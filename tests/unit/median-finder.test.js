// ─── Unit Tests: median-finder ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MedianFinder,
  findMedian,
  findKth,
  createMedianFinder,
} from '../../app/modules/median-finder.js';

// ─── findMedian() ───────────────────────────────────────────────────────────

describe('findMedian()', () => {
  it('returns null for an empty array', () => {
    assert.equal(findMedian([]), null);
  });

  it('returns the single element for a length-1 array', () => {
    assert.equal(findMedian([42]), 42);
  });

  it('returns the average of the two middle elements for even-length arrays', () => {
    assert.equal(findMedian([1, 3]), 2);
    assert.equal(findMedian([1, 2, 3, 4]), 2.5);
  });

  it('returns the middle element for odd-length arrays', () => {
    assert.equal(findMedian([3, 1, 2]), 2);
    assert.equal(findMedian([7, 1, 5, 3, 9]), 5);
  });

  it('does not mutate the input array', () => {
    const arr = [5, 3, 1, 4, 2];
    findMedian(arr);
    assert.deepEqual(arr, [5, 3, 1, 4, 2]);
  });

  it('handles negative numbers', () => {
    assert.equal(findMedian([-5, -1, -3]), -3);
  });
});

// ─── findKth() ──────────────────────────────────────────────────────────────

describe('findKth()', () => {
  it('finds the kth smallest element (1-based)', () => {
    assert.equal(findKth([3, 1, 2, 5, 4], 1), 1);
    assert.equal(findKth([3, 1, 2, 5, 4], 3), 3);
    assert.equal(findKth([3, 1, 2, 5, 4], 5), 5);
  });

  it('works for a single-element array', () => {
    assert.equal(findKth([99], 1), 99);
  });

  it('throws for empty array', () => {
    assert.throws(() => findKth([], 1), RangeError);
  });

  it('throws when k is out of bounds', () => {
    assert.throws(() => findKth([1, 2, 3], 0), RangeError);
    assert.throws(() => findKth([1, 2, 3], 4), RangeError);
  });

  it('does not mutate the input array', () => {
    const arr = [5, 3, 1, 4, 2];
    findKth(arr, 2);
    assert.deepEqual(arr, [5, 3, 1, 4, 2]);
  });

  it('handles duplicates correctly', () => {
    assert.equal(findKth([3, 3, 3, 1, 1], 3), 3);
    assert.equal(findKth([3, 3, 3, 1, 1], 1), 1);
  });
});

// ─── MedianFinder class ─────────────────────────────────────────────────────

describe('MedianFinder', () => {
  it('returns null median when empty', () => {
    const mf = new MedianFinder();
    assert.equal(mf.median, null);
    assert.equal(mf.size, 0);
    assert.equal(mf.min, null);
    assert.equal(mf.max, null);
  });

  it('tracks median for a single element', () => {
    const mf = new MedianFinder();
    mf.add(5);
    assert.equal(mf.median, 5);
    assert.equal(mf.size, 1);
  });

  it('tracks median for two elements', () => {
    const mf = new MedianFinder();
    mf.add(1);
    mf.add(3);
    assert.equal(mf.median, 2);
  });

  it('tracks median across many insertions', () => {
    const mf = new MedianFinder();
    mf.add(6);
    assert.equal(mf.median, 6);
    mf.add(10);
    assert.equal(mf.median, 8);
    mf.add(2);
    assert.equal(mf.median, 6);
    mf.add(6);
    assert.equal(mf.median, 6);
    mf.add(5);
    assert.equal(mf.median, 6);
  });

  it('tracks min and max correctly', () => {
    const mf = new MedianFinder();
    mf.add(5);
    mf.add(2);
    mf.add(8);
    mf.add(1);
    mf.add(9);
    assert.equal(mf.min, 1);
    assert.equal(mf.max, 9);
  });

  it('reports correct size', () => {
    const mf = new MedianFinder();
    assert.equal(mf.size, 0);
    mf.add(1);
    mf.add(2);
    mf.add(3);
    assert.equal(mf.size, 3);
  });

  it('resets state on clear()', () => {
    const mf = new MedianFinder();
    mf.add(1);
    mf.add(2);
    mf.add(3);
    mf.clear();
    assert.equal(mf.median, null);
    assert.equal(mf.size, 0);
    assert.equal(mf.min, null);
    assert.equal(mf.max, null);
  });

  it('works correctly after clear() and re-add', () => {
    const mf = new MedianFinder();
    mf.add(100);
    mf.clear();
    mf.add(7);
    assert.equal(mf.median, 7);
    assert.equal(mf.min, 7);
    assert.equal(mf.max, 7);
    assert.equal(mf.size, 1);
  });
});

// ─── createMedianFinder() ───────────────────────────────────────────────────

describe('createMedianFinder()', () => {
  it('returns a MedianFinder instance', () => {
    const mf = createMedianFinder();
    assert.ok(mf instanceof MedianFinder);
  });

  it('returned instance works correctly', () => {
    const mf = createMedianFinder();
    mf.add(4);
    mf.add(2);
    mf.add(7);
    assert.equal(mf.median, 4);
  });
});
