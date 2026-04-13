// ─── Unit Tests: cache ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LRUCache,
  LFUCache,
  FIFOCache,
  WriteThroughCache,
} from '../../app/modules/cache.js';

// ─── LRUCache ─────────────────────────────────────────────────────────────────

describe('LRUCache – basic operations', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    assert.equal(cache.get('a'), 1);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache({ maxSize: 3 });
    assert.equal(cache.get('missing'), undefined);
  });

  it('has() returns true for existing keys', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('x', 42);
    assert.ok(cache.has('x'));
  });

  it('has() returns false for missing keys', () => {
    const cache = new LRUCache({ maxSize: 3 });
    assert.equal(cache.has('x'), false);
  });

  it('delete() removes a key and returns true', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(cache.has('a'), false);
  });

  it('delete() returns false for missing key', () => {
    const cache = new LRUCache({ maxSize: 3 });
    assert.equal(cache.delete('missing'), false);
  });

  it('clear() empties the cache', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.get('a'), undefined);
  });

  it('size reflects the number of entries', () => {
    const cache = new LRUCache({ maxSize: 5 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.equal(cache.size, 3);
  });

  it('maxSize property returns the configured max size', () => {
    const cache = new LRUCache({ maxSize: 7 });
    assert.equal(cache.maxSize, 7);
  });

  it('overwrites existing key without growing size', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('a', 99);
    assert.equal(cache.get('a'), 99);
    assert.equal(cache.size, 1);
  });
});

describe('LRUCache – eviction', () => {
  it('evicts least recently used when full', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // 'a' is LRU; adding 'd' should evict 'a'
    cache.set('d', 4);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('d'), 4);
  });

  it('get() updates recency — recently gotten item is not evicted', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' to make it MRU
    cache.get('a');
    // 'b' is now LRU; adding 'd' should evict 'b'
    cache.set('d', 4);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('a'), true);
  });

  it('set() on existing key updates recency', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Re-set 'a' to make it MRU
    cache.set('a', 10);
    // 'b' is now LRU
    cache.set('d', 4);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.get('a'), 10);
  });

  it('never exceeds maxSize', () => {
    const cache = new LRUCache({ maxSize: 2 });
    for (let i = 0; i < 10; i++) {
      cache.set(i, i * 2);
    }
    assert.equal(cache.size, 2);
  });
});

describe('LRUCache – entries()', () => {
  it('returns entries from MRU to LRU', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const keys = cache.entries().map(([k]) => k);
    assert.deepEqual(keys, ['c', 'b', 'a']);
  });

  it('reflects access order changes', () => {
    const cache = new LRUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // 'a' becomes MRU
    const keys = cache.entries().map(([k]) => k);
    assert.equal(keys[0], 'a');
  });
});

describe('LRUCache – TTL', () => {
  it('returns undefined for expired entries', () => {
    const cache = new LRUCache({ maxSize: 5, ttl: 1000 });
    cache.set('a', 42);
    cache.advance(1001);
    assert.equal(cache.get('a'), undefined);
  });

  it('has() returns false for expired entries', () => {
    const cache = new LRUCache({ maxSize: 5, ttl: 500 });
    cache.set('a', 42);
    cache.advance(501);
    assert.equal(cache.has('a'), false);
  });

  it('returns value when TTL has not expired', () => {
    const cache = new LRUCache({ maxSize: 5, ttl: 1000 });
    cache.set('a', 42);
    cache.advance(999);
    assert.equal(cache.get('a'), 42);
  });

  it('expired entries do not count toward size', () => {
    const cache = new LRUCache({ maxSize: 5, ttl: 500 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.advance(501);
    assert.equal(cache.size, 0);
  });

  it('expired slot allows insertion of new items without evicting live items', () => {
    const cache = new LRUCache({ maxSize: 2, ttl: 500 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.advance(501);
    // Both expired; now set new items — should not evict anything live
    cache.set('c', 3);
    assert.equal(cache.get('c'), 3);
  });
});

// ─── LFUCache ─────────────────────────────────────────────────────────────────

describe('LFUCache – basic operations', () => {
  it('stores and retrieves values', () => {
    const cache = new LFUCache({ maxSize: 3 });
    cache.set('a', 10);
    assert.equal(cache.get('a'), 10);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LFUCache({ maxSize: 3 });
    assert.equal(cache.get('z'), undefined);
  });

  it('has() works correctly', () => {
    const cache = new LFUCache({ maxSize: 3 });
    cache.set('k', 7);
    assert.ok(cache.has('k'));
    assert.equal(cache.has('missing'), false);
  });

  it('delete() removes the key', () => {
    const cache = new LFUCache({ maxSize: 3 });
    cache.set('x', 99);
    assert.equal(cache.delete('x'), true);
    assert.equal(cache.has('x'), false);
  });

  it('delete() returns false for missing key', () => {
    const cache = new LFUCache({ maxSize: 3 });
    assert.equal(cache.delete('nope'), false);
  });

  it('clear() empties the cache', () => {
    const cache = new LFUCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it('size reflects the number of entries', () => {
    const cache = new LFUCache({ maxSize: 5 });
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });
});

describe('LFUCache – frequency tracking', () => {
  it('starts with frequency 1 after set', () => {
    const cache = new LFUCache({ maxSize: 5 });
    cache.set('a', 1);
    assert.equal(cache.frequency('a'), 1);
  });

  it('increments frequency on each get', () => {
    const cache = new LFUCache({ maxSize: 5 });
    cache.set('a', 1);
    cache.get('a');
    cache.get('a');
    assert.equal(cache.frequency('a'), 3); // 1 set + 2 gets
  });

  it('returns 0 frequency for unknown key', () => {
    const cache = new LFUCache({ maxSize: 5 });
    assert.equal(cache.frequency('nope'), 0);
  });

  it('updating via set increments frequency', () => {
    const cache = new LFUCache({ maxSize: 5 });
    cache.set('a', 1);
    cache.set('a', 2); // update
    assert.equal(cache.frequency('a'), 2);
  });
});

describe('LFUCache – eviction', () => {
  it('evicts least frequently used when full', () => {
    const cache = new LFUCache({ maxSize: 3 });
    cache.set('a', 1); // freq 1
    cache.set('b', 2); // freq 1
    cache.set('c', 3); // freq 1
    cache.get('a');    // freq('a') = 2
    cache.get('a');    // freq('a') = 3
    cache.get('b');    // freq('b') = 2
    // 'c' has freq 1 — should be evicted
    cache.set('d', 4);
    assert.equal(cache.has('c'), false);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('d'), 4);
  });

  it('never exceeds maxSize', () => {
    const cache = new LFUCache({ maxSize: 2 });
    for (let i = 0; i < 10; i++) {
      cache.set(i, i);
    }
    assert.equal(cache.size, 2);
  });
});

// ─── FIFOCache ────────────────────────────────────────────────────────────────

describe('FIFOCache – basic operations', () => {
  it('stores and retrieves values', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('a', 100);
    assert.equal(cache.get('a'), 100);
  });

  it('returns undefined for missing keys', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    assert.equal(cache.get('missing'), undefined);
  });

  it('has() returns correct boolean', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('x', 5);
    assert.ok(cache.has('x'));
    assert.equal(cache.has('y'), false);
  });

  it('delete() removes key and returns true', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(cache.has('a'), false);
  });

  it('delete() returns false for missing key', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    assert.equal(cache.delete('nope'), false);
  });

  it('clear() empties the cache', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it('size reflects the number of entries', () => {
    const cache = new FIFOCache({ maxSize: 5 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.equal(cache.size, 3);
  });
});

describe('FIFOCache – eviction in insertion order', () => {
  it('evicts the first inserted item when full', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // 'a' was inserted first; adding 'd' should evict 'a'
    cache.set('d', 4);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('d'), 4);
  });

  it('get() does NOT update insertion order (no recency effect)', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Accessing 'a' should NOT prevent it from being evicted next
    cache.get('a');
    cache.set('d', 4);
    // 'a' should still be evicted because FIFO ignores access order
    assert.equal(cache.has('a'), false);
  });

  it('update of existing key does not change insertion order', () => {
    const cache = new FIFOCache({ maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('a', 99); // update, not re-insert
    cache.set('d', 4); // should evict 'a' (still first in insertion order)
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
  });

  it('evicts in correct sequence across multiple insertions', () => {
    const cache = new FIFOCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // evicts 'a'
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), true);
    cache.set('d', 4); // evicts 'b'
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.has('d'), true);
  });
});

// ─── WriteThroughCache ────────────────────────────────────────────────────────

describe('WriteThroughCache – basic operations', () => {
  it('set writes to both cache and backing store', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    cache.set('a', 42);
    assert.equal(store.get('a'), 42);
    assert.equal(cache.get('a'), 42);
  });

  it('get returns value from cache', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    cache.set('k', 7);
    assert.equal(cache.get('k'), 7);
  });

  it('get falls through to backing store on cache miss', () => {
    const store = new Map([['x', 100]]);
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    assert.equal(cache.get('x'), 100);
  });

  it('returns undefined when key is in neither cache nor store', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    assert.equal(cache.get('nope'), undefined);
  });

  it('has() returns true when key is in cache', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    cache.set('y', 5);
    assert.ok(cache.has('y'));
  });

  it('has() returns true when key is only in backing store', () => {
    const store = new Map([['z', 9]]);
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    assert.ok(cache.has('z'));
  });

  it('has() returns false when key is absent everywhere', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    assert.equal(cache.has('absent'), false);
  });

  it('size reflects number of entries in cache layer', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });
});

describe('WriteThroughCache – delete', () => {
  it('delete removes from both cache and backing store', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(store.has('a'), false);
    assert.equal(cache.get('a'), undefined);
  });

  it('delete returns false when key is absent everywhere', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    assert.equal(cache.delete('ghost'), false);
  });

  it('delete removes key that exists only in backing store', () => {
    const store = new Map([['b', 99]]);
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    assert.equal(cache.delete('b'), true);
    assert.equal(store.has('b'), false);
  });

  it('set after delete re-adds to both layers', () => {
    const store = new Map();
    const cache = new WriteThroughCache({ maxSize: 5 }, store);
    cache.set('a', 1);
    cache.delete('a');
    cache.set('a', 2);
    assert.equal(cache.get('a'), 2);
    assert.equal(store.get('a'), 2);
  });
});
