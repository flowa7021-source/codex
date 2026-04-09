// ─── Unit Tests: data-analysis ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  summarize,
  detectOutliers,
  removeOutliers,
  histogram,
  frequency,
  kMeans1D,
  detectTrend,
  cumulativeSum,
} from '../../app/modules/data-analysis.js';

// ─── summarize ────────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('returns correct count', () => {
    assert.equal(summarize([1, 2, 3, 4, 5]).count, 5);
  });

  it('returns correct min and max', () => {
    const s = summarize([3, 1, 4, 1, 5, 9, 2, 6]);
    assert.equal(s.min, 1);
    assert.equal(s.max, 9);
  });

  it('returns correct mean', () => {
    const s = summarize([1, 2, 3, 4, 5]);
    assert.equal(s.mean, 3);
  });

  it('returns correct median', () => {
    const s = summarize([1, 2, 3, 4, 5]);
    assert.equal(s.median, 3);
  });

  it('returns correct stdDev (population)', () => {
    // [2,4,4,4,5,5,7,9] population stddev = 2
    const s = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.ok(Math.abs(s.stdDev - 2) < 1e-10);
  });

  it('returns q1 <= median <= q3', () => {
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(s.q1 <= s.median);
    assert.ok(s.median <= s.q3);
  });

  it('iqr equals q3 - q1', () => {
    const s = summarize([1, 2, 3, 4, 5]);
    assert.ok(Math.abs(s.iqr - (s.q3 - s.q1)) < 1e-10);
  });

  it('returns NaN values for empty array', () => {
    const s = summarize([]);
    assert.equal(s.count, 0);
    assert.ok(Number.isNaN(s.mean));
    assert.ok(Number.isNaN(s.min));
    assert.ok(Number.isNaN(s.max));
  });
});

// ─── detectOutliers ───────────────────────────────────────────────────────────

describe('detectOutliers', () => {
  it('detects a high outlier', () => {
    // Q1=2, Q3=4, IQR=2, fence 1.5*2=3 → lo=-1, hi=7; 100 is outlier
    const outliers = detectOutliers([1, 2, 3, 4, 5, 100]);
    assert.ok(outliers.includes(100));
  });

  it('detects a low outlier', () => {
    const outliers = detectOutliers([-100, 1, 2, 3, 4, 5]);
    assert.ok(outliers.includes(-100));
  });

  it('returns empty array when no outliers', () => {
    assert.deepEqual(detectOutliers([1, 2, 3, 4, 5]), []);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(detectOutliers([]), []);
  });

  it('does not include non-outlier values', () => {
    const outliers = detectOutliers([1, 2, 3, 4, 5, 100]);
    assert.ok(!outliers.includes(3));
    assert.ok(!outliers.includes(5));
  });
});

// ─── removeOutliers ───────────────────────────────────────────────────────────

describe('removeOutliers', () => {
  it('removes a high outlier', () => {
    const clean = removeOutliers([1, 2, 3, 4, 5, 100]);
    assert.ok(!clean.includes(100));
  });

  it('removes a low outlier', () => {
    const clean = removeOutliers([-100, 1, 2, 3, 4, 5]);
    assert.ok(!clean.includes(-100));
  });

  it('returns all data when there are no outliers', () => {
    const data = [1, 2, 3, 4, 5];
    assert.equal(removeOutliers(data).length, data.length);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(removeOutliers([]), []);
  });

  it('result is a new array (does not mutate)', () => {
    const data = [1, 2, 3, 4, 5, 100];
    const clean = removeOutliers(data);
    assert.equal(data.length, 6);
    assert.ok(clean.length < data.length);
  });
});

// ─── histogram ────────────────────────────────────────────────────────────────

describe('histogram', () => {
  it('returns correct number of bins', () => {
    const h = histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    assert.equal(h.length, 5);
  });

  it('total count equals data length', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const h = histogram(data, 4);
    const total = h.reduce((acc, b) => acc + b.count, 0);
    assert.equal(total, data.length);
  });

  it('bins are contiguous (end of bin i equals start of bin i+1)', () => {
    const h = histogram([0, 1, 2, 3, 4, 5], 3);
    for (let i = 0; i < h.length - 1; i++) {
      assert.ok(Math.abs(h[i].end - h[i + 1].start) < 1e-10);
    }
  });

  it('first bin start equals min, last bin end equals max', () => {
    const data = [2, 4, 6, 8, 10];
    const h = histogram(data, 4);
    assert.equal(h[0].start, 2);
    assert.equal(h[h.length - 1].end, 10);
  });

  it('handles all-same-value data', () => {
    const h = histogram([5, 5, 5], 3);
    const total = h.reduce((acc, b) => acc + b.count, 0);
    assert.equal(total, 3);
  });

  it('returns empty array for empty data', () => {
    assert.deepEqual(histogram([], 5), []);
  });

  it('returns empty array for bins <= 0', () => {
    assert.deepEqual(histogram([1, 2, 3], 0), []);
  });
});

// ─── frequency ────────────────────────────────────────────────────────────────

describe('frequency', () => {
  it('counts occurrences of each value', () => {
    const freq = frequency([1, 2, 2, 3, 3, 3]);
    assert.equal(freq.get(1), 1);
    assert.equal(freq.get(2), 2);
    assert.equal(freq.get(3), 3);
  });

  it('returns a Map', () => {
    assert.ok(frequency([1, 2]) instanceof Map);
  });

  it('returns empty Map for empty input', () => {
    assert.equal(frequency([]).size, 0);
  });

  it('handles single unique value', () => {
    const freq = frequency([7, 7, 7]);
    assert.equal(freq.size, 1);
    assert.equal(freq.get(7), 3);
  });

  it('all frequencies sum to data length', () => {
    const data = [1, 2, 2, 3, 3, 3, 4];
    const freq = frequency(data);
    let total = 0;
    for (const count of freq.values()) total += count;
    assert.equal(total, data.length);
  });
});

// ─── kMeans1D ─────────────────────────────────────────────────────────────────

describe('kMeans1D', () => {
  it('returns k centroids', () => {
    const { centroids } = kMeans1D([1, 2, 3, 10, 11, 12], 2);
    assert.equal(centroids.length, 2);
  });

  it('returns labels with same length as data', () => {
    const data = [1, 2, 10, 11];
    const { labels } = kMeans1D(data, 2);
    assert.equal(labels.length, data.length);
  });

  it('groups clearly separated clusters', () => {
    // Two obvious clusters: [1,2,3] and [100,101,102]
    const { labels } = kMeans1D([1, 2, 3, 100, 101, 102], 2);
    // First three should have same label; last three should have same label
    assert.equal(labels[0], labels[1]);
    assert.equal(labels[1], labels[2]);
    assert.equal(labels[3], labels[4]);
    assert.equal(labels[4], labels[5]);
    assert.notEqual(labels[0], labels[3]);
  });

  it('centroids are sorted ascending', () => {
    const { centroids } = kMeans1D([1, 2, 3, 100, 101, 102], 2);
    assert.ok(centroids[0] < centroids[1]);
  });

  it('returns empty result for empty data', () => {
    const { centroids, labels } = kMeans1D([], 2);
    assert.deepEqual(centroids, []);
    assert.deepEqual(labels, []);
  });

  it('handles k=1 (all data in single cluster)', () => {
    const data = [1, 2, 3, 4, 5];
    const { centroids, labels } = kMeans1D(data, 1);
    assert.equal(centroids.length, 1);
    assert.ok(labels.every((l) => l === 0));
  });

  it('handles k >= data length', () => {
    const data = [1, 2, 3];
    const { centroids, labels } = kMeans1D(data, 10);
    assert.ok(centroids.length <= data.length);
    assert.equal(labels.length, data.length);
  });
});

// ─── detectTrend ──────────────────────────────────────────────────────────────

describe('detectTrend', () => {
  it("returns 'increasing' for monotonically increasing data", () => {
    assert.equal(detectTrend([1, 2, 3, 4, 5]), 'increasing');
  });

  it("returns 'decreasing' for monotonically decreasing data", () => {
    assert.equal(detectTrend([5, 4, 3, 2, 1]), 'decreasing');
  });

  it("returns 'flat' for constant data", () => {
    assert.equal(detectTrend([3, 3, 3, 3, 3]), 'flat');
  });

  it("returns 'flat' for single element", () => {
    assert.equal(detectTrend([42]), 'flat');
  });

  it("returns 'flat' for empty array", () => {
    assert.equal(detectTrend([]), 'flat');
  });

  it("returns 'increasing' for generally upward noisy data", () => {
    assert.equal(detectTrend([1, 3, 2, 5, 4, 7, 6, 9]), 'increasing');
  });

  it("returns 'decreasing' for generally downward noisy data", () => {
    assert.equal(detectTrend([9, 7, 8, 5, 6, 3, 4, 1]), 'decreasing');
  });
});

// ─── cumulativeSum ────────────────────────────────────────────────────────────

describe('cumulativeSum', () => {
  it('returns prefix sums', () => {
    assert.deepEqual(cumulativeSum([1, 2, 3, 4, 5]), [1, 3, 6, 10, 15]);
  });

  it('handles single element', () => {
    assert.deepEqual(cumulativeSum([7]), [7]);
  });

  it('handles negative numbers', () => {
    assert.deepEqual(cumulativeSum([-1, -2, -3]), [-1, -3, -6]);
  });

  it('handles mix of positive and negative', () => {
    assert.deepEqual(cumulativeSum([3, -1, 4, -2]), [3, 2, 6, 4]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(cumulativeSum([]), []);
  });

  it('same length as input', () => {
    const data = [5, 10, 15, 20];
    assert.equal(cumulativeSum(data).length, data.length);
  });
});
