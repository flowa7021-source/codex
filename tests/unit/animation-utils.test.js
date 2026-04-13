// ─── Unit Tests: animation-utils ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  interpolate,
  interpolateMulti,
  interpolateColor,
  clampT,
  calcT,
  frameSequence,
  pingPong,
  spring,
} from '../../app/modules/animation-utils.js';

// ─── interpolate ─────────────────────────────────────────────────────────────

describe('interpolate', () => {
  it('returns from at t=0', () => {
    assert.equal(interpolate(10, 20, 0), 10);
  });

  it('returns to at t=1', () => {
    assert.equal(interpolate(10, 20, 1), 20);
  });

  it('returns midpoint at t=0.5', () => {
    assert.equal(interpolate(10, 20, 0.5), 15);
  });

  it('works with negative from/to values', () => {
    assert.equal(interpolate(-10, 10, 0.5), 0);
  });

  it('applies easing function to t', () => {
    // easing that squares t → interpolate(0, 100, 0.5, t => t*t) = 0 + 100 * 0.25 = 25
    const result = interpolate(0, 100, 0.5, (t) => t * t);
    assert.equal(result, 25);
  });

  it('uses linear interpolation when no easing provided', () => {
    assert.equal(interpolate(0, 100, 0.3), 30);
  });
});

// ─── interpolateMulti ────────────────────────────────────────────────────────

describe('interpolateMulti', () => {
  it('interpolates all values at t=0', () => {
    assert.deepEqual(interpolateMulti([0, 10, 20], [100, 110, 120], 0), [0, 10, 20]);
  });

  it('interpolates all values at t=1', () => {
    assert.deepEqual(interpolateMulti([0, 10, 20], [100, 110, 120], 1), [100, 110, 120]);
  });

  it('interpolates all values at t=0.5', () => {
    assert.deepEqual(interpolateMulti([0, 0, 0], [100, 200, 400], 0.5), [50, 100, 200]);
  });

  it('stops at shorter array length', () => {
    const result = interpolateMulti([0, 0, 0], [10, 20], 1);
    assert.equal(result.length, 2);
    assert.deepEqual(result, [10, 20]);
  });

  it('applies easing to all channels', () => {
    // easing t => t*t, so at t=0.5 easedT=0.25
    const result = interpolateMulti([0, 0], [100, 200], 0.5, (t) => t * t);
    assert.equal(result[0], 25);
    assert.equal(result[1], 50);
  });

  it('returns empty array for empty inputs', () => {
    assert.deepEqual(interpolateMulti([], [], 0.5), []);
  });
});

// ─── interpolateColor ────────────────────────────────────────────────────────

describe('interpolateColor', () => {
  it('returns from color at t=0', () => {
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 255, b: 0 };
    assert.deepEqual(interpolateColor(from, to, 0), { r: 255, g: 0, b: 0 });
  });

  it('returns to color at t=1', () => {
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 255, b: 0 };
    assert.deepEqual(interpolateColor(from, to, 1), { r: 0, g: 255, b: 0 });
  });

  it('returns midpoint color at t=0.5', () => {
    const from = { r: 0, g: 0, b: 0 };
    const to = { r: 200, g: 100, b: 50 };
    assert.deepEqual(interpolateColor(from, to, 0.5), { r: 100, g: 50, b: 25 });
  });

  it('rounds channel values to integers', () => {
    const from = { r: 0, g: 0, b: 0 };
    const to = { r: 1, g: 1, b: 1 };
    const result = interpolateColor(from, to, 0.4);
    assert.ok(Number.isInteger(result.r));
    assert.ok(Number.isInteger(result.g));
    assert.ok(Number.isInteger(result.b));
  });
});

// ─── clampT ──────────────────────────────────────────────────────────────────

describe('clampT', () => {
  it('returns t unchanged when in [0,1]', () => {
    assert.equal(clampT(0), 0);
    assert.equal(clampT(0.5), 0.5);
    assert.equal(clampT(1), 1);
  });

  it('clamps negative values to 0', () => {
    assert.equal(clampT(-1), 0);
    assert.equal(clampT(-0.001), 0);
  });

  it('clamps values above 1 to 1', () => {
    assert.equal(clampT(2), 1);
    assert.equal(clampT(1.001), 1);
  });
});

// ─── calcT ───────────────────────────────────────────────────────────────────

describe('calcT', () => {
  it('returns 0 at elapsed=0', () => {
    assert.equal(calcT(0, 1000), 0);
  });

  it('returns 1 at elapsed=duration', () => {
    assert.equal(calcT(1000, 1000), 1);
  });

  it('returns 0.5 at half elapsed time', () => {
    assert.equal(calcT(500, 1000), 0.5);
  });

  it('clamps to 1 when elapsed exceeds duration', () => {
    assert.equal(calcT(2000, 1000), 1);
  });

  it('clamps to 0 when elapsed is negative', () => {
    assert.equal(calcT(-100, 1000), 0);
  });

  it('returns 1 immediately when duration is 0', () => {
    assert.equal(calcT(0, 0), 1);
  });

  it('returns 1 when duration is negative', () => {
    assert.equal(calcT(500, -1), 1);
  });
});

// ─── frameSequence ───────────────────────────────────────────────────────────

describe('frameSequence', () => {
  it('returns empty array for 0 frames', () => {
    assert.deepEqual(frameSequence(0, 1000), []);
  });

  it('returns [0] for 1 frame', () => {
    assert.deepEqual(frameSequence(1, 1000), [0]);
  });

  it('returns [0, duration] for 2 frames', () => {
    assert.deepEqual(frameSequence(2, 1000), [0, 1000]);
  });

  it('returns evenly spaced timestamps for 5 frames over 1000ms', () => {
    const seq = frameSequence(5, 1000);
    assert.equal(seq.length, 5);
    assert.equal(seq[0], 0);
    assert.equal(seq[4], 1000);
    assert.ok(Math.abs(seq[2] - 500) < 1e-9);
  });

  it('starts at 0 and ends at duration', () => {
    const seq = frameSequence(10, 500);
    assert.equal(seq[0], 0);
    assert.equal(seq[9], 500);
  });
});

// ─── pingPong ────────────────────────────────────────────────────────────────

describe('pingPong', () => {
  it('returns 0 at t=0', () => {
    assert.equal(pingPong(0), 0);
  });

  it('returns 1 at t=0.5', () => {
    assert.equal(pingPong(0.5), 1);
  });

  it('returns 0 at t=1', () => {
    assert.ok(Math.abs(pingPong(1)) < 1e-9);
  });

  it('returns 0.5 at t=0.25', () => {
    assert.ok(Math.abs(pingPong(0.25) - 0.5) < 1e-9);
  });

  it('returns 0.5 at t=0.75', () => {
    assert.ok(Math.abs(pingPong(0.75) - 0.5) < 1e-9);
  });
});

// ─── spring ──────────────────────────────────────────────────────────────────

describe('spring', () => {
  it('returns 0 at t=0', () => {
    assert.equal(spring(0), 0);
  });

  it('returns 1 at t=1', () => {
    assert.equal(spring(1), 1);
  });

  it('returns a value strictly between 0 and 1 for t in (0,1)', () => {
    const v = spring(0.5);
    assert.ok(v > 0 && v < 1);
  });

  it('is monotonically increasing', () => {
    const t1 = spring(0.3);
    const t2 = spring(0.6);
    assert.ok(t1 < t2);
  });

  it('clamps to 0 below t=0', () => {
    assert.equal(spring(-1), 0);
  });

  it('clamps to 1 above t=1', () => {
    assert.equal(spring(2), 1);
  });

  it('higher stiffness reaches target faster', () => {
    const slow = spring(0.3, 2, 1);
    const fast = spring(0.3, 20, 1);
    assert.ok(fast > slow);
  });
});
