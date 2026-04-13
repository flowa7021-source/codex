// ─── Unit Tests: percentile ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  percentile,
  quantile,
  quartiles,
  iqr,
  percentileRank,
  PercentileDigest,
  createPercentileDigest,
} from '../../app/modules/percentile.js';

// ─── percentile() ───────────────────────────────────────────────────────────

describe('percentile()', () => {
  it('returns the min at p=0', () => {
    assert.equal(percentile([10, 20, 30, 40, 50], 0), 10);
  });

  it('returns the max at p=100', () => {
    assert.equal(percentile([10, 20, 30, 40, 50], 100), 50);
  });

  it('returns the median at p=50', () => {
    assert.equal(percentile([10, 20, 30, 40, 50], 50), 30);
  });

  it('interpolates between values', () => {
    // [1, 2, 3, 4] at p=25 => pos = 0.25*3 = 0.75 => 1*0.25 + 2*0.75 = 1.75
    assert.equal(percentile([1, 2, 3, 4], 25), 1.75);
  });

  it('works for a single-element array', () => {
    assert.equal(percentile([42], 50), 42);
    assert.equal(percentile([42], 0), 42);
    assert.equal(percentile([42], 100), 42);
  });

  it('throws for empty array', () => {
    assert.throws(() => percentile([], 50), RangeError);
  });

  it('throws for out-of-range p', () => {
    assert.throws(() => percentile([1, 2, 3], -1), RangeError);
    assert.throws(() => percentile([1, 2, 3], 101), RangeError);
  });

  it('does not mutate the input', () => {
    const arr = [5, 3, 1, 4, 2];
    percentile(arr, 50);
    assert.deepEqual(arr, [5, 3, 1, 4, 2]);
  });
});

// ─── quantile() ─────────────────────────────────────────────────────────────

describe('quantile()', () => {
  it('returns the min at q=0', () => {
    assert.equal(quantile([10, 20, 30], 0), 10);
  });

  it('returns the max at q=1', () => {
    assert.equal(quantile([10, 20, 30], 1), 30);
  });

  it('returns the median at q=0.5', () => {
    assert.equal(quantile([10, 20, 30], 0.5), 20);
  });

  it('throws for out-of-range q', () => {
    assert.throws(() => quantile([1, 2], -0.1), RangeError);
    assert.throws(() => quantile([1, 2], 1.1), RangeError);
  });

  it('throws for empty array', () => {
    assert.throws(() => quantile([], 0.5), RangeError);
  });
});

// ─── quartiles() ────────────────────────────────────────────────────────────

describe('quartiles()', () => {
  it('computes Q1, Q2, Q3 correctly', () => {
    // 1..10
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const q = quartiles(data);
    assert.equal(q.q2, 5.5); // median
    // q1 = quantile at 0.25: pos = 0.25*9 = 2.25 => 3*0.75 + 4*0.25 = 3.25
    assert.equal(q.q1, 3.25);
    // q3 = quantile at 0.75: pos = 0.75*9 = 6.75 => 7*0.25 + 8*0.75 = 7.75
    assert.equal(q.q3, 7.75);
  });

  it('throws for empty array', () => {
    assert.throws(() => quartiles([]), RangeError);
  });
});

// ─── iqr() ──────────────────────────────────────────────────────────────────

describe('iqr()', () => {
  it('computes the interquartile range', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // q3 - q1 = 7.75 - 3.25 = 4.5
    assert.equal(iqr(data), 4.5);
  });

  it('returns 0 for a single element', () => {
    assert.equal(iqr([5]), 0);
  });

  it('throws for empty array', () => {
    assert.throws(() => iqr([]), RangeError);
  });
});

// ─── percentileRank() ───────────────────────────────────────────────────────

describe('percentileRank()', () => {
  it('returns 100 for the maximum value', () => {
    assert.equal(percentileRank([1, 2, 3, 4, 5], 5), 100);
  });

  it('returns 20 for the minimum when all distinct', () => {
    // 1 out of 5 values <= 1 => 20%
    assert.equal(percentileRank([1, 2, 3, 4, 5], 1), 20);
  });

  it('returns 0 when value is below all elements', () => {
    assert.equal(percentileRank([10, 20, 30], 5), 0);
  });

  it('returns 100 when value is above all elements', () => {
    assert.equal(percentileRank([10, 20, 30], 50), 100);
  });

  it('handles duplicates', () => {
    // 4 out of 5 values <= 3 => 80%
    assert.equal(percentileRank([1, 2, 3, 3, 5], 3), 80);
  });

  it('throws for empty array', () => {
    assert.throws(() => percentileRank([], 5), RangeError);
  });
});

// ─── PercentileDigest class ─────────────────────────────────────────────────

describe('PercentileDigest', () => {
  it('throws when queried while empty', () => {
    const pd = new PercentileDigest();
    assert.throws(() => pd.percentile(50), RangeError);
  });

  it('returns correct percentile for a single value', () => {
    const pd = new PercentileDigest();
    pd.add(10);
    assert.equal(pd.percentile(0), 10);
    assert.equal(pd.percentile(50), 10);
    assert.equal(pd.percentile(100), 10);
  });

  it('computes percentiles after multiple adds', () => {
    const pd = new PercentileDigest();
    for (let i = 1; i <= 100; i++) pd.add(i);
    assert.equal(pd.percentile(0), 1);
    assert.equal(pd.percentile(100), 100);
    assert.equal(pd.percentile(50), 50.5);
  });

  it('reports correct size', () => {
    const pd = new PercentileDigest();
    assert.equal(pd.size, 0);
    pd.add(1);
    pd.add(2);
    assert.equal(pd.size, 2);
  });

  it('resets on clear()', () => {
    const pd = new PercentileDigest();
    pd.add(1);
    pd.add(2);
    pd.clear();
    assert.equal(pd.size, 0);
    assert.throws(() => pd.percentile(50), RangeError);
  });

  it('throws for out-of-range p', () => {
    const pd = new PercentileDigest();
    pd.add(1);
    assert.throws(() => pd.percentile(-1), RangeError);
    assert.throws(() => pd.percentile(101), RangeError);
  });
});

// ─── createPercentileDigest() ───────────────────────────────────────────────

describe('createPercentileDigest()', () => {
  it('returns a PercentileDigest instance', () => {
    const pd = createPercentileDigest();
    assert.ok(pd instanceof PercentileDigest);
  });

  it('returned instance works correctly', () => {
    const pd = createPercentileDigest();
    pd.add(10);
    pd.add(20);
    pd.add(30);
    assert.equal(pd.percentile(50), 20);
  });
});
