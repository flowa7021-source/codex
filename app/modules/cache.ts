// @ts-check
// ─── Cache Eviction Strategies ───────────────────────────────────────────────
// LRU, LFU, FIFO, and Write-Through cache implementations.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheOptions {
  maxSize: number;
  ttl?: number; // time-to-live in ms (optional)
}

// ─── LRUCache ────────────────────────────────────────────────────────────────

/** Least Recently Used cache. */
export class LRUCache<K, V> {
  #maxSize: number;
  #ttl: number | undefined;
  #map: Map<K, { value: V; expiry: number | undefined }> = new Map();
  #now: number = Date.now();

  constructor(options: CacheOptions) {
    this.#maxSize = options.maxSize;
    this.#ttl = options.ttl;
  }

  #currentTime(): number {
    return this.#now;
  }

  #isExpired(expiry: number | undefined): boolean {
    if (expiry === undefined) return false;
    return this.#currentTime() >= expiry;
  }

  get(key: K): V | undefined {
    const entry = this.#map.get(key);
    if (entry === undefined) return undefined;
    if (this.#isExpired(entry.expiry)) {
      this.#map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.#map.delete(key);
    this.#map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Remove existing entry to update its position
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.#maxSize) {
      // Evict the least recently used (first entry in map)
      const lruKey = this.#map.keys().next().value as K;
      this.#map.delete(lruKey);
    }
    const expiry = this.#ttl !== undefined ? this.#currentTime() + this.#ttl : undefined;
    this.#map.set(key, { value, expiry });
  }

  has(key: K): boolean {
    const entry = this.#map.get(key);
    if (entry === undefined) return false;
    if (this.#isExpired(entry.expiry)) {
      this.#map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  clear(): void {
    this.#map.clear();
  }

  get size(): number {
    // Prune expired entries
    for (const [key, entry] of this.#map) {
      if (this.#isExpired(entry.expiry)) {
        this.#map.delete(key);
      }
    }
    return this.#map.size;
  }

  get maxSize(): number {
    return this.#maxSize;
  }

  /** All entries in order from MRU to LRU. */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    const entries = [...this.#map.entries()].reverse();
    for (const [key, entry] of entries) {
      if (!this.#isExpired(entry.expiry)) {
        result.push([key, entry.value]);
      }
    }
    return result;
  }

  /** Advance internal clock by ms (for TTL testing). */
  advance(ms: number): void {
    this.#now += ms;
  }
}

// ─── LFUCache ────────────────────────────────────────────────────────────────

/** Least Frequently Used cache. */
export class LFUCache<K, V> {
  #maxSize: number;
  #ttl: number | undefined;
  #values: Map<K, V> = new Map();
  #freqs: Map<K, number> = new Map();
  #expiries: Map<K, number | undefined> = new Map();
  #now: number = Date.now();

  constructor(options: CacheOptions) {
    this.#maxSize = options.maxSize;
    this.#ttl = options.ttl;
  }

  #currentTime(): number {
    return this.#now;
  }

  #isExpired(key: K): boolean {
    const expiry = this.#expiries.get(key);
    if (expiry === undefined) return false;
    return this.#currentTime() >= expiry;
  }

  #evictExpired(): void {
    for (const key of this.#values.keys()) {
      if (this.#isExpired(key)) {
        this.#values.delete(key);
        this.#freqs.delete(key);
        this.#expiries.delete(key);
      }
    }
  }

  get(key: K): V | undefined {
    if (!this.#values.has(key)) return undefined;
    if (this.#isExpired(key)) {
      this.#values.delete(key);
      this.#freqs.delete(key);
      this.#expiries.delete(key);
      return undefined;
    }
    this.#freqs.set(key, (this.#freqs.get(key) ?? 0) + 1);
    return this.#values.get(key);
  }

  set(key: K, value: V): void {
    if (this.#values.has(key)) {
      this.#values.set(key, value);
      this.#freqs.set(key, (this.#freqs.get(key) ?? 0) + 1);
      const expiry = this.#ttl !== undefined ? this.#currentTime() + this.#ttl : undefined;
      this.#expiries.set(key, expiry);
      return;
    }

    this.#evictExpired();

    if (this.#values.size >= this.#maxSize) {
      // Evict the least frequently used key (ties broken by insertion order)
      let minFreq = Infinity;
      let evictKey: K | undefined;
      for (const [k, freq] of this.#freqs) {
        if (freq < minFreq) {
          minFreq = freq;
          evictKey = k;
        }
      }
      if (evictKey !== undefined) {
        this.#values.delete(evictKey);
        this.#freqs.delete(evictKey);
        this.#expiries.delete(evictKey);
      }
    }

    this.#values.set(key, value);
    this.#freqs.set(key, 1);
    const expiry = this.#ttl !== undefined ? this.#currentTime() + this.#ttl : undefined;
    this.#expiries.set(key, expiry);
  }

  has(key: K): boolean {
    if (!this.#values.has(key)) return false;
    if (this.#isExpired(key)) {
      this.#values.delete(key);
      this.#freqs.delete(key);
      this.#expiries.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    if (!this.#values.has(key)) return false;
    this.#values.delete(key);
    this.#freqs.delete(key);
    this.#expiries.delete(key);
    return true;
  }

  clear(): void {
    this.#values.clear();
    this.#freqs.clear();
    this.#expiries.clear();
  }

  get size(): number {
    this.#evictExpired();
    return this.#values.size;
  }

  /** Frequency of access for a key. */
  frequency(key: K): number {
    return this.#freqs.get(key) ?? 0;
  }

  /** Advance internal clock by ms (for TTL testing). */
  advance(ms: number): void {
    this.#now += ms;
  }
}

// ─── FIFOCache ───────────────────────────────────────────────────────────────

/** First In First Out cache. */
export class FIFOCache<K, V> {
  #maxSize: number;
  #ttl: number | undefined;
  #map: Map<K, { value: V; expiry: number | undefined }> = new Map();
  #now: number = Date.now();

  constructor(options: CacheOptions) {
    this.#maxSize = options.maxSize;
    this.#ttl = options.ttl;
  }

  #currentTime(): number {
    return this.#now;
  }

  #isExpired(expiry: number | undefined): boolean {
    if (expiry === undefined) return false;
    return this.#currentTime() >= expiry;
  }

  get(key: K): V | undefined {
    const entry = this.#map.get(key);
    if (entry === undefined) return undefined;
    if (this.#isExpired(entry.expiry)) {
      this.#map.delete(key);
      return undefined;
    }
    // FIFO: no position update on access
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) {
      // Update in place without changing insertion order
      const existing = this.#map.get(key)!;
      existing.value = value;
      if (this.#ttl !== undefined) {
        existing.expiry = this.#currentTime() + this.#ttl;
      }
      return;
    }

    if (this.#map.size >= this.#maxSize) {
      // Evict oldest (first inserted)
      const firstKey = this.#map.keys().next().value as K;
      this.#map.delete(firstKey);
    }
    const expiry = this.#ttl !== undefined ? this.#currentTime() + this.#ttl : undefined;
    this.#map.set(key, { value, expiry });
  }

  has(key: K): boolean {
    const entry = this.#map.get(key);
    if (entry === undefined) return false;
    if (this.#isExpired(entry.expiry)) {
      this.#map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.#map.delete(key);
  }

  clear(): void {
    this.#map.clear();
  }

  get size(): number {
    // Prune expired entries
    for (const [key, entry] of this.#map) {
      if (this.#isExpired(entry.expiry)) {
        this.#map.delete(key);
      }
    }
    return this.#map.size;
  }

  /** Advance internal clock by ms (for TTL testing). */
  advance(ms: number): void {
    this.#now += ms;
  }
}

// ─── WriteThroughCache ───────────────────────────────────────────────────────

/** Write-through cache with a backing store. */
export class WriteThroughCache<K, V> {
  #maxSize: number;
  #cache: Map<K, V> = new Map();
  #store: Map<K, V>;

  constructor(options: CacheOptions, store: Map<K, V>) {
    this.#maxSize = options.maxSize;
    this.#store = store;
  }

  get(key: K): V | undefined {
    if (this.#cache.has(key)) return this.#cache.get(key);
    if (this.#store.has(key)) {
      const value = this.#store.get(key) as V;
      // Load into cache (evict if needed)
      if (this.#cache.size >= this.#maxSize) {
        const oldestKey = this.#cache.keys().next().value as K;
        this.#cache.delete(oldestKey);
      }
      this.#cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    // Write to backing store first
    this.#store.set(key, value);
    // Update cache
    if (this.#cache.has(key)) {
      this.#cache.set(key, value);
    } else {
      if (this.#cache.size >= this.#maxSize) {
        const oldestKey = this.#cache.keys().next().value as K;
        this.#cache.delete(oldestKey);
      }
      this.#cache.set(key, value);
    }
  }

  has(key: K): boolean {
    return this.#cache.has(key) || this.#store.has(key);
  }

  delete(key: K): boolean {
    const inCache = this.#cache.delete(key);
    const inStore = this.#store.delete(key);
    return inCache || inStore;
  }

  get size(): number {
    return this.#cache.size;
  }
}
