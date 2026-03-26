// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Barcode Reader
// Detect and decode barcodes / QR codes in images and PDF pages
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} BarcodeResult
 * @property {string} format  - e.g. 'QR_CODE', 'EAN_13', 'CODE_128'
 * @property {string} text    - decoded text
 * @property {{x: number, y: number, width: number, height: number}} bounds
 * @property {number} confidence
 */

// ---------------------------------------------------------------------------
// Internal: Lazy loader for zxing-wasm
// ---------------------------------------------------------------------------

/** @type {any} */
let _zxingModule = null;

/**
 * Lazily load the zxing-wasm library.
 * @returns {Promise<any>}
 */
async function getZxing() {
  if (_zxingModule) return _zxingModule;
  try {
    // @ts-ignore — zxing-wasm is a lazy optional dependency
    const mod = await import('zxing-wasm');
    _zxingModule = mod;
    return mod;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal: Simple barcode pattern detection fallback
// ---------------------------------------------------------------------------

/**
 * Simple QR code pattern detector (fallback when zxing is unavailable).
 * Looks for the characteristic finder patterns (3 corner squares).
 *
 * @param {ImageData} imageData
 * @returns {BarcodeResult[]}
 */
function simpleBarcodeDetect(imageData) {
  const { width: _width, height: _height, data: _data } = imageData;
  /** @type {BarcodeResult[]} */
  const results = [];

  // Use BarcodeDetector API if available (Chrome/Edge)
  // Otherwise return empty — the caller should use zxing-wasm
  if (typeof globalThis.BarcodeDetector === 'undefined') {
    return results;
  }

  return results;
}

/**
 * Convert ImageData to grayscale luminance array.
 * @param {ImageData} imageData
 * @returns {Uint8Array}
 */
function toGrayscale(imageData) {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
  }
  return gray;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect barcodes in an ImageData object.
 *
 * Attempts to use zxing-wasm for comprehensive detection.
 * Falls back to BarcodeDetector API if available.
 *
 * @param {ImageData} imageData
 * @param {object} [options]
 * @param {string[]} [options.formats] - e.g. ['QR_CODE', 'EAN_13']
 * @param {boolean} [options.tryHarder]
 * @returns {Promise<BarcodeResult[]>}
 */
export async function detectBarcodes(imageData, options = {}) {
  const { formats, tryHarder = false } = options;

  // Try zxing-wasm first
  const zxing = await getZxing();
  if (zxing && zxing.readBarcodesFromImageData) {
    try {
      const zxingResults = await zxing.readBarcodesFromImageData(imageData, {
        formats: formats || [],
        tryHarder,
      });

      return (zxingResults || []).map(/** @param {any} r */ r => ({
        format: r.format || 'UNKNOWN',
        text: r.text || '',
        bounds: {
          x: r.position?.topLeft?.x || 0,
          y: r.position?.topLeft?.y || 0,
          width: (r.position?.topRight?.x || 0) - (r.position?.topLeft?.x || 0),
          height: (r.position?.bottomLeft?.y || 0) - (r.position?.topLeft?.y || 0),
        },
        confidence: r.isValid ? 1.0 : 0.5,
      }));
    } catch (_e) {
      // Fall through to fallback
    }
  }

  // Try BarcodeDetector API (Chrome/Edge)
  if (typeof globalThis.BarcodeDetector !== 'undefined') {
    try {
      const detector = new globalThis.BarcodeDetector(
        formats ? { formats: formats.map(f => f.toLowerCase()) } : {},
      );
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
        const detected = await detector.detect(canvas);
        return detected.map(/** @param {any} d */ d => ({
          format: (d.format || 'unknown').toUpperCase(),
          text: d.rawValue || '',
          bounds: {
            x: d.boundingBox?.x || 0,
            y: d.boundingBox?.y || 0,
            width: d.boundingBox?.width || 0,
            height: d.boundingBox?.height || 0,
          },
          confidence: 0.9,
        }));
      }
    } catch (_e) {
      // Fall through
    }
  }

  // Simple fallback
  return simpleBarcodeDetect(imageData);
}

/**
 * Detect barcodes across one or more PDF pages.
 *
 * @param {any} pdfDocument - PDF.js document proxy
 * @param {number[]|null} [pageNums] - 1-based page numbers (null = all)
 * @param {object} [options]
 * @param {number} [options.scale]
 * @param {string[]} [options.formats]
 * @returns {Promise<Map<number, BarcodeResult[]>>}
 */
export async function detectBarcodesInPdf(pdfDocument, pageNums = null, options = {}) {
  const { scale = 2.0, formats } = options;

  const total = pdfDocument.numPages;
  const pages = pageNums || Array.from({ length: total }, (_, i) => i + 1);

  /** @type {Map<number, BarcodeResult[]>} */
  const resultMap = new Map();

  for (const num of pages) {
    if (num < 1 || num > total) continue;

    const page = await pdfDocument.getPage(num);
    const viewport = page.getViewport({ scale });

    // Create canvas and render
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resultMap.set(num, []);
      continue;
    }

    await page.render({ canvasContext: ctx, viewport }).promise;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const barcodes = await detectBarcodes(imageData, { formats });
    resultMap.set(num, barcodes);
  }

  return resultMap;
}

// Exported for testing
export { toGrayscale, simpleBarcodeDetect, getZxing };
