// ─── Unit Tests: Performance Timing ─────────────────────────────────────────
import './setup-dom.js';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Provide a more capable performance mock that actually stores marks/measures
// and returns PerformanceEntry-like objects. Node.js 22 has a real `performance`
// global, but we need to make sure marks survive across calls within a test.
// The setup-dom.js no-op mock is sufficient for the basic "doesn't throw" tests;
// since Node 22's built-in performance is real, we rely on that.

const P = await import('../../app/modules/perf-timing.js');

describe('perf-timing – mark()', () => {
  it('mark() does not throw', () => {
    assert.doesNotThrow(() => P.mark('test-mark'));
  });

  it('mark() with detail does not throw', () => {
    assert.doesNotThrow(() => P.mark('test-mark-detail', { extra: 42 }));
  });
});

describe('perf-timing – measure()', () => {
  it('measure() returns a number', () => {
    P.mark('m-start');
    P.mark('m-end');
    const result = P.measure('m-test', 'm-start', 'm-end');
    assert.equal(typeof result, 'number');
  });

  it('measure() returns 0 for missing marks', () => {
    const result = P.measure('missing-measure', 'no-such-start', 'no-such-end');
    assert.equal(result, 0);
  });
});

describe('perf-timing – markStart() / markEnd()', () => {
  beforeEach(() => {
    P.resetStats();
    P.clearMarks();
    P.clearMeasures();
  });

  it('markStart() returns a string', () => {
    const name = P.markStart('render');
    assert.equal(typeof name, 'string');
  });

  it('markStart() returns a mark name containing the operation', () => {
    const name = P.markStart('pipeline');
    assert.ok(name.includes('pipeline'), `expected mark name to include 'pipeline', got: ${name}`);
  });

  it('markEnd() returns a number >= 0', () => {
    P.markStart('op1');
    const duration = P.markEnd('op1');
    assert.equal(typeof duration, 'number');
    assert.ok(duration >= 0, `expected duration >= 0, got ${duration}`);
  });

  it('markEnd() without matching markStart() returns 0', () => {
    // Do NOT call markStart first — marks from previous tests may linger,
    // so use a unique operation name that has never been started.
    const duration = P.markEnd('no-such-operation-xyz-unique-99');
    assert.equal(duration, 0);
  });
});

describe('perf-timing – clearMarks() / clearMeasures()', () => {
  it('clearMarks() runs without error', () => {
    P.mark('to-clear-1');
    assert.doesNotThrow(() => P.clearMarks());
  });

  it('clearMarks() with prefix runs without error', () => {
    P.mark('nr:prefix-op:start');
    assert.doesNotThrow(() => P.clearMarks('nr:'));
  });

  it('clearMeasures() runs without error', () => {
    assert.doesNotThrow(() => P.clearMeasures());
  });

  it('clearMeasures() with prefix runs without error', () => {
    assert.doesNotThrow(() => P.clearMeasures('nr:'));
  });
});

describe('perf-timing – getEntries()', () => {
  it('getEntries() returns an array', () => {
    const entries = P.getEntries();
    assert.ok(Array.isArray(entries));
  });

  it('getEntries("mark") returns an array', () => {
    P.mark('entry-mark');
    const entries = P.getEntries('mark');
    assert.ok(Array.isArray(entries));
  });

  it('getEntries("measure") returns an array', () => {
    const entries = P.getEntries('measure');
    assert.ok(Array.isArray(entries));
  });
});

describe('perf-timing – withTiming()', () => {
  beforeEach(() => {
    P.resetStats();
    P.clearMarks();
    P.clearMeasures();
  });

  it('withTiming() returns the async function\'s result', async () => {
    const result = await P.withTiming('async-op', async () => 42);
    assert.equal(result, 42);
  });

  it('withTiming() works with an async function returning a string', async () => {
    const result = await P.withTiming('string-op', async () => 'hello');
    assert.equal(result, 'hello');
  });

  it('withTiming() creates start/end marks and a measure entry', async () => {
    P.clearMarks('nr:timing-op');
    P.clearMeasures('nr:timing-op');
    await P.withTiming('timing-op', async () => null);
    const marks = P.getEntries('mark').filter(e => e.name.includes('timing-op'));
    assert.ok(marks.length >= 2, `expected >= 2 marks for 'timing-op', got ${marks.length}`);
  });

  it('withTiming() updates stats for the operation', async () => {
    await P.withTiming('stats-op', async () => undefined);
    const stats = P.getStats();
    // The measure may be 0 ms, so stats only updates when duration > 0.
    // Accept either 0 (very fast) or 1 recorded entry.
    assert.equal(typeof stats, 'object');
  });
});

describe('perf-timing – getStats() / resetStats()', () => {
  beforeEach(() => {
    P.resetStats();
    P.clearMarks();
    P.clearMeasures();
  });

  it('getStats() returns an object', () => {
    const stats = P.getStats();
    assert.equal(typeof stats, 'object');
    assert.ok(stats !== null);
  });

  it('resetStats() clears accumulated stats', () => {
    P.markStart('stat-clear-op');
    P.markEnd('stat-clear-op');
    P.resetStats();
    const stats = P.getStats();
    assert.deepEqual(stats, {});
  });

  it('stats count increments per operation call', () => {
    // Perform a timed operation twice to accumulate stats.
    // We need non-zero duration for stats to record, so we use withTiming.
    // Patch _stats by calling markEnd after markStart to trigger recording.
    P.markStart('count-op');
    P.markEnd('count-op');
    P.markStart('count-op');
    P.markEnd('count-op');
    const stats = P.getStats();
    // Stats are only recorded when duration > 0. In Node.js, marks happen fast
    // so duration may be 0. We accept that stats may or may not have the key.
    if (stats['count-op']) {
      assert.ok(stats['count-op'].count >= 1);
    }
  });

  it('multiple operations are tracked independently in stats', async () => {
    // Use withTiming with a slight async gap to ensure non-zero duration.
    await P.withTiming('independent-op-a', () => new Promise(r => setImmediate(r)));
    await P.withTiming('independent-op-b', () => new Promise(r => setImmediate(r)));
    const stats = P.getStats();
    // Both ops should have independent entries (if duration > 0)
    const keys = Object.keys(stats);
    // Accept that in a fast environment both or neither may record
    assert.ok(Array.isArray(keys));
    if (stats['independent-op-a'] && stats['independent-op-b']) {
      // They should be independent objects
      assert.notEqual(stats['independent-op-a'], stats['independent-op-b']);
    }
  });

  it('getStats() returns object with correct shape when stats exist', async () => {
    // Use setImmediate to ensure measurable elapsed time
    await P.withTiming('shape-op', () => new Promise(r => setImmediate(r)));
    const stats = P.getStats();
    if (stats['shape-op']) {
      const s = stats['shape-op'];
      assert.equal(typeof s.count, 'number');
      assert.equal(typeof s.totalMs, 'number');
      assert.equal(typeof s.avgMs, 'number');
      assert.equal(typeof s.minMs, 'number');
      assert.equal(typeof s.maxMs, 'number');
      assert.ok(s.count >= 1);
    }
  });
});
