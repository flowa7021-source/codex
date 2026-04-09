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

// ─── CacheManager ─────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
  hits: number;
  size?: number; // estimated size in bytes
}

export interface CacheManagerOptions {
  maxSize?: number;    // max number of entries, default 500
  defaultTtl?: number; // default TTL ms, default none
  onEvict?: (key: string, value: unknown) => void;
}

/**
 * Multi-layer cache with TTL, size limits, eviction callbacks, hit rate
 * tracking, and memoization support.
 *
 * @template T - Value type (default: unknown)
 *
 * @example
 *   const cache = new CacheManager<string>({ maxSize: 100, defaultTtl: 5000 });
 *   cache.set('key', 'value');
 *   const result = cache.memoize('expensive', () => computeExpensive());
 */
export class CacheManager<T = unknown> {
  #store: Map<string, CacheEntry<T>> = new Map();
  #maxSize: number;
  #defaultTtl: number | undefined;
  #onEvict: ((key: string, value: unknown) => void) | undefined;
  #hits = 0;
  #misses = 0;

  constructor(options?: CacheManagerOptions) {
    this.#maxSize = options?.maxSize ?? 500;
    this.#defaultTtl = options?.defaultTtl;
    this.#onEvict = options?.onEvict;
  }

  /** Store a value. Optionally override the TTL for this entry. */
  set(key: string, value: T, ttl?: number): void {
    // Remove existing entry first to reset insertion order
    if (this.#store.has(key)) {
      this.#store.delete(key);
    }

    const effectiveTtl = ttl ?? this.#defaultTtl;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: effectiveTtl !== undefined ? now + effectiveTtl : undefined,
      hits: 0,
    };

    this.#store.set(key, entry);

    // Evict oldest entries when over capacity
    while (this.#store.size > this.#maxSize) {
      const oldestKey = this.#store.keys().next().value as string;
      const oldestEntry = this.#store.get(oldestKey)!;
      this.#store.delete(oldestKey);
      this.#onEvict?.(oldestKey, oldestEntry.value);
    }
  }

  /** Retrieve a value. Returns undefined if missing or expired. */
  get(key: string): T | undefined {
    const entry = this.#store.get(key);

    if (entry === undefined) {
      this.#misses += 1;
      return undefined;
    }

    if (this.#isExpired(entry)) {
      this.#store.delete(key);
      this.#onEvict?.(key, entry.value);
      this.#misses += 1;
      return undefined;
    }

    entry.hits += 1;
    this.#hits += 1;
    return entry.value;
  }

  /** Check whether a non-expired entry exists for the key. */
  has(key: string): boolean {
    const entry = this.#store.get(key);
    if (entry === undefined) return false;
    if (this.#isExpired(entry)) {
      this.#store.delete(key);
      this.#onEvict?.(key, entry.value);
      return false;
    }
    return true;
  }

  /** Remove an entry. Returns true if the key existed. */
  delete(key: string): boolean {
    const entry = this.#store.get(key);
    if (entry === undefined) return false;
    this.#store.delete(key);
    this.#onEvict?.(key, entry.value);
    return true;
  }

  /** Remove all entries. */
  clear(): void {
    if (this.#onEvict) {
      for (const [key, entry] of this.#store) {
        this.#onEvict(key, entry.value);
      }
    }
    this.#store.clear();
  }

  /** Get entry metadata without incrementing the hit counter. */
  getEntry(key: string): CacheEntry<T> | undefined {
    const entry = this.#store.get(key);
    if (entry === undefined) return undefined;
    if (this.#isExpired(entry)) {
      this.#store.delete(key);
      this.#onEvict?.(key, entry.value);
      return undefined;
    }
    return entry;
  }

  /** Get all non-expired keys. */
  keys(): string[] {
    const now = Date.now();
    const result: string[] = [];
    for (const [key, entry] of this.#store) {
      if (!this.#isExpiredAt(entry, now)) {
        result.push(key);
      }
    }
    return result;
  }

  /** Evict all expired entries. Returns the count of entries evicted. */
  evictExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.#store) {
      if (this.#isExpiredAt(entry, now)) {
        this.#store.delete(key);
        this.#onEvict?.(key, entry.value);
        count += 1;
      }
    }
    return count;
  }

  /** Number of non-expired entries. */
  get size(): number {
    return this.keys().length;
  }

  /** Hit rate: hits / (hits + misses). Returns 0 when no lookups have occurred. */
  get hitRate(): number {
    const total = this.#hits + this.#misses;
    if (total === 0) return 0;
    return this.#hits / total;
  }

  /**
   * Memoize a function — cache the result by key.
   * If the key exists and is not expired, return the cached value.
   * Otherwise call fn, cache the result, and return it.
   */
  memoize<R>(key: string, fn: () => R, ttl?: number): R {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing as unknown as R;
    }
    const result = fn();
    this.set(key, result as unknown as T, ttl);
    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #isExpired(entry: CacheEntry<T>): boolean {
    return this.#isExpiredAt(entry, Date.now());
  }

  #isExpiredAt(entry: CacheEntry<T>, now: number): boolean {
    return entry.expiresAt !== undefined && now >= entry.expiresAt;
  }
}
