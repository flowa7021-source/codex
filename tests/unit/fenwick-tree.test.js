// ─── Unit Tests: FenwickTree ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FenwickTree,
  FenwickTree2D,
  buildFenwickTree,
} from '../../app/modules/fenwick-tree.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('FenwickTree constructor', () => {
  it('creates a zero-filled tree of size n', () => {
    const ft = new FenwickTree(5);
    assert.equal(ft.size, 5);
    // All prefix sums should be 0 initially
    assert.equal(ft.prefixSum(5), 0);
  });

  it('throws on negative size', () => {
    assert.throws(() => new FenwickTree(-1), RangeError);
  });

  it('throws on non-integer size', () => {
    assert.throws(() => new FenwickTree(2.5), RangeError);
  });

  it('handles size zero', () => {
    const ft = new FenwickTree(0);
    assert.equal(ft.size, 0);
  });
});

// ─── add ─────────────────────────────────────────────────────────────────────

describe('FenwickTree.add', () => {
  it('adds delta at a 1-based position', () => {
    const ft = new FenwickTree(4);
    ft.add(1, 5);
    ft.add(3, 3);
    assert.equal(ft.get(1), 5);
    assert.equal(ft.get(3), 3);
    assert.equal(ft.get(2), 0);
  });

  it('accumulates multiple adds at the same position', () => {
    const ft = new FenwickTree(3);
    ft.add(2, 10);
    ft.add(2, 5);
    assert.equal(ft.get(2), 15);
  });

  it('throws on 0-based or out-of-bounds index', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.add(0, 1), RangeError);  // 0 is out of 1-based range
    assert.throws(() => ft.add(4, 1), RangeError);  // > size
    assert.throws(() => ft.add(-1, 1), RangeError);
  });
});

// ─── prefixSum ───────────────────────────────────────────────────────────────

describe('FenwickTree.prefixSum', () => {
  it('returns correct prefix sums after adds', () => {
    const ft = buildFenwickTree([1, 2, 3, 4, 5]);
    assert.equal(ft.prefixSum(1), 1);
    assert.equal(ft.prefixSum(2), 3);
    assert.equal(ft.prefixSum(3), 6);
    assert.equal(ft.prefixSum(4), 10);
    assert.equal(ft.prefixSum(5), 15);
  });

  it('reflects updates after add', () => {
    const ft = new FenwickTree(3);
    ft.add(1, 10);
    ft.add(2, 20);
    ft.add(3, 30);
    assert.equal(ft.prefixSum(1), 10);
    assert.equal(ft.prefixSum(2), 30);
    assert.equal(ft.prefixSum(3), 60);
  });

  it('throws on out-of-bounds index', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.prefixSum(0), RangeError);
    assert.throws(() => ft.prefixSum(4), RangeError);
  });
});

// ─── rangeSum ────────────────────────────────────────────────────────────────

describe('FenwickTree.rangeSum', () => {
  it('computes range sums correctly (1-based)', () => {
    const ft = buildFenwickTree([1, 2, 3, 4, 5]);
    assert.equal(ft.rangeSum(1, 5), 15);
    assert.equal(ft.rangeSum(2, 4), 9);  // 2+3+4
    assert.equal(ft.rangeSum(3, 3), 3);
    assert.equal(ft.rangeSum(1, 1), 1);
  });

  it('single-element range equals get()', () => {
    const ft = buildFenwickTree([10, 20, 30]);
    assert.equal(ft.rangeSum(2, 2), ft.get(2));
  });

  it('throws when l > r', () => {
    const ft = buildFenwickTree([1, 2, 3]);
    assert.throws(() => ft.rangeSum(3, 2), RangeError);
  });

  it('throws on out-of-bounds', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.rangeSum(0, 3), RangeError);
    assert.throws(() => ft.rangeSum(1, 4), RangeError);
  });
});

// ─── get ─────────────────────────────────────────────────────────────────────

describe('FenwickTree.get', () => {
  it('returns the value at a 1-based position', () => {
    const ft = buildFenwickTree([7, 14, 21]);
    assert.equal(ft.get(1), 7);
    assert.equal(ft.get(2), 14);
    assert.equal(ft.get(3), 21);
  });

  it('reflects updates', () => {
    const ft = new FenwickTree(3);
    assert.equal(ft.get(2), 0);
    ft.add(2, 42);
    assert.equal(ft.get(2), 42);
  });

  it('throws on out-of-bounds', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.get(0), RangeError);
    assert.throws(() => ft.get(4), RangeError);
  });
});

// ─── set ─────────────────────────────────────────────────────────────────────

describe('FenwickTree.set', () => {
  it('sets absolute value at a 1-based position', () => {
    const ft = buildFenwickTree([1, 2, 3]);
    ft.set(2, 10);
    assert.equal(ft.get(2), 10);
    assert.equal(ft.prefixSum(3), 14); // 1 + 10 + 3
  });

  it('set same value is a no-op', () => {
    const ft = buildFenwickTree([5, 6, 7]);
    ft.set(1, 5);
    assert.equal(ft.get(1), 5);
    assert.equal(ft.prefixSum(3), 18);
  });

  it('set then add accumulate correctly', () => {
    const ft = new FenwickTree(3);
    ft.set(2, 100);
    ft.add(2, 50);
    assert.equal(ft.get(2), 150);
  });

  it('throws on out-of-bounds', () => {
    const ft = new FenwickTree(3);
    assert.throws(() => ft.set(0, 1), RangeError);
    assert.throws(() => ft.set(4, 1), RangeError);
  });
});

// ─── buildFenwickTree ────────────────────────────────────────────────────────

describe('buildFenwickTree', () => {
  it('builds from array and prefix sums match', () => {
    const ft = buildFenwickTree([10, 20, 30]);
    assert.equal(ft.size, 3);
    assert.equal(ft.prefixSum(1), 10);
    assert.equal(ft.prefixSum(2), 30);
    assert.equal(ft.prefixSum(3), 60);
  });

  it('builds from empty array', () => {
    const ft = buildFenwickTree([]);
    assert.equal(ft.size, 0);
  });

  it('supports subsequent mutations', () => {
    const ft = buildFenwickTree([1, 2, 3, 4, 5]);
    ft.add(3, 10);
    assert.equal(ft.get(3), 13);
    assert.equal(ft.prefixSum(5), 25);
  });

  it('stress: 1000 elements', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i + 1);
    const ft = buildFenwickTree(data);
    // Sum 1..1000 = 500500
    assert.equal(ft.prefixSum(1000), 500500);
    // rangeSum [101..200] = sum 101+102+...+200
    const expected = Array.from({ length: 100 }, (_, i) => i + 101).reduce((a, b) => a + b, 0);
    assert.equal(ft.rangeSum(101, 200), expected);
  });
});

// ─── FenwickTree2D ───────────────────────────────────────────────────────────

describe('FenwickTree2D', () => {
  it('initialises to all zeros', () => {
    const ft = new FenwickTree2D(3, 3);
    assert.equal(ft.prefixSum(3, 3), 0);
  });

  it('add and prefixSum over a single cell', () => {
    const ft = new FenwickTree2D(4, 4);
    ft.add(2, 3, 7);
    assert.equal(ft.prefixSum(2, 3), 7);
    assert.equal(ft.prefixSum(1, 3), 0);
    assert.equal(ft.prefixSum(2, 2), 0);
  });

  it('prefixSum accumulates all cells in rectangle', () => {
    const ft = new FenwickTree2D(3, 3);
    ft.add(1, 1, 1);
    ft.add(1, 2, 2);
    ft.add(2, 1, 3);
    ft.add(2, 2, 4);
    // prefixSum(2,2) should sum 1+2+3+4 = 10
    assert.equal(ft.prefixSum(2, 2), 10);
    // prefixSum(1,2) = 1+2 = 3
    assert.equal(ft.prefixSum(1, 2), 3);
    // prefixSum(2,1) = 1+3 = 4
    assert.equal(ft.prefixSum(2, 1), 4);
  });

  it('rangeSum returns sum over sub-rectangle', () => {
    const ft = new FenwickTree2D(4, 4);
    // Fill a 2x2 block at (2,2)..(3,3) with value 5 each
    ft.add(2, 2, 5);
    ft.add(2, 3, 5);
    ft.add(3, 2, 5);
    ft.add(3, 3, 5);
    assert.equal(ft.rangeSum(2, 2, 3, 3), 20);
    // Other cells should be 0
    assert.equal(ft.rangeSum(1, 1, 1, 1), 0);
    assert.equal(ft.rangeSum(1, 1, 4, 4), 20);
  });

  it('rangeSum with top-left corner at (1,1)', () => {
    const ft = new FenwickTree2D(3, 3);
    ft.add(1, 1, 10);
    ft.add(3, 3, 10);
    assert.equal(ft.rangeSum(1, 1, 1, 1), 10);
    assert.equal(ft.rangeSum(3, 3, 3, 3), 10);
    assert.equal(ft.rangeSum(1, 1, 3, 3), 20);
  });

  it('multiple adds to same cell accumulate', () => {
    const ft = new FenwickTree2D(2, 2);
    ft.add(1, 1, 3);
    ft.add(1, 1, 7);
    assert.equal(ft.prefixSum(1, 1), 10);
  });

  it('throws on out-of-bounds row or col', () => {
    const ft = new FenwickTree2D(3, 3);
    assert.throws(() => ft.add(0, 1, 1), RangeError);
    assert.throws(() => ft.add(4, 1, 1), RangeError);
    assert.throws(() => ft.add(1, 0, 1), RangeError);
    assert.throws(() => ft.add(1, 4, 1), RangeError);
    assert.throws(() => ft.prefixSum(0, 1), RangeError);
    assert.throws(() => ft.prefixSum(1, 0), RangeError);
  });

  it('throws on invalid rangeSum bounds', () => {
    const ft = new FenwickTree2D(3, 3);
    assert.throws(() => ft.rangeSum(2, 1, 1, 3), RangeError); // r1 > r2
    assert.throws(() => ft.rangeSum(1, 2, 3, 1), RangeError); // c1 > c2
  });
});
