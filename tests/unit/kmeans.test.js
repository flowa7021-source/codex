// ─── Unit Tests: K-Means Clustering ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  euclideanDistance,
  kmeans,
  silhouetteScore,
  createKMeans,
} from '../../app/modules/kmeans.js';

// ─── euclideanDistance ────────────────────────────────────────────────────────

describe('euclideanDistance', () => {
  it('computes a 3-4-5 right triangle hypotenuse', () => {
    // Point a = [0,0], point b = [3,4] → distance = 5
    const d = euclideanDistance([0, 0], [3, 4]);
    assert.equal(d, 5);
  });

  it('returns 0 for identical points', () => {
    assert.equal(euclideanDistance([1, 2, 3], [1, 2, 3]), 0);
  });

  it('works for 1-D vectors', () => {
    assert.equal(euclideanDistance([7], [3]), 4);
  });

  it('works for 3-D vectors', () => {
    // (1,0,0) → (0,0,0) = 1
    assert.equal(euclideanDistance([1, 0, 0], [0, 0, 0]), 1);
  });

  it('throws when vector lengths differ', () => {
    assert.throws(
      () => euclideanDistance([1, 2], [1, 2, 3]),
      /dimensionality/i,
    );
  });

  it('throws when one vector is empty and the other is not', () => {
    assert.throws(
      () => euclideanDistance([], [1]),
      /dimensionality/i,
    );
  });
});

// ─── kmeans – validation ──────────────────────────────────────────────────────

describe('kmeans – input validation', () => {
  it('throws for empty data', () => {
    assert.throws(() => kmeans([], 1), /empty/i);
  });

  it('throws for k = 0', () => {
    assert.throws(() => kmeans([[1, 2]], 0), /positive integer/i);
  });

  it('throws for negative k', () => {
    assert.throws(() => kmeans([[1, 2]], -1), /positive integer/i);
  });

  it('throws for non-integer k', () => {
    assert.throws(() => kmeans([[1, 2]], 1.5), /positive integer/i);
  });

  it('throws when k exceeds number of data points', () => {
    assert.throws(
      () => kmeans([[1, 2], [3, 4]], 3),
      /exceed/i,
    );
  });

  it('does not throw when k equals data.length', () => {
    assert.doesNotThrow(() => kmeans([[1, 2], [3, 4]], 2, { seed: 1 }));
  });
});

// ─── kmeans – basic two-cluster separation ────────────────────────────────────

describe('kmeans – two clearly separated clusters', () => {
  // Three points near the origin and three points near x=100.
  const data = [
    [0, 0], [1, 0], [2, 0],
    [100, 0], [101, 0], [102, 0],
  ];

  it('assigns all points to exactly 2 clusters', () => {
    const result = kmeans(data, 2, { seed: 1 });
    assert.equal(result.clusters.length, 2);
    // Every cluster must be non-empty
    for (const cluster of result.clusters) {
      assert.ok(cluster.length > 0, 'no cluster should be empty');
    }
  });

  it('places near-origin and far points in different clusters', () => {
    const result = kmeans(data, 2, { seed: 1 });
    const { assignments } = result;

    // Points 0-2 share one label, points 3-5 share the other label
    const nearLabel = assignments[0];
    const farLabel = assignments[3];

    assert.notEqual(nearLabel, farLabel, 'the two groups must be in different clusters');
    assert.equal(assignments[1], nearLabel);
    assert.equal(assignments[2], nearLabel);
    assert.equal(assignments[4], farLabel);
    assert.equal(assignments[5], farLabel);
  });
});

// ─── kmeans – result structure ────────────────────────────────────────────────

describe('kmeans – result structure', () => {
  const data = [[0], [1], [2], [10], [11], [12]];
  const k = 2;
  const n = data.length;

  it('clusters.length equals k', () => {
    const result = kmeans(data, k, { seed: 42 });
    assert.equal(result.clusters.length, k);
  });

  it('centroids.length equals k', () => {
    const result = kmeans(data, k, { seed: 42 });
    assert.equal(result.centroids.length, k);
  });

  it('assignments.length equals n (number of data points)', () => {
    const result = kmeans(data, k, { seed: 42 });
    assert.equal(result.assignments.length, n);
  });

  it('all assignments are valid cluster indices', () => {
    const result = kmeans(data, k, { seed: 42 });
    for (const a of result.assignments) {
      assert.ok(a >= 0 && a < k, `assignment ${a} is out of range [0, ${k})`);
    }
  });

  it('clusters arrays together contain every point index exactly once', () => {
    const result = kmeans(data, k, { seed: 42 });
    const allIndices = result.clusters.flat().sort((a, b) => a - b);
    const expected = Array.from({ length: n }, (_, i) => i);
    assert.deepEqual(allIndices, expected);
  });

  it('iterations is a positive integer', () => {
    const result = kmeans(data, k, { seed: 42 });
    assert.ok(Number.isInteger(result.iterations) && result.iterations >= 1);
  });

  it('centroids have the same dimensionality as input points', () => {
    const data2d = [[0, 0], [1, 1], [10, 10], [11, 11]];
    const result = kmeans(data2d, 2, { seed: 1 });
    for (const c of result.centroids) {
      assert.equal(c.length, 2);
    }
  });
});

// ─── kmeans – determinism ─────────────────────────────────────────────────────

describe('kmeans – determinism with seed', () => {
  const data = [
    [0, 0], [1, 0], [2, 0],
    [100, 0], [101, 0], [102, 0],
  ];

  it('produces the same assignments for the same seed', () => {
    const r1 = kmeans(data, 2, { seed: 7 });
    const r2 = kmeans(data, 2, { seed: 7 });
    assert.deepEqual(r1.assignments, r2.assignments);
  });

  it('produces the same centroids for the same seed', () => {
    const r1 = kmeans(data, 2, { seed: 7 });
    const r2 = kmeans(data, 2, { seed: 7 });
    assert.deepEqual(r1.centroids, r2.centroids);
  });
});

// ─── kmeans – edge cases ──────────────────────────────────────────────────────

describe('kmeans – k = 1 (single cluster)', () => {
  const data = [[1, 2], [3, 4], [5, 6]];

  it('puts every point in the one cluster', () => {
    const result = kmeans(data, 1, { seed: 1 });
    assert.equal(result.clusters.length, 1);
    assert.equal(result.clusters[0].length, data.length);
  });

  it('all assignments equal 0', () => {
    const result = kmeans(data, 1, { seed: 1 });
    for (const a of result.assignments) {
      assert.equal(a, 0);
    }
  });
});

describe('kmeans – k = n (each point in its own cluster)', () => {
  const data = [[0], [10], [20], [30]];

  it('produces n singleton clusters', () => {
    const result = kmeans(data, data.length, { seed: 1 });
    assert.equal(result.clusters.length, data.length);
    for (const cluster of result.clusters) {
      assert.equal(cluster.length, 1);
    }
  });
});

// ─── silhouetteScore ─────────────────────────────────────────────────────────

describe('silhouetteScore', () => {
  it('returns 0 for a single data point', () => {
    const score = silhouetteScore([[1, 2]], [0]);
    assert.equal(score, 0);
  });

  it('returns 0 when all points share one cluster', () => {
    const data = [[0], [1], [2]];
    const assignments = [0, 0, 0];
    assert.equal(silhouetteScore(data, assignments), 0);
  });

  it('returns a value in the range [-1, 1] for a normal clustering', () => {
    const data = [
      [0, 0], [1, 0], [2, 0],
      [100, 0], [101, 0], [102, 0],
    ];
    const { assignments } = kmeans(data, 2, { seed: 1 });
    const score = silhouetteScore(data, assignments);
    assert.ok(score >= -1 && score <= 1, `score ${score} out of [-1, 1]`);
  });

  it('returns a high score (> 0.9) for well-separated clusters', () => {
    // Points are 1 000 units apart – separation dominates intra-cluster spread.
    const data = [
      [0, 0], [1, 0], [0, 1],
      [1000, 0], [1001, 0], [1000, 1],
    ];
    const { assignments } = kmeans(data, 2, { seed: 1 });
    const score = silhouetteScore(data, assignments);
    assert.ok(score > 0.9, `expected score > 0.9, got ${score}`);
  });

  it('handles two-point dataset (one point per cluster)', () => {
    // Each point is its own cluster; score should be finite and in [-1,1].
    const score = silhouetteScore([[0], [100]], [0, 1]);
    assert.ok(score >= -1 && score <= 1);
  });
});

// ─── createKMeans factory ─────────────────────────────────────────────────────

describe('createKMeans', () => {
  it('returns an object with a fit method', () => {
    const estimator = createKMeans(2);
    assert.equal(typeof estimator.fit, 'function');
  });

  it('fit() returns a valid KMeansResult', () => {
    const data = [[0, 0], [1, 0], [10, 0], [11, 0]];
    const estimator = createKMeans(2, { maxIterations: 100 });
    const result = estimator.fit(data);

    assert.equal(result.clusters.length, 2);
    assert.equal(result.centroids.length, 2);
    assert.equal(result.assignments.length, data.length);
    assert.ok(Number.isInteger(result.iterations) && result.iterations >= 1);
  });

  it('factory respects k when clustering', () => {
    const data = [[0], [1], [2], [10], [11], [12]];
    const k = 3;
    const estimator = createKMeans(k, { maxIterations: 50 });
    const result = estimator.fit(data);
    assert.equal(result.clusters.length, k);
    assert.equal(result.centroids.length, k);
  });

  it('fit() can be called multiple times independently', () => {
    const estimator = createKMeans(2, { maxIterations: 50 });
    const data = [[0], [1], [100], [101]];
    const r1 = estimator.fit(data);
    const r2 = estimator.fit(data);
    assert.deepEqual(r1.clusters.length, r2.clusters.length);
    assert.deepEqual(r1.centroids.length, r2.centroids.length);
  });
});
