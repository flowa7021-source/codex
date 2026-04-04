// @ts-check
// ─── PDF → DjVu Converter ────────────────────────────────────────────────────
// Converts PDF pages to a multi-page DjVu document using the IW44 wavelet
// encoder built into the DjVu.js library already bundled with the app.
//
// Architecture:
//   pdf.js renders each page to an HTMLCanvasElement at the target DPI.
//   DjVu.Worker (via DjVu.js) encodes each page's ImageData as an IW44 chunk
//   and assembles a standards-compliant DJVM multi-page file.
//
// Quality profiles (IW44 slice count ≈ pdf2djvu --bg-slices sum):
//   compact  →  83 slices  (72+11)              ~40% size of balanced
//   balanced → 103 slices  (72+11+10+10)         recommended
//   quality  → 111 slices  (72+11+10+10+8)       high quality
//   archive  → 119 slices  (72+11+10+10+8+8)     near-lossless

import { ensureDjVuJs } from './loaders.js';

// ── Quality profiles ──────────────────────────────────────────────────────────

/** @type {Record<string, {slices: number, dpi: number, grayscale: number}>} */
const PROFILES = {
  compact:  { slices: 83,  dpi: 200, grayscale: 0 },
  balanced: { slices: 103, dpi: 300, grayscale: 0 },
  quality:  { slices: 111, dpi: 300, grayscale: 0 },
  archive:  { slices: 119, dpi: 400, grayscale: 0 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a page-range string like "1-5,8,10-12" into a sorted array of
 * 1-based page numbers clamped to [1, maxPage].
 * @param {string} str
 * @param {number} maxPage
 * @returns {number[]}
 */
function parsePageRange(str, maxPage) {
  /** @type {Set<number>} */
  const pages = new Set();
  for (const part of str.split(',')) {
    const t = part.trim();
    if (!t) continue;
    const dash = t.indexOf('-');
    if (dash >= 0) {
      const lo = Math.max(1, parseInt(t.slice(0, dash), 10));
      const hi = Math.min(maxPage, parseInt(t.slice(dash + 1), 10));
      if (!isNaN(lo) && !isNaN(hi)) {
        for (let p = lo; p <= hi; p++) pages.add(p);
      }
    } else {
      const n = parseInt(t, 10);
      if (!isNaN(n) && n >= 1 && n <= maxPage) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

/**
 * Patch the DPI field inside every INFO chunk in a DJVM byte array.
 *
 * DjVu.js IWImageWriter hardcodes DPI=100 in the INFO chunk.
 * INFO layout (relative to start of "INFO" token):
 *   [0-3]  "INFO"
 *   [4-7]  chunk size (big-endian int32 = 10)
 *   [8-9]  page width  (big-endian uint16)
 *   [10-11] page height (big-endian uint16)
 *   [12]   minor version
 *   [13]   major version
 *   [14]   DPI low byte  (little-endian!)
 *   [15]   DPI high byte
 *   [16]   gamma
 *   [17]   flags
 *
 * We search for the specific "DJVU" + "INFO" sequence so we only match page
 * chunks, not accidental "INFO" bytes inside compressed data.
 *
 * @param {Uint8Array} buf
 * @param {number} dpi
 * @returns {Uint8Array}
 */
function patchDpiInBuffer(buf, dpi) {
  const lo = dpi & 0xFF;
  const hi = (dpi >> 8) & 0xFF;

  // Look for "DJVU" (0x44 0x4A 0x56 0x55); the very next 4 bytes are "INFO"
  for (let i = 0; i + 18 < buf.length; i++) {
    if (buf[i]   === 0x44 && buf[i+1] === 0x4A &&
        buf[i+2] === 0x56 && buf[i+3] === 0x55) {
      // "DJVU" found at i. INFO chunk begins at i+4.
      const inf = i + 4;
      if (buf[inf]   === 0x49 && buf[inf+1] === 0x4E &&
          buf[inf+2] === 0x46 && buf[inf+3] === 0x4F) {
        // Confirmed INFO chunk. DPI bytes at inf + 14 and inf + 15.
        buf[inf + 14] = lo;
        buf[inf + 15] = hi;
      }
    }
  }
  return buf;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DjvuConvertOptions
 * @property {'compact'|'balanced'|'quality'|'archive'} [quality='balanced']
 * @property {string} [pageRange]  e.g. "1-5,8"
 * @property {(current: number, total: number, stage: string) => void} [onProgress]
 */

/**
 * @typedef {Object} DjvuConvertResult
 * @property {Blob}   blob
 * @property {number} pageCount
 * @property {{ pageCount: number, dpi: number, slices: number, quality: string }} stats
 */

/**
 * Convert a PDF to a multi-page DjVu file.
 *
 * The conversion uses DjVu.js's built-in IW44 wavelet encoder:
 *   - PDF pages are rendered at target DPI via pdf.js
 *   - Each page's ImageData is streamed into the DjVu.Worker encoder
 *   - The worker assembles a DJVM (bundled multi-page) file
 *   - DPI metadata is patched from the hardcoded 100 DPI to the target value
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {DjvuConvertOptions} [options]
 * @returns {Promise<DjvuConvertResult>}
 */
export async function convertPdfToDjvu(pdfBytes, options = {}) {
  const {
    quality = 'balanced',
    pageRange,
    onProgress,
  } = options;

  const profile = PROFILES[quality] || PROFILES.balanced;
  // PDF native unit = 72 pt/inch → scale to target DPI
  const renderScale = profile.dpi / 72;

  // ── 1. Load PDF via pdf.js ─────────────────────────────────────────────────
  const pdfjsMod = await import('pdfjs-dist');
  const getDocument = pdfjsMod.getDocument || pdfjsMod.default?.getDocument;
  const rawBytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await getDocument({ data: rawBytes }).promise;
  const totalPages = pdfDoc.numPages;

  const pages = pageRange
    ? parsePageRange(pageRange, totalPages)
    : Array.from({ length: totalPages }, (_, i) => i + 1);
  const total = pages.length;
  if (total === 0) throw new Error('No pages to convert');

  // ── 2. Load DjVu.js and start encoder worker ──────────────────────────────
  const DjVu = await ensureDjVuJs();
  const worker = new DjVu.Worker();

  let pagesEncoded = 0;

  try {
    // Streaming API: one page at a time → constant memory usage
    await worker.startMultiPageDocument(profile.slices, 0, profile.grayscale);

    // ── 3. Render each page and stream into the encoder ─────────────────────
    for (let idx = 0; idx < total; idx++) {
      const pageNum = pages[idx];
      if (onProgress) onProgress(idx + 1, total, 'Рендеринг');

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });
      const w = Math.round(viewport.width);
      const h = Math.round(viewport.height);

      if (w <= 0 || h <= 0) continue;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      // White background so transparent PDFs render correctly
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const imageData = ctx.getImageData(0, 0, w, h);

      // Free canvas memory before transferring ImageData to worker
      canvas.width = 0;
      canvas.height = 0;

      // addPageToDocument transfers imageData.data.buffer to the worker
      // (the buffer is detached in the main thread after this call)
      if (onProgress) onProgress(idx + 1, total, 'Кодирование IW44');
      await worker.addPageToDocument(imageData);
      pagesEncoded++;
    }

    if (pagesEncoded === 0) throw new Error('No pages were rendered');

    // ── 4. Finalize the DJVM document ─────────────────────────────────────
    if (onProgress) onProgress(total, total, 'Сборка DjVu');
    const buffer = await worker.endMultiPageDocument();

    // Patch DPI metadata: IWImageWriter hardcodes 100 DPI in INFO chunks
    const djvuBytes = patchDpiInBuffer(new Uint8Array(buffer), profile.dpi);

    return {
      blob: new Blob([djvuBytes], { type: 'image/vnd.djvu' }),
      pageCount: pagesEncoded,
      stats: {
        pageCount: pagesEncoded,
        dpi: profile.dpi,
        slices: profile.slices,
        quality,
      },
    };
  } finally {
    worker.terminate();
  }
}
