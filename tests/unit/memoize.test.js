// ─── Unit Tests: memoize ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  memoize,
  memoizeAsync,
  weakMemoize,
  once,
  thunk,
} from '../../app/modules/memoize.js';

// ─── memoize ─────────────────────────────────────────────────────────────────

describe('memoize', () => {
  it('caches the result of a pure function', () => {
    let calls = 0;
    const add = memoize((a, b) => { calls++; return a + b; });
    assert.equal(add(1, 2), 3);
    assert.equal(add(1, 2), 3);
    assert.equal(calls, 1);
  });

  it('distinguishes different arguments', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n * 2; });
    assert.equal(fn(3), 6);
    assert.equal(fn(4), 8);
    assert.equal(fn(3), 6);
    assert.equal(calls, 2);
  });

  it('returns a result for each unique set of arguments', () => {
    const fn = memoize((a, b) => `${a}-${b}`);
    assert.equal(fn('x', 'y'), 'x-y');
    assert.equal(fn('a', 'b'), 'a-b');
    assert.equal(fn('x', 'y'), 'x-y');
  });

  it('clear() empties the cache', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n; });
    fn(1);
    fn.clear();
    fn(1);
    assert.equal(calls, 2);
  });

  it('invalidate() removes a specific cache entry', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n * 3; });
    assert.equal(fn(2), 6);
    assert.equal(fn(3), 9);
    fn.invalidate(2);
    assert.equal(fn(2), 6);  // recomputed
    assert.equal(fn(3), 9);  // still cached
    assert.equal(calls, 3);
  });

  it('respects maxSize by evicting the least-recently-used entry', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n; }, { maxSize: 2 });
    fn(1); // cache: [1]
    fn(2); // cache: [1, 2]
    fn(3); // cache: [2, 3] — 1 evicted
    fn(1); // must recompute
    assert.equal(calls, 4);
  });

  it('TTL expiry causes recomputation after expiry time', async () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n; }, { ttl: 30 });
    fn(1);
    assert.equal(calls, 1);
    fn(1); // still cached
    assert.equal(calls, 1);
    await new Promise((r) => setTimeout(r, 50));
    fn(1); // expired
    assert.equal(calls, 2);
  });

  it('custom keyFn is used for cache keying', () => {
    let calls = 0;
    // Ignore the second argument for caching purposes
    const fn = memoize((a, _b) => { calls++; return a; }, {
      keyFn: (a) => String(a),
    });
    fn('hello', 1);
    fn('hello', 999); // same key — cached
    assert.equal(calls, 1);
  });

  it('exposes .cache as a Map-like object', () => {
    const fn = memoize((n) => n * 2);
    fn(5);
    assert.equal(fn.cache.size, 1);
  });
});

// ─── memoizeAsync ─────────────────────────────────────────────────────────────

describe('memoizeAsync', () => {
  it('caches the resolved value', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (n) => { calls++; return n * 2; });
    assert.equal(await fn(3), 6);
    assert.equal(await fn(3), 6);
    assert.equal(calls, 1);
  });

  it('deduplicates concurrent in-flight requests', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (n) => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return n;
    });
    const [a, b] = await Promise.all([fn(42), fn(42)]);
    assert.equal(a, 42);
    assert.equal(b, 42);
    assert.equal(calls, 1);
  });

  it('removes cache entry on rejection so retries work', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (n) => {
      calls++;
      if (calls === 1) throw new Error('fail');
      return n;
    });
    await assert.rejects(() => fn(1));
    const result = await fn(1); // should retry
    assert.equal(result, 1);
    assert.equal(calls, 2);
  });

  it('different arguments are cached independently', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (n) => { calls++; return n; });
    await fn(1);
    await fn(2);
    await fn(1);
    assert.equal(calls, 2);
  });

  it('TTL causes recomputation after expiry', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (n) => { calls++; return n; }, { ttl: 30 });
    await fn(1);
    await fn(1);
    assert.equal(calls, 1);
    await new Promise((r) => setTimeout(r, 50));
    await fn(1);
    assert.equal(calls, 2);
  });
});

// ─── weakMemoize ─────────────────────────────────────────────────────────────

describe('weakMemoize', () => {
  it('caches result keyed by object identity', () => {
    let calls = 0;
    const fn = weakMemoize((obj) => { calls++; return Object.keys(obj).length; });
    const key = { a: 1, b: 2 };
    assert.equal(fn(key), 2);
    assert.equal(fn(key), 2);
    assert.equal(calls, 1);
  });

  it('treats different objects as different keys', () => {
    let calls = 0;
    const fn = weakMemoize((obj) => { calls++; return obj.x; });
    const a = { x: 1 };
    const b = { x: 1 };
    assert.equal(fn(a), 1);
    assert.equal(fn(b), 1);
    assert.equal(calls, 2);
  });

  it('same object always returns cached value', () => {
    const fn = weakMemoize((obj) => ({ computed: true, ref: obj }));
    const key = {};
    const r1 = fn(key);
    const r2 = fn(key);
    assert.equal(r1, r2); // same reference
  });
});

// ─── once ─────────────────────────────────────────────────────────────────────

describe('once', () => {
  it('executes the function only once', () => {
    let calls = 0;
    const fn = once(() => { calls++; return 42; });
    assert.equal(fn(), 42);
    assert.equal(fn(), 42);
    assert.equal(fn(), 42);
    assert.equal(calls, 1);
  });

  it('always returns the result of the first call', () => {
    let n = 0;
    const fn = once(() => ++n);
    assert.equal(fn(), 1);
    assert.equal(fn(), 1);
  });

  it('uses arguments from the first call only', () => {
    const fn = once((x) => x * 2);
    assert.equal(fn(5), 10);
    assert.equal(fn(99), 10); // ignores 99
  });

  it('works with functions that return objects', () => {
    const obj = { a: 1 };
    const fn = once(() => obj);
    assert.equal(fn(), obj);
    assert.equal(fn(), obj);
  });
});

// ─── thunk ────────────────────────────────────────────────────────────────────

describe('thunk', () => {
  it('defers evaluation until first call', () => {
    let evaluated = false;
    const t = thunk(() => { evaluated = true; return 42; });
    assert.equal(evaluated, false);
    assert.equal(t(), 42);
    assert.equal(evaluated, true);
  });

  it('evaluates only once even when called multiple times', () => {
    let calls = 0;
    const t = thunk(() => { calls++; return 'result'; });
    assert.equal(t(), 'result');
    assert.equal(t(), 'result');
    assert.equal(t(), 'result');
    assert.equal(calls, 1);
  });

  it('caches the computed value', () => {
    const t = thunk(() => ({ computed: true }));
    const a = t();
    const b = t();
    assert.equal(a, b); // same reference
  });

  it('works with side-effectful initialization', () => {
    const log = [];
    const t = thunk(() => { log.push('init'); return log; });
    assert.equal(log.length, 0);
    t();
    t();
    assert.equal(log.length, 1);
  });
});
