// @ts-check
// ─── Random Selection ───────────────────────────────────────────────────────
// Randomized selection and shuffling algorithms: Fisher-Yates shuffle,
// weighted sampling, and random permutation generation.

// ─── Shuffle (non-mutating) ─────────────────────────────────────────────────

/**
 * Return a new array with elements shuffled using the Fisher-Yates algorithm.
 * The original array is not modified.
 *
 * @param arr - Source array
 * @param rng - Random number generator returning values in [0, 1)
 */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const result = [...arr];
  return shuffleInPlace(result, rng);
}

// ─── Shuffle In Place ───────────────────────────────────────────────────────

/**
 * Shuffle an array in place using the Fisher-Yates (Knuth) algorithm.
 * Returns the same array reference for convenience.
 *
 * @param arr - Array to shuffle (mutated)
 * @param rng - Random number generator returning values in [0, 1)
 */
export function shuffleInPlace<T>(
  arr: T[],
  rng: () => number = Math.random,
): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

// ─── Sample Without Replacement ─────────────────────────────────────────────

/**
 * Select k random items from an array without replacement.
 * Uses a partial Fisher-Yates shuffle for efficiency.
 * The original array is not modified.
 *
 * @param arr - Source array
 * @param k   - Number of items to select
 * @param rng - Random number generator returning values in [0, 1)
 */
export function sample<T>(
  arr: T[],
  k: number,
  rng: () => number = Math.random,
): T[] {
  const n = arr.length;
  if (k <= 0) return [];
  const count = Math.min(k, n);
  const copy = [...arr];

  // Partial Fisher-Yates: only shuffle the first `count` positions
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (n - i));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy.slice(0, count);
}

// ─── Single Weighted Pick ───────────────────────────────────────────────────

/**
 * Select a single item with probability proportional to its weight.
 * Weights must be positive numbers.
 *
 * @param items - Array of items with associated weights
 * @param rng   - Random number generator returning values in [0, 1)
 */
export function weightedSample<T>(
  items: { value: T; weight: number }[],
  rng: () => number = Math.random,
): T {
  if (items.length === 0) {
    throw new Error('Cannot sample from an empty array');
  }

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = rng() * totalWeight;

  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }

  // Fallback for floating-point edge cases
  return items[items.length - 1].value;
}

// ─── Multiple Weighted Picks ────────────────────────────────────────────────

/**
 * Select k items with probability proportional to their weights (with
 * replacement). Each pick is independent.
 *
 * @param items - Array of items with associated weights
 * @param k     - Number of items to select
 * @param rng   - Random number generator returning values in [0, 1)
 */
export function weightedSampleMultiple<T>(
  items: { value: T; weight: number }[],
  k: number,
  rng: () => number = Math.random,
): T[] {
  if (k <= 0) return [];
  const result: T[] = [];
  for (let i = 0; i < k; i++) {
    result.push(weightedSample(items, rng));
  }
  return result;
}

// ─── Random Permutation ─────────────────────────────────────────────────────

/**
 * Generate a random permutation of integers 0 through n-1.
 *
 * @param n   - Length of the permutation
 * @param rng - Random number generator returning values in [0, 1)
 */
export function randomPermutation(
  n: number,
  rng: () => number = Math.random,
): number[] {
  const perm: number[] = Array.from({ length: n }, (_, i) => i);
  return shuffleInPlace(perm, rng);
}
