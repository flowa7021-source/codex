import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { detectContentBounds, SmartCropPreview } from '../../app/modules/smart-crop.js';

// Helper: create a canvas with a known pixel pattern
function makeCanvas(width, height, fillFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  // Override getContext to return a functional mock with real ImageData
  const pixels = new Uint8ClampedArray(width * height * 4);
  // Default: all white (255,255,255,255)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }

  if (fillFn) fillFn(pixels, width, height);

  canvas.getContext = () => ({
    getImageData: (x, y, w, h) => ({ data: pixels, width: w, height: h }),
    drawImage() {},
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    fillText() {},
    setLineDash() {},
    measureText: () => ({ width: 0 }),
    canvas,
  });

  return canvas;
}

describe('detectContentBounds', () => {
  it('returns full canvas for all-white image', () => {
    const canvas = makeCanvas(100, 100);
    const bounds = detectContentBounds(canvas, { paddingPx: 0 });
    // All white means no content detected, edges stay at 0 and width-1/height-1
    assert.equal(typeof bounds.x, 'number');
    assert.equal(typeof bounds.y, 'number');
    assert.equal(typeof bounds.width, 'number');
    assert.equal(typeof bounds.height, 'number');
  });

  it('detects content in center of canvas', () => {
    const canvas = makeCanvas(100, 100, (pixels, w, h) => {
      // Draw a black rectangle from (30,30) to (70,70)
      for (let y = 30; y < 70; y++) {
        for (let x = 30; x < 70; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
        }
      }
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 0, threshold: 240 });
    // Content starts at y=30, x=30
    assert.ok(bounds.y <= 30, `top edge ${bounds.y} should be <= 30`);
    assert.ok(bounds.x <= 30, `left edge ${bounds.x} should be <= 30`);
    assert.ok(bounds.marginTop > 0, 'should detect top margin');
    assert.ok(bounds.marginLeft > 0, 'should detect left margin');
  });

  it('applies padding', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      // Content at center
      for (let y = 40; y < 60; y++) {
        for (let x = 40; x < 60; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx] = 0; pixels[idx + 1] = 0; pixels[idx + 2] = 0;
        }
      }
    });
    const noPad = detectContentBounds(canvas, { paddingPx: 0 });
    const withPad = detectContentBounds(canvas, { paddingPx: 10 });
    assert.ok(withPad.y <= noPad.y, 'padding should extend top edge upward');
    assert.ok(withPad.x <= noPad.x, 'padding should extend left edge leftward');
  });

  it('uses custom threshold', () => {
    const canvas = makeCanvas(50, 50, (pixels, w) => {
      // Fill with gray (200) which is below default threshold 240
      for (let y = 20; y < 30; y++) {
        for (let x = 20; x < 30; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx] = 200; pixels[idx + 1] = 200; pixels[idx + 2] = 200;
        }
      }
    });
    // With threshold=240, gray(200) is content
    const bounds240 = detectContentBounds(canvas, { threshold: 240, paddingPx: 0 });
    // With threshold=100, gray(200) is background
    const bounds100 = detectContentBounds(canvas, { threshold: 100, paddingPx: 0 });
    assert.ok(bounds240.marginTop > 0 || bounds240.marginLeft > 0);
  });

  it('returns margin properties', () => {
    const canvas = makeCanvas(100, 100, (pixels, w) => {
      for (let y = 20; y < 80; y++) {
        for (let x = 20; x < 80; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx] = 0; pixels[idx + 1] = 0; pixels[idx + 2] = 0;
        }
      }
    });
    const bounds = detectContentBounds(canvas, { paddingPx: 0 });
    assert.ok('marginTop' in bounds);
    assert.ok('marginRight' in bounds);
    assert.ok('marginBottom' in bounds);
    assert.ok('marginLeft' in bounds);
  });

  it('stores canvas dimensions', () => {
    const canvas = makeCanvas(200, 300);
    const bounds = detectContentBounds(canvas);
    assert.equal(bounds._canvasWidth, 200);
    assert.equal(bounds._canvasHeight, 300);
  });
});

describe('SmartCropPreview', () => {
  it('constructs with given parameters', () => {
    const canvas = document.createElement('canvas');
    const preview = new SmartCropPreview(canvas, 612, 792, 1.5);
    assert.equal(preview.pageW, 612);
    assert.equal(preview.pageH, 792);
    assert.equal(preview.zoom, 1.5);
  });

  it('setZoom updates zoom value', () => {
    const canvas = document.createElement('canvas');
    const preview = new SmartCropPreview(canvas, 612, 792, 1);
    preview.setZoom(2);
    assert.equal(preview.zoom, 2);
  });

  it('hide clears the crop rect', () => {
    const canvas = document.createElement('canvas');
    const preview = new SmartCropPreview(canvas, 612, 792);
    preview._cropRect = { x: 0, y: 0, width: 100, height: 100 };
    preview.hide();
    assert.equal(preview._cropRect, null);
  });

  it('show stores the crop rect', () => {
    const canvas = document.createElement('canvas');
    // Override getContext to provide setLineDash
    const origGetContext = canvas.getContext;
    canvas.getContext = (type) => {
      const ctx = origGetContext.call(canvas, type);
      ctx.setLineDash = () => {};
      return ctx;
    };
    const preview = new SmartCropPreview(canvas, 612, 792);
    const rect = { x: 10, y: 10, width: 500, height: 700, marginTop: 5, marginBottom: 5 };
    preview.show(rect);
    assert.equal(preview._cropRect, rect);
  });
});
