// ─── Unit Tests: bitmap-utils ─────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Ensure browser globals exist ────────────────────────────────────────────
import './setup-dom.js';

// ─── Extend OffscreenCanvas mock with convertToBlob ──────────────────────────
if (typeof globalThis.OffscreenCanvas !== 'undefined') {
  const OrigOffscreen = globalThis.OffscreenCanvas;
  if (!OrigOffscreen.prototype.convertToBlob) {
    OrigOffscreen.prototype.convertToBlob = function () {
      return Promise.resolve(new Blob([], { type: 'image/png' }));
    };
  }
}

import {
  createCanvas,
  canvasToDataURL,
  scaleCanvas,
  cropCanvas,
  applyGrayscale,
  getPixel,
} from '../../app/modules/bitmap-utils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a mock HTMLCanvasElement with pixel data support.
 * The default setup-dom.js mock returns empty ImageData; here we wire up
 * a proper Uint8ClampedArray so pixel-level tests work correctly.
 */
function makePixelCanvas(width, height, fillR = 128, fillG = 64, fillB = 32, fillA = 255) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const totalPixels = width * height;
  const pixelData = new Uint8ClampedArray(totalPixels * 4);
  for (let i = 0; i < totalPixels; i++) {
    pixelData[i * 4 + 0] = fillR;
    pixelData[i * 4 + 1] = fillG;
    pixelData[i * 4 + 2] = fillB;
    pixelData[i * 4 + 3] = fillA;
  }

  // Override getContext to return pixel-aware mock
  canvas.getContext = () => ({
    drawImage() {},
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    putImageData() {},
    createImageData: () => ({ data: new Uint8ClampedArray(totalPixels * 4) }),
    measureText: () => ({ width: 0 }),
    fillText() {},
    strokeText() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    setTransform() {},
    resetTransform() {},
    canvas,
    getImageData: (_x, _y, w, h) => {
      const size = w * h * 4;
      const data = new Uint8ClampedArray(size);
      for (let i = 0; i < w * h; i++) {
        data[i * 4 + 0] = fillR;
        data[i * 4 + 1] = fillG;
        data[i * 4 + 2] = fillB;
        data[i * 4 + 3] = fillA;
      }
      return { data, width: w, height: h };
    },
  });
  return canvas;
}

// ─── createCanvas ─────────────────────────────────────────────────────────────

describe('createCanvas', () => {
  it('returns an OffscreenCanvas or HTMLCanvasElement', () => {
    const canvas = createCanvas(100, 200);
    const isOffscreen = typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas;
    const isHtml = canvas instanceof HTMLCanvasElement || (canvas && typeof canvas.getContext === 'function');
    assert.ok(isOffscreen || isHtml, 'should return an OffscreenCanvas or HTMLCanvasElement');
  });

  it('sets the correct width and height', () => {
    const canvas = createCanvas(320, 240);
    assert.equal(canvas.width, 320);
    assert.equal(canvas.height, 240);
  });

  it('creates a canvas with zero dimensions without throwing', () => {
    assert.doesNotThrow(() => createCanvas(0, 0));
  });

  it('creates canvases with large dimensions', () => {
    const canvas = createCanvas(4096, 4096);
    assert.equal(canvas.width, 4096);
    assert.equal(canvas.height, 4096);
  });
});

// ─── canvasToDataURL ──────────────────────────────────────────────────────────

describe('canvasToDataURL', () => {
  it('returns a string starting with "data:"', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const result = canvasToDataURL(canvas);
    assert.equal(typeof result, 'string');
    assert.ok(result.startsWith('data:'), `Expected data URL, got: ${result.slice(0, 30)}`);
  });

  it('returns a string with a custom MIME type', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const result = canvasToDataURL(canvas, 'image/jpeg');
    assert.equal(typeof result, 'string');
    assert.ok(result.startsWith('data:'), `Expected data URL, got: ${result.slice(0, 30)}`);
  });

  it('returns a string when quality is specified', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const result = canvasToDataURL(canvas, 'image/jpeg', 0.8);
    assert.equal(typeof result, 'string');
    assert.ok(result.startsWith('data:'));
  });
});

// ─── scaleCanvas ──────────────────────────────────────────────────────────────

describe('scaleCanvas', () => {
  let source;

  beforeEach(() => {
    source = document.createElement('canvas');
    source.width = 200;
    source.height = 100;
  });

  it('returns a canvas with the requested dimensions', () => {
    const result = scaleCanvas(source, 50, 25);
    assert.equal(result.width, 50);
    assert.equal(result.height, 25);
  });

  it('returns an HTMLCanvasElement', () => {
    const result = scaleCanvas(source, 50, 25);
    assert.ok(result instanceof HTMLCanvasElement || typeof result.getContext === 'function');
  });

  it('can upscale a canvas', () => {
    const result = scaleCanvas(source, 400, 200);
    assert.equal(result.width, 400);
    assert.equal(result.height, 200);
  });

  it('returns a different canvas object than the source', () => {
    const result = scaleCanvas(source, 200, 100);
    assert.notEqual(result, source);
  });

  it('works with an OffscreenCanvas source', () => {
    if (typeof OffscreenCanvas === 'undefined') return;
    const offscreen = new OffscreenCanvas(100, 100);
    const result = scaleCanvas(offscreen, 50, 50);
    assert.equal(result.width, 50);
    assert.equal(result.height, 50);
  });
});

// ─── cropCanvas ───────────────────────────────────────────────────────────────

describe('cropCanvas', () => {
  let source;

  beforeEach(() => {
    source = document.createElement('canvas');
    source.width = 400;
    source.height = 300;
  });

  it('returns a canvas with the specified crop dimensions', () => {
    const result = cropCanvas(source, 10, 20, 100, 80);
    assert.equal(result.width, 100);
    assert.equal(result.height, 80);
  });

  it('returns an HTMLCanvasElement', () => {
    const result = cropCanvas(source, 0, 0, 50, 50);
    assert.ok(result instanceof HTMLCanvasElement || typeof result.getContext === 'function');
  });

  it('returns a canvas with zero dimensions when crop size is zero', () => {
    const result = cropCanvas(source, 0, 0, 0, 0);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  it('returns a different canvas object than the source', () => {
    const result = cropCanvas(source, 0, 0, 200, 150);
    assert.notEqual(result, source);
  });

  it('works with OffscreenCanvas source', () => {
    if (typeof OffscreenCanvas === 'undefined') return;
    const offscreen = new OffscreenCanvas(200, 200);
    const result = cropCanvas(offscreen, 0, 0, 100, 100);
    assert.equal(result.width, 100);
    assert.equal(result.height, 100);
  });
});

// ─── applyGrayscale ───────────────────────────────────────────────────────────

describe('applyGrayscale', () => {
  it('does not throw on a valid canvas', () => {
    const canvas = makePixelCanvas(10, 10);
    assert.doesNotThrow(() => applyGrayscale(canvas));
  });

  it('calls getImageData on the canvas context', () => {
    let getImageDataCalled = false;
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    canvas.getContext = () => ({
      getImageData: (_x, _y, w, h) => {
        getImageDataCalled = true;
        return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
      },
      putImageData() {},
      canvas,
    });
    applyGrayscale(canvas);
    assert.ok(getImageDataCalled, 'getImageData should have been called');
  });

  it('does not throw on a zero-dimension canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    assert.doesNotThrow(() => applyGrayscale(canvas));
  });

  it('converts pixel RGB to a luminance-weighted gray value', () => {
    let capturedData = null;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    // Pure red pixel
    const inputData = new Uint8ClampedArray([255, 0, 0, 255]);
    canvas.getContext = () => ({
      getImageData: () => ({ data: new Uint8ClampedArray(inputData), width: 1, height: 1 }),
      putImageData: (imageData) => { capturedData = imageData; },
      canvas,
    });
    applyGrayscale(canvas);
    assert.ok(capturedData !== null, 'putImageData should have been called');
    // Expected gray for pure red: round(0.299 * 255) = 76
    const expectedGray = Math.round(0.299 * 255);
    assert.equal(capturedData.data[0], expectedGray, `Expected gray ${expectedGray}, got ${capturedData.data[0]}`);
    assert.equal(capturedData.data[1], expectedGray);
    assert.equal(capturedData.data[2], expectedGray);
    assert.equal(capturedData.data[3], 255, 'Alpha should remain unchanged');
  });
});

// ─── getPixel ─────────────────────────────────────────────────────────────────

describe('getPixel', () => {
  it('returns an object with r, g, b, a properties', () => {
    const canvas = makePixelCanvas(10, 10, 100, 150, 200, 255);
    const pixel = getPixel(canvas, 0, 0);
    assert.ok('r' in pixel, 'should have r property');
    assert.ok('g' in pixel, 'should have g property');
    assert.ok('b' in pixel, 'should have b property');
    assert.ok('a' in pixel, 'should have a property');
  });

  it('returns numeric channel values', () => {
    const canvas = makePixelCanvas(10, 10, 100, 150, 200, 255);
    const pixel = getPixel(canvas, 5, 5);
    assert.equal(typeof pixel.r, 'number');
    assert.equal(typeof pixel.g, 'number');
    assert.equal(typeof pixel.b, 'number');
    assert.equal(typeof pixel.a, 'number');
  });

  it('returns correct pixel color from filled canvas', () => {
    const canvas = makePixelCanvas(4, 4, 128, 64, 32, 255);
    const pixel = getPixel(canvas, 0, 0);
    assert.equal(pixel.r, 128);
    assert.equal(pixel.g, 64);
    assert.equal(pixel.b, 32);
    assert.equal(pixel.a, 255);
  });

  it('returns zeros when getContext is unavailable', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    canvas.getContext = () => null;
    const pixel = getPixel(canvas, 0, 0);
    assert.deepEqual(pixel, { r: 0, g: 0, b: 0, a: 0 });
  });
});
