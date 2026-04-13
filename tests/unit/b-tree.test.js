// ─── Unit Tests: BTree ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BTree, createBTree } from '../../app/modules/b-tree.js';

// ─── constructor ────────────────────────────────────────────────────────────

describe('BTree – constructor', () => {
  it('creates an empty tree with size 0', () => {
    const tree = new BTree();
    assert.equal(tree.size, 0);
  });

  it('accepts a custom order', () => {
    const tree = new BTree(5);
    assert.equal(tree.size, 0);
  });

  it('throws for order < 2', () => {
    assert.throws(() => new BTree(1), RangeError);
  });
});

// ─── set / get / has ────────────────────────────────────────────────────────

describe('BTree – set / get / has', () => {
  it('inserts and retrieves a single key', () => {
    const tree = new BTree();
    tree.set(10, 'ten');
    assert.equal(tree.get(10), 'ten');
    assert.equal(tree.has(10), true);
    assert.equal(tree.size, 1);
  });

  it('returns undefined for missing key', () => {
    const tree = new BTree();
    assert.equal(tree.get(42), undefined);
    assert.equal(tree.has(42), false);
  });

  it('updates existing key without changing size', () => {
    const tree = new BTree();
    tree.set(1, 'a');
    tree.set(1, 'b');
    assert.equal(tree.get(1), 'b');
    assert.equal(tree.size, 1);
  });

  it('handles many insertions (triggers splits)', () => {
    const tree = new BTree(2);
    for (let i = 0; i < 100; i++) {
      tree.set(i, `val${i}`);
    }
    assert.equal(tree.size, 100);
    for (let i = 0; i < 100; i++) {
      assert.equal(tree.get(i), `val${i}`);
    }
  });

  it('works with string keys and custom comparator', () => {
    const tree = new BTree(3, (a, b) => a.localeCompare(b));
    tree.set('banana', 2);
    tree.set('apple', 1);
    tree.set('cherry', 3);
    assert.equal(tree.get('apple'), 1);
    assert.equal(tree.get('banana'), 2);
    assert.equal(tree.get('cherry'), 3);
  });
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe('BTree – delete', () => {
  it('removes an existing key', () => {
    const tree = new BTree();
    tree.set(5, 'five');
    assert.equal(tree.delete(5), true);
    assert.equal(tree.has(5), false);
    assert.equal(tree.size, 0);
  });

  it('returns false for non-existent key', () => {
    const tree = new BTree();
    tree.set(1, 'one');
    assert.equal(tree.delete(99), false);
    assert.equal(tree.size, 1);
  });

  it('handles deleting all keys', () => {
    const tree = new BTree(2);
    const keys = [10, 20, 5, 15, 25, 3, 8, 12, 18, 30];
    for (const k of keys) tree.set(k, k);
    for (const k of keys) {
      assert.equal(tree.delete(k), true);
    }
    assert.equal(tree.size, 0);
  });

  it('maintains correct ordering after deletions', () => {
    const tree = new BTree(2);
    for (let i = 1; i <= 20; i++) tree.set(i, i);
    tree.delete(5);
    tree.delete(10);
    tree.delete(15);
    const keys = tree.keys();
    const expected = [];
    for (let i = 1; i <= 20; i++) {
      if (i !== 5 && i !== 10 && i !== 15) expected.push(i);
    }
    assert.deepEqual(keys, expected);
  });
});

// ─── min / max ──────────────────────────────────────────────────────────────

describe('BTree – min / max', () => {
  it('returns null on empty tree', () => {
    const tree = new BTree();
    assert.equal(tree.min(), null);
    assert.equal(tree.max(), null);
  });

  it('returns correct min and max', () => {
    const tree = new BTree(2);
    tree.set(50, 'a');
    tree.set(10, 'b');
    tree.set(90, 'c');
    tree.set(30, 'd');
    tree.set(70, 'e');
    assert.deepEqual(tree.min(), [10, 'b']);
    assert.deepEqual(tree.max(), [90, 'c']);
  });
});

// ─── keys / entries ─────────────────────────────────────────────────────────

describe('BTree – keys / entries', () => {
  it('returns keys in sorted order', () => {
    const tree = new BTree(2);
    tree.set(3, 'c');
    tree.set(1, 'a');
    tree.set(2, 'b');
    tree.set(5, 'e');
    tree.set(4, 'd');
    assert.deepEqual(tree.keys(), [1, 2, 3, 4, 5]);
  });

  it('returns entries in sorted order', () => {
    const tree = new BTree(2);
    tree.set(2, 'b');
    tree.set(1, 'a');
    tree.set(3, 'c');
    assert.deepEqual(tree.entries(), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('returns empty arrays for empty tree', () => {
    const tree = new BTree();
    assert.deepEqual(tree.keys(), []);
    assert.deepEqual(tree.entries(), []);
  });
});

// ─── clear ──────────────────────────────────────────────────────────────────

describe('BTree – clear', () => {
  it('removes all entries', () => {
    const tree = new BTree();
    tree.set(1, 'a');
    tree.set(2, 'b');
    tree.clear();
    assert.equal(tree.size, 0);
    assert.equal(tree.get(1), undefined);
    assert.deepEqual(tree.keys(), []);
  });
});

// ─── height ─────────────────────────────────────────────────────────────────

describe('BTree – height', () => {
  it('returns 0 for empty tree', () => {
    const tree = new BTree();
    assert.equal(tree.height(), 0);
  });

  it('returns 1 for a single-node tree', () => {
    const tree = new BTree();
    tree.set(1, 'a');
    assert.equal(tree.height(), 1);
  });

  it('increases with more insertions', () => {
    const tree = new BTree(2);
    for (let i = 0; i < 50; i++) tree.set(i, i);
    assert.ok(tree.height() >= 2);
  });
});

// ─── factory ────────────────────────────────────────────────────────────────

describe('createBTree factory', () => {
  it('creates a working BTree', () => {
    const tree = createBTree(3);
    tree.set(1, 'one');
    assert.equal(tree.get(1), 'one');
    assert.equal(tree.size, 1);
  });

  it('defaults order when not specified', () => {
    const tree = createBTree();
    tree.set('x', 1);
    assert.equal(tree.get('x'), 1);
  });
});

// ─── stress / edge cases ────────────────────────────────────────────────────

describe('BTree – stress', () => {
  it('handles insert-delete-reinsert cycle', () => {
    const tree = new BTree(3);
    for (let i = 0; i < 50; i++) tree.set(i, i * 10);
    for (let i = 0; i < 50; i += 2) tree.delete(i);
    assert.equal(tree.size, 25);
    for (let i = 0; i < 50; i += 2) tree.set(i, i * 100);
    assert.equal(tree.size, 50);
    assert.equal(tree.get(0), 0);
    assert.equal(tree.get(1), 10);
    assert.equal(tree.get(2), 200);
  });

  it('handles reverse-order insertions', () => {
    const tree = new BTree(2);
    for (let i = 99; i >= 0; i--) tree.set(i, i);
    assert.equal(tree.size, 100);
    assert.deepEqual(tree.min(), [0, 0]);
    assert.deepEqual(tree.max(), [99, 99]);
    const keys = tree.keys();
    for (let i = 0; i < 100; i++) {
      assert.equal(keys[i], i);
    }
  });
});
