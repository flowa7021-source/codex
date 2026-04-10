// @ts-check
// ─── Sparse Matrix (CSR Format) ──────────────────────────────────────────────
// Implements a sparse matrix using Compressed Sparse Row (CSR) storage.
// Non-zero values are stored in a flat array alongside column indices and row
// pointer offsets, giving O(1) row iteration and compact memory usage.

/**
 * Sparse matrix stored in Compressed Sparse Row (CSR) format.
 *
 * Internal arrays:
 *   _values  – non-zero values in row-major order
 *   _colIdx  – column index for each value in _values
 *   _rowPtr  – rowPtr[r] is the first index in _values that belongs to row r;
 *              rowPtr[rows] == nnz (sentinel)
 */
export class SparseMatrix {
  readonly #rows: number;
  readonly #cols: number;
  #values: number[];
  #colIdx: number[];
  #rowPtr: number[];

  constructor(rows: number, cols: number) {
    if (rows < 0 || cols < 0) throw new RangeError('Dimensions must be non-negative');
    this.#rows = rows;
    this.#cols = cols;
    this.#values = [];
    this.#colIdx = [];
    // rowPtr has length rows+1, all zeros (no entries yet)
    this.#rowPtr = new Array(rows + 1).fill(0);
  }

  // ── Dimension accessors ────────────────────────────────────────────────────

  get rows(): number { return this.#rows; }
  get cols(): number { return this.#cols; }
  /** Number of stored non-zero elements. */
  get nnz(): number { return this.#values.length; }

  // ── Element access ─────────────────────────────────────────────────────────

  /** Get element at (r, c). Returns 0 for entries not stored. */
  get(r: number, c: number): number {
    this.#checkBounds(r, c);
    const start = this.#rowPtr[r];
    const end   = this.#rowPtr[r + 1];
    for (let i = start; i < end; i++) {
      if (this.#colIdx[i] === c) return this.#values[i];
    }
    return 0;
  }

  /** Set element at (r, c). Setting to 0 removes the entry. */
  set(r: number, c: number, value: number): void {
    this.#checkBounds(r, c);
    const start = this.#rowPtr[r];
    const end   = this.#rowPtr[r + 1];

    // Find existing position in this row (columns are kept sorted)
    let pos = start;
    while (pos < end && this.#colIdx[pos] < c) pos++;

    const exists = pos < end && this.#colIdx[pos] === c;

    if (exists) {
      if (value === 0) {
        // Remove this entry
        this.#values.splice(pos, 1);
        this.#colIdx.splice(pos, 1);
        for (let i = r + 1; i <= this.#rows; i++) this.#rowPtr[i]--;
      } else {
        this.#values[pos] = value;
      }
    } else if (value !== 0) {
      // Insert new entry at `pos`
      this.#values.splice(pos, 0, value);
      this.#colIdx.splice(pos, 0, c);
      for (let i = r + 1; i <= this.#rows; i++) this.#rowPtr[i]++;
    }
  }

  // ── Matrix operations ──────────────────────────────────────────────────────

  /** Add two sparse matrices element-wise. Returns a new SparseMatrix. */
  add(other: SparseMatrix): SparseMatrix {
    if (other.#rows !== this.#rows || other.#cols !== this.#cols) {
      throw new Error('Matrix dimensions must match for addition');
    }
    const result = new SparseMatrix(this.#rows, this.#cols);
    for (let r = 0; r < this.#rows; r++) {
      const aStart = this.#rowPtr[r],  aEnd = this.#rowPtr[r + 1];
      const bStart = other.#rowPtr[r], bEnd = other.#rowPtr[r + 1];
      let ai = aStart, bi = bStart;
      while (ai < aEnd || bi < bEnd) {
        const ac = ai < aEnd ? this.#colIdx[ai]  : Infinity;
        const bc = bi < bEnd ? other.#colIdx[bi] : Infinity;
        if (ac < bc) {
          result.set(r, ac, this.#values[ai++]);
        } else if (bc < ac) {
          result.set(r, bc, other.#values[bi++]);
        } else {
          const sum = this.#values[ai++] + other.#values[bi++];
          if (sum !== 0) result.set(r, ac, sum);
        }
      }
    }
    return result;
  }

  /** Multiply this matrix by `other`. Returns a new SparseMatrix. */
  multiply(other: SparseMatrix): SparseMatrix {
    if (this.#cols !== other.#rows) {
      throw new Error(`Incompatible dimensions for multiplication: (${this.#rows}×${this.#cols}) × (${other.#rows}×${other.#cols})`);
    }
    const result = new SparseMatrix(this.#rows, other.#cols);
    for (let r = 0; r < this.#rows; r++) {
      // Accumulate into a dense row buffer for simplicity
      const acc = new Array<number>(other.#cols).fill(0);
      const aStart = this.#rowPtr[r], aEnd = this.#rowPtr[r + 1];
      for (let ai = aStart; ai < aEnd; ai++) {
        const k  = this.#colIdx[ai];
        const av = this.#values[ai];
        const bStart = other.#rowPtr[k], bEnd = other.#rowPtr[k + 1];
        for (let bi = bStart; bi < bEnd; bi++) {
          acc[other.#colIdx[bi]] += av * other.#values[bi];
        }
      }
      for (let c = 0; c < other.#cols; c++) {
        if (acc[c] !== 0) result.set(r, c, acc[c]);
      }
    }
    return result;
  }

  /** Multiply matrix by a dense column vector. Returns a dense vector. */
  multiplyVector(v: number[]): number[] {
    if (v.length !== this.#cols) {
      throw new Error(`Vector length ${v.length} does not match matrix cols ${this.#cols}`);
    }
    const result = new Array<number>(this.#rows).fill(0);
    for (let r = 0; r < this.#rows; r++) {
      const start = this.#rowPtr[r], end = this.#rowPtr[r + 1];
      for (let i = start; i < end; i++) {
        result[r] += this.#values[i] * v[this.#colIdx[i]];
      }
    }
    return result;
  }

  /** Return the transpose as a new SparseMatrix. */
  transpose(): SparseMatrix {
    const T = new SparseMatrix(this.#cols, this.#rows);
    // Collect entries per transposed row (= original column)
    for (let r = 0; r < this.#rows; r++) {
      const start = this.#rowPtr[r], end = this.#rowPtr[r + 1];
      for (let i = start; i < end; i++) {
        T.set(this.#colIdx[i], r, this.#values[i]);
      }
    }
    return T;
  }

  // ── Conversion ─────────────────────────────────────────────────────────────

  /** Convert to a dense 2-D array. */
  toDense(): number[][] {
    const dense: number[][] = Array.from({ length: this.#rows }, () =>
      new Array<number>(this.#cols).fill(0),
    );
    for (let r = 0; r < this.#rows; r++) {
      const start = this.#rowPtr[r], end = this.#rowPtr[r + 1];
      for (let i = start; i < end; i++) {
        dense[r][this.#colIdx[i]] = this.#values[i];
      }
    }
    return dense;
  }

  /** Build a SparseMatrix from a dense 2-D array. */
  static fromDense(data: number[][]): SparseMatrix {
    const rows = data.length;
    const cols = rows === 0 ? 0 : data[0].length;
    const m = new SparseMatrix(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (data[r][c] !== 0) m.set(r, c, data[r][c]);
      }
    }
    return m;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  #checkBounds(r: number, c: number): void {
    if (r < 0 || r >= this.#rows || c < 0 || c >= this.#cols) {
      throw new RangeError(`Index (${r}, ${c}) out of bounds for ${this.#rows}×${this.#cols} matrix`);
    }
  }
}
