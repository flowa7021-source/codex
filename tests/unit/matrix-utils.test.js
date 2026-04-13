// ─── Unit Tests: matrix-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Matrix,
  add,
  subtract,
  multiply,
  transpose,
  scale,
  determinant,
  trace,
} from '../../app/modules/matrix-utils.js';

// ─── Matrix.zeros ─────────────────────────────────────────────────────────────

describe('Matrix.zeros', () => {
  it('creates a matrix filled with zeros', () => {
    const m = Matrix.zeros(2, 3);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 3);
    assert.deepEqual(m.toArray(), [[0, 0, 0], [0, 0, 0]]);
  });

  it('creates a 1x1 zero matrix', () => {
    const m = Matrix.zeros(1, 1);
    assert.deepEqual(m.toArray(), [[0]]);
  });

  it('creates a square zero matrix', () => {
    const m = Matrix.zeros(3, 3);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        assert.equal(m.get(r, c), 0);
      }
    }
  });

  it('throws for zero rows', () => {
    assert.throws(() => Matrix.zeros(0, 3), RangeError);
  });

  it('throws for zero cols', () => {
    assert.throws(() => Matrix.zeros(3, 0), RangeError);
  });

  it('throws for negative dimensions', () => {
    assert.throws(() => Matrix.zeros(-1, 3), RangeError);
    assert.throws(() => Matrix.zeros(3, -2), RangeError);
  });

  it('produces independent row arrays', () => {
    const m = Matrix.zeros(2, 2);
    const arr = m.toArray();
    arr[0][0] = 99;
    assert.equal(m.get(0, 0), 0); // original unchanged
  });

  it('returns correct dimensions', () => {
    const m = Matrix.zeros(4, 5);
    assert.equal(m.rows, 4);
    assert.equal(m.cols, 5);
  });
});

// ─── Matrix.identity ─────────────────────────────────────────────────────────

describe('Matrix.identity', () => {
  it('creates a 3x3 identity matrix', () => {
    const m = Matrix.identity(3);
    assert.deepEqual(m.toArray(), [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('creates a 1x1 identity matrix', () => {
    const m = Matrix.identity(1);
    assert.deepEqual(m.toArray(), [[1]]);
  });

  it('creates a 2x2 identity matrix', () => {
    const m = Matrix.identity(2);
    assert.deepEqual(m.toArray(), [[1, 0], [0, 1]]);
  });

  it('is square with rows === cols === n', () => {
    const m = Matrix.identity(4);
    assert.equal(m.rows, 4);
    assert.equal(m.cols, 4);
  });

  it('throws for n <= 0', () => {
    assert.throws(() => Matrix.identity(0), RangeError);
    assert.throws(() => Matrix.identity(-1), RangeError);
  });

  it('off-diagonal elements are zero', () => {
    const m = Matrix.identity(4);
    assert.equal(m.get(0, 1), 0);
    assert.equal(m.get(1, 3), 0);
    assert.equal(m.get(3, 0), 0);
  });

  it('diagonal elements are one', () => {
    const m = Matrix.identity(4);
    for (let i = 0; i < 4; i++) {
      assert.equal(m.get(i, i), 1);
    }
  });

  it('acts as identity under multiplication', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const id = Matrix.identity(2);
    const result = multiply(a, id);
    assert.deepEqual(result.toArray(), a.toArray());
  });
});

// ─── Matrix.fromArray ─────────────────────────────────────────────────────────

describe('Matrix.fromArray', () => {
  it('creates a matrix from a 2D array', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 3);
    assert.equal(m.get(0, 0), 1);
    assert.equal(m.get(1, 2), 6);
  });

  it('makes a deep copy of the input', () => {
    const data = [[1, 2], [3, 4]];
    const m = Matrix.fromArray(data);
    data[0][0] = 99;
    assert.equal(m.get(0, 0), 1);
  });

  it('throws for empty outer array', () => {
    assert.throws(() => Matrix.fromArray([]), RangeError);
  });

  it('throws for rows with inconsistent column counts', () => {
    assert.throws(() => Matrix.fromArray([[1, 2], [3]]), RangeError);
  });

  it('throws for rows with zero columns', () => {
    assert.throws(() => Matrix.fromArray([[]]), RangeError);
  });

  it('handles a 1x1 matrix', () => {
    const m = Matrix.fromArray([[42]]);
    assert.equal(m.rows, 1);
    assert.equal(m.cols, 1);
    assert.equal(m.get(0, 0), 42);
  });

  it('handles negative values', () => {
    const m = Matrix.fromArray([[-1, -2], [-3, -4]]);
    assert.equal(m.get(0, 0), -1);
    assert.equal(m.get(1, 1), -4);
  });

  it('handles floating point values', () => {
    const m = Matrix.fromArray([[1.5, 2.7], [3.14, 0.001]]);
    assert.ok(Math.abs(m.get(1, 0) - 3.14) < 1e-10);
  });
});

// ─── get / set ────────────────────────────────────────────────────────────────

describe('Matrix get and set', () => {
  it('get returns the correct element', () => {
    const m = Matrix.fromArray([[10, 20], [30, 40]]);
    assert.equal(m.get(0, 1), 20);
    assert.equal(m.get(1, 0), 30);
  });

  it('get throws for out-of-bounds row', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.throws(() => m.get(2, 0), RangeError);
    assert.throws(() => m.get(-1, 0), RangeError);
  });

  it('get throws for out-of-bounds col', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.throws(() => m.get(0, 2), RangeError);
    assert.throws(() => m.get(0, -1), RangeError);
  });

  it('set returns a new matrix with the updated value', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    const m2 = m.set(0, 1, 99);
    assert.equal(m2.get(0, 1), 99);
    assert.equal(m.get(0, 1), 2); // original unchanged
  });

  it('set preserves all other elements', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    const m2 = m.set(1, 2, 100);
    assert.equal(m2.get(0, 0), 1);
    assert.equal(m2.get(1, 1), 5);
    assert.equal(m2.get(1, 2), 100);
  });

  it('set throws for out-of-bounds index', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.throws(() => m.set(5, 0, 1), RangeError);
  });

  it('chained set operations are independent', () => {
    const m = Matrix.zeros(2, 2);
    const m2 = m.set(0, 0, 1).set(1, 1, 1);
    assert.equal(m.get(0, 0), 0);
    assert.equal(m2.get(0, 0), 1);
    assert.equal(m2.get(1, 1), 1);
  });

  it('toArray returns a deep copy', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    const arr = m.toArray();
    arr[0][0] = 999;
    assert.equal(m.get(0, 0), 1);
  });
});

// ─── add ──────────────────────────────────────────────────────────────────────

describe('add', () => {
  it('adds two matrices element-wise', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.deepEqual(add(a, b).toArray(), [[6, 8], [10, 12]]);
  });

  it('adding a zero matrix is identity', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const z = Matrix.zeros(2, 2);
    assert.deepEqual(add(a, z).toArray(), a.toArray());
  });

  it('throws when dimensions differ (rows)', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.throws(() => add(a, b), RangeError);
  });

  it('throws when dimensions differ (cols)', () => {
    const a = Matrix.fromArray([[1, 2, 3]]);
    const b = Matrix.fromArray([[1, 2]]);
    assert.throws(() => add(a, b), RangeError);
  });

  it('handles negative values', () => {
    const a = Matrix.fromArray([[-1, -2], [-3, -4]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(add(a, b).toArray(), [[0, 0], [0, 0]]);
  });

  it('does not mutate input matrices', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    add(a, b);
    assert.deepEqual(a.toArray(), [[1, 2], [3, 4]]);
  });

  it('works for non-square matrices', () => {
    const a = Matrix.fromArray([[1, 2, 3]]);
    const b = Matrix.fromArray([[4, 5, 6]]);
    assert.deepEqual(add(a, b).toArray(), [[5, 7, 9]]);
  });

  it('is commutative', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.deepEqual(add(a, b).toArray(), add(b, a).toArray());
  });
});

// ─── subtract ─────────────────────────────────────────────────────────────────

describe('subtract', () => {
  it('subtracts two matrices element-wise', () => {
    const a = Matrix.fromArray([[5, 6], [7, 8]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(subtract(a, b).toArray(), [[4, 4], [4, 4]]);
  });

  it('subtracting a matrix from itself yields zeros', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(subtract(a, a).toArray(), [[0, 0], [0, 0]]);
  });

  it('throws when dimensions differ', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.throws(() => subtract(a, b), RangeError);
  });

  it('handles negative results', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[3, 5]]);
    assert.deepEqual(subtract(a, b).toArray(), [[-2, -3]]);
  });

  it('does not mutate input matrices', () => {
    const a = Matrix.fromArray([[5, 6], [7, 8]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    subtract(a, b);
    assert.deepEqual(a.toArray(), [[5, 6], [7, 8]]);
  });

  it('works for 1x1 matrices', () => {
    const a = Matrix.fromArray([[10]]);
    const b = Matrix.fromArray([[3]]);
    assert.deepEqual(subtract(a, b).toArray(), [[7]]);
  });

  it('subtraction is anti-commutative (a-b = -(b-a))', () => {
    const a = Matrix.fromArray([[3, 4], [5, 6]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    const ab = subtract(a, b);
    const ba = subtract(b, a);
    const negBa = scale(ba, -1);
    assert.deepEqual(ab.toArray(), negBa.toArray());
  });

  it('works for non-square matrices', () => {
    const a = Matrix.fromArray([[10, 20, 30]]);
    const b = Matrix.fromArray([[1, 2, 3]]);
    assert.deepEqual(subtract(a, b).toArray(), [[9, 18, 27]]);
  });
});

// ─── multiply ─────────────────────────────────────────────────────────────────

describe('multiply', () => {
  it('multiplies two 2x2 matrices', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.deepEqual(multiply(a, b).toArray(), [[19, 22], [43, 50]]);
  });

  it('returns matrix with correct shape (m×k times k×n = m×n)', () => {
    const a = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);   // 2x3
    const b = Matrix.fromArray([[7, 8], [9, 10], [11, 12]]); // 3x2
    const result = multiply(a, b);
    assert.equal(result.rows, 2);
    assert.equal(result.cols, 2);
  });

  it('multiplying by identity returns original', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const id = Matrix.identity(2);
    assert.deepEqual(multiply(a, id).toArray(), a.toArray());
    assert.deepEqual(multiply(id, a).toArray(), a.toArray());
  });

  it('multiplying by zero matrix gives zero matrix', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const z = Matrix.zeros(2, 2);
    assert.deepEqual(multiply(a, z).toArray(), [[0, 0], [0, 0]]);
  });

  it('throws when inner dimensions do not match', () => {
    const a = Matrix.fromArray([[1, 2, 3]]);    // 1x3
    const b = Matrix.fromArray([[1, 2], [3, 4]]); // 2x2
    assert.throws(() => multiply(a, b), RangeError);
  });

  it('computes a 3x3 product correctly', () => {
    const a = Matrix.fromArray([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    const b = Matrix.fromArray([[2, 3, 4], [5, 6, 7], [8, 9, 10]]);
    assert.deepEqual(multiply(a, b).toArray(), b.toArray());
  });

  it('non-square matrices produce correct result', () => {
    const a = Matrix.fromArray([[1, 2, 3]]);        // 1x3
    const b = Matrix.fromArray([[1], [2], [3]]);    // 3x1
    const result = multiply(a, b);
    assert.equal(result.rows, 1);
    assert.equal(result.cols, 1);
    assert.equal(result.get(0, 0), 14); // 1*1 + 2*2 + 3*3
  });

  it('is associative: (AB)C = A(BC)', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[0, 1], [1, 0]]);
    const c = Matrix.fromArray([[2, 0], [0, 2]]);
    const lhs = multiply(multiply(a, b), c);
    const rhs = multiply(a, multiply(b, c));
    assert.deepEqual(lhs.toArray(), rhs.toArray());
  });
});

// ─── transpose ────────────────────────────────────────────────────────────────

describe('transpose', () => {
  it('transposes a 2x3 matrix to 3x2', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    const t = transpose(m);
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.deepEqual(t.toArray(), [[1, 4], [2, 5], [3, 6]]);
  });

  it('transpose of identity is identity', () => {
    const id = Matrix.identity(3);
    assert.deepEqual(transpose(id).toArray(), id.toArray());
  });

  it('double transpose returns original', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    assert.deepEqual(transpose(transpose(m)).toArray(), m.toArray());
  });

  it('transposes a 1xN row vector to an Nx1 column vector', () => {
    const m = Matrix.fromArray([[1, 2, 3]]);
    const t = transpose(m);
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 1);
    assert.deepEqual(t.toArray(), [[1], [2], [3]]);
  });

  it('transposes a square matrix', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(transpose(m).toArray(), [[1, 3], [2, 4]]);
  });

  it('does not mutate the input matrix', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    transpose(m);
    assert.deepEqual(m.toArray(), [[1, 2, 3], [4, 5, 6]]);
  });

  it('(AB)^T = B^T * A^T', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    const lhs = transpose(multiply(a, b));
    const rhs = multiply(transpose(b), transpose(a));
    assert.deepEqual(lhs.toArray(), rhs.toArray());
  });

  it('handles a 1x1 matrix', () => {
    const m = Matrix.fromArray([[7]]);
    assert.deepEqual(transpose(m).toArray(), [[7]]);
  });
});

// ─── scale ────────────────────────────────────────────────────────────────────

describe('scale', () => {
  it('multiplies all elements by the scalar', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(scale(m, 2).toArray(), [[2, 4], [6, 8]]);
  });

  it('scaling by 1 returns equal matrix', () => {
    const m = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.deepEqual(scale(m, 1).toArray(), m.toArray());
  });

  it('scaling by 0 gives zero matrix', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(scale(m, 0).toArray(), [[0, 0], [0, 0]]);
  });

  it('scaling by -1 negates all elements', () => {
    const m = Matrix.fromArray([[1, -2], [3, -4]]);
    assert.deepEqual(scale(m, -1).toArray(), [[-1, 2], [-3, 4]]);
  });

  it('does not mutate the input matrix', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    scale(m, 5);
    assert.deepEqual(m.toArray(), [[1, 2], [3, 4]]);
  });

  it('works with fractional scalars', () => {
    const m = Matrix.fromArray([[4, 8], [12, 16]]);
    assert.deepEqual(scale(m, 0.5).toArray(), [[2, 4], [6, 8]]);
  });

  it('works for non-square matrices', () => {
    const m = Matrix.fromArray([[1, 2, 3]]);
    assert.deepEqual(scale(m, 3).toArray(), [[3, 6, 9]]);
  });

  it('double scale is equivalent to single scale with product', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(scale(scale(m, 2), 3).toArray(), scale(m, 6).toArray());
  });
});

// ─── determinant ──────────────────────────────────────────────────────────────

describe('determinant', () => {
  it('computes 1x1 determinant', () => {
    const m = Matrix.fromArray([[7]]);
    assert.equal(determinant(m), 7);
  });

  it('computes 2x2 determinant', () => {
    const m = Matrix.fromArray([[3, 8], [4, 6]]);
    assert.equal(determinant(m), 3 * 6 - 8 * 4); // -14
  });

  it('determinant of 2x2 identity is 1', () => {
    assert.equal(determinant(Matrix.identity(2)), 1);
  });

  it('computes 3x3 determinant', () => {
    const m = Matrix.fromArray([
      [6, 1, 1],
      [4, -2, 5],
      [2, 8, 7],
    ]);
    assert.equal(determinant(m), -306);
  });

  it('determinant of 3x3 identity is 1', () => {
    assert.equal(determinant(Matrix.identity(3)), 1);
  });

  it('singular 2x2 matrix has determinant 0', () => {
    const m = Matrix.fromArray([[2, 4], [1, 2]]);
    assert.equal(determinant(m), 0);
  });

  it('throws for non-square matrix', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    assert.throws(() => determinant(m), RangeError);
  });

  it('throws for unsupported size (4x4)', () => {
    const m = Matrix.identity(4);
    assert.throws(() => determinant(m), RangeError);
  });

  it('det(AB) = det(A) * det(B) for 2x2', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    const detAB = determinant(multiply(a, b));
    const detA_detB = determinant(a) * determinant(b);
    assert.ok(Math.abs(detAB - detA_detB) < 1e-9);
  });
});

// ─── trace ────────────────────────────────────────────────────────────────────

describe('trace', () => {
  it('sums diagonal elements of a 2x2 matrix', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.equal(trace(m), 5);
  });

  it('trace of identity(n) equals n', () => {
    assert.equal(trace(Matrix.identity(1)), 1);
    assert.equal(trace(Matrix.identity(3)), 3);
    assert.equal(trace(Matrix.identity(5)), 5);
  });

  it('trace of zero matrix is 0', () => {
    assert.equal(trace(Matrix.zeros(3, 3)), 0);
  });

  it('computes trace of a 3x3 matrix', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    assert.equal(trace(m), 15);
  });

  it('throws for non-square matrix', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    assert.throws(() => trace(m), RangeError);
  });

  it('trace(A + B) = trace(A) + trace(B)', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.equal(trace(add(a, b)), trace(a) + trace(b));
  });

  it('trace of a 1x1 matrix equals the single element', () => {
    const m = Matrix.fromArray([[42]]);
    assert.equal(trace(m), 42);
  });

  it('trace(A^T) = trace(A)', () => {
    const a = Matrix.fromArray([[3, 1], [2, 7]]);
    assert.equal(trace(transpose(a)), trace(a));
  });
});
