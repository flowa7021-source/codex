// ─── Unit Tests: memoize ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  memoize,
  memoizeTTL,
  memoizeLRU,
  debounce,
  throttle,
  once,
  retry,
  memoizeAsync,
  weakMemoize,
  thunk,
} from '../../app/modules/memoize.js';

// ─── memoize ─────────────────────────────────────────────────────────────────

describe('memoize', () => {
  it('returns cached result on cache hit (same first arg)', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n * 2; });
    assert.equal(fn(5), 10);
    assert.equal(fn(5), 10);
    assert.equal(calls, 1);
  });

  it('recomputes for a different first argument', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n; });
    fn(1);
    fn(2);
    assert.equal(calls, 2);
    fn(1); // cached
    assert.equal(calls, 2);
  });

  it('custom keyFn is used for cache keying', () => {
    let calls = 0;
    // Key on first arg only, ignore second
    const fn = memoize((a, _b) => { calls++; return a; }, (a) => a);
    fn('x', 1);
    fn('x', 999); // same key — should be a cache hit
    assert.equal(calls, 1);
  });

  it('custom keyFn receives all arguments', () => {
    let calls = 0;
    const fn = memoize((a, b) => { calls++; return `${a}:${b}`; }, (a, b) => `${a}|${b}`);
    assert.equal(fn('foo', 'bar'), 'foo:bar');
    assert.equal(fn('foo', 'bar'), 'foo:bar');
    assert.equal(calls, 1);
    fn('foo', 'baz'); // different composite key
    assert.equal(calls, 2);
  });

  it('.cache is a Map-like with correct size', () => {
    const fn = memoize((n) => n);
    fn(1);
    fn(2);
    assert.equal(fn.cache.size, 2);
  });

  it('.cache.clear() empties the cache via the proxy', () => {
    const fn = memoize((n) => n);
    fn(42);
    assert.equal(fn.cache.size, 1);
    fn.cache.clear();
    assert.equal(fn.cache.size, 0);
  });

  it('.clear() empties the cache', () => {
    let calls = 0;
    const fn = memoize((n) => { calls++; return n; });
    fn(1);
    fn.clear();
    fn(1);
    assert.equal(calls, 2);
  });

  it('call count reflects cache hits', () => {
    let calls = 0;
    const fn = memoize((s) => { calls++; return s.length; });
    fn('hello');
    fn('hello');
    fn('world');
    fn('world');
    assert.equal(calls, 2);
  });

  it('works with zero-argument functions using explicit keyFn', () => {
    let calls = 0;
    const fn = memoize(() => { calls++; return 99; }, () => 'fixed');
    fn();
    fn();
    assert.equal(calls, 1);
  });

  it('works with multiple arguments when options keyFn provided', () => {
    let calls = 0;
    const fn = memoize((a, b, c) => { calls++; return a + b + c; }, { keyFn: (a, b, c) => `${a}|${b}|${c}` });
    assert.equal(fn(1, 2, 3), 6);
    assert.equal(fn(1, 2, 3), 6);
    assert.equal(calls, 1);
    fn(1, 2, 4);
    assert.equal(calls, 2);
  });
});

// ─── memoizeTTL ──────────────────────────────────────────────────────────────

describe('memoizeTTL', () => {
  it('returns cached value within the TTL window', () => {
    let calls = 0;
    const fn = memoizeTTL((n) => { calls++; return n; }, 200);
    fn(1);
    fn(1);
    assert.equal(calls, 1);
  });

  it('recomputes after the TTL expires', async () => {
    let calls = 0;
    const fn = memoizeTTL((n) => { calls++; return n; }, 30);
    fn(1);
    assert.equal(calls, 1);
    await new Promise((r) => setTimeout(r, 60));
    fn(1);
    assert.equal(calls, 2);
  });

  it('caches different keys independently', () => {
    let calls = 0;
    const fn = memoizeTTL((n) => { calls++; return n * 10; }, 500);
    assert.equal(fn(1), 10);
    assert.equal(fn(2), 20);
    assert.equal(fn(1), 10);
    assert.equal(calls, 2);
  });

  it('accepts a custom keyFn', () => {
    let calls = 0;
    const fn = memoizeTTL((a, _b) => { calls++; return a; }, 500, (a) => a);
    fn('x', 1);
    fn('x', 999);
    assert.equal(calls, 1);
  });

  it('.clear() removes all TTL entries', async () => {
    let calls = 0;
    const fn = memoizeTTL((n) => { calls++; return n; }, 500);
    fn(7);
    fn.clear();
    fn(7);
    assert.equal(calls, 2);
  });
});

// ─── memoizeLRU ──────────────────────────────────────────────────────────────

describe('memoizeLRU', () => {
  it('caches results up to maxSize', () => {
    let calls = 0;
    const fn = memoizeLRU((n) => { calls++; return n; }, 3);
    fn(1); fn(2); fn(3);
    assert.equal(calls, 3);
    fn(1); fn(2); fn(3); // all still cached
    assert.equal(calls, 3);
  });

  it('evicts the least recently used entry when maxSize is exceeded', () => {
    let calls = 0;
    const fn = memoizeLRU((n) => { calls++; return n; }, 2);
    fn(1); // cache: [1]
    fn(2); // cache: [1, 2]
    fn(3); // cache: [2, 3] — 1 evicted
    fn(1); // must recompute
    assert.equal(calls, 4);
  });

  it('accessing an entry refreshes its recency', () => {
    let calls = 0;
    const fn = memoizeLRU((n) => { calls++; return n; }, 2);
    fn(1); // cache: [1]
    fn(2); // cache: [1, 2]
    fn(1); // access 1 → refresh, cache: [2, 1]
    fn(3); // cache: [1, 3] — 2 evicted (oldest)
    fn(2); // must recompute
    assert.equal(calls, 4);
  });

  it('.size reflects the current number of cached entries', () => {
    const fn = memoizeLRU((n) => n, 5);
    fn(1); fn(2); fn(3);
    assert.equal(fn.size, 3);
  });

  it('.clear() empties the LRU cache', () => {
    let calls = 0;
    const fn = memoizeLRU((n) => { calls++; return n; }, 10);
    fn(1);
    fn.clear();
    assert.equal(fn.size, 0);
    fn(1);
    assert.equal(calls, 2);
  });

  it('accepts a custom keyFn', () => {
    let calls = 0;
    const fn = memoizeLRU((a, _b) => { calls++; return a; }, 5, (a) => a);
    fn('z', 1);
    fn('z', 2); // same key
    assert.equal(calls, 1);
  });
});

// ─── debounce ─────────────────────────────────────────────────────────────────

describe('debounce', () => {
  it('does not invoke the function before the delay elapses', async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 50);
    fn();
    assert.equal(calls, 0);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(calls, 1);
  });

  it('invokes exactly once after multiple rapid calls', async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 50);
    fn(); fn(); fn();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(calls, 1);
  });

  it('.cancel() prevents the pending invocation', async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 50);
    fn();
    fn.cancel();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(calls, 0);
  });

  it('.flush() triggers the pending call immediately', () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 200);
    fn();
    assert.equal(calls, 0);
    fn.flush();
    assert.equal(calls, 1);
  });

  it('passes the latest arguments to the debounced function', async () => {
    const received = [];
    const fn = debounce((v) => { received.push(v); }, 40);
    fn(1); fn(2); fn(3);
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(received, [3]);
  });
});

// ─── throttle ─────────────────────────────────────────────────────────────────

describe('throttle', () => {
  it('calls the function immediately on the first invocation', () => {
    let calls = 0;
    const fn = throttle(() => { calls++; }, 100);
    fn();
    assert.equal(calls, 1);
  });

  it('suppresses calls within the cooldown interval', () => {
    let calls = 0;
    const fn = throttle(() => { calls++; }, 200);
    fn(); fn(); fn();
    assert.equal(calls, 1);
  });

  it('allows a second call after the interval has passed', async () => {
    let calls = 0;
    const fn = throttle(() => { calls++; }, 40);
    fn();
    await new Promise((r) => setTimeout(r, 60));
    fn();
    assert.equal(calls, 2);
  });

  it('.cancel() resets the throttle so the next call fires immediately', () => {
    let calls = 0;
    const fn = throttle(() => { calls++; }, 1000);
    fn();
    fn.cancel();
    fn();
    assert.equal(calls, 2);
  });

  it('passes arguments through to the original function', () => {
    const results = [];
    const fn = throttle((v) => { results.push(v); }, 1000);
    fn(42);
    assert.deepEqual(results, [42]);
  });
});

// ─── once ─────────────────────────────────────────────────────────────────────

describe('once', () => {
  it('calls the function only on the first invocation', () => {
    let calls = 0;
    const fn = once(() => { calls++; return 42; });
    fn(); fn(); fn();
    assert.equal(calls, 1);
  });

  it('always returns the result of the first call', () => {
    let n = 0;
    const fn = once(() => ++n);
    assert.equal(fn(), 1);
    assert.equal(fn(), 1);
  });

  it('uses the arguments from the first call only', () => {
    const fn = once((x) => x * 2);
    assert.equal(fn(5), 10);
    assert.equal(fn(99), 10); // 99 is ignored
  });

  it('returns undefined when the wrapped function returns undefined', () => {
    const fn = once(() => undefined);
    assert.equal(fn(), undefined);
    assert.equal(fn(), undefined);
  });

  it('works with functions that return objects (reference equality)', () => {
    const obj = { a: 1 };
    const fn = once(() => obj);
    assert.equal(fn(), obj);
    assert.equal(fn(), obj);
  });

  it('works with zero-argument functions', () => {
    let calls = 0;
    const fn = once(() => { calls++; return 'done'; });
    assert.equal(fn(), 'done');
    assert.equal(fn(), 'done');
    assert.equal(calls, 1);
  });
});

// ─── retry ────────────────────────────────────────────────────────────────────

describe('retry', () => {
  it('resolves immediately when fn succeeds on the first attempt', async () => {
    let calls = 0;
    const result = await retry(() => { calls++; return 'ok'; }, 3);
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('succeeds after one initial failure', async () => {
    let calls = 0;
    const result = await retry(() => {
      calls++;
      if (calls < 2) throw new Error('fail');
      return 'recovered';
    }, 3);
    assert.equal(result, 'recovered');
    assert.equal(calls, 2);
  });

  it('succeeds after multiple failures within maxAttempts', async () => {
    let calls = 0;
    const result = await retry(() => {
      calls++;
      if (calls < 3) throw new Error('not yet');
      return calls;
    }, 5);
    assert.equal(result, 3);
  });

  it('throws after all maxAttempts are exhausted', async () => {
    let calls = 0;
    await assert.rejects(
      () => retry(() => { calls++; throw new Error(`fail #${calls}`); }, 3),
      /fail #3/,
    );
    assert.equal(calls, 3);
  });

  it('re-throws the last error when all attempts fail', async () => {
    const sentinel = new Error('final');
    let calls = 0;
    const err = await retry(() => { calls++; throw sentinel; }, 2).catch((e) => e);
    assert.equal(err, sentinel);
  });

  it('works with async fn (Promise-returning)', async () => {
    let calls = 0;
    const result = await retry(async () => { calls++; return calls * 10; }, 2);
    assert.equal(result, 10);
  });

  it('respects delayMs between attempts without excessive delay', async () => {
    let calls = 0;
    const start = Date.now();
    await retry(() => {
      calls++;
      if (calls < 3) throw new Error('retry');
      return 'done';
    }, 3, 10);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 20, `elapsed=${elapsed} should be ≥ 20ms`);
  });

  it('maxAttempts=1 throws immediately without retrying', async () => {
    let calls = 0;
    await assert.rejects(
      () => retry(() => { calls++; throw new Error('once'); }, 1),
    );
    assert.equal(calls, 1);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('memoize with no args and no keyFn uses undefined as key', () => {
    let calls = 0;
    const fn = memoize(() => { calls++; return 42; });
    fn();
    fn();
    // Both calls produce key=undefined; second call should be a cache hit.
    assert.equal(calls, 1);
  });

  it('memoizeLRU maxSize=1 always evicts the previous entry', () => {
    let calls = 0;
    const fn = memoizeLRU((n) => { calls++; return n; }, 1);
    fn(1);
    fn(2);
    fn(1); // 1 was evicted when 2 was inserted
    assert.equal(calls, 3);
    assert.equal(fn.size, 1);
  });

  it('retry with maxAttempts=0 throws immediately (empty loop)', async () => {
    // The loop body never executes; lastError is undefined, so throw undefined.
    // Just confirm it rejects.
    let threw = false;
    try {
      await retry(() => 'ok', 0);
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it('once preserves `this` context of the first call', () => {
    const obj = { value: 7, get: once(function () { return this.value; }) };
    assert.equal(obj.get(), 7);
    assert.equal(obj.get(), 7);
  });

  it('debounce cancel is a no-op when nothing is pending', () => {
    const fn = debounce(() => {}, 100);
    assert.doesNotThrow(() => fn.cancel());
  });

  it('debounce flush is a no-op when nothing is pending', () => {
    const fn = debounce(() => {}, 100);
    assert.doesNotThrow(() => fn.flush());
  });
});

// ─── memoizeAsync (backwards-compat) ─────────────────────────────────────────

describe('memoizeAsync', () => {
  it('caches the resolved value', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (n) => { calls++; return n * 2; });
    assert.equal(await fn(3), 6);
    assert.equal(await fn(3), 6);
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
    const result = await fn(1);
    assert.equal(result, 1);
    assert.equal(calls, 2);
  });
});

// ─── weakMemoize (backwards-compat) ──────────────────────────────────────────

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
    fn(a);
    fn(b);
    assert.equal(calls, 2);
  });
});

// ─── thunk (backwards-compat) ─────────────────────────────────────────────────

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
    t(); t(); t();
    assert.equal(calls, 1);
  });
});
