// ─── Unit Tests: quaternion ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  quat,
  quatIdentity,
  quatFromAxisAngle,
  quatFromEuler,
  quatMultiply,
  quatConjugate,
  quatInverse,
  quatLength,
  quatNormalize,
  quatDot,
  quatSlerp,
  quatToEuler,
  quatRotateVec3,
} from '../../app/modules/quaternion.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function approxEqual(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }

function quatApproxEqual(a, b, eps = 1e-9) {
  return (
    approxEqual(a.x, b.x, eps) &&
    approxEqual(a.y, b.y, eps) &&
    approxEqual(a.z, b.z, eps) &&
    approxEqual(a.w, b.w, eps)
  );
}

// ─── quat() ──────────────────────────────────────────────────────────────────

describe('quat()', () => {
  it('creates a quaternion from components', () => {
    const q = quat(1, 2, 3, 4);
    assert.equal(q.x, 1);
    assert.equal(q.y, 2);
    assert.equal(q.z, 3);
    assert.equal(q.w, 4);
  });
});

// ─── quatIdentity() ──────────────────────────────────────────────────────────

describe('quatIdentity()', () => {
  it('returns (0, 0, 0, 1)', () => {
    const q = quatIdentity();
    assert.equal(q.x, 0);
    assert.equal(q.y, 0);
    assert.equal(q.z, 0);
    assert.equal(q.w, 1);
  });
});

// ─── quatFromAxisAngle() ─────────────────────────────────────────────────────

describe('quatFromAxisAngle()', () => {
  it('angle 0 around any axis yields identity', () => {
    const q = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, 0);
    assert.ok(approxEqual(q.x, 0));
    assert.ok(approxEqual(q.y, 0));
    assert.ok(approxEqual(q.z, 0));
    assert.ok(approxEqual(q.w, 1));
  });

  it('π/2 around Z axis: (0, 0, sin(π/4), cos(π/4))', () => {
    const q = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const s = Math.sin(Math.PI / 4);
    const c = Math.cos(Math.PI / 4);
    assert.ok(approxEqual(q.x, 0));
    assert.ok(approxEqual(q.y, 0));
    assert.ok(approxEqual(q.z, s));
    assert.ok(approxEqual(q.w, c));
  });

  it('π around X axis: (1, 0, 0, 0)', () => {
    const q = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI);
    assert.ok(approxEqual(q.x, 1, 1e-9));
    assert.ok(approxEqual(q.y, 0));
    assert.ok(approxEqual(q.z, 0));
    assert.ok(approxEqual(q.w, 0, 1e-9));
  });
});

// ─── quatMultiply() ──────────────────────────────────────────────────────────

describe('quatMultiply()', () => {
  it('identity * q = q', () => {
    const q = quat(1, 2, 3, 4);
    assert.ok(quatApproxEqual(quatMultiply(quatIdentity(), q), q));
  });

  it('q * identity = q', () => {
    const q = quat(1, 2, 3, 4);
    assert.ok(quatApproxEqual(quatMultiply(q, quatIdentity()), q));
  });

  it('two 90° Z-rotations = one 180° Z-rotation', () => {
    const q90 = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const q180 = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI);
    const composed = quatMultiply(q90, q90);
    // Both represent 180° around Z; could differ by sign, use dot-product check
    const dot = Math.abs(quatDot(composed, q180));
    assert.ok(approxEqual(dot, 1, 1e-9));
  });
});

// ─── quatConjugate() ─────────────────────────────────────────────────────────

describe('quatConjugate()', () => {
  it('negates x, y, z but keeps w', () => {
    const q = quat(1, 2, 3, 4);
    const c = quatConjugate(q);
    assert.equal(c.x, -1);
    assert.equal(c.y, -2);
    assert.equal(c.z, -3);
    assert.equal(c.w, 4);
  });

  it('conjugate of identity is identity', () => {
    assert.ok(quatApproxEqual(quatConjugate(quatIdentity()), quatIdentity()));
  });
});

// ─── quatInverse() ───────────────────────────────────────────────────────────

describe('quatInverse()', () => {
  it('q * inverse(q) ≈ identity for unit quaternion', () => {
    const q = quatNormalize(quat(1, 2, 3, 4));
    const result = quatMultiply(q, quatInverse(q));
    assert.ok(quatApproxEqual(result, quatIdentity(), 1e-9));
  });

  it('inverse of identity is identity', () => {
    assert.ok(quatApproxEqual(quatInverse(quatIdentity()), quatIdentity()));
  });
});

// ─── quatLength() ────────────────────────────────────────────────────────────

describe('quatLength()', () => {
  it('identity has length 1', () => {
    assert.ok(approxEqual(quatLength(quatIdentity()), 1));
  });

  it('(0, 0, 0, 1) has length 1', () => {
    assert.ok(approxEqual(quatLength(quat(0, 0, 0, 1)), 1));
  });

  it('(3, 4, 0, 0) has length 5', () => {
    assert.ok(approxEqual(quatLength(quat(3, 4, 0, 0)), 5));
  });
});

// ─── quatNormalize() ─────────────────────────────────────────────────────────

describe('quatNormalize()', () => {
  it('result has length 1', () => {
    const q = quatNormalize(quat(1, 2, 3, 4));
    assert.ok(approxEqual(quatLength(q), 1, 1e-9));
  });

  it('normalizing a unit quaternion leaves it unchanged', () => {
    const q = quatIdentity();
    assert.ok(quatApproxEqual(quatNormalize(q), q));
  });

  it('normalizing zero-length quaternion returns identity', () => {
    const result = quatNormalize(quat(0, 0, 0, 0));
    assert.ok(quatApproxEqual(result, quatIdentity()));
  });
});

// ─── quatDot() ───────────────────────────────────────────────────────────────

describe('quatDot()', () => {
  it('identity · identity = 1', () => {
    assert.ok(approxEqual(quatDot(quatIdentity(), quatIdentity()), 1));
  });

  it('(0,0,0,1) · (0,0,0,1) = 1', () => {
    assert.ok(approxEqual(quatDot(quat(0, 0, 0, 1), quat(0, 0, 0, 1)), 1));
  });

  it('perpendicular quaternions (orthogonal) have dot = 0', () => {
    // (1,0,0,0) · (0,1,0,0)
    assert.ok(approxEqual(quatDot(quat(1, 0, 0, 0), quat(0, 1, 0, 0)), 0));
  });
});

// ─── quatSlerp() ─────────────────────────────────────────────────────────────

describe('quatSlerp()', () => {
  it('t=0 returns a', () => {
    const a = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0);
    const b = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const result = quatSlerp(a, b, 0);
    assert.ok(quatApproxEqual(result, a, 1e-9));
  });

  it('t=1 returns b', () => {
    const a = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0);
    const b = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const result = quatSlerp(a, b, 1);
    // result and b represent same rotation (dot ≈ 1 or -1)
    const dot = Math.abs(quatDot(quatNormalize(result), quatNormalize(b)));
    assert.ok(approxEqual(dot, 1, 1e-9));
  });

  it('t=0.5 produces midpoint rotation', () => {
    const a = quatIdentity();
    const b = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const mid = quatSlerp(a, b, 0.5);
    // Midpoint should be quarter-turn: π/4 around Z
    const expected = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 4);
    const dot = Math.abs(quatDot(quatNormalize(mid), expected));
    assert.ok(approxEqual(dot, 1, 1e-9));
  });

  it('slerp between identical quaternions returns that quaternion', () => {
    const q = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 3);
    const result = quatSlerp(q, q, 0.5);
    const dot = Math.abs(quatDot(quatNormalize(result), q));
    assert.ok(approxEqual(dot, 1, 1e-9));
  });
});

// ─── quatRotateVec3() ────────────────────────────────────────────────────────

describe('quatRotateVec3()', () => {
  it('identity rotation does not change the vector', () => {
    const v = { x: 1, y: 2, z: 3 };
    const result = quatRotateVec3(quatIdentity(), v);
    assert.ok(approxEqual(result.x, v.x));
    assert.ok(approxEqual(result.y, v.y));
    assert.ok(approxEqual(result.z, v.z));
  });

  it('rotate (1,0,0) 90° around Z → (0,1,0)', () => {
    const q = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const result = quatRotateVec3(q, { x: 1, y: 0, z: 0 });
    assert.ok(approxEqual(result.x, 0, 1e-9));
    assert.ok(approxEqual(result.y, 1, 1e-9));
    assert.ok(approxEqual(result.z, 0, 1e-9));
  });

  it('rotate (0,1,0) 90° around X → (0,0,1)', () => {
    const q = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const result = quatRotateVec3(q, { x: 0, y: 1, z: 0 });
    assert.ok(approxEqual(result.x, 0, 1e-9));
    assert.ok(approxEqual(result.y, 0, 1e-9));
    assert.ok(approxEqual(result.z, 1, 1e-9));
  });

  it('rotate (1,0,0) 180° around Y → (-1,0,0)', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI);
    const result = quatRotateVec3(q, { x: 1, y: 0, z: 0 });
    assert.ok(approxEqual(result.x, -1, 1e-9));
    assert.ok(approxEqual(result.y, 0, 1e-9));
    assert.ok(approxEqual(result.z, 0, 1e-9));
  });
});

// ─── quatFromEuler() / quatToEuler() round-trip ──────────────────────────────

describe('quatFromEuler() / quatToEuler() round-trip', () => {
  function roundTrip(pitch, yaw, roll, eps = 1e-9) {
    const q = quatFromEuler(pitch, yaw, roll);
    const e = quatToEuler(q);
    return (
      approxEqual(e.pitch, pitch, eps) &&
      approxEqual(e.yaw, yaw, eps) &&
      approxEqual(e.roll, roll, eps)
    );
  }

  it('zero angles round-trip', () => {
    assert.ok(roundTrip(0, 0, 0));
  });

  it('pitch-only round-trip', () => {
    assert.ok(roundTrip(Math.PI / 4, 0, 0));
  });

  it('yaw-only round-trip', () => {
    assert.ok(roundTrip(0, Math.PI / 6, 0));
  });

  it('roll-only round-trip', () => {
    assert.ok(roundTrip(0, 0, Math.PI / 3));
  });

  it('combined simple angles round-trip', () => {
    assert.ok(roundTrip(Math.PI / 6, Math.PI / 8, Math.PI / 4, 1e-6));
  });

  it('quatFromEuler zero produces identity', () => {
    const q = quatFromEuler(0, 0, 0);
    assert.ok(quatApproxEqual(q, quatIdentity()));
  });
});
