// ─── Unit Tests: SplayTree ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SplayTree, createSplayTree } from '../../app/modules/splay-tree.js';

// ─── Basic set / get ─────────────────────────────────────────────────────────

describe('SplayTree – set / get', () => {
  it('stores and retrieves a single key-value pair', () => {
    const st = new SplayTree();
    st.set('a', 1);
    assert.equal(st.get('a'), 1);
  });

  it('returns undefined for a missing key', () => {
    const st = new SplayTree();
    assert.equal(st.get('nope'), undefined);
  });

  it('overwrites the value when the same key is set again', () => {
    const st = new SplayTree();
    st.set(10, 'first');
    st.set(10, 'second');
    assert.equal(st.get(10), 'second');
    assert.equal(st.size, 1);
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('SplayTree – has', () => {
  it('returns true for existing key', () => {
    const st = new SplayTree();
    st.set(5, 'v');
    assert.equal(st.has(5), true);
  });

  it('returns false for missing key', () => {
    const st = new SplayTree();
    assert.equal(st.has(5), false);
  });
});

// ─── delete ──────────────────────────────────────────────────────────────────

describe('SplayTree – delete', () => {
  it('removes an existing key and decrements size', () => {
    const st = new SplayTree();
    st.set(1, 'a');
    st.set(2, 'b');
    assert.equal(st.delete(1), true);
    assert.equal(st.has(1), false);
    assert.equal(st.size, 1);
  });

  it('returns false when deleting a non-existent key', () => {
    const st = new SplayTree();
    assert.equal(st.delete(42), false);
  });

  it('can delete the only element', () => {
    const st = new SplayTree();
    st.set('x', 1);
    assert.equal(st.delete('x'), true);
    assert.equal(st.size, 0);
    assert.equal(st.get('x'), undefined);
  });
});

// ─── size ────────────────────────────────────────────────────────────────────

describe('SplayTree – size', () => {
  it('starts at 0', () => {
    assert.equal(new SplayTree().size, 0);
  });

  it('tracks insertions and deletions', () => {
    const st = new SplayTree();
    st.set(1, 'a');
    st.set(2, 'b');
    st.set(3, 'c');
    assert.equal(st.size, 3);
    st.delete(2);
    assert.equal(st.size, 2);
  });
});

// ─── min / max ───────────────────────────────────────────────────────────────

describe('SplayTree – min / max', () => {
  it('returns null on empty tree', () => {
    const st = new SplayTree();
    assert.equal(st.min(), null);
    assert.equal(st.max(), null);
  });

  it('returns the smallest and largest entries', () => {
    const st = new SplayTree();
    for (const v of [5, 3, 8, 1, 9, 2]) {
      st.set(v, `val-${v}`);
    }
    assert.deepEqual(st.min(), [1, 'val-1']);
    assert.deepEqual(st.max(), [9, 'val-9']);
  });
});

// ─── keys / values / entries ─────────────────────────────────────────────────

describe('SplayTree – iteration helpers', () => {
  it('keys() returns keys in sorted order', () => {
    const st = new SplayTree();
    for (const v of [30, 10, 20, 50, 40]) {
      st.set(v, v * 2);
    }
    assert.deepEqual(st.keys(), [10, 20, 30, 40, 50]);
  });

  it('values() matches the sorted key order', () => {
    const st = new SplayTree();
    st.set(2, 'b');
    st.set(1, 'a');
    st.set(3, 'c');
    assert.deepEqual(st.values(), ['a', 'b', 'c']);
  });

  it('entries() returns [key, value] pairs in sorted order', () => {
    const st = new SplayTree();
    st.set(3, 'c');
    st.set(1, 'a');
    st.set(2, 'b');
    assert.deepEqual(st.entries(), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('SplayTree – clear', () => {
  it('empties the tree', () => {
    const st = new SplayTree();
    st.set(1, 'a');
    st.set(2, 'b');
    st.clear();
    assert.equal(st.size, 0);
    assert.equal(st.get(1), undefined);
    assert.deepEqual(st.entries(), []);
  });
});

// ─── custom comparator ──────────────────────────────────────────────────────

describe('SplayTree – custom comparator', () => {
  it('supports reverse ordering', () => {
    const st = new SplayTree((a, b) => b - a);
    st.set(1, 'a');
    st.set(3, 'c');
    st.set(2, 'b');
    assert.deepEqual(st.keys(), [3, 2, 1]);
    assert.deepEqual(st.min(), [3, 'c']);
    assert.deepEqual(st.max(), [1, 'a']);
  });
});

// ─── splay behaviour ────────────────────────────────────────────────────────

describe('SplayTree – splay behaviour', () => {
  it('get() moves accessed element to root (still yields correct results)', () => {
    const st = new SplayTree();
    st.set(1, 'a');
    st.set(2, 'b');
    st.set(3, 'c');
    st.set(4, 'd');
    st.set(5, 'e');

    // Access element 1 — it should be splayed to root
    assert.equal(st.get(1), 'a');

    // Tree still functions correctly
    assert.deepEqual(st.keys(), [1, 2, 3, 4, 5]);
    assert.equal(st.size, 5);
  });

  it('repeated access to same key does not corrupt tree', () => {
    const st = new SplayTree();
    for (let i = 0; i < 20; i++) {
      st.set(i, i);
    }
    // Repeatedly access the same key
    for (let i = 0; i < 50; i++) {
      assert.equal(st.get(10), 10);
    }
    assert.equal(st.size, 20);
    assert.deepEqual(st.min(), [0, 0]);
    assert.deepEqual(st.max(), [19, 19]);
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('SplayTree – createSplayTree factory', () => {
  it('creates a working SplayTree instance', () => {
    const st = createSplayTree();
    st.set('hello', 42);
    assert.equal(st.get('hello'), 42);
    assert.ok(st instanceof SplayTree);
  });
});

// ─── many elements (stress) ──────────────────────────────────────────────────

describe('SplayTree – many elements', () => {
  it('handles 1000 inserts, lookups, and deletes correctly', () => {
    const st = new SplayTree();
    for (let i = 0; i < 1000; i++) {
      st.set(i, i * 10);
    }
    assert.equal(st.size, 1000);
    assert.equal(st.get(500), 5000);
    assert.deepEqual(st.min(), [0, 0]);
    assert.deepEqual(st.max(), [999, 9990]);

    // Delete even numbers
    for (let i = 0; i < 1000; i += 2) {
      assert.equal(st.delete(i), true);
    }
    assert.equal(st.size, 500);
    assert.equal(st.has(0), false);
    assert.equal(st.has(1), true);

    const keys = st.keys();
    assert.equal(keys.length, 500);
    assert.equal(keys[0], 1);
    assert.equal(keys[keys.length - 1], 999);
  });
});
