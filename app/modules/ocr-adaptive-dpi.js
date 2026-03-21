// ─── Adaptive DPI Module ─────────────────────────────────────────────────────
// Analyzes page content to determine optimal OCR zoom/DPI.
// Detects text density, average stroke width, and contrast to pick
// the best preprocessing scale. Fully offline — no network calls.

const MIN_SCALE = 1.2;
const MAX_SCALE = 6.0;
const TARGET_STROKE_PX = 3.0; // ideal stroke width after scaling

/**
 * Analyze a grayscale canvas to estimate text density and stroke characteristics.
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @returns {{ density: number, avgStrokeWidth: number, contrast: number, suggestedScale: number }}
 */
export function analyzeTextDensity(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { density: 0, avgStrokeWidth: 1, contrast: 0, suggestedScale: 2.0 };
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return { density: 0, avgStrokeWidth: 1, contrast: 0, suggestedScale: 2.0 };

  // Sample center region (avoid borders/headers)
  const sx = Math.floor(w * 0.1);
  const sy = Math.floor(h * 0.15);
  const sw = Math.floor(w * 0.8);
  const sh = Math.floor(h * 0.7);
  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const data = imageData.data;
  const totalPx = sw * sh;

  // Compute grayscale histogram
  let darkPx = 0;
  let min = 255, max = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const gray = Math.round(g);
    sum += gray;
    if (gray < 128) darkPx++;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const _mean = sum / totalPx;
  const contrast = (max - min) / 255;
  const density = darkPx / totalPx; // 0..1, how much "ink" on page

  // Estimate average stroke width by horizontal run-length analysis
  let totalRuns = 0;
  let totalRunLength = 0;
  const rowStep = Math.max(1, Math.floor(sh / 40)); // sample ~40 rows

  for (let y = 0; y < sh; y += rowStep) {
    let inRun = false;
    let runLen = 0;
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const gray = data[idx];
      if (gray < 128) {
        if (!inRun) { inRun = true; runLen = 0; }
        runLen++;
      } else {
        if (inRun) {
          totalRuns++;
          totalRunLength += runLen;
          inRun = false;
        }
      }
    }
    if (inRun) { totalRuns++; totalRunLength += runLen; }
  }

  const avgStrokeWidth = totalRuns > 0 ? totalRunLength / totalRuns : 1;

  // Compute suggested scale
  let suggestedScale = TARGET_STROKE_PX / Math.max(0.5, avgStrokeWidth);

  // Adjust for density: dense pages need less scale (already enough detail)
  if (density > 0.25) suggestedScale *= 0.8;
  if (density < 0.05) suggestedScale *= 1.3; // very sparse = maybe small text

  // Adjust for low contrast
  if (contrast < 0.3) suggestedScale *= 1.2;

  suggestedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, suggestedScale));

  return {
    density: Math.round(density * 1000) / 1000,
    avgStrokeWidth: Math.round(avgStrokeWidth * 100) / 100,
    contrast: Math.round(contrast * 100) / 100,
    suggestedScale: Math.round(suggestedScale * 100) / 100,
  };
}

/**
 * Given page dimensions and analysis, compute optimal render zoom for OCR.
 * @param {number} pageWidth - natural page width in px
 * @param {number} pageHeight - natural page height in px
 * @param {{ suggestedScale: number }} analysis - from analyzeTextDensity
 * @param {number} maxPixels - max total pixels (default 4.8M)
 * @returns {number} zoom factor
 */
export function computeOcrZoom(pageWidth, pageHeight, analysis, maxPixels = 4_800_000) {
  let zoom = analysis?.suggestedScale || 2.0;
  const pixels = pageWidth * zoom * pageHeight * zoom;
  if (pixels > maxPixels) {
    zoom = Math.sqrt(maxPixels / (pageWidth * pageHeight));
  }
  return Math.max(MIN_SCALE, Math.round(zoom * 100) / 100);
}

/**
 * Quick check: does this page look like it has very small text?
 * @param {HTMLCanvasElement} canvas
 * @returns {boolean}
 */
export function hasSmallText(canvas) {
  const analysis = analyzeTextDensity(canvas);
  return analysis.avgStrokeWidth < 1.5 && analysis.density > 0.03;
}
