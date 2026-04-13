// ─── Unit Tests: LRUCache ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LRUCache } from '../../app/modules/lru-cache.js';

describe('LRUCache – get', () => {
  it('returns value for existing key', () => {
    const cache = new LRUCache(5);
    cache.set('a', 1);
    assert.equal(cache.get('a'), 1);
  });

  it('returns undefined for missing key', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.get('missing'), undefined);
  });
});

describe('LRUCache – set', () => {
  it('stores a value', () => {
    const cache = new LRUCache(5);
    cache.set('x', 42);
    assert.equal(cache.get('x'), 42);
  });

  it('updates an existing key in place', () => {
    const cache = new LRUCache(5);
    cache.set('k', 1);
    cache.set('k', 2);
    assert.equal(cache.get('k'), 2);
    assert.equal(cache.size, 1);
  });

  it('evicts the LRU entry when over capacity', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // 'a' is LRU — adding 'd' should evict it
    cache.set('d', 4);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
  });
});

describe('LRUCache – has', () => {
  it('returns true for an existing key', () => {
    const cache = new LRUCache(5);
    cache.set('z', 99);
    assert.equal(cache.has('z'), true);
  });

  it('returns false for a missing key', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.has('nope'), false);
  });
});

describe('LRUCache – delete', () => {
  it('removes an entry and returns true', () => {
    const cache = new LRUCache(5);
    cache.set('del', 7);
    assert.equal(cache.delete('del'), true);
    assert.equal(cache.has('del'), false);
    assert.equal(cache.size, 0);
  });

  it('returns false when key is not present', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.delete('ghost'), false);
  });
});

describe('LRUCache – clear', () => {
  it('empties the cache', () => {
    const cache = new LRUCache(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), false);
  });
});

describe('LRUCache – size and capacity', () => {
  it('size reflects the number of stored entries', () => {
    const cache = new LRUCache(10);
    assert.equal(cache.size, 0);
    cache.set('a', 1);
    assert.equal(cache.size, 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
    cache.delete('a');
    assert.equal(cache.size, 1);
  });

  it('capacity reflects the constructor argument', () => {
    const cache = new LRUCache(7);
    assert.equal(cache.capacity, 7);
  });

  it('size never exceeds capacity', () => {
    const cap = 4;
    const cache = new LRUCache(cap);
    for (let i = 0; i < 10; i++) cache.set(i, i);
    assert.equal(cache.size, cap);
  });
});

describe('LRUCache – LRU eviction order', () => {
  it('evicts the oldest-inserted item when none accessed', () => {
    const cache = new LRUCache(3);
    cache.set(1, 'one');
    cache.set(2, 'two');
    cache.set(3, 'three');
    cache.set(4, 'four'); // evicts 1
    assert.equal(cache.has(1), false);
    assert.deepEqual(cache.keys(), [2, 3, 4]);
  });
});

describe('LRUCache – access updates recency', () => {
  it('accessed item is not evicted before un-accessed ones', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' so it moves to MRU; 'b' becomes LRU
    cache.get('a');
    cache.set('d', 4); // should evict 'b', not 'a'
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.has('d'), true);
  });

  it('set on existing key moves it to MRU position', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Update 'a'; 'b' is now LRU
    cache.set('a', 10);
    cache.set('d', 4); // should evict 'b'
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.get('a'), 10);
  });
});

describe('LRUCache – keys / values / entries', () => {
  it('keys() returns keys in LRU order', () => {
    const cache = new LRUCache(4);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' to make it MRU; order: b(LRU), c, a(MRU)
    cache.get('a');
    assert.deepEqual(cache.keys(), ['b', 'c', 'a']);
  });

  it('values() returns values in LRU order', () => {
    const cache = new LRUCache(3);
    cache.set('x', 10);
    cache.set('y', 20);
    cache.set('z', 30);
    cache.get('x'); // x → MRU; order: y, z, x
    assert.deepEqual(cache.values(), [20, 30, 10]);
  });

  it('entries() returns [key, value] pairs in LRU order', () => {
    const cache = new LRUCache(3);
    cache.set('p', 100);
    cache.set('q', 200);
    cache.set('r', 300);
    // No additional access; insertion order = LRU order
    assert.deepEqual(cache.entries(), [['p', 100], ['q', 200], ['r', 300]]);
  });

  it('returns empty arrays for empty cache', () => {
    const cache = new LRUCache(5);
    assert.deepEqual(cache.keys(), []);
    assert.deepEqual(cache.values(), []);
    assert.deepEqual(cache.entries(), []);
  });
});

describe('LRUCache – constructor validation', () => {
  it('throws RangeError for capacity < 1', () => {
    assert.throws(() => new LRUCache(0), RangeError);
    assert.throws(() => new LRUCache(-1), RangeError);
  });

  it('accepts capacity of 1', () => {
    const cache = new LRUCache(1);
    cache.set('only', true);
    assert.equal(cache.get('only'), true);
    cache.set('another', false); // evicts 'only'
    assert.equal(cache.has('only'), false);
    assert.equal(cache.get('another'), false);
  });
});
