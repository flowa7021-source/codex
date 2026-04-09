// @ts-check
// ─── Image Processing ────────────────────────────────────────────────────────
// Image processing utilities for PDF page handling, including scale calculation,
// progressive downscaling, and conversions between image formats.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert an ImageBitmap to an HTMLCanvasElement by drawing it into a new canvas.
 */
export function imageBitmapToCanvas(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(bitmap, 0, 0);
  }
  return canvas;
}

/**
 * Convert a Blob to an ImageBitmap.
 * Resolves with the decoded ImageBitmap ready for drawing.
 */
export async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * Calculate the optimal scale factor to fit content within maxWidth x maxHeight.
 * Never scales up — returns at most 1.0 when content already fits.
 */
export function calculateFitScale(
  contentWidth: number,
  contentHeight: number,
  maxWidth: number,
  maxHeight: number,
): number {
  if (contentWidth <= 0 || contentHeight <= 0) return 1;
  const scaleX = maxWidth / contentWidth;
  const scaleY = maxHeight / contentHeight;
  return Math.min(1, scaleX, scaleY);
}

/**
 * Calculate the scale to fill the container (crop-to-fill / cover behaviour).
 * Returns the larger of the two axis scales so the content covers the container.
 */
export function calculateFillScale(
  contentWidth: number,
  contentHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (contentWidth <= 0 || contentHeight <= 0) return 1;
  const scaleX = containerWidth / contentWidth;
  const scaleY = containerHeight / contentHeight;
  return Math.max(scaleX, scaleY);
}

/**
 * Get the pixel ratio for high-DPI rendering.
 * Falls back to 1 in environments where `window` is unavailable.
 */
export function getDevicePixelRatio(): number {
  if (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number') {
    return window.devicePixelRatio || 1;
  }
  return 1;
}

/**
 * Create an image element from a URL, resolving when the image has loaded.
 * Rejects if the image fails to load.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${src} — ${String(err)}`));
    img.src = src;
  });
}

/**
 * Downscale an image progressively for better quality than a single-step resize.
 * Each step halves the dimensions (approximately) until the target is reached.
 *
 * @param canvas       - Source canvas to downscale.
 * @param targetWidth  - Target width in pixels.
 * @param targetHeight - Target height in pixels.
 * @param steps        - Number of intermediate steps (default: 4). More steps = better quality.
 * @returns A new canvas at targetWidth x targetHeight.
 */
export function progressiveDownscale(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  steps = 4,
): HTMLCanvasElement {
  if (steps <= 0 || canvas.width === 0 || canvas.height === 0) {
    // Fallback: single-step scale
    const out = document.createElement('canvas');
    out.width = targetWidth;
    out.height = targetHeight;
    const ctx = out.getContext('2d');
    if (ctx) ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    return out;
  }

  let current: HTMLCanvasElement = canvas;
  let curW = canvas.width;
  let curH = canvas.height;

  for (let step = 0; step < steps; step++) {
    const isLastStep = step === steps - 1;
    const nextW = isLastStep ? targetWidth : Math.max(targetWidth, Math.round(curW / 2));
    const nextH = isLastStep ? targetHeight : Math.max(targetHeight, Math.round(curH / 2));

    // If we've already reached the target, stop early
    if (nextW === curW && nextH === curH) break;

    const next = document.createElement('canvas');
    next.width = nextW;
    next.height = nextH;
    const ctx = next.getContext('2d');
    if (ctx) ctx.drawImage(current, 0, 0, nextW, nextH);

    current = next;
    curW = nextW;
    curH = nextH;

    if (curW === targetWidth && curH === targetHeight) break;
  }

  return current;
}
