// ─── Percentile & Quantile Utilities ────────────────────────────────────────
// @ts-check
// Percentile, quantile, and streaming digest utilities for NovaReader.

// ─── Static helpers ─────────────────────────────────────────────────────────

/**
 * Compute the p-th percentile of an array of numbers using linear
 * interpolation (the "R-7" method used by Excel, NumPy, etc.).
 *
 * @param values - Non-empty array of numbers (not mutated)
 * @param p      - Percentile in [0, 100]
 * @throws {RangeError} If the array is empty or p is out of range
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new RangeError('Cannot compute percentile of an empty array');
  }
  if (p < 0 || p > 100) {
    throw new RangeError(`Percentile p=${p} is out of [0, 100]`);
  }
  return computeQuantile(values, p / 100);
}

/**
 * Compute the q-th quantile of an array of numbers using linear
 * interpolation (R-7 method).
 *
 * @param values - Non-empty array of numbers (not mutated)
 * @param q      - Quantile in [0, 1]
 * @throws {RangeError} If the array is empty or q is out of range
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    throw new RangeError('Cannot compute quantile of an empty array');
  }
  if (q < 0 || q > 1) {
    throw new RangeError(`Quantile q=${q} is out of [0, 1]`);
  }
  return computeQuantile(values, q);
}

/**
 * Internal quantile computation (R-7 linear interpolation).
 * q is assumed to be in [0, 1].
 */
function computeQuantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;

  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Compute the three quartiles (Q1, Q2, Q3) of an array.
 *
 * @param values - Non-empty array of numbers (not mutated)
 * @throws {RangeError} If the array is empty
 */
export function quartiles(values: number[]): { q1: number; q2: number; q3: number } {
  if (values.length === 0) {
    throw new RangeError('Cannot compute quartiles of an empty array');
  }
  return {
    q1: computeQuantile(values, 0.25),
    q2: computeQuantile(values, 0.50),
    q3: computeQuantile(values, 0.75),
  };
}

/**
 * Interquartile range (Q3 - Q1).
 *
 * @param values - Non-empty array of numbers (not mutated)
 * @throws {RangeError} If the array is empty
 */
export function iqr(values: number[]): number {
  const q = quartiles(values);
  return q.q3 - q.q1;
}

/**
 * Compute the percentile rank of a given value within an array.
 * Returns the percentage of values that are less than or equal to the given value.
 *
 * @param values - Non-empty array of numbers (not mutated)
 * @param value  - The value whose rank to compute
 * @throws {RangeError} If the array is empty
 */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) {
    throw new RangeError('Cannot compute percentile rank of an empty array');
  }
  let count = 0;
  for (const v of values) {
    if (v <= value) count++;
  }
  return (count / values.length) * 100;
}

// ─── Streaming PercentileDigest ─────────────────────────────────────────────

/**
 * A streaming percentile digest that keeps all inserted values and computes
 * exact percentiles on demand.
 *
 * For production workloads with millions of data points a t-digest or similar
 * sketch would be preferable, but for NovaReader's typical dataset sizes
 * (hundreds to low thousands) exact computation is both fast and simple.
 */
export class PercentileDigest {
  /** @internal */ private values: number[] = [];
  /** @internal */ private sorted: boolean = true;

  /**
   * Add a value to the digest.
   *
   * @param value - The number to add
   */
  add(value: number): void {
    this.values.push(value);
    this.sorted = false;
  }

  /**
   * Compute the p-th percentile from all values added so far.
   *
   * @param p - Percentile in [0, 100]
   * @throws {RangeError} If the digest is empty or p is out of range
   */
  percentile(p: number): number {
    if (this.values.length === 0) {
      throw new RangeError('Cannot compute percentile of an empty digest');
    }
    if (p < 0 || p > 100) {
      throw new RangeError(`Percentile p=${p} is out of [0, 100]`);
    }
    this.ensureSorted();
    return computeQuantileSorted(this.values, p / 100);
  }

  /** Number of values in the digest. */
  get size(): number {
    return this.values.length;
  }

  /** Remove all values. */
  clear(): void {
    this.values = [];
    this.sorted = true;
  }

  /** @internal */
  private ensureSorted(): void {
    if (!this.sorted) {
      this.values.sort((a, b) => a - b);
      this.sorted = true;
    }
  }
}

/**
 * Quantile computation on a pre-sorted array (avoids re-sorting).
 */
function computeQuantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];

  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;

  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new PercentileDigest instance.
 */
export function createPercentileDigest(): PercentileDigest {
  return new PercentileDigest();
}
