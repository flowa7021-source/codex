// @ts-check
// ─── Statistics Utilities ─────────────────────────────────────────────────────
// Extended statistical functions for numerical data analysis.
// No browser APIs — pure math.

// ─── Descriptive statistics ──────────────────────────────────────────────────

/** Arithmetic mean of a dataset. */
export function mean(data: number[]): number {
  if (data.length === 0) return NaN;
  return data.reduce((acc, v) => acc + v, 0) / data.length;
}

/** Median value (middle element of sorted data). */
export function median(data: number[]): number {
  if (data.length === 0) return NaN;
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** All modes (values that appear most frequently). */
export function mode(data: number[]): number[] {
  if (data.length === 0) return [];
  const freq = new Map<number, number>();
  for (const v of data) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  const max = Math.max(...freq.values());
  return [...freq.entries()]
    .filter(([, count]) => count === max)
    .map(([v]) => v)
    .sort((a, b) => a - b);
}

/**
 * Variance of a dataset.
 * @param sample - If true, uses Bessel's correction (n-1). Default: false (population).
 */
export function variance(data: number[], sample = false): number {
  if (data.length === 0) return NaN;
  const divisor = sample ? data.length - 1 : data.length;
  if (divisor <= 0) return NaN;
  const mu = mean(data);
  return data.reduce((acc, v) => acc + (v - mu) ** 2, 0) / divisor;
}

/**
 * Standard deviation of a dataset.
 * @param sample - If true, uses Bessel's correction (n-1). Default: false (population).
 */
export function stdDev(data: number[], sample = false): number {
  return Math.sqrt(variance(data, sample));
}

/** Skewness (Fisher's moment coefficient of skewness). */
export function skewness(data: number[]): number {
  const n = data.length;
  if (n < 3) return NaN;
  const mu = mean(data);
  const sd = stdDev(data);
  if (sd === 0) return 0;
  const s = data.reduce((acc, v) => acc + ((v - mu) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * s;
}

/** Excess kurtosis (Fisher's definition: normal distribution = 0). */
export function kurtosis(data: number[]): number {
  const n = data.length;
  if (n < 4) return NaN;
  const mu = mean(data);
  const sd = stdDev(data);
  if (sd === 0) return 0;
  const m4 = data.reduce((acc, v) => acc + ((v - mu) / sd) ** 4, 0) / n;
  return m4 - 3;
}

// ─── Order statistics ────────────────────────────────────────────────────────

/**
 * Percentile value using linear interpolation.
 * @param p - Percentile in [0, 100].
 */
export function percentile(data: number[], p: number): number {
  if (data.length === 0) return NaN;
  if (p <= 0) return Math.min(...data);
  if (p >= 100) return Math.max(...data);
  const sorted = [...data].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/** Interquartile range (Q3 - Q1). */
export function iqr(data: number[]): number {
  return percentile(data, 75) - percentile(data, 25);
}

// ─── Standardisation ─────────────────────────────────────────────────────────

/** Z-score of a single value relative to a dataset (population stddev). */
export function zScore(value: number, data: number[]): number {
  const sd = stdDev(data);
  if (sd === 0) return 0;
  return (value - mean(data)) / sd;
}

/**
 * Normalise data to [0, 1] using min-max scaling.
 * If all values are equal, returns an array of zeros.
 */
export function normalize(data: number[]): number[] {
  if (data.length === 0) return [];
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const range = mx - mn;
  if (range === 0) return data.map(() => 0);
  return data.map((v) => (v - mn) / range);
}

// ─── Bivariate statistics ─────────────────────────────────────────────────────

/** Pearson correlation coefficient between two arrays of equal length. */
export function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return NaN;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/** Population covariance of two arrays. */
export function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return NaN;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }
  return sum / n;
}

/** Ordinary least-squares linear regression. Returns slope, intercept, and R². */
export function linearRegression(
  x: number[],
  y: number[],
): { slope: number; intercept: number; r2: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN };
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;

  // R² from correlation²
  const r = correlation(xs, ys);
  const r2 = r * r;

  return { slope, intercept, r2 };
}

// ─── Moving averages ─────────────────────────────────────────────────────────

/**
 * Simple moving average with a given window size.
 * Output length equals data.length - window + 1.
 */
export function movingAverage(data: number[], window: number): number[] {
  if (window <= 0 || window > data.length) return [];
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < window; i++) sum += data[i];
  result.push(sum / window);
  for (let i = window; i < data.length; i++) {
    sum += data[i] - data[i - window];
    result.push(sum / window);
  }
  return result;
}

/**
 * Exponential moving average.
 * @param alpha - Smoothing factor in (0, 1]. Higher = more weight on recent values.
 */
export function exponentialMovingAverage(data: number[], alpha: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}
