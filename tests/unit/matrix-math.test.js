// ─── Unit Tests: matrix-math ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mat2Identity,
  mat2Multiply,
  mat2Determinant,
  mat2Inverse,
  mat2Transpose,
  mat2Scale,
  mat2Rotate,
  mat3Identity,
  mat3Multiply,
  mat3Determinant,
  mat3Transpose,
  mat3FromMat4,
  mat4Identity,
  mat4Multiply,
  mat4Transpose,
  mat4Translation,
  mat4Scale,
  mat4RotateX,
  mat4RotateY,
  mat4RotateZ,
} from '../../app/modules/matrix-math.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function approxEqual(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }
function arrApproxEqual(a, b, eps = 1e-9) { return a.every((v, i) => approxEqual(v, b[i], eps)); }

// ─── Mat2 ─────────────────────────────────────────────────────────────────────

describe('mat2Identity()', () => {
  it('returns [1, 0, 0, 1]', () => {
    assert.deepEqual(mat2Identity(), [1, 0, 0, 1]);
  });
});

describe('mat2Multiply()', () => {
  it('identity * M = M', () => {
    const m = [2, 3, 4, 5];
    assert.deepEqual(mat2Multiply(mat2Identity(), m), m);
  });

  it('M * identity = M', () => {
    const m = [2, 3, 4, 5];
    assert.deepEqual(mat2Multiply(m, mat2Identity()), m);
  });

  it('multiplies two known matrices', () => {
    const a = [1, 2, 3, 4];
    const b = [5, 6, 7, 8];
    // [1*5+2*7, 1*6+2*8, 3*5+4*7, 3*6+4*8] = [19, 22, 43, 50]
    assert.deepEqual(mat2Multiply(a, b), [19, 22, 43, 50]);
  });
});

describe('mat2Determinant()', () => {
  it('identity has determinant 1', () => {
    assert.equal(mat2Determinant(mat2Identity()), 1);
  });

  it('det([1,2,3,4]) = -2', () => {
    assert.equal(mat2Determinant([1, 2, 3, 4]), -2);
  });

  it('singular matrix has determinant 0', () => {
    assert.equal(mat2Determinant([2, 4, 1, 2]), 0);
  });
});

describe('mat2Inverse()', () => {
  it('M * inverse(M) = identity', () => {
    const m = [1, 2, 3, 4];
    const inv = mat2Inverse(m);
    assert.ok(inv !== null);
    const product = mat2Multiply(m, inv);
    assert.ok(arrApproxEqual(product, [1, 0, 0, 1], 1e-9));
  });

  it('returns null for a singular matrix', () => {
    assert.equal(mat2Inverse([2, 4, 1, 2]), null);
  });

  it('inverse of identity is identity', () => {
    const inv = mat2Inverse(mat2Identity());
    assert.ok(inv !== null);
    assert.ok(arrApproxEqual(inv, [1, 0, 0, 1]));
  });
});

describe('mat2Transpose()', () => {
  it('swaps off-diagonal elements', () => {
    assert.deepEqual(mat2Transpose([1, 2, 3, 4]), [1, 3, 2, 4]);
  });

  it('identity is its own transpose', () => {
    assert.deepEqual(mat2Transpose(mat2Identity()), mat2Identity());
  });
});

describe('mat2Scale()', () => {
  it('returns correct scale matrix', () => {
    assert.deepEqual(mat2Scale(2, 3), [2, 0, 0, 3]);
  });

  it('uniform scale 1 is identity', () => {
    assert.deepEqual(mat2Scale(1, 1), mat2Identity());
  });
});

describe('mat2Rotate()', () => {
  it('rotation by 0 is identity', () => {
    assert.ok(arrApproxEqual(mat2Rotate(0), [1, 0, 0, 1]));
  });

  it('rotation by π/2', () => {
    const m = mat2Rotate(Math.PI / 2);
    assert.ok(arrApproxEqual(m, [0, -1, 1, 0], 1e-9));
  });

  it('rotation by π', () => {
    const m = mat2Rotate(Math.PI);
    assert.ok(arrApproxEqual(m, [-1, 0, 0, -1], 1e-9));
  });

  it('rotate vector (1,0) by π/2 yields (0,1)', () => {
    const m = mat2Rotate(Math.PI / 2);
    // [a,b,c,d] * [x,y]^T = [ax+by, cx+dy]
    const rx = m[0] * 1 + m[1] * 0;
    const ry = m[2] * 1 + m[3] * 0;
    assert.ok(approxEqual(rx, 0));
    assert.ok(approxEqual(ry, 1));
  });
});

// ─── Mat3 ─────────────────────────────────────────────────────────────────────

describe('mat3Identity()', () => {
  it('returns 3x3 identity', () => {
    assert.deepEqual(mat3Identity(), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});

describe('mat3Multiply()', () => {
  it('identity * M = M', () => {
    const m = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    assert.deepEqual(mat3Multiply(mat3Identity(), m), m);
  });

  it('M * identity = M', () => {
    const m = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    assert.deepEqual(mat3Multiply(m, mat3Identity()), m);
  });

  it('multiplies two known 3x3 matrices', () => {
    const a = [1, 0, 0,  0, 1, 0,  0, 0, 1]; // identity
    const b = [2, 3, 4,  5, 6, 7,  8, 9, 10];
    assert.deepEqual(mat3Multiply(a, b), b);
  });
});

describe('mat3Determinant()', () => {
  it('identity has determinant 1', () => {
    assert.equal(mat3Determinant(mat3Identity()), 1);
  });

  it('computes determinant of a known matrix', () => {
    // det([1,2,3, 0,1,4, 5,6,0]) = 1*(0-24)-2*(0-20)+3*(0-5) = -24+40-15 = 1
    const m = [1, 2, 3,  0, 1, 4,  5, 6, 0];
    assert.equal(mat3Determinant(m), 1);
  });

  it('singular matrix has determinant 0', () => {
    const m = [1, 2, 3,  4, 5, 6,  7, 8, 9]; // rows are linearly dependent
    assert.ok(approxEqual(mat3Determinant(m), 0, 1e-9));
  });
});

describe('mat3Transpose()', () => {
  it('transposes a known matrix', () => {
    const m = [1, 2, 3,  4, 5, 6,  7, 8, 9];
    assert.deepEqual(mat3Transpose(m), [1, 4, 7,  2, 5, 8,  3, 6, 9]);
  });

  it('identity is its own transpose', () => {
    assert.deepEqual(mat3Transpose(mat3Identity()), mat3Identity());
  });
});

describe('mat3FromMat4()', () => {
  it('extracts upper-left 3x3 from identity mat4', () => {
    assert.deepEqual(mat3FromMat4(mat4Identity()), mat3Identity());
  });

  it('extracts upper-left 3x3 from a known mat4', () => {
    const m4 = [
       1,  2,  3,  4,
       5,  6,  7,  8,
       9, 10, 11, 12,
      13, 14, 15, 16,
    ];
    assert.deepEqual(mat3FromMat4(m4), [1, 2, 3, 5, 6, 7, 9, 10, 11]);
  });
});

// ─── Mat4 ─────────────────────────────────────────────────────────────────────

describe('mat4Identity()', () => {
  it('returns 4x4 identity', () => {
    assert.deepEqual(mat4Identity(), [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });
});

describe('mat4Multiply()', () => {
  it('identity * M = M', () => {
    const m = mat4Translation(1, 2, 3);
    assert.ok(arrApproxEqual(mat4Multiply(mat4Identity(), m), m));
  });

  it('M * identity = M', () => {
    const m = mat4Scale(2, 3, 4);
    assert.ok(arrApproxEqual(mat4Multiply(m, mat4Identity()), m));
  });

  it('translation * translation accumulates', () => {
    const t1 = mat4Translation(1, 0, 0);
    const t2 = mat4Translation(0, 2, 0);
    const result = mat4Multiply(t1, t2);
    // Translation column should be (1, 2, 0, 1)
    assert.ok(approxEqual(result[3], 1));
    assert.ok(approxEqual(result[7], 2));
    assert.ok(approxEqual(result[11], 0));
  });
});

describe('mat4Transpose()', () => {
  it('transposes a known mat4', () => {
    const m = [
       1,  2,  3,  4,
       5,  6,  7,  8,
       9, 10, 11, 12,
      13, 14, 15, 16,
    ];
    assert.deepEqual(mat4Transpose(m), [
      1, 5,  9, 13,
      2, 6, 10, 14,
      3, 7, 11, 15,
      4, 8, 12, 16,
    ]);
  });

  it('identity is its own transpose', () => {
    assert.deepEqual(mat4Transpose(mat4Identity()), mat4Identity());
  });
});

describe('mat4Translation()', () => {
  it('stores translation in the right column', () => {
    const m = mat4Translation(5, 6, 7);
    assert.equal(m[3],  5);
    assert.equal(m[7],  6);
    assert.equal(m[11], 7);
    assert.equal(m[15], 1);
  });

  it('upper-left 3x3 is identity', () => {
    const m = mat4Translation(1, 2, 3);
    assert.ok(arrApproxEqual(mat3FromMat4(m), mat3Identity()));
  });
});

describe('mat4Scale()', () => {
  it('stores scale on the diagonal', () => {
    const m = mat4Scale(2, 3, 4);
    assert.equal(m[0],  2);
    assert.equal(m[5],  3);
    assert.equal(m[10], 4);
    assert.equal(m[15], 1);
  });

  it('uniform scale 1 is identity', () => {
    assert.deepEqual(mat4Scale(1, 1, 1), mat4Identity());
  });
});

describe('mat4RotateX()', () => {
  it('rotation by 0 is identity', () => {
    assert.ok(arrApproxEqual(mat4RotateX(0), mat4Identity()));
  });

  it('rotation by π/2 around X: Y→Z direction', () => {
    const m = mat4RotateX(Math.PI / 2);
    // Row 1 (y output): [0, c, -s, 0] = [0, 0, -1, 0]
    assert.ok(approxEqual(m[5],  0, 1e-9));
    assert.ok(approxEqual(m[6], -1, 1e-9));
    // Row 2 (z output): [0, s, c, 0] = [0, 1, 0, 0]
    assert.ok(approxEqual(m[9],  1, 1e-9));
    assert.ok(approxEqual(m[10], 0, 1e-9));
  });
});

describe('mat4RotateY()', () => {
  it('rotation by 0 is identity', () => {
    assert.ok(arrApproxEqual(mat4RotateY(0), mat4Identity()));
  });

  it('rotation by π/2 around Y: Z→X direction', () => {
    const m = mat4RotateY(Math.PI / 2);
    // Row 0 (x output): [c, 0, s, 0] = [0, 0, 1, 0]
    assert.ok(approxEqual(m[0], 0, 1e-9));
    assert.ok(approxEqual(m[2], 1, 1e-9));
    // Row 2 (z output): [-s, 0, c, 0] = [-1, 0, 0, 0]
    assert.ok(approxEqual(m[8], -1, 1e-9));
    assert.ok(approxEqual(m[10], 0, 1e-9));
  });
});

describe('mat4RotateZ()', () => {
  it('rotation by 0 is identity', () => {
    assert.ok(arrApproxEqual(mat4RotateZ(0), mat4Identity()));
  });

  it('rotation by π/2 around Z: X→Y direction', () => {
    const m = mat4RotateZ(Math.PI / 2);
    // Row 0 (x output): [c, -s, 0, 0] = [0, -1, 0, 0]
    assert.ok(approxEqual(m[0],  0, 1e-9));
    assert.ok(approxEqual(m[1], -1, 1e-9));
    // Row 1 (y output): [s, c, 0, 0] = [1, 0, 0, 0]
    assert.ok(approxEqual(m[4],  1, 1e-9));
    assert.ok(approxEqual(m[5],  0, 1e-9));
  });
});
