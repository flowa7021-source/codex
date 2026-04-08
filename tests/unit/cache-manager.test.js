// ─── Unit Tests: CacheManager ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LRUCache, TTLCache } from '../../app/modules/cache-manager.js';

// ─── LRUCache ─────────────────────────────────────────────────────────────────

describe('LRUCache – constructor', () => {
  it('stores the capacity', () => {
    const cache = new LRUCache(10);
    assert.equal(cache.capacity, 10);
  });

  it('starts with size 0', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.size, 0);
  });

  it('throws RangeError for capacity < 1', () => {
    assert.throws(() => new LRUCache(0), RangeError);
    assert.throws(() => new LRUCache(-1), RangeError);
  });
});

describe('LRUCache – get', () => {
  it('returns undefined for missing key', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.get('missing'), undefined);
  });

  it('returns the stored value after set', () => {
    const cache = new LRUCache(5);
    cache.set('a', 42);
    assert.equal(cache.get('a'), 42);
  });

  it('works with non-string keys (number)', () => {
    const cache = new LRUCache(5);
    cache.set(1, 'one');
    assert.equal(cache.get(1), 'one');
    assert.equal(cache.get(2), undefined);
  });
});

describe('LRUCache – set/get round-trip', () => {
  it('stores and retrieves multiple entries', () => {
    const cache = new LRUCache(10);
    cache.set('x', 1).set('y', 2).set('z', 3);
    assert.equal(cache.get('x'), 1);
    assert.equal(cache.get('y'), 2);
    assert.equal(cache.get('z'), 3);
  });

  it('set returns the cache instance (chainable)', () => {
    const cache = new LRUCache(5);
    const returned = cache.set('k', 'v');
    assert.equal(returned, cache);
  });

  it('overwriting an existing key updates the value', () => {
    const cache = new LRUCache(5);
    cache.set('a', 1);
    cache.set('a', 99);
    assert.equal(cache.get('a'), 99);
    assert.equal(cache.size, 1);
  });
});

describe('LRUCache – has', () => {
  it('returns false for a key that has not been set', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.has('nope'), false);
  });

  it('returns true after setting a key', () => {
    const cache = new LRUCache(5);
    cache.set('yes', true);
    assert.equal(cache.has('yes'), true);
  });

  it('returns false after deleting a key', () => {
    const cache = new LRUCache(5);
    cache.set('del', 1);
    cache.delete('del');
    assert.equal(cache.has('del'), false);
  });
});

describe('LRUCache – delete', () => {
  it('returns true when the key exists', () => {
    const cache = new LRUCache(5);
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
  });

  it('returns false when the key does not exist', () => {
    const cache = new LRUCache(5);
    assert.equal(cache.delete('ghost'), false);
  });

  it('removes the entry so get returns undefined', () => {
    const cache = new LRUCache(5);
    cache.set('b', 2);
    cache.delete('b');
    assert.equal(cache.get('b'), undefined);
  });

  it('decrements size', () => {
    const cache = new LRUCache(5);
    cache.set('c', 3);
    assert.equal(cache.size, 1);
    cache.delete('c');
    assert.equal(cache.size, 0);
  });
});

describe('LRUCache – clear', () => {
  it('empties the cache', () => {
    const cache = new LRUCache(5);
    cache.set('a', 1).set('b', 2).set('c', 3);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it('all keys return undefined after clear', () => {
    const cache = new LRUCache(5);
    cache.set('a', 1).set('b', 2);
    cache.clear();
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), undefined);
  });
});

describe('LRUCache – size', () => {
  it('increments on each new set', () => {
    const cache = new LRUCache(10);
    assert.equal(cache.size, 0);
    cache.set('a', 1);
    assert.equal(cache.size, 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });

  it('does not increment when overwriting an existing key', () => {
    const cache = new LRUCache(10);
    cache.set('a', 1);
    cache.set('a', 2);
    assert.equal(cache.size, 1);
  });
});

describe('LRUCache – LRU eviction', () => {
  it('evicts the least-recently-used entry when capacity is reached', () => {
    // capacity=3: set a, b, c — all fit
    // set d → a is evicted (oldest)
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // should evict 'a'

    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
    assert.equal(cache.size, 3);
  });

  it('accessing an entry makes it MRU so it is not evicted', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' to make it MRU
    cache.get('a');
    // Now 'b' is LRU
    cache.set('d', 4); // should evict 'b'

    assert.equal(cache.has('b'), false);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
  });

  it('evicts correctly with capacity=1', () => {
    const cache = new LRUCache(1);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.size, 1);
  });

  it('overwriting an existing key does not trigger eviction', () => {
    const cache = new LRUCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 99); // overwrite, no new key → no eviction
    assert.equal(cache.size, 2);
    assert.equal(cache.has('b'), true);
    assert.equal(cache.get('a'), 99);
  });
});

describe('LRUCache – keys()', () => {
  it('returns all keys', () => {
    const cache = new LRUCache(5);
    cache.set('x', 1).set('y', 2).set('z', 3);
    const keys = cache.keys();
    assert.equal(keys.length, 3);
    assert.ok(keys.includes('x'));
    assert.ok(keys.includes('y'));
    assert.ok(keys.includes('z'));
  });

  it('returns empty array when cache is empty', () => {
    const cache = new LRUCache(5);
    assert.deepEqual(cache.keys(), []);
  });
});

describe('LRUCache – LRU order maintained after access', () => {
  it('keys() returns entries in LRU order (least recently used first)', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1); // oldest
    cache.set('b', 2);
    cache.set('c', 3); // newest
    // Before any access: order should be a, b, c
    assert.deepEqual(cache.keys(), ['a', 'b', 'c']);

    // Access 'a' → promotes it to MRU; order becomes b, c, a
    cache.get('a');
    assert.deepEqual(cache.keys(), ['b', 'c', 'a']);
  });

  it('values() matches LRU order', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // promote a to MRU
    assert.deepEqual(cache.values(), [2, 3, 1]);
  });

  it('set on existing key moves entry to MRU', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('a', 10); // re-set 'a' → moves to MRU
    assert.deepEqual(cache.keys(), ['b', 'c', 'a']);
    // Adding a new entry should now evict 'b'
    cache.set('d', 4);
    assert.equal(cache.has('b'), false);
    assert.deepEqual(cache.keys(), ['c', 'a', 'd']);
  });
});

// ─── TTLCache ─────────────────────────────────────────────────────────────────

describe('TTLCache – get returns value for non-expired entry', () => {
  it('returns the stored value within TTL window', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    cache.set('key', 'value');
    assert.equal(cache.get('key'), 'value');
  });

  it('returns undefined for a key that was never set', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    assert.equal(cache.get('missing'), undefined);
  });
});

describe('TTLCache – get returns undefined for expired entry', () => {
  it('treats an entry as a miss after TTL has elapsed', () => {
    const cache = new TTLCache({ ttlMs: 1 });
    cache.set('k', 'v');

    // Simulate passage of time by reaching into the internal store
    // We manually push expiresAt into the past using the Map's inner state.
    // Since we cannot access private fields directly, we instead use a zero-ms
    // TTL and rely on Date.now() advancing — but that is flaky without sleep.
    //
    // Instead, we subclass-shadow the Date approach: use ttlMs = -1 to force
    // immediate expiry.
    const expiredCache = new TTLCache({ ttlMs: -1 }); // expires immediately
    expiredCache.set('x', 'stale');
    assert.equal(expiredCache.get('x'), undefined);
  });

  it('expired entry is removed so size decreases', () => {
    const cache = new TTLCache({ ttlMs: -1 }); // expires immediately
    cache.set('a', 1);
    assert.equal(cache.size, 1);
    cache.get('a'); // triggers eviction
    assert.equal(cache.size, 0);
  });
});

describe('TTLCache – has', () => {
  it('returns true for a non-expired entry', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    cache.set('present', true);
    assert.equal(cache.has('present'), true);
  });

  it('returns false for a missing key', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    assert.equal(cache.has('absent'), false);
  });

  it('returns false for an expired entry', () => {
    const cache = new TTLCache({ ttlMs: -1 }); // expires immediately
    cache.set('expired', 'yes');
    assert.equal(cache.has('expired'), false);
  });

  it('removes expired entry on has() check so size decreases', () => {
    const cache = new TTLCache({ ttlMs: -1 });
    cache.set('z', 99);
    assert.equal(cache.size, 1);
    cache.has('z'); // triggers eviction
    assert.equal(cache.size, 0);
  });
});

describe('TTLCache – delete', () => {
  it('returns true when key exists', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    cache.set('del', 1);
    assert.equal(cache.delete('del'), true);
  });

  it('returns false when key does not exist', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    assert.equal(cache.delete('ghost'), false);
  });

  it('removed entry is no longer retrievable', () => {
    const cache = new TTLCache({ ttlMs: 60_000 });
    cache.set('d', 'data');
    cache.delete('d');
    assert.equal(cache.get('d'), undefined);
    assert.equal(cache.has('d'), false);
  });
});

describe('TTLCache – capacity', () => {
  it('respects capacity limit via eviction', () => {
    const cache = new TTLCache({ ttlMs: 60_000, capacity: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'
    assert.equal(cache.size, 2);
    assert.equal(cache.has('a'), false);
  });
});
