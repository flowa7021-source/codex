// ─── Random Utilities ────────────────────────────────────────────────────────
// @ts-check
// Random number generation helpers for NovaReader.

// ─── Numeric ─────────────────────────────────────────────────────────────────

/** Generate a random integer in [min, max] (inclusive). */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a random float in [min, max). */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// ─── Array Operations ────────────────────────────────────────────────────────

/** Pick a random element from an array. */
export function randomChoice<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffle an array in-place using Fisher-Yates. Returns the array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick N unique random elements from an array. */
export function sampleWithout<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return shuffle([...arr]);
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    const j = Math.floor(Math.random() * (copy.length - i)) + i;
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}

// ─── Weighted & Boolean ──────────────────────────────────────────────────────

/** Weighted random choice: picks index based on weights array. */
export function weightedChoice(weights: number[]): number {
  if (weights.length === 0) return -1;
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Generate a random boolean with probability p of true (default 0.5). */
export function randomBool(p = 0.5): boolean {
  return Math.random() < p;
}

// ─── String ──────────────────────────────────────────────────────────────────

const DEFAULT_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Generate a random string of N chars from the given alphabet. */
export function randomString(n: number, alphabet = DEFAULT_ALPHABET): string {
  let result = '';
  for (let i = 0; i < n; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

// ─── Seeded PRNG ─────────────────────────────────────────────────────────────

/**
 * Generate a seeded pseudo-random number (deterministic, for testing).
 * Uses a Linear Congruential Generator (LCG).
 * Returns a function that produces values in [0, 1).
 */
export function seededRandom(seed: number): () => number {
  // LCG parameters from Numerical Recipes
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  let state = seed >>> 0; // ensure unsigned 32-bit
  return function () {
    state = (a * state + c) >>> 0; // keep 32-bit unsigned
    return state / m;
  };
}
