// ─── Unit Tests: SparseMatrix (CSR format) ────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SparseMatrix } from '../../app/modules/sparse-matrix.js';

// ── Constructor & dimensions ──────────────────────────────────────────────────

describe('SparseMatrix – constructor & dimensions', () => {
  it('creates a matrix with correct dimensions', () => {
    const m = new SparseMatrix(3, 4);
    assert.equal(m.rows, 3);
    assert.equal(m.cols, 4);
  });

  it('starts with zero nnz', () => {
    const m = new SparseMatrix(5, 5);
    assert.equal(m.nnz, 0);
  });

  it('allows 0×0 matrix', () => {
    const m = new SparseMatrix(0, 0);
    assert.equal(m.rows, 0);
    assert.equal(m.cols, 0);
    assert.equal(m.nnz, 0);
  });

  it('throws for negative dimensions', () => {
    assert.throws(() => new SparseMatrix(-1, 3), RangeError);
    assert.throws(() => new SparseMatrix(3, -1), RangeError);
  });
});

// ── get / set ─────────────────────────────────────────────────────────────────

describe('SparseMatrix – get / set', () => {
  it('returns 0 for unset elements', () => {
    const m = new SparseMatrix(3, 3);
    assert.equal(m.get(0, 0), 0);
    assert.equal(m.get(1, 2), 0);
  });

  it('sets and retrieves a value', () => {
    const m = new SparseMatrix(3, 3);
    m.set(1, 2, 42);
    assert.equal(m.get(1, 2), 42);
  });

  it('nnz increments after set', () => {
    const m = new SparseMatrix(3, 3);
    m.set(0, 0, 1);
    m.set(1, 1, 2);
    assert.equal(m.nnz, 2);
  });

  it('setting an element to 0 removes it', () => {
    const m = new SparseMatrix(3, 3);
    m.set(0, 0, 5);
    assert.equal(m.nnz, 1);
    m.set(0, 0, 0);
    assert.equal(m.nnz, 0);
    assert.equal(m.get(0, 0), 0);
  });

  it('overwriting a value does not change nnz', () => {
    const m = new SparseMatrix(3, 3);
    m.set(2, 2, 7);
    m.set(2, 2, 99);
    assert.equal(m.nnz, 1);
    assert.equal(m.get(2, 2), 99);
  });

  it('setting 0 for a non-existent entry is a no-op', () => {
    const m = new SparseMatrix(3, 3);
    m.set(1, 1, 0);
    assert.equal(m.nnz, 0);
  });

  it('throws for out-of-bounds access', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.get(3, 0), RangeError);
    assert.throws(() => m.get(0, 3), RangeError);
    assert.throws(() => m.set(-1, 0, 1), RangeError);
  });

  it('handles multiple entries in the same row', () => {
    const m = new SparseMatrix(2, 5);
    m.set(0, 4, 10);
    m.set(0, 1, 20);
    m.set(0, 3, 30);
    assert.equal(m.get(0, 1), 20);
    assert.equal(m.get(0, 3), 30);
    assert.equal(m.get(0, 4), 10);
    assert.equal(m.nnz, 3);
  });
});

// ── toDense / fromDense ───────────────────────────────────────────────────────

describe('SparseMatrix – toDense / fromDense', () => {
  it('toDense returns all zeros for empty matrix', () => {
    const m = new SparseMatrix(2, 3);
    assert.deepEqual(m.toDense(), [[0, 0, 0], [0, 0, 0]]);
  });

  it('toDense reflects set values', () => {
    const m = new SparseMatrix(2, 2);
    m.set(0, 0, 1);
    m.set(1, 1, 4);
    assert.deepEqual(m.toDense(), [[1, 0], [0, 4]]);
  });

  it('fromDense round-trips through toDense', () => {
    const data = [[1, 0, 3], [0, 5, 0], [7, 0, 9]];
    const m = SparseMatrix.fromDense(data);
    assert.deepEqual(m.toDense(), data);
  });

  it('fromDense sets correct nnz', () => {
    const data = [[1, 0, 3], [0, 5, 0], [7, 0, 9]];
    const m = SparseMatrix.fromDense(data);
    assert.equal(m.nnz, 5);
  });

  it('fromDense handles all-zero matrix', () => {
    const data = [[0, 0], [0, 0]];
    const m = SparseMatrix.fromDense(data);
    assert.equal(m.nnz, 0);
    assert.deepEqual(m.toDense(), data);
  });

  it('fromDense handles empty (0-row) matrix', () => {
    const m = SparseMatrix.fromDense([]);
    assert.equal(m.rows, 0);
    assert.equal(m.nnz, 0);
  });
});

// ── add ───────────────────────────────────────────────────────────────────────

describe('SparseMatrix – add', () => {
  it('adds two sparse matrices correctly', () => {
    const a = SparseMatrix.fromDense([[1, 0], [0, 2]]);
    const b = SparseMatrix.fromDense([[0, 3], [4, 0]]);
    const c = a.add(b);
    assert.deepEqual(c.toDense(), [[1, 3], [4, 2]]);
  });

  it('cancels entries that sum to zero', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const b = SparseMatrix.fromDense([[-1, -2], [-3, -4]]);
    const c = a.add(b);
    assert.equal(c.nnz, 0);
  });

  it('returns a new matrix (does not mutate operands)', () => {
    const a = SparseMatrix.fromDense([[1, 0], [0, 1]]);
    const b = SparseMatrix.fromDense([[2, 0], [0, 2]]);
    a.add(b);
    assert.equal(a.get(0, 0), 1);
  });

  it('throws for mismatched dimensions', () => {
    const a = new SparseMatrix(2, 2);
    const b = new SparseMatrix(2, 3);
    assert.throws(() => a.add(b), Error);
  });

  it('addition is commutative', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const b = SparseMatrix.fromDense([[5, 6], [7, 8]]);
    assert.deepEqual(a.add(b).toDense(), b.add(a).toDense());
  });

  it('adding the zero matrix is identity', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const z = new SparseMatrix(2, 2);
    assert.deepEqual(a.add(z).toDense(), a.toDense());
  });
});

// ── multiply ──────────────────────────────────────────────────────────────────

describe('SparseMatrix – multiply', () => {
  it('multiplies two square matrices', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const b = SparseMatrix.fromDense([[5, 6], [7, 8]]);
    const c = a.multiply(b);
    // [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]] = [[19,22],[43,50]]
    assert.deepEqual(c.toDense(), [[19, 22], [43, 50]]);
  });

  it('multiplies non-square compatible matrices', () => {
    // 2×3 × 3×2 → 2×2
    const a = SparseMatrix.fromDense([[1, 2, 3], [4, 5, 6]]);
    const b = SparseMatrix.fromDense([[7, 8], [9, 10], [11, 12]]);
    const c = a.multiply(b);
    assert.equal(c.rows, 2);
    assert.equal(c.cols, 2);
    assert.deepEqual(c.toDense(), [[58, 64], [139, 154]]);
  });

  it('multiplying by identity returns equal matrix', () => {
    const data = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const a = SparseMatrix.fromDense(data);
    const I = SparseMatrix.fromDense([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    assert.deepEqual(a.multiply(I).toDense(), data);
  });

  it('multiplying by zero matrix gives zero matrix', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const z = new SparseMatrix(2, 2);
    const c = a.multiply(z);
    assert.equal(c.nnz, 0);
  });

  it('throws for incompatible dimensions', () => {
    const a = new SparseMatrix(2, 3);
    const b = new SparseMatrix(2, 3);
    assert.throws(() => a.multiply(b), Error);
  });

  it('result has correct dimensions', () => {
    const a = new SparseMatrix(3, 4);
    const b = new SparseMatrix(4, 5);
    const c = a.multiply(b);
    assert.equal(c.rows, 3);
    assert.equal(c.cols, 5);
  });
});

// ── multiplyVector ────────────────────────────────────────────────────────────

describe('SparseMatrix – multiplyVector', () => {
  it('multiplies a matrix by a vector', () => {
    const m = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    assert.deepEqual(m.multiplyVector([1, 0]), [1, 3]);
    assert.deepEqual(m.multiplyVector([0, 1]), [2, 4]);
    assert.deepEqual(m.multiplyVector([1, 1]), [3, 7]);
  });

  it('multiplying by zero vector gives zero vector', () => {
    const m = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    assert.deepEqual(m.multiplyVector([0, 0]), [0, 0]);
  });

  it('works for a row vector (1×n matrix)', () => {
    const m = SparseMatrix.fromDense([[2, 3, 4]]);
    assert.deepEqual(m.multiplyVector([1, 1, 1]), [9]);
  });

  it('throws if vector length does not match cols', () => {
    const m = new SparseMatrix(2, 3);
    assert.throws(() => m.multiplyVector([1, 2]), Error);
  });

  it('returns a fresh array (does not mutate the input vector)', () => {
    const m = SparseMatrix.fromDense([[2, 0], [0, 2]]);
    const v = [3, 4];
    m.multiplyVector(v);
    assert.deepEqual(v, [3, 4]);
  });
});

// ── transpose ─────────────────────────────────────────────────────────────────

describe('SparseMatrix – transpose', () => {
  it('transposes a square matrix', () => {
    const m = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    assert.deepEqual(m.transpose().toDense(), [[1, 3], [2, 4]]);
  });

  it('transposes a rectangular matrix', () => {
    const m = SparseMatrix.fromDense([[1, 2, 3], [4, 5, 6]]);
    const t = m.transpose();
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.deepEqual(t.toDense(), [[1, 4], [2, 5], [3, 6]]);
  });

  it('double transpose returns the original matrix', () => {
    const data = [[1, 2, 3], [4, 5, 6]];
    const m = SparseMatrix.fromDense(data);
    assert.deepEqual(m.transpose().transpose().toDense(), data);
  });

  it('nnz is preserved after transpose', () => {
    const data = [[1, 0, 3], [0, 5, 0]];
    const m = SparseMatrix.fromDense(data);
    assert.equal(m.transpose().nnz, m.nnz);
  });

  it('transpose of zero matrix is zero matrix', () => {
    const m = new SparseMatrix(2, 3);
    const t = m.transpose();
    assert.equal(t.rows, 3);
    assert.equal(t.cols, 2);
    assert.equal(t.nnz, 0);
  });
});
