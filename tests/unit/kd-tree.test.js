// ─── Unit Tests: kd-tree ──────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KDTree, createKDTree } from '../../app/modules/kd-tree.js';

// ─── constructor ──────────────────────────────────────────────────────────────

describe('KDTree constructor', () => {
  it('builds a tree from an array of 2D points', () => {
    const tree = new KDTree([
      { coords: [2, 3] },
      { coords: [5, 4] },
      { coords: [9, 6] },
    ]);
    assert.equal(tree.size, 3);
    assert.equal(tree.dimensions, 2);
  });

  it('handles an empty points array', () => {
    const tree = new KDTree([]);
    assert.equal(tree.size, 0);
    assert.equal(tree.dimensions, 0);
  });

  it('accepts an explicit k parameter', () => {
    const tree = new KDTree([{ coords: [1, 2, 3] }], 3);
    assert.equal(tree.dimensions, 3);
  });
});

// ─── nearest ──────────────────────────────────────────────────────────────────

describe('KDTree.nearest', () => {
  const points = [
    { coords: [2, 3] },
    { coords: [5, 4] },
    { coords: [9, 6] },
    { coords: [4, 7] },
    { coords: [8, 1] },
    { coords: [7, 2] },
  ];

  it('finds the single nearest neighbor by default', () => {
    const tree = new KDTree(points);
    const result = tree.nearest([5, 5]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].coords, [5, 4]);
  });

  it('finds k nearest neighbors', () => {
    const tree = new KDTree(points);
    const result = tree.nearest([5, 5], 3);
    assert.equal(result.length, 3);
    // Closest should be first
    assert.deepEqual(result[0].coords, [5, 4]);
  });

  it('returns all points when count exceeds size', () => {
    const tree = new KDTree(points);
    const result = tree.nearest([0, 0], 100);
    assert.equal(result.length, points.length);
  });

  it('returns empty array on an empty tree', () => {
    const tree = new KDTree([]);
    const result = tree.nearest([0, 0]);
    assert.deepEqual(result, []);
  });

  it('returns empty array when count is 0', () => {
    const tree = new KDTree(points);
    const result = tree.nearest([0, 0], 0);
    assert.deepEqual(result, []);
  });
});

// ─── rangeSearch ──────────────────────────────────────────────────────────────

describe('KDTree.rangeSearch', () => {
  const points = [
    { coords: [1, 1] },
    { coords: [3, 3] },
    { coords: [5, 5] },
    { coords: [7, 7] },
    { coords: [9, 9] },
  ];

  it('finds all points within the bounding box', () => {
    const tree = new KDTree(points);
    const result = tree.rangeSearch([2, 2], [6, 6]);
    const coordSets = result.map((p) => p.coords);
    assert.ok(coordSets.some((c) => c[0] === 3 && c[1] === 3));
    assert.ok(coordSets.some((c) => c[0] === 5 && c[1] === 5));
  });

  it('includes boundary points', () => {
    const tree = new KDTree(points);
    const result = tree.rangeSearch([1, 1], [1, 1]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].coords, [1, 1]);
  });

  it('returns empty array when no points in range', () => {
    const tree = new KDTree(points);
    const result = tree.rangeSearch([10, 10], [20, 20]);
    assert.deepEqual(result, []);
  });

  it('returns all points when range encompasses everything', () => {
    const tree = new KDTree(points);
    const result = tree.rangeSearch([0, 0], [10, 10]);
    assert.equal(result.length, points.length);
  });
});

// ─── insert ───────────────────────────────────────────────────────────────────

describe('KDTree.insert', () => {
  it('inserts a point into an existing tree', () => {
    const tree = new KDTree([{ coords: [1, 1] }]);
    tree.insert({ coords: [5, 5] });
    assert.equal(tree.size, 2);
    const result = tree.nearest([5, 5]);
    assert.deepEqual(result[0].coords, [5, 5]);
  });

  it('inserts into an empty tree', () => {
    const tree = new KDTree([]);
    tree.insert({ coords: [3, 4] });
    assert.equal(tree.size, 1);
    assert.equal(tree.dimensions, 2);
    const result = tree.nearest([3, 4]);
    assert.deepEqual(result[0].coords, [3, 4]);
  });

  it('maintains correct nearest-neighbor results after inserts', () => {
    const tree = new KDTree([{ coords: [0, 0] }]);
    tree.insert({ coords: [10, 10] });
    tree.insert({ coords: [5, 5] });
    const result = tree.nearest([6, 6]);
    assert.deepEqual(result[0].coords, [5, 5]);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('KDTree.toArray', () => {
  it('returns all points', () => {
    const points = [
      { coords: [1, 2] },
      { coords: [3, 4] },
      { coords: [5, 6] },
    ];
    const tree = new KDTree(points);
    const arr = tree.toArray();
    assert.equal(arr.length, 3);
    // Each original point should be present
    for (const p of points) {
      assert.ok(arr.some((a) => a.coords[0] === p.coords[0] && a.coords[1] === p.coords[1]));
    }
  });

  it('returns empty array for empty tree', () => {
    const tree = new KDTree([]);
    assert.deepEqual(tree.toArray(), []);
  });
});

// ─── createKDTree factory ─────────────────────────────────────────────────────

describe('createKDTree', () => {
  it('returns a KDTree instance', () => {
    const tree = createKDTree([{ coords: [1, 2] }]);
    assert.ok(tree instanceof KDTree);
    assert.equal(tree.size, 1);
  });

  it('passes k parameter through', () => {
    const tree = createKDTree([{ coords: [1, 2, 3] }], 3);
    assert.equal(tree.dimensions, 3);
  });
});

// ─── 3D points ────────────────────────────────────────────────────────────────

describe('KDTree with 3D points', () => {
  it('handles 3-dimensional data', () => {
    const points = [
      { coords: [1, 2, 3] },
      { coords: [4, 5, 6] },
      { coords: [7, 8, 9] },
    ];
    const tree = new KDTree(points);
    assert.equal(tree.dimensions, 3);
    const result = tree.nearest([4, 5, 6]);
    assert.deepEqual(result[0].coords, [4, 5, 6]);
  });

  it('performs range search in 3D', () => {
    const points = [
      { coords: [1, 1, 1] },
      { coords: [5, 5, 5] },
      { coords: [9, 9, 9] },
    ];
    const tree = new KDTree(points);
    const result = tree.rangeSearch([0, 0, 0], [6, 6, 6]);
    assert.equal(result.length, 2);
  });
});

// ─── data payload ─────────────────────────────────────────────────────────────

describe('KDTree with data payload', () => {
  it('preserves the data property through queries', () => {
    const tree = new KDTree([
      { coords: [1, 1], data: 'alpha' },
      { coords: [9, 9], data: 'beta' },
    ]);
    const result = tree.nearest([1, 1]);
    assert.equal(result[0].data, 'alpha');
  });
});
