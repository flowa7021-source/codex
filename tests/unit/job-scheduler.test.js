// ─── Unit Tests: JobScheduler ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { JobScheduler } from '../../app/modules/job-scheduler.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a scheduler with a controllable clock starting at `start`. */
function makeScheduler(start = 0) {
  let time = start;
  const now = () => time;
  const advance = (ms) => { time += ms; };
  const scheduler = new JobScheduler({ now, tickInterval: 100 });
  return { scheduler, now, advance };
}

// ─── register + tick ─────────────────────────────────────────────────────────

describe('JobScheduler – register + tick', () => {
  it('job runs when tick advances past nextRun', async () => {
    const { scheduler, advance } = makeScheduler(1000);
    let ran = false;
    scheduler.register({ name: 'test', fn: () => { ran = false; ran = true; }, interval: 500 });

    // Before interval elapses
    await scheduler.tick();
    assert.equal(ran, false);

    // After interval elapses
    advance(500);
    await scheduler.tick();
    assert.equal(ran, true);
  });

  it('job does not run before its interval', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let count = 0;
    scheduler.register({ name: 'not-yet', fn: () => { count++; }, interval: 1000 });

    advance(999);
    await scheduler.tick();
    assert.equal(count, 0);
  });

  it('job runs exactly at nextRun time', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let count = 0;
    scheduler.register({ name: 'exact', fn: () => { count++; }, interval: 200 });

    advance(200);
    await scheduler.tick();
    assert.equal(count, 1);
  });

  it('job runs on every tick where interval has elapsed', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let count = 0;
    scheduler.register({ name: 'repeat', fn: () => { count++; }, interval: 100 });

    advance(100);
    await scheduler.tick();
    assert.equal(count, 1);

    advance(100);
    await scheduler.tick();
    assert.equal(count, 2);

    advance(100);
    await scheduler.tick();
    assert.equal(count, 3);
  });
});

// ─── runImmediately ───────────────────────────────────────────────────────────

describe('JobScheduler – runImmediately', () => {
  it('job with runImmediately runs on the first tick', async () => {
    const { scheduler } = makeScheduler(1000);
    let ran = false;
    scheduler.register({ name: 'immed', fn: () => { ran = true; }, interval: 5000, runImmediately: true });

    await scheduler.tick();
    assert.equal(ran, true);
  });

  it('job without runImmediately does not run on first tick', async () => {
    const { scheduler } = makeScheduler(0);
    let ran = false;
    scheduler.register({ name: 'delayed', fn: () => { ran = true; }, interval: 5000, runImmediately: false });

    await scheduler.tick();
    assert.equal(ran, false);
  });

  it('after runImmediately, subsequent run waits for full interval', async () => {
    const { scheduler, advance } = makeScheduler(1000);
    let count = 0;
    scheduler.register({ name: 'immed2', fn: () => { count++; }, interval: 500, runImmediately: true });

    await scheduler.tick();  // runs immediately
    assert.equal(count, 1);

    advance(499);
    await scheduler.tick();  // not yet
    assert.equal(count, 1);

    advance(1);
    await scheduler.tick();  // now
    assert.equal(count, 2);
  });
});

// ─── setEnabled ───────────────────────────────────────────────────────────────

describe('JobScheduler – setEnabled', () => {
  it('disabled job is skipped during tick', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let count = 0;
    const id = scheduler.register({ name: 'skip', fn: () => { count++; }, interval: 100 });

    scheduler.setEnabled(id, false);
    advance(100);
    await scheduler.tick();
    assert.equal(count, 0);
  });

  it('re-enabling a job lets it run again', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let count = 0;
    const id = scheduler.register({ name: 'toggle', fn: () => { count++; }, interval: 100 });

    scheduler.setEnabled(id, false);
    advance(100);
    await scheduler.tick();
    assert.equal(count, 0);

    scheduler.setEnabled(id, true);
    advance(100); // now past nextRun
    await scheduler.tick();
    assert.equal(count, 1);
  });

  it('setEnabled on unknown id is a no-op', () => {
    const { scheduler } = makeScheduler(0);
    assert.doesNotThrow(() => scheduler.setEnabled('ghost', false));
  });
});

// ─── trigger ─────────────────────────────────────────────────────────────────

describe('JobScheduler – trigger', () => {
  it('trigger runs job immediately regardless of schedule', async () => {
    const { scheduler } = makeScheduler(0);
    let ran = false;
    const id = scheduler.register({ name: 'trig', fn: () => { ran = true; }, interval: 9999 });

    await scheduler.trigger(id);
    assert.equal(ran, true);
  });

  it('trigger updates runCount and lastRun', async () => {
    const { scheduler } = makeScheduler(500);
    const id = scheduler.register({ name: 'rc', fn: () => {}, interval: 9999 });

    await scheduler.trigger(id);
    const job = scheduler.get(id);
    assert.equal(job.runCount, 1);
    assert.equal(job.lastRun, 500);
  });

  it('trigger on disabled job still runs it', async () => {
    const { scheduler } = makeScheduler(0);
    let ran = false;
    const id = scheduler.register({ name: 'disabled-trig', fn: () => { ran = true; }, interval: 100 });
    scheduler.setEnabled(id, false);

    await scheduler.trigger(id);
    assert.equal(ran, true);
  });

  it('trigger on unknown id is a no-op', async () => {
    const { scheduler } = makeScheduler(0);
    await scheduler.trigger('nonexistent'); // should not throw
  });
});

// ─── unregister ───────────────────────────────────────────────────────────────

describe('JobScheduler – unregister', () => {
  it('unregistered job is no longer returned by getAll', () => {
    const { scheduler } = makeScheduler(0);
    const id = scheduler.register({ name: 'bye', fn: () => {}, interval: 100 });
    scheduler.unregister(id);
    assert.equal(scheduler.getAll().length, 0);
    assert.equal(scheduler.get(id), undefined);
  });

  it('unregistered job does not run on tick', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let count = 0;
    const id = scheduler.register({ name: 'gone', fn: () => { count++; }, interval: 100 });
    scheduler.unregister(id);

    advance(100);
    await scheduler.tick();
    assert.equal(count, 0);
  });

  it('unregister on unknown id is a no-op', () => {
    const { scheduler } = makeScheduler(0);
    assert.doesNotThrow(() => scheduler.unregister('phantom'));
  });
});

// ─── runCount ─────────────────────────────────────────────────────────────────

describe('JobScheduler – runCount', () => {
  it('runCount starts at 0', () => {
    const { scheduler } = makeScheduler(0);
    const id = scheduler.register({ name: 'cnt', fn: () => {}, interval: 100 });
    assert.equal(scheduler.get(id).runCount, 0);
  });

  it('runCount increments on each run', async () => {
    const { scheduler, advance } = makeScheduler(0);
    const id = scheduler.register({ name: 'incr', fn: () => {}, interval: 50 });

    for (let i = 1; i <= 5; i++) {
      advance(50);
      await scheduler.tick();
      assert.equal(scheduler.get(id).runCount, i);
    }
  });
});

// ─── nextRun advancement ──────────────────────────────────────────────────────

describe('JobScheduler – nextRun advancement', () => {
  it('nextRun advances by interval after each run', async () => {
    const { scheduler, advance } = makeScheduler(1000);
    const id = scheduler.register({ name: 'nxt', fn: () => {}, interval: 200 });

    advance(200);
    await scheduler.tick();
    assert.equal(scheduler.get(id).nextRun, 1200 + 200); // ran at 1200, next = 1200 + 200

    advance(200);
    await scheduler.tick();
    assert.equal(scheduler.get(id).nextRun, 1400 + 200);
  });

  it('lastRun is set to the time tick ran the job', async () => {
    const { scheduler, advance } = makeScheduler(0);
    const id = scheduler.register({ name: 'lr', fn: () => {}, interval: 300 });

    advance(300);
    await scheduler.tick();
    assert.equal(scheduler.get(id).lastRun, 300);
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('JobScheduler – getAll', () => {
  it('returns empty array when no jobs registered', () => {
    const { scheduler } = makeScheduler(0);
    assert.deepEqual(scheduler.getAll(), []);
  });

  it('returns all registered jobs', () => {
    const { scheduler } = makeScheduler(0);
    const ids = [
      scheduler.register({ name: 'a', fn: () => {}, interval: 100 }),
      scheduler.register({ name: 'b', fn: () => {}, interval: 200 }),
      scheduler.register({ name: 'c', fn: () => {}, interval: 300 }),
    ];
    const all = scheduler.getAll();
    assert.equal(all.length, 3);
    assert.deepEqual(all.map(j => j.id).sort(), ids.sort());
  });

  it('unregistered jobs are not included', () => {
    const { scheduler } = makeScheduler(0);
    const id1 = scheduler.register({ name: 'keep', fn: () => {}, interval: 100 });
    const id2 = scheduler.register({ name: 'drop', fn: () => {}, interval: 200 });
    scheduler.unregister(id2);
    const all = scheduler.getAll();
    assert.equal(all.length, 1);
    assert.equal(all[0].id, id1);
  });
});

// ─── isRunning ────────────────────────────────────────────────────────────────

describe('JobScheduler – isRunning', () => {
  it('isRunning is false before start()', () => {
    const { scheduler } = makeScheduler(0);
    assert.equal(scheduler.isRunning, false);
  });

  it('isRunning is true after start() and false after stop()', () => {
    const { scheduler } = makeScheduler(0);
    scheduler.start();
    assert.equal(scheduler.isRunning, true);
    scheduler.stop();
    assert.equal(scheduler.isRunning, false);
  });

  it('calling stop() when not running is a no-op', () => {
    const { scheduler } = makeScheduler(0);
    assert.doesNotThrow(() => scheduler.stop());
    assert.equal(scheduler.isRunning, false);
  });

  it('calling start() twice does not create duplicate timers', () => {
    const { scheduler } = makeScheduler(0);
    scheduler.start();
    scheduler.start(); // second call should be no-op
    assert.equal(scheduler.isRunning, true);
    scheduler.stop();
    assert.equal(scheduler.isRunning, false);
  });
});

// ─── async jobs ───────────────────────────────────────────────────────────────

describe('JobScheduler – async job fns', () => {
  it('awaits async job fns before resolving tick', async () => {
    const { scheduler, advance } = makeScheduler(0);
    let resolved = false;
    scheduler.register({
      name: 'async-job',
      fn: async () => {
        await new Promise(r => setTimeout(r, 10));
        resolved = true;
      },
      interval: 100,
    });

    advance(100);
    await scheduler.tick();
    assert.equal(resolved, true);
  });

  it('errors thrown by async jobs do not crash tick', async () => {
    const { scheduler, advance } = makeScheduler(0);
    scheduler.register({
      name: 'bad',
      fn: async () => { throw new Error('job error'); },
      interval: 100,
    });

    advance(100);
    await assert.doesNotReject(() => scheduler.tick());
  });
});
