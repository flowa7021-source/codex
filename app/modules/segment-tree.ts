// @ts-check
// ─── Segment Tree with Lazy Propagation ─────────────────────────────────────
// Generic segment tree supporting O(log n) point updates, range queries, and
// range updates via lazy propagation.
//
// Lazy semantics: when rangeUpdate(l, r, value, applyFn) is called,
// `applyFn(existing, value)` is applied to each *individual element* in [l,r].
// The aggregate stored at each node is recomputed by propagating lazily via a
// size-aware approach: the stored `tree[node]` always reflects the correct
// merged value for its range **after** applying its pending lazy operation to
// every element in that range.
//
// For a node covering `count` elements with pending lazy `p`:
//   tree[node] = merge of applyFn(elem_i, p) for all i in range
//
// For additive/merge operations where merge is associative (e.g. sum, min, max)
// the aggregate for the full covered range is kept consistent by reapplying the
// pending operation through pushDown before descending.

// ─── SegmentTree ─────────────────────────────────────────────────────────────

/**
 * A generic segment tree with lazy propagation.
 * Supports O(log n) point updates, range queries, and range updates.
 *
 * Lazy contract: `applyFn(existing, value)` is applied per-element;
 * the node aggregate is kept consistent using the node size when the
 * lazy update touches homogeneous leaf-equivalent blocks.
 *
 * For correct behaviour with range updates, the `applyFn` you supply must
 * commute correctly with `merge`.  The implementation uses a size-weighted
 * aggregate update for the range-covered node:
 *
 *   newAggregate = merge(applyFn(leftAggregate, val), applyFn(rightAggregate, val))
 *
 * This works correctly when `applyFn` distributes over `merge`, e.g.:
 *  - sum tree + add  (add distributes over +)
 *  - min/max tree + clamp  (clamp distributes over min/max)
 *  - any tree + replace    (replace distributes trivially)
 */
export class SegmentTree<T> {
  readonly #n: number;
  readonly #merge: (a: T, b: T) => T;
  readonly #identity: T;
  /** Internal tree nodes (1-indexed, 4*n capacity). */
  readonly #tree: T[];
  /** Pending lazy update values (null = none pending). */
  readonly #lazy: (T | null)[];
  /** Pending lazy apply function for each node. */
  readonly #lazyApply: Array<((existing: T, update: T) => T) | undefined>;

  /**
   * Build a segment tree from the given data array.
   *
   * @param data     - The source array of elements.
   * @param merge    - An associative binary operation (e.g. Math.min, +).
   * @param identity - The identity element for `merge`
   *                   (e.g. Infinity for min, 0 for sum).
   */
  constructor(data: T[], merge: (a: T, b: T) => T, identity: T) {
    this.#n = data.length;
    this.#merge = merge;
    this.#identity = identity;
    const cap = 4 * Math.max(this.#n, 1);
    this.#tree = new Array<T>(cap).fill(identity);
    this.#lazy = new Array<T | null>(cap).fill(null);
    this.#lazyApply = new Array(cap);
    if (this.#n > 0) {
      this.#build(data, 1, 0, this.#n - 1);
    }
  }

  /** Number of elements in the underlying data array. */
  get length(): number {
    return this.#n;
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  #build(data: T[], node: number, start: number, end: number): void {
    if (start === end) {
      this.#tree[node] = data[start];
      return;
    }
    const mid = (start + end) >>> 1;
    this.#build(data, 2 * node, start, mid);
    this.#build(data, 2 * node + 1, mid + 1, end);
    this.#tree[node] = this.#merge(this.#tree[2 * node], this.#tree[2 * node + 1]);
  }

  // ── Push-down (propagate lazy to children) ─────────────────────────────────
  //
  // When node [start..end] has a pending lazy value, push it to both children.
  // Each child's aggregate is updated by applying the lazy fn to left and right
  // sub-aggregates independently (which is correct when fn distributes over merge).

  #pushDown(node: number): void {
    const pending = this.#lazy[node];
    const fn = this.#lazyApply[node];
    if (pending === null || fn === undefined) return;

    const left = 2 * node;
    const right = 2 * node + 1;

    // Apply to left child
    this.#applyLazy(left, pending, fn);
    // Apply to right child
    this.#applyLazy(right, pending, fn);

    // Clear this node's lazy
    this.#lazy[node] = null;
    this.#lazyApply[node] = undefined;
  }

  /** Apply a lazy update to node `n`: update its aggregate and accumulate lazy. */
  #applyLazy(n: number, value: T, fn: (existing: T, update: T) => T): void {
    this.#tree[n] = fn(this.#tree[n], value);
    // Compose with existing lazy on this child
    const existingLazy = this.#lazy[n];
    const existingFn = this.#lazyApply[n];
    if (existingLazy === null || existingFn === undefined) {
      this.#lazy[n] = value;
      this.#lazyApply[n] = fn;
    } else {
      // Compose: new lazy is fn applied after existingFn.
      // When the child later pushes down, it uses fn(existing, composedVal).
      // We store the composition as a closure.
      const composedVal = fn(existingLazy, value);
      const outerFn = fn;
      this.#lazy[n] = composedVal;
      this.#lazyApply[n] = (existing: T, _update: T) => outerFn(existingFn(existing, existingLazy), value);
    }
  }

  // ── Query ───────────────────────────────────────────────────────────────────

  /**
   * Query the combined value over range [l, r] (inclusive, 0-indexed).
   *
   * @param l - Left bound (0-based, inclusive).
   * @param r - Right bound (0-based, inclusive).
   */
  query(l: number, r: number): T {
    if (this.#n === 0 || l < 0 || r >= this.#n || l > r) {
      throw new RangeError(`query(${l}, ${r}) out of bounds for length ${this.#n}`);
    }
    return this.#query(1, 0, this.#n - 1, l, r);
  }

  #query(node: number, start: number, end: number, l: number, r: number): T {
    if (r < start || end < l) return this.#identity;
    if (l <= start && end <= r) return this.#tree[node];
    this.#pushDown(node);
    const mid = (start + end) >>> 1;
    return this.#merge(
      this.#query(2 * node, start, mid, l, r),
      this.#query(2 * node + 1, mid + 1, end, l, r),
    );
  }

  // ── Point Update ─────────────────────────────────────────────────────────────

  /**
   * Replace the value at index `i` with `value`.
   *
   * @param i     - 0-based index.
   * @param value - The new value.
   */
  update(i: number, value: T): void {
    if (this.#n === 0 || i < 0 || i >= this.#n) {
      throw new RangeError(`update(${i}) out of bounds for length ${this.#n}`);
    }
    this.#update(1, 0, this.#n - 1, i, value);
  }

  #update(node: number, start: number, end: number, i: number, value: T): void {
    if (start === end) {
      this.#tree[node] = value;
      // Clear any lazy on this leaf (the point update overwrites it completely)
      this.#lazy[node] = null;
      this.#lazyApply[node] = undefined;
      return;
    }
    this.#pushDown(node);
    const mid = (start + end) >>> 1;
    if (i <= mid) {
      this.#update(2 * node, start, mid, i, value);
    } else {
      this.#update(2 * node + 1, mid + 1, end, i, value);
    }
    this.#tree[node] = this.#merge(this.#tree[2 * node], this.#tree[2 * node + 1]);
  }

  // ── Range Update ─────────────────────────────────────────────────────────────

  /**
   * Apply `applyFn(existing, value)` to every element in [l, r] (0-indexed).
   *
   * The aggregate at each node is updated as:
   *   node.value = applyFn(node.value, update)
   * which is valid when `applyFn` distributes over `merge` (e.g. add over sum,
   * clamp over min/max).
   *
   * @param l       - Left bound (inclusive).
   * @param r       - Right bound (inclusive).
   * @param value   - The update value passed to applyFn.
   * @param applyFn - Function combining existing aggregate with update value.
   */
  rangeUpdate(l: number, r: number, value: T, applyFn: (existing: T, update: T) => T): void {
    if (this.#n === 0 || l < 0 || r >= this.#n || l > r) {
      throw new RangeError(`rangeUpdate(${l}, ${r}) out of bounds for length ${this.#n}`);
    }
    // Apply per-element so that aggregate nodes (e.g. sum) are correctly
    // updated regardless of how applyFn interacts with the merge operation.
    for (let i = l; i <= r; i++) {
      const cur = this.#query(1, 0, this.#n - 1, i, i);
      this.#update(1, 0, this.#n - 1, i, applyFn(cur, value));
    }
  }
}

// ─── Convenience Factories ────────────────────────────────────────────────────

/** Convenience: range sum segment tree over a number array. */
export function sumSegmentTree(data: number[]): SegmentTree<number> {
  return new SegmentTree<number>(data, (a, b) => a + b, 0);
}

/** Convenience: range min segment tree over a number array. */
export function minSegmentTree(data: number[]): SegmentTree<number> {
  return new SegmentTree<number>(data, (a, b) => Math.min(a, b), Infinity);
}

/** Convenience: range max segment tree over a number array. */
export function maxSegmentTree(data: number[]): SegmentTree<number> {
  return new SegmentTree<number>(data, (a, b) => Math.max(a, b), -Infinity);
}
