// ─── Unit Tests: Telemetry ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Telemetry } from '../../app/modules/telemetry.js';

// ─── startTimer / stop ───────────────────────────────────────────────────────

describe('Telemetry – startTimer / stop', () => {
  it('records a timing entry with duration >= 0', () => {
    const t = new Telemetry();
    const stop = t.startTimer('load');
    const entry = stop();
    assert.equal(entry.name, 'load');
    assert.ok(typeof entry.startTime === 'number');
    assert.ok(typeof entry.endTime === 'number');
    assert.ok(entry.duration >= 0);
    assert.ok(entry.endTime >= entry.startTime);
  });

  it('duration is > 0 for a non-trivial operation', async () => {
    const t = new Telemetry();
    const stop = t.startTimer('pause');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const entry = stop();
    assert.ok(entry.duration > 0);
  });

  it('records metadata in the timing entry', () => {
    const t = new Telemetry();
    const stop = t.startTimer('op', { page: 5, format: 'pdf' });
    const entry = stop();
    assert.deepEqual(entry.metadata, { page: 5, format: 'pdf' });
  });

  it('entry has no metadata key when metadata not provided', () => {
    const t = new Telemetry();
    const stop = t.startTimer('bare');
    const entry = stop();
    assert.equal(Object.prototype.hasOwnProperty.call(entry, 'metadata'), false);
  });

  it('stop function records timing into getTimings()', () => {
    const t = new Telemetry();
    const stop = t.startTimer('alpha');
    stop();
    const timings = t.getTimings();
    assert.equal(timings.length, 1);
    assert.equal(timings[0].name, 'alpha');
  });

  it('multiple timers accumulate independently', () => {
    const t = new Telemetry();
    const s1 = t.startTimer('a');
    const s2 = t.startTimer('b');
    s2();
    s1();
    assert.equal(t.getTimings().length, 2);
  });
});

// ─── time() — async ───────────────────────────────────────────────────────────

describe('Telemetry – time() async', () => {
  it('times an async operation and returns its result', async () => {
    const t = new Telemetry();
    const result = await t.time('fetch', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 42;
    });
    assert.equal(result, 42);
    const timings = t.getTimings();
    assert.equal(timings.length, 1);
    assert.equal(timings[0].name, 'fetch');
    assert.ok(timings[0].duration > 0);
  });

  it('records timing even when the async fn resolves immediately', async () => {
    const t = new Telemetry();
    await t.time('instant', async () => 'done');
    assert.equal(t.getTimings().length, 1);
  });

  it('records metadata for async operation', async () => {
    const t = new Telemetry();
    await t.time('op', async () => {}, { tag: 'async' });
    assert.deepEqual(t.getTimings()[0].metadata, { tag: 'async' });
  });

  it('re-throws when async fn throws', async () => {
    const t = new Telemetry();
    await assert.rejects(
      () => t.time('boom', async () => { throw new Error('fail'); }),
      /fail/,
    );
  });
});

// ─── timeSync() ───────────────────────────────────────────────────────────────

describe('Telemetry – timeSync()', () => {
  it('times a sync operation and returns its result', () => {
    const t = new Telemetry();
    const result = t.timeSync('compute', () => 99);
    assert.equal(result, 99);
    assert.equal(t.getTimings().length, 1);
    assert.equal(t.getTimings()[0].name, 'compute');
  });

  it('duration >= 0', () => {
    const t = new Telemetry();
    t.timeSync('noop', () => {});
    assert.ok(t.getTimings()[0].duration >= 0);
  });

  it('records metadata for sync operation', () => {
    const t = new Telemetry();
    t.timeSync('op', () => {}, { sync: true });
    assert.deepEqual(t.getTimings()[0].metadata, { sync: true });
  });

  it('re-throws when sync fn throws', () => {
    const t = new Telemetry();
    assert.throws(
      () => t.timeSync('err', () => { throw new Error('sync-fail'); }),
      /sync-fail/,
    );
  });
});

// ─── increment ────────────────────────────────────────────────────────────────

describe('Telemetry – increment', () => {
  it('increments counter from 0 by 1 by default', () => {
    const t = new Telemetry();
    t.increment('requests');
    assert.equal(t.getCounter('requests'), 1);
  });

  it('increments by a custom amount', () => {
    const t = new Telemetry();
    t.increment('bytes', 1024);
    assert.equal(t.getCounter('bytes'), 1024);
  });

  it('accumulates multiple increments', () => {
    const t = new Telemetry();
    t.increment('hits');
    t.increment('hits');
    t.increment('hits', 3);
    assert.equal(t.getCounter('hits'), 5);
  });

  it('does not affect other counters', () => {
    const t = new Telemetry();
    t.increment('a', 10);
    t.increment('b', 5);
    assert.equal(t.getCounter('a'), 10);
    assert.equal(t.getCounter('b'), 5);
  });
});

// ─── decrement ────────────────────────────────────────────────────────────────

describe('Telemetry – decrement', () => {
  it('decrements counter by 1 by default', () => {
    const t = new Telemetry();
    t.increment('stock', 10);
    t.decrement('stock');
    assert.equal(t.getCounter('stock'), 9);
  });

  it('decrements by a custom amount', () => {
    const t = new Telemetry();
    t.increment('credits', 100);
    t.decrement('credits', 25);
    assert.equal(t.getCounter('credits'), 75);
  });

  it('can go negative', () => {
    const t = new Telemetry();
    t.decrement('balance', 5);
    assert.equal(t.getCounter('balance'), -5);
  });
});

// ─── gauge ────────────────────────────────────────────────────────────────────

describe('Telemetry – gauge', () => {
  it('sets gauge to the given value', () => {
    const t = new Telemetry();
    t.gauge('memory', 512);
    assert.equal(t.getCounter('memory'), 512);
  });

  it('overwrites previous value', () => {
    const t = new Telemetry();
    t.gauge('cpu', 0.5);
    t.gauge('cpu', 0.9);
    assert.equal(t.getCounter('cpu'), 0.9);
  });

  it('does not accumulate like increment', () => {
    const t = new Telemetry();
    t.gauge('val', 10);
    t.gauge('val', 20);
    assert.equal(t.getCounter('val'), 20);
  });
});

// ─── getTimings ───────────────────────────────────────────────────────────────

describe('Telemetry – getTimings', () => {
  it('returns empty array when no timers recorded', () => {
    const t = new Telemetry();
    assert.deepEqual(t.getTimings(), []);
  });

  it('returns all recorded timing entries', () => {
    const t = new Telemetry();
    t.startTimer('a')();
    t.startTimer('b')();
    t.startTimer('c')();
    assert.equal(t.getTimings().length, 3);
  });

  it('returns a copy (mutation does not affect internal state)', () => {
    const t = new Telemetry();
    t.startTimer('x')();
    const timings = t.getTimings();
    timings.push({ name: 'injected', startTime: 0, endTime: 0, duration: 0 });
    assert.equal(t.getTimings().length, 1);
  });
});

// ─── getCounters ─────────────────────────────────────────────────────────────

describe('Telemetry – getCounters', () => {
  it('returns empty array when no counters set', () => {
    const t = new Telemetry();
    assert.deepEqual(t.getCounters(), []);
  });

  it('returns one entry per named counter', () => {
    const t = new Telemetry();
    t.increment('a');
    t.increment('b');
    t.increment('a');
    const counters = t.getCounters();
    assert.equal(counters.length, 2);
    const names = counters.map((c) => c.name).sort();
    assert.deepEqual(names, ['a', 'b']);
  });

  it('each entry has the latest value', () => {
    const t = new Telemetry();
    t.increment('n', 3);
    t.increment('n', 7);
    const counters = t.getCounters();
    assert.equal(counters[0].value, 10);
  });

  it('returns a copy (mutation does not affect internal state)', () => {
    const t = new Telemetry();
    t.increment('x');
    const counters = t.getCounters();
    counters.push({ name: 'injected', value: 99 });
    assert.equal(t.getCounters().length, 1);
  });
});

// ─── getCounter ───────────────────────────────────────────────────────────────

describe('Telemetry – getCounter', () => {
  it('returns 0 for a counter that was never set', () => {
    const t = new Telemetry();
    assert.equal(t.getCounter('unknown'), 0);
  });

  it('returns the current value for a known counter', () => {
    const t = new Telemetry();
    t.increment('seen', 7);
    assert.equal(t.getCounter('seen'), 7);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('Telemetry – clear', () => {
  it('removes all timings', () => {
    const t = new Telemetry();
    t.startTimer('a')();
    t.startTimer('b')();
    t.clear();
    assert.deepEqual(t.getTimings(), []);
  });

  it('removes all counters', () => {
    const t = new Telemetry();
    t.increment('x');
    t.gauge('y', 5);
    t.clear();
    assert.deepEqual(t.getCounters(), []);
    assert.equal(t.getCounter('x'), 0);
    assert.equal(t.getCounter('y'), 0);
  });

  it('can record new data after clear', () => {
    const t = new Telemetry();
    t.startTimer('first')();
    t.increment('count', 5);
    t.clear();

    t.startTimer('second')();
    t.increment('count', 2);
    assert.equal(t.getTimings().length, 1);
    assert.equal(t.getTimings()[0].name, 'second');
    assert.equal(t.getCounter('count'), 2);
  });
});
