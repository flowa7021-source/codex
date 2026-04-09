// @ts-check
// ─── Fenwick Tree (Binary Indexed Tree) ────────────────────────────────────
// Supports O(log n) point updates and prefix-sum queries over a numeric array.

// ─── FenwickTree ────────────────────────────────────────────────────────────

export class FenwickTree {
  readonly #tree: number[];
  readonly #values: number[];
  readonly #size: number;

  /**
   * Construct a Fenwick tree.
   * @param sizeOrData - either a numeric size (all zeros) or an initial data array.
   */
  constructor(sizeOrData: number | number[]) {
    if (typeof sizeOrData === 'number') {
      if (sizeOrData < 0 || !Number.isInteger(sizeOrData)) {
        throw new RangeError('Size must be a non-negative integer');
      }
      this.#size = sizeOrData;
      this.#tree = new Array<number>(sizeOrData + 1).fill(0);
      this.#values = new Array<number>(sizeOrData).fill(0);
    } else {
      const data = sizeOrData;
      this.#size = data.length;
      this.#values = data.slice();
      // Build tree in O(n) using the standard technique
      this.#tree = new Array<number>(data.length + 1).fill(0);
      for (let i = 0; i < data.length; i++) {
        this.#tree[i + 1] = data[i];
      }
      for (let i = 1; i <= data.length; i++) {
        const parent = i + (i & -i);
        if (parent <= data.length) {
          this.#tree[parent] += this.#tree[i];
        }
      }
    }
  }

  /** Number of elements in the tree. */
  get size(): number {
    return this.#size;
  }

  /**
   * Add `delta` to the value at `index`.
   * @param index - zero-based index (0 <= index < size).
   * @param delta - value to add.
   */
  update(index: number, delta: number): void {
    this.#boundsCheck(index);
    this.#values[index] += delta;
    let i = index + 1; // 1-based
    while (i <= this.#size) {
      this.#tree[i] += delta;
      i += i & -i;
    }
  }

  /**
   * Set the absolute value at `index`.
   * @param index - zero-based index (0 <= index < size).
   * @param value - new value.
   */
  set(index: number, value: number): void {
    this.#boundsCheck(index);
    const delta = value - this.#values[index];
    this.update(index, delta);
  }

  /**
   * Return the prefix sum from index 0 through `index` (inclusive).
   * @param index - zero-based index (0 <= index < size).
   */
  prefixSum(index: number): number {
    this.#boundsCheck(index);
    let sum = 0;
    let i = index + 1; // 1-based
    while (i > 0) {
      sum += this.#tree[i];
      i -= i & -i;
    }
    return sum;
  }

  /**
   * Return the sum of elements in the range [left, right] (inclusive).
   * @param left  - zero-based left bound.
   * @param right - zero-based right bound (>= left).
   */
  rangeSum(left: number, right: number): number {
    if (left > right) {
      throw new RangeError(`left (${left}) must be <= right (${right})`);
    }
    this.#boundsCheck(left);
    this.#boundsCheck(right);
    return left === 0 ? this.prefixSum(right) : this.prefixSum(right) - this.prefixSum(left - 1);
  }

  /** Reconstruct the underlying values as a plain array. */
  toArray(): number[] {
    return this.#values.slice();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  #boundsCheck(index: number): void {
    if (index < 0 || index >= this.#size) {
      throw new RangeError(`Index ${index} out of bounds [0, ${this.#size - 1}]`);
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a FenwickTree from a size (zeros) or an initial data array.
 */
export function createFenwickTree(sizeOrData: number | number[]): FenwickTree {
  return new FenwickTree(sizeOrData);
}
