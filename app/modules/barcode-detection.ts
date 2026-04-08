// ─── Barcode Detection API ────────────────────────────────────────────────────
// Wrapper for the BarcodeDetector API for detecting barcodes and QR codes
// in images, video frames, and other image sources.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the BarcodeDetector API is supported.
 */
export function isBarcodeDetectionSupported(): boolean {
  return typeof (globalThis as any).BarcodeDetector !== 'undefined';
}

/**
 * Get supported barcode formats.
 * Returns empty array if unsupported.
 */
export async function getSupportedFormats(): Promise<string[]> {
  if (!isBarcodeDetectionSupported()) return [];
  try {
    return await (globalThis as any).BarcodeDetector.getSupportedFormats();
  } catch {
    return [];
  }
}

/**
 * Detect barcodes in an image (ImageBitmap, HTMLImageElement, HTMLVideoElement, etc.).
 * Returns array of detected barcodes with rawValue, format, and boundingBox.
 */
export async function detectBarcodes(
  image: ImageBitmapSource,
): Promise<Array<{ rawValue: string; format: string; boundingBox: DOMRectReadOnly }>> {
  if (!isBarcodeDetectionSupported()) return [];
  try {
    const detector = new (globalThis as any).BarcodeDetector();
    const results = await detector.detect(image);
    return results.map((b: any) => ({
      rawValue: b.rawValue,
      format: b.format,
      boundingBox: b.boundingBox,
    }));
  } catch {
    return [];
  }
}

/**
 * Detect the first QR code in an image.
 * Returns the raw value string or null if not found.
 */
export async function detectQRCode(image: ImageBitmapSource): Promise<string | null> {
  const barcodes = await detectBarcodes(image);
  const qr = barcodes.find(b => b.format === 'qr_code');
  return qr?.rawValue ?? null;
}
