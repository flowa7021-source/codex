// ─── Unit Tests: Matrix (dense matrix library) ────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Matrix, createMatrix, matMul } from '../../app/modules/matrix.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Assert two numbers are within eps of each other. */
function near(a, b, eps = 1e-9) {
  assert.ok(Math.abs(a - b) <= eps, `Expected ${a} to be near ${b} (eps=${eps})`);
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('Matrix – constructor', () => {
  it('creates a 2×3 matrix with correct dimensions', () => {
    const m = new Matrix(2, 3);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 3);
  });

  it('fills with 0 by default', () => {
    const m = new Matrix(2, 2);
    assert.equal(m.get(0, 0), 0);
    assert.equal(m.get(1, 1), 0);
  });

  it('fills with provided fill value', () => {
    const m = new Matrix(3, 3, 7);
    assert.equal(m.get(0, 0), 7);
    assert.equal(m.get(2, 2), 7);
    assert.equal(m.get(1, 2), 7);
  });

  it('accepts fill = 0 explicitly', () => {
    const m = new Matrix(2, 2, 0);
    assert.equal(m.get(0, 1), 0);
  });

  it('throws for rows < 1', () => {
    assert.throws(() => new Matrix(0, 2), /RangeError/);
  });

  it('throws for cols < 1', () => {
    assert.throws(() => new Matrix(2, 0), /RangeError/);
  });

  it('throws for non-integer rows', () => {
    assert.throws(() => new Matrix(1.5, 2), /RangeError/);
  });

  it('throws for negative rows', () => {
    assert.throws(() => new Matrix(-1, 2), /RangeError/);
  });
});

// ─── fromArray ────────────────────────────────────────────────────────────────

describe('Matrix.fromArray', () => {
  it('creates matrix with correct dimensions', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 3);
  });

  it('reads values correctly', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.equal(m.get(0, 0), 1);
    assert.equal(m.get(0, 1), 2);
    assert.equal(m.get(1, 0), 3);
    assert.equal(m.get(1, 1), 4);
  });

  it('deep-copies input (mutation does not affect matrix)', () => {
    const data = [[1, 2], [3, 4]];
    const m = Matrix.fromArray(data);
    data[0][0] = 99;
    assert.equal(m.get(0, 0), 1);
  });

  it('throws on empty outer array', () => {
    assert.throws(() => Matrix.fromArray([]), /RangeError/);
  });

  it('throws on empty inner arrays', () => {
    assert.throws(() => Matrix.fromArray([[]]), /RangeError/);
  });

  it('throws when rows have inconsistent lengths', () => {
    assert.throws(() => Matrix.fromArray([[1, 2], [3]]), /RangeError/);
  });

  it('1×1 matrix', () => {
    const m = Matrix.fromArray([[42]]);
    assert.equal(m.rows, 1);
    assert.equal(m.cols, 1);
    assert.equal(m.get(0, 0), 42);
  });
});

// ─── identity ─────────────────────────────────────────────────────────────────

describe('Matrix.identity', () => {
  it('identity(1) returns [[1]]', () => {
    assert.deepEqual(Matrix.identity(1).toArray(), [[1]]);
  });

  it('identity(3) has ones on diagonal and zeros off it', () => {
    const I = Matrix.identity(3);
    assert.equal(I.get(0, 0), 1);
    assert.equal(I.get(1, 1), 1);
    assert.equal(I.get(2, 2), 1);
    assert.equal(I.get(0, 1), 0);
    assert.equal(I.get(1, 2), 0);
  });

  it('A × I = A', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const I = Matrix.identity(2);
    assert.ok(a.multiply(I).equals(a));
  });
});

// ─── zeros / ones ─────────────────────────────────────────────────────────────

describe('Matrix.zeros', () => {
  it('all elements are zero', () => {
    const Z = Matrix.zeros(3, 4);
    assert.equal(Z.rows, 3);
    assert.equal(Z.cols, 4);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        assert.equal(Z.get(r, c), 0);
      }
    }
  });
});

describe('Matrix.ones', () => {
  it('all elements are one', () => {
    const O = Matrix.ones(2, 3);
    assert.equal(O.rows, 2);
    assert.equal(O.cols, 3);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        assert.equal(O.get(r, c), 1);
      }
    }
  });
});

// ─── random ───────────────────────────────────────────────────────────────────

describe('Matrix.random', () => {
  it('returns correct dimensions', () => {
    const R = Matrix.random(3, 4);
    assert.equal(R.rows, 3);
    assert.equal(R.cols, 4);
  });

  it('all values are in [0, 1)', () => {
    const R = Matrix.random(10, 10);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const v = R.get(r, c);
        assert.ok(v >= 0 && v < 1, `value ${v} out of [0, 1)`);
      }
    }
  });

  it('two random matrices are (almost certainly) different', () => {
    const a = Matrix.random(4, 4);
    const b = Matrix.random(4, 4);
    assert.ok(!a.equals(b, 0));
  });
});

// ─── get / set / toArray ──────────────────────────────────────────────────────

describe('Matrix – get/set/toArray', () => {
  it('get returns correct element', () => {
    const m = Matrix.fromArray([[10, 20], [30, 40]]);
    assert.equal(m.get(0, 0), 10);
    assert.equal(m.get(0, 1), 20);
    assert.equal(m.get(1, 0), 30);
    assert.equal(m.get(1, 1), 40);
  });

  it('set mutates element in place', () => {
    const m = new Matrix(2, 2);
    m.set(0, 0, 99);
    assert.equal(m.get(0, 0), 99);
    assert.equal(m.get(0, 1), 0);
  });

  it('get throws on out-of-bounds row', () => {
    assert.throws(() => new Matrix(2, 2).get(5, 0), /RangeError/);
  });

  it('get throws on negative column', () => {
    assert.throws(() => new Matrix(2, 2).get(0, -1), /RangeError/);
  });

  it('set throws on out-of-bounds', () => {
    assert.throws(() => new Matrix(2, 2).set(2, 0, 1), /RangeError/);
  });

  it('toArray returns deep copy matching values', () => {
    const data = [[1, 2], [3, 4]];
    const m = Matrix.fromArray(data);
    assert.deepEqual(m.toArray(), data);
  });

  it('toArray mutation does not affect matrix', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    const arr = m.toArray();
    arr[0][0] = 999;
    assert.equal(m.get(0, 0), 1);
  });
});

// ─── add / subtract / scale ───────────────────────────────────────────────────

describe('Matrix – add', () => {
  it('element-wise addition of 2×2', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.deepEqual(a.add(b).toArray(), [[6, 8], [10, 12]]);
  });

  it('adding zero matrix is identity operation', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.ok(m.add(Matrix.zeros(2, 2)).equals(m));
  });

  it('throws on dimension mismatch', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[1], [2]]);
    assert.throws(() => a.add(b), /RangeError/);
  });
});

describe('Matrix – subtract', () => {
  it('element-wise subtraction', () => {
    const a = Matrix.fromArray([[5, 6], [7, 8]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(a.subtract(b).toArray(), [[4, 4], [4, 4]]);
  });

  it('subtracting self gives zeros', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.ok(m.subtract(m).equals(Matrix.zeros(2, 2)));
  });

  it('throws on dimension mismatch', () => {
    assert.throws(() => Matrix.fromArray([[1, 2]]).subtract(Matrix.fromArray([[1, 2, 3]])), /RangeError/);
  });
});

describe('Matrix – scale', () => {
  it('multiplies all elements by scalar', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.deepEqual(m.scale(3).toArray(), [[3, 6], [9, 12]]);
  });

  it('scale by 0 gives zero matrix', () => {
    assert.ok(Matrix.fromArray([[1, 2], [3, 4]]).scale(0).equals(Matrix.zeros(2, 2)));
  });

  it('scale by 1 returns equal matrix', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.ok(m.scale(1).equals(m));
  });

  it('scale by -1 negates all elements', () => {
    const m = Matrix.fromArray([[1, -2], [3, -4]]);
    assert.deepEqual(m.scale(-1).toArray(), [[-1, 2], [-3, 4]]);
  });
});

// ─── multiply ─────────────────────────────────────────────────────────────────

describe('Matrix – multiply', () => {
  it('multiplies two 2×2 matrices', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.deepEqual(a.multiply(b).toArray(), [[19, 22], [43, 50]]);
  });

  it('multiplies 2×3 by 3×2 to get 2×2', () => {
    const a = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    const b = Matrix.fromArray([[7, 8], [9, 10], [11, 12]]);
    const r = a.multiply(b);
    assert.equal(r.rows, 2);
    assert.equal(r.cols, 2);
    assert.deepEqual(r.toArray(), [[58, 64], [139, 154]]);
  });

  it('multiplies 3×1 by 1×3 to get 3×3', () => {
    const col = Matrix.fromArray([[1], [2], [3]]);
    const row = Matrix.fromArray([[4, 5, 6]]);
    const r = col.multiply(row);
    assert.equal(r.rows, 3);
    assert.equal(r.cols, 3);
    assert.deepEqual(r.toArray(), [[4, 5, 6], [8, 10, 12], [12, 15, 18]]);
  });

  it('A × I = A', () => {
    const a = Matrix.fromArray([[2, 3], [5, 7]]);
    assert.ok(a.multiply(Matrix.identity(2)).equals(a));
  });

  it('I × A = A', () => {
    const a = Matrix.fromArray([[2, 3], [5, 7]]);
    assert.ok(Matrix.identity(2).multiply(a).equals(a));
  });

  it('throws on incompatible dimensions', () => {
    assert.throws(
      () => Matrix.fromArray([[1, 2]]).multiply(Matrix.fromArray([[1, 2]])),
      /RangeError/,
    );
  });
});

// ─── elementWise / map ────────────────────────────────────────────────────────

describe('Matrix – elementWise', () => {
  it('applies function element-wise', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[10, 20], [30, 40]]);
    const r = a.elementWise(b, (x, y) => x + y);
    assert.deepEqual(r.toArray(), [[11, 22], [33, 44]]);
  });

  it('can multiply element-wise', () => {
    const a = Matrix.fromArray([[2, 3], [4, 5]]);
    const b = Matrix.fromArray([[10, 10], [10, 10]]);
    const r = a.elementWise(b, (x, y) => x * y);
    assert.deepEqual(r.toArray(), [[20, 30], [40, 50]]);
  });

  it('throws on dimension mismatch', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[1], [2]]);
    assert.throws(() => a.elementWise(b, (x, y) => x + y), /RangeError/);
  });
});

describe('Matrix – map', () => {
  it('applies function to every element', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    const r = m.map((v) => v * 2);
    assert.deepEqual(r.toArray(), [[2, 4], [6, 8]]);
  });

  it('passes row and col indices correctly', () => {
    const m = new Matrix(2, 3, 0);
    const r = m.map((_v, row, col) => row * 10 + col);
    assert.equal(r.get(0, 0), 0);
    assert.equal(r.get(0, 2), 2);
    assert.equal(r.get(1, 0), 10);
    assert.equal(r.get(1, 2), 12);
  });

  it('returns a new matrix (does not mutate original)', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    m.map((v) => v + 100);
    assert.equal(m.get(0, 0), 1);
  });
});

// ─── transpose ────────────────────────────────────────────────────────────────

describe('Matrix – transpose', () => {
  it('transposes a 2×3 to 3×2', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    const t = m.transpose();
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.deepEqual(t.toArray(), [[1, 4], [2, 5], [3, 6]]);
  });

  it('double transpose returns original data', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4], [5, 6]]);
    assert.ok(m.transpose().transpose().equals(m));
  });

  it('square matrix transpose swaps off-diagonals', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    const t = m.transpose();
    assert.equal(t.get(0, 1), 3);
    assert.equal(t.get(1, 0), 2);
  });

  it('symmetric matrix is equal to its transpose', () => {
    const m = Matrix.fromArray([[1, 2], [2, 1]]);
    assert.ok(m.equals(m.transpose()));
  });
});

// ─── trace ────────────────────────────────────────────────────────────────────

describe('Matrix – trace', () => {
  it('trace of 2×2 identity is 2', () => {
    assert.equal(Matrix.identity(2).trace(), 2);
  });

  it('trace of 3×3 diagonal matrix', () => {
    const m = Matrix.fromArray([[1, 0, 0], [0, 5, 0], [0, 0, 9]]);
    assert.equal(m.trace(), 15);
  });

  it('trace of 2×2 general matrix', () => {
    assert.equal(Matrix.fromArray([[3, 7], [1, 4]]).trace(), 7);
  });

  it('trace works on non-square (uses min diagonal)', () => {
    // 2×3: diagonal has 2 elements
    const m = Matrix.fromArray([[1, 0, 0], [0, 5, 0]]);
    assert.equal(m.trace(), 6);
  });
});

// ─── determinant ──────────────────────────────────────────────────────────────

describe('Matrix – determinant', () => {
  it('det of 1×1 is the single element', () => {
    near(Matrix.fromArray([[7]]).determinant(), 7);
  });

  it('det of 2×2 identity is 1', () => {
    near(Matrix.identity(2).determinant(), 1);
  });

  it('det of 2×2: ad − bc', () => {
    // [[1,2],[3,4]] → 1*4 - 2*3 = -2
    near(Matrix.fromArray([[1, 2], [3, 4]]).determinant(), -2);
  });

  it('det of singular 2×2 is 0', () => {
    near(Matrix.fromArray([[1, 2], [2, 4]]).determinant(), 0);
  });

  it('det of 3×3 identity is 1', () => {
    near(Matrix.identity(3).determinant(), 1);
  });

  it('det of 3×3 general matrix', () => {
    // [[6,1,1],[4,-2,5],[2,8,7]] → 6(-14-40) - 1(28-10) + 1(32+4) = -324 - 18 + 36 = -306
    const m = Matrix.fromArray([[6, 1, 1], [4, -2, 5], [2, 8, 7]]);
    near(m.determinant(), -306, 1e-6);
  });

  it('throws for non-square matrix', () => {
    assert.throws(() => Matrix.fromArray([[1, 2, 3], [4, 5, 6]]).determinant(), /square/i);
  });
});

// ─── frobenius ────────────────────────────────────────────────────────────────

describe('Matrix – frobenius', () => {
  it('frobenius of zeros matrix is 0', () => {
    near(Matrix.zeros(3, 3).frobenius(), 0);
  });

  it('frobenius of 1×1 is abs(value)', () => {
    near(Matrix.fromArray([[3]]).frobenius(), 3);
  });

  it('frobenius of [[3,4]] is 5', () => {
    near(Matrix.fromArray([[3, 4]]).frobenius(), 5);
  });

  it('frobenius of identity(n) is sqrt(n)', () => {
    near(Matrix.identity(4).frobenius(), 2);
  });

  it('is always non-negative', () => {
    const m = Matrix.fromArray([[-1, -2], [-3, -4]]);
    assert.ok(m.frobenius() >= 0);
  });
});

// ─── isSquare / isSymmetric ───────────────────────────────────────────────────

describe('Matrix – isSquare', () => {
  it('square matrix returns true', () => {
    assert.ok(new Matrix(3, 3).isSquare());
  });

  it('rectangular matrix returns false', () => {
    assert.ok(!new Matrix(2, 3).isSquare());
  });

  it('1×1 is square', () => {
    assert.ok(new Matrix(1, 1).isSquare());
  });
});

describe('Matrix – isSymmetric', () => {
  it('identity matrix is symmetric', () => {
    assert.ok(Matrix.identity(3).isSymmetric());
  });

  it('symmetric 2×2 matrix', () => {
    const m = Matrix.fromArray([[1, 2], [2, 1]]);
    assert.ok(m.isSymmetric());
  });

  it('non-symmetric matrix returns false', () => {
    const m = Matrix.fromArray([[1, 2], [3, 1]]);
    assert.ok(!m.isSymmetric());
  });

  it('non-square matrix is not symmetric', () => {
    assert.ok(!Matrix.fromArray([[1, 2, 3], [4, 5, 6]]).isSymmetric());
  });

  it('uses epsilon for near-symmetric comparison', () => {
    const m = Matrix.fromArray([[1, 2.0000000001], [2, 1]]);
    assert.ok(m.isSymmetric(1e-6));
    assert.ok(!m.isSymmetric(0));
  });
});

// ─── getRow / getCol / setRow / setCol ───────────────────────────────────────

describe('Matrix – getRow', () => {
  it('returns correct row values', () => {
    const m = Matrix.fromArray([[1, 2, 3], [4, 5, 6]]);
    assert.deepEqual(m.getRow(0), [1, 2, 3]);
    assert.deepEqual(m.getRow(1), [4, 5, 6]);
  });

  it('returns a copy (mutation does not affect matrix)', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    const row = m.getRow(0);
    row[0] = 999;
    assert.equal(m.get(0, 0), 1);
  });

  it('throws on out-of-bounds row', () => {
    assert.throws(() => Matrix.fromArray([[1, 2]]).getRow(5), /RangeError/);
  });
});

describe('Matrix – getCol', () => {
  it('returns correct column values', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4], [5, 6]]);
    assert.deepEqual(m.getCol(0), [1, 3, 5]);
    assert.deepEqual(m.getCol(1), [2, 4, 6]);
  });

  it('throws on out-of-bounds column', () => {
    assert.throws(() => Matrix.fromArray([[1, 2]]).getCol(5), /RangeError/);
  });
});

describe('Matrix – setRow', () => {
  it('replaces all values in a row', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    m.setRow(0, [10, 20]);
    assert.deepEqual(m.getRow(0), [10, 20]);
    assert.deepEqual(m.getRow(1), [3, 4]);
  });

  it('throws on out-of-bounds row', () => {
    assert.throws(() => Matrix.fromArray([[1, 2]]).setRow(5, [1, 2]), /RangeError/);
  });

  it('throws when values length !== cols', () => {
    assert.throws(() => Matrix.fromArray([[1, 2]]).setRow(0, [1, 2, 3]), /RangeError/);
  });
});

describe('Matrix – setCol', () => {
  it('replaces all values in a column', () => {
    const m = Matrix.fromArray([[1, 2], [3, 4]]);
    m.setCol(1, [20, 40]);
    assert.deepEqual(m.getCol(1), [20, 40]);
    assert.deepEqual(m.getCol(0), [1, 3]);
  });

  it('throws on out-of-bounds column', () => {
    assert.throws(() => Matrix.fromArray([[1, 2]]).setCol(5, [1]), /RangeError/);
  });

  it('throws when values length !== rows', () => {
    assert.throws(() => Matrix.fromArray([[1, 2], [3, 4]]).setCol(0, [1, 2, 3]), /RangeError/);
  });
});

// ─── equals ───────────────────────────────────────────────────────────────────

describe('Matrix – equals', () => {
  it('identical matrices are equal', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[1, 2], [3, 4]]);
    assert.ok(a.equals(b));
  });

  it('different values → not equal', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[1, 2], [3, 5]]);
    assert.ok(!a.equals(b));
  });

  it('different dimensions → not equal', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[1], [2]]);
    assert.ok(!a.equals(b));
  });

  it('respects epsilon tolerance', () => {
    const a = Matrix.fromArray([[1, 2]]);
    const b = Matrix.fromArray([[1.0000000001, 2]]);
    assert.ok(a.equals(b, 1e-6));
    assert.ok(!a.equals(b, 0));
  });

  it('a matrix equals itself', () => {
    const m = Matrix.fromArray([[3, 1], [4, 1]]);
    assert.ok(m.equals(m));
  });
});

// ─── createMatrix / matMul ────────────────────────────────────────────────────

describe('createMatrix', () => {
  it('returns a Matrix instance', () => {
    assert.ok(createMatrix(2, 3) instanceof Matrix);
  });

  it('has correct dimensions', () => {
    const m = createMatrix(4, 5);
    assert.equal(m.rows, 4);
    assert.equal(m.cols, 5);
  });

  it('uses fill parameter', () => {
    const m = createMatrix(2, 2, 9);
    assert.equal(m.get(0, 0), 9);
    assert.equal(m.get(1, 1), 9);
  });

  it('defaults fill to 0', () => {
    assert.equal(createMatrix(2, 2).get(1, 0), 0);
  });
});

describe('matMul', () => {
  it('is an alias for a.multiply(b)', () => {
    const a = Matrix.fromArray([[1, 2], [3, 4]]);
    const b = Matrix.fromArray([[5, 6], [7, 8]]);
    assert.ok(matMul(a, b).equals(a.multiply(b)));
  });

  it('throws on incompatible dimensions', () => {
    assert.throws(
      () => matMul(Matrix.fromArray([[1, 2]]), Matrix.fromArray([[1, 2]])),
      /RangeError/,
    );
  });
});
