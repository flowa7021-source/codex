// ─── Unit Tests: promise-utils ────────────────────────────────────────────────
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import {
  delay,
  timeout,
  mapLimit,
  filterAsync,
  reduceAsync,
  allSettled,
  any,
  retryWithBackoff,
  deferred,
  pQueue,
  promisify,
  tap,
  // new exports
  TimeoutError,
  retry,
  mapConcurrent,
  pDebounce,
  pThrottle,
  race,
  withAbort,
} from '../../app/modules/promise-utils.js';

// ─── delay ────────────────────────────────────────────────────────────────────

describe('delay', () => {
  it('resolves after approximately the given time', async () => {
    const ms = 30;
    const before = Date.now();
    await delay(ms);
    const elapsed = Date.now() - before;
    assert.ok(elapsed >= ms - 5, `elapsed ${elapsed}ms should be >= ${ms - 5}ms`);
    assert.ok(elapsed < ms + 200, `elapsed ${elapsed}ms should not overshoot by >200ms`);
  });

  it('resolves immediately for 0ms', async () => {
    const before = Date.now();
    await delay(0);
    const elapsed = Date.now() - before;
    assert.ok(elapsed < 100, `elapsed ${elapsed}ms should be near 0`);
  });

  it('returns a Promise', async () => {
    const result = delay(0);
    assert.ok(result instanceof Promise);
    await result;
  });
});

// ─── timeout ──────────────────────────────────────────────────────────────────

describe('timeout', () => {
  it('resolves with the original value when promise is fast enough', async () => {
    const fast = Promise.resolve(42);
    const result = await timeout(fast, 500);
    assert.equal(result, 42);
  });

  it('rejects with an Error when promise exceeds the timeout', async () => {
    const slow = new Promise(resolve => setTimeout(() => resolve('late'), 200));
    await assert.rejects(
      () => timeout(slow, 30),
      err => err instanceof Error && /timed out/i.test(err.message),
    );
  });

  it('error message includes the ms value', async () => {
    const slow = new Promise(() => {});
    await assert.rejects(
      () => timeout(slow, 25),
      err => err instanceof Error && err.message.includes('25'),
    );
  });

  it('resolves when promise settles just before deadline', async () => {
    const just_fast = new Promise(resolve => setTimeout(() => resolve('ok'), 10));
    const result = await timeout(just_fast, 500);
    assert.equal(result, 'ok');
  });

  it('propagates rejection from the original promise', async () => {
    const failing = Promise.reject(new Error('original error'));
    await assert.rejects(() => timeout(failing, 500), /original error/);
  });
});

// ─── mapLimit ─────────────────────────────────────────────────────────────────

describe('mapLimit', () => {
  it('returns results in the same order as the input', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapLimit(items, 2, async item => item * 2);
    assert.deepEqual(result, [2, 4, 6, 8, 10]);
  });

  it('respects the concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5, 6];
    await mapLimit(items, 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(10);
      active--;
    });
    assert.ok(maxActive <= 2, `max concurrency was ${maxActive}, expected <= 2`);
  });

  it('returns empty array for empty input', async () => {
    const result = await mapLimit([], 3, async x => x);
    assert.deepEqual(result, []);
  });

  it('passes the correct index to the callback', async () => {
    const indices = [];
    await mapLimit(['a', 'b', 'c'], 1, async (_, index) => {
      indices.push(index);
    });
    assert.deepEqual(indices, [0, 1, 2]);
  });

  it('propagates errors from the mapping function', async () => {
    const items = [1, 2, 3];
    await assert.rejects(
      () => mapLimit(items, 2, async item => {
        if (item === 2) throw new Error('map error');
        return item;
      }),
      /map error/,
    );
  });

  it('runs all items when limit exceeds array length', async () => {
    const result = await mapLimit([10, 20], 100, async x => x + 1);
    assert.deepEqual(result, [11, 21]);
  });

  it('handles limit of 1 (serial)', async () => {
    const order = [];
    await mapLimit([1, 2, 3], 1, async item => {
      order.push(item);
      await delay(5);
    });
    assert.deepEqual(order, [1, 2, 3]);
  });
});

// ─── filterAsync ──────────────────────────────────────────────────────────────

describe('filterAsync', () => {
  it('filters items based on async predicate', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await filterAsync(items, async item => item % 2 === 0);
    assert.deepEqual(result, [2, 4]);
  });

  it('returns all items when predicate is always true', async () => {
    const items = ['a', 'b', 'c'];
    const result = await filterAsync(items, async () => true);
    assert.deepEqual(result, ['a', 'b', 'c']);
  });

  it('returns empty array when predicate is always false', async () => {
    const result = await filterAsync([1, 2, 3], async () => false);
    assert.deepEqual(result, []);
  });

  it('returns empty array for empty input', async () => {
    const result = await filterAsync([], async () => true);
    assert.deepEqual(result, []);
  });

  it('preserves the original order', async () => {
    const items = [5, 3, 1, 4, 2];
    const result = await filterAsync(items, async item => item > 2);
    assert.deepEqual(result, [5, 3, 4]);
  });

  it('propagates errors from predicate', async () => {
    await assert.rejects(
      () => filterAsync([1, 2], async item => {
        if (item === 2) throw new Error('predicate error');
        return true;
      }),
      /predicate error/,
    );
  });
});

// ─── reduceAsync ──────────────────────────────────────────────────────────────

describe('reduceAsync', () => {
  it('reduces array to a single value', async () => {
    const result = await reduceAsync([1, 2, 3, 4], async (acc, item) => acc + item, 0);
    assert.equal(result, 10);
  });

  it('returns the initial value for empty array', async () => {
    const result = await reduceAsync([], async (acc, item) => acc + item, 99);
    assert.equal(result, 99);
  });

  it('passes the correct index to the callback', async () => {
    const indices = [];
    await reduceAsync(['a', 'b', 'c'], async (acc, item, index) => {
      indices.push(index);
      return acc + item;
    }, '');
    assert.deepEqual(indices, [0, 1, 2]);
  });

  it('runs serially (left-to-right)', async () => {
    const order = [];
    await reduceAsync([1, 2, 3], async (acc, item) => {
      order.push(item);
      return acc + item;
    }, 0);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('propagates errors from the reducer', async () => {
    await assert.rejects(
      () => reduceAsync([1, 2, 3], async (acc, item) => {
        if (item === 2) throw new Error('reduce error');
        return acc + item;
      }, 0),
      /reduce error/,
    );
  });

  it('works with object accumulator', async () => {
    const result = await reduceAsync(
      ['a', 'b', 'c'],
      async (acc, item, index) => {
        acc[item] = index;
        return acc;
      },
      /** @type {Record<string, number>} */ ({}),
    );
    assert.deepEqual(result, { a: 0, b: 1, c: 2 });
  });
});

// ─── allSettled ───────────────────────────────────────────────────────────────

describe('allSettled', () => {
  it('returns fulfilled and rejected results for a mixed array', async () => {
    const promises = [
      Promise.resolve(1),
      Promise.reject(new Error('oops')),
      Promise.resolve(3),
    ];
    const results = await allSettled(promises);
    assert.equal(results.length, 3);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(/** @type {any} */ (results[0]).value, 1);
    assert.equal(results[1].status, 'rejected');
    assert.ok(/** @type {any} */ (results[1]).reason instanceof Error);
    assert.equal(results[2].status, 'fulfilled');
    assert.equal(/** @type {any} */ (results[2]).value, 3);
  });

  it('returns all fulfilled when no rejections', async () => {
    const results = await allSettled([Promise.resolve('a'), Promise.resolve('b')]);
    assert.ok(results.every(r => r.status === 'fulfilled'));
  });

  it('returns all rejected when all reject', async () => {
    const results = await allSettled([
      Promise.reject(new Error('e1')),
      Promise.reject(new Error('e2')),
    ]);
    assert.ok(results.every(r => r.status === 'rejected'));
  });

  it('returns empty array for empty input', async () => {
    const results = await allSettled([]);
    assert.deepEqual(results, []);
  });

  it('preserves order matching the input array', async () => {
    const results = await allSettled([
      Promise.resolve('first'),
      Promise.reject(new Error('second')),
      Promise.resolve('third'),
    ]);
    assert.equal(/** @type {any} */ (results[0]).value, 'first');
    assert.equal(results[1].status, 'rejected');
    assert.equal(/** @type {any} */ (results[2]).value, 'third');
  });
});

// ─── any ─────────────────────────────────────────────────────────────────────

describe('any', () => {
  it('resolves with the first fulfilled promise', async () => {
    const promises = [
      new Promise(resolve => setTimeout(() => resolve('slow'), 100)),
      Promise.resolve('fast'),
    ];
    const result = await any(promises);
    assert.equal(result, 'fast');
  });

  it('rejects with AggregateError when all promises reject', async () => {
    const promises = [
      Promise.reject(new Error('err1')),
      Promise.reject(new Error('err2')),
    ];
    await assert.rejects(
      () => any(promises),
      err => err instanceof AggregateError,
    );
  });

  it('rejects immediately for empty array', async () => {
    await assert.rejects(
      () => any([]),
      err => err instanceof AggregateError,
    );
  });

  it('ignores rejections if at least one promise fulfills', async () => {
    const promises = [
      Promise.reject(new Error('fail')),
      Promise.resolve('success'),
    ];
    const result = await any(promises);
    assert.equal(result, 'success');
  });

  it('resolves with the correct value when multiple fulfill', async () => {
    const promises = [
      new Promise(resolve => setTimeout(() => resolve('second'), 20)),
      new Promise(resolve => setTimeout(() => resolve('first'), 5)),
    ];
    const result = await any(promises);
    assert.equal(result, 'first');
  });
});

// ─── retryWithBackoff ─────────────────────────────────────────────────────────

describe('retryWithBackoff', () => {
  it('resolves on the first try when fn succeeds immediately', async () => {
    let calls = 0;
    const result = await retryWithBackoff(() => { calls++; return Promise.resolve(42); }, {
      initialDelay: 0,
    });
    assert.equal(result, 42);
    assert.equal(calls, 1);
  });

  it('retries and resolves when fn succeeds on the 2nd attempt', async () => {
    let calls = 0;
    const result = await retryWithBackoff(
      () => {
        calls++;
        if (calls < 2) return Promise.reject(new Error('not yet'));
        return Promise.resolve('done');
      },
      { maxAttempts: 3, initialDelay: 1 },
    );
    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });

  it('throws after maxAttempts are exhausted', async () => {
    let calls = 0;
    await assert.rejects(
      () => retryWithBackoff(() => { calls++; return Promise.reject(new Error('always fails')); }, {
        maxAttempts: 3,
        initialDelay: 1,
      }),
      /always fails/,
    );
    assert.equal(calls, 3);
  });

  it('defaults to 3 maxAttempts', async () => {
    let calls = 0;
    await assert.rejects(
      () => retryWithBackoff(() => { calls++; return Promise.reject(new Error('x')); }, {
        initialDelay: 1,
      }),
      /x/,
    );
    assert.equal(calls, 3);
  });

  it('calls onError with the error and attempt number on each failure', async () => {
    const errors = [];
    await assert.rejects(
      () => retryWithBackoff(
        () => Promise.reject(new Error('boom')),
        {
          maxAttempts: 3,
          initialDelay: 1,
          onError: (err, attempt) => errors.push({ err, attempt }),
        },
      ),
      /boom/,
    );
    assert.equal(errors.length, 3);
    assert.equal(errors[0].attempt, 1);
    assert.equal(errors[1].attempt, 2);
    assert.equal(errors[2].attempt, 3);
  });

  it('respects maxDelay cap', async () => {
    let calls = 0;
    const timestamps = [];
    await assert.rejects(
      () => retryWithBackoff(
        () => { calls++; timestamps.push(Date.now()); return Promise.reject(new Error('fail')); },
        {
          maxAttempts: 4,
          initialDelay: 5,
          maxDelay: 10,
          factor: 100,
        },
      ),
      /fail/,
    );
    // Verify all delays were capped (no huge pauses)
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      assert.ok(gap < 200, `gap ${gap}ms should be < 200ms (maxDelay capped)`);
    }
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

  it('exposes promise, resolve, and reject properties', async () => {
    const d = deferred();
    assert.ok(d.promise instanceof Promise);
    assert.equal(typeof d.resolve, 'function');
    assert.equal(typeof d.reject, 'function');
    d.resolve(undefined);
  });
});

// ─── pQueue ───────────────────────────────────────────────────────────────────

describe('pQueue', () => {
  it('runs tasks serially by default (concurrency=1)', async () => {
    const order = [];
    const tasks = [
      async () => { order.push(1); await delay(10); return 'a'; },
      async () => { order.push(2); return 'b'; },
      async () => { order.push(3); return 'c'; },
    ];
    const results = await pQueue(tasks);
    assert.deepEqual(results, ['a', 'b', 'c']);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('returns results in the same order as input tasks', async () => {
    const tasks = [
      async () => 'first',
      async () => 'second',
      async () => 'third',
    ];
    const results = await pQueue(tasks, 2);
    assert.deepEqual(results, ['first', 'second', 'third']);
  });

  it('runs concurrently when concurrency > 1', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 6 }, () => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(10);
      active--;
      return active;
    });
    await pQueue(tasks, 3);
    assert.ok(maxActive <= 3, `maxActive ${maxActive} should be <= 3`);
    assert.ok(maxActive > 1, `maxActive ${maxActive} should be > 1 (ran concurrently)`);
  });

  it('returns empty array for empty input', async () => {
    const results = await pQueue([]);
    assert.deepEqual(results, []);
  });

  it('propagates task errors', async () => {
    const tasks = [
      async () => 1,
      async () => { throw new Error('task failed'); },
    ];
    await assert.rejects(() => pQueue(tasks), /task failed/);
  });
});

// ─── promisify ────────────────────────────────────────────────────────────────

describe('promisify', () => {
  it('resolves with the callback result value', async () => {
    const fn = (x, cb) => cb(null, x * 2);
    const result = await promisify(fn, 21);
    assert.equal(result, 42);
  });

  it('rejects when the callback receives an error', async () => {
    const fn = (cb) => cb(new Error('cb error'));
    await assert.rejects(() => promisify(fn), /cb error/);
  });

  it('rejects with an Error when the callback receives a non-Error error', async () => {
    const fn = (cb) => cb('string error');
    await assert.rejects(() => promisify(fn), err => err instanceof Error);
  });

  it('passes multiple arguments to the original function', async () => {
    const fn = (a, b, c, cb) => cb(null, a + b + c);
    const result = await promisify(fn, 1, 2, 3);
    assert.equal(result, 6);
  });

  it('works with no extra arguments (just the callback)', async () => {
    const fn = (cb) => cb(null, 'value');
    const result = await promisify(fn);
    assert.equal(result, 'value');
  });

  it('resolves with undefined when result is null/undefined', async () => {
    const fn = (cb) => cb(null, undefined);
    const result = await promisify(fn);
    assert.equal(result, undefined);
  });
});

// ─── tap ─────────────────────────────────────────────────────────────────────

describe('tap', () => {
  it('returns the original resolved value unchanged', async () => {
    const result = await tap(Promise.resolve(42), () => 'ignored');
    assert.equal(result, 42);
  });

  it('runs the side-effect function with the resolved value', async () => {
    let seen = null;
    await tap(Promise.resolve('hello'), value => { seen = value; });
    assert.equal(seen, 'hello');
  });

  it('propagates rejection from the original promise', async () => {
    await assert.rejects(
      () => tap(Promise.reject(new Error('original')), () => {}),
      /original/,
    );
  });

  it('waits for an async side-effect before resolving', async () => {
    const log = [];
    const result = await tap(Promise.resolve(7), async value => {
      await delay(10);
      log.push(value);
    });
    assert.equal(result, 7);
    assert.deepEqual(log, [7]);
  });

  it('does not change the value even if the side-effect returns a different value', async () => {
    const result = await tap(Promise.resolve(10), () => 999);
    assert.equal(result, 10);
  });

  it('side-effect errors do not suppress the original value (propagated)', async () => {
    // tap propagates errors from fn (this is expected behavior)
    await assert.rejects(
      () => tap(Promise.resolve('ok'), () => { throw new Error('side effect error'); }),
      /side effect error/,
    );
  });
});

// ─── TimeoutError ─────────────────────────────────────────────────────────────

describe('TimeoutError', () => {
  it('is an instance of Error', () => {
    const err = new TimeoutError(100);
    assert.ok(err instanceof Error);
  });

  it('is an instance of TimeoutError', () => {
    const err = new TimeoutError(100);
    assert.ok(err instanceof TimeoutError);
  });

  it('has name "TimeoutError"', () => {
    const err = new TimeoutError(100);
    assert.equal(err.name, 'TimeoutError');
  });

  it('message contains the ms value', () => {
    const err = new TimeoutError(250);
    assert.ok(err.message.includes('250'), `expected message to contain 250, got: ${err.message}`);
  });

  it('stack is populated', () => {
    const err = new TimeoutError(1);
    assert.ok(typeof err.stack === 'string');
  });
});

// ─── timeout (TimeoutError) ───────────────────────────────────────────────────

describe('timeout – TimeoutError variant', () => {
  it('rejects with TimeoutError (not plain Error) on timeout', async () => {
    await assert.rejects(
      () => timeout(new Promise(() => {}), 15),
      (err) => err instanceof TimeoutError,
    );
  });

  it('does not leave a dangling timer when promise resolves first', async () => {
    // Should resolve cleanly without any unhandled-rejection noise
    const result = await timeout(Promise.resolve('clean'), 500);
    assert.equal(result, 'clean');
  });

  it('clears timer when underlying promise rejects before deadline', async () => {
    const err = new Error('rejected first');
    await assert.rejects(
      () => timeout(Promise.reject(err), 500),
      (e) => e === err,
    );
  });
});

// ─── retry ────────────────────────────────────────────────────────────────────

describe('retry', () => {
  it('returns value on first success', async () => {
    const fn = mock.fn(() => Promise.resolve(42));
    const result = await retry(fn);
    assert.equal(result, 42);
    assert.equal(fn.mock.calls.length, 1);
  });

  it('retries on failure and succeeds on 2nd attempt', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(new Error('not yet'));
      return Promise.resolve('done');
    };
    const result = await retry(fn, { retries: 3, delay: 0 });
    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });

  it('throws last error after all retries exhausted', async () => {
    const err = new Error('always fails');
    const fn = () => Promise.reject(err);
    await assert.rejects(
      () => retry(fn, { retries: 2, delay: 0 }),
      (e) => e === err,
    );
  });

  it('default retries=3 means 4 total calls', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.reject(new Error('x')); };
    await assert.rejects(() => retry(fn, { delay: 0 }));
    assert.equal(calls, 4);
  });

  it('retries: 0 means only 1 attempt total', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.reject(new Error('x')); };
    await assert.rejects(() => retry(fn, { retries: 0 }));
    assert.equal(calls, 1);
  });

  it('respects delay between retries', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    };
    const start = Date.now();
    await retry(fn, { retries: 2, delay: 20 });
    assert.ok(Date.now() - start >= 15, 'should have waited for delay');
  });

  it('succeeds immediately when retries: 0 and fn resolves', async () => {
    const result = await retry(() => Promise.resolve('yes'), { retries: 0 });
    assert.equal(result, 'yes');
  });

  it('backoff > 1 increases delay each retry without throwing', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('x'));
      return Promise.resolve('done');
    };
    const result = await retry(fn, { retries: 3, delay: 5, backoff: 2 });
    assert.equal(result, 'done');
    assert.equal(calls, 3);
  });

  it('delay: 0 with backoff: 1 does not sleep between retries', async () => {
    const start = Date.now();
    let calls = 0;
    const fn = () => { calls++; return Promise.reject(new Error('x')); };
    await assert.rejects(() => retry(fn, { retries: 3, delay: 0, backoff: 1 }));
    assert.ok(Date.now() - start < 200, 'no-delay retries should complete quickly');
    assert.equal(calls, 4);
  });
});

// ─── mapConcurrent ────────────────────────────────────────────────────────────

describe('mapConcurrent', () => {
  it('maps items and preserves order', async () => {
    const results = await mapConcurrent(
      [1, 2, 3],
      (x) => Promise.resolve(x * 2),
      2,
    );
    assert.deepEqual(results, [2, 4, 6]);
  });

  it('limits concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const fn = async (x) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(10);
      active--;
      return x;
    };
    await mapConcurrent([1, 2, 3, 4, 5], fn, 2);
    assert.ok(maxActive <= 2, `max concurrent was ${maxActive}, expected <= 2`);
  });

  it('concurrency=1 processes items serially', async () => {
    const order = [];
    const fn = async (x) => {
      order.push(`start-${x}`);
      await delay(5);
      order.push(`end-${x}`);
      return x;
    };
    await mapConcurrent([1, 2, 3], fn, 1);
    assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
  });

  it('returns empty array for empty input', async () => {
    const results = await mapConcurrent([], () => Promise.resolve(0), 4);
    assert.deepEqual(results, []);
  });

  it('concurrency larger than item count works', async () => {
    const results = await mapConcurrent([10, 20], (x) => Promise.resolve(x + 1), 10);
    assert.deepEqual(results, [11, 21]);
  });

  it('propagates errors from fn', async () => {
    const boom = new Error('boom');
    await assert.rejects(
      () => mapConcurrent([1, 2], () => Promise.reject(boom), 2),
      (e) => e === boom,
    );
  });

  it('single item with concurrency=1', async () => {
    const results = await mapConcurrent(['hello'], (x) => Promise.resolve(x.toUpperCase()), 1);
    assert.deepEqual(results, ['HELLO']);
  });
});

// ─── deferred (new tests) ─────────────────────────────────────────────────────

describe('deferred – additional', () => {
  it('resolve with a PromiseLike value chains correctly', async () => {
    const d = deferred();
    d.resolve(Promise.resolve('chained'));
    const result = await d.promise;
    assert.equal(result, 'chained');
  });

  it('reject without argument settles with undefined reason', async () => {
    const d = deferred();
    d.reject();
    await assert.rejects(() => d.promise, (e) => e === undefined);
  });
});

// ─── race ─────────────────────────────────────────────────────────────────────

describe('race', () => {
  it('resolves with the first fulfilled value', async () => {
    const result = await race([
      new Promise((res) => setTimeout(() => res('slow'), 40)),
      new Promise((res) => setTimeout(() => res('fast'), 5)),
    ]);
    assert.equal(result, 'fast');
  });

  it('rejects with the first rejected reason', async () => {
    const boom = new Error('first-reject');
    await assert.rejects(
      () => race([
        new Promise((_, rej) => setTimeout(() => rej(boom), 5)),
        new Promise((res) => setTimeout(() => res('late'), 50)),
      ]),
      (e) => e === boom,
    );
  });

  it('single-element array resolves correctly', async () => {
    const result = await race([Promise.resolve('only')]);
    assert.equal(result, 'only');
  });

  it('already-resolved promise wins', async () => {
    const result = await race([
      Promise.resolve(7),
      new Promise((res) => setTimeout(() => res(8), 50)),
    ]);
    assert.equal(result, 7);
  });

  it('returns the same promise semantics as Promise.race', async () => {
    const p1 = Promise.resolve('a');
    const p2 = Promise.resolve('b');
    const result = await race([p1, p2]);
    // Either 'a' or 'b' – both already resolved, so implementation-defined
    assert.ok(result === 'a' || result === 'b');
  });
});

// ─── any (new tests) ──────────────────────────────────────────────────────────

describe('any – additional', () => {
  it('resolves with the first fulfilled even among rejections', async () => {
    const result = await any([
      Promise.reject(new Error('no-1')),
      Promise.resolve('yes'),
      Promise.reject(new Error('no-2')),
    ]);
    assert.equal(result, 'yes');
  });

  it('AggregateError contains all rejection reasons', async () => {
    const e1 = new Error('a');
    const e2 = new Error('b');
    await assert.rejects(
      () => any([Promise.reject(e1), Promise.reject(e2)]),
      (e) => e instanceof AggregateError && e.errors.includes(e1) && e.errors.includes(e2),
    );
  });
});

// ─── withAbort ────────────────────────────────────────────────────────────────

describe('withAbort', () => {
  it('exposes promise and abort()', () => {
    const { promise, abort } = withAbort(() => delay(10000));
    assert.ok(promise instanceof Promise);
    assert.equal(typeof abort, 'function');
    abort(); // cleanup
    return promise.catch(() => {}); // swallow AbortError
  });

  it('resolves normally when not aborted', async () => {
    const { promise } = withAbort(() => Promise.resolve('done'));
    assert.equal(await promise, 'done');
  });

  it('rejects with DOMException(AbortError) when abort() is called', async () => {
    const { promise, abort } = withAbort(() => delay(2000));
    setTimeout(abort, 10);
    await assert.rejects(
      () => promise,
      (e) => e instanceof DOMException && e.name === 'AbortError',
    );
  });

  it('passes a valid AbortSignal to fn', async () => {
    let receivedSignal;
    const { promise } = withAbort((signal) => {
      receivedSignal = signal;
      return Promise.resolve('ok');
    });
    await promise;
    assert.ok(receivedSignal instanceof AbortSignal);
  });

  it('propagates rejection from fn', async () => {
    const err = new Error('fn failed');
    const { promise } = withAbort(() => Promise.reject(err));
    await assert.rejects(() => promise, (e) => e === err);
  });

  it('abort after resolution does not change the resolved value', async () => {
    const { promise, abort } = withAbort(() => Promise.resolve('value'));
    const result = await promise;
    abort(); // too late
    assert.equal(result, 'value');
  });
});

// ─── pDebounce ────────────────────────────────────────────────────────────────

describe('pDebounce', () => {
  it('calls fn only once when invoked multiple times rapidly', async () => {
    const fn = mock.fn(() => Promise.resolve('result'));
    const debounced = pDebounce(fn, 20);

    const p1 = debounced('a');
    const p2 = debounced('b');
    const p3 = debounced('c');

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    assert.equal(fn.mock.calls.length, 1);
    assert.equal(r1, 'result');
    assert.equal(r2, 'result');
    assert.equal(r3, 'result');
  });

  it('uses the last arguments passed', async () => {
    const received = [];
    const fn = mock.fn((x) => { received.push(x); return Promise.resolve(x); });
    const debounced = pDebounce(fn, 20);

    debounced('first');
    debounced('second');
    const result = await debounced('third');

    assert.equal(result, 'third');
    assert.deepEqual(received, ['third']);
  });

  it('resets the timer on each rapid call', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(calls); };
    const debounced = pDebounce(fn, 30);

    const p1 = debounced();
    await delay(15);
    const p2 = debounced(); // resets timer
    await delay(15);
    const p3 = debounced(); // resets timer again

    await Promise.all([p1, p2, p3]);
    assert.equal(calls, 1);
  });

  it('propagates rejection to all pending callers', async () => {
    const err = new Error('debounce fail');
    const fn = () => Promise.reject(err);
    const debounced = pDebounce(fn, 10);

    const p1 = debounced();
    const p2 = debounced();

    const results = await Promise.allSettled([p1, p2]);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[0].reason, err);
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason, err);
  });

  it('allows a second invocation after the first window expires', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(calls); };
    const debounced = pDebounce(fn, 15);

    const r1 = await debounced();
    await delay(25); // wait for window to expire
    const r2 = await debounced();

    assert.equal(calls, 2);
    assert.equal(r1, 1);
    assert.equal(r2, 2);
  });

  it('single call resolves with fn result', async () => {
    const fn = () => Promise.resolve(42);
    const debounced = pDebounce(fn, 10);
    const result = await debounced();
    assert.equal(result, 42);
  });
});

// ─── pThrottle ────────────────────────────────────────────────────────────────

describe('pThrottle', () => {
  it('calls fn immediately on first invocation', async () => {
    const fn = mock.fn(() => Promise.resolve('first'));
    const throttled = pThrottle(fn, 50);
    const result = await throttled();
    assert.equal(result, 'first');
    assert.equal(fn.mock.calls.length, 1);
  });

  it('queues a call made during cooldown and fires after window', async () => {
    const results = [];
    const fn = (x) => { results.push(x); return Promise.resolve(x); };
    const throttled = pThrottle(fn, 20);

    const p1 = throttled('a');  // fires immediately
    const p2 = throttled('b');  // queued

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, 'a');
    assert.equal(r2, 'b');
    assert.equal(results[0], 'a');
    assert.equal(results[1], 'b');
  });

  it('most-recent queued args win when multiple calls queue during cooldown', async () => {
    const received = [];
    const fn = (x) => { received.push(x); return Promise.resolve(x); };
    const throttled = pThrottle(fn, 30);

    const p1 = throttled('first');   // fires immediately
    throttled('second');             // queued, will be replaced
    const p3 = throttled('third');   // replaces 'second' in queue

    await Promise.all([p1, p3]);
    assert.ok(received.includes('first'), 'first call should have fired');
    assert.ok(received.includes('third'), 'queued call with latest args should have fired');
    assert.ok(!received.includes('second'), 'intermediate queued call should have been dropped');
  });

  it('does not call fn during cooldown window', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(calls); };
    const throttled = pThrottle(fn, 50);

    throttled(); // fires immediately
    throttled(); // queued
    throttled(); // replaces queued

    // At this point only 1 call should have fired synchronously
    assert.equal(calls, 1);
  });

  it('fn return value is passed through to the caller', async () => {
    const fn = (x) => Promise.resolve(x * 10);
    const throttled = pThrottle(fn, 20);
    const result = await throttled(5);
    assert.equal(result, 50);
  });
});
