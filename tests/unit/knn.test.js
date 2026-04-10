// ─── Unit Tests: KNN ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KNN, createKNN } from '../../app/modules/knn.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('KNN – constructor', () => {
  it('accepts k = 1', () => {
    const knn = new KNN(1);
    assert.equal(knn.k, 1);
  });

  it('accepts k > 1', () => {
    const knn = new KNN(5);
    assert.equal(knn.k, 5);
  });

  it('throws RangeError for k = 0', () => {
    assert.throws(() => new KNN(0), RangeError);
  });

  it('throws RangeError for k < 0', () => {
    assert.throws(() => new KNN(-3), RangeError);
  });

  it('throws RangeError for k = 0.5 (non-integer below 1)', () => {
    assert.throws(() => new KNN(0.5), RangeError);
  });
});

// ─── fit ─────────────────────────────────────────────────────────────────────

describe('KNN – fit', () => {
  it('throws if data is empty', () => {
    const knn = new KNN(1);
    assert.throws(() => knn.fit([], []), { message: /empty/i });
  });

  it('throws if data and labels lengths differ (too many labels)', () => {
    const knn = new KNN(1);
    assert.throws(() => knn.fit([[0, 0]], ['A', 'B']), {
      message: /same length/i,
    });
  });

  it('throws if data and labels lengths differ (too few labels)', () => {
    const knn = new KNN(1);
    assert.throws(() => knn.fit([[0, 0], [1, 1]], ['A']), {
      message: /same length/i,
    });
  });

  it('does not throw for valid data/labels', () => {
    const knn = new KNN(1);
    assert.doesNotThrow(() => knn.fit([[0, 0], [1, 1]], ['A', 'B']));
  });
});

// ─── predict – guard ─────────────────────────────────────────────────────────

describe('KNN – predict guard', () => {
  it('throws if predict called before fit', () => {
    const knn = new KNN(1);
    assert.throws(() => knn.predict([0, 0]), { message: /fitted/i });
  });
});

// ─── predict – 2-class classification ────────────────────────────────────────

describe('KNN – 2-class classification', () => {
  /** Training points clustered around (0,0) → 'A' and (10,10) → 'B'. */
  function makeFittedKNN(k) {
    const knn = new KNN(k);
    knn.fit(
      [
        [0, 0],
        [0.5, 0.5],
        [-0.5, 0.5],
        [10, 10],
        [9.5, 10],
        [10, 9.5],
      ],
      ['A', 'A', 'A', 'B', 'B', 'B'],
    );
    return knn;
  }

  it('classifies [0.5, 0.5] as "A" with k=1', () => {
    const knn = makeFittedKNN(1);
    assert.equal(knn.predict([0.5, 0.5]).label, 'A');
  });

  it('classifies [9.5, 9.5] as "B" with k=1', () => {
    const knn = makeFittedKNN(1);
    assert.equal(knn.predict([9.5, 9.5]).label, 'B');
  });

  it('classifies [0.5, 0.5] as "A" with k=3', () => {
    const knn = makeFittedKNN(3);
    assert.equal(knn.predict([0.5, 0.5]).label, 'A');
  });

  it('classifies [9.5, 9.5] as "B" with k=3', () => {
    const knn = makeFittedKNN(3);
    assert.equal(knn.predict([9.5, 9.5]).label, 'B');
  });
});

// ─── predict – k=1 nearest-neighbor wins ─────────────────────────────────────

describe('KNN – k=1 nearest neighbor', () => {
  it('returns the single closest point label', () => {
    const knn = new KNN(1);
    knn.fit([[0, 0], [5, 0], [10, 0]], [1, 2, 3]);
    assert.equal(knn.predict([4.9, 0]).label, 2);
    assert.equal(knn.predict([0.1, 0]).label, 1);
    assert.equal(knn.predict([9.9, 0]).label, 3);
  });
});

// ─── predict – k=3 majority vote ─────────────────────────────────────────────

describe('KNN – k=3 majority vote', () => {
  it('minority point is overridden by majority', () => {
    const knn = new KNN(3);
    // Three 'A' points clustered near origin, one 'B' right at test point.
    knn.fit(
      [[0, 0], [0.1, 0], [0.2, 0], [0.15, 0]],
      ['A', 'A', 'A', 'B'],
    );
    // The nearest is 'B' at [0.15, 0], but the 2nd and 3rd are 'A' → majority 'A'
    const result = knn.predict([0.15, 0]);
    assert.equal(result.label, 'A');
  });

  it('all three neighbors agree', () => {
    const knn = new KNN(3);
    knn.fit([[1, 0], [2, 0], [3, 0], [100, 0]], ['X', 'X', 'X', 'Y']);
    assert.equal(knn.predict([2, 0]).label, 'X');
  });
});

// ─── KNNResult shape ─────────────────────────────────────────────────────────

describe('KNN – KNNResult shape', () => {
  it('result.neighbors.length === k', () => {
    const knn = new KNN(3);
    knn.fit([[0, 0], [1, 0], [2, 0], [5, 0]], ['A', 'A', 'A', 'B']);
    const result = knn.predict([1, 0]);
    assert.equal(result.neighbors.length, 3);
  });

  it('result.neighbors are sorted by distance ascending', () => {
    const knn = new KNN(3);
    knn.fit([[0, 0], [3, 0], [1, 0]], ['A', 'B', 'C']);
    const result = knn.predict([0.5, 0]);
    const distances = result.neighbors.map(n => n.distance);
    const sorted = [...distances].sort((a, b) => a - b);
    assert.deepEqual(distances, sorted);
  });

  it('result.distance equals the distance to the nearest neighbor', () => {
    const knn = new KNN(2);
    knn.fit([[0, 0], [4, 0]], ['A', 'B']);
    const result = knn.predict([1, 0]);
    assert.ok(Math.abs(result.distance - result.neighbors[0].distance) < 1e-9);
  });

  it('each neighbor has label and distance fields', () => {
    const knn = new KNN(2);
    knn.fit([[0, 0], [1, 0]], ['X', 'Y']);
    const result = knn.predict([0.3, 0]);
    for (const neighbor of result.neighbors) {
      assert.ok('label' in neighbor);
      assert.ok('distance' in neighbor);
      assert.equal(typeof neighbor.distance, 'number');
    }
  });

  it('result.neighbors.length === k when k equals training set size', () => {
    const knn = new KNN(4);
    knn.fit([[0, 0], [1, 0], [2, 0], [3, 0]], ['A', 'B', 'C', 'D']);
    const result = knn.predict([1.5, 0]);
    assert.equal(result.neighbors.length, 4);
  });
});

// ─── predictAll ──────────────────────────────────────────────────────────────

describe('KNN – predictAll', () => {
  it('returns an array with one label per input point', () => {
    const knn = new KNN(1);
    knn.fit([[0, 0], [10, 0]], ['near', 'far']);
    const labels = knn.predictAll([[0.1, 0], [9.9, 0], [0.2, 0]]);
    assert.equal(labels.length, 3);
  });

  it('each label matches the individual predict result', () => {
    const knn = new KNN(1);
    knn.fit([[0, 0], [10, 0]], ['near', 'far']);
    const points = [[0.1, 0], [9.9, 0]];
    const labels = knn.predictAll(points);
    for (let i = 0; i < points.length; i++) {
      assert.equal(labels[i], knn.predict(points[i]).label);
    }
  });

  it('returns empty array for empty input', () => {
    const knn = new KNN(1);
    knn.fit([[0, 0]], ['A']);
    assert.deepEqual(knn.predictAll([]), []);
  });

  it('throws if called before fit', () => {
    const knn = new KNN(1);
    assert.throws(() => knn.predictAll([[0, 0]]), { message: /fitted/i });
  });
});

// ─── createKNN factory ────────────────────────────────────────────────────────

describe('createKNN factory', () => {
  it('returns a KNN instance', () => {
    const knn = createKNN(3);
    assert.ok(knn instanceof KNN);
  });

  it('returned instance has the correct k', () => {
    const knn = createKNN(5);
    assert.equal(knn.k, 5);
  });

  it('throws RangeError for k < 1, same as constructor', () => {
    assert.throws(() => createKNN(0), RangeError);
  });

  it('returned instance can be fitted and used for prediction', () => {
    const knn = createKNN(1);
    knn.fit([[0, 0], [10, 0]], ['A', 'B']);
    assert.equal(knn.predict([0.1, 0]).label, 'A');
  });
});
