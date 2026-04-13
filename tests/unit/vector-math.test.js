// ─── Unit Tests: Vector Math ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  vec2,
  vec2Add,
  vec2Sub,
  vec2Scale,
  vec2Dot,
  vec2Length,
  vec2Normalize,
  vec2Distance,
  vec2Lerp,
  vec2Angle,
  vec3,
  vec3Add,
  vec3Sub,
  vec3Scale,
  vec3Dot,
  vec3Cross,
  vec3Length,
  vec3Normalize,
  vec3Distance,
  vec3Lerp,
} from '../../app/modules/vector-math.js';

// ─── Floating-point helper ────────────────────────────────────────────────────

function approxEqual(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

function assertApprox(actual, expected, eps = 1e-9, msg = '') {
  assert.ok(
    approxEqual(actual, expected, eps),
    `${msg}Expected ${expected}, got ${actual} (eps=${eps})`,
  );
}

function assertVec2Approx(v, x, y, eps = 1e-9) {
  assertApprox(v.x, x, eps, `x: `);
  assertApprox(v.y, y, eps, `y: `);
}

function assertVec3Approx(v, x, y, z, eps = 1e-9) {
  assertApprox(v.x, x, eps, `x: `);
  assertApprox(v.y, y, eps, `y: `);
  assertApprox(v.z, z, eps, `z: `);
}

// ─── vec2 ─────────────────────────────────────────────────────────────────────

describe('vec2', () => {
  it('creates a vector with the given components', () => {
    const v = vec2(3, 4);
    assert.equal(v.x, 3);
    assert.equal(v.y, 4);
  });

  it('creates a zero vector', () => {
    const v = vec2(0, 0);
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
  });

  it('creates vectors with negative components', () => {
    const v = vec2(-1, -2);
    assert.equal(v.x, -1);
    assert.equal(v.y, -2);
  });
});

// ─── vec2Add ──────────────────────────────────────────────────────────────────

describe('vec2Add', () => {
  it('(1,2) + (3,4) = (4,6)', () => {
    const result = vec2Add(vec2(1, 2), vec2(3, 4));
    assert.equal(result.x, 4);
    assert.equal(result.y, 6);
  });

  it('adding zero vector is identity', () => {
    const v = vec2(5, -3);
    const result = vec2Add(v, vec2(0, 0));
    assert.equal(result.x, 5);
    assert.equal(result.y, -3);
  });

  it('addition is commutative', () => {
    const a = vec2(2, 7);
    const b = vec2(-1, 4);
    const ab = vec2Add(a, b);
    const ba = vec2Add(b, a);
    assert.equal(ab.x, ba.x);
    assert.equal(ab.y, ba.y);
  });
});

// ─── vec2Sub ──────────────────────────────────────────────────────────────────

describe('vec2Sub', () => {
  it('(5,3) - (2,1) = (3,2)', () => {
    const result = vec2Sub(vec2(5, 3), vec2(2, 1));
    assert.equal(result.x, 3);
    assert.equal(result.y, 2);
  });

  it('subtracting a vector from itself gives zero', () => {
    const v = vec2(7, -4);
    const result = vec2Sub(v, v);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
  });

  it('can produce negative components', () => {
    const result = vec2Sub(vec2(1, 1), vec2(3, 5));
    assert.equal(result.x, -2);
    assert.equal(result.y, -4);
  });
});

// ─── vec2Scale ────────────────────────────────────────────────────────────────

describe('vec2Scale', () => {
  it('(2,3) * 2 = (4,6)', () => {
    const result = vec2Scale(vec2(2, 3), 2);
    assert.equal(result.x, 4);
    assert.equal(result.y, 6);
  });

  it('scaling by 1 is identity', () => {
    const v = vec2(5, -7);
    const result = vec2Scale(v, 1);
    assert.equal(result.x, 5);
    assert.equal(result.y, -7);
  });

  it('scaling by 0 gives zero vector', () => {
    const result = vec2Scale(vec2(9, 3), 0);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
  });

  it('scaling by -1 negates components', () => {
    const result = vec2Scale(vec2(3, -4), -1);
    assert.equal(result.x, -3);
    assert.equal(result.y, 4);
  });
});

// ─── vec2Dot ──────────────────────────────────────────────────────────────────

describe('vec2Dot', () => {
  it('(1,0) · (0,1) = 0 (orthogonal)', () => {
    assert.equal(vec2Dot(vec2(1, 0), vec2(0, 1)), 0);
  });

  it('(1,0) · (1,0) = 1 (parallel unit vectors)', () => {
    assert.equal(vec2Dot(vec2(1, 0), vec2(1, 0)), 1);
  });

  it('(2,3) · (4,5) = 23', () => {
    assert.equal(vec2Dot(vec2(2, 3), vec2(4, 5)), 23);
  });

  it('dot product is commutative', () => {
    const a = vec2(3, -2);
    const b = vec2(1, 7);
    assert.equal(vec2Dot(a, b), vec2Dot(b, a));
  });

  it('(1,1) · (-1,-1) = -2 (anti-parallel)', () => {
    assert.equal(vec2Dot(vec2(1, 1), vec2(-1, -1)), -2);
  });
});

// ─── vec2Length ───────────────────────────────────────────────────────────────

describe('vec2Length', () => {
  it('(3,4) → 5 (3-4-5 triangle)', () => {
    assertApprox(vec2Length(vec2(3, 4)), 5);
  });

  it('zero vector has length 0', () => {
    assert.equal(vec2Length(vec2(0, 0)), 0);
  });

  it('unit vectors along axes have length 1', () => {
    assertApprox(vec2Length(vec2(1, 0)), 1);
    assertApprox(vec2Length(vec2(0, 1)), 1);
  });

  it('(-3,-4) has same length as (3,4)', () => {
    assertApprox(vec2Length(vec2(-3, -4)), 5);
  });
});

// ─── vec2Normalize ────────────────────────────────────────────────────────────

describe('vec2Normalize', () => {
  it('(3,4) → (0.6, 0.8)', () => {
    const n = vec2Normalize(vec2(3, 4));
    assertApprox(n.x, 0.6);
    assertApprox(n.y, 0.8);
  });

  it('normalized vector has length 1', () => {
    const n = vec2Normalize(vec2(5, 12));
    assertApprox(vec2Length(n), 1);
  });

  it('normalizing unit vector returns same vector', () => {
    const n = vec2Normalize(vec2(1, 0));
    assertApprox(n.x, 1);
    assertApprox(n.y, 0);
  });

  it('normalizing zero vector returns zero vector (safe)', () => {
    const n = vec2Normalize(vec2(0, 0));
    assert.equal(n.x, 0);
    assert.equal(n.y, 0);
  });
});

// ─── vec2Distance ─────────────────────────────────────────────────────────────

describe('vec2Distance', () => {
  it('(0,0) to (3,4) = 5', () => {
    assertApprox(vec2Distance(vec2(0, 0), vec2(3, 4)), 5);
  });

  it('distance from a point to itself is 0', () => {
    assert.equal(vec2Distance(vec2(5, 3), vec2(5, 3)), 0);
  });

  it('distance is symmetric', () => {
    const a = vec2(1, 2);
    const b = vec2(4, 6);
    assertApprox(vec2Distance(a, b), vec2Distance(b, a));
  });

  it('(1,1) to (4,5) = 5', () => {
    assertApprox(vec2Distance(vec2(1, 1), vec2(4, 5)), 5);
  });
});

// ─── vec2Lerp ─────────────────────────────────────────────────────────────────

describe('vec2Lerp', () => {
  it('t=0 returns a', () => {
    const result = vec2Lerp(vec2(1, 2), vec2(5, 6), 0);
    assert.equal(result.x, 1);
    assert.equal(result.y, 2);
  });

  it('t=1 returns b', () => {
    const result = vec2Lerp(vec2(1, 2), vec2(5, 6), 1);
    assert.equal(result.x, 5);
    assert.equal(result.y, 6);
  });

  it('t=0.5 returns midpoint', () => {
    const result = vec2Lerp(vec2(0, 0), vec2(4, 8), 0.5);
    assertApprox(result.x, 2);
    assertApprox(result.y, 4);
  });

  it('t=0.25 returns quarter point', () => {
    const result = vec2Lerp(vec2(0, 0), vec2(8, 4), 0.25);
    assertApprox(result.x, 2);
    assertApprox(result.y, 1);
  });
});

// ─── vec2Angle ────────────────────────────────────────────────────────────────

describe('vec2Angle', () => {
  it('+x axis vector has angle 0', () => {
    assertApprox(vec2Angle(vec2(1, 0)), 0);
  });

  it('+y axis vector has angle π/2', () => {
    assertApprox(vec2Angle(vec2(0, 1)), Math.PI / 2);
  });

  it('-x axis vector has angle ±π', () => {
    const angle = vec2Angle(vec2(-1, 0));
    assertApprox(Math.abs(angle), Math.PI);
  });

  it('-y axis vector has angle -π/2', () => {
    assertApprox(vec2Angle(vec2(0, -1)), -Math.PI / 2);
  });

  it('(1,1) has angle π/4', () => {
    assertApprox(vec2Angle(vec2(1, 1)), Math.PI / 4);
  });
});

// ─── vec3 ─────────────────────────────────────────────────────────────────────

describe('vec3', () => {
  it('creates a vector with the given components', () => {
    const v = vec3(1, 2, 3);
    assert.equal(v.x, 1);
    assert.equal(v.y, 2);
    assert.equal(v.z, 3);
  });

  it('creates a zero vector', () => {
    const v = vec3(0, 0, 0);
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
    assert.equal(v.z, 0);
  });
});

// ─── vec3Add ──────────────────────────────────────────────────────────────────

describe('vec3Add', () => {
  it('(1,2,3) + (4,5,6) = (5,7,9)', () => {
    const result = vec3Add(vec3(1, 2, 3), vec3(4, 5, 6));
    assert.equal(result.x, 5);
    assert.equal(result.y, 7);
    assert.equal(result.z, 9);
  });

  it('adding zero vector is identity', () => {
    const v = vec3(3, -1, 7);
    const result = vec3Add(v, vec3(0, 0, 0));
    assert.equal(result.x, 3);
    assert.equal(result.y, -1);
    assert.equal(result.z, 7);
  });
});

// ─── vec3Sub ──────────────────────────────────────────────────────────────────

describe('vec3Sub', () => {
  it('(5,7,9) - (1,2,3) = (4,5,6)', () => {
    const result = vec3Sub(vec3(5, 7, 9), vec3(1, 2, 3));
    assert.equal(result.x, 4);
    assert.equal(result.y, 5);
    assert.equal(result.z, 6);
  });

  it('subtracting a vector from itself gives zero', () => {
    const v = vec3(2, -3, 5);
    const result = vec3Sub(v, v);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.z, 0);
  });
});

// ─── vec3Scale ────────────────────────────────────────────────────────────────

describe('vec3Scale', () => {
  it('(1,2,3) * 3 = (3,6,9)', () => {
    const result = vec3Scale(vec3(1, 2, 3), 3);
    assert.equal(result.x, 3);
    assert.equal(result.y, 6);
    assert.equal(result.z, 9);
  });

  it('scaling by 0 gives zero vector', () => {
    const result = vec3Scale(vec3(5, 4, 3), 0);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.z, 0);
  });

  it('scaling by -1 negates all components', () => {
    const result = vec3Scale(vec3(1, -2, 3), -1);
    assert.equal(result.x, -1);
    assert.equal(result.y, 2);
    assert.equal(result.z, -3);
  });
});

// ─── vec3Dot ──────────────────────────────────────────────────────────────────

describe('vec3Dot', () => {
  it('(1,0,0) · (0,1,0) = 0 (orthogonal)', () => {
    assert.equal(vec3Dot(vec3(1, 0, 0), vec3(0, 1, 0)), 0);
  });

  it('(1,0,0) · (1,0,0) = 1 (parallel unit vectors)', () => {
    assert.equal(vec3Dot(vec3(1, 0, 0), vec3(1, 0, 0)), 1);
  });

  it('(1,2,3) · (4,5,6) = 32', () => {
    assert.equal(vec3Dot(vec3(1, 2, 3), vec3(4, 5, 6)), 32);
  });

  it('dot product is commutative', () => {
    const a = vec3(1, -2, 3);
    const b = vec3(4, 5, -6);
    assert.equal(vec3Dot(a, b), vec3Dot(b, a));
  });
});

// ─── vec3Cross ────────────────────────────────────────────────────────────────

describe('vec3Cross', () => {
  it('(1,0,0) × (0,1,0) = (0,0,1)', () => {
    const result = vec3Cross(vec3(1, 0, 0), vec3(0, 1, 0));
    assertApprox(result.x, 0);
    assertApprox(result.y, 0);
    assertApprox(result.z, 1);
  });

  it('(0,1,0) × (0,0,1) = (1,0,0)', () => {
    const result = vec3Cross(vec3(0, 1, 0), vec3(0, 0, 1));
    assertApprox(result.x, 1);
    assertApprox(result.y, 0);
    assertApprox(result.z, 0);
  });

  it('(0,0,1) × (1,0,0) = (0,1,0)', () => {
    const result = vec3Cross(vec3(0, 0, 1), vec3(1, 0, 0));
    assertApprox(result.x, 0);
    assertApprox(result.y, 1);
    assertApprox(result.z, 0);
  });

  it('cross product of parallel vectors is zero', () => {
    const result = vec3Cross(vec3(1, 0, 0), vec3(2, 0, 0));
    assertApprox(result.x, 0);
    assertApprox(result.y, 0);
    assertApprox(result.z, 0);
  });

  it('cross product is anti-commutative: a×b = -(b×a)', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    const ab = vec3Cross(a, b);
    const ba = vec3Cross(b, a);
    assertApprox(ab.x, -ba.x);
    assertApprox(ab.y, -ba.y);
    assertApprox(ab.z, -ba.z);
  });

  it('result is orthogonal to both inputs (dot product = 0)', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    const c = vec3Cross(a, b);
    assertApprox(vec3Dot(c, a), 0, 1e-9);
    assertApprox(vec3Dot(c, b), 0, 1e-9);
  });
});

// ─── vec3Length ───────────────────────────────────────────────────────────────

describe('vec3Length', () => {
  it('(0,0,0) has length 0', () => {
    assert.equal(vec3Length(vec3(0, 0, 0)), 0);
  });

  it('(1,0,0) has length 1', () => {
    assertApprox(vec3Length(vec3(1, 0, 0)), 1);
  });

  it('(1,2,2) has length 3', () => {
    assertApprox(vec3Length(vec3(1, 2, 2)), 3);
  });

  it('(2,3,6) has length 7', () => {
    // sqrt(4+9+36) = sqrt(49) = 7
    assertApprox(vec3Length(vec3(2, 3, 6)), 7);
  });
});

// ─── vec3Normalize ────────────────────────────────────────────────────────────

describe('vec3Normalize', () => {
  it('normalized vector has length 1', () => {
    const n = vec3Normalize(vec3(1, 2, 3));
    assertApprox(vec3Length(n), 1);
  });

  it('(2,3,6) normalizes to (2/7, 3/7, 6/7)', () => {
    const n = vec3Normalize(vec3(2, 3, 6));
    assertApprox(n.x, 2 / 7);
    assertApprox(n.y, 3 / 7);
    assertApprox(n.z, 6 / 7);
  });

  it('normalizing unit axis vector returns same vector', () => {
    const n = vec3Normalize(vec3(0, 0, 1));
    assertApprox(n.x, 0);
    assertApprox(n.y, 0);
    assertApprox(n.z, 1);
  });

  it('normalizing zero vector returns zero vector (safe)', () => {
    const n = vec3Normalize(vec3(0, 0, 0));
    assert.equal(n.x, 0);
    assert.equal(n.y, 0);
    assert.equal(n.z, 0);
  });
});

// ─── vec3Distance ─────────────────────────────────────────────────────────────

describe('vec3Distance', () => {
  it('(0,0,0) to (1,2,2) = 3', () => {
    assertApprox(vec3Distance(vec3(0, 0, 0), vec3(1, 2, 2)), 3);
  });

  it('distance from a point to itself is 0', () => {
    assert.equal(vec3Distance(vec3(1, 2, 3), vec3(1, 2, 3)), 0);
  });

  it('distance is symmetric', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);
    assertApprox(vec3Distance(a, b), vec3Distance(b, a));
  });

  it('(0,0,0) to (2,3,6) = 7', () => {
    assertApprox(vec3Distance(vec3(0, 0, 0), vec3(2, 3, 6)), 7);
  });
});

// ─── vec3Lerp ─────────────────────────────────────────────────────────────────

describe('vec3Lerp', () => {
  it('t=0 returns a', () => {
    const result = vec3Lerp(vec3(1, 2, 3), vec3(7, 8, 9), 0);
    assert.equal(result.x, 1);
    assert.equal(result.y, 2);
    assert.equal(result.z, 3);
  });

  it('t=1 returns b', () => {
    const result = vec3Lerp(vec3(1, 2, 3), vec3(7, 8, 9), 1);
    assert.equal(result.x, 7);
    assert.equal(result.y, 8);
    assert.equal(result.z, 9);
  });

  it('t=0.5 returns midpoint', () => {
    const result = vec3Lerp(vec3(0, 0, 0), vec3(2, 4, 6), 0.5);
    assertApprox(result.x, 1);
    assertApprox(result.y, 2);
    assertApprox(result.z, 3);
  });

  it('t=0.25 returns quarter point', () => {
    const result = vec3Lerp(vec3(0, 0, 0), vec3(4, 8, 12), 0.25);
    assertApprox(result.x, 1);
    assertApprox(result.y, 2);
    assertApprox(result.z, 3);
  });
});
