import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeTextDensity, computeOcrZoom, hasSmallText } from '../../app/modules/ocr-adaptive-dpi.js';

// Helper: create a mock canvas with controllable getImageData
function makeCanvas(w, h, pixelFn) {
  const data = new Uint8ClampedArray(w * h * 4);
  if (pixelFn) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = pixelFn(x, y);
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
  }
  return {
    width: w,
    height: h,
    getContext() {
      return {
        getImageData: () => ({ data, width: w, height: h }),
      };
    },
  };
}

describe('analyzeTextDensity', () => {
  it('returns defaults for zero-size canvas', () => {
    const canvas = makeCanvas(0, 0);
    const result = analyzeTextDensity(canvas);
    assert.equal(result.density, 0);
    assert.equal(result.suggestedScale, 2.0);
  });

  it('returns defaults when getContext returns null', () => {
    const canvas = { width: 100, height: 100, getContext: () => null };
    const result = analyzeTextDensity(canvas);
    assert.equal(result.density, 0);
    assert.equal(result.suggestedScale, 2.0);
  });

  it('returns low density for an all-white canvas', () => {
    const canvas = makeCanvas(100, 100, () => 255);
    const result = analyzeTextDensity(canvas);
    assert.equal(result.density, 0);
    assert.equal(result.suggestedScale, 2.0); // default when no dark runs
  });

  it('returns high density for an all-black canvas', () => {
    const canvas = makeCanvas(100, 100, () => 0);
    const result = analyzeTextDensity(canvas);
    assert.ok(result.density > 0.5);
    assert.ok(result.suggestedScale >= 1.2);
    assert.ok(result.suggestedScale <= 6.0);
  });

  it('returns result with expected shape', () => {
    const canvas = makeCanvas(200, 200, (x) => (x % 10 < 3 ? 0 : 255));
    const result = analyzeTextDensity(canvas);
    assert.ok('density' in result);
    assert.ok('avgStrokeWidth' in result);
    assert.ok('contrast' in result);
    assert.ok('suggestedScale' in result);
  });

  it('clamps suggestedScale within MIN/MAX', () => {
    const canvas = makeCanvas(200, 200, (x) => (x % 10 < 3 ? 0 : 255));
    const result = analyzeTextDensity(canvas);
    assert.ok(result.suggestedScale >= 1.2);
    assert.ok(result.suggestedScale <= 6.0);
  });
});

describe('computeOcrZoom', () => {
  it('returns analysis suggestedScale when under pixel budget', () => {
    const zoom = computeOcrZoom(100, 100, { suggestedScale: 3.0 });
    assert.equal(zoom, 3.0);
  });

  it('defaults to 2.0 when analysis is null', () => {
    const zoom = computeOcrZoom(100, 100, null);
    assert.equal(zoom, 2.0);
  });

  it('caps zoom when pixels exceed maxPixels', () => {
    // 2000*2000 with zoom 3 = 36M pixels, should cap
    const zoom = computeOcrZoom(2000, 2000, { suggestedScale: 3.0 }, 4_800_000);
    assert.ok(zoom < 3.0);
    // zoom is clamped to at least MIN_SCALE (1.2), so just verify it was reduced
    assert.ok(zoom >= 1.2);
  });

  it('never returns below MIN_SCALE', () => {
    const zoom = computeOcrZoom(10000, 10000, { suggestedScale: 0.5 }, 100_000);
    assert.ok(zoom >= 1.2);
  });

  it('rounds to two decimal places', () => {
    const zoom = computeOcrZoom(100, 100, { suggestedScale: 2.123 });
    const decimals = zoom.toString().split('.')[1];
    assert.ok(!decimals || decimals.length <= 2);
  });
});

describe('hasSmallText', () => {
  it('returns false for all-white canvas', () => {
    const canvas = makeCanvas(100, 100, () => 255);
    assert.equal(hasSmallText(canvas), false);
  });

  it('returns false for all-black canvas (density too high, stroke width too wide)', () => {
    const canvas = makeCanvas(100, 100, () => 0);
    assert.equal(hasSmallText(canvas), false);
  });
});
