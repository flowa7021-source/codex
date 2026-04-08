// @ts-check
// ─── PDF Oxide Fast Text Extractor ─────────────────────────────────────────
// Uses pdf-oxide-wasm (Rust/WASM via pdf_oxide) for near-native-speed PDF
// text extraction as a fast alternative to PDF.js getTextContent().
//
// Advantages over PDF.js:
//   • ~10-50× faster for text-heavy documents (Rust core vs JS)
//   • `toMarkdown()` output preserves more structure
//   • `search()` is native full-text search (no per-page JS iteration)
//   • `extractLines()` / `extractWords()` provide structured positional data
//
// Availability:
//   • Node.js / Tauri: works out of the box (WASM loaded via readFileSync)
//   • Browser (Vite): works when Vite bundles the WASM (optimizeDeps.include)
//   • Falls back silently to null if the module cannot be imported
//
// Usage:
//   import { isAvailable, extractPageText, extractMarkdown, searchText }
//     from './pdf-oxide-extractor.js';
//
//   if (await isAvailable()) {
//     const text = await extractPageText(pdfBytes, 1);
//   }

// ─── Lazy WASM loader ────────────────────────────────────────────────────────

/** @type {any|null} */
let _mod = null;
let _loading = false;
/** @type {Array<(m: any|null) => void>} */
const _waiters = [];

/**
 * Lazily import pdf-oxide-wasm. Returns the module or null if unavailable.
 * @returns {Promise<any|null>}
 */
async function _loadMod() {
  if (_mod !== null) return _mod;
  if (_loading) return new Promise(res => _waiters.push(res));

  _loading = true;
  try {
    const mod = await import('pdf-oxide-wasm');
    _mod = mod;
    _waiters.forEach(r => r(_mod));
    return _mod;
  } catch (err) {
    console.warn('[pdf-oxide] pdf-oxide-wasm unavailable:', /** @type {Error} */ (err).message);
    _waiters.forEach(r => r(null));
    return null;
  } finally {
    _loading = false;
    _waiters.length = 0;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if pdf-oxide-wasm is available in this environment.
 * Result is cached after the first call.
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  return (await _loadMod()) !== null;
}

/**
 * Warm up the WASM module in the background.
 * Call once after a document is opened so the first extraction doesn't pay
 * the module initialisation cost.
 */
export function warmupPdfOxide() {
  _loadMod().catch(() => {});
}

/**
 * Extract plain text from a single page using pdf-oxide-wasm.
 * Returns null if the module is unavailable.
 *
 * @param {Uint8Array} pdfBytes - Full PDF file bytes
 * @param {number} pageNum - 1-indexed page number
 * @returns {Promise<string|null>}
 */
export async function extractPageText(pdfBytes, pageNum) {
  const mod = await _loadMod();
  if (!mod) return null;

  let doc;
  try {
    doc = new mod.WasmPdfDocument(pdfBytes);
    // pdf-oxide uses 0-based page index
    return doc.toPlainText(pageNum - 1) ?? null;
  } catch (_e) {
    return null;
  } finally {
    doc?.free();
  }
}

/**
 * Extract plain text from all pages at once.
 * More efficient than extractPageText() in a loop for large documents.
 * Returns null if the module is unavailable.
 *
 * @param {Uint8Array} pdfBytes
 * @returns {Promise<string|null>}
 */
export async function extractAllText(pdfBytes) {
  const mod = await _loadMod();
  if (!mod) return null;

  let doc;
  try {
    doc = new mod.WasmPdfDocument(pdfBytes);
    return doc.toPlainTextAll() ?? null;
  } catch (_e) {
    return null;
  } finally {
    doc?.free();
  }
}

/**
 * Extract Markdown-formatted text from a single page.
 * Preserves headings, tables, lists, and code blocks.
 *
 * @param {Uint8Array} pdfBytes
 * @param {number} pageNum - 1-indexed
 * @param {object} [opts]
 * @param {boolean} [opts.detectHeadings=true]
 * @param {boolean} [opts.includeImages=false]
 * @returns {Promise<string|null>}
 */
export async function extractMarkdown(pdfBytes, pageNum, opts = {}) {
  const { detectHeadings = true, includeImages = false } = opts;
  const mod = await _loadMod();
  if (!mod) return null;

  let doc;
  try {
    doc = new mod.WasmPdfDocument(pdfBytes);
    return doc.toMarkdown(pageNum - 1, detectHeadings, includeImages, false) ?? null;
  } catch (_e) {
    return null;
  } finally {
    doc?.free();
  }
}

/**
 * Extract Markdown from all pages.
 * @param {Uint8Array} pdfBytes
 * @param {object} [opts]
 * @param {boolean} [opts.detectHeadings=true]
 * @returns {Promise<string|null>}
 */
export async function extractMarkdownAll(pdfBytes, opts = {}) {
  const { detectHeadings = true } = opts;
  const mod = await _loadMod();
  if (!mod) return null;

  let doc;
  try {
    doc = new mod.WasmPdfDocument(pdfBytes);
    return doc.toMarkdownAll(detectHeadings, false, false) ?? null;
  } catch (_e) {
    return null;
  } finally {
    doc?.free();
  }
}

/**
 * @typedef {object} SearchResult
 * @property {number} page      - 0-indexed page number
 * @property {string} text      - Matching text snippet
 * @property {any}   bbox      - Bounding box
 * @property {number} start_index
 * @property {number} end_index
 */

/**
 * Full-text search across all pages via pdf-oxide-wasm.
 * Much faster than iterating pages with indexOf for large documents.
 *
 * @param {Uint8Array} pdfBytes
 * @param {string} query
 * @param {object} [opts]
 * @param {boolean} [opts.caseSensitive=false]
 * @returns {Promise<SearchResult[]>}
 */
export async function searchText(pdfBytes, query, opts = {}) {
  const { caseSensitive = false } = opts;
  if (!query) return [];

  const mod = await _loadMod();
  if (!mod) return [];

  let doc;
  try {
    doc = new mod.WasmPdfDocument(pdfBytes);
    const results = doc.search(query, !caseSensitive) ?? [];
    return /** @type {SearchResult[]} */ (Array.isArray(results) ? results : []);
  } catch (_e) {
    return [];
  } finally {
    doc?.free();
  }
}

/**
 * Get the page count for a PDF using pdf-oxide-wasm.
 * Faster than PDF.js for this simple operation.
 *
 * @param {Uint8Array} pdfBytes
 * @returns {Promise<number|null>}
 */
export async function getPageCount(pdfBytes) {
  const mod = await _loadMod();
  if (!mod) return null;

  let doc;
  try {
    doc = new mod.WasmPdfDocument(pdfBytes);
    return doc.pageCount();
  } catch (_e) {
    return null;
  } finally {
    doc?.free();
  }
}
