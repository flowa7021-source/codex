// ─── Unit Tests: Linear Algebra ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  determinant,
  inverse,
  rank,
  eigenvalues2x2,
  dotProduct,
  crossProduct,
  magnitude,
  normalize,
  projectVector,
} from '../../app/modules/matrix-algebra.js';
import { Matrix } from '../../app/modules/matrix.js';

describe('determinant', () => {
  it('1x1 matrix', () => assert.equal(determinant(new Matrix([[5]])), 5));
  it('2x2 matrix', () => assert.equal(determinant(new Matrix([[1, 2], [3, 4]])), -2));
  it('3x3 identity has det 1', () => {
    assert.ok(Math.abs(determinant(Matrix.identity(3)) - 1) < 1e-9);
  });
  it('singular matrix has det 0', () => {
    assert.ok(Math.abs(determinant(new Matrix([[1, 2], [2, 4]]))) < 1e-9);
  });
});

describe('inverse', () => {
  it('inverse of identity is identity', () => {
    const I = Matrix.identity(2);
    const inv = inverse(I);
    assert.ok(inv !== null);
    assert.ok(Math.abs(inv.get(0, 0) - 1) < 1e-9);
    assert.ok(Math.abs(inv.get(0, 1)) < 1e-9);
  });

  it('inverse of 2x2', () => {
    const m = new Matrix([[4, 7], [2, 6]]);
    const inv = inverse(m);
    assert.ok(inv !== null);
    // m * inv should be identity
    const prod = m.multiply(inv);
    assert.ok(Math.abs(prod.get(0, 0) - 1) < 1e-9);
    assert.ok(Math.abs(prod.get(1, 1) - 1) < 1e-9);
    assert.ok(Math.abs(prod.get(0, 1)) < 1e-9);
  });

  it('returns null for singular matrix', () => {
    assert.equal(inverse(new Matrix([[1, 2], [2, 4]])), null);
  });
});

describe('rank', () => {
  it('rank of identity matrix equals n', () => assert.equal(rank(Matrix.identity(3)), 3));
  it('rank of zero matrix is 0', () => assert.equal(rank(Matrix.zeros(3, 3)), 0));
  it('rank-deficient matrix', () => {
    const m = new Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    assert.equal(rank(m), 2);
  });
});

describe('eigenvalues2x2', () => {
  it('real eigenvalues for symmetric matrix', () => {
    const m = new Matrix([[4, 1], [1, 4]]);
    const ev = eigenvalues2x2(m);
    assert.ok(ev !== null);
    const [a, b] = ev.sort((x, y) => x - y);
    assert.ok(Math.abs(a - 3) < 1e-9);
    assert.ok(Math.abs(b - 5) < 1e-9);
  });

  it('returns null for complex eigenvalues', () => {
    // rotation matrix has complex eigenvalues
    const m = new Matrix([[0, -1], [1, 0]]);
    assert.equal(eigenvalues2x2(m), null);
  });
});

describe('dotProduct', () => {
  it('basic dot product', () => assert.equal(dotProduct([1, 2, 3], [4, 5, 6]), 32));
  it('orthogonal vectors return 0', () => assert.equal(dotProduct([1, 0], [0, 1]), 0));
});

describe('crossProduct', () => {
  it('i x j = k', () => {
    assert.deepEqual(crossProduct([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  });
  it('j x i = -k', () => {
    assert.deepEqual(crossProduct([0, 1, 0], [1, 0, 0]), [0, 0, -1]);
  });
});

describe('magnitude', () => {
  it('unit vector has magnitude 1', () => assert.ok(Math.abs(magnitude([1, 0, 0]) - 1) < 1e-9));
  it('3-4-5 triangle', () => assert.ok(Math.abs(magnitude([3, 4]) - 5) < 1e-9));
});

describe('normalize', () => {
  it('normalized vector has magnitude 1', () => {
    const n = normalize([3, 4]);
    assert.ok(Math.abs(magnitude(n) - 1) < 1e-9);
  });
  it('direction is preserved', () => {
    const n = normalize([1, 0]);
    assert.ok(Math.abs(n[0] - 1) < 1e-9);
  });
});

describe('projectVector', () => {
  it('projection onto unit vector', () => {
    const proj = projectVector([3, 4], [1, 0]);
    assert.ok(Math.abs(proj[0] - 3) < 1e-9);
    assert.ok(Math.abs(proj[1]) < 1e-9);
  });
});
