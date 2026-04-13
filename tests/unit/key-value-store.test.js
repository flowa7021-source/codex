// ─── Unit Tests: KVStore ──────────────────────────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { KVStore } from '../../app/modules/key-value-store.js';

// ─── set / get ────────────────────────────────────────────────────────────────

describe('KVStore – set/get basic storage', () => {
  it('stores and retrieves a value', () => {
    const store = new KVStore();
    store.set('a', 42);
    assert.equal(store.get('a'), 42);
  });

  it('returns undefined for a missing key', () => {
    const store = new KVStore();
    assert.equal(store.get('missing'), undefined);
  });

  it('overwrites an existing value', () => {
    const store = new KVStore();
    store.set('k', 'first');
    store.set('k', 'second');
    assert.equal(store.get('k'), 'second');
  });

  it('stores objects', () => {
    const store = new KVStore();
    const obj = { x: 1, y: 2 };
    store.set('obj', obj);
    assert.deepEqual(store.get('obj'), { x: 1, y: 2 });
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('KVStore – TTL expiry', () => {
  let originalDateNow;

  beforeEach(() => {
    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it('returns undefined after TTL has elapsed', () => {
    let now = 1000;
    Date.now = () => now;

    const store = new KVStore();
    store.set('key', 'value', 500); // expires at 1500

    now = 1500; // exactly at expiry — expired
    assert.equal(store.get('key'), undefined);
  });

  it('returns value before TTL has elapsed', () => {
    let now = 1000;
    Date.now = () => now;

    const store = new KVStore();
    store.set('key', 'value', 500); // expires at 1500

    now = 1499; // just before expiry
    assert.equal(store.get('key'), 'value');
  });

  it('returns value when no TTL set', () => {
    const store = new KVStore();
    store.set('key', 'value');
    assert.equal(store.get('key'), 'value');
  });
});

// ─── has ─────────────────────────────────────────────────────────────────────

describe('KVStore – has', () => {
  it('returns true for an existing key', () => {
    const store = new KVStore();
    store.set('k', 'v');
    assert.equal(store.has('k'), true);
  });

  it('returns false for a missing key', () => {
    const store = new KVStore();
    assert.equal(store.has('missing'), false);
  });

  it('returns false for an expired key', () => {
    let now = 1000;
    const origDateNow = Date.now;
    Date.now = () => now;

    const store = new KVStore();
    store.set('k', 'v', 100); // expires at 1100

    now = 1100; // expired
    assert.equal(store.has('k'), false);

    Date.now = origDateNow;
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('KVStore – delete', () => {
  it('removes an existing entry and returns true', () => {
    const store = new KVStore();
    store.set('k', 'v');
    const result = store.delete('k');
    assert.equal(result, true);
    assert.equal(store.get('k'), undefined);
  });

  it('returns false for a non-existent key', () => {
    const store = new KVStore();
    assert.equal(store.delete('missing'), false);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('KVStore – clear', () => {
  it('empties the store', () => {
    const store = new KVStore();
    store.set('a', 1);
    store.set('b', 2);
    store.clear();
    assert.equal(store.size, 0);
    assert.equal(store.get('a'), undefined);
    assert.equal(store.get('b'), undefined);
  });
});

// ─── keys / values / entries ──────────────────────────────────────────────────

describe('KVStore – keys/values/entries (non-expired only)', () => {
  let originalDateNow;

  beforeEach(() => {
    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it('keys returns non-expired keys', () => {
    let now = 1000;
    Date.now = () => now;

    const store = new KVStore();
    store.set('a', 1);
    store.set('b', 2, 100); // expires at 1100

    now = 1200; // b is expired
    const keys = store.keys();
    assert.ok(keys.includes('a'));
    assert.ok(!keys.includes('b'));
  });

  it('values returns non-expired values', () => {
    let now = 1000;
    Date.now = () => now;

    const store = new KVStore();
    store.set('a', 10);
    store.set('b', 20, 100); // expires at 1100

    now = 1200; // b is expired
    const vals = store.values();
    assert.ok(vals.includes(10));
    assert.ok(!vals.includes(20));
  });

  it('entries returns [key, value] pairs for non-expired entries', () => {
    let now = 1000;
    Date.now = () => now;

    const store = new KVStore();
    store.set('x', 'hello');
    store.set('y', 'world', 50); // expires at 1050

    now = 1100; // y is expired
    const entries = store.entries();
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0], ['x', 'hello']);
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('KVStore – size', () => {
  it('returns 0 for empty store', () => {
    const store = new KVStore();
    assert.equal(store.size, 0);
  });

  it('returns correct count', () => {
    const store = new KVStore();
    store.set('a', 1);
    store.set('b', 2);
    assert.equal(store.size, 2);
  });

  it('excludes expired entries from count', () => {
    let now = 1000;
    const origDateNow = Date.now;
    Date.now = () => now;

    const store = new KVStore();
    store.set('a', 1);
    store.set('b', 2, 100); // expires at 1100

    now = 1200;
    assert.equal(store.size, 1);

    Date.now = origDateNow;
  });
});

// ─── prune ────────────────────────────────────────────────────────────────────

describe('KVStore – prune', () => {
  it('removes expired entries and returns count', () => {
    let now = 1000;
    const origDateNow = Date.now;
    Date.now = () => now;

    const store = new KVStore();
    store.set('a', 1, 100); // expires at 1100
    store.set('b', 2, 200); // expires at 1200
    store.set('c', 3);      // no expiry

    now = 1150; // a is expired, b and c are not

    const removed = store.prune();
    assert.equal(removed, 1);
    assert.equal(store.get('a'), undefined);
    assert.equal(store.get('b'), 2);
    assert.equal(store.get('c'), 3);

    Date.now = origDateNow;
  });

  it('returns 0 when no entries are expired', () => {
    const store = new KVStore();
    store.set('a', 1);
    store.set('b', 2);
    assert.equal(store.prune(), 0);
  });
});

// ─── getOrSet ─────────────────────────────────────────────────────────────────

describe('KVStore – getOrSet', () => {
  it('returns existing value without overwriting', () => {
    const store = new KVStore();
    store.set('k', 'existing');
    const result = store.getOrSet('k', 'new');
    assert.equal(result, 'existing');
    assert.equal(store.get('k'), 'existing');
  });

  it('sets and returns the new value when key is absent', () => {
    const store = new KVStore();
    const result = store.getOrSet('k', 'new');
    assert.equal(result, 'new');
    assert.equal(store.get('k'), 'new');
  });

  it('sets with TTL when key is absent', () => {
    let now = 1000;
    const origDateNow = Date.now;
    Date.now = () => now;

    const store = new KVStore();
    store.getOrSet('k', 'val', 100); // expires at 1100

    now = 1200; // expired
    assert.equal(store.get('k'), undefined);

    Date.now = origDateNow;
  });
});

// ─── namespace ────────────────────────────────────────────────────────────────

describe('KVStore – namespace', () => {
  it('keys are prefixed internally but returned without prefix', () => {
    const store = new KVStore({ namespace: 'ns' });
    store.set('foo', 'bar');

    // External key should work without namespace prefix
    assert.equal(store.get('foo'), 'bar');
    assert.ok(store.has('foo'));

    const keys = store.keys();
    assert.deepEqual(keys, ['foo']);
  });

  it('namespaced stores do not share keys', () => {
    const store1 = new KVStore({ namespace: 'a' });
    const store2 = new KVStore({ namespace: 'b' });

    store1.set('key', 'from-a');
    store2.set('key', 'from-b');

    assert.equal(store1.get('key'), 'from-a');
    assert.equal(store2.get('key'), 'from-b');
  });

  it('delete uses the namespaced key correctly', () => {
    const store = new KVStore({ namespace: 'ns' });
    store.set('x', 1);
    assert.equal(store.delete('x'), true);
    assert.equal(store.get('x'), undefined);
  });
});

// ─── defaultTTL ───────────────────────────────────────────────────────────────

describe('KVStore – defaultTTL', () => {
  it('applies defaultTTL when no per-key TTL is provided', () => {
    let now = 1000;
    const origDateNow = Date.now;
    Date.now = () => now;

    const store = new KVStore({ defaultTTL: 200 }); // default 200ms
    store.set('k', 'val'); // should expire at 1200

    now = 1200; // expired
    assert.equal(store.get('k'), undefined);

    Date.now = origDateNow;
  });

  it('per-key TTL overrides defaultTTL', () => {
    let now = 1000;
    const origDateNow = Date.now;
    Date.now = () => now;

    const store = new KVStore({ defaultTTL: 200 });
    store.set('k', 'val', 500); // per-key TTL: expires at 1500

    now = 1300; // past defaultTTL but not per-key TTL
    assert.equal(store.get('k'), 'val');

    now = 1500; // expired per per-key TTL
    assert.equal(store.get('k'), undefined);

    Date.now = origDateNow;
  });

  it('stores without expiry when defaultTTL is not set', () => {
    const store = new KVStore();
    store.set('k', 'val');
    const entry = store.getEntry('k');
    assert.equal(entry?.expiresAt, undefined);
  });
});
