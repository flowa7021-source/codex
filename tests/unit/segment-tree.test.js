// ─── Unit Tests: SegmentTree ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SegmentTree,
  sumSegmentTree,
  minSegmentTree,
  maxSegmentTree,
} from '../../app/modules/segment-tree.js';

// ─── sumSegmentTree ──────────────────────────────────────────────────────────

describe('sumSegmentTree', () => {
  it('query full range returns total sum', () => {
    const st = sumSegmentTree([1, 3, 5, 7, 9, 11]);
    assert.equal(st.query(0, 5), 36);
  });

  it('query single element returns that element', () => {
    const st = sumSegmentTree([1, 3, 5, 7, 9, 11]);
    assert.equal(st.query(2, 2), 5);
  });

  it('query partial range is correct', () => {
    const st = sumSegmentTree([1, 3, 5, 7, 9, 11]);
    // indices 1..3 → 3 + 5 + 7 = 15
    assert.equal(st.query(1, 3), 15);
  });

  it('point update reflects in subsequent queries', () => {
    const st = sumSegmentTree([1, 3, 5, 7, 9, 11]);
    st.update(2, 10); // replace 5 with 10
    assert.equal(st.query(0, 5), 41); // 36 - 5 + 10
    assert.equal(st.query(2, 2), 10);
  });

  it('length getter returns element count', () => {
    const st = sumSegmentTree([4, 8, 15, 16, 23, 42]);
    assert.equal(st.length, 6);
  });
});

// ─── minSegmentTree ──────────────────────────────────────────────────────────

describe('minSegmentTree', () => {
  it('full range query returns minimum', () => {
    const st = minSegmentTree([5, 2, 8, 1, 9, 3]);
    assert.equal(st.query(0, 5), 1);
  });

  it('partial range query returns correct min', () => {
    const st = minSegmentTree([5, 2, 8, 1, 9, 3]);
    assert.equal(st.query(0, 2), 2); // min(5, 2, 8)
    assert.equal(st.query(4, 5), 3); // min(9, 3)
  });

  it('update can change the minimum', () => {
    const st = minSegmentTree([5, 2, 8, 1, 9, 3]);
    st.update(3, 100); // replace 1 with 100
    assert.equal(st.query(0, 5), 2); // new min is 2
  });
});

// ─── maxSegmentTree ──────────────────────────────────────────────────────────

describe('maxSegmentTree', () => {
  it('full range query returns maximum', () => {
    const st = maxSegmentTree([3, 1, 4, 1, 5, 9, 2, 6]);
    assert.equal(st.query(0, 7), 9);
  });

  it('partial range query returns correct max', () => {
    const st = maxSegmentTree([3, 1, 4, 1, 5, 9, 2, 6]);
    assert.equal(st.query(0, 2), 4); // max(3, 1, 4)
    assert.equal(st.query(5, 7), 9); // max(9, 2, 6)
  });

  it('works for a single-element array', () => {
    const st = maxSegmentTree([42]);
    assert.equal(st.length, 1);
    assert.equal(st.query(0, 0), 42);
  });
});

// ─── SegmentTree – generic constructor ───────────────────────────────────────

describe('SegmentTree (generic constructor)', () => {
  it('supports non-numeric merge (string concat)', () => {
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

  it('identity element is returned for empty sub-ranges (via merge)', () => {
    const st = new SegmentTree([10, 20, 30], (a, b) => a + b, 0);
    assert.equal(st.query(1, 1), 20);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('SegmentTree (edge cases)', () => {
  it('single element – query and update', () => {
    const st = sumSegmentTree([99]);
    assert.equal(st.query(0, 0), 99);
    st.update(0, 1);
    assert.equal(st.query(0, 0), 1);
  });

  it('throws on out-of-bounds query', () => {
    const st = sumSegmentTree([1, 2, 3]);
    assert.throws(() => st.query(-1, 2), RangeError);
    assert.throws(() => st.query(0, 3), RangeError);
    assert.throws(() => st.query(2, 1), RangeError);
  });

  it('throws on out-of-bounds update', () => {
    const st = sumSegmentTree([1, 2, 3]);
    assert.throws(() => st.update(-1, 0), RangeError);
    assert.throws(() => st.update(3, 0), RangeError);
  });

  it('throws on any query against an empty tree', () => {
    const st = sumSegmentTree([]);
    assert.throws(() => st.query(0, 0), RangeError);
  });

  it('length is 0 for empty tree', () => {
    const st = sumSegmentTree([]);
    assert.equal(st.length, 0);
  });
});

// ─── rangeUpdate ─────────────────────────────────────────────────────────────

describe('SegmentTree.rangeUpdate', () => {
  const add = (existing, update) => existing + update;

  it('adds a constant to full range', () => {
    const st = sumSegmentTree([1, 2, 3, 4, 5]);
    // Add 10 to all elements: new sum = 15 + 50 = 65
    st.rangeUpdate(0, 4, 10, add);
    assert.equal(st.query(0, 4), 65);
  });

  it('adds a constant to a sub-range', () => {
    const st = sumSegmentTree([1, 2, 3, 4, 5]);
    // Add 10 to indices 1..3: sum[0..4] = 1 + 12 + 13 + 14 + 5 = 45
    st.rangeUpdate(1, 3, 10, add);
    assert.equal(st.query(0, 4), 45);
    assert.equal(st.query(1, 3), 39); // (2+10)+(3+10)+(4+10)
    assert.equal(st.query(0, 0), 1);  // untouched
    assert.equal(st.query(4, 4), 5);  // untouched
  });

  it('single-element range update', () => {
    const st = sumSegmentTree([10, 20, 30]);
    st.rangeUpdate(1, 1, 5, add);
    assert.equal(st.query(1, 1), 25);
    assert.equal(st.query(0, 2), 65);
  });

  it('multiple overlapping range updates accumulate correctly', () => {
    const st = sumSegmentTree([0, 0, 0, 0, 0]);
    st.rangeUpdate(0, 4, 1, add); // [1,1,1,1,1]
    st.rangeUpdate(1, 3, 2, add); // [1,3,3,3,1]
    st.rangeUpdate(2, 2, 4, add); // [1,3,7,3,1]
    assert.equal(st.query(0, 4), 15);
    assert.equal(st.query(2, 2), 7);
    assert.equal(st.query(0, 0), 1);
    assert.equal(st.query(4, 4), 1);
  });

  it('rangeUpdate then point update interact correctly', () => {
    const st = sumSegmentTree([1, 2, 3, 4, 5]);
    st.rangeUpdate(0, 4, 10, add); // [11,12,13,14,15]
    st.update(2, 100);              // [11,12,100,14,15]
    assert.equal(st.query(0, 4), 152);
    assert.equal(st.query(2, 2), 100);
  });

  it('works with min operation', () => {
    const clamp = (existing, cap) => Math.min(existing, cap);
    const st = maxSegmentTree([10, 20, 30, 40, 50]);
    // Clamp all values above 25 to 25
    st.rangeUpdate(0, 4, 25, clamp);
    assert.equal(st.query(0, 4), 25); // max is now 25
    assert.equal(st.query(0, 2), 25); // max(10,20,25)
  });

  it('throws on out-of-bounds rangeUpdate', () => {
    const st = sumSegmentTree([1, 2, 3]);
    assert.throws(() => st.rangeUpdate(-1, 2, 1, add), RangeError);
    assert.throws(() => st.rangeUpdate(0, 3, 1, add), RangeError);
    assert.throws(() => st.rangeUpdate(2, 1, 1, add), RangeError);
  });
});
