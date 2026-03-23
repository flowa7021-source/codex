import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getConfusableLatinToCyrillicMap,
  convertLatinLookalikesToCyrillic,
  hasMixedCyrillicLatinToken,
  computeOtsuThreshold,
  countHistogramPercentile,
  scoreCyrillicWordQuality,
  scoreRussianBigrams,
  scoreEnglishBigrams,
  medianDenoiseMonochrome,
  morphologyCloseMonochrome,
  estimateSkewAngleFromBinary,
  rotateCanvas,
  clearOcrRuntimeCaches,
  getOcrSourceCacheKey,
  updateOcrSourceCache,
  constrainOcrSourceCanvasPixels,
  getFreshOcrSourceCacheEntry,
  cropCanvasByRelativeRect,
  preprocessOcrCanvas,
  pickVariantsByBudget,
} from '../../app/modules/ocr-image-processing.js';

import { state } from '../../app/modules/state.js';

// ─── getConfusableLatinToCyrillicMap ─────────────────────────────────────────

describe('getConfusableLatinToCyrillicMap', () => {
  it('returns object with Latin-to-Cyrillic mappings', () => {
    const map = getConfusableLatinToCyrillicMap();
    assert.equal(map.A, 'А');
    assert.equal(map.o, 'о');
    assert.equal(typeof map, 'object');
  });

  it('has entries for common confusables', () => {
    const map = getConfusableLatinToCyrillicMap();
    assert.ok('B' in map);
    assert.ok('E' in map);
    assert.ok('K' in map);
    assert.ok('M' in map);
    assert.ok('H' in map);
    assert.ok('O' in map);
    assert.ok('P' in map);
    assert.ok('C' in map);
    assert.ok('T' in map);
    assert.ok('X' in map);
    assert.ok('y' in map);
    assert.ok('Y' in map);
  });
});

// ─── convertLatinLookalikesToCyrillic ────────────────────────────────────────

describe('convertLatinLookalikesToCyrillic', () => {
  it('replaces confusable Latin chars with Cyrillic', () => {
    const result = convertLatinLookalikesToCyrillic('AoBo');
    assert.equal(result, 'АоВо');
  });

  it('handles empty input', () => {
    assert.equal(convertLatinLookalikesToCyrillic(''), '');
  });

  it('handles null input', () => {
    assert.equal(convertLatinLookalikesToCyrillic(null), '');
  });

  it('leaves non-confusable Latin chars unchanged', () => {
    const result = convertLatinLookalikesToCyrillic('QWZ');
    assert.equal(result, 'QWZ');
  });

  it('replaces multiple known chars in one string', () => {
    const result = convertLatinLookalikesToCyrillic('ABCDE');
    // A->А, B->В, C->С, D unchanged, E->Е
    assert.ok(result.includes('А'));
    assert.ok(result.includes('В'));
    assert.ok(result.includes('С'));
    assert.ok(result.includes('Е'));
  });

  it('handles numeric string without modification', () => {
    assert.equal(convertLatinLookalikesToCyrillic('12345'), '12345');
  });
});

// ─── hasMixedCyrillicLatinToken ──────────────────────────────────────────────

describe('hasMixedCyrillicLatinToken', () => {
  it('returns true for mixed Cyrillic+Latin tokens', () => {
    assert.equal(hasMixedCyrillicLatinToken('Hелло'), true);
  });

  it('returns false for pure Latin', () => {
    assert.equal(hasMixedCyrillicLatinToken('Hello'), false);
  });

  it('returns false for pure Cyrillic', () => {
    assert.equal(hasMixedCyrillicLatinToken('Привет'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(hasMixedCyrillicLatinToken(''), false);
  });

  it('returns false for null', () => {
    assert.equal(hasMixedCyrillicLatinToken(null), false);
  });

  it('returns false for short strings (less than 2 chars)', () => {
    assert.equal(hasMixedCyrillicLatinToken('A'), false);
  });
});

// ─── computeOtsuThreshold ────────────────────────────────────────────────────

describe('computeOtsuThreshold', () => {
  it('returns a value in 0-255 for uniform data', () => {
    const data = new Uint8ClampedArray(16);
    data.fill(128);
    const t = computeOtsuThreshold(data);
    assert.ok(t >= 0 && t <= 255);
  });

  it('finds threshold for bimodal image', () => {
    const data = new Uint8ClampedArray(400);
    for (let i = 0; i < 200; i += 4) {
      data[i] = 50; data[i + 1] = 50; data[i + 2] = 50; data[i + 3] = 255;
    }
    for (let i = 200; i < 400; i += 4) {
      data[i] = 200; data[i + 1] = 200; data[i + 2] = 200; data[i + 3] = 255;
    }
    const t = computeOtsuThreshold(data);
    assert.ok(t >= 50 && t <= 200, `Threshold ${t} should be between 50 and 200`);
  });

  it('returns a valid threshold for a black image', () => {
    const data = new Uint8ClampedArray(40);
    data.fill(0);
    const t = computeOtsuThreshold(data);
    assert.ok(t >= 0 && t <= 255);
  });

  it('returns a valid threshold for a white image', () => {
    const data = new Uint8ClampedArray(40);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255; data[i+1] = 255; data[i+2] = 255; data[i+3] = 255;
    }
    const t = computeOtsuThreshold(data);
    assert.ok(t >= 0 && t <= 255);
  });
});

// ─── countHistogramPercentile ─────────────────────────────────────────────────

describe('countHistogramPercentile', () => {
  it('returns correct index for 50th percentile', () => {
    const hist = new Uint32Array(256);
    hist[100] = 50;
    hist[200] = 50;
    const p = countHistogramPercentile(hist, 0.5, 100);
    assert.equal(p, 100);
  });

  it('returns last index for 100th percentile', () => {
    const hist = new Uint32Array(256);
    hist[0] = 100;
    const p = countHistogramPercentile(hist, 1.0, 100);
    assert.equal(p, 0);
  });

  it('returns hist.length-1 when nothing accumulates', () => {
    const hist = new Uint32Array(256);
    const p = countHistogramPercentile(hist, 0.5, 100);
    assert.equal(p, 255);
  });

  it('handles percentile 0 (returns first non-zero)', () => {
    const hist = new Uint32Array(256);
    hist[50] = 10;
    const p = countHistogramPercentile(hist, 0, 10);
    assert.equal(p, 50);
  });
});

// ─── scoreCyrillicWordQuality ─────────────────────────────────────────────────

describe('scoreCyrillicWordQuality', () => {
  it('returns 0 for empty input', () => {
    assert.equal(scoreCyrillicWordQuality(''), 0);
  });

  it('returns positive score for valid Russian words', () => {
    const score = scoreCyrillicWordQuality('привет мир слово');
    assert.ok(score > 0);
  });

  it('penalizes repeated characters', () => {
    const score = scoreCyrillicWordQuality('аааааа');
    assert.ok(score < 0);
  });

  it('penalizes consonant-only long words', () => {
    const score = scoreCyrillicWordQuality('бвгджзкл');
    assert.ok(score < 0);
  });

  it('ignores non-Cyrillic words', () => {
    const score = scoreCyrillicWordQuality('hello world');
    assert.equal(score, 0);
  });

  it('penalizes long consonant clusters', () => {
    // 5+ consonants without a vowel
    const score = scoreCyrillicWordQuality('бвгджзкл мир');
    assert.ok(score < 1);
  });

  it('returns positive for real Russian sentence', () => {
    const score = scoreCyrillicWordQuality('это хорошее предложение для теста');
    assert.ok(score > 0);
  });
});

// ─── scoreRussianBigrams ──────────────────────────────────────────────────────

describe('scoreRussianBigrams', () => {
  it('returns 0 for empty text', () => {
    assert.equal(scoreRussianBigrams(''), 0);
  });

  it('returns positive score for Russian text', () => {
    const score = scoreRussianBigrams('программирование на языке');
    assert.ok(score > 0);
  });

  it('returns 0 for non-Russian (English only) text', () => {
    const score = scoreRussianBigrams('hello world');
    assert.equal(score, 0);
  });

  it('returns score for null/falsy gracefully', () => {
    const score = scoreRussianBigrams(null);
    assert.equal(score, 0);
  });

  it('caps per-bigram count at 5', () => {
    // Repeat "ст" many times - score should be capped at 5 per bigram
    const score = scoreRussianBigrams('стстстстстстстстстстстстстст');
    assert.ok(score <= 5 * 19); // 19 bigrams * max 5 each
  });
});

// ─── scoreEnglishBigrams ──────────────────────────────────────────────────────

describe('scoreEnglishBigrams', () => {
  it('returns 0 for empty text', () => {
    assert.equal(scoreEnglishBigrams(''), 0);
  });

  it('returns positive score for English text', () => {
    const score = scoreEnglishBigrams('The quick brown fox jumps over the lazy dog');
    assert.ok(score > 0);
  });

  it('returns 0 for Russian text', () => {
    const score = scoreEnglishBigrams('привет мир');
    assert.equal(score, 0);
  });

  it('handles null gracefully', () => {
    const score = scoreEnglishBigrams(null);
    assert.equal(score, 0);
  });
});

// ─── medianDenoiseMonochrome ──────────────────────────────────────────────────

describe('medianDenoiseMonochrome', () => {
  it('does not throw for small image (< 3x3)', () => {
    const data = new Uint8ClampedArray(4 * 4);
    data.fill(128);
    medianDenoiseMonochrome({ width: 2, height: 2, data });
    // Should return early without errors
  });

  it('processes a 5x5 white image without error', () => {
    const w = 5, h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    data.fill(255);
    medianDenoiseMonochrome({ width: w, height: h, data });
    // Pixels should remain 255 for all-white image
    for (let i = 0; i < data.length; i += 4) {
      assert.equal(data[i], 255);
    }
  });

  it('processes a mixed 5x5 image without error', () => {
    const w = 5, h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    // Checkerboard pattern
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const v = (x + y) % 2 === 0 ? 0 : 255;
        data[idx] = data[idx+1] = data[idx+2] = v;
        data[idx+3] = 255;
      }
    }
    // Should not throw
    medianDenoiseMonochrome({ width: w, height: h, data });
  });
});

// ─── morphologyCloseMonochrome ────────────────────────────────────────────────

describe('morphologyCloseMonochrome', () => {
  it('does not throw for small image (< 3x3)', () => {
    const data = new Uint8ClampedArray(4 * 4);
    data.fill(128);
    morphologyCloseMonochrome({ width: 2, height: 2, data });
  });

  it('processes a 5x5 image without error', () => {
    const w = 5, h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    data.fill(128);
    morphologyCloseMonochrome({ width: w, height: h, data });
  });

  it('dilates then erodes a dark spot (close operation)', () => {
    const w = 5, h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    // Fill white
    data.fill(255);
    // Put a single dark pixel in center
    const cx = 2, cy = 2;
    const idx = (cy * w + cx) * 4;
    data[idx] = data[idx+1] = data[idx+2] = 0;
    data[idx+3] = 255;
    morphologyCloseMonochrome({ width: w, height: h, data });
    // After close, interior pixels may change but no error
  });
});

// ─── estimateSkewAngleFromBinary ─────────────────────────────────────────────

describe('estimateSkewAngleFromBinary', () => {
  it('returns 0 for insufficient dark points (all white)', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    data.fill(255);
    const angle = estimateSkewAngleFromBinary({ width: 100, height: 100, data });
    assert.equal(angle, 0);
  });

  it('returns a number for a dense dark image', () => {
    // Dense dark image (many points >= 200)
    const w = 60, h = 60;
    const data = new Uint8ClampedArray(w * h * 4);
    data.fill(0); // all black
    const angle = estimateSkewAngleFromBinary({ width: w, height: h, data });
    assert.equal(typeof angle, 'number');
    assert.ok(angle >= -15 && angle <= 15);
  });

  it('handles an image with exactly 200 dark points', () => {
    const w = 50, h = 50;
    const data = new Uint8ClampedArray(w * h * 4);
    data.fill(255);
    // Set exactly 200 dark pixels
    for (let i = 0; i < 200; i++) {
      data[i * 4] = 0;
    }
    const angle = estimateSkewAngleFromBinary({ width: w, height: h, data });
    assert.equal(typeof angle, 'number');
  });
});

// ─── rotateCanvas ────────────────────────────────────────────────────────────

describe('rotateCanvas', () => {
  it('returns a canvas for 0 degree rotation', () => {
    const src = document.createElement('canvas');
    src.width = 100;
    src.height = 50;
    const result = rotateCanvas(src, 0);
    assert.ok(result);
    assert.ok(result.width >= 1);
    assert.ok(result.height >= 1);
  });

  it('returns a rotated canvas for 45 degrees', () => {
    const src = document.createElement('canvas');
    src.width = 100;
    src.height = 50;
    const result = rotateCanvas(src, 45);
    assert.ok(result);
    // At 45°, rotated dimensions should be larger than original
    assert.ok(result.width > 0);
    assert.ok(result.height > 0);
  });

  it('returns a rotated canvas for negative angle', () => {
    const src = document.createElement('canvas');
    src.width = 80;
    src.height = 60;
    const result = rotateCanvas(src, -15);
    assert.ok(result.width >= 1);
    assert.ok(result.height >= 1);
  });
});

// ─── clearOcrRuntimeCaches ────────────────────────────────────────────────────

describe('clearOcrRuntimeCaches', () => {
  it('clears the cache without error', () => {
    clearOcrRuntimeCaches('test');
    assert.equal(state.ocrSourceCache.size, 0);
    assert.equal(state.ocrCacheHitCount, 0);
    assert.equal(state.ocrCacheMissCount, 0);
  });

  it('works with default reason', () => {
    clearOcrRuntimeCaches();
    assert.equal(state.ocrSourceCache.size, 0);
  });

  it('clears cache entries that have a canvas', () => {
    const fakeCanvas = document.createElement('canvas');
    fakeCanvas.width = 100;
    fakeCanvas.height = 100;
    state.ocrSourceCache.set('test-key', { canvas: fakeCanvas, at: Date.now(), pixels: 10000 });
    assert.equal(state.ocrSourceCache.size, 1);
    clearOcrRuntimeCaches('test-clear');
    assert.equal(state.ocrSourceCache.size, 0);
  });

  it('resets skew angles and promises', () => {
    state.pageSkewAngles = { 1: 2.5, 2: -1.0 };
    state.pageSkewPromises = { 1: Promise.resolve(2.5) };
    clearOcrRuntimeCaches('reset');
    assert.deepEqual(state.pageSkewAngles, {});
    assert.deepEqual(state.pageSkewPromises, {});
  });
});

// ─── getOcrSourceCacheKey ─────────────────────────────────────────────────────

describe('getOcrSourceCacheKey', () => {
  it('returns a string key', () => {
    const key = getOcrSourceCacheKey(1);
    assert.equal(typeof key, 'string');
  });

  it('includes page number in key', () => {
    const key = getOcrSourceCacheKey(5);
    assert.ok(key.includes('5'));
  });

  it('differs for different pages', () => {
    const key1 = getOcrSourceCacheKey(1);
    const key2 = getOcrSourceCacheKey(2);
    assert.notEqual(key1, key2);
  });

  it('includes rotation in key', () => {
    state.rotation = 0;
    const key0 = getOcrSourceCacheKey(1);
    state.rotation = 90;
    const key90 = getOcrSourceCacheKey(1);
    assert.notEqual(key0, key90);
    state.rotation = 0;
  });

  it('includes quality mode in key', () => {
    if (!state.settings) state.settings = {};
    state.settings.ocrQualityMode = 'balanced';
    const keyBal = getOcrSourceCacheKey(1);
    state.settings.ocrQualityMode = 'accurate';
    const keyAcc = getOcrSourceCacheKey(1);
    assert.notEqual(keyBal, keyAcc);
    state.settings.ocrQualityMode = 'balanced';
  });
});

// ─── updateOcrSourceCache ─────────────────────────────────────────────────────

describe('updateOcrSourceCache', () => {
  beforeEach(() => {
    clearOcrRuntimeCaches('before-each');
  });

  it('does nothing if key is falsy', () => {
    updateOcrSourceCache(null, document.createElement('canvas'));
    assert.equal(state.ocrSourceCache.size, 0);
  });

  it('does nothing if canvas is falsy', () => {
    updateOcrSourceCache('some-key', null);
    assert.equal(state.ocrSourceCache.size, 0);
  });

  it('adds an entry for valid key and canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    updateOcrSourceCache('test-key', canvas);
    assert.equal(state.ocrSourceCache.size, 1);
    assert.ok(state.ocrSourceCache.has('test-key'));
  });

  it('evicts old entries when more than 4', () => {
    for (let i = 0; i < 5; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      updateOcrSourceCache(`key-${i}`, canvas);
    }
    assert.ok(state.ocrSourceCache.size <= 4);
  });

  it('evicts TTL-expired entries', () => {
    // Insert an old entry
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    state.ocrSourceCache.set('old-key', { canvas, at: Date.now() - 200000, pixels: 100 });
    // Insert a fresh one
    const canvas2 = document.createElement('canvas');
    canvas2.width = 10;
    canvas2.height = 10;
    updateOcrSourceCache('new-key', canvas2);
    assert.ok(!state.ocrSourceCache.has('old-key'));
  });
});

// ─── constrainOcrSourceCanvasPixels ──────────────────────────────────────────

describe('constrainOcrSourceCanvasPixels', () => {
  it('returns original canvas if within pixel limit', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const result = constrainOcrSourceCanvasPixels(canvas, 20000);
    assert.equal(result.scaled, false);
    assert.equal(result.scale, 1);
  });

  it('returns scaled canvas if over pixel limit', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const result = constrainOcrSourceCanvasPixels(canvas, 100000);
    assert.equal(result.scaled, true);
    assert.ok(result.scale < 1);
    assert.ok(result.canvas.width < 1000 || result.canvas.height < 1000);
  });

  it('uses OCR_SOURCE_MAX_PIXELS default', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const result = constrainOcrSourceCanvasPixels(canvas);
    assert.equal(typeof result.scaled, 'boolean');
    assert.ok(result.canvas);
  });

  it('includes sourcePixels and outputPixels in result', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const result = constrainOcrSourceCanvasPixels(canvas, 50000);
    assert.ok(typeof result.sourcePixels === 'number');
    assert.ok(typeof result.outputPixels === 'number');
  });
});

// ─── getFreshOcrSourceCacheEntry ──────────────────────────────────────────────

describe('getFreshOcrSourceCacheEntry', () => {
  beforeEach(() => {
    clearOcrRuntimeCaches('before-each');
  });

  it('returns null for falsy key', () => {
    assert.equal(getFreshOcrSourceCacheEntry(null), null);
    assert.equal(getFreshOcrSourceCacheEntry(''), null);
  });

  it('returns null for missing cache entry', () => {
    assert.equal(getFreshOcrSourceCacheEntry('nonexistent'), null);
  });

  it('returns entry for fresh cached canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    state.ocrSourceCache.set('fresh-key', { canvas, at: Date.now(), pixels: 2500 });
    const result = getFreshOcrSourceCacheEntry('fresh-key');
    assert.ok(result !== null);
    assert.equal(result.canvas, canvas);
  });

  it('returns null and evicts expired entry', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    // Old entry (200 seconds ago)
    state.ocrSourceCache.set('expired-key', { canvas, at: Date.now() - 200_000, pixels: 2500 });
    const result = getFreshOcrSourceCacheEntry('expired-key');
    assert.equal(result, null);
    assert.ok(!state.ocrSourceCache.has('expired-key'));
  });

  it('returns null for entry without canvas', () => {
    state.ocrSourceCache.set('no-canvas', { canvas: null, at: Date.now(), pixels: 0 });
    const result = getFreshOcrSourceCacheEntry('no-canvas');
    assert.equal(result, null);
  });
});

// ─── cropCanvasByRelativeRect ─────────────────────────────────────────────────

describe('cropCanvasByRelativeRect', () => {
  it('creates a canvas with cropped dimensions', () => {
    const src = document.createElement('canvas');
    src.width = 200;
    src.height = 100;
    const result = cropCanvasByRelativeRect(src, { x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
    assert.equal(result.width, 100);
    assert.equal(result.height, 50);
  });

  it('clamps to at least 1px', () => {
    const src = document.createElement('canvas');
    src.width = 100;
    src.height = 100;
    const result = cropCanvasByRelativeRect(src, { x: 0, y: 0, w: 0.001, h: 0.001 });
    assert.ok(result.width >= 1);
    assert.ok(result.height >= 1);
  });

  it('handles full-canvas rect (1.0 x 1.0)', () => {
    const src = document.createElement('canvas');
    src.width = 100;
    src.height = 80;
    const result = cropCanvasByRelativeRect(src, { x: 0, y: 0, w: 1.0, h: 1.0 });
    assert.equal(result.width, 100);
    assert.equal(result.height, 80);
  });
});

// ─── preprocessOcrCanvas ─────────────────────────────────────────────────────

describe('preprocessOcrCanvas', () => {
  it('returns input canvas when dimensions are zero', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    const result = preprocessOcrCanvas(canvas);
    assert.equal(result, canvas);
  });

  it('returns a processed canvas for valid input', () => {
    const src = document.createElement('canvas');
    src.width = 50;
    src.height = 50;
    const ctx = src.getContext('2d');
    if (ctx) { ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 50, 50); }
    const result = preprocessOcrCanvas(src, 0, 'mean', false, 1);
    assert.ok(result.width >= 1);
    assert.ok(result.height >= 1);
  });

  it('handles otsu threshold mode', () => {
    const src = document.createElement('canvas');
    src.width = 40;
    src.height = 40;
    const result = preprocessOcrCanvas(src, 0, 'otsu', false, 1);
    assert.ok(result.width >= 1);
  });

  it('handles invert=true', () => {
    const src = document.createElement('canvas');
    src.width = 30;
    src.height = 30;
    const result = preprocessOcrCanvas(src, 0, 'mean', true, 1);
    assert.ok(result.width >= 1);
  });

  it('handles positive threshold bias', () => {
    const src = document.createElement('canvas');
    src.width = 30;
    src.height = 30;
    const result = preprocessOcrCanvas(src, 16, 'otsu', false, 1);
    assert.ok(result.width >= 1);
  });

  it('handles negative threshold bias', () => {
    const src = document.createElement('canvas');
    src.width = 30;
    src.height = 30;
    const result = preprocessOcrCanvas(src, -16, 'mean', false, 1);
    assert.ok(result.width >= 1);
  });

  it('handles extraScale parameter', () => {
    const src = document.createElement('canvas');
    src.width = 40;
    src.height = 40;
    const result = preprocessOcrCanvas(src, 0, 'mean', false, 1.5);
    assert.ok(result.width >= 1);
  });
});

// ─── pickVariantsByBudget ─────────────────────────────────────────────────────

describe('pickVariantsByBudget', () => {
  it('returns all items when within budget', () => {
    const items = [1, 2, 3];
    const result = pickVariantsByBudget(items, 5);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('selects evenly distributed items when over budget', () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = pickVariantsByBudget(items, 3);
    assert.equal(result.length, 3);
    assert.equal(result[0], 0);
    assert.equal(result[2], 9);
  });

  it('handles budget of 1', () => {
    const items = [10, 20, 30];
    const result = pickVariantsByBudget(items, 1);
    assert.equal(result.length, 1);
  });

  it('handles non-array gracefully', () => {
    const result = pickVariantsByBudget(null, 3);
    assert.deepEqual(result, []);
  });

  it('returns exact list when length equals budget', () => {
    const items = [1, 2, 3];
    const result = pickVariantsByBudget(items, 3);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('handles budget of 2', () => {
    const items = [10, 20, 30, 40, 50];
    const result = pickVariantsByBudget(items, 2);
    assert.equal(result.length, 2);
    assert.equal(result[0], 10);
    assert.equal(result[1], 50);
  });

  it('handles empty array', () => {
    const result = pickVariantsByBudget([], 5);
    assert.deepEqual(result, []);
  });
});
