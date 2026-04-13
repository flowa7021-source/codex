// @ts-check
// ─── Permutation & Combinatorics ─────────────────────────────────────────────
// Pure-function combinatorics library: factorial, permutations, combinations,
// binomial coefficient, next-permutation, Fisher-Yates shuffle, Cartesian
// product, and power-set.

// ─── Seeded PRNG (Mulberry32) ────────────────────────────────────────────────

/**
 * Mulberry32 — a fast, seedable 32-bit PRNG.
 * Returns a closure that produces a float in [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ─── factorial ───────────────────────────────────────────────────────────────

/**
 * Compute n! (n factorial).
 *
 * Throws a `RangeError` if `n` is negative or greater than 20 (21! overflows
 * a 64-bit float integer range).
 *
 * @param n - A non-negative integer ≤ 20.
 * @returns n!
 */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`factorial: n must be a non-negative integer, got ${n}`);
  }
  if (n > 20) {
    throw new RangeError(`factorial: n must be ≤ 20 to avoid overflow, got ${n}`);
  }
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// ─── permutations ────────────────────────────────────────────────────────────

/**
 * Generate all permutations of `arr` taking `r` elements at a time.
 *
 * - If `r` is omitted the full-length permutations are returned.
 * - Returns `[]` when `arr` is empty or `r === 0`.
 *
 * @param arr - Source array.
 * @param r   - Number of elements to select (default: `arr.length`).
 * @returns Array of permutations, each permutation being a `T[]`.
 */
export function permutations<T>(arr: T[], r?: number): T[][] {
  const n = arr.length;
  const k = r === undefined ? n : r;

  if (n === 0 || k === 0) return [];
  if (k > n) return [];

  const results: T[][] = [];

  /** Heap-style partial permutation via backtracking. */
  function backtrack(current: T[], remaining: T[]): void {
    if (current.length === k) {
      results.push(current.slice());
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      backtrack(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop();
    }
  }

  backtrack([], arr.slice());
  return results;
}

// ─── combinations ────────────────────────────────────────────────────────────

/**
 * Generate all `r`-combinations (subsets of size `r`) from `arr`.
 *
 * @param arr - Source array.
 * @param r   - Subset size.
 * @returns Array of combinations, each combination being a `T[]`.
 */
export function combinations<T>(arr: T[], r: number): T[][] {
  const n = arr.length;
  if (r < 0 || r > n) return [];
  if (r === 0) return [[]];

  const results: T[][] = [];

  function backtrack(start: number, current: T[]): void {
    if (current.length === r) {
      results.push(current.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return results;
}

// ─── choose ──────────────────────────────────────────────────────────────────

/**
 * Compute the binomial coefficient C(n, r) = n! / (r! × (n−r)!).
 *
 * Uses a multiplicative formula to avoid computing large factorials directly.
 *
 * @param n - Total items.
 * @param r - Items chosen.
 * @returns C(n, r), or 0 when `r < 0` or `r > n`.
 */
export function choose(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  // Optimise: C(n, r) == C(n, n-r)
  const k = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

// ─── nextPermutation ─────────────────────────────────────────────────────────

/**
 * Mutate `arr` in-place to the next lexicographically greater permutation.
 *
 * Uses the standard algorithm (Narayana Pandita):
 *  1. Find the largest index `i` such that `arr[i] < arr[i + 1]`.
 *  2. Find the largest index `j > i` such that `arr[j] > arr[i]`.
 *  3. Swap `arr[i]` and `arr[j]`.
 *  4. Reverse the suffix starting at `arr[i + 1]`.
 *
 * @param arr - Array to mutate (elements must be comparable with `<`).
 * @returns `true` if a next permutation exists and was applied; `false` if
 *          `arr` was already the last (descending) permutation, in which case
 *          `arr` is left unchanged.
 */
export function nextPermutation<T>(arr: T[]): boolean {
  const n = arr.length;
  if (n <= 1) return false;

  // Step 1: find largest i such that arr[i] < arr[i+1]
  let i = n - 2;
  while (i >= 0 && arr[i] >= arr[i + 1]) i--;

  if (i < 0) return false; // already last permutation

  // Step 2: find largest j > i such that arr[j] > arr[i]
  let j = n - 1;
  while (arr[j] <= arr[i]) j--;

  // Step 3: swap
  [arr[i], arr[j]] = [arr[j], arr[i]];

  // Step 4: reverse suffix after i
  let left = i + 1;
  let right = n - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]];
    left++;
    right--;
  }

  return true;
}

// ─── shuffle ─────────────────────────────────────────────────────────────────

/**
 * Return a new array containing the same elements as `arr` in a shuffled
 * order using the Fisher-Yates algorithm.
 *
 * @param arr  - Source array (not mutated).
 * @param seed - Optional integer seed.  When provided a deterministic PRNG
 *               (Mulberry32) is used so results are reproducible.  When
 *               omitted `Math.random` is used.
 * @returns A new shuffled array.
 */
export function shuffle<T>(arr: T[], seed?: number): T[] {
  const result = arr.slice();
  const random = seed !== undefined ? mulberry32(seed) : Math.random.bind(Math);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── cartesianProduct ────────────────────────────────────────────────────────

/**
 * Compute the Cartesian product of any number of arrays.
 *
 * cartesianProduct([1, 2], [3, 4]) → [[1,3],[1,4],[2,3],[2,4]]
 *
 * @param arrays - One or more arrays.
 * @returns Array of tuples, one tuple per combination.
 */
export function cartesianProduct<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];

  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((prefix) => arr.map((item) => [...prefix, item])),
    [[]],
  );
}

// ─── powerSet ────────────────────────────────────────────────────────────────

/**
 * Compute the power set (set of all subsets) of `arr`.
 *
 * The empty set is always included.  For an array of `n` elements the result
 * contains exactly 2ⁿ subsets.
 *
 * @param arr - Source array.
 * @returns Array of subsets.
 */
export function powerSet<T>(arr: T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of arr) {
    const len = result.length;
    for (let i = 0; i < len; i++) {
      result.push([...result[i], item]);
    }
  }
  return result;
}
