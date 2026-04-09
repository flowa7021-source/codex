// @ts-check
// ─── Matrix Chain Multiplication ────────────────────────────────────────────
// Optimal parenthesization for matrix chain multiplication plus helpers for
// actual matrix arithmetic.

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute the split table for optimal matrix chain parenthesization.
 * `dimensions` has length n+1 for n matrices, where matrix i is
 * dimensions[i] x dimensions[i+1].
 *
 * Returns a 2-D array `s` where `s[i][j]` is the split index for the
 * optimal parenthesization of matrices i..j (1-indexed).
 */
export function matrixChainSplit(dimensions: number[]): number[][] {
  const n = dimensions.length - 1;
  if (n <= 0) return [];

  // m[i][j] = minimum cost to multiply matrices i..j (1-indexed)
  const m: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  const s: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  // l = chain length
  for (let l = 2; l <= n; l++) {
    for (let i = 1; i <= n - l + 1; i++) {
      const j = i + l - 1;
      m[i][j] = Infinity;
      for (let k = i; k < j; k++) {
        const q =
          m[i][k] + m[k + 1][j] + dimensions[i - 1] * dimensions[k] * dimensions[j];
        if (q < m[i][j]) {
          m[i][j] = q;
          s[i][j] = k;
        }
      }
    }
  }

  return s;
}

/**
 * Compute the minimum scalar multiplication cost and an optimal
 * parenthesization string (e.g. "((A1A2)A3)").
 *
 * `dimensions` has length n+1 for n matrices.
 */
export function matrixChainOrder(
  dimensions: number[],
): { cost: number; order: string } {
  const n = dimensions.length - 1;
  if (n <= 0) return { cost: 0, order: '' };
  if (n === 1) return { cost: 0, order: 'A1' };

  // m[i][j] = minimum cost to multiply matrices i..j (1-indexed)
  const m: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  const s = matrixChainSplit(dimensions);

  for (let l = 2; l <= n; l++) {
    for (let i = 1; i <= n - l + 1; i++) {
      const j = i + l - 1;
      m[i][j] = Infinity;
      for (let k = i; k < j; k++) {
        const q =
          m[i][k] + m[k + 1][j] + dimensions[i - 1] * dimensions[k] * dimensions[j];
        if (q < m[i][j]) {
          m[i][j] = q;
        }
      }
    }
  }

  function buildOrder(i: number, j: number): string {
    if (i === j) return `A${i}`;
    return `(${buildOrder(i, s[i][j])}${buildOrder(s[i][j] + 1, j)})`;
  }

  return { cost: m[1][n], order: buildOrder(1, n) };
}

/**
 * Multiply two 2-D matrices. Throws if inner dimensions don't match.
 */
export function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0]?.length ?? 0;
  const rowsB = b.length;
  const colsB = b[0]?.length ?? 0;

  if (colsA !== rowsB) {
    throw new Error(
      `Incompatible dimensions: ${rowsA}x${colsA} and ${rowsB}x${colsB}`,
    );
  }

  const result: number[][] = Array.from({ length: rowsA }, () =>
    new Array<number>(colsB).fill(0),
  );

  for (let i = 0; i < rowsA; i++) {
    for (let k = 0; k < colsA; k++) {
      const aik = a[i][k];
      for (let j = 0; j < colsB; j++) {
        result[i][j] += aik * b[k][j];
      }
    }
  }

  return result;
}

/**
 * Multiply a chain of matrices in optimal order using the split table
 * produced by `matrixChainSplit`.
 */
export function chainMultiply(matrices: number[][][]): number[][] {
  const n = matrices.length;
  if (n === 0) return [];
  if (n === 1) return matrices[0];

  const dimensions: number[] = matrices.map((m) => m.length);
  dimensions.push(matrices[n - 1][0]?.length ?? 0);

  const s = matrixChainSplit(dimensions);

  function multiply(i: number, j: number): number[][] {
    if (i === j) return matrices[i - 1]; // 1-indexed split table
    const k = s[i][j];
    const left = multiply(i, k);
    const right = multiply(k + 1, j);
    return matrixMultiply(left, right);
  }

  return multiply(1, n);
}
