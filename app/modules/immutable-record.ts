// ─── Immutable Record ────────────────────────────────────────────────────────
// Value object pattern: a type-safe, deeply-frozen record that returns new
// instances on every mutation, preserving the original unchanged.

// ─── Deep equality helper ─────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

// ─── ImmutableRecord ─────────────────────────────────────────────────────────

/**
 * Immutable value-object wrapper around a plain record.
 * Every mutation method returns a new `ImmutableRecord`; the original is
 * never modified.
 *
 * @example
 *   const r = record({ name: 'Alice', age: 30 });
 *   const r2 = r.set('age', 31);   // r is unchanged
 *   r.get('age');  // 30
 *   r2.get('age'); // 31
 */
export class ImmutableRecord<T extends Record<string, unknown>> {
  readonly #data: Readonly<T>;

  constructor(data: T) {
    // Shallow-clone then freeze so external code cannot mutate via the
    // original reference.
    this.#data = Object.freeze({ ...data }) as Readonly<T>;
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  /** Return the value for `key`. */
  get<K extends keyof T>(key: K): T[K] {
    return this.#data[key];
  }

  /** Return a plain (unfrozen) copy of the underlying object. */
  toObject(): T {
    return { ...this.#data };
  }

  /** Return all keys. */
  keys(): (keyof T)[] {
    return Object.keys(this.#data) as (keyof T)[];
  }

  /** Return true if `key` exists on the record. */
  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.#data, key);
  }

  // ─── Equality ───────────────────────────────────────────────────────────────

  /** Deep-equality check against another ImmutableRecord of the same shape. */
  equals(other: ImmutableRecord<T>): boolean {
    return deepEqual(this.#data, other.#data);
  }

  // ─── Mutation (returns new instance) ────────────────────────────────────────

  /** Return a new record with `key` set to `value`. */
  set<K extends keyof T>(key: K, value: T[K]): ImmutableRecord<T> {
    return new ImmutableRecord<T>({ ...this.#data, [key]: value } as T);
  }

  /**
   * Return a new record with all fields in `partial` merged in.
   * Equivalent to `Object.assign({}, original, partial)`.
   */
  update(partial: Partial<T>): ImmutableRecord<T> {
    return new ImmutableRecord<T>({ ...this.#data, ...partial } as T);
  }

  /** Alias for `update` — merge a partial object into the record. */
  merge(other: Partial<T>): ImmutableRecord<T> {
    return this.update(other);
  }

  /**
   * Return a new record with `key` removed.
   * The result type drops `K` from `T`.
   */
  delete<K extends keyof T>(key: K): ImmutableRecord<Omit<T, K>> {
    const copy = { ...this.#data };
    delete (copy as Partial<T>)[key];
    return new ImmutableRecord<Omit<T, K>>(copy as Omit<T, K>);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Convenience factory — equivalent to `new ImmutableRecord(data)`. */
export function record<T extends Record<string, unknown>>(data: T): ImmutableRecord<T> {
  return new ImmutableRecord(data);
}
