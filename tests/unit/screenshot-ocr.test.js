// ─── Unit Tests: Screenshot OCR ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScreenshotOcr } from '../../app/modules/screenshot-ocr.js';

describe('ScreenshotOcr', () => {
  it('can be instantiated', () => {
    const ocr = new ScreenshotOcr();
    assert.ok(ocr);
    assert.equal(ocr._lastCapture, null);
  });

  it('has captureRegion method', () => {
    const ocr = new ScreenshotOcr();
    assert.equal(typeof ocr.captureRegion, 'function');
  });

  it('has recognizeFromCapture method', () => {
    const ocr = new ScreenshotOcr();
    assert.equal(typeof ocr.recognizeFromCapture, 'function');
  });

  it('has captureAndRecognize method', () => {
    const ocr = new ScreenshotOcr();
    assert.equal(typeof ocr.captureAndRecognize, 'function');
  });

  it('has captureToImage method', () => {
    const ocr = new ScreenshotOcr();
    assert.equal(typeof ocr.captureToImage, 'function');
  });

  it('recognizeFromCapture rejects invalid imageData', async () => {
    const ocr = new ScreenshotOcr();
    await assert.rejects(() => ocr.recognizeFromCapture(null), /Invalid image data/);
  });

  it('recognizeFromCapture rejects empty imageData', async () => {
    const ocr = new ScreenshotOcr();
    await assert.rejects(() => ocr.recognizeFromCapture({ width: 0, height: 0, data: new Uint8ClampedArray(0) }), /Invalid image data/);
  });
});
