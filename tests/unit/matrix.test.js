// ─── Unit Tests: Matrix ───────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Matrix, createMatrix } from '../../app/modules/matrix.js';

describe('Matrix – construction', () => {
  it('creates a matrix with correct dimensions', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.equal(m.rows, 2);
    assert.equal(m.cols, 2);
  });

  it('get/set work correctly', () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    assert.equal(m.get(0, 0), 1);
    assert.equal(m.get(1, 1), 4);
    m.set(0, 0, 99);
    assert.equal(m.get(0, 0), 99);
  });

  it('toArray returns the data', () => {
    const data = [[1, 2], [3, 4]];
    assert.deepEqual(new Matrix(data).toArray(), data);
  });
});

describe('Matrix – static factories', () => {
  it('identity matrix', () => {
    const I = Matrix.identity(3);
    assert.equal(I.get(0, 0), 1);
    assert.equal(I.get(0, 1), 0);
    assert.equal(I.get(1, 1), 1);
  });

  it('zeros matrix', () => {
    const Z = Matrix.zeros(2, 3);
    assert.equal(Z.rows, 2);
    assert.equal(Z.cols, 3);
    assert.equal(Z.get(1, 2), 0);
  });

  it('ones matrix', () => {
    const O = Matrix.ones(2, 2);
    assert.equal(O.get(0, 0), 1);
    assert.equal(O.get(1, 1), 1);
  });
});

describe('Matrix – arithmetic', () => {
  it('add two matrices', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    const b = new Matrix([[5, 6], [7, 8]]);
    const result = a.add(b);
    assert.deepEqual(result.toArray(), [[6, 8], [10, 12]]);
  });

  it('subtract two matrices', () => {
    const a = new Matrix([[5, 6], [7, 8]]);
    const b = new Matrix([[1, 2], [3, 4]]);
    const result = a.subtract(b);
    assert.deepEqual(result.toArray(), [[4, 4], [4, 4]]);
  });

  it('multiply 2x2 matrices', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    const b = new Matrix([[5, 6], [7, 8]]);
    const result = a.multiply(b);
    assert.deepEqual(result.toArray(), [[19, 22], [43, 50]]);
  });

  it('scale by scalar', () => {
    const a = new Matrix([[1, 2], [3, 4]]);
    assert.deepEqual(a.scale(2).toArray(), [[2, 4], [6, 8]]);
  });

  it('transpose', () => {
    const a = new Matrix([[1, 2, 3], [4, 5, 6]]);
    const t = a.transpose();
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.equal(t.get(0, 0), 1);
    assert.equal(t.get(2, 1), 6);
  });

  it('trace of identity matrix equals n', () => {
    assert.equal(Matrix.identity(4).trace(), 4);
  });
});

describe('createMatrix factory', () => {
  it('creates a Matrix instance', () => {
    const m = createMatrix([[1, 0], [0, 1]]);
    assert.ok(m instanceof Matrix);
    assert.equal(m.rows, 2);
  });
});
