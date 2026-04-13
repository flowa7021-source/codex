// @ts-check
// ─── Descriptive & Inferential Statistics ─────────────────────────────────────
// Pure mathematical functions: descriptive stats, distributions, correlation,
// and seeded sampling. All functions throw on empty arrays or invalid inputs.

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Assert non-empty array; throws with a descriptive message. */
function requireNonEmpty(data: number[], fnName: string): void {
  if (data.length === 0) {
    throw new RangeError(`${fnName}: data array must not be empty`);
  }
}

/** Return a sorted copy without mutating the input. */
function sorted(data: number[]): number[] {
  return [...data].sort((a, b) => a - b);
}

/**
 * Simple seeded LCG PRNG (same algorithm as array-utils.ts shuffle).
 * Returns a function that yields pseudo-random numbers in [0, 1).
 */
function lcgRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

// ─── Descriptive statistics ───────────────────────────────────────────────────

/** Arithmetic mean of a dataset. */
export function mean(data: number[]): number {
  requireNonEmpty(data, 'mean');
  let total = 0;
  for (const x of data) total += x;
  return total / data.length;
}

/**
 * Median (middle value of a sorted dataset).
 * For even-length datasets the average of the two middle values is returned.
 */
export function median(data: number[]): number {
  requireNonEmpty(data, 'median');
  const s = sorted(data);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Mode — all values that appear most frequently, returned in ascending order.
 * If every value is unique all values are returned (every value is a mode).
 */
export function mode(data: number[]): number[] {
  requireNonEmpty(data, 'mode');
  const freq = new Map<number, number>();
  for (const x of data) freq.set(x, (freq.get(x) ?? 0) + 1);
  const maxFreq = Math.max(...freq.values());
  return [...freq.keys()].filter((k) => freq.get(k) === maxFreq).sort((a, b) => a - b);
}

/**
 * Variance of a dataset.
 * @param population - if true, divides by N (population variance);
 *                     if false (default), divides by N−1 (sample variance).
 */
export function variance(data: number[], population = false): number {
  requireNonEmpty(data, 'variance');
  if (!population && data.length < 2) {
    throw new RangeError('variance: sample variance requires at least 2 data points');
  }
  const m = mean(data);
  let sumSq = 0;
  for (const x of data) {
    const d = x - m;
    sumSq += d * d;
  }
  return sumSq / (population ? data.length : data.length - 1);
}

/**
 * Standard deviation of a dataset.
 * @param population - if true, population std dev; if false (default), sample std dev.
 */
export function stddev(data: number[], population = false): number {
  return Math.sqrt(variance(data, population));
}

/** Minimum value in a dataset. */
export function min(data: number[]): number {
  requireNonEmpty(data, 'min');
  let m = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] < m) m = data[i];
  }
  return m;
}

/** Maximum value in a dataset. */
export function max(data: number[]): number {
  requireNonEmpty(data, 'max');
  let m = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] > m) m = data[i];
  }
  return m;
}

/** Range — difference between the maximum and minimum values. */
export function range(data: number[]): number {
  return max(data) - min(data);
}

/** Sum of all values in a dataset. */
export function sum(data: number[]): number {
  requireNonEmpty(data, 'sum');
  let total = 0;
  for (const x of data) total += x;
  return total;
}

/**
 * Quantile via linear interpolation (method similar to R's type 7).
 * @param q - quantile in [0, 1].
 */
export function quantile(data: number[], q: number): number {
  requireNonEmpty(data, 'quantile');
  if (q < 0 || q > 1) {
    throw new RangeError(`quantile: q must be in [0, 1], got ${q}`);
  }
  const s = sorted(data);
  const n = s.length;
  if (n === 1) return s[0];
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return s[lo] + frac * (s[hi] - s[lo]);
}

/** Interquartile range (Q3 − Q1). */
export function iqr(data: number[]): number {
  return quantile(data, 0.75) - quantile(data, 0.25);
}

/**
 * Skewness using the Fisher-Pearson standardised moment coefficient.
 * Requires at least 3 data points.
 */
export function skewness(data: number[]): number {
  requireNonEmpty(data, 'skewness');
  if (data.length < 3) {
    throw new RangeError('skewness: requires at least 3 data points');
  }
  const m = mean(data);
  const s = stddev(data, true); // population std dev for moment computation
  if (s === 0) return 0;
  const n = data.length;
  let sum3 = 0;
  for (const x of data) {
    sum3 += Math.pow((x - m) / s, 3);
  }
  return sum3 / n;
}

/**
 * Excess kurtosis (kurtosis − 3), using the population fourth central moment.
 * A normal distribution has excess kurtosis ≈ 0.
 * Requires at least 4 data points.
 */
export function kurtosis(data: number[]): number {
  requireNonEmpty(data, 'kurtosis');
  if (data.length < 4) {
    throw new RangeError('kurtosis: requires at least 4 data points');
  }
  const m = mean(data);
  const s = stddev(data, true);
  if (s === 0) return 0;
  const n = data.length;
  let sum4 = 0;
  for (const x of data) {
    sum4 += Math.pow((x - m) / s, 4);
  }
  return sum4 / n - 3;
}

// ─── Distribution ─────────────────────────────────────────────────────────────

/**
 * Standardise a value to a z-score.
 * @param value  - the observation.
 * @param mean   - population mean.
 * @param stddev - population standard deviation.
 */
export function zScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) throw new RangeError('zScore: stddev must not be zero');
  return (value - mean) / stddev;
}

/**
 * Probability density of the normal distribution at x.
 * @param x      - evaluation point.
 * @param mean   - distribution mean (default 0).
 * @param stddev - distribution standard deviation (default 1).
 */
export function normalPDF(x: number, mean = 0, stddev = 1): number {
  if (stddev <= 0) throw new RangeError('normalPDF: stddev must be > 0');
  const z = (x - mean) / stddev;
  return Math.exp(-0.5 * z * z) / (stddev * Math.sqrt(2 * Math.PI));
}

/**
 * Cumulative distribution function of the normal distribution.
 * Uses the Abramowitz & Stegun approximation (error < 7.5 × 10⁻⁸).
 * @param x      - evaluation point.
 * @param mean   - distribution mean (default 0).
 * @param stddev - distribution standard deviation (default 1).
 */
export function normalCDF(x: number, mean = 0, stddev = 1): number {
  if (stddev <= 0) throw new RangeError('normalCDF: stddev must be > 0');
  // Transform to standard normal
  const z = (x - mean) / (stddev * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

/**
 * Error function approximation (Abramowitz & Stegun 7.1.26).
 * Maximum error: |ε| ≤ 1.5 × 10⁻⁷.
 */
function erf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z);
  // Constants from A&S 7.1.26
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const t = 1 / (1 + p * x);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  return sign * (1 - poly * Math.exp(-x * x));
}

// ─── Correlation ──────────────────────────────────────────────────────────────

/** Validate that two arrays are the same non-zero length. */
function requirePaired(x: number[], y: number[], fnName: string): void {
  if (x.length === 0 || y.length === 0) {
    throw new RangeError(`${fnName}: arrays must not be empty`);
  }
  if (x.length !== y.length) {
    throw new RangeError(`${fnName}: arrays must have the same length`);
  }
}

/**
 * Sample covariance of two variables.
 * Uses N−1 in the denominator (sample covariance).
 */
export function covariance(x: number[], y: number[]): number {
  requirePaired(x, y, 'covariance');
  if (x.length < 2) {
    throw new RangeError('covariance: requires at least 2 paired observations');
  }
  const mx = mean(x);
  const my = mean(y);
  let sumXY = 0;
  for (let i = 0; i < x.length; i++) {
    sumXY += (x[i] - mx) * (y[i] - my);
  }
  return sumXY / (x.length - 1);
}

/**
 * Pearson product-moment correlation coefficient in [−1, 1].
 * Returns NaN if either variable has zero variance.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  requirePaired(x, y, 'pearsonCorrelation');
  const sx = stddev(x);
  const sy = stddev(y);
  if (sx === 0 || sy === 0) return NaN;
  return covariance(x, y) / (sx * sy);
}

/**
 * Rank an array (1-based, average ranks for ties).
 * Returns a parallel array of ranks.
 */
function rankArray(data: number[]): number[] {
  const n = data.length;
  // Pair each value with its original index
  const indexed = data.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    // Find run of ties
    while (j < n - 1 && indexed[j + 1].v === indexed[j].v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based average rank
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Spearman rank-order correlation coefficient in [−1, 1].
 * Monotonic relationships (not necessarily linear) are captured.
 */
export function spearmanCorrelation(x: number[], y: number[]): number {
  requirePaired(x, y, 'spearmanCorrelation');
  const rx = rankArray(x);
  const ry = rankArray(y);
  return pearsonCorrelation(rx, ry);
}

// ─── Sampling ─────────────────────────────────────────────────────────────────

/**
 * Draw `n` samples with replacement from `data`.
 * @param seed - optional seed for reproducibility (uses seeded LCG when provided).
 */
export function sampleWithReplacement(data: number[], n: number, seed?: number): number[] {
  requireNonEmpty(data, 'sampleWithReplacement');
  if (n < 0) throw new RangeError('sampleWithReplacement: n must be ≥ 0');
  const rand = seed !== undefined ? lcgRand(seed) : Math.random;
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(data[Math.floor(rand() * data.length)]);
  }
  return result;
}

/**
 * Draw `n` samples without replacement from `data` (Fisher-Yates partial shuffle).
 * @param seed - optional seed for reproducibility.
 */
export function sampleWithoutReplacement(data: number[], n: number, seed?: number): number[] {
  requireNonEmpty(data, 'sampleWithoutReplacement');
  if (n < 0) throw new RangeError('sampleWithoutReplacement: n must be ≥ 0');
  if (n > data.length) {
    throw new RangeError(
      `sampleWithoutReplacement: n (${n}) exceeds population size (${data.length})`,
    );
  }
  const rand = seed !== undefined ? lcgRand(seed) : Math.random;
  const pool = [...data];
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    result.push(pool[i]);
  }
  return result;
}
