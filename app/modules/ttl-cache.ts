// @ts-check
// ─── TTL Cache ───────────────────────────────────────────────────────────────
// Cache with per-entry Time-To-Live expiry. Expired entries are lazily evicted
// on access; call prune() to eagerly remove them. When maxSize is set, the
// oldest-inserted entry (by insertion order) is evicted when the limit is hit.

export interface TTLCacheOptions {
  /** Default TTL in milliseconds. Default 60000 (1 minute). */
  defaultTTL?: number;
  /** Max entries. Default unlimited. */
  maxSize?: number;
}

interface TTLEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Cache with per-entry Time-To-Live (TTL) expiry.
 *
 * Expired entries are treated as cache misses on `get` / `has` and lazily
 * removed. Call `prune()` to eagerly delete all stale entries. When `maxSize`
 * is configured, the oldest-inserted entry is evicted first.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const cache = new TTLCache<string, Response>({ defaultTTL: 30_000, maxSize: 200 });
 *   cache.set('url', response);
 *   cache.get('url'); // response within 30 s, undefined after
 */
export class TTLCache<K, V> {
  readonly #defaultTTL: number;
  readonly #maxSize: number;
  // Insertion-order Map so eviction of oldest entry is O(1).
  #map: Map<K, TTLEntry<V>>;

  constructor(options?: TTLCacheOptions) {
    this.#defaultTTL = options?.defaultTTL ?? 60_000;
    this.#maxSize = options?.maxSize ?? Infinity;
    this.#map = new Map();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Store a value with an optional custom TTL (ms).
   * Falls back to the instance default when `ttl` is not provided.
   * If at maxSize, the oldest entry (by insertion order) is evicted first.
   */
  set(key: K, value: V, ttl?: number): void {
    // If the key already exists, delete it first so re-insertion moves it to
    // the "newest" position in the Map's insertion order.
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.#maxSize) {
      // Evict oldest entry (first key in insertion order).
      const oldestKey = this.#map.keys().next().value as K;
      this.#map.delete(oldestKey);
    }
    const expiresAt = Date.now() + (ttl ?? this.#defaultTTL);
    this.#map.set(key, { value, expiresAt });
  }

  /**
   * Get a value if it exists and has not expired.
   * Returns `undefined` for missing or expired entries. An expired entry is
   * lazily removed from the cache on access.
   */
  get(key: K): V | undefined {
    const entry = this.#map.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.#map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Returns `true` if the key exists and has not expired.
   * Lazily removes the entry if it has expired.
   */
  has(key: K): boolean {
    const entry = this.#map.get(key);
    if (entry === undefined) return false;
    if (Date.now() >= entry.expiresAt) {
      this.#map.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a key. Returns `true` if it was present (even if expired).
   */
  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  /** Remove all entries. */
  clear(): void {
    this.#map.clear();
  }

  /**
   * Eagerly remove all expired entries.
   * @returns The number of entries removed.
   */
  prune(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.#map) {
      if (now >= entry.expiresAt) {
        this.#map.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Current number of stored entries (including not-yet-evicted expired ones).
   */
  get size(): number {
    return this.#map.size;
  }

  /**
   * Get the remaining TTL for a key in milliseconds.
   * Returns `-1` if the key does not exist, `0` if the entry is expired.
   */
  ttlRemaining(key: K): number {
    const entry = this.#map.get(key);
    if (entry === undefined) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}
