// @ts-check
// ─── Mat-Algebra: Dense Matrix & Vector Linear Algebra ───────────────────────
// Common linear algebra operations on dense matrices (Matrix = number[][]) and
// vectors (Vector = number[]).  All functions are pure; they never mutate their
// arguments.

export type Matrix = number[][];
export type Vector = number[];

// ── Factories ────────────────────────────────────────────────────────────────

/** Create an m×n zero matrix. */
export function zeros(m: number, n: number): Matrix {
  return Array.from({ length: m }, () => new Array<number>(n).fill(0));
}

/** Create an n×n identity matrix. */
export function identity(n: number): Matrix {
  const I = zeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

// ── Elementwise arithmetic ────────────────────────────────────────────────────

/** Matrix addition A + B. */
export function matAdd(a: Matrix, b: Matrix): Matrix {
  const [m, n] = _shape(a);
  _assertSameShape(a, b, 'matAdd');
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (__, j) => a[i][j] + b[i][j]),
  );
}

/** Matrix subtraction A − B. */
export function matSub(a: Matrix, b: Matrix): Matrix {
  const [m, n] = _shape(a);
  _assertSameShape(a, b, 'matSub');
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (__, j) => a[i][j] - b[i][j]),
  );
}

/** Matrix multiplication A × B. */
export function matMul(a: Matrix, b: Matrix): Matrix {
  const [m, k] = _shape(a);
  const [k2, n] = _shape(b);
  if (k !== k2) throw new Error(`matMul: incompatible shapes (${m}×${k}) × (${k2}×${n})`);
  const C = zeros(m, n);
  for (let i = 0; i < m; i++) {
    for (let l = 0; l < k; l++) {
      if (a[i][l] === 0) continue;
      for (let j = 0; j < n; j++) {
        C[i][j] += a[i][l] * b[l][j];
      }
    }
  }
  return C;
}

/** Scalar multiplication s·A. */
export function matScale(a: Matrix, s: number): Matrix {
  return a.map(row => row.map(v => v * s));
}

/** Transpose: returns Aᵀ. */
export function transpose(a: Matrix): Matrix {
  const [m, n] = _shape(a);
  return Array.from({ length: n }, (_, j) =>
    Array.from({ length: m }, (__, i) => a[i][j]),
  );
}

// ── Vector operations ─────────────────────────────────────────────────────────

/** Dot product of two vectors. */
export function dot(a: Vector, b: Vector): number {
  if (a.length !== b.length) throw new Error('dot: vectors must have the same length');
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Vector p-norm.
 * p=2 (default) → Euclidean norm, p=1 → Manhattan norm.
 * Pass p=Infinity for the max-norm.
 */
export function norm(v: Vector, p: number = 2): number {
  if (v.length === 0) return 0;
  if (p === Infinity) return Math.max(...v.map(Math.abs));
  if (p === 1) return v.reduce((s, x) => s + Math.abs(x), 0);
  return Math.pow(v.reduce((s, x) => s + Math.pow(Math.abs(x), p), 0), 1 / p);
}

// ── Linear system solver ──────────────────────────────────────────────────────

/**
 * Solve A·x = b using Gaussian elimination with partial pivoting.
 * Returns x, or null if the system has no unique solution (singular A).
 */
export function solve(A: Matrix, b: Vector): Vector | null {
  const n = b.length;
  if (A.length !== n) throw new Error('solve: A must be n×n and b must have length n');
  if (A.some(row => row.length !== n)) throw new Error('solve: A must be a square n×n matrix');
  if (n === 0) return [];

  // Build augmented matrix [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find row with largest absolute value in this column
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // singular

    // Swap rows
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    // Eliminate below
    const pivot = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back-substitution
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

// ── Determinant ───────────────────────────────────────────────────────────────

/**
 * Compute the determinant of a square matrix via LU decomposition.
 */
export function determinant(A: Matrix): number {
  const n = A.length;
  if (n === 0) return 1;
  if (A.some(row => row.length !== n)) throw new Error('determinant: matrix must be square');

  const { U, P } = luDecompose(A);

  // Count row swaps encoded in permutation matrix P
  const perm = P.map(row => row.indexOf(1)); // perm[i] = original row placed at position i
  const visited = new Array<boolean>(n).fill(false);
  let swaps = 0;
  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      let cycleLen = 0;
      let j = i;
      while (!visited[j]) {
        visited[j] = true;
        j = perm[j];
        cycleLen++;
      }
      swaps += cycleLen - 1;
    }
  }

  let det = swaps % 2 === 0 ? 1 : -1;
  for (let i = 0; i < n; i++) det *= U[i][i];
  return det;
}

// ── LU Decomposition ──────────────────────────────────────────────────────────

/**
 * LU decomposition with partial pivoting.
 * Returns { L, U, P } such that P·A = L·U.
 * L is unit lower-triangular, U is upper-triangular.
 */
export function luDecompose(A: Matrix): { L: Matrix; U: Matrix; P: Matrix } {
  const n = A.length;
  if (n === 0) return { L: [], U: [], P: [] };
  if (A.some(row => row.length !== n)) throw new Error('luDecompose: matrix must be square');

  // Work on a copy
  const U: Matrix = A.map(row => [...row]);
  const L: Matrix = identity(n);
  // P starts as identity; rows swapped to track pivoting
  const P: Matrix = identity(n);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(U[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(U[row][col]) > maxVal) {
        maxVal = Math.abs(U[row][col]);
        maxRow = row;
      }
    }

    if (maxRow !== col) {
      [U[col], U[maxRow]] = [U[maxRow], U[col]];
      [P[col], P[maxRow]] = [P[maxRow], P[col]];
      // Swap the already-computed L multipliers (sub-diagonal entries)
      for (let j = 0; j < col; j++) {
        [L[col][j], L[maxRow][j]] = [L[maxRow][j], L[col][j]];
      }
    }

    if (Math.abs(U[col][col]) < 1e-15) continue; // near-zero pivot — skip

    for (let row = col + 1; row < n; row++) {
      const factor = U[row][col] / U[col][col];
      L[row][col] = factor;
      for (let j = col; j < n; j++) {
        U[row][j] -= factor * U[col][j];
      }
    }
  }

  return { L, U, P };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _shape(a: Matrix): [number, number] {
  return [a.length, a.length === 0 ? 0 : a[0].length];
}

function _assertSameShape(a: Matrix, b: Matrix, fn: string): void {
  const [m1, n1] = _shape(a);
  const [m2, n2] = _shape(b);
  if (m1 !== m2 || n1 !== n2) {
    throw new Error(`${fn}: shape mismatch (${m1}×${n1}) vs (${m2}×${n2})`);
  }
}
