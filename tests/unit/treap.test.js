// ─── Unit Tests: Treap ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Treap, createTreap } from '../../app/modules/treap.js';

// ─── Basic set / get ─────────────────────────────────────────────────────────

describe('Treap – set / get', () => {
  it('stores and retrieves a single key-value pair', () => {
    const t = new Treap();
    t.set('a', 1);
    assert.equal(t.get('a'), 1);
  });

  it('returns undefined for a missing key', () => {
    const t = new Treap();
    assert.equal(t.get('nope'), undefined);
  });

  it('overwrites the value when the same key is set again', () => {
    const t = new Treap();
    t.set(10, 'first');
    t.set(10, 'second');
    assert.equal(t.get(10), 'second');
    assert.equal(t.size, 1);
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('Treap – has', () => {
  it('returns true for existing key', () => {
    const t = new Treap();
    t.set(5, 'v');
    assert.equal(t.has(5), true);
  });

  it('returns false for missing key', () => {
    const t = new Treap();
    assert.equal(t.has(5), false);
  });
});

// ─── delete ──────────────────────────────────────────────────────────────────

describe('Treap – delete', () => {
  it('removes an existing key and decrements size', () => {
    const t = new Treap();
    t.set(1, 'a');
    t.set(2, 'b');
    assert.equal(t.delete(1), true);
    assert.equal(t.has(1), false);
    assert.equal(t.size, 1);
  });

  it('returns false when deleting a non-existent key', () => {
    const t = new Treap();
    assert.equal(t.delete(42), false);
  });

  it('can delete the only element', () => {
    const t = new Treap();
    t.set('x', 1);
    assert.equal(t.delete('x'), true);
    assert.equal(t.size, 0);
    assert.equal(t.get('x'), undefined);
  });
});

// ─── size ────────────────────────────────────────────────────────────────────

describe('Treap – size', () => {
  it('starts at 0', () => {
    assert.equal(new Treap().size, 0);
  });

  it('tracks insertions and deletions', () => {
    const t = new Treap();
    t.set(1, 'a');
    t.set(2, 'b');
    t.set(3, 'c');
    assert.equal(t.size, 3);
    t.delete(2);
    assert.equal(t.size, 2);
  });
});

// ─── min / max ───────────────────────────────────────────────────────────────

describe('Treap – min / max', () => {
  it('returns null on empty treap', () => {
    const t = new Treap();
    assert.equal(t.min(), null);
    assert.equal(t.max(), null);
  });

  it('returns the smallest and largest entries', () => {
    const t = new Treap();
    for (const v of [5, 3, 8, 1, 9, 2]) {
      t.set(v, `val-${v}`);
    }
    assert.deepEqual(t.min(), [1, 'val-1']);
    assert.deepEqual(t.max(), [9, 'val-9']);
  });
});

// ─── keys / values / entries ─────────────────────────────────────────────────

describe('Treap – iteration helpers', () => {
  it('keys() returns keys in sorted order', () => {
    const t = new Treap();
    for (const v of [30, 10, 20, 50, 40]) {
      t.set(v, v * 2);
    }
    assert.deepEqual(t.keys(), [10, 20, 30, 40, 50]);
  });

  it('values() matches the sorted key order', () => {
    const t = new Treap();
    t.set(2, 'b');
    t.set(1, 'a');
    t.set(3, 'c');
    assert.deepEqual(t.values(), ['a', 'b', 'c']);
  });

  it('entries() returns [key, value] pairs in sorted order', () => {
    const t = new Treap();
    t.set(3, 'c');
    t.set(1, 'a');
    t.set(2, 'b');
    assert.deepEqual(t.entries(), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('Treap – clear', () => {
  it('empties the treap', () => {
    const t = new Treap();
    t.set(1, 'a');
    t.set(2, 'b');
    t.clear();
    assert.equal(t.size, 0);
    assert.equal(t.get(1), undefined);
    assert.deepEqual(t.entries(), []);
  });
});

// ─── custom comparator ──────────────────────────────────────────────────────

describe('Treap – custom comparator', () => {
  it('supports reverse ordering', () => {
    const t = new Treap((a, b) => b - a);
    t.set(1, 'a');
    t.set(3, 'c');
    t.set(2, 'b');
    // Reverse order: keys should be 3, 2, 1 in-order
    assert.deepEqual(t.keys(), [3, 2, 1]);
    assert.deepEqual(t.min(), [3, 'c']);
    assert.deepEqual(t.max(), [1, 'a']);
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('Treap – createTreap factory', () => {
  it('creates a working Treap instance', () => {
    const t = createTreap();
    t.set('hello', 42);
    assert.equal(t.get('hello'), 42);
    assert.ok(t instanceof Treap);
  });
});

// ─── many elements (stress) ──────────────────────────────────────────────────

describe('Treap – many elements', () => {
  it('handles 1000 inserts, lookups, and deletes correctly', () => {
    const t = new Treap();
    for (let i = 0; i < 1000; i++) {
      t.set(i, i * 10);
    }
    assert.equal(t.size, 1000);
    assert.equal(t.get(500), 5000);
    assert.deepEqual(t.min(), [0, 0]);
    assert.deepEqual(t.max(), [999, 9990]);

    // Delete even numbers
    for (let i = 0; i < 1000; i += 2) {
      assert.equal(t.delete(i), true);
    }
    assert.equal(t.size, 500);
    assert.equal(t.has(0), false);
    assert.equal(t.has(1), true);

    // Keys should be all odd numbers in order
    const keys = t.keys();
    assert.equal(keys.length, 500);
    assert.equal(keys[0], 1);
    assert.equal(keys[keys.length - 1], 999);
  });
});
