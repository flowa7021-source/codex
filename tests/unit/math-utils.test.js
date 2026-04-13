// ─── Unit Tests: math-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp,
  lerp,
  inverseLerp,
  mapRange,
  roundTo,
  approxEqual,
  gcd,
  lcm,
  isPowerOfTwo,
  nextPowerOfTwo,
  degToRad,
  radToDeg,
  mod,
  average,
  median,
  stdDev,
} from '../../app/modules/math-utils.js';

// ─── clamp() ─────────────────────────────────────────────────────────────────

describe('clamp()', () => {
  it('returns min when value is below range', () => {
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(0, 1, 5), 1);
  });

  it('returns max when value is above range', () => {
    assert.equal(clamp(15, 0, 10), 10);
    assert.equal(clamp(100, -5, 5), 5);
  });

  it('returns value when within range', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(0, -1, 1), 0);
  });

  it('returns min/max when value equals boundary', () => {
    assert.equal(clamp(0, 0, 10), 0);
    assert.equal(clamp(10, 0, 10), 10);
  });
});

// ─── lerp() ──────────────────────────────────────────────────────────────────

describe('lerp()', () => {
  it('returns a when t = 0', () => {
    assert.equal(lerp(5, 15, 0), 5);
    assert.equal(lerp(-10, 10, 0), -10);
  });

  it('returns b when t = 1', () => {
    assert.equal(lerp(5, 15, 1), 15);
    assert.equal(lerp(-10, 10, 1), 10);
  });

  it('returns midpoint when t = 0.5', () => {
    assert.equal(lerp(0, 10, 0.5), 5);
    assert.equal(lerp(4, 8, 0.5), 6);
  });

  it('handles negative ranges', () => {
    assert.equal(lerp(-20, -10, 0.5), -15);
  });
});

// ─── inverseLerp() ───────────────────────────────────────────────────────────

describe('inverseLerp()', () => {
  it('returns 0 when value equals a', () => {
    assert.equal(inverseLerp(0, 10, 0), 0);
    assert.equal(inverseLerp(5, 15, 5), 0);
  });

  it('returns 1 when value equals b', () => {
    assert.equal(inverseLerp(0, 10, 10), 1);
    assert.equal(inverseLerp(5, 15, 15), 1);
  });

  it('returns 0.5 for midpoint value', () => {
    assert.equal(inverseLerp(0, 100, 50), 0.5);
  });

  it('returns 0 when a equals b (no division by zero)', () => {
    assert.equal(inverseLerp(5, 5, 5), 0);
  });
});

// ─── mapRange() ──────────────────────────────────────────────────────────────

describe('mapRange()', () => {
  it('maps 0–100 to 0–1 correctly', () => {
    assert.equal(mapRange(50, 0, 100, 0, 1), 0.5);
    assert.equal(mapRange(0, 0, 100, 0, 1), 0);
    assert.equal(mapRange(100, 0, 100, 0, 1), 1);
  });

  it('maps to a different output range', () => {
    assert.equal(mapRange(5, 0, 10, 0, 100), 50);
    assert.equal(mapRange(0, 0, 10, -5, 5), -5);
    assert.equal(mapRange(10, 0, 10, -5, 5), 5);
  });

  it('maps values outside input range (no clamping)', () => {
    // mapRange itself doesn't clamp; t can exceed [0,1]
    assert.equal(mapRange(200, 0, 100, 0, 1), 2);
  });
});

// ─── roundTo() ───────────────────────────────────────────────────────────────

describe('roundTo()', () => {
  it('rounds to 0 decimal places', () => {
    assert.equal(roundTo(3.7, 0), 4);
    assert.equal(roundTo(3.2, 0), 3);
  });

  it('rounds to 2 decimal places', () => {
    assert.equal(roundTo(3.14159, 2), 3.14);
    assert.equal(roundTo(1.125, 2), 1.13);
  });

  it('rounds to 3 decimal places', () => {
    assert.equal(roundTo(2.71828, 3), 2.718);
  });

  it('rounds negative numbers correctly', () => {
    assert.equal(roundTo(-1.567, 2), -1.57);
  });

  it('returns unchanged value when already at desired precision', () => {
    assert.equal(roundTo(5.25, 2), 5.25);
  });
});

// ─── approxEqual() ───────────────────────────────────────────────────────────

describe('approxEqual()', () => {
  it('returns true when values are exactly equal', () => {
    assert.ok(approxEqual(1, 1));
    assert.ok(approxEqual(0, 0));
    assert.ok(approxEqual(-3.5, -3.5));
  });

  it('returns true when difference is within default epsilon (1e-9)', () => {
    assert.ok(approxEqual(1, 1 + 1e-10));
    assert.ok(approxEqual(0, 1e-12));
  });

  it('returns false when difference exceeds default epsilon', () => {
    assert.ok(!approxEqual(1, 1.001));
    assert.ok(!approxEqual(0, 1e-8));
  });

  it('respects a custom epsilon', () => {
    assert.ok(approxEqual(1, 1.05, 0.1));
    assert.ok(!approxEqual(1, 1.2, 0.1));
  });
});

// ─── gcd() ───────────────────────────────────────────────────────────────────

describe('gcd()', () => {
  it('computes gcd(12, 8) = 4', () => {
    assert.equal(gcd(12, 8), 4);
  });

  it('computes gcd(100, 75) = 25', () => {
    assert.equal(gcd(100, 75), 25);
  });

  it('returns the number itself when other is 0', () => {
    assert.equal(gcd(7, 0), 7);
    assert.equal(gcd(0, 5), 5);
  });

  it('returns 0 for gcd(0, 0)', () => {
    assert.equal(gcd(0, 0), 0);
  });

  it('handles negative inputs', () => {
    assert.equal(gcd(-12, 8), 4);
    assert.equal(gcd(12, -8), 4);
  });

  it('returns 1 for coprime numbers', () => {
    assert.equal(gcd(13, 7), 1);
  });
});

// ─── lcm() ───────────────────────────────────────────────────────────────────

describe('lcm()', () => {
  it('computes lcm(4, 6) = 12', () => {
    assert.equal(lcm(4, 6), 12);
  });

  it('computes lcm(3, 5) = 15', () => {
    assert.equal(lcm(3, 5), 15);
  });

  it('returns 0 when either argument is 0', () => {
    assert.equal(lcm(0, 5), 0);
    assert.equal(lcm(4, 0), 0);
    assert.equal(lcm(0, 0), 0);
  });

  it('handles negative inputs', () => {
    assert.equal(lcm(-4, 6), 12);
    assert.equal(lcm(4, -6), 12);
  });
});

// ─── isPowerOfTwo() ──────────────────────────────────────────────────────────

describe('isPowerOfTwo()', () => {
  it('returns true for powers of 2', () => {
    assert.ok(isPowerOfTwo(1));
    assert.ok(isPowerOfTwo(2));
    assert.ok(isPowerOfTwo(4));
    assert.ok(isPowerOfTwo(8));
    assert.ok(isPowerOfTwo(16));
    assert.ok(isPowerOfTwo(1024));
  });

  it('returns false for 0', () => {
    assert.ok(!isPowerOfTwo(0));
  });

  it('returns false for non-powers-of-2', () => {
    assert.ok(!isPowerOfTwo(3));
    assert.ok(!isPowerOfTwo(5));
    assert.ok(!isPowerOfTwo(6));
    assert.ok(!isPowerOfTwo(7));
    assert.ok(!isPowerOfTwo(100));
  });

  it('returns false for negative numbers', () => {
    assert.ok(!isPowerOfTwo(-1));
    assert.ok(!isPowerOfTwo(-4));
  });
});

// ─── nextPowerOfTwo() ────────────────────────────────────────────────────────

describe('nextPowerOfTwo()', () => {
  it('returns 1 for n = 1', () => {
    assert.equal(nextPowerOfTwo(1), 1);
  });

  it('returns 1 for n ≤ 0', () => {
    assert.equal(nextPowerOfTwo(0), 1);
    assert.equal(nextPowerOfTwo(-5), 1);
  });

  it('returns 8 for n = 5', () => {
    assert.equal(nextPowerOfTwo(5), 8);
  });

  it('returns 16 for n = 9', () => {
    assert.equal(nextPowerOfTwo(9), 16);
  });

  it('returns exact power of 2 when n is already a power', () => {
    assert.equal(nextPowerOfTwo(4), 4);
    assert.equal(nextPowerOfTwo(16), 16);
  });

  it('returns 4 for n = 3', () => {
    assert.equal(nextPowerOfTwo(3), 4);
  });
});

// ─── degToRad() / radToDeg() ─────────────────────────────────────────────────

describe('degToRad()', () => {
  it('converts 0° to 0 rad', () => {
    assert.equal(degToRad(0), 0);
  });

  it('converts 180° to π rad', () => {
    assert.ok(approxEqual(degToRad(180), Math.PI));
  });

  it('converts 360° to 2π rad', () => {
    assert.ok(approxEqual(degToRad(360), 2 * Math.PI));
  });

  it('converts 90° to π/2 rad', () => {
    assert.ok(approxEqual(degToRad(90), Math.PI / 2));
  });
});

describe('radToDeg()', () => {
  it('converts 0 rad to 0°', () => {
    assert.equal(radToDeg(0), 0);
  });

  it('converts π rad to 180°', () => {
    assert.ok(approxEqual(radToDeg(Math.PI), 180));
  });

  it('converts 2π rad to 360°', () => {
    assert.ok(approxEqual(radToDeg(2 * Math.PI), 360));
  });
});

describe('degToRad / radToDeg round-trip', () => {
  it('round-trips 45°', () => {
    assert.ok(approxEqual(radToDeg(degToRad(45)), 45));
  });

  it('round-trips 270°', () => {
    assert.ok(approxEqual(radToDeg(degToRad(270)), 270));
  });

  it('round-trips arbitrary value', () => {
    const deg = 123.456;
    assert.ok(approxEqual(radToDeg(degToRad(deg)), deg));
  });
});

// ─── mod() ───────────────────────────────────────────────────────────────────

describe('mod()', () => {
  it('behaves like % for positive numbers', () => {
    assert.equal(mod(10, 3), 1);
    assert.equal(mod(7, 4), 3);
  });

  it('always returns a positive result for negative dividend', () => {
    assert.equal(mod(-1, 5), 4);
    assert.equal(mod(-7, 3), 2);
    assert.equal(mod(-10, 4), 2);
  });

  it('returns 0 when evenly divisible', () => {
    assert.equal(mod(12, 4), 0);
    assert.equal(mod(-12, 4), 0);
  });
});

// ─── average() ───────────────────────────────────────────────────────────────

describe('average()', () => {
  it('computes average of [1, 2, 3, 4, 5] = 3', () => {
    assert.equal(average([1, 2, 3, 4, 5]), 3);
  });

  it('computes average of [10, 20] = 15', () => {
    assert.equal(average([10, 20]), 15);
  });

  it('returns the value itself for a single-element array', () => {
    assert.equal(average([7]), 7);
  });

  it('returns NaN for an empty array', () => {
    assert.ok(Number.isNaN(average([])));
  });

  it('handles negative numbers', () => {
    assert.equal(average([-5, 5]), 0);
  });
});

// ─── median() ────────────────────────────────────────────────────────────────

describe('median()', () => {
  it('returns the middle value for odd-length arrays', () => {
    assert.equal(median([1, 2, 3]), 2);
    assert.equal(median([5, 1, 3]), 3);      // unsorted input
    assert.equal(median([7]), 7);
  });

  it('returns average of two middle values for even-length arrays', () => {
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([10, 20]), 15);
  });

  it('returns NaN for an empty array', () => {
    assert.ok(Number.isNaN(median([])));
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    median(input);
    assert.deepEqual(input, [3, 1, 2]);
  });

  it('handles negative numbers', () => {
    assert.equal(median([-3, -1, -2]), -2);
  });
});

// ─── stdDev() ────────────────────────────────────────────────────────────────

describe('stdDev()', () => {
  it('returns 0 for a uniform array', () => {
    assert.equal(stdDev([5, 5, 5, 5]), 0);
    assert.equal(stdDev([0, 0, 0]), 0);
  });

  it('returns 0 for a single-element array', () => {
    assert.equal(stdDev([42]), 0);
  });

  it('returns NaN for an empty array', () => {
    assert.ok(Number.isNaN(stdDev([])));
  });

  it('returns > 0 for varied arrays', () => {
    assert.ok(stdDev([1, 2, 3, 4, 5]) > 0);
    assert.ok(stdDev([0, 100]) > 0);
  });

  it('computes stdDev([2, 4, 4, 4, 5, 5, 7, 9]) ≈ 2', () => {
    // Population stdDev of this well-known dataset is exactly 2
    assert.ok(approxEqual(stdDev([2, 4, 4, 4, 5, 5, 7, 9]), 2, 1e-6));
  });
});
