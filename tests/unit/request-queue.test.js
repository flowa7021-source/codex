// ─── Unit Tests: RequestQueue ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RequestQueue } from '../../app/modules/request-queue.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a promise that resolves after one microtask flush. */
function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve));
}

/**
 * Returns { task, resolve, reject } where `task` is an async function that
 * stays pending until you call `resolve(value)` or `reject(err)`.
 */
function makeControllableTask() {
  let _resolve, _reject;
  const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });
  const task = () => promise;
  return { task, resolve: _resolve, reject: _reject };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('RequestQueue – constructor', () => {
  it('defaults concurrency to 4', () => {
    const q = new RequestQueue();
    assert.equal(q.concurrency, 4);
  });

  it('accepts a custom concurrency', () => {
    const q = new RequestQueue(2);
    assert.equal(q.concurrency, 2);
  });

  it('starts with pendingCount 0', () => {
    const q = new RequestQueue(2);
    assert.equal(q.pendingCount, 0);
  });

  it('starts with runningCount 0', () => {
    const q = new RequestQueue(2);
    assert.equal(q.runningCount, 0);
  });

  it('throws RangeError for concurrency < 1', () => {
    assert.throws(() => new RequestQueue(0), RangeError);
    assert.throws(() => new RequestQueue(-1), RangeError);
  });
});

// ─── add / basic resolution ──────────────────────────────────────────────────

describe('RequestQueue – add() resolves with task result', () => {
  it('resolves with the value returned by the task', async () => {
    const q = new RequestQueue(2);
    const result = await q.add(() => Promise.resolve(42));
    assert.equal(result, 42);
  });

  it('rejects when the task rejects', async () => {
    const q = new RequestQueue(2);
    const err = new Error('task failed');
    await assert.rejects(() => q.add(() => Promise.reject(err)), err);
  });

  it('runs tasks immediately when below concurrency limit', async () => {
    const q = new RequestQueue(4);
    const results = await Promise.all([
      q.add(() => Promise.resolve(1)),
      q.add(() => Promise.resolve(2)),
      q.add(() => Promise.resolve(3)),
    ]);
    assert.deepEqual(results, [1, 2, 3]);
  });
});

// ─── concurrency limiting ─────────────────────────────────────────────────────

describe('RequestQueue – concurrency is respected', () => {
  it('runs at most N tasks at once', async () => {
    const q = new RequestQueue(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 5 }, () => {
      return q.add(async () => {
        concurrent++;
        if (concurrent > maxConcurrent) maxConcurrent = concurrent;
        await flushMicrotasks();
        concurrent--;
      });
    });

    await Promise.all(tasks);
    assert.ok(maxConcurrent <= 2, `max concurrent was ${maxConcurrent}, expected <= 2`);
  });

  it('runningCount never exceeds concurrency', async () => {
    const q = new RequestQueue(2);
    const maxSeen = { count: 0 };

    const controllable = Array.from({ length: 4 }, () => makeControllableTask());
    const promises = controllable.map(({ task }) => q.add(task));

    // After adding, first 2 should be running
    await flushMicrotasks();
    maxSeen.count = Math.max(maxSeen.count, q.runningCount);
    assert.ok(q.runningCount <= 2);

    // Resolve first two — triggers next two
    controllable[0].resolve(1);
    controllable[1].resolve(2);
    await flushMicrotasks();
    await flushMicrotasks();

    controllable[2].resolve(3);
    controllable[3].resolve(4);
    await Promise.all(promises);

    assert.equal(q.runningCount, 0);
    assert.equal(q.pendingCount, 0);
  });

  it('queues tasks beyond concurrency limit as pending', async () => {
    const q = new RequestQueue(1);
    const c1 = makeControllableTask();
    const c2 = makeControllableTask();
    const c3 = makeControllableTask();

    q.add(c1.task);
    q.add(c2.task);
    q.add(c3.task);

    await flushMicrotasks();

    assert.equal(q.runningCount, 1);
    assert.equal(q.pendingCount, 2);

    c1.resolve('a');
    await flushMicrotasks();
    await flushMicrotasks();

    assert.equal(q.runningCount, 1);
    assert.equal(q.pendingCount, 1);

    c2.resolve('b');
    c3.resolve('c');
    await flushMicrotasks();
    await flushMicrotasks();
  });
});

// ─── clearPending ─────────────────────────────────────────────────────────────

describe('RequestQueue – clearPending()', () => {
  it('removes tasks from the pending queue', async () => {
    const q = new RequestQueue(1);
    // Block the first slot
    const blocker = makeControllableTask();
    q.add(blocker.task);
    await flushMicrotasks();

    // These go into pending — attach catch handlers to silence the AbortError rejections
    const p1 = q.add(() => Promise.resolve('never'));
    const p2 = q.add(() => Promise.resolve('never2'));
    p1.catch(() => {});
    p2.catch(() => {});
    assert.equal(q.pendingCount, 2);

    q.clearPending();
    assert.equal(q.pendingCount, 0);

    blocker.resolve(null);
    await flushMicrotasks();
  });

  it('rejected promises from cleared tasks carry AbortError name', async () => {
    const q = new RequestQueue(1);
    const blocker = makeControllableTask();
    q.add(blocker.task);
    await flushMicrotasks();

    const p = q.add(() => Promise.resolve('cleared'));
    q.clearPending();

    const err = await p.then(() => null, e => e);
    assert.ok(err instanceof DOMException || err instanceof Error);
    assert.equal(err.name, 'AbortError');

    blocker.resolve(null);
  });

  it('does nothing when pending is already empty', () => {
    const q = new RequestQueue(4);
    assert.doesNotThrow(() => q.clearPending());
  });
});

// ─── pause / resume ───────────────────────────────────────────────────────────

describe('RequestQueue – pause() / resume()', () => {
  it('isPaused is false by default', () => {
    const q = new RequestQueue();
    assert.equal(q.isPaused, false);
  });

  it('isPaused reflects pause/resume state', () => {
    const q = new RequestQueue();
    q.pause();
    assert.equal(q.isPaused, true);
    q.resume();
    assert.equal(q.isPaused, false);
  });

  it('paused queue does not start new tasks', async () => {
    const q = new RequestQueue(2);
    q.pause();

    let started = false;
    q.add(() => { started = true; return Promise.resolve(); });
    await flushMicrotasks();

    assert.equal(started, false);
    assert.equal(q.pendingCount, 1);
    assert.equal(q.runningCount, 0);

    q.resume();
    await flushMicrotasks();
    assert.equal(started, true);
  });

  it('resume() drains accumulated pending tasks up to concurrency', async () => {
    const q = new RequestQueue(2);
    q.pause();

    const results = [];
    const p1 = q.add(async () => { results.push(1); return 1; });
    const p2 = q.add(async () => { results.push(2); return 2; });
    const p3 = q.add(async () => { results.push(3); return 3; });

    assert.equal(q.pendingCount, 3);

    q.resume();
    await Promise.all([p1, p2, p3]);
    assert.deepEqual(results.sort(), [1, 2, 3]);
  });
});

// ─── drain ────────────────────────────────────────────────────────────────────

describe('RequestQueue – drain()', () => {
  it('resolves immediately when queue is empty', async () => {
    const q = new RequestQueue(4);
    await assert.doesNotReject(() => q.drain());
  });

  it('resolves after all tasks complete', async () => {
    const q = new RequestQueue(2);
    const order = [];

    q.add(async () => { order.push('a'); });
    q.add(async () => { order.push('b'); });
    q.add(async () => { order.push('c'); });

    await q.drain();
    assert.equal(order.length, 3);
    assert.ok(order.includes('a'));
    assert.ok(order.includes('b'));
    assert.ok(order.includes('c'));
  });

  it('multiple concurrent drain() calls all resolve', async () => {
    const q = new RequestQueue(1);
    const c = makeControllableTask();
    q.add(c.task);

    await flushMicrotasks();

    const d1 = q.drain();
    const d2 = q.drain();

    c.resolve('done');
    await assert.doesNotReject(() => Promise.all([d1, d2]));
  });

  it('resolves even when tasks reject', async () => {
    const q = new RequestQueue(2);
    q.add(() => Promise.reject(new Error('oops'))).catch(() => {});
    q.add(() => Promise.resolve('ok'));

    await assert.doesNotReject(() => q.drain());
  });
});

// ─── priority ordering ────────────────────────────────────────────────────────

describe('RequestQueue – priority ordering', () => {
  it('higher priority tasks run before lower priority tasks', async () => {
    const q = new RequestQueue(1);
    // Fill the running slot so subsequent tasks queue
    const blocker = makeControllableTask();
    q.add(blocker.task);
    await flushMicrotasks(); // blocker is now running

    const order = [];
    q.add(async () => { order.push('low'); }, 0);
    q.add(async () => { order.push('high'); }, 10);
    q.add(async () => { order.push('medium'); }, 5);

    // Unblock runner
    blocker.resolve(null);
    await q.drain();

    assert.deepEqual(order, ['high', 'medium', 'low']);
  });

  it('equal priority tasks run in FIFO order', async () => {
    const q = new RequestQueue(1);
    const blocker = makeControllableTask();
    q.add(blocker.task);
    await flushMicrotasks();

    const order = [];
    q.add(async () => { order.push(1); }, 5);
    q.add(async () => { order.push(2); }, 5);
    q.add(async () => { order.push(3); }, 5);

    blocker.resolve(null);
    await q.drain();

    assert.deepEqual(order, [1, 2, 3]);
  });

  it('default priority is 0', async () => {
    const q = new RequestQueue(1);
    const blocker = makeControllableTask();
    q.add(blocker.task);
    await flushMicrotasks();

    const order = [];
    q.add(async () => { order.push('default'); });       // priority 0
    q.add(async () => { order.push('higher'); }, 1);     // priority 1 → runs first

    blocker.resolve(null);
    await q.drain();

    assert.deepEqual(order, ['higher', 'default']);
  });
});
