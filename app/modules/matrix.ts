// @ts-check
// ─── Dense Matrix Library ─────────────────────────────────────────────────────
// Linear algebra module providing a dense Matrix class with arithmetic,
// transforms, row/col operations, and common matrix properties.
// Stored in row-major order as a flat Float64Array for cache efficiency.

// ─── Matrix ───────────────────────────────────────────────────────────────────

/** Dense matrix stored in row-major order as a flat Float64Array. */
export class Matrix {
  #rows: number;
  #cols: number;
  #data: Float64Array;

  /**
   * Create a matrix from dimensions with optional fill value, or from a 2D array.
   * Usage: `new Matrix(rows, cols, fill?)` or `new Matrix([[1,2],[3,4]])`
   */
  constructor(rowsOrData: number | number[][], cols?: number, fill: number = 0) {
    // Detect if first arg is a 2D array (matrix-algebra.test.js usage)
    if (Array.isArray(rowsOrData)) {
      const data = rowsOrData;
      if (data.length === 0) {
        throw new RangeError('Matrix: data must have at least one row');
      }
      const numCols = data[0].length;
      if (numCols === 0) {
        throw new RangeError('Matrix: rows must have at least one column');
      }
      this.#rows = data.length;
      this.#cols = numCols;
      this.#data = new Float64Array(this.#rows * numCols);
      for (let r = 0; r < data.length; r++) {
        if (data[r].length !== numCols) {
          throw new RangeError(
            `Matrix: row ${r} has ${data[r].length} elements, expected ${numCols}`,
          );
        }
        for (let c = 0; c < numCols; c++) {
          this.#data[r * numCols + c] = data[r][c];
        }
      }
    } else {
      // Dimensions-based usage (matrix.test.js usage)
      const rows = rowsOrData;
      if (!cols || !Number.isInteger(rows) || rows < 1) {
        throw new RangeError(`Matrix: rows must be a positive integer, got ${rows}`);
      }
      if (!Number.isInteger(cols) || cols < 1) {
        throw new RangeError(`Matrix: cols must be a positive integer, got ${cols}`);
      }
      this.#rows = rows;
      this.#cols = cols;
      this.#data = new Float64Array(rows * cols).fill(fill);
    }
  }

  // ─── Static Factories ──────────────────────────────────────────────────────

  /**
   * Build a Matrix from a 2-D JavaScript array.
   * All rows must have the same non-zero length.
   */
  static fromArray(data: number[][]): Matrix {
    if (data.length === 0) {
      throw new RangeError('Matrix.fromArray: data must have at least one row');
    }
    const cols = data[0].length;
    if (cols === 0) {
      throw new RangeError('Matrix.fromArray: rows must have at least one column');
    }
    const m = new Matrix(data.length, cols);
    for (let r = 0; r < data.length; r++) {
      if (data[r].length !== cols) {
        throw new RangeError(
          `Matrix.fromArray: row ${r} has ${data[r].length} elements, expected ${cols}`,
        );
      }
      for (let c = 0; c < cols; c++) {
        m.#data[r * cols + c] = data[r][c];
      }
    }
    return m;
  }

  /** Create an n×n identity matrix. */
  static identity(n: number): Matrix {
    const m = new Matrix(n, n, 0);
    for (let i = 0; i < n; i++) {
      m.#data[i * n + i] = 1;
    }
    return m;
  }

  /** Create a rows×cols matrix filled with zeros. */
  static zeros(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols, 0);
  }

  /** Create a rows×cols matrix filled with ones. */
  static ones(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols, 1);
  }

  /** Create a rows×cols matrix filled with uniform random values in [0, 1). */
  static random(rows: number, cols: number): Matrix {
    const m = new Matrix(rows, cols);
    for (let i = 0; i < m.#data.length; i++) {
      m.#data[i] = Math.random();
    }
    return m;
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  /** Number of rows. */
  get rows(): number {
    return this.#rows;
  }

  /** Number of columns. */
  get cols(): number {
    return this.#cols;
  }

  /**
   * Return the element at (row, col).
   * @param row - Zero-based row index
   * @param col - Zero-based column index
   */
  get(row: number, col: number): number {
    this.#checkBounds(row, col);
    return this.#data[row * this.#cols + col];
  }

  /**
   * Set the element at (row, col) to `value`.
   * @param row   - Zero-based row index
   * @param col   - Zero-based column index
   * @param value - The new value
   */
  set(row: number, col: number, value: number): void {
    this.#checkBounds(row, col);
    this.#data[row * this.#cols + col] = value;
  }

  /** Return a deep copy of the matrix as a 2-D JavaScript array. */
  toArray(): number[][] {
    const result: number[][] = [];
    for (let r = 0; r < this.#rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < this.#cols; c++) {
        row.push(this.#data[r * this.#cols + c]);
      }
      result.push(row);
    }
    return result;
  }

  // ─── Arithmetic ────────────────────────────────────────────────────────────

  /**
   * Element-wise addition.  Returns a new Matrix.
   * Throws if dimensions do not match.
   */
  add(other: Matrix): Matrix {
    this.#checkSameDims(other, 'add');
    const result = new Matrix(this.#rows, this.#cols);
    for (let i = 0; i < this.#data.length; i++) {
      result.#data[i] = this.#data[i] + other.#data[i];
    }
    return result;
  }

  /**
   * Element-wise subtraction.  Returns a new Matrix.
   * Throws if dimensions do not match.
   */
  subtract(other: Matrix): Matrix {
    this.#checkSameDims(other, 'subtract');
    const result = new Matrix(this.#rows, this.#cols);
    for (let i = 0; i < this.#data.length; i++) {
      result.#data[i] = this.#data[i] - other.#data[i];
    }
    return result;
  }

  /**
   * Matrix multiplication (this × other).  Returns a new Matrix.
   * Requires this.cols === other.rows; throws otherwise.
   */
  multiply(other: Matrix): Matrix {
    if (this.#cols !== other.#rows) {
      throw new RangeError(
        `Matrix.multiply: dimension mismatch — ` +
          `(${this.#rows}×${this.#cols}) × (${other.#rows}×${other.#cols})`,
      );
    }
    const result = new Matrix(this.#rows, other.#cols, 0);
    for (let r = 0; r < this.#rows; r++) {
      for (let k = 0; k < this.#cols; k++) {
        const a = this.#data[r * this.#cols + k];
        if (a === 0) continue;
        for (let c = 0; c < other.#cols; c++) {
          result.#data[r * other.#cols + c] += a * other.#data[k * other.#cols + c];
        }
      }
    }
    return result;
  }

  /**
   * Scalar (element-wise) multiplication.  Returns a new Matrix.
   * @param scalar - The value to multiply every element by
   */
  scale(scalar: number): Matrix {
    const result = new Matrix(this.#rows, this.#cols);
    for (let i = 0; i < this.#data.length; i++) {
      result.#data[i] = this.#data[i] * scalar;
    }
    return result;
  }

  /**
   * Apply a binary function element-wise across this and `other`.
   * Returns a new Matrix.  Throws if dimensions do not match.
   * @param other - The right-hand operand
   * @param fn    - Function called with (a, b) for each element pair
   */
  elementWise(other: Matrix, fn: (a: number, b: number) => number): Matrix {
    this.#checkSameDims(other, 'elementWise');
    const result = new Matrix(this.#rows, this.#cols);
    for (let i = 0; i < this.#data.length; i++) {
      result.#data[i] = fn(this.#data[i], other.#data[i]);
    }
    return result;
  }

  // ─── Transforms ────────────────────────────────────────────────────────────

  /** Return the transpose of this matrix as a new Matrix. */
  transpose(): Matrix {
    const result = new Matrix(this.#cols, this.#rows);
    for (let r = 0; r < this.#rows; r++) {
      for (let c = 0; c < this.#cols; c++) {
        result.#data[c * this.#rows + r] = this.#data[r * this.#cols + c];
      }
    }
    return result;
  }

  /**
   * Apply a function to every element and return a new Matrix.
   * @param fn - Called with (value, row, col) for each element
   */
  map(fn: (value: number, row: number, col: number) => number): Matrix {
    const result = new Matrix(this.#rows, this.#cols);
    for (let r = 0; r < this.#rows; r++) {
      for (let c = 0; c < this.#cols; c++) {
        result.#data[r * this.#cols + c] = fn(this.#data[r * this.#cols + c], r, c);
      }
    }
    return result;
  }

  // ─── Properties ────────────────────────────────────────────────────────────

  /**
   * Sum of the main diagonal elements.
   * Works for non-square matrices (uses min(rows, cols) diagonal elements).
   */
  trace(): number {
    const diag = Math.min(this.#rows, this.#cols);
    let sum = 0;
    for (let i = 0; i < diag; i++) {
      sum += this.#data[i * this.#cols + i];
    }
    return sum;
  }

  /**
   * Determinant via LU decomposition with partial pivoting.
   * Throws for non-square matrices.
   */
  determinant(): number {
    if (!this.isSquare()) {
      throw new Error(
        `Matrix.determinant: matrix must be square, got ${this.#rows}×${this.#cols}`,
      );
    }
    const n = this.#rows;
    if (n === 1) return this.#data[0];
    if (n === 2) {
      return this.#data[0] * this.#data[3] - this.#data[1] * this.#data[2];
    }

    // Copy to a mutable JS array for in-place LU decomposition
    const lu = Array.from(this.#data);
    let sign = 1;

    for (let col = 0; col < n; col++) {
      // Partial pivoting: find the row with the largest absolute value in this column
      let maxVal = Math.abs(lu[col * n + col]);
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        const v = Math.abs(lu[row * n + col]);
        if (v > maxVal) {
          maxVal = v;
          maxRow = row;
        }
      }

      if (maxRow !== col) {
        // Swap rows col and maxRow
        for (let k = 0; k < n; k++) {
          const tmp = lu[col * n + k];
          lu[col * n + k] = lu[maxRow * n + k];
          lu[maxRow * n + k] = tmp;
        }
        sign = -sign;
      }

      if (lu[col * n + col] === 0) return 0;

      for (let row = col + 1; row < n; row++) {
        const factor = lu[row * n + col] / lu[col * n + col];
        for (let k = col; k < n; k++) {
          lu[row * n + k] -= factor * lu[col * n + k];
        }
      }
    }

    // Determinant is the product of diagonal elements × accumulated sign
    let det = sign;
    for (let i = 0; i < n; i++) {
      det *= lu[i * n + i];
    }
    return det;
  }

  /** Frobenius norm: sqrt(Σ aᵢⱼ²). */
  frobenius(): number {
    let sum = 0;
    for (let i = 0; i < this.#data.length; i++) {
      sum += this.#data[i] * this.#data[i];
    }
    return Math.sqrt(sum);
  }

  /** Return true if the matrix is square (rows === cols). */
  isSquare(): boolean {
    return this.#rows === this.#cols;
  }

  /**
   * Return true if A ≈ Aᵀ within the given epsilon.
   * Non-square matrices are never symmetric.
   * @param eps - Tolerance (default 1e-10)
   */
  isSymmetric(eps: number = 1e-10): boolean {
    if (!this.isSquare()) return false;
    for (let r = 0; r < this.#rows; r++) {
      for (let c = r + 1; c < this.#cols; c++) {
        if (Math.abs(this.#data[r * this.#cols + c] - this.#data[c * this.#cols + r]) > eps) {
          return false;
        }
      }
    }
    return true;
  }

  // ─── Row / Column Operations ───────────────────────────────────────────────

  /**
   * Return a copy of the given row as a plain number array.
   * @param row - Zero-based row index
   */
  getRow(row: number): number[] {
    if (row < 0 || row >= this.#rows) {
      throw new RangeError(`Matrix.getRow: row ${row} out of bounds (0..${this.#rows - 1})`);
    }
    const result: number[] = [];
    for (let c = 0; c < this.#cols; c++) {
      result.push(this.#data[row * this.#cols + c]);
    }
    return result;
  }

  /**
   * Return a copy of the given column as a plain number array.
   * @param col - Zero-based column index
   */
  getCol(col: number): number[] {
    if (col < 0 || col >= this.#cols) {
      throw new RangeError(`Matrix.getCol: col ${col} out of bounds (0..${this.#cols - 1})`);
    }
    const result: number[] = [];
    for (let r = 0; r < this.#rows; r++) {
      result.push(this.#data[r * this.#cols + col]);
    }
    return result;
  }

  /**
   * Replace all elements in the given row with `values`.
   * @param row    - Zero-based row index
   * @param values - Array of length cols
   */
  setRow(row: number, values: number[]): void {
    if (row < 0 || row >= this.#rows) {
      throw new RangeError(`Matrix.setRow: row ${row} out of bounds (0..${this.#rows - 1})`);
    }
    if (values.length !== this.#cols) {
      throw new RangeError(
        `Matrix.setRow: values length ${values.length} !== cols ${this.#cols}`,
      );
    }
    for (let c = 0; c < this.#cols; c++) {
      this.#data[row * this.#cols + c] = values[c];
    }
  }

  /**
   * Replace all elements in the given column with `values`.
   * @param col    - Zero-based column index
   * @param values - Array of length rows
   */
  setCol(col: number, values: number[]): void {
    if (col < 0 || col >= this.#cols) {
      throw new RangeError(`Matrix.setCol: col ${col} out of bounds (0..${this.#cols - 1})`);
    }
    if (values.length !== this.#rows) {
      throw new RangeError(
        `Matrix.setCol: values length ${values.length} !== rows ${this.#rows}`,
      );
    }
    for (let r = 0; r < this.#rows; r++) {
      this.#data[r * this.#cols + col] = values[r];
    }
  }

  // ─── Comparison ────────────────────────────────────────────────────────────

  /**
   * Return true if this matrix equals `other` within the given epsilon.
   * Matrices with different dimensions are never equal.
   * @param other - Matrix to compare with
   * @param eps   - Tolerance (default 1e-10)
   */
  equals(other: Matrix, eps: number = 1e-10): boolean {
    if (this.#rows !== other.#rows || this.#cols !== other.#cols) return false;
    for (let i = 0; i < this.#data.length; i++) {
      if (Math.abs(this.#data[i] - other.#data[i]) > eps) return false;
    }
    return true;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  #checkBounds(row: number, col: number): void {
    if (row < 0 || row >= this.#rows || col < 0 || col >= this.#cols) {
      throw new RangeError(
        `Matrix: index (${row}, ${col}) out of bounds for ${this.#rows}×${this.#cols} matrix`,
      );
    }
  }

  #checkSameDims(other: Matrix, op: string): void {
    if (this.#rows !== other.#rows || this.#cols !== other.#cols) {
      throw new RangeError(
        `Matrix.${op}: dimension mismatch — ` +
          `(${this.#rows}×${this.#cols}) vs (${other.#rows}×${other.#cols})`,
      );
    }
  }
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Create a new Matrix with the given dimensions and optional fill value.
 * Equivalent to `new Matrix(rows, cols, fill)`.
 */
export function createMatrix(rows: number, cols: number, fill: number = 0): Matrix {
  return new Matrix(rows, cols, fill);
}

/**
 * Matrix multiplication: alias for `a.multiply(b)`.
 * Returns a new Matrix representing a × b.
 */
export function matMul(a: Matrix, b: Matrix): Matrix {
  return a.multiply(b);
}
