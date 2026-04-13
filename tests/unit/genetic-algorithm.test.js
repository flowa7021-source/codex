// ─── Unit Tests: Genetic Algorithm ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GeneticAlgorithm } from '../../app/modules/genetic-algorithm.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Bit-string individuals: arrays of 0/1 of fixed length. */
const BIT_LENGTH = 8;

/** Fitness = number of 1-bits (maximise). */
function bitFitness(bits) {
  return bits.reduce((sum, b) => sum + b, 0);
}

/** Create a random bit-string. */
function createBit() {
  return Array.from({ length: BIT_LENGTH }, () => (Math.random() < 0.5 ? 1 : 0));
}

/** Uniform crossover: randomly pick each bit from one of the two parents. */
function crossoverBit(a, b) {
  return a.map((bit, i) => (Math.random() < 0.5 ? bit : b[i]));
}

/** Flip a random bit. */
function mutateBit(bits) {
  const copy = [...bits];
  const idx = Math.floor(Math.random() * BIT_LENGTH);
  copy[idx] = 1 - copy[idx];
  return copy;
}

const defaultOpts = {
  populationSize: 20,
  create: createBit,
  fitness: bitFitness,
  crossover: crossoverBit,
  mutate: mutateBit,
  mutationRate: 0.3,
  elitism: 2,
};

// ─── Constructor & basic accessors ────────────────────────────────────────────

describe('GeneticAlgorithm – construction', () => {
  it('creates a population of the requested size', () => {
    const ga = new GeneticAlgorithm({ ...defaultOpts, populationSize: 10 });
    assert.equal(ga.population.length, 10);
  });

  it('starts at generation 0', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    assert.equal(ga.generation, 0);
  });

  it('bestFitness is within valid range at generation 0', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    assert.ok(ga.bestFitness >= 0);
    assert.ok(ga.bestFitness <= BIT_LENGTH);
  });

  it('population getter returns a copy (mutations do not affect internal state)', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    const pop = ga.population;
    pop.length = 0; // truncate the copy
    assert.equal(ga.population.length, defaultOpts.populationSize);
  });
});

// ─── step() ───────────────────────────────────────────────────────────────────

describe('GeneticAlgorithm – step()', () => {
  it('increments generation by 1', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    ga.step();
    assert.equal(ga.generation, 1);
    ga.step();
    assert.equal(ga.generation, 2);
  });

  it('keeps population size constant after a step', () => {
    const ga = new GeneticAlgorithm({ ...defaultOpts, populationSize: 15 });
    ga.step();
    assert.equal(ga.population.length, 15);
  });

  it('bestFitness is non-decreasing with elitism > 0', () => {
    // With elitism the best individual always survives, so bestFitness
    // should never decrease.
    const ga = new GeneticAlgorithm({ ...defaultOpts, elitism: 2 });
    let prev = ga.bestFitness;
    for (let i = 0; i < 20; i++) {
      ga.step();
      assert.ok(
        ga.bestFitness >= prev,
        `bestFitness decreased at generation ${ga.generation}: ${prev} -> ${ga.bestFitness}`,
      );
      prev = ga.bestFitness;
    }
  });
});

// ─── Elitism ──────────────────────────────────────────────────────────────────

describe('GeneticAlgorithm – elitism', () => {
  it('elitism=0 still produces a valid population', () => {
    const ga = new GeneticAlgorithm({ ...defaultOpts, elitism: 0 });
    ga.step();
    assert.equal(ga.population.length, defaultOpts.populationSize);
  });

  it('elite individual is present in next generation', () => {
    // Use a deterministic fitness so we can identify the elite.
    // Individual with most 1-bits at position 0 is always kept.
    const allOnes = Array(BIT_LENGTH).fill(1);
    const allZeros = Array(BIT_LENGTH).fill(0);

    // Seed the first population with a known best (allOnes).
    let seeded = false;
    const ga = new GeneticAlgorithm({
      ...defaultOpts,
      elitism: 1,
      mutationRate: 0, // no mutation so elite stays intact
      create: () => {
        if (!seeded) { seeded = true; return allOnes; }
        return allZeros;
      },
    });

    assert.equal(ga.bestFitness, BIT_LENGTH); // allOnes is present

    ga.step();

    // After one step the elite (allOnes) must still be in the population.
    const hasElite = ga.population.some((ind) => ind.every((b) => b === 1));
    assert.ok(hasElite, 'elite individual was not preserved after step');
  });
});

// ─── run() ────────────────────────────────────────────────────────────────────

describe('GeneticAlgorithm – run()', () => {
  it('runs exactly maxGenerations when no targetFitness is set', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    const result = ga.run(10);
    assert.equal(result.generation, 10);
    assert.equal(result.history.length, 10);
  });

  it('stops early when targetFitness is reached', () => {
    // With a large population and high mutation, we should reach all-ones
    // before 200 generations with high probability.
    const ga = new GeneticAlgorithm({
      ...defaultOpts,
      populationSize: 50,
      mutationRate: 0.5,
    });
    const result = ga.run(200, BIT_LENGTH);
    assert.equal(result.bestFitness, BIT_LENGTH);
    assert.ok(result.generation < 200, `should stop early, got generation ${result.generation}`);
  });

  it('history records best fitness per generation', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    const result = ga.run(5);
    assert.equal(result.history.length, 5);
    // Each entry must be a valid fitness value.
    for (const f of result.history) {
      assert.ok(f >= 0 && f <= BIT_LENGTH);
    }
  });

  it('result.best matches bestIndividual after run', () => {
    const ga = new GeneticAlgorithm(defaultOpts);
    const result = ga.run(10);
    assert.deepEqual(result.best, ga.bestIndividual);
    assert.equal(result.bestFitness, ga.bestFitness);
  });
});

// ─── Selection modes ──────────────────────────────────────────────────────────

describe('GeneticAlgorithm – selection modes', () => {
  it('tournament selection produces valid population', () => {
    const ga = new GeneticAlgorithm({ ...defaultOpts, selection: 'tournament' });
    ga.run(5);
    assert.equal(ga.population.length, defaultOpts.populationSize);
  });

  it('roulette selection produces valid population', () => {
    const ga = new GeneticAlgorithm({ ...defaultOpts, selection: 'roulette' });
    ga.run(5);
    assert.equal(ga.population.length, defaultOpts.populationSize);
  });

  it('roulette selection handles equal-fitness population without error', () => {
    // All individuals have the same fitness.
    const ga = new GeneticAlgorithm({
      populationSize: 10,
      create: () => [0, 0, 0],
      fitness: () => 0,
      crossover: (a) => [...a],
      mutate: (a) => [...a],
      selection: 'roulette',
    });
    assert.doesNotThrow(() => ga.run(5));
  });
});

// ─── Maximisation convergence ─────────────────────────────────────────────────

describe('GeneticAlgorithm – convergence', () => {
  it('maximises bit-count fitness over many generations', () => {
    // Run with a generous budget; expect near-optimal solution.
    const ga = new GeneticAlgorithm({
      ...defaultOpts,
      populationSize: 30,
      mutationRate: 0.2,
    });
    const result = ga.run(100);
    assert.ok(
      result.bestFitness >= BIT_LENGTH - 2,
      `expected near-optimal fitness, got ${result.bestFitness}`,
    );
  });
});
