// ─── Tesseract.js Adapter ────────────────────────────────────────────────────
// High-quality OCR engine adapter. Runs Tesseract.js entirely offline using
// bundled WASM core and local traineddata files (no network calls).
//
// Usage: await initTesseract('rus'); const text = await recognizeTesseract(canvas);

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

// Resolve local paths relative to this module
function resolveVendorPath(relativePath) {
  try {
    return new URL(relativePath, import.meta.url).href;
  } catch {
    return relativePath;
  }
}

const PATHS = {
  workerJs: resolveVendorPath('../vendor/tesseract/worker.min.js'),
  coreSimdLstm: resolveVendorPath('../vendor/tesseract/tesseract-core-simd-lstm.wasm.js'),
  coreLstm: resolveVendorPath('../vendor/tesseract/tesseract-core-lstm.wasm.js'),
  langDataDir: resolveVendorPath('../vendor/tesseract/lang-data'),
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
  auto: 'eng+rus', // multi-language mode for auto
};

/**
 * Check if Tesseract.js files are available locally.
 * Handles file:// protocol (Electron) where HEAD requests and fetch may behave
 * differently than HTTP.
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
  } catch { /* continue to next strategy */ }

  // Strategy 2: HTTP HEAD check (works on http/https only)
  try {
    const resp = await fetch(PATHS.workerJs, { method: 'HEAD', cache: 'force-cache' });
    if (resp.ok) { _available = true; return true; }
  } catch { /* ignore */ }

  // Module/files truly not found — mark unavailable
  _available = false;
  return false;
}

/**
 * Dynamically import Tesseract.js ESM module from vendor.
 * Module is cached after first successful load.
 */
let _tesseractModule = null;
async function loadTesseractModule() {
  if (_tesseractModule) return _tesseractModule;
  const esmPath = resolveVendorPath('../vendor/tesseract/tesseract.esm.min.js');
  const mod = await import(/* webpackIgnore: true */ esmPath);
  // The ESM bundle wraps the CommonJS module as a default export:
  //   export { tesseract_min as default }
  // So mod = { default: { createWorker, createScheduler, ... } }
  // We need the default export to access createWorker.
  const resolved = mod.default || mod;
  if (typeof resolved.createWorker !== 'function') {
    // Last resort: check if createWorker is nested one more level (e.g. mod.default.default)
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
 * Detect SIMD support in the browser.
 */
function hasSIMD() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
      3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]));
  } catch {
    return false;
  }
}

/**
 * Initialize Tesseract worker with a specific language.
 * All resources loaded from local vendor/ — no network calls.
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
        try { await _worker.terminate(); } catch { /* ignore */ }
        _worker = null;
        _currentLang = null;
      }

      const Tesseract = await loadTesseractModule();
      const corePath = hasSIMD() ? PATHS.coreSimdLstm : PATHS.coreLstm;

      const workerOpts = {
        workerPath: PATHS.workerJs,
        corePath: corePath,
        langPath: PATHS.langDataDir,
        cacheMethod: 'none', // Don't use IndexedDB cache — load from local files
        gzip: false, // Our traineddata files are not gzipped
        // workerBlobURL: false is CRITICAL for Electron (file:// protocol).
        // Default true creates a blob:-origin worker that cannot importScripts
        // from file:// URLs, causing silent init failures.
        workerBlobURL: false,
      };

      try {
        _worker = await Tesseract.createWorker(tessLang, 1, workerOpts);
      } catch (primaryErr) {
        // If multi-language (e.g. 'eng+rus') fails, try falling back to first language
        if (tessLang.includes('+')) {
          const fallbackLang = tessLang.split('+')[0];
          console.warn(`Tesseract multi-lang "${tessLang}" failed, trying "${fallbackLang}":`, primaryErr?.message);
          _worker = await Tesseract.createWorker(fallbackLang, 1, workerOpts);
        } else {
          throw primaryErr;
        }
      }

      _currentLang = tessLang;
      _available = true;
      _initFailCount = 0; // reset on success
      _lastInitError = '';
      _lastFailTime = 0;

      // Configure Tesseract parameters for higher quality recognition
      try {
        await _worker.setParameters({
          tessedit_pageseg_mode: '6',    // Assume a single uniform block of text
          preserve_interword_spaces: '1', // Keep spaces between words
          textord_heavy_nr: '1',         // Heavy noise removal
          tessedit_do_invert: '0',       // Don't try inverted (we handle it ourselves)
        });
      } catch { /* setParameters may not be supported in all versions */ }

      return true;
    } catch (err) {
      _initFailCount++;
      _lastInitError = String(err?.message || err || 'unknown error');
      _lastFailTime = performance.now();
      console.warn(`Tesseract init failed (attempt ${_initFailCount}/${MAX_INIT_RETRIES}):`, _lastInitError);
      _worker = null;
      _currentLang = null;
      // Don't set _available = false here — the module exists, only worker creation failed.
      // _available tracks whether the Tesseract MODULE is present, not whether createWorker succeeded.
      return false;
    } finally {
      _initializing = false;
    }
  })();

  return _initPromise;
}

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
    initFailCount: _initFailCount,
    lastError: _lastInitError,
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
    try { await _worker.terminate(); } catch { /* ignore */ }
    _worker = null;
    _currentLang = null;
  }
}

/**
 * Get list of locally available language files.
 * @returns {string[]}
 */
export function getAvailableTesseractLangs() {
  return Object.keys(LANG_MAP);
}
