// ─── Unit Tests: Barcode Detection API ───────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBarcodeDetectionSupported,
  getSupportedFormats,
  detectBarcodes,
  detectQRCode,
} from '../../app/modules/barcode-detection.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.BarcodeDetector = class BarcodeDetector {
    static async getSupportedFormats() { return ['qr_code', 'ean_13', 'code_128']; }
    async detect(_image) {
      return [
        {
          rawValue: 'https://example.com',
          format: 'qr_code',
          boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        },
      ];
    }
  };
});

afterEach(() => {
  delete globalThis.BarcodeDetector;
});

// ─── isBarcodeDetectionSupported ─────────────────────────────────────────────

describe('isBarcodeDetectionSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isBarcodeDetectionSupported(), 'boolean');
  });

  it('returns true when BarcodeDetector is present', () => {
    assert.equal(isBarcodeDetectionSupported(), true);
  });

  it('returns false when BarcodeDetector is absent', () => {
    delete globalThis.BarcodeDetector;
    assert.equal(isBarcodeDetectionSupported(), false);
  });
});

// ─── getSupportedFormats ─────────────────────────────────────────────────────

describe('getSupportedFormats', () => {
  it('returns an array', async () => {
    const formats = await getSupportedFormats();
    assert.ok(Array.isArray(formats));
  });

  it('returns array of format strings', async () => {
    const formats = await getSupportedFormats();
    assert.ok(formats.length > 0);
    assert.ok(formats.every(f => typeof f === 'string'));
  });

  it('includes qr_code in supported formats', async () => {
    const formats = await getSupportedFormats();
    assert.ok(formats.includes('qr_code'));
  });

  it('includes ean_13 and code_128 in supported formats', async () => {
    const formats = await getSupportedFormats();
    assert.ok(formats.includes('ean_13'));
    assert.ok(formats.includes('code_128'));
  });

  it('returns empty array when BarcodeDetector is unsupported', async () => {
    delete globalThis.BarcodeDetector;
    const formats = await getSupportedFormats();
    assert.ok(Array.isArray(formats));
    assert.equal(formats.length, 0);
  });

  it('returns empty array when getSupportedFormats throws', async () => {
    globalThis.BarcodeDetector = class BarcodeDetector {
      static async getSupportedFormats() { throw new Error('not supported'); }
    };
    const formats = await getSupportedFormats();
    assert.ok(Array.isArray(formats));
    assert.equal(formats.length, 0);
  });
});

// ─── detectBarcodes ──────────────────────────────────────────────────────────

describe('detectBarcodes', () => {
  it('returns an array', async () => {
    const barcodes = await detectBarcodes(null);
    assert.ok(Array.isArray(barcodes));
  });

  it('returns barcode objects with rawValue', async () => {
    const barcodes = await detectBarcodes(null);
    assert.ok(barcodes.length > 0);
    assert.equal(typeof barcodes[0].rawValue, 'string');
  });

  it('returns barcode objects with format', async () => {
    const barcodes = await detectBarcodes(null);
    assert.ok(barcodes.length > 0);
    assert.equal(typeof barcodes[0].format, 'string');
  });

  it('returns barcode objects with boundingBox', async () => {
    const barcodes = await detectBarcodes(null);
    assert.ok(barcodes.length > 0);
    assert.ok(barcodes[0].boundingBox !== null && typeof barcodes[0].boundingBox === 'object');
  });

  it('returns correct rawValue from mock', async () => {
    const barcodes = await detectBarcodes(null);
    assert.equal(barcodes[0].rawValue, 'https://example.com');
  });

  it('returns correct format from mock', async () => {
    const barcodes = await detectBarcodes(null);
    assert.equal(barcodes[0].format, 'qr_code');
  });

  it('returns empty array when BarcodeDetector is unsupported', async () => {
    delete globalThis.BarcodeDetector;
    const barcodes = await detectBarcodes(null);
    assert.ok(Array.isArray(barcodes));
    assert.equal(barcodes.length, 0);
  });

  it('returns empty array when detect throws', async () => {
    globalThis.BarcodeDetector = class BarcodeDetector {
      async detect(_image) { throw new Error('detection failed'); }
    };
    const barcodes = await detectBarcodes(null);
    assert.ok(Array.isArray(barcodes));
    assert.equal(barcodes.length, 0);
  });

  it('returns only rawValue, format, and boundingBox properties', async () => {
    const barcodes = await detectBarcodes(null);
    assert.ok(barcodes.length > 0);
    const keys = Object.keys(barcodes[0]).sort();
    assert.deepEqual(keys, ['boundingBox', 'format', 'rawValue']);
  });
});

// ─── detectQRCode ─────────────────────────────────────────────────────────────

describe('detectQRCode', () => {
  it('returns the rawValue string of the first QR code', async () => {
    const value = await detectQRCode(null);
    assert.equal(value, 'https://example.com');
  });

  it('returns a string', async () => {
    const value = await detectQRCode(null);
    assert.equal(typeof value, 'string');
  });

  it('returns null when no QR codes are detected', async () => {
    globalThis.BarcodeDetector = class BarcodeDetector {
      async detect(_image) {
        return [
          { rawValue: '978-3-16-148410-0', format: 'ean_13', boundingBox: { x: 0, y: 0, width: 50, height: 50 } },
        ];
      }
    };
    const value = await detectQRCode(null);
    assert.equal(value, null);
  });

  it('returns null when detect returns empty array', async () => {
    globalThis.BarcodeDetector = class BarcodeDetector {
      async detect(_image) { return []; }
    };
    const value = await detectQRCode(null);
    assert.equal(value, null);
  });

  it('returns null when BarcodeDetector is unsupported', async () => {
    delete globalThis.BarcodeDetector;
    const value = await detectQRCode(null);
    assert.equal(value, null);
  });

  it('returns the first QR code when multiple are present', async () => {
    globalThis.BarcodeDetector = class BarcodeDetector {
      async detect(_image) {
        return [
          { rawValue: 'first-qr', format: 'qr_code', boundingBox: { x: 0, y: 0, width: 50, height: 50 } },
          { rawValue: 'second-qr', format: 'qr_code', boundingBox: { x: 60, y: 0, width: 50, height: 50 } },
        ];
      }
    };
    const value = await detectQRCode(null);
    assert.equal(value, 'first-qr');
  });

  it('returns QR code rawValue even when mixed with other formats', async () => {
    globalThis.BarcodeDetector = class BarcodeDetector {
      async detect(_image) {
        return [
          { rawValue: '123456789', format: 'code_128', boundingBox: { x: 0, y: 0, width: 50, height: 50 } },
          { rawValue: 'qr-value', format: 'qr_code', boundingBox: { x: 60, y: 0, width: 50, height: 50 } },
        ];
      }
    };
    const value = await detectQRCode(null);
    assert.equal(value, 'qr-value');
  });
});
