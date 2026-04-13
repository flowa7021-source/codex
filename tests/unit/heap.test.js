// ─── Unit Tests: heap ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MinHeap, MaxHeap, PriorityQueue, createMinHeap, createMaxHeap, createPriorityQueue, heapSort } from '../../app/modules/heap.js';

// ─── MinHeap – push / pop / peek ─────────────────────────────────────────────

describe('MinHeap – push/pop/peek', () => {
  it('starts empty', () => {
    const h = new MinHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty(), true);
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
    assert.equal(h.isEmpty(), false);
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
    while (!h.isEmpty()) result.push(h.pop());
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

  it('single element push/pop round-trip', () => {
    const h = new MinHeap();
    h.push(42);
    assert.equal(h.pop(), 42);
    assert.equal(h.isEmpty(), true);
  });

  it('consecutive pops after many pushes', () => {
    const h = new MinHeap();
    for (const n of [9, 4, 7, 1, 8, 2, 6, 3, 5]) h.push(n);
    const result = [];
    while (!h.isEmpty()) result.push(h.pop());
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

// ─── MinHeap – sorted order ───────────────────────────────────────────────────

describe('MinHeap – sorted order', () => {
  it('toSortedArray returns elements smallest-first', () => {
    const h = new MinHeap();
    h.push(5);
    h.push(1);
    h.push(3);
    h.push(2);
    h.push(4);
    assert.deepEqual(h.toSortedArray(), [1, 2, 3, 4, 5]);
  });

  it('toSortedArray is non-destructive', () => {
    const h = new MinHeap();
    h.push(3);
    h.push(1);
    h.push(2);
    h.toSortedArray();
    assert.equal(h.size, 3);
    assert.equal(h.peek(), 1);
  });

  it('toSortedArray on empty heap returns empty array', () => {
    const h = new MinHeap();
    assert.deepEqual(h.toSortedArray(), []);
  });
});

// ─── MinHeap – custom comparator ─────────────────────────────────────────────

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

  it('works with objects sorted by numeric key', () => {
    const h = new MinHeap((a, b) => a.priority - b.priority);
    h.push({ name: 'low', priority: 10 });
    h.push({ name: 'high', priority: 1 });
    h.push({ name: 'mid', priority: 5 });
    assert.equal(h.pop()?.name, 'high');
    assert.equal(h.pop()?.name, 'mid');
    assert.equal(h.pop()?.name, 'low');
  });

  it('inverted comparator turns it into a max-heap', () => {
    const h = new MinHeap((a, b) => b - a);
    h.push(3);
    h.push(1);
    h.push(5);
    assert.equal(h.pop(), 5);
    assert.equal(h.pop(), 3);
    assert.equal(h.pop(), 1);
  });
});

// ─── MinHeap – edge cases ────────────────────────────────────────────────────

describe('MinHeap – edge cases', () => {
  it('pop on empty heap returns undefined', () => {
    const h = new MinHeap();
    assert.equal(h.pop(), undefined);
  });

  it('pop after clear returns undefined', () => {
    const h = new MinHeap();
    h.push(1);
    h.clear();
    assert.equal(h.pop(), undefined);
  });

  it('handles negative numbers', () => {
    const h = new MinHeap();
    h.push(-5);
    h.push(-1);
    h.push(-3);
    assert.equal(h.pop(), -5);
  });

  it('handles a single element heap repeatedly', () => {
    const h = new MinHeap();
    h.push(1);
    assert.equal(h.pop(), 1);
    h.push(2);
    assert.equal(h.pop(), 2);
  });
});

// ─── MinHeap – size, isEmpty, clear, toArray, toSortedArray ──────────────────

describe('MinHeap – size, isEmpty, clear, toArray, toSortedArray', () => {
  it('size tracks pushes and pops', () => {
    const h = new MinHeap();
    assert.equal(h.size, 0);
    h.push(1);
    assert.equal(h.size, 1);
    h.push(2);
    assert.equal(h.size, 2);
    h.pop();
    assert.equal(h.size, 1);
  });

  it('isEmpty returns true only when empty', () => {
    const h = new MinHeap();
    assert.equal(h.isEmpty(), true);
    h.push(1);
    assert.equal(h.isEmpty(), false);
    h.pop();
    assert.equal(h.isEmpty(), true);
  });

  it('clear empties the heap', () => {
    const h = new MinHeap();
    h.push(1);
    h.push(2);
    h.clear();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty(), true);
    assert.equal(h.peek(), undefined);
  });

  it('toArray returns unsorted heap contents', () => {
    const h = new MinHeap();
    h.push(3);
    h.push(1);
    h.push(2);
    const arr = h.toArray();
    assert.equal(arr.length, 3);
    assert.equal(arr[0], 1); // heap root must be minimum
    assert.equal(h.size, 3); // non-destructive
  });

  it('toArray returns a copy — mutation does not affect heap', () => {
    const h = new MinHeap();
    h.push(5);
    h.push(3);
    const arr = h.toArray();
    arr.push(999);
    assert.equal(h.size, 2);
  });
});

// ─── MaxHeap – push / pop / peek ─────────────────────────────────────────────

describe('MaxHeap – push/pop/peek', () => {
  it('starts empty', () => {
    const h = new MaxHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty(), true);
  });

  it('pop returns undefined on empty heap', () => {
    const h = new MaxHeap();
    assert.equal(h.pop(), undefined);
  });

  it('pop returns items in descending order', () => {
    const h = new MaxHeap();
    h.push(5);
    h.push(1);
    h.push(3);
    h.push(4);
    h.push(2);
    const result = [];
    while (!h.isEmpty()) result.push(h.pop());
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
});

// ─── MaxHeap – sorted order ───────────────────────────────────────────────────

describe('MaxHeap – sorted order', () => {
  it('toSortedArray returns elements largest-first', () => {
    const h = new MaxHeap();
    h.push(3);
    h.push(1);
    h.push(5);
    h.push(2);
    h.push(4);
    assert.deepEqual(h.toSortedArray(), [5, 4, 3, 2, 1]);
  });

  it('toSortedArray is non-destructive', () => {
    const h = new MaxHeap();
    h.push(3);
    h.push(1);
    h.push(2);
    h.toSortedArray();
    assert.equal(h.size, 3);
  });
});

// ─── MaxHeap – size, isEmpty, clear, toArray, toSortedArray ──────────────────

describe('MaxHeap – size, isEmpty, clear, toArray, toSortedArray', () => {
  it('size tracks pushes and pops', () => {
    const h = new MaxHeap();
    assert.equal(h.size, 0);
    h.push(10);
    assert.equal(h.size, 1);
    h.pop();
    assert.equal(h.size, 0);
  });

  it('isEmpty returns true only when empty', () => {
    const h = new MaxHeap();
    assert.equal(h.isEmpty(), true);
    h.push(1);
    assert.equal(h.isEmpty(), false);
  });

  it('clear empties the heap', () => {
    const h = new MaxHeap();
    h.push(1);
    h.push(2);
    h.clear();
    assert.equal(h.size, 0);
    assert.equal(h.peek(), undefined);
  });

  it('toArray returns a copy', () => {
    const h = new MaxHeap();
    h.push(10);
    h.push(5);
    const arr = h.toArray();
    assert.equal(arr.length, 2);
    assert.equal(h.size, 2); // non-destructive
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

// ─── MaxHeap – custom comparator ─────────────────────────────────────────────

describe('MaxHeap – custom comparator', () => {
  it('works with objects sorted by numeric key', () => {
    const h = new MaxHeap((a, b) => a.score - b.score);
    h.push({ name: 'low', score: 1 });
    h.push({ name: 'high', score: 10 });
    h.push({ name: 'mid', score: 5 });
    assert.equal(h.pop()?.name, 'high');
    assert.equal(h.pop()?.name, 'mid');
    assert.equal(h.pop()?.name, 'low');
  });
});

// ─── PriorityQueue ───────────────────────────────────────────────────────────

describe('PriorityQueue – enqueue/dequeue by priority', () => {
  it('dequeues in priority order (lower number first)', () => {
    const pq = new PriorityQueue();
    pq.enqueue('low', 10);
    pq.enqueue('high', 1);
    pq.enqueue('mid', 5);
    assert.equal(pq.dequeue(), 'high');
    assert.equal(pq.dequeue(), 'mid');
    assert.equal(pq.dequeue(), 'low');
  });

  it('returns undefined on empty dequeue', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.dequeue(), undefined);
  });

  it('enqueues items with the same priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 1);
    // Both should dequeue without error
    const first = pq.dequeue();
    const second = pq.dequeue();
    assert.ok(first === 'a' || first === 'b');
    assert.ok(second === 'a' || second === 'b');
    assert.notEqual(first, second);
  });
});

describe('PriorityQueue – peek', () => {
  it('peek returns highest-priority item without removing', () => {
    const pq = new PriorityQueue();
    pq.enqueue('task', 3);
    pq.enqueue('urgent', 1);
    assert.equal(pq.peek(), 'urgent');
    assert.equal(pq.size, 2);
  });

  it('peek returns undefined on empty queue', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.peek(), undefined);
  });
});

describe('PriorityQueue – size and isEmpty', () => {
  it('size tracks enqueue and dequeue', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.size, 0);
    pq.enqueue('a', 1);
    assert.equal(pq.size, 1);
    pq.enqueue('b', 2);
    assert.equal(pq.size, 2);
    pq.dequeue();
    assert.equal(pq.size, 1);
  });

  it('isEmpty returns true only when empty', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.isEmpty(), true);
    pq.enqueue('x', 0);
    assert.equal(pq.isEmpty(), false);
    pq.dequeue();
    assert.equal(pq.isEmpty(), true);
  });
});

describe('PriorityQueue – clear', () => {
  it('clear removes all items', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    pq.clear();
    assert.equal(pq.size, 0);
    assert.equal(pq.isEmpty(), true);
    assert.equal(pq.dequeue(), undefined);
  });
});

describe('PriorityQueue – contains', () => {
  it('returns true for an enqueued item', () => {
    const pq = new PriorityQueue();
    pq.enqueue('hello', 1);
    assert.equal(pq.contains('hello'), true);
  });

  it('returns false for an item not in the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue('hello', 1);
    assert.equal(pq.contains('world'), false);
  });

  it('returns false after item is dequeued', () => {
    const pq = new PriorityQueue();
    pq.enqueue('hello', 1);
    pq.dequeue();
    assert.equal(pq.contains('hello'), false);
  });

  it('uses === identity for objects', () => {
    const pq = new PriorityQueue();
    const obj = { x: 1 };
    pq.enqueue(obj, 5);
    assert.equal(pq.contains(obj), true);
    assert.equal(pq.contains({ x: 1 }), false); // different reference
  });
});

describe('PriorityQueue – changePriority', () => {
  it('changes priority of an existing item', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 10);
    pq.enqueue('b', 5);
    pq.enqueue('c', 1);
    pq.changePriority('a', 0); // 'a' should now come first
    assert.equal(pq.dequeue(), 'a');
  });

  it('is a no-op for an unknown item', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 5);
    pq.changePriority('nonexistent', 0);
    assert.equal(pq.size, 1);
    assert.equal(pq.dequeue(), 'a');
  });

  it('demotes an item that had high priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.enqueue('b', 5);
    pq.changePriority('a', 10); // 'a' should now come last
    assert.equal(pq.dequeue(), 'b');
    assert.equal(pq.dequeue(), 'a');
  });
});

// ─── heapSort ─────────────────────────────────────────────────────────────────

describe('heapSort', () => {
  it('sorts an array in ascending order', () => {
    const arr = [5, 2, 8, 1, 9, 3];
    const result = heapSort(arr);
    assert.deepEqual(result, [1, 2, 3, 5, 8, 9]);
  });

  it('returns the same array reference (in-place)', () => {
    const arr = [3, 1, 2];
    const result = heapSort(arr);
    assert.equal(result, arr);
  });

  it('sorts an already-sorted array', () => {
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

  it('handles negative numbers', () => {
    assert.deepEqual(heapSort([-3, -1, -4, -1, -5]), [-5, -4, -3, -1, -1]);
  });

  it('handles mixed positive and negative numbers', () => {
    assert.deepEqual(heapSort([0, -2, 3, -1, 2]), [-2, -1, 0, 2, 3]);
  });
});

// ─── Factory functions ────────────────────────────────────────────────────────

describe('createMinHeap factory', () => {
  it('returns a MinHeap instance', () => {
    const h = createMinHeap();
    assert.ok(h instanceof MinHeap);
  });

  it('created instance works correctly', () => {
    const h = createMinHeap();
    h.push(3);
    h.push(1);
    h.push(2);
    assert.equal(h.pop(), 1);
  });

  it('accepts a custom comparator', () => {
    const h = createMinHeap((a, b) => b - a); // inverted → max-heap behaviour
    h.push(1);
    h.push(5);
    h.push(3);
    assert.equal(h.pop(), 5);
  });
});

describe('createMaxHeap factory', () => {
  it('returns a MaxHeap instance', () => {
    const h = createMaxHeap();
    assert.ok(h instanceof MaxHeap);
  });

  it('created instance works correctly', () => {
    const h = createMaxHeap();
    h.push(3);
    h.push(1);
    h.push(2);
    assert.equal(h.pop(), 3);
  });

  it('accepts a custom comparator', () => {
    const h = createMaxHeap((a, b) => a.v - b.v);
    h.push({ v: 1 });
    h.push({ v: 5 });
    h.push({ v: 3 });
    assert.equal(h.pop()?.v, 5);
  });
});

describe('createPriorityQueue factory', () => {
  it('returns a PriorityQueue instance', () => {
    const pq = createPriorityQueue();
    assert.ok(pq instanceof PriorityQueue);
  });

  it('created instance works correctly', () => {
    const pq = createPriorityQueue();
    pq.enqueue('first', 1);
    pq.enqueue('second', 2);
    assert.equal(pq.dequeue(), 'first');
  });
});
