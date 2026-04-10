// ─── Cache Strategies ────────────────────────────────────────────────────────
// Higher-level cache strategies built on top of primitive caches.
//   TTLCache      — per-entry time-to-live with lazy expiry and eager prune
//   WriteThrough  — keeps an LRUCache and a backing Map in sync on every write

import { LRUCache } from './lru-cache.js';

// ─── TTLCache ────────────────────────────────────────────────────────────────

interface TTLEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Cache with per-entry Time-To-Live expiry.
 *
 * Expired entries are lazily evicted on `get` / `has`. Call `prune()` to
 * eagerly remove all stale entries.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const cache = new TTLCache<string, string>(5_000);
 *   cache.set('k', 'v');
 *   cache.get('k'); // 'v' within 5 s, undefined after
 */
export class TTLCache<K, V> {
  #defaultTtlMs: number;
  #map: Map<K, TTLEntry<V>>;

  constructor(defaultTtlMs: number) {
    this.#defaultTtlMs = defaultTtlMs;
    this.#map = new Map();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Store a value with an optional per-entry TTL (ms).
   * Falls back to the instance default when `ttlMs` is not provided.
   */
  set(key: K, value: V, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.#defaultTtlMs);
    this.#map.set(key, { value, expiresAt });
  }

  /**
   * Get a value if it exists and has not expired.
   * Returns `undefined` for missing or expired entries; lazily removes expired.
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
   * Delete a key regardless of expiry. Returns `true` if it was present.
   */
  delete(key: K): boolean {
    return this.#map.delete(key);
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
}

// ─── WriteThrough ────────────────────────────────────────────────────────────

/**
 * Write-through cache layer that keeps an LRUCache and a backing Map in sync.
 *
 * Every `set` writes to both the cache and the store. Every `delete` removes
 * from both. Reads check the cache first, falling back to the store.
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 *   const store = new Map<string, number>();
 *   const cache = new LRUCache<string, number>(100);
 *   const wt = new WriteThrough(cache, store);
 *   wt.set('x', 42);   // written to both
 *   wt.get('x');       // 42
 */
export class WriteThrough<K, V> {
  #cache: LRUCache<K, V>;
  #store: Map<K, V>;

  constructor(cache: LRUCache<K, V>, store: Map<K, V>) {
    this.#cache = cache;
    this.#store = store;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Retrieve a value. Checks the cache first; falls back to the store.
   * If found in the store but not the cache, warms the cache entry.
   */
  get(key: K): V | undefined {
    const cached = this.#cache.get(key);
    if (cached !== undefined) return cached;
    const stored = this.#store.get(key);
    if (stored !== undefined) {
      this.#cache.set(key, stored);
    }
    return stored;
  }

  /**
   * Write a value to both the cache and the backing store.
   */
  set(key: K, value: V): void {
    this.#cache.set(key, value);
    this.#store.set(key, value);
  }

  /**
   * Remove a key from both the cache and the backing store.
   * Returns `true` if the key was present in either.
   */
  delete(key: K): boolean {
    const inCache = this.#cache.delete(key);
    const inStore = this.#store.delete(key);
    return inCache || inStore;
  }
}
