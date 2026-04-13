// @ts-check
// ─── Simulated Annealing Optimization ────────────────────────────────────────
// A generic simulated annealing implementation supporting configurable
// temperature schedules, neighbor functions, and energy landscapes.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnnealingOptions<T> {
  /** Initial state. */
  initial: T;
  /** Energy function (lower = better). */
  energy: (state: T) => number;
  /** Generate a neighboring state. */
  neighbor: (state: T) => T;
  /** Starting temperature. Default: 100. */
  initialTemp?: number;
  /** Cooling rate (0-1). Default: 0.995. */
  coolingRate?: number;
  /** Minimum temperature. Default: 0.01. */
  minTemp?: number;
  /** Iterations per temperature step. Default: 10. */
  iterationsPerStep?: number;
}

export interface AnnealingResult<T> {
  best: T;
  bestEnergy: number;
  finalTemp: number;
  iterations: number;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Run simulated annealing optimisation.
 *
 * Begins at `options.initialTemp` and cools by multiplying by `coolingRate`
 * after each batch of `iterationsPerStep` iterations, stopping when the
 * temperature drops below `minTemp`.
 */
export function simulatedAnnealing<T>(options: AnnealingOptions<T>): AnnealingResult<T> {
  const {
    initial,
    energy,
    neighbor,
    initialTemp = 100,
    coolingRate = 0.995,
    minTemp = 0.01,
    iterationsPerStep = 10,
  } = options;

  let current = initial;
  let currentEnergy = energy(current);

  let best = current;
  let bestEnergy = currentEnergy;

  let temp = initialTemp;
  let iterations = 0;

  while (temp > minTemp) {
    for (let i = 0; i < iterationsPerStep; i++) {
      const candidate = neighbor(current);
      const candidateEnergy = energy(candidate);
      const prob = acceptanceProbability(currentEnergy, candidateEnergy, temp);

      if (Math.random() < prob) {
        current = candidate;
        currentEnergy = candidateEnergy;
      }

      if (currentEnergy < bestEnergy) {
        best = current;
        bestEnergy = currentEnergy;
      }

      iterations++;
    }

    temp *= coolingRate;
  }

  return {
    best,
    bestEnergy,
    finalTemp: temp,
    iterations,
  };
}

// ─── Acceptance probability ───────────────────────────────────────────────────

/**
 * Metropolis acceptance probability.
 *
 * - If `newEnergy <= currentEnergy` (improvement), returns 1 (always accept).
 * - Otherwise returns `exp(-delta / temp)` where `delta = newEnergy - currentEnergy`.
 */
export function acceptanceProbability(
  currentEnergy: number,
  newEnergy: number,
  temp: number,
): number {
  if (newEnergy <= currentEnergy) return 1;
  const delta = newEnergy - currentEnergy;
  return Math.exp(-delta / temp);
}
