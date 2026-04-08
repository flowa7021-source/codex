// @ts-check
// ─── Cache Manager ───────────────────────────────────────────────────────────
// LRU cache and TTL cache implementations for in-memory caching of page
// renders, OCR results, and other frequently-reused computed values.

// ─── LRUCache ────────────────────────────────────────────────────────────────

/**
 * An LRU (Least Recently Used) cache with a configurable size limit.
 *
 * Uses a Map for O(1) access and insertion-order tracking. On each `get`,
 * the entry is moved to the end of the Map (most-recently-used position).
 * When capacity is exceeded, the first entry (least-recently-used) is evicted.
 *
 * @template K - Key type (default: string)
 * @template V - Value type (default: unknown)
 *
 * @example
 *   const cache = new LRUCache<string, ArrayBuffer>(50);
 *   cache.set('page:1', buffer);
 *   const buf = cache.get('page:1'); // moves to MRU position
 */
export class LRUCache<K = string, V = unknown> {
  readonly capacity: number;
  #map: Map<K, V>;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('LRUCache capacity must be >= 1');
    this.capacity = capacity;
    this.#map = new Map<K, V>();
  }

  /**
   * Get a cached value. Returns `undefined` if not found.
   * Promotes the entry to the most-recently-used position.
   */
  get(key: K): V | undefined {
    if (!this.#map.has(key)) return undefined;
    // Move to end (most recently used)
    const value = this.#map.get(key) as V;
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  /**
   * Set a value. Evicts the LRU (oldest-accessed) entry if at capacity.
   */
  set(key: K, value: V): this {
    if (this.#map.has(key)) {
      // Remove first so re-insertion moves it to MRU position
      this.#map.delete(key);
    } else if (this.#map.size >= this.capacity) {
      // Evict least-recently-used (first entry in Map)
      const lruKey = this.#map.keys().next().value as K;
      this.#map.delete(lruKey);
    }
    this.#map.set(key, value);
    return this;
  }

  /**
   * Check if a key exists in the cache (does not update access order).
   */
  has(key: K): boolean {
    return this.#map.has(key);
  }

  /**
   * Delete a specific key. Returns `true` if the key existed.
   */
  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.#map.clear();
  }

  /**
   * Current number of cached entries.
   */
  get size(): number {
    return this.#map.size;
  }

  /**
   * Get all keys in LRU order (least recently used first).
   */
  keys(): K[] {
    return [...this.#map.keys()];
  }

  /**
   * Get all values in LRU order (least recently used first).
   */
  values(): V[] {
    return [...this.#map.values()];
  }
}

// ─── TTLCache ─────────────────────────────────────────────────────────────────

interface TTLEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * An LRU cache where each entry carries a TTL (time-to-live).
 * Expired entries are treated as cache misses on `get` and `has`.
 *
 * Internally wraps an {@link LRUCache} that stores `{ value, expiresAt }` pairs.
 * Expired entries are lazily evicted on access — no background timer is used.
 *
 * @template K - Key type (default: string)
 * @template V - Value type (default: unknown)
 *
 * @example
 *   const cache = new TTLCache<string, string>({ ttlMs: 5000, capacity: 100 });
 *   cache.set('key', 'value');
 *   cache.get('key'); // 'value' within 5 s, undefined after
 */
export class TTLCache<K = string, V = unknown> {
  readonly #inner: LRUCache<K, TTLEntry<V>>;
  readonly #ttlMs: number;

  constructor(options: { capacity?: number; ttlMs: number }) {
    this.#ttlMs = options.ttlMs;
    this.#inner = new LRUCache<K, TTLEntry<V>>(options.capacity ?? 256);
  }

  /**
   * Get a cached value. Returns `undefined` if not found or expired.
   * An expired entry is deleted from the cache on access.
   */
  get(key: K): V | undefined {
    const entry = this.#inner.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.#inner.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Set a value. Evicts the LRU entry if at capacity.
   */
  set(key: K, value: V): this {
    this.#inner.set(key, { value, expiresAt: Date.now() + this.#ttlMs });
    return this;
  }

  /**
   * Check if a key exists and has not expired.
   * An expired entry is deleted from the cache on access.
   */
  has(key: K): boolean {
    const entry = this.#inner.get(key);
    if (entry === undefined) return false;
    if (Date.now() >= entry.expiresAt) {
      this.#inner.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key. Returns `true` if the key existed.
   */
  delete(key: K): boolean {
    return this.#inner.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.#inner.clear();
  }

  /**
   * Current number of stored entries (including any not-yet-evicted expired ones).
   */
  get size(): number {
    return this.#inner.size;
  }
}
