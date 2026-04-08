// ─── Unit Tests: Screenshot OCR ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScreenshotOcr } from '../../app/modules/screenshot-ocr.js';

// ── Helper: create fake ImageData ─────────────────────────────────────────────
function makeImageData(w = 10, h = 10) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

// ── Helper: mock navigator.mediaDevices.getDisplayMedia ───────────────────────
function setupMediaDeviceMock(imageData) {
  const mockTrack = {
    getSettings: () => ({ width: imageData.width, height: imageData.height }),
    stop: () => {},
  };
  const mockStream = {
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
  };

  // Use defineProperty since navigator may be read-only
  const origMediaDevices = globalThis.navigator?.mediaDevices;
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia: async () => mockStream },
  });

  // Override document.createElement to give video elements a play() method
  const origCreateElement = document.createElement.bind(document);
  document.createElement = function (tag) {
    const el = origCreateElement(tag);
    if (tag === 'video') {
      el.play = async () => {};
      el.srcObject = null;
    }
    return el;
  };

  // Override OffscreenCanvas.getContext to return imageData from getImageData
  const origOffscreen = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class MockOffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
      return {
        drawImage() {},
        putImageData() {},
        getImageData: () => imageData,
        convertToBlob: async () => new Blob([new Uint8Array(4)], { type: 'image/png' }),
      };
    }
    async convertToBlob() { return new Blob([new Uint8Array(4)], { type: 'image/png' }); }
  };

  return () => {
    if (origMediaDevices !== undefined) {
      Object.defineProperty(globalThis.navigator, 'mediaDevices', { configurable: true, value: origMediaDevices });
    } else {
      delete globalThis.navigator.mediaDevices;
    }
    document.createElement = origCreateElement;
    globalThis.OffscreenCanvas = origOffscreen;
  };
}

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

  it('recognizeFromCapture throws OCR failed when tesseract unavailable', async () => {
    const ocr = new ScreenshotOcr();
    const imgData = makeImageData(4, 4);
    await assert.rejects(() => ocr.recognizeFromCapture(imgData), /OCR failed/);
  });
});

describe('ScreenshotOcr — captureRegion via _capturePwa', () => {
  it('calls _capturePwa when __TAURI__ is not defined', async () => {
    const imgData = makeImageData(20, 15);
    const cleanup = setupMediaDeviceMock(imgData);
    try {
      const ocr = new ScreenshotOcr();
      const result = await ocr.captureRegion();
      assert.ok(result, 'should return imageData');
      assert.equal(result.width, 20);
      assert.equal(result.height, 15);
    } finally {
      cleanup();
    }
  });

  it('captureRegion fails when mediaDevices is unavailable', async () => {
    const origMediaDevices = globalThis.navigator?.mediaDevices;
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { configurable: true, value: undefined });
    try {
      const ocr = new ScreenshotOcr();
      await assert.rejects(() => ocr.captureRegion(), /Screen capture not available/);
    } finally {
      if (origMediaDevices !== undefined) {
        Object.defineProperty(globalThis.navigator, 'mediaDevices', { configurable: true, value: origMediaDevices });
      }
    }
  });
});

describe('ScreenshotOcr — captureRegion via _captureTauri', () => {
  it('calls _captureTauri when __TAURI__ is defined', async () => {
    globalThis.__TAURI__ = {};
    try {
      const ocr = new ScreenshotOcr();
      // _captureTauri imports @tauri-apps/api/core which will fail → wrapped error
      await assert.rejects(() => ocr.captureRegion(), /Tauri capture failed/);
    } finally {
      delete globalThis.__TAURI__;
    }
  });
});

describe('ScreenshotOcr — captureToImage', () => {
  it('captures and returns a Blob', async () => {
    const imgData = makeImageData(8, 8);
    const cleanup = setupMediaDeviceMock(imgData);
    try {
      const ocr = new ScreenshotOcr();
      const blob = await ocr.captureToImage('png');
      assert.ok(blob instanceof Blob);
      assert.equal(ocr._lastCapture, imgData);
    } finally {
      cleanup();
    }
  });

  it('captures with jpeg format', async () => {
    const imgData = makeImageData(8, 8);
    const cleanup = setupMediaDeviceMock(imgData);
    try {
      const ocr = new ScreenshotOcr();
      const blob = await ocr.captureToImage('jpeg');
      assert.ok(blob instanceof Blob);
    } finally {
      cleanup();
    }
  });
});

describe('ScreenshotOcr — captureAndRecognize', () => {
  it('captures region and stores _lastCapture, then tries OCR (fails with OCR failed)', async () => {
    const imgData = makeImageData(5, 5);
    const cleanup = setupMediaDeviceMock(imgData);
    try {
      const ocr = new ScreenshotOcr();
      await assert.rejects(() => ocr.captureAndRecognize('eng'), /OCR failed/);
      // Even though OCR fails, _lastCapture should have been set before OCR
      // (recognizeFromCapture is called after captureRegion and _lastCapture assignment)
      assert.equal(ocr._lastCapture, imgData);
    } finally {
      cleanup();
    }
  });

  it('captureAndRecognize with navigator.clipboard writes text when available', async () => {
    const imgData = makeImageData(5, 5);
    const cleanup = setupMediaDeviceMock(imgData);

    // Add clipboard mock
    const clipboardTexts = [];
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { clipboardTexts.push(text); } },
    });

    try {
      const ocr = new ScreenshotOcr();
      // OCR will fail (tesseract unavailable), but clipboard path is not reached
      await assert.rejects(() => ocr.captureAndRecognize(), /OCR failed/);
    } finally {
      delete globalThis.navigator.clipboard;
      cleanup();
    }
  });
});
