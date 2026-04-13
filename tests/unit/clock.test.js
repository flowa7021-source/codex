// ─── Unit Tests: clock ────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RealClock, FakeClock, Stopwatch } from '../../app/modules/clock.js';

// ─── RealClock ───────────────────────────────────────────────────────────────

describe('RealClock', () => {
  it('now() returns a number', () => {
    const clock = new RealClock();
    assert.equal(typeof clock.now(), 'number');
  });

  it('now() is close to Date.now()', () => {
    const clock = new RealClock();
    const before = Date.now();
    const t = clock.now();
    const after = Date.now();
    assert.ok(t >= before && t <= after, `expected ${t} to be in [${before}, ${after}]`);
  });

  it('Date property is the global Date constructor', () => {
    const clock = new RealClock();
    assert.strictEqual(clock.Date, Date);
  });

  it('successive now() calls are non-decreasing', () => {
    const clock = new RealClock();
    const t1 = clock.now();
    const t2 = clock.now();
    assert.ok(t2 >= t1);
  });
});

// ─── FakeClock ───────────────────────────────────────────────────────────────

describe('FakeClock – construction / now / setTime', () => {
  it('defaults to time 0', () => {
    const clock = new FakeClock();
    assert.equal(clock.now(), 0);
  });

  it('accepts a custom startTime', () => {
    const clock = new FakeClock(1000);
    assert.equal(clock.now(), 1000);
  });

  it('setTime changes the current time', () => {
    const clock = new FakeClock(0);
    clock.setTime(5000);
    assert.equal(clock.now(), 5000);
  });

  it('setTime does not fire callbacks', () => {
    const clock = new FakeClock(0);
    let fired = false;
    clock.schedule(() => { fired = true; }, 100);
    clock.setTime(200);
    assert.equal(fired, false);
  });
});

describe('FakeClock – tick', () => {
  it('advances time by the given amount', () => {
    const clock = new FakeClock(0);
    clock.tick(500);
    assert.equal(clock.now(), 500);
  });

  it('multiple ticks accumulate', () => {
    const clock = new FakeClock(0);
    clock.tick(100);
    clock.tick(200);
    assert.equal(clock.now(), 300);
  });

  it('fires callbacks scheduled within the tick window', () => {
    const clock = new FakeClock(0);
    let fired = false;
    clock.schedule(() => { fired = true; }, 50);
    clock.tick(100);
    assert.equal(fired, true);
  });

  it('does not fire callbacks beyond the tick window', () => {
    const clock = new FakeClock(0);
    let fired = false;
    clock.schedule(() => { fired = true; }, 200);
    clock.tick(100);
    assert.equal(fired, false);
  });

  it('fires callbacks in chronological order', () => {
    const clock = new FakeClock(0);
    const order = [];
    clock.schedule(() => order.push(2), 20);
    clock.schedule(() => order.push(1), 10);
    clock.schedule(() => order.push(3), 30);
    clock.tick(50);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('fires multiple callbacks at the same timestamp', () => {
    const clock = new FakeClock(0);
    let count = 0;
    clock.schedule(() => count++, 10);
    clock.schedule(() => count++, 10);
    clock.tick(20);
    assert.equal(count, 2);
  });

  it('sets current time to scheduled time when callback fires', () => {
    const clock = new FakeClock(0);
    let timeAtFire = -1;
    clock.schedule(() => { timeAtFire = clock.now(); }, 50);
    clock.tick(100);
    assert.equal(timeAtFire, 50);
  });

  it('callbacks scheduled by a callback are executed if within the tick window', () => {
    const clock = new FakeClock(0);
    let second = false;
    clock.schedule(() => {
      clock.scheduleIn(() => { second = true; }, 10);
    }, 10);
    clock.tick(30);
    assert.equal(second, true);
  });
});

describe('FakeClock – schedule / scheduleIn', () => {
  it('schedule adds a pending callback', () => {
    const clock = new FakeClock(0);
    clock.schedule(() => {}, 100);
    assert.equal(clock.getPending().length, 1);
  });

  it('scheduleIn adds relative to current time', () => {
    const clock = new FakeClock(1000);
    clock.scheduleIn(() => {}, 200);
    const pending = clock.getPending();
    assert.equal(pending[0].at, 1200);
  });

  it('getPending returns expected at and callback', () => {
    const clock = new FakeClock(0);
    const cb = () => {};
    clock.schedule(cb, 999);
    const pending = clock.getPending();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].at, 999);
    assert.strictEqual(pending[0].callback, cb);
  });

  it('getPending is a snapshot, not the internal array', () => {
    const clock = new FakeClock(0);
    clock.schedule(() => {}, 50);
    const snap = clock.getPending();
    clock.schedule(() => {}, 100);
    assert.equal(snap.length, 1);
  });
});

describe('FakeClock – flush', () => {
  it('runs all callbacks <= current time', () => {
    const clock = new FakeClock(100);
    let count = 0;
    clock.schedule(() => count++, 50);
    clock.schedule(() => count++, 100);
    clock.schedule(() => count++, 150); // in the future
    clock.flush();
    assert.equal(count, 2);
  });

  it('removes flushed callbacks from pending', () => {
    const clock = new FakeClock(100);
    clock.schedule(() => {}, 100);
    clock.flush();
    assert.equal(clock.getPending().length, 0);
  });

  it('flush on empty pending is safe', () => {
    const clock = new FakeClock(0);
    assert.doesNotThrow(() => clock.flush());
  });

  it('flush runs callbacks in chronological order', () => {
    const clock = new FakeClock(100);
    const order = [];
    clock.schedule(() => order.push(2), 20);
    clock.schedule(() => order.push(1), 10);
    clock.schedule(() => order.push(3), 30);
    clock.flush();
    assert.deepEqual(order, [1, 2, 3]);
  });
});

describe('FakeClock – Date proxy', () => {
  it('Date.now() returns fake time', () => {
    const clock = new FakeClock(42000);
    assert.equal(clock.Date.now(), 42000);
  });

  it('Date.now() advances with tick', () => {
    const clock = new FakeClock(0);
    clock.tick(500);
    assert.equal(clock.Date.now(), 500);
  });

  it('new Date() uses fake time', () => {
    const clock = new FakeClock(1_000_000);
    const d = new clock.Date();
    assert.equal(d.getTime(), 1_000_000);
  });

  it('new Date(explicit) still works', () => {
    const clock = new FakeClock(0);
    const d = new clock.Date(9999);
    assert.equal(d.getTime(), 9999);
  });
});

// ─── Stopwatch ───────────────────────────────────────────────────────────────

describe('Stopwatch – initial state', () => {
  it('elapsed is 0 before start', () => {
    const sw = new Stopwatch();
    assert.equal(sw.elapsed, 0);
  });

  it('isRunning is false before start', () => {
    const sw = new Stopwatch();
    assert.equal(sw.isRunning, false);
  });

  it('getLaps returns empty array initially', () => {
    const sw = new Stopwatch();
    assert.deepEqual(sw.getLaps(), []);
  });
});

describe('Stopwatch – start/stop', () => {
  it('isRunning is true after start', () => {
    const sw = new Stopwatch();
    sw.start();
    assert.equal(sw.isRunning, true);
    sw.stop();
  });

  it('isRunning is false after stop', () => {
    const sw = new Stopwatch();
    sw.start();
    sw.stop();
    assert.equal(sw.isRunning, false);
  });

  it('stop returns elapsed ms', async () => {
    const sw = new Stopwatch();
    sw.start();
    // A tiny sleep so elapsed > 0 (typically).
    await new Promise((r) => globalThis.setTimeout(r, 20));
    const elapsed = sw.stop();
    assert.ok(typeof elapsed === 'number');
    assert.ok(elapsed >= 0);
  });

  it('stop() without start returns 0', () => {
    const sw = new Stopwatch();
    assert.equal(sw.stop(), 0);
  });
});

describe('Stopwatch – elapsed', () => {
  it('elapsed increases while running', async () => {
    const sw = new Stopwatch();
    sw.start();
    const e1 = sw.elapsed;
    await new Promise((r) => globalThis.setTimeout(r, 20));
    const e2 = sw.elapsed;
    assert.ok(e2 >= e1, `expected e2 (${e2}) >= e1 (${e1})`);
    sw.stop();
  });

  it('elapsed is fixed after stop', async () => {
    const sw = new Stopwatch();
    sw.start();
    await new Promise((r) => globalThis.setTimeout(r, 10));
    sw.stop();
    const e1 = sw.elapsed;
    await new Promise((r) => globalThis.setTimeout(r, 20));
    const e2 = sw.elapsed;
    assert.equal(e1, e2);
  });
});

describe('Stopwatch – reset', () => {
  it('reset clears elapsed', () => {
    const sw = new Stopwatch();
    sw.start();
    sw.stop();
    sw.reset();
    assert.equal(sw.elapsed, 0);
  });

  it('reset sets isRunning to false', () => {
    const sw = new Stopwatch();
    sw.start();
    sw.reset();
    assert.equal(sw.isRunning, false);
  });

  it('reset clears laps', () => {
    const sw = new Stopwatch();
    sw.start();
    sw.lap();
    sw.reset();
    assert.deepEqual(sw.getLaps(), []);
  });
});

describe('Stopwatch – lap', () => {
  it('lap returns a non-negative number while running', async () => {
    const sw = new Stopwatch();
    sw.start();
    await new Promise((r) => globalThis.setTimeout(r, 10));
    const lapTime = sw.lap();
    assert.ok(lapTime >= 0);
    sw.stop();
  });

  it('lap records each lap duration', async () => {
    const sw = new Stopwatch();
    sw.start();
    await new Promise((r) => globalThis.setTimeout(r, 10));
    sw.lap();
    await new Promise((r) => globalThis.setTimeout(r, 10));
    sw.lap();
    const laps = sw.getLaps();
    assert.equal(laps.length, 2);
    assert.ok(laps.every((l) => l >= 0));
    sw.stop();
  });

  it('lap without start returns 0', () => {
    const sw = new Stopwatch();
    assert.equal(sw.lap(), 0);
  });

  it('getLaps returns a copy (mutating it does not affect stopwatch)', () => {
    const sw = new Stopwatch();
    sw.start();
    sw.lap();
    const laps = sw.getLaps();
    laps.push(9999);
    assert.equal(sw.getLaps().length, 1);
    sw.stop();
  });
});
