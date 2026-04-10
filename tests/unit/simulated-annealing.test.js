// ─── Unit Tests: Simulated Annealing ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  simulatedAnnealing,
  acceptanceProbability,
} from '../../app/modules/simulated-annealing.js';

// ─── acceptanceProbability ────────────────────────────────────────────────────

describe('acceptanceProbability', () => {
  it('returns 1 when new energy equals current energy', () => {
    assert.equal(acceptanceProbability(5, 5, 100), 1);
  });

  it('returns 1 when new energy is lower (improvement)', () => {
    assert.equal(acceptanceProbability(10, 5, 100), 1);
  });

  it('returns a value between 0 and 1 for a worse state', () => {
    const prob = acceptanceProbability(5, 10, 100);
    assert.ok(prob > 0 && prob < 1, `expected 0 < prob < 1, got ${prob}`);
  });

  it('higher temperature yields higher acceptance for worse state', () => {
    const probLowTemp = acceptanceProbability(5, 10, 1);
    const probHighTemp = acceptanceProbability(5, 10, 100);
    assert.ok(
      probHighTemp > probLowTemp,
      `high-temp prob ${probHighTemp} should exceed low-temp prob ${probLowTemp}`,
    );
  });

  it('matches exp(-delta/temp) formula', () => {
    const prob = acceptanceProbability(3, 8, 10);
    const expected = Math.exp(-(8 - 3) / 10);
    assert.ok(
      Math.abs(prob - expected) < 1e-12,
      `expected ${expected}, got ${prob}`,
    );
  });

  it('returns exactly 1 for an improvement', () => {
    assert.equal(acceptanceProbability(100, 50, 1), 1);
    assert.equal(acceptanceProbability(0.5, 0.1, 0.01), 1);
  });
});

// ─── simulatedAnnealing – basic contract ─────────────────────────────────────

describe('simulatedAnnealing – basic contract', () => {
  const quadratic = {
    initial: 10,
    energy: (x) => x * x,
    neighbor: (x) => x + (Math.random() - 0.5) * 2,
  };

  it('returns an object with the required fields', () => {
    const result = simulatedAnnealing(quadratic);
    assert.ok('best' in result);
    assert.ok('bestEnergy' in result);
    assert.ok('finalTemp' in result);
    assert.ok('iterations' in result);
  });

  it('bestEnergy equals energy(best)', () => {
    const result = simulatedAnnealing(quadratic);
    assert.ok(
      Math.abs(result.bestEnergy - quadratic.energy(result.best)) < 1e-12,
    );
  });

  it('finalTemp is less than initialTemp', () => {
    const result = simulatedAnnealing({ ...quadratic, initialTemp: 100 });
    assert.ok(result.finalTemp < 100);
  });

  it('finalTemp is at or below minTemp', () => {
    const minTemp = 0.01;
    const result = simulatedAnnealing({ ...quadratic, minTemp });
    assert.ok(result.finalTemp <= minTemp * 1.01, // allow one cooling step past
      `finalTemp ${result.finalTemp} should be <= minTemp ${minTemp}`);
  });

  it('iterations > 0', () => {
    const result = simulatedAnnealing(quadratic);
    assert.ok(result.iterations > 0);
  });
});

// ─── simulatedAnnealing – minimises x² ───────────────────────────────────────

describe('simulatedAnnealing – minimises x²', () => {
  it('finds a solution close to x=0 starting from x=10', () => {
    // Run several trials and check at least one converges close to 0.
    // (SA is probabilistic so we give it a few attempts.)
    let closestEnergy = Infinity;
    for (let trial = 0; trial < 5; trial++) {
      const result = simulatedAnnealing({
        initial: 10,
        energy: (x) => x * x,
        neighbor: (x) => x + (Math.random() - 0.5) * 2,
        initialTemp: 100,
        coolingRate: 0.99,
        minTemp: 0.001,
        iterationsPerStep: 20,
      });
      if (result.bestEnergy < closestEnergy) closestEnergy = result.bestEnergy;
    }
    assert.ok(
      closestEnergy < 1,
      `expected bestEnergy < 1 near x=0, got ${closestEnergy}`,
    );
  });

  it('finds a better solution than the initial state', () => {
    const result = simulatedAnnealing({
      initial: 50,
      energy: (x) => x * x,
      neighbor: (x) => x + (Math.random() - 0.5) * 4,
      initialTemp: 200,
      coolingRate: 0.99,
      minTemp: 0.001,
      iterationsPerStep: 20,
    });
    assert.ok(
      result.bestEnergy < 50 * 50,
      `bestEnergy ${result.bestEnergy} should be less than initial energy ${50 * 50}`,
    );
  });
});

// ─── Cooling schedule ─────────────────────────────────────────────────────────

describe('simulatedAnnealing – cooling schedule', () => {
  it('higher coolingRate (slower cooling) yields more iterations', () => {
    const base = {
      initial: 0,
      energy: () => 0,
      neighbor: (x) => x,
      initialTemp: 100,
      minTemp: 0.01,
      iterationsPerStep: 1,
    };
    const fast = simulatedAnnealing({ ...base, coolingRate: 0.9 });
    const slow = simulatedAnnealing({ ...base, coolingRate: 0.999 });
    assert.ok(
      slow.iterations > fast.iterations,
      `slow cooling (${slow.iterations}) should run more iterations than fast (${fast.iterations})`,
    );
  });

  it('finalTemp < initialTemp after cooling', () => {
    const result = simulatedAnnealing({
      initial: 0,
      energy: () => 0,
      neighbor: (x) => x,
      initialTemp: 50,
      coolingRate: 0.9,
      minTemp: 0.01,
    });
    assert.ok(result.finalTemp < 50);
  });

  it('respects iterationsPerStep count', () => {
    // With iterationsPerStep=5 and known temp range, verify the total
    // iterations is a multiple of iterationsPerStep.
    const result = simulatedAnnealing({
      initial: 0,
      energy: () => 0,
      neighbor: (x) => x,
      initialTemp: 10,
      coolingRate: 0.5,
      minTemp: 0.1,
      iterationsPerStep: 7,
    });
    assert.equal(result.iterations % 7, 0);
  });
});

// ─── Default parameter values ─────────────────────────────────────────────────

describe('simulatedAnnealing – default parameters', () => {
  it('runs without explicit optional params', () => {
    assert.doesNotThrow(() =>
      simulatedAnnealing({
        initial: 5,
        energy: (x) => x * x,
        neighbor: (x) => x + (Math.random() - 0.5),
      }),
    );
  });

  it('accepts string state', () => {
    // Ensure generics work beyond numbers.
    const result = simulatedAnnealing({
      initial: 'aaaa',
      energy: (s) => s.split('').filter((c) => c !== 'b').length,
      neighbor: (s) => {
        const idx = Math.floor(Math.random() * s.length);
        return s.slice(0, idx) + 'b' + s.slice(idx + 1);
      },
    });
    assert.ok(typeof result.best === 'string');
    assert.ok(result.bestEnergy >= 0);
  });
});

// ─── Deterministic behaviour with seeded Math.random ─────────────────────────

describe('simulatedAnnealing – deterministic with replaced RNG', () => {
  it('produces identical results when random is replaced with a fixed sequence', () => {
    // Replace Math.random with a simple LCG for reproducibility.
    const originalRandom = Math.random;

    function makeLCG(seed) {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
      };
    }

    function runWithSeed(seed) {
      Math.random = makeLCG(seed);
      try {
        return simulatedAnnealing({
          initial: 10,
          energy: (x) => x * x,
          neighbor: (x) => x + (Math.random() - 0.5) * 2,
          initialTemp: 50,
          coolingRate: 0.9,
          minTemp: 0.1,
          iterationsPerStep: 5,
        });
      } finally {
        Math.random = originalRandom;
      }
    }

    const r1 = runWithSeed(42);
    const r2 = runWithSeed(42);

    assert.equal(r1.best, r2.best);
    assert.equal(r1.bestEnergy, r2.bestEnergy);
    assert.equal(r1.iterations, r2.iterations);
    assert.equal(r1.finalTemp, r2.finalTemp);
  });

  it('produces different results with different seeds', () => {
    const originalRandom = Math.random;

    function makeLCG(seed) {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
      };
    }

    function runWithSeed(seed) {
      Math.random = makeLCG(seed);
      try {
        return simulatedAnnealing({
          initial: 10,
          energy: (x) => x * x,
          neighbor: (x) => x + (Math.random() - 0.5) * 2,
          initialTemp: 50,
          coolingRate: 0.9,
          minTemp: 0.1,
          iterationsPerStep: 5,
        });
      } finally {
        Math.random = originalRandom;
      }
    }

    const r1 = runWithSeed(1);
    const r2 = runWithSeed(999);
    // Different seeds should (very likely) produce different trajectories.
    // We compare best values — it is astronomically unlikely they're identical.
    assert.ok(
      r1.best !== r2.best || r1.bestEnergy !== r2.bestEnergy,
      'different seeds should yield different results',
    );
  });
});
