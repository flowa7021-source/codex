// ─── Unit Tests: bounding-box ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createAABB,
  fromPoints,
  fromCircle,
  width,
  height,
  area,
  center,
  contains,
  intersects,
  intersection,
  union,
  expand,
  translate,
  scale,
  toRect,
} from '../../app/modules/bounding-box.js';

const EPSILON = 1e-9;
const approxEqual = (a, b) => Math.abs(a - b) < EPSILON;

// ─── createAABB ──────────────────────────────────────────────────────────────

describe('createAABB', () => {
  it('creates box from positive width/height', () => {
    const box = createAABB(1, 2, 4, 6);
    assert.deepEqual(box, { minX: 1, minY: 2, maxX: 5, maxY: 8 });
  });

  it('creates zero-area box when width and height are 0', () => {
    const box = createAABB(3, 3, 0, 0);
    assert.deepEqual(box, { minX: 3, minY: 3, maxX: 3, maxY: 3 });
  });

  it('normalises negative width', () => {
    const box = createAABB(5, 0, -4, 2);
    assert.equal(box.minX, 1);
    assert.equal(box.maxX, 5);
  });

  it('normalises negative height', () => {
    const box = createAABB(0, 5, 2, -4);
    assert.equal(box.minY, 1);
    assert.equal(box.maxY, 5);
  });
});

// ─── fromPoints ──────────────────────────────────────────────────────────────

describe('fromPoints', () => {
  it('empty array → all-zero box', () => {
    assert.deepEqual(fromPoints([]), { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('single point → degenerate box at that point', () => {
    assert.deepEqual(fromPoints([{ x: 3, y: 7 }]), { minX: 3, minY: 7, maxX: 3, maxY: 7 });
  });

  it('bounding box of a unit square corner set', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    assert.deepEqual(fromPoints(pts), { minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it('handles negative and mixed coordinates', () => {
    const pts = [{ x: -3, y: 2 }, { x: 5, y: -1 }, { x: 0, y: 4 }];
    assert.deepEqual(fromPoints(pts), { minX: -3, minY: -1, maxX: 5, maxY: 4 });
  });
});

// ─── fromCircle ──────────────────────────────────────────────────────────────

describe('fromCircle', () => {
  it('unit circle centred at origin', () => {
    assert.deepEqual(fromCircle({ x: 0, y: 0 }, 1), {
      minX: -1, minY: -1, maxX: 1, maxY: 1,
    });
  });

  it('radius 5 circle centred at (2, 3)', () => {
    assert.deepEqual(fromCircle({ x: 2, y: 3 }, 5), {
      minX: -3, minY: -2, maxX: 7, maxY: 8,
    });
  });

  it('zero-radius circle is a point', () => {
    assert.deepEqual(fromCircle({ x: 4, y: 4 }, 0), {
      minX: 4, minY: 4, maxX: 4, maxY: 4,
    });
  });
});

// ─── width / height / area ───────────────────────────────────────────────────

describe('width', () => {
  it('width of a 4×6 box is 4', () => {
    assert.equal(width({ minX: 0, minY: 0, maxX: 4, maxY: 6 }), 4);
  });

  it('width of a degenerate box is 0', () => {
    assert.equal(width({ minX: 2, minY: 2, maxX: 2, maxY: 5 }), 0);
  });
});

describe('height', () => {
  it('height of a 4×6 box is 6', () => {
    assert.equal(height({ minX: 0, minY: 0, maxX: 4, maxY: 6 }), 6);
  });
});

describe('area', () => {
  it('area of a 4×6 box is 24', () => {
    assert.equal(area({ minX: 0, minY: 0, maxX: 4, maxY: 6 }), 24);
  });

  it('area of a degenerate box is 0', () => {
    assert.equal(area({ minX: 3, minY: 3, maxX: 3, maxY: 3 }), 0);
  });
});

// ─── center ──────────────────────────────────────────────────────────────────

describe('center', () => {
  it('centre of (0,0)-(4,6) is (2,3)', () => {
    assert.deepEqual(center({ minX: 0, minY: 0, maxX: 4, maxY: 6 }), { x: 2, y: 3 });
  });

  it('centre of (-2,-2)-(2,2) is (0,0)', () => {
    assert.deepEqual(center({ minX: -2, minY: -2, maxX: 2, maxY: 2 }), { x: 0, y: 0 });
  });
});

// ─── contains ────────────────────────────────────────────────────────────────

describe('contains', () => {
  const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

  it('interior point is contained', () => {
    assert.equal(contains(box, { x: 5, y: 5 }), true);
  });

  it('corner points are contained (boundary)', () => {
    assert.equal(contains(box, { x: 0, y: 0 }), true);
    assert.equal(contains(box, { x: 10, y: 10 }), true);
  });

  it('edge midpoints are contained', () => {
    assert.equal(contains(box, { x: 5, y: 0 }), true);
    assert.equal(contains(box, { x: 10, y: 5 }), true);
  });

  it('outside point is not contained', () => {
    assert.equal(contains(box, { x: 11, y: 5 }), false);
    assert.equal(contains(box, { x: 5, y: -1 }), false);
  });
});

// ─── intersects ──────────────────────────────────────────────────────────────

describe('intersects', () => {
  it('overlapping boxes intersect', () => {
    const a = { minX: 0, minY: 0, maxX: 5, maxY: 5 };
    const b = { minX: 3, minY: 3, maxX: 8, maxY: 8 };
    assert.equal(intersects(a, b), true);
  });

  it('touching boxes intersect (boundary)', () => {
    const a = { minX: 0, minY: 0, maxX: 5, maxY: 5 };
    const b = { minX: 5, minY: 0, maxX: 10, maxY: 5 };
    assert.equal(intersects(a, b), true);
  });

  it('separated boxes do not intersect', () => {
    const a = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    const b = { minX: 6, minY: 6, maxX: 10, maxY: 10 };
    assert.equal(intersects(a, b), false);
  });

  it('one box inside another intersects', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 2, minY: 2, maxX: 6, maxY: 6 };
    assert.equal(intersects(a, b), true);
  });
});

// ─── intersection ────────────────────────────────────────────────────────────

describe('intersection', () => {
  it('overlapping boxes → correct intersection', () => {
    const a = { minX: 0, minY: 0, maxX: 6, maxY: 6 };
    const b = { minX: 3, minY: 3, maxX: 9, maxY: 9 };
    assert.deepEqual(intersection(a, b), { minX: 3, minY: 3, maxX: 6, maxY: 6 });
  });

  it('touching on one edge → degenerate intersection', () => {
    const a = { minX: 0, minY: 0, maxX: 5, maxY: 5 };
    const b = { minX: 5, minY: 0, maxX: 10, maxY: 5 };
    const result = intersection(a, b);
    assert.ok(result !== null);
    assert.equal(result.minX, 5);
    assert.equal(result.maxX, 5);
  });

  it('non-overlapping boxes → null', () => {
    const a = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    const b = { minX: 6, minY: 6, maxX: 10, maxY: 10 };
    assert.equal(intersection(a, b), null);
  });

  it('one box fully inside another → inner box', () => {
    const outer = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const inner = { minX: 2, minY: 2, maxX: 6, maxY: 6 };
    assert.deepEqual(intersection(outer, inner), inner);
  });
});

// ─── union ───────────────────────────────────────────────────────────────────

describe('union', () => {
  it('union of two disjoint boxes spans both', () => {
    const a = { minX: 0, minY: 0, maxX: 3, maxY: 3 };
    const b = { minX: 7, minY: 7, maxX: 10, maxY: 10 };
    assert.deepEqual(union(a, b), { minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it('union of overlapping boxes', () => {
    const a = { minX: 0, minY: 0, maxX: 6, maxY: 6 };
    const b = { minX: 3, minY: 3, maxX: 9, maxY: 9 };
    assert.deepEqual(union(a, b), { minX: 0, minY: 0, maxX: 9, maxY: 9 });
  });

  it('union of identical boxes is the same box', () => {
    const a = { minX: 1, minY: 2, maxX: 5, maxY: 6 };
    assert.deepEqual(union(a, a), a);
  });

  it('union with contained box returns outer box', () => {
    const outer = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const inner = { minX: 2, minY: 2, maxX: 5, maxY: 5 };
    assert.deepEqual(union(outer, inner), outer);
  });
});

// ─── expand ──────────────────────────────────────────────────────────────────

describe('expand', () => {
  it('expand by 1 grows each side by 1', () => {
    const box = { minX: 2, minY: 2, maxX: 8, maxY: 8 };
    assert.deepEqual(expand(box, 1), { minX: 1, minY: 1, maxX: 9, maxY: 9 });
  });

  it('expand by 0 leaves box unchanged', () => {
    const box = { minX: 2, minY: 2, maxX: 8, maxY: 8 };
    assert.deepEqual(expand(box, 0), box);
  });

  it('expand by negative amount shrinks box', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    assert.deepEqual(expand(box, -2), { minX: 2, minY: 2, maxX: 8, maxY: 8 });
  });
});

// ─── translate ───────────────────────────────────────────────────────────────

describe('translate', () => {
  it('translate by (3, 5)', () => {
    const box = { minX: 0, minY: 0, maxX: 4, maxY: 6 };
    assert.deepEqual(translate(box, 3, 5), { minX: 3, minY: 5, maxX: 7, maxY: 11 });
  });

  it('translate by (0, 0) leaves box unchanged', () => {
    const box = { minX: 1, minY: 2, maxX: 5, maxY: 8 };
    assert.deepEqual(translate(box, 0, 0), box);
  });

  it('translate by negative deltas', () => {
    const box = { minX: 5, minY: 5, maxX: 10, maxY: 10 };
    assert.deepEqual(translate(box, -3, -3), { minX: 2, minY: 2, maxX: 7, maxY: 7 });
  });
});

// ─── scale ───────────────────────────────────────────────────────────────────

describe('scale', () => {
  it('scale by 2 from default centre doubles the box size around its centre', () => {
    const box = { minX: 2, minY: 2, maxX: 4, maxY: 4 }; // centre (3,3)
    const result = scale(box, 2);
    assert.ok(approxEqual(result.minX, 1));
    assert.ok(approxEqual(result.minY, 1));
    assert.ok(approxEqual(result.maxX, 5));
    assert.ok(approxEqual(result.maxY, 5));
  });

  it('scale by 1 leaves box unchanged', () => {
    const box = { minX: 0, minY: 0, maxX: 6, maxY: 6 };
    const result = scale(box, 1);
    assert.deepEqual(result, box);
  });

  it('scale by 0 collapses box to origin', () => {
    const box = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    const result = scale(box, 0, { x: 0, y: 0 });
    assert.ok(approxEqual(result.minX, 0));
    assert.ok(approxEqual(result.maxX, 0));
  });

  it('scale around explicit origin', () => {
    const box = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    const result = scale(box, 2, { x: 0, y: 0 });
    assert.deepEqual(result, { minX: 0, minY: 0, maxX: 8, maxY: 8 });
  });

  it('scale by 0.5 halves dimensions around centre', () => {
    const box = { minX: 0, minY: 0, maxX: 4, maxY: 4 }; // centre (2,2)
    const result = scale(box, 0.5);
    assert.ok(approxEqual(result.minX, 1));
    assert.ok(approxEqual(result.minY, 1));
    assert.ok(approxEqual(result.maxX, 3));
    assert.ok(approxEqual(result.maxY, 3));
  });
});

// ─── toRect ──────────────────────────────────────────────────────────────────

describe('toRect', () => {
  it('converts AABB to {x, y, width, height}', () => {
    const box = { minX: 2, minY: 3, maxX: 7, maxY: 9 };
    assert.deepEqual(toRect(box), { x: 2, y: 3, width: 5, height: 6 });
  });

  it('zero-area box gives width=0 height=0', () => {
    const box = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
    assert.deepEqual(toRect(box), { x: 5, y: 5, width: 0, height: 0 });
  });

  it('createAABB → toRect round-trips correctly', () => {
    const rect = toRect(createAABB(3, 4, 6, 8));
    assert.deepEqual(rect, { x: 3, y: 4, width: 6, height: 8 });
  });
});
