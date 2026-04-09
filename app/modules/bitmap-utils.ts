// @ts-check
// ─── Bitmap Utilities ────────────────────────────────────────────────────────
// Canvas/bitmap manipulation utilities for the PDF viewer.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create an OffscreenCanvas or regular canvas with given dimensions.
 * Prefers OffscreenCanvas when available (Web Workers / modern browsers).
 */
export function createCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Convert a canvas to a Blob (PNG by default).
 * Uses `convertToBlob` for OffscreenCanvas, `toBlob` for HTMLCanvasElement.
 */
export async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    const blob = await (canvas as OffscreenCanvas).convertToBlob({ type, quality });
    return blob;
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('toBlob returned null'));
        }
      },
      type,
      quality,
    );
  });
}

/**
 * Convert a canvas to a base64 data URL.
 */
export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): string {
  return canvas.toDataURL(type, quality);
}

/**
 * Scale a canvas to new dimensions and return a new canvas.
 * Draws the source canvas scaled to the target width/height.
 */
export function scaleCanvas(
  source: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
): HTMLCanvasElement {
  const dest = document.createElement('canvas');
  dest.width = width;
  dest.height = height;
  const ctx = dest.getContext('2d');
  if (ctx) {
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  }
  return dest;
}

/**
 * Crop a canvas to a region defined by (x, y, width, height).
 * Returns a new canvas containing only the cropped area.
 */
export function cropCanvas(
  source: HTMLCanvasElement | OffscreenCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const dest = document.createElement('canvas');
  dest.width = width;
  dest.height = height;
  const ctx = dest.getContext('2d');
  if (ctx) {
    ctx.drawImage(source as CanvasImageSource, -x, -y);
  }
  return dest;
}

/**
 * Apply a simple grayscale filter to a canvas (in-place).
 * Converts every pixel's RGB channels to the luminance value.
 */
export function applyGrayscale(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  if (width === 0 || height === 0) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Standard luminance weights (ITU-R BT.601)
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // alpha (data[i + 3]) is left unchanged
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Get pixel color at coordinates (x, y).
 * Returns an object with r, g, b, a channel values (0–255).
 */
export function getPixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { r: 0, g: 0, b: 0, a: 0 };
  const imageData = ctx.getImageData(x, y, 1, 1);
  const { data } = imageData;
  return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: data[3] ?? 0 };
}
