// ─── Unit Tests: BTree ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BTree } from '../../app/modules/btree.js';

// ─── Basic insert / get / has ────────────────────────────────────────────────

describe('BTree – basic insert, get, has', () => {
  it('starts empty', () => {
    const tree = new BTree();
    assert.equal(tree.size, 0);
  });

  it('inserts and retrieves a single entry', () => {
    const tree = new BTree();
    tree.set(1, 'one');
    assert.equal(tree.get(1), 'one');
    assert.equal(tree.size, 1);
  });

  it('has() returns true for present keys', () => {
    const tree = new BTree();
    tree.set('x', 42);
    assert.equal(tree.has('x'), true);
  });

  it('has() returns false for absent keys', () => {
    const tree = new BTree();
    assert.equal(tree.has('missing'), false);
  });

  it('get() returns undefined for absent keys', () => {
    const tree = new BTree();
    assert.equal(tree.get(99), undefined);
  });

  it('updates an existing key without incrementing size', () => {
    const tree = new BTree();
    tree.set('k', 1);
    tree.set('k', 2);
    assert.equal(tree.get('k'), 2);
    assert.equal(tree.size, 1);
  });

  it('inserts many entries and retrieves all correctly', () => {
    const tree = new BTree();
    for (let i = 0; i < 100; i++) tree.set(i, i * 2);
    for (let i = 0; i < 100; i++) assert.equal(tree.get(i), i * 2);
    assert.equal(tree.size, 100);
  });
});

// ─── Delete ──────────────────────────────────────────────────────────────────

describe('BTree – delete', () => {
  it('returns false when deleting a missing key', () => {
    const tree = new BTree();
    assert.equal(tree.delete(42), false);
  });

  it('deletes a single entry and size drops to 0', () => {
    const tree = new BTree();
    tree.set(1, 'a');
    assert.equal(tree.delete(1), true);
    assert.equal(tree.size, 0);
    assert.equal(tree.has(1), false);
  });

  it('deletes a key that requires merging', () => {
    const tree = new BTree(2); // t=2 → each node has [1, 3] keys
    for (let i = 1; i <= 10; i++) tree.set(i, i);
    assert.equal(tree.delete(5), true);
    assert.equal(tree.has(5), false);
    assert.equal(tree.size, 9);
    // Remaining keys are still retrievable.
    for (let i = 1; i <= 10; i++) {
      if (i === 5) continue;
      assert.equal(tree.get(i), i);
    }
  });

  it('deletes all entries one by one, ending empty', () => {
    const tree = new BTree();
    const N = 30;
    for (let i = 0; i < N; i++) tree.set(i, i);
    for (let i = 0; i < N; i++) {
      assert.equal(tree.delete(i), true);
    }
    assert.equal(tree.size, 0);
  });

  it('deletes root key correctly', () => {
    const tree = new BTree();
    tree.set(10, 'ten');
    tree.set(20, 'twenty');
    tree.set(5, 'five');
    assert.equal(tree.delete(10), true);
    assert.equal(tree.has(10), false);
    assert.equal(tree.size, 2);
  });
});

// ─── Sorted traversal ────────────────────────────────────────────────────────

describe('BTree – keys / values / entries in sorted order', () => {
  it('returns keys in ascending order after random inserts', () => {
    const tree = new BTree();
    const nums = [50, 10, 90, 30, 70, 20, 80, 40, 60];
    for (const n of nums) tree.set(n, String(n));
    assert.deepEqual(tree.keys(), [...nums].sort((a, b) => a - b));
  });

  it('returns values in key order', () => {
    const tree = new BTree();
    tree.set(3, 'three');
    tree.set(1, 'one');
    tree.set(2, 'two');
    assert.deepEqual(tree.values(), ['one', 'two', 'three']);
  });

  it('returns entries as [key, value] pairs in key order', () => {
    const tree = new BTree();
    tree.set(2, 'b');
    tree.set(1, 'a');
    tree.set(3, 'c');
    assert.deepEqual(tree.entries(), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });
});

// ─── Range query ─────────────────────────────────────────────────────────────

describe('BTree – range query', () => {
  function buildTree() {
    const tree = new BTree();
    for (let i = 1; i <= 20; i++) tree.set(i, i * 10);
    return tree;
  }

  it('returns all entries in [lo, hi]', () => {
    const tree = buildTree();
    const res = tree.range(5, 10);
    assert.deepEqual(res, [[5, 50], [6, 60], [7, 70], [8, 80], [9, 90], [10, 100]]);
  });

  it('returns empty array when range is outside all keys', () => {
    const tree = buildTree();
    assert.deepEqual(tree.range(100, 200), []);
  });

  it('returns a single entry when lo === hi and key exists', () => {
    const tree = buildTree();
    assert.deepEqual(tree.range(7, 7), [[7, 70]]);
  });

  it('returns empty array when lo === hi and key is absent', () => {
    const tree = buildTree();
    assert.deepEqual(tree.range(99, 99), []);
  });

  it('handles a range that spans the entire tree', () => {
    const tree = buildTree();
    const all = tree.range(1, 20);
    assert.equal(all.length, 20);
    assert.deepEqual(all[0], [1, 10]);
    assert.deepEqual(all[19], [20, 200]);
  });
});

// ─── Height stays logarithmic ────────────────────────────────────────────────

describe('BTree – height stays low for large n', () => {
  it('height ≤ ceil(log_t(n+1)) for 1000 entries with t=3', () => {
    const t = 3;
    const n = 1000;
    const tree = new BTree(t);
    for (let i = 0; i < n; i++) tree.set(i, i);
    // Upper bound from CLRS: height ≤ log_{t}(n+1)
    const maxHeight = Math.ceil(Math.log(n + 1) / Math.log(t));
    assert.ok(
      tree.height <= maxHeight,
      `height ${tree.height} exceeded expected maximum ${maxHeight}`,
    );
  });

  it('height is 1 for an empty tree', () => {
    assert.equal(new BTree().height, 1);
  });

  it('height grows slowly: 10000 entries with t=5 has height ≤ 7', () => {
    const tree = new BTree(5);
    for (let i = 0; i < 10000; i++) tree.set(i, i);
    assert.ok(tree.height <= 7, `height was ${tree.height}`);
  });
});

// ─── Custom comparator ────────────────────────────────────────────────────────

describe('BTree – custom comparator', () => {
  it('supports reverse (descending) order', () => {
    const tree = new BTree(3, (a, b) => b - a); // reverse numeric
    for (const n of [3, 1, 4, 1, 5, 9, 2, 6]) tree.set(n, n);
    // keys() should now be descending
    assert.deepEqual(tree.keys(), [9, 6, 5, 4, 3, 2, 1]);
  });

  it('supports string length comparator', () => {
    const cmp = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
    const tree = new BTree(3, cmp);
    for (const s of ['banana', 'fig', 'apple', 'kiwi', 'date']) tree.set(s, s.length);
    const ks = tree.keys();
    // Shorter strings first.
    assert.equal(ks[0], 'fig');
    assert.equal(ks[ks.length - 1], 'banana');
  });

  it('has() and get() respect the custom comparator', () => {
    const tree = new BTree(3, (a, b) => b - a);
    tree.set(10, 'ten');
    tree.set(5, 'five');
    assert.equal(tree.has(10), true);
    assert.equal(tree.get(5), 'five');
  });
});

// ─── Constructor validation ────────────────────────────────────────────────────

describe('BTree – constructor validation', () => {
  it('throws RangeError when t < 2', () => {
    assert.throws(() => new BTree(1), RangeError);
  });

  it('accepts t = 2 without error', () => {
    assert.doesNotThrow(() => new BTree(2));
  });
});
