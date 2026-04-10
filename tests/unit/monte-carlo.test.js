// ─── Unit Tests: Monte Carlo Simulation ──────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimatePi,
  monteCarloIntegrate,
  monteCarloIntegrate2D,
  rejectionSampling,
  bootstrapConfidenceInterval,
} from '../../app/modules/monte-carlo.js';

// ─── Deterministic RNG ────────────────────────────────────────────────────────

/**
 * Linear-congruential generator – fixed seed for fully reproducible tests.
 */
function makeLcg(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── estimatePi ───────────────────────────────────────────────────────────────

describe('estimatePi', () => {
  it('returns a value in (2, 4) for a small sample', () => {
    const pi = estimatePi(100, makeLcg(1));
    assert.ok(pi > 2 && pi < 4, `expected pi in (2,4), got ${pi}`);
  });

  it('converges towards π with a large sample', () => {
    const pi = estimatePi(50_000, makeLcg(17));
    assert.ok(Math.abs(pi - Math.PI) < 0.1, `expected pi ≈ π, got ${pi}`);
  });

  it('is deterministic with the same seed', () => {
    const pi1 = estimatePi(1000, makeLcg(99));
    const pi2 = estimatePi(1000, makeLcg(99));
    assert.equal(pi1, pi2);
  });

  it('throws RangeError for samples < 1', () => {
    assert.throws(() => estimatePi(0), RangeError);
    assert.throws(() => estimatePi(-10), RangeError);
  });

  it('works with a single sample (extreme case)', () => {
    const rng = () => 0; // always (0,0) – inside circle
    assert.equal(estimatePi(1, rng), 4);
  });
});

// ─── monteCarloIntegrate ─────────────────────────────────────────────────────

describe('monteCarloIntegrate', () => {
  it('estimates ∫_0^1 x dx ≈ 0.5', () => {
    const result = monteCarloIntegrate(x => x, 0, 1, 20_000, makeLcg(3));
    assert.ok(Math.abs(result - 0.5) < 0.05, `expected ~0.5, got ${result}`);
  });

  it('estimates ∫_0^π sin(x) dx ≈ 2', () => {
    const result = monteCarloIntegrate(Math.sin, 0, Math.PI, 50_000, makeLcg(5));
    assert.ok(Math.abs(result - 2) < 0.05, `expected ~2, got ${result}`);
  });

  it('estimates ∫_0^1 x² dx ≈ 1/3', () => {
    const result = monteCarloIntegrate(x => x * x, 0, 1, 30_000, makeLcg(8));
    assert.ok(Math.abs(result - 1 / 3) < 0.05, `expected ~0.333, got ${result}`);
  });

  it('handles negative bounds (∫_-1^0 x dx ≈ -0.5)', () => {
    const result = monteCarloIntegrate(x => x, -1, 0, 30_000, makeLcg(11));
    assert.ok(Math.abs(result + 0.5) < 0.05, `expected ~-0.5, got ${result}`);
  });

  it('returns exact result for constant function', () => {
    // ∫_2^5 3 dx = 9
    const result = monteCarloIntegrate(() => 3, 2, 5, 1, makeLcg(0));
    assert.equal(result, 9);
  });

  it('throws RangeError for samples < 1', () => {
    assert.throws(() => monteCarloIntegrate(x => x, 0, 1, 0), RangeError);
  });

  it('throws RangeError when a >= b', () => {
    assert.throws(() => monteCarloIntegrate(x => x, 1, 0, 100), RangeError);
    assert.throws(() => monteCarloIntegrate(x => x, 1, 1, 100), RangeError);
  });
});

// ─── monteCarloIntegrate2D ────────────────────────────────────────────────────

describe('monteCarloIntegrate2D', () => {
  it('estimates ∬_[0,1]² 1 dx dy = 1 (area of unit square)', () => {
    const result = monteCarloIntegrate2D(
      () => 1,
      { x: [0, 1], y: [0, 1] },
      1,
      makeLcg(0),
    );
    assert.equal(result, 1);
  });

  it('estimates ∬_[0,1]² (x + y) dx dy ≈ 1', () => {
    // ∫_0^1 ∫_0^1 (x+y) dx dy = 1
    const result = monteCarloIntegrate2D(
      (x, y) => x + y,
      { x: [0, 1], y: [0, 1] },
      50_000,
      makeLcg(21),
    );
    assert.ok(Math.abs(result - 1) < 0.05, `expected ~1, got ${result}`);
  });

  it('estimates ∬_[0,2]×[0,3] 1 dx dy = 6 (rectangle area)', () => {
    const result = monteCarloIntegrate2D(
      () => 1,
      { x: [0, 2], y: [0, 3] },
      10_000,
      makeLcg(13),
    );
    assert.ok(Math.abs(result - 6) < 0.2, `expected ~6, got ${result}`);
  });

  it('throws RangeError for samples < 1', () => {
    assert.throws(
      () => monteCarloIntegrate2D(() => 1, { x: [0, 1], y: [0, 1] }, 0),
      RangeError,
    );
  });

  it('throws RangeError for invalid x bounds', () => {
    assert.throws(
      () => monteCarloIntegrate2D(() => 1, { x: [1, 0], y: [0, 1] }, 100),
      RangeError,
    );
  });

  it('throws RangeError for invalid y bounds', () => {
    assert.throws(
      () => monteCarloIntegrate2D(() => 1, { x: [0, 1], y: [2, 1] }, 100),
      RangeError,
    );
  });
});

// ─── rejectionSampling ────────────────────────────────────────────────────────

describe('rejectionSampling', () => {
  it('returns exactly the requested number of samples', () => {
    // Uniform target on [0,1]: always accept
    const samples = rejectionSampling(
      () => 1,                    // target always = 1
      rng => rng(),              // proposal samples from [0,1)
      1,                          // proposalMax = 1
      50,
      makeLcg(4),
    );
    assert.equal(samples.length, 50);
  });

  it('all accepted samples satisfy target > 0', () => {
    // Triangle target: peaks at 0.5, zero outside [0,1]
    const target = x => (x >= 0 && x <= 1) ? 1 - Math.abs(x - 0.5) * 2 : 0;
    const samples = rejectionSampling(
      target,
      rng => rng(),
      1,
      100,
      makeLcg(55),
    );
    for (const x of samples) {
      assert.ok(target(x) >= 0, `sample ${x} has negative target`);
    }
  });

  it('samples from a half-gaussian-like target land mostly in [0, 1]', () => {
    // Simple bump centred at 0: target(x) = exp(-x^2/0.5), proposal uniform [-2,2]
    const target = x => Math.exp(-x * x / 0.5);
    const proposal = rng => (rng() - 0.5) * 4; // uniform [-2, 2]
    const samples = rejectionSampling(target, proposal, 1, 200, makeLcg(66));
    const nearZero = samples.filter(x => Math.abs(x) < 1).length;
    // Most samples should land near 0 given the Gaussian shape
    assert.ok(nearZero > 100, `expected most samples near 0, got ${nearZero}/200`);
  });

  it('throws RangeError for samples < 1', () => {
    assert.throws(
      () => rejectionSampling(() => 1, rng => rng(), 1, 0),
      RangeError,
    );
  });

  it('throws RangeError for proposalMax <= 0', () => {
    assert.throws(
      () => rejectionSampling(() => 1, rng => rng(), 0, 10),
      RangeError,
    );
    assert.throws(
      () => rejectionSampling(() => 1, rng => rng(), -1, 10),
      RangeError,
    );
  });
});

// ─── bootstrapConfidenceInterval ─────────────────────────────────────────────

describe('bootstrapConfidenceInterval', () => {
  it('estimate equals statistic applied to original data', () => {
    const data = [1, 2, 3, 4, 5];
    const mean = d => d.reduce((a, b) => a + b, 0) / d.length;
    const ci = bootstrapConfidenceInterval(data, mean, 0.95, 500, makeLcg(7));
    assert.equal(ci.estimate, mean(data));
  });

  it('lower <= estimate <= upper', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    const mean = d => d.reduce((a, b) => a + b, 0) / d.length;
    const ci = bootstrapConfidenceInterval(data, mean, 0.95, 1000, makeLcg(9));
    assert.ok(ci.lower <= ci.estimate, `lower(${ci.lower}) > estimate(${ci.estimate})`);
    assert.ok(ci.estimate <= ci.upper, `estimate(${ci.estimate}) > upper(${ci.upper})`);
  });

  it('95% CI is wider than 50% CI', () => {
    const data = Array.from({ length: 30 }, (_, i) => i + 1);
    const mean = d => d.reduce((a, b) => a + b, 0) / d.length;
    const ci95 = bootstrapConfidenceInterval(data, mean, 0.95, 1000, makeLcg(12));
    const ci50 = bootstrapConfidenceInterval(data, mean, 0.50, 1000, makeLcg(12));
    const width95 = ci95.upper - ci95.lower;
    const width50 = ci50.upper - ci50.lower;
    assert.ok(width95 > width50, `95% CI (${width95}) should be wider than 50% CI (${width50})`);
  });

  it('CI for a constant dataset has zero or trivial width', () => {
    const data = [5, 5, 5, 5, 5];
    const mean = d => d.reduce((a, b) => a + b, 0) / d.length;
    const ci = bootstrapConfidenceInterval(data, mean, 0.95, 200, makeLcg(0));
    assert.equal(ci.estimate, 5);
    assert.equal(ci.lower, 5);
    assert.equal(ci.upper, 5);
  });

  it('works with median as statistic', () => {
    const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
    const median = d => {
      const s = [...d].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
    };
    const ci = bootstrapConfidenceInterval(data, median, 0.90, 500, makeLcg(33));
    assert.ok(ci.lower <= ci.estimate);
    assert.ok(ci.estimate <= ci.upper);
  });

  it('throws RangeError for empty data', () => {
    assert.throws(
      () => bootstrapConfidenceInterval([], d => d[0], 0.95),
      RangeError,
    );
  });

  it('throws RangeError for confidence out of (0, 1)', () => {
    const data = [1, 2, 3];
    assert.throws(
      () => bootstrapConfidenceInterval(data, d => d[0], 0, 100),
      RangeError,
    );
    assert.throws(
      () => bootstrapConfidenceInterval(data, d => d[0], 1, 100),
      RangeError,
    );
    assert.throws(
      () => bootstrapConfidenceInterval(data, d => d[0], 1.5, 100),
      RangeError,
    );
  });

  it('throws RangeError for iterations < 1', () => {
    const data = [1, 2, 3];
    assert.throws(
      () => bootstrapConfidenceInterval(data, d => d[0], 0.95, 0),
      RangeError,
    );
  });

  it('is deterministic with the same seed', () => {
    const data = [1, 3, 5, 7, 9, 11];
    const mean = d => d.reduce((a, b) => a + b, 0) / d.length;
    const ci1 = bootstrapConfidenceInterval(data, mean, 0.95, 200, makeLcg(44));
    const ci2 = bootstrapConfidenceInterval(data, mean, 0.95, 200, makeLcg(44));
    assert.deepEqual(ci1, ci2);
  });
});
