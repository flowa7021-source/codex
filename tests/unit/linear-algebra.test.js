// ─── Unit Tests: linear-algebra ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Vector,
  dot,
  cross,
  magnitude,
  normalize,
  add,
  subtract,
  scale,
  angle,
  project,
  distance,
  lerp,
} from '../../app/modules/linear-algebra.js';

// ─── Vector constructor & Vector.of ──────────────────────────────────────────

describe('Vector', () => {
  it('creates a vector from an array', () => {
    const v = new Vector([1, 2, 3]);
    assert.deepEqual(v.components, [1, 2, 3]);
  });

  it('stores a deep copy of components', () => {
    const arr = [1, 2, 3];
    const v = new Vector(arr);
    arr[0] = 99;
    assert.equal(v.components[0], 1);
  });

  it('reports correct dimension', () => {
    assert.equal(new Vector([1, 2]).dimension, 2);
    assert.equal(new Vector([1, 2, 3, 4]).dimension, 4);
  });

  it('Vector.of creates a vector from variadic args', () => {
    const v = Vector.of(4, 5, 6);
    assert.deepEqual(v.components, [4, 5, 6]);
  });

  it('Vector.of creates a 1D vector', () => {
    const v = Vector.of(7);
    assert.deepEqual(v.components, [7]);
  });

  it('throws for empty components array', () => {
    assert.throws(() => new Vector([]), RangeError);
  });

  it('handles negative components', () => {
    const v = Vector.of(-1, -2, -3);
    assert.deepEqual(v.components, [-1, -2, -3]);
  });

  it('handles floating point components', () => {
    const v = Vector.of(1.5, 2.7, 3.14);
    assert.ok(Math.abs(v.components[2] - 3.14) < 1e-10);
  });
});

// ─── add ──────────────────────────────────────────────────────────────────────

describe('add', () => {
  it('adds two 3D vectors component-wise', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    assert.deepEqual(add(a, b).components, [5, 7, 9]);
  });

  it('adding the zero vector is identity', () => {
    const v = Vector.of(3, 4, 5);
    const zero = Vector.of(0, 0, 0);
    assert.deepEqual(add(v, zero).components, v.components);
  });

  it('throws for dimension mismatch', () => {
    const a = Vector.of(1, 2);
    const b = Vector.of(1, 2, 3);
    assert.throws(() => add(a, b), RangeError);
  });

  it('works for 1D vectors', () => {
    assert.deepEqual(add(Vector.of(3), Vector.of(4)).components, [7]);
  });

  it('does not mutate input vectors', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    add(a, b);
    assert.deepEqual(a.components, [1, 2, 3]);
  });

  it('is commutative', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    assert.deepEqual(add(a, b).components, add(b, a).components);
  });

  it('handles negative components', () => {
    const a = Vector.of(-1, -2);
    const b = Vector.of(1, 2);
    assert.deepEqual(add(a, b).components, [0, 0]);
  });

  it('works for 2D vectors', () => {
    const a = Vector.of(3, 4);
    const b = Vector.of(1, 2);
    assert.deepEqual(add(a, b).components, [4, 6]);
  });
});

// ─── subtract ─────────────────────────────────────────────────────────────────

describe('subtract', () => {
  it('subtracts two 3D vectors component-wise', () => {
    const a = Vector.of(5, 7, 9);
    const b = Vector.of(1, 2, 3);
    assert.deepEqual(subtract(a, b).components, [4, 5, 6]);
  });

  it('subtracting a vector from itself gives zero', () => {
    const v = Vector.of(3, 4, 5);
    const result = subtract(v, v);
    assert.deepEqual(result.components, [0, 0, 0]);
  });

  it('throws for dimension mismatch', () => {
    const a = Vector.of(1, 2);
    const b = Vector.of(1, 2, 3);
    assert.throws(() => subtract(a, b), RangeError);
  });

  it('can produce negative components', () => {
    const a = Vector.of(1, 2);
    const b = Vector.of(3, 5);
    assert.deepEqual(subtract(a, b).components, [-2, -3]);
  });

  it('does not mutate input vectors', () => {
    const a = Vector.of(5, 7, 9);
    const b = Vector.of(1, 2, 3);
    subtract(a, b);
    assert.deepEqual(a.components, [5, 7, 9]);
  });

  it('is anti-commutative: a-b = -(b-a)', () => {
    const a = Vector.of(3, 4);
    const b = Vector.of(1, 2);
    const ab = subtract(a, b);
    const ba = subtract(b, a);
    assert.deepEqual(ab.components, scale(ba, -1).components);
  });

  it('works for 1D vectors', () => {
    assert.deepEqual(subtract(Vector.of(10), Vector.of(4)).components, [6]);
  });

  it('works for high-dimensional vectors', () => {
    const a = Vector.of(1, 2, 3, 4, 5);
    const b = Vector.of(5, 4, 3, 2, 1);
    assert.deepEqual(subtract(a, b).components, [-4, -2, 0, 2, 4]);
  });
});

// ─── scale ────────────────────────────────────────────────────────────────────

describe('scale', () => {
  it('multiplies all components by the scalar', () => {
    const v = Vector.of(1, 2, 3);
    assert.deepEqual(scale(v, 3).components, [3, 6, 9]);
  });

  it('scaling by 1 returns equal vector', () => {
    const v = Vector.of(4, 5, 6);
    assert.deepEqual(scale(v, 1).components, v.components);
  });

  it('scaling by 0 gives zero vector', () => {
    const v = Vector.of(1, 2, 3);
    assert.deepEqual(scale(v, 0).components, [0, 0, 0]);
  });

  it('scaling by -1 negates all components', () => {
    const v = Vector.of(1, -2, 3);
    assert.deepEqual(scale(v, -1).components, [-1, 2, -3]);
  });

  it('does not mutate the input vector', () => {
    const v = Vector.of(1, 2, 3);
    scale(v, 5);
    assert.deepEqual(v.components, [1, 2, 3]);
  });

  it('works with fractional scalars', () => {
    const v = Vector.of(4, 8, 12);
    assert.deepEqual(scale(v, 0.5).components, [2, 4, 6]);
  });

  it('double scale equals single scale with product', () => {
    const v = Vector.of(1, 2, 3);
    assert.deepEqual(scale(scale(v, 2), 3).components, scale(v, 6).components);
  });

  it('works for 1D vectors', () => {
    assert.deepEqual(scale(Vector.of(7), 4).components, [28]);
  });
});

// ─── dot ──────────────────────────────────────────────────────────────────────

describe('dot', () => {
  it('computes the dot product of two 3D vectors', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    assert.equal(dot(a, b), 32); // 4 + 10 + 18
  });

  it('dot product of perpendicular vectors is 0', () => {
    const a = Vector.of(1, 0);
    const b = Vector.of(0, 1);
    assert.equal(dot(a, b), 0);
  });

  it('dot product of a vector with itself equals magnitude squared', () => {
    const v = Vector.of(3, 4);
    assert.equal(dot(v, v), 25);
  });

  it('is commutative', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    assert.equal(dot(a, b), dot(b, a));
  });

  it('throws for dimension mismatch', () => {
    assert.throws(() => dot(Vector.of(1, 2), Vector.of(1, 2, 3)), RangeError);
  });

  it('works for 1D vectors', () => {
    assert.equal(dot(Vector.of(3), Vector.of(4)), 12);
  });

  it('handles negative components', () => {
    const a = Vector.of(-1, -2);
    const b = Vector.of(3, 4);
    assert.equal(dot(a, b), -11); // -3 + -8
  });

  it('works for high-dimensional vectors', () => {
    const a = Vector.of(1, 0, 0, 0, 1);
    const b = Vector.of(0, 0, 0, 0, 5);
    assert.equal(dot(a, b), 5);
  });
});

// ─── cross ────────────────────────────────────────────────────────────────────

describe('cross', () => {
  it('computes the cross product of two standard basis vectors', () => {
    const i = Vector.of(1, 0, 0);
    const j = Vector.of(0, 1, 0);
    assert.deepEqual(cross(i, j).components, [0, 0, 1]); // k
  });

  it('cross product of parallel vectors is zero', () => {
    const a = Vector.of(1, 0, 0);
    const b = Vector.of(2, 0, 0);
    assert.deepEqual(cross(a, b).components, [0, 0, 0]);
  });

  it('cross product is anti-commutative: a×b = -(b×a)', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    const ab = cross(a, b);
    const ba = cross(b, a);
    assert.deepEqual(ab.components, scale(ba, -1).components);
  });

  it('result is orthogonal to both inputs (dot = 0)', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    const c = cross(a, b);
    assert.ok(Math.abs(dot(a, c)) < 1e-10);
    assert.ok(Math.abs(dot(b, c)) < 1e-10);
  });

  it('throws for non-3D vectors', () => {
    assert.throws(() => cross(Vector.of(1, 2), Vector.of(3, 4)), RangeError);
    assert.throws(() => cross(Vector.of(1, 2, 3, 4), Vector.of(1, 2, 3, 4)), RangeError);
  });

  it('throws for dimension mismatch', () => {
    // One 3D, one 2D – the 3D check fires first
    assert.throws(() => cross(Vector.of(1, 2, 3), Vector.of(1, 2)), RangeError);
  });

  it('computes correct cross product', () => {
    const a = Vector.of(3, -3, 1);
    const b = Vector.of(4, 9, 2);
    // a×b = ((-3*2 - 1*9), (1*4 - 3*2), (3*9 - (-3)*4))
    //     = (-6-9, 4-6, 27+12) = (-15, -2, 39)
    assert.deepEqual(cross(a, b).components, [-15, -2, 39]);
  });

  it('cross product of a vector with itself is zero', () => {
    const v = Vector.of(1, 2, 3);
    assert.deepEqual(cross(v, v).components, [0, 0, 0]);
  });
});

// ─── magnitude ────────────────────────────────────────────────────────────────

describe('magnitude', () => {
  it('computes magnitude of a 3D vector', () => {
    const v = Vector.of(3, 4, 0);
    assert.equal(magnitude(v), 5);
  });

  it('magnitude of zero vector is 0', () => {
    assert.equal(magnitude(Vector.of(0, 0, 0)), 0);
  });

  it('magnitude of unit vector is 1', () => {
    assert.ok(Math.abs(magnitude(Vector.of(1, 0, 0)) - 1) < 1e-10);
  });

  it('magnitude equals sqrt of dot with itself', () => {
    const v = Vector.of(3, 4, 5);
    assert.ok(Math.abs(magnitude(v) - Math.sqrt(dot(v, v))) < 1e-10);
  });

  it('works for 1D vectors', () => {
    assert.equal(magnitude(Vector.of(5)), 5);
    assert.equal(magnitude(Vector.of(-5)), 5);
  });

  it('works for 2D vectors', () => {
    assert.equal(magnitude(Vector.of(3, 4)), 5);
  });

  it('scales correctly: |s*v| = |s| * |v|', () => {
    const v = Vector.of(3, 4);
    assert.ok(Math.abs(magnitude(scale(v, 3)) - 3 * magnitude(v)) < 1e-10);
  });

  it('is always non-negative', () => {
    assert.ok(magnitude(Vector.of(-3, -4)) >= 0);
  });
});

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('returns a unit vector', () => {
    const v = Vector.of(3, 4);
    const u = normalize(v);
    assert.ok(Math.abs(magnitude(u) - 1) < 1e-10);
  });

  it('points in the same direction as the input', () => {
    const v = Vector.of(3, 4);
    const u = normalize(v);
    // u should be a positive scalar multiple of v
    const ratio = u.components[0] / v.components[0];
    assert.ok(ratio > 0);
    assert.ok(Math.abs(u.components[1] / v.components[1] - ratio) < 1e-10);
  });

  it('normalizing an already-unit vector returns a unit vector', () => {
    const v = Vector.of(1, 0, 0);
    assert.ok(Math.abs(magnitude(normalize(v)) - 1) < 1e-10);
  });

  it('throws for the zero vector', () => {
    assert.throws(() => normalize(Vector.of(0, 0, 0)), RangeError);
  });

  it('does not mutate the input vector', () => {
    const v = Vector.of(3, 4);
    normalize(v);
    assert.deepEqual(v.components, [3, 4]);
  });

  it('works for 3D vectors', () => {
    const v = Vector.of(1, 1, 1);
    const u = normalize(v);
    assert.ok(Math.abs(magnitude(u) - 1) < 1e-10);
  });

  it('works for 1D vectors', () => {
    const u = normalize(Vector.of(5));
    assert.ok(Math.abs(u.components[0] - 1) < 1e-10);
  });

  it('normalizing negative vector has magnitude 1', () => {
    const v = Vector.of(-3, -4);
    assert.ok(Math.abs(magnitude(normalize(v)) - 1) < 1e-10);
  });
});

// ─── angle ────────────────────────────────────────────────────────────────────

describe('angle', () => {
  it('angle between identical vectors is 0', () => {
    const v = Vector.of(1, 0, 0);
    assert.ok(Math.abs(angle(v, v)) < 1e-10);
  });

  it('angle between perpendicular vectors is pi/2', () => {
    const a = Vector.of(1, 0);
    const b = Vector.of(0, 1);
    assert.ok(Math.abs(angle(a, b) - Math.PI / 2) < 1e-10);
  });

  it('angle between opposite vectors is pi', () => {
    const a = Vector.of(1, 0);
    const b = Vector.of(-1, 0);
    assert.ok(Math.abs(angle(a, b) - Math.PI) < 1e-10);
  });

  it('is symmetric: angle(a, b) === angle(b, a)', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    assert.ok(Math.abs(angle(a, b) - angle(b, a)) < 1e-10);
  });

  it('throws for zero vector a', () => {
    assert.throws(() => angle(Vector.of(0, 0), Vector.of(1, 0)), RangeError);
  });

  it('throws for zero vector b', () => {
    assert.throws(() => angle(Vector.of(1, 0), Vector.of(0, 0)), RangeError);
  });

  it('throws for dimension mismatch', () => {
    assert.throws(() => angle(Vector.of(1, 2), Vector.of(1, 2, 3)), RangeError);
  });

  it('angle between 45-degree vectors is pi/4', () => {
    const a = Vector.of(1, 0);
    const b = Vector.of(1, 1);
    assert.ok(Math.abs(angle(a, b) - Math.PI / 4) < 1e-10);
  });
});

// ─── project ──────────────────────────────────────────────────────────────────

describe('project', () => {
  it('projects a vector onto an axis vector', () => {
    const a = Vector.of(3, 4);
    const onto = Vector.of(1, 0); // x-axis
    const p = project(a, onto);
    assert.ok(Math.abs(p.components[0] - 3) < 1e-10);
    assert.ok(Math.abs(p.components[1]) < 1e-10);
  });

  it('projection onto itself is the vector scaled appropriately', () => {
    const v = Vector.of(3, 4);
    const p = project(v, v);
    // projection of v onto v should equal v
    assert.ok(Math.abs(p.components[0] - 3) < 1e-10);
    assert.ok(Math.abs(p.components[1] - 4) < 1e-10);
  });

  it('projection of perpendicular vector is zero', () => {
    const a = Vector.of(0, 1);
    const onto = Vector.of(1, 0);
    const p = project(a, onto);
    assert.ok(Math.abs(p.components[0]) < 1e-10);
    assert.ok(Math.abs(p.components[1]) < 1e-10);
  });

  it('throws when projecting onto the zero vector', () => {
    assert.throws(() => project(Vector.of(1, 2), Vector.of(0, 0)), RangeError);
  });

  it('throws for dimension mismatch', () => {
    assert.throws(() => project(Vector.of(1, 2), Vector.of(1, 2, 3)), RangeError);
  });

  it('result is parallel to `onto`', () => {
    const a = Vector.of(3, 4, 5);
    const onto = Vector.of(1, 0, 0);
    const p = project(a, onto);
    // cross product of p and onto should be zero (parallel)
    const c = cross(p, onto);
    assert.ok(magnitude(c) < 1e-10);
  });

  it('works for 3D vectors', () => {
    const a = Vector.of(1, 2, 3);
    const onto = Vector.of(0, 0, 1);
    const p = project(a, onto);
    assert.ok(Math.abs(p.components[2] - 3) < 1e-10);
    assert.ok(Math.abs(p.components[0]) < 1e-10);
    assert.ok(Math.abs(p.components[1]) < 1e-10);
  });

  it('does not mutate input vectors', () => {
    const a = Vector.of(3, 4);
    const onto = Vector.of(1, 0);
    project(a, onto);
    assert.deepEqual(a.components, [3, 4]);
    assert.deepEqual(onto.components, [1, 0]);
  });
});

// ─── distance ─────────────────────────────────────────────────────────────────

describe('distance', () => {
  it('distance between identical vectors is 0', () => {
    const v = Vector.of(3, 4, 5);
    assert.equal(distance(v, v), 0);
  });

  it('computes 2D Euclidean distance', () => {
    const a = Vector.of(0, 0);
    const b = Vector.of(3, 4);
    assert.equal(distance(a, b), 5);
  });

  it('is symmetric: distance(a, b) === distance(b, a)', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 6, 3);
    assert.ok(Math.abs(distance(a, b) - distance(b, a)) < 1e-10);
  });

  it('throws for dimension mismatch', () => {
    assert.throws(() => distance(Vector.of(1, 2), Vector.of(1, 2, 3)), RangeError);
  });

  it('is always non-negative', () => {
    assert.ok(distance(Vector.of(1, 2), Vector.of(5, -1)) >= 0);
  });

  it('computes 3D distance correctly', () => {
    const a = Vector.of(1, 1, 1);
    const b = Vector.of(4, 5, 1);
    assert.equal(distance(a, b), 5);
  });

  it('distance between origin and (1,1,1) is sqrt(3)', () => {
    const a = Vector.of(0, 0, 0);
    const b = Vector.of(1, 1, 1);
    assert.ok(Math.abs(distance(a, b) - Math.sqrt(3)) < 1e-10);
  });

  it('works for 1D vectors', () => {
    assert.equal(distance(Vector.of(0), Vector.of(5)), 5);
    assert.equal(distance(Vector.of(-3), Vector.of(4)), 7);
  });
});

// ─── lerp ─────────────────────────────────────────────────────────────────────

describe('lerp', () => {
  it('at t=0 returns vector a', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(7, 8, 9);
    assert.deepEqual(lerp(a, b, 0).components, a.components);
  });

  it('at t=1 returns vector b', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(7, 8, 9);
    assert.deepEqual(lerp(a, b, 1).components, b.components);
  });

  it('at t=0.5 returns midpoint', () => {
    const a = Vector.of(0, 0);
    const b = Vector.of(4, 8);
    assert.deepEqual(lerp(a, b, 0.5).components, [2, 4]);
  });

  it('throws for dimension mismatch', () => {
    assert.throws(() => lerp(Vector.of(1, 2), Vector.of(1, 2, 3), 0.5), RangeError);
  });

  it('does not clamp t beyond [0, 1]', () => {
    const a = Vector.of(0, 0);
    const b = Vector.of(1, 1);
    const beyond = lerp(a, b, 2);
    assert.deepEqual(beyond.components, [2, 2]);
  });

  it('does not mutate input vectors', () => {
    const a = Vector.of(1, 2, 3);
    const b = Vector.of(4, 5, 6);
    lerp(a, b, 0.5);
    assert.deepEqual(a.components, [1, 2, 3]);
    assert.deepEqual(b.components, [4, 5, 6]);
  });

  it('at t=0.25 is one quarter of the way from a to b', () => {
    const a = Vector.of(0, 0);
    const b = Vector.of(4, 8);
    const result = lerp(a, b, 0.25);
    assert.ok(Math.abs(result.components[0] - 1) < 1e-10);
    assert.ok(Math.abs(result.components[1] - 2) < 1e-10);
  });

  it('lerp(a, a, t) === a for any t', () => {
    const a = Vector.of(3, 7);
    assert.deepEqual(lerp(a, a, 0.5).components, a.components);
  });
});
