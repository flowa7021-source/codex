// ─── Unit Tests: sparse-table ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SparseTable,
  createMinSparseTable,
  createMaxSparseTable,
  createGcdSparseTable,
} from '../../app/modules/sparse-table.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('SparseTable constructor', () => {
  it('throws on empty data', () => {
    assert.throws(() => new SparseTable([], Math.min), RangeError);
  });

  it('works with a single element', () => {
    const st = new SparseTable([42], Math.min);
    assert.equal(st.size, 1);
    assert.equal(st.query(0, 0), 42);
  });

  it('reports correct size', () => {
    const st = new SparseTable([1, 2, 3, 4, 5], Math.min);
    assert.equal(st.size, 5);
  });
});

// ─── min queries ─────────────────────────────────────────────────────────────

describe('createMinSparseTable', () => {
  it('finds minimum across the full range', () => {
    const st = createMinSparseTable([3, 1, 4, 1, 5, 9, 2, 6]);
    assert.equal(st.query(0, 7), 1);
  });

  it('finds minimum in sub-ranges', () => {
    const st = createMinSparseTable([5, 3, 8, 1, 7, 2, 4]);
    assert.equal(st.query(0, 1), 3);
    assert.equal(st.query(2, 4), 1);
    assert.equal(st.query(4, 6), 2);
    assert.equal(st.query(3, 3), 1);
  });

  it('handles all-equal elements', () => {
    const st = createMinSparseTable([7, 7, 7, 7]);
    assert.equal(st.query(0, 3), 7);
    assert.equal(st.query(1, 2), 7);
  });

  it('handles negative numbers', () => {
    const st = createMinSparseTable([5, -3, 8, -10, 2]);
    assert.equal(st.query(0, 4), -10);
    assert.equal(st.query(0, 1), -3);
    assert.equal(st.query(2, 4), -10);
  });
});

// ─── max queries ─────────────────────────────────────────────────────────────

describe('createMaxSparseTable', () => {
  it('finds maximum across the full range', () => {
    const st = createMaxSparseTable([3, 1, 4, 1, 5, 9, 2, 6]);
    assert.equal(st.query(0, 7), 9);
  });

  it('finds maximum in sub-ranges', () => {
    const st = createMaxSparseTable([5, 3, 8, 1, 7, 2, 4]);
    assert.equal(st.query(0, 1), 5);
    assert.equal(st.query(2, 4), 8);
    assert.equal(st.query(4, 6), 7);
  });

  it('works with single element query', () => {
    const st = createMaxSparseTable([10, 20, 30]);
    assert.equal(st.query(1, 1), 20);
  });
});

// ─── gcd queries ─────────────────────────────────────────────────────────────

describe('createGcdSparseTable', () => {
  it('computes gcd across full range', () => {
    const st = createGcdSparseTable([12, 18, 24]);
    assert.equal(st.query(0, 2), 6);
  });

  it('computes gcd in sub-ranges', () => {
    const st = createGcdSparseTable([6, 10, 15, 35]);
    assert.equal(st.query(0, 1), 2); // gcd(6,10)
    assert.equal(st.query(1, 2), 5); // gcd(10,15)
    assert.equal(st.query(2, 3), 5); // gcd(15,35)
    assert.equal(st.query(0, 3), 1); // gcd(6,10,15,35)
  });

  it('handles single element', () => {
    const st = createGcdSparseTable([42]);
    assert.equal(st.query(0, 0), 42);
  });

  it('handles powers of two', () => {
    const st = createGcdSparseTable([8, 16, 32, 64]);
    assert.equal(st.query(0, 3), 8);
    assert.equal(st.query(1, 3), 16);
  });
});

// ─── boundary / error handling ───────────────────────────────────────────────

describe('SparseTable boundary checks', () => {
  it('throws when left > right', () => {
    const st = createMinSparseTable([1, 2, 3]);
    assert.throws(() => st.query(2, 1), RangeError);
  });

  it('throws on negative index', () => {
    const st = createMinSparseTable([1, 2, 3]);
    assert.throws(() => st.query(-1, 1), RangeError);
  });

  it('throws when right exceeds bounds', () => {
    const st = createMinSparseTable([1, 2, 3]);
    assert.throws(() => st.query(0, 3), RangeError);
  });
});

// ─── custom combine ──────────────────────────────────────────────────────────

describe('SparseTable with custom combine', () => {
  it('supports bitwise AND', () => {
    const st = new SparseTable([0b1111, 0b1010, 0b1100, 0b1001], (a, b) => a & b);
    assert.equal(st.query(0, 3), 0b1000);
    assert.equal(st.query(0, 1), 0b1010);
    assert.equal(st.query(1, 2), 0b1000);
  });
});

// ─── stress / larger input ───────────────────────────────────────────────────

describe('SparseTable stress', () => {
  it('handles 1000 elements correctly for min', () => {
    const data = Array.from({ length: 1000 }, (_, i) => 1000 - i); // [1000, 999, ..., 1]
    const st = createMinSparseTable(data);
    assert.equal(st.query(0, 999), 1);
    assert.equal(st.query(0, 0), 1000);
    assert.equal(st.query(500, 999), 1);
    assert.equal(st.query(0, 499), 501);
  });

  it('handles power-of-two sized arrays', () => {
    const data = [4, 2, 7, 1, 3, 8, 5, 6]; // 8 elements
    const st = createMinSparseTable(data);
    assert.equal(st.query(0, 7), 1);
    assert.equal(st.query(4, 7), 3);
  });
});
