// ─── Unit Tests: SparseMatrix ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SparseMatrix,
  createSparseMatrix,
  sparseDiagonal,
  sparseIdentity,
} from '../../app/modules/sparse-matrix.js';

// ── 1. Construction and properties ────────────────────────────────────────────

describe('SparseMatrix – construction and properties', () => {
  it('stores correct row and column counts', () => {
    const m = new SparseMatrix(4, 7);
    assert.equal(m.rows, 4);
    assert.equal(m.cols, 7);
  });

  it('starts with nnz of 0', () => {
    const m = new SparseMatrix(10, 10);
    assert.equal(m.nnz, 0);
  });

  it('allows a 0×0 matrix', () => {
    const m = new SparseMatrix(0, 0);
    assert.equal(m.rows, 0);
    assert.equal(m.cols, 0);
    assert.equal(m.nnz, 0);
  });

  it('allows a 0-row matrix with columns', () => {
    const m = new SparseMatrix(0, 5);
    assert.equal(m.rows, 0);
    assert.equal(m.cols, 5);
  });

  it('allows a 0-column matrix with rows', () => {
    const m = new SparseMatrix(3, 0);
    assert.equal(m.rows, 3);
    assert.equal(m.cols, 0);
  });

  it('throws RangeError for negative row count', () => {
    assert.throws(() => new SparseMatrix(-1, 3), RangeError);
  });

  it('throws RangeError for negative column count', () => {
    assert.throws(() => new SparseMatrix(3, -1), RangeError);
  });
});

// ── 2. get / set including zero removal ───────────────────────────────────────

describe('SparseMatrix – get / set', () => {
  it('returns 0 for every unset element', () => {
    const m = new SparseMatrix(5, 5);
    assert.equal(m.get(0, 0), 0);
    assert.equal(m.get(4, 4), 0);
    assert.equal(m.get(2, 3), 0);
  });

  it('stores and retrieves a positive value', () => {
    const m = new SparseMatrix(3, 3);
    m.set(1, 2, 42);
    assert.equal(m.get(1, 2), 42);
  });

  it('stores and retrieves a negative value', () => {
    const m = new SparseMatrix(3, 3);
    m.set(0, 0, -7);
    assert.equal(m.get(0, 0), -7);
  });

  it('nnz increments for each distinct non-zero set', () => {
    const m = new SparseMatrix(4, 4);
    m.set(0, 0, 1);
    assert.equal(m.nnz, 1);
    m.set(1, 1, 2);
    assert.equal(m.nnz, 2);
    m.set(3, 3, 3);
    assert.equal(m.nnz, 3);
  });

  it('overwriting an existing value does not change nnz', () => {
    const m = new SparseMatrix(3, 3);
    m.set(2, 2, 5);
    m.set(2, 2, 99);
    assert.equal(m.nnz, 1);
    assert.equal(m.get(2, 2), 99);
  });

  it('setting to 0 removes the entry and decrements nnz', () => {
    const m = new SparseMatrix(3, 3);
    m.set(0, 1, 10);
    assert.equal(m.nnz, 1);
    m.set(0, 1, 0);
    assert.equal(m.nnz, 0);
    assert.equal(m.get(0, 1), 0);
  });

  it('setting 0 for a non-existent entry is a no-op (nnz stays 0)', () => {
    const m = new SparseMatrix(3, 3);
    m.set(1, 1, 0);
    assert.equal(m.nnz, 0);
  });

  it('multiple entries in the same row are independently accessible', () => {
    const m = new SparseMatrix(2, 5);
    m.set(0, 0, 1);
    m.set(0, 2, 3);
    m.set(0, 4, 5);
    assert.equal(m.get(0, 0), 1);
    assert.equal(m.get(0, 2), 3);
    assert.equal(m.get(0, 4), 5);
    assert.equal(m.nnz, 3);
  });

  it('throws RangeError for row out of bounds on get', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.get(3, 0), RangeError);
  });

  it('throws RangeError for negative row on get', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.get(-1, 0), RangeError);
  });

  it('throws RangeError for col out of bounds on get', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.get(0, 3), RangeError);
  });

  it('throws RangeError for row out of bounds on set', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.set(5, 0, 1), RangeError);
  });

  it('throws RangeError for negative col on set', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.set(0, -1, 1), RangeError);
  });
});

// ── 3. add ────────────────────────────────────────────────────────────────────

describe('SparseMatrix – add', () => {
  it('adds two matrices element-wise', () => {
    const a = SparseMatrix.fromDense([[1, 0], [0, 2]]);
    const b = SparseMatrix.fromDense([[0, 3], [4, 0]]);
    assert.deepEqual(a.add(b).toDense(), [[1, 3], [4, 2]]);
  });

  it('cancels entries that sum to exactly zero', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const b = SparseMatrix.fromDense([[-1, -2], [-3, -4]]);
    const c = a.add(b);
    assert.equal(c.nnz, 0);
  });

  it('does not mutate either operand', () => {
    const a = SparseMatrix.fromDense([[5, 0], [0, 5]]);
    const b = SparseMatrix.fromDense([[1, 0], [0, 1]]);
    a.add(b);
    assert.equal(a.get(0, 0), 5);
    assert.equal(b.get(1, 1), 1);
  });

  it('returns the same values when adding a zero matrix', () => {
    const a = SparseMatrix.fromDense([[7, 8], [9, 10]]);
    const z = new SparseMatrix(2, 2);
    assert.deepEqual(a.add(z).toDense(), a.toDense());
  });

  it('addition is commutative', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const b = SparseMatrix.fromDense([[5, 6], [7, 8]]);
    assert.deepEqual(a.add(b).toDense(), b.add(a).toDense());
  });

  it('throws RangeError for mismatched dimensions', () => {
    const a = new SparseMatrix(2, 2);
    const b = new SparseMatrix(2, 3);
    assert.throws(() => a.add(b), RangeError);
  });
});

// ── 4. scale ──────────────────────────────────────────────────────────────────

describe('SparseMatrix – scale', () => {
  it('multiplies every element by a positive scalar', () => {
    const m = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    assert.deepEqual(m.scale(3).toDense(), [[3, 6], [9, 12]]);
  });

  it('negates all elements when scalar is -1', () => {
    const m = SparseMatrix.fromDense([[1, -2], [3, 0]]);
    assert.deepEqual(m.scale(-1).toDense(), [[-1, 2], [-3, 0]]);
  });

  it('returns all-zero matrix when scalar is 0', () => {
    const m = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const r = m.scale(0);
    assert.equal(r.nnz, 0);
    assert.deepEqual(r.toDense(), [[0, 0], [0, 0]]);
  });

  it('does not mutate the original matrix', () => {
    const m = SparseMatrix.fromDense([[2, 4], [6, 8]]);
    m.scale(10);
    assert.equal(m.get(0, 0), 2);
  });

  it('preserves nnz when scalar is non-zero', () => {
    const m = SparseMatrix.fromDense([[1, 0], [0, 1]]);
    assert.equal(m.scale(5).nnz, 2);
  });
});

// ── 5. multiply ───────────────────────────────────────────────────────────────

describe('SparseMatrix – multiply', () => {
  it('multiplies two 2×2 matrices', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const b = SparseMatrix.fromDense([[5, 6], [7, 8]]);
    assert.deepEqual(a.multiply(b).toDense(), [[19, 22], [43, 50]]);
  });

  it('multiplies 2×3 by 3×2 giving 2×2', () => {
    const a = SparseMatrix.fromDense([[1, 2, 3], [4, 5, 6]]);
    const b = SparseMatrix.fromDense([[7, 8], [9, 10], [11, 12]]);
    const c = a.multiply(b);
    assert.equal(c.rows, 2);
    assert.equal(c.cols, 2);
    assert.deepEqual(c.toDense(), [[58, 64], [139, 154]]);
  });

  it('multiplying by identity gives equal matrix', () => {
    const data = [[1, 2], [3, 4]];
    const a = SparseMatrix.fromDense(data);
    const I = sparseIdentity(2);
    assert.deepEqual(a.multiply(I).toDense(), data);
  });

  it('multiplying by zero matrix yields all zeros', () => {
    const a = SparseMatrix.fromDense([[1, 2], [3, 4]]);
    const z = new SparseMatrix(2, 2);
    assert.equal(a.multiply(z).nnz, 0);
  });

  it('result has the correct dimensions', () => {
    const a = new SparseMatrix(3, 4);
    const b = new SparseMatrix(4, 5);
    const c = a.multiply(b);
    assert.equal(c.rows, 3);
    assert.equal(c.cols, 5);
  });

  it('throws RangeError when inner dimensions do not match', () => {
    const a = new SparseMatrix(2, 3);
    const b = new SparseMatrix(2, 3);
    assert.throws(() => a.multiply(b), RangeError);
  });
});

// ── 6. transpose ──────────────────────────────────────────────────────────────

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

  it('double transpose round-trips to the original', () => {
    const data = [[1, 2, 3], [4, 5, 6]];
    const m = SparseMatrix.fromDense(data);
    assert.deepEqual(m.transpose().transpose().toDense(), data);
  });

  it('nnz is preserved after transpose', () => {
    const m = SparseMatrix.fromDense([[1, 0, 3], [0, 5, 0]]);
    assert.equal(m.transpose().nnz, m.nnz);
  });

  it('transpose of a zero matrix is a zero matrix with flipped dimensions', () => {
    const m = new SparseMatrix(2, 5);
    const t = m.transpose();
    assert.equal(t.rows, 5);
    assert.equal(t.cols, 2);
    assert.equal(t.nnz, 0);
  });
});

// ── 7. toDense / fromDense roundtrip ─────────────────────────────────────────

describe('SparseMatrix – toDense / fromDense', () => {
  it('toDense on empty matrix returns all zeros', () => {
    const m = new SparseMatrix(2, 3);
    assert.deepEqual(m.toDense(), [[0, 0, 0], [0, 0, 0]]);
  });

  it('fromDense round-trips through toDense', () => {
    const data = [[1, 0, 3], [0, 5, 0], [7, 0, 9]];
    assert.deepEqual(SparseMatrix.fromDense(data).toDense(), data);
  });

  it('fromDense sets correct nnz (ignoring zeros)', () => {
    const data = [[1, 0, 3], [0, 5, 0], [7, 0, 9]];
    assert.equal(SparseMatrix.fromDense(data).nnz, 5);
  });

  it('fromDense with all-zero data yields nnz of 0', () => {
    const m = SparseMatrix.fromDense([[0, 0], [0, 0]]);
    assert.equal(m.nnz, 0);
  });

  it('fromDense of an empty array yields a 0×0 matrix', () => {
    const m = SparseMatrix.fromDense([]);
    assert.equal(m.rows, 0);
    assert.equal(m.cols, 0);
  });

  it('fromDense preserves negative values', () => {
    const data = [[-1, 2], [3, -4]];
    assert.deepEqual(SparseMatrix.fromDense(data).toDense(), data);
  });
});

// ── 8. entries iterator ───────────────────────────────────────────────────────

describe('SparseMatrix – entries', () => {
  it('returns an empty array for a zero matrix', () => {
    const m = new SparseMatrix(3, 3);
    assert.deepEqual(m.entries(), []);
  });

  it('returns one entry for a single set element', () => {
    const m = new SparseMatrix(3, 3);
    m.set(2, 1, 99);
    assert.deepEqual(m.entries(), [{ row: 2, col: 1, value: 99 }]);
  });

  it('entries are sorted by row then by column', () => {
    const m = new SparseMatrix(3, 4);
    m.set(2, 3, 6);
    m.set(0, 1, 1);
    m.set(2, 0, 5);
    m.set(1, 2, 3);
    const rows = m.entries().map(e => e.row);
    const cols = m.entries().map(e => e.col);
    assert.deepEqual(rows, [0, 1, 2, 2]);
    assert.deepEqual(cols, [1, 2, 0, 3]);
  });

  it('entries count equals nnz', () => {
    const data = [[1, 0, 2], [0, 3, 0]];
    const m = SparseMatrix.fromDense(data);
    assert.equal(m.entries().length, m.nnz);
  });

  it('entry values match what get() returns', () => {
    const data = [[4, 0], [0, 7]];
    const m = SparseMatrix.fromDense(data);
    for (const { row, col, value } of m.entries()) {
      assert.equal(value, m.get(row, col));
    }
  });
});

// ── 9. frobeniusNorm ──────────────────────────────────────────────────────────

describe('SparseMatrix – frobeniusNorm', () => {
  it('returns 0 for a zero matrix', () => {
    const m = new SparseMatrix(4, 4);
    assert.equal(m.frobeniusNorm(), 0);
  });

  it('returns the correct norm for an identity matrix', () => {
    const I = sparseIdentity(3);
    // sqrt(1^2 + 1^2 + 1^2) = sqrt(3)
    assert.ok(Math.abs(I.frobeniusNorm() - Math.sqrt(3)) < 1e-10);
  });

  it('handles a single-element matrix', () => {
    const m = new SparseMatrix(1, 1);
    m.set(0, 0, 5);
    assert.equal(m.frobeniusNorm(), 5);
  });

  it('is invariant under transpose', () => {
    const data = [[3, 0], [4, 0]];
    const m = SparseMatrix.fromDense(data);
    assert.ok(Math.abs(m.frobeniusNorm() - m.transpose().frobeniusNorm()) < 1e-10);
  });

  it('scales correctly when the matrix is scaled', () => {
    const m = SparseMatrix.fromDense([[3, 4]]);
    // norm = 5; scaled by 2 → norm = 10
    assert.ok(Math.abs(m.scale(2).frobeniusNorm() - 10) < 1e-10);
  });
});

// ── 10. getRow / getCol / rowSum / colSum ─────────────────────────────────────

describe('SparseMatrix – getRow / getCol / rowSum / colSum', () => {
  it('getRow returns a Map of col→value for a populated row', () => {
    const m = SparseMatrix.fromDense([[1, 0, 3], [0, 5, 0]]);
    const row = m.getRow(0);
    assert.ok(row instanceof Map);
    assert.equal(row.get(0), 1);
    assert.equal(row.get(2), 3);
    assert.equal(row.size, 2);
  });

  it('getRow returns an empty Map for an all-zero row', () => {
    const m = new SparseMatrix(3, 3);
    assert.equal(m.getRow(1).size, 0);
  });

  it('getRow snapshot does not affect the matrix when mutated', () => {
    const m = new SparseMatrix(2, 2);
    m.set(0, 0, 9);
    const snap = m.getRow(0);
    snap.set(0, 999);
    assert.equal(m.get(0, 0), 9);
  });

  it('getRow throws RangeError for out-of-bounds row', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.getRow(3), RangeError);
    assert.throws(() => m.getRow(-1), RangeError);
  });

  it('getCol returns a Map of row→value for a populated column', () => {
    const m = SparseMatrix.fromDense([[1, 0], [2, 0], [3, 0]]);
    const col = m.getCol(0);
    assert.ok(col instanceof Map);
    assert.equal(col.get(0), 1);
    assert.equal(col.get(1), 2);
    assert.equal(col.get(2), 3);
  });

  it('getCol returns an empty Map for an all-zero column', () => {
    const m = new SparseMatrix(3, 3);
    assert.equal(m.getCol(2).size, 0);
  });

  it('getCol throws RangeError for out-of-bounds column', () => {
    const m = new SparseMatrix(3, 3);
    assert.throws(() => m.getCol(3), RangeError);
    assert.throws(() => m.getCol(-1), RangeError);
  });

  it('rowSum sums all values in the given row', () => {
    const m = SparseMatrix.fromDense([[1, 2, 3], [4, 5, 6]]);
    assert.equal(m.rowSum(0), 6);
    assert.equal(m.rowSum(1), 15);
  });

  it('rowSum returns 0 for an all-zero row', () => {
    const m = new SparseMatrix(2, 3);
    assert.equal(m.rowSum(0), 0);
  });

  it('rowSum throws RangeError for out-of-bounds row', () => {
    const m = new SparseMatrix(2, 2);
    assert.throws(() => m.rowSum(2), RangeError);
  });

  it('colSum sums all values in the given column', () => {
    const m = SparseMatrix.fromDense([[1, 2], [3, 4], [5, 6]]);
    assert.equal(m.colSum(0), 9);
    assert.equal(m.colSum(1), 12);
  });

  it('colSum returns 0 for an all-zero column', () => {
    const m = new SparseMatrix(3, 3);
    assert.equal(m.colSum(1), 0);
  });

  it('colSum throws RangeError for out-of-bounds column', () => {
    const m = new SparseMatrix(2, 2);
    assert.throws(() => m.colSum(-1), RangeError);
  });
});

// ── 11. createSparseMatrix / sparseDiagonal / sparseIdentity factories ────────

describe('SparseMatrix – factory functions', () => {
  it('createSparseMatrix returns an empty SparseMatrix with correct size', () => {
    const m = createSparseMatrix(5, 6);
    assert.ok(m instanceof SparseMatrix);
    assert.equal(m.rows, 5);
    assert.equal(m.cols, 6);
    assert.equal(m.nnz, 0);
  });

  it('createSparseMatrix throws for negative dimensions', () => {
    assert.throws(() => createSparseMatrix(-1, 3), RangeError);
  });

  it('sparseDiagonal creates correct diagonal matrix', () => {
    const d = sparseDiagonal([2, 4, 6]);
    assert.equal(d.rows, 3);
    assert.equal(d.cols, 3);
    assert.equal(d.get(0, 0), 2);
    assert.equal(d.get(1, 1), 4);
    assert.equal(d.get(2, 2), 6);
    assert.equal(d.get(0, 1), 0);
    assert.equal(d.get(1, 0), 0);
  });

  it('sparseDiagonal nnz equals the number of non-zero values', () => {
    const d = sparseDiagonal([1, 0, 3]);
    assert.equal(d.nnz, 2);
  });

  it('sparseDiagonal of empty array creates 0×0 matrix', () => {
    const d = sparseDiagonal([]);
    assert.equal(d.rows, 0);
    assert.equal(d.cols, 0);
  });

  it('sparseIdentity creates an n×n identity matrix', () => {
    const I = sparseIdentity(4);
    assert.equal(I.rows, 4);
    assert.equal(I.cols, 4);
    assert.equal(I.nnz, 4);
    for (let i = 0; i < 4; i++) {
      assert.equal(I.get(i, i), 1);
      for (let j = 0; j < 4; j++) {
        if (i !== j) assert.equal(I.get(i, j), 0);
      }
    }
  });

  it('sparseIdentity 1×1 is a single 1 on the diagonal', () => {
    const I = sparseIdentity(1);
    assert.equal(I.get(0, 0), 1);
    assert.equal(I.nnz, 1);
  });

  it('sparseIdentity 0×0 has nnz 0', () => {
    const I = sparseIdentity(0);
    assert.equal(I.rows, 0);
    assert.equal(I.nnz, 0);
  });

  it('multiplying a matrix by sparseIdentity is idempotent', () => {
    const data = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const a = SparseMatrix.fromDense(data);
    const I = sparseIdentity(3);
    assert.deepEqual(a.multiply(I).toDense(), data);
    assert.deepEqual(I.multiply(a).toDense(), data);
  });
});
