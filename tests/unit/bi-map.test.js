// ─── Unit Tests: BiMap ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BiMap, createBiMap } from '../../app/modules/bi-map.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('BiMap – constructor', () => {
  it('creates an empty map with no arguments', () => {
    const bm = new BiMap();
    assert.equal(bm.size, 0);
  });

  it('creates a map from initial entries', () => {
    const bm = new BiMap([['a', 1], ['b', 2], ['c', 3]]);
    assert.equal(bm.size, 3);
    assert.equal(bm.get('a'), 1);
    assert.equal(bm.getKey(3), 'c');
  });
});

// ─── set / get / getKey ──────────────────────────────────────────────────────

describe('BiMap – set / get / getKey', () => {
  it('sets and retrieves a key-value pair', () => {
    const bm = new BiMap();
    bm.set('x', 42);
    assert.equal(bm.get('x'), 42);
    assert.equal(bm.getKey(42), 'x');
  });

  it('returns undefined for missing key or value', () => {
    const bm = new BiMap();
    assert.equal(bm.get('missing'), undefined);
    assert.equal(bm.getKey('missing'), undefined);
  });

  it('replaces existing value when setting same key', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    bm.set('a', 2);
    assert.equal(bm.get('a'), 2);
    assert.equal(bm.getKey(2), 'a');
    assert.equal(bm.hasValue(1), false);
    assert.equal(bm.size, 1);
  });

  it('replaces existing key when setting same value', () => {
    const bm = new BiMap();
    bm.set('a', 1);
    bm.set('b', 1);
    assert.equal(bm.get('b'), 1);
    assert.equal(bm.getKey(1), 'b');
    assert.equal(bm.has('a'), false);
    assert.equal(bm.size, 1);
  });
});

// ─── has / hasValue ──────────────────────────────────────────────────────────

describe('BiMap – has / hasValue', () => {
  it('returns true for existing key and value', () => {
    const bm = new BiMap([['k', 'v']]);
    assert.equal(bm.has('k'), true);
    assert.equal(bm.hasValue('v'), true);
  });

  it('returns false for non-existing key and value', () => {
    const bm = new BiMap();
    assert.equal(bm.has('nope'), false);
    assert.equal(bm.hasValue('nope'), false);
  });
});

// ─── delete / deleteValue ────────────────────────────────────────────────────

describe('BiMap – delete / deleteValue', () => {
  it('deletes by key and cleans up reverse mapping', () => {
    const bm = new BiMap([['a', 1]]);
    assert.equal(bm.delete('a'), true);
    assert.equal(bm.has('a'), false);
    assert.equal(bm.hasValue(1), false);
    assert.equal(bm.size, 0);
  });

  it('returns false when deleting a non-existing key', () => {
    const bm = new BiMap();
    assert.equal(bm.delete('nope'), false);
  });

  it('deletes by value and cleans up forward mapping', () => {
    const bm = new BiMap([['a', 1]]);
    assert.equal(bm.deleteValue(1), true);
    assert.equal(bm.has('a'), false);
    assert.equal(bm.hasValue(1), false);
    assert.equal(bm.size, 0);
  });

  it('returns false when deleting a non-existing value', () => {
    const bm = new BiMap();
    assert.equal(bm.deleteValue('nope'), false);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('BiMap – clear', () => {
  it('removes all entries', () => {
    const bm = new BiMap([['a', 1], ['b', 2]]);
    bm.clear();
    assert.equal(bm.size, 0);
    assert.equal(bm.has('a'), false);
    assert.equal(bm.hasValue(1), false);
  });
});

// ─── keys / values / entries ─────────────────────────────────────────────────

describe('BiMap – keys / values / entries', () => {
  it('returns all keys', () => {
    const bm = new BiMap([['a', 1], ['b', 2]]);
    assert.deepEqual(bm.keys().sort(), ['a', 'b']);
  });

  it('returns all values', () => {
    const bm = new BiMap([['a', 1], ['b', 2]]);
    assert.deepEqual(bm.values().sort(), [1, 2]);
  });

  it('returns all entries', () => {
    const bm = new BiMap([['a', 1], ['b', 2]]);
    const entries = bm.entries().sort((x, y) => (x[0] < y[0] ? -1 : 1));
    assert.deepEqual(entries, [['a', 1], ['b', 2]]);
  });
});

// ─── inverse ─────────────────────────────────────────────────────────────────

describe('BiMap – inverse', () => {
  it('returns a new BiMap with swapped keys and values', () => {
    const bm = new BiMap([['a', 1], ['b', 2]]);
    const inv = bm.inverse();
    assert.equal(inv.get(1), 'a');
    assert.equal(inv.get(2), 'b');
    assert.equal(inv.getKey('a'), 1);
    assert.equal(inv.size, 2);
  });

  it('inverse does not affect the original map', () => {
    const bm = new BiMap([['a', 1]]);
    const inv = bm.inverse();
    inv.set(99, 'z');
    assert.equal(bm.size, 1);
    assert.equal(bm.has('z'), false);
  });
});

// ─── Symbol.iterator ─────────────────────────────────────────────────────────

describe('BiMap – Symbol.iterator', () => {
  it('is iterable with for-of', () => {
    const bm = new BiMap([['a', 1], ['b', 2]]);
    const collected = [];
    for (const pair of bm) {
      collected.push(pair);
    }
    assert.equal(collected.length, 2);
  });

  it('supports spread operator', () => {
    const bm = new BiMap([['x', 10]]);
    const arr = [...bm];
    assert.deepEqual(arr, [['x', 10]]);
  });
});

// ─── createBiMap factory ─────────────────────────────────────────────────────

describe('createBiMap', () => {
  it('creates a BiMap using the factory function', () => {
    const bm = createBiMap([['a', 1]]);
    assert.ok(bm instanceof BiMap);
    assert.equal(bm.get('a'), 1);
  });

  it('creates an empty BiMap when no entries given', () => {
    const bm = createBiMap();
    assert.equal(bm.size, 0);
  });
});
