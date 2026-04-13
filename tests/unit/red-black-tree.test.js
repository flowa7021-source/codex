// ─── Unit Tests: RBTree ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RBTree, createRBTree } from '../../app/modules/red-black-tree.js';

describe('RBTree – construction', () => {
  it('starts empty with size 0', () => {
    const tree = new RBTree();
    assert.equal(tree.size, 0);
    assert.equal(tree.height(), 0);
  });

  it('createRBTree factory returns an RBTree instance', () => {
    const tree = createRBTree();
    assert.ok(tree instanceof RBTree);
    assert.equal(tree.size, 0);
  });
});

describe('RBTree – insertion and lookup', () => {
  it('set/get single entry', () => {
    const tree = new RBTree();
    tree.set(5, 'five');
    assert.equal(tree.get(5), 'five');
    assert.equal(tree.size, 1);
  });

  it('has returns true for existing keys, false for missing', () => {
    const tree = new RBTree();
    tree.set(1, 'a');
    assert.equal(tree.has(1), true);
    assert.equal(tree.has(99), false);
  });

  it('get returns undefined for missing key', () => {
    const tree = new RBTree();
    assert.equal(tree.get(42), undefined);
  });

  it('set overwrites existing key', () => {
    const tree = new RBTree();
    tree.set(1, 'first');
    tree.set(1, 'second');
    assert.equal(tree.get(1), 'second');
    assert.equal(tree.size, 1);
  });

  it('inserts many keys and retrieves all correctly', () => {
    const tree = new RBTree();
    for (let i = 0; i < 100; i++) {
      tree.set(i, `val-${i}`);
    }
    assert.equal(tree.size, 100);
    for (let i = 0; i < 100; i++) {
      assert.equal(tree.get(i), `val-${i}`);
    }
  });
});

describe('RBTree – deletion', () => {
  it('delete existing key returns true and reduces size', () => {
    const tree = new RBTree();
    tree.set(10, 'ten');
    tree.set(20, 'twenty');
    assert.equal(tree.delete(10), true);
    assert.equal(tree.size, 1);
    assert.equal(tree.has(10), false);
  });

  it('delete non-existing key returns false', () => {
    const tree = new RBTree();
    tree.set(1, 'a');
    assert.equal(tree.delete(999), false);
    assert.equal(tree.size, 1);
  });

  it('delete all keys leaves tree empty', () => {
    const tree = new RBTree();
    const keys = [5, 3, 7, 1, 4, 6, 8];
    for (const k of keys) tree.set(k, k);
    for (const k of keys) {
      assert.equal(tree.delete(k), true);
    }
    assert.equal(tree.size, 0);
    assert.equal(tree.min(), null);
  });

  it('delete from a larger tree maintains correct values', () => {
    const tree = new RBTree();
    for (let i = 1; i <= 50; i++) tree.set(i, i * 10);
    // Delete even numbers
    for (let i = 2; i <= 50; i += 2) tree.delete(i);
    assert.equal(tree.size, 25);
    // Odds still present
    for (let i = 1; i <= 50; i += 2) {
      assert.equal(tree.get(i), i * 10);
    }
    // Evens gone
    for (let i = 2; i <= 50; i += 2) {
      assert.equal(tree.has(i), false);
    }
  });
});

describe('RBTree – min / max', () => {
  it('min and max on empty tree return null', () => {
    const tree = new RBTree();
    assert.equal(tree.min(), null);
    assert.equal(tree.max(), null);
  });

  it('min returns smallest, max returns largest', () => {
    const tree = new RBTree();
    tree.set(30, 'c');
    tree.set(10, 'a');
    tree.set(20, 'b');
    assert.deepEqual(tree.min(), [10, 'a']);
    assert.deepEqual(tree.max(), [30, 'c']);
  });
});

describe('RBTree – ordering (keys, values, entries)', () => {
  it('keys returns sorted order', () => {
    const tree = new RBTree();
    for (const k of [5, 3, 8, 1, 4]) tree.set(k, k);
    assert.deepEqual(tree.keys(), [1, 3, 4, 5, 8]);
  });

  it('values returns values in key-sorted order', () => {
    const tree = new RBTree();
    tree.set(2, 'b');
    tree.set(1, 'a');
    tree.set(3, 'c');
    assert.deepEqual(tree.values(), ['a', 'b', 'c']);
  });

  it('entries returns [key, value] pairs sorted', () => {
    const tree = new RBTree();
    tree.set(3, 'c');
    tree.set(1, 'a');
    tree.set(2, 'b');
    assert.deepEqual(tree.entries(), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });
});

describe('RBTree – clear', () => {
  it('clear empties the tree', () => {
    const tree = new RBTree();
    for (let i = 0; i < 10; i++) tree.set(i, i);
    tree.clear();
    assert.equal(tree.size, 0);
    assert.equal(tree.min(), null);
    assert.deepEqual(tree.keys(), []);
  });
});

describe('RBTree – black-height / rebalancing', () => {
  it('height is consistent (black-height) after sequential inserts', () => {
    const tree = new RBTree();
    // Insert 1..31 sequentially (worst case for naive BST)
    for (let i = 1; i <= 31; i++) tree.set(i, i);
    const h = tree.height();
    // For 31 nodes, black-height should be reasonable (between 2 and 6)
    assert.ok(h >= 2, `black-height ${h} too small`);
    assert.ok(h <= 6, `black-height ${h} too large`);
  });

  it('height stays bounded after many inserts and deletes', () => {
    const tree = new RBTree();
    for (let i = 0; i < 200; i++) tree.set(i, i);
    for (let i = 0; i < 100; i++) tree.delete(i);
    // 100 remaining keys — black-height should be small
    const h = tree.height();
    assert.ok(h >= 1 && h <= 8, `black-height ${h} out of expected range`);
    assert.equal(tree.size, 100);
  });
});

describe('RBTree – custom comparator', () => {
  it('reverse comparator stores in descending order', () => {
    const tree = new RBTree((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    tree.set(1, 'a');
    tree.set(2, 'b');
    tree.set(3, 'c');
    // In-order traversal with reversed comparator yields descending keys
    assert.deepEqual(tree.keys(), [3, 2, 1]);
  });

  it('string keys with custom comparator', () => {
    const tree = createRBTree((a, b) => a.localeCompare(b));
    tree.set('banana', 1);
    tree.set('apple', 2);
    tree.set('cherry', 3);
    assert.deepEqual(tree.keys(), ['apple', 'banana', 'cherry']);
  });
});
