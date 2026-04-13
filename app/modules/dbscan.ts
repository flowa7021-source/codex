// @ts-check
// ─── DBSCAN Clustering ─────────────────────────────────────────────────────
// Density-Based Spatial Clustering of Applications with Noise.
// Groups together closely packed points and marks outliers as noise.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result returned by a DBSCAN run. */
export interface DBSCANResult {
  /** Array of clusters, each cluster being an array of point indices. */
  clusters: number[][];
  /** Indices of points classified as noise. */
  noise: number[];
  /** Per-point cluster assignment (-1 = noise, otherwise cluster index). */
  assignments: number[];
}

// ─── Distance ─────────────────────────────────────────────────────────────────

/**
 * Compute the Manhattan (L1) distance between two points of equal dimensionality.
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensionality');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Euclidean distance (internal, used as the default distance metric). */
function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Return the indices of all points within `epsilon` of point `idx`.
 */
function regionQuery(
  data: number[][],
  idx: number,
  epsilon: number,
): number[] {
  const neighbors: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (euclidean(data[idx], data[i]) <= epsilon) {
      neighbors.push(i);
    }
  }
  return neighbors;
}

// ─── DBSCAN Algorithm ─────────────────────────────────────────────────────────

/**
 * Run DBSCAN clustering on `data`.
 *
 * @param data       Array of points (each point is a number[]).
 * @param epsilon    Neighbourhood radius.
 * @param minPoints  Minimum number of points to form a dense region.
 */
export function dbscan(
  data: number[][],
  epsilon: number,
  minPoints: number,
): DBSCANResult {
  if (epsilon <= 0) {
    throw new Error('epsilon must be positive');
  }
  if (minPoints < 1 || !Number.isInteger(minPoints)) {
    throw new Error('minPoints must be a positive integer');
  }

  const n = data.length;
  const assignments = new Array<number>(n).fill(-2); // -2 = unvisited
  const clusters: number[][] = [];
  let clusterIdx = -1;

  for (let i = 0; i < n; i++) {
    if (assignments[i] !== -2) continue; // already processed

    const neighbors = regionQuery(data, i, epsilon);

    if (neighbors.length < minPoints) {
      // Mark as noise (may be re-assigned later if reachable from a core point)
      assignments[i] = -1;
      continue;
    }

    // Start a new cluster
    clusterIdx++;
    clusters.push([]);
    assignments[i] = clusterIdx;
    clusters[clusterIdx].push(i);

    // Expand cluster with a seed set
    const seeds = neighbors.filter((j) => j !== i);
    let seedIdx = 0;

    while (seedIdx < seeds.length) {
      const q = seeds[seedIdx];
      seedIdx++;

      if (assignments[q] === -1) {
        // Was noise, now border point
        assignments[q] = clusterIdx;
        clusters[clusterIdx].push(q);
      }

      if (assignments[q] !== -2) continue; // already in a cluster

      assignments[q] = clusterIdx;
      clusters[clusterIdx].push(q);

      const qNeighbors = regionQuery(data, q, epsilon);
      if (qNeighbors.length >= minPoints) {
        for (const nb of qNeighbors) {
          if (assignments[nb] === -2 || assignments[nb] === -1) {
            // Only add to seeds if unvisited or noise (border candidate)
            if (!seeds.includes(nb)) {
              seeds.push(nb);
            }
          }
        }
      }
    }
  }

  // Collect noise
  const noise: number[] = [];
  for (let i = 0; i < n; i++) {
    if (assignments[i] === -1) noise.push(i);
  }

  return { clusters, noise, assignments };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a reusable DBSCAN estimator with pre-set hyper-parameters.
 */
export function createDBSCAN(
  epsilon: number,
  minPoints: number,
): { fit: (data: number[][]) => DBSCANResult } {
  return {
    fit(data: number[][]): DBSCANResult {
      return dbscan(data, epsilon, minPoints);
    },
  };
}
