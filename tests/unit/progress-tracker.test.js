// ─── Unit Tests: ProgressTracker ─────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ProgressTracker } from '../../app/modules/progress-tracker.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a tracker with one or more pre-added tasks. */
function makeTracker(...ids) {
  const tracker = new ProgressTracker();
  for (const id of ids) {
    tracker.add(id, `Task ${id}`);
  }
  return tracker;
}

// ─── add ─────────────────────────────────────────────────────────────────────

describe('ProgressTracker – add', () => {
  it('task created with pending status and zero progress', () => {
    const tracker = new ProgressTracker();
    tracker.add('t1', 'My Task');
    const { tasks } = tracker.snapshot;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 't1');
    assert.equal(tasks[0].label, 'My Task');
    assert.equal(tasks[0].progress, 0);
    assert.equal(tasks[0].status, 'pending');
  });

  it('can add multiple tasks', () => {
    const tracker = makeTracker('a', 'b', 'c');
    assert.equal(tracker.snapshot.tasks.length, 3);
  });

  it('adding task triggers subscribers', () => {
    const tracker = new ProgressTracker();
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.add('t1', 'Task');
    assert.equal(calls, 1);
  });
});

// ─── start ───────────────────────────────────────────────────────────────────

describe('ProgressTracker – start', () => {
  it('changes status to running', () => {
    const tracker = makeTracker('t1');
    tracker.start('t1');
    const task = tracker.snapshot.tasks[0];
    assert.equal(task.status, 'running');
  });

  it('does not change progress', () => {
    const tracker = makeTracker('t1');
    tracker.start('t1');
    assert.equal(tracker.snapshot.tasks[0].progress, 0);
  });

  it('is a no-op for unknown id', () => {
    const tracker = makeTracker('t1');
    assert.doesNotThrow(() => tracker.start('unknown'));
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('ProgressTracker – update', () => {
  it('updates progress value', () => {
    const tracker = makeTracker('t1');
    tracker.update('t1', 42);
    assert.equal(tracker.snapshot.tasks[0].progress, 42);
  });

  it('clamps progress to 0-100 (below 0)', () => {
    const tracker = makeTracker('t1');
    tracker.update('t1', -10);
    assert.equal(tracker.snapshot.tasks[0].progress, 0);
  });

  it('clamps progress to 0-100 (above 100)', () => {
    const tracker = makeTracker('t1');
    tracker.update('t1', 150);
    assert.equal(tracker.snapshot.tasks[0].progress, 100);
  });

  it('is a no-op for unknown id', () => {
    const tracker = makeTracker('t1');
    assert.doesNotThrow(() => tracker.update('unknown', 50));
  });
});

// ─── complete ────────────────────────────────────────────────────────────────

describe('ProgressTracker – complete', () => {
  it('sets progress to 100 and status to done', () => {
    const tracker = makeTracker('t1');
    tracker.complete('t1');
    const task = tracker.snapshot.tasks[0];
    assert.equal(task.progress, 100);
    assert.equal(task.status, 'done');
  });

  it('is a no-op for unknown id', () => {
    const tracker = makeTracker('t1');
    assert.doesNotThrow(() => tracker.complete('unknown'));
  });
});

// ─── fail ────────────────────────────────────────────────────────────────────

describe('ProgressTracker – fail', () => {
  it('sets status to error', () => {
    const tracker = makeTracker('t1');
    tracker.fail('t1');
    assert.equal(tracker.snapshot.tasks[0].status, 'error');
  });

  it('stores the error message', () => {
    const tracker = makeTracker('t1');
    tracker.fail('t1', 'Network timeout');
    assert.equal(tracker.snapshot.tasks[0].error, 'Network timeout');
  });

  it('works without an error message', () => {
    const tracker = makeTracker('t1');
    tracker.fail('t1');
    assert.equal(tracker.snapshot.tasks[0].error, undefined);
  });

  it('is a no-op for unknown id', () => {
    const tracker = makeTracker('t1');
    assert.doesNotThrow(() => tracker.fail('unknown', 'oops'));
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('ProgressTracker – remove', () => {
  it('removes the task from the snapshot', () => {
    const tracker = makeTracker('t1', 't2');
    tracker.remove('t1');
    const { tasks } = tracker.snapshot;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 't2');
  });

  it('is a no-op for unknown id', () => {
    const tracker = makeTracker('t1');
    assert.doesNotThrow(() => tracker.remove('unknown'));
    assert.equal(tracker.snapshot.tasks.length, 1);
  });
});

// ─── reset ───────────────────────────────────────────────────────────────────

describe('ProgressTracker – reset', () => {
  it('clears all tasks', () => {
    const tracker = makeTracker('a', 'b', 'c');
    tracker.reset();
    assert.equal(tracker.snapshot.tasks.length, 0);
  });

  it('overall resets to 0 after reset', () => {
    const tracker = makeTracker('t1');
    tracker.complete('t1');
    tracker.reset();
    assert.equal(tracker.snapshot.overall, 0);
  });

  it('can add tasks again after reset', () => {
    const tracker = makeTracker('t1');
    tracker.reset();
    tracker.add('t2', 'New Task');
    assert.equal(tracker.snapshot.tasks.length, 1);
    assert.equal(tracker.snapshot.tasks[0].id, 't2');
  });
});

// ─── overall ─────────────────────────────────────────────────────────────────

describe('ProgressTracker – overall', () => {
  it('is 0 when there are no tasks', () => {
    const tracker = new ProgressTracker();
    assert.equal(tracker.snapshot.overall, 0);
  });

  it('is 0 for all pending tasks', () => {
    const tracker = makeTracker('a', 'b', 'c');
    assert.equal(tracker.snapshot.overall, 0);
  });

  it('is 50 when half the tasks are done', () => {
    const tracker = makeTracker('a', 'b');
    tracker.complete('a');
    // a=100, b=0 → average=50
    assert.equal(tracker.snapshot.overall, 50);
  });

  it('is 100 when all tasks are done', () => {
    const tracker = makeTracker('a', 'b');
    tracker.complete('a');
    tracker.complete('b');
    assert.equal(tracker.snapshot.overall, 100);
  });

  it('reflects actual progress values', () => {
    const tracker = makeTracker('a', 'b', 'c', 'd');
    tracker.update('a', 100);
    tracker.update('b', 100);
    tracker.update('c', 0);
    tracker.update('d', 0);
    // (100+100+0+0)/4 = 50
    assert.equal(tracker.snapshot.overall, 50);
  });
});

// ─── done ────────────────────────────────────────────────────────────────────

describe('ProgressTracker – done', () => {
  it('is false when there are no tasks', () => {
    const tracker = new ProgressTracker();
    assert.equal(tracker.snapshot.done, false);
  });

  it('is false when tasks are still pending', () => {
    const tracker = makeTracker('a', 'b');
    assert.equal(tracker.snapshot.done, false);
  });

  it('is false when some tasks are still running', () => {
    const tracker = makeTracker('a', 'b');
    tracker.complete('a');
    tracker.start('b');
    assert.equal(tracker.snapshot.done, false);
  });

  it('is true when all tasks are done', () => {
    const tracker = makeTracker('a', 'b');
    tracker.complete('a');
    tracker.complete('b');
    assert.equal(tracker.snapshot.done, true);
  });

  it('is true when all tasks are done or errored', () => {
    const tracker = makeTracker('a', 'b');
    tracker.complete('a');
    tracker.fail('b', 'oops');
    assert.equal(tracker.snapshot.done, true);
  });

  it('is false when only some tasks are done', () => {
    const tracker = makeTracker('a', 'b', 'c');
    tracker.complete('a');
    tracker.complete('b');
    assert.equal(tracker.snapshot.done, false);
  });
});

// ─── subscribe ───────────────────────────────────────────────────────────────

describe('ProgressTracker – subscribe', () => {
  it('callback is called on add', () => {
    const tracker = new ProgressTracker();
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.add('t1', 'Task');
    assert.equal(calls, 1);
  });

  it('callback is called on update', () => {
    const tracker = makeTracker('t1');
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.update('t1', 50);
    assert.equal(calls, 1);
  });

  it('callback is called on complete', () => {
    const tracker = makeTracker('t1');
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.complete('t1');
    assert.equal(calls, 1);
  });

  it('callback is called on fail', () => {
    const tracker = makeTracker('t1');
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.fail('t1', 'err');
    assert.equal(calls, 1);
  });

  it('callback is called on remove', () => {
    const tracker = makeTracker('t1');
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.remove('t1');
    assert.equal(calls, 1);
  });

  it('callback is called on reset', () => {
    const tracker = makeTracker('t1');
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.reset();
    assert.equal(calls, 1);
  });

  it('callback receives the current snapshot', () => {
    const tracker = makeTracker('t1');
    let lastSnap = null;
    tracker.subscribe((snap) => { lastSnap = snap; });
    tracker.complete('t1');
    assert.ok(lastSnap !== null);
    assert.equal(lastSnap.overall, 100);
    assert.equal(lastSnap.done, true);
  });

  it('unsubscribe stops further callbacks', () => {
    const tracker = new ProgressTracker();
    let calls = 0;
    const unsub = tracker.subscribe(() => calls++);
    tracker.add('t1', 'Task');
    assert.equal(calls, 1);
    unsub();
    tracker.add('t2', 'Task2');
    assert.equal(calls, 1);
  });

  it('multiple subscribers all receive updates', () => {
    const tracker = makeTracker('t1');
    let a = 0;
    let b = 0;
    tracker.subscribe(() => a++);
    tracker.subscribe(() => b++);
    tracker.update('t1', 50);
    assert.equal(a, 1);
    assert.equal(b, 1);
  });
});
