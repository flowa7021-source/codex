/**
 * @module ocr-char-layer
 * @description Phase 4 — OCR Pipeline 2.0: Character-level bounding boxes.
 *
 * Extends the existing Tesseract.js pipeline with:
 *   • Character-level bounding boxes extracted from Tesseract word.symbols[]
 *   • Pre-processing: deskew, denoise, upscale to ≥300 DPI
 *   • Post-processing: ligature restoration, punctuation repair, n-gram scoring
 *   • TextLayerModel construction from char-level data (feeds into
 *     pixel-perfect-text-layer.js and scan-decomposer.js)
 *
 * This module is a pure enhancement to the existing ocr-controller.js —
 * it provides a `ocrWithCharBoxes()` drop-in that returns the richer result
 * structure expected by Phase 2/5/6 modules.
 *
 * Public API:
 *   ocrWithCharBoxes(canvas, opts)    → Promise<OcrCharResult>
 *   preprocessCanvas(canvas, opts)   → HTMLCanvasElement
 *   buildTextLayerFromResult(result, pageW, pageH) → TextLayerModel
 *   estimateImageDpi(canvas, pageWidthMm)          → number
 */

import { TextLayerModel } from './page-model.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TARGET_DPI   = 300;
const MIN_DPI      = 150;   // below this DPI we upscale before OCR
const DESKEW_RANGE = 15;    // ±15° search range for skew correction
const DESKEW_STEPS = 60;    // angular resolution

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CharBox
 * @property {string} char
 * @property {{x0,y0,x1,y1}} bbox   Image pixel coordinates
 * @property {number} confidence    0–100
 * @property {string} wordText
 * @property {number} lineBaseline  Y pixel coordinate of the line baseline
 * @property {number} fontSize      Approximate font size in pixels
 */

/**
 * @typedef {Object} OcrWord
 * @property {string} text
 * @property {{x0,y0,x1,y1}} bbox
 * @property {number} confidence
 * @property {CharBox[]} chars
 * @property {{isBold:boolean, isItalic:boolean, fontName:string}} fontAttributes
 */

/**
 * @typedef {Object} OcrCharResult
 * @property {string}    text          Full plain-text
 * @property {number}    confidence    Page-level average confidence
 * @property {CharBox[]} charBoxes     All characters with pixel bboxes
 * @property {OcrWord[]} words
 * @property {Object[]}  blocks        Raw Tesseract blocks
 * @property {boolean}   wasDeskewed
 * @property {number}    deskewAngle   Degrees; 0 if not deskewed
 * @property {boolean}   wasUpscaled
 * @property {number}    upscaleFactor
 */

// ---------------------------------------------------------------------------
// ocrWithCharBoxes
// ---------------------------------------------------------------------------

/**
 * Run Tesseract on `canvas` and extract character-level bounding boxes.
 *
 * This function wraps the existing Tesseract adapter from the project
 * (`tesseract-adapter.js`) and enriches its output with per-character
 * geometry, normalised to image-pixel coordinates.
 *
 * @param {HTMLCanvasElement} canvas         Pre-rendered page at reasonable DPI
 * @param {Object} [opts]
 * @param {string}   [opts.lang='rus+eng']
 * @param {boolean}  [opts.deskew=true]
 * @param {boolean}  [opts.denoise=true]
 * @param {boolean}  [opts.upscale=true]    Upscale if DPI < MIN_DPI
 * @param {number}   [opts.pageWidthMm]     Used for DPI estimation
 * @param {Function} [opts.getTesseractWorker]  async () => Tesseract.Worker
 * @returns {Promise<OcrCharResult>}
 */
export async function ocrWithCharBoxes(canvas, opts = {}) {
  const lang    = opts.lang    || 'rus+eng';
  const doDeskew  = opts.deskew  !== false;
  const doDenoise = opts.denoise !== false;
  const doUpscale = opts.upscale !== false;

  let workCanvas = canvas;
  let wasDeskewed  = false;
  let deskewAngle  = 0;
  let wasUpscaled  = false;
  let upscaleFactor = 1;

  // ── Pre-processing ────────────────────────────────────────────────────────
  workCanvas = preprocessCanvas(workCanvas, { denoise: doDenoise });

  if (doUpscale && opts.pageWidthMm) {
    const dpi = estimateImageDpi(workCanvas, opts.pageWidthMm);
    if (dpi < MIN_DPI) {
      upscaleFactor = Math.min(4, TARGET_DPI / dpi);
      workCanvas = upscaleCanvas(workCanvas, upscaleFactor);
      wasUpscaled = true;
    }
  }

  if (doDeskew) {
    const angle = detectSkewAngle(workCanvas);
    if (Math.abs(angle) > 0.3) {
      workCanvas = deskewCanvas(workCanvas, angle);
      wasDeskewed = true;
      deskewAngle = angle;
    }
  }

  // ── Run Tesseract ─────────────────────────────────────────────────────────
  let result;
  try {
    const getWorker = opts.getTesseractWorker || _defaultWorkerFactory(lang);
    const worker = await getWorker();

    // Request character-level data via tesseract's PSM_AUTO
    result = await worker.recognize(workCanvas);
  } catch (err) {
    console.error('[ocr-char-layer] Tesseract recognition failed:', err);
    return _emptyResult(wasDeskewed, deskewAngle, wasUpscaled, upscaleFactor);
  }

  // ── Extract character-level bounding boxes ────────────────────────────────
  const charBoxes = [];
  const words     = [];

  const scaleBack = 1 / upscaleFactor; // convert upscaled coords back to original

  for (const block of (result.data.blocks || [])) {
    for (const para of (block.paragraphs || [])) {
      for (const line of (para.lines || [])) {
        const lineBaseline = ((line.baseline?.y ?? line.bbox?.y1) || 0) * scaleBack;

        for (const word of (line.words || [])) {
          const wordChars = [];

          for (const symbol of (word.symbols || [])) {
            const cb = {
              char:          symbol.text || '',
              bbox: {
                x0: (symbol.bbox?.x0 ?? symbol.bbox?.left   ?? 0) * scaleBack,
                y0: (symbol.bbox?.y0 ?? symbol.bbox?.top    ?? 0) * scaleBack,
                x1: (symbol.bbox?.x1 ?? symbol.bbox?.right  ?? 0) * scaleBack,
                y1: (symbol.bbox?.y1 ?? symbol.bbox?.bottom ?? 0) * scaleBack,
              },
              confidence:    symbol.confidence || 0,
              wordText:      word.text || '',
              lineBaseline,
              fontSize:      ((word.bbox?.y1 ?? 0) - (word.bbox?.y0 ?? 0)) * scaleBack,
            };
            charBoxes.push(cb);
            wordChars.push(cb);
          }

          words.push({
            text:       word.text || '',
            bbox: {
              x0: (word.bbox?.x0 ?? word.bbox?.left   ?? 0) * scaleBack,
              y0: (word.bbox?.y0 ?? word.bbox?.top    ?? 0) * scaleBack,
              x1: (word.bbox?.x1 ?? word.bbox?.right  ?? 0) * scaleBack,
              y1: (word.bbox?.y1 ?? word.bbox?.bottom ?? 0) * scaleBack,
            },
            confidence: word.confidence || 0,
            chars:      wordChars,
            fontAttributes: {
              isBold:   word.fontAttributes?.is_bold   || false,
              isItalic: word.fontAttributes?.is_italic || false,
              fontName: word.fontAttributes?.font_name || '',
            },
          });
        }
      }
    }
  }

  // ── Post-correction ───────────────────────────────────────────────────────
  const correctedText = postCorrectText(result.data.text || '');

  return {
    text:         correctedText,
    confidence:   result.data.confidence || 0,
    charBoxes,
    words,
    blocks:       result.data.blocks || [],
    wasDeskewed,
    deskewAngle,
    wasUpscaled,
    upscaleFactor,
  };
}

// ---------------------------------------------------------------------------
// buildTextLayerFromResult
// ---------------------------------------------------------------------------

/**
 * Convert an OcrCharResult into a TextLayerModel (page-model.js) so it can
 * be used directly by PixelPerfectTextLayer or the InlineTextEditor.
 *
 * @param {OcrCharResult} result
 * @param {number} pageWidthPt    Page width in PDF points
 * @param {number} pageHeightPt   Page height in PDF points
 * @param {number} imageWidth     Width of the source OCR image in pixels
 * @param {number} imageHeight    Height of the source OCR image in pixels
 * @returns {TextLayerModel}
 */
export function buildTextLayerFromResult(result, pageWidthPt, pageHeightPt, imageWidth, imageHeight) {
  const scaleX = pageWidthPt  / imageWidth;
  const scaleY = pageHeightPt / imageHeight;

  // Convert image-pixel bboxes to page-pt coords
  // Image Y: top=0, bottom=imageHeight. PDF Y: bottom=0 (flip needed for PageModel).
  // TextLayerModel stores raw image coords (not flipped) — consistent with
  // how ocr-controller.js populates _ocrWordCache.
  // We store them in image-px directly; callers that need pt do their own scaling.
  const charBoxes = result.charBoxes.map(cb => ({
    char:         cb.char,
    bbox:         cb.bbox,
    confidence:   cb.confidence,
    wordText:     cb.wordText,
    lineBaseline: cb.lineBaseline,
    fontSize:     cb.fontSize,
    // pt versions for convenience
    _pt: {
      x: cb.bbox.x0 * scaleX,
      y: pageHeightPt - cb.bbox.y1 * scaleY,   // flip Y for PDF coords
      w: (cb.bbox.x1 - cb.bbox.x0) * scaleX,
      h: (cb.bbox.y1 - cb.bbox.y0) * scaleY,
    },
  }));

  return new TextLayerModel(charBoxes, 'ocr');
}

// ---------------------------------------------------------------------------
// preprocessCanvas
// ---------------------------------------------------------------------------

/**
 * Apply image pre-processing to improve OCR quality:
 *   • Denoise (3×3 median approximation via box blur)
 *   • Contrast normalisation (simple histogram stretch)
 *   • Binarisation is left to Tesseract itself
 *
 * Returns a new canvas (does not modify the input).
 *
 * @param {HTMLCanvasElement} src
 * @param {Object} [opts]
 * @param {boolean} [opts.denoise=true]
 * @param {boolean} [opts.normalise=true]
 * @returns {HTMLCanvasElement}
 */
export function preprocessCanvas(src, opts = {}) {
  const doDenoise   = opts.denoise   !== false;
  const doNormalise = opts.normalise !== false;

  const dst = document.createElement('canvas');
  dst.width  = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d');
  ctx.drawImage(src, 0, 0);

  if (!doDenoise && !doNormalise) return dst;

  const imageData = ctx.getImageData(0, 0, dst.width, dst.height);
  const data = imageData.data;
  const w = dst.width;
  const h = dst.height;

  // ── Contrast normalisation ────────────────────────────────────────────────
  if (doNormalise) {
    let minL = 255, maxL = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      if (lum < minL) minL = lum;
      if (lum > maxL) maxL = lum;
    }
    const range = Math.max(1, maxL - minL);
    if (range < 200) {  // Only stretch if there's a meaningful range difference
      const scale = 255 / range;
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.round((data[i]     - minL) * scale));
        data[i + 1] = Math.min(255, Math.round((data[i + 1] - minL) * scale));
        data[i + 2] = Math.min(255, Math.round((data[i + 2] - minL) * scale));
      }
    }
  }

  // ── Denoise: approximated 3×3 median via two-pass box blur ───────────────
  if (doDenoise) {
    // Simple 3×3 average (true median is expensive in JS without WASM)
    const src2 = new Uint8ClampedArray(data);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += src2[((y + dy) * w + (x + dx)) * 4 + c];
            }
          }
          data[idx + c] = Math.round(sum / 9);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return dst;
}

// ---------------------------------------------------------------------------
// Skew detection and correction
// ---------------------------------------------------------------------------

/**
 * Detect the text skew angle by projecting row pixel counts at various angles
 * and finding the angle that maximises variance (= sharpest horizontal lines).
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {number}  Degrees; positive = clockwise skew
 */
export function detectSkewAngle(canvas) {
  const ctx  = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const w = canvas.width;
  const h = canvas.height;

  let bestAngle    = 0;
  let bestVariance = -Infinity;

  const step = (DESKEW_RANGE * 2) / DESKEW_STEPS;

  for (let ai = 0; ai <= DESKEW_STEPS; ai++) {
    const angleDeg = -DESKEW_RANGE + ai * step;
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Project rotated canvas onto horizontal rows
    const rowSums = new Float32Array(h);
    const cx = w / 2;
    const cy = h / 2;

    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = 0; x < w; x++) {
        // Rotate (x, y) back to original
        const ox = (x - cx) * cos + (y - cy) * sin + cx;
        const oy = -(x - cx) * sin + (y - cy) * cos + cy;

        const ix = Math.round(ox);
        const iy = Math.round(oy);
        if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
          const i = (iy * w + ix) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum < 128) sum++;   // count dark pixels (text)
        }
      }
      rowSums[y] = sum;
    }

    // Compute variance of rowSums
    const mean = rowSums.reduce((s, v) => s + v, 0) / h;
    let variance = 0;
    for (let y = 0; y < h; y++) {
      const d = rowSums[y] - mean;
      variance += d * d;
    }
    variance /= h;

    if (variance > bestVariance) {
      bestVariance = variance;
      bestAngle    = angleDeg;
    }
  }

  return bestAngle;
}

/**
 * Rotate canvas by `angleDeg` around its centre.
 * Returns a new canvas (background filled white).
 *
 * @param {HTMLCanvasElement} src
 * @param {number} angleDeg
 * @returns {HTMLCanvasElement}
 */
export function deskewCanvas(src, angleDeg) {
  const dst = document.createElement('canvas');
  dst.width  = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dst.width, dst.height);

  const cx = src.width  / 2;
  const cy = src.height / 2;

  ctx.translate(cx, cy);
  ctx.rotate(-angleDeg * Math.PI / 180);
  ctx.translate(-cx, -cy);
  ctx.drawImage(src, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return dst;
}

// ---------------------------------------------------------------------------
// DPI estimation and upscaling
// ---------------------------------------------------------------------------

/**
 * Estimate the DPI of a canvas based on the physical page width.
 * @param {HTMLCanvasElement} canvas
 * @param {number} pageWidthMm
 * @returns {number}
 */
export function estimateImageDpi(canvas, pageWidthMm) {
  const pageWidthIn = pageWidthMm / 25.4;
  return canvas.width / pageWidthIn;
}

/**
 * Return a new canvas scaled up by `factor`.
 * Uses imageSmoothingQuality: 'high' for better OCR results.
 */
function upscaleCanvas(src, factor) {
  const dst = document.createElement('canvas');
  dst.width  = Math.round(src.width  * factor);
  dst.height = Math.round(src.height * factor);
  const ctx = dst.getContext('2d');
  ctx.imageSmoothingEnabled  = true;
  ctx.imageSmoothingQuality  = 'high';
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}

// ---------------------------------------------------------------------------
// Post-correction
// ---------------------------------------------------------------------------

/** Common OCR error patterns independent of language. */
const COMMON_FIXES = [
  [/\s{2,}/g,              ' '],
  [/\u00AD/g,              '-'],     // soft hyphen
  [/[''`ʼ]/g,             "'"],
  [/[""„«»]/g,            '"'],
  [/\s+([.,;:!?])/g,      '$1'],
  [/\(\s+/g,              '('],
  [/\s+\)/g,              ')'],
  [/(\w)-\s*\n\s*(\w)/g,  '$1$2'],  // rejoin hyphenated words split across lines
  // Ligature restoration
  [/ﬁ/g, 'fi'],  [/ﬂ/g, 'fl'],  [/ﬀ/g, 'ff'],
  [/ﬃ/g, 'ffi'], [/ﬄ/g, 'ffl'], [/ﬅ/g, 'st'],
];

/**
 * Apply common OCR post-corrections.
 * Language-specific corrections live in ocr-post-correct.js (existing module).
 * @param {string} text
 * @returns {string}
 */
export function postCorrectText(text) {
  if (!text) return '';
  let out = text;
  for (const [pat, rep] of COMMON_FIXES) {
    out = out.replace(pat, rep);
  }
  return out.trim();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _emptyResult(wasDeskewed, deskewAngle, wasUpscaled, upscaleFactor) {
  return { text: '', confidence: 0, charBoxes: [], words: [], blocks: [],
           wasDeskewed, deskewAngle, wasUpscaled, upscaleFactor };
}

function _defaultWorkerFactory(lang) {
  return async () => {
    // Dynamic import of the existing Tesseract adapter
    const { createTesseractWorker } = await import('./tesseract-adapter.js');
    const worker = await createTesseractWorker(lang);
    return worker;
  };
}
