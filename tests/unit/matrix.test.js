// ─── Unit Tests: Matrix ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Matrix, createMatrix } from '../../app/modules/matrix.js';

// ─── Constructor & Validation ─────────────────────────────────────────────────

describe('Matrix – constructor', () => {
  it('creates a 2x2 matrix with correct dimensions', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 2);
  });

  it('creates a 2x3 matrix with correct dimensions', () => {
    const m = new Matrix([[1, 2, 3], [4, 5, 6]]);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 3);
  });

  it('creates a 1x1 matrix', () => {
    const m = new Matrix([[42]]);
    assert.equal(m.rows, 1);
    assert.equal(m.cols, 1);
    assert.equal(m.get(0, 0), 42);
  });

  it('deep-copies input so mutation does not affect the matrix', () => {
    const data = [[1, 2], [3, 4]];
    const m = new Matrix(data);
    data[0][0] = 99;
    assert.equal(m.get(0, 0), 1);
  });

  it('throws when given an empty row array', () => {
    assert.throws(() => new Matrix([]), /RangeError/);
  });

  it('throws when a row has zero columns', () => {
    assert.throws(() => new Matrix([[]]), /RangeError/);
  });

  it('throws when rows have inconsistent column counts', () => {
    assert.throws(() => new Matrix([[1, 2], [3]]), /RangeError/);
  });
});

// ─── get / set ────────────────────────────────────────────────────────────────

describe('Matrix – get/set', () => {
  it('get returns the correct element', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.equal(m.get(0, 0), 1);
    assert.equal(m.get(1, 1), 4);
  });

  it('set mutates the element in place', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    m.set(0, 0, 99);
    assert.equal(m.get(0, 0), 99);
  });

  it('get throws on out-of-bounds row', () => {
    const m = new Matrix([[1, 2]]);
    assert.throws(() => m.get(5, 0), /RangeError/);
  });

  it('set throws on negative column index', () => {
    const m = new Matrix([[1, 2]]);
    assert.throws(() => m.set(0, -1, 0), /RangeError/);
  });

  it('get throws on out-of-bounds column', () => {
    const m = new Matrix([[1, 2, 3]]);
    assert.throws(() => m.get(0, 5), /RangeError/);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('Matrix – toArray', () => {
  it('returns the data matching the original', () => {
    const data = [[1, 2], [3, 4]];
    assert.deepEqual(new Matrix(data).toArray(), data);
  });

  it('returns a deep copy so mutations do not affect the matrix', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const arr = m.toArray();
    arr[0][0] = 99;
    assert.equal(m.get(0, 0), 1);
  });
});

// ─── Static Factories ─────────────────────────────────────────────────────────

describe('Matrix – static factories', () => {
  it('identity 3x3 has ones on diagonal', () => {
    const I = Matrix.identity(3);
    assert.equal(I.get(0, 0), 1);
    assert.equal(I.get(0, 1), 0);
    assert.equal(I.get(1, 1), 1);
    assert.equal(I.get(2, 2), 1);
    assert.equal(I.get(0, 2), 0);
  });

  it('identity 1x1 is [[1]]', () => {
    assert.deepEqual(Matrix.identity(1).toArray(), [[1]]);
  });

  it('identity throws for n < 1', () => {
    assert.throws(() => Matrix.identity(0), /RangeError/);
  });

  it('zeros 2x3 has all zeros', () => {
    const Z = Matrix.zeros(2, 3);
    assert.equal(Z.rows, 2);
    assert.equal(Z.cols, 3);
    assert.equal(Z.get(0, 0), 0);
    assert.equal(Z.get(1, 2), 0);
  });

  it('zeros throws for invalid dimensions', () => {
    assert.throws(() => Matrix.zeros(0, 2), /RangeError/);
  });

  it('ones 2x2 has all ones', () => {
    const O = Matrix.ones(2, 2);
    assert.equal(O.get(0, 0), 1);
    assert.equal(O.get(1, 1), 1);
  });

  it('ones throws for invalid column count', () => {
    assert.throws(() => Matrix.ones(2, 0), /RangeError/);
  });
});

// ─── Arithmetic ───────────────────────────────────────────────────────────────

describe('Matrix – add', () => {
  it('adds two 2x2 matrices element-wise', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    const b = new Matrix([[5, 6], [7, 8]]);
    assert.deepEqual(a.add(b).toArray(), [[6, 8], [10, 12]]);
  });

  it('adding the zero matrix is identity', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const zero = Matrix.zeros(2, 2);
    assert.deepEqual(m.add(zero).toArray(), m.toArray());
  });

  it('add throws on dimension mismatch', () => {
    const a = new Matrix([[1, 2]]);
    const b = new Matrix([[1], [2]]);
    assert.throws(() => a.add(b), /RangeError/);
  });
});

describe('Matrix – subtract', () => {
  it('subtracts two 2x2 matrices element-wise', () => {
    const a = new Matrix([[5, 6], [7, 8]]);
    const b = new Matrix([[1, 2], [3, 4]]);
    assert.deepEqual(a.subtract(b).toArray(), [[4, 4], [4, 4]]);
  });

  it('subtracting a matrix from itself gives zeros', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.deepEqual(m.subtract(m).toArray(), [[0, 0], [0, 0]]);
  });

  it('subtract throws on dimension mismatch', () => {
    const a = new Matrix([[1, 2]]);
    const b = new Matrix([[1, 2, 3]]);
    assert.throws(() => a.subtract(b), /RangeError/);
  });
});

describe('Matrix – multiply', () => {
  it('multiplies two 2x2 matrices', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    const b = new Matrix([[5, 6], [7, 8]]);
    assert.deepEqual(a.multiply(b).toArray(), [[19, 22], [43, 50]]);
  });

  it('multiplies a 2x3 by a 3x2 to get a 2x2', () => {
    const a = new Matrix([[1, 2, 3], [4, 5, 6]]);
    const b = new Matrix([[7, 8], [9, 10], [11, 12]]);
    const result = a.multiply(b);
    assert.equal(result.rows, 2);
    assert.equal(result.cols, 2);
    assert.deepEqual(result.toArray(), [[58, 64], [139, 154]]);
  });

  it('A x I = A for 2x2 identity', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    const I = Matrix.identity(2);
    assert.deepEqual(a.multiply(I).toArray(), a.toArray());
  });

  it('I x A = A for 2x2 identity', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    const I = Matrix.identity(2);
    assert.deepEqual(I.multiply(a).toArray(), a.toArray());
  });

  it('multiply throws on incompatible dimensions', () => {
    const a = new Matrix([[1, 2]]);
    const b = new Matrix([[1, 2]]);
    assert.throws(() => a.multiply(b), /RangeError/);
  });
});

describe('Matrix – scale', () => {
  it('scales all elements by the given scalar', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    assert.deepEqual(a.scale(2).toArray(), [[2, 4], [6, 8]]);
  });

  it('scaling by 0 gives a zero matrix', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.deepEqual(m.scale(0).toArray(), [[0, 0], [0, 0]]);
  });

  it('scaling by 1 returns equal data', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.deepEqual(m.scale(1).toArray(), m.toArray());
  });

  it('scaling by -1 negates all elements', () => {
    const m = new Matrix([[1, -2], [3, -4]]);
    assert.deepEqual(m.scale(-1).toArray(), [[-1, 2], [-3, 4]]);
  });
});

// ─── Transpose ────────────────────────────────────────────────────────────────

describe('Matrix – transpose', () => {
  it('transposes a 2x3 matrix to 3x2', () => {
    const a = new Matrix([[1, 2, 3], [4, 5, 6]]);
    const t = a.transpose();
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.equal(t.get(0, 0), 1);
    assert.equal(t.get(2, 1), 6);
  });

  it('double-transposing returns the original data', () => {
    const m = new Matrix([[1, 2], [3, 4], [5, 6]]);
    assert.deepEqual(m.transpose().transpose().toArray(), m.toArray());
  });

  it('transpose of a square matrix swaps off-diagonals', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const t = m.transpose();
    assert.equal(t.get(0, 1), 3);
    assert.equal(t.get(1, 0), 2);
  });
});

// ─── Trace ────────────────────────────────────────────────────────────────────

describe('Matrix – trace', () => {
  it('trace of identity(4) equals 4', () => {
    assert.equal(Matrix.identity(4).trace(), 4);
  });

  it('trace of a 2x2 matrix is sum of diagonal', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.equal(m.trace(), 5);
  });

  it('trace of a 3x3 diagonal matrix', () => {
    const m = new Matrix([[1, 0, 0], [0, 5, 0], [0, 0, 9]]);
    assert.equal(m.trace(), 15);
  });

  it('trace throws for non-square matrix', () => {
    const m = new Matrix([[1, 2, 3], [4, 5, 6]]);
    assert.throws(() => m.trace(), /RangeError/);
  });
});

// ─── createMatrix factory ─────────────────────────────────────────────────────

describe('createMatrix factory', () => {
  it('creates a Matrix instance', () => {
    const m = createMatrix([[1, 0], [0, 1]]);
    assert.ok(m instanceof Matrix);
    assert.equal(m.rows, 2);
  });

  it('is equivalent to new Matrix()', () => {
    const data = [[1, 2], [3, 4]];
    assert.deepEqual(createMatrix(data).toArray(), new Matrix(data).toArray());
  });
});
