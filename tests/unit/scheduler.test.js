// ─── Unit Tests: Scheduler ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Scheduler,
  parseCronPattern,
  nextCronDate,
  createScheduler,
} from '../../app/modules/scheduler.js';

// ─── Mock clock ───────────────────────────────────────────────────────────────

/** Create a controllable mock clock.  Timers never fire on their own. */
function makeClock(startMs = 1_000_000) {
  let now = startMs;
  const timers = new Map();
  let nextTimerId = 1;

  return {
    now: () => now,
    advance: (ms) => { now += ms; },
    setNow: (ms) => { now = ms; },
    setTimeout: (fn, _ms) => {
      const id = nextTimerId++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); },
    _timers: timers,
  };
}

// ─── schedule: returns ID ─────────────────────────────────────────────────────

describe('Scheduler – schedule returns ID', () => {
  it('returns a non-empty string id', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {});
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  });

  it('each call returns a unique id', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const ids = new Set([
      s.schedule(() => {}),
      s.schedule(() => {}),
      s.schedule(() => {}),
    ]);
    assert.equal(ids.size, 3);
  });

  it('id is immediately visible via isScheduled', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {});
    assert.equal(s.isScheduled(id), true);
  });
});

// ─── schedule: one-shot tasks ─────────────────────────────────────────────────

describe('Scheduler – one-shot tasks', () => {
  it('runs exactly once on tick', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    s.schedule(() => { count++; });
    await s.tick(clock.now());
    assert.equal(count, 1);
  });

  it('does not run again on a second tick', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    s.schedule(() => { count++; });
    await s.tick(clock.now());
    clock.advance(1000);
    await s.tick(clock.now());
    assert.equal(count, 1);
  });

  it('is marked cancelled after running', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {});
    await s.tick(clock.now());
    assert.equal(s.isScheduled(id), false);
  });

  it('task with delay does not run before delay elapses', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let ran = false;
    s.schedule(() => { ran = true; }, { delay: 500 });
    await s.tick(clock.now() + 499);
    assert.equal(ran, false);
  });

  it('task with delay runs at or after the delay', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let ran = false;
    s.schedule(() => { ran = true; }, { delay: 500 });
    await s.tick(clock.now() + 500);
    assert.equal(ran, true);
  });

  it('awaits async task before proceeding', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const log = [];
    s.schedule(async () => {
      await Promise.resolve();
      log.push('async');
    }, { priority: 10 });
    s.schedule(() => { log.push('sync'); }, { priority: 1 });
    await s.tick(clock.now());
    assert.deepEqual(log, ['async', 'sync']);
  });
});

// ─── schedule: recurring tasks ────────────────────────────────────────────────

describe('Scheduler – recurring tasks', () => {
  it('runs on each interval tick', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    const base = clock.now();
    s.schedule(() => { count++; }, { interval: 100 });

    await s.tick(base);        // first run
    assert.equal(count, 1);

    await s.tick(base + 100);  // second run
    assert.equal(count, 2);

    await s.tick(base + 200);  // third run
    assert.equal(count, 3);
  });

  it('remains scheduled after running', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {}, { interval: 100 });
    await s.tick(clock.now());
    assert.equal(s.isScheduled(id), true);
  });

  it('does not run twice in the same tick for a single elapsed interval', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    const base = clock.now();
    s.schedule(() => { count++; }, { interval: 100 });
    await s.tick(base);         // runs once
    await s.tick(base + 50);    // not yet due again
    assert.equal(count, 1);
  });

  it('recurring task with initial delay', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    const base = clock.now();
    s.schedule(() => { count++; }, { delay: 200, interval: 100 });

    await s.tick(base + 100);   // before initial delay — no run
    assert.equal(count, 0);

    await s.tick(base + 200);   // at delay — first run
    assert.equal(count, 1);

    await s.tick(base + 300);   // one interval after — second run
    assert.equal(count, 2);
  });
});

// ─── cancel ───────────────────────────────────────────────────────────────────

describe('Scheduler – cancel', () => {
  it('returns true when found and cancelled', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {});
    assert.equal(s.cancel(id), true);
  });

  it('returns false for unknown id', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    assert.equal(s.cancel('no-such-task'), false);
  });

  it('returns false when called twice on the same id', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {});
    s.cancel(id);
    assert.equal(s.cancel(id), false);
  });

  it('cancelled task does not run on tick', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let ran = false;
    const id = s.schedule(() => { ran = true; });
    s.cancel(id);
    await s.tick(clock.now());
    assert.equal(ran, false);
  });

  it('cancelled recurring task does not run', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    const id = s.schedule(() => { count++; }, { interval: 100 });
    s.cancel(id);
    await s.tick(clock.now() + 500);
    assert.equal(count, 0);
  });
});

// ─── isScheduled / getTask / pending ─────────────────────────────────────────

describe('Scheduler – isScheduled, getTask, pending', () => {
  it('isScheduled returns false for unknown id', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    assert.equal(s.isScheduled('x'), false);
  });

  it('getTask returns undefined for unknown id', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    assert.equal(s.getTask('x'), undefined);
  });

  it('getTask returns correct snapshot before run', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id = s.schedule(() => {}, { priority: 7, delay: 300 });
    const info = s.getTask(id);
    assert.ok(info);
    assert.equal(info.id, id);
    assert.equal(info.priority, 7);
    assert.equal(info.runCount, 0);
    assert.equal(info.lastRunAt, null);
    assert.equal(info.nextRunAt, clock.now() + 300);
    assert.equal(info.cancelled, false);
  });

  it('getTask reflects runCount and lastRunAt after tick', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const base = clock.now();
    const id = s.schedule(() => {}, { interval: 100 });
    await s.tick(base);
    const info = s.getTask(id);
    assert.ok(info);
    assert.equal(info.runCount, 1);
    assert.equal(info.lastRunAt, base);
  });

  it('pending lists all non-cancelled task ids', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const id1 = s.schedule(() => {});
    const id2 = s.schedule(() => {});
    const id3 = s.schedule(() => {});
    s.cancel(id2);
    const p = s.pending;
    assert.ok(p.includes(id1));
    assert.ok(!p.includes(id2));
    assert.ok(p.includes(id3));
  });

  it('pending is empty initially', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    assert.deepEqual(s.pending, []);
  });
});

// ─── tick: runs due tasks ─────────────────────────────────────────────────────

describe('Scheduler – tick', () => {
  it('runs multiple due tasks in one call', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    s.schedule(() => { count++; });
    s.schedule(() => { count++; });
    s.schedule(() => { count++; });
    await s.tick(clock.now());
    assert.equal(count, 3);
  });

  it('skips tasks not yet due', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let ran = false;
    s.schedule(() => { ran = true; }, { delay: 1000 });
    await s.tick(clock.now() + 500);
    assert.equal(ran, false);
  });

  it('passes current time when called with no argument', async () => {
    // This verifies tick() uses clock.now() when no arg is given
    const clock = makeClock();
    const s = new Scheduler(clock);
    let ran = false;
    s.schedule(() => { ran = true; });
    await s.tick();
    assert.equal(ran, true);
  });

  it('a task cancelled during another task\'s run is not executed', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let secondRan = false;
    const id2 = s.schedule(() => { secondRan = true; }, { priority: 1 });
    s.schedule(() => { s.cancel(id2); }, { priority: 10 });
    await s.tick(clock.now());
    assert.equal(secondRan, false);
  });
});

// ─── priority ordering ────────────────────────────────────────────────────────

describe('Scheduler – priority ordering', () => {
  it('higher-priority task runs first', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const log = [];
    s.schedule(() => { log.push('low'); }, { priority: 1 });
    s.schedule(() => { log.push('high'); }, { priority: 100 });
    s.schedule(() => { log.push('mid'); }, { priority: 50 });
    await s.tick(clock.now());
    assert.deepEqual(log, ['high', 'mid', 'low']);
  });

  it('equal-priority tasks run in nextRunAt ascending order', async () => {
    const clock = makeClock();
    const base = clock.now();
    const s = new Scheduler(clock);
    const log = [];
    s.schedule(() => { log.push('later'); }, { priority: 5, delay: 200 });
    s.schedule(() => { log.push('sooner'); }, { priority: 5, delay: 100 });
    await s.tick(base + 200);
    assert.deepEqual(log, ['sooner', 'later']);
  });

  it('pending getter reflects priority+nextRunAt order', () => {
    const clock = makeClock();
    const base = clock.now();
    const s = new Scheduler(clock);
    const idA = s.schedule(() => {}, { priority: 5, delay: 100 });
    const idB = s.schedule(() => {}, { priority: 10, delay: 50 });
    const idC = s.schedule(() => {}, { priority: 5, delay: 50 });
    const p = s.pending;
    // idB has highest priority
    assert.equal(p[0], idB);
    // idC and idA both priority 5; idC has smaller nextRunAt
    assert.equal(p[1], idC);
    assert.equal(p[2], idA);
  });
});

// ─── maxRuns limit ────────────────────────────────────────────────────────────

describe('Scheduler – maxRuns', () => {
  it('stops after maxRuns executions', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    const base = clock.now();
    s.schedule(() => { count++; }, { interval: 100, maxRuns: 3 });

    await s.tick(base);
    await s.tick(base + 100);
    await s.tick(base + 200);
    await s.tick(base + 300); // should NOT run a 4th time
    assert.equal(count, 3);
  });

  it('is no longer scheduled after maxRuns reached', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    const base = clock.now();
    const id = s.schedule(() => {}, { interval: 100, maxRuns: 2 });
    await s.tick(base);
    await s.tick(base + 100);
    assert.equal(s.isScheduled(id), false);
  });

  it('maxRuns=1 on a recurring task behaves as one-shot', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    const base = clock.now();
    const id = s.schedule(() => { count++; }, { interval: 100, maxRuns: 1 });
    await s.tick(base);
    await s.tick(base + 100);
    assert.equal(count, 1);
    assert.equal(s.isScheduled(id), false);
  });
});

// ─── cancelAll ────────────────────────────────────────────────────────────────

describe('Scheduler – cancelAll', () => {
  it('cancels all pending tasks', () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    s.schedule(() => {});
    s.schedule(() => {}, { interval: 100 });
    s.schedule(() => {}, { delay: 500 });
    s.cancelAll();
    assert.deepEqual(s.pending, []);
  });

  it('no task runs after cancelAll', async () => {
    const clock = makeClock();
    const s = new Scheduler(clock);
    let count = 0;
    s.schedule(() => { count++; });
    s.schedule(() => { count++; }, { interval: 100 });
    s.cancelAll();
    await s.tick(clock.now() + 1000);
    assert.equal(count, 0);
  });
});

// ─── createScheduler factory ──────────────────────────────────────────────────

describe('createScheduler', () => {
  it('returns a Scheduler instance', () => {
    const s = createScheduler();
    assert.ok(s instanceof Scheduler);
  });

  it('returned scheduler can schedule and query tasks', () => {
    const s = createScheduler();
    const id = s.schedule(() => {});
    assert.equal(s.isScheduled(id), true);
    s.cancel(id);
    assert.equal(s.isScheduled(id), false);
  });
});

// ─── parseCronPattern ─────────────────────────────────────────────────────────

describe('parseCronPattern', () => {
  it('parses "* * * * *" as all values for each field', () => {
    const f = parseCronPattern('* * * * *');
    assert.equal(f.minute.length, 60);   // 0-59
    assert.equal(f.hour.length, 24);     // 0-23
    assert.equal(f.dom.length, 31);      // 1-31
    assert.equal(f.month.length, 12);    // 1-12
    assert.equal(f.dow.length, 7);       // 0-6
  });

  it('parses single values', () => {
    const f = parseCronPattern('30 12 15 6 3');
    assert.deepEqual(f.minute, [30]);
    assert.deepEqual(f.hour, [12]);
    assert.deepEqual(f.dom, [15]);
    assert.deepEqual(f.month, [6]);
    assert.deepEqual(f.dow, [3]);
  });

  it('parses ranges (1-5)', () => {
    const f = parseCronPattern('0 0 * * 1-5');
    assert.deepEqual(f.dow, [1, 2, 3, 4, 5]);
  });

  it('parses comma-separated lists', () => {
    const f = parseCronPattern('0,15,30,45 * * * *');
    assert.deepEqual(f.minute, [0, 15, 30, 45]);
  });

  it('parses step syntax */5 for minutes', () => {
    const f = parseCronPattern('*/5 * * * *');
    assert.deepEqual(f.minute, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it('parses step syntax */2 for hours', () => {
    const f = parseCronPattern('0 */2 * * *');
    assert.deepEqual(f.hour, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
  });

  it('parses range+step (1-6/2)', () => {
    const f = parseCronPattern('0 0 1-6/2 * *');
    assert.deepEqual(f.dom, [1, 3, 5]);
  });

  it('parses "0 12 * * 1-5" (weekdays at noon)', () => {
    const f = parseCronPattern('0 12 * * 1-5');
    assert.deepEqual(f.minute, [0]);
    assert.deepEqual(f.hour, [12]);
    assert.deepEqual(f.dow, [1, 2, 3, 4, 5]);
  });

  it('throws on wrong number of fields', () => {
    assert.throws(
      () => parseCronPattern('* * * *'),
      /expected 5 fields/,
    );
  });

  it('throws on out-of-range value', () => {
    assert.throws(
      () => parseCronPattern('60 * * * *'),
      /out of bounds/,
    );
  });

  it('throws on invalid range', () => {
    assert.throws(
      () => parseCronPattern('* 25 * * *'),
      /out of bounds/,
    );
  });

  it('month field: 1-12 are all valid', () => {
    const f = parseCronPattern('0 0 1 1-12 *');
    assert.deepEqual(f.month, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('dow field: 0 (Sunday) through 6 (Saturday)', () => {
    const f = parseCronPattern('0 0 * * 0-6');
    assert.deepEqual(f.dow, [0, 1, 2, 3, 4, 5, 6]);
  });

  it('minute values are sorted ascending', () => {
    const f = parseCronPattern('45,5,30 * * * *');
    assert.deepEqual(f.minute, [5, 30, 45]);
  });
});

// ─── nextCronDate ─────────────────────────────────────────────────────────────

describe('nextCronDate', () => {
  it('returns a Date in the future relative to `from`', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const next = nextCronDate('* * * * *', from);
    assert.ok(next > from);
  });

  it('"* * * * *" returns exactly one minute after `from`', () => {
    const from = new Date('2026-04-01T10:00:00.000Z');
    const next = nextCronDate('* * * * *', from);
    const expected = new Date('2026-04-01T10:01:00.000Z');
    assert.equal(next.getTime(), expected.getTime());
  });

  it('returns next matching minute for a specific minute pattern', () => {
    // Pattern: minute 30, any hour/day
    const from = new Date('2026-04-01T10:00:00.000Z');
    const next = nextCronDate('30 * * * *', from);
    // Next :30 after 10:00 is 10:30
    assert.equal(next.getMinutes(), 30);
    assert.equal(next.getHours(), from.getHours());
  });

  it('advances to the next hour when minute has already passed', () => {
    const from = new Date('2026-04-01T10:31:00.000Z');
    const next = nextCronDate('30 * * * *', from);
    // :30 already passed this hour — next is 11:30
    assert.equal(next.getHours(), 11);
    assert.equal(next.getMinutes(), 30);
  });

  it('handles a specific hour and minute', () => {
    const from = new Date('2026-04-01T08:00:00.000Z');
    const next = nextCronDate('0 12 * * *', from);
    assert.equal(next.getHours(), 12);
    assert.equal(next.getMinutes(), 0);
  });

  it('skips to next month when current month does not match', () => {
    // Pattern: every minute, but only in December (month 12)
    const from = new Date('2026-01-15T00:00:00.000Z');
    const next = nextCronDate('0 0 1 12 *', from);
    assert.equal(next.getMonth(), 11); // JS month is 0-based: 11 = December
    assert.equal(next.getDate(), 1);
  });

  it('returns a result whose seconds are zero', () => {
    const from = new Date('2026-04-01T10:00:45.000Z');
    const next = nextCronDate('* * * * *', from);
    assert.equal(next.getSeconds(), 0);
    assert.equal(next.getMilliseconds(), 0);
  });

  it('weekday filter: "0 9 * * 1" returns a Monday', () => {
    // Monday = dow 1
    const from = new Date('2026-04-12T00:00:00.000Z'); // Sunday 12 Apr 2026
    const next = nextCronDate('0 9 * * 1', from);
    assert.equal(next.getDay(), 1); // Monday
    assert.equal(next.getHours(), 9);
    assert.equal(next.getMinutes(), 0);
  });

  it('throws for patterns that can never match (e.g. Feb 31)', () => {
    // Feb 31 will never exist → should throw after scanning 4 years
    assert.throws(
      () => nextCronDate('0 0 31 2 *', new Date('2026-01-01T00:00:00.000Z')),
      /No matching date found/,
    );
  });
});
