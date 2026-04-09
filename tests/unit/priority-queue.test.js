// ─── Unit Tests: priority-queue ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PriorityQueue,
  MaxPriorityQueue,
  MinPriorityQueue,
} from '../../app/modules/priority-queue.js';

// ─── PriorityQueue – basic min-heap behavior ──────────────────────────────────

describe('PriorityQueue – basic operations (min-heap default)', () => {
  it('starts empty', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.size, 0);
    assert.equal(pq.isEmpty, true);
  });

  it('peek returns undefined on empty queue', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.peek(), undefined);
  });

  it('dequeue returns undefined on empty queue', () => {
    const pq = new PriorityQueue();
    assert.equal(pq.dequeue(), undefined);
  });

  it('enqueue increases size', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    assert.equal(pq.size, 1);
    assert.equal(pq.isEmpty, false);
  });

  it('peek returns smallest without removing', () => {
    const pq = new PriorityQueue();
    pq.enqueue(10);
    pq.enqueue(3);
    pq.enqueue(7);
    assert.equal(pq.peek(), 3);
    assert.equal(pq.size, 3);
  });

  it('dequeue returns items in ascending order (min-heap)', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    pq.enqueue(1);
    pq.enqueue(3);
    pq.enqueue(4);
    pq.enqueue(2);
    const result = [];
    while (!pq.isEmpty) result.push(pq.dequeue());
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it('handles duplicate values', () => {
    const pq = new PriorityQueue();
    pq.enqueue(2);
    pq.enqueue(2);
    pq.enqueue(1);
    assert.equal(pq.dequeue(), 1);
    assert.equal(pq.dequeue(), 2);
    assert.equal(pq.dequeue(), 2);
  });

  it('single element enqueue/dequeue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(42);
    assert.equal(pq.dequeue(), 42);
    assert.equal(pq.isEmpty, true);
  });
});

// ─── PriorityQueue – size / isEmpty ──────────────────────────────────────────

describe('PriorityQueue – size and isEmpty', () => {
  it('isEmpty is true for new queue', () => {
    assert.equal(new PriorityQueue().isEmpty, true);
  });

  it('isEmpty is false after enqueue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    assert.equal(pq.isEmpty, false);
  });

  it('isEmpty becomes true after dequeuing all items', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.dequeue();
    assert.equal(pq.isEmpty, true);
    assert.equal(pq.size, 0);
  });

  it('size tracks enqueue and dequeue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.enqueue(2);
    assert.equal(pq.size, 2);
    pq.dequeue();
    assert.equal(pq.size, 1);
    pq.dequeue();
    assert.equal(pq.size, 0);
  });
});

// ─── PriorityQueue – toArray ──────────────────────────────────────────────────

describe('PriorityQueue – toArray', () => {
  it('returns items in priority order (sorted)', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    pq.enqueue(1);
    pq.enqueue(3);
    assert.deepEqual(pq.toArray(), [1, 3, 5]);
  });

  it('does not modify the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(3);
    pq.enqueue(1);
    pq.enqueue(2);
    pq.toArray();
    assert.equal(pq.size, 3);
    assert.equal(pq.peek(), 1);
  });

  it('returns empty array for empty queue', () => {
    assert.deepEqual(new PriorityQueue().toArray(), []);
  });

  it('returns single-element array', () => {
    const pq = new PriorityQueue();
    pq.enqueue(99);
    assert.deepEqual(pq.toArray(), [99]);
  });
});

// ─── PriorityQueue – clear ────────────────────────────────────────────────────

describe('PriorityQueue – clear', () => {
  it('empties the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.enqueue(2);
    pq.enqueue(3);
    pq.clear();
    assert.equal(pq.size, 0);
    assert.equal(pq.isEmpty, true);
    assert.equal(pq.peek(), undefined);
  });

  it('clear on empty queue is a no-op', () => {
    const pq = new PriorityQueue();
    pq.clear();
    assert.equal(pq.isEmpty, true);
  });

  it('queue works normally after clear', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    pq.clear();
    pq.enqueue(3);
    pq.enqueue(1);
    assert.equal(pq.dequeue(), 1);
  });
});

// ─── PriorityQueue – has ─────────────────────────────────────────────────────

describe('PriorityQueue – has', () => {
  it('returns true for an item in the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    assert.equal(pq.has(5), true);
  });

  it('returns false for an item not in the queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    assert.equal(pq.has(10), false);
  });

  it('returns false for empty queue', () => {
    assert.equal(new PriorityQueue().has(1), false);
  });

  it('uses === equality (not structural)', () => {
    const pq = new PriorityQueue();
    const obj = { x: 1 };
    const other = { x: 1 };
    pq.enqueue(obj);
    assert.equal(pq.has(obj), true);
    assert.equal(pq.has(other), false);
  });

  it('returns false after item is dequeued', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    pq.dequeue();
    assert.equal(pq.has(5), false);
  });
});

// ─── PriorityQueue – remove ───────────────────────────────────────────────────

describe('PriorityQueue – remove', () => {
  it('removes an existing item and returns true', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.enqueue(2);
    pq.enqueue(3);
    assert.equal(pq.remove(2), true);
    assert.equal(pq.size, 2);
    assert.equal(pq.has(2), false);
  });

  it('returns false when item not in queue', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    assert.equal(pq.remove(99), false);
    assert.equal(pq.size, 1);
  });

  it('returns false for empty queue', () => {
    assert.equal(new PriorityQueue().remove(1), false);
  });

  it('queue remains valid after remove', () => {
    const pq = new PriorityQueue();
    pq.enqueue(5);
    pq.enqueue(1);
    pq.enqueue(3);
    pq.enqueue(4);
    pq.enqueue(2);
    pq.remove(3);
    const result = [];
    while (!pq.isEmpty) result.push(pq.dequeue());
    assert.deepEqual(result, [1, 2, 4, 5]);
  });

  it('can remove the minimum element', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.enqueue(2);
    pq.enqueue(3);
    pq.remove(1);
    assert.equal(pq.peek(), 2);
  });

  it('can remove the maximum element', () => {
    const pq = new PriorityQueue();
    pq.enqueue(1);
    pq.enqueue(2);
    pq.enqueue(3);
    pq.remove(3);
    const result = [];
    while (!pq.isEmpty) result.push(pq.dequeue());
    assert.deepEqual(result, [1, 2]);
  });

  it('removes only the first occurrence of a duplicate', () => {
    const pq = new PriorityQueue();
    pq.enqueue(2);
    pq.enqueue(2);
    pq.enqueue(1);
    pq.remove(2);
    assert.equal(pq.size, 2);
    assert.equal(pq.has(2), true);
  });
});

// ─── PriorityQueue – from() ───────────────────────────────────────────────────

describe('PriorityQueue.from', () => {
  it('builds a queue from an array', () => {
    const pq = PriorityQueue.from([5, 3, 8, 1, 4]);
    assert.equal(pq.size, 5);
    assert.equal(pq.peek(), 1);
  });

  it('dequeues in sorted order', () => {
    const pq = PriorityQueue.from([5, 3, 8, 1, 4]);
    const result = [];
    while (!pq.isEmpty) result.push(pq.dequeue());
    assert.deepEqual(result, [1, 3, 4, 5, 8]);
  });

  it('builds from empty array', () => {
    const pq = PriorityQueue.from([]);
    assert.equal(pq.isEmpty, true);
  });

  it('accepts a custom comparator', () => {
    const pq = PriorityQueue.from([5, 3, 8, 1, 4], (a, b) => b - a);
    assert.equal(pq.peek(), 8); // max first
  });

  it('does not mutate the source array', () => {
    const arr = [5, 3, 1];
    const copy = [...arr];
    PriorityQueue.from(arr);
    assert.deepEqual(arr, copy);
  });
});

// ─── PriorityQueue – custom comparator ───────────────────────────────────────

describe('PriorityQueue – custom comparator', () => {
  it('works as a max-heap when comparator is reversed', () => {
    const pq = new PriorityQueue((a, b) => b - a);
    pq.enqueue(1);
    pq.enqueue(5);
    pq.enqueue(3);
    assert.equal(pq.dequeue(), 5);
    assert.equal(pq.dequeue(), 3);
    assert.equal(pq.dequeue(), 1);
  });

  it('works with objects sorted by a property', () => {
    const pq = new PriorityQueue((a, b) => a.priority - b.priority);
    pq.enqueue({ name: 'low', priority: 10 });
    pq.enqueue({ name: 'high', priority: 1 });
    pq.enqueue({ name: 'mid', priority: 5 });
    assert.equal(pq.dequeue()?.name, 'high');
    assert.equal(pq.dequeue()?.name, 'mid');
    assert.equal(pq.dequeue()?.name, 'low');
  });
});

// ─── MaxPriorityQueue ─────────────────────────────────────────────────────────

describe('MaxPriorityQueue', () => {
  it('dequeues numbers in descending order', () => {
    const pq = new MaxPriorityQueue();
    pq.enqueue(5);
    pq.enqueue(1);
    pq.enqueue(3);
    pq.enqueue(4);
    pq.enqueue(2);
    const result = [];
    while (!pq.isEmpty) result.push(pq.dequeue());
    assert.deepEqual(result, [5, 4, 3, 2, 1]);
  });

  it('peek returns largest without removing', () => {
    const pq = new MaxPriorityQueue();
    pq.enqueue(10);
    pq.enqueue(30);
    pq.enqueue(20);
    assert.equal(pq.peek(), 30);
    assert.equal(pq.size, 3);
  });

  it('works with strings (lexicographically last first)', () => {
    const pq = new MaxPriorityQueue();
    pq.enqueue('apple');
    pq.enqueue('cherry');
    pq.enqueue('banana');
    assert.equal(pq.dequeue(), 'cherry');
    assert.equal(pq.dequeue(), 'banana');
    assert.equal(pq.dequeue(), 'apple');
  });

  it('handles empty queue', () => {
    const pq = new MaxPriorityQueue();
    assert.equal(pq.isEmpty, true);
    assert.equal(pq.dequeue(), undefined);
  });

  it('toArray returns items in descending order', () => {
    const pq = new MaxPriorityQueue();
    pq.enqueue(3);
    pq.enqueue(1);
    pq.enqueue(2);
    assert.deepEqual(pq.toArray(), [3, 2, 1]);
  });
});

// ─── MinPriorityQueue ─────────────────────────────────────────────────────────

describe('MinPriorityQueue', () => {
  it('dequeues numbers in ascending order', () => {
    const pq = new MinPriorityQueue();
    pq.enqueue(5);
    pq.enqueue(1);
    pq.enqueue(3);
    pq.enqueue(4);
    pq.enqueue(2);
    const result = [];
    while (!pq.isEmpty) result.push(pq.dequeue());
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it('peek returns smallest without removing', () => {
    const pq = new MinPriorityQueue();
    pq.enqueue(10);
    pq.enqueue(3);
    pq.enqueue(7);
    assert.equal(pq.peek(), 3);
    assert.equal(pq.size, 3);
  });

  it('works with strings (lexicographically first first)', () => {
    const pq = new MinPriorityQueue();
    pq.enqueue('cherry');
    pq.enqueue('apple');
    pq.enqueue('banana');
    assert.equal(pq.dequeue(), 'apple');
    assert.equal(pq.dequeue(), 'banana');
    assert.equal(pq.dequeue(), 'cherry');
  });

  it('handles empty queue', () => {
    const pq = new MinPriorityQueue();
    assert.equal(pq.isEmpty, true);
    assert.equal(pq.dequeue(), undefined);
  });

  it('toArray returns items in ascending order', () => {
    const pq = new MinPriorityQueue();
    pq.enqueue(3);
    pq.enqueue(1);
    pq.enqueue(2);
    assert.deepEqual(pq.toArray(), [1, 2, 3]);
  });
});
