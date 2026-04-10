// ─── Unit Tests: mat-algebra (Dense Matrix & Vector Linear Algebra) ───────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  zeros,
  identity,
  matAdd,
  matSub,
  matMul,
  matScale,
  transpose,
  dot,
  norm,
  solve,
  determinant,
  luDecompose,
} from '../../app/modules/mat-algebra.js';

// ── zeros ─────────────────────────────────────────────────────────────────────

describe('zeros', () => {
  it('creates an m×n zero matrix', () => {
    const z = zeros(2, 3);
    assert.equal(z.length, 2);
    assert.equal(z[0].length, 3);
    assert.ok(z.every(row => row.every(v => v === 0)));
  });

  it('creates a 1×1 zero matrix', () => {
    assert.deepEqual(zeros(1, 1), [[0]]);
  });

  it('rows are independent (not aliased)', () => {
    const z = zeros(2, 2);
    z[0][0] = 99;
    assert.equal(z[1][0], 0);
  });
});

// ── identity ──────────────────────────────────────────────────────────────────

describe('identity', () => {
  it('creates a 3×3 identity matrix', () => {
    const I = identity(3);
    assert.deepEqual(I, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  });

  it('creates a 1×1 identity matrix', () => {
    assert.deepEqual(identity(1), [[1]]);
  });

  it('diagonal entries are 1, off-diagonal are 0', () => {
    const I = identity(4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        assert.equal(I[i][j], i === j ? 1 : 0);
      }
    }
  });
});

// ── matAdd ────────────────────────────────────────────────────────────────────

describe('matAdd', () => {
  it('adds two 2×2 matrices', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    assert.deepEqual(matAdd(a, b), [[6, 8], [10, 12]]);
  });

  it('adding zero matrix is identity', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matAdd(a, zeros(2, 2)), a);
  });

  it('is commutative', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    assert.deepEqual(matAdd(a, b), matAdd(b, a));
  });

  it('does not mutate inputs', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    matAdd(a, b);
    assert.deepEqual(a, [[1, 2], [3, 4]]);
  });

  it('throws for shape mismatch', () => {
    assert.throws(() => matAdd([[1, 2]], [[1], [2]]), Error);
  });
});

// ── matSub ────────────────────────────────────────────────────────────────────

describe('matSub', () => {
  it('subtracts two 2×2 matrices', () => {
    const a = [[5, 6], [7, 8]];
    const b = [[1, 2], [3, 4]];
    assert.deepEqual(matSub(a, b), [[4, 4], [4, 4]]);
  });

  it('A - A = zero matrix', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matSub(a, a), zeros(2, 2));
  });

  it('does not mutate inputs', () => {
    const a = [[5, 6], [7, 8]];
    const b = [[1, 2], [3, 4]];
    matSub(a, b);
    assert.deepEqual(a, [[5, 6], [7, 8]]);
  });

  it('throws for shape mismatch', () => {
    assert.throws(() => matSub([[1, 2]], [[1], [2]]), Error);
  });
});

// ── matMul ────────────────────────────────────────────────────────────────────

describe('matMul', () => {
  it('multiplies two 2×2 matrices', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    assert.deepEqual(matMul(a, b), [[19, 22], [43, 50]]);
  });

  it('multiplies 2×3 by 3×2 → 2×2', () => {
    const a = [[1, 2, 3], [4, 5, 6]];
    const b = [[7, 8], [9, 10], [11, 12]];
    assert.deepEqual(matMul(a, b), [[58, 64], [139, 154]]);
  });

  it('A × I = A', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matMul(a, identity(2)), a);
  });

  it('A × 0 = 0', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matMul(a, zeros(2, 2)), zeros(2, 2));
  });

  it('throws for incompatible dimensions', () => {
    assert.throws(() => matMul([[1, 2]], [[1, 2]]), Error);
  });

  it('does not mutate inputs', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    matMul(a, b);
    assert.deepEqual(a, [[1, 2], [3, 4]]);
  });
});

// ── matScale ──────────────────────────────────────────────────────────────────

describe('matScale', () => {
  it('scales each element by scalar', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matScale(a, 2), [[2, 4], [6, 8]]);
  });

  it('scaling by 0 gives zero matrix', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matScale(a, 0), zeros(2, 2));
  });

  it('scaling by 1 is identity', () => {
    const a = [[1, 2], [3, 4]];
    assert.deepEqual(matScale(a, 1), a);
  });

  it('scaling by -1 negates', () => {
    assert.deepEqual(matScale([[1, -2]], -1), [[-1, 2]]);
  });

  it('does not mutate input', () => {
    const a = [[1, 2], [3, 4]];
    matScale(a, 3);
    assert.deepEqual(a, [[1, 2], [3, 4]]);
  });
});

// ── transpose ─────────────────────────────────────────────────────────────────

describe('transpose', () => {
  it('transposes a 2×2 matrix', () => {
    assert.deepEqual(transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]]);
  });

  it('transposes a 2×3 matrix to 3×2', () => {
    const t = transpose([[1, 2, 3], [4, 5, 6]]);
    assert.deepEqual(t, [[1, 4], [2, 5], [3, 6]]);
  });

  it('double transpose returns original', () => {
    const a = [[1, 2, 3], [4, 5, 6]];
    assert.deepEqual(transpose(transpose(a)), a);
  });

  it('(AB)ᵀ = BᵀAᵀ', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    assert.deepEqual(transpose(matMul(a, b)), matMul(transpose(b), transpose(a)));
  });

  it('does not mutate input', () => {
    const a = [[1, 2], [3, 4]];
    transpose(a);
    assert.deepEqual(a, [[1, 2], [3, 4]]);
  });
});

// ── dot ───────────────────────────────────────────────────────────────────────

describe('dot', () => {
  it('computes dot product of two vectors', () => {
    assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  });

  it('dot of perpendicular vectors is 0', () => {
    assert.equal(dot([1, 0], [0, 1]), 0);
  });

  it('dot of a vector with itself equals sum of squares', () => {
    assert.equal(dot([3, 4], [3, 4]), 25);
  });

  it('is commutative', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    assert.equal(dot(a, b), dot(b, a));
  });

  it('throws for different lengths', () => {
    assert.throws(() => dot([1, 2], [1, 2, 3]), Error);
  });

  it('works with negative values', () => {
    assert.equal(dot([-1, -2], [3, 4]), -11);
  });
});

// ── norm ──────────────────────────────────────────────────────────────────────

describe('norm', () => {
  it('Euclidean norm of [3, 4] is 5', () => {
    assert.ok(Math.abs(norm([3, 4]) - 5) < 1e-10);
  });

  it('p=1 gives Manhattan norm', () => {
    assert.ok(Math.abs(norm([1, -2, 3], 1) - 6) < 1e-10);
  });

  it('p=Infinity gives max-norm', () => {
    assert.ok(Math.abs(norm([1, -5, 3], Infinity) - 5) < 1e-10);
  });

  it('norm of zero vector is 0', () => {
    assert.equal(norm([0, 0, 0]), 0);
  });

  it('norm is always non-negative', () => {
    assert.ok(norm([-3, -4]) >= 0);
  });

  it('scaling a vector scales its norm', () => {
    const v = [3, 4];
    assert.ok(Math.abs(norm(v.map(x => x * 2)) - 2 * norm(v)) < 1e-10);
  });
});

// ── solve ─────────────────────────────────────────────────────────────────────

describe('solve', () => {
  it('solves a simple 2×2 system', () => {
    // 2x + y = 5, x + 3y = 10  →  x=1, y=3
    const A = [[2, 1], [1, 3]];
    const b = [5, 10];
    const x = solve(A, b);
    assert.ok(x !== null);
    assert.ok(Math.abs(x[0] - 1) < 1e-10);
    assert.ok(Math.abs(x[1] - 3) < 1e-10);
  });

  it('solves a 3×3 system', () => {
    const A = [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]];
    const b = [8, -11, -3];
    const x = solve(A, b);
    // Expected: x=2, y=3, z=-1
    assert.ok(x !== null);
    assert.ok(Math.abs(x[0] - 2) < 1e-9);
    assert.ok(Math.abs(x[1] - 3) < 1e-9);
    assert.ok(Math.abs(x[2] - (-1)) < 1e-9);
  });

  it('returns null for singular matrix', () => {
    const A = [[1, 2], [2, 4]]; // rows are linearly dependent
    const b = [1, 2];
    assert.equal(solve(A, b), null);
  });

  it('solves 1×1 system', () => {
    const x = solve([[3]], [9]);
    assert.ok(x !== null);
    assert.ok(Math.abs(x[0] - 3) < 1e-10);
  });

  it('solution satisfies Ax = b', () => {
    const A = [[4, 1], [2, 3]];
    const b = [9, 8];
    const x = solve(A, b);
    assert.ok(x !== null);
    // Verify A*x ≈ b
    for (let i = 0; i < 2; i++) {
      const ax_i = A[i].reduce((s, aij, j) => s + aij * x[j], 0);
      assert.ok(Math.abs(ax_i - b[i]) < 1e-10);
    }
  });

  it('throws if A is not square relative to b', () => {
    assert.throws(() => solve([[1, 2, 3]], [1]), Error);
  });
});

// ── determinant ───────────────────────────────────────────────────────────────

describe('determinant', () => {
  it('1×1 determinant', () => {
    assert.ok(Math.abs(determinant([[5]]) - 5) < 1e-10);
  });

  it('2×2 determinant', () => {
    // det([[1,2],[3,4]]) = 1*4 - 2*3 = -2
    assert.ok(Math.abs(determinant([[1, 2], [3, 4]]) - (-2)) < 1e-10);
  });

  it('3×3 determinant', () => {
    const A = [[1, 2, 3], [4, 5, 6], [7, 8, 10]];
    // det = -3
    assert.ok(Math.abs(determinant(A) - (-3)) < 1e-9);
  });

  it('singular matrix has determinant 0', () => {
    const A = [[1, 2], [2, 4]];
    assert.ok(Math.abs(determinant(A)) < 1e-10);
  });

  it('identity matrix has determinant 1', () => {
    assert.ok(Math.abs(determinant(identity(3)) - 1) < 1e-10);
  });

  it('det(AB) = det(A) * det(B)', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    const detAB = determinant(matMul(a, b));
    const detAdetB = determinant(a) * determinant(b);
    assert.ok(Math.abs(detAB - detAdetB) < 1e-9);
  });

  it('throws for non-square matrix', () => {
    assert.throws(() => determinant([[1, 2, 3], [4, 5, 6]]), Error);
  });
});

// ── luDecompose ───────────────────────────────────────────────────────────────

describe('luDecompose', () => {
  it('PA = LU for a 2×2 matrix', () => {
    const A = [[2, 1], [4, 3]];
    const { L, U, P } = luDecompose(A);
    // Verify PA = LU
    const PA = matMul(P, A);
    const LU = matMul(L, U);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        assert.ok(Math.abs(PA[i][j] - LU[i][j]) < 1e-10, `PA[${i}][${j}] != LU[${i}][${j}]`);
      }
    }
  });

  it('PA = LU for a 3×3 matrix', () => {
    const A = [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]];
    const { L, U, P } = luDecompose(A);
    const PA = matMul(P, A);
    const LU = matMul(L, U);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        assert.ok(Math.abs(PA[i][j] - LU[i][j]) < 1e-9);
      }
    }
  });

  it('L is unit lower triangular', () => {
    const { L } = luDecompose([[4, 3], [6, 3]]);
    // Diagonal must be 1
    assert.ok(Math.abs(L[0][0] - 1) < 1e-10);
    assert.ok(Math.abs(L[1][1] - 1) < 1e-10);
    // Upper triangle must be 0
    assert.ok(Math.abs(L[0][1]) < 1e-10);
  });

  it('U is upper triangular', () => {
    const { U } = luDecompose([[4, 3], [6, 3]]);
    assert.ok(Math.abs(U[1][0]) < 1e-10);
  });

  it('P is a permutation matrix (rows have exactly one 1)', () => {
    const { P } = luDecompose([[2, 1], [4, 3]]);
    for (const row of P) {
      assert.equal(row.filter(v => v === 1).length, 1);
      assert.equal(row.filter(v => v === 0).length, row.length - 1);
    }
  });

  it('handles identity matrix — no row swaps needed', () => {
    const A = identity(3);
    const { L, U, P } = luDecompose(A);
    assert.deepEqual(P, identity(3));
    assert.deepEqual(L, identity(3));
    assert.deepEqual(U, identity(3));
  });

  it('handles empty matrix', () => {
    const { L, U, P } = luDecompose([]);
    assert.deepEqual(L, []);
    assert.deepEqual(U, []);
    assert.deepEqual(P, []);
  });

  it('throws for non-square matrix', () => {
    assert.throws(() => luDecompose([[1, 2, 3], [4, 5, 6]]), Error);
  });
});
