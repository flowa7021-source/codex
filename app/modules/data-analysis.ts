// @ts-check
// ─── Data Analysis ───────────────────────────────────────────────────────────
// Higher-level data analysis functions built on top of statistics-utils.
// No browser APIs — pure math.

import {
  mean,
  median,
  stdDev,
  percentile,
  iqr,
  linearRegression,
} from './statistics-utils.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/** Generate summary statistics for a dataset. */
export function summarize(data: number[]): DataSummary {
  const q1 = percentile(data, 25);
  const q3 = percentile(data, 75);
  return {
    count: data.length,
    min: data.length === 0 ? NaN : Math.min(...data),
    max: data.length === 0 ? NaN : Math.max(...data),
    mean: mean(data),
    median: median(data),
    stdDev: stdDev(data),
    q1,
    q3,
    iqr: q3 - q1,
  };
}

// ─── Outlier detection ───────────────────────────────────────────────────────

/** Detect outliers using the IQR method (values outside 1.5 * IQR from Q1/Q3). */
export function detectOutliers(data: number[]): number[] {
  if (data.length === 0) return [];
  const q1 = percentile(data, 25);
  const q3 = percentile(data, 75);
  const fence = 1.5 * (q3 - q1);
  const lo = q1 - fence;
  const hi = q3 + fence;
  return data.filter((v) => v < lo || v > hi);
}

/** Remove outliers from data (returns copy without outlier values). */
export function removeOutliers(data: number[]): number[] {
  if (data.length === 0) return [];
  const q1 = percentile(data, 25);
  const q3 = percentile(data, 75);
  const fence = 1.5 * (q3 - q1);
  const lo = q1 - fence;
  const hi = q3 + fence;
  return data.filter((v) => v >= lo && v <= hi);
}

// ─── Histogram ───────────────────────────────────────────────────────────────

/** Bin data into N equal-width buckets. Returns an array of {start, end, count}. */
export function histogram(
  data: number[],
  bins: number,
): { start: number; end: number; count: number }[] {
  if (data.length === 0 || bins <= 0) return [];
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const width = mx === mn ? 1 : (mx - mn) / bins;
  const result = Array.from({ length: bins }, (_, i) => ({
    start: mn + i * width,
    end: mn + (i + 1) * width,
    count: 0,
  }));
  for (const v of data) {
    // Clamp the last bin to include the maximum value
    const idx = Math.min(Math.floor((v - mn) / width), bins - 1);
    result[idx].count++;
  }
  return result;
}

// ─── Frequency distribution ──────────────────────────────────────────────────

/** Frequency distribution: count occurrences of each value. */
export function frequency(data: number[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const v of data) {
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
}

// ─── k-means clustering (1-D) ────────────────────────────────────────────────

/**
 * 1-D k-means clustering.
 * Returns the final centroids (sorted) and a label array (index into centroids).
 * @param maxIter - Maximum number of iterations (default 100).
 */
export function kMeans1D(
  data: number[],
  k: number,
  maxIter = 100,
): { centroids: number[]; labels: number[] } {
  if (data.length === 0 || k <= 0) return { centroids: [], labels: [] };
  const n = data.length;
  const actualK = Math.min(k, n);

  // Initialise centroids by spreading evenly across sorted data
  const sorted = [...data].sort((a, b) => a - b);
  let centroids: number[] = Array.from(
    { length: actualK },
    (_, i) => sorted[Math.floor((i * n) / actualK)],
  );

  let labels = new Array<number>(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assignment step
    const newLabels = data.map((v) => {
      let best = 0;
      let bestDist = Math.abs(v - centroids[0]);
      for (let j = 1; j < actualK; j++) {
        const d = Math.abs(v - centroids[j]);
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
      return best;
    });

    // Check for convergence
    const converged = newLabels.every((l, i) => l === labels[i]);
    labels = newLabels;

    // Update step
    const sums = new Array<number>(actualK).fill(0);
    const counts = new Array<number>(actualK).fill(0);
    for (let i = 0; i < n; i++) {
      sums[labels[i]] += data[i];
      counts[labels[i]]++;
    }
    centroids = centroids.map((c, j) => (counts[j] > 0 ? sums[j] / counts[j] : c));

    if (converged) break;
  }

  // Sort centroids and remap labels so output is deterministic
  const order = centroids
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c - b.c)
    .map((x) => x.i);
  const remap = new Array<number>(actualK);
  for (let j = 0; j < actualK; j++) remap[order[j]] = j;
  const sortedCentroids = order.map((i) => centroids[i]);
  const remappedLabels = labels.map((l) => remap[l]);

  return { centroids: sortedCentroids, labels: remappedLabels };
}

// ─── Trend detection ─────────────────────────────────────────────────────────

/**
 * Detect monotonic trend using OLS linear regression slope.
 * Returns 'increasing', 'decreasing', or 'flat'.
 * The threshold for flat is slope magnitude < 1e-10.
 */
export function detectTrend(data: number[]): 'increasing' | 'decreasing' | 'flat' {
  if (data.length < 2) return 'flat';
  const xs = Array.from({ length: data.length }, (_, i) => i);
  const { slope } = linearRegression(xs, data);
  if (Math.abs(slope) < 1e-10) return 'flat';
  return slope > 0 ? 'increasing' : 'decreasing';
}

// ─── Cumulative sum ──────────────────────────────────────────────────────────

/** Calculate cumulative sum (prefix sum). */
export function cumulativeSum(data: number[]): number[] {
  const result: number[] = [];
  let acc = 0;
  for (const v of data) {
    acc += v;
    result.push(acc);
  }
  return result;
}
