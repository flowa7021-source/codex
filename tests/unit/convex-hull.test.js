// ─── Unit Tests: convex-hull ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  convexHull,
  isInsideHull,
  hullArea,
  hullPerimeter,
  createConvexHull,
} from '../../app/modules/convex-hull.js';

// ─── convexHull ──────────────────────────────────────────────────────────────

describe('convexHull', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(convexHull([]), []);
  });

  it('returns single point for one-point input', () => {
    const pts = [{ x: 3, y: 4 }];
    assert.deepEqual(convexHull(pts), [{ x: 3, y: 4 }]);
  });

  it('returns both points for two-point input', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const hull = convexHull(pts);
    assert.equal(hull.length, 2);
  });

  it('computes hull of a square', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const hull = convexHull(pts);
    assert.equal(hull.length, 4);
  });

  it('excludes interior points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
      { x: 2, y: 2 }, // interior
    ];
    const hull = convexHull(pts);
    assert.equal(hull.length, 4);
  });

  it('returns hull in CCW order', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const hull = convexHull(pts);
    // Verify CCW by checking cross products are all >= 0
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      const c = hull[(i + 2) % hull.length];
      const cp = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      assert.ok(cp >= 0, `Cross product at index ${i} should be >= 0, got ${cp}`);
    }
  });

  it('handles collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const hull = convexHull(pts);
    // Collinear points — hull is just the two endpoints
    assert.equal(hull.length, 2);
  });

  it('handles triangle correctly', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 2, y: 4 },
    ];
    const hull = convexHull(pts);
    assert.equal(hull.length, 3);
  });
});

// ─── isInsideHull ────────────────────────────────────────────────────────────

describe('isInsideHull', () => {
  const square = convexHull([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ]);

  it('returns true for a point inside', () => {
    assert.ok(isInsideHull(square, { x: 2, y: 2 }));
  });

  it('returns true for a point on the boundary', () => {
    assert.ok(isInsideHull(square, { x: 0, y: 2 }));
  });

  it('returns false for a point outside', () => {
    assert.equal(isInsideHull(square, { x: 5, y: 5 }), false);
  });

  it('returns false for empty hull', () => {
    assert.equal(isInsideHull([], { x: 0, y: 0 }), false);
  });

  it('returns true for single-point hull matching', () => {
    assert.ok(isInsideHull([{ x: 1, y: 1 }], { x: 1, y: 1 }));
  });

  it('returns false for single-point hull not matching', () => {
    assert.equal(isInsideHull([{ x: 1, y: 1 }], { x: 2, y: 2 }), false);
  });
});

// ─── hullArea ────────────────────────────────────────────────────────────────

describe('hullArea', () => {
  it('returns 0 for fewer than 3 points', () => {
    assert.equal(hullArea([]), 0);
    assert.equal(hullArea([{ x: 0, y: 0 }]), 0);
    assert.equal(hullArea([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
  });

  it('computes area of a unit square', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    assert.equal(hullArea(hull), 1);
  });

  it('computes area of a right triangle', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ]);
    assert.equal(hullArea(hull), 6);
  });

  it('computes area of a larger rectangle', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]);
    assert.equal(hullArea(hull), 50);
  });
});

// ─── hullPerimeter ───────────────────────────────────────────────────────────

describe('hullPerimeter', () => {
  it('returns 0 for fewer than 2 points', () => {
    assert.equal(hullPerimeter([]), 0);
    assert.equal(hullPerimeter([{ x: 0, y: 0 }]), 0);
  });

  it('computes perimeter of a unit square', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    const p = hullPerimeter(hull);
    assert.ok(Math.abs(p - 4) < 1e-9, `Expected 4, got ${p}`);
  });

  it('computes perimeter of a 3-4-5 triangle', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ]);
    const p = hullPerimeter(hull);
    assert.ok(Math.abs(p - 12) < 1e-9, `Expected 12, got ${p}`);
  });
});

// ─── createConvexHull ────────────────────────────────────────────────────────

describe('createConvexHull', () => {
  it('returns hull, area, and perimeter', () => {
    const result = createConvexHull([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 0, y: 4 },
    ]);
    assert.equal(result.hull.length, 4);
    assert.equal(result.area, 12);
    assert.ok(Math.abs(result.perimeter - 14) < 1e-9);
  });

  it('handles interior points in factory', () => {
    const result = createConvexHull([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
      { x: 3, y: 3 }, // interior
      { x: 1, y: 1 }, // interior
    ]);
    assert.equal(result.hull.length, 4);
    assert.equal(result.area, 36);
    assert.ok(Math.abs(result.perimeter - 24) < 1e-9);
  });
});
