// ─── Unit Tests: SkipList ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SkipList, createSkipList } from '../../app/modules/skip-list.js';

// ─── Construction ────────────────────────────────────────────────────────────

describe('SkipList – construction', () => {
  it('starts with size 0', () => {
    const sl = new SkipList();
    assert.equal(sl.size, 0);
  });

  it('createSkipList factory returns a SkipList instance', () => {
    const sl = createSkipList();
    assert.ok(sl instanceof SkipList);
    assert.equal(sl.size, 0);
  });

  it('createSkipList with a custom comparator returns a SkipList', () => {
    const sl = createSkipList((a, b) => a - b);
    assert.ok(sl instanceof SkipList);
  });
});

// ─── set / get / has ─────────────────────────────────────────────────────────

describe('SkipList – set / get / has', () => {
  it('set and get a single entry', () => {
    const sl = new SkipList();
    sl.set(5, 'five');
    assert.equal(sl.get(5), 'five');
    assert.equal(sl.size, 1);
  });

  it('has returns true for existing key', () => {
    const sl = new SkipList();
    sl.set(1, 'a');
    assert.equal(sl.has(1), true);
  });

  it('has returns false for missing key', () => {
    const sl = new SkipList();
    assert.equal(sl.has(999), false);
  });

  it('get returns undefined for missing key', () => {
    const sl = new SkipList();
    assert.equal(sl.get(42), undefined);
  });

  it('set overwrites an existing key and keeps size the same', () => {
    const sl = new SkipList();
    sl.set(1, 'first');
    sl.set(1, 'second');
    assert.equal(sl.get(1), 'second');
    assert.equal(sl.size, 1);
  });

  it('inserts many keys and retrieves all correctly', () => {
    const sl = new SkipList();
    for (let i = 0; i < 100; i++) sl.set(i, `val-${i}`);
    assert.equal(sl.size, 100);
    for (let i = 0; i < 100; i++) {
      assert.equal(sl.get(i), `val-${i}`, `missing key ${i}`);
    }
  });

  it('string keys work with default comparator', () => {
    const sl = new SkipList();
    sl.set('banana', 2);
    sl.set('apple', 1);
    sl.set('cherry', 3);
    assert.equal(sl.get('apple'), 1);
    assert.equal(sl.get('banana'), 2);
    assert.equal(sl.get('cherry'), 3);
  });
});

// ─── delete ──────────────────────────────────────────────────────────────────

describe('SkipList – delete', () => {
  it('delete existing key returns true and reduces size', () => {
    const sl = new SkipList();
    sl.set(10, 'ten');
    sl.set(20, 'twenty');
    assert.equal(sl.delete(10), true);
    assert.equal(sl.has(10), false);
    assert.equal(sl.size, 1);
  });

  it('delete non-existing key returns false', () => {
    const sl = new SkipList();
    sl.set(1, 'a');
    assert.equal(sl.delete(999), false);
    assert.equal(sl.size, 1);
  });

  it('can delete the only element leaving an empty list', () => {
    const sl = new SkipList();
    sl.set(42, 'x');
    assert.equal(sl.delete(42), true);
    assert.equal(sl.size, 0);
    assert.equal(sl.get(42), undefined);
  });

  it('can delete and re-insert a key', () => {
    const sl = new SkipList();
    sl.set(3, 'a');
    sl.delete(3);
    sl.set(3, 'b');
    assert.equal(sl.get(3), 'b');
    assert.equal(sl.size, 1);
  });

  it('deleting all keys leaves an empty list', () => {
    const sl = new SkipList();
    for (const k of [5, 3, 7, 1, 4]) sl.set(k, k);
    for (const k of [5, 3, 7, 1, 4]) sl.delete(k);
    assert.equal(sl.size, 0);
    assert.deepEqual(sl.keys(), []);
  });
});

// ─── keys / values / entries ─────────────────────────────────────────────────

describe('SkipList – keys / values / entries', () => {
  function populate() {
    const sl = new SkipList();
    for (const k of [5, 3, 8, 1, 4, 9, 2, 7, 6]) sl.set(k, `v${k}`);
    return sl;
  }

  it('keys() returns keys in sorted ascending order', () => {
    assert.deepEqual(populate().keys(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('values() returns values in key-sorted order', () => {
    assert.deepEqual(
      populate().values(),
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `v${k}`),
    );
  });

  it('entries() returns [key, value] pairs in sorted order', () => {
    const entries = populate().entries();
    assert.equal(entries.length, 9);
    assert.deepEqual(entries[0], [1, 'v1']);
    assert.deepEqual(entries[8], [9, 'v9']);
  });

  it('keys() on empty list returns []', () => {
    assert.deepEqual(new SkipList().keys(), []);
  });

  it('values() on empty list returns []', () => {
    assert.deepEqual(new SkipList().values(), []);
  });

  it('entries() on empty list returns []', () => {
    assert.deepEqual(new SkipList().entries(), []);
  });

  it('entries maintain sorted order after mixed inserts and deletes', () => {
    const sl = new SkipList();
    for (let i = 10; i >= 1; i--) sl.set(i, i * 10);
    sl.delete(3);
    sl.delete(7);
    const keys = sl.keys();
    assert.deepEqual(keys, [1, 2, 4, 5, 6, 8, 9, 10]);
  });
});

// ─── range ───────────────────────────────────────────────────────────────────

describe('SkipList – range', () => {
  it('returns entries within [lo, hi] inclusive', () => {
    const sl = new SkipList();
    for (let i = 1; i <= 10; i++) sl.set(i, `v${i}`);
    assert.deepEqual(sl.range(3, 7), [
      [3, 'v3'],
      [4, 'v4'],
      [5, 'v5'],
      [6, 'v6'],
      [7, 'v7'],
    ]);
  });

  it('returns empty array when range has no matching keys', () => {
    const sl = new SkipList();
    sl.set(1, 'a');
    sl.set(10, 'b');
    assert.deepEqual(sl.range(4, 8), []);
  });

  it('single element range when lo === hi and key exists', () => {
    const sl = new SkipList();
    sl.set(5, 'five');
    assert.deepEqual(sl.range(5, 5), [[5, 'five']]);
  });

  it('returns empty array on empty list', () => {
    const sl = new SkipList();
    assert.deepEqual(sl.range(1, 100), []);
  });

  it('range spanning the whole list returns all entries', () => {
    const sl = new SkipList();
    for (let i = 1; i <= 5; i++) sl.set(i, `v${i}`);
    assert.equal(sl.range(1, 5).length, 5);
  });
});

// ─── Custom comparator ───────────────────────────────────────────────────────

describe('SkipList – custom comparator', () => {
  it('descending numeric order via custom comparator', () => {
    const sl = new SkipList((a, b) => b - a);
    sl.set(1, 'one');
    sl.set(3, 'three');
    sl.set(2, 'two');
    assert.deepEqual(sl.keys(), [3, 2, 1]);
  });

  it('string keys sorted by locale compare', () => {
    const sl = createSkipList((a, b) => a.localeCompare(b));
    sl.set('banana', 2);
    sl.set('apple', 1);
    sl.set('cherry', 3);
    assert.deepEqual(sl.keys(), ['apple', 'banana', 'cherry']);
  });

  it('range works correctly with custom comparator', () => {
    const sl = new SkipList((a, b) => b - a); // descending: 5 < 4 < 3 ...
    for (let i = 1; i <= 5; i++) sl.set(i, `v${i}`);
    // In descending order, "range(5, 3)" means keys from 5 down to 3
    const result = sl.range(5, 3);
    assert.deepEqual(
      result.map((e) => e[0]),
      [5, 4, 3],
    );
  });
});

// ─── Stress ──────────────────────────────────────────────────────────────────

describe('SkipList – stress', () => {
  it('1000 insertions maintain sorted order', () => {
    const sl = new SkipList();
    for (let i = 0; i < 1000; i++) sl.set(Math.floor(Math.random() * 1e6), i);
    const keys = sl.keys();
    for (let i = 1; i < keys.length; i++) {
      assert.ok(keys[i] >= keys[i - 1], `unsorted at index ${i}`);
    }
  });

  it('repeated insert-delete cycles maintain correct size', () => {
    const sl = new SkipList();
    for (let i = 0; i < 200; i++) sl.set(i, i);
    for (let i = 0; i < 100; i++) sl.delete(i);
    assert.equal(sl.size, 100);
    for (let i = 100; i < 200; i++) {
      assert.equal(sl.has(i), true, `key ${i} should be present`);
    }
  });
});
