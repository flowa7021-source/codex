// ─── Sparse Matrix ────────────────────────────────────────────────────────────
// @ts-check
// Dictionary of Keys (DOK) backed sparse matrix.
// Supports standard linear-algebra operations: add, scale, multiply, transpose.

// ─── Internal bound check ─────────────────────────────────────────────────────

/** @throws {RangeError} when (row, col) is outside the matrix dimensions. */
function checkBounds(row: number, col: number, rows: number, cols: number): void {
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    throw new RangeError(
      `Index (${row}, ${col}) is out of bounds for matrix of size ${rows}×${cols}`,
    );
  }
}

// ─── SparseMatrix ─────────────────────────────────────────────────────────────

/**
 * Sparse matrix backed by a Map-of-Maps (Dictionary of Keys format).
 * Row and column indices are 0-based.
 *
 * @example
 *   const m = new SparseMatrix(3, 4);
 *   m.set(0, 2, 7);
 *   console.log(m.get(0, 2)); // 7
 *   console.log(m.nnz);      // 1
 */
export class SparseMatrix {
  readonly #rows: number;
  readonly #cols: number;
  /** DOK storage: outer key = row, inner key = col, value = non-zero number. */
  #data: Map<number, Map<number, number>>;

  constructor(rows: number, cols: number) {
    if (rows < 0 || cols < 0) {
      throw new RangeError(`Matrix dimensions must be non-negative, got ${rows}×${cols}`);
    }
    this.#rows = rows;
    this.#cols = cols;
    this.#data = new Map();
  }

  // ── Dimension accessors ────────────────────────────────────────────────────

  /** Number of rows. */
  get rows(): number { return this.#rows; }

  /** Number of columns. */
  get cols(): number { return this.#cols; }

  /** Number of stored non-zero elements. */
  get nnz(): number {
    let n = 0;
    for (const rowMap of this.#data.values()) n += rowMap.size;
    return n;
  }

  // ── Element access ─────────────────────────────────────────────────────────

  /**
   * Return the value at (row, col). Returns 0 for absent entries.
   * @throws {RangeError} if indices are out of bounds
   */
  get(row: number, col: number): number {
    checkBounds(row, col, this.#rows, this.#cols);
    return this.#data.get(row)?.get(col) ?? 0;
  }

  /**
   * Set the value at (row, col). Passing 0 removes the stored entry.
   * @throws {RangeError} if indices are out of bounds
   */
  set(row: number, col: number, value: number): void {
    checkBounds(row, col, this.#rows, this.#cols);
    if (value === 0) {
      const rowMap = this.#data.get(row);
      if (rowMap !== undefined) {
        rowMap.delete(col);
        if (rowMap.size === 0) this.#data.delete(row);
      }
      return;
    }
    let rowMap = this.#data.get(row);
    if (rowMap === undefined) {
      rowMap = new Map();
      this.#data.set(row, rowMap);
    }
    rowMap.set(col, value);
  }

  // ── Matrix operations ──────────────────────────────────────────────────────

  /**
   * Add two matrices element-wise and return a new SparseMatrix.
   * @throws {RangeError} if dimensions do not match
   */
  add(other: SparseMatrix): SparseMatrix {
    if (this.#rows !== other.#rows || this.#cols !== other.#cols) {
      throw new RangeError(
        `Cannot add matrices of size ${this.#rows}×${this.#cols} and ${other.#rows}×${other.#cols}`,
      );
    }
    const result = new SparseMatrix(this.#rows, this.#cols);
    for (const [r, rowMap] of this.#data) {
      for (const [c, v] of rowMap) result.set(r, c, v);
    }
    for (const [r, rowMap] of other.#data) {
      for (const [c, v] of rowMap) {
        result.set(r, c, result.get(r, c) + v);
      }
    }
    return result;
  }

  /**
   * Multiply every element by a scalar and return a new SparseMatrix.
   * A scalar of 0 returns an all-zero matrix (nnz === 0).
   */
  scale(scalar: number): SparseMatrix {
    const result = new SparseMatrix(this.#rows, this.#cols);
    if (scalar === 0) return result;
    for (const [r, rowMap] of this.#data) {
      for (const [c, v] of rowMap) result.set(r, c, v * scalar);
    }
    return result;
  }

  /**
   * Sparse matrix multiplication: this × other.
   * @throws {RangeError} if inner dimensions do not match
   */
  multiply(other: SparseMatrix): SparseMatrix {
    if (this.#cols !== other.#rows) {
      throw new RangeError(
        `Cannot multiply ${this.#rows}×${this.#cols} by ${other.#rows}×${other.#cols}: ` +
        `inner dimensions must match`,
      );
    }
    const result = new SparseMatrix(this.#rows, other.#cols);
    for (const [r, rowMap] of this.#data) {
      for (const [k, aVal] of rowMap) {
        const otherRow = other.#data.get(k);
        if (otherRow === undefined) continue;
        for (const [c, bVal] of otherRow) {
          result.set(r, c, result.get(r, c) + aVal * bVal);
        }
      }
    }
    return result;
  }

  /** Return the transpose of this matrix as a new SparseMatrix. */
  transpose(): SparseMatrix {
    const result = new SparseMatrix(this.#cols, this.#rows);
    for (const [r, rowMap] of this.#data) {
      for (const [c, v] of rowMap) result.set(c, r, v);
    }
    return result;
  }

  // ── Dense conversion ───────────────────────────────────────────────────────

  /** Convert to a dense 2-D array (rows × cols); absent entries become 0. */
  toDense(): number[][] {
    const dense: number[][] = Array.from({ length: this.#rows }, () =>
      new Array<number>(this.#cols).fill(0),
    );
    for (const [r, rowMap] of this.#data) {
      for (const [c, v] of rowMap) dense[r][c] = v;
    }
    return dense;
  }

  /**
   * Build a SparseMatrix from a dense 2-D array.
   * Zero values are not stored.
   * @throws {RangeError} if rows have inconsistent lengths
   */
  static fromDense(matrix: number[][]): SparseMatrix {
    const rows = matrix.length;
    const cols = rows === 0 ? 0 : matrix[0].length;
    const result = new SparseMatrix(rows, cols);
    for (let r = 0; r < rows; r++) {
      if (matrix[r].length !== cols) {
        throw new RangeError(`Row ${r} has length ${matrix[r].length}, expected ${cols}`);
      }
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] !== 0) result.set(r, c, matrix[r][c]);
      }
    }
    return result;
  }

  // ── Iteration ──────────────────────────────────────────────────────────────

  /**
   * Return all stored non-zero entries sorted by row then by column.
   */
  entries(): Array<{ row: number; col: number; value: number }> {
    const out: Array<{ row: number; col: number; value: number }> = [];
    const sortedRows = [...this.#data.keys()].sort((a, b) => a - b);
    for (const r of sortedRows) {
      const rowMap = this.#data.get(r)!;
      const sortedCols = [...rowMap.keys()].sort((a, b) => a - b);
      for (const c of sortedCols) {
        out.push({ row: r, col: c, value: rowMap.get(c)! });
      }
    }
    return out;
  }

  // ── Norms ──────────────────────────────────────────────────────────────────

  /** Frobenius norm: sqrt of the sum of squares of all stored elements. */
  frobeniusNorm(): number {
    let sumSq = 0;
    for (const rowMap of this.#data.values()) {
      for (const v of rowMap.values()) sumSq += v * v;
    }
    return Math.sqrt(sumSq);
  }

  // ── Row / column helpers ───────────────────────────────────────────────────

  /**
   * Return a snapshot Map from column index to value for the given row.
   * @throws {RangeError} if row is out of bounds
   */
  getRow(row: number): Map<number, number> {
    if (row < 0 || row >= this.#rows) {
      throw new RangeError(`Row ${row} is out of bounds for ${this.#rows} rows`);
    }
    const rowMap = this.#data.get(row);
    return rowMap !== undefined ? new Map(rowMap) : new Map();
  }

  /**
   * Return a snapshot Map from row index to value for the given column.
   * @throws {RangeError} if col is out of bounds
   */
  getCol(col: number): Map<number, number> {
    if (col < 0 || col >= this.#cols) {
      throw new RangeError(`Col ${col} is out of bounds for ${this.#cols} cols`);
    }
    const result: Map<number, number> = new Map();
    for (const [r, rowMap] of this.#data) {
      const v = rowMap.get(col);
      if (v !== undefined) result.set(r, v);
    }
    return result;
  }

  /**
   * Sum of all values in the given row.
   * @throws {RangeError} if row is out of bounds
   */
  rowSum(row: number): number {
    if (row < 0 || row >= this.#rows) {
      throw new RangeError(`Row ${row} is out of bounds for ${this.#rows} rows`);
    }
    let sum = 0;
    const rowMap = this.#data.get(row);
    if (rowMap !== undefined) for (const v of rowMap.values()) sum += v;
    return sum;
  }

  /**
   * Sum of all values in the given column.
   * @throws {RangeError} if col is out of bounds
   */
  colSum(col: number): number {
    if (col < 0 || col >= this.#cols) {
      throw new RangeError(`Col ${col} is out of bounds for ${this.#cols} cols`);
    }
    let sum = 0;
    for (const rowMap of this.#data.values()) sum += rowMap.get(col) ?? 0;
    return sum;
  }
}

// ─── Factory functions ─────────────────────────────────────────────────────────

/**
 * Create an empty SparseMatrix with the given dimensions.
 *
 * @param rows - Number of rows (non-negative)
 * @param cols - Number of columns (non-negative)
 */
export function createSparseMatrix(rows: number, cols: number): SparseMatrix {
  return new SparseMatrix(rows, cols);
}

/**
 * Create a square diagonal matrix from the given values array.
 * Entry [i][i] = values[i]; all off-diagonal entries are 0.
 *
 * @param values - Diagonal entries; result is values.length × values.length
 */
export function sparseDiagonal(values: number[]): SparseMatrix {
  const n = values.length;
  const m = new SparseMatrix(n, n);
  for (let i = 0; i < n; i++) {
    if (values[i] !== 0) m.set(i, i, values[i]);
  }
  return m;
}

/**
 * Create an n×n identity matrix.
 *
 * @param n - Matrix dimension (non-negative)
 */
export function sparseIdentity(n: number): SparseMatrix {
  return sparseDiagonal(new Array<number>(n).fill(1));
}
