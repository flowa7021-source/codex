// ─── Unit Tests: MultiMap ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MultiMap, createMultiMap } from '../../app/modules/multi-map.js';

// ─── set / get ───────────────────────────────────────────────────────────────

describe('MultiMap – set / get', () => {
  it('adds a single value to a key', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    assert.deepEqual(mm.get('a'), [1]);
  });

  it('adds multiple values to the same key', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('a', 3);
    assert.deepEqual(mm.get('a'), [1, 2, 3]);
  });

  it('returns empty array for missing key', () => {
    const mm = new MultiMap();
    assert.deepEqual(mm.get('missing'), []);
  });

  it('returns a copy of the values array, not a reference', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    const arr = mm.get('a');
    arr.push(999);
    assert.deepEqual(mm.get('a'), [1]);
  });
});

// ─── has / hasEntry ──────────────────────────────────────────────────────────

describe('MultiMap – has / hasEntry', () => {
  it('returns true for existing key', () => {
    const mm = new MultiMap();
    mm.set('x', 10);
    assert.equal(mm.has('x'), true);
  });

  it('returns false for non-existing key', () => {
    const mm = new MultiMap();
    assert.equal(mm.has('nope'), false);
  });

  it('returns true for existing key-value pair', () => {
    const mm = new MultiMap();
    mm.set('x', 10);
    mm.set('x', 20);
    assert.equal(mm.hasEntry('x', 10), true);
    assert.equal(mm.hasEntry('x', 20), true);
  });

  it('returns false for non-existing key-value pair', () => {
    const mm = new MultiMap();
    mm.set('x', 10);
    assert.equal(mm.hasEntry('x', 99), false);
    assert.equal(mm.hasEntry('y', 10), false);
  });
});

// ─── delete ──────────────────────────────────────────────────────────────────

describe('MultiMap – delete', () => {
  it('removes all values for a key', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    assert.equal(mm.delete('a'), true);
    assert.equal(mm.has('a'), false);
    assert.deepEqual(mm.get('a'), []);
    assert.equal(mm.size, 0);
  });

  it('returns false for non-existing key', () => {
    const mm = new MultiMap();
    assert.equal(mm.delete('nope'), false);
  });
});

// ─── deleteEntry ─────────────────────────────────────────────────────────────

describe('MultiMap – deleteEntry', () => {
  it('removes a specific value from a key', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('a', 3);
    assert.equal(mm.deleteEntry('a', 2), true);
    assert.deepEqual(mm.get('a'), [1, 3]);
    assert.equal(mm.size, 2);
  });

  it('removes the key entirely when last value is deleted', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.deleteEntry('a', 1);
    assert.equal(mm.has('a'), false);
    assert.equal(mm.keyCount, 0);
  });

  it('returns false when key does not exist', () => {
    const mm = new MultiMap();
    assert.equal(mm.deleteEntry('nope', 1), false);
  });

  it('returns false when value does not exist for that key', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    assert.equal(mm.deleteEntry('a', 99), false);
  });
});

// ─── size / keyCount ─────────────────────────────────────────────────────────

describe('MultiMap – size / keyCount', () => {
  it('size counts total entries across all keys', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('b', 3);
    assert.equal(mm.size, 3);
  });

  it('keyCount counts distinct keys', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('b', 3);
    assert.equal(mm.keyCount, 2);
  });

  it('both are 0 for empty map', () => {
    const mm = new MultiMap();
    assert.equal(mm.size, 0);
    assert.equal(mm.keyCount, 0);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('MultiMap – clear', () => {
  it('removes all entries', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('b', 2);
    mm.clear();
    assert.equal(mm.size, 0);
    assert.equal(mm.keyCount, 0);
    assert.equal(mm.has('a'), false);
  });
});

// ─── keys / entries ──────────────────────────────────────────────────────────

describe('MultiMap – keys / entries', () => {
  it('returns all distinct keys', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('b', 3);
    assert.deepEqual(mm.keys().sort(), ['a', 'b']);
  });

  it('returns flat list of all key-value pairs', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('b', 3);
    const entries = mm.entries().sort((x, y) => x[1] - y[1]);
    assert.deepEqual(entries, [['a', 1], ['a', 2], ['b', 3]]);
  });
});

// ─── Symbol.iterator ─────────────────────────────────────────────────────────

describe('MultiMap – Symbol.iterator', () => {
  it('iterates over [key, values[]] pairs', () => {
    const mm = new MultiMap();
    mm.set('a', 1);
    mm.set('a', 2);
    mm.set('b', 3);
    const collected = [...mm];
    assert.equal(collected.length, 2);
    const map = new Map(collected);
    assert.deepEqual(map.get('a'), [1, 2]);
    assert.deepEqual(map.get('b'), [3]);
  });

  it('is iterable with for-of', () => {
    const mm = new MultiMap();
    mm.set('x', 10);
    const pairs = [];
    for (const pair of mm) {
      pairs.push(pair);
    }
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0][0], 'x');
    assert.deepEqual(pairs[0][1], [10]);
  });
});

// ─── createMultiMap factory ──────────────────────────────────────────────────

describe('createMultiMap', () => {
  it('creates a MultiMap using the factory function', () => {
    const mm = createMultiMap();
    assert.ok(mm instanceof MultiMap);
    assert.equal(mm.size, 0);
  });

  it('factory-created map works correctly', () => {
    const mm = createMultiMap();
    mm.set('key', 'value');
    assert.deepEqual(mm.get('key'), ['value']);
  });
});
