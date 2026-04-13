// ─── Unit Tests: BinarySearchTree ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BinarySearchTree, createBST } from '../../app/modules/binary-search-tree.js';

// ─── Insert and size ─────────────────────────────────────────────────────────

describe('BinarySearchTree – insert and size', () => {
  it('starts with size 0', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.size, 0);
  });

  it('size increases with each unique insert', () => {
    const bst = new BinarySearchTree();
    bst.insert(5);
    assert.equal(bst.size, 1);
    bst.insert(3);
    assert.equal(bst.size, 2);
    bst.insert(7);
    assert.equal(bst.size, 3);
  });

  it('does not increase size on duplicate insert', () => {
    const bst = new BinarySearchTree();
    bst.insert(10);
    bst.insert(10);
    bst.insert(10);
    assert.equal(bst.size, 1);
  });

  it('inserts multiple values correctly', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.equal(bst.size, 7);
  });

  it('can insert negative numbers', () => {
    const bst = new BinarySearchTree();
    bst.insert(-5);
    bst.insert(-10);
    bst.insert(0);
    assert.equal(bst.size, 3);
  });

  it('can insert a single value', () => {
    const bst = new BinarySearchTree();
    bst.insert(42);
    assert.equal(bst.size, 1);
  });
});

// ─── has() / find() ──────────────────────────────────────────────────────────

describe('BinarySearchTree – has() / find()', () => {
  it('has() returns false on empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.has(1), false);
  });

  it('has() returns true for inserted value', () => {
    const bst = new BinarySearchTree();
    bst.insert(42);
    assert.equal(bst.has(42), true);
  });

  it('has() returns false for absent value', () => {
    const bst = new BinarySearchTree();
    bst.insert(10);
    assert.equal(bst.has(99), false);
  });

  it('has() works on multiple values', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    assert.equal(bst.has(3), true);
    assert.equal(bst.has(7), true);
    assert.equal(bst.has(4), false);
  });

  it('find() returns undefined on empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.find(1), undefined);
  });

  it('find() returns the value when found', () => {
    const bst = new BinarySearchTree();
    bst.insert(55);
    assert.equal(bst.find(55), 55);
  });

  it('find() returns undefined when value is absent', () => {
    const bst = new BinarySearchTree();
    bst.insert(10);
    assert.equal(bst.find(20), undefined);
  });

  it('find() returns the stored object identity for custom types', () => {
    const cmp = (a, b) => a.id - b.id;
    const bst = new BinarySearchTree(cmp);
    const obj = { id: 1, name: 'Alice' };
    bst.insert(obj);
    const found = bst.find({ id: 1 });
    assert.equal(found, obj); // same reference
  });
});

// ─── delete() ────────────────────────────────────────────────────────────────

describe('BinarySearchTree – delete()', () => {
  it('returns false when deleting from empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.delete(5), false);
  });

  it('returns false when value is not in the tree', () => {
    const bst = new BinarySearchTree();
    bst.insert(10);
    assert.equal(bst.delete(99), false);
  });

  it('deletes a leaf node', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    assert.equal(bst.delete(3), true);
    assert.equal(bst.has(3), false);
    assert.equal(bst.size, 2);
  });

  it('deletes a node with only a left child', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 1]) bst.insert(v);
    assert.equal(bst.delete(3), true);
    assert.equal(bst.has(3), false);
    assert.equal(bst.has(1), true);
    assert.equal(bst.size, 2);
  });

  it('deletes a node with only a right child', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 4]) bst.insert(v);
    assert.equal(bst.delete(3), true);
    assert.equal(bst.has(3), false);
    assert.equal(bst.has(4), true);
    assert.equal(bst.size, 2);
  });

  it('deletes a node with two children', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.equal(bst.delete(3), true);
    assert.equal(bst.has(3), false);
    assert.equal(bst.has(1), true);
    assert.equal(bst.has(4), true);
    assert.equal(bst.size, 6);
  });

  it('deletes the root node', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    assert.equal(bst.delete(5), true);
    assert.equal(bst.has(5), false);
    assert.equal(bst.size, 2);
    // remaining values still accessible
    assert.equal(bst.has(3), true);
    assert.equal(bst.has(7), true);
  });

  it('tree is still valid BST after multiple deletes', () => {
    const bst = new BinarySearchTree();
    for (const v of [10, 5, 15, 3, 7, 12, 20]) bst.insert(v);
    bst.delete(5);
    bst.delete(15);
    const sorted = bst.inOrder();
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i] >= sorted[i - 1]);
    }
  });

  it('size decrements correctly after delete', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 2, 3]) bst.insert(v);
    bst.delete(2);
    assert.equal(bst.size, 2);
  });
});

// ─── height() ────────────────────────────────────────────────────────────────

describe('BinarySearchTree – height()', () => {
  it('returns 0 for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.height, 0);
  });

  it('returns 1 for single-node tree', () => {
    const bst = new BinarySearchTree();
    bst.insert(5);
    assert.equal(bst.height, 1);
  });

  it('returns 2 for a two-level tree', () => {
    const bst = new BinarySearchTree();
    bst.insert(5);
    bst.insert(3);
    assert.equal(bst.height, 2);
  });

  it('returns correct height for balanced tree', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.equal(bst.height, 3);
  });

  it('returns correct height for right-skewed tree', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 2, 3, 4, 5]) bst.insert(v);
    assert.equal(bst.height, 5);
  });

  it('height decreases after deleting nodes', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 2, 3, 4, 5]) bst.insert(v);
    bst.delete(5);
    bst.delete(4);
    assert.equal(bst.height, 3);
  });
});

// ─── inOrder / preOrder / postOrder / levelOrder ──────────────────────────────

describe('BinarySearchTree – traversals', () => {
  it('inOrder returns empty array for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.deepEqual(bst.inOrder(), []);
  });

  it('inOrder returns sorted ascending order', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.deepEqual(bst.inOrder(), [1, 3, 4, 5, 6, 7, 8]);
  });

  it('inOrder returns single element for single-node tree', () => {
    const bst = new BinarySearchTree();
    bst.insert(42);
    assert.deepEqual(bst.inOrder(), [42]);
  });

  it('preOrder returns empty array for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.deepEqual(bst.preOrder(), []);
  });

  it('preOrder visits root first', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    const result = bst.preOrder();
    assert.equal(result[0], 5);
  });

  it('preOrder returns correct order', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.deepEqual(bst.preOrder(), [5, 3, 1, 4, 7, 6, 8]);
  });

  it('postOrder returns empty array for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.deepEqual(bst.postOrder(), []);
  });

  it('postOrder visits root last', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    const result = bst.postOrder();
    assert.equal(result[result.length - 1], 5);
  });

  it('postOrder returns correct order', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.deepEqual(bst.postOrder(), [1, 4, 3, 6, 8, 7, 5]);
  });

  it('levelOrder returns empty array for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.deepEqual(bst.levelOrder(), []);
  });

  it('levelOrder returns root first', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    const result = bst.levelOrder();
    assert.equal(result[0], 5);
  });

  it('levelOrder returns breadth-first order', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    assert.deepEqual(bst.levelOrder(), [5, 3, 7, 1, 4, 6, 8]);
  });

  it('all traversals contain same elements as inserted', () => {
    const bst = new BinarySearchTree();
    const values = [10, 5, 15, 3, 7, 12, 20];
    for (const v of values) bst.insert(v);
    const sorted = [...values].sort((a, b) => a - b);
    assert.deepEqual(bst.inOrder(), sorted);
    assert.deepEqual([...bst.preOrder()].sort((a, b) => a - b), sorted);
    assert.deepEqual([...bst.postOrder()].sort((a, b) => a - b), sorted);
    assert.deepEqual([...bst.levelOrder()].sort((a, b) => a - b), sorted);
  });
});

// ─── min() / max() ───────────────────────────────────────────────────────────

describe('BinarySearchTree – min() / max()', () => {
  it('min() returns undefined for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.min(), undefined);
  });

  it('max() returns undefined for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.max(), undefined);
  });

  it('min() returns the only element in a single-node tree', () => {
    const bst = new BinarySearchTree();
    bst.insert(7);
    assert.equal(bst.min(), 7);
  });

  it('max() returns the only element in a single-node tree', () => {
    const bst = new BinarySearchTree();
    bst.insert(7);
    assert.equal(bst.max(), 7);
  });

  it('min() returns the smallest value', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 9]) bst.insert(v);
    assert.equal(bst.min(), 1);
  });

  it('max() returns the largest value', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 9]) bst.insert(v);
    assert.equal(bst.max(), 9);
  });

  it('min() and max() are same for single element', () => {
    const bst = new BinarySearchTree();
    bst.insert(42);
    assert.equal(bst.min(), bst.max());
  });
});

// ─── floor() / ceil() ────────────────────────────────────────────────────────

describe('BinarySearchTree – floor() / ceil()', () => {
  it('floor() returns undefined on empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.floor(5), undefined);
  });

  it('ceil() returns undefined on empty tree', () => {
    const bst = new BinarySearchTree();
    assert.equal(bst.ceil(5), undefined);
  });

  it('floor() returns exact match when value exists', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    assert.equal(bst.floor(5), 5);
  });

  it('ceil() returns exact match when value exists', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    assert.equal(bst.ceil(5), 5);
  });

  it('floor() returns largest value less than target', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 3, 5, 7, 9]) bst.insert(v);
    assert.equal(bst.floor(6), 5);
  });

  it('ceil() returns smallest value greater than target', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 3, 5, 7, 9]) bst.insert(v);
    assert.equal(bst.ceil(6), 7);
  });

  it('floor() returns undefined when target is smaller than all values', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 8, 10]) bst.insert(v);
    assert.equal(bst.floor(2), undefined);
  });

  it('ceil() returns undefined when target is larger than all values', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 3, 5]) bst.insert(v);
    assert.equal(bst.ceil(10), undefined);
  });

  it('floor() returns max when target >= all values', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 3, 5]) bst.insert(v);
    assert.equal(bst.floor(100), 5);
  });

  it('ceil() returns min when target <= all values', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 7, 9]) bst.insert(v);
    assert.equal(bst.ceil(0), 5);
  });

  it('floor() works with the minimum value in the tree', () => {
    const bst = new BinarySearchTree();
    for (const v of [2, 4, 6, 8]) bst.insert(v);
    assert.equal(bst.floor(2), 2);
    assert.equal(bst.floor(3), 2);
  });

  it('ceil() works with the maximum value in the tree', () => {
    const bst = new BinarySearchTree();
    for (const v of [2, 4, 6, 8]) bst.insert(v);
    assert.equal(bst.ceil(8), 8);
    assert.equal(bst.ceil(7), 8);
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('BinarySearchTree – clear()', () => {
  it('clear() on empty tree does nothing', () => {
    const bst = new BinarySearchTree();
    bst.clear();
    assert.equal(bst.size, 0);
  });

  it('clear() resets size to 0', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 2, 3, 4, 5]) bst.insert(v);
    bst.clear();
    assert.equal(bst.size, 0);
  });

  it('clear() removes all values', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    bst.clear();
    assert.equal(bst.has(5), false);
    assert.equal(bst.has(3), false);
    assert.equal(bst.has(7), false);
  });

  it('clear() resets height to 0', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    bst.clear();
    assert.equal(bst.height, 0);
  });

  it('inOrder() returns empty array after clear()', () => {
    const bst = new BinarySearchTree();
    for (const v of [1, 2, 3]) bst.insert(v);
    bst.clear();
    assert.deepEqual(bst.inOrder(), []);
  });

  it('can insert values after clear()', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    bst.clear();
    bst.insert(10);
    assert.equal(bst.size, 1);
    assert.equal(bst.has(10), true);
  });
});

// ─── Custom comparator (string BST) ──────────────────────────────────────────

describe('BinarySearchTree – custom comparator', () => {
  it('accepts a string comparator', () => {
    const bst = new BinarySearchTree((a, b) => a.localeCompare(b));
    bst.insert('banana');
    bst.insert('apple');
    bst.insert('cherry');
    assert.equal(bst.size, 3);
  });

  it('inOrder returns strings in lexicographic order', () => {
    const bst = new BinarySearchTree((a, b) => a.localeCompare(b));
    for (const s of ['banana', 'apple', 'cherry', 'date']) bst.insert(s);
    assert.deepEqual(bst.inOrder(), ['apple', 'banana', 'cherry', 'date']);
  });

  it('has() works with custom comparator', () => {
    const bst = new BinarySearchTree((a, b) => a.localeCompare(b));
    bst.insert('hello');
    assert.equal(bst.has('hello'), true);
    assert.equal(bst.has('world'), false);
  });

  it('min() and max() work with strings', () => {
    const bst = new BinarySearchTree((a, b) => a.localeCompare(b));
    for (const s of ['mango', 'apple', 'zebra']) bst.insert(s);
    assert.equal(bst.min(), 'apple');
    assert.equal(bst.max(), 'zebra');
  });

  it('floor() works with string comparator', () => {
    const bst = new BinarySearchTree((a, b) => a.localeCompare(b));
    for (const s of ['apple', 'cherry', 'mango']) bst.insert(s);
    assert.equal(bst.floor('banana'), 'apple');
    assert.equal(bst.ceil('banana'), 'cherry');
  });

  it('duplicate strings are not inserted', () => {
    const bst = new BinarySearchTree((a, b) => a.localeCompare(b));
    bst.insert('hello');
    bst.insert('hello');
    assert.equal(bst.size, 1);
  });
});

// ─── toArray() ───────────────────────────────────────────────────────────────

describe('BinarySearchTree – toArray()', () => {
  it('toArray() returns same result as inOrder()', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 1, 9, 3, 7]) bst.insert(v);
    assert.deepEqual(bst.toArray(), bst.inOrder());
  });

  it('toArray() returns empty array for empty tree', () => {
    const bst = new BinarySearchTree();
    assert.deepEqual(bst.toArray(), []);
  });
});

// ─── Iterator (for...of) ─────────────────────────────────────────────────────

describe('BinarySearchTree – Iterator', () => {
  it('for...of yields values in ascending order', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7, 1, 4, 6, 8]) bst.insert(v);
    const result = [];
    for (const v of bst) result.push(v);
    assert.deepEqual(result, [1, 3, 4, 5, 6, 7, 8]);
  });

  it('for...of on empty tree yields nothing', () => {
    const bst = new BinarySearchTree();
    const result = [];
    for (const v of bst) result.push(v);
    assert.deepEqual(result, []);
  });

  it('spread operator works with iterator', () => {
    const bst = new BinarySearchTree();
    for (const v of [3, 1, 2]) bst.insert(v);
    assert.deepEqual([...bst], [1, 2, 3]);
  });

  it('destructuring works with iterator', () => {
    const bst = new BinarySearchTree();
    for (const v of [10, 20, 30]) bst.insert(v);
    const [first, second, third] = bst;
    assert.equal(first, 10);
    assert.equal(second, 20);
    assert.equal(third, 30);
  });

  it('Array.from works with iterator', () => {
    const bst = new BinarySearchTree();
    for (const v of [4, 2, 6]) bst.insert(v);
    assert.deepEqual(Array.from(bst), [2, 4, 6]);
  });

  it('multiple iterations yield same result', () => {
    const bst = new BinarySearchTree();
    for (const v of [5, 3, 7]) bst.insert(v);
    const first = [...bst];
    const second = [...bst];
    assert.deepEqual(first, second);
  });
});

// ─── createBST factory ───────────────────────────────────────────────────────

describe('createBST factory', () => {
  it('returns a BinarySearchTree instance', () => {
    const bst = createBST();
    assert.ok(bst instanceof BinarySearchTree);
  });

  it('created instance has size 0', () => {
    const bst = createBST();
    assert.equal(bst.size, 0);
  });

  it('created instance supports all operations', () => {
    const bst = createBST();
    bst.insert(5);
    bst.insert(3);
    bst.insert(7);
    assert.equal(bst.size, 3);
    assert.equal(bst.has(3), true);
    assert.deepEqual(bst.inOrder(), [3, 5, 7]);
  });

  it('createBST accepts a custom comparator', () => {
    const bst = createBST((a, b) => b - a); // reverse numeric
    for (const v of [5, 3, 7]) bst.insert(v);
    // With reverse comparator, inOrder gives descending
    assert.deepEqual(bst.inOrder(), [7, 5, 3]);
  });

  it('createBST without comparator works for numbers', () => {
    const bst = createBST();
    for (const v of [10, 2, 8, 4, 6]) bst.insert(v);
    assert.equal(bst.min(), 2);
    assert.equal(bst.max(), 10);
  });
});
