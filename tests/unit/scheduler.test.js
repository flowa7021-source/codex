// ─── Unit Tests: Scheduler ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Scheduler } from '../../app/modules/scheduler.js';

// ─── schedule (one-shot) ─────────────────────────────────────────────────────

describe('Scheduler – schedule (one-shot)', () => {
  it('returns a string task id', () => {
    const s = new Scheduler();
    const id = s.schedule(() => {});
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('tick() runs the task', async () => {
    const s = new Scheduler();
    let ran = false;
    s.schedule(() => { ran = true; });
    await s.tick(Date.now() + 1);
    assert.equal(ran, true);
  });

  it('removes the task from pending after it runs', async () => {
    const s = new Scheduler();
    s.schedule(() => {});
    assert.equal(s.pendingCount, 1);
    await s.tick(Date.now() + 1);
    assert.equal(s.pendingCount, 0);
  });

  it('task only runs once', async () => {
    const s = new Scheduler();
    let count = 0;
    s.schedule(() => { count++; });
    const now = Date.now() + 1;
    await s.tick(now);
    await s.tick(now + 100);
    assert.equal(count, 1);
  });
});

describe('Scheduler – schedule with delay', () => {
  it('does not run task when tick is before nextRun', async () => {
    const s = new Scheduler();
    let ran = false;
    const now = Date.now();
    s.schedule(() => { ran = true; }, { delay: 1000 });
    await s.tick(now + 500); // before delay expires
    assert.equal(ran, false);
  });

  it('runs task when tick reaches nextRun', async () => {
    const s = new Scheduler();
    let ran = false;
    const now = Date.now();
    s.schedule(() => { ran = true; }, { delay: 500 });
    await s.tick(now + 500); // exactly at nextRun
    assert.equal(ran, true);
  });

  it('runs task when tick is past nextRun', async () => {
    const s = new Scheduler();
    let ran = false;
    const now = Date.now();
    s.schedule(() => { ran = true; }, { delay: 100 });
    await s.tick(now + 200); // well past delay
    assert.equal(ran, true);
  });
});

// ─── repeat ──────────────────────────────────────────────────────────────────

describe('Scheduler – repeat', () => {
  it('runs the task on each tick interval', async () => {
    const s = new Scheduler();
    let count = 0;
    const now = Date.now();
    s.repeat(() => { count++; }, 100);

    await s.tick(now + 100);    // first run
    assert.equal(count, 1);

    await s.tick(now + 200);    // second run
    assert.equal(count, 2);

    await s.tick(now + 300);    // third run
    assert.equal(count, 3);
  });

  it('keeps the task in pending after running', async () => {
    const s = new Scheduler();
    s.repeat(() => {}, 100);
    assert.equal(s.pendingCount, 1);
    await s.tick(Date.now() + 200);
    assert.equal(s.pendingCount, 1, 'repeat task should remain pending');
  });

  it('repeat with initial delay does not fire before delay expires', async () => {
    const s = new Scheduler();
    let count = 0;
    const now = Date.now();
    s.repeat(() => { count++; }, 100, { delay: 200 });

    await s.tick(now + 100); // before initial delay
    assert.equal(count, 0);

    await s.tick(now + 200); // exactly at initial delay
    assert.equal(count, 1);
  });
});

// ─── cancel ──────────────────────────────────────────────────────────────────

describe('Scheduler – cancel()', () => {
  it('returns true when task is found and cancelled', () => {
    const s = new Scheduler();
    const id = s.schedule(() => {});
    assert.equal(s.cancel(id), true);
  });

  it('returns false when task id is unknown', () => {
    const s = new Scheduler();
    assert.equal(s.cancel('nonexistent'), false);
  });

  it('cancelled task is not run by tick()', async () => {
    const s = new Scheduler();
    let ran = false;
    const id = s.schedule(() => { ran = true; });
    s.cancel(id);
    await s.tick(Date.now() + 1);
    assert.equal(ran, false);
  });

  it('cancelling a repeat task removes it from pending', () => {
    const s = new Scheduler();
    const id = s.repeat(() => {}, 50);
    assert.equal(s.pendingCount, 1);
    s.cancel(id);
    assert.equal(s.pendingCount, 0);
  });
});

// ─── cancelAll ────────────────────────────────────────────────────────────────

describe('Scheduler – cancelAll()', () => {
  it('removes all pending tasks', () => {
    const s = new Scheduler();
    s.schedule(() => {});
    s.schedule(() => {});
    s.repeat(() => {}, 100);
    assert.equal(s.pendingCount, 3);
    s.cancelAll();
    assert.equal(s.pendingCount, 0);
  });

  it('cancelled tasks are not run by tick()', async () => {
    const s = new Scheduler();
    let count = 0;
    s.schedule(() => { count++; });
    s.schedule(() => { count++; });
    s.cancelAll();
    await s.tick(Date.now() + 100);
    assert.equal(count, 0);
  });
});

// ─── pendingCount ────────────────────────────────────────────────────────────

describe('Scheduler – pendingCount', () => {
  it('starts at 0', () => {
    const s = new Scheduler();
    assert.equal(s.pendingCount, 0);
  });

  it('increments when tasks are added', () => {
    const s = new Scheduler();
    s.schedule(() => {});
    assert.equal(s.pendingCount, 1);
    s.schedule(() => {});
    assert.equal(s.pendingCount, 2);
  });

  it('decrements after one-shot tasks run', async () => {
    const s = new Scheduler();
    s.schedule(() => {});
    s.schedule(() => {});
    await s.tick(Date.now() + 1);
    assert.equal(s.pendingCount, 0);
  });
});

// ─── priority ────────────────────────────────────────────────────────────────

describe('Scheduler – priority ordering', () => {
  it('higher-priority tasks run before lower-priority tasks in the same tick', async () => {
    const s = new Scheduler();
    const order = [];
    const now = Date.now();

    s.schedule(() => { order.push('low'); },    { priority: 1 });
    s.schedule(() => { order.push('high'); },   { priority: 10 });
    s.schedule(() => { order.push('medium'); }, { priority: 5 });

    await s.tick(now + 1);

    assert.deepEqual(order, ['high', 'medium', 'low']);
  });

  it('tasks with equal priority run in registration order', async () => {
    const s = new Scheduler();
    const order = [];
    const now = Date.now();

    s.schedule(() => { order.push(1); }, { priority: 5 });
    s.schedule(() => { order.push(2); }, { priority: 5 });
    s.schedule(() => { order.push(3); }, { priority: 5 });

    await s.tick(now + 1);

    assert.deepEqual(order, [1, 2, 3]);
  });
});

// ─── async tasks ─────────────────────────────────────────────────────────────

describe('Scheduler – async tasks', () => {
  it('awaits async task before running the next one', async () => {
    const s = new Scheduler();
    const order = [];
    const now = Date.now();

    s.schedule(async () => {
      await Promise.resolve();
      order.push('first');
    }, { priority: 10 });

    s.schedule(() => { order.push('second'); }, { priority: 5 });

    await s.tick(now + 1);

    assert.deepEqual(order, ['first', 'second']);
  });
});
