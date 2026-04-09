// @ts-check
// ─── TTL Map ────────────────────────────────────────────────────────────────
// Map with per-key Time-To-Live expiry. Expired entries are lazily evicted on
// access; call cleanup() to eagerly remove all stale entries. An injectable
// clock function makes testing deterministic.
//
// Differs from TTLCache by requiring a mandatory defaultTTL, exposing ttlOf(),
// cleanup() returning a count, and accepting a clock option instead of relying
// on Date.now().

export interface TTLMapOptions {
  /** Custom clock function. Defaults to `Date.now`. */
  clock?: () => number;
}

interface TTLEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Map with per-key Time-To-Live (TTL) expiry.
 *
 * Expired entries are treated as misses on `get` / `has` and lazily removed.
 * Call `cleanup()` to eagerly delete all stale entries and learn how many were
 * removed.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const map = new TTLMap<string, Response>(30_000);
 *   map.set('url', response);
 *   map.get('url');   // response within 30 s, undefined after
 *   map.ttlOf('url'); // remaining ms (or undefined if missing)
 */
export class TTLMap<K, V> {
  readonly #defaultTTL: number;
  readonly #clock: () => number;
  #map: Map<K, TTLEntry<V>>;

  constructor(defaultTTL: number, options?: TTLMapOptions) {
    if (defaultTTL <= 0) throw new RangeError('TTLMap defaultTTL must be > 0');
    this.#defaultTTL = defaultTTL;
    this.#clock = options?.clock ?? Date.now;
    this.#map = new Map();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Return true when an entry has expired according to the current clock. */
  #isExpired(entry: TTLEntry<V>): boolean {
    return this.#clock() >= entry.expiresAt;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Store a value with an optional custom TTL (ms).
   * Falls back to the instance default when `ttl` is not provided.
   */
  set(key: K, value: V, ttl?: number): void {
    const ms = ttl ?? this.#defaultTTL;
    this.#map.set(key, { value, expiresAt: this.#clock() + ms });
  }

  /**
   * Get a value. Returns `undefined` if not present or expired.
   * Lazily removes the entry when expired.
   */
  get(key: K): V | undefined {
    const entry = this.#map.get(key);
    if (entry === undefined) return undefined;
    if (this.#isExpired(entry)) {
      this.#map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Check whether a key exists and is not expired. */
  has(key: K): boolean {
    const entry = this.#map.get(key);
    if (entry === undefined) return false;
    if (this.#isExpired(entry)) {
      this.#map.delete(key);
      return false;
    }
    return true;
  }

  /** Delete a key. Returns `true` if the key was present (even if expired). */
  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  /** Number of non-expired entries. */
  get size(): number {
    let count = 0;
    for (const entry of this.#map.values()) {
      if (!this.#isExpired(entry)) count++;
    }
    return count;
  }

  /** Remove all entries. */
  clear(): void {
    this.#map.clear();
  }

  /**
   * Eagerly remove every expired entry.
   * @returns The number of entries removed.
   */
  cleanup(): number {
    let removed = 0;
    for (const [key, entry] of this.#map) {
      if (this.#isExpired(entry)) {
        this.#map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** Keys of non-expired entries (in insertion order). */
  keys(): K[] {
    const result: K[] = [];
    for (const [key, entry] of this.#map) {
      if (!this.#isExpired(entry)) result.push(key);
    }
    return result;
  }

  /** Entries that are not expired (in insertion order). */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    for (const [key, entry] of this.#map) {
      if (!this.#isExpired(entry)) result.push([key, entry.value]);
    }
    return result;
  }

  /**
   * Remaining TTL in milliseconds for a key, or `undefined` if the key is
   * missing or already expired.
   */
  ttlOf(key: K): number | undefined {
    const entry = this.#map.get(key);
    if (entry === undefined) return undefined;
    const remaining = entry.expiresAt - this.#clock();
    if (remaining <= 0) {
      this.#map.delete(key);
      return undefined;
    }
    return remaining;
  }
}

/**
 * Factory that creates a new {@link TTLMap} instance.
 *
 * @template K - Key type
 * @template V - Value type
 */
export function createTTLMap<K, V>(defaultTTL: number, options?: TTLMapOptions): TTLMap<K, V> {
  return new TTLMap<K, V>(defaultTTL, options);
}
