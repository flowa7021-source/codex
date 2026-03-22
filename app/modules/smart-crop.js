// @ts-check
/**
 * @module smart-crop
 * @description Phase 8 — Smart Crop (Tier 4 unique tool).
 *
 * Automatically detects the content boundary of a PDF page by analysing
 * the pixel histogram of the rendered page image, then suggests (and
 * optionally applies) a crop rectangle that trims the whitespace margin.
 *
 * Unlike a dumb symmetric margin crop, Smart Crop:
 *   • Processes each edge independently (top / right / bottom / left)
 *   • Uses a row/column luminance projection to find where content starts
 *   • Adds a configurable padding after detection
 *   • Supports batch processing of all pages in a document
 *   • Applies the crop via pdf-lib (modifies the MediaBox / CropBox)
 *
 * Public API:
 *   detectContentBounds(canvas, opts)         → CropRect
 *   smartCropPage(pdfBytes, pageNum, opts)    → Promise<{blob, cropRect}>
 *   smartCropAll(pdfBytes, opts)              → Promise<{blob, rects[]}>
 *   SmartCropPreview                          – UI helper class
 */

import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CropRect
 * @property {number} x        Left edge in page pt from MediaBox origin
 * @property {number} y        Bottom edge in page pt from MediaBox origin
 * @property {number} width    Width in pt
 * @property {number} height   Height in pt
 * @property {number} marginTop    Detected top whitespace (pt)
 * @property {number} marginRight  Detected right whitespace (pt)
 * @property {number} marginBottom Detected bottom whitespace (pt)
 * @property {number} marginLeft   Detected left whitespace (pt)
 */

// ---------------------------------------------------------------------------
// detectContentBounds
// ---------------------------------------------------------------------------

/**
 * Analyse a rendered page canvas and detect the bounding rectangle of
 * non-background content using luminance projections.
 *
 * Algorithm:
 *   For each horizontal row: compute the average luminance.
 *   For each vertical column: compute the average luminance.
 *   Starting from each edge, advance inward until the luminance drops
 *   below `threshold` (i.e. we hit actual content).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [opts]
 * @param {number} [opts.threshold=240]    Luminance threshold (0–255). Pixels
 *   brighter than this are considered background (white).
 * @param {number} [opts.paddingPx=10]    Padding to add around detected content.
 * @param {number} [opts.minContentRatio=0.05]  Minimum fraction of rows/cols
 *   that must differ from background before the edge is moved.
 * @returns {CropRect}  Pixel coordinates on the canvas (not yet in pt).
 *   Use opts.scaleX / scaleY to convert to PDF points.
 */
export function detectContentBounds(canvas, opts = {}) {
  const threshold    = opts.threshold    ?? 240;
  const paddingPx    = opts.paddingPx    ?? 10;
  const minRatio     = opts.minContentRatio ?? 0.05;

  const ctx = canvas.getContext('2d');
  if (!ctx) return /** @type {any} */ ({ x: 0, y: 0, width: canvas.width, height: canvas.height });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // ── Build row and column luminance arrays ─────────────────────────────────

  // rowLum[y]  = fraction of pixels in row y that are "content" (lum < threshold)
  const rowContent = new Float32Array(height);
  // colContent[x] = fraction of pixels in col x that are content
  const colContent = new Float32Array(width);

  for (let y = 0; y < height; y++) {
    let contentCount = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < threshold) contentCount++;
    }
    rowContent[y] = contentCount / width;
  }

  for (let x = 0; x < width; x++) {
    let contentCount = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < threshold) contentCount++;
    }
    colContent[x] = contentCount / height;
  }

  // ── Find edges ────────────────────────────────────────────────────────────

  let top    = 0;
  let bottom = height - 1;
  let left   = 0;
  let right  = width - 1;

  // Top: scan rows downward until we find content
  for (let y = 0; y < height; y++) {
    if (rowContent[y] >= minRatio) { top = y; break; }
  }
  // Bottom: scan rows upward
  for (let y = height - 1; y >= 0; y--) {
    if (rowContent[y] >= minRatio) { bottom = y; break; }
  }
  // Left: scan columns rightward
  for (let x = 0; x < width; x++) {
    if (colContent[x] >= minRatio) { left = x; break; }
  }
  // Right: scan columns leftward
  for (let x = width - 1; x >= 0; x--) {
    if (colContent[x] >= minRatio) { right = x; break; }
  }

  // ── Apply padding ─────────────────────────────────────────────────────────
  top    = Math.max(0,         top    - paddingPx);
  bottom = Math.min(height - 1, bottom + paddingPx);
  left   = Math.max(0,         left   - paddingPx);
  right  = Math.min(width - 1,  right  + paddingPx);

  const marginTop    = top;
  const marginBottom = height - 1 - bottom;
  const marginLeft   = left;
  const marginRight  = width - 1 - right;

  return {
    x:      left,
    y:      top,
    width:  right  - left,
    height: bottom - top,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    // @ts-ignore Store scale for conversion to PDF pt
    _canvasWidth:  width,
    _canvasHeight: height,
  };
}

// ---------------------------------------------------------------------------
// smartCropPage
// ---------------------------------------------------------------------------

/**
 * Render a PDF page to a canvas, detect content bounds, and apply the
 * crop by adjusting the page's CropBox in pdf-lib.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum   1-based
 * @param {Object} [opts]
 * @param {Function} [opts.renderPage]   async (pageNum) => HTMLCanvasElement
 *   If omitted, uses a simple off-screen canvas fallback.
 * @param {number}  [opts.threshold=240]
 * @param {number}  [opts.paddingPt=5]    Padding in PDF points (default 5pt ≈ 1.8mm)
 * @param {boolean} [opts.applyAll=false] Apply same crop rect to all pages
 * @returns {Promise<{blob: Blob, cropRect: CropRect}>}
 */
export async function smartCropPage(pdfBytes, pageNum, opts = {}) {
  const paddingPt = opts.paddingPt ?? 5;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageIndex = pageNum - 1;
  const page = pdfDoc.getPage(pageIndex);
  const { width: pageW, height: pageH } = page.getSize();

  // ── Render or create canvas ───────────────────────────────────────────────
  let canvas;
  if (opts.renderPage) {
    canvas = await opts.renderPage(pageNum);
  } else {
    // Minimal fallback: create a blank canvas (crop will be no-op without real render)
    canvas = document.createElement('canvas');
    canvas.width  = Math.round(pageW);
    canvas.height = Math.round(pageH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Detect content bounds in canvas pixels ────────────────────────────────
  const bounds = detectContentBounds(canvas, { threshold: opts.threshold, paddingPx: 0 });

  // ── Convert pixel bounds → PDF points ─────────────────────────────────────
  const scaleX = pageW / canvas.width;
  const scaleY = pageH / canvas.height;

  // Canvas Y=0 is top; PDF Y=0 is bottom — flip Y
  const cropLeft   = Math.max(0,     bounds.x * scaleX                          - paddingPt);
  const cropBottom = Math.max(0,     pageH - (bounds.y + bounds.height) * scaleY - paddingPt);
  const cropRight  = Math.min(pageW, (bounds.x + bounds.width)  * scaleX        + paddingPt);
  const cropTop    = Math.min(pageH, pageH - bounds.y * scaleY                  + paddingPt);

  const cropRectPt = {
    x:      cropLeft,
    y:      cropBottom,
    width:  cropRight - cropLeft,
    height: cropTop   - cropBottom,
    marginTop:    bounds.marginTop    * scaleY,
    marginRight:  bounds.marginRight  * scaleX,
    marginBottom: bounds.marginBottom * scaleY,
    marginLeft:   bounds.marginLeft   * scaleX,
  };

  // ── Apply CropBox to page(s) ──────────────────────────────────────────────
  const pagesToCrop = opts.applyAll
    ? Array.from({ length: pdfDoc.getPageCount() }, (_, i) => pdfDoc.getPage(i))
    : [page];

  for (const p of pagesToCrop) {
    p.setCropBox(cropRectPt.x, cropRectPt.y, cropRectPt.width, cropRectPt.height);
  }

  const saved = await pdfDoc.save();
  return {
    blob: new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' }),
    cropRect: cropRectPt,
  };
}

// ---------------------------------------------------------------------------
// smartCropAll
// ---------------------------------------------------------------------------

/**
 * Detect and apply independent crop rects for every page in the document.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {Object} [opts]
 * @param {Function} [opts.renderPage]   async (pageNum) => HTMLCanvasElement
 * @param {number}   [opts.threshold=240]
 * @param {number}   [opts.paddingPt=5]
 * @param {Function} [opts.onProgress]   (pageNum, total) => void
 * @returns {Promise<{blob: Blob, rects: CropRect[]}>}
 */
export async function smartCropAll(pdfBytes, opts = {}) {
  const paddingPt = opts.paddingPt ?? 5;
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = pdfDoc.getPageCount();
  const rects = [];

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    const page = pdfDoc.getPage(i);
    const { width: pageW, height: pageH } = page.getSize();

    let canvas;
    if (opts.renderPage) {
      canvas = await opts.renderPage(pageNum);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = Math.round(pageW);
      canvas.height = Math.round(pageH);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const bounds  = detectContentBounds(canvas, { threshold: opts.threshold, paddingPx: 0 });
    const scaleX  = pageW / canvas.width;
    const scaleY  = pageH / canvas.height;

    const cropLeft   = Math.max(0,     bounds.x * scaleX                          - paddingPt);
    const cropBottom = Math.max(0,     pageH - (bounds.y + bounds.height) * scaleY - paddingPt);
    const cropRight  = Math.min(pageW, (bounds.x + bounds.width) * scaleX         + paddingPt);
    const cropTop    = Math.min(pageH, pageH - bounds.y * scaleY                  + paddingPt);

    const rect = {
      x:      cropLeft,
      y:      cropBottom,
      width:  cropRight  - cropLeft,
      height: cropTop    - cropBottom,
      marginTop:    bounds.marginTop    * scaleY,
      marginRight:  bounds.marginRight  * scaleX,
      marginBottom: bounds.marginBottom * scaleY,
      marginLeft:   bounds.marginLeft   * scaleX,
    };

    page.setCropBox(rect.x, rect.y, rect.width, rect.height);
    rects.push(rect);

    if (opts.onProgress) opts.onProgress(pageNum, total);
  }

  const saved = await pdfDoc.save();
  return { blob: new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' }), rects };
}

// ---------------------------------------------------------------------------
// SmartCropPreview — UI helper
// ---------------------------------------------------------------------------

/**
 * Renders a visual preview of the detected crop rectangle on an overlay
 * canvas positioned above the PDF page canvas.
 *
 * Usage:
 *   const preview = new SmartCropPreview(overlayCanvas, pageWidth, pageHeight, zoom);
 *   preview.show(cropRect);        // show crop outline
 *   preview.hide();                // clear overlay
 *   preview.setZoom(newZoom);      // update on zoom change
 */
export class SmartCropPreview {
  /**
   * @param {HTMLCanvasElement} overlayCanvas
   * @param {number} pageWidthPt
   * @param {number} pageHeightPt
   * @param {number} [zoom=1]
   */
  constructor(overlayCanvas, pageWidthPt, pageHeightPt, zoom = 1) {
    this.canvas    = overlayCanvas;
    this.ctx       = overlayCanvas.getContext('2d');
    if (!this.ctx) return;
    this.pageW     = pageWidthPt;
    this.pageH     = pageHeightPt;
    this.zoom      = zoom;
    this._cropRect = null;
  }

  setZoom(zoom) {
    this.zoom = zoom;
    if (this._cropRect) this.show(this._cropRect);
  }

  /** @param {CropRect} rect  PDF pt coordinates */
  show(rect) {
    this._cropRect = rect;
    const { ctx, canvas, zoom, pageH } = this;
    const z = zoom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Darken outside the crop
    ctx.fillStyle = 'rgba(0,0,0,0.35)';

    // Convert from PDF pt (Y up) to canvas px (Y down)
    const cx = rect.x * z;
    const cy = (pageH - rect.y - rect.height) * z;
    const cw = rect.width  * z;
    const ch = rect.height * z;

    // Draw dark overlay around the crop area
    ctx.fillRect(0, 0, canvas.width, cy);             // top strip
    ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch); // bottom strip
    ctx.fillRect(0, cy, cx, ch);                      // left strip
    ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch); // right strip

    // Draw crop border
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cx, cy, cw, ch);

    // Corner handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#00BFFF';
    const h = 8;
    for (const [hx, hy] of [[cx, cy], [cx + cw - h, cy], [cx, cy + ch - h], [cx + cw - h, cy + ch - h]]) {
      ctx.fillRect(hx, hy, h, h);
    }

    // Label: detected margins
    ctx.setLineDash([]);
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(0,191,255,0.9)';
    ctx.fillText(`↑ ${Math.round(rect.marginTop)}pt`, cx + 4, cy - 4);
    ctx.fillText(`↓ ${Math.round(rect.marginBottom)}pt`, cx + 4, cy + ch + 14);
  }

  hide() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._cropRect = null;
  }
}
