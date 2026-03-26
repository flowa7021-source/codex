// @ts-check
// ─── Extended Image Export ───────────────────────────────────────────────────
// Multi-page TIFF export and SVG export for PDF pages.
// TIFF uses uncompressed RGB format with chained IFD entries.

/**
 * @typedef {Object} TiffIfd
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} imageData - Raw RGB bytes (no alpha)
 */

/**
 * Write a 32-bit little-endian unsigned integer into a buffer.
 * @param {DataView} view
 * @param {number} offset
 * @param {number} value
 */
function writeUint32LE(view, offset, value) {
  view.setUint32(offset, value, true);
}

/**
 * Write a 16-bit little-endian unsigned integer into a buffer.
 * @param {DataView} view
 * @param {number} offset
 * @param {number} value
 */
function writeUint16LE(view, offset, value) {
  view.setUint16(offset, value, true);
}

/**
 * Build a TIFF IFD entry (12 bytes).
 * @param {DataView} view
 * @param {number} offset - Write position
 * @param {number} tag
 * @param {number} type - 3=SHORT, 4=LONG
 * @param {number} count
 * @param {number} value
 */
function writeIfdEntry(view, offset, tag, type, count, value) {
  writeUint16LE(view, offset, tag);
  writeUint16LE(view, offset + 2, type);
  writeUint32LE(view, offset + 4, count);
  if (type === 3 && count === 1) {
    // SHORT value stored in first 2 bytes of value field
    writeUint16LE(view, offset + 8, value);
    writeUint16LE(view, offset + 10, 0);
  } else {
    writeUint32LE(view, offset + 8, value);
  }
}

/**
 * Convert RGBA imageData to RGB bytes (strip alpha channel).
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
function rgbaToRgb(rgba, width, height) {
  const pixelCount = width * height;
  const rgb = new Uint8Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  return rgb;
}

/**
 * Try to render a PDF page to image data.
 * Returns null if canvas is unavailable.
 * @param {any} page - PDF.js page proxy
 * @param {number} dpi
 * @returns {Promise<{width: number, height: number, rgbData: Uint8Array} | null>}
 */
async function renderPageToRgb(page, dpi) {
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);

  if (width === 0 || height === 0) return null;

  /** @type {any} */
  let canvas = null;

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
    } else if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    }
  } catch {
    return null;
  }

  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    return null;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const rgbData = rgbaToRgb(imageData.data, width, height);

  return { width, height, rgbData };
}

/**
 * Export PDF pages as a multi-page TIFF file.
 *
 * TIFF structure:
 * - Header (8 bytes): byte order + magic + first IFD offset
 * - For each page: IFD entries + image strip data
 * - IFDs are linked via "next IFD offset" field
 *
 * @param {any} pdfDoc - PDF.js document proxy
 * @param {number[]} pageNums - 1-based page numbers to include
 * @param {number} [dpi=300] - Render resolution
 * @returns {Promise<Uint8Array>}
 */
export async function exportPagesToTiff(pdfDoc, pageNums, dpi = 300) {
  /** @type {TiffIfd[]} */
  const pages = [];

  for (const pageNum of pageNums) {
    const page = await pdfDoc.getPage(pageNum);
    const result = await renderPageToRgb(page, dpi);
    page.cleanup();

    if (result) {
      pages.push({ width: result.width, height: result.height, imageData: result.rgbData });
    }
  }

  if (pages.length === 0) {
    // Return minimal 1x1 white pixel TIFF if no pages could be rendered
    pages.push({ width: 1, height: 1, imageData: new Uint8Array([255, 255, 255]) });
  }

  // Calculate total size
  // Header: 8 bytes
  // Per page IFD: 2 (count) + N*12 (entries) + 4 (next IFD offset) + 6 (BitsPerSample values if >1 value)
  const NUM_IFD_TAGS = 10;
  const IFD_SIZE = 2 + NUM_IFD_TAGS * 12 + 4;
  const BITS_PER_SAMPLE_SIZE = 6; // 3 shorts for RGB (3*2 bytes)
  const PAGE_OVERHEAD = IFD_SIZE + BITS_PER_SAMPLE_SIZE;

  let totalSize = 8; // header
  for (const pg of pages) {
    totalSize += PAGE_OVERHEAD + pg.imageData.length;
  }

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // ─── Header ──────────────────────────────────────────────────────────
  // Byte order: little-endian ("II")
  view.setUint8(0, 0x49);
  view.setUint8(1, 0x49);
  // Magic number: 42
  writeUint16LE(view, 2, 42);
  // Offset to first IFD
  writeUint32LE(view, 4, 8);

  let offset = 8;

  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    const stripSize = pg.imageData.length;

    // Position of BitsPerSample values (stored after IFD)
    const bpsOffset = offset + IFD_SIZE;
    // Position of image data (after BitsPerSample)
    const stripOffset = bpsOffset + BITS_PER_SAMPLE_SIZE;
    // Position of next IFD (after image data), 0 if last
    const nextIfdOffset = (i < pages.length - 1) ? stripOffset + stripSize : 0;

    // ─── IFD ─────────────────────────────────────────────────────────
    // Tag count
    writeUint16LE(view, offset, NUM_IFD_TAGS);
    let entryOff = offset + 2;

    // Tag 256: ImageWidth (LONG)
    writeIfdEntry(view, entryOff, 256, 4, 1, pg.width); entryOff += 12;
    // Tag 257: ImageLength (LONG)
    writeIfdEntry(view, entryOff, 257, 4, 1, pg.height); entryOff += 12;
    // Tag 258: BitsPerSample (SHORT, count=3 → offset to values)
    writeIfdEntry(view, entryOff, 258, 3, 3, bpsOffset); entryOff += 12;
    // Tag 259: Compression (SHORT, 1=None)
    writeIfdEntry(view, entryOff, 259, 3, 1, 1); entryOff += 12;
    // Tag 262: PhotometricInterpretation (SHORT, 2=RGB)
    writeIfdEntry(view, entryOff, 262, 3, 1, 2); entryOff += 12;
    // Tag 273: StripOffsets (LONG)
    writeIfdEntry(view, entryOff, 273, 4, 1, stripOffset); entryOff += 12;
    // Tag 277: SamplesPerPixel (SHORT, 3)
    writeIfdEntry(view, entryOff, 277, 3, 1, 3); entryOff += 12;
    // Tag 278: RowsPerStrip (LONG — entire image in one strip)
    writeIfdEntry(view, entryOff, 278, 4, 1, pg.height); entryOff += 12;
    // Tag 279: StripByteCounts (LONG)
    writeIfdEntry(view, entryOff, 279, 4, 1, stripSize); entryOff += 12;
    // Tag 282: XResolution — store inline as rational? Simplify: use resolution unit=1 (no unit)
    // Tag 296: ResolutionUnit (SHORT, 2=inch)
    writeIfdEntry(view, entryOff, 296, 3, 1, 2); entryOff += 12;

    // Next IFD offset
    writeUint32LE(view, entryOff, nextIfdOffset);

    // ─── BitsPerSample values ────────────────────────────────────────
    writeUint16LE(view, bpsOffset, 8);
    writeUint16LE(view, bpsOffset + 2, 8);
    writeUint16LE(view, bpsOffset + 4, 8);

    // ─── Image data ──────────────────────────────────────────────────
    bytes.set(pg.imageData, stripOffset);

    offset = nextIfdOffset || (stripOffset + stripSize);
  }

  return new Uint8Array(buffer);
}

/**
 * Export a single PDF page to SVG.
 * Delegates to pdf-to-svg module.
 *
 * @param {any} pdfDoc - PDF.js document proxy
 * @param {number} pageNum - 1-based page number
 * @returns {Promise<string>} SVG markup
 */
export async function exportPageToSvg(pdfDoc, pageNum) {
  const { convertPdfPageToSvg } = await import('./pdf-to-svg.js');
  return convertPdfPageToSvg(pdfDoc, pageNum);
}
