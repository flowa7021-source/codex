// ─── Unit Tests: geometry-utils ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  distance,
  midpoint,
  angle,
  rotate,
  scale,
  translate,
  lineLength,
  pointOnLine,
  lineIntersect,
  pointInRect,
  pointInCircle,
  circleIntersect,
  rectIntersect,
  polygonArea,
  isConvex,
} from '../../app/modules/geometry-utils.js';

const EPSILON = 1e-9;
const approxEqual = (a, b) => Math.abs(a - b) < EPSILON;

// ─── distance ────────────────────────────────────────────────────────────────

describe('distance', () => {
  it('3-4-5 Pythagorean triple', () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });

  it('same point → 0', () => {
    assert.equal(distance({ x: 7, y: -3 }, { x: 7, y: -3 }), 0);
  });

  it('horizontal line', () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 5, y: 0 }), 5);
  });

  it('vertical line', () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 0, y: 12 }), 12);
  });

  it('works with negative coordinates', () => {
    assert.equal(distance({ x: -3, y: 0 }, { x: 0, y: 4 }), 5);
  });
});

// ─── midpoint ────────────────────────────────────────────────────────────────

describe('midpoint', () => {
  it('midpoint of origin and (2, 4) is (1, 2)', () => {
    assert.deepEqual(midpoint({ x: 0, y: 0 }, { x: 2, y: 4 }), { x: 1, y: 2 });
  });

  it('midpoint of two identical points is the same point', () => {
    assert.deepEqual(midpoint({ x: 3, y: 5 }, { x: 3, y: 5 }), { x: 3, y: 5 });
  });

  it('works with negative values', () => {
    assert.deepEqual(midpoint({ x: -4, y: -2 }, { x: 4, y: 2 }), { x: 0, y: 0 });
  });
});

// ─── angle ───────────────────────────────────────────────────────────────────

describe('angle', () => {
  it('east direction → 0', () => {
    assert.ok(approxEqual(angle({ x: 0, y: 0 }, { x: 1, y: 0 }), 0));
  });

  it('north direction → -π/2 (y-axis down convention in screen coords)', () => {
    // atan2(-1, 0) = -π/2
    assert.ok(approxEqual(angle({ x: 0, y: 0 }, { x: 0, y: -1 }), -Math.PI / 2));
  });

  it('south direction → π/2', () => {
    assert.ok(approxEqual(angle({ x: 0, y: 0 }, { x: 0, y: 1 }), Math.PI / 2));
  });

  it('west direction → π', () => {
    assert.ok(approxEqual(angle({ x: 0, y: 0 }, { x: -1, y: 0 }), Math.PI));
  });

  it('45° diagonal', () => {
    assert.ok(approxEqual(angle({ x: 0, y: 0 }, { x: 1, y: 1 }), Math.PI / 4));
  });
});

// ─── rotate ──────────────────────────────────────────────────────────────────

describe('rotate', () => {
  it('rotation by 0 leaves point unchanged', () => {
    const result = rotate({ x: 3, y: 0 }, { x: 0, y: 0 }, 0);
    assert.ok(approxEqual(result.x, 3));
    assert.ok(approxEqual(result.y, 0));
  });

  it('rotate (1,0) by π/2 around origin → (0,1)', () => {
    const result = rotate({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    assert.ok(approxEqual(result.x, 0));
    assert.ok(approxEqual(result.y, 1));
  });

  it('rotate (1,0) by π around origin → (-1,0)', () => {
    const result = rotate({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI);
    assert.ok(approxEqual(result.x, -1));
    assert.ok(approxEqual(result.y, 0));
  });

  it('rotate around non-origin point', () => {
    // rotate (2,1) by π/2 around (1,1) → (1,2)
    const result = rotate({ x: 2, y: 1 }, { x: 1, y: 1 }, Math.PI / 2);
    assert.ok(approxEqual(result.x, 1));
    assert.ok(approxEqual(result.y, 2));
  });

  it('rotation by 2π is identity', () => {
    const result = rotate({ x: 5, y: 3 }, { x: 1, y: 2 }, 2 * Math.PI);
    assert.ok(approxEqual(result.x, 5));
    assert.ok(approxEqual(result.y, 3));
  });
});

// ─── scale ───────────────────────────────────────────────────────────────────

describe('scale', () => {
  it('scale by 2 from origin doubles coordinates', () => {
    assert.deepEqual(scale({ x: 3, y: 4 }, 2), { x: 6, y: 8 });
  });

  it('scale by 1 leaves point unchanged', () => {
    assert.deepEqual(scale({ x: 3, y: 4 }, 1), { x: 3, y: 4 });
  });

  it('scale by 0 collapses to origin', () => {
    assert.deepEqual(scale({ x: 5, y: 7 }, 0), { x: 0, y: 0 });
  });

  it('scale relative to custom origin', () => {
    // point (3,3), origin (1,1), factor 2 → (5,5)
    const result = scale({ x: 3, y: 3 }, 2, { x: 1, y: 1 });
    assert.deepEqual(result, { x: 5, y: 5 });
  });

  it('scale by 0.5 halves distance from origin', () => {
    assert.deepEqual(scale({ x: 4, y: 6 }, 0.5), { x: 2, y: 3 });
  });
});

// ─── translate ───────────────────────────────────────────────────────────────

describe('translate', () => {
  it('translate by (0,0) leaves point unchanged', () => {
    assert.deepEqual(translate({ x: 3, y: 4 }, 0, 0), { x: 3, y: 4 });
  });

  it('translate by positive delta', () => {
    assert.deepEqual(translate({ x: 1, y: 2 }, 3, 4), { x: 4, y: 6 });
  });

  it('translate by negative delta', () => {
    assert.deepEqual(translate({ x: 5, y: 5 }, -2, -3), { x: 3, y: 2 });
  });
});

// ─── lineLength ──────────────────────────────────────────────────────────────

describe('lineLength', () => {
  it('3-4-5 triangle', () => {
    assert.equal(lineLength({ p1: { x: 0, y: 0 }, p2: { x: 3, y: 4 } }), 5);
  });

  it('zero-length line', () => {
    assert.equal(lineLength({ p1: { x: 2, y: 2 }, p2: { x: 2, y: 2 } }), 0);
  });

  it('horizontal line of length 7', () => {
    assert.equal(lineLength({ p1: { x: 0, y: 3 }, p2: { x: 7, y: 3 } }), 7);
  });
});

// ─── pointOnLine ─────────────────────────────────────────────────────────────

describe('pointOnLine', () => {
  const line = { p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } };

  it('t=0 → p1', () => {
    assert.deepEqual(pointOnLine(line, 0), { x: 0, y: 0 });
  });

  it('t=1 → p2', () => {
    assert.deepEqual(pointOnLine(line, 1), { x: 10, y: 10 });
  });

  it('t=0.5 → midpoint', () => {
    assert.deepEqual(pointOnLine(line, 0.5), { x: 5, y: 5 });
  });

  it('t=0.25', () => {
    assert.deepEqual(pointOnLine(line, 0.25), { x: 2.5, y: 2.5 });
  });
});

// ─── lineIntersect ───────────────────────────────────────────────────────────

describe('lineIntersect', () => {
  it('perpendicular lines at origin', () => {
    const l1 = { p1: { x: -1, y: 0 }, p2: { x: 1, y: 0 } }; // horizontal
    const l2 = { p1: { x: 0, y: -1 }, p2: { x: 0, y: 1 } }; // vertical
    const pt = lineIntersect(l1, l2);
    assert.ok(pt !== null);
    assert.ok(approxEqual(pt.x, 0));
    assert.ok(approxEqual(pt.y, 0));
  });

  it('diagonal lines crossing at (1,1)', () => {
    const l1 = { p1: { x: 0, y: 0 }, p2: { x: 2, y: 2 } };
    const l2 = { p1: { x: 0, y: 2 }, p2: { x: 2, y: 0 } };
    const pt = lineIntersect(l1, l2);
    assert.ok(pt !== null);
    assert.ok(approxEqual(pt.x, 1));
    assert.ok(approxEqual(pt.y, 1));
  });

  it('parallel lines return null', () => {
    const l1 = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    const l2 = { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } };
    assert.equal(lineIntersect(l1, l2), null);
  });

  it('coincident lines return null', () => {
    const l1 = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    const l2 = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    assert.equal(lineIntersect(l1, l2), null);
  });
});

// ─── pointInRect ─────────────────────────────────────────────────────────────

describe('pointInRect', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };

  it('centre point is inside', () => {
    assert.equal(pointInRect({ x: 5, y: 5 }, rect), true);
  });

  it('corner is inside (boundary)', () => {
    assert.equal(pointInRect({ x: 0, y: 0 }, rect), true);
    assert.equal(pointInRect({ x: 10, y: 10 }, rect), true);
  });

  it('point outside returns false', () => {
    assert.equal(pointInRect({ x: 11, y: 5 }, rect), false);
    assert.equal(pointInRect({ x: 5, y: -1 }, rect), false);
  });
});

// ─── pointInCircle ───────────────────────────────────────────────────────────

describe('pointInCircle', () => {
  const circle = { center: { x: 0, y: 0 }, radius: 5 };

  it('centre is inside', () => {
    assert.equal(pointInCircle({ x: 0, y: 0 }, circle), true);
  });

  it('point on boundary is inside', () => {
    assert.equal(pointInCircle({ x: 5, y: 0 }, circle), true);
  });

  it('point outside returns false', () => {
    assert.equal(pointInCircle({ x: 4, y: 4 }, circle), false); // dist ≈ 5.66
  });

  it('point within radius', () => {
    assert.equal(pointInCircle({ x: 3, y: 4 }, circle), true); // dist = 5 exactly
  });
});

// ─── circleIntersect ─────────────────────────────────────────────────────────

describe('circleIntersect', () => {
  it('overlapping circles', () => {
    const c1 = { center: { x: 0, y: 0 }, radius: 3 };
    const c2 = { center: { x: 4, y: 0 }, radius: 3 };
    assert.equal(circleIntersect(c1, c2), true);
  });

  it('touching circles (tangent)', () => {
    const c1 = { center: { x: 0, y: 0 }, radius: 3 };
    const c2 = { center: { x: 6, y: 0 }, radius: 3 };
    assert.equal(circleIntersect(c1, c2), true);
  });

  it('non-intersecting circles', () => {
    const c1 = { center: { x: 0, y: 0 }, radius: 2 };
    const c2 = { center: { x: 10, y: 0 }, radius: 2 };
    assert.equal(circleIntersect(c1, c2), false);
  });

  it('one circle inside another', () => {
    const c1 = { center: { x: 0, y: 0 }, radius: 10 };
    const c2 = { center: { x: 0, y: 0 }, radius: 1 };
    assert.equal(circleIntersect(c1, c2), true);
  });
});

// ─── rectIntersect ───────────────────────────────────────────────────────────

describe('rectIntersect', () => {
  it('overlapping rectangles', () => {
    const r1 = { x: 0, y: 0, width: 5, height: 5 };
    const r2 = { x: 3, y: 3, width: 5, height: 5 };
    assert.equal(rectIntersect(r1, r2), true);
  });

  it('touching rectangles (edge contact)', () => {
    const r1 = { x: 0, y: 0, width: 5, height: 5 };
    const r2 = { x: 5, y: 0, width: 5, height: 5 };
    assert.equal(rectIntersect(r1, r2), true);
  });

  it('non-intersecting rectangles', () => {
    const r1 = { x: 0, y: 0, width: 4, height: 4 };
    const r2 = { x: 10, y: 10, width: 4, height: 4 };
    assert.equal(rectIntersect(r1, r2), false);
  });

  it('one rect contained in the other', () => {
    const r1 = { x: 0, y: 0, width: 10, height: 10 };
    const r2 = { x: 2, y: 2, width: 4, height: 4 };
    assert.equal(rectIntersect(r1, r2), true);
  });
});

// ─── polygonArea ─────────────────────────────────────────────────────────────

describe('polygonArea', () => {
  it('unit square has area 1', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    assert.equal(polygonArea(square), 1);
  });

  it('2×3 rectangle has area 6', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ];
    assert.equal(polygonArea(rect), 6);
  });

  it('right triangle with legs 3 and 4 has area 6', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 4 },
    ];
    assert.equal(polygonArea(tri), 6);
  });

  it('degenerate: 0 vertices returns 0', () => {
    assert.equal(polygonArea([]), 0);
  });

  it('degenerate: 2 vertices returns 0', () => {
    assert.equal(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
  });

  it('counter-clockwise winding also returns positive area', () => {
    const ccwSquare = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ];
    assert.equal(polygonArea(ccwSquare), 1);
  });
});

// ─── isConvex ────────────────────────────────────────────────────────────────

describe('isConvex', () => {
  it('unit square is convex', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    assert.equal(isConvex(square), true);
  });

  it('equilateral triangle is convex', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    assert.equal(isConvex(tri), true);
  });

  it('L-shaped concave polygon is not convex', () => {
    // "dent" in the middle
    const concave = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 2, y: 2 }, // concave vertex
      { x: 0, y: 4 },
    ];
    assert.equal(isConvex(concave), false);
  });

  it('fewer than 3 vertices returns false', () => {
    assert.equal(isConvex([]), false);
    assert.equal(isConvex([{ x: 0, y: 0 }]), false);
    assert.equal(isConvex([{ x: 0, y: 0 }, { x: 1, y: 0 }]), false);
  });

  it('regular pentagon is convex', () => {
    const n = 5;
    const vertices = Array.from({ length: n }, (_, i) => ({
      x: Math.cos((2 * Math.PI * i) / n),
      y: Math.sin((2 * Math.PI * i) / n),
    }));
    assert.equal(isConvex(vertices), true);
  });
});
