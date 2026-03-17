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
 * @returns {Promise<boolean>}
 */
export async function isTesseractAvailable() {
  if (_available !== null) return _available;
  try {
    const resp = await fetch(PATHS.workerJs, { method: 'HEAD', cache: 'force-cache' });
    _available = resp.ok;
  } catch {
    _available = false;
  }
  return _available;
}

/**
 * Dynamically import Tesseract.js ESM module from vendor.
 */
async function loadTesseractModule() {
  const esmPath = resolveVendorPath('../vendor/tesseract/tesseract.esm.min.js');
  const mod = await import(/* webpackIgnore: true */ esmPath);
  return mod;
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
        await _worker.terminate();
        _worker = null;
        _currentLang = null;
      }

      const Tesseract = await loadTesseractModule();
      const corePath = hasSIMD() ? PATHS.coreSimdLstm : PATHS.coreLstm;

      _worker = await Tesseract.createWorker(tessLang, 1, {
        workerPath: PATHS.workerJs,
        corePath: corePath,
        langPath: PATHS.langDataDir,
        cacheMethod: 'none', // Don't use IndexedDB cache — load from local files
        gzip: false, // Our traineddata files are not gzipped
      });

      _currentLang = tessLang;
      _available = true;
      return true;
    } catch (err) {
      console.warn('Tesseract init failed:', err);
      _worker = null;
      _currentLang = null;
      _available = false;
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
  };
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
