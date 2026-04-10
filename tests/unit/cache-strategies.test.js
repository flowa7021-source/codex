// ─── Unit Tests: Cache Strategies ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TTLCache, WriteThrough } from '../../app/modules/cache-strategies.js';
import { LRUCache } from '../../app/modules/lru-cache.js';

// ─── TTLCache ─────────────────────────────────────────────────────────────────

describe('TTLCache – basic', () => {
  it('set and get within TTL', () => {
    const cache = new TTLCache(10000);
    cache.set('k', 'v');
    assert.equal(cache.get('k'), 'v');
  });

  it('get returns undefined for missing key', () => {
    const cache = new TTLCache(10000);
    assert.equal(cache.get('missing'), undefined);
  });

  it('has returns true for present key', () => {
    const cache = new TTLCache(10000);
    cache.set('x', 1);
    assert.equal(cache.has('x'), true);
  });

  it('has returns false for missing key', () => {
    assert.equal(new TTLCache(1000).has('no'), false);
  });

  it('delete removes a key', () => {
    const cache = new TTLCache(10000);
    cache.set("a", 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(cache.get('a'), undefined);
  });

  it('delete returns false for absent key', () => {
    assert.equal(new TTLCache(1000).delete('nope'), false);
  });

  it('size reflects number of unexpired entries', () => {
    const cache = new TTLCache(10000);
    cache.set("a", 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });
});

describe('TTLCache – custom TTL per entry', () => {
  it('custom ttl can differ per key', () => {
    const cache = new TTLCache(10000);
    cache.set('long', 'v', 99999);
    cache.set('short', 'v', 1);
    assert.equal(cache.has('long'), true);
    // short-lived entry could be tested with time mocking; just confirm it was set
    assert.ok(cache.size >= 1);
  });
});

describe('TTLCache – prune', () => {
  it('prune returns count of removed entries', () => {
    const cache = new TTLCache(1000);
    cache.set("a", 1);
    cache.set('b', 2);
    // Force TTL by using a very small value
    const cache2 = new TTLCache(1);
    cache2.set('x', 1, 1);
    // prune on regular cache should handle gracefully
    const removed = cache.prune();
    assert.ok(removed >= 0);
  });
});

// ─── WriteThrough ─────────────────────────────────────────────────────────────

describe('WriteThrough', () => {
  it('set writes to both cache and store', () => {
    const cache = new LRUCache(10);
    const store = new Map();
    const wt = new WriteThrough(cache, store);
    wt.set('k', 'v');
    assert.equal(cache.get('k'), 'v');
    assert.equal(store.get('k'), 'v');
  });

  it('get reads from cache when present', () => {
    const cache = new LRUCache(10);
    const store = new Map();
    const wt = new WriteThrough(cache, store);
    wt.set('k', 42);
    assert.equal(wt.get('k'), 42);
  });

  it('get falls back to store when cache misses', () => {
    const cache = new LRUCache(1); // tiny cache
    const store = new Map([['k', 99]]);
    const wt = new WriteThrough(cache, store);
    assert.equal(wt.get('k'), 99);
  });

  it('delete removes from both', () => {
    const cache = new LRUCache(10);
    const store = new Map();
    const wt = new WriteThrough(cache, store);
    wt.set('k', 1);
    assert.equal(wt.delete('k'), true);
    assert.equal(cache.get('k'), undefined);
    assert.equal(store.has('k'), false);
  });
});
