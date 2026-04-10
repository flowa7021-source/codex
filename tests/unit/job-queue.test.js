// ─── Unit Tests: Job Queue ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { JobQueue } from '../../app/modules/job-queue.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a simple handler that resolves with the payload. */
function echoHandler(job) {
  return Promise.resolve(job.payload);
}

/** Create a handler that rejects a fixed number of times before succeeding. */
function failNTimes(n) {
  let calls = 0;
  return (job) => {
    calls++;
    if (calls <= n) return Promise.reject(new Error(`fail #${calls}`));
    return Promise.resolve(`success after ${n} failures`);
  };
}

/** Wait for a queue to drain (all pending+running = 0) by polling. */
function waitForDrain(queue, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (queue.pending === 0 && queue.running === 0) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error('Timeout waiting for queue to drain'));
      } else {
        setImmediate(check);
      }
    };
    setImmediate(check);
  });
}

// ─── Basic enqueue and process ────────────────────────────────────────────────

describe('JobQueue – basic processing', () => {
  it('processes a single job and stores result', async () => {
    const q = new JobQueue(echoHandler, { concurrency: 1 });
    q.start();
    const id = q.enqueue('hello');
    await waitForDrain(q);
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.status, 'done');
    assert.equal(job.result, 'hello');
    assert.equal(job.attempts, 1);
  });

  it('processes multiple jobs', async () => {
    const results = [];
    const q = new JobQueue(async (job) => {
      results.push(job.payload);
    }, { concurrency: 1 });
    q.start();
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    await waitForDrain(q);
    assert.equal(results.length, 3);
    assert.deepEqual(results.sort(), ['a', 'b', 'c']);
  });

  it('increments completed counter', async () => {
    const q = new JobQueue(echoHandler, { concurrency: 2 });
    q.start();
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    await waitForDrain(q);
    assert.equal(q.completed, 3);
    assert.equal(q.failed, 0);
  });

  it('does not process jobs before start()', async () => {
    let processed = false;
    const q = new JobQueue(async () => { processed = true; }, { concurrency: 1 });
    q.enqueue('x');
    // Give microtask queue a chance to run
    await new Promise(r => setImmediate(r));
    assert.equal(processed, false);
    q.start();
    await waitForDrain(q);
    assert.equal(processed, true);
  });
});

// ─── Priority ordering ────────────────────────────────────────────────────────

describe('JobQueue – priority ordering', () => {
  it('processes higher-priority jobs first', async () => {
    const order = [];
    // Concurrency = 1 to guarantee serial execution
    const q = new JobQueue(async (job) => {
      order.push(job.payload);
    }, { concurrency: 1 });

    // Enqueue before start so all end up in pending
    q.enqueue('low',    { priority: 1 });
    q.enqueue('high',   { priority: 10 });
    q.enqueue('medium', { priority: 5 });
    q.start();
    await waitForDrain(q);

    assert.deepEqual(order, ['high', 'medium', 'low']);
  });

  it('uses defaultPriority when none specified', async () => {
    const order = [];
    const q = new JobQueue(async (job) => {
      order.push(job.payload);
    }, { concurrency: 1, defaultPriority: 0 });

    q.enqueue('default1');
    q.enqueue('explicit', { priority: 5 });
    q.enqueue('default2');
    q.start();
    await waitForDrain(q);

    assert.equal(order[0], 'explicit');
  });
});

// ─── Retry on failure ─────────────────────────────────────────────────────────

describe('JobQueue – retry logic', () => {
  it('retries a failing job up to maxRetries', async () => {
    const handler = failNTimes(2);
    const q = new JobQueue(handler, { concurrency: 1 });
    q.start();
    const id = q.enqueue('task', { maxRetries: 2, retryDelay: 0 });
    await waitForDrain(q);
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.status, 'done');
    assert.equal(job.attempts, 3); // 2 failures + 1 success
  });

  it('marks job as failed when retries exhausted', async () => {
    const handler = failNTimes(99); // always fails within test scope
    const q = new JobQueue(handler, { concurrency: 1 });
    q.start();
    const id = q.enqueue('task', { maxRetries: 2, retryDelay: 0 });
    await waitForDrain(q);
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.status, 'failed');
    assert.equal(job.attempts, 3); // 1 + 2 retries
    assert.ok(job.error instanceof Error);
    assert.equal(q.failed, 1);
  });

  it('stores the last error on failed job', async () => {
    const q = new JobQueue(async () => {
      throw new Error('boom');
    }, { concurrency: 1 });
    q.start();
    const id = q.enqueue('task', { maxRetries: 0 });
    await waitForDrain(q);
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.error?.message, 'boom');
  });

  it('uses defaultMaxRetries from options', async () => {
    const handler = failNTimes(1);
    const q = new JobQueue(handler, { concurrency: 1, defaultMaxRetries: 1, defaultRetryDelay: 0 });
    q.start();
    const id = q.enqueue('task');
    await waitForDrain(q);
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.status, 'done');
    assert.equal(job.attempts, 2);
  });

  it('retries with delay (retryDelay > 0)', async () => {
    const handler = failNTimes(1);
    const q = new JobQueue(handler, { concurrency: 1 });
    q.start();
    const id = q.enqueue('task', { maxRetries: 1, retryDelay: 20 });
    // Wait for the delayed retry to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    await waitForDrain(q);
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.status, 'done');
    assert.equal(job.attempts, 2);
  });
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

describe('JobQueue – cancel', () => {
  it('cancels a pending job by id', async () => {
    let targetRan = false;
    let releaseBlocker;
    const q = new JobQueue(
      async (job) => {
        if (job.payload === 'blocker') {
          // Block until released
          await new Promise(r => { releaseBlocker = r; });
        } else if (job.payload === 'target') {
          targetRan = true;
        }
      },
      { concurrency: 1 },
    );
    q.start();
    q.enqueue('blocker');
    // Wait for the blocker to start running
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    assert.equal(q.running, 1, 'blocker should be running');
    const targetId = q.enqueue('target');
    assert.equal(q.pending, 1, 'target should be pending');
    const cancelled = q.cancel(targetId);
    assert.equal(cancelled, true);
    assert.equal(q.pending, 0);
    // Unblock the first job
    releaseBlocker();
    await waitForDrain(q);
    assert.equal(targetRan, false, 'target should never have run');
  });

  it('returns false when cancelling a non-existent id', () => {
    const q = new JobQueue(echoHandler, { concurrency: 1 });
    q.start();
    assert.equal(q.cancel('ghost-id'), false);
  });

  it('returns false when cancelling an already-running job', async () => {
    let release;
    const q = new JobQueue(
      async () => new Promise(r => { release = r; }),
      { concurrency: 1 },
    );
    q.start();
    const id = q.enqueue('task');
    await new Promise(r => setImmediate(r)); // let it start
    assert.equal(q.running, 1);
    assert.equal(q.cancel(id), false);
    release();
    await waitForDrain(q);
  });
});

// ─── Concurrency ─────────────────────────────────────────────────────────────

describe('JobQueue – concurrency', () => {
  it('never exceeds concurrency limit', async () => {
    let maxSeen = 0;
    let current = 0;
    const q = new JobQueue(async () => {
      current++;
      if (current > maxSeen) maxSeen = current;
      await new Promise(r => setImmediate(r));
      current--;
    }, { concurrency: 3 });
    q.start();
    for (let i = 0; i < 10; i++) q.enqueue(i);
    await waitForDrain(q);
    assert.ok(maxSeen <= 3, `max concurrent was ${maxSeen}, expected <= 3`);
  });

  it('runs up to concurrency jobs in parallel', async () => {
    let maxSeen = 0;
    let current = 0;
    const q = new JobQueue(async () => {
      current++;
      if (current > maxSeen) maxSeen = current;
      await new Promise(r => setImmediate(r));
      current--;
    }, { concurrency: 5 });
    q.start();
    for (let i = 0; i < 5; i++) q.enqueue(i);
    await waitForDrain(q);
    assert.ok(maxSeen >= 2, `expected at least 2 concurrent jobs, got ${maxSeen}`);
  });

  it('pending count reflects unstarted jobs', async () => {
    let releaseFirst;
    const q = new JobQueue(
      async (job) => {
        if (job.payload === 'a') {
          await new Promise(r => { releaseFirst = r; });
        }
      },
      { concurrency: 1 },
    );
    q.start();
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    // Wait for 'a' to start running
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    assert.equal(q.running, 1);
    assert.equal(q.pending, 2);
    releaseFirst();
    await waitForDrain(q);
  });
});

// ─── stop() ───────────────────────────────────────────────────────────────────

describe('JobQueue – stop', () => {
  it('resolves stop() when queue drains', async () => {
    const q = new JobQueue(echoHandler, { concurrency: 2 });
    q.start();
    q.enqueue(1);
    q.enqueue(2);
    await q.stop();
    assert.equal(q.running, 0);
    assert.equal(q.pending, 0);
  });

  it('resolves stop() immediately if already empty', async () => {
    const q = new JobQueue(echoHandler, { concurrency: 1 });
    q.start();
    await q.stop(); // nothing enqueued
  });

  it('throws when enqueueing after stop()', async () => {
    const q = new JobQueue(echoHandler, { concurrency: 1 });
    q.start();
    q.stop(); // don't await
    assert.throws(() => q.enqueue('late'), /stopping/);
  });
});

// ─── get() ────────────────────────────────────────────────────────────────────

describe('JobQueue – get', () => {
  it('returns undefined for unknown id', () => {
    const q = new JobQueue(echoHandler, { concurrency: 1 });
    assert.equal(q.get('nope'), undefined);
  });

  it('returns the job with correct initial status', () => {
    const q = new JobQueue(echoHandler, { concurrency: 1 });
    // Do NOT start so the job stays pending
    const id = q.enqueue('test');
    const job = q.get(id);
    assert.ok(job);
    assert.equal(job.status, 'pending');
    assert.equal(job.payload, 'test');
    assert.equal(job.attempts, 0);
  });
});
