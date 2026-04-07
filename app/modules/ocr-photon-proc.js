// @ts-check
// ─── OCR Photon Pre-processor ─────────────────────────────────────────────────
// Uses @silvia-odwyer/photon (Rust/WASM) to apply fast, SIMD-accelerated image
// enhancements to the raw canvas before it enters the existing Tesseract
// preprocessing pipeline.
//
// Operations applied (in order):
//   1. grayscale_human_corrected — perceptually-weighted luminance conversion
//   2. sharpen — deconvolution-based sharpening (improves blurry scans)
//
// The existing JS-based preprocessOcrCanvas already handles threshold / Otsu /
// contrast stretching, so we avoid duplicating those steps here.
//
// Integration: `photonEnhanceCanvas(canvas)` returns a NEW canvas with the
// enhanced image. Pass it as the input to preprocessOcrCanvas variants.
// Falls back to the original canvas if Photon WASM is unavailable.

// ─── Lazy WASM loader ────────────────────────────────────────────────────────

/** @type {any | null} */
let _photon = null;
let _loading = false;
/** @type {Array<(mod: any|null) => void>} */
const _waiters = [];

/**
 * Load @silvia-odwyer/photon lazily (WASM must be initialised before use).
 * Resolves to the photon module or null if unavailable (e.g. SSR/test env).
 * @returns {Promise<any|null>}
 */
async function _loadPhoton() {
  if (_photon) return _photon;
  if (_loading) return new Promise(res => _waiters.push(res));

  _loading = true;
  try {
    // Dynamic import so the WASM binary is only fetched when OCR is triggered.
    const mod = await import('@silvia-odwyer/photon');
    // Photon WASM requires an async init call (default export) before any use.
    if (typeof mod.default === 'function') {
      await mod.default();
    }
    _photon = mod;
    _waiters.forEach(r => r(_photon));
    return _photon;
  } catch (err) {
    console.warn('[ocr-photon] Photon WASM unavailable:', /** @type {Error} */ (err).message);
    _waiters.forEach(r => r(null));
    return null;
  } finally {
    _loading = false;
    _waiters.length = 0;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine whether a canvas image likely comes from a scanned document
 * (high contrast variance, possibly blurry) vs. a digital/vector PDF page
 * (clean, sharp, uniform backgrounds).
 *
 * Photon enhancement is most beneficial for scanned pages; it's unnecessary
 * (and slightly risky) for clean vector pages.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {boolean}
 */
export function looksLikeScannedPage(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return false;

  // Sample a grid of 16×16 pixels uniformly across the page
  const SAMPLES = 16;
  const dx = Math.floor(canvas.width / SAMPLES);
  const dy = Math.floor(canvas.height / SAMPLES);
  if (dx < 1 || dy < 1) return false;

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const w = canvas.width;

  let sum = 0;
  let sumSq = 0;
  let n = 0;

  for (let row = 0; row < SAMPLES; row++) {
    for (let col = 0; col < SAMPLES; col++) {
      const px = (row * dy * w + col * dx) * 4;
      const gray = data[px] * 0.299 + data[px + 1] * 0.587 + data[px + 2] * 0.114;
      sum += gray;
      sumSq += gray * gray;
      n++;
    }
  }

  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  // High variance → textured/noisy → scanned. Low variance → uniform → vector.
  return variance > 800; // empirically determined threshold
}

/**
 * Apply Photon WASM image enhancements to a canvas for OCR.
 *
 * Steps:
 *   1. grayscale_human_corrected (perceptual luminance weighting)
 *   2. sharpen (improves blurry scans)
 *
 * @param {HTMLCanvasElement} srcCanvas  Source canvas (not modified)
 * @returns {Promise<HTMLCanvasElement>}
 *   Enhanced canvas, or srcCanvas unchanged if Photon is unavailable.
 */
export async function photonEnhanceCanvas(srcCanvas) {
  if (!srcCanvas.width || !srcCanvas.height) return srcCanvas;

  const photon = await _loadPhoton();
  if (!photon) return srcCanvas;

  // Create an output canvas that matches the source dimensions
  const out = document.createElement('canvas');
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return srcCanvas;

  try {
    // Copy source → output canvas so Photon operates on a separate copy
    outCtx.drawImage(srcCanvas, 0, 0);

    // get_image_data() returns a PhotonImage from the canvas content
    const photonImg = photon.get_image_data(out, outCtx);

    // Step 1: perceptual grayscale (accounts for human luminance sensitivity)
    photon.grayscale_human_corrected(photonImg);

    // Step 2: sharpen — deconvolution kernel improves blurry scan readability
    photon.sharpen(photonImg);

    // Write the processed PhotonImage back to the output canvas
    photon.putImageData(out, outCtx, photonImg);

    return out;
  } catch (err) {
    console.warn('[ocr-photon] enhancement failed:', /** @type {Error} */ (err).message);
    return srcCanvas;
  }
}

/**
 * Warm up the Photon WASM module in the background.
 * Call once after document open so the first OCR call doesn't pay
 * the WASM initialization cost.
 */
export function warmupPhoton() {
  _loadPhoton().catch(() => {});
}
