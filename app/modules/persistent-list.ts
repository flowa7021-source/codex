// ─── Persistent List ─────────────────────────────────────────────────────────
// Immutable functional list backed by a frozen array snapshot.
// Every operation returns a new PersistentList; the original is never mutated.

// ─── PersistentList ──────────────────────────────────────────────────────────

/**
 * Immutable list that returns a new list from every structural mutation.
 *
 * @example
 *   const l  = list(1, 2, 3);
 *   const l2 = l.push(4);   // l still has [1, 2, 3]
 *   l2.toArray();            // [1, 2, 3, 4]
 */
export class PersistentList<T> {
  readonly #items: readonly T[];

  constructor(items: T[] = []) {
    this.#items = Object.freeze([...items]);
  }

  // ─── Introspection ───────────────────────────────────────────────────────────

  /** Number of items in the list. */
  get size(): number {
    return this.#items.length;
  }

  /** True when the list has no items. */
  get isEmpty(): boolean {
    return this.#items.length === 0;
  }

  /** Return the item at `index`, or `undefined` if out of range. */
  get(index: number): T | undefined {
    return this.#items[index];
  }

  /** Return a plain (mutable) array copy. */
  toArray(): T[] {
    return [...this.#items];
  }

  // ─── Mutation (returns new list) ─────────────────────────────────────────────

  /** Return a new list with `item` appended to the end. */
  push(item: T): PersistentList<T> {
    return new PersistentList<T>([...this.#items, item]);
  }

  /**
   * Return the last item and a new list without it.
   * `item` is `undefined` when the list is empty.
   */
  pop(): { list: PersistentList<T>; item: T | undefined } {
    if (this.#items.length === 0) {
      return { list: new PersistentList<T>(), item: undefined };
    }
    const item = this.#items[this.#items.length - 1];
    return {
      list: new PersistentList<T>(this.#items.slice(0, -1) as T[]),
      item,
    };
  }

  /** Return a new list with `item` prepended to the front. */
  unshift(item: T): PersistentList<T> {
    return new PersistentList<T>([item, ...this.#items]);
  }

  /**
   * Return the first item and a new list without it.
   * `item` is `undefined` when the list is empty.
   */
  shift(): { list: PersistentList<T>; item: T | undefined } {
    if (this.#items.length === 0) {
      return { list: new PersistentList<T>(), item: undefined };
    }
    const [item, ...rest] = this.#items;
    return { list: new PersistentList<T>(rest as T[]), item };
  }

  /** Return a new list with the item at `index` replaced by `value`. */
  set(index: number, value: T): PersistentList<T> {
    if (index < 0 || index >= this.#items.length) {
      return new PersistentList<T>(this.#items as T[]);
    }
    const copy = [...this.#items] as T[];
    copy[index] = value;
    return new PersistentList<T>(copy);
  }

  // ─── Functional transforms ───────────────────────────────────────────────────

  /** Return a new list produced by applying `fn` to every item. */
  map<U>(fn: (item: T, i: number) => U): PersistentList<U> {
    return new PersistentList<U>((this.#items as T[]).map(fn));
  }

  /** Return a new list containing only the items for which `predicate` returns true. */
  filter(predicate: (item: T, i: number) => boolean): PersistentList<T> {
    return new PersistentList<T>((this.#items as T[]).filter(predicate));
  }

  /**
   * Return a new list that is a slice of the current list.
   * Follows the same semantics as `Array.prototype.slice`.
   */
  slice(start?: number, end?: number): PersistentList<T> {
    return new PersistentList<T>((this.#items as T[]).slice(start, end));
  }

  /** Return a new list with all items from `other` appended. */
  concat(other: PersistentList<T>): PersistentList<T> {
    return new PersistentList<T>([...this.#items, ...other.#items]);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Convenience factory — `list(1, 2, 3)` is equivalent to `new PersistentList([1, 2, 3])`. */
export function list<T>(...items: T[]): PersistentList<T> {
  return new PersistentList(items);
}
