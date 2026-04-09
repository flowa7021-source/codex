// ─── Unit Tests: promise-utils ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  delay,
  series,
  parallel,
  pRetry,
  pRace,
  pSettle,
  deferred,
  memoizeAsync,
} from '../../app/modules/promise-utils.js';

// ─── delay ────────────────────────────────────────────────────────────────────

describe('delay', () => {
  it('resolves after approximately the given time', async () => {
    const ms = 30;
    const before = Date.now();
    await delay(ms);
    const elapsed = Date.now() - before;
    // Allow generous tolerance for slow CI environments
    assert.ok(elapsed >= ms - 5, `elapsed ${elapsed}ms should be >= ${ms - 5}ms`);
    assert.ok(elapsed < ms + 200, `elapsed ${elapsed}ms should not overshoot by >200ms`);
  });

  it('resolves immediately for 0ms', async () => {
    const before = Date.now();
    await delay(0);
    const elapsed = Date.now() - before;
    assert.ok(elapsed < 100, `elapsed ${elapsed}ms should be near 0`);
  });
});

// ─── series ───────────────────────────────────────────────────────────────────

describe('series', () => {
  it('resolves all in sequence, returns values in order', async () => {
    const order = [];
    const fns = [
      () => Promise.resolve('a').then((v) => { order.push(1); return v; }),
      () => Promise.resolve('b').then((v) => { order.push(2); return v; }),
      () => Promise.resolve('c').then((v) => { order.push(3); return v; }),
    ];
    const result = await series(fns);
    assert.deepEqual(result, ['a', 'b', 'c']);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('returns empty array for empty input', async () => {
    const result = await series([]);
    assert.deepEqual(result, []);
  });

  it('runs each fn only after the previous resolves', async () => {
    const log = [];
    const fns = [
      () => new Promise((resolve) => setTimeout(() => { log.push('first'); resolve('a'); }, 20)),
      () => new Promise((resolve) => { log.push('second'); resolve('b'); }),
    ];
    const result = await series(fns);
    assert.deepEqual(result, ['a', 'b']);
    assert.deepEqual(log, ['first', 'second']);
  });

  it('rejects if any fn rejects', async () => {
    const fns = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(3),
    ];
    await assert.rejects(() => series(fns), /boom/);
  });
});

// ─── parallel ─────────────────────────────────────────────────────────────────

describe('parallel', () => {
  it('resolves all and returns values in input order', async () => {
    const fns = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];
    const result = await parallel(fns);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;

    const fns = Array.from({ length: 6 }, (_, i) => () =>
      new Promise((resolve) => {
        active++;
        maxActive = Math.max(maxActive, active);
        setTimeout(() => {
          active--;
          resolve(i);
        }, 10);
      })
    );

    const result = await parallel(fns, 2);
    assert.deepEqual(result, [0, 1, 2, 3, 4, 5]);
    assert.ok(maxActive <= 2, `max concurrency was ${maxActive}, expected <= 2`);
  });

  it('runs all in parallel when concurrency exceeds length', async () => {
    const fns = [
      () => Promise.resolve('x'),
      () => Promise.resolve('y'),
    ];
    const result = await parallel(fns, 100);
    assert.deepEqual(result, ['x', 'y']);
  });

  it('returns empty array for empty input', async () => {
    const result = await parallel([]);
    assert.deepEqual(result, []);
  });
});

// ─── pRetry ───────────────────────────────────────────────────────────────────

describe('pRetry', () => {
  it('resolves on first success without retrying', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(42); };
    const result = await pRetry(fn, 3);
    assert.equal(result, 42);
    assert.equal(calls, 1);
  });

  it('retries on failure and resolves when fn succeeds', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('not yet'));
      return Promise.resolve('done');
    };
    const result = await pRetry(fn, 3);
    assert.equal(result, 'done');
    assert.equal(calls, 3);
  });

  it('throws after max attempts are exhausted', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.reject(new Error('always fails')); };
    await assert.rejects(() => pRetry(fn, 3), /always fails/);
    assert.equal(calls, 3);
  });

  it('defaults to 3 attempts', async () => {
    let calls = 0;
    await assert.rejects(
      () => pRetry(() => { calls++; return Promise.reject(new Error('x')); }),
      /x/
    );
    assert.equal(calls, 3);
  });
});

// ─── pRace ────────────────────────────────────────────────────────────────────

describe('pRace', () => {
  it('returns the first resolved value', async () => {
    const promises = [
      new Promise((resolve) => setTimeout(() => resolve('slow'), 50)),
      new Promise((resolve) => setTimeout(() => resolve('fast'), 5)),
      new Promise((resolve) => setTimeout(() => resolve('medium'), 20)),
    ];
    const result = await pRace(promises);
    assert.equal(result, 'fast');
  });

  it('resolves with an already-resolved promise', async () => {
    const result = await pRace([Promise.resolve('immediate'), new Promise(() => {})]);
    assert.equal(result, 'immediate');
  });

  it('rejects if the fastest promise rejects', async () => {
    const promises = [
      Promise.reject(new Error('first-fail')),
      new Promise((resolve) => setTimeout(() => resolve('too-late'), 50)),
    ];
    await assert.rejects(() => pRace(promises), /first-fail/);
  });
});

// ─── pSettle ──────────────────────────────────────────────────────────────────

describe('pSettle', () => {
  it('returns fulfilled and rejected results for all', async () => {
    const promises = [
      Promise.resolve(1),
      Promise.reject(new Error('oops')),
      Promise.resolve(3),
    ];
    const results = await pSettle(promises);
    assert.equal(results.length, 3);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(/** @type {any} */ (results[0]).value, 1);
    assert.equal(results[1].status, 'rejected');
    assert.ok(/** @type {any} */ (results[1]).reason instanceof Error);
    assert.equal(results[2].status, 'fulfilled');
    assert.equal(/** @type {any} */ (results[2]).value, 3);
  });

  it('returns all fulfilled when no rejections', async () => {
    const results = await pSettle([Promise.resolve('a'), Promise.resolve('b')]);
    assert.ok(results.every((r) => r.status === 'fulfilled'));
  });

  it('returns all rejected when all reject', async () => {
    const results = await pSettle([
      Promise.reject(new Error('e1')),
      Promise.reject(new Error('e2')),
    ]);
    assert.ok(results.every((r) => r.status === 'rejected'));
  });

  it('returns empty array for empty input', async () => {
    const results = await pSettle([]);
    assert.deepEqual(results, []);
  });
});

// ─── deferred ─────────────────────────────────────────────────────────────────

describe('deferred', () => {
  it('resolve from outside works', async () => {
    const d = deferred();
    setTimeout(() => d.resolve('hello'), 5);
    const result = await d.promise;
    assert.equal(result, 'hello');
  });

  it('reject from outside works', async () => {
    const d = deferred();
    setTimeout(() => d.reject(new Error('external reject')), 5);
    await assert.rejects(() => d.promise, /external reject/);
  });

  it('promise is pending before resolve/reject', async () => {
    const d = deferred();
    let settled = false;
    d.promise.then(() => { settled = true; }).catch(() => { settled = true; });
    // Allow microtasks to drain
    await Promise.resolve();
    assert.equal(settled, false);
    d.resolve('ok');
    await d.promise;
    assert.equal(settled, true);
  });

  it('resolve with a specific value', async () => {
    const d = /** @type {ReturnType<typeof deferred<number>>} */ (deferred());
    d.resolve(99);
    const result = await d.promise;
    assert.equal(result, 99);
  });
});

// ─── memoizeAsync ─────────────────────────────────────────────────────────────

describe('memoizeAsync', () => {
  it('caches results — same key returns same promise', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (key) => { calls++; return key.toUpperCase(); });
    const [r1, r2] = await Promise.all([fn('a'), fn('a')]);
    assert.equal(r1, 'A');
    assert.equal(r2, 'A');
    assert.equal(calls, 1);
  });

  it('calls fn for different keys', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (key) => { calls++; return key * 2; });
    const r1 = await fn(3);
    const r2 = await fn(5);
    assert.equal(r1, 6);
    assert.equal(r2, 10);
    assert.equal(calls, 2);
  });

  it('second call for same key returns cached result without calling fn again', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (key) => { calls++; return `val-${key}`; });
    await fn('x');
    const result = await fn('x');
    assert.equal(result, 'val-x');
    assert.equal(calls, 1);
  });

  it('accepts a custom key function', async () => {
    let calls = 0;
    const fn = memoizeAsync(
      async (obj) => { calls++; return obj.id; },
      (obj) => String(obj.id),
    );
    await fn({ id: 7 });
    await fn({ id: 7 });
    assert.equal(calls, 1);
  });

  it('removes from cache on rejection so a future call can retry', async () => {
    let calls = 0;
    const fn = memoizeAsync(async (key) => {
      calls++;
      if (calls === 1) throw new Error('first call fails');
      return `ok-${key}`;
    });
    await assert.rejects(() => fn('key'), /first call fails/);
    // Wait for the rejection cleanup microtask
    await Promise.resolve();
    const result = await fn('key');
    assert.equal(result, 'ok-key');
    assert.equal(calls, 2);
  });
});
