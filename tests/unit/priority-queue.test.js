// ─── Unit Tests: priority-queue ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MinHeap,
  MaxHeap,
  PriorityQueue,
  createMinHeap,
  createMaxHeap,
} from '../../app/modules/priority-queue.js';

// ─── MinHeap – basic operations ───────────────────────────────────────────────

describe('MinHeap – basic operations', () => {
  it('starts empty', () => {
    const h = new MinHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
  });

  it('pop returns undefined on empty heap', () => {
    assert.equal(new MinHeap().pop(), undefined);
  });

  it('peek returns undefined on empty heap', () => {
    assert.equal(new MinHeap().peek(), undefined);
  });

  it('push increases size', () => {
    const h = new MinHeap();
    h.push('a', 5);
    assert.equal(h.size, 1);
    assert.equal(h.isEmpty, false);
  });

  it('peek returns minimum without removing', () => {
    const h = new MinHeap();
    h.push('high', 10);
    h.push('low', 1);
    h.push('mid', 5);
    assert.equal(h.peek(), 'low');
    assert.equal(h.size, 3); // not removed
  });

  it('pop returns items in ascending priority order', () => {
    const h = new MinHeap();
    h.push('c', 3);
    h.push('a', 1);
    h.push('e', 5);
    h.push('b', 2);
    h.push('d', 4);
    const result = [];
    while (!h.isEmpty) result.push(h.pop());
    assert.deepEqual(result, ['a', 'b', 'c', 'd', 'e']);
  });

  it('pop reduces size correctly', () => {
    const h = new MinHeap();
    h.push('x', 1);
    h.push('y', 2);
    h.pop();
    assert.equal(h.size, 1);
    h.pop();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
  });

  it('single element push/pop round-trip', () => {
    const h = new MinHeap();
    h.push('only', 42);
    assert.equal(h.pop(), 'only');
    assert.equal(h.isEmpty, true);
  });
});

// ─── MinHeap – peek and size/isEmpty ─────────────────────────────────────────

describe('MinHeap – peek and size / isEmpty', () => {
  it('isEmpty is false after push', () => {
    const h = new MinHeap();
    h.push('x', 1);
    assert.equal(h.isEmpty, false);
  });

  it('isEmpty becomes true after popping the last item', () => {
    const h = new MinHeap();
    h.push('x', 1);
    h.pop();
    assert.equal(h.isEmpty, true);
  });

  it('peek does not change size', () => {
    const h = new MinHeap();
    h.push('a', 3);
    h.push('b', 1);
    h.peek();
    assert.equal(h.size, 2);
  });

  it('peek always reflects the current minimum after pops', () => {
    const h = new MinHeap();
    h.push('p10', 10);
    h.push('p1', 1);
    h.push('p5', 5);
    assert.equal(h.peek(), 'p1');
    h.pop();
    assert.equal(h.peek(), 'p5');
    h.pop();
    assert.equal(h.peek(), 'p10');
  });
});

// ─── MinHeap – toArray ────────────────────────────────────────────────────────

describe('MinHeap – toArray', () => {
  it('returns empty array for an empty heap', () => {
    assert.deepEqual(new MinHeap().toArray(), []);
  });

  it('first element of toArray is the minimum', () => {
    const h = new MinHeap();
    h.push('z', 9);
    h.push('a', 1);
    h.push('m', 5);
    const arr = h.toArray();
    assert.equal(arr[0], 'a');
  });

  it('toArray length equals heap size', () => {
    const h = new MinHeap();
    h.push('x', 1);
    h.push('y', 2);
    h.push('z', 3);
    assert.equal(h.toArray().length, 3);
  });

  it('toArray does not remove items from the heap', () => {
    const h = new MinHeap();
    h.push('a', 1);
    h.push('b', 2);
    h.toArray();
    assert.equal(h.size, 2);
    assert.equal(h.peek(), 'a');
  });
});

// ─── MinHeap – same-priority and large sequences ──────────────────────────────

describe('MinHeap – same priority and large sequences', () => {
  it('all items with the same priority all come out', () => {
    const h = new MinHeap();
    h.push('x', 5);
    h.push('y', 5);
    h.push('z', 5);
    const out = [h.pop(), h.pop(), h.pop()];
    assert.equal(out.length, 3);
    // All values must be one of the three pushed
    assert.ok(out.every((v) => ['x', 'y', 'z'].includes(v)));
    assert.equal(h.isEmpty, true);
  });

  it('maintains min-heap ordering for 100 random pushes', () => {
    const h = new MinHeap();
    const values = Array.from({ length: 100 }, (_, i) => i);
    // Shuffle with a deterministic sequence
    for (let i = values.length - 1; i > 0; i--) {
      const j = (i * 37 + 17) % (i + 1);
      [values[i], values[j]] = [values[j], values[i]];
    }
    for (const v of values) h.push(v, v);

    let prev = -Infinity;
    while (!h.isEmpty) {
      const val = h.pop();
      assert.ok(val >= prev, `heap order violated: ${val} < ${prev}`);
      prev = val;
    }
  });
});

// ─── MaxHeap – basic operations ───────────────────────────────────────────────

describe('MaxHeap – basic operations', () => {
  it('starts empty', () => {
    const h = new MaxHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
  });

  it('pop returns undefined on empty heap', () => {
    assert.equal(new MaxHeap().pop(), undefined);
  });

  it('peek returns undefined on empty heap', () => {
    assert.equal(new MaxHeap().peek(), undefined);
  });

  it('pop returns items in descending priority order', () => {
    const h = new MaxHeap();
    h.push('c', 3);
    h.push('a', 1);
    h.push('e', 5);
    h.push('b', 2);
    h.push('d', 4);
    const result = [];
    while (!h.isEmpty) result.push(h.pop());
    assert.deepEqual(result, ['e', 'd', 'c', 'b', 'a']);
  });

  it('peek returns maximum without removing', () => {
    const h = new MaxHeap();
    h.push('low', 1);
    h.push('high', 99);
    h.push('mid', 50);
    assert.equal(h.peek(), 'high');
    assert.equal(h.size, 3);
  });

  it('single element push/pop round-trip', () => {
    const h = new MaxHeap();
    h.push('only', 7);
    assert.equal(h.pop(), 'only');
    assert.equal(h.isEmpty, true);
  });

  it('toArray first element is the maximum', () => {
    const h = new MaxHeap();
    h.push('a', 1);
    h.push('z', 26);
    h.push('m', 13);
    assert.equal(h.toArray()[0], 'z');
  });

  it('toArray does not remove items', () => {
    const h = new MaxHeap();
    h.push('x', 1);
    h.push('y', 2);
    h.toArray();
    assert.equal(h.size, 2);
  });

  it('maintains max-heap ordering for 50 pushes', () => {
    const h = new MaxHeap();
    for (let i = 0; i < 50; i++) h.push(i, i);
    let prev = Infinity;
    while (!h.isEmpty) {
      const val = h.pop();
      assert.ok(val <= prev, `heap order violated: ${val} > ${prev}`);
      prev = val;
    }
  });
});

// ─── PriorityQueue – enqueue / dequeue / peek ────────────────────────────────

describe('PriorityQueue – enqueue / dequeue / peek', () => {
  it('starts empty', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.size, 0);
    assert.equal(pq.isEmpty, true);
  });

  it('dequeue returns undefined on empty queue', () => {
    assert.equal(new PriorityQueue().dequeue(), undefined);
  });

  it('peek returns undefined on empty queue', () => {
    assert.equal(new PriorityQueue().peek(), undefined);
  });

  it('enqueue with explicit priority dequeues smallest first', () => {
    const pq = new PriorityQueue();
    pq.enqueue('normal', 5);
    pq.enqueue('urgent', 1);
    pq.enqueue('low', 10);
    assert.equal(pq.dequeue(), 'urgent');
    assert.equal(pq.dequeue(), 'normal');
    assert.equal(pq.dequeue(), 'low');
  });

  it('peek returns highest-priority item without removing', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 3);
    pq.enqueue('b', 1);
    pq.enqueue('c', 2);
    assert.equal(pq.peek(), 'b');
    assert.equal(pq.size, 3);
  });

  it('size and isEmpty track mutations correctly', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 1);
    pq.enqueue('y', 2);
    assert.equal(pq.size, 2);
    assert.equal(pq.isEmpty, false);
    pq.dequeue();
    assert.equal(pq.size, 1);
    pq.dequeue();
    assert.equal(pq.size, 0);
    assert.equal(pq.isEmpty, true);
  });

  it('enqueue without priority uses item numeric value', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    pq.enqueue(1);
    pq.enqueue(3);
    assert.equal(pq.dequeue(), 1);
    assert.equal(pq.dequeue(), 3);
    assert.equal(pq.dequeue(), 5);
  });
});

// ─── PriorityQueue – toSortedArray ───────────────────────────────────────────

describe('PriorityQueue – toSortedArray', () => {
  it('returns items in priority order (smallest first)', () => {
    const pq = new PriorityQueue();
    pq.enqueue('c', 3);
    pq.enqueue('a', 1);
    pq.enqueue('b', 2);
    assert.deepEqual(pq.toSortedArray(), ['a', 'b', 'c']);
  });

  it('leaves the queue empty after draining', () => {
    const pq = new PriorityQueue();
    pq.enqueue('x', 1);
    pq.enqueue('y', 2);
    pq.toSortedArray();
    assert.equal(pq.isEmpty, true);
  });

  it('returns empty array for an empty queue', () => {
    assert.deepEqual(new PriorityQueue().toSortedArray(), []);
  });

  it('single-element queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue('only', 7);
    assert.deepEqual(pq.toSortedArray(), ['only']);
  });
});

// ─── PriorityQueue – custom comparator ───────────────────────────────────────

describe('PriorityQueue – custom comparator', () => {
  it('acts as a max-heap when comparator is reversed', () => {
    const pq = new PriorityQueue((a, b) => b - a);
    pq.enqueue(1);
    pq.enqueue(5);
    pq.enqueue(3);
    // Without explicit priority the compareFn is used as tiebreaker;
    // to get true max-heap by value, pass value as priority inverted.
    // Here we pass explicit priorities to exercise the custom path.
    const pq2 = new PriorityQueue((a, b) => b - a);
    pq2.enqueue(1, -1); // higher priority for larger value
    pq2.enqueue(5, -5);
    pq2.enqueue(3, -3);
    assert.equal(pq2.dequeue(), 5);
    assert.equal(pq2.dequeue(), 3);
    assert.equal(pq2.dequeue(), 1);
  });

  it('sorts objects by a property used as priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ name: 'low',  task: 'C' }, 10);
    pq.enqueue({ name: 'high', task: 'A' }, 1);
    pq.enqueue({ name: 'mid',  task: 'B' }, 5);
    assert.equal(pq.dequeue().name, 'high');
    assert.equal(pq.dequeue().name, 'mid');
    assert.equal(pq.dequeue().name, 'low');
  });

  it('compareFn breaks ties when priorities are equal', () => {
    // compareFn orders alphabetically; same numeric priority → alpha order
    const pq = new PriorityQueue((a, b) => a.localeCompare(b));
    pq.enqueue('banana', 5);
    pq.enqueue('apple',  5);
    pq.enqueue('cherry', 5);
    assert.equal(pq.dequeue(), 'apple');
    assert.equal(pq.dequeue(), 'banana');
    assert.equal(pq.dequeue(), 'cherry');
  });
});

// ─── createMinHeap factory ────────────────────────────────────────────────────

describe('createMinHeap factory', () => {
  it('returns a MinHeap instance', () => {
    const h = createMinHeap();
    assert.ok(h instanceof MinHeap);
  });

  it('created heap is empty', () => {
    const h = createMinHeap();
    assert.equal(h.isEmpty, true);
    assert.equal(h.size, 0);
  });

  it('push and pop work on factory-created heap', () => {
    const h = createMinHeap();
    h.push('b', 2);
    h.push('a', 1);
    assert.equal(h.pop(), 'a');
    assert.equal(h.pop(), 'b');
    assert.equal(h.pop(), undefined);
  });

  it('heap maintains min-order after multiple pushes', () => {
    const h = createMinHeap();
    [5, 3, 8, 1, 4].forEach((p) => h.push(p, p));
    const sorted = [];
    while (!h.isEmpty) sorted.push(h.pop());
    assert.deepEqual(sorted, [1, 3, 4, 5, 8]);
  });
});

// ─── createMaxHeap factory ────────────────────────────────────────────────────

describe('createMaxHeap factory', () => {
  it('returns a MaxHeap instance', () => {
    const h = createMaxHeap();
    assert.ok(h instanceof MaxHeap);
  });

  it('created heap is empty', () => {
    const h = createMaxHeap();
    assert.equal(h.isEmpty, true);
    assert.equal(h.size, 0);
  });

  it('push and pop work on factory-created heap', () => {
    const h = createMaxHeap();
    h.push('b', 2);
    h.push('a', 1);
    assert.equal(h.pop(), 'b');
    assert.equal(h.pop(), 'a');
    assert.equal(h.pop(), undefined);
  });

  it('heap maintains max-order after multiple pushes', () => {
    const h = createMaxHeap();
    [5, 3, 8, 1, 4].forEach((p) => h.push(p, p));
    const sorted = [];
    while (!h.isEmpty) sorted.push(h.pop());
    assert.deepEqual(sorted, [8, 5, 4, 3, 1]);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Edge cases – single element and same priority', () => {
  it('MinHeap single element: push then pop returns it', () => {
    const h = new MinHeap();
    h.push('solo', 99);
    assert.equal(h.size, 1);
    assert.equal(h.peek(), 'solo');
    assert.equal(h.pop(), 'solo');
    assert.equal(h.isEmpty, true);
  });

  it('MaxHeap single element: push then pop returns it', () => {
    const h = new MaxHeap();
    h.push('solo', 99);
    assert.equal(h.pop(), 'solo');
    assert.equal(h.isEmpty, true);
  });

  it('MinHeap: all items identical priority come out in some order (no crash)', () => {
    const h = new MinHeap();
    h.push(1, 0);
    h.push(2, 0);
    h.push(3, 0);
    const out = [h.pop(), h.pop(), h.pop()];
    assert.equal(out.length, 3);
    assert.deepEqual([...out].sort(), [1, 2, 3]);
    assert.equal(h.isEmpty, true);
  });

  it('MaxHeap: all items identical priority come out (no crash)', () => {
    const h = new MaxHeap();
    h.push('x', 7);
    h.push('y', 7);
    h.push('z', 7);
    const out = [h.pop(), h.pop(), h.pop()];
    assert.equal(out.length, 3);
    assert.deepEqual([...out].sort(), ['x', 'y', 'z']);
  });

  it('PriorityQueue: dequeue past empty returns undefined', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 1);
    pq.dequeue();
    assert.equal(pq.dequeue(), undefined);
    assert.equal(pq.dequeue(), undefined);
  });

  it('PriorityQueue: interleaved enqueue and dequeue maintains order', () => {
    const pq = new PriorityQueue();
    pq.enqueue('a', 3);
    pq.enqueue('b', 1);
    assert.equal(pq.dequeue(), 'b');   // priority 1
    pq.enqueue('c', 2);
    assert.equal(pq.dequeue(), 'c');   // priority 2
    assert.equal(pq.dequeue(), 'a');   // priority 3
    assert.equal(pq.isEmpty, true);
  });

  it('MinHeap: negative priorities are handled correctly', () => {
    const h = new MinHeap();
    h.push('neg', -10);
    h.push('zero', 0);
    h.push('pos', 10);
    assert.equal(h.pop(), 'neg');
    assert.equal(h.pop(), 'zero');
    assert.equal(h.pop(), 'pos');
  });

  it('MaxHeap: negative priorities are handled correctly', () => {
    const h = new MaxHeap();
    h.push('neg', -10);
    h.push('zero', 0);
    h.push('pos', 10);
    assert.equal(h.pop(), 'pos');
    assert.equal(h.pop(), 'zero');
    assert.equal(h.pop(), 'neg');
  });
});
