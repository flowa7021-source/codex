// ─── Unit Tests: quadtree ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Quadtree, createQuadtree } from '../../app/modules/quadtree.js';

const WORLD = { x: 0, y: 0, width: 100, height: 100 };

// ─── constructor ──────────────────────────────────────────────────────────────

describe('Quadtree constructor', () => {
  it('creates an empty quadtree with the given bounds', () => {
    const qt = new Quadtree(WORLD);
    assert.equal(qt.size, 0);
    assert.deepEqual(qt.bounds, WORLD);
  });

  it('uses default capacity of 4', () => {
    const qt = new Quadtree(WORLD);
    // Insert 4 points — no subdivision yet
    for (let i = 0; i < 4; i++) qt.insert({ x: i, y: i });
    assert.equal(qt.size, 4);
  });

  it('accepts a custom capacity', () => {
    const qt = new Quadtree(WORLD, 2);
    qt.insert({ x: 1, y: 1 });
    qt.insert({ x: 2, y: 2 });
    // 3rd insert triggers subdivision
    qt.insert({ x: 3, y: 3 });
    assert.equal(qt.size, 3);
  });
});

// ─── insert ───────────────────────────────────────────────────────────────────

describe('Quadtree.insert', () => {
  it('inserts a point within bounds', () => {
    const qt = new Quadtree(WORLD);
    assert.equal(qt.insert({ x: 50, y: 50 }), true);
    assert.equal(qt.size, 1);
  });

  it('rejects a point outside bounds', () => {
    const qt = new Quadtree(WORLD);
    assert.equal(qt.insert({ x: 200, y: 200 }), false);
    assert.equal(qt.size, 0);
  });

  it('inserts points on the boundary', () => {
    const qt = new Quadtree(WORLD);
    assert.equal(qt.insert({ x: 0, y: 0 }), true);
    assert.equal(qt.insert({ x: 100, y: 100 }), true);
    assert.equal(qt.size, 2);
  });

  it('handles many points with subdivision', () => {
    const qt = new Quadtree(WORLD, 2);
    for (let i = 0; i < 50; i++) {
      qt.insert({ x: Math.random() * 100, y: Math.random() * 100 });
    }
    assert.equal(qt.size, 50);
  });
});

// ─── query ────────────────────────────────────────────────────────────────────

describe('Quadtree.query', () => {
  it('returns points within the query range', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 10, y: 10 });
    qt.insert({ x: 50, y: 50 });
    qt.insert({ x: 90, y: 90 });
    const result = qt.query({ x: 0, y: 0, width: 30, height: 30 });
    assert.equal(result.length, 1);
    assert.equal(result[0].x, 10);
  });

  it('returns empty array when no points in range', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 10, y: 10 });
    const result = qt.query({ x: 80, y: 80, width: 10, height: 10 });
    assert.deepEqual(result, []);
  });

  it('returns all points when range covers everything', () => {
    const qt = new Quadtree(WORLD);
    for (let i = 0; i <= 10; i++) qt.insert({ x: i * 10, y: i * 10 });
    const result = qt.query(WORLD);
    assert.equal(result.length, 11);
  });

  it('works correctly after subdivision', () => {
    const qt = new Quadtree(WORLD, 2);
    qt.insert({ x: 10, y: 10 });
    qt.insert({ x: 20, y: 20 });
    qt.insert({ x: 30, y: 30 });
    qt.insert({ x: 60, y: 60 });
    qt.insert({ x: 80, y: 80 });
    const result = qt.query({ x: 0, y: 0, width: 35, height: 35 });
    assert.equal(result.length, 3);
  });
});

// ─── queryRadius ──────────────────────────────────────────────────────────────

describe('Quadtree.queryRadius', () => {
  it('returns points within the specified radius', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 50, y: 50 });
    qt.insert({ x: 51, y: 51 });
    qt.insert({ x: 90, y: 90 });
    const result = qt.queryRadius(50, 50, 5);
    assert.equal(result.length, 2);
  });

  it('excludes points outside the radius but inside bounding box', () => {
    const qt = new Quadtree(WORLD);
    // Point at corner of bounding box but outside radius circle
    qt.insert({ x: 54, y: 54 }); // dist from (50,50) = sqrt(32) ≈ 5.66
    const result = qt.queryRadius(50, 50, 5);
    assert.equal(result.length, 0);
  });

  it('returns empty array with no matches', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 90, y: 90 });
    const result = qt.queryRadius(10, 10, 5);
    assert.deepEqual(result, []);
  });
});

// ─── has ──────────────────────────────────────────────────────────────────────

describe('Quadtree.has', () => {
  it('returns true for an inserted point', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 42, y: 42 });
    assert.equal(qt.has({ x: 42, y: 42 }), true);
  });

  it('returns false for a point not inserted', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 42, y: 42 });
    assert.equal(qt.has({ x: 43, y: 43 }), false);
  });

  it('returns false for a point outside bounds', () => {
    const qt = new Quadtree(WORLD);
    assert.equal(qt.has({ x: 200, y: 200 }), false);
  });

  it('finds points after subdivision', () => {
    const qt = new Quadtree(WORLD, 2);
    qt.insert({ x: 10, y: 10 });
    qt.insert({ x: 20, y: 20 });
    qt.insert({ x: 80, y: 80 });
    assert.equal(qt.has({ x: 80, y: 80 }), true);
    assert.equal(qt.has({ x: 50, y: 50 }), false);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('Quadtree.clear', () => {
  it('removes all points', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 1, y: 1 });
    qt.insert({ x: 2, y: 2 });
    qt.clear();
    assert.equal(qt.size, 0);
    assert.deepEqual(qt.toArray(), []);
  });

  it('allows re-insertion after clear', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 1, y: 1 });
    qt.clear();
    qt.insert({ x: 99, y: 99 });
    assert.equal(qt.size, 1);
    assert.equal(qt.toArray()[0].x, 99);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('Quadtree.toArray', () => {
  it('returns all inserted points', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 10, y: 20 });
    qt.insert({ x: 30, y: 40 });
    const arr = qt.toArray();
    assert.equal(arr.length, 2);
  });

  it('returns empty array for empty tree', () => {
    const qt = new Quadtree(WORLD);
    assert.deepEqual(qt.toArray(), []);
  });

  it('includes points from all subdivisions', () => {
    const qt = new Quadtree(WORLD, 1);
    qt.insert({ x: 10, y: 10 });
    qt.insert({ x: 90, y: 10 });
    qt.insert({ x: 10, y: 90 });
    qt.insert({ x: 90, y: 90 });
    const arr = qt.toArray();
    assert.equal(arr.length, 4);
  });
});

// ─── createQuadtree factory ───────────────────────────────────────────────────

describe('createQuadtree', () => {
  it('returns a Quadtree instance', () => {
    const qt = createQuadtree(WORLD);
    assert.ok(qt instanceof Quadtree);
    assert.equal(qt.size, 0);
  });

  it('passes capacity through', () => {
    const qt = createQuadtree(WORLD, 8);
    // Insert 8 points — should not subdivide
    for (let i = 0; i < 8; i++) qt.insert({ x: i * 10, y: i * 10 });
    assert.equal(qt.size, 8);
  });
});

// ─── data payload ─────────────────────────────────────────────────────────────

describe('Quadtree with data payload', () => {
  it('preserves the data property through queries', () => {
    const qt = new Quadtree(WORLD);
    qt.insert({ x: 25, y: 25, data: 'hello' });
    qt.insert({ x: 75, y: 75, data: 'world' });
    const result = qt.query({ x: 0, y: 0, width: 50, height: 50 });
    assert.equal(result.length, 1);
    assert.equal(result[0].data, 'hello');
  });
});
