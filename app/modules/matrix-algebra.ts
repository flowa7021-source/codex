// @ts-check
// ─── Matrix Linear Algebra Operations ────────────────────────────────────────
// Higher-level linear-algebra routines built on top of the Matrix class:
// determinant, inverse, rank, eigenvalues, and vector helpers.

import { Matrix } from './matrix.js';

// ─── Private Helpers ──────────────────────────────────────────────────────────

const _EPS = 1e-9;

/** Return the (n-1)×(n-1) submatrix obtained by removing row `r` and col `c`. */
function _minor(m: number[][], r: number, c: number): number[][] {
  return m
    .filter((_, i) => i !== r)
    .map((row) => row.filter((_, j) => j !== c));
}

/** Recursive cofactor determinant on a plain 2-D array. */
function _det(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];

  let det = 0;
  for (let c = 0; c < n; c++) {
    det += (c % 2 === 0 ? 1 : -1) * m[0][c] * _det(_minor(m, 0, c));
  }
  return det;
}

// ─── Determinant ──────────────────────────────────────────────────────────────

/**
 * Compute the determinant of a square matrix.
 * Uses direct formulae for 1×1 and 2×2, and cofactor (Laplace) expansion
 * along the first row for larger matrices (NxN).
 */
export function determinant(matrix: Matrix): number {
  const n = matrix.rows;
  if (n !== matrix.cols) {
    throw new RangeError('determinant() requires a square matrix');
  }
  return _det(matrix.toArray());
}

// ─── Inverse ──────────────────────────────────────────────────────────────────

/**
 * Compute the inverse of a square matrix.
 * Returns `null` if the matrix is singular (determinant ≈ 0).
 * Uses the classical adjugate formula: A⁻¹ = adj(A) / det(A).
 */
export function inverse(matrix: Matrix): Matrix | null {
  const n = matrix.rows;
  if (n !== matrix.cols) {
    throw new RangeError('inverse() requires a square matrix');
  }
  const m = matrix.toArray();
  const det = _det(m);
  if (Math.abs(det) < _EPS) return null;

  // Build cofactor matrix, then transpose to get the adjugate
  const cofactors: number[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (__, c) => {
      const sign = (r + c) % 2 === 0 ? 1 : -1;
      return sign * _det(_minor(m, r, c));
    }),
  );

  // Adjugate = transpose of cofactors
  const adj: number[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (__, c) => cofactors[c][r]),
  );

  // Scale by 1/det
  const invData: number[][] = adj.map((row) => row.map((v) => v / det));
  return new Matrix(invData);
}

// ─── Rank ─────────────────────────────────────────────────────────────────────

/**
 * Compute the rank of a matrix via Gaussian elimination with partial pivoting.
 */
export function rank(matrix: Matrix): number {
  const m = matrix.toArray();
  const rows = m.length;
  const cols = m[0].length;
  let pivotRow = 0;

  for (let col = 0; col < cols && pivotRow < rows; col++) {
    // Find the row with the largest absolute value in this column
    let maxRow = pivotRow;
    let maxVal = Math.abs(m[pivotRow][col]);
    for (let r = pivotRow + 1; r < rows; r++) {
      if (Math.abs(m[r][col]) > maxVal) {
        maxVal = Math.abs(m[r][col]);
        maxRow = r;
      }
    }

    if (maxVal < _EPS) continue; // Column is effectively zero — skip

    // Swap current pivot row with the best row
    [m[pivotRow], m[maxRow]] = [m[maxRow], m[pivotRow]];

    // Eliminate all other rows in this column
    const pivot = m[pivotRow][col];
    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = m[r][col] / pivot;
      for (let c = col; c < cols; c++) {
        m[r][c] -= factor * m[pivotRow][c];
      }
    }

    pivotRow++;
  }

  return pivotRow;
}

// ─── Eigenvalues (2×2) ───────────────────────────────────────────────────────

/**
 * Compute the real eigenvalues of a 2×2 matrix.
 * Returns a pair `[λ₁, λ₂]` sorted descending, or `null` if the eigenvalues
 * are complex (negative discriminant).
 */
export function eigenvalues2x2(
  matrix: Matrix,
): [number, number] | null {
  if (matrix.rows !== 2 || matrix.cols !== 2) {
    throw new RangeError('eigenvalues2x2() requires a 2×2 matrix');
  }
  const a = matrix.get(0, 0);
  const b = matrix.get(0, 1);
  const c = matrix.get(1, 0);
  const d = matrix.get(1, 1);

  // Characteristic polynomial: λ² - tr(A)λ + det(A) = 0
  const tr = a + d;
  const det = a * d - b * c;
  const discriminant = tr * tr - 4 * det;

  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const λ1 = (tr + sqrtDisc) / 2;
  const λ2 = (tr - sqrtDisc) / 2;
  return [λ1, λ2];
}

// ─── Vector Operations ────────────────────────────────────────────────────────

/**
 * Compute the dot (inner) product of two equal-length vectors.
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError('Vectors must have the same length');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Compute the cross product of two 3-D vectors.
 */
export function crossProduct(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Return the Euclidean magnitude (length) of a vector.
 */
export function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Return a unit vector in the same direction as `v`.
 * Throws if `v` is the zero vector.
 */
export function normalize(v: number[]): number[] {
  const mag = magnitude(v);
  if (mag < _EPS) throw new RangeError('Cannot normalise the zero vector');
  return v.map((x) => x / mag);
}

/**
 * Project vector `v` onto vector `onto`.
 * Returns the component of `v` in the direction of `onto`.
 * Throws if `onto` is the zero vector.
 */
export function projectVector(v: number[], onto: number[]): number[] {
  if (v.length !== onto.length) {
    throw new RangeError('Vectors must have the same length');
  }
  const mag2 = dotProduct(onto, onto);
  if (mag2 < _EPS) throw new RangeError('Cannot project onto the zero vector');
  const scalar = dotProduct(v, onto) / mag2;
  return onto.map((x) => x * scalar);
}
