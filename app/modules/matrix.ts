// @ts-check
// ─── Matrix Data Structure ────────────────────────────────────────────────────
// A 2-D numeric matrix with standard arithmetic, transpose, trace, and common
// static factory helpers.

// ─── Matrix Class ─────────────────────────────────────────────────────────────

export class Matrix {
  /** Internal row-major storage. */
  private _data: number[][];
  private _rows: number;
  private _cols: number;

  constructor(data: number[][]) {
    if (data.length === 0) throw new RangeError('Matrix must have at least one row');
    const cols = data[0].length;
    if (cols === 0) throw new RangeError('Matrix must have at least one column');
    for (let r = 1; r < data.length; r++) {
      if (data[r].length !== cols) {
        throw new RangeError('All rows must have the same number of columns');
      }
    }
    // Deep-copy so the caller cannot mutate our internals
    this._data = data.map((row) => [...row]);
    this._rows = data.length;
    this._cols = cols;
  }

  // ─── Dimension Getters ──────────────────────────────────────────────────────

  get rows(): number {
    return this._rows;
  }

  get cols(): number {
    return this._cols;
  }

  // ─── Element Access ─────────────────────────────────────────────────────────

  /** Return the value at row `r`, column `c` (0-indexed). */
  get(r: number, c: number): number {
    this._checkBounds(r, c);
    return this._data[r][c];
  }

  /** Set the value at row `r`, column `c` (0-indexed). Mutates in place. */
  set(r: number, c: number, v: number): void {
    this._checkBounds(r, c);
    this._data[r][c] = v;
  }

  // ─── Arithmetic ─────────────────────────────────────────────────────────────

  /** Element-wise addition.  Both matrices must share the same dimensions. */
  add(other: Matrix): Matrix {
    this._checkSameDimensions(other);
    return new Matrix(
      this._data.map((row, r) => row.map((v, c) => v + other._data[r][c])),
    );
  }

  /** Element-wise subtraction.  Both matrices must share the same dimensions. */
  subtract(other: Matrix): Matrix {
    this._checkSameDimensions(other);
    return new Matrix(
      this._data.map((row, r) => row.map((v, c) => v - other._data[r][c])),
    );
  }

  /** Standard matrix multiplication.  `this.cols` must equal `other.rows`. */
  multiply(other: Matrix): Matrix {
    if (this._cols !== other._rows) {
      throw new RangeError(
        `Cannot multiply ${this._rows}×${this._cols} by ${other._rows}×${other._cols}`,
      );
    }
    const result: number[][] = Array.from({ length: this._rows }, () =>
      new Array(other._cols).fill(0),
    );
    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < other._cols; c++) {
        let sum = 0;
        for (let k = 0; k < this._cols; k++) {
          sum += this._data[r][k] * other._data[k][c];
        }
        result[r][c] = sum;
      }
    }
    return new Matrix(result);
  }

  /** Multiply every element by `scalar`. */
  scale(scalar: number): Matrix {
    return new Matrix(this._data.map((row) => row.map((v) => v * scalar)));
  }

  // ─── Structural Operations ──────────────────────────────────────────────────

  /** Return the transpose (rows become columns). */
  transpose(): Matrix {
    const result: number[][] = Array.from({ length: this._cols }, (_, c) =>
      Array.from({ length: this._rows }, (__, r) => this._data[r][c]),
    );
    return new Matrix(result);
  }

  /**
   * Return the sum of the main diagonal.
   * Only defined for square matrices.
   */
  trace(): number {
    if (this._rows !== this._cols) {
      throw new RangeError('trace() is only defined for square matrices');
    }
    let sum = 0;
    for (let i = 0; i < this._rows; i++) {
      sum += this._data[i][i];
    }
    return sum;
  }

  // ─── Serialisation ──────────────────────────────────────────────────────────

  /** Return a deep copy of the underlying 2-D array. */
  toArray(): number[][] {
    return this._data.map((row) => [...row]);
  }

  // ─── Static Factories ───────────────────────────────────────────────────────

  /** Create an n×n identity matrix. */
  static identity(n: number): Matrix {
    if (n < 1) throw new RangeError('n must be at least 1');
    return new Matrix(
      Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (__, c) => (r === c ? 1 : 0)),
      ),
    );
  }

  /** Create an r×c matrix filled with zeros. */
  static zeros(r: number, c: number): Matrix {
    if (r < 1 || c < 1) throw new RangeError('Dimensions must be at least 1');
    return new Matrix(Array.from({ length: r }, () => new Array(c).fill(0)));
  }

  /** Create an r×c matrix filled with ones. */
  static ones(r: number, c: number): Matrix {
    if (r < 1 || c < 1) throw new RangeError('Dimensions must be at least 1');
    return new Matrix(Array.from({ length: r }, () => new Array(c).fill(1)));
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private _checkBounds(r: number, c: number): void {
    if (r < 0 || r >= this._rows || c < 0 || c >= this._cols) {
      throw new RangeError(
        `Index (${r}, ${c}) out of bounds for ${this._rows}×${this._cols} matrix`,
      );
    }
  }

  private _checkSameDimensions(other: Matrix): void {
    if (this._rows !== other._rows || this._cols !== other._cols) {
      throw new RangeError(
        `Dimension mismatch: ${this._rows}×${this._cols} vs ${other._rows}×${other._cols}`,
      );
    }
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/** Convenience factory — equivalent to `new Matrix(data)`. */
export function createMatrix(data: number[][]): Matrix {
  return new Matrix(data);
}
