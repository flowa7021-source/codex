// ─── Sorted Array ────────────────────────────────────────────────────────────
// A self-maintaining sorted array backed by binary search insertion.
// Keeps elements in ascending order at all times; O(log n) for lookups,
// O(n) for insertions/removals (array shift cost).

import { lowerBound, upperBound } from './binary-search.js';

// ─── Default Comparator ──────────────────────────────────────────────────────

function defaultComparator<T>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ─── SortedArray ─────────────────────────────────────────────────────────────

/**
 * A self-maintaining sorted array. Elements are kept in ascending order
 * (as defined by the comparator) at all times.
 *
 * @example
 *   const sa = new SortedArray<number>();
 *   sa.insert(5); sa.insert(2); sa.insert(8);
 *   sa.toArray(); // [2, 5, 8]
 */
export class SortedArray<T> {
  #data: T[];
  #comparator: (a: T, b: T) => number;

  /**
   * @param comparator Optional comparison function (default: natural order).
   * @param items      Optional initial items (will be sorted on construction).
   */
  constructor(
    comparator: (a: T, b: T) => number = defaultComparator,
    items?: T[],
  ) {
    this.#comparator = comparator;
    if (items && items.length > 0) {
      this.#data = [...items].sort(comparator);
    } else {
      this.#data = [];
    }
  }

  // ─── Insertion ─────────────────────────────────────────────────────────────

  /**
   * Insert an item maintaining sort order.
   * @returns The index at which the item was inserted.
   */
  insert(item: T): number {
    const idx = lowerBound(this.#data, item, this.#comparator);
    this.#data.splice(idx, 0, item);
    return idx;
  }

  /**
   * Insert all items from an array. Each item is inserted maintaining order.
   * More efficient to provide a large batch at construction time, but this
   * supports incremental additions.
   */
  insertAll(items: T[]): void {
    for (const item of items) {
      this.insert(item);
    }
  }

  // ─── Removal ───────────────────────────────────────────────────────────────

  /**
   * Remove the first occurrence of `item`.
   * @returns `true` if an item was removed, `false` if not found.
   */
  remove(item: T): boolean {
    const idx = this.indexOf(item);
    if (idx === -1) return false;
    this.#data.splice(idx, 1);
    return true;
  }

  /**
   * Remove the element at `index`.
   * @returns The removed item, or `undefined` if out of bounds.
   */
  removeAt(index: number): T | undefined {
    if (index < 0 || index >= this.#data.length) return undefined;
    return this.#data.splice(index, 1)[0];
  }

  // ─── Lookup ────────────────────────────────────────────────────────────────

  /**
   * Check whether `item` exists in the sorted array.
   */
  has(item: T): boolean {
    return this.indexOf(item) !== -1;
  }

  /**
   * Find the index of the first occurrence of `item` using binary search.
   * @returns The index, or -1 if not found.
   */
  indexOf(item: T): number {
    const lo = lowerBound(this.#data, item, this.#comparator);
    if (lo < this.#data.length && this.#comparator(this.#data[lo], item) === 0) {
      return lo;
    }
    return -1;
  }

  /**
   * Get the element at `index`.
   * @returns The element, or `undefined` if out of bounds.
   */
  get(index: number): T | undefined {
    return this.#data[index];
  }

  // ─── Slice / Export ────────────────────────────────────────────────────────

  /**
   * Return a portion of the sorted array as a plain array.
   * Follows the same semantics as `Array.prototype.slice`.
   */
  slice(start?: number, end?: number): T[] {
    return this.#data.slice(start, end);
  }

  /**
   * Return a copy of all elements as a plain array (in sorted order).
   */
  toArray(): T[] {
    return [...this.#data];
  }

  // ─── Size ──────────────────────────────────────────────────────────────────

  /** Number of elements currently stored. */
  get size(): number {
    return this.#data.length;
  }

  // ─── Min / Max ─────────────────────────────────────────────────────────────

  /**
   * The minimum (first) element, or `undefined` if empty.
   */
  min(): T | undefined {
    return this.#data[0];
  }

  /**
   * The maximum (last) element, or `undefined` if empty.
   */
  max(): T | undefined {
    return this.#data[this.#data.length - 1];
  }

  // ─── Range Query ───────────────────────────────────────────────────────────

  /**
   * Return all elements in the inclusive range [low, high].
   * Uses binary search to find the slice boundaries in O(log n).
   *
   * @param low  Lower bound (inclusive).
   * @param high Upper bound (inclusive).
   * @returns Array of elements e where low <= e <= high.
   */
  range(low: T, high: T): T[] {
    const lo = lowerBound(this.#data, low, this.#comparator);
    const hi = upperBound(this.#data, high, this.#comparator);
    return this.#data.slice(lo, hi);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Factory function for creating a `SortedArray<T>`.
 *
 * @param comparator Optional ordering function.
 * @returns A new, empty `SortedArray`.
 *
 * @example
 *   const sa = createSortedArray<string>((a, b) => a.localeCompare(b));
 */
export function createSortedArray<T>(
  comparator?: (a: T, b: T) => number,
): SortedArray<T> {
  return new SortedArray<T>(comparator);
}
