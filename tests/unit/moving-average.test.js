// ─── Unit Tests: moving-average ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sma,
  ema,
  wma,
  cma,
  bollingerBands,
  macd,
  rsi,
  rollingStdDev,
} from '../../app/modules/moving-average.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Assert two numbers are close within epsilon. */
function assertClose(actual, expected, eps = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `Expected ${actual} ≈ ${expected} (eps=${eps})`,
  );
}

// ─── sma ──────────────────────────────────────────────────────────────────────

describe('sma', () => {
  it('computes correct simple moving averages', () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    assert.equal(result.length, 3);
    assertClose(result[0], 2);   // (1+2+3)/3
    assertClose(result[1], 3);   // (2+3+4)/3
    assertClose(result[2], 4);   // (3+4+5)/3
  });

  it('returns empty array when period > data length', () => {
    assert.deepEqual(sma([1, 2, 3], 5), []);
  });

  it('returns single value when period equals data length', () => {
    const result = sma([10, 20, 30], 3);
    assert.equal(result.length, 1);
    assertClose(result[0], 20);
  });

  it('returns full array when period is 1', () => {
    const data = [5, 10, 15];
    const result = sma(data, 1);
    assert.deepEqual(result, data);
  });

  it('returns empty array for period <= 0', () => {
    assert.deepEqual(sma([1, 2, 3], 0), []);
    assert.deepEqual(sma([1, 2, 3], -1), []);
  });

  it('handles floating-point data', () => {
    const result = sma([1.5, 2.5, 3.5], 2);
    assert.equal(result.length, 2);
    assertClose(result[0], 2);
    assertClose(result[1], 3);
  });
});

// ─── ema ──────────────────────────────────────────────────────────────────────

describe('ema', () => {
  it('first value equals first data point', () => {
    const result = ema([10, 20, 30, 40, 50], 3);
    assertClose(result[0], 10);
  });

  it('returns same length as input', () => {
    const data = [1, 2, 3, 4, 5];
    assert.equal(ema(data, 3).length, data.length);
  });

  it('weights recent values more heavily than older ones', () => {
    // With a spike at the end, EMA should trend toward the spike
    const data = [10, 10, 10, 10, 100];
    const result = ema(data, 3);
    // Last EMA value should be higher than first due to trailing spike
    assert.ok(result[result.length - 1] > result[0]);
  });

  it('converges correctly with known values (period=2)', () => {
    // k = 2/(2+1) = 2/3
    // ema[0] = 1
    // ema[1] = 2*(2/3) + 1*(1/3) = 4/3 + 1/3 = 5/3
    // ema[2] = 3*(2/3) + (5/3)*(1/3) = 2 + 5/9 = 23/9
    const result = ema([1, 2, 3], 2);
    assertClose(result[0], 1);
    assertClose(result[1], 5 / 3);
    assertClose(result[2], 23 / 9);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(ema([], 3), []);
  });

  it('returns empty array for period <= 0', () => {
    assert.deepEqual(ema([1, 2, 3], 0), []);
  });
});

// ─── wma ──────────────────────────────────────────────────────────────────────

describe('wma', () => {
  it('computes weighted average correctly', () => {
    // period=3, weights [1,2,3], denom=6
    // [1,2,3]: (1*1 + 2*2 + 3*3) / 6 = 14/6 = 7/3
    const result = wma([1, 2, 3, 4], 3);
    assertClose(result[0], 14 / 6);
    // [2,3,4]: (1*2 + 2*3 + 3*4) / 6 = 20/6 = 10/3
    assertClose(result[1], 20 / 6);
  });

  it('returns empty array when period > data length', () => {
    assert.deepEqual(wma([1, 2], 5), []);
  });

  it('has length data.length - period + 1', () => {
    const result = wma([1, 2, 3, 4, 5], 3);
    assert.equal(result.length, 3);
  });

  it('returns empty array for period <= 0', () => {
    assert.deepEqual(wma([1, 2, 3], 0), []);
  });
});

// ─── cma ──────────────────────────────────────────────────────────────────────

describe('cma', () => {
  it('computes cumulative moving average', () => {
    const result = cma([2, 4, 6, 8]);
    assertClose(result[0], 2);       // 2/1
    assertClose(result[1], 3);       // 6/2
    assertClose(result[2], 4);       // 12/3
    assertClose(result[3], 5);       // 20/4
  });

  it('has same length as input', () => {
    const data = [1, 2, 3, 4, 5];
    assert.equal(cma(data).length, data.length);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(cma([]), []);
  });

  it('single element equals that element', () => {
    assertClose(cma([42])[0], 42);
  });
});

// ─── rollingStdDev ────────────────────────────────────────────────────────────

describe('rollingStdDev', () => {
  it('returns 0 for constant data', () => {
    const result = rollingStdDev([5, 5, 5, 5], 3);
    for (const v of result) assertClose(v, 0);
  });

  it('computes correct std dev', () => {
    // window [2, 4, 4, 4, 5, 5, 7, 9] has stddev 2 (classic example)
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = rollingStdDev(data, 8);
    assert.equal(result.length, 1);
    assertClose(result[0], 2);
  });

  it('has length data.length - period + 1', () => {
    const result = rollingStdDev([1, 2, 3, 4, 5], 3);
    assert.equal(result.length, 3);
  });

  it('returns empty array when period > data length', () => {
    assert.deepEqual(rollingStdDev([1, 2], 5), []);
  });
});

// ─── bollingerBands ───────────────────────────────────────────────────────────

describe('bollingerBands', () => {
  it('upper > middle > lower for non-constant data', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { upper, middle, lower } = bollingerBands(data, 5);

    for (let i = 0; i < middle.length; i++) {
      assert.ok(upper[i] > middle[i], `upper[${i}] should be > middle[${i}]`);
      assert.ok(middle[i] > lower[i], `middle[${i}] should be > lower[${i}]`);
    }
  });

  it('middle band equals SMA', () => {
    const data = [10, 20, 30, 40, 50];
    const { middle } = bollingerBands(data, 3);
    const smaResult = sma(data, 3);
    assert.equal(middle.length, smaResult.length);
    for (let i = 0; i < middle.length; i++) {
      assertClose(middle[i], smaResult[i]);
    }
  });

  it('upper = middle for constant data (stddev = 0)', () => {
    const data = [5, 5, 5, 5, 5];
    const { upper, middle, lower } = bollingerBands(data, 3);
    for (let i = 0; i < middle.length; i++) {
      assertClose(upper[i], middle[i]);
      assertClose(lower[i], middle[i]);
    }
  });

  it('uses custom multiplier', () => {
    const data = [1, 2, 3, 4, 5];
    const std2 = bollingerBands(data, 3, 2);
    const std3 = bollingerBands(data, 3, 3);

    for (let i = 0; i < std2.upper.length; i++) {
      assert.ok(std3.upper[i] >= std2.upper[i]);
      assert.ok(std3.lower[i] <= std2.lower[i]);
    }
  });

  it('all three arrays have the same length', () => {
    const { upper, middle, lower } = bollingerBands([1, 2, 3, 4, 5, 6], 3);
    assert.equal(upper.length, middle.length);
    assert.equal(middle.length, lower.length);
  });
});

// ─── rsi ──────────────────────────────────────────────────────────────────────

describe('rsi', () => {
  it('all values are between 0 and 100', () => {
    const data = [44, 46, 45, 47, 48, 47, 46, 48, 50, 51, 52, 50, 48, 49, 51, 53, 55];
    const result = rsi(data, 14);
    assert.ok(result.length > 0);
    for (const v of result) {
      assert.ok(v >= 0 && v <= 100, `RSI value ${v} out of range`);
    }
  });

  it('returns 100 for a series of only gains', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const result = rsi(data, 14);
    assert.ok(result.length > 0);
    for (const v of result) {
      assertClose(v, 100, 1e-6);
    }
  });

  it('returns 0 for a series of only losses', () => {
    const data = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const result = rsi(data, 14);
    assert.ok(result.length > 0);
    for (const v of result) {
      assertClose(v, 0, 1e-6);
    }
  });

  it('returns empty array when data length <= period', () => {
    assert.deepEqual(rsi([1, 2, 3, 4, 5], 5), []);
    assert.deepEqual(rsi([1, 2, 3], 14), []);
  });

  it('uses default period of 14', () => {
    const data = Array.from({ length: 30 }, (_, i) => i + 1);
    const withDefault = rsi(data);
    const withExplicit = rsi(data, 14);
    assert.deepEqual(withDefault, withExplicit);
  });
});

// ─── macd ─────────────────────────────────────────────────────────────────────

describe('macd', () => {
  // Generate enough data for defaults: fastPeriod=12, slowPeriod=26, signalPeriod=9
  const data = Array.from({ length: 50 }, (_, i) =>
    100 + Math.sin(i * 0.3) * 10 + i * 0.5,
  );

  it('returns macd, signal, and histogram arrays of the same length', () => {
    const { macd: m, signal, histogram } = macd(data);
    assert.equal(m.length, signal.length);
    assert.equal(signal.length, histogram.length);
  });

  it('histogram equals macd - signal', () => {
    const { macd: m, signal, histogram } = macd(data);
    for (let i = 0; i < histogram.length; i++) {
      assertClose(histogram[i], m[i] - signal[i]);
    }
  });

  it('signal line lags behind the MACD line (EMA smoothing)', () => {
    // Signal is EMA of MACD, so it starts at the same value as MACD[0]
    // but responds more slowly. Verify first value equality.
    const { macd: m, signal } = macd(data);
    // signal[0] = ema(macdLine, 9)[0] = macdLine[0]
    assertClose(signal[0], m[0]);
  });

  it('works with custom periods', () => {
    const { macd: m, signal, histogram } = macd(data, 5, 10, 3);
    assert.ok(m.length > 0);
    assert.equal(m.length, signal.length);
    assert.equal(signal.length, histogram.length);
  });

  it('histogram is 0 at index 0 (signal equals macd at first point)', () => {
    const { histogram } = macd(data);
    assertClose(histogram[0], 0, 1e-9);
  });
});
