// ─── Unit Tests: LRUMap ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LRUMap, createLRUMap } from '../../app/modules/lru-map.js';

describe('LRUMap – get', () => {
  it('returns value for existing key', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    assert.equal(map.get('a'), 1);
  });

  it('returns undefined for missing key', () => {
    const map = new LRUMap(5);
    assert.equal(map.get('missing'), undefined);
  });

  it('promotes entry to MRU on get', () => {
    const map = new LRUMap(3);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    // 'a' is LRU — accessing it promotes it
    map.get('a');
    assert.deepEqual(map.keys(), ['b', 'c', 'a']);
  });
});

describe('LRUMap – set', () => {
  it('stores a value', () => {
    const map = new LRUMap(5);
    map.set('x', 42);
    assert.equal(map.get('x'), 42);
  });

  it('updates an existing key in place', () => {
    const map = new LRUMap(5);
    map.set('k', 1);
    map.set('k', 2);
    assert.equal(map.get('k'), 2);
    assert.equal(map.size, 1);
  });

  it('evicts the LRU entry when at capacity', () => {
    const map = new LRUMap(3);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    map.set('d', 4);
    assert.equal(map.has('a'), false);
    assert.equal(map.size, 3);
    assert.deepEqual(map.keys(), ['b', 'c', 'd']);
  });
});

describe('LRUMap – peek', () => {
  it('returns value without updating recency', () => {
    const map = new LRUMap(3);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    assert.equal(map.peek('a'), 1);
    // 'a' should still be LRU after peek
    assert.deepEqual(map.keys(), ['a', 'b', 'c']);
  });

  it('returns undefined for missing key', () => {
    const map = new LRUMap(5);
    assert.equal(map.peek('nope'), undefined);
  });
});

describe('LRUMap – has / delete', () => {
  it('has returns true for existing key', () => {
    const map = new LRUMap(5);
    map.set('z', 99);
    assert.equal(map.has('z'), true);
  });

  it('has returns false for missing key', () => {
    const map = new LRUMap(5);
    assert.equal(map.has('nope'), false);
  });

  it('delete removes the key and returns true', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    assert.equal(map.delete('a'), true);
    assert.equal(map.has('a'), false);
    assert.equal(map.size, 0);
  });

  it('delete returns false for missing key', () => {
    const map = new LRUMap(5);
    assert.equal(map.delete('a'), false);
  });
});

describe('LRUMap – clear', () => {
  it('removes all entries', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    map.set('b', 2);
    map.clear();
    assert.equal(map.size, 0);
    assert.equal(map.has('a'), false);
    assert.deepEqual(map.keys(), []);
  });
});

describe('LRUMap – keys / values / entries', () => {
  it('returns entries in LRU order (oldest first)', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    assert.deepEqual(map.keys(), ['a', 'b', 'c']);
    assert.deepEqual(map.values(), [1, 2, 3]);
    assert.deepEqual(map.entries(), [['a', 1], ['b', 2], ['c', 3]]);
  });
});

describe('LRUMap – oldest / newest', () => {
  it('oldest returns the LRU entry', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    map.set('b', 2);
    assert.deepEqual(map.oldest(), ['a', 1]);
  });

  it('newest returns the MRU entry', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    map.set('b', 2);
    assert.deepEqual(map.newest(), ['b', 2]);
  });

  it('oldest/newest return undefined when empty', () => {
    const map = new LRUMap(5);
    assert.equal(map.oldest(), undefined);
    assert.equal(map.newest(), undefined);
  });
});

describe('LRUMap – resize', () => {
  it('evicts oldest entries when shrinking', () => {
    const map = new LRUMap(5);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    map.set('d', 4);
    map.set('e', 5);
    map.resize(3);
    assert.equal(map.maxSize, 3);
    assert.equal(map.size, 3);
    assert.equal(map.has('a'), false);
    assert.equal(map.has('b'), false);
    assert.deepEqual(map.keys(), ['c', 'd', 'e']);
  });

  it('allows growing without eviction', () => {
    const map = new LRUMap(2);
    map.set('a', 1);
    map.set('b', 2);
    map.resize(5);
    assert.equal(map.maxSize, 5);
    assert.equal(map.size, 2);
  });

  it('throws on invalid newMax', () => {
    const map = new LRUMap(5);
    assert.throws(() => map.resize(0), RangeError);
  });
});

describe('LRUMap – constructor validation', () => {
  it('throws on maxSize < 1', () => {
    assert.throws(() => new LRUMap(0), RangeError);
    assert.throws(() => new LRUMap(-1), RangeError);
  });
});

describe('LRUMap – createLRUMap factory', () => {
  it('creates an LRUMap instance', () => {
    const map = createLRUMap(10);
    assert.ok(map instanceof LRUMap);
    assert.equal(map.maxSize, 10);
  });
});
