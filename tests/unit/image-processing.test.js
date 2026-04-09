// ─── Unit Tests: image-processing ────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Ensure browser globals exist ────────────────────────────────────────────
import './setup-dom.js';

// ─── ImageBitmap mock (not provided by setup-dom.js) ─────────────────────────
if (typeof globalThis.ImageBitmap === 'undefined') {
  globalThis.ImageBitmap = class ImageBitmap {
    constructor(width = 0, height = 0) {
      this.width = width;
      this.height = height;
    }
    close() {}
  };
}

if (typeof globalThis.createImageBitmap === 'undefined') {
  globalThis.createImageBitmap = (source) => {
    const width = source && source.width ? source.width : 100;
    const height = source && source.height ? source.height : 100;
    return Promise.resolve(new globalThis.ImageBitmap(width, height));
  };
}

import {
  imageBitmapToCanvas,
  blobToImageBitmap,
  calculateFitScale,
  calculateFillScale,
  getDevicePixelRatio,
  loadImage,
  progressiveDownscale,
} from '../../app/modules/image-processing.js';

// ─── calculateFitScale ────────────────────────────────────────────────────────

describe('calculateFitScale', () => {
  it('scales down to fit within bounds', () => {
    // 200x100 content into 100x100 container → scale = 0.5 (limited by width)
    const scale = calculateFitScale(200, 100, 100, 100);
    assert.equal(scale, 0.5);
  });

  it('is limited by the tighter dimension (height)', () => {
    // 200x400 into 200x100 → scaleX=1, scaleY=0.25 → min=0.25
    const scale = calculateFitScale(200, 400, 200, 100);
    assert.equal(scale, 0.25);
  });

  it('does not scale up when content is smaller than bounds', () => {
    // 50x50 into 200x200 → would need scale=4 but capped at 1
    const scale = calculateFitScale(50, 50, 200, 200);
    assert.equal(scale, 1);
  });

  it('returns 1 when content exactly matches bounds', () => {
    const scale = calculateFitScale(100, 100, 100, 100);
    assert.equal(scale, 1);
  });

  it('returns 1 for zero-dimension content', () => {
    const scale = calculateFitScale(0, 100, 200, 200);
    assert.equal(scale, 1);
  });

  it('returns 1 for zero-height content', () => {
    const scale = calculateFitScale(100, 0, 200, 200);
    assert.equal(scale, 1);
  });

  it('correctly fits wide content into a narrow container', () => {
    // 1000x100 into 250x200 → scaleX=0.25, scaleY=2 → min=0.25
    const scale = calculateFitScale(1000, 100, 250, 200);
    assert.equal(scale, 0.25);
  });
});

// ─── calculateFillScale ───────────────────────────────────────────────────────

describe('calculateFillScale', () => {
  it('returns the larger scale to fill the container', () => {
    // 100x200 into 200x200 → scaleX=2, scaleY=1 → max=2
    const scale = calculateFillScale(100, 200, 200, 200);
    assert.equal(scale, 2);
  });

  it('covers container when content aspect is wider', () => {
    // 400x100 into 200x200 → scaleX=0.5, scaleY=2 → max=2
    const scale = calculateFillScale(400, 100, 200, 200);
    assert.equal(scale, 2);
  });

  it('returns 1 when content exactly matches container', () => {
    const scale = calculateFillScale(100, 100, 100, 100);
    assert.equal(scale, 1);
  });

  it('returns 1 for zero-dimension content', () => {
    const scale = calculateFillScale(0, 100, 200, 200);
    assert.equal(scale, 1);
  });

  it('always returns the larger of the two axis scales', () => {
    // 50x200 into 100x100 → scaleX=2, scaleY=0.5 → max=2
    const scale = calculateFillScale(50, 200, 100, 100);
    assert.equal(scale, 2);
  });
});

// ─── getDevicePixelRatio ──────────────────────────────────────────────────────

describe('getDevicePixelRatio', () => {
  it('returns a number', () => {
    const ratio = getDevicePixelRatio();
    assert.equal(typeof ratio, 'number');
  });

  it('returns a positive value', () => {
    const ratio = getDevicePixelRatio();
    assert.ok(ratio > 0, `Expected positive ratio, got ${ratio}`);
  });

  it('returns window.devicePixelRatio when available', () => {
    const original = globalThis.window.devicePixelRatio;
    globalThis.window.devicePixelRatio = 2;
    const ratio = getDevicePixelRatio();
    assert.equal(ratio, 2);
    globalThis.window.devicePixelRatio = original;
  });

  it('returns 1 when window.devicePixelRatio is 0 (falsy)', () => {
    const original = globalThis.window.devicePixelRatio;
    globalThis.window.devicePixelRatio = 0;
    const ratio = getDevicePixelRatio();
    assert.equal(ratio, 1);
    globalThis.window.devicePixelRatio = original;
  });
});

// ─── imageBitmapToCanvas ──────────────────────────────────────────────────────

describe('imageBitmapToCanvas', () => {
  it('returns an HTMLCanvasElement', () => {
    const bitmap = new globalThis.ImageBitmap(100, 200);
    const canvas = imageBitmapToCanvas(bitmap);
    assert.ok(
      canvas instanceof HTMLCanvasElement || typeof canvas.getContext === 'function',
      'should return a canvas-like object',
    );
  });

  it('sets canvas width from bitmap.width', () => {
    const bitmap = new globalThis.ImageBitmap(320, 240);
    const canvas = imageBitmapToCanvas(bitmap);
    assert.equal(canvas.width, 320);
  });

  it('sets canvas height from bitmap.height', () => {
    const bitmap = new globalThis.ImageBitmap(320, 240);
    const canvas = imageBitmapToCanvas(bitmap);
    assert.equal(canvas.height, 240);
  });

  it('handles zero-dimension bitmap', () => {
    const bitmap = new globalThis.ImageBitmap(0, 0);
    assert.doesNotThrow(() => imageBitmapToCanvas(bitmap));
  });
});

// ─── blobToImageBitmap ────────────────────────────────────────────────────────

describe('blobToImageBitmap', () => {
  it('returns a Promise', () => {
    const blob = new Blob([], { type: 'image/png' });
    const result = blobToImageBitmap(blob);
    assert.ok(result instanceof Promise, 'should return a Promise');
    // Prevent unhandled rejection in environments without createImageBitmap
    result.catch(() => {});
  });

  it('resolves with an object that has width and height', async () => {
    const blob = new Blob([], { type: 'image/png' });
    const bitmap = await blobToImageBitmap(blob);
    assert.ok('width' in bitmap, 'bitmap should have width');
    assert.ok('height' in bitmap, 'bitmap should have height');
  });
});

// ─── loadImage ────────────────────────────────────────────────────────────────

describe('loadImage', () => {
  it('resolves with an HTMLImageElement', async () => {
    const img = await loadImage('https://example.com/test.png');
    assert.ok(img instanceof Image || (img && typeof img.src !== 'undefined'), 'should resolve with an Image');
  });

  it('resolves with the correct src', async () => {
    const url = 'https://example.com/page.png';
    const img = await loadImage(url);
    assert.equal(img.src, url);
  });

  it('returns a Promise', () => {
    const result = loadImage('https://example.com/img.png');
    assert.ok(result instanceof Promise);
    // Consume to avoid unhandled rejection
    result.then(() => {}).catch(() => {});
  });
});

// ─── progressiveDownscale ─────────────────────────────────────────────────────

describe('progressiveDownscale', () => {
  let sourceCanvas;

  beforeEach(() => {
    sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 800;
    sourceCanvas.height = 600;
  });

  it('returns a canvas with the target dimensions', () => {
    const result = progressiveDownscale(sourceCanvas, 100, 75);
    assert.equal(result.width, 100);
    assert.equal(result.height, 75);
  });

  it('returns an HTMLCanvasElement', () => {
    const result = progressiveDownscale(sourceCanvas, 200, 150);
    assert.ok(
      result instanceof HTMLCanvasElement || typeof result.getContext === 'function',
      'should return a canvas-like object',
    );
  });

  it('returns a different canvas object than the source', () => {
    const result = progressiveDownscale(sourceCanvas, 400, 300);
    assert.notEqual(result, sourceCanvas);
  });

  it('works with steps=1 (single-step)', () => {
    const result = progressiveDownscale(sourceCanvas, 100, 75, 1);
    assert.equal(result.width, 100);
    assert.equal(result.height, 75);
  });

  it('works with steps=0 (fallback single-step)', () => {
    const result = progressiveDownscale(sourceCanvas, 50, 37, 0);
    assert.equal(result.width, 50);
    assert.equal(result.height, 37);
  });

  it('handles a zero-dimension source canvas without throwing', () => {
    const empty = document.createElement('canvas');
    empty.width = 0;
    empty.height = 0;
    assert.doesNotThrow(() => progressiveDownscale(empty, 100, 100));
  });

  it('returns target dimensions with many steps', () => {
    const result = progressiveDownscale(sourceCanvas, 50, 37, 8);
    assert.equal(result.width, 50);
    assert.equal(result.height, 37);
  });
});
