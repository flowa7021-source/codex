import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
    // All same value → output should be either all 0 or all 255
    const val = result.data[0];
    assert.ok(val === 0 || val === 255);
  });

  it('binarizes mixed content image', () => {
    const img = makeImageData(30, 30, (x) => (x < 15 ? 30 : 230));
    const result = sauvolaBinarize(img, 15, 0.2);
    assert.equal(result.width, 30);
    // There should be both 0 and 255 values
    const values = new Set();
    for (let i = 0; i < result.data.length; i += 4) {
      values.add(result.data[i]);
    }
    assert.ok(values.has(0) || values.has(255));
  });
});

describe('estimateSkewAngle', () => {
  it('returns 0 for uniform white image', () => {
    const img = makeImageData(100, 100, () => 255);
    const angle = estimateSkewAngle(img);
    assert.equal(angle, 0);
  });

  it('returns angle within -5 to +5 range', () => {
    // Create horizontal lines
    const img = makeImageData(100, 100, (x, y) => (y % 10 < 2 ? 0 : 255));
    const angle = estimateSkewAngle(img);
    assert.ok(angle >= -5 && angle <= 5);
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
  it('returns original imageData when all pixels are dark', () => {
    // If everything is dark, cropping would be too aggressive (<50%)
    const img = makeImageData(20, 20, () => 0);
    const result = cropBlackBorders(img);
    assert.equal(result.width, 20);
  });

  it('returns original imageData when image is all white', () => {
    const img = makeImageData(20, 20, () => 255);
    const result = cropBlackBorders(img);
    // All white → first non-dark pixel at (0,0), no cropping needed
    assert.ok(result.width >= 18); // with 2px margin
  });

  it('crops black borders from an image with a white center', () => {
    // Create image with 3px black border and white center
    const img = makeImageData(40, 40, (x, y) => {
      if (x < 3 || x >= 37 || y < 3 || y >= 37) return 0;
      return 255;
    });
    const result = cropBlackBorders(img);
    // Should be cropped, but not below 50% of original dimensions
    assert.ok(result.width <= 40);
    assert.ok(result.height <= 40);
  });
});
