// @ts-check
// ─── Fenwick Tree (Binary Indexed Tree) ────────────────────────────────────
// Supports O(log n) point updates and prefix-sum queries.
// The 1-D tree uses a 1-indexed public API; the 2-D tree mirrors that.

// ─── FenwickTree ────────────────────────────────────────────────────────────

/**
 * A Fenwick Tree (Binary Indexed Tree) for efficient prefix sums.
 * All indices in the public API are 1-based.
 */
export class FenwickTree {
  readonly #n: number;
  readonly #tree: number[];
  /** Shadow array tracking the logical value at each 1-based position. */
  readonly #vals: number[];

  /**
   * Construct a Fenwick tree of size `n` (all values initialised to 0).
   *
   * @param n - Number of elements (must be a non-negative integer).
   */
  constructor(n: number) {
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`FenwickTree size must be a non-negative integer, got ${n}`);
    }
    this.#n = n;
    this.#tree = new Array<number>(n + 1).fill(0);
    this.#vals = new Array<number>(n + 1).fill(0); // 1-indexed shadow
  }

  /** Number of elements in the tree. */
  get size(): number {
    return this.#n;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Add `delta` to element at 1-based index `i`.
   *
   * @param i     - 1-based index (1 ≤ i ≤ size).
   * @param delta - Value to add.
   */
  add(i: number, delta: number): void {
    this.#check1(i);
    this.#vals[i] += delta;
    let j = i;
    while (j <= this.#n) {
      this.#tree[j] += delta;
      j += j & -j;
    }
  }

  /**
   * Prefix sum from position 1 to `i` (1-based, inclusive).
   *
   * @param i - 1-based index (1 ≤ i ≤ size).
   */
  prefixSum(i: number): number {
    this.#check1(i);
    let sum = 0;
    let j = i;
    while (j > 0) {
      sum += this.#tree[j];
      j -= j & -j;
    }
    return sum;
  }

  /**
   * Range sum from position `l` to `r` (1-based, inclusive).
   *
   * @param l - 1-based left bound.
   * @param r - 1-based right bound (≥ l).
   */
  rangeSum(l: number, r: number): number {
    this.#check1(l);
    this.#check1(r);
    if (l > r) throw new RangeError(`rangeSum: l (${l}) must be ≤ r (${r})`);
    return l === 1 ? this.prefixSum(r) : this.prefixSum(r) - this.prefixSum(l - 1);
  }

  /**
   * Return the current value at 1-based index `i`.
   *
   * @param i - 1-based index.
   */
  get(i: number): number {
    this.#check1(i);
    return this.#vals[i];
  }

  /**
   * Set element at 1-based index `i` to an exact `value`.
   *
   * @param i     - 1-based index.
   * @param value - New absolute value.
   */
  set(i: number, value: number): void {
    this.#check1(i);
    const delta = value - this.#vals[i];
    this.add(i, delta);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  #check1(i: number): void {
    if (i < 1 || i > this.#n) {
      throw new RangeError(`Index ${i} out of 1-based bounds [1, ${this.#n}]`);
    }
  }
}

// ─── FenwickTree2D ──────────────────────────────────────────────────────────

/**
 * A 2-D Fenwick Tree supporting 2-D prefix sums.
 * Rows and columns are 1-indexed.
 */
export class FenwickTree2D {
  readonly #rows: number;
  readonly #cols: number;
  readonly #tree: number[][];

  /**
   * @param rows - Number of rows (1-indexed limit).
   * @param cols - Number of columns (1-indexed limit).
   */
  constructor(rows: number, cols: number) {
    if (!Number.isInteger(rows) || rows < 0) {
      throw new RangeError(`rows must be a non-negative integer, got ${rows}`);
    }
    if (!Number.isInteger(cols) || cols < 0) {
      throw new RangeError(`cols must be a non-negative integer, got ${cols}`);
    }
    this.#rows = rows;
    this.#cols = cols;
    this.#tree = Array.from({ length: rows + 1 }, () =>
      new Array<number>(cols + 1).fill(0),
    );
  }

  /**
   * Add `delta` to cell (r, c) (1-based).
   */
  add(r: number, c: number, delta: number): void {
    this.#checkR(r);
    this.#checkC(c);
    let i = r;
    while (i <= this.#rows) {
      let j = c;
      while (j <= this.#cols) {
        this.#tree[i][j] += delta;
        j += j & -j;
      }
      i += i & -i;
    }
  }

  /**
   * Prefix sum over the rectangle from (1,1) to (r,c) (1-based, inclusive).
   */
  prefixSum(r: number, c: number): number {
    this.#checkR(r);
    this.#checkC(c);
    let sum = 0;
    let i = r;
    while (i > 0) {
      let j = c;
      while (j > 0) {
        sum += this.#tree[i][j];
        j -= j & -j;
      }
      i -= i & -i;
    }
    return sum;
  }

  /**
   * Sum over the sub-rectangle from (r1,c1) to (r2,c2) (1-based, inclusive).
   */
  rangeSum(r1: number, c1: number, r2: number, c2: number): number {
    this.#checkR(r1);
    this.#checkC(c1);
    this.#checkR(r2);
    this.#checkC(c2);
    if (r1 > r2) throw new RangeError(`rangeSum: r1 (${r1}) must be ≤ r2 (${r2})`);
    if (c1 > c2) throw new RangeError(`rangeSum: c1 (${c1}) must be ≤ c2 (${c2})`);

    const total = this.prefixSum(r2, c2);
    const top = r1 > 1 ? this.prefixSum(r1 - 1, c2) : 0;
    const left = c1 > 1 ? this.prefixSum(r2, c1 - 1) : 0;
    const corner = (r1 > 1 && c1 > 1) ? this.prefixSum(r1 - 1, c1 - 1) : 0;
    return total - top - left + corner;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  #checkR(r: number): void {
    if (r < 1 || r > this.#rows) {
      throw new RangeError(`Row ${r} out of 1-based bounds [1, ${this.#rows}]`);
    }
  }

  #checkC(c: number): void {
    if (c < 1 || c > this.#cols) {
      throw new RangeError(`Col ${c} out of 1-based bounds [1, ${this.#cols}]`);
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Build a FenwickTree from an existing data array (1-indexed values).
 * The array is treated as 1-indexed: data[0] → position 1, data[1] → position 2, …
 */
export function buildFenwickTree(data: number[]): FenwickTree {
  const ft = new FenwickTree(data.length);
  for (let i = 0; i < data.length; i++) {
    ft.add(i + 1, data[i]);
  }
  return ft;
}
