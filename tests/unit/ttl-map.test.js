// ─── Unit Tests: TTLMap ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TTLMap, createTTLMap } from '../../app/modules/ttl-map.js';

/**
 * Creates a deterministic clock that starts at `start` and can be advanced
 * manually via `clock.advance(ms)`.
 */
function makeClock(start = 0) {
  let now = start;
  const clock = () => now;
  clock.advance = (ms) => { now += ms; };
  clock.set = (t) => { now = t; };
  return clock;
}

describe('TTLMap – set / get', () => {
  it('stores and retrieves a value within TTL', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('a', 42);
    assert.equal(map.get('a'), 42);
  });

  it('returns undefined after TTL expires', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1);
    clock.advance(100);
    assert.equal(map.get('a'), undefined);
  });

  it('allows per-key TTL override', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('short', 1, 50);
    map.set('long', 2, 500);
    clock.advance(60);
    assert.equal(map.get('short'), undefined);
    assert.equal(map.get('long'), 2);
  });

  it('overwrites an existing key with fresh TTL', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1);
    clock.advance(80);
    map.set('a', 2);
    clock.advance(80);
    // 80+80 = 160 ms since first set, but only 80 ms since second set
    assert.equal(map.get('a'), 2);
  });
});

describe('TTLMap – has', () => {
  it('returns true for live key', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('a', 1);
    assert.equal(map.has('a'), true);
  });

  it('returns false for expired key', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1);
    clock.advance(100);
    assert.equal(map.has('a'), false);
  });

  it('returns false for missing key', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    assert.equal(map.has('nope'), false);
  });
});

describe('TTLMap – delete', () => {
  it('deletes a key and returns true', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('a', 1);
    assert.equal(map.delete('a'), true);
    assert.equal(map.has('a'), false);
  });

  it('returns false for missing key', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    assert.equal(map.delete('nope'), false);
  });
});

describe('TTLMap – size', () => {
  it('counts only non-expired entries', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1);
    map.set('b', 2, 200);
    clock.advance(150);
    // 'a' expired (TTL 100), 'b' still alive (TTL 200)
    assert.equal(map.size, 1);
  });

  it('returns 0 when all entries expired', () => {
    const clock = makeClock();
    const map = new TTLMap(50, { clock });
    map.set('a', 1);
    map.set('b', 2);
    clock.advance(50);
    assert.equal(map.size, 0);
  });
});

describe('TTLMap – clear', () => {
  it('removes all entries', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('a', 1);
    map.set('b', 2);
    map.clear();
    assert.equal(map.size, 0);
    assert.equal(map.get('a'), undefined);
  });
});

describe('TTLMap – cleanup', () => {
  it('removes expired entries and returns the count', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1, 50);
    map.set('b', 2, 200);
    map.set('c', 3, 50);
    clock.advance(60);
    const removed = map.cleanup();
    assert.equal(removed, 2);
    assert.equal(map.has('a'), false);
    assert.equal(map.has('c'), false);
    assert.equal(map.get('b'), 2);
  });

  it('returns 0 when nothing is expired', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('a', 1);
    assert.equal(map.cleanup(), 0);
  });
});

describe('TTLMap – keys / entries', () => {
  it('returns only non-expired keys', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1, 50);
    map.set('b', 2, 200);
    map.set('c', 3, 50);
    clock.advance(60);
    assert.deepEqual(map.keys(), ['b']);
    assert.deepEqual(map.entries(), [['b', 2]]);
  });
});

describe('TTLMap – ttlOf', () => {
  it('returns remaining TTL for a live key', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    map.set('a', 1);
    clock.advance(300);
    assert.equal(map.ttlOf('a'), 700);
  });

  it('returns undefined for expired key', () => {
    const clock = makeClock();
    const map = new TTLMap(100, { clock });
    map.set('a', 1);
    clock.advance(100);
    assert.equal(map.ttlOf('a'), undefined);
  });

  it('returns undefined for missing key', () => {
    const clock = makeClock();
    const map = new TTLMap(1000, { clock });
    assert.equal(map.ttlOf('nope'), undefined);
  });
});

describe('TTLMap – constructor validation', () => {
  it('throws on defaultTTL <= 0', () => {
    assert.throws(() => new TTLMap(0), RangeError);
    assert.throws(() => new TTLMap(-1), RangeError);
  });
});

describe('TTLMap – createTTLMap factory', () => {
  it('creates a TTLMap instance', () => {
    const map = createTTLMap(5000);
    assert.ok(map instanceof TTLMap);
  });

  it('accepts clock option', () => {
    const clock = makeClock(1000);
    const map = createTTLMap(100, { clock });
    map.set('a', 1);
    clock.advance(50);
    assert.equal(map.ttlOf('a'), 50);
  });
});
