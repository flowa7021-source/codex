// ─── Unit Tests: FibonacciHeap ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FibonacciHeap, createFibonacciHeap } from '../../app/modules/fibonacci-heap.js';

// ─── Basic operations ────────────────────────────────────────────────────────

describe('FibonacciHeap – basic operations', () => {
  it('starts empty', () => {
    const h = new FibonacciHeap();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
  });

  it('findMin returns undefined on empty heap', () => {
    const h = new FibonacciHeap();
    assert.equal(h.findMin(), undefined);
  });

  it('extractMin returns undefined on empty heap', () => {
    const h = new FibonacciHeap();
    assert.equal(h.extractMin(), undefined);
  });

  it('insert increases size and updates min', () => {
    const h = new FibonacciHeap();
    h.insert(42);
    assert.equal(h.size, 1);
    assert.equal(h.isEmpty, false);
    assert.equal(h.findMin(), 42);
  });

  it('findMin returns the smallest element', () => {
    const h = new FibonacciHeap();
    h.insert(10);
    h.insert(3);
    h.insert(7);
    assert.equal(h.findMin(), 3);
    assert.equal(h.size, 3);
  });
});

// ─── Extract min ordering ────────────────────────────────────────────────────

describe('FibonacciHeap – extract ordering', () => {
  it('extractMin returns items in ascending order', () => {
    const h = new FibonacciHeap();
    h.insert(5);
    h.insert(1);
    h.insert(3);
    h.insert(4);
    h.insert(2);
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it('handles duplicates correctly', () => {
    const h = new FibonacciHeap();
    h.insert(3);
    h.insert(1);
    h.insert(3);
    h.insert(1);
    h.insert(2);
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    assert.deepEqual(result, [1, 1, 2, 3, 3]);
  });

  it('handles already-sorted input', () => {
    const h = new FibonacciHeap();
    for (let i = 1; i <= 10; i++) h.insert(i);
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('handles reverse-sorted input', () => {
    const h = new FibonacciHeap();
    for (let i = 10; i >= 1; i--) h.insert(i);
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

// ─── Custom comparator ──────────────────────────────────────────────────────

describe('FibonacciHeap – custom comparator', () => {
  it('supports max-heap via reversed comparator', () => {
    const h = new FibonacciHeap((a, b) => b - a);
    h.insert(1);
    h.insert(5);
    h.insert(3);
    assert.equal(h.findMin(), 5); // "min" per reversed comparator = max value
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    assert.deepEqual(result, [5, 3, 1]);
  });

  it('supports string comparison', () => {
    const h = new FibonacciHeap((a, b) => a.localeCompare(b));
    h.insert('banana');
    h.insert('apple');
    h.insert('cherry');
    assert.equal(h.findMin(), 'apple');
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    assert.deepEqual(result, ['apple', 'banana', 'cherry']);
  });
});

// ─── Merge ───────────────────────────────────────────────────────────────────

describe('FibonacciHeap – merge', () => {
  it('merges two heaps into a sorted result', () => {
    const a = new FibonacciHeap();
    a.insert(1);
    a.insert(5);
    a.insert(9);
    const b = new FibonacciHeap();
    b.insert(2);
    b.insert(4);
    b.insert(8);
    const merged = a.merge(b);
    assert.equal(merged.size, 6);
    const result = [];
    while (!merged.isEmpty) result.push(merged.extractMin());
    assert.deepEqual(result, [1, 2, 4, 5, 8, 9]);
  });

  it('merge with empty heap returns copy of non-empty', () => {
    const a = new FibonacciHeap();
    a.insert(3);
    a.insert(1);
    const b = new FibonacciHeap();
    const merged = a.merge(b);
    assert.equal(merged.size, 2);
    assert.equal(merged.extractMin(), 1);
    assert.equal(merged.extractMin(), 3);
  });

  it('original heaps are emptied after merge', () => {
    const a = new FibonacciHeap();
    a.insert(10);
    const b = new FibonacciHeap();
    b.insert(20);
    a.merge(b);
    assert.equal(a.size, 0);
    assert.equal(b.size, 0);
  });
});

// ─── clear / toArray ─────────────────────────────────────────────────────────

describe('FibonacciHeap – clear and toArray', () => {
  it('clear resets the heap', () => {
    const h = new FibonacciHeap();
    h.insert(1);
    h.insert(2);
    h.insert(3);
    h.clear();
    assert.equal(h.size, 0);
    assert.equal(h.isEmpty, true);
    assert.equal(h.findMin(), undefined);
  });

  it('toArray returns sorted copy without modifying heap', () => {
    const h = new FibonacciHeap();
    h.insert(5);
    h.insert(1);
    h.insert(3);
    h.insert(4);
    h.insert(2);
    assert.deepEqual(h.toArray(), [1, 2, 3, 4, 5]);
    assert.equal(h.size, 5); // still intact
  });

  it('toArray on empty heap returns empty array', () => {
    const h = new FibonacciHeap();
    assert.deepEqual(h.toArray(), []);
  });
});

// ─── Factory ─────────────────────────────────────────────────────────────────

describe('FibonacciHeap – createFibonacciHeap factory', () => {
  it('creates a working heap with default comparator', () => {
    const h = createFibonacciHeap();
    h.insert(3);
    h.insert(1);
    h.insert(2);
    assert.equal(h.findMin(), 1);
  });

  it('creates a working heap with custom comparator', () => {
    const h = createFibonacciHeap((a, b) => b - a);
    h.insert(3);
    h.insert(1);
    h.insert(2);
    assert.equal(h.findMin(), 3);
  });
});

// ─── Stress test ─────────────────────────────────────────────────────────────

describe('FibonacciHeap – larger input', () => {
  it('correctly sorts 200 random numbers', () => {
    const h = new FibonacciHeap();
    const nums = Array.from({ length: 200 }, () => Math.floor(Math.random() * 1000));
    for (const n of nums) h.insert(n);
    const result = [];
    while (!h.isEmpty) result.push(h.extractMin());
    const sorted = [...nums].sort((a, b) => a - b);
    assert.deepEqual(result, sorted);
  });
});
