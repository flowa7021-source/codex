// @ts-check
// ─── Multiset (Bag) ──────────────────────────────────────────────────────────
// A data structure that allows storing multiple occurrences of the same value.

/**
 * A Multiset (also called a "bag") maps each distinct element to a count.
 * Counts are always positive integers — zero-count entries are pruned.
 */
export class Multiset<T> {
  readonly #counts: Map<T, number>;
  #size: number;

  constructor(items?: Iterable<T>) {
    this.#counts = new Map<T, number>();
    this.#size = 0;
    if (items) {
      for (const item of items) {
        this.add(item);
      }
    }
  }

  // ── Mutation ────────────────────────────────────────────────────────────────

  /**
   * Add `count` (default 1) occurrences of `item`.
   * Throws if count is not a positive integer.
   */
  add(item: T, count: number = 1): void {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(`count must be a positive integer, got ${count}`);
    }
    const prev = this.#counts.get(item) ?? 0;
    this.#counts.set(item, prev + count);
    this.#size += count;
  }

  /**
   * Remove `count` (default 1) occurrences of `item`.
   * Returns `false` if the item is not present at all.
   * If count >= current count, all occurrences are removed.
   */
  delete(item: T, count: number = 1): boolean {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(`count must be a positive integer, got ${count}`);
    }
    const current = this.#counts.get(item);
    if (current === undefined) return false;

    if (count >= current) {
      this.#counts.delete(item);
      this.#size -= current;
    } else {
      this.#counts.set(item, current - count);
      this.#size -= count;
    }
    return true;
  }

  /**
   * Remove all occurrences of `item`.
   * Returns `false` if the item was not present.
   */
  deleteAll(item: T): boolean {
    const current = this.#counts.get(item);
    if (current === undefined) return false;
    this.#counts.delete(item);
    this.#size -= current;
    return true;
  }

  // ── Query ───────────────────────────────────────────────────────────────────

  /** Number of occurrences of `item` (0 if absent). */
  count(item: T): number {
    return this.#counts.get(item) ?? 0;
  }

  /** Total number of items, counting duplicates. */
  get size(): number {
    return this.#size;
  }

  /** Number of distinct items (unique values). */
  get distinctSize(): number {
    return this.#counts.size;
  }

  /** Returns `true` if at least one occurrence of `item` is present. */
  has(item: T): boolean {
    return this.#counts.has(item);
  }

  // ── Iteration ───────────────────────────────────────────────────────────────

  /** All distinct items (each appearing once). */
  keys(): T[] {
    return [...this.#counts.keys()];
  }

  /**
   * All items with repetition — each item appears `count` times.
   * Order follows insertion order of distinct items.
   */
  values(): T[] {
    const result: T[] = [];
    for (const [item, count] of this.#counts) {
      for (let i = 0; i < count; i++) {
        result.push(item);
      }
    }
    return result;
  }

  /** `[item, count]` pairs for every distinct item. */
  entries(): [T, number][] {
    return [...this.#counts.entries()];
  }

  // ── Set-like Operations ─────────────────────────────────────────────────────

  /**
   * Union: for each distinct item, take the **max** count from either multiset.
   */
  union(other: Multiset<T>): Multiset<T> {
    const result = new Multiset<T>();
    const allKeys = new Set<T>([...this.#counts.keys(), ...other.#counts.keys()]);
    for (const item of allKeys) {
      const c = Math.max(this.count(item), other.count(item));
      if (c > 0) result.add(item, c);
    }
    return result;
  }

  /**
   * Intersection: for each distinct item, take the **min** count from either
   * multiset. Items absent from either side are dropped.
   */
  intersect(other: Multiset<T>): Multiset<T> {
    const result = new Multiset<T>();
    for (const [item, count] of this.#counts) {
      const c = Math.min(count, other.count(item));
      if (c > 0) result.add(item, c);
    }
    return result;
  }

  /**
   * Difference: subtract `other` counts from `this` counts, floored at 0.
   * Items where the result would be 0 are omitted.
   */
  difference(other: Multiset<T>): Multiset<T> {
    const result = new Multiset<T>();
    for (const [item, count] of this.#counts) {
      const c = count - other.count(item);
      if (c > 0) result.add(item, c);
    }
    return result;
  }

  /**
   * Sum: add counts from both multisets together.
   */
  sum(other: Multiset<T>): Multiset<T> {
    const result = new Multiset<T>();
    for (const [item, count] of this.#counts) {
      result.add(item, count);
    }
    for (const [item, count] of other.#counts) {
      result.add(item, count);
    }
    return result;
  }
}
