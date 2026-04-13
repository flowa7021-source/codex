// ─── Unit Tests: promise-pool ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  promisePool,
  pMap,
  pAll,
  pSeries,
  pRetry,
  pTimeout,
  pDebounce,
} from '../../app/modules/promise-pool.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Resolve after `ms` milliseconds. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create a task that resolves with `value` after `ms` milliseconds. */
function makeTask(value, ms = 0) {
  return () => delay(ms).then(() => value);
}

// ─── promisePool ──────────────────────────────────────────────────────────────

describe('promisePool', () => {
  it('resolves all tasks and returns results in order', async () => {
    const tasks = [makeTask(1), makeTask(2), makeTask(3)];
    const results = await promisePool(tasks, 2);
    assert.deepEqual(results, [1, 2, 3]);
  });

  it('returns empty array for empty task list', async () => {
    const results = await promisePool([], 5);
    assert.deepEqual(results, []);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const concurrency = 2;

    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(20);
      active--;
      return i;
    });

    await promisePool(tasks, concurrency);
    assert.ok(maxActive <= concurrency, `max active was ${maxActive}, expected <= ${concurrency}`);
  });

  it('handles concurrency larger than task count', async () => {
    const tasks = [makeTask('a'), makeTask('b')];
    const results = await promisePool(tasks, 10);
    assert.deepEqual(results, ['a', 'b']);
  });

  it('handles concurrency of 1 (sequential)', async () => {
    const order = [];
    const tasks = [0, 1, 2].map((i) => async () => {
      order.push(i);
      return i;
    });
    const results = await promisePool(tasks, 1);
    assert.deepEqual(results, [0, 1, 2]);
    assert.deepEqual(order, [0, 1, 2]);
  });

  it('propagates errors', async () => {
    const tasks = [
      makeTask(1),
      () => Promise.reject(new Error('boom')),
      makeTask(3),
    ];
    await assert.rejects(() => promisePool(tasks, 2), /boom/);
  });
});

// ─── pMap ────────────────────────────────────────────────────────────────────

describe('pMap', () => {
  it('maps over items and returns results in order', async () => {
    const results = await pMap([1, 2, 3, 4], async (x) => x * 2, 2);
    assert.deepEqual(results, [2, 4, 6, 8]);
  });

  it('passes the index to the mapping function', async () => {
    const results = await pMap(['a', 'b', 'c'], async (item, i) => `${i}:${item}`, 3);
    assert.deepEqual(results, ['0:a', '1:b', '2:c']);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    await pMap(
      Array.from({ length: 8 }, (_, i) => i),
      async (x) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await delay(10);
        active--;
        return x;
      },
      3,
    );
    assert.ok(maxActive <= 3);
  });

  it('returns empty array for empty items', async () => {
    const results = await pMap([], async (x) => x, 2);
    assert.deepEqual(results, []);
  });
});

// ─── pAll ────────────────────────────────────────────────────────────────────

describe('pAll', () => {
  it('resolves all factories and returns results in order', async () => {
    const results = await pAll([makeTask(10), makeTask(20), makeTask(30)], 2);
    assert.deepEqual(results, [10, 20, 30]);
  });

  it('returns empty array for empty factory list', async () => {
    assert.deepEqual(await pAll([], 3), []);
  });
});

// ─── pSeries ─────────────────────────────────────────────────────────────────

describe('pSeries', () => {
  it('runs tasks sequentially and returns results in order', async () => {
    const order = [];
    const tasks = [0, 1, 2, 3].map((i) => async () => {
      order.push(i);
      return i * 10;
    });
    const results = await pSeries(tasks);
    assert.deepEqual(results, [0, 10, 20, 30]);
    assert.deepEqual(order, [0, 1, 2, 3]);
  });

  it('returns empty array for no tasks', async () => {
    assert.deepEqual(await pSeries([]), []);
  });

  it('runs only one task at a time', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 5 }, () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(5);
      concurrent--;
    });
    await pSeries(tasks);
    assert.equal(maxConcurrent, 1);
  });
});

// ─── pRetry ──────────────────────────────────────────────────────────────────

describe('pRetry', () => {
  it('resolves immediately when task succeeds on first attempt', async () => {
    const result = await pRetry(() => Promise.resolve(42), { maxAttempts: 3 });
    assert.equal(result, 42);
  });

  it('retries and eventually succeeds', async () => {
    let attempts = 0;
    const result = await pRetry(
      () => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error('not yet'));
        return Promise.resolve('success');
      },
      { maxAttempts: 5 },
    );
    assert.equal(result, 'success');
    assert.equal(attempts, 3);
  });

  it('throws the last error after exhausting maxAttempts', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        pRetry(
          () => {
            attempts++;
            return Promise.reject(new Error(`attempt ${attempts}`));
          },
          { maxAttempts: 3 },
        ),
      /attempt 3/,
    );
    assert.equal(attempts, 3);
  });

  it('respects maxAttempts of 1 (no retries)', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        pRetry(
          () => {
            attempts++;
            return Promise.reject(new Error('fail'));
          },
          { maxAttempts: 1 },
        ),
      /fail/,
    );
    assert.equal(attempts, 1);
  });

  it('applies delay between retries', async () => {
    let attempts = 0;
    const start = Date.now();
    await pRetry(
      () => {
        attempts++;
        if (attempts < 3) return Promise.reject(new Error('retry'));
        return Promise.resolve('ok');
      },
      { maxAttempts: 3, delay: 20 },
    );
    const elapsed = Date.now() - start;
    // 2 delays of 20ms each = 40ms minimum
    assert.ok(elapsed >= 35, `elapsed ${elapsed}ms < 35ms`);
  });

  it('applies backoff multiplier', async () => {
    let attempts = 0;
    const timestamps = [];
    await pRetry(
      () => {
        attempts++;
        timestamps.push(Date.now());
        if (attempts < 3) return Promise.reject(new Error('retry'));
        return Promise.resolve('ok');
      },
      { maxAttempts: 3, delay: 20, backoff: 2 },
    );
    // First retry delay ~20ms, second retry delay ~40ms
    const firstGap = timestamps[1] - timestamps[0];
    const secondGap = timestamps[2] - timestamps[1];
    assert.ok(firstGap >= 15, `first gap ${firstGap}ms too small`);
    assert.ok(secondGap >= 35, `second gap ${secondGap}ms too small`);
    assert.ok(secondGap > firstGap, 'second gap should be larger (backoff)');
  });
});

// ─── pTimeout ────────────────────────────────────────────────────────────────

describe('pTimeout', () => {
  it('resolves when promise completes within timeout', async () => {
    const result = await pTimeout(delay(10).then(() => 'done'), 200);
    assert.equal(result, 'done');
  });

  it('throws when promise takes longer than timeout', async () => {
    await assert.rejects(
      () => pTimeout(delay(200), 30),
      /timed out/,
    );
  });

  it('resolves immediately for already-resolved promise', async () => {
    const result = await pTimeout(Promise.resolve('instant'), 100);
    assert.equal(result, 'instant');
  });

  it('does not throw when promise resolves just before timeout', async () => {
    const result = await pTimeout(delay(20).then(() => 'ok'), 200);
    assert.equal(result, 'ok');
  });
});

// ─── pDebounce ───────────────────────────────────────────────────────────────

describe('pDebounce', () => {
  it('calls the underlying function only once for rapid calls', async () => {
    let callCount = 0;
    const fn = pDebounce(async (x) => {
      callCount++;
      return x;
    }, 30);

    const p1 = fn(1);
    const p2 = fn(2);
    const p3 = fn(3);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    // All promises should resolve with the last call's result
    assert.equal(r1, 3);
    assert.equal(r2, 3);
    assert.equal(r3, 3);
    // Underlying function called only once
    assert.equal(callCount, 1);
  });

  it('calls again after debounce window passes', async () => {
    let callCount = 0;
    const fn = pDebounce(async (x) => {
      callCount++;
      return x * 10;
    }, 20);

    const r1 = await fn(5);
    await delay(50); // wait for debounce to clear
    const r2 = await fn(7);

    assert.equal(r1, 50);
    assert.equal(r2, 70);
    assert.equal(callCount, 2);
  });

  it('propagates errors to all waiting callers', async () => {
    const fn = pDebounce(async () => {
      throw new Error('debounce error');
    }, 20);

    const p1 = fn();
    const p2 = fn();

    await assert.rejects(() => p1, /debounce error/);
    await assert.rejects(() => p2, /debounce error/);
  });
});
