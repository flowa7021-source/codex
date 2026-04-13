// ─── Unit Tests: async-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sleep,
  timeout,
  parallel,
  series,
  race,
  retryAsync,
  createDeferred,
  poll,
  AsyncQueue,
} from '../../app/modules/async-utils.js';

// ─── sleep ───────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    const start = Date.now();
    await sleep(10);
    assert.ok(Date.now() - start >= 8, 'should wait at least ~10ms');
  });

  it('resolves with undefined', async () => {
    const result = await sleep(1);
    assert.equal(result, undefined);
  });

  it('resolves for a zero-millisecond delay', async () => {
    // Should not throw or hang
    await sleep(0);
    assert.ok(true);
  });
});

// ─── timeout ─────────────────────────────────────────────────────────────────

describe('timeout', () => {
  it('resolves with the promise value when fast enough', async () => {
    const result = await timeout(Promise.resolve(42), 100);
    assert.equal(result, 42);
  });

  it('rejects with default message when deadline exceeded', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 200));
    await assert.rejects(
      () => timeout(slow, 5),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Timeout after 5ms/);
        return true;
      },
    );
  });

  it('rejects with a custom message when supplied', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 200));
    await assert.rejects(
      () => timeout(slow, 5, 'custom timeout message'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'custom timeout message');
        return true;
      },
    );
  });

  it('propagates a rejection from the wrapped promise', async () => {
    const failing = Promise.reject(new Error('inner failure'));
    await assert.rejects(
      () => timeout(failing, 100),
      /inner failure/,
    );
  });
});

// ─── parallel ────────────────────────────────────────────────────────────────

describe('parallel', () => {
  it('resolves with all results in original order', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];
    const results = await parallel(tasks);
    assert.deepEqual(results, [1, 2, 3]);
  });

  it('returns empty array for an empty task list', async () => {
    assert.deepEqual(await parallel([]), []);
  });

  it('runs all tasks concurrently when no concurrency limit given', async () => {
    const started = [];
    const tasks = [0, 1, 2].map(i => () => {
      started.push(i);
      return Promise.resolve(i);
    });
    await parallel(tasks);
    // All tasks were started (order may vary but all must appear)
    assert.deepEqual(started.sort(), [0, 1, 2]);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 6 }, () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(5);
      concurrent--;
      return 1;
    });
    await parallel(tasks, 2);
    assert.ok(maxConcurrent <= 2, `max concurrent was ${maxConcurrent}`);
  });

  it('preserves result order with concurrency limit', async () => {
    const tasks = [3, 1, 2].map(delay => async () => {
      await sleep(delay);
      return delay;
    });
    const results = await parallel(tasks, 2);
    assert.deepEqual(results, [3, 1, 2]);
  });

  it('rejects when any task rejects', async () => {
    const tasks = [
      () => Promise.resolve('ok'),
      () => Promise.reject(new Error('boom')),
    ];
    await assert.rejects(() => parallel(tasks), /boom/);
  });
});

// ─── series ──────────────────────────────────────────────────────────────────

describe('series', () => {
  it('returns results in order', async () => {
    const results = await series([
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
      () => Promise.resolve('c'),
    ]);
    assert.deepEqual(results, ['a', 'b', 'c']);
  });

  it('executes tasks sequentially', async () => {
    const log = [];
    await series([
      async () => { log.push(1); await sleep(5); log.push(2); return 1; },
      async () => { log.push(3); return 2; },
    ]);
    assert.deepEqual(log, [1, 2, 3]);
  });

  it('returns empty array for no tasks', async () => {
    assert.deepEqual(await series([]), []);
  });

  it('rejects on the first failing task', async () => {
    const log = [];
    await assert.rejects(
      () => series([
        () => Promise.reject(new Error('first')),
        () => { log.push('second'); return Promise.resolve(1); },
      ]),
      /first/,
    );
    assert.deepEqual(log, [], 'second task must not run');
  });
});

// ─── race ────────────────────────────────────────────────────────────────────

describe('race', () => {
  it('resolves with the value of the fastest task', async () => {
    const result = await race([
      async () => { await sleep(20); return 'slow'; },
      async () => { await sleep(1); return 'fast'; },
    ]);
    assert.equal(result, 'fast');
  });

  it('rejects if the fastest task rejects', async () => {
    await assert.rejects(
      () => race([
        async () => { await sleep(1); throw new Error('first failure'); },
        async () => { await sleep(50); return 'never'; },
      ]),
      /first failure/,
    );
  });

  it('resolves immediately when a task is already resolved', async () => {
    const result = await race([
      () => Promise.resolve('instant'),
      async () => { await sleep(50); return 'late'; },
    ]);
    assert.equal(result, 'instant');
  });
});

// ─── retryAsync ──────────────────────────────────────────────────────────────

describe('retryAsync', () => {
  it('returns immediately on first success', async () => {
    let calls = 0;
    const result = await retryAsync(async () => { calls++; return 'ok'; }, 3);
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('retries and succeeds on the second attempt', async () => {
    let calls = 0;
    const result = await retryAsync(async () => {
      calls++;
      if (calls < 2) throw new Error('not yet');
      return 'done';
    }, 3);
    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });

  it('rejects after exhausting all attempts', async () => {
    let calls = 0;
    await assert.rejects(
      () => retryAsync(async () => { calls++; throw new Error(`fail #${calls}`); }, 3),
      /fail #3/,
    );
    assert.equal(calls, 3);
  });

  it('calls onError with err and attempt number on each failure', async () => {
    const errors = [];
    await assert.rejects(
      () => retryAsync(
        async () => { throw new Error('oops'); },
        3,
        { onError: (err, attempt) => errors.push({ msg: err.message, attempt }) },
      ),
    );
    assert.deepEqual(errors, [
      { msg: 'oops', attempt: 1 },
      { msg: 'oops', attempt: 2 },
      { msg: 'oops', attempt: 3 },
    ]);
  });

  it('respects delayMs between retries', async () => {
    const start = Date.now();
    let calls = 0;
    await retryAsync(async () => {
      calls++;
      if (calls < 3) throw new Error('retry');
      return 'final';
    }, 3, { delayMs: 5, backoff: 'linear' });
    // 2 retries × 5ms ≥ 8ms elapsed
    assert.ok(Date.now() - start >= 8);
  });

  it('doubles delay with exponential backoff', async () => {
    const delays = [];
    let last = Date.now();
    let calls = 0;
    await retryAsync(
      async () => { calls++; if (calls < 3) throw new Error('x'); return 'y'; },
      3,
      {
        delayMs: 5,
        backoff: 'exponential',
        onError: () => { delays.push(Date.now() - last); last = Date.now(); },
      },
    );
    // Second delay should be notably larger than first
    assert.ok(delays[1] >= delays[0], 'second delay should be >= first delay');
  });
});

// ─── createDeferred ──────────────────────────────────────────────────────────

describe('createDeferred', () => {
  it('resolves via the external resolve callback', async () => {
    const d = createDeferred();
    setTimeout(() => d.resolve('hello'), 5);
    assert.equal(await d.promise, 'hello');
  });

  it('rejects via the external reject callback', async () => {
    const d = createDeferred();
    setTimeout(() => d.reject(new Error('external reject')), 5);
    await assert.rejects(() => d.promise, /external reject/);
  });

  it('promise is still pending before resolve/reject', async () => {
    const d = createDeferred();
    let settled = false;
    d.promise.then(() => { settled = true; }).catch(() => { settled = true; });
    await sleep(5);
    assert.equal(settled, false);
    d.resolve(undefined);
    await d.promise;
    assert.equal(settled, true);
  });

  it('supports typed values', async () => {
    const d = createDeferred();
    d.resolve(99);
    assert.equal(await d.promise, 99);
  });
});

// ─── poll ────────────────────────────────────────────────────────────────────

describe('poll', () => {
  it('resolves as soon as fn returns a non-null value', async () => {
    let calls = 0;
    const result = await poll(
      async () => { calls++; return calls >= 3 ? 'found' : null; },
      { intervalMs: 2, timeoutMs: 200 },
    );
    assert.equal(result, 'found');
    assert.ok(calls >= 3);
  });

  it('rejects with a timeout error when condition is never met', async () => {
    await assert.rejects(
      () => poll(async () => null, { intervalMs: 2, timeoutMs: 20 }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /timed out/i);
        return true;
      },
    );
  });

  it('uses the custom condition predicate', async () => {
    let counter = 0;
    const result = await poll(
      async () => { counter++; return counter; },
      { intervalMs: 1, timeoutMs: 200, condition: v => v >= 5 },
    );
    assert.ok(result >= 5);
  });

  it('keeps polling when condition returns false even for non-null value', async () => {
    let n = 0;
    const result = await poll(
      async () => { n++; return n; },
      { intervalMs: 1, timeoutMs: 200, condition: v => v === 3 },
    );
    assert.equal(result, 3);
  });
});

// ─── AsyncQueue ──────────────────────────────────────────────────────────────

describe('AsyncQueue', () => {
  it('runs a single task and returns its result', async () => {
    const q = new AsyncQueue(1);
    const result = await q.enqueue(() => Promise.resolve('done'));
    assert.equal(result, 'done');
  });

  it('queues multiple tasks and resolves each independently', async () => {
    const q = new AsyncQueue(1);
    const [a, b, c] = await Promise.all([
      q.enqueue(() => Promise.resolve(1)),
      q.enqueue(() => Promise.resolve(2)),
      q.enqueue(() => Promise.resolve(3)),
    ]);
    assert.equal(a, 1);
    assert.equal(b, 2);
    assert.equal(c, 3);
  });

  it('respects concurrency=1 (serial execution)', async () => {
    const q = new AsyncQueue(1);
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 4 }, () => () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      return sleep(3).then(() => { concurrent--; });
    });
    await Promise.all(tasks.map(t => q.enqueue(t)));
    assert.equal(maxConcurrent, 1);
  });

  it('allows higher concurrency when specified', async () => {
    const q = new AsyncQueue(3);
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 6 }, () => () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      return sleep(5).then(() => { concurrent--; });
    });
    await Promise.all(tasks.map(t => q.enqueue(t)));
    assert.ok(maxConcurrent > 1, `expected concurrency > 1, got ${maxConcurrent}`);
    assert.ok(maxConcurrent <= 3, `expected concurrency <= 3, got ${maxConcurrent}`);
  });

  it('pending count decrements as tasks start', async () => {
    const q = new AsyncQueue(1);
    // Enqueue a slow task that holds the slot
    const d = createDeferred();
    q.enqueue(() => d.promise);
    // Enqueue a second task — it should be pending
    q.enqueue(() => Promise.resolve('second'));
    assert.equal(q.pending, 1);
    assert.equal(q.running, 1);
    d.resolve('first');
    await sleep(5);
    assert.equal(q.pending, 0);
  });

  it('drain() resolves immediately when queue is empty', async () => {
    const q = new AsyncQueue(2);
    await q.drain(); // should not hang
    assert.ok(true);
  });

  it('drain() waits until all tasks finish', async () => {
    const q = new AsyncQueue(2);
    let done = false;
    q.enqueue(async () => { await sleep(10); done = true; });
    q.enqueue(async () => { await sleep(10); });
    await q.drain();
    assert.equal(done, true);
  });

  it('propagates task rejection to the enqueue caller', async () => {
    const q = new AsyncQueue(1);
    await assert.rejects(
      () => q.enqueue(() => Promise.reject(new Error('task failed'))),
      /task failed/,
    );
  });

  it('continues processing after a rejected task', async () => {
    const q = new AsyncQueue(1);
    // Ignore the rejection from the first task
    q.enqueue(() => Promise.reject(new Error('ignored'))).catch(() => {});
    const result = await q.enqueue(() => Promise.resolve('still works'));
    assert.equal(result, 'still works');
  });

  it('running count is 0 after all tasks finish', async () => {
    const q = new AsyncQueue(2);
    await Promise.all([
      q.enqueue(() => sleep(5)),
      q.enqueue(() => sleep(5)),
    ]);
    assert.equal(q.running, 0);
  });

  it('multiple drain() callers all resolve when queue empties', async () => {
    const q = new AsyncQueue(1);
    q.enqueue(() => sleep(10));
    const [d1, d2] = await Promise.all([q.drain(), q.drain()]);
    assert.equal(d1, undefined);
    assert.equal(d2, undefined);
  });
});
