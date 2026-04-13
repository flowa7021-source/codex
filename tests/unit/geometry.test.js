// ─── Unit Tests: 2D Geometry Primitives ──────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  distance,
  midpoint,
  lineLength,
  slope,
  yIntercept,
  lineIntersection,
  pointOnLine,
  circleArea,
  circlePerimeter,
  circleContainsPoint,
  rectArea,
  rectPerimeter,
  rectContainsPoint,
  rectsOverlap,
  polygonArea,
  polygonPerimeter,
  polygonContainsPoint,
  rotatePoint,
  scalePoint,
} from '../../app/modules/geometry.js';

const EPS = 1e-9;

function approx(actual, expected, eps = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `Expected ${actual} ≈ ${expected} (±${eps})`,
  );
}

function approxPoint(actual, expected, eps = 1e-9) {
  approx(actual.x, expected.x, eps);
  approx(actual.y, expected.y, eps);
}

// ─── distance ────────────────────────────────────────────────────────────────

describe('distance', () => {
  it('distance between the same point is 0', () => {
    assert.equal(distance({ x: 3, y: 4 }, { x: 3, y: 4 }), 0);
  });

  it('3-4-5 right triangle', () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });

  it('horizontal distance', () => {
    assert.equal(distance({ x: 1, y: 0 }, { x: 4, y: 0 }), 3);
  });

  it('negative coordinates', () => {
    assert.equal(distance({ x: -1, y: -1 }, { x: 2, y: 3 }), 5);
  });
});

// ─── midpoint ────────────────────────────────────────────────────────────────

describe('midpoint', () => {
  it('midpoint of origin and (2,4)', () => {
    const m = midpoint({ x: 0, y: 0 }, { x: 2, y: 4 });
    assert.deepEqual(m, { x: 1, y: 2 });
  });

  it('midpoint of two identical points', () => {
    const m = midpoint({ x: 5, y: 7 }, { x: 5, y: 7 });
    assert.deepEqual(m, { x: 5, y: 7 });
  });

  it('midpoint with negative coords', () => {
    const m = midpoint({ x: -4, y: -2 }, { x: 4, y: 2 });
    assert.deepEqual(m, { x: 0, y: 0 });
  });
});

// ─── lineLength ──────────────────────────────────────────────────────────────

describe('lineLength', () => {
  it('horizontal segment', () => {
    assert.equal(lineLength({ a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }), 5);
  });

  it('diagonal segment (3-4-5)', () => {
    assert.equal(lineLength({ a: { x: 0, y: 0 }, b: { x: 3, y: 4 } }), 5);
  });
});

// ─── slope ───────────────────────────────────────────────────────────────────

describe('slope', () => {
  it('slope of horizontal line is 0', () => {
    assert.equal(slope({ a: { x: 0, y: 2 }, b: { x: 5, y: 2 } }), 0);
  });

  it('slope of vertical line is Infinity', () => {
    assert.equal(slope({ a: { x: 3, y: 0 }, b: { x: 3, y: 5 } }), Infinity);
  });

  it('slope of 45-degree line is 1', () => {
    assert.equal(slope({ a: { x: 0, y: 0 }, b: { x: 4, y: 4 } }), 1);
  });

  it('negative slope', () => {
    assert.equal(slope({ a: { x: 0, y: 4 }, b: { x: 4, y: 0 } }), -1);
  });
});

// ─── yIntercept ──────────────────────────────────────────────────────────────

describe('yIntercept', () => {
  it('line through origin', () => {
    assert.equal(yIntercept({ a: { x: 0, y: 0 }, b: { x: 1, y: 2 } }), 0);
  });

  it('positive intercept', () => {
    assert.equal(yIntercept({ a: { x: 0, y: 3 }, b: { x: 1, y: 4 } }), 3);
  });

  it('vertical line returns NaN', () => {
    assert.ok(Number.isNaN(yIntercept({ a: { x: 2, y: 0 }, b: { x: 2, y: 5 } })));
  });
});

// ─── lineIntersection ────────────────────────────────────────────────────────

describe('lineIntersection', () => {
  it('two perpendicular lines at origin', () => {
    const result = lineIntersection(
      { a: { x: -1, y: 0 }, b: { x: 1, y: 0 } },
      { a: { x: 0, y: -1 }, b: { x: 0, y: 1 } },
    );
    assert.ok(result);
    approxPoint(result, { x: 0, y: 0 });
  });

  it('diagonal lines crossing at (2,2)', () => {
    const result = lineIntersection(
      { a: { x: 0, y: 0 }, b: { x: 4, y: 4 } },
      { a: { x: 0, y: 4 }, b: { x: 4, y: 0 } },
    );
    assert.ok(result);
    approxPoint(result, { x: 2, y: 2 }, 1e-9);
  });

  it('parallel horizontal lines return null', () => {
    const result = lineIntersection(
      { a: { x: 0, y: 1 }, b: { x: 5, y: 1 } },
      { a: { x: 0, y: 3 }, b: { x: 5, y: 3 } },
    );
    assert.equal(result, null);
  });

  it('parallel vertical lines return null', () => {
    const result = lineIntersection(
      { a: { x: 1, y: 0 }, b: { x: 1, y: 5 } },
      { a: { x: 3, y: 0 }, b: { x: 3, y: 5 } },
    );
    assert.equal(result, null);
  });
});

// ─── pointOnLine ─────────────────────────────────────────────────────────────

describe('pointOnLine', () => {
  it('point on horizontal line', () => {
    assert.ok(pointOnLine({ x: 3, y: 0 }, { a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }));
  });

  it('point on diagonal line', () => {
    assert.ok(pointOnLine({ x: 2, y: 2 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 4 } }));
  });

  it('point off line', () => {
    assert.ok(!pointOnLine({ x: 1, y: 2 }, { a: { x: 0, y: 0 }, b: { x: 4, y: 4 } }));
  });
});

// ─── circleArea / circlePerimeter ────────────────────────────────────────────

describe('circleArea', () => {
  it('unit circle area = π', () => {
    approx(circleArea({ center: { x: 0, y: 0 }, radius: 1 }), Math.PI, 1e-12);
  });

  it('radius 2 gives 4π', () => {
    approx(circleArea({ center: { x: 0, y: 0 }, radius: 2 }), 4 * Math.PI, 1e-12);
  });
});

describe('circlePerimeter', () => {
  it('unit circle perimeter = 2π', () => {
    approx(circlePerimeter({ center: { x: 0, y: 0 }, radius: 1 }), 2 * Math.PI, 1e-12);
  });
});

// ─── circleContainsPoint ─────────────────────────────────────────────────────

describe('circleContainsPoint', () => {
  const c = { center: { x: 0, y: 0 }, radius: 5 };

  it('center is inside', () => {
    assert.ok(circleContainsPoint(c, { x: 0, y: 0 }));
  });

  it('point on boundary is inside', () => {
    assert.ok(circleContainsPoint(c, { x: 5, y: 0 }));
  });

  it('point outside', () => {
    assert.ok(!circleContainsPoint(c, { x: 4, y: 4 }));
  });

  it('point just inside', () => {
    assert.ok(circleContainsPoint(c, { x: 3, y: 4 })); // dist = 5 exactly
  });
});

// ─── rectArea / rectPerimeter ────────────────────────────────────────────────

describe('rectArea', () => {
  it('3x4 rect', () => {
    assert.equal(rectArea({ x: 0, y: 0, width: 3, height: 4 }), 12);
  });

  it('square', () => {
    assert.equal(rectArea({ x: 10, y: 10, width: 5, height: 5 }), 25);
  });
});

describe('rectPerimeter', () => {
  it('3x4 rect perimeter = 14', () => {
    assert.equal(rectPerimeter({ x: 0, y: 0, width: 3, height: 4 }), 14);
  });
});

// ─── rectContainsPoint ───────────────────────────────────────────────────────

describe('rectContainsPoint', () => {
  const r = { x: 1, y: 1, width: 4, height: 4 };

  it('interior point', () => {
    assert.ok(rectContainsPoint(r, { x: 3, y: 3 }));
  });

  it('corner point (on boundary)', () => {
    assert.ok(rectContainsPoint(r, { x: 1, y: 1 }));
    assert.ok(rectContainsPoint(r, { x: 5, y: 5 }));
  });

  it('outside point', () => {
    assert.ok(!rectContainsPoint(r, { x: 0, y: 0 }));
    assert.ok(!rectContainsPoint(r, { x: 6, y: 3 }));
  });
});

// ─── rectsOverlap ────────────────────────────────────────────────────────────

describe('rectsOverlap', () => {
  it('two overlapping rects', () => {
    assert.ok(rectsOverlap(
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 2, y: 2, width: 4, height: 4 },
    ));
  });

  it('touching edge counts as overlapping', () => {
    assert.ok(rectsOverlap(
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 4, y: 0, width: 4, height: 4 },
    ));
  });

  it('non-overlapping rects', () => {
    assert.ok(!rectsOverlap(
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 5, y: 5, width: 2, height: 2 },
    ));
  });

  it('one rect fully inside the other', () => {
    assert.ok(rectsOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 2, y: 2, width: 3, height: 3 },
    ));
  });
});

// ─── polygonArea ─────────────────────────────────────────────────────────────

describe('polygonArea', () => {
  it('unit square area = 1', () => {
    const sq = { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
    assert.equal(polygonArea(sq), 1);
  });

  it('right triangle (0,0)(3,0)(0,4) area = 6', () => {
    const tri = { vertices: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }] };
    assert.equal(polygonArea(tri), 6);
  });

  it('fewer than 3 vertices returns 0', () => {
    assert.equal(polygonArea({ vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), 0);
  });
});

// ─── polygonPerimeter ────────────────────────────────────────────────────────

describe('polygonPerimeter', () => {
  it('unit square perimeter = 4', () => {
    const sq = { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
    assert.equal(polygonPerimeter(sq), 4);
  });

  it('right triangle perimeter', () => {
    const tri = { vertices: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }] };
    assert.equal(polygonPerimeter(tri), 3 + 4 + 5);
  });
});

// ─── polygonContainsPoint ────────────────────────────────────────────────────

describe('polygonContainsPoint', () => {
  const square = { vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] };

  it('centre point is inside', () => {
    assert.ok(polygonContainsPoint(square, { x: 2, y: 2 }));
  });

  it('point outside polygon', () => {
    assert.ok(!polygonContainsPoint(square, { x: 5, y: 5 }));
    assert.ok(!polygonContainsPoint(square, { x: -1, y: 2 }));
  });

  it('non-convex L-shape contains interior point', () => {
    // L-shape vertices (CCW)
    const L = {
      vertices: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
    };
    assert.ok(polygonContainsPoint(L, { x: 0.5, y: 0.5 }));
    assert.ok(!polygonContainsPoint(L, { x: 1.5, y: 1.5 }));
  });
});

// ─── rotatePoint ─────────────────────────────────────────────────────────────

describe('rotatePoint', () => {
  it('rotate (1,0) 90° around origin → (0,1)', () => {
    const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    approxPoint(result, { x: 0, y: 1 }, 1e-9);
  });

  it('rotate (1,0) 180° around origin → (-1,0)', () => {
    const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 180);
    approxPoint(result, { x: -1, y: 0 }, 1e-9);
  });

  it('rotate 0° leaves point unchanged', () => {
    const p = { x: 3, y: 5 };
    const result = rotatePoint(p, { x: 0, y: 0 }, 0);
    approxPoint(result, p, 1e-9);
  });

  it('rotate around non-origin pivot', () => {
    // Rotate (2,1) by 90° around (1,1) → should land at (1,2)
    const result = rotatePoint({ x: 2, y: 1 }, { x: 1, y: 1 }, 90);
    approxPoint(result, { x: 1, y: 2 }, 1e-9);
  });
});

// ─── scalePoint ──────────────────────────────────────────────────────────────

describe('scalePoint', () => {
  it('scale factor 2 from origin doubles coordinates', () => {
    const result = scalePoint({ x: 3, y: 4 }, { x: 0, y: 0 }, 2);
    assert.deepEqual(result, { x: 6, y: 8 });
  });

  it('scale factor 0.5 halves distance from origin', () => {
    const result = scalePoint({ x: 4, y: 0 }, { x: 0, y: 0 }, 0.5);
    assert.deepEqual(result, { x: 2, y: 0 });
  });

  it('scale around non-origin pivot', () => {
    // Point (3,1) scaled by 2 from pivot (1,1) → (5,1)
    const result = scalePoint({ x: 3, y: 1 }, { x: 1, y: 1 }, 2);
    assert.deepEqual(result, { x: 5, y: 1 });
  });

  it('scale factor 1 leaves point unchanged', () => {
    const p = { x: 7, y: 3 };
    assert.deepEqual(scalePoint(p, { x: 0, y: 0 }, 1), p);
  });
});
