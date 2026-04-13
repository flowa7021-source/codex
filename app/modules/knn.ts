// ─── K-Nearest Neighbors Classifier ─────────────────────────────────────────
// @ts-check
// A simple KNN classifier using Euclidean distance and majority-vote labeling.

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single neighbor returned as part of a prediction result. */
export interface NeighborEntry {
  label: string | number;
  distance: number;
}

/**
 * Result returned by {@link KNN.predict}.
 *
 * - `label`     — Majority-vote winner among the k nearest neighbors
 * - `distance`  — Euclidean distance to the nearest neighbor
 * - `neighbors` — The k nearest training points (sorted ascending by distance)
 */
export interface KNNResult {
  label: string | number;
  distance: number;
  neighbors: Array<NeighborEntry>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Squared Euclidean distance between two same-length vectors.
 * Avoids the sqrt for performance when only ordering is needed.
 *
 * @param a - First point
 * @param b - Second point
 */
function squaredEuclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

// ─── KNN Class ───────────────────────────────────────────────────────────────

/**
 * K-Nearest Neighbors classifier.
 *
 * @example
 *   const knn = new KNN(3);
 *   knn.fit([[0, 0], [1, 0], [10, 10], [11, 10]], ['A', 'A', 'B', 'B']);
 *   const result = knn.predict([0.5, 0.5]);
 *   console.log(result.label); // 'A'
 */
export class KNN {
  /** Number of neighbors to consider when predicting. */
  k: number;

  /** Training feature vectors. Populated by {@link fit}. */
  #data: number[][] = [];

  /** Training labels, parallel to {@link #data}. Populated by {@link fit}. */
  #labels: (string | number)[] = [];

  /** Whether {@link fit} has been called with valid data. */
  #fitted = false;

  /**
   * Create a new KNN classifier.
   *
   * @param k - Number of nearest neighbors to use (must be ≥ 1)
   * @throws {RangeError} if k < 1
   */
  constructor(k: number) {
    if (k < 1) {
      throw new RangeError(`k must be at least 1, got ${k}`);
    }
    this.k = k;
  }

  /**
   * Store training data and labels.
   *
   * @param data   - Array of feature vectors (all must have the same length)
   * @param labels - Class label for each feature vector
   * @throws {Error} if data is empty
   * @throws {Error} if data.length !== labels.length
   */
  fit(data: number[][], labels: (string | number)[]): void {
    if (data.length === 0) {
      throw new Error('Training data must not be empty');
    }
    if (data.length !== labels.length) {
      throw new Error(
        `data and labels must have the same length ` +
          `(got data.length=${data.length}, labels.length=${labels.length})`,
      );
    }
    // Defensive copies so the caller cannot mutate internal state.
    this.#data = data.map(point => [...point]);
    this.#labels = [...labels];
    this.#fitted = true;
  }

  /**
   * Predict the class label for a single point.
   *
   * Finds the k nearest training points by Euclidean distance and returns the
   * majority-vote label. Ties between labels are broken by the label that
   * appears first among the sorted neighbors.
   *
   * @param point - Feature vector (must match the dimensionality of training data)
   * @returns {KNNResult} prediction result with label, distance, and neighbors
   * @throws {Error} if {@link fit} has not been called
   */
  predict(point: number[]): KNNResult {
    if (!this.#fitted) {
      throw new Error('KNN must be fitted before calling predict()');
    }

    // Build distance list.
    const distances: Array<{ label: string | number; sqDist: number }> =
      this.#data.map((trainPoint, i) => ({
        label: this.#labels[i],
        sqDist: squaredEuclidean(point, trainPoint),
      }));

    // Sort ascending by distance (stable in modern JS).
    distances.sort((a, b) => a.sqDist - b.sqDist);

    // Take the k nearest.
    const kNearest = distances.slice(0, this.k);

    // Build neighbor entries (real distances, not squared).
    const neighbors: NeighborEntry[] = kNearest.map(entry => ({
      label: entry.label,
      distance: Math.sqrt(entry.sqDist),
    }));

    // Majority vote.
    const votes = new Map<string | number, number>();
    for (const neighbor of neighbors) {
      votes.set(neighbor.label, (votes.get(neighbor.label) ?? 0) + 1);
    }

    let winnerLabel: string | number = neighbors[0].label;
    let winnerCount = 0;
    for (const [label, count] of votes) {
      if (count > winnerCount) {
        winnerCount = count;
        winnerLabel = label;
      }
    }

    return {
      label: winnerLabel,
      distance: neighbors[0].distance,
      neighbors,
    };
  }

  /**
   * Predict class labels for multiple points in one call.
   *
   * @param points - Array of feature vectors
   * @returns Array of predicted labels (parallel to the input array)
   * @throws {Error} if {@link fit} has not been called
   */
  predictAll(points: number[][]): (string | number)[] {
    return points.map(point => this.predict(point).label);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Convenience factory that creates a {@link KNN} instance.
 *
 * @param k - Number of nearest neighbors (must be ≥ 1)
 * @returns a new, unfitted KNN classifier
 * @throws {RangeError} if k < 1
 */
export function createKNN(k: number): KNN {
  return new KNN(k);
}
