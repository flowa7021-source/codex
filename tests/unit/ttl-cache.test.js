// ─── Unit Tests: TTLCache ────────────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { TTLCache } from '../../app/modules/ttl-cache.js';

// ─── Date.now mock helpers ────────────────────────────────────────────────────

const realNow = Date.now;
let fakeNow = realNow();

function advanceTime(ms) {
  fakeNow += ms;
}

function installFakeNow() {
  fakeNow = realNow();
  Date.now = () => fakeNow;
}

function restoreNow() {
  Date.now = realNow;
}

// ─── Basic set / get ──────────────────────────────────────────────────────────

describe('TTLCache – set/get basic storage', () => {
  it('stores and retrieves a value', () => {
    const cache = new TTLCache({ defaultTTL: 60_000 });
    cache.set('key', 'value');
    assert.equal(cache.get('key'), 'value');
  });

  it('returns undefined for missing key', () => {
    const cache = new TTLCache();
    assert.equal(cache.get('missing'), undefined);
  });

  it('overwrites an existing key', () => {
    const cache = new TTLCache({ defaultTTL: 60_000 });
    cache.set('k', 1);
    cache.set('k', 2);
    assert.equal(cache.get('k'), 2);
    assert.equal(cache.size, 1);
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('TTLCache – TTL expiry', () => {
  beforeEach(installFakeNow);
  afterEach(restoreNow);

  it('returns value before TTL elapses', () => {
    const cache = new TTLCache({ defaultTTL: 5000 });
    cache.set('a', 'hello');
    advanceTime(4999);
    assert.equal(cache.get('a'), 'hello');
  });

  it('returns undefined after TTL elapses', () => {
    const cache = new TTLCache({ defaultTTL: 5000 });
    cache.set('a', 'hello');
    advanceTime(5000);
    assert.equal(cache.get('a'), undefined);
  });

  it('lazily removes the expired entry from size', () => {
    const cache = new TTLCache({ defaultTTL: 1000 });
    cache.set('x', 42);
    assert.equal(cache.size, 1);
    advanceTime(1000);
    cache.get('x'); // triggers lazy eviction
    assert.equal(cache.size, 0);
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('TTLCache – has', () => {
  beforeEach(installFakeNow);
  afterEach(restoreNow);

  it('returns true for a fresh entry', () => {
    const cache = new TTLCache({ defaultTTL: 5000 });
    cache.set('a', 1);
    assert.equal(cache.has('a'), true);
  });

  it('returns false for an expired entry', () => {
    const cache = new TTLCache({ defaultTTL: 1000 });
    cache.set('a', 1);
    advanceTime(1000);
    assert.equal(cache.has('a'), false);
  });

  it('returns false for a missing key', () => {
    const cache = new TTLCache();
    assert.equal(cache.has('nope'), false);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('TTLCache – delete', () => {
  it('removes an entry and returns true', () => {
    const cache = new TTLCache({ defaultTTL: 60_000 });
    cache.set('d', 'val');
    assert.equal(cache.delete('d'), true);
    assert.equal(cache.has('d'), false);
    assert.equal(cache.size, 0);
  });

  it('returns false when key is not present', () => {
    const cache = new TTLCache();
    assert.equal(cache.delete('ghost'), false);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('TTLCache – clear', () => {
  it('empties the cache', () => {
    const cache = new TTLCache({ defaultTTL: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), false);
  });
});

// ─── prune ────────────────────────────────────────────────────────────────────

describe('TTLCache – prune', () => {
  beforeEach(installFakeNow);
  afterEach(restoreNow);

  it('removes expired entries and returns count', () => {
    const cache = new TTLCache({ defaultTTL: 2000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3, 10_000); // longer TTL
    advanceTime(2000); // 'a' and 'b' are now expired
    const removed = cache.prune();
    assert.equal(removed, 2);
    assert.equal(cache.size, 1);
    assert.equal(cache.has('c'), true);
  });

  it('returns 0 when nothing has expired', () => {
    const cache = new TTLCache({ defaultTTL: 60_000 });
    cache.set('x', 1);
    cache.set('y', 2);
    assert.equal(cache.prune(), 0);
    assert.equal(cache.size, 2);
  });

  it('returns 0 on an empty cache', () => {
    const cache = new TTLCache();
    assert.equal(cache.prune(), 0);
  });
});

// ─── ttlRemaining ─────────────────────────────────────────────────────────────

describe('TTLCache – ttlRemaining', () => {
  beforeEach(installFakeNow);
  afterEach(restoreNow);

  it('returns a positive value for a fresh entry', () => {
    const cache = new TTLCache({ defaultTTL: 5000 });
    cache.set('k', 'v');
    advanceTime(1000);
    const remaining = cache.ttlRemaining('k');
    assert.equal(remaining, 4000);
  });

  it('returns 0 for an expired entry', () => {
    const cache = new TTLCache({ defaultTTL: 1000 });
    cache.set('k', 'v');
    advanceTime(1000);
    assert.equal(cache.ttlRemaining('k'), 0);
  });

  it('returns -1 for a missing key', () => {
    const cache = new TTLCache();
    assert.equal(cache.ttlRemaining('nope'), -1);
  });
});

// ─── Custom TTL per entry ─────────────────────────────────────────────────────

describe('TTLCache – custom TTL per entry', () => {
  beforeEach(installFakeNow);
  afterEach(restoreNow);

  it('custom TTL overrides the default TTL', () => {
    const cache = new TTLCache({ defaultTTL: 60_000 });
    cache.set('short', 'val', 500); // custom: 500 ms
    advanceTime(500);
    assert.equal(cache.get('short'), undefined); // expired
  });

  it('entry with default TTL survives while custom-TTL entry expires', () => {
    const cache = new TTLCache({ defaultTTL: 10_000 });
    cache.set('default', 'a'); // 10 s
    cache.set('custom', 'b', 1000); // 1 s
    advanceTime(1000);
    assert.equal(cache.get('custom'), undefined);
    assert.equal(cache.get('default'), 'a');
  });
});

// ─── maxSize eviction ─────────────────────────────────────────────────────────

describe('TTLCache – maxSize eviction', () => {
  it('evicts the oldest entry when maxSize is exceeded', () => {
    const cache = new TTLCache({ defaultTTL: 60_000, maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // should evict 'a' (oldest)
    assert.equal(cache.size, 3);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.get('d'), 4);
  });

  it('size never exceeds maxSize', () => {
    const cache = new TTLCache({ defaultTTL: 60_000, maxSize: 2 });
    for (let i = 0; i < 10; i++) cache.set(i, i);
    assert.equal(cache.size, 2);
  });

  it('updating an existing key does not evict other entries', () => {
    const cache = new TTLCache({ defaultTTL: 60_000, maxSize: 3 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('b', 99); // update 'b' — no eviction should happen
    assert.equal(cache.size, 3);
    assert.equal(cache.get('b'), 99);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('c'), true);
  });
});
