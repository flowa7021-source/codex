// @ts-check
// ─── PDF → DjVu Converter ────────────────────────────────────────────────────
// Converts PDF pages to a multi-page DjVu document using the IW44 wavelet
// encoder built into the DjVu.js library already bundled with the app.
//
// Architecture:
//   pdf.js renders each page to an HTMLCanvasElement at the target DPI.
//   DjVu.Worker (via DjVu.js) encodes each page's ImageData as an IW44 chunk
//   and assembles a standards-compliant DJVM multi-page file.
//   After assembly, TXTa text-layer chunks are injected from pdf.js text
//   content so the resulting DjVu is searchable and copyable.
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

// ── Text layer helpers ────────────────────────────────────────────────────────

/** Write big-endian uint16 into buf at pos. */
function u16(buf, pos, val) {
  buf[pos]     = (val >>> 8) & 0xFF;
  buf[pos + 1] = val & 0xFF;
}

/** Write big-endian int32 into buf at pos. */
function i32(buf, pos, val) {
  buf[pos]     = (val >>> 24) & 0xFF;
  buf[pos + 1] = (val >>> 16) & 0xFF;
  buf[pos + 2] = (val >>> 8)  & 0xFF;
  buf[pos + 3] = val & 0xFF;
}

/** Read big-endian unsigned int32 from buf at pos. */
function rU32(buf, pos) {
  return ((buf[pos] << 24) | (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3]) >>> 0;
}

/** Write big-endian int24 into buf at pos. */
function i24(buf, pos, val) {
  buf[pos]     = (val >>> 16) & 0xFF;
  buf[pos + 1] = (val >>> 8)  & 0xFF;
  buf[pos + 2] = val & 0xFF;
}

/**
 * Clamp a delta value to [-0x7FFF, 0x7FFF] so it fits in the DjVu uint16+0x8000 encoding.
 * @param {number} v
 * @returns {number}
 */
function clampDelta(v) {
  return Math.max(-0x7FFF, Math.min(0x7FFF, Math.round(v)));
}

/**
 * Extract word-level text zones from a PDF.js page, converted to DjVu pixel
 * coordinates (y=0 at bottom, same as PDF — no flip required).
 *
 * @param {any} pdfPage - PDF.js page object
 * @param {number} renderScale - pixels per PDF unit = dpi / 72
 * @returns {Promise<Array<{words: Array<{text:string,x:number,y:number,w:number,h:number,_ts:number,_tl:number}>, x:number, y:number, w:number, h:number, _ts:number, _tl:number}>>}
 */
async function extractPageLines(pdfPage, renderScale) {
  let textContent;
  try { textContent = await pdfPage.getTextContent(); } catch (_e) { return []; }

  /** @type {Array<{text:string,x:number,y:number,w:number,h:number,_ts:number,_tl:number}>} */
  const wordItems = [];

  for (const item of textContent.items) {
    const str = (/** @type {any} */ (item).str || '').trim();
    if (!str) continue;
    const tx = /** @type {any} */ (item).transform[4];
    const ty = /** @type {any} */ (item).transform[5];
    const ph = /** @type {any} */ (item).height || 10;
    const pw = /** @type {any} */ (item).width  || str.length * ph * 0.6;
    const x = Math.round(tx * renderScale);
    const y = Math.round(ty * renderScale);
    const w = Math.max(1, Math.round(pw * renderScale));
    const h = Math.max(1, Math.round(ph * renderScale));
    if (x < -5000 || y < -5000) continue;
    wordItems.push({ text: str, x, y, w, h, _ts: 0, _tl: 0 });
  }
  if (!wordItems.length) return [];

  // Sort top-to-bottom (largest y first in DjVu's bottom-origin system), then left-to-right.
  wordItems.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  // Group items into lines: words whose bottom-edge y is within 60 % of the line height.
  /** @type {Array<{words: typeof wordItems, y:number, h:number, x:number, w:number, _ts:number, _tl:number}>} */
  const lines = [];
  for (const word of wordItems) {
    let placed = false;
    for (const line of lines) {
      if (Math.abs(word.y - line.y) <= line.h * 0.6) {
        line.words.push(word);
        line.h = Math.max(line.h, word.h);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lines.push({ words: [word], y: word.y, h: word.h, x: 0, w: 0, _ts: 0, _tl: 0 });
    }
  }

  // Sort lines top-to-bottom; sort words in each line left-to-right.
  lines.sort((a, b) => b.y - a.y);
  for (const line of lines) {
    line.words.sort((a, b) => a.x - b.x);
    // Compute line bounding box from its words.
    let lx = Infinity, ly = Infinity, lr = 0, lt = 0;
    for (const w of line.words) {
      lx = Math.min(lx, w.x);
      ly = Math.min(ly, w.y);
      lr = Math.max(lr, w.x + w.w);
      lt = Math.max(lt, w.y + w.h);
    }
    line.x = Math.max(0, lx);
    line.y = Math.max(0, ly);
    line.w = Math.max(1, lr - lx);
    line.h = Math.max(1, lt - ly);
  }

  return lines;
}

/**
 * Build TXTa chunk data bytes (the raw payload, without the 8-byte IFF header).
 *
 * Format (all big-endian):
 *   int24  total UTF-8 text bytes
 *   <text bytes>
 *   uint8  version = 1
 *   <zone tree> — page zone → line zones → word zones (delta-encoded)
 *
 * Each zone record (17 bytes):
 *   uint8   type
 *   uint16  delta_x      + 0x8000
 *   uint16  delta_y      + 0x8000
 *   uint16  width        + 0x8000  (absolute, not delta)
 *   uint16  height       + 0x8000  (absolute)
 *   uint16  delta_textStart + 0x8000
 *   int24   textLength
 *   int24   childrenCount
 *
 * @param {ReturnType<extractPageLines> extends Promise<infer T> ? T : never} lines
 * @param {number} pageW  page width in pixels
 * @param {number} pageH  page height in pixels
 * @returns {Uint8Array|null}  null if no text
 */
function buildTxtaData(lines, pageW, pageH) {
  if (!lines.length) return null;

  const enc = new TextEncoder();

  // ── Pass 1: build text string and record byte offsets for each zone ──────────
  /** @type {number[]} */
  const textBytes = [];
  let byteOffset = 0;

  for (const line of lines) {
    line._ts = byteOffset;
    for (let wi = 0; wi < line.words.length; wi++) {
      if (wi > 0) { textBytes.push(0x20); byteOffset++; } // space between words
      const wb = enc.encode(line.words[wi].text);
      line.words[wi]._ts = byteOffset;
      line.words[wi]._tl = wb.length;
      for (const b of wb) textBytes.push(b);
      byteOffset += wb.length;
    }
    textBytes.push(0x0A); byteOffset++; // newline after each line
    line._tl = byteOffset - line._ts;
  }
  const totalTextLen = byteOffset;

  // ── Pass 2: allocate output buffer ───────────────────────────────────────────
  const ZONE_SIZE = 17; // bytes per zone record
  const numLines = lines.length;
  const numWords = lines.reduce((s, l) => s + l.words.length, 0);
  // 1 page zone + numLines line zones + numWords word zones
  const bufSize = 3 + totalTextLen + 1 + (1 + numLines + numWords) * ZONE_SIZE;
  const buf = new Uint8Array(bufSize);
  let p = 0;

  // int24 total text length
  i24(buf, p, totalTextLen); p += 3;
  // UTF-8 text
  for (const b of textBytes) buf[p++] = b;
  // version = 1
  buf[p++] = 1;

  // ── Page zone (root, type 1, no parent, no previous sibling) ─────────────────
  // Absolute coords stored directly (delta vs nothing = absolute + 0x8000)
  buf[p++] = 1;                                      // type = Page
  u16(buf, p, clampDelta(0)  + 0x8000); p += 2;     // x = 0
  u16(buf, p, clampDelta(0)  + 0x8000); p += 2;     // y = 0
  u16(buf, p, clampDelta(pageW) + 0x8000); p += 2;  // width
  u16(buf, p, clampDelta(pageH) + 0x8000); p += 2;  // height
  u16(buf, p, 0 + 0x8000); p += 2;                  // textStart = 0 (root)
  i24(buf, p, totalTextLen); p += 3;                 // textLength = all text
  i24(buf, p, numLines);     p += 3;                 // childrenCount

  // ── Line zones (type 5 = Line, children of page) ─────────────────────────────
  /** @type {{x:number,y:number,w:number,h:number,_ts:number,_tl:number}|null} */
  let prevLine = null;

  for (const line of lines) {
    buf[p++] = 5; // type = Line

    let dx, dy, dts;
    if (!prevLine) {
      // First child of page: delta relative to parent (page zone)
      dx  = clampDelta(line.x - 0);             // parent.x = 0
      dy  = clampDelta(0 + pageH - line.y - line.h); // parent.y + parent.h - y - h
      dts = clampDelta(line._ts - 0);           // parent.textStart = 0
    } else {
      // Sibling; type 5 → vertical-stacking delta
      dx  = clampDelta(line.x - prevLine.x);
      dy  = clampDelta(prevLine.y - line.y - line.h);
      dts = clampDelta(line._ts - prevLine._ts - prevLine._tl);
    }
    u16(buf, p, dx  + 0x8000); p += 2;
    u16(buf, p, dy  + 0x8000); p += 2;
    u16(buf, p, clampDelta(line.w) + 0x8000); p += 2;
    u16(buf, p, clampDelta(line.h) + 0x8000); p += 2;
    u16(buf, p, dts + 0x8000); p += 2;
    i24(buf, p, line._tl);        p += 3;
    i24(buf, p, line.words.length); p += 3;

    // ── Word zones (type 6 = Word, children of this line) ────────────────────
    /** @type {{x:number,y:number,w:number,h:number,_ts:number,_tl:number}|null} */
    let prevWord = null;

    for (const word of line.words) {
      buf[p++] = 6; // type = Word

      let wx, wy, wts;
      if (!prevWord) {
        // First child of line
        wx  = clampDelta(word.x - line.x);
        wy  = clampDelta(line.y + line.h - word.y - word.h);
        wts = clampDelta(word._ts - line._ts);
      } else {
        // Sibling word; type 6 (not in {1,4,5}) → horizontal-stacking delta
        wx  = clampDelta(word.x - prevWord.x - prevWord.w);
        wy  = clampDelta(word.y - prevWord.y);
        wts = clampDelta(word._ts - prevWord._ts - prevWord._tl);
      }
      u16(buf, p, wx  + 0x8000); p += 2;
      u16(buf, p, wy  + 0x8000); p += 2;
      u16(buf, p, clampDelta(word.w) + 0x8000); p += 2;
      u16(buf, p, clampDelta(word.h) + 0x8000); p += 2;
      u16(buf, p, wts + 0x8000); p += 2;
      i24(buf, p, word._tl); p += 3;
      i24(buf, p, 0);        p += 3; // no children
      prevWord = word;
    }

    prevLine = line;
  }

  return buf;
}

/**
 * Wrap raw TXTa payload bytes in an IFF chunk header.
 * Includes a trailing pad byte if the payload size is odd (IFF requirement).
 *
 * @param {Uint8Array} data - raw TXTa payload
 * @returns {Uint8Array}  always has even length
 */
function wrapTxtaChunk(data) {
  const pad = data.length % 2;
  const chunk = new Uint8Array(8 + data.length + pad);
  chunk[0] = 0x54; chunk[1] = 0x58; chunk[2] = 0x54; chunk[3] = 0x61; // "TXTa"
  i32(chunk, 4, data.length);
  chunk.set(data, 8);
  // trailing pad byte is already 0
  return chunk;
}

/**
 * Inject TXTa text-layer chunks into a finished DJVM binary produced by DjVu.Worker.
 *
 * Strategy:
 *  • Parse the DIRM plain-binary section to locate each FORM:DJVU page offset.
 *  • Append the TXTa chunk immediately after each FORM:DJVU body.
 *  • Update each affected FORM:DJVU size field and the FORM:DJVM file size.
 *  • Update DIRM page offsets for pages after each injection.
 *  • The DIRM BZZ-encoded sizes section is intentionally left unchanged — it
 *    is redundant with the FORM chunk size fields; all major DjVu viewers
 *    navigate pages by scanning FORM headers, not by DIRM sizes.
 *
 * @param {ArrayBuffer} djvuBuf  - output of worker.endMultiPageDocument()
 * @param {Array<Uint8Array|null>} pageChunks  - TXTa chunk (from wrapTxtaChunk) per page, or null
 * @returns {Uint8Array}
 */
function injectTextLayer(djvuBuf, pageChunks) {
  if (!pageChunks.some(Boolean)) return new Uint8Array(djvuBuf);

  const buf = new Uint8Array(djvuBuf);

  // ── 1. Parse DIRM: locate page count and DIRM offsets array ──────────────────
  // File layout: "AT&T"(4) + "FORM"(4) + fileBodySize(4) + "DJVM"(4) + "DIRM"(4) + ...
  // DIRM starts at byte 16.
  if (buf[16] !== 0x44 || buf[17] !== 0x49 || buf[18] !== 0x52 || buf[19] !== 0x4D) {
    // Can't find DIRM — return original unchanged
    return buf;
  }
  const count   = (buf[25] << 8) | buf[26];  // big-endian uint16 at byte 25
  const offsBase = 27;                         // DIRM offsets array starts here

  const origOffsets = [];
  for (let i = 0; i < count; i++) {
    origOffsets.push(rU32(buf, offsBase + i * 4));
  }

  // ── 2. Compute total extra bytes we will inject ───────────────────────────────
  let totalExtra = 0;
  for (let i = 0; i < count; i++) {
    if (pageChunks[i]) totalExtra += /** @type {Uint8Array} */ (pageChunks[i]).length;
  }
  if (totalExtra === 0) return buf;

  // ── 3. Build the new buffer piece by piece ───────────────────────────────────
  const newBuf = new Uint8Array(buf.length + totalExtra);
  let dst = 0;

  // Helper: append a slice of the source buffer to newBuf.
  /** @param {number} from @param {number} to */
  const copyRange = (from, to) => {
    if (from >= to) return;
    newBuf.set(buf.subarray(from, to), dst);
    dst += to - from;
  };

  // Copy everything up to (and including) the first page's starting byte.
  copyRange(0, origOffsets[0]);

  for (let i = 0; i < count; i++) {
    const pageOff      = origOffsets[i];
    const pageBodySize = rU32(buf, pageOff + 4);          // size field of FORM:DJVU
    const pageBodyEnd  = pageOff + 8 + pageBodySize;       // end of FORM:DJVU body
    // IFF pad byte after body if size is odd (not counted in size field):
    const pagePad      = pageBodySize % 2;
    const pageChunkEnd = pageBodyEnd + pagePad;            // next chunk in original

    const nextOrigStart = (i + 1 < count) ? origOffsets[i + 1] : buf.length;

    // Record where this page's FORM chunk starts in the new buffer.
    const newPageOff = dst;

    // Copy the FORM:DJVU chunk (header + body, WITHOUT the optional pad byte).
    copyRange(pageOff, pageBodyEnd);

    const txtaChunk = pageChunks[i];
    if (txtaChunk) {
      // Append TXTa inside the FORM:DJVU (txtaChunk.length is always even).
      newBuf.set(txtaChunk, dst);
      dst += txtaChunk.length;

      // Update FORM:DJVU size field at newPageOff + 4 in the new buffer.
      i32(newBuf, newPageOff + 4, pageBodySize + txtaChunk.length);
    }

    // Copy the original pad byte (if any) — FORM parity is preserved because
    // txtaChunk.length is always even, so parity of pageBodySize is unchanged.
    copyRange(pageBodyEnd, pageChunkEnd);

    // Copy any gap bytes between this page's chunk end and the next page start
    // (typically zero bytes, but may include DIRM padding in edge cases).
    copyRange(pageChunkEnd, nextOrigStart);
  }

  // ── 4. Update DIRM page offsets in the new buffer ────────────────────────────
  // The new offset for page i = origOffsets[i] + sum of injections for pages 0..i-1.
  let cumulativeShift = 0;
  for (let i = 0; i < count; i++) {
    i32(newBuf, offsBase + i * 4, origOffsets[i] + cumulativeShift);
    if (pageChunks[i]) cumulativeShift += /** @type {Uint8Array} */ (pageChunks[i]).length;
  }

  // ── 5. Update FORM:DJVM body size at byte [8] ─────────────────────────────────
  const origFileBodySize = rU32(buf, 8);
  i32(newBuf, 8, origFileBodySize + totalExtra);

  return newBuf;
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
 * @property {{ pageCount: number, dpi: number, slices: number, quality: string, hasTextLayer: boolean }} stats
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
  /** @type {Array<Uint8Array|null>} */
  const txtaChunks = [];

  try {
    // Streaming API: one page at a time → constant memory usage
    await worker.startMultiPageDocument(profile.slices, 0, profile.grayscale);

    // ── 3. Render each page, stream into encoder, and extract text ───────────
    for (let idx = 0; idx < total; idx++) {
      const pageNum = pages[idx];
      if (onProgress) onProgress(idx + 1, total, 'Рендеринг');

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });
      const w = Math.round(viewport.width);
      const h = Math.round(viewport.height);

      if (w <= 0 || h <= 0) { txtaChunks.push(null); continue; }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { txtaChunks.push(null); continue; }

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

      // Extract text concurrently with encoding for the text layer
      const lines = await extractPageLines(page, renderScale);
      const txtaData = buildTxtaData(lines, w, h);
      txtaChunks.push(txtaData ? wrapTxtaChunk(txtaData) : null);
    }

    if (pagesEncoded === 0) throw new Error('No pages were rendered');

    // ── 4. Finalize the DJVM document ─────────────────────────────────────
    if (onProgress) onProgress(total, total, 'Сборка DjVu');
    const buffer = await worker.endMultiPageDocument();

    // Patch DPI metadata: IWImageWriter hardcodes 100 DPI in INFO chunks
    let djvuBytes = patchDpiInBuffer(new Uint8Array(buffer), profile.dpi);

    // ── 5. Inject TXTa text layer (makes the DjVu searchable/copyable) ──────
    if (txtaChunks.some(Boolean)) {
      if (onProgress) onProgress(total, total, 'Текстовый слой');
      djvuBytes = injectTextLayer(/** @type {ArrayBuffer} */ (djvuBytes.buffer), txtaChunks);
    }

    const hasText = txtaChunks.some(Boolean);
    return {
      blob: new Blob([/** @type {any} */ (djvuBytes)], { type: 'image/vnd.djvu' }),
      pageCount: pagesEncoded,
      stats: {
        pageCount: pagesEncoded,
        dpi: profile.dpi,
        slices: profile.slices,
        quality,
        hasTextLayer: hasText,
      },
    };
  } finally {
    worker.terminate();
  }
}
