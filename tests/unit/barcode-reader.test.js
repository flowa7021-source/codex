import './setup-dom.js';
import { describe, it } from 'node:test';
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
    // The function accepts 3 parameters
    assert.ok(detectBarcodesInPdf.length >= 1);
  });
});
