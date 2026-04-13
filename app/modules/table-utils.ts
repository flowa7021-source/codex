// @ts-check
// ─── Table Utilities ─────────────────────────────────────────────────────────
// In-memory table with chainable query operations (select, where, orderBy, …).

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Immutable in-memory table with a chainable query API.
 *
 * @template T - Row shape; must be a plain object with string keys.
 *
 * @example
 *   const t = new Table([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
 *   t.orderBy('age').limit(1).toArray(); // [{ name: 'Bob', age: 25 }]
 */
export class Table<T extends Record<string, unknown>> {
  readonly #rows: readonly T[];

  constructor(rows: T[]) {
    this.#rows = Object.freeze([...rows]);
  }

  // ── Projection ─────────────────────────────────────────────────────────────

  /**
   * Return a new Table containing only the specified columns.
   * Column values not present on a row default to `undefined`.
   */
  select<K extends keyof T>(...columns: K[]): Table<Pick<T, K>> {
    const projected = this.#rows.map((row) => {
      const out = {} as Pick<T, K>;
      for (const col of columns) {
        out[col] = row[col];
      }
      return out;
    });
    return new Table(projected);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  /** Return a new Table containing only rows that satisfy `predicate`. */
  where(predicate: (row: T) => boolean): Table<T> {
    return new Table(this.#rows.filter(predicate));
  }

  // ── Ordering ───────────────────────────────────────────────────────────────

  /**
   * Return a new Table sorted by `column`.
   * @param direction 'asc' (default) or 'desc'
   */
  orderBy(column: keyof T, direction: 'asc' | 'desc' = 'asc'): Table<T> {
    const sign = direction === 'asc' ? 1 : -1;
    const sorted = [...this.#rows].sort((a, b) => {
      const va = a[column];
      const vb = b[column];
      if (va === vb) return 0;
      if (va === null || va === undefined) return sign;
      if (vb === null || vb === undefined) return -sign;
      return va < vb ? -sign : sign;
    });
    return new Table(sorted);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  /** Return a new Table with at most `n` rows from the start. */
  limit(n: number): Table<T> {
    return new Table(this.#rows.slice(0, n));
  }

  /** Return a new Table with the first `n` rows removed. */
  offset(n: number): Table<T> {
    return new Table(this.#rows.slice(n));
  }

  // ── Grouping ───────────────────────────────────────────────────────────────

  /**
   * Group rows by a column's value.
   * Returns a Map whose keys are the distinct values of `column` and whose
   * values are Tables containing the matching rows.
   */
  groupBy<K extends keyof T>(column: K): Map<T[K], Table<T>> {
    const map = new Map<T[K], T[]>();
    for (const row of this.#rows) {
      const key = row[column] as T[K];
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        map.set(key, [row]);
      }
    }
    const result = new Map<T[K], Table<T>>();
    for (const [key, bucket] of map) {
      result.set(key, new Table(bucket));
    }
    return result;
  }

  // ── Aggregation ────────────────────────────────────────────────────────────

  /**
   * Apply an aggregation function to the underlying row array and return the
   * result. Useful for SUM, AVG, MIN/MAX, COUNT, etc.
   */
  aggregate<R>(fn: (rows: T[]) => R): R {
    return fn([...this.#rows]);
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  /** Return a shallow copy of the underlying row array. */
  toArray(): T[] {
    return [...this.#rows];
  }

  /** Number of rows in the table. */
  count(): number {
    return this.#rows.length;
  }

  /**
   * Return the sorted list of unique values present in `column`.
   * Order is insertion order (first encountered wins).
   */
  distinct(column: keyof T): unknown[] {
    const seen = new Set<unknown>();
    const result: unknown[] = [];
    for (const row of this.#rows) {
      const val = row[column];
      if (!seen.has(val)) {
        seen.add(val);
        result.push(val);
      }
    }
    return result;
  }
}

// ─── Join ────────────────────────────────────────────────────────────────────

/**
 * Inner join two Tables.
 * Each pair `(a, b)` for which `on(a, b)` returns `true` produces a merged
 * row (`{ ...a, ...b }`).  If both sides share a key the right-hand value wins.
 *
 * @template A - Left row shape
 * @template B - Right row shape
 */
export function join<
  A extends Record<string, unknown>,
  B extends Record<string, unknown>,
>(left: Table<A>, right: Table<B>, on: (a: A, b: B) => boolean): Table<A & B> {
  const leftRows = left.toArray();
  const rightRows = right.toArray();
  const result: (A & B)[] = [];

  for (const a of leftRows) {
    for (const b of rightRows) {
      if (on(a, b)) {
        result.push({ ...a, ...b } as A & B);
      }
    }
  }

  return new Table(result);
}
