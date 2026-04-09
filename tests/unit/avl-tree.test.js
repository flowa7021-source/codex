// ─── Unit Tests: AVLTree ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AVLTree, createAVLTree } from '../../app/modules/avl-tree.js';

describe('AVLTree – construction', () => {
  it('starts empty with size 0 and height 0', () => {
    const tree = new AVLTree();
    assert.equal(tree.size, 0);
    assert.equal(tree.height(), 0);
    assert.equal(tree.isBalanced(), true);
  });

  it('createAVLTree factory returns an AVLTree instance', () => {
    const tree = createAVLTree();
    assert.ok(tree instanceof AVLTree);
    assert.equal(tree.size, 0);
  });
});

describe('AVLTree – insertion and lookup', () => {
  it('set/get single entry', () => {
    const tree = new AVLTree();
    tree.set(5, 'five');
    assert.equal(tree.get(5), 'five');
    assert.equal(tree.size, 1);
    assert.equal(tree.height(), 1);
  });

  it('has returns true for existing keys, false for missing', () => {
    const tree = new AVLTree();
    tree.set(1, 'a');
    assert.equal(tree.has(1), true);
    assert.equal(tree.has(99), false);
  });

  it('get returns undefined for missing key', () => {
    const tree = new AVLTree();
    assert.equal(tree.get(42), undefined);
  });

  it('set overwrites existing key', () => {
    const tree = new AVLTree();
    tree.set(1, 'first');
    tree.set(1, 'second');
    assert.equal(tree.get(1), 'second');
    assert.equal(tree.size, 1);
  });

  it('inserts many keys and retrieves all correctly', () => {
    const tree = new AVLTree();
    for (let i = 0; i < 100; i++) {
      tree.set(i, `val-${i}`);
    }
    assert.equal(tree.size, 100);
    for (let i = 0; i < 100; i++) {
      assert.equal(tree.get(i), `val-${i}`);
    }
    assert.equal(tree.isBalanced(), true);
  });
});

describe('AVLTree – deletion', () => {
  it('delete existing key returns true and reduces size', () => {
    const tree = new AVLTree();
    tree.set(10, 'ten');
    tree.set(20, 'twenty');
    assert.equal(tree.delete(10), true);
    assert.equal(tree.size, 1);
    assert.equal(tree.has(10), false);
    assert.equal(tree.isBalanced(), true);
  });

  it('delete non-existing key returns false', () => {
    const tree = new AVLTree();
    tree.set(1, 'a');
    assert.equal(tree.delete(999), false);
    assert.equal(tree.size, 1);
  });

  it('delete all keys leaves tree empty', () => {
    const tree = new AVLTree();
    const keys = [5, 3, 7, 1, 4, 6, 8];
    for (const k of keys) tree.set(k, k);
    for (const k of keys) {
      assert.equal(tree.delete(k), true);
    }
    assert.equal(tree.size, 0);
    assert.equal(tree.min(), null);
    assert.equal(tree.isBalanced(), true);
  });

  it('delete from a larger tree maintains correct values and balance', () => {
    const tree = new AVLTree();
    for (let i = 1; i <= 50; i++) tree.set(i, i * 10);
    // Delete even numbers
    for (let i = 2; i <= 50; i += 2) tree.delete(i);
    assert.equal(tree.size, 25);
    assert.equal(tree.isBalanced(), true);
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

describe('AVLTree – min / max', () => {
  it('min and max on empty tree return null', () => {
    const tree = new AVLTree();
    assert.equal(tree.min(), null);
    assert.equal(tree.max(), null);
  });

  it('min returns smallest, max returns largest', () => {
    const tree = new AVLTree();
    tree.set(30, 'c');
    tree.set(10, 'a');
    tree.set(20, 'b');
    assert.deepEqual(tree.min(), [10, 'a']);
    assert.deepEqual(tree.max(), [30, 'c']);
    assert.equal(tree.isBalanced(), true);
  });
});

describe('AVLTree – ordering (keys, values, entries)', () => {
  it('keys returns sorted order', () => {
    const tree = new AVLTree();
    for (const k of [5, 3, 8, 1, 4]) tree.set(k, k);
    assert.deepEqual(tree.keys(), [1, 3, 4, 5, 8]);
  });

  it('values returns values in key-sorted order', () => {
    const tree = new AVLTree();
    tree.set(2, 'b');
    tree.set(1, 'a');
    tree.set(3, 'c');
    assert.deepEqual(tree.values(), ['a', 'b', 'c']);
  });

  it('entries returns [key, value] pairs sorted', () => {
    const tree = new AVLTree();
    tree.set(3, 'c');
    tree.set(1, 'a');
    tree.set(2, 'b');
    assert.deepEqual(tree.entries(), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });
});

describe('AVLTree – clear', () => {
  it('clear empties the tree', () => {
    const tree = new AVLTree();
    for (let i = 0; i < 10; i++) tree.set(i, i);
    tree.clear();
    assert.equal(tree.size, 0);
    assert.equal(tree.height(), 0);
    assert.equal(tree.min(), null);
    assert.deepEqual(tree.keys(), []);
    assert.equal(tree.isBalanced(), true);
  });
});

describe('AVLTree – height and balance', () => {
  it('height is logarithmic after sequential inserts', () => {
    const tree = new AVLTree();
    // Insert 1..31 sequentially (worst case for naive BST)
    for (let i = 1; i <= 31; i++) tree.set(i, i);
    const h = tree.height();
    // AVL tree of 31 nodes: height should be at most ceil(1.44 * log2(33)) ~ 7
    assert.ok(h >= 5, `height ${h} too small for 31 nodes`);
    assert.ok(h <= 7, `height ${h} too large for 31 nodes`);
    assert.equal(tree.isBalanced(), true);
  });

  it('isBalanced returns true after many inserts and deletes', () => {
    const tree = new AVLTree();
    for (let i = 0; i < 200; i++) tree.set(i, i);
    for (let i = 0; i < 100; i++) tree.delete(i);
    assert.equal(tree.size, 100);
    assert.equal(tree.isBalanced(), true);
  });

  it('isBalanced holds after random-order inserts', () => {
    const tree = new AVLTree();
    // Pseudo-random insertion order
    const keys = [42, 17, 88, 5, 23, 71, 99, 2, 11, 35, 60, 80, 95, 1, 9];
    for (const k of keys) tree.set(k, k);
    assert.equal(tree.isBalanced(), true);
    assert.equal(tree.size, keys.length);
  });
});

describe('AVLTree – custom comparator', () => {
  it('reverse comparator stores in descending order', () => {
    const tree = new AVLTree((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    tree.set(1, 'a');
    tree.set(2, 'b');
    tree.set(3, 'c');
    // In-order traversal with reversed comparator yields descending keys
    assert.deepEqual(tree.keys(), [3, 2, 1]);
    assert.equal(tree.isBalanced(), true);
  });

  it('string keys with custom comparator', () => {
    const tree = createAVLTree((a, b) => a.localeCompare(b));
    tree.set('banana', 1);
    tree.set('apple', 2);
    tree.set('cherry', 3);
    assert.deepEqual(tree.keys(), ['apple', 'banana', 'cherry']);
  });
});

describe('AVLTree – rebalancing on specific rotation patterns', () => {
  it('right-right case triggers left rotation', () => {
    const tree = new AVLTree();
    tree.set(1, 'a');
    tree.set(2, 'b');
    tree.set(3, 'c'); // triggers RR -> left rotation
    assert.equal(tree.isBalanced(), true);
    assert.deepEqual(tree.keys(), [1, 2, 3]);
  });

  it('left-left case triggers right rotation', () => {
    const tree = new AVLTree();
    tree.set(3, 'c');
    tree.set(2, 'b');
    tree.set(1, 'a'); // triggers LL -> right rotation
    assert.equal(tree.isBalanced(), true);
    assert.deepEqual(tree.keys(), [1, 2, 3]);
  });

  it('left-right case triggers double rotation', () => {
    const tree = new AVLTree();
    tree.set(3, 'c');
    tree.set(1, 'a');
    tree.set(2, 'b'); // triggers LR -> left then right rotation
    assert.equal(tree.isBalanced(), true);
    assert.deepEqual(tree.keys(), [1, 2, 3]);
  });

  it('right-left case triggers double rotation', () => {
    const tree = new AVLTree();
    tree.set(1, 'a');
    tree.set(3, 'c');
    tree.set(2, 'b'); // triggers RL -> right then left rotation
    assert.equal(tree.isBalanced(), true);
    assert.deepEqual(tree.keys(), [1, 2, 3]);
  });
});
