// ─── Unit Tests: sparse-array ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SparseArray, createSparseArray } from '../../app/modules/sparse-array.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('SparseArray constructor', () => {
  it('creates an empty sparse array', () => {
    const sa = new SparseArray();
    assert.equal(sa.size, 0);
  });
});

// ─── set / get / has ──────────────────────────────────────────────────────────

describe('set, get, has', () => {
  it('stores and retrieves a value', () => {
    const sa = new SparseArray();
    sa.set(5, 'hello');
    assert.equal(sa.get(5), 'hello');
    assert.equal(sa.has(5), true);
  });

  it('returns undefined for unset indices', () => {
    const sa = new SparseArray();
    assert.equal(sa.get(0), undefined);
    assert.equal(sa.has(0), false);
  });

  it('overwrites existing values', () => {
    const sa = new SparseArray();
    sa.set(3, 'a');
    sa.set(3, 'b');
    assert.equal(sa.get(3), 'b');
    assert.equal(sa.size, 1);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('removes an existing element and returns true', () => {
    const sa = new SparseArray();
    sa.set(10, 'x');
    assert.equal(sa.delete(10), true);
    assert.equal(sa.has(10), false);
    assert.equal(sa.size, 0);
  });

  it('returns false for a non-existent element', () => {
    const sa = new SparseArray();
    assert.equal(sa.delete(99), false);
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('size', () => {
  it('tracks the number of set elements', () => {
    const sa = new SparseArray();
    sa.set(0, 'a');
    sa.set(100, 'b');
    sa.set(1000, 'c');
    assert.equal(sa.size, 3);
  });
});

// ─── density ──────────────────────────────────────────────────────────────────

describe('density', () => {
  it('returns 0 for an empty array', () => {
    const sa = new SparseArray();
    assert.equal(sa.density, 0);
  });

  it('returns 1 for a fully dense array', () => {
    const sa = new SparseArray();
    sa.set(0, 'a');
    sa.set(1, 'b');
    sa.set(2, 'c');
    assert.equal(sa.density, 1);
  });

  it('calculates partial density correctly', () => {
    const sa = new SparseArray();
    sa.set(0, 'a');
    sa.set(9, 'b');
    // 2 elements, maxIndex = 9, density = 2/10 = 0.2
    assert.equal(sa.density, 0.2);
  });
});

// ─── indices / values / entries ───────────────────────────────────────────────

describe('indices, values, entries', () => {
  it('returns sorted indices', () => {
    const sa = new SparseArray();
    sa.set(50, 'c');
    sa.set(10, 'a');
    sa.set(30, 'b');
    assert.deepEqual(sa.indices(), [10, 30, 50]);
  });

  it('returns values in index order', () => {
    const sa = new SparseArray();
    sa.set(50, 'c');
    sa.set(10, 'a');
    sa.set(30, 'b');
    assert.deepEqual(sa.values(), ['a', 'b', 'c']);
  });

  it('returns entries in index order', () => {
    const sa = new SparseArray();
    sa.set(2, 'x');
    sa.set(0, 'y');
    assert.deepEqual(sa.entries(), [[0, 'y'], [2, 'x']]);
  });
});

// ─── forEach ──────────────────────────────────────────────────────────────────

describe('forEach', () => {
  it('iterates over entries in index order', () => {
    const sa = new SparseArray();
    sa.set(5, 'a');
    sa.set(1, 'b');
    sa.set(3, 'c');
    const collected = [];
    sa.forEach((value, index) => collected.push([index, value]));
    assert.deepEqual(collected, [[1, 'b'], [3, 'c'], [5, 'a']]);
  });
});

// ─── map ──────────────────────────────────────────────────────────────────────

describe('map', () => {
  it('creates a new SparseArray with transformed values', () => {
    const sa = new SparseArray();
    sa.set(0, 1);
    sa.set(5, 2);
    sa.set(10, 3);
    const doubled = sa.map((v) => v * 2);
    assert.deepEqual(doubled.entries(), [[0, 2], [5, 4], [10, 6]]);
  });

  it('passes index to the mapping function', () => {
    const sa = new SparseArray();
    sa.set(3, 'val');
    const mapped = sa.map((v, i) => `${v}-${i}`);
    assert.equal(mapped.get(3), 'val-3');
  });
});

// ─── filter ───────────────────────────────────────────────────────────────────

describe('filter', () => {
  it('creates a new SparseArray with matching entries', () => {
    const sa = new SparseArray();
    sa.set(0, 1);
    sa.set(1, 2);
    sa.set(2, 3);
    sa.set(3, 4);
    const evens = sa.filter((v) => v % 2 === 0);
    assert.deepEqual(evens.entries(), [[1, 2], [3, 4]]);
    assert.equal(evens.size, 2);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('removes all entries', () => {
    const sa = new SparseArray();
    sa.set(0, 'a');
    sa.set(1, 'b');
    sa.clear();
    assert.equal(sa.size, 0);
    assert.equal(sa.has(0), false);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('toArray', () => {
  it('returns empty array when empty', () => {
    const sa = new SparseArray();
    assert.deepEqual(sa.toArray(), []);
  });

  it('returns dense array with gaps as undefined', () => {
    const sa = new SparseArray();
    sa.set(0, 'a');
    sa.set(3, 'b');
    assert.deepEqual(sa.toArray(), ['a', undefined, undefined, 'b']);
  });
});

// ─── createSparseArray factory ────────────────────────────────────────────────

describe('createSparseArray', () => {
  it('returns a new SparseArray instance', () => {
    const sa = createSparseArray();
    assert.ok(sa instanceof SparseArray);
    assert.equal(sa.size, 0);
  });
});
