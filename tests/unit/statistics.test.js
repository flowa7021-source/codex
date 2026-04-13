// ─── Unit Tests: statistics ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mean, median, mode, variance, stddev,
  min, max, range, sum, quantile, iqr,
  skewness, kurtosis, zScore,
  normalPDF, normalCDF,
  covariance, pearsonCorrelation, spearmanCorrelation,
  sampleWithReplacement, sampleWithoutReplacement,
} from '../../app/modules/statistics.js';

const EPS = 1e-9;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

// ─── mean ────────────────────────────────────────────────────────────────────

describe('mean', () => {
  it('returns the arithmetic mean', () => {
    assert.equal(mean([1, 2, 3, 4, 5]), 3);
  });
  it('single element', () => {
    assert.equal(mean([7]), 7);
  });
  it('handles negatives', () => {
    assert.ok(near(mean([-3, -1, 1, 3]), 0));
  });
  it('throws on empty array', () => {
    assert.throws(() => mean([]), RangeError);
  });
});

// ─── median ─────────────────────────────────────────────────────────────────

describe('median', () => {
  it('odd length: returns middle element', () => {
    assert.equal(median([3, 1, 2]), 2);
  });
  it('even length: returns average of two middle elements', () => {
    assert.equal(median([1, 2, 3, 4]), 2.5);
  });
  it('single element', () => {
    assert.equal(median([42]), 42);
  });
  it('throws on empty array', () => {
    assert.throws(() => median([]), RangeError);
  });
});

// ─── mode ────────────────────────────────────────────────────────────────────

describe('mode', () => {
  it('returns most frequent value', () => {
    assert.deepEqual(mode([1, 2, 2, 3]), [2]);
  });
  it('returns all modes for multi-modal dataset', () => {
    assert.deepEqual(mode([1, 1, 2, 2, 3]), [1, 2]);
  });
  it('sorted ascending', () => {
    const m = mode([3, 1, 1, 3, 2, 2]);
    assert.deepEqual(m, [...m].sort((a, b) => a - b));
  });
  it('throws on empty array', () => {
    assert.throws(() => mode([]), RangeError);
  });
});

// ─── variance / stddev ───────────────────────────────────────────────────────

describe('variance / stddev', () => {
  it('population variance of [2,4,4,4,5,5,7,9] = 4', () => {
    assert.ok(near(variance([2, 4, 4, 4, 5, 5, 7, 9], true), 4));
  });
  it('population variance divides by N', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    assert.ok(variance(data, true) < variance(data, false));
  });
  it('stddev is sqrt of variance', () => {
    const data = [1, 2, 3, 4, 5];
    assert.ok(near(stddev(data), Math.sqrt(variance(data))));
  });
  it('population stddev', () => {
    const data = [1, 2, 3];
    assert.ok(near(stddev(data, true), Math.sqrt(variance(data, true))));
  });
  it('throws on empty array', () => {
    assert.throws(() => variance([]), RangeError);
  });
});

// ─── min / max / range / sum ─────────────────────────────────────────────────

describe('min / max / range / sum', () => {
  const data = [3, 1, 4, 1, 5, 9, 2, 6];
  it('min', () => assert.equal(min(data), 1));
  it('max', () => assert.equal(max(data), 9));
  it('range = max - min', () => assert.equal(range(data), 8));
  it('sum', () => assert.equal(sum(data), 31));
  it('min throws on empty', () => assert.throws(() => min([]), RangeError));
  it('max throws on empty', () => assert.throws(() => max([]), RangeError));
});

// ─── quantile / iqr ──────────────────────────────────────────────────────────

describe('quantile / iqr', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('Q2 (median)', () => assert.ok(near(quantile(data, 0.5), 5.5, 0.01)));
  it('Q0 = min', () => assert.equal(quantile(data, 0), 1));
  it('Q1 in (1,5)', () => {
    const q1 = quantile(data, 0.25);
    assert.ok(q1 > 1 && q1 < 5);
  });
  it('Q3 in (6,10)', () => {
    const q3 = quantile(data, 0.75);
    assert.ok(q3 > 5 && q3 < 10);
  });
  it('iqr = Q3 - Q1', () => {
    const q1 = quantile(data, 0.25);
    const q3 = quantile(data, 0.75);
    assert.ok(near(iqr(data), q3 - q1, 0.01));
  });
  it('throws on empty array', () => assert.throws(() => quantile([], 0.5), RangeError));
});

// ─── skewness / kurtosis ─────────────────────────────────────────────────────

describe('skewness / kurtosis', () => {
  it('symmetric data has skewness near 0', () => {
    const sym = [-3, -2, -1, 0, 1, 2, 3];
    assert.ok(Math.abs(skewness(sym)) < 0.01);
  });
  it('right-skewed data has positive skewness', () => {
    const rsk = [1, 1, 1, 2, 10, 20];
    assert.ok(skewness(rsk) > 0);
  });
  it('kurtosis of normal-like data is finite', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    assert.ok(Number.isFinite(kurtosis(data)));
  });
});

// ─── zScore ──────────────────────────────────────────────────────────────────

describe('zScore', () => {
  it('z-score at mean = 0', () => {
    assert.equal(zScore(5, 5, 2), 0);
  });
  it('z-score = 1 at mean + 1 stddev', () => {
    assert.equal(zScore(7, 5, 2), 1);
  });
  it('z-score = -2 at mean - 2 stddev', () => {
    assert.equal(zScore(1, 5, 2), -2);
  });
});

// ─── normalPDF / normalCDF ───────────────────────────────────────────────────

describe('normalPDF / normalCDF', () => {
  it('normalPDF at mean is maximum (standard normal)', () => {
    const atMean = normalPDF(0);
    const away = normalPDF(1);
    assert.ok(atMean > away);
  });
  it('normalPDF is symmetric', () => {
    assert.ok(near(normalPDF(1), normalPDF(-1)));
  });
  it('normalCDF at mean = 0.5', () => {
    assert.ok(near(normalCDF(0), 0.5, 0.001));
  });
  it('normalCDF at mean + 2σ ≈ 0.9772', () => {
    assert.ok(near(normalCDF(2), 0.9772, 0.005));
  });
  it('normalCDF at mean - 2σ ≈ 0.0228', () => {
    assert.ok(near(normalCDF(-2), 0.0228, 0.005));
  });
  it('normalCDF is monotone increasing', () => {
    assert.ok(normalCDF(0) < normalCDF(1));
  });
});

// ─── covariance / pearsonCorrelation / spearmanCorrelation ──────────────────

describe('covariance / pearsonCorrelation / spearmanCorrelation', () => {
  const x = [1, 2, 3, 4, 5];
  const y = [2, 4, 6, 8, 10]; // perfect positive correlation

  it('positive covariance for positively related data', () => {
    assert.ok(covariance(x, y) > 0);
  });
  it('pearson correlation = 1 for perfect linear', () => {
    assert.ok(near(pearsonCorrelation(x, y), 1));
  });
  it('pearson correlation = -1 for perfect inverse', () => {
    const yInv = y.map(v => -v);
    assert.ok(near(pearsonCorrelation(x, yInv), -1));
  });
  it('pearson correlation in [-1,1]', () => {
    const a = [1, 3, 2, 5, 4];
    const b = [4, 2, 3, 1, 5];
    const r = pearsonCorrelation(a, b);
    assert.ok(r >= -1 && r <= 1);
  });
  it('spearman = 1 for monotone increasing', () => {
    assert.ok(near(spearmanCorrelation(x, y), 1, 0.001));
  });
  it('spearman = -1 for monotone decreasing', () => {
    const yDec = [5, 4, 3, 2, 1];
    assert.ok(near(spearmanCorrelation(x, yDec), -1, 0.001));
  });
  it('throws on length mismatch', () => {
    assert.throws(() => pearsonCorrelation([1, 2], [1]));
  });
});

// ─── sampleWithReplacement / sampleWithoutReplacement ───────────────────────

describe('sampleWithReplacement / sampleWithoutReplacement', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('sampleWithReplacement returns correct count', () => {
    const s = sampleWithReplacement(data, 5, 42);
    assert.equal(s.length, 5);
  });
  it('sampleWithReplacement: all values in data', () => {
    const s = sampleWithReplacement(data, 20, 1);
    for (const v of s) assert.ok(data.includes(v));
  });
  it('sampleWithReplacement: seeded gives deterministic result', () => {
    const a = sampleWithReplacement(data, 5, 99);
    const b = sampleWithReplacement(data, 5, 99);
    assert.deepEqual(a, b);
  });
  it('sampleWithoutReplacement returns correct count', () => {
    const s = sampleWithoutReplacement(data, 5, 42);
    assert.equal(s.length, 5);
  });
  it('sampleWithoutReplacement: no duplicates', () => {
    const s = sampleWithoutReplacement(data, data.length, 7);
    const unique = new Set(s);
    assert.equal(unique.size, data.length);
  });
  it('sampleWithoutReplacement: all values in data', () => {
    const s = sampleWithoutReplacement(data, 7, 3);
    for (const v of s) assert.ok(data.includes(v));
  });
  it('throws when n > data.length for without replacement', () => {
    assert.throws(() => sampleWithoutReplacement([1, 2], 3));
  });
});
