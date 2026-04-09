// ─── Unit Tests: skip-list ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SkipList,
  createSkipList,
} from '../../app/modules/skip-list.js';

// ─── Basic operations ───────────────────────────────────────────────────────

describe('SkipList basic operations', () => {
  it('starts empty with size 0', () => {
    const sl = new SkipList();
    assert.equal(sl.size, 0);
  });

  it('set/get stores and retrieves a value', () => {
    const sl = new SkipList();
    sl.set(5, 'five');
    assert.equal(sl.get(5), 'five');
    assert.equal(sl.size, 1);
  });

  it('has returns true for existing keys', () => {
    const sl = new SkipList();
    sl.set(1, 'one');
    assert.equal(sl.has(1), true);
    assert.equal(sl.has(2), false);
  });

  it('set overwrites existing key value', () => {
    const sl = new SkipList();
    sl.set(1, 'a');
    sl.set(1, 'b');
    assert.equal(sl.get(1), 'b');
    assert.equal(sl.size, 1);
  });

  it('get returns undefined for missing keys', () => {
    const sl = new SkipList();
    assert.equal(sl.get(999), undefined);
  });
});

// ─── Delete ─────────────────────────────────────────────────────────────────

describe('SkipList delete', () => {
  it('removes an existing key and returns true', () => {
    const sl = new SkipList();
    sl.set(10, 'ten');
    assert.equal(sl.delete(10), true);
    assert.equal(sl.has(10), false);
    assert.equal(sl.size, 0);
  });

  it('returns false for non-existent key', () => {
    const sl = new SkipList();
    assert.equal(sl.delete(42), false);
  });

  it('can delete and re-insert a key', () => {
    const sl = new SkipList();
    sl.set(3, 'a');
    sl.delete(3);
    sl.set(3, 'b');
    assert.equal(sl.get(3), 'b');
    assert.equal(sl.size, 1);
  });
});

// ─── Ordering & iteration ───────────────────────────────────────────────────

describe('SkipList ordering', () => {
  function populatedList() {
    const sl = new SkipList();
    for (const k of [5, 3, 8, 1, 4, 9, 2, 7, 6]) {
      sl.set(k, `v${k}`);
    }
    return sl;
  }

  it('keys() returns keys in sorted order', () => {
    const sl = populatedList();
    assert.deepEqual(sl.keys(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('values() returns values in key-sorted order', () => {
    const sl = populatedList();
    assert.deepEqual(
      sl.values(),
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `v${k}`),
    );
  });

  it('entries() returns [key, value] pairs in order', () => {
    const sl = populatedList();
    const entries = sl.entries();
    assert.equal(entries.length, 9);
    assert.deepEqual(entries[0], [1, 'v1']);
    assert.deepEqual(entries[8], [9, 'v9']);
  });
});

// ─── min / max ──────────────────────────────────────────────────────────────

describe('SkipList min/max', () => {
  it('min and max return null on empty list', () => {
    const sl = new SkipList();
    assert.equal(sl.min(), null);
    assert.equal(sl.max(), null);
  });

  it('min returns the smallest entry', () => {
    const sl = new SkipList();
    sl.set(10, 'a');
    sl.set(3, 'b');
    sl.set(7, 'c');
    assert.deepEqual(sl.min(), [3, 'b']);
  });

  it('max returns the largest entry', () => {
    const sl = new SkipList();
    sl.set(10, 'a');
    sl.set(3, 'b');
    sl.set(7, 'c');
    assert.deepEqual(sl.max(), [10, 'a']);
  });
});

// ─── Range query ────────────────────────────────────────────────────────────

describe('SkipList range', () => {
  it('returns entries within [low, high] inclusive', () => {
    const sl = new SkipList();
    for (let i = 1; i <= 10; i++) sl.set(i, `v${i}`);
    const result = sl.range(3, 7);
    assert.deepEqual(result, [
      [3, 'v3'],
      [4, 'v4'],
      [5, 'v5'],
      [6, 'v6'],
      [7, 'v7'],
    ]);
  });

  it('returns empty array when range has no elements', () => {
    const sl = new SkipList();
    sl.set(1, 'a');
    sl.set(10, 'b');
    assert.deepEqual(sl.range(5, 8), []);
  });

  it('returns single element when low equals high and key exists', () => {
    const sl = new SkipList();
    sl.set(5, 'five');
    assert.deepEqual(sl.range(5, 5), [[5, 'five']]);
  });
});

// ─── Custom comparator ──────────────────────────────────────────────────────

describe('SkipList with custom comparator', () => {
  it('supports reverse numeric order', () => {
    const sl = new SkipList((a, b) => b - a);
    sl.set(1, 'one');
    sl.set(3, 'three');
    sl.set(2, 'two');
    // In descending order, keys should be 3, 2, 1
    assert.deepEqual(sl.keys(), [3, 2, 1]);
    assert.deepEqual(sl.min(), [3, 'three']);
    assert.deepEqual(sl.max(), [1, 'one']);
  });

  it('supports string keys with default comparator', () => {
    const sl = new SkipList();
    sl.set('banana', 2);
    sl.set('apple', 1);
    sl.set('cherry', 3);
    assert.deepEqual(sl.keys(), ['apple', 'banana', 'cherry']);
  });
});

// ─── Factory function ───────────────────────────────────────────────────────

describe('createSkipList', () => {
  it('returns a working SkipList instance', () => {
    const sl = createSkipList();
    assert.ok(sl instanceof SkipList);
    sl.set('x', 1);
    assert.equal(sl.get('x'), 1);
  });
});

// ─── Stress: many inserts maintain order ────────────────────────────────────

describe('SkipList stress', () => {
  it('handles 1000 insertions and maintains sorted order', () => {
    const sl = new SkipList();
    const values = [];
    for (let i = 0; i < 1000; i++) {
      const v = Math.floor(Math.random() * 100000);
      values.push(v);
      sl.set(v, v);
    }
    const keys = sl.keys();
    for (let i = 1; i < keys.length; i++) {
      assert.ok(keys[i] >= keys[i - 1], `keys not sorted at index ${i}`);
    }
  });
});
