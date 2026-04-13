// ─── Unit Tests: Convex Hull Algorithms (extended API) ───────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  grahamScan,
  jarvisMarch,
  isConvex,
  minEnclosingCircle,
  closestPair,
  triangulate,
} from '../../app/modules/convex-hull.js';

function approx(actual, expected, eps = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} ≈ ${expected} (±${eps})`,
  );
}

/** Sort points by (x, y) so we can compare hull arrays regardless of start. */
function sortedPoints(pts) {
  return pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
}

/** Check that two hulls contain the same set of vertices (order may differ). */
function sameHull(h1, h2) {
  if (h1.length !== h2.length) return false;
  const s1 = sortedPoints(h1);
  const s2 = sortedPoints(h2);
  return s1.every((p, i) => p.x === s2[i].x && p.y === s2[i].y);
}

// ─── grahamScan ───────────────────────────────────────────────────────────────

describe('grahamScan', () => {
  it('square: returns all 4 corners', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
      { x: 2, y: 2 }, // interior point — should be excluded
    ];
    const hull = grahamScan(pts);
    assert.equal(hull.length, 4);
    // All returned points must be from the original set.
    for (const p of hull) {
      assert.ok(pts.some(q => q.x === p.x && q.y === p.y));
    }
    // The interior point must not appear.
    assert.ok(!hull.some(p => p.x === 2 && p.y === 2));
  });

  it('triangle: returns all 3 vertices', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }];
    const hull = grahamScan(pts);
    assert.equal(hull.length, 3);
  });

  it('single point returns 1-element array', () => {
    const hull = grahamScan([{ x: 1, y: 2 }]);
    assert.equal(hull.length, 1);
  });

  it('two points returns 2-element array', () => {
    const hull = grahamScan([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
    assert.equal(hull.length, 2);
  });

  it('all collinear: hull contains endpoints', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    const hull = grahamScan(pts);
    // For collinear points the hull should include at least the extreme points.
    const hasLeft = hull.some(p => p.x === 0);
    const hasRight = hull.some(p => p.x === 3);
    assert.ok(hasLeft);
    assert.ok(hasRight);
  });

  it('interior points are excluded from a large set', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 },
      { x: 1, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 5 },
    ];
    const hull = grahamScan(pts);
    assert.equal(hull.length, 4);
  });
});

// ─── jarvisMarch ──────────────────────────────────────────────────────────────

describe('jarvisMarch', () => {
  it('square: returns all 4 corners', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
      { x: 2, y: 2 }, // interior
    ];
    const hull = jarvisMarch(pts);
    assert.equal(hull.length, 4);
    assert.ok(!hull.some(p => p.x === 2 && p.y === 2));
  });

  it('triangle: returns all 3 vertices', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }];
    const hull = jarvisMarch(pts);
    assert.equal(hull.length, 3);
  });

  it('single point', () => {
    assert.equal(jarvisMarch([{ x: 1, y: 2 }]).length, 1);
  });

  it('two points', () => {
    assert.equal(jarvisMarch([{ x: 0, y: 0 }, { x: 3, y: 3 }]).length, 2);
  });
});

// ─── grahamScan and jarvisMarch agree ────────────────────────────────────────

describe('grahamScan and jarvisMarch produce the same hull', () => {
  it('random cloud of points', () => {
    const pts = [
      { x: 1, y: 3 }, { x: 2, y: 1 }, { x: 5, y: 2 },
      { x: 4, y: 5 }, { x: 0, y: 4 }, { x: 3, y: 3 },
    ];
    const g = grahamScan(pts);
    const j = jarvisMarch(pts);
    assert.ok(sameHull(g, j), `Graham: ${JSON.stringify(g)}\nJarvis: ${JSON.stringify(j)}`);
  });

  it('pentagon', () => {
    // Vertices of a regular pentagon (roughly).
    const pts = [
      { x: 0, y: 2 }, { x: 1.9, y: 0.6 }, { x: 1.2, y: -1.6 },
      { x: -1.2, y: -1.6 }, { x: -1.9, y: 0.6 },
    ];
    const g = grahamScan(pts);
    const j = jarvisMarch(pts);
    assert.ok(sameHull(g, j));
  });

  it('cloud with interior points', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      { x: 3, y: 4 }, { x: 7, y: 2 }, { x: 5, y: 8 },
    ];
    const g = grahamScan(pts);
    const j = jarvisMarch(pts);
    assert.ok(sameHull(g, j));
  });
});

// ─── isConvex ────────────────────────────────────────────────────────────────

describe('isConvex', () => {
  it('square is convex', () => {
    assert.ok(isConvex([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
    ]));
  });

  it('triangle is convex', () => {
    assert.ok(isConvex([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }]));
  });

  it('L-shape is not convex', () => {
    assert.ok(!isConvex([
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 },
      { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 },
    ]));
  });

  it('fewer than 3 points returns false', () => {
    assert.ok(!isConvex([{ x: 0, y: 0 }, { x: 1, y: 1 }]));
    assert.ok(!isConvex([]));
  });

  it('regular hexagon is convex', () => {
    const r = 2;
    const hex = Array.from({ length: 6 }, (_, i) => ({
      x: r * Math.cos((i * Math.PI) / 3),
      y: r * Math.sin((i * Math.PI) / 3),
    }));
    assert.ok(isConvex(hex));
  });

  it('star shape is not convex', () => {
    // Simple 5-pointed star: alternating inner/outer vertices
    const star = [
      { x: 0, y: 3 }, { x: 1, y: 1 }, { x: 3, y: 1 },
      { x: 1.5, y: -0.5 }, { x: 2, y: -2 }, { x: 0, y: -1 },
      { x: -2, y: -2 }, { x: -1.5, y: -0.5 }, { x: -3, y: 1 },
      { x: -1, y: 1 },
    ];
    assert.ok(!isConvex(star));
  });
});

// ─── minEnclosingCircle ───────────────────────────────────────────────────────

describe('minEnclosingCircle', () => {
  it('single point → radius 0', () => {
    const c = minEnclosingCircle([{ x: 3, y: 4 }]);
    assert.equal(c.radius, 0);
    assert.deepEqual(c.center, { x: 3, y: 4 });
  });

  it('two points → diameter circle', () => {
    const c = minEnclosingCircle([{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    approx(c.radius, 2, 1e-9);
    approx(c.center.x, 2, 1e-9);
    approx(c.center.y, 0, 1e-9);
  });

  it('equilateral triangle → all points on boundary', () => {
    const pts = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) }];
    const c = minEnclosingCircle(pts);
    for (const p of pts) {
      const d = Math.hypot(p.x - c.center.x, p.y - c.center.y);
      approx(d, c.radius, 1e-6);
    }
  });

  it('all points within the circle', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1.5, y: 2 }, { x: 1, y: 1 },
    ];
    const c = minEnclosingCircle(pts);
    for (const p of pts) {
      const d = Math.hypot(p.x - c.center.x, p.y - c.center.y);
      assert.ok(d <= c.radius + 1e-9, `Point (${p.x},${p.y}) outside circle`);
    }
  });

  it('empty input returns zero circle', () => {
    const c = minEnclosingCircle([]);
    assert.equal(c.radius, 0);
  });

  it('collinear points: diameter equals max distance between endpoints', () => {
    const pts = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 0 }];
    const c = minEnclosingCircle(pts);
    approx(c.radius, 3, 1e-6);
  });
});

// ─── closestPair ─────────────────────────────────────────────────────────────

describe('closestPair', () => {
  it('returns null for fewer than 2 points', () => {
    assert.equal(closestPair([]), null);
    assert.equal(closestPair([{ x: 0, y: 0 }]), null);
  });

  it('exactly two points', () => {
    const result = closestPair([{ x: 0, y: 0 }, { x: 3, y: 4 }]);
    assert.ok(result);
    assert.equal(result.distance, 5);
  });

  it('finds the closest pair among several points', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10.5, y: 10 }, { x: 5, y: 5 },
    ];
    const result = closestPair(pts);
    assert.ok(result);
    approx(result.distance, 0.5, 1e-9);
  });

  it('collinear points on x-axis', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 7, y: 0 }];
    const result = closestPair(pts);
    assert.ok(result);
    assert.equal(result.distance, 1);
  });

  it('result distance matches actual distance between returned points', () => {
    const pts = [
      { x: 1, y: 2 }, { x: 4, y: 6 }, { x: 1.1, y: 2.1 },
    ];
    const result = closestPair(pts);
    assert.ok(result);
    const actualDist = Math.hypot(result.a.x - result.b.x, result.a.y - result.b.y);
    approx(result.distance, actualDist, 1e-12);
  });

  it('larger point set', () => {
    // Known closest pair: (5, 5) and (5.1, 5) → dist = 0.1
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 5 }, { x: 5.1, y: 5 },
      { x: 3, y: 8 }, { x: 7, y: 2 },
    ];
    const result = closestPair(pts);
    assert.ok(result);
    approx(result.distance, 0.1, 1e-9);
  });
});

// ─── triangulate ─────────────────────────────────────────────────────────────

describe('triangulate', () => {
  it('fewer than 3 points returns empty array', () => {
    assert.deepEqual(triangulate([]), []);
    assert.deepEqual(triangulate([{ x: 0, y: 0 }]), []);
    assert.deepEqual(triangulate([{ x: 0, y: 0 }, { x: 1, y: 1 }]), []);
  });

  it('3 points → 1 triangle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }];
    const tris = triangulate(pts);
    assert.equal(tris.length, 1);
  });

  it('square hull → 2 triangles', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
      { x: 2, y: 2 }, // interior — hull is still the 4 corners
    ];
    const tris = triangulate(pts);
    assert.equal(tris.length, 2);
  });

  it('each triangle has three distinct vertices', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 },
      { x: 0, y: 5 }, { x: 2, y: 2 },
    ];
    const tris = triangulate(pts);
    for (const t of tris) {
      assert.ok(
        !(t.a.x === t.b.x && t.a.y === t.b.y) &&
        !(t.b.x === t.c.x && t.b.y === t.c.y) &&
        !(t.a.x === t.c.x && t.a.y === t.c.y),
      );
    }
  });

  it('pentagon → 3 triangles', () => {
    const r = 3;
    const pts = Array.from({ length: 5 }, (_, i) => ({
      x: r * Math.cos((2 * Math.PI * i) / 5),
      y: r * Math.sin((2 * Math.PI * i) / 5),
    }));
    const tris = triangulate(pts);
    assert.equal(tris.length, 3);
  });

  it('each triangle result has a, b, c fields', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1.5, y: 2 }];
    const tris = triangulate(pts);
    assert.equal(tris.length, 1);
    const [t] = tris;
    assert.ok('a' in t && 'b' in t && 'c' in t);
    assert.ok('x' in t.a && 'y' in t.a);
  });
});
