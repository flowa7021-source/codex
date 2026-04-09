// ─── Unit Tests: sorted-array ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SortedArray,
  createSortedArray,
} from '../../app/modules/sorted-array.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Numeric comparator for clarity in tests. */
const numCmp = (a, b) => a - b;

/** Comparator that sorts objects by their `.name` property lexicographically. */
const nameCmp = (a, b) => a.name.localeCompare(b.name);

// ─── constructor ─────────────────────────────────────────────────────────────

describe('SortedArray – constructor', () => {
  it('creates an empty sorted array with no arguments', () => {
    const sa = new SortedArray();
    assert.equal(sa.size, 0);
    assert.deepEqual(sa.toArray(), []);
  });

  it('accepts initial items and sorts them', () => {
    const sa = new SortedArray(numCmp, [5, 1, 3, 2, 4]);
    assert.deepEqual(sa.toArray(), [1, 2, 3, 4, 5]);
  });

  it('does not mutate the original items array', () => {
    const items = [3, 1, 2];
    new SortedArray(numCmp, items);
    assert.deepEqual(items, [3, 1, 2]);
  });

  it('handles initial items with duplicates', () => {
    const sa = new SortedArray(numCmp, [3, 1, 2, 1, 3]);
    assert.deepEqual(sa.toArray(), [1, 1, 2, 3, 3]);
  });

  it('handles empty initial items array', () => {
    const sa = new SortedArray(numCmp, []);
    assert.equal(sa.size, 0);
  });

  it('uses default comparator for strings', () => {
    const sa = new SortedArray(undefined, ['banana', 'apple', 'cherry']);
    assert.deepEqual(sa.toArray(), ['apple', 'banana', 'cherry']);
  });

  it('supports custom comparator (reverse order)', () => {
    const sa = new SortedArray((a, b) => b - a, [1, 3, 2]);
    assert.deepEqual(sa.toArray(), [3, 2, 1]);
  });

  it('handles single initial item', () => {
    const sa = new SortedArray(numCmp, [42]);
    assert.deepEqual(sa.toArray(), [42]);
  });
});

// ─── insert ──────────────────────────────────────────────────────────────────

describe('SortedArray – insert', () => {
  it('inserts into an empty array', () => {
    const sa = new SortedArray(numCmp);
    const idx = sa.insert(10);
    assert.equal(idx, 0);
    assert.deepEqual(sa.toArray(), [10]);
  });

  it('maintains sorted order on successive inserts', () => {
    const sa = new SortedArray(numCmp);
    sa.insert(5);
    sa.insert(2);
    sa.insert(8);
    sa.insert(1);
    assert.deepEqual(sa.toArray(), [1, 2, 5, 8]);
  });

  it('returns the correct insertion index', () => {
    const sa = new SortedArray(numCmp, [1, 3, 5]);
    const idx = sa.insert(4);
    assert.equal(idx, 2);
    assert.deepEqual(sa.toArray(), [1, 3, 4, 5]);
  });

  it('inserts before existing element when equal (stable left)', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    const idx = sa.insert(2);
    assert.equal(idx, 1);
    assert.deepEqual(sa.toArray(), [1, 2, 2, 3]);
  });

  it('inserts at the beginning when smallest', () => {
    const sa = new SortedArray(numCmp, [5, 10, 15]);
    const idx = sa.insert(1);
    assert.equal(idx, 0);
    assert.equal(sa.get(0), 1);
  });

  it('inserts at the end when largest', () => {
    const sa = new SortedArray(numCmp, [5, 10, 15]);
    const idx = sa.insert(99);
    assert.equal(idx, 3);
    assert.equal(sa.max(), 99);
  });

  it('size increases by 1 per insert', () => {
    const sa = new SortedArray(numCmp);
    sa.insert(1);
    sa.insert(2);
    sa.insert(3);
    assert.equal(sa.size, 3);
  });

  it('handles inserting duplicates — all are retained', () => {
    const sa = new SortedArray(numCmp);
    sa.insert(5);
    sa.insert(5);
    sa.insert(5);
    assert.equal(sa.size, 3);
    assert.deepEqual(sa.toArray(), [5, 5, 5]);
  });
});

// ─── insertAll ───────────────────────────────────────────────────────────────

describe('SortedArray – insertAll', () => {
  it('inserts multiple items maintaining order', () => {
    const sa = new SortedArray(numCmp);
    sa.insertAll([4, 1, 3, 2]);
    assert.deepEqual(sa.toArray(), [1, 2, 3, 4]);
  });

  it('merges into an existing sorted array', () => {
    const sa = new SortedArray(numCmp, [2, 5, 8]);
    sa.insertAll([1, 4, 7]);
    assert.deepEqual(sa.toArray(), [1, 2, 4, 5, 7, 8]);
  });

  it('handles empty insertAll gracefully', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    sa.insertAll([]);
    assert.deepEqual(sa.toArray(), [1, 2, 3]);
  });

  it('handles single item in insertAll', () => {
    const sa = new SortedArray(numCmp);
    sa.insertAll([7]);
    assert.deepEqual(sa.toArray(), [7]);
  });

  it('handles duplicates across batches', () => {
    const sa = new SortedArray(numCmp, [1, 2]);
    sa.insertAll([2, 3]);
    assert.deepEqual(sa.toArray(), [1, 2, 2, 3]);
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('SortedArray – remove', () => {
  it('removes an existing element and returns true', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3, 4]);
    const removed = sa.remove(3);
    assert.equal(removed, true);
    assert.deepEqual(sa.toArray(), [1, 2, 4]);
  });

  it('returns false when element is not present', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.remove(99), false);
  });

  it('removes only the first occurrence of a duplicate', () => {
    const sa = new SortedArray(numCmp, [1, 2, 2, 2, 3]);
    sa.remove(2);
    assert.deepEqual(sa.toArray(), [1, 2, 2, 3]);
  });

  it('removes the only element leaving the array empty', () => {
    const sa = new SortedArray(numCmp, [42]);
    sa.remove(42);
    assert.equal(sa.size, 0);
    assert.deepEqual(sa.toArray(), []);
  });

  it('returns false on empty array', () => {
    const sa = new SortedArray(numCmp);
    assert.equal(sa.remove(1), false);
  });

  it('size decreases by 1 after successful remove', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    sa.remove(2);
    assert.equal(sa.size, 2);
  });

  it('leaves array in sorted order after removal', () => {
    const sa = new SortedArray(numCmp, [5, 10, 15, 20]);
    sa.remove(10);
    assert.deepEqual(sa.toArray(), [5, 15, 20]);
  });

  it('handles removal from all-same array', () => {
    const sa = new SortedArray(numCmp, [3, 3, 3]);
    sa.remove(3);
    assert.deepEqual(sa.toArray(), [3, 3]);
  });
});

// ─── removeAt ────────────────────────────────────────────────────────────────

describe('SortedArray – removeAt', () => {
  it('removes element at a specific index and returns it', () => {
    const sa = new SortedArray(numCmp, [10, 20, 30, 40]);
    const val = sa.removeAt(1);
    assert.equal(val, 20);
    assert.deepEqual(sa.toArray(), [10, 30, 40]);
  });

  it('removes first element', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.removeAt(0), 1);
    assert.deepEqual(sa.toArray(), [2, 3]);
  });

  it('removes last element', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.removeAt(2), 3);
    assert.deepEqual(sa.toArray(), [1, 2]);
  });

  it('returns undefined for out-of-bounds index (positive)', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.removeAt(10), undefined);
  });

  it('returns undefined for negative index', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.removeAt(-1), undefined);
  });

  it('returns undefined on empty array', () => {
    const sa = new SortedArray(numCmp);
    assert.equal(sa.removeAt(0), undefined);
  });

  it('size decreases after successful removeAt', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    sa.removeAt(0);
    assert.equal(sa.size, 2);
  });

  it('size unchanged after failed removeAt', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    sa.removeAt(99);
    assert.equal(sa.size, 3);
  });
});

// ─── has / indexOf ───────────────────────────────────────────────────────────

describe('SortedArray – has and indexOf', () => {
  it('has returns true for existing element', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.has(2), true);
  });

  it('has returns false for missing element', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.equal(sa.has(99), false);
  });

  it('has returns false on empty array', () => {
    const sa = new SortedArray(numCmp);
    assert.equal(sa.has(1), false);
  });

  it('indexOf returns correct index using binary search', () => {
    const sa = new SortedArray(numCmp, [10, 20, 30, 40, 50]);
    assert.equal(sa.indexOf(30), 2);
  });

  it('indexOf returns -1 for missing element', () => {
    const sa = new SortedArray(numCmp, [1, 3, 5]);
    assert.equal(sa.indexOf(4), -1);
  });

  it('indexOf returns leftmost index when duplicates present', () => {
    const sa = new SortedArray(numCmp, [1, 2, 2, 2, 3]);
    assert.equal(sa.indexOf(2), 1);
  });

  it('indexOf works with custom comparator objects', () => {
    const sa = new SortedArray(nameCmp, [
      { name: 'charlie' },
      { name: 'alice' },
      { name: 'bob' },
    ]);
    // After sort: alice(0), bob(1), charlie(2)
    assert.equal(sa.indexOf({ name: 'bob' }), 1);
  });

  it('has and indexOf agree on presence', () => {
    const sa = new SortedArray(numCmp, [5, 10, 15]);
    assert.equal(sa.has(10), sa.indexOf(10) !== -1);
    assert.equal(sa.has(7), sa.indexOf(7) !== -1);
  });
});

// ─── get / slice / toArray ───────────────────────────────────────────────────

describe('SortedArray – get, slice, and toArray', () => {
  it('get returns the element at index', () => {
    const sa = new SortedArray(numCmp, [10, 20, 30]);
    assert.equal(sa.get(1), 20);
  });

  it('get returns undefined for out-of-bounds', () => {
    const sa = new SortedArray(numCmp, [10, 20, 30]);
    assert.equal(sa.get(99), undefined);
    assert.equal(sa.get(-1), undefined);
  });

  it('toArray returns a copy — mutation does not affect the internal array', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    const arr = sa.toArray();
    arr.push(99);
    assert.equal(sa.size, 3);
  });

  it('slice with no args returns a full copy', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3, 4, 5]);
    assert.deepEqual(sa.slice(), [1, 2, 3, 4, 5]);
  });

  it('slice with start and end returns a sub-array', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3, 4, 5]);
    assert.deepEqual(sa.slice(1, 3), [2, 3]);
  });

  it('slice with only start returns from start to end', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3, 4, 5]);
    assert.deepEqual(sa.slice(3), [4, 5]);
  });

  it('slice returns empty array for empty sorted array', () => {
    const sa = new SortedArray(numCmp);
    assert.deepEqual(sa.slice(), []);
  });

  it('toArray on empty returns empty array', () => {
    const sa = new SortedArray(numCmp);
    assert.deepEqual(sa.toArray(), []);
  });
});

// ─── size / min / max ────────────────────────────────────────────────────────

describe('SortedArray – size, min, and max', () => {
  it('size is 0 for empty array', () => {
    assert.equal(new SortedArray().size, 0);
  });

  it('size reflects the number of elements', () => {
    const sa = new SortedArray(numCmp, [3, 1, 4, 1, 5]);
    assert.equal(sa.size, 5);
  });

  it('min returns the smallest element', () => {
    const sa = new SortedArray(numCmp, [7, 2, 9, 4]);
    assert.equal(sa.min(), 2);
  });

  it('max returns the largest element', () => {
    const sa = new SortedArray(numCmp, [7, 2, 9, 4]);
    assert.equal(sa.max(), 9);
  });

  it('min returns undefined for empty array', () => {
    assert.equal(new SortedArray(numCmp).min(), undefined);
  });

  it('max returns undefined for empty array', () => {
    assert.equal(new SortedArray(numCmp).max(), undefined);
  });

  it('min and max are the same for single-element array', () => {
    const sa = new SortedArray(numCmp, [42]);
    assert.equal(sa.min(), 42);
    assert.equal(sa.max(), 42);
  });

  it('min and max are the same for all-equal elements', () => {
    const sa = new SortedArray(numCmp, [5, 5, 5]);
    assert.equal(sa.min(), 5);
    assert.equal(sa.max(), 5);
  });
});

// ─── range ───────────────────────────────────────────────────────────────────

describe('SortedArray – range', () => {
  it('returns all elements in [low, high]', () => {
    const sa = new SortedArray(numCmp, [1, 3, 5, 7, 9, 11]);
    assert.deepEqual(sa.range(4, 9), [5, 7, 9]);
  });

  it('includes elements equal to low and high (inclusive bounds)', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3, 4, 5]);
    assert.deepEqual(sa.range(2, 4), [2, 3, 4]);
  });

  it('returns empty array when no elements in range', () => {
    const sa = new SortedArray(numCmp, [1, 2, 3]);
    assert.deepEqual(sa.range(10, 20), []);
  });

  it('returns all elements when range covers the entire array', () => {
    const sa = new SortedArray(numCmp, [5, 10, 15]);
    assert.deepEqual(sa.range(5, 15), [5, 10, 15]);
  });

  it('returns empty array for empty sorted array', () => {
    const sa = new SortedArray(numCmp);
    assert.deepEqual(sa.range(1, 10), []);
  });

  it('returns a single element when low === high and element exists', () => {
    const sa = new SortedArray(numCmp, [1, 5, 10]);
    assert.deepEqual(sa.range(5, 5), [5]);
  });

  it('returns empty when low === high and element does not exist', () => {
    const sa = new SortedArray(numCmp, [1, 3, 7]);
    assert.deepEqual(sa.range(5, 5), []);
  });

  it('includes duplicate elements in range', () => {
    const sa = new SortedArray(numCmp, [1, 2, 2, 2, 3]);
    assert.deepEqual(sa.range(2, 2), [2, 2, 2]);
  });

  it('works with custom comparator on strings', () => {
    const sa = new SortedArray(undefined, ['apple', 'banana', 'cherry', 'date', 'elderberry']);
    assert.deepEqual(sa.range('banana', 'date'), ['banana', 'cherry', 'date']);
  });
});

// ─── createSortedArray factory ───────────────────────────────────────────────

describe('createSortedArray', () => {
  it('returns a SortedArray instance', () => {
    const sa = createSortedArray(numCmp);
    assert.ok(sa instanceof SortedArray);
  });

  it('starts empty', () => {
    const sa = createSortedArray(numCmp);
    assert.equal(sa.size, 0);
  });

  it('uses provided comparator correctly', () => {
    const sa = createSortedArray((a, b) => b - a); // descending
    sa.insertAll([3, 1, 4, 1, 5]);
    assert.deepEqual(sa.toArray(), [5, 4, 3, 1, 1]);
  });

  it('works without a comparator (default natural order)', () => {
    const sa = createSortedArray();
    sa.insertAll(['cat', 'ant', 'bat']);
    assert.deepEqual(sa.toArray(), ['ant', 'bat', 'cat']);
  });

  it('factory and constructor produce identical results', () => {
    const fromFactory = createSortedArray(numCmp);
    const fromNew = new SortedArray(numCmp);
    fromFactory.insertAll([5, 3, 1]);
    fromNew.insertAll([5, 3, 1]);
    assert.deepEqual(fromFactory.toArray(), fromNew.toArray());
  });

  it('supports chained operations after creation', () => {
    const sa = createSortedArray(numCmp);
    sa.insert(10);
    sa.insert(5);
    sa.insert(15);
    sa.remove(10);
    assert.deepEqual(sa.toArray(), [5, 15]);
  });

  it('size getter works correctly via factory', () => {
    const sa = createSortedArray(numCmp);
    assert.equal(sa.size, 0);
    sa.insert(1);
    sa.insert(2);
    assert.equal(sa.size, 2);
  });

  it('range query works via factory', () => {
    const sa = createSortedArray(numCmp);
    sa.insertAll([10, 20, 30, 40, 50]);
    assert.deepEqual(sa.range(20, 40), [20, 30, 40]);
  });
});
