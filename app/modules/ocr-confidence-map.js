// @ts-check
// ─── OCR Confidence Map Overlay ──────────────────────────────────────────────
// Renders a color-coded overlay on the annotation canvas to visualize
// word-level OCR confidence. Green = high (>=90), yellow = medium (70-89),
// red = low (<70). Controlled by state.ocrConfidenceMode.

import { state } from './state.js';

/**
 * Color presets for confidence levels (semi-transparent).
 * @type {Object<string, string>}
 */
const CONFIDENCE_COLORS = {
  high:   'rgba(0, 180, 60, 0.25)',   // green — confidence >= 90
  medium: 'rgba(230, 180, 0, 0.25)',  // yellow — confidence 70–89
  low:    'rgba(220, 40, 30, 0.30)',   // red — confidence < 70
};

/**
 * Border colors used to outline each word rectangle for better visibility.
 * @type {Object<string, string>}
 */
const CONFIDENCE_BORDERS = {
  high:   'rgba(0, 180, 60, 0.45)',
  medium: 'rgba(230, 180, 0, 0.50)',
  low:    'rgba(220, 40, 30, 0.55)',
};

/**
 * Determine the confidence level string for a numeric confidence value.
 * @param {number} confidence - 0–100
 * @returns {'high'|'medium'|'low'}
 */
function getLevel(confidence) {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

/**
 * Render a color-coded confidence overlay on top of the given canvas.
 *
 * Each word in `words` is expected to have:
 *   - text {string}
 *   - bbox {object} with x0, y0, x1, y1 in **normalised [0,1]** coordinates
 *     (same convention used by the OCR text-layer in render-controller.js)
 *   - confidence {number} 0–100
 *
 * The overlay is drawn on the canvas's 2D context. The caller is responsible
 * for ensuring the canvas has already been sized correctly (the annotation
 * canvas is resized in _updateAnnotationCanvas).
 *
 * @param {Array<{text: string, bbox: {x0: number, y0: number, x1: number, y1: number}, confidence: number}>} words
 * @param {HTMLCanvasElement} canvas - The annotation (overlay) canvas.
 * @param {number} pageWidth  - Logical page width in CSS pixels (display width).
 * @param {number} pageHeight - Logical page height in CSS pixels (display height).
 */
export function renderConfidenceOverlay(words, canvas, pageWidth, pageHeight) {
  if (!canvas || !words || !words.length) return;
  if (!state.ocrConfidenceMode) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // The annotation canvas may be scaled by devicePixelRatio.  Determine the
  // ratio between the canvas's backing-store size and the logical display size
  // so rectangles land in the right place.
  const scaleX = canvas.width / pageWidth;
  const scaleY = canvas.height / pageHeight;

  for (const word of words) {
    if (word.confidence == null || !word.bbox) continue;

    // Skip words with out-of-range normalised coordinates
    if (word.bbox.x0 < 0 || word.bbox.x1 > 1 || word.bbox.y0 < 0 || word.bbox.y1 > 1) continue;

    const level = getLevel(word.confidence);

    // Map normalised [0,1] bbox → canvas backing-store pixels.
    const x = word.bbox.x0 * pageWidth * scaleX;
    const y = word.bbox.y0 * pageHeight * scaleY;
    const w = (word.bbox.x1 - word.bbox.x0) * pageWidth * scaleX;
    const h = (word.bbox.y1 - word.bbox.y0) * pageHeight * scaleY;

    // Fill
    ctx.fillStyle = CONFIDENCE_COLORS[level];
    ctx.fillRect(x, y, w, h);

    // Thin border for definition
    ctx.strokeStyle = CONFIDENCE_BORDERS[level];
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
}

/**
 * Clear only the confidence overlay from the canvas.
 *
 * Because the annotation canvas is shared with drawing strokes and other
 * overlays, a full clearRect is NOT safe here.  Instead, the recommended
 * approach is to re-render the entire annotation canvas (which the app
 * already does via _deps.renderAnnotations()).  This function is provided
 * as a convenience for the simple case where the confidence overlay is the
 * only content on the canvas, or the caller will re-render everything
 * after calling this.
 *
 * @param {HTMLCanvasElement} canvas
 */
export function clearConfidenceOverlay(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
