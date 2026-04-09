// ─── Unit Tests: segment-tree ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SegmentTree,
  createSegmentTree,
} from '../../app/modules/segment-tree.js';

// ─── Sum segment tree ───────────────────────────────────────────────────────

describe('SegmentTree (sum)', () => {
  const data = [1, 3, 5, 7, 9, 11];
  const sum = (a, b) => a + b;

  it('reports correct size', () => {
    const st = new SegmentTree(data, sum, 0);
    assert.equal(st.size, 6);
  });

  it('full range query returns total sum', () => {
    const st = new SegmentTree(data, sum, 0);
    assert.equal(st.query(0, 5), 36);
  });

  it('single element query returns that element', () => {
    const st = new SegmentTree(data, sum, 0);
    assert.equal(st.query(2, 2), 5);
  });

  it('partial range query is correct', () => {
    const st = new SegmentTree(data, sum, 0);
    // indices 1..3 → 3 + 5 + 7 = 15
    assert.equal(st.query(1, 3), 15);
  });

  it('point update changes subsequent queries', () => {
    const st = new SegmentTree(data, sum, 0);
    st.update(2, 10); // change 5 → 10
    assert.equal(st.query(0, 5), 41); // 36 - 5 + 10
    assert.equal(st.query(2, 2), 10);
  });

  it('throws on out-of-bounds query', () => {
    const st = new SegmentTree(data, sum, 0);
    assert.throws(() => st.query(-1, 2), RangeError);
    assert.throws(() => st.query(0, 6), RangeError);
    assert.throws(() => st.query(4, 2), RangeError);
  });

  it('throws on out-of-bounds update', () => {
    const st = new SegmentTree(data, sum, 0);
    assert.throws(() => st.update(-1, 0), RangeError);
    assert.throws(() => st.update(6, 0), RangeError);
  });
});

// ─── Min segment tree ───────────────────────────────────────────────────────

describe('SegmentTree (min)', () => {
  const data = [5, 2, 8, 1, 9, 3];
  const min = (a, b) => Math.min(a, b);

  it('full range query returns minimum', () => {
    const st = new SegmentTree(data, min, Infinity);
    assert.equal(st.query(0, 5), 1);
  });

  it('partial range query returns correct min', () => {
    const st = new SegmentTree(data, min, Infinity);
    assert.equal(st.query(0, 2), 2); // min(5,2,8)
    assert.equal(st.query(4, 5), 3); // min(9,3)
  });

  it('update can change the minimum', () => {
    const st = new SegmentTree(data, min, Infinity);
    st.update(3, 100); // replace 1 with 100
    assert.equal(st.query(0, 5), 2); // new min is 2
  });
});

// ─── Max segment tree ───────────────────────────────────────────────────────

describe('SegmentTree (max)', () => {
  it('works for a single-element array', () => {
    const st = new SegmentTree([42], Math.max, -Infinity);
    assert.equal(st.size, 1);
    assert.equal(st.query(0, 0), 42);
  });
});

// ─── Empty data ─────────────────────────────────────────────────────────────

describe('SegmentTree (empty)', () => {
  it('has size 0', () => {
    const st = new SegmentTree([], (a, b) => a + b, 0);
    assert.equal(st.size, 0);
  });

  it('throws on any query', () => {
    const st = new SegmentTree([], (a, b) => a + b, 0);
    assert.throws(() => st.query(0, 0), RangeError);
  });
});

// ─── Factory function ───────────────────────────────────────────────────────

describe('createSegmentTree', () => {
  it('returns a working SegmentTree instance', () => {
    const st = createSegmentTree([10, 20, 30], (a, b) => a + b, 0);
    assert.ok(st instanceof SegmentTree);
    assert.equal(st.query(0, 2), 60);
  });
});

// ─── String concatenation ───────────────────────────────────────────────────

describe('SegmentTree (string concat)', () => {
  it('supports non-numeric combine operations', () => {
    const st = new SegmentTree(
      ['a', 'b', 'c', 'd'],
      (a, b) => a + b,
      '',
    );
    assert.equal(st.query(0, 3), 'abcd');
    assert.equal(st.query(1, 2), 'bc');
    st.update(1, 'X');
    assert.equal(st.query(0, 3), 'aXcd');
  });
});
