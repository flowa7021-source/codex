// ─── Unit Tests: statistics-utils ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mean,
  median,
  mode,
  variance,
  stdDev,
  skewness,
  kurtosis,
  percentile,
  iqr,
  zScore,
  normalize,
  correlation,
  covariance,
  linearRegression,
  movingAverage,
  exponentialMovingAverage,
} from '../../app/modules/statistics-utils.js';

// ─── mean ─────────────────────────────────────────────────────────────────────

describe('mean', () => {
  it('returns correct mean for [1,2,3,4,5]', () => {
    assert.equal(mean([1, 2, 3, 4, 5]), 3);
  });

  it('returns single element for one-element array', () => {
    assert.equal(mean([42]), 42);
  });

  it('handles negative numbers', () => {
    assert.equal(mean([-3, -1, 1, 3]), 0);
  });

  it('handles floats', () => {
    assert.ok(Math.abs(mean([0.1, 0.2, 0.3]) - 0.2) < 1e-10);
  });

  it('returns NaN for empty array', () => {
    assert.ok(Number.isNaN(mean([])));
  });
});

// ─── median ───────────────────────────────────────────────────────────────────

describe('median', () => {
  it('returns 3 for [1,2,3,4,5]', () => {
    assert.equal(median([1, 2, 3, 4, 5]), 3);
  });

  it('returns average of two middle elements for even-length array', () => {
    assert.equal(median([1, 2, 3, 4]), 2.5);
  });

  it('works on unsorted input', () => {
    assert.equal(median([5, 1, 3, 2, 4]), 3);
  });

  it('returns single element for one-element array', () => {
    assert.equal(median([7]), 7);
  });

  it('returns NaN for empty array', () => {
    assert.ok(Number.isNaN(median([])));
  });

  it('does not mutate input', () => {
    const data = [3, 1, 2];
    median(data);
    assert.deepEqual(data, [3, 1, 2]);
  });
});

// ─── mode ─────────────────────────────────────────────────────────────────────

describe('mode', () => {
  it('returns single mode', () => {
    assert.deepEqual(mode([1, 2, 2, 3]), [2]);
  });

  it('returns all modes in ascending order', () => {
    assert.deepEqual(mode([1, 1, 2, 2, 3]), [1, 2]);
  });

  it('returns all values when all have same frequency', () => {
    assert.deepEqual(mode([3, 1, 2]), [1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(mode([]), []);
  });

  it('returns single element for one-element array', () => {
    assert.deepEqual(mode([5]), [5]);
  });
});

// ─── variance ─────────────────────────────────────────────────────────────────

describe('variance', () => {
  it('returns 4 for [2,4,4,4,5,5,7,9] population variance', () => {
    assert.ok(Math.abs(variance([2, 4, 4, 4, 5, 5, 7, 9]) - 4) < 1e-10);
  });

  it('uses Bessel correction when sample=true', () => {
    // sample variance of [2,4,4,4,5,5,7,9]: 4 * 8/7
    const expected = 4 * (8 / 7);
    assert.ok(Math.abs(variance([2, 4, 4, 4, 5, 5, 7, 9], true) - expected) < 1e-10);
  });

  it('returns 0 for constant array', () => {
    assert.equal(variance([3, 3, 3, 3]), 0);
  });

  it('returns NaN for empty array', () => {
    assert.ok(Number.isNaN(variance([])));
  });

  it('returns NaN for single element with sample=true', () => {
    assert.ok(Number.isNaN(variance([5], true)));
  });
});

// ─── stdDev ───────────────────────────────────────────────────────────────────

describe('stdDev', () => {
  it('returns 2 for [2,4,4,4,5,5,7,9] population std dev', () => {
    assert.ok(Math.abs(stdDev([2, 4, 4, 4, 5, 5, 7, 9]) - 2) < 1e-10);
  });

  it('is sqrt of variance', () => {
    const data = [1, 2, 3, 4, 5];
    assert.ok(Math.abs(stdDev(data) - Math.sqrt(variance(data))) < 1e-10);
  });

  it('returns 0 for constant array', () => {
    assert.equal(stdDev([7, 7, 7]), 0);
  });

  it('sample=true gives larger value than population', () => {
    const data = [1, 2, 3, 4, 5];
    assert.ok(stdDev(data, true) > stdDev(data, false));
  });
});

// ─── skewness ─────────────────────────────────────────────────────────────────

describe('skewness', () => {
  it('returns approximately 0 for a symmetric dataset', () => {
    // Symmetric around mean
    assert.ok(Math.abs(skewness([1, 2, 3, 4, 5])) < 1e-9);
  });

  it('returns positive value for right-skewed data', () => {
    // Long tail to the right
    assert.ok(skewness([1, 1, 1, 1, 10]) > 0);
  });

  it('returns negative value for left-skewed data', () => {
    assert.ok(skewness([1, 10, 10, 10, 10]) < 0);
  });

  it('returns NaN for fewer than 3 elements', () => {
    assert.ok(Number.isNaN(skewness([1, 2])));
    assert.ok(Number.isNaN(skewness([])));
  });
});

// ─── kurtosis ─────────────────────────────────────────────────────────────────

describe('kurtosis', () => {
  it('returns a finite number for a standard dataset', () => {
    const k = kurtosis([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(Number.isFinite(k));
  });

  it('returns NaN for fewer than 4 elements', () => {
    assert.ok(Number.isNaN(kurtosis([1, 2, 3])));
  });

  it('returns 0 for constant array', () => {
    assert.equal(kurtosis([5, 5, 5, 5, 5]), 0);
  });

  it('returns excess kurtosis (normal distribution ~ 0)', () => {
    // A large normal-like dataset should be close to 0
    const data = [
      -2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0, 0.25, 0.5, 0.75, 1, 1.5, 2,
    ];
    const k = kurtosis(data);
    assert.ok(Number.isFinite(k));
  });
});

// ─── percentile ───────────────────────────────────────────────────────────────

describe('percentile', () => {
  it('returns 75 for percentile([0,25,50,75,100], 75)', () => {
    assert.equal(percentile([0, 25, 50, 75, 100], 75), 75);
  });

  it('returns minimum for p=0', () => {
    assert.equal(percentile([3, 1, 4, 1, 5], 0), 1);
  });

  it('returns maximum for p=100', () => {
    assert.equal(percentile([3, 1, 4, 1, 5], 100), 5);
  });

  it('returns median for p=50', () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  });

  it('interpolates correctly for non-exact positions', () => {
    // sorted: [0, 25, 50, 75, 100], p=25 → rank=1 → 25
    assert.equal(percentile([0, 25, 50, 75, 100], 25), 25);
  });

  it('returns NaN for empty array', () => {
    assert.ok(Number.isNaN(percentile([], 50)));
  });

  it('does not mutate input', () => {
    const data = [5, 3, 1, 4, 2];
    percentile(data, 50);
    assert.deepEqual(data, [5, 3, 1, 4, 2]);
  });
});

// ─── iqr ──────────────────────────────────────────────────────────────────────

describe('iqr', () => {
  it('returns Q3 - Q1 for [1,2,3,4,5]', () => {
    // Q1=25th pct, Q3=75th pct of [1,2,3,4,5]
    const result = iqr([1, 2, 3, 4, 5]);
    assert.ok(result > 0);
    assert.ok(Math.abs(result - (percentile([1, 2, 3, 4, 5], 75) - percentile([1, 2, 3, 4, 5], 25))) < 1e-10);
  });

  it('returns 0 for constant array', () => {
    assert.equal(iqr([5, 5, 5, 5]), 0);
  });

  it('returns positive value for spread data', () => {
    assert.ok(iqr([1, 2, 3, 4, 5, 6, 7, 8]) > 0);
  });
});

// ─── zScore ───────────────────────────────────────────────────────────────────

describe('zScore', () => {
  it('returns 0 for the mean of the dataset', () => {
    const data = [1, 2, 3, 4, 5];
    assert.ok(Math.abs(zScore(mean(data), data)) < 1e-10);
  });

  it('returns positive z-score for values above mean', () => {
    assert.ok(zScore(10, [1, 2, 3, 4, 5]) > 0);
  });

  it('returns negative z-score for values below mean', () => {
    assert.ok(zScore(-10, [1, 2, 3, 4, 5]) < 0);
  });

  it('returns 0 for any value when stddev is 0', () => {
    assert.equal(zScore(5, [5, 5, 5]), 0);
  });
});

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('maps min to 0 and max to 1', () => {
    const result = normalize([1, 2, 3, 4, 5]);
    assert.equal(result[0], 0);
    assert.equal(result[result.length - 1], 1);
  });

  it('returns all values in [0, 1]', () => {
    const result = normalize([10, 20, 30, 40, 50]);
    for (const v of result) {
      assert.ok(v >= 0 && v <= 1);
    }
  });

  it('returns zeros for constant array', () => {
    assert.deepEqual(normalize([7, 7, 7]), [0, 0, 0]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(normalize([]), []);
  });

  it('preserves relative ordering', () => {
    const result = normalize([1, 3, 2]);
    assert.ok(result[1] > result[2]);
    assert.ok(result[2] > result[0]);
  });
});

// ─── correlation ──────────────────────────────────────────────────────────────

describe('correlation', () => {
  it('returns ~1 for perfectly positive correlation', () => {
    assert.ok(Math.abs(correlation([1, 2, 3], [1, 2, 3]) - 1) < 1e-10);
  });

  it('returns ~-1 for perfectly negative correlation', () => {
    assert.ok(Math.abs(correlation([1, 2, 3], [3, 2, 1]) + 1) < 1e-10);
  });

  it('returns 0 for constant y array', () => {
    assert.equal(correlation([1, 2, 3], [5, 5, 5]), 0);
  });

  it('returns NaN for empty arrays', () => {
    assert.ok(Number.isNaN(correlation([], [])));
  });

  it('result is in [-1, 1]', () => {
    const r = correlation([1, 3, 2, 5, 4], [2, 1, 4, 3, 5]);
    assert.ok(r >= -1 && r <= 1);
  });
});

// ─── covariance ───────────────────────────────────────────────────────────────

describe('covariance', () => {
  it('returns positive covariance for positively correlated data', () => {
    assert.ok(covariance([1, 2, 3], [1, 2, 3]) > 0);
  });

  it('returns negative covariance for negatively correlated data', () => {
    assert.ok(covariance([1, 2, 3], [3, 2, 1]) < 0);
  });

  it('returns 0 for constant arrays', () => {
    assert.equal(covariance([1, 2, 3], [5, 5, 5]), 0);
  });

  it('returns NaN for empty arrays', () => {
    assert.ok(Number.isNaN(covariance([], [])));
  });

  it('is symmetric', () => {
    const x = [1, 2, 3, 4];
    const y = [4, 3, 2, 1];
    assert.ok(Math.abs(covariance(x, y) - covariance(y, x)) < 1e-10);
  });
});

// ─── linearRegression ─────────────────────────────────────────────────────────

describe('linearRegression', () => {
  it('returns slope=1 and intercept=0 for y=x', () => {
    const { slope, intercept, r2 } = linearRegression([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    assert.ok(Math.abs(slope - 1) < 1e-10);
    assert.ok(Math.abs(intercept) < 1e-10);
    assert.ok(Math.abs(r2 - 1) < 1e-10);
  });

  it('returns slope=2 and intercept=0 for y=2x', () => {
    const { slope, intercept } = linearRegression([1, 2, 3], [2, 4, 6]);
    assert.ok(Math.abs(slope - 2) < 1e-10);
    assert.ok(Math.abs(intercept) < 1e-10);
  });

  it('roundtrip: predicted values match original', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [3, 5, 7, 9, 11]; // y = 2x + 1
    const { slope, intercept } = linearRegression(x, y);
    for (let i = 0; i < x.length; i++) {
      assert.ok(Math.abs(slope * x[i] + intercept - y[i]) < 1e-8);
    }
  });

  it('r2 is 1 for perfect linear fit', () => {
    const { r2 } = linearRegression([0, 1, 2, 3], [1, 3, 5, 7]);
    assert.ok(Math.abs(r2 - 1) < 1e-10);
  });

  it('r2 is between 0 and 1 for imperfect fit', () => {
    const { r2 } = linearRegression([1, 2, 3, 4, 5], [1, 4, 3, 8, 5]);
    assert.ok(r2 >= 0 && r2 <= 1);
  });

  it('returns NaN for fewer than 2 points', () => {
    const { slope, intercept, r2 } = linearRegression([1], [1]);
    assert.ok(Number.isNaN(slope));
    assert.ok(Number.isNaN(intercept));
    assert.ok(Number.isNaN(r2));
  });
});

// ─── movingAverage ────────────────────────────────────────────────────────────

describe('movingAverage', () => {
  it('returns correct values for window=3', () => {
    const result = movingAverage([1, 2, 3, 4, 5], 3);
    assert.equal(result.length, 3);
    assert.ok(Math.abs(result[0] - 2) < 1e-10);
    assert.ok(Math.abs(result[1] - 3) < 1e-10);
    assert.ok(Math.abs(result[2] - 4) < 1e-10);
  });

  it('returns single element for window=data.length', () => {
    const result = movingAverage([1, 2, 3, 4, 5], 5);
    assert.equal(result.length, 1);
    assert.equal(result[0], 3);
  });

  it('returns all original values for window=1', () => {
    assert.deepEqual(movingAverage([1, 2, 3], 1), [1, 2, 3]);
  });

  it('returns empty array when window > data.length', () => {
    assert.deepEqual(movingAverage([1, 2], 5), []);
  });

  it('returns empty array for window <= 0', () => {
    assert.deepEqual(movingAverage([1, 2, 3], 0), []);
  });
});

// ─── exponentialMovingAverage ─────────────────────────────────────────────────

describe('exponentialMovingAverage', () => {
  it('returns same length as input', () => {
    const result = exponentialMovingAverage([1, 2, 3, 4, 5], 0.5);
    assert.equal(result.length, 5);
  });

  it('first element equals first data point', () => {
    const result = exponentialMovingAverage([10, 20, 30], 0.3);
    assert.equal(result[0], 10);
  });

  it('alpha=1 returns original data', () => {
    const data = [5, 10, 15, 20];
    const result = exponentialMovingAverage(data, 1);
    assert.deepEqual(result, data);
  });

  it('alpha=0 returns constant array of first element', () => {
    const result = exponentialMovingAverage([5, 10, 15], 0);
    assert.deepEqual(result, [5, 5, 5]);
  });

  it('values are smoothed (intermediate alpha)', () => {
    // With alpha=0.5: ema[1] = 0.5*20 + 0.5*10 = 15
    const result = exponentialMovingAverage([10, 20], 0.5);
    assert.ok(Math.abs(result[1] - 15) < 1e-10);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(exponentialMovingAverage([], 0.5), []);
  });
});
