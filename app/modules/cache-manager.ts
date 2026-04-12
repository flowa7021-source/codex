// @ts-check
// ─── Cache Manager ────────────────────────────────────────────────────────────
// Flexible in-memory cache with LRU, LFU, and FIFO eviction strategies,
// optional TTL expiry, per-entry TTL overrides, stats, and bulk operations.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheOptions {
  /** Maximum number of entries before eviction (default: Infinity). */
  maxSize?: number;
  /** Time-to-live in ms. null means no expiry (default: null). */
  ttl?: number | null;
  /** Eviction strategy when maxSize is exceeded (default: 'lru'). */
  strategy?: 'lru' | 'lfu' | 'fifo';
  /** Called whenever an entry is evicted (not on manual delete/clear). */
  onEvict?: (key: string, value: unknown) => void;
}

interface InternalEntry<V> {
  value: V;
  /** Absolute expiry timestamp in ms, or null for no expiry. */
  expiresAt: number | null;
  /** Insertion order counter for FIFO. */
  insertOrder: number;
  /** Access count for LFU. */
  frequency: number;
  /** Last-access timestamp for LRU. */
  lastAccess: number;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

export class Cache<V = unknown> {
  #store: Map<string, InternalEntry<V>>;
  #maxSize: number;
  #defaultTtl: number | null;
  #strategy: 'lru' | 'lfu' | 'fifo';
  #onEvict: ((key: string, value: unknown) => void) | undefined;
  /** Monotonically increasing clock used for both insertOrder and lastAccess. */
  #clock: number;
  #hits: number;
  #misses: number;
  #evictions: number;

  constructor(options?: CacheOptions) {
    this.#store = new Map();
    this.#maxSize = options?.maxSize ?? Infinity;
    this.#defaultTtl = options?.ttl ?? null;
    this.#strategy = options?.strategy ?? 'lru';
    this.#onEvict = options?.onEvict;
    this.#clock = 0;
    this.#hits = 0;
    this.#misses = 0;
    this.#evictions = 0;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Current number of non-expired entries. */
  get size(): number {
    this.#pruneExpired();
    return this.#store.size;
  }

  /** Maximum number of entries allowed. */
  get maxSize(): number {
    return this.#maxSize;
  }

  /** Eviction strategy in use. */
  get strategy(): string {
    return this.#strategy;
  }

  // ─── Core API ───────────────────────────────────────────────────────────────

  /**
   * Store a value. An optional per-entry `ttl` (ms) overrides the cache-level
   * default for this entry only.
   */
  set(key: string, value: V, ttl?: number): void {
    // Remove existing entry first to allow re-insertion.
    if (this.#store.has(key)) {
      this.#store.delete(key);
    }

    // Evict if at capacity before inserting.
    if (this.#store.size >= this.#maxSize) {
      this.#evictOne();
    }

    const resolvedTtl = ttl !== undefined ? ttl : this.#defaultTtl;
    const expiresAt = resolvedTtl !== null ? Date.now() + resolvedTtl : null;

    const now = this.#clock++;
    this.#store.set(key, {
      value,
      expiresAt,
      insertOrder: now,
      frequency: 1,
      lastAccess: now,
    });
  }

  /**
   * Retrieve a value by key. Returns `undefined` if the key does not exist or
   * has expired.
   */
  get(key: string): V | undefined {
    const entry = this.#store.get(key);
    if (!entry) {
      this.#misses++;
      return undefined;
    }

    if (this.#isExpired(entry)) {
      this.#store.delete(key);
      this.#misses++;
      return undefined;
    }

    // Update access metadata using a monotonic clock for stable ordering.
    entry.frequency++;
    entry.lastAccess = this.#clock++;
    this.#hits++;
    return entry.value;
  }

  /** Returns true if the key exists and has not expired. */
  has(key: string): boolean {
    const entry = this.#store.get(key);
    if (!entry) return false;
    if (this.#isExpired(entry)) {
      this.#store.delete(key);
      return false;
    }
    return true;
  }

  /** Remove a single entry. Returns true if the entry existed. */
  delete(key: string): boolean {
    return this.#store.delete(key);
  }

  /** Remove all entries without triggering onEvict callbacks. */
  clear(): void {
    this.#store.clear();
  }

  // ─── Iteration ──────────────────────────────────────────────────────────────

  /** Returns all non-expired keys. */
  keys(): string[] {
    this.#pruneExpired();
    return Array.from(this.#store.keys());
  }

  /** Returns all non-expired values. */
  values(): V[] {
    this.#pruneExpired();
    return Array.from(this.#store.values()).map((e) => e.value);
  }

  /** Returns all non-expired [key, value] pairs. */
  entries(): Array<[string, V]> {
    this.#pruneExpired();
    return Array.from(this.#store.entries()).map(([k, e]) => [k, e.value]);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  /** Returns accumulated hit/miss/eviction counts and current size. */
  getStats(): { hits: number; misses: number; evictions: number; size: number } {
    return {
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
      size: this.size,
    };
  }

  /** Reset hit/miss/eviction counters to zero. */
  resetStats(): void {
    this.#hits = 0;
    this.#misses = 0;
    this.#evictions = 0;
  }

  // ─── Bulk Operations ────────────────────────────────────────────────────────

  /** Set multiple entries at once. */
  mset(entries: Array<[string, V]>): void {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /** Get multiple values at once. Missing / expired entries return undefined. */
  mget(keys: string[]): Array<V | undefined> {
    return keys.map((k) => this.get(k));
  }

  /** Delete multiple entries. Returns the count of entries that were deleted. */
  mdelete(keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.#store.delete(key)) count++;
    }
    return count;
  }

  // ─── Pruning ────────────────────────────────────────────────────────────────

  /** Manually remove all expired entries. Returns the count removed. */
  prune(): number {
    return this.#pruneExpired();
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  #isExpired(entry: InternalEntry<V>): boolean {
    return entry.expiresAt !== null && Date.now() >= entry.expiresAt;
  }

  /** Remove all expired entries and return the count removed. */
  #pruneExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.#store) {
      if (this.#isExpired(entry)) {
        this.#store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** Evict one entry according to the current strategy. */
  #evictOne(): void {
    if (this.#store.size === 0) return;

    let victimKey: string | null = null;

    if (this.#strategy === 'fifo') {
      // Evict the entry with the smallest insertOrder.
      let minOrder = Infinity;
      for (const [key, entry] of this.#store) {
        if (entry.insertOrder < minOrder) {
          minOrder = entry.insertOrder;
          victimKey = key;
        }
      }
    } else if (this.#strategy === 'lfu') {
      // Evict the entry with the lowest frequency.
      // Ties broken by oldest lastAccess, then by oldest insertOrder.
      let minFreq = Infinity;
      let minAccess = Infinity;
      let minOrder = Infinity;
      for (const [key, entry] of this.#store) {
        if (
          entry.frequency < minFreq ||
          (entry.frequency === minFreq && entry.lastAccess < minAccess) ||
          (entry.frequency === minFreq && entry.lastAccess === minAccess && entry.insertOrder < minOrder)
        ) {
          minFreq = entry.frequency;
          minAccess = entry.lastAccess;
          minOrder = entry.insertOrder;
          victimKey = key;
        }
      }
    } else {
      // LRU: evict the entry with the oldest lastAccess.
      // Ties broken by insertOrder (oldest insert is evicted first).
      let minAccess = Infinity;
      let minOrder = Infinity;
      for (const [key, entry] of this.#store) {
        if (
          entry.lastAccess < minAccess ||
          (entry.lastAccess === minAccess && entry.insertOrder < minOrder)
        ) {
          minAccess = entry.lastAccess;
          minOrder = entry.insertOrder;
          victimKey = key;
        }
      }
    }

    if (victimKey !== null) {
      const entry = this.#store.get(victimKey)!;
      this.#store.delete(victimKey);
      this.#evictions++;
      this.#onEvict?.(victimKey, entry.value);
    }
  }
}

// ─── Factories ────────────────────────────────────────────────────────────────

/** Create a cache with the given options. */
export function createCache<V>(options?: CacheOptions): Cache<V> {
  return new Cache<V>(options);
}

/** Create an LRU cache with a fixed maximum size and optional TTL. */
export function createLRUCache<V>(maxSize: number, ttl?: number): Cache<V> {
  return new Cache<V>({ maxSize, ttl: ttl ?? null, strategy: 'lru' });
}

/** Create an LFU cache with a fixed maximum size. */
export function createLFUCache<V>(maxSize: number): Cache<V> {
  return new Cache<V>({ maxSize, strategy: 'lfu' });
}

/** Create a TTL-only cache where every entry expires after `ttl` ms. */
export function createTTLCache<V>(ttl: number): Cache<V> {
  return new Cache<V>({ ttl, strategy: 'lru' });
}

// ─── Legacy exports (kept for backward compatibility) ─────────────────────────

export class LRUCache<K = string, V = unknown> {
  readonly capacity: number;
  #map: Map<K, V>;

  constructor(capacity: number) {
    if (capacity < 1) throw new RangeError('LRUCache capacity must be >= 1');
    this.capacity = capacity;
    this.#map = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key) as V;
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.capacity) {
      const lruKey = this.#map.keys().next().value as K;
      this.#map.delete(lruKey);
    }
    this.#map.set(key, value);
    return this;
  }

  has(key: K): boolean {
    return this.#map.has(key);
  }

  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  clear(): void {
    this.#map.clear();
  }

  get size(): number {
    return this.#map.size;
  }

  keys(): K[] {
    return [...this.#map.keys()];
  }

  values(): V[] {
    return [...this.#map.values()];
  }
}

interface TTLEntry<V> {
  value: V;
  expiresAt: number;
}

export class TTLCache<K = string, V = unknown> {
  readonly #inner: LRUCache<K, TTLEntry<V>>;
  readonly #ttlMs: number;

  constructor(options: { capacity?: number; ttlMs: number }) {
    this.#ttlMs = options.ttlMs;
    this.#inner = new LRUCache<K, TTLEntry<V>>(options.capacity ?? 256);
  }

  get(key: K): V | undefined {
    const entry = this.#inner.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.#inner.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): this {
    this.#inner.set(key, { value, expiresAt: Date.now() + this.#ttlMs });
    return this;
  }

  has(key: K): boolean {
    const entry = this.#inner.get(key);
    if (entry === undefined) return false;
    if (Date.now() >= entry.expiresAt) {
      this.#inner.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.#inner.delete(key);
  }

  clear(): void {
    this.#inner.clear();
  }

  get size(): number {
    return this.#inner.size;
  }
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
  hits: number;
  size?: number;
}

export interface CacheManagerOptions {
  maxSize?: number;
  defaultTtl?: number;
  onEvict?: (key: string, value: unknown) => void;
}

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

  set(key: string, value: T, ttl?: number): void {
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
    while (this.#store.size > this.#maxSize) {
      const oldestKey = this.#store.keys().next().value as string;
      const oldestEntry = this.#store.get(oldestKey)!;
      this.#store.delete(oldestKey);
      this.#onEvict?.(oldestKey, oldestEntry.value);
    }
  }

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

  delete(key: string): boolean {
    const entry = this.#store.get(key);
    if (entry === undefined) return false;
    this.#store.delete(key);
    this.#onEvict?.(key, entry.value);
    return true;
  }

  clear(): void {
    if (this.#onEvict) {
      for (const [key, entry] of this.#store) {
        this.#onEvict(key, entry.value);
      }
    }
    this.#store.clear();
  }

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

  get size(): number {
    return this.keys().length;
  }

  get hitRate(): number {
    const total = this.#hits + this.#misses;
    if (total === 0) return 0;
    return this.#hits / total;
  }

  memoize<R>(key: string, fn: () => R, ttl?: number): R {
    const existing = this.get(key);
    if (existing !== undefined) {
      return existing as unknown as R;
    }
    const result = fn();
    this.set(key, result as unknown as T, ttl);
    return result;
  }

  #isExpired(entry: CacheEntry<T>): boolean {
    return this.#isExpiredAt(entry, Date.now());
  }

  #isExpiredAt(entry: CacheEntry<T>, now: number): boolean {
    return entry.expiresAt !== undefined && now >= entry.expiresAt;
  }
}
