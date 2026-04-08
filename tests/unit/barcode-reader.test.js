import './setup-dom.js';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectBarcodes,
  detectBarcodesInPdf,
  toGrayscale,
  simpleBarcodeDetect,
} from '../../app/modules/barcode-reader.js';

// ---------------------------------------------------------------------------
// toGrayscale
// ---------------------------------------------------------------------------

describe('toGrayscale', () => {
  it('converts RGBA ImageData to grayscale Uint8Array', () => {
    // 2x2 white pixels
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
      128, 128, 128, 255,
      255, 0, 0, 255,
    ]);
    const imageData = { width: 2, height: 2, data };
    const gray = toGrayscale(imageData);
    assert.ok(gray instanceof Uint8Array);
    assert.equal(gray.length, 4);
    // White pixel -> 255
    assert.equal(gray[0], 255);
    // Black pixel -> 0
    assert.equal(gray[1], 0);
    // Gray pixel -> 128
    assert.equal(gray[2], 128);
    // Red pixel -> ~76 (0.299*255)
    assert.ok(gray[3] > 70 && gray[3] < 80);
  });

  it('returns correct length for given dimensions', () => {
    const data = new Uint8ClampedArray(3 * 5 * 4);
    const imageData = { width: 3, height: 5, data };
    const gray = toGrayscale(imageData);
    assert.equal(gray.length, 15);
  });
});

// ---------------------------------------------------------------------------
// simpleBarcodeDetect
// ---------------------------------------------------------------------------

describe('simpleBarcodeDetect', () => {
  it('returns empty array when BarcodeDetector is not available', () => {
    const data = new Uint8ClampedArray(10 * 10 * 4);
    const imageData = { width: 10, height: 10, data };
    const results = simpleBarcodeDetect(imageData);
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });
});

// ---------------------------------------------------------------------------
// detectBarcodes
// ---------------------------------------------------------------------------

describe('detectBarcodes', () => {
  it('is a function', () => {
    assert.equal(typeof detectBarcodes, 'function');
  });

  it('returns an array (empty) for a blank ImageData without zxing', async () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    const imageData = { width: 4, height: 4, data };
    const results = await detectBarcodes(imageData);
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });

  it('accepts options parameter with formats and tryHarder', async () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    const imageData = { width: 4, height: 4, data };
    const results = await detectBarcodes(imageData, {
      formats: ['QR_CODE'],
      tryHarder: true,
    });
    assert.ok(Array.isArray(results));
  });
});

// ---------------------------------------------------------------------------
// detectBarcodesInPdf
// ---------------------------------------------------------------------------

describe('detectBarcodesInPdf', () => {
  it('is a function', () => {
    assert.equal(typeof detectBarcodesInPdf, 'function');
  });

  it('has correct arity (pdfDocument, pageNums, options)', () => {
    assert.ok(detectBarcodesInPdf.length >= 1);
  });
});

// ---------------------------------------------------------------------------
// detectBarcodes with BarcodeDetector mock
// ---------------------------------------------------------------------------

describe('detectBarcodes — BarcodeDetector path', () => {
  afterEach(() => {
    delete globalThis.BarcodeDetector;
  });

  it('uses BarcodeDetector when available and returns results', async () => {
    // Mock BarcodeDetector API (Chrome/Edge shape)
    globalThis.BarcodeDetector = class MockBarcodeDetector {
      constructor() {}
      async detect(_canvas) {
        return [
          {
            format: 'qr_code',
            rawValue: 'https://example.com',
            boundingBox: { x: 10, y: 20, width: 50, height: 50 },
          },
        ];
      }
    };

    const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
    const imageData = { width: 100, height: 100, data };
    const results = await detectBarcodes(imageData);

    assert.ok(Array.isArray(results));
    assert.equal(results.length, 1);
    assert.equal(results[0].format, 'QR_CODE');
    assert.equal(results[0].text, 'https://example.com');
    assert.equal(results[0].bounds.x, 10);
    assert.equal(results[0].confidence, 0.9);
  });

  it('returns empty array when BarcodeDetector.detect throws', async () => {
    globalThis.BarcodeDetector = class {
      constructor() {}
      async detect() { throw new Error('detect failed'); }
    };

    const data = new Uint8ClampedArray(10 * 10 * 4);
    const imageData = { width: 10, height: 10, data };
    const results = await detectBarcodes(imageData);
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });

  it('handles formats option passed to BarcodeDetector', async () => {
    const ctorArgs = [];
    globalThis.BarcodeDetector = class {
      constructor(opts) { ctorArgs.push(opts); }
      async detect() { return []; }
    };

    const data = new Uint8ClampedArray(4 * 4 * 4);
    const imageData = { width: 4, height: 4, data };
    await detectBarcodes(imageData, { formats: ['QR_CODE', 'EAN_13'] });

    assert.equal(ctorArgs.length, 1);
    assert.ok(ctorArgs[0].formats.includes('qr_code'));
    assert.ok(ctorArgs[0].formats.includes('ean_13'));
  });
});
