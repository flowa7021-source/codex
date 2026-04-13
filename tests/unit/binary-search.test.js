// ─── Unit Tests: binary-search ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  binarySearch,
  binarySearchLeft,
  binarySearchRight,
  lowerBound,
  upperBound,
  exponentialSearch,
  interpolationSearch,
  equalRange,
} from '../../app/modules/binary-search.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Numeric comparator for use in tests that need an explicit comparator. */
const numCmp = (a, b) => a - b;

/** Comparator that sorts objects by their `.v` property. */
const objCmp = (a, b) => a.v - b.v;

// ─── binarySearch ────────────────────────────────────────────────────────────

describe('binarySearch', () => {
  it('finds an element in the middle of the array', () => {
    assert.equal(binarySearch([1, 3, 5, 7, 9], 5), 2);
  });

  it('finds the first element', () => {
    assert.equal(binarySearch([1, 3, 5, 7, 9], 1), 0);
  });

  it('finds the last element', () => {
    assert.equal(binarySearch([1, 3, 5, 7, 9], 9), 4);
  });

  it('returns -1 for a missing element', () => {
    assert.equal(binarySearch([1, 3, 5, 7, 9], 4), -1);
  });

  it('returns -1 for an empty array', () => {
    assert.equal(binarySearch([], 1), -1);
  });

  it('finds the only element in a single-element array', () => {
    assert.equal(binarySearch([42], 42), 0);
  });

  it('returns -1 when target is smaller than all elements', () => {
    assert.equal(binarySearch([10, 20, 30], 5), -1);
  });

  it('returns -1 when target is larger than all elements', () => {
    assert.equal(binarySearch([10, 20, 30], 99), -1);
  });

  it('works with a custom comparator on objects', () => {
    const arr = [{ v: 1 }, { v: 3 }, { v: 5 }];
    const idx = binarySearch(arr, { v: 3 }, objCmp);
    assert.equal(idx, 1);
  });

  it('works with strings using default comparator', () => {
    assert.equal(binarySearch(['apple', 'banana', 'cherry'], 'banana'), 1);
  });

  it('returns a valid index when duplicates exist (any occurrence)', () => {
    const arr = [1, 2, 2, 2, 3];
    const idx = binarySearch(arr, 2);
    assert.ok(idx >= 1 && idx <= 3, `expected 1–3, got ${idx}`);
  });

  it('finds element in large array', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i * 2);
    assert.equal(binarySearch(arr, 500), 250);
  });
});

// ─── binarySearchLeft ────────────────────────────────────────────────────────

describe('binarySearchLeft', () => {
  it('returns the leftmost index when duplicates exist', () => {
    assert.equal(binarySearchLeft([1, 2, 2, 2, 3], 2), 1);
  });

  it('returns the only index when no duplicates', () => {
    assert.equal(binarySearchLeft([1, 3, 5, 7], 5), 2);
  });

  it('returns -1 for missing element', () => {
    assert.equal(binarySearchLeft([1, 3, 5], 4), -1);
  });

  it('returns -1 for empty array', () => {
    assert.equal(binarySearchLeft([], 1), -1);
  });

  it('finds the first element', () => {
    assert.equal(binarySearchLeft([2, 2, 2], 2), 0);
  });

  it('handles single element — found', () => {
    assert.equal(binarySearchLeft([7], 7), 0);
  });

  it('handles single element — not found', () => {
    assert.equal(binarySearchLeft([7], 8), -1);
  });

  it('returns -1 when all elements are the same and target differs', () => {
    assert.equal(binarySearchLeft([5, 5, 5, 5], 3), -1);
  });

  it('returns 0 when all elements equal the target', () => {
    assert.equal(binarySearchLeft([4, 4, 4, 4], 4), 0);
  });

  it('works with a custom comparator', () => {
    const arr = [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }];
    assert.equal(binarySearchLeft(arr, { v: 2 }, objCmp), 1);
  });
});

// ─── binarySearchRight ───────────────────────────────────────────────────────

describe('binarySearchRight', () => {
  it('returns index past the last occurrence when duplicates exist', () => {
    // [1, 2, 2, 2, 3] — last 2 is at index 3, so result is 4
    assert.equal(binarySearchRight([1, 2, 2, 2, 3], 2), 4);
  });

  it('returns index past the only occurrence when no duplicates', () => {
    assert.equal(binarySearchRight([1, 3, 5, 7], 5), 3);
  });

  it('returns -1 for missing element', () => {
    assert.equal(binarySearchRight([1, 3, 5], 4), -1);
  });

  it('returns -1 for empty array', () => {
    assert.equal(binarySearchRight([], 1), -1);
  });

  it('returns array length when all elements equal the target', () => {
    assert.equal(binarySearchRight([3, 3, 3], 3), 3);
  });

  it('handles single element — found', () => {
    assert.equal(binarySearchRight([7], 7), 1);
  });

  it('handles single element — not found', () => {
    assert.equal(binarySearchRight([7], 8), -1);
  });

  it('returns -1 when all elements are the same and target differs', () => {
    assert.equal(binarySearchRight([5, 5, 5, 5], 3), -1);
  });

  it('works with a custom comparator', () => {
    const arr = [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }];
    assert.equal(binarySearchRight(arr, { v: 2 }, objCmp), 3);
  });
});

// ─── lowerBound ──────────────────────────────────────────────────────────────

describe('lowerBound', () => {
  it('returns first index >= target', () => {
    assert.equal(lowerBound([1, 2, 4, 5], 3), 2);
  });

  it('returns the leftmost matching index when target exists', () => {
    assert.equal(lowerBound([1, 2, 2, 2, 3], 2), 1);
  });

  it('returns 0 when target is less than all elements', () => {
    assert.equal(lowerBound([10, 20, 30], 5), 0);
  });

  it('returns arr.length when target is greater than all elements', () => {
    assert.equal(lowerBound([10, 20, 30], 99), 3);
  });

  it('returns 0 for empty array', () => {
    assert.equal(lowerBound([], 1), 0);
  });

  it('returns 0 for a single-element array when target matches', () => {
    assert.equal(lowerBound([5], 5), 0);
  });

  it('returns 1 for a single-element array when target exceeds it', () => {
    assert.equal(lowerBound([5], 6), 1);
  });

  it('handles all-same array — returns 0', () => {
    assert.equal(lowerBound([7, 7, 7, 7], 7), 0);
  });

  it('works with a custom comparator', () => {
    const arr = [{ v: 1 }, { v: 3 }, { v: 5 }];
    assert.equal(lowerBound(arr, { v: 3 }, objCmp), 1);
  });

  it('returns correct index for target between elements', () => {
    assert.equal(lowerBound([1, 3, 5, 7, 9], 6), 3);
  });
});

// ─── upperBound ──────────────────────────────────────────────────────────────

describe('upperBound', () => {
  it('returns first index > target', () => {
    assert.equal(upperBound([1, 2, 4, 5], 3), 2);
  });

  it('returns index past the last matching element when target exists', () => {
    assert.equal(upperBound([1, 2, 2, 2, 3], 2), 4);
  });

  it('returns 0 when target is less than all elements', () => {
    assert.equal(upperBound([10, 20, 30], 5), 0);
  });

  it('returns arr.length when target is greater than all elements', () => {
    assert.equal(upperBound([10, 20, 30], 99), 3);
  });

  it('returns 0 for empty array', () => {
    assert.equal(upperBound([], 1), 0);
  });

  it('returns 1 for a single-element array when target matches', () => {
    assert.equal(upperBound([5], 5), 1);
  });

  it('returns 0 for a single-element array when target is less', () => {
    assert.equal(upperBound([5], 4), 0);
  });

  it('handles all-same array — returns length', () => {
    assert.equal(upperBound([7, 7, 7, 7], 7), 4);
  });

  it('works with a custom comparator', () => {
    const arr = [{ v: 1 }, { v: 3 }, { v: 3 }, { v: 5 }];
    assert.equal(upperBound(arr, { v: 3 }, objCmp), 3);
  });

  it('upper and lower bound give equal range for non-existent target', () => {
    const arr = [1, 3, 5, 7];
    const lo = lowerBound(arr, 4);
    const hi = upperBound(arr, 4);
    assert.equal(lo, hi); // empty range: target not present
  });
});

// ─── exponentialSearch ───────────────────────────────────────────────────────

describe('exponentialSearch', () => {
  it('finds element near the start', () => {
    assert.equal(exponentialSearch([1, 3, 5, 7, 9, 11, 13], 3), 1);
  });

  it('finds element near the end', () => {
    assert.equal(exponentialSearch([1, 3, 5, 7, 9, 11, 13], 13), 6);
  });

  it('finds the very first element', () => {
    assert.equal(exponentialSearch([1, 3, 5, 7, 9], 1), 0);
  });

  it('returns -1 for missing element', () => {
    assert.equal(exponentialSearch([1, 3, 5, 7, 9], 4), -1);
  });

  it('returns -1 for empty array', () => {
    assert.equal(exponentialSearch([], 1), -1);
  });

  it('finds element in single-element array', () => {
    assert.equal(exponentialSearch([42], 42), 0);
  });

  it('returns -1 in single-element array when not found', () => {
    assert.equal(exponentialSearch([42], 99), -1);
  });

  it('works on a large array', () => {
    const arr = Array.from({ length: 10000 }, (_, i) => i);
    assert.equal(exponentialSearch(arr, 9999), 9999);
    assert.equal(exponentialSearch(arr, 1), 1);
  });

  it('works with a custom comparator', () => {
    const arr = [{ v: 2 }, { v: 4 }, { v: 6 }, { v: 8 }];
    const idx = exponentialSearch(arr, { v: 6 }, objCmp);
    assert.equal(idx, 2);
  });

  it('returns -1 when target is larger than all elements', () => {
    assert.equal(exponentialSearch([1, 2, 3], 100), -1);
  });
});

// ─── interpolationSearch ─────────────────────────────────────────────────────

describe('interpolationSearch', () => {
  it('finds element in uniformly distributed array', () => {
    const arr = [10, 20, 30, 40, 50];
    assert.equal(interpolationSearch(arr, 30), 2);
  });

  it('finds the first element', () => {
    assert.equal(interpolationSearch([10, 20, 30, 40, 50], 10), 0);
  });

  it('finds the last element', () => {
    assert.equal(interpolationSearch([10, 20, 30, 40, 50], 50), 4);
  });

  it('returns -1 for missing element', () => {
    assert.equal(interpolationSearch([10, 20, 30, 40, 50], 25), -1);
  });

  it('returns -1 for empty array', () => {
    assert.equal(interpolationSearch([], 1), -1);
  });

  it('returns -1 when target is out of range', () => {
    assert.equal(interpolationSearch([1, 2, 3], 99), -1);
    assert.equal(interpolationSearch([1, 2, 3], 0), -1);
  });

  it('finds element in single-element array', () => {
    assert.equal(interpolationSearch([7], 7), 0);
  });

  it('handles all-same elements — target present', () => {
    assert.equal(interpolationSearch([5, 5, 5, 5], 5), 0);
  });

  it('handles all-same elements — target absent', () => {
    assert.equal(interpolationSearch([5, 5, 5, 5], 3), -1);
  });

  it('works on a large uniformly distributed array', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i * 3);
    assert.equal(interpolationSearch(arr, 600), 200);
  });
});

// ─── equalRange ──────────────────────────────────────────────────────────────

describe('equalRange', () => {
  it('returns [lower, upper) bounds for an element with duplicates', () => {
    assert.deepEqual(equalRange([1, 2, 2, 2, 3], 2), [1, 4]);
  });

  it('returns a single-element range for a unique element', () => {
    assert.deepEqual(equalRange([1, 3, 5, 7], 5), [2, 3]);
  });

  it('returns equal bounds (empty range) for missing element', () => {
    const [lo, hi] = equalRange([1, 3, 5], 4);
    assert.equal(lo, hi); // empty range
    assert.equal(lo, 2);  // insertion point
  });

  it('returns [0, 0] for empty array', () => {
    assert.deepEqual(equalRange([], 1), [0, 0]);
  });

  it('returns [0, arr.length] when all elements equal the target', () => {
    assert.deepEqual(equalRange([4, 4, 4, 4], 4), [0, 4]);
  });

  it('returns [0, 0] when target is below all elements', () => {
    assert.deepEqual(equalRange([5, 10, 15], 3), [0, 0]);
  });

  it('returns [length, length] when target is above all elements', () => {
    assert.deepEqual(equalRange([5, 10, 15], 99), [3, 3]);
  });

  it('range size equals number of equal elements', () => {
    const arr = [1, 2, 2, 2, 2, 3];
    const [lo, hi] = equalRange(arr, 2);
    assert.equal(hi - lo, 4);
  });

  it('works with a custom comparator on objects', () => {
    const arr = [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }];
    assert.deepEqual(equalRange(arr, { v: 2 }, objCmp), [1, 3]);
  });

  it('works with strings', () => {
    assert.deepEqual(equalRange(['a', 'b', 'b', 'c'], 'b'), [1, 3]);
  });
});
