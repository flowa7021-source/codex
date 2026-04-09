// @ts-check
// ─── BiMap ──────────────────────────────────────────────────────────────────
// Bidirectional map (bijective key-value mapping). Every key maps to exactly
// one value and every value maps back to exactly one key.

/**
 * A bidirectional map where both keys and values are unique and lookups
 * can be performed in either direction.
 *
 * @example
 *   const bm = new BiMap<string, number>([['a', 1], ['b', 2]]);
 *   bm.get('a');      // 1
 *   bm.getKey(2);     // 'b'
 *   bm.inverse().get(1); // 'a'
 */
export class BiMap<K, V> {
  #forward = new Map<K, V>();
  #reverse = new Map<V, K>();

  constructor(entries?: [K, V][]) {
    if (entries) {
      for (const [k, v] of entries) {
        this.set(k, v);
      }
    }
  }

  /** Set a key-value pair, replacing any existing associations in both directions. */
  set(key: K, value: V): void {
    // Remove old value for this key (if any)
    if (this.#forward.has(key)) {
      const oldValue = this.#forward.get(key)!;
      this.#reverse.delete(oldValue);
    }
    // Remove old key for this value (if any)
    if (this.#reverse.has(value)) {
      const oldKey = this.#reverse.get(value)!;
      this.#forward.delete(oldKey);
    }
    this.#forward.set(key, value);
    this.#reverse.set(value, key);
  }

  /** Get the value for a key. */
  get(key: K): V | undefined {
    return this.#forward.get(key);
  }

  /** Reverse lookup: get the key for a value. */
  getKey(value: V): K | undefined {
    return this.#reverse.get(value);
  }

  /** Whether the map contains the given key. */
  has(key: K): boolean {
    return this.#forward.has(key);
  }

  /** Whether the map contains the given value. */
  hasValue(value: V): boolean {
    return this.#reverse.has(value);
  }

  /** Delete by key. Returns true if the key existed. */
  delete(key: K): boolean {
    if (!this.#forward.has(key)) return false;
    const value = this.#forward.get(key)!;
    this.#forward.delete(key);
    this.#reverse.delete(value);
    return true;
  }

  /** Delete by value. Returns true if the value existed. */
  deleteValue(value: V): boolean {
    if (!this.#reverse.has(value)) return false;
    const key = this.#reverse.get(value)!;
    this.#reverse.delete(value);
    this.#forward.delete(key);
    return true;
  }

  /** Number of entries in the map. */
  get size(): number {
    return this.#forward.size;
  }

  /** Remove all entries. */
  clear(): void {
    this.#forward.clear();
    this.#reverse.clear();
  }

  /** All keys. */
  keys(): K[] {
    return [...this.#forward.keys()];
  }

  /** All values. */
  values(): V[] {
    return [...this.#forward.values()];
  }

  /** All entries as [key, value] pairs. */
  entries(): [K, V][] {
    return [...this.#forward.entries()];
  }

  /** Return a new BiMap with keys and values swapped. */
  inverse(): BiMap<V, K> {
    return new BiMap<V, K>([...this.#reverse.entries()]);
  }

  /** Iterate over [key, value] pairs. */
  [Symbol.iterator](): Iterator<[K, V]> {
    return this.#forward.entries();
  }
}

/** Factory function to create a BiMap. */
export function createBiMap<K, V>(entries?: [K, V][]): BiMap<K, V> {
  return new BiMap<K, V>(entries);
}
