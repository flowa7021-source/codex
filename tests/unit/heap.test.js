// ─── Unit Tests: heap ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MinHeap, MaxHeap, heapSort, kSmallest, kLargest } from '../../app/modules/heap.js';

// ─── MinHeap ──────────────────────────────────────────────────────────────────

describe('MinHeap – basic operations', () => {
  it('starts empty', () => {
    const h = new MinHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
  });

  it('peek returns undefined on empty heap', () => {
    const h = new MinHeap();
    assert.equal(h.peek(), undefined);
  });

  it('pop returns undefined on empty heap', () => {
    const h = new MinHeap();
    assert.equal(h.pop(), undefined);
  });

  it('push increases size', () => {
    const h = new MinHeap();
    h.push(5);
    assert.equal(h.size, 1);
    assert.equal(h.isEmpty, false);
  });

  it('peek returns smallest without removing', () => {
    const h = new MinHeap();
    h.push(10);
    h.push(3);
    h.push(7);
    assert.equal(h.peek(), 3);
    assert.equal(h.size, 3);
  });

  it('pop returns items in ascending order', () => {
    const h = new MinHeap();
    h.push(5);
    h.push(1);
    h.push(3);
    h.push(4);
    h.push(2);
    const result = [];
    while (!h.isEmpty) result.push(h.pop());
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it('handles duplicate values', () => {
    const h = new MinHeap();
    h.push(2);
    h.push(2);
    h.push(1);
    assert.equal(h.pop(), 1);
    assert.equal(h.pop(), 2);
    assert.equal(h.pop(), 2);
  });

  it('single element push/pop', () => {
    const h = new MinHeap();
    h.push(42);
    assert.equal(h.pop(), 42);
    assert.equal(h.isEmpty, true);
  });

  it('clear empties the heap', () => {
    const h = new MinHeap();
    h.push(1);
    h.push(2);
    h.clear();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
    assert.equal(h.peek(), undefined);
  });

  it('toArray returns unsorted heap contents', () => {
    const h = new MinHeap();
    h.push(3);
    h.push(1);
    h.push(2);
    const arr = h.toArray();
    assert.equal(arr.length, 3);
    // Heap property: first element must be the minimum
    assert.equal(arr[0], 1);
    // toArray does not drain the heap
    assert.equal(h.size, 3);
  });

  it('toArray does not share state with internal array', () => {
    const h = new MinHeap();
    h.push(5);
    h.push(3);
    const arr = h.toArray();
    arr.push(999);
    assert.equal(h.size, 2);
  });
});

describe('MinHeap – custom comparator', () => {
  it('works with strings (lexicographic)', () => {
    const h = new MinHeap((a, b) => a.localeCompare(b));
    h.push('banana');
    h.push('apple');
    h.push('cherry');
    assert.equal(h.pop(), 'apple');
    assert.equal(h.pop(), 'banana');
    assert.equal(h.pop(), 'cherry');
  });

  it('works with objects via key', () => {
    const h = new MinHeap((a, b) => a.priority - b.priority);
    h.push({ name: 'low', priority: 10 });
    h.push({ name: 'high', priority: 1 });
    h.push({ name: 'mid', priority: 5 });
    assert.equal(h.pop()?.name, 'high');
    assert.equal(h.pop()?.name, 'mid');
    assert.equal(h.pop()?.name, 'low');
  });
});

describe('MinHeap.heapify', () => {
  it('builds a heap from an array', () => {
    const h = MinHeap.heapify([5, 3, 8, 1, 4]);
    assert.equal(h.size, 5);
    const result = [];
    while (!h.isEmpty) result.push(h.pop());
    assert.deepEqual(result, [1, 3, 4, 5, 8]);
  });

  it('heapify on empty array produces empty heap', () => {
    const h = MinHeap.heapify([]);
    assert.equal(h.isEmpty, true);
  });

  it('heapify on single-element array', () => {
    const h = MinHeap.heapify([42]);
    assert.equal(h.pop(), 42);
    assert.equal(h.isEmpty, true);
  });

  it('heapify does not mutate the source array', () => {
    const arr = [5, 3, 8, 1, 4];
    const copy = [...arr];
    MinHeap.heapify(arr);
    assert.deepEqual(arr, copy);
  });

  it('heapify with custom comparator (reverse order)', () => {
    const h = MinHeap.heapify([5, 3, 8, 1], (a, b) => b - a);
    assert.equal(h.pop(), 8);
  });
});

// ─── MaxHeap ──────────────────────────────────────────────────────────────────

describe('MaxHeap – basic operations', () => {
  it('starts empty', () => {
    const h = new MaxHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
  });

  it('pop returns items in descending order', () => {
    const h = new MaxHeap();
    h.push(5);
    h.push(1);
    h.push(3);
    h.push(4);
    h.push(2);
    const result = [];
    while (!h.isEmpty) result.push(h.pop());
    assert.deepEqual(result, [5, 4, 3, 2, 1]);
  });

  it('peek returns largest without removing', () => {
    const h = new MaxHeap();
    h.push(10);
    h.push(30);
    h.push(20);
    assert.equal(h.peek(), 30);
    assert.equal(h.size, 3);
  });

  it('handles duplicate values', () => {
    const h = new MaxHeap();
    h.push(3);
    h.push(3);
    h.push(1);
    assert.equal(h.pop(), 3);
    assert.equal(h.pop(), 3);
    assert.equal(h.pop(), 1);
  });

  it('clear empties the heap', () => {
    const h = new MaxHeap();
    h.push(1);
    h.push(2);
    h.clear();
    assert.equal(h.size, 0);
    assert.equal(h.peek(), undefined);
  });

  it('toArray does not drain the heap', () => {
    const h = new MaxHeap();
    h.push(10);
    h.push(5);
    const arr = h.toArray();
    assert.equal(arr.length, 2);
    assert.equal(h.size, 2);
  });

  it('toArray first element is the maximum', () => {
    const h = new MaxHeap();
    h.push(3);
    h.push(7);
    h.push(1);
    const arr = h.toArray();
    assert.equal(arr[0], 7);
  });
});

describe('MaxHeap.heapify', () => {
  it('builds a max-heap from an array', () => {
    const h = MaxHeap.heapify([5, 3, 8, 1, 4]);
    assert.equal(h.size, 5);
    const result = [];
    while (!h.isEmpty) result.push(h.pop());
    assert.deepEqual(result, [8, 5, 4, 3, 1]);
  });

  it('heapify on empty array produces empty heap', () => {
    const h = MaxHeap.heapify([]);
    assert.equal(h.isEmpty, true);
  });
});

// ─── heapSort ─────────────────────────────────────────────────────────────────

describe('heapSort', () => {
  it('sorts an array in ascending order', () => {
    assert.deepEqual(heapSort([5, 2, 8, 1, 9, 3]), [1, 2, 3, 5, 8, 9]);
  });

  it('sorts an already sorted array', () => {
    assert.deepEqual(heapSort([1, 2, 3, 4, 5]), [1, 2, 3, 4, 5]);
  });

  it('sorts a reverse-sorted array', () => {
    assert.deepEqual(heapSort([5, 4, 3, 2, 1]), [1, 2, 3, 4, 5]);
  });

  it('handles empty array', () => {
    assert.deepEqual(heapSort([]), []);
  });

  it('handles single-element array', () => {
    assert.deepEqual(heapSort([42]), [42]);
  });

  it('handles duplicates', () => {
    assert.deepEqual(heapSort([3, 1, 2, 1, 3]), [1, 1, 2, 3, 3]);
  });

  it('does not mutate the source array', () => {
    const arr = [3, 1, 2];
    const sorted = heapSort(arr);
    assert.deepEqual(arr, [3, 1, 2]);
    assert.deepEqual(sorted, [1, 2, 3]);
  });

  it('sorts in descending order with custom comparator', () => {
    assert.deepEqual(heapSort([3, 1, 4, 1, 5], (a, b) => b - a), [5, 4, 3, 1, 1]);
  });

  it('sorts strings lexicographically', () => {
    assert.deepEqual(heapSort(['banana', 'apple', 'cherry']), ['apple', 'banana', 'cherry']);
  });
});

// ─── kSmallest ────────────────────────────────────────────────────────────────

describe('kSmallest', () => {
  it('returns the k smallest elements in ascending order', () => {
    assert.deepEqual(kSmallest([5, 2, 8, 1, 9, 3], 3), [1, 2, 3]);
  });

  it('returns empty array when k is 0', () => {
    assert.deepEqual(kSmallest([5, 2, 8], 0), []);
  });

  it('returns empty array for negative k', () => {
    assert.deepEqual(kSmallest([5, 2, 8], -1), []);
  });

  it('returns all elements sorted when k >= length', () => {
    assert.deepEqual(kSmallest([3, 1, 2], 5), [1, 2, 3]);
  });

  it('returns all elements sorted when k equals length', () => {
    assert.deepEqual(kSmallest([3, 1, 2], 3), [1, 2, 3]);
  });

  it('handles k = 1', () => {
    assert.deepEqual(kSmallest([5, 2, 8, 1, 9], 1), [1]);
  });

  it('handles duplicates', () => {
    const result = kSmallest([4, 1, 3, 1, 2], 3);
    assert.deepEqual(result, [1, 1, 2]);
  });

  it('handles single-element array', () => {
    assert.deepEqual(kSmallest([42], 1), [42]);
  });

  it('handles empty array', () => {
    assert.deepEqual(kSmallest([], 3), []);
  });

  it('works with a custom comparator (objects)', () => {
    const items = [{ v: 5 }, { v: 2 }, { v: 8 }, { v: 1 }];
    const result = kSmallest(items, 2, (a, b) => a.v - b.v);
    assert.deepEqual(result.map((x) => x.v), [1, 2]);
  });
});

// ─── kLargest ─────────────────────────────────────────────────────────────────

describe('kLargest', () => {
  it('returns the k largest elements in descending order', () => {
    assert.deepEqual(kLargest([5, 2, 8, 1, 9, 3], 3), [9, 8, 5]);
  });

  it('returns empty array when k is 0', () => {
    assert.deepEqual(kLargest([5, 2, 8], 0), []);
  });

  it('returns empty array for negative k', () => {
    assert.deepEqual(kLargest([5, 2, 8], -1), []);
  });

  it('returns all elements sorted descending when k >= length', () => {
    assert.deepEqual(kLargest([3, 1, 2], 5), [3, 2, 1]);
  });

  it('returns all elements sorted descending when k equals length', () => {
    assert.deepEqual(kLargest([3, 1, 2], 3), [3, 2, 1]);
  });

  it('handles k = 1', () => {
    assert.deepEqual(kLargest([5, 2, 8, 1, 9], 1), [9]);
  });

  it('handles duplicates', () => {
    const result = kLargest([4, 1, 3, 4, 2], 3);
    assert.deepEqual(result, [4, 4, 3]);
  });

  it('handles single-element array', () => {
    assert.deepEqual(kLargest([42], 1), [42]);
  });

  it('handles empty array', () => {
    assert.deepEqual(kLargest([], 3), []);
  });

  it('works with a custom comparator (objects)', () => {
    const items = [{ v: 5 }, { v: 2 }, { v: 8 }, { v: 1 }];
    const result = kLargest(items, 2, (a, b) => a.v - b.v);
    assert.deepEqual(result.map((x) => x.v), [8, 5]);
  });
});
