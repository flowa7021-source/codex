// ─── Unit Tests: RTree ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RTree, createRTree } from '../../app/modules/r-tree.js';

// ─── constructor ────────────────────────────────────────────────────────────

describe('RTree – constructor', () => {
  it('creates an empty tree with size 0', () => {
    const tree = new RTree();
    assert.equal(tree.size, 0);
  });

  it('accepts a custom maxEntries', () => {
    const tree = new RTree(4);
    assert.equal(tree.size, 0);
  });

  it('throws for maxEntries < 2', () => {
    assert.throws(() => new RTree(1), RangeError);
  });
});

// ─── insert ─────────────────────────────────────────────────────────────────

describe('RTree – insert', () => {
  it('inserts a single rectangle', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    assert.equal(tree.size, 1);
  });

  it('inserts many rectangles', () => {
    const tree = new RTree(4);
    for (let i = 0; i < 50; i++) {
      tree.insert({ minX: i, minY: i, maxX: i + 5, maxY: i + 5 });
    }
    assert.equal(tree.size, 50);
  });

  it('inserts rectangles with data', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 1, maxY: 1, data: 'hello' });
    const results = tree.search({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
    assert.equal(results.length, 1);
    assert.equal(results[0].data, 'hello');
  });
});

// ─── search ─────────────────────────────────────────────────────────────────

describe('RTree – search', () => {
  it('returns empty array for empty tree', () => {
    const tree = new RTree();
    const results = tree.search({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    assert.deepEqual(results, []);
  });

  it('finds intersecting rectangles', () => {
    const tree = new RTree(3);
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    tree.insert({ minX: 20, minY: 20, maxX: 30, maxY: 30 });
    tree.insert({ minX: 5, minY: 5, maxX: 15, maxY: 15 });

    const results = tree.search({ minX: 8, minY: 8, maxX: 12, maxY: 12 });
    assert.equal(results.length, 2);
  });

  it('does not return non-intersecting rectangles', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 5, maxY: 5 });
    tree.insert({ minX: 100, minY: 100, maxX: 105, maxY: 105 });

    const results = tree.search({ minX: 50, minY: 50, maxX: 60, maxY: 60 });
    assert.equal(results.length, 0);
  });

  it('handles edge-touching rectangles as intersecting', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10 });

    // Search bounds touch the edge of the inserted rectangle
    const results = tree.search({ minX: 10, minY: 10, maxX: 20, maxY: 20 });
    assert.equal(results.length, 1);
  });

  it('finds all rectangles when search covers everything', () => {
    const tree = new RTree(3);
    for (let i = 0; i < 20; i++) {
      tree.insert({ minX: i * 10, minY: i * 10, maxX: i * 10 + 5, maxY: i * 10 + 5 });
    }
    const results = tree.search({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });
    assert.equal(results.length, 20);
  });
});

// ─── remove ─────────────────────────────────────────────────────────────────

describe('RTree – remove', () => {
  it('removes an existing rectangle', () => {
    const tree = new RTree();
    const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    tree.insert(rect);
    assert.equal(tree.remove(rect), true);
    assert.equal(tree.size, 0);
  });

  it('returns false for non-existent rectangle', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    assert.equal(tree.remove({ minX: 99, minY: 99, maxX: 100, maxY: 100 }), false);
    assert.equal(tree.size, 1);
  });

  it('removes rectangles with matching data', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10, data: 'a' });
    tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10, data: 'b' });
    assert.equal(tree.size, 2);
    assert.equal(tree.remove({ minX: 0, minY: 0, maxX: 10, maxY: 10, data: 'a' }), true);
    assert.equal(tree.size, 1);
    const results = tree.toArray();
    assert.equal(results[0].data, 'b');
  });

  it('handles removing all items', () => {
    const tree = new RTree(3);
    const rects = [];
    for (let i = 0; i < 10; i++) {
      const r = { minX: i, minY: i, maxX: i + 1, maxY: i + 1 };
      rects.push(r);
      tree.insert(r);
    }
    for (const r of rects) {
      assert.equal(tree.remove(r), true);
    }
    assert.equal(tree.size, 0);
    assert.deepEqual(tree.toArray(), []);
  });
});

// ─── clear ──────────────────────────────────────────────────────────────────

describe('RTree – clear', () => {
  it('removes all entries', () => {
    const tree = new RTree();
    tree.insert({ minX: 0, minY: 0, maxX: 5, maxY: 5 });
    tree.insert({ minX: 10, minY: 10, maxX: 15, maxY: 15 });
    tree.clear();
    assert.equal(tree.size, 0);
    assert.deepEqual(tree.toArray(), []);
  });
});

// ─── toArray ────────────────────────────────────────────────────────────────

describe('RTree – toArray', () => {
  it('returns empty array for empty tree', () => {
    const tree = new RTree();
    assert.deepEqual(tree.toArray(), []);
  });

  it('returns all inserted rectangles', () => {
    const tree = new RTree(3);
    const rects = [
      { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      { minX: 10, minY: 10, maxX: 11, maxY: 11 },
      { minX: 20, minY: 20, maxX: 21, maxY: 21 },
    ];
    for (const r of rects) tree.insert(r);
    const result = tree.toArray();
    assert.equal(result.length, 3);
    // All rects should be present
    for (const r of rects) {
      assert.ok(result.some(x => x.minX === r.minX && x.minY === r.minY));
    }
  });
});

// ─── factory ────────────────────────────────────────────────────────────────

describe('createRTree factory', () => {
  it('creates a working RTree', () => {
    const tree = createRTree(5);
    tree.insert({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
    assert.equal(tree.size, 1);
  });

  it('defaults maxEntries when not specified', () => {
    const tree = createRTree();
    tree.insert({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
    assert.equal(tree.size, 1);
  });
});

// ─── stress / edge cases ────────────────────────────────────────────────────

describe('RTree – stress', () => {
  it('handles many inserts and searches correctly', () => {
    const tree = new RTree(4);
    for (let i = 0; i < 200; i++) {
      tree.insert({ minX: i, minY: i, maxX: i + 2, maxY: i + 2 });
    }
    assert.equal(tree.size, 200);

    // Search a small window
    const results = tree.search({ minX: 50, minY: 50, maxX: 55, maxY: 55 });
    // Should find rects with minX in [49..55] (since maxX = minX+2)
    assert.ok(results.length > 0);
    for (const r of results) {
      assert.ok(r.maxX >= 50 && r.minX <= 55);
    }
  });

  it('handles insert-remove-search cycle', () => {
    const tree = new RTree(3);
    const rects = [];
    for (let i = 0; i < 30; i++) {
      const r = { minX: i * 2, minY: i * 2, maxX: i * 2 + 3, maxY: i * 2 + 3, data: i };
      rects.push(r);
      tree.insert(r);
    }
    // Remove every other rect
    for (let i = 0; i < 30; i += 2) {
      tree.remove(rects[i]);
    }
    assert.equal(tree.size, 15);

    // All remaining should be findable
    const all = tree.toArray();
    assert.equal(all.length, 15);
  });

  it('handles overlapping rectangles at same position', () => {
    const tree = new RTree();
    for (let i = 0; i < 5; i++) {
      tree.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10, data: i });
    }
    assert.equal(tree.size, 5);
    const results = tree.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    assert.equal(results.length, 5);
  });
});
