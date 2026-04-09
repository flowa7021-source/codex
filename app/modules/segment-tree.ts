// @ts-check
// ─── Segment Tree ───────────────────────────────────────────────────────────
// Generic segment tree for efficient range queries and point updates.
// Supports any associative combine operation with an identity element.

// ─── Class ──────────────────────────────────────────────────────────────────

/**
 * A segment tree that supports O(log n) range queries and point updates
 * over an arbitrary associative binary operation.
 */
export class SegmentTree<T> {
  private readonly _tree: T[];
  private readonly _n: number;
  private readonly _combine: (a: T, b: T) => T;
  private readonly _identity: T;

  /**
   * Build a segment tree from the given data array.
   *
   * @param data     - The source array of elements.
   * @param combine  - An associative binary operation (e.g. Math.min, +).
   * @param identity - The identity element for `combine`
   *                   (e.g. Infinity for min, 0 for sum).
   */
  constructor(data: T[], combine: (a: T, b: T) => T, identity: T) {
    this._n = data.length;
    this._combine = combine;
    this._identity = identity;

    // Allocate 4 * n to guarantee enough space for the implicit binary tree.
    this._tree = new Array<T>(4 * Math.max(this._n, 1)).fill(identity);

    if (this._n > 0) {
      this._build(data, 1, 0, this._n - 1);
    }
  }

  /** Number of elements in the underlying data array. */
  get size(): number {
    return this._n;
  }

  /**
   * Query the combined result over the inclusive range [l, r].
   *
   * @param l - Left index (0-based, inclusive).
   * @param r - Right index (0-based, inclusive).
   * @returns The combined value of all elements in [l, r].
   * @throws If l or r is out of bounds or l > r.
   */
  query(l: number, r: number): T {
    if (l < 0 || r >= this._n || l > r) {
      throw new RangeError(
        `query(${l}, ${r}) out of bounds for size ${this._n}`,
      );
    }
    return this._query(1, 0, this._n - 1, l, r);
  }

  /**
   * Replace the value at `index` with `value` and propagate the change.
   *
   * @param index - 0-based index into the original data array.
   * @param value - The new value.
   * @throws If index is out of bounds.
   */
  update(index: number, value: T): void {
    if (index < 0 || index >= this._n) {
      throw new RangeError(
        `update(${index}) out of bounds for size ${this._n}`,
      );
    }
    this._update(1, 0, this._n - 1, index, value);
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  private _build(data: T[], node: number, start: number, end: number): void {
    if (start === end) {
      this._tree[node] = data[start];
      return;
    }
    const mid = (start + end) >>> 1;
    this._build(data, 2 * node, start, mid);
    this._build(data, 2 * node + 1, mid + 1, end);
    this._tree[node] = this._combine(
      this._tree[2 * node],
      this._tree[2 * node + 1],
    );
  }

  private _query(
    node: number,
    start: number,
    end: number,
    l: number,
    r: number,
  ): T {
    if (r < start || end < l) {
      return this._identity;
    }
    if (l <= start && end <= r) {
      return this._tree[node];
    }
    const mid = (start + end) >>> 1;
    const leftVal = this._query(2 * node, start, mid, l, r);
    const rightVal = this._query(2 * node + 1, mid + 1, end, l, r);
    return this._combine(leftVal, rightVal);
  }

  private _update(
    node: number,
    start: number,
    end: number,
    index: number,
    value: T,
  ): void {
    if (start === end) {
      this._tree[node] = value;
      return;
    }
    const mid = (start + end) >>> 1;
    if (index <= mid) {
      this._update(2 * node, start, mid, index, value);
    } else {
      this._update(2 * node + 1, mid + 1, end, index, value);
    }
    this._tree[node] = this._combine(
      this._tree[2 * node],
      this._tree[2 * node + 1],
    );
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a new SegmentTree from the given data.
 */
export function createSegmentTree<T>(
  data: T[],
  combine: (a: T, b: T) => T,
  identity: T,
): SegmentTree<T> {
  return new SegmentTree(data, combine, identity);
}
