// ─── Unit Tests: fenwick-tree ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FenwickTree, createFenwickTree } from '../../app/modules/fenwick-tree.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('FenwickTree constructor', () => {
  it('creates a zero-filled tree from a numeric size', () => {
    const ft = new FenwickTree(5);
    assert.equal(ft.size, 5);
    assert.deepEqual(ft.toArray(), [0, 0, 0, 0, 0]);
  });

  it('creates a tree from an initial data array', () => {
    const ft = new FenwickTree([1, 2, 3, 4]);
    assert.equal(ft.size, 4);
    assert.deepEqual(ft.toArray(), [1, 2, 3, 4]);
  });

  it('throws on negative size', () => {
    assert.throws(() => new FenwickTree(-1), RangeError);
  });

  it('handles size zero', () => {
    const ft = new FenwickTree(0);
    assert.equal(ft.size, 0);
    assert.deepEqual(ft.toArray(), []);
  });

  it('handles empty array', () => {
    const ft = new FenwickTree([]);
    assert.equal(ft.size, 0);
    assert.deepEqual(ft.toArray(), []);
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('FenwickTree.update', () => {
  it('adds delta to the correct position', () => {
    const ft = new FenwickTree(4);
    ft.update(0, 5);
    ft.update(2, 3);
    assert.deepEqual(ft.toArray(), [5, 0, 3, 0]);
  });

  it('throws on out-of-bounds index', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.update(3, 1), RangeError);
    assert.throws(() => ft.update(-1, 1), RangeError);
  });
});

// ─── set ─────────────────────────────────────────────────────────────────────

describe('FenwickTree.set', () => {
  it('sets absolute value correctly', () => {
    const ft = new FenwickTree([1, 2, 3]);
    ft.set(1, 10);
    assert.deepEqual(ft.toArray(), [1, 10, 3]);
    assert.equal(ft.prefixSum(2), 14);
  });

  it('can set the same value (no-op delta)', () => {
    const ft = new FenwickTree([5, 6, 7]);
    ft.set(0, 5);
    assert.deepEqual(ft.toArray(), [5, 6, 7]);
  });
});

// ─── prefixSum ───────────────────────────────────────────────────────────────

describe('FenwickTree.prefixSum', () => {
  it('returns correct prefix sums for initialized data', () => {
    const ft = new FenwickTree([1, 2, 3, 4, 5]);
    assert.equal(ft.prefixSum(0), 1);
    assert.equal(ft.prefixSum(1), 3);
    assert.equal(ft.prefixSum(2), 6);
    assert.equal(ft.prefixSum(3), 10);
    assert.equal(ft.prefixSum(4), 15);
  });

  it('reflects updates', () => {
    const ft = new FenwickTree(3);
    ft.update(0, 10);
    ft.update(1, 20);
    ft.update(2, 30);
    assert.equal(ft.prefixSum(0), 10);
    assert.equal(ft.prefixSum(1), 30);
    assert.equal(ft.prefixSum(2), 60);
  });

  it('throws on out-of-bounds', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.prefixSum(3), RangeError);
    assert.throws(() => ft.prefixSum(-1), RangeError);
  });
});

// ─── rangeSum ────────────────────────────────────────────────────────────────

describe('FenwickTree.rangeSum', () => {
  it('computes correct range sums', () => {
    const ft = new FenwickTree([1, 2, 3, 4, 5]);
    assert.equal(ft.rangeSum(0, 4), 15);
    assert.equal(ft.rangeSum(1, 3), 9);
    assert.equal(ft.rangeSum(2, 2), 3);
    assert.equal(ft.rangeSum(0, 0), 1);
  });

  it('throws when left > right', () => {
    const ft = new FenwickTree([1, 2, 3]);
    assert.throws(() => ft.rangeSum(2, 1), RangeError);
  });

  it('throws on out-of-bounds', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.rangeSum(0, 3), RangeError);
    assert.throws(() => ft.rangeSum(-1, 2), RangeError);
  });
});

// ─── toArray ─────────────────────────────────────────────────────────────────

describe('FenwickTree.toArray', () => {
  it('returns a copy, not a reference', () => {
    const ft = new FenwickTree([1, 2, 3]);
    const arr = ft.toArray();
    arr[0] = 999;
    assert.deepEqual(ft.toArray(), [1, 2, 3]);
  });
});

// ─── createFenwickTree factory ───────────────────────────────────────────────

describe('createFenwickTree', () => {
  it('creates a tree from size', () => {
    const ft = createFenwickTree(5);
    assert.equal(ft.size, 5);
  });

  it('creates a tree from data', () => {
    const ft = createFenwickTree([10, 20, 30]);
    assert.equal(ft.prefixSum(2), 60);
  });
});

// ─── stress / larger input ───────────────────────────────────────────────────

describe('FenwickTree stress', () => {
  it('handles 1000 elements correctly', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i + 1);
    const ft = new FenwickTree(data);
    // Sum 1..1000 = 500500
    assert.equal(ft.prefixSum(999), 500500);
    // rangeSum [100..199] = sum 101..200
    const expected = Array.from({ length: 100 }, (_, i) => i + 101).reduce((a, b) => a + b, 0);
    assert.equal(ft.rangeSum(100, 199), expected);
  });

  it('update and set interleave correctly', () => {
    const ft = new FenwickTree([1, 2, 3, 4, 5]);
    ft.update(2, 10); // [1,2,13,4,5]
    ft.set(4, 100);   // [1,2,13,4,100]
    assert.equal(ft.rangeSum(0, 4), 120);
    assert.equal(ft.rangeSum(2, 4), 117);
    assert.deepEqual(ft.toArray(), [1, 2, 13, 4, 100]);
  });
});
