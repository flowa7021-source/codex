import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Polyfill ImageData for Node.js
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

import {
  toGrayscale,
  medianFilter,
  sauvolaBinarize,
  estimateSkewAngle,
  rotateCanvas,
  cropBlackBorders,
} from '../../app/modules/ocr-preprocess.js';

// Helper: create ImageData-like object
function makeImageData(w, h, fillFn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const val = fillFn ? fillFn(x, y) : 128;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe('toGrayscale', () => {
  it('sets R=G=B to luminance value', () => {
    const img = { data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), width: 2, height: 1 };
    toGrayscale(img);
    // Red pixel: 0.299*255 = ~76
    assert.equal(img.data[0], Math.round(0.299 * 255));
    assert.equal(img.data[0], img.data[1]);
    assert.equal(img.data[0], img.data[2]);
    // Green pixel: 0.587*255 = ~150
    assert.equal(img.data[4], Math.round(0.587 * 255));
  });

  it('returns the same imageData object', () => {
    const img = makeImageData(2, 2);
    const result = toGrayscale(img);
    assert.equal(result, img);
  });
});

describe('medianFilter', () => {
  it('returns new ImageData with same dimensions', () => {
    const img = makeImageData(10, 10);
    const result = medianFilter(img, 3);
    assert.equal(result.width, 10);
    assert.equal(result.height, 10);
  });

  it('preserves uniform image', () => {
    const img = makeImageData(10, 10, () => 100);
    const result = medianFilter(img, 3);
    // Center pixels should remain 100
    const centerIdx = (5 * 10 + 5) * 4;
    assert.equal(result.data[centerIdx], 100);
  });

  it('handles small images', () => {
    const img = makeImageData(3, 3, () => 128);
    const result = medianFilter(img, 3);
    assert.equal(result.width, 3);
  });
});

describe('sauvolaBinarize', () => {
  it('returns binarized ImageData', () => {
    const img = makeImageData(20, 20, () => 128);
    const result = sauvolaBinarize(img, 15, 0.2);
    assert.equal(result.width, 20);
    assert.equal(result.height, 20);
    // All same value, output should be either all 0 or all 255
    const val = result.data[0];
    assert.ok(val === 0 || val === 255);
  });

  it('binarizes mixed content image', () => {
    const img = makeImageData(30, 30, (x) => (x < 15 ? 30 : 230));
    const result = sauvolaBinarize(img, 15, 0.2);
    assert.equal(result.width, 30);
  });
});

describe('estimateSkewAngle', () => {
  it('returns angle within -5 to +5 range for horizontal lines', () => {
    // Create horizontal lines
    const img = makeImageData(100, 100, (x, y) => (y % 10 < 2 ? 0 : 255));
    const angle = estimateSkewAngle(img);
    assert.ok(angle >= -5 && angle <= 5);
  });

  it('returns a number', () => {
    const img = makeImageData(50, 50, () => 200);
    const angle = estimateSkewAngle(img);
    assert.equal(typeof angle, 'number');
  });
});

describe('rotateCanvas', () => {
  it('returns same canvas for near-zero angle', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const result = rotateCanvas(canvas, 0.05);
    assert.equal(result, canvas);
  });

  it('returns new canvas for non-trivial angle', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const result = rotateCanvas(canvas, 5);
    assert.ok(result.width > 0);
    assert.ok(result.height > 0);
  });
});

describe('cropBlackBorders', () => {
  it('returns original when all pixels are dark (crop too aggressive)', () => {
    const img = makeImageData(20, 20, () => 0);
    const result = cropBlackBorders(img);
    // All dark => cropping would remove >50%, so returns original
    assert.equal(result.width, 20);
  });

  it('returns cropped result for image with white center and black border', () => {
    // 40x40 with 3px black border, white center
    const img = makeImageData(40, 40, (x, y) => {
      if (x < 3 || x >= 37 || y < 3 || y >= 37) return 0;
      return 255;
    });
    const result = cropBlackBorders(img);
    assert.ok(result.width <= 40);
    assert.ok(result.height <= 40);
    assert.ok(result.width > 0);
  });

  it('preserves all-white image dimensions', () => {
    const img = makeImageData(30, 30, () => 255);
    const result = cropBlackBorders(img);
    // No black border to crop, should stay close to original
    assert.ok(result.width >= 20);
    assert.ok(result.height >= 20);
  });
});
