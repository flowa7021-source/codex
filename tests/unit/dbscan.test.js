// ─── Unit Tests: DBSCAN Clustering ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { manhattanDistance, dbscan, createDBSCAN } from '../../app/modules/dbscan.js';

// ─── manhattanDistance ────────────────────────────────────────────────────────

describe('manhattanDistance – basic cases', () => {
  it('returns 0 for identical 1-D points', () => {
    assert.equal(manhattanDistance([3], [3]), 0);
  });

  it('computes correct distance for 1-D points', () => {
    assert.equal(manhattanDistance([1], [4]), 3);
    assert.equal(manhattanDistance([4], [1]), 3);
  });

  it('computes correct distance for 2-D points', () => {
    // |3-1| + |4-1| = 2 + 3 = 5
    assert.equal(manhattanDistance([3, 4], [1, 1]), 5);
  });

  it('computes correct distance for 3-D points', () => {
    // |1-4| + |2-6| + |3-8| = 3 + 4 + 5 = 12
    assert.equal(manhattanDistance([1, 2, 3], [4, 6, 8]), 12);
  });

  it('handles negative coordinates', () => {
    // |-3 - 3| + |-4 - 4| = 6 + 8 = 14
    assert.equal(manhattanDistance([-3, -4], [3, 4]), 14);
  });

  it('handles zero vectors', () => {
    assert.equal(manhattanDistance([0, 0], [0, 0]), 0);
  });

  it('handles floating-point coordinates', () => {
    // |0.5 - 0.1| + |0.9 - 0.4| = 0.4 + 0.5 = 0.9
    assert.ok(Math.abs(manhattanDistance([0.5, 0.9], [0.1, 0.4]) - 0.9) < 1e-10);
  });
});

describe('manhattanDistance – throws on mismatched lengths', () => {
  it('throws when second vector is longer', () => {
    assert.throws(
      () => manhattanDistance([1, 2], [1, 2, 3]),
      /same dimensionality/i,
    );
  });

  it('throws when first vector is longer', () => {
    assert.throws(
      () => manhattanDistance([1, 2, 3], [1, 2]),
      /same dimensionality/i,
    );
  });

  it('throws when one vector is empty and the other is not', () => {
    assert.throws(
      () => manhattanDistance([], [1]),
      /same dimensionality/i,
    );
  });
});

// ─── dbscan – validation ──────────────────────────────────────────────────────

describe('dbscan – parameter validation', () => {
  it('throws when epsilon is zero', () => {
    assert.throws(
      () => dbscan([[0, 0]], 0, 1),
      /epsilon/i,
    );
  });

  it('throws when epsilon is negative', () => {
    assert.throws(
      () => dbscan([[0, 0]], -1, 1),
      /epsilon/i,
    );
  });

  it('throws when minPoints is zero', () => {
    assert.throws(
      () => dbscan([[0, 0]], 1, 0),
      /minPoints/i,
    );
  });

  it('throws when minPoints is negative', () => {
    assert.throws(
      () => dbscan([[0, 0]], 1, -5),
      /minPoints/i,
    );
  });

  it('throws when minPoints is a non-integer', () => {
    assert.throws(
      () => dbscan([[0, 0]], 1, 1.5),
      /minPoints/i,
    );
  });

  it('accepts minPoints = 1 (valid boundary)', () => {
    assert.doesNotThrow(() => dbscan([[0, 0]], 1, 1));
  });

  it('accepts a small positive epsilon', () => {
    assert.doesNotThrow(() => dbscan([[0, 0]], 0.001, 1));
  });
});

// ─── dbscan – empty data ──────────────────────────────────────────────────────

describe('dbscan – empty dataset', () => {
  it('returns empty clusters, noise and assignments for empty input', () => {
    const result = dbscan([], 1, 1);
    assert.deepEqual(result.clusters, []);
    assert.deepEqual(result.noise, []);
    assert.deepEqual(result.assignments, []);
  });
});

// ─── dbscan – single point ────────────────────────────────────────────────────

describe('dbscan – single point', () => {
  it('classifies the lone point as noise when minPoints > 1', () => {
    // A single point has only 1 neighbor (itself), which is < minPoints=2.
    const result = dbscan([[5, 5]], 2, 2);
    assert.deepEqual(result.clusters, []);
    assert.deepEqual(result.noise, [0]);
    assert.deepEqual(result.assignments, [-1]);
  });

  it('classifies the lone point as a cluster member when minPoints = 1', () => {
    // With minPoints=1 the point forms its own cluster.
    const result = dbscan([[5, 5]], 2, 1);
    assert.equal(result.clusters.length, 1);
    assert.ok(result.clusters[0].includes(0));
    assert.deepEqual(result.noise, []);
    assert.equal(result.assignments[0], 0);
  });
});

// ─── dbscan – well-separated clusters ────────────────────────────────────────

describe('dbscan – well-separated clusters', () => {
  // Two tight groups and one isolated noise point.
  //
  // Cluster A (indices 0-2): points near [0, 0]
  //   [0,0], [0.5,0], [0,0.5]   — all within Euclidean distance 1 of each other
  //
  // Cluster B (indices 3-5): points near [10, 10]
  //   [10,10], [10.5,10], [10,10.5]
  //
  // Noise (index 6): [100, 100]   — far from everything
  //
  // Parameters: epsilon=2, minPoints=2
  const clusterA = [[0, 0], [0.5, 0], [0, 0.5]];
  const clusterB = [[10, 10], [10.5, 10], [10, 10.5]];
  const noisePoint = [[100, 100]];
  const data = [...clusterA, ...clusterB, ...noisePoint];
  // Indices: 0,1,2 → cluster A | 3,4,5 → cluster B | 6 → noise

  it('finds exactly two clusters', () => {
    const { clusters } = dbscan(data, 2, 2);
    assert.equal(clusters.length, 2);
  });

  it('noise array contains only the isolated point', () => {
    const { noise } = dbscan(data, 2, 2);
    assert.deepEqual(noise, [6]);
  });

  it('assignments length equals data length', () => {
    const { assignments } = dbscan(data, 2, 2);
    assert.equal(assignments.length, data.length);
  });

  it('noise point has assignment -1', () => {
    const { assignments } = dbscan(data, 2, 2);
    assert.equal(assignments[6], -1);
  });

  it('all cluster-A indices are in the same cluster', () => {
    const { assignments } = dbscan(data, 2, 2);
    const cA = assignments[0];
    assert.notEqual(cA, -1);
    assert.equal(assignments[1], cA);
    assert.equal(assignments[2], cA);
  });

  it('all cluster-B indices are in the same cluster', () => {
    const { assignments } = dbscan(data, 2, 2);
    const cB = assignments[3];
    assert.notEqual(cB, -1);
    assert.equal(assignments[4], cB);
    assert.equal(assignments[5], cB);
  });

  it('the two clusters have different ids', () => {
    const { assignments } = dbscan(data, 2, 2);
    assert.notEqual(assignments[0], assignments[3]);
  });

  it('every cluster contains the correct point indices', () => {
    const { clusters, assignments } = dbscan(data, 2, 2);
    const cA = assignments[0];
    const cB = assignments[3];
    // Each cluster array should contain exactly indices 0,1,2 or 3,4,5
    assert.deepEqual([...clusters[cA]].sort((a, b) => a - b), [0, 1, 2]);
    assert.deepEqual([...clusters[cB]].sort((a, b) => a - b), [3, 4, 5]);
  });
});

// ─── dbscan – noise detection ─────────────────────────────────────────────────

describe('dbscan – noise detection', () => {
  it('multiple isolated points are all classified as noise', () => {
    // Each point is far from every other — none will reach minPoints=3 neighbours.
    const data = [[0, 0], [50, 50], [100, 0], [0, 100]];
    const { clusters, noise } = dbscan(data, 1, 3);
    assert.equal(clusters.length, 0);
    assert.deepEqual(noise.sort((a, b) => a - b), [0, 1, 2, 3]);
  });

  it('border point initially marked noise is re-assigned to cluster', () => {
    // Point layout (1-D):
    //   [0], [1], [2]   — all within epsilon=1.5 of at least one neighbour
    //   [20]            — isolated noise
    //
    // With minPoints=2, points 0,1,2 form one cluster; point 3 is noise.
    const data = [[0], [1], [2], [20]];
    const { clusters, noise, assignments } = dbscan(data, 1.5, 2);
    assert.equal(clusters.length, 1);
    assert.deepEqual(noise, [3]);
    assert.equal(assignments[0], 0);
    assert.equal(assignments[1], 0);
    assert.equal(assignments[2], 0);
    assert.equal(assignments[3], -1);
  });
});

// ─── dbscan – assignments integrity ──────────────────────────────────────────

describe('dbscan – assignments integrity', () => {
  it('assignments length always equals data length', () => {
    const sizes = [0, 1, 5, 20];
    for (const n of sizes) {
      const data = Array.from({ length: n }, (_, i) => [i * 50]);
      const { assignments } = dbscan(data, 1, 2);
      assert.equal(assignments.length, n, `failed for n=${n}`);
    }
  });

  it('every assignment is either -1 or a valid cluster index', () => {
    const data = [[0, 0], [1, 0], [0, 1], [50, 50], [51, 50], [200, 200]];
    const { clusters, assignments } = dbscan(data, 2, 2);
    for (const a of assignments) {
      assert.ok(a === -1 || (a >= 0 && a < clusters.length), `invalid assignment: ${a}`);
    }
  });

  it('cluster indices in assignments are consistent with clusters array', () => {
    const data = [[0, 0], [1, 0], [10, 10], [11, 10]];
    const { clusters, assignments } = dbscan(data, 2, 2);
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] >= 0) {
        assert.ok(
          clusters[assignments[i]].includes(i),
          `point ${i} assigned to cluster ${assignments[i]} but not found in it`,
        );
      }
    }
  });
});

// ─── dbscan – cluster member uniqueness ──────────────────────────────────────

describe('dbscan – cluster member uniqueness', () => {
  it('each point index appears at most once across all clusters', () => {
    const data = [
      [0, 0], [0.5, 0], [0, 0.5],
      [10, 10], [10.5, 10], [10, 10.5],
      [100, 100],
    ];
    const { clusters } = dbscan(data, 2, 2);
    const allMembers = clusters.flat();
    const unique = new Set(allMembers);
    assert.equal(allMembers.length, unique.size);
  });

  it('no index appears in both a cluster and the noise array', () => {
    const data = [
      [0, 0], [1, 0],
      [100, 100],
    ];
    const { clusters, noise } = dbscan(data, 2, 2);
    const clusterSet = new Set(clusters.flat());
    for (const ni of noise) {
      assert.ok(!clusterSet.has(ni), `index ${ni} appears in both cluster and noise`);
    }
  });

  it('every data index appears exactly once (cluster or noise)', () => {
    const data = [[0, 0], [1, 0], [0, 1], [50, 50], [200, 200]];
    const { clusters, noise } = dbscan(data, 2, 2);
    const all = [...clusters.flat(), ...noise].sort((a, b) => a - b);
    const expected = data.map((_, i) => i);
    assert.deepEqual(all, expected);
  });
});

// ─── dbscan – all points form one cluster ────────────────────────────────────

describe('dbscan – single cluster covering all points', () => {
  it('returns one cluster and no noise when all points are tightly packed', () => {
    const data = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]];
    const { clusters, noise } = dbscan(data, 2, 2);
    assert.equal(clusters.length, 1);
    assert.deepEqual(noise, []);
    assert.deepEqual(clusters[0].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  });
});

// ─── createDBSCAN factory ─────────────────────────────────────────────────────

describe('createDBSCAN – factory', () => {
  it('returns an object with a fit method', () => {
    const estimator = createDBSCAN(2, 2);
    assert.equal(typeof estimator, 'object');
    assert.equal(typeof estimator.fit, 'function');
  });

  it('fit returns a DBSCANResult with clusters, noise and assignments', () => {
    const estimator = createDBSCAN(2, 2);
    const result = estimator.fit([[0, 0], [1, 0], [100, 100]]);
    assert.ok(Array.isArray(result.clusters));
    assert.ok(Array.isArray(result.noise));
    assert.ok(Array.isArray(result.assignments));
  });

  it('fit produces the same result as calling dbscan directly', () => {
    const data = [[0, 0], [0.5, 0], [0, 0.5], [10, 10], [100, 100]];
    const direct = dbscan(data, 2, 2);
    const factory = createDBSCAN(2, 2).fit(data);
    assert.deepEqual(factory.clusters, direct.clusters);
    assert.deepEqual(factory.noise, direct.noise);
    assert.deepEqual(factory.assignments, direct.assignments);
  });

  it('can be called multiple times with different datasets', () => {
    const estimator = createDBSCAN(2, 2);

    const r1 = estimator.fit([[0, 0], [1, 0], [100, 100]]);
    assert.equal(r1.clusters.length, 1);
    assert.deepEqual(r1.noise, [2]);

    const r2 = estimator.fit([[0, 0], [1, 0], [2, 0], [50, 50], [51, 50]]);
    assert.equal(r2.clusters.length, 2);
    assert.deepEqual(r2.noise, []);
  });

  it('propagates validation errors from dbscan', () => {
    const badEpsilon = createDBSCAN(-1, 2);
    assert.throws(() => badEpsilon.fit([[0, 0]]), /epsilon/i);

    const badMinPoints = createDBSCAN(1, 0);
    assert.throws(() => badMinPoints.fit([[0, 0]]), /minPoints/i);
  });

  it('fit on empty dataset returns empty result', () => {
    const estimator = createDBSCAN(1, 1);
    const result = estimator.fit([]);
    assert.deepEqual(result.clusters, []);
    assert.deepEqual(result.noise, []);
    assert.deepEqual(result.assignments, []);
  });
});
