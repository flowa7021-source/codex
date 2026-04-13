// ─── Unit Tests: Cache Manager ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Cache, createCache, createLRUCache, createLFUCache, createTTLCache } from '../../app/modules/cache-manager.js';

// Helper: small async delay
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Basic set/get/has/delete/clear ───────────────────────────────────────────

describe('Cache – basic set/get', () => {
  it('returns undefined for missing key', () => {
    const cache = new Cache();
    assert.equal(cache.get('missing'), undefined);
  });

  it('stores and retrieves a value', () => {
    const cache = new Cache();
    cache.set('a', 42);
    assert.equal(cache.get('a'), 42);
  });

  it('stores and retrieves multiple entries', () => {
    const cache = new Cache();
    cache.set('x', 1);
    cache.set('y', 2);
    cache.set('z', 3);
    assert.equal(cache.get('x'), 1);
    assert.equal(cache.get('y'), 2);
    assert.equal(cache.get('z'), 3);
  });

  it('overwriting an existing key updates the value', () => {
    const cache = new Cache();
    cache.set('k', 1);
    cache.set('k', 99);
    assert.equal(cache.get('k'), 99);
  });

  it('overwriting does not increase size', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('a', 2);
    assert.equal(cache.size, 1);
  });

  it('size starts at 0', () => {
    const cache = new Cache();
    assert.equal(cache.size, 0);
  });

  it('size increments with each new entry', () => {
    const cache = new Cache();
    cache.set('a', 1);
    assert.equal(cache.size, 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });
});

describe('Cache – has', () => {
  it('returns false for a key that was never set', () => {
    const cache = new Cache();
    assert.equal(cache.has('nope'), false);
  });

  it('returns true after setting a key', () => {
    const cache = new Cache();
    cache.set('yes', true);
    assert.equal(cache.has('yes'), true);
  });

  it('returns false after deleting a key', () => {
    const cache = new Cache();
    cache.set('del', 1);
    cache.delete('del');
    assert.equal(cache.has('del'), false);
  });
});

describe('Cache – delete', () => {
  it('returns true when the key exists', () => {
    const cache = new Cache();
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
  });

  it('returns false when the key does not exist', () => {
    const cache = new Cache();
    assert.equal(cache.delete('ghost'), false);
  });

  it('removes the entry so get returns undefined', () => {
    const cache = new Cache();
    cache.set('b', 2);
    cache.delete('b');
    assert.equal(cache.get('b'), undefined);
  });

  it('decrements size', () => {
    const cache = new Cache();
    cache.set('c', 3);
    assert.equal(cache.size, 1);
    cache.delete('c');
    assert.equal(cache.size, 0);
  });
});

describe('Cache – clear', () => {
  it('empties the cache', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it('all keys return undefined after clear', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), undefined);
  });
});

describe('Cache – keys/values/entries', () => {
  it('keys() returns all non-expired keys', () => {
    const cache = new Cache();
    cache.set('x', 1);
    cache.set('y', 2);
    const keys = cache.keys();
    assert.equal(keys.length, 2);
    assert.ok(keys.includes('x'));
    assert.ok(keys.includes('y'));
  });

  it('values() returns all non-expired values', () => {
    const cache = new Cache();
    cache.set('a', 10);
    cache.set('b', 20);
    const vals = cache.values();
    assert.equal(vals.length, 2);
    assert.ok(vals.includes(10));
    assert.ok(vals.includes(20));
  });

  it('entries() returns all non-expired [key, value] pairs', () => {
    const cache = new Cache();
    cache.set('p', 'q');
    const ents = cache.entries();
    assert.equal(ents.length, 1);
    assert.deepEqual(ents[0], ['p', 'q']);
  });

  it('keys/values/entries return empty arrays on empty cache', () => {
    const cache = new Cache();
    assert.deepEqual(cache.keys(), []);
    assert.deepEqual(cache.values(), []);
    assert.deepEqual(cache.entries(), []);
  });
});

describe('Cache – maxSize and strategy getters', () => {
  it('maxSize defaults to Infinity', () => {
    const cache = new Cache();
    assert.equal(cache.maxSize, Infinity);
  });

  it('maxSize reflects constructor option', () => {
    const cache = new Cache({ maxSize: 5 });
    assert.equal(cache.maxSize, 5);
  });

  it('strategy defaults to lru', () => {
    const cache = new Cache();
    assert.equal(cache.strategy, 'lru');
  });

  it('strategy reflects constructor option', () => {
    const cache = new Cache({ strategy: 'fifo' });
    assert.equal(cache.strategy, 'fifo');
  });
});

// ─── LRU eviction ─────────────────────────────────────────────────────────────

describe('Cache – LRU eviction', () => {
  it('evicts the least-recently-used entry when maxSize is reached', () => {
    const cache = new Cache({ maxSize: 3, strategy: 'lru' });
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

  it('accessing an entry promotes it so it is not evicted', () => {
    const cache = new Cache({ maxSize: 3, strategy: 'lru' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' to make it most-recently-used
    cache.get('a');
    // Now 'b' should be LRU
    cache.set('d', 4);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
  });

  it('evicts correctly with maxSize=1', () => {
    const cache = new Cache({ maxSize: 1, strategy: 'lru' });
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.size, 1);
  });

  it('overwriting an existing key does not trigger eviction', () => {
    const cache = new Cache({ maxSize: 2, strategy: 'lru' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 99); // overwrite, no new key
    assert.equal(cache.size, 2);
    assert.equal(cache.has('b'), true);
    assert.equal(cache.get('a'), 99);
  });
});

// ─── LFU eviction ─────────────────────────────────────────────────────────────

describe('Cache – LFU eviction', () => {
  it('evicts the least-frequently-used entry', () => {
    const cache = new Cache({ maxSize: 3, strategy: 'lfu' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'b' and 'c' multiple times so 'a' has lowest frequency
    cache.get('b');
    cache.get('b');
    cache.get('c');
    cache.set('d', 4); // should evict 'a' (freq=1)
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
  });

  it('evicts correctly when frequencies are equal (ties broken by older access)', () => {
    const cache = new Cache({ maxSize: 2, strategy: 'lfu' });
    cache.set('a', 1); // inserted first, older lastAccess on tie
    cache.set('b', 2);
    // Neither accessed extra; both freq=1. 'a' should be evicted (older).
    cache.set('c', 3);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), true);
    assert.equal(cache.has('c'), true);
  });

  it('increments eviction counter on lfu eviction', () => {
    const cache = new Cache({ maxSize: 1, strategy: 'lfu' });
    cache.set('a', 1);
    cache.set('b', 2);
    const stats = cache.getStats();
    assert.equal(stats.evictions, 1);
  });
});

// ─── FIFO eviction ────────────────────────────────────────────────────────────

describe('Cache – FIFO eviction', () => {
  it('evicts the first inserted entry regardless of access', () => {
    const cache = new Cache({ maxSize: 3, strategy: 'fifo' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // Access 'a' many times — FIFO ignores access order
    cache.get('a');
    cache.get('a');
    cache.set('d', 4); // should evict 'a' (first inserted)
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
  });

  it('evicts in strict insertion order', () => {
    const cache = new Cache({ maxSize: 2, strategy: 'fifo' });
    cache.set('first', 1);
    cache.set('second', 2);
    cache.set('third', 3); // evicts 'first'
    assert.equal(cache.has('first'), false);
    assert.equal(cache.has('second'), true);
    cache.set('fourth', 4); // evicts 'second'
    assert.equal(cache.has('second'), false);
    assert.equal(cache.has('third'), true);
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('Cache – TTL expiry', () => {
  it('returns value before expiry', () => {
    const cache = new Cache({ ttl: 60_000 });
    cache.set('k', 'v');
    assert.equal(cache.get('k'), 'v');
  });

  it('entry expires after ttl ms', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('k', 'v');
    await delay(10);
    assert.equal(cache.get('k'), undefined);
  });

  it('has() returns false after expiry', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('k', 'v');
    await delay(10);
    assert.equal(cache.has('k'), false);
  });

  it('expired entry excluded from keys after delay', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('exp', 'gone');
    await delay(10);
    assert.ok(!cache.keys().includes('exp'));
  });

  it('expired entry excluded from values after delay', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('exp', 'gone');
    await delay(10);
    assert.ok(!cache.values().includes('gone'));
  });

  it('expired entry excluded from entries after delay', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('exp', 'gone');
    await delay(10);
    assert.ok(!cache.entries().some(([k]) => k === 'exp'));
  });

  it('size does not include expired entries', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    await delay(10);
    assert.equal(cache.size, 0);
  });

  it('null ttl means no expiry', async () => {
    const cache = new Cache({ ttl: null });
    cache.set('k', 'permanent');
    await delay(10);
    assert.equal(cache.get('k'), 'permanent');
  });
});

// ─── Per-entry TTL override ───────────────────────────────────────────────────

describe('Cache – per-entry TTL override', () => {
  it('per-entry ttl overrides cache-level ttl', async () => {
    const cache = new Cache({ ttl: 60_000 }); // cache default = 1 min
    cache.set('short', 'bye', 1);             // override to 1ms
    cache.set('long', 'hi');                  // uses cache default
    await delay(10);
    assert.equal(cache.get('short'), undefined);
    assert.equal(cache.get('long'), 'hi');
  });

  it('per-entry ttl of 0 expires immediately', () => {
    const cache = new Cache({ ttl: 60_000 });
    cache.set('k', 'v', 0);
    assert.equal(cache.get('k'), undefined);
  });

  it('per-entry ttl works without cache-level ttl', async () => {
    const cache = new Cache();
    cache.set('k', 'v', 1);
    await delay(10);
    assert.equal(cache.get('k'), undefined);
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('Cache – stats', () => {
  it('starts with zero hits, misses, evictions', () => {
    const cache = new Cache();
    const s = cache.getStats();
    assert.equal(s.hits, 0);
    assert.equal(s.misses, 0);
    assert.equal(s.evictions, 0);
  });

  it('counts hits on successful get', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.get('a');
    cache.get('a');
    assert.equal(cache.getStats().hits, 2);
  });

  it('counts misses on missing key', () => {
    const cache = new Cache();
    cache.get('nope');
    cache.get('also-nope');
    assert.equal(cache.getStats().misses, 2);
  });

  it('counts misses on expired entry', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('k', 'v');
    await delay(10);
    cache.get('k');
    assert.equal(cache.getStats().misses, 1);
  });

  it('counts evictions when maxSize is exceeded', () => {
    const cache = new Cache({ maxSize: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.getStats().evictions, 1);
  });

  it('resetStats zeroes all counters', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.get('a');
    cache.get('missing');
    cache.resetStats();
    const s = cache.getStats();
    assert.equal(s.hits, 0);
    assert.equal(s.misses, 0);
    assert.equal(s.evictions, 0);
  });

  it('getStats size reflects current non-expired count', () => {
    const cache = new Cache();
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.getStats().size, 2);
  });
});

// ─── mset/mget/mdelete ────────────────────────────────────────────────────────

describe('Cache – mset/mget/mdelete', () => {
  it('mset inserts multiple entries', () => {
    const cache = new Cache();
    cache.mset([['a', 1], ['b', 2], ['c', 3]]);
    assert.equal(cache.size, 3);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
  });

  it('mget returns values in key order', () => {
    const cache = new Cache();
    cache.mset([['x', 10], ['y', 20]]);
    const results = cache.mget(['y', 'x', 'z']);
    assert.deepEqual(results, [20, 10, undefined]);
  });

  it('mget returns undefined for missing keys', () => {
    const cache = new Cache();
    const results = cache.mget(['nope', 'ghost']);
    assert.deepEqual(results, [undefined, undefined]);
  });

  it('mdelete removes specified keys and returns count', () => {
    const cache = new Cache();
    cache.mset([['a', 1], ['b', 2], ['c', 3]]);
    const count = cache.mdelete(['a', 'c']);
    assert.equal(count, 2);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('c'), false);
    assert.equal(cache.has('b'), true);
  });

  it('mdelete returns 0 when no keys match', () => {
    const cache = new Cache();
    cache.set('a', 1);
    assert.equal(cache.mdelete(['x', 'y']), 0);
  });

  it('mdelete count only counts actually deleted keys', () => {
    const cache = new Cache();
    cache.set('a', 1);
    const count = cache.mdelete(['a', 'nonexistent']);
    assert.equal(count, 1);
  });
});

// ─── prune() ──────────────────────────────────────────────────────────────────

describe('Cache – prune', () => {
  it('returns 0 when no entries are expired', () => {
    const cache = new Cache({ ttl: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.prune(), 0);
  });

  it('removes expired entries and returns count', async () => {
    const cache = new Cache({ ttl: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    await delay(10);
    const count = cache.prune();
    assert.equal(count, 2);
    assert.equal(cache.size, 0);
  });

  it('does not remove non-expired entries', async () => {
    const cache = new Cache();
    cache.set('exp', 'x', 1);
    cache.set('live', 'y', 60_000);
    await delay(10);
    const count = cache.prune();
    assert.equal(count, 1);
    assert.equal(cache.has('live'), true);
  });

  it('prune returns 0 on empty cache', () => {
    const cache = new Cache();
    assert.equal(cache.prune(), 0);
  });
});

// ─── onEvict callback ─────────────────────────────────────────────────────────

describe('Cache – onEvict callback', () => {
  it('is called when an entry is evicted due to maxSize', () => {
    const evicted = [];
    const cache = new Cache({
      maxSize: 1,
      onEvict: (k, v) => evicted.push([k, v]),
    });
    cache.set('first', 1);
    cache.set('second', 2); // evicts 'first'
    assert.equal(evicted.length, 1);
    assert.deepEqual(evicted[0], ['first', 1]);
  });

  it('is called with the correct key and value', () => {
    const evicted = [];
    const cache = new Cache({
      maxSize: 2,
      onEvict: (k, v) => evicted.push({ k, v }),
    });
    cache.set('a', 'alpha');
    cache.set('b', 'beta');
    cache.set('c', 'gamma'); // evicts 'a'
    assert.equal(evicted[0].k, 'a');
    assert.equal(evicted[0].v, 'alpha');
  });

  it('is not called on manual delete', () => {
    const evicted = [];
    const cache = new Cache({ onEvict: (k) => evicted.push(k) });
    cache.set('a', 1);
    cache.delete('a');
    assert.equal(evicted.length, 0);
  });

  it('is not called on clear', () => {
    const evicted = [];
    const cache = new Cache({ onEvict: (k) => evicted.push(k) });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(evicted.length, 0);
  });

  it('eviction count matches number of onEvict calls', () => {
    const calls = [];
    const cache = new Cache({ maxSize: 2, onEvict: (k) => calls.push(k) });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    assert.equal(calls.length, 2);
    assert.equal(cache.getStats().evictions, 2);
  });
});

// ─── Factory functions ────────────────────────────────────────────────────────

describe('createCache', () => {
  it('returns a Cache instance', () => {
    const cache = createCache();
    assert.ok(cache instanceof Cache);
  });

  it('passes options through', () => {
    const cache = createCache({ maxSize: 10, strategy: 'fifo' });
    assert.equal(cache.maxSize, 10);
    assert.equal(cache.strategy, 'fifo');
  });

  it('works without options', () => {
    const cache = createCache();
    cache.set('k', 'v');
    assert.equal(cache.get('k'), 'v');
  });
});

describe('createLRUCache', () => {
  it('returns a Cache with LRU strategy and given maxSize', () => {
    const cache = createLRUCache(5);
    assert.ok(cache instanceof Cache);
    assert.equal(cache.maxSize, 5);
    assert.equal(cache.strategy, 'lru');
  });

  it('evicts LRU entry when full', () => {
    const cache = createLRUCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // promote 'a'
    cache.set('c', 3); // evict 'b'
    assert.equal(cache.has('b'), false);
    assert.equal(cache.has('a'), true);
  });

  it('accepts optional ttl', async () => {
    const cache = createLRUCache(5, 1);
    cache.set('k', 'v');
    await delay(10);
    assert.equal(cache.get('k'), undefined);
  });
});

describe('createLFUCache', () => {
  it('returns a Cache with LFU strategy and given maxSize', () => {
    const cache = createLFUCache(3);
    assert.ok(cache instanceof Cache);
    assert.equal(cache.maxSize, 3);
    assert.equal(cache.strategy, 'lfu');
  });

  it('evicts least-frequently-used entry', () => {
    const cache = createLFUCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('b'); // increase 'b' frequency
    cache.set('c', 3); // evict 'a' (lower frequency)
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), true);
  });
});

describe('createTTLCache', () => {
  it('returns a Cache instance', () => {
    const cache = createTTLCache(60_000);
    assert.ok(cache instanceof Cache);
  });

  it('entries expire after ttl ms', async () => {
    const cache = createTTLCache(1);
    cache.set('k', 'v');
    await delay(10);
    assert.equal(cache.get('k'), undefined);
  });

  it('entries are accessible before expiry', () => {
    const cache = createTTLCache(60_000);
    cache.set('k', 'v');
    assert.equal(cache.get('k'), 'v');
  });
});
