// ─── Unit Tests: BST ──────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BST, createBST } from '../../app/modules/bst.js';

describe('BST – basic operations', () => {
  it('starts empty', () => {
    const t = new BST();
    assert.equal(t.size, 0);
  });

  it('insert and get', () => {
    const t = new BST();
    t.insert(5, 'five');
    assert.equal(t.get(5), 'five');
  });

  it('has returns true for present key', () => {
    const t = new BST();
    t.insert(3, 'three');
    assert.equal(t.has(3), true);
  });

  it('has returns false for absent key', () => {
    const t = new BST();
    assert.equal(t.has(99), false);
  });

  it('size increments on insert', () => {
    const t = new BST();
    t.insert(1, 'a');
    t.insert(2, 'b');
    assert.equal(t.size, 2);
  });

  it('update existing key', () => {
    const t = new BST();
    t.insert(1, 'old');
    t.insert(1, 'new');
    assert.equal(t.get(1), 'new');
    assert.equal(t.size, 1);
  });
});

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
    t.insert(1, 'a'); t.insert(2, 'b');
    t.delete(1);
    assert.equal(t.size, 1);
  });
});

describe('BST – traversal', () => {
  it('inOrder returns sorted keys', () => {
    const t = new BST();
    [5, 3, 7, 1, 4].forEach(k => t.insert(k, k));
    const keys = t.inOrder().map(([k]) => k);
    assert.deepEqual(keys, [1, 3, 4, 5, 7]);
  });

  it('min and max', () => {
    const t = new BST();
    [5, 3, 7, 1, 4].forEach(k => t.insert(k, k));
    assert.equal(t.min()[0], 1);
    assert.equal(t.max()[0], 7);
  });

  it('min/max return null when empty', () => {
    const t = new BST();
    assert.equal(t.min(), null);
    assert.equal(t.max(), null);
  });
});

describe('BST – height', () => {
  it('height of empty is -1 or 0', () => {
    assert.ok(new BST().height() <= 0);
  });

  it('height of single node is 0', () => {
    const t = new BST();
    t.insert(1, 'x');
    assert.equal(t.height(), 0);
  });
});

describe('createBST factory', () => {
  it('creates a BST', () => {
    const t = createBST();
    t.insert('b', 2);
    t.insert('a', 1);
    assert.deepEqual(t.inOrder().map(([k]) => k), ['a', 'b']);
  });
});
