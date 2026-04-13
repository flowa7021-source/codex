// @ts-check
// ─── Data Transformation Pipeline ────────────────────────────────────────────
// A fluent, chainable data-transformation pipeline with lazy evaluation.
// All intermediate operations are applied eagerly on each chain call, making
// the implementation straightforward while still providing a fluent API.

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * A chainable data-transformation pipeline.
 *
 * Operations that return `Pipeline<U>` create a *new* pipeline holding the
 * transformed data, leaving the original pipeline unchanged.
 */
export class Pipeline<T> {
  private _data: T[];

  constructor(data: T[]) {
    this._data = data.slice(); // defensive copy
  }

  // ── Transformations (return new Pipeline) ───────────────────────────────────

  /** Apply `fn` to every element and return a new Pipeline with the results. */
  map<U>(fn: (item: T, idx: number) => U): Pipeline<U> {
    return new Pipeline<U>(this._data.map(fn));
  }

  /** Keep only elements for which `fn` returns true. */
  filter(fn: (item: T, idx: number) => boolean): Pipeline<T> {
    return new Pipeline<T>(this._data.filter(fn));
  }

  /** Sort elements in place (on a copy) using the provided comparator. */
  sortBy(fn: (a: T, b: T) => number): Pipeline<T> {
    return new Pipeline<T>([...this._data].sort(fn));
  }

  /** Keep only the first `n` elements. */
  take(n: number): Pipeline<T> {
    return new Pipeline<T>(this._data.slice(0, n));
  }

  /** Skip the first `n` elements. */
  skip(n: number): Pipeline<T> {
    return new Pipeline<T>(this._data.slice(n));
  }

  /**
   * Remove duplicate elements.
   * If `fn` is provided, two elements are considered equal when `fn` returns
   * the same value for both.  Otherwise strict identity (`===`) is used.
   */
  unique(fn?: (item: T) => unknown): Pipeline<T> {
    if (fn === undefined) {
      return new Pipeline<T>([...new Set(this._data)]);
    }
    const seen = new Set<unknown>();
    return new Pipeline<T>(
      this._data.filter((item) => {
        const key = fn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }

  /**
   * Map each element to an array and flatten one level.
   * Equivalent to `Array.prototype.flatMap`.
   */
  flatMap<U>(fn: (item: T) => U[]): Pipeline<U> {
    return new Pipeline<U>(this._data.flatMap(fn));
  }

  // ── Terminal operations ──────────────────────────────────────────────────────

  /**
   * Fold the pipeline into a single value.
   * The `initial` accumulator is passed as the first argument to `fn`.
   */
  reduce<U>(fn: (acc: U, item: T, idx: number) => U, initial: U): U {
    return this._data.reduce(fn, initial);
  }

  /**
   * Partition elements into groups by a key function.
   * Returns a `Record` mapping each key to the array of elements with that key.
   */
  groupBy<K extends string>(fn: (item: T) => K): Record<K, T[]> {
    const result = {} as Record<K, T[]>;
    for (const item of this._data) {
      const key = fn(item);
      if (key in result) {
        result[key].push(item);
      } else {
        result[key] = [item];
      }
    }
    return result;
  }

  /** Return the underlying array (a copy). */
  toArray(): T[] {
    return this._data.slice();
  }

  /** Return the number of elements in the pipeline. */
  count(): number {
    return this._data.length;
  }

  /** Return the first element, or `undefined` if the pipeline is empty. */
  first(): T | undefined {
    return this._data[0];
  }

  /** Return the last element, or `undefined` if the pipeline is empty. */
  last(): T | undefined {
    return this._data[this._data.length - 1];
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new `Pipeline` from an array.
 *
 * @example
 * const result = pipeline([1, 2, 3, 4, 5])
 *   .filter(x => x % 2 === 0)
 *   .map(x => x * 10)
 *   .toArray(); // [20, 40]
 */
export function pipeline<T>(data: T[]): Pipeline<T> {
  return new Pipeline<T>(data);
}
