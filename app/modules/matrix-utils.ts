// @ts-check
// ─── Matrix Utilities ─────────────────────────────────────────────────────────
// General-purpose matrix operations: creation, arithmetic, and decomposition.

// ─── Matrix Class ─────────────────────────────────────────────────────────────

/** Immutable 2D matrix backed by a rows×cols array of numbers. */
export class Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: number[][];

  constructor(rows: number, cols: number, data: number[][]) {
    this.rows = rows;
    this.cols = cols;
    this.data = data;
  }

  // ─── Static Factories ────────────────────────────────────────────────────

  /** Create a rows×cols matrix filled with zeros. */
  static zeros(rows: number, cols: number): Matrix {
    if (rows <= 0 || cols <= 0) {
      throw new RangeError(`Matrix dimensions must be positive (got ${rows}x${cols})`);
    }
    const data = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    return new Matrix(rows, cols, data);
  }

  /** Create an n×n identity matrix. */
  static identity(n: number): Matrix {
    if (n <= 0) {
      throw new RangeError(`Identity matrix size must be positive (got ${n})`);
    }
    const data = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)),
    );
    return new Matrix(n, n, data);
  }

  /**
   * Create a Matrix from a 2D array.
   * All rows must have the same number of columns.
   */
  static fromArray(data: number[][]): Matrix {
    if (data.length === 0) {
      throw new RangeError('Cannot create Matrix from empty array');
    }
    const rows = data.length;
    const cols = data[0].length;
    if (cols === 0) {
      throw new RangeError('Matrix rows must have at least one column');
    }
    for (let r = 1; r < rows; r++) {
      if (data[r].length !== cols) {
        throw new RangeError(
          `Row ${r} has ${data[r].length} columns but expected ${cols}`,
        );
      }
    }
    // Deep-copy to maintain immutability
    const copy = data.map((row) => [...row]);
    return new Matrix(rows, cols, copy);
  }

  // ─── Element Access ──────────────────────────────────────────────────────

  /** Return the element at (row, col). */
  get(row: number, col: number): number {
    this._checkBounds(row, col);
    return this.data[row][col];
  }

  /**
   * Return a new Matrix with the element at (row, col) set to value.
   * The original matrix is not mutated.
   */
  set(row: number, col: number, value: number): Matrix {
    this._checkBounds(row, col);
    const copy = this.data.map((r) => [...r]);
    copy[row][col] = value;
    return new Matrix(this.rows, this.cols, copy);
  }

  /** Convert to a plain 2D array (deep copy). */
  toArray(): number[][] {
    return this.data.map((row) => [...row]);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private _checkBounds(row: number, col: number): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new RangeError(
        `Index (${row}, ${col}) out of bounds for ${this.rows}x${this.cols} matrix`,
      );
    }
  }
}

// ─── Arithmetic Operations ────────────────────────────────────────────────────

/**
 * Add two matrices element-wise.
 * Both matrices must have the same dimensions.
 */
export function add(a: Matrix, b: Matrix): Matrix {
  _checkSameDimensions(a, b, 'add');
  const data = Array.from({ length: a.rows }, (_, r) =>
    Array.from({ length: a.cols }, (__, c) => a.data[r][c] + b.data[r][c]),
  );
  return new Matrix(a.rows, a.cols, data);
}

/**
 * Subtract matrix b from matrix a element-wise.
 * Both matrices must have the same dimensions.
 */
export function subtract(a: Matrix, b: Matrix): Matrix {
  _checkSameDimensions(a, b, 'subtract');
  const data = Array.from({ length: a.rows }, (_, r) =>
    Array.from({ length: a.cols }, (__, c) => a.data[r][c] - b.data[r][c]),
  );
  return new Matrix(a.rows, a.cols, data);
}

/**
 * Multiply two matrices (standard matrix product a × b).
 * a.cols must equal b.rows.
 */
export function multiply(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.rows) {
    throw new RangeError(
      `Cannot multiply ${a.rows}x${a.cols} by ${b.rows}x${b.cols}: inner dimensions must match`,
    );
  }
  const data = Array.from({ length: a.rows }, (_, r) =>
    Array.from({ length: b.cols }, (__, c) => {
      let sum = 0;
      for (let k = 0; k < a.cols; k++) {
        sum += a.data[r][k] * b.data[k][c];
      }
      return sum;
    }),
  );
  return new Matrix(a.rows, b.cols, data);
}

/**
 * Transpose a matrix (swap rows and cols).
 * Returns an m×n matrix given an n×m input.
 */
export function transpose(m: Matrix): Matrix {
  const data = Array.from({ length: m.cols }, (_, c) =>
    Array.from({ length: m.rows }, (__, r) => m.data[r][c]),
  );
  return new Matrix(m.cols, m.rows, data);
}

/**
 * Multiply every element of a matrix by a scalar.
 */
export function scale(m: Matrix, scalar: number): Matrix {
  const data = m.data.map((row) => row.map((v) => v * scalar));
  return new Matrix(m.rows, m.cols, data);
}

// ─── Decomposition & Properties ──────────────────────────────────────────────

/**
 * Compute the determinant of a 2×2 or 3×3 matrix.
 * Throws for non-square or unsupported sizes.
 */
export function determinant(m: Matrix): number {
  if (m.rows !== m.cols) {
    throw new RangeError(`determinant requires a square matrix (got ${m.rows}x${m.cols})`);
  }
  const d = m.data;
  if (m.rows === 1) {
    return d[0][0];
  }
  if (m.rows === 2) {
    return d[0][0] * d[1][1] - d[0][1] * d[1][0];
  }
  if (m.rows === 3) {
    return (
      d[0][0] * (d[1][1] * d[2][2] - d[1][2] * d[2][1]) -
      d[0][1] * (d[1][0] * d[2][2] - d[1][2] * d[2][0]) +
      d[0][2] * (d[1][0] * d[2][1] - d[1][1] * d[2][0])
    );
  }
  throw new RangeError(
    `determinant only supports 1x1, 2x2, and 3x3 matrices (got ${m.rows}x${m.rows})`,
  );
}

/**
 * Compute the trace of a square matrix (sum of diagonal elements).
 * Throws for non-square matrices.
 */
export function trace(m: Matrix): number {
  if (m.rows !== m.cols) {
    throw new RangeError(`trace requires a square matrix (got ${m.rows}x${m.cols})`);
  }
  let sum = 0;
  for (let i = 0; i < m.rows; i++) {
    sum += m.data[i][i];
  }
  return sum;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function _checkSameDimensions(a: Matrix, b: Matrix, op: string): void {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new RangeError(
      `Cannot ${op} ${a.rows}x${a.cols} and ${b.rows}x${b.cols} matrices: dimensions must match`,
    );
  }
}
