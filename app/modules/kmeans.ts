// @ts-check
// ─── K-Means Clustering ────────────────────────────────────────────────────
// Standalone K-Means implementation with configurable iterations, seeded
// random initialisation, and silhouette scoring for cluster quality evaluation.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result returned by a K-Means run. */
export interface KMeansResult {
  /** Array of k clusters, each cluster being an array of point indices. */
  clusters: number[][];
  /** The final centroid positions (one per cluster). */
  centroids: number[][];
  /** Per-point cluster assignment (index into clusters/centroids). */
  assignments: number[];
  /** Number of iterations performed. */
  iterations: number;
}

/** Options for the kmeans function. */
export interface KMeansOptions {
  maxIterations?: number;
  seed?: number;
}

// ─── Distance ─────────────────────────────────────────────────────────────────

/**
 * Compute the Euclidean distance between two points of equal dimensionality.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensionality');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────

/** Simple mulberry32 PRNG seeded with a 32-bit integer. Returns [0, 1). */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── K-Means Algorithm ────────────────────────────────────────────────────────

/**
 * Run K-Means clustering on `data`.
 *
 * @param data  Array of points (each point is a number[]).
 * @param k     Number of clusters.
 * @param options  Optional `maxIterations` (default 300) and `seed`.
 */
export function kmeans(
  data: number[][],
  k: number,
  options?: KMeansOptions,
): KMeansResult {
  if (data.length === 0) {
    throw new Error('Data must not be empty');
  }
  if (k <= 0 || !Number.isInteger(k)) {
    throw new Error('k must be a positive integer');
  }
  if (k > data.length) {
    throw new Error('k must not exceed the number of data points');
  }

  const maxIterations = options?.maxIterations ?? 300;
  const rand = options?.seed !== undefined
    ? seededRandom(options.seed)
    : seededRandom(42);

  const n = data.length;
  const dim = data[0].length;

  // ── Initialise centroids via reservoir sampling ──────────────────────────
  const centroidIndices: number[] = [];
  const used = new Set<number>();
  while (centroidIndices.length < k) {
    const idx = Math.floor(rand() * n);
    if (!used.has(idx)) {
      used.add(idx);
      centroidIndices.push(idx);
    }
  }
  const centroids: number[][] = centroidIndices.map((i) => [...data[i]]);

  let assignments = new Array<number>(n).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    let changed = false;

    // ── Assignment step ──────────────────────────────────────────────────
    for (let i = 0; i < n; i++) {
      let bestDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        const d = euclideanDistance(data[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // ── Update step ──────────────────────────────────────────────────────
    for (let c = 0; c < k; c++) {
      const members: number[] = [];
      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) members.push(i);
      }
      if (members.length === 0) continue; // keep old centroid for empty cluster
      const newCentroid = new Array<number>(dim).fill(0);
      for (const m of members) {
        for (let d = 0; d < dim; d++) {
          newCentroid[d] += data[m][d];
        }
      }
      for (let d = 0; d < dim; d++) {
        newCentroid[d] /= members.length;
      }
      centroids[c] = newCentroid;
    }

    if (!changed) break;
  }

  // ── Build cluster index arrays ─────────────────────────────────────────
  const clusters: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    clusters[assignments[i]].push(i);
  }

  return { clusters, centroids, assignments, iterations };
}

// ─── Silhouette Score ─────────────────────────────────────────────────────────

/**
 * Compute the mean silhouette score for a clustering.
 * Values range from -1 (poor) to +1 (excellent).
 *
 * @param data         The original data points.
 * @param assignments  Per-point cluster assignment.
 */
export function silhouetteScore(
  data: number[][],
  assignments: number[],
): number {
  const n = data.length;
  if (n <= 1) return 0;

  const k = Math.max(...assignments) + 1;

  // Group indices by cluster
  const clusterMembers: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    clusterMembers[assignments[i]].push(i);
  }

  // If all points are in the same cluster, silhouette is 0
  const nonEmpty = clusterMembers.filter((c) => c.length > 0);
  if (nonEmpty.length <= 1) return 0;

  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const ci = assignments[i];
    const ownCluster = clusterMembers[ci];

    // a(i): mean distance to other points in the same cluster
    let a = 0;
    if (ownCluster.length > 1) {
      for (const j of ownCluster) {
        if (j !== i) a += euclideanDistance(data[i], data[j]);
      }
      a /= ownCluster.length - 1;
    }

    // b(i): minimum mean distance to points in any other cluster
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ci || clusterMembers[c].length === 0) continue;
      let meanDist = 0;
      for (const j of clusterMembers[c]) {
        meanDist += euclideanDistance(data[i], data[j]);
      }
      meanDist /= clusterMembers[c].length;
      if (meanDist < b) b = meanDist;
    }

    const s = (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / n;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a reusable K-Means estimator with pre-set hyper-parameters.
 */
export function createKMeans(
  k: number,
  options?: { maxIterations?: number },
): { fit: (data: number[][]) => KMeansResult } {
  return {
    fit(data: number[][]): KMeansResult {
      return kmeans(data, k, options);
    },
  };
}
