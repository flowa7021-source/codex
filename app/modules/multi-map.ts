// @ts-check
// ─── MultiMap ───────────────────────────────────────────────────────────────
// A map where each key can have multiple values.

/**
 * A map that associates each key with a collection of values.
 *
 * @example
 *   const mm = new MultiMap<string, number>();
 *   mm.set('a', 1);
 *   mm.set('a', 2);
 *   mm.get('a');  // [1, 2]
 *   mm.size;      // 2
 *   mm.keyCount;  // 1
 */
export class MultiMap<K, V> {
  #map = new Map<K, V[]>();

  /** Add a value to the key's collection. */
  set(key: K, value: V): void {
    const existing = this.#map.get(key);
    if (existing) {
      existing.push(value);
    } else {
      this.#map.set(key, [value]);
    }
  }

  /** Get all values for a key. Returns an empty array if the key has no values. */
  get(key: K): V[] {
    return this.#map.get(key)?.slice() ?? [];
  }

  /** Whether the map contains at least one value for the key. */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /** Whether the map contains a specific key-value pair. */
  hasEntry(key: K, value: V): boolean {
    const values = this.#map.get(key);
    return values !== undefined && values.includes(value);
  }

  /** Remove all values for a key. Returns true if the key existed. */
  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  /** Remove a specific value from a key. Returns true if the entry existed. */
  deleteEntry(key: K, value: V): boolean {
    const values = this.#map.get(key);
    if (!values) return false;
    const idx = values.indexOf(value);
    if (idx === -1) return false;
    values.splice(idx, 1);
    if (values.length === 0) {
      this.#map.delete(key);
    }
    return true;
  }

  /** Total number of entries (sum of all values across all keys). */
  get size(): number {
    let total = 0;
    for (const values of this.#map.values()) {
      total += values.length;
    }
    return total;
  }

  /** Number of distinct keys. */
  get keyCount(): number {
    return this.#map.size;
  }

  /** Remove all entries. */
  clear(): void {
    this.#map.clear();
  }

  /** All distinct keys. */
  keys(): K[] {
    return [...this.#map.keys()];
  }

  /** Flat list of all [key, value] pairs. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    for (const [key, values] of this.#map) {
      for (const value of values) {
        result.push([key, value]);
      }
    }
    return result;
  }

  /** Iterate over [key, values[]] pairs. */
  [Symbol.iterator](): Iterator<[K, V[]]> {
    return this.#map.entries();
  }
}

/** Factory function to create a MultiMap. */
export function createMultiMap<K, V>(): MultiMap<K, V> {
  return new MultiMap<K, V>();
}
