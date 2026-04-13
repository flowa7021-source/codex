// @ts-check
// ─── Genetic Algorithm Framework ─────────────────────────────────────────────
// A generic genetic algorithm supporting tournament and roulette selection,
// elitism, configurable crossover/mutation, and generation history tracking.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneticOptions<T> {
  populationSize: number;
  /** Generate a random individual. */
  create: () => T;
  /** Fitness score (higher = better). */
  fitness: (individual: T) => number;
  /** Crossover two parents to produce a child. */
  crossover: (a: T, b: T) => T;
  /** Mutate an individual. */
  mutate: (individual: T) => T;
  /** Mutation probability (0-1). Default: 0.1. */
  mutationRate?: number;
  /** Selection: 'tournament' | 'roulette'. Default: 'tournament'. */
  selection?: 'tournament' | 'roulette';
  /** Elitism: top N individuals survive unchanged. Default: 2. */
  elitism?: number;
}

export interface GeneticResult<T> {
  best: T;
  bestFitness: number;
  generation: number;
  history: number[]; // best fitness per generation
}

// ─── Selection helpers ────────────────────────────────────────────────────────

/**
 * Tournament selection: pick the best of `k` random individuals.
 */
function tournamentSelect<T>(
  population: T[],
  fitnessCache: number[],
  k = 3,
): T {
  let bestIdx = Math.floor(Math.random() * population.length);
  for (let i = 1; i < k; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (fitnessCache[idx] > fitnessCache[bestIdx]) {
      bestIdx = idx;
    }
  }
  return population[bestIdx];
}

/**
 * Roulette (fitness-proportionate) selection.
 * Shifts all fitnesses so the minimum is 0 to avoid negative values.
 */
function rouletteSelect<T>(
  population: T[],
  fitnessCache: number[],
): T {
  const minFitness = Math.min(...fitnessCache);
  const shifted = fitnessCache.map((f) => f - minFitness);
  const total = shifted.reduce((a, b) => a + b, 0);

  // If all fitnesses are equal, choose uniformly.
  if (total === 0) {
    return population[Math.floor(Math.random() * population.length)];
  }

  const r = Math.random() * total;
  let cumulative = 0;
  for (let i = 0; i < population.length; i++) {
    cumulative += shifted[i];
    if (r <= cumulative) return population[i];
  }
  return population[population.length - 1];
}

// ─── GeneticAlgorithm class ───────────────────────────────────────────────────

export class GeneticAlgorithm<T> {
  readonly #options: Required<GeneticOptions<T>>;
  #population: T[];
  #fitnessCache: number[];
  #generation: number = 0;
  #history: number[] = [];

  constructor(options: GeneticOptions<T>) {
    this.#options = {
      mutationRate: 0.1,
      selection: 'tournament',
      elitism: 2,
      ...options,
    };

    // Initialise population
    this.#population = Array.from(
      { length: this.#options.populationSize },
      () => this.#options.create(),
    );
    this.#fitnessCache = this.#population.map((ind) =>
      this.#options.fitness(ind),
    );
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  get population(): T[] {
    return [...this.#population];
  }

  get bestIndividual(): T {
    return this.#population[this.#bestIndex()];
  }

  get bestFitness(): number {
    return this.#fitnessCache[this.#bestIndex()];
  }

  get generation(): number {
    return this.#generation;
  }

  /** Run for maxGenerations or until fitness >= targetFitness. */
  run(maxGenerations: number, targetFitness?: number): GeneticResult<T> {
    for (let g = 0; g < maxGenerations; g++) {
      this.step();
      if (targetFitness !== undefined && this.bestFitness >= targetFitness) {
        break;
      }
    }
    return {
      best: this.bestIndividual,
      bestFitness: this.bestFitness,
      generation: this.#generation,
      history: [...this.#history],
    };
  }

  /** Advance the population by one generation. */
  step(): void {
    const { populationSize, elitism, mutationRate, selection, crossover, mutate, fitness } =
      this.#options;

    // Sort indices descending by fitness for elitism
    const sortedIndices = this.#population
      .map((_, i) => i)
      .sort((a, b) => this.#fitnessCache[b] - this.#fitnessCache[a]);

    const newPopulation: T[] = [];
    const newFitnessCache: number[] = [];

    // Elitism: carry the top `elitism` individuals unchanged
    const elite = Math.min(elitism, populationSize);
    for (let i = 0; i < elite; i++) {
      const idx = sortedIndices[i];
      newPopulation.push(this.#population[idx]);
      newFitnessCache.push(this.#fitnessCache[idx]);
    }

    // Fill the rest with offspring
    while (newPopulation.length < populationSize) {
      const parentA =
        selection === 'roulette'
          ? rouletteSelect(this.#population, this.#fitnessCache)
          : tournamentSelect(this.#population, this.#fitnessCache);
      const parentB =
        selection === 'roulette'
          ? rouletteSelect(this.#population, this.#fitnessCache)
          : tournamentSelect(this.#population, this.#fitnessCache);

      let child = crossover(parentA, parentB);
      if (Math.random() < mutationRate) {
        child = mutate(child);
      }
      newPopulation.push(child);
      newFitnessCache.push(fitness(child));
    }

    this.#population = newPopulation;
    this.#fitnessCache = newFitnessCache;
    this.#generation++;
    this.#history.push(this.bestFitness);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  #bestIndex(): number {
    let best = 0;
    for (let i = 1; i < this.#fitnessCache.length; i++) {
      if (this.#fitnessCache[i] > this.#fitnessCache[best]) best = i;
    }
    return best;
  }
}
