// ─── Unit Tests: Binary Search Tree ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BST, createBST } from '../../app/modules/bst.js';

// ─── constructor / size ───────────────────────────────────────────────────────

describe('BST – constructor and size', () => {
  it('starts empty with size 0', () => {
    const t = new BST();
    assert.equal(t.size, 0);
  });

  it('size increments on unique insertions', () => {
    const t = new BST();
    t.insert(1, 'a');
    t.insert(2, 'b');
    assert.equal(t.size, 2);
  });

  it('size does not change when updating an existing key', () => {
    const t = new BST();
    t.insert(1, 'old');
    t.insert(1, 'new');
    assert.equal(t.get(1), 'new');
    assert.equal(t.size, 1);
  });

  it('accepts a custom comparator (reverse order)', () => {
    const t = new BST((a, b) => b - a);
    t.insert(1, 'one');
    t.insert(2, 'two');
    t.insert(3, 'three');
    const keys = t.inOrder().map(([k]) => k);
    assert.deepEqual(keys, [3, 2, 1]);
  });
});

// ─── insert / get ─────────────────────────────────────────────────────────────

describe('BST – insert and get', () => {
  it('insert and get a single value', () => {
    const t = new BST();
    t.insert(5, 'five');
    assert.equal(t.get(5), 'five');
  });

  it('get returns undefined for absent keys', () => {
    const t = new BST();
    t.insert(1, 'one');
    assert.equal(t.get(99), undefined);
  });

  it('get returns undefined on empty tree', () => {
    const t = new BST();
    assert.equal(t.get(42), undefined);
  });

  it('updates value when key already exists', () => {
    const t = new BST();
    t.insert(42, 'first');
    t.insert(42, 'second');
    assert.equal(t.get(42), 'second');
  });

  it('works with string keys', () => {
    const t = new BST();
    t.insert('banana', 2);
    t.insert('apple', 1);
    t.insert('cherry', 3);
    assert.equal(t.get('apple'), 1);
    assert.equal(t.get('cherry'), 3);
  });

  it('retrieves multiple entries in a tree with many nodes', () => {
    const t = new BST();
    [10, 5, 15, 3, 7, 12, 20].forEach(k => t.insert(k, k * 10));
    assert.equal(t.get(3), 30);
    assert.equal(t.get(12), 120);
    assert.equal(t.get(20), 200);
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('BST – has', () => {
  it('returns true for present keys', () => {
    const t = new BST();
    t.insert(3, 'three');
    assert.equal(t.has(3), true);
  });

  it('returns false for absent keys', () => {
    const t = new BST();
    assert.equal(t.has(99), false);
  });

  it('returns false after deletion', () => {
    const t = new BST();
    t.insert(5, 'v');
    t.delete(5);
    assert.equal(t.has(5), false);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('BST – delete', () => {
  it('delete returns true and removes key', () => {
    const t = new BST();
    t.insert(5, 'x');
    assert.equal(t.delete(5), true);
    assert.equal(t.has(5), false);
  });

  it('delete returns false for absent key', () => {
    const t = new BST();
    assert.equal(t.delete(99), false);
  });

  it('delete reduces size', () => {
    const t = new BST();
    t.insert(1, 'a');
    t.insert(2, 'b');
    t.delete(1);
    assert.equal(t.size, 1);
  });

  it('deletes a leaf node correctly', () => {
    const t = new BST();
    t.insert(5, 'root');
    t.insert(3, 'left-leaf');
    t.delete(3);
    assert.equal(t.has(3), false);
    assert.equal(t.size, 1);
  });

  it('deletes a node with one child', () => {
    const t = new BST();
    t.insert(10, 'root');
    t.insert(5, 'left');
    t.insert(3, 'leaf');
    t.delete(5);
    assert.equal(t.has(5), false);
    assert.equal(t.has(3), true);
    assert.equal(t.size, 2);
  });

  it('deletes a node with two children', () => {
    const t = new BST();
    [10, 5, 15, 3, 7].forEach(k => t.insert(k, k * 2));
    t.delete(5);
    assert.equal(t.has(5), false);
    assert.equal(t.has(3), true);
    assert.equal(t.has(7), true);
    assert.equal(t.size, 4);
  });

  it('deletes the root when it is the only node', () => {
    const t = new BST();
    t.insert(1, 'only');
    t.delete(1);
    assert.equal(t.size, 0);
    assert.equal(t.min(), null);
  });

  it('maintains BST ordering after multiple deletions', () => {
    const t = new BST();
    [4, 2, 6, 1, 3, 5, 7].forEach(k => t.insert(k, k));
    t.delete(2);
    t.delete(6);
    const keys = t.inOrder().map(([k]) => k);
    assert.deepEqual(keys, [1, 3, 4, 5, 7]);
  });
});

// ─── min / max ────────────────────────────────────────────────────────────────

describe('BST – traversal', () => {
  it('inOrder returns sorted keys', () => {
    const t = new BST();
    [5, 3, 7, 1, 4].forEach(k => t.insert(k, k));
    const keys = t.inOrder().map(([k]) => k);
    assert.deepEqual(keys, [1, 3, 4, 5, 7]);
  });

  it('min returns smallest key-value pair', () => {
    const t = new BST();
    [5, 3, 7, 1, 4].forEach(k => t.insert(k, k));
    assert.equal(t.min()[0], 1);
  });

  it('max returns largest key-value pair', () => {
    const t = new BST();
    [5, 3, 7, 1, 4].forEach(k => t.insert(k, k));
    assert.equal(t.max()[0], 7);
  });

  it('min/max return null when empty', () => {
    const t = new BST();
    assert.equal(t.min(), null);
    assert.equal(t.max(), null);
  });

  it('preOrder visits root before children', () => {
    const t = new BST();
    t.insert(5, 5);
    t.insert(3, 3);
    t.insert(7, 7);
    const keys = t.preOrder().map(([k]) => k);
    assert.equal(keys[0], 5);
    assert.equal(keys.length, 3);
  });

  it('postOrder visits root last', () => {
    const t = new BST();
    t.insert(5, 5);
    t.insert(3, 3);
    t.insert(7, 7);
    const keys = t.postOrder().map(([k]) => k);
    assert.equal(keys[keys.length - 1], 5);
    assert.equal(keys.length, 3);
  });

  it('all traversals return empty array for empty tree', () => {
    const t = new BST();
    assert.deepEqual(t.inOrder(), []);
    assert.deepEqual(t.preOrder(), []);
    assert.deepEqual(t.postOrder(), []);
  });

  it('single-node tree: all traversals return that node', () => {
    const t = new BST();
    t.insert(42, 'answer');
    assert.deepEqual(t.inOrder(), [[42, 'answer']]);
    assert.deepEqual(t.preOrder(), [[42, 'answer']]);
    assert.deepEqual(t.postOrder(), [[42, 'answer']]);
  });
});

// ─── height ───────────────────────────────────────────────────────────────────

describe('BST – height', () => {
  it('height of empty is -1 or 0 (not positive)', () => {
    assert.ok(new BST().height() <= 0);
  });

  it('height of single node is 0', () => {
    const t = new BST();
    t.insert(1, 'x');
    assert.equal(t.height(), 0);
  });

  it('height grows with skewed insertion', () => {
    const t = new BST();
    [1, 2, 3, 4, 5].forEach(k => t.insert(k, k));
    assert.ok(t.height() >= 3);
  });

  it('returns correct height for a balanced-ish tree', () => {
    const t = new BST();
    t.insert(4, 4);
    t.insert(2, 2);
    t.insert(6, 6);
    t.insert(1, 1);
    t.insert(3, 3);
    t.insert(5, 5);
    t.insert(7, 7);
    assert.equal(t.height(), 2);
  });
});

// ─── createBST factory ────────────────────────────────────────────────────────

describe('createBST factory', () => {
  it('creates a BST', () => {
    const t = createBST();
    t.insert('b', 2);
    t.insert('a', 1);
    assert.deepEqual(t.inOrder().map(([k]) => k), ['a', 'b']);
  });

  it('returns a BST instance', () => {
    const t = createBST();
    assert.ok(t instanceof BST);
  });

  it('factory accepts a custom comparator', () => {
    const t = createBST((a, b) => b - a);
    [3, 1, 2].forEach(k => t.insert(k, k));
    const keys = t.inOrder().map(([k]) => k);
    assert.deepEqual(keys, [3, 2, 1]);
  });
});
