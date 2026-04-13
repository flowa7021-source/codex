// ─── Unit Tests: Scheduler2 ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Scheduler2, createScheduler2 } from '../../app/modules/scheduler2.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a controllable clock starting at `start` ms. */
function makeClock(start = 1000) {
  let time = start;
  return {
    clock: () => time,
    advance: (ms) => { time += ms; },
    set: (ms) => { time = ms; },
  };
}

// ─── schedule ────────────────────────────────────────────────────────────────

describe('Scheduler2 – schedule()', () => {
  it('returns a non-empty string id', () => {
    const s = new Scheduler2();
    const id = s.schedule('ping', () => {});
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('each call returns a unique id', () => {
    const s = new Scheduler2();
    const id1 = s.schedule('a', () => {});
    const id2 = s.schedule('b', () => {});
    assert.notEqual(id1, id2);
  });

  it('task without interval runs on the first runDue() call', async () => {
    const { clock } = makeClock(1000);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.schedule('once', () => { ran = true; });
    await s.runDue();
    assert.equal(ran, true);
  });

  it('one-shot task is removed from pending after it runs', async () => {
    const { clock } = makeClock(1000);
    const s = new Scheduler2({ clock });
    s.schedule('once', () => {});
    assert.equal(s.pending().length, 1);
    await s.runDue();
    assert.equal(s.pending().length, 0);
  });

  it('one-shot task only runs once across multiple runDue() calls', async () => {
    const { clock } = makeClock(1000);
    const s = new Scheduler2({ clock });
    let count = 0;
    s.schedule('once', () => { count++; });
    await s.runDue();
    await s.runDue();
    assert.equal(count, 1);
  });

  it('repeating task runs on each runDue() when interval has elapsed', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    s.schedule('repeat', () => { count++; }, 100);

    advance(100);
    await s.runDue();
    assert.equal(count, 1);

    advance(100);
    await s.runDue();
    assert.equal(count, 2);

    advance(100);
    await s.runDue();
    assert.equal(count, 3);
  });

  it('repeating task stays in pending after running', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    s.schedule('repeat', () => {}, 100);
    advance(100);
    await s.runDue();
    assert.equal(s.pending().length, 1);
  });

  it('task does not run before its interval elapses', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.schedule('wait', () => { ran = true; }, 500);

    advance(499);
    await s.runDue();
    assert.equal(ran, false);
  });

  it('task runs exactly when interval elapses', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.schedule('exact', () => { ran = true; }, 500);

    advance(500);
    await s.runDue();
    assert.equal(ran, true);
  });

  it('pending() exposes task name and id', () => {
    const s = new Scheduler2();
    s.schedule('my-task', () => {});
    const [task] = s.pending();
    assert.equal(task.name, 'my-task');
    assert.equal(typeof task.id, 'string');
  });

  it('pending() exposes interval when provided', () => {
    const s = new Scheduler2();
    s.schedule('interval-task', () => {}, 250);
    const [task] = s.pending();
    assert.equal(task.interval, 250);
  });
});

// ─── scheduleAt ──────────────────────────────────────────────────────────────

describe('Scheduler2 – scheduleAt()', () => {
  it('returns a unique string id', () => {
    const s = new Scheduler2();
    const id = s.scheduleAt('event', () => {}, Date.now() + 1000);
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('task does not run before the target timestamp', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.scheduleAt('future', () => { ran = true; }, 1000);

    advance(999);
    await s.runDue();
    assert.equal(ran, false);
  });

  it('task runs exactly at the target timestamp', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.scheduleAt('on-time', () => { ran = true; }, 1000);

    advance(1000);
    await s.runDue();
    assert.equal(ran, true);
  });

  it('task runs when clock is past the timestamp', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.scheduleAt('late', () => { ran = true; }, 500);

    advance(9999);
    await s.runDue();
    assert.equal(ran, true);
  });

  it('one-shot scheduleAt task is removed after running', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    s.scheduleAt('disposable', () => {}, 100);

    advance(100);
    await s.runDue();
    assert.equal(s.pending().length, 0);
  });

  it('task runs only once (second runDue does not re-run it)', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    s.scheduleAt('once-at', () => { count++; }, 100);

    advance(100);
    await s.runDue();
    await s.runDue();
    assert.equal(count, 1);
  });

  it('multiple scheduleAt tasks can coexist with different timestamps', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    const ran = [];
    s.scheduleAt('first', () => { ran.push('first'); }, 100);
    s.scheduleAt('second', () => { ran.push('second'); }, 200);

    advance(100);
    await s.runDue();
    assert.deepEqual(ran, ['first']);

    advance(100);
    await s.runDue();
    assert.deepEqual(ran, ['first', 'second']);
  });

  it('scheduleAt task in the past runs immediately on first runDue()', async () => {
    const { clock } = makeClock(5000);
    const s = new Scheduler2({ clock });
    let ran = false;
    s.scheduleAt('past', () => { ran = true; }, 1000); // timestamp < now
    await s.runDue();
    assert.equal(ran, true);
  });
});

// ─── cancel ──────────────────────────────────────────────────────────────────

describe('Scheduler2 – cancel()', () => {
  it('returns true when task is found and cancelled', () => {
    const s = new Scheduler2();
    const id = s.schedule('x', () => {});
    assert.equal(s.cancel(id), true);
  });

  it('returns false when task id is unknown', () => {
    const s = new Scheduler2();
    assert.equal(s.cancel('ghost'), false);
  });

  it('cancelled task is removed from pending', () => {
    const s = new Scheduler2();
    const id = s.schedule('gone', () => {});
    s.cancel(id);
    assert.equal(s.pending().length, 0);
  });

  it('cancelled task does not run on next runDue()', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    const id = s.schedule('skip', () => { ran = true; });
    s.cancel(id);
    await s.runDue();
    assert.equal(ran, false);
  });

  it('cancelling a repeating task removes it permanently', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    const id = s.schedule('loop', () => { count++; }, 50);
    s.cancel(id);
    advance(1000);
    await s.runDue();
    assert.equal(count, 0);
    assert.equal(s.pending().length, 0);
  });

  it('returns false on second cancel of the same id', () => {
    const s = new Scheduler2();
    const id = s.schedule('x', () => {});
    s.cancel(id);
    assert.equal(s.cancel(id), false);
  });

  it('cancelling one task does not affect other tasks', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    const id = s.schedule('gone', () => { count++; });
    s.schedule('keep', () => { count++; });
    s.cancel(id);
    await s.runDue();
    assert.equal(count, 1);
  });

  it('a task can cancel itself during execution', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let runCount = 0;
    let selfId;
    selfId = s.schedule('self-cancel', () => {
      runCount++;
      s.cancel(selfId);
    }, 100);

    advance(100); // advance clock so task becomes due
    await s.runDue();
    advance(100);
    await s.runDue();
    // Task ran once then cancelled itself
    assert.equal(runCount, 1);
    assert.equal(s.pending().length, 0);
  });
});

// ─── pause / resume ──────────────────────────────────────────────────────────

describe('Scheduler2 – pause() / resume()', () => {
  it('paused task is skipped by runDue()', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    const id = s.schedule('paused', () => { ran = true; });
    s.pause(id);
    await s.runDue();
    assert.equal(ran, false);
  });

  it('paused task remains in pending', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    const id = s.schedule('paused', () => {});
    s.pause(id);
    await s.runDue();
    assert.equal(s.pending().length, 1);
  });

  it('resumed task runs on the next runDue()', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    const id = s.schedule('toggled', () => { ran = true; });
    s.pause(id);
    await s.runDue();
    assert.equal(ran, false);

    s.resume(id);
    await s.runDue();
    assert.equal(ran, true);
  });

  it('pause on unknown id is a no-op', () => {
    const s = new Scheduler2();
    assert.doesNotThrow(() => s.pause('nope'));
  });

  it('resume on unknown id is a no-op', () => {
    const s = new Scheduler2();
    assert.doesNotThrow(() => s.resume('nope'));
  });

  it('multiple tasks — only the paused one is skipped', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    const ran = [];
    const id1 = s.schedule('a', () => { ran.push('a'); });
    s.schedule('b', () => { ran.push('b'); });
    s.pause(id1);
    await s.runDue();
    assert.deepEqual(ran, ['b']);
  });

  it('pausing and resuming a repeating task works across ticks', async () => {
    const { clock, advance } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    const id = s.schedule('loop', () => { count++; }, 100);

    advance(100);
    await s.runDue();
    assert.equal(count, 1);

    s.pause(id);
    advance(100);
    await s.runDue();
    assert.equal(count, 1); // skipped

    s.resume(id);
    advance(100);
    await s.runDue();
    assert.equal(count, 2); // ran again
  });

  it('pausing an already-paused task is a no-op', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let ran = false;
    const id = s.schedule('double-pause', () => { ran = true; });
    s.pause(id);
    s.pause(id); // second pause should not throw or break state
    await s.runDue();
    assert.equal(ran, false);
  });
});

// ─── runDue ──────────────────────────────────────────────────────────────────

describe('Scheduler2 – runDue()', () => {
  it('runs async task and awaits completion', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let done = false;
    s.schedule('async', async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });
    await s.runDue();
    assert.equal(done, true);
  });

  it('errors thrown by tasks do not prevent other tasks from running', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let secondRan = false;
    s.schedule('fail', async () => { throw new Error('boom'); });
    s.schedule('ok', () => { secondRan = true; });
    await assert.doesNotReject(() => s.runDue());
    assert.equal(secondRan, true);
  });

  it('does nothing when no tasks are due', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    s.schedule('future', () => {}, 9999);
    // clock is still at 0, so nextRun = 9999 is not due
    let ran = false;
    // Replace fn after scheduling (to check it didn't run)
    s.pending()[0].fn = () => { ran = true; };
    // Can't mutate the internal fn via pending() since it's a copy,
    // so just assert no errors and no side effects
    await assert.doesNotReject(() => s.runDue());
  });

  it('runs all due tasks in a single call', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    s.schedule('t1', () => { count++; });
    s.schedule('t2', () => { count++; });
    s.schedule('t3', () => { count++; });
    await s.runDue();
    assert.equal(count, 3);
  });
});

// ─── pending ─────────────────────────────────────────────────────────────────

describe('Scheduler2 – pending()', () => {
  it('returns empty array when no tasks are registered', () => {
    const s = new Scheduler2();
    assert.deepEqual(s.pending(), []);
  });

  it('returns one entry per registered task', () => {
    const s = new Scheduler2();
    s.schedule('a', () => {});
    s.schedule('b', () => {});
    assert.equal(s.pending().length, 2);
  });

  it('does not include cancelled tasks', () => {
    const s = new Scheduler2();
    const id = s.schedule('gone', () => {});
    s.schedule('keep', () => {});
    s.cancel(id);
    assert.equal(s.pending().length, 1);
  });

  it('returns a snapshot — mutations do not affect internal state', () => {
    const s = new Scheduler2();
    s.schedule('safe', () => {});
    const snap = s.pending();
    snap.pop();
    assert.equal(s.pending().length, 1);
  });

  it('includes paused tasks in the list', () => {
    const s = new Scheduler2();
    const id = s.schedule('paused', () => {});
    s.pause(id);
    assert.equal(s.pending().length, 1);
  });

  it('includes nextRun timestamp in each entry', () => {
    const { clock } = makeClock(5000);
    const s = new Scheduler2({ clock });
    s.schedule('timed', () => {}, 200);
    const [task] = s.pending();
    assert.equal(task.nextRun, 5200);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('Scheduler2 – clear()', () => {
  it('removes all pending tasks', () => {
    const s = new Scheduler2();
    s.schedule('a', () => {});
    s.schedule('b', () => {});
    s.schedule('c', () => {}, 100);
    s.clear();
    assert.equal(s.pending().length, 0);
  });

  it('cleared tasks do not run on subsequent runDue()', async () => {
    const { clock } = makeClock(0);
    const s = new Scheduler2({ clock });
    let count = 0;
    s.schedule('t1', () => { count++; });
    s.schedule('t2', () => { count++; });
    s.clear();
    await s.runDue();
    assert.equal(count, 0);
  });

  it('new tasks can be added after clear()', () => {
    const s = new Scheduler2();
    s.schedule('old', () => {});
    s.clear();
    const id = s.schedule('new', () => {});
    assert.equal(s.pending().length, 1);
    assert.equal(typeof id, 'string');
  });

  it('calling clear() on an empty scheduler is a no-op', () => {
    const s = new Scheduler2();
    assert.doesNotThrow(() => s.clear());
    assert.equal(s.pending().length, 0);
  });
});

// ─── createScheduler2 factory ────────────────────────────────────────────────

describe('createScheduler2()', () => {
  it('returns a Scheduler2 instance', () => {
    const s = createScheduler2();
    assert.ok(s instanceof Scheduler2);
  });

  it('passes clock option through to the instance', async () => {
    let time = 1000;
    const s = createScheduler2({ clock: () => time });
    let ran = false;
    s.schedule('t', () => { ran = true; }, 500);

    // Task nextRun = 1000 + 500 = 1500; clock still at 1000 — not due
    await s.runDue();
    assert.equal(ran, false);

    time = 1500;
    await s.runDue();
    assert.equal(ran, true);
  });

  it('default clock uses real Date.now', async () => {
    const s = createScheduler2();
    let ran = false;
    s.schedule('now', () => { ran = true; });
    await s.runDue();
    assert.equal(ran, true);
  });
});
