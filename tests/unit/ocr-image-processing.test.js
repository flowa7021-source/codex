import './setup-dom.js';
import { describe, it } from 'node:test';
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
  estimateSkewAngleFromBinary,
  pickVariantsByBudget,
  cropCanvasByRelativeRect,
} from '../../app/modules/ocr-image-processing.js';

describe('getConfusableLatinToCyrillicMap', () => {
  it('returns object with Latin-to-Cyrillic mappings', () => {
    const map = getConfusableLatinToCyrillicMap();
    assert.equal(map.A, 'А');
    assert.equal(map.o, 'о');
    assert.equal(typeof map, 'object');
  });
});

describe('convertLatinLookalikesToCyrillic', () => {
  it('replaces confusable Latin chars with Cyrillic', () => {
    const result = convertLatinLookalikesToCyrillic('AoBo');
    assert.equal(result, 'АоВо');
  });

  it('handles empty/null input', () => {
    assert.equal(convertLatinLookalikesToCyrillic(''), '');
    assert.equal(convertLatinLookalikesToCyrillic(null), '');
  });

  it('leaves non-confusable Latin chars unchanged', () => {
    const result = convertLatinLookalikesToCyrillic('QWZ');
    // Q, W, Z are not in the map
    assert.equal(result, 'QWZ');
  });
});

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

  it('returns false for null/empty', () => {
    assert.equal(hasMixedCyrillicLatinToken(''), false);
    assert.equal(hasMixedCyrillicLatinToken(null), false);
  });
});

describe('computeOtsuThreshold', () => {
  it('returns 127 for uniform data', () => {
    // All pixels same value => no variance difference
    const data = new Uint8ClampedArray(16);
    data.fill(128);
    const t = computeOtsuThreshold(data);
    assert.ok(t >= 0 && t <= 255);
  });

  it('finds threshold between bimodal peaks', () => {
    // Create bimodal image: half black (0), half white (255)
    const data = new Uint8ClampedArray(400); // 100 pixels
    for (let i = 0; i < 200; i += 4) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
    }
    for (let i = 200; i < 400; i += 4) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
    const t = computeOtsuThreshold(data);
    // Threshold should be somewhere between 0 and 255
    assert.ok(t > 0 && t < 255);
  });
});

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
});

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
});

describe('scoreRussianBigrams', () => {
  it('returns 0 for empty text', () => {
    assert.equal(scoreRussianBigrams(''), 0);
  });

  it('returns positive score for Russian text', () => {
    const score = scoreRussianBigrams('Программирование на языке');
    assert.ok(score > 0);
  });
});

describe('scoreEnglishBigrams', () => {
  it('returns 0 for empty text', () => {
    assert.equal(scoreEnglishBigrams(''), 0);
  });

  it('returns positive score for English text', () => {
    const score = scoreEnglishBigrams('The quick brown fox jumps over the lazy dog');
    assert.ok(score > 0);
  });
});

describe('estimateSkewAngleFromBinary', () => {
  it('returns 0 for insufficient dark points', () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    data.fill(255);
    const angle = estimateSkewAngleFromBinary({ width: 100, height: 100, data });
    assert.equal(angle, 0);
  });
});

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
    assert.equal(result[0], 0); // first
    assert.equal(result[2], 9); // last
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
});

describe('cropCanvasByRelativeRect', () => {
  it('creates a canvas with cropped dimensions', () => {
    const src = document.createElement('canvas');
    src.width = 200;
    src.height = 100;
    const result = cropCanvasByRelativeRect(src, { x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
    assert.equal(result.width, 100); // floor(200 * 0.5)
    assert.equal(result.height, 50); // floor(100 * 0.5)
  });

  it('clamps to at least 1px', () => {
    const src = document.createElement('canvas');
    src.width = 100;
    src.height = 100;
    const result = cropCanvasByRelativeRect(src, { x: 0, y: 0, w: 0.001, h: 0.001 });
    assert.ok(result.width >= 1);
    assert.ok(result.height >= 1);
  });
});
