// ─── Unit Tests: TaskQueue ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TaskQueue } from '../../app/modules/task-queue.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a task fn that resolves with `value` after `delay` ms. */
function delayed(value, delay = 0) {
  return () => new Promise(resolve => setTimeout(() => resolve(value), delay));
}

/** Returns a task fn that rejects with `message` after `delay` ms. */
function failing(message, delay = 0) {
  return () => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), delay));
}

// ─── add + drain ──────────────────────────────────────────────────────────────

describe('TaskQueue – add + drain', () => {
  it('runs a task and resolves drain when complete', async () => {
    const q = new TaskQueue();
    let ran = false;
    q.add(async () => { ran = true; });
    await q.drain();
    assert.equal(ran, true);
  });

  it('drain resolves immediately when queue is empty', async () => {
    const q = new TaskQueue();
    await q.drain(); // should not hang
  });

  it('task result is stored on the task object', async () => {
    const q = new TaskQueue();
    const id = q.add(() => Promise.resolve(42));
    await q.drain();
    const task = q.get(id);
    assert.equal(task.status, 'completed');
    assert.equal(task.result, 42);
  });

  it('failed task stores error and status', async () => {
    const q = new TaskQueue();
    const id = q.add(failing('boom'));
    await q.drain();
    const task = q.get(id);
    assert.equal(task.status, 'failed');
    assert.ok(task.error instanceof Error);
    assert.equal(task.error.message, 'boom');
  });

  it('task timestamps are set correctly', async () => {
    const q = new TaskQueue();
    const before = Date.now();
    const id = q.add(() => Promise.resolve());
    await q.drain();
    const after = Date.now();
    const task = q.get(id);
    assert.ok(task.createdAt >= before && task.createdAt <= after);
    assert.ok(task.startedAt >= before && task.startedAt <= after);
    assert.ok(task.completedAt >= task.startedAt);
  });
});

// ─── priority ordering ────────────────────────────────────────────────────────

describe('TaskQueue – priority ordering', () => {
  it('higher-priority task runs before lower-priority task', async () => {
    // concurrency 1: tasks start only after queue processes them
    const q = new TaskQueue({ concurrency: 1 });
    const order = [];

    // Add a blocker task first to keep the queue occupied while we enqueue others
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);

    q.add(async () => { order.push('low'); }, { priority: 1 });
    q.add(async () => { order.push('high'); }, { priority: 10 });
    q.add(async () => { order.push('mid'); }, { priority: 5 });

    unblock();
    await q.drain();

    assert.deepEqual(order, ['high', 'mid', 'low']);
  });

  it('equal-priority tasks run in FIFO order', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const order = [];

    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);

    q.add(async () => { order.push(1); }, { priority: 5 });
    q.add(async () => { order.push(2); }, { priority: 5 });
    q.add(async () => { order.push(3); }, { priority: 5 });

    unblock();
    await q.drain();

    assert.deepEqual(order, [1, 2, 3]);
  });
});

// ─── concurrency ──────────────────────────────────────────────────────────────

describe('TaskQueue – concurrency', () => {
  it('runs up to N tasks in parallel', async () => {
    const q = new TaskQueue({ concurrency: 3 });
    let maxConcurrent = 0;
    let current = 0;

    const tasks = Array.from({ length: 6 }, () =>
      q.add(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 10));
        current--;
      }),
    );

    await q.drain();
    assert.ok(maxConcurrent >= 2, `expected concurrent tasks, got max=${maxConcurrent}`);
    assert.ok(maxConcurrent <= 3, `exceeded concurrency: max=${maxConcurrent}`);
  });

  it('concurrency 1 runs tasks sequentially', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let maxConcurrent = 0;
    let current = 0;

    for (let i = 0; i < 4; i++) {
      q.add(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise(r => setTimeout(r, 5));
        current--;
      });
    }

    await q.drain();
    assert.equal(maxConcurrent, 1);
  });
});

// ─── cancel ───────────────────────────────────────────────────────────────────

describe('TaskQueue – cancel', () => {
  it('cancel returns true and marks task as cancelled', async () => {
    const q = new TaskQueue({ concurrency: 1 });

    // Hold the queue with a blocker
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);

    const id = q.add(async () => 'should not run');
    const result = q.cancel(id);

    assert.equal(result, true);
    assert.equal(q.get(id).status, 'cancelled');

    unblock();
    await q.drain();

    // Cancelled task should not have run
    assert.equal(q.get(id).result, undefined);
  });

  it('cancel returns false for a running task', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    const id = q.add(() => blocker);

    // Give the event loop a tick to start the task
    await Promise.resolve();

    assert.equal(q.get(id).status, 'running');
    assert.equal(q.cancel(id), false);

    unblock();
    await q.drain();
  });

  it('cancel returns false for completed task', async () => {
    const q = new TaskQueue();
    const id = q.add(() => Promise.resolve());
    await q.drain();
    assert.equal(q.cancel(id), false);
  });

  it('cancel returns false for unknown id', () => {
    const q = new TaskQueue();
    assert.equal(q.cancel('nonexistent'), false);
  });
});

// ─── get / getAll / pendingCount / runningCount ───────────────────────────────

describe('TaskQueue – get / getAll / pendingCount / runningCount', () => {
  it('get returns undefined for unknown id', () => {
    const q = new TaskQueue();
    assert.equal(q.get('nope'), undefined);
  });

  it('getAll returns all tasks', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const ids = [q.add(() => Promise.resolve(1)), q.add(() => Promise.resolve(2))];
    await q.drain();
    const all = q.getAll();
    assert.equal(all.length, 2);
    assert.deepEqual(all.map(t => t.id).sort(), ids.sort());
  });

  it('pendingCount reflects queued tasks', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);
    q.add(() => Promise.resolve());
    q.add(() => Promise.resolve());

    await Promise.resolve(); // let blocker start running
    assert.equal(q.pendingCount, 2);

    unblock();
    await q.drain();
    assert.equal(q.pendingCount, 0);
  });

  it('runningCount reflects active tasks', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);
    q.add(() => blocker);

    await Promise.resolve();
    assert.equal(q.runningCount, 2);

    unblock();
    await q.drain();
    assert.equal(q.runningCount, 0);
  });
});

// ─── cleanup ──────────────────────────────────────────────────────────────────

describe('TaskQueue – cleanup', () => {
  it('removes completed and failed tasks', async () => {
    const q = new TaskQueue();
    q.add(() => Promise.resolve('ok'));
    q.add(failing('err'));
    await q.drain();

    assert.equal(q.getAll().length, 2);
    q.cleanup();
    assert.equal(q.getAll().length, 0);
  });

  it('does not remove pending or running tasks', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);     // running
    q.add(() => Promise.resolve()); // pending

    await Promise.resolve();
    q.cleanup();
    assert.equal(q.getAll().length, 2);

    unblock();
    await q.drain();
  });

  it('removes cancelled tasks', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    q.add(() => blocker);
    const id = q.add(() => Promise.resolve());
    q.cancel(id);
    unblock();
    await q.drain();
    q.cleanup();
    assert.equal(q.getAll().length, 0);
  });
});

// ─── pause / resume ───────────────────────────────────────────────────────────

describe('TaskQueue – pause / resume', () => {
  it('pause stops new tasks from starting', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    q.pause();

    let ran = false;
    q.add(async () => { ran = true; });

    // Give the event loop a few ticks
    await new Promise(r => setTimeout(r, 10));
    assert.equal(ran, false);

    q.resume();
    await q.drain();
    assert.equal(ran, true);
  });

  it('resume processes all pending tasks', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    q.pause();

    const results = [];
    q.add(async () => results.push(1));
    q.add(async () => results.push(2));
    q.add(async () => results.push(3));

    q.resume();
    await q.drain();
    assert.equal(results.length, 3);
  });

  it('running tasks are not interrupted by pause', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    let unblock;
    const blocker = new Promise(resolve => { unblock = resolve; });
    let completed = false;
    q.add(async () => { await blocker; completed = true; });

    await Promise.resolve(); // let task start
    q.pause();
    unblock();

    await q.drain();
    assert.equal(completed, true);
  });
});
