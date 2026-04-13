// ─── Unit Tests: time-series ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TimeSeries } from '../../app/modules/time-series.js';

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('TimeSeries constructor', () => {
  it('creates an empty series with no arguments', () => {
    const ts = new TimeSeries();
    assert.equal(ts.length, 0);
    assert.deepEqual(ts.data, []);
  });

  it('accepts an initial array of data points', () => {
    const ts = new TimeSeries([
      { timestamp: 100, value: 1 },
      { timestamp: 200, value: 2 },
    ]);
    assert.equal(ts.length, 2);
  });

  it('sorts initial data by timestamp', () => {
    const ts = new TimeSeries([
      { timestamp: 300, value: 3 },
      { timestamp: 100, value: 1 },
      { timestamp: 200, value: 2 },
    ]);
    const d = ts.data;
    assert.equal(d[0].timestamp, 100);
    assert.equal(d[1].timestamp, 200);
    assert.equal(d[2].timestamp, 300);
  });

  it('does not mutate the input array', () => {
    const input = [
      { timestamp: 200, value: 2 },
      { timestamp: 100, value: 1 },
    ];
    new TimeSeries(input);
    assert.equal(input[0].timestamp, 200); // unchanged
  });
});

// ─── add ─────────────────────────────────────────────────────────────────────

describe('TimeSeries#add', () => {
  it('inserts a point and maintains sorted order', () => {
    const ts = new TimeSeries([
      { timestamp: 100, value: 1 },
      { timestamp: 300, value: 3 },
    ]);
    ts.add({ timestamp: 200, value: 2 });
    const d = ts.data;
    assert.equal(d.length, 3);
    assert.equal(d[1].timestamp, 200);
  });

  it('appending at the end works correctly', () => {
    const ts = new TimeSeries([{ timestamp: 100, value: 1 }]);
    ts.add({ timestamp: 500, value: 5 });
    assert.equal(ts.length, 2);
    assert.equal(ts.data[1].timestamp, 500);
  });

  it('prepending at the start works correctly', () => {
    const ts = new TimeSeries([{ timestamp: 500, value: 5 }]);
    ts.add({ timestamp: 100, value: 1 });
    assert.equal(ts.data[0].timestamp, 100);
  });

  it('increments length', () => {
    const ts = new TimeSeries();
    ts.add({ timestamp: 1, value: 10 });
    assert.equal(ts.length, 1);
  });
});

// ─── valueAt ─────────────────────────────────────────────────────────────────

describe('TimeSeries#valueAt', () => {
  const ts = new TimeSeries([
    { timestamp: 100, value: 10 },
    { timestamp: 200, value: 20 },
    { timestamp: 400, value: 40 },
  ]);

  it('returns exact value when timestamp matches', () => {
    assert.equal(ts.valueAt(100), 10);
    assert.equal(ts.valueAt(200), 20);
    assert.equal(ts.valueAt(400), 40);
  });

  it('returns most-recent value before timestamp (no interpolation)', () => {
    assert.equal(ts.valueAt(150), 10);
    assert.equal(ts.valueAt(350), 20);
  });

  it('returns undefined when timestamp is before all points', () => {
    assert.equal(ts.valueAt(50), undefined);
  });

  it('returns undefined for empty series', () => {
    const empty = new TimeSeries();
    assert.equal(empty.valueAt(100), undefined);
  });

  it('interpolates between two points when interpolate=true', () => {
    const v = ts.valueAt(150, true);
    assert.ok(v !== undefined);
    // 150 is midway between 100 and 200 → value should be 15
    assert.ok(Math.abs(v - 15) < 1e-9);
  });

  it('interpolates at 3/4 position correctly', () => {
    // 350 is 3/4 between 200 (val=20) and 400 (val=40) → 20 + 0.75*20 = 35
    const v = ts.valueAt(350, true);
    assert.ok(v !== undefined);
    assert.ok(Math.abs(v - 35) < 1e-9);
  });

  it('returns value at last point when timestamp equals last (interpolate=true)', () => {
    assert.equal(ts.valueAt(400, true), 40);
  });
});

// ─── slice ────────────────────────────────────────────────────────────────────

describe('TimeSeries#slice', () => {
  const ts = new TimeSeries([
    { timestamp: 100, value: 1 },
    { timestamp: 200, value: 2 },
    { timestamp: 300, value: 3 },
    { timestamp: 400, value: 4 },
    { timestamp: 500, value: 5 },
  ]);

  it('returns points within [start, end] inclusive', () => {
    const sliced = ts.slice(200, 400);
    assert.equal(sliced.length, 3);
    assert.equal(sliced.data[0].timestamp, 200);
    assert.equal(sliced.data[2].timestamp, 400);
  });

  it('returns empty series when range excludes all points', () => {
    const sliced = ts.slice(600, 700);
    assert.equal(sliced.length, 0);
  });

  it('includes boundary points', () => {
    const sliced = ts.slice(100, 100);
    assert.equal(sliced.length, 1);
    assert.equal(sliced.data[0].value, 1);
  });

  it('does not modify the original series', () => {
    ts.slice(200, 300);
    assert.equal(ts.length, 5);
  });

  it('returns a new TimeSeries instance', () => {
    const sliced = ts.slice(100, 500);
    assert.ok(sliced instanceof TimeSeries);
  });
});

// ─── resample ─────────────────────────────────────────────────────────────────

describe('TimeSeries#resample', () => {
  it('produces evenly spaced timestamps', () => {
    const ts = new TimeSeries([
      { timestamp: 0, value: 0 },
      { timestamp: 100, value: 100 },
    ]);
    const resampled = ts.resample(25);
    const times = resampled.data.map((p) => p.timestamp);
    assert.deepEqual(times, [0, 25, 50, 75, 100]);
  });

  it('interpolates values correctly', () => {
    const ts = new TimeSeries([
      { timestamp: 0, value: 0 },
      { timestamp: 100, value: 100 },
    ]);
    const resampled = ts.resample(50);
    const values = resampled.data.map((p) => p.value);
    assert.ok(Math.abs(values[0] - 0) < 1e-9);
    assert.ok(Math.abs(values[1] - 50) < 1e-9);
    assert.ok(Math.abs(values[2] - 100) < 1e-9);
  });

  it('returns empty series for empty input', () => {
    const ts = new TimeSeries();
    assert.equal(ts.resample(100).length, 0);
  });

  it('returns single-point series for single-point input', () => {
    const ts = new TimeSeries([{ timestamp: 500, value: 42 }]);
    const resampled = ts.resample(100);
    assert.equal(resampled.length, 1);
    assert.equal(resampled.data[0].value, 42);
  });

  it('returns empty for interval <= 0', () => {
    const ts = new TimeSeries([
      { timestamp: 0, value: 0 },
      { timestamp: 100, value: 1 },
    ]);
    assert.equal(ts.resample(0).length, 0);
  });
});

// ─── map ──────────────────────────────────────────────────────────────────────

describe('TimeSeries#map', () => {
  it('applies a function to all values', () => {
    const ts = new TimeSeries([
      { timestamp: 100, value: 2 },
      { timestamp: 200, value: 4 },
      { timestamp: 300, value: 6 },
    ]);
    const doubled = ts.map((v) => v * 2);
    assert.deepEqual(
      doubled.data.map((p) => p.value),
      [4, 8, 12],
    );
  });

  it('passes the timestamp as the second argument', () => {
    const ts = new TimeSeries([{ timestamp: 1000, value: 5 }]);
    const result = ts.map((v, t) => v + t);
    assert.equal(result.data[0].value, 1005);
  });

  it('preserves timestamps', () => {
    const ts = new TimeSeries([
      { timestamp: 100, value: 1 },
      { timestamp: 200, value: 2 },
    ]);
    const mapped = ts.map((v) => v + 10);
    assert.equal(mapped.data[0].timestamp, 100);
    assert.equal(mapped.data[1].timestamp, 200);
  });

  it('returns a new TimeSeries instance', () => {
    const ts = new TimeSeries([{ timestamp: 1, value: 1 }]);
    const mapped = ts.map((v) => v);
    assert.ok(mapped instanceof TimeSeries);
    assert.notEqual(mapped, ts);
  });
});

// ─── stats ────────────────────────────────────────────────────────────────────

describe('TimeSeries#stats', () => {
  it('computes min, max, mean, stddev, count', () => {
    const ts = new TimeSeries([
      { timestamp: 1, value: 2 },
      { timestamp: 2, value: 4 },
      { timestamp: 3, value: 4 },
      { timestamp: 4, value: 4 },
      { timestamp: 5, value: 5 },
      { timestamp: 6, value: 5 },
      { timestamp: 7, value: 7 },
      { timestamp: 8, value: 9 },
    ]);
    const s = ts.stats();
    assert.equal(s.count, 8);
    assert.equal(s.min, 2);
    assert.equal(s.max, 9);
    assert.ok(Math.abs(s.mean - 5) < 1e-9);
    assert.ok(s.stddev > 0);
  });

  it('returns NaN for all stats on empty series', () => {
    const ts = new TimeSeries();
    const s = ts.stats();
    assert.equal(s.count, 0);
    assert.ok(Number.isNaN(s.min));
    assert.ok(Number.isNaN(s.max));
    assert.ok(Number.isNaN(s.mean));
    assert.ok(Number.isNaN(s.stddev));
  });

  it('returns stddev of 0 for a constant series', () => {
    const ts = new TimeSeries([
      { timestamp: 1, value: 5 },
      { timestamp: 2, value: 5 },
      { timestamp: 3, value: 5 },
    ]);
    const s = ts.stats();
    assert.equal(s.stddev, 0);
    assert.equal(s.mean, 5);
  });

  it('returns correct stats for a single point', () => {
    const ts = new TimeSeries([{ timestamp: 1, value: 42 }]);
    const s = ts.stats();
    assert.equal(s.count, 1);
    assert.equal(s.min, 42);
    assert.equal(s.max, 42);
    assert.equal(s.mean, 42);
    assert.equal(s.stddev, 0);
  });
});

// ─── data & length getters ───────────────────────────────────────────────────

describe('TimeSeries getters', () => {
  it('data returns a copy of the internal array', () => {
    const ts = new TimeSeries([{ timestamp: 1, value: 99 }]);
    const d1 = ts.data;
    const d2 = ts.data;
    assert.notEqual(d1, d2); // new array each time
    assert.deepEqual(d1, d2);
  });

  it('length matches the number of data points', () => {
    const ts = new TimeSeries();
    assert.equal(ts.length, 0);
    ts.add({ timestamp: 1, value: 1 });
    ts.add({ timestamp: 2, value: 2 });
    assert.equal(ts.length, 2);
  });
});
