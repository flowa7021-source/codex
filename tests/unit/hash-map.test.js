// ─── Unit Tests: HashMap ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HashMap, createHashMap } from '../../app/modules/hash-map.js';

// ─── constructor ────────────────────────────────────────────────────────────

describe('HashMap – constructor', () => {
  it('creates an empty map with default capacity', () => {
    const map = new HashMap();
    assert.equal(map.size, 0);
    assert.equal(map.capacity, 16);
  });

  it('accepts a custom capacity', () => {
    const map = new HashMap(32);
    assert.equal(map.capacity, 32);
    assert.equal(map.size, 0);
  });
});

// ─── set / get ──────────────────────────────────────────────────────────────

describe('HashMap – set & get', () => {
  it('stores and retrieves a value', () => {
    const map = new HashMap();
    map.set('name', 'Alice');
    assert.equal(map.get('name'), 'Alice');
  });

  it('overwrites an existing key', () => {
    const map = new HashMap();
    map.set('k', 1);
    map.set('k', 2);
    assert.equal(map.get('k'), 2);
    assert.equal(map.size, 1);
  });

  it('returns undefined for missing key', () => {
    const map = new HashMap();
    assert.equal(map.get('nope'), undefined);
  });

  it('handles multiple keys', () => {
    const map = new HashMap();
    for (let i = 0; i < 50; i++) {
      map.set(`key${i}`, i);
    }
    assert.equal(map.size, 50);
    for (let i = 0; i < 50; i++) {
      assert.equal(map.get(`key${i}`), i);
    }
  });
});

// ─── has ────────────────────────────────────────────────────────────────────

describe('HashMap – has', () => {
  it('returns true for existing key', () => {
    const map = new HashMap();
    map.set('x', 1);
    assert.ok(map.has('x'));
  });

  it('returns false for missing key', () => {
    const map = new HashMap();
    assert.ok(!map.has('x'));
  });
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe('HashMap – delete', () => {
  it('removes an existing key and returns true', () => {
    const map = new HashMap();
    map.set('a', 1);
    assert.ok(map.delete('a'));
    assert.ok(!map.has('a'));
    assert.equal(map.size, 0);
  });

  it('returns false when deleting a nonexistent key', () => {
    const map = new HashMap();
    assert.ok(!map.delete('ghost'));
  });

  it('allows re-inserting a deleted key', () => {
    const map = new HashMap();
    map.set('a', 1);
    map.delete('a');
    map.set('a', 2);
    assert.equal(map.get('a'), 2);
    assert.equal(map.size, 1);
  });

  it('does not break lookup of colliding keys', () => {
    // Use a hash function that always returns 0 to force collisions
    const map = new HashMap(16, () => 0);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    map.delete('b');
    assert.equal(map.get('a'), 1);
    assert.equal(map.get('c'), 3);
    assert.equal(map.get('b'), undefined);
  });
});

// ─── loadFactor ─────────────────────────────────────────────────────────────

describe('HashMap – loadFactor', () => {
  it('computes correct load factor', () => {
    const map = new HashMap(4);
    map.set('a', 1);
    assert.equal(map.loadFactor, 0.25);
    map.set('b', 2);
    assert.equal(map.loadFactor, 0.5);
  });
});

// ─── resize ─────────────────────────────────────────────────────────────────

describe('HashMap – auto-resize', () => {
  it('grows capacity when load exceeds threshold', () => {
    const map = new HashMap(4);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    // load = 3/4 = 0.75 → next set triggers resize
    map.set('d', 4);
    assert.ok(map.capacity > 4);
    assert.equal(map.size, 4);
    assert.equal(map.get('a'), 1);
    assert.equal(map.get('b'), 2);
    assert.equal(map.get('c'), 3);
    assert.equal(map.get('d'), 4);
  });
});

// ─── keys / values / entries ────────────────────────────────────────────────

describe('HashMap – keys, values, entries', () => {
  it('returns all keys', () => {
    const map = new HashMap();
    map.set('x', 1);
    map.set('y', 2);
    const k = map.keys().sort();
    assert.deepEqual(k, ['x', 'y']);
  });

  it('returns all values', () => {
    const map = new HashMap();
    map.set('x', 10);
    map.set('y', 20);
    const v = map.values().sort();
    assert.deepEqual(v, [10, 20]);
  });

  it('returns all entries', () => {
    const map = new HashMap();
    map.set('x', 10);
    map.set('y', 20);
    const entries = map.entries().sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(entries, [['x', 10], ['y', 20]]);
  });
});

// ─── clear ──────────────────────────────────────────────────────────────────

describe('HashMap – clear', () => {
  it('removes all entries', () => {
    const map = new HashMap();
    map.set('a', 1);
    map.set('b', 2);
    map.clear();
    assert.equal(map.size, 0);
    assert.ok(!map.has('a'));
    assert.ok(!map.has('b'));
  });
});

// ─── Symbol.iterator ────────────────────────────────────────────────────────

describe('HashMap – Symbol.iterator', () => {
  it('iterates over all entries', () => {
    const map = new HashMap();
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    const collected = [];
    for (const [key, value] of map) {
      collected.push([key, value]);
    }
    assert.equal(collected.length, 3);
    const keys = collected.map(([k]) => k).sort();
    assert.deepEqual(keys, ['a', 'b', 'c']);
  });

  it('works with spread operator', () => {
    const map = new HashMap();
    map.set('x', 99);
    const arr = [...map];
    assert.equal(arr.length, 1);
    assert.deepEqual(arr[0], ['x', 99]);
  });
});

// ─── factory ────────────────────────────────────────────────────────────────

describe('createHashMap', () => {
  it('returns a HashMap instance', () => {
    const map = createHashMap(8);
    assert.ok(map instanceof HashMap);
    assert.equal(map.capacity, 8);
    assert.equal(map.size, 0);
  });

  it('works without arguments', () => {
    const map = createHashMap();
    assert.ok(map instanceof HashMap);
    assert.equal(map.size, 0);
  });
});
