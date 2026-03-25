// @ts-check
// ─── Tesseract.js Adapter ────────────────────────────────────────────────────
// High-quality OCR engine adapter. Runs Tesseract.js entirely offline using
// bundled WASM core and local traineddata files (no network calls).
//
// Import strategy:
//   - The Tesseract.js ESM entry point is loaded from the `tesseract.js` npm
//     package (node_modules/tesseract.js/dist/tesseract.esm.min.js).
//   - The web-worker script is loaded from `tesseract.js` npm dist as well.
//   - WASM core files come from the `tesseract.js-core` npm package
//     (dependency of tesseract.js, installed in node_modules).
//   - Language traineddata files remain in app/vendor/tesseract/lang-data
//     since they are project-specific offline bundles not published to npm.
//
// Supports both single-worker mode (for on-demand page OCR) and parallel
// scheduler mode (for background multi-page scanning).
//
// Usage: await initTesseract('rus'); const text = await recognizeTesseract(canvas);
// Pool:  await initTesseractPool('rus', 4); const text = await recognizeWithPool(canvas);

let _worker = null;
let _currentLang = null;
let _initializing = false;
let _initPromise = null;
let _available = null; // null = not checked, true/false
let _initFailCount = 0; // track consecutive init failures for backoff
let _lastInitError = ''; // last error message for diagnostics
let _lastFailTime = 0; // timestamp of last failure for cooldown
const MAX_INIT_RETRIES = 3; // max retries before giving up for this session
const INIT_FAIL_COOLDOWN_MS = 5000; // minimum delay between retry attempts after failure

// ─── Progress callback for Tesseract recognition ────────────────────────────
// Set via setTesseractProgressCallback() before recognition to receive
// real-time progress updates from the Tesseract worker (0-100%).
/** @type {((progress: number, status: string) => void) | null} */
let _progressCallback = null;

/**
 * Set a callback that receives Tesseract recognition progress updates.
 * Pass `null` to clear.
 * @param {((progress: number, status: string) => void) | null} cb
 */
export function setTesseractProgressCallback(cb) {
  _progressCallback = cb;
}

// ─── Worker Pool (Scheduler) state ──────────────────────────────────────────
let _scheduler = null;
let _poolWorkers = [];
let _poolLang = null;
let _poolSize = 0;
let _poolInitializing = false;
let _poolInitPromise = null;

// Resolve local paths relative to this module
function resolveVendorPath(relativePath) {
  try {
    return new URL(relativePath, import.meta.url).href;
  } catch (err) {
    console.warn('[ocr] error:', err?.message);
    return relativePath;
  }
}

/**
 * Resolve a path under the public vendor/tesseract directory.
 * In dev mode, Vite serves `app/public/` at the root.
 * In production, these files are copied to `dist/vendor/tesseract/`.
 * Uses document baseURI so it works on any origin (http, tauri.localhost, file://).
 */
function resolvePublicTesseractPath(filename) {
  try {
    const base = (typeof document !== 'undefined' && document.baseURI) || import.meta.url;
    return new URL(`vendor/tesseract/${filename}`, base).href;
  } catch {
    return `vendor/tesseract/${filename}`;
  }
}

// Worker and core files are served from app/public/vendor/tesseract/ so they
// load from the app's own origin — no external CDN requests.
// Language data stays in app/vendor/tesseract/lang-data (bundled by Vite).
const PATHS = {
  langDataDir: resolveVendorPath('../vendor/tesseract/lang-data'),
  workerPath: resolvePublicTesseractPath('worker.min.js'),
  corePath: resolvePublicTesseractPath(''),
};

// Map our lang codes to Tesseract lang codes
const LANG_MAP = {
  rus: 'rus',
  eng: 'eng',
  deu: 'deu',
  fra: 'fra',
  spa: 'spa',
  ita: 'ita',
  por: 'por',
  chi_sim: 'chi_sim',
  chi_tra: 'chi_tra',
  jpn: 'jpn',
  kor: 'kor',
  ara: 'ara',
  hin: 'hin',
  tur: 'tur',
  pol: 'pol',
  ces: 'ces',
  ukr: 'ukr',
  bel: 'bel',
  nld: 'nld',
  swe: 'swe',
  nor: 'nor',
  fin: 'fin',
  ell: 'ell',
  heb: 'heb',
  vie: 'vie',
  tha: 'tha',
  ron: 'ron',
  bul: 'bul',
  auto: 'eng+rus', // multi-language mode for auto
};

/**
 * Check if Tesseract.js files are available locally.
 * Handles custom protocols (Tauri, file://) where HEAD requests and fetch may
 * behave differently than HTTP.
 * @returns {Promise<boolean>}
 */
export async function isTesseractAvailable() {
  // If permanently failed after MAX_INIT_RETRIES, give up
  if (_available === false && _initFailCount >= MAX_INIT_RETRIES) return false;

  // If already confirmed available (module loaded OK), return true
  if (_available === true) return true;

  // Strategy 1: Try to load the ESM module directly (works on all protocols)
  try {
    await loadTesseractModule();
    _available = true;
    return true;
  } catch (err) { console.warn('[ocr] error:', err?.message); }

  // Strategy 2: HTTP HEAD check for lang-data dir (works on http/https only)
  try {
    const resp = await fetch(PATHS.langDataDir, { method: 'HEAD', cache: 'force-cache' });
    if (resp.ok) { _available = true; return true; }
  } catch (err) { console.warn('[ocr] error:', err?.message); }

  // Module/files truly not found — mark unavailable
  _available = false;
  return false;
}

/**
 * Dynamically import Tesseract.js ESM module from npm package.
 * Module is cached after first successful load.
 */
let _tesseractModule = null;
async function loadTesseractModule() {
  if (_tesseractModule) return _tesseractModule;
  // Load Tesseract.js ESM entry via bare specifier (resolved by Vite to chunk).
  const mod = await import('tesseract.js');
  // The ESM bundle wraps the CommonJS module as a default export:
  //   export { tesseract_min as default }
  // So mod = { default: { createWorker, createScheduler, ... } }
  // We need the default export to access createWorker.
  // @ts-ignore — dynamic import may return { default: ... } wrapper
  const resolved = mod.default || mod;
  if (typeof resolved.createWorker !== 'function') {
    // Last resort: check if createWorker is nested one more level (e.g. mod.default.default)
    // @ts-ignore
    const deeper = resolved.default || resolved;
    if (typeof deeper.createWorker === 'function') {
      _tesseractModule = deeper;
      return deeper;
    }
    throw new Error(`Tesseract module loaded but createWorker not found. Keys: ${Object.keys(resolved).join(', ')}`);
  }
  _tesseractModule = resolved;
  return resolved;
}

/**
 * Common worker creation options.
 * Exported so other modules (e.g. batch-ocr-editor) can create workers that
 * load from the local origin instead of a CDN.
 * @returns {{ workerPath: string, corePath: string, langPath: string, workerBlobURL: boolean, cacheMethod: string, gzip: boolean }}
 */
export function getTesseractWorkerOpts() {
  return {
    workerPath: PATHS.workerPath,
    corePath: PATHS.corePath,
    langPath: PATHS.langDataDir,
    workerBlobURL: true,
    cacheMethod: 'none',
    gzip: false,
  };
}

/**
 * Create a single Tesseract worker with language fallback.
 * @param {object} Tesseract - loaded Tesseract module
 * @param {string} tessLang - Tesseract language string
 * @param {object} workerOpts - worker creation options
 * @returns {Promise<object>} created worker
 */
async function _createWorkerWithFallback(Tesseract, tessLang, workerOpts) {
  const optsWithLogger = {
    ...workerOpts,
    logger: (m) => {
      if (_progressCallback && m && m.status === 'recognizing text' && typeof m.progress === 'number') {
        _progressCallback(Math.round(m.progress * 100), m.status);
      }
    },
  };
  try {
    return await Tesseract.createWorker(tessLang, 1, optsWithLogger);
  } catch (primaryErr) {
    if (tessLang.includes('+')) {
      const fallbackLang = tessLang.split('+')[0];
      console.warn(`Tesseract multi-lang "${tessLang}" failed, trying "${fallbackLang}":`, primaryErr?.message);
      return await Tesseract.createWorker(fallbackLang, 1, optsWithLogger);
    }
    throw primaryErr;
  }
}

/**
 * Configure a worker with optimal OCR parameters.
 */
async function _configureWorker(worker) {
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      textord_heavy_nr: '1',
      tessedit_do_invert: '0',
    });
  } catch (err) { console.warn('[ocr] error:', err?.message); }
}

/**
 * Initialize Tesseract worker with a specific language.
 * All resources loaded locally — no network calls.
 * @param {string} lang - language code (rus, eng, deu, fra, spa, ita, por, auto)
 * @returns {Promise<boolean>} true if initialized successfully
 */
export async function initTesseract(lang = 'eng') {
  const tessLang = LANG_MAP[lang] || lang;

  // If already initialized with the same language, reuse
  if (_worker && _currentLang === tessLang) return true;

  // If too many consecutive failures, don't retry
  if (_initFailCount >= MAX_INIT_RETRIES) return false;

  // Cooldown: don't spam retries immediately after a failure
  if (_lastFailTime > 0 && (performance.now() - _lastFailTime) < INIT_FAIL_COOLDOWN_MS) {
    return false;
  }

  // If currently initializing, wait for it
  if (_initializing && _initPromise) {
    await _initPromise;
    if (_currentLang === tessLang) return true;
  }

  _initializing = true;
  _initPromise = (async () => {
    try {
      // Terminate previous worker if switching language
      if (_worker) {
        try { await _worker.terminate(); } catch (err) { console.warn('[ocr] error:', err?.message); }
        _worker = null;
        _currentLang = null;
      }

      const Tesseract = await loadTesseractModule();
      const workerOpts = getTesseractWorkerOpts();

      _worker = await _createWorkerWithFallback(Tesseract, tessLang, workerOpts);
      _currentLang = tessLang;
      _available = true;
      _initFailCount = 0;
      _lastInitError = '';
      _lastFailTime = 0;

      await _configureWorker(_worker);
      return true;
    } catch (err) {
      _initFailCount++;
      _lastInitError = String(err?.message || err || 'unknown error');
      _lastFailTime = performance.now();
      console.warn(`Tesseract init failed (attempt ${_initFailCount}/${MAX_INIT_RETRIES}):`, _lastInitError);
      _worker = null;
      _currentLang = null;
      return false;
    } finally {
      _initializing = false;
    }
  })();

  return _initPromise;
}

// ─── Worker Pool (Scheduler) ────────────────────────────────────────────────

/**
 * Get the recommended pool size based on hardware.
 * @returns {number}
 */
export function getRecommendedPoolSize() {
  const cores = navigator.hardwareConcurrency || 2;
  // Use at most half the cores (min 2, max 4) to avoid starving the UI thread
  return Math.max(2, Math.min(4, Math.floor(cores / 2)));
}

/**
 * Initialize a pool of Tesseract workers managed by a scheduler.
 * The scheduler automatically distributes recognition jobs across workers.
 * @param {string} lang - language code
 * @param {number} [size] - number of workers (defaults to getRecommendedPoolSize())
 * @returns {Promise<boolean>} true if pool initialized successfully
 */
export async function initTesseractPool(lang = 'eng', size) {
  const tessLang = LANG_MAP[lang] || lang;
  const targetSize = size || getRecommendedPoolSize();

  // Already initialized with same config
  if (_scheduler && _poolLang === tessLang && _poolSize === targetSize) return true;

  if (_initFailCount >= MAX_INIT_RETRIES) return false;
  if (_lastFailTime > 0 && (performance.now() - _lastFailTime) < INIT_FAIL_COOLDOWN_MS) return false;

  // Wait for in-progress initialization
  if (_poolInitializing && _poolInitPromise) {
    await _poolInitPromise;
    if (_poolLang === tessLang && _poolSize === targetSize) return true;
  }

  _poolInitializing = true;
  _poolInitPromise = (async () => {
    try {
      // Tear down existing pool
      await terminateTesseractPool();

      const Tesseract = await loadTesseractModule();
      if (typeof Tesseract.createScheduler !== 'function') {
        console.warn('Tesseract.createScheduler not available, falling back to single worker');
        return await initTesseract(lang);
      }

      const workerOpts = getTesseractWorkerOpts();
      const scheduler = Tesseract.createScheduler();
      const workers = [];

      for (let i = 0; i < targetSize; i++) {
        const w = await _createWorkerWithFallback(Tesseract, tessLang, workerOpts);
        await _configureWorker(w);
        scheduler.addWorker(w);
        workers.push(w);
      }

      _scheduler = scheduler;
      _poolWorkers = workers;
      _poolLang = tessLang;
      _poolSize = targetSize;
      _available = true;
      _initFailCount = 0;
      _lastInitError = '';
      _lastFailTime = 0;

      console.info(`[tesseract] Pool initialized: ${targetSize} workers, lang="${tessLang}"`);
      return true;
    } catch (err) {
      _initFailCount++;
      _lastInitError = String(err?.message || err || 'unknown error');
      _lastFailTime = performance.now();
      console.warn(`Tesseract pool init failed (attempt ${_initFailCount}/${MAX_INIT_RETRIES}):`, _lastInitError);
      await terminateTesseractPool();
      return false;
    } finally {
      _poolInitializing = false;
    }
  })();

  return _poolInitPromise;
}

/**
 * Recognize text using the scheduler pool.
 * Falls back to single worker if pool is not initialized.
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @returns {Promise<{ text: string, confidence: number, words: Array }>}
 */
export async function recognizeWithPool(canvas, options = {}) {
  if (!_scheduler) {
    // Fall back to single worker
    return recognizeTesseract(canvas, options);
  }

  try {
    const result = await _scheduler.addJob('recognize', canvas);
    const text = result?.data?.text || '';
    const confidence = result?.data?.confidence || 0;
    const words = (result?.data?.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));
    return { text: text.trim(), confidence, words };
  } catch (err) {
    console.warn('Tesseract pool recognize error:', err);
    const errMsg = String(err?.message || err || '');
    if (errMsg.includes('terminated') || errMsg.includes('Worker') || errMsg.includes('disposed') || errMsg.includes('dead')) {
      // Pool is broken — tear it down
      await terminateTesseractPool();
      _lastInitError = `pool recognize failed: ${errMsg}`;
    }
    return { text: '', confidence: 0, words: [] };
  }
}

/**
 * Check if the pool is active and ready.
 * @returns {boolean}
 */
export function isTesseractPoolReady() {
  return !!_scheduler && _poolWorkers.length > 0;
}

/**
 * Terminate all pool workers and the scheduler.
 */
export async function terminateTesseractPool() {
  if (_scheduler) {
    try { _scheduler.terminate(); } catch (err) { console.warn('[ocr] error:', err?.message); }
    _scheduler = null;
  }
  for (const w of _poolWorkers) {
    try { await w.terminate(); } catch (err) { console.warn('[ocr] error:', err?.message); }
  }
  _poolWorkers = [];
  _poolLang = null;
  _poolSize = 0;
}

// ─── Single Worker Recognition ──────────────────────────────────────────────

/**
 * Recognize text from a canvas using Tesseract.js.
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {string} [options.lang] - override language
 * @returns {Promise<{ text: string, confidence: number, words: Array }>}
 */
export async function recognizeTesseract(canvas, options = {}) {
  const lang = options.lang || _currentLang || 'eng';
  const tessLang = LANG_MAP[lang] || lang;

  if (!_worker || _currentLang !== tessLang) {
    const ok = await initTesseract(lang);
    if (!ok) return { text: '', confidence: 0, words: [] };
  }

  try {
    const result = await _worker.recognize(canvas);
    const text = result?.data?.text || '';
    const confidence = result?.data?.confidence || 0;

    // Extract word-level data if available
    const words = (result?.data?.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));

    return { text: text.trim(), confidence, words };
  } catch (err) {
    console.warn('Tesseract recognize error:', err);
    // Worker may have crashed — reset so next call re-initializes
    const errMsg = String(err?.message || err || '');
    if (errMsg.includes('terminated') || errMsg.includes('Worker') || errMsg.includes('disposed') || errMsg.includes('dead')) {
      _worker = null;
      _currentLang = null;
      _lastInitError = `recognize failed: ${errMsg}`;
    }
    return { text: '', confidence: 0, words: [] };
  }
}

/**
 * Recognize text and return word-level bounding boxes.
 * Useful for overlay rendering and word highlighting.
 * @param {HTMLCanvasElement} canvas
 * @param {string} [lang]
 * @returns {Promise<Array<{ text: string, confidence: number, bbox: {x0,y0,x1,y1} }>>}
 */
export async function recognizeWithBoxes(canvas, lang) {
  const result = await recognizeTesseract(canvas, { lang });
  return result.words;
}

/**
 * Get current Tesseract engine status.
 * @returns {{ ready: boolean, lang: string|null, available: boolean|null }}
 */
export function getTesseractStatus() {
  return {
    ready: !!_worker && !!_currentLang,
    lang: _currentLang,
    available: _available,
// @ts-ignore
    initFailCount: _initFailCount,
    lastError: _lastInitError,
    poolReady: isTesseractPoolReady(),
    poolSize: _poolSize,
  };
}

/**
 * Reset availability flag so Tesseract can be retried.
 * Useful after a file-open or settings change.
 */
export function resetTesseractAvailability() {
  _initFailCount = 0;
  _lastInitError = '';
  _lastFailTime = 0;
  // Only reset _available if it was set to false due to init failure
  // (keep null or true as-is)
  if (_available === false) _available = null;
}

/**
 * Terminate the Tesseract worker and free resources.
 */
export async function terminateTesseract() {
  if (_worker) {
    try { await _worker.terminate(); } catch (err) { console.warn('[ocr] error:', err?.message); }
    _worker = null;
    _currentLang = null;
  }
  await terminateTesseractPool();
}

/**
 * Get list of locally available language files.
 * @returns {string[]}
 */
export function getAvailableTesseractLangs() {
  return Object.keys(LANG_MAP);
}

/**
 * Create (or reuse) a Tesseract worker for the given language and return
 * a thin proxy that exposes the raw `recognize` method.
 * Used by ocr-char-layer's _defaultWorkerFactory fallback.
 * @param {string} [lang='eng']
 * @returns {Promise<{ recognize: (canvas: HTMLCanvasElement) => Promise<any> }>}
 */
export async function createTesseractWorker(lang = 'eng') {
  const ok = await initTesseract(lang);
  if (!ok) throw new Error(`[tesseract-adapter] failed to init worker for lang="${lang}"`);
  return { recognize: (canvas) => _worker.recognize(canvas) };
}
