// @ts-check
// ─── Key-Value Store ──────────────────────────────────────────────────────────
// Typed in-memory key-value store with namespaces and TTL support.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KVEntry<T> {
  value: T;
  expiresAt?: number;  // timestamp, undefined = no expiry
  createdAt: number;
  updatedAt: number;
}

export interface KVStoreOptions {
  namespace?: string;    // key prefix, default ''
  defaultTTL?: number;   // ms, undefined = no expiry
}

// ─── KVStore ──────────────────────────────────────────────────────────────────

export class KVStore<T = unknown> {
  #store: Map<string, KVEntry<T>> = new Map();
  #namespace: string;
  #defaultTTL: number | undefined;

  constructor(options?: KVStoreOptions) {
    this.#namespace = options?.namespace ?? '';
    this.#defaultTTL = options?.defaultTTL;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  #fullKey(key: string): string {
    return this.#namespace ? `${this.#namespace}:${key}` : key;
  }

  #isExpired(entry: KVEntry<T>): boolean {
    if (entry.expiresAt === undefined) return false;
    return Date.now() >= entry.expiresAt;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Set a key-value pair. Optionally supply a per-key TTL in milliseconds.
   * Falls back to the store's defaultTTL when no TTL is provided.
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const effectiveTTL = ttl ?? this.#defaultTTL;
    const expiresAt = effectiveTTL !== undefined ? now + effectiveTTL : undefined;

    const existing = this.#store.get(this.#fullKey(key));
    const entry: KVEntry<T> = {
      value,
      expiresAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.#store.set(this.#fullKey(key), entry);
  }

  /** Get the value for a key, or undefined if missing or expired. */
  get(key: string): T | undefined {
    const entry = this.#store.get(this.#fullKey(key));
    if (!entry) return undefined;
    if (this.#isExpired(entry)) return undefined;
    return entry.value;
  }

  /** Get the full entry for a key, or undefined if missing or expired. */
  getEntry(key: string): KVEntry<T> | undefined {
    const entry = this.#store.get(this.#fullKey(key));
    if (!entry) return undefined;
    if (this.#isExpired(entry)) return undefined;
    return entry;
  }

  /** Returns true if the key exists and has not expired. */
  has(key: string): boolean {
    const entry = this.#store.get(this.#fullKey(key));
    if (!entry) return false;
    if (this.#isExpired(entry)) return false;
    return true;
  }

  /** Delete a key. Returns true if the key existed (regardless of expiry). */
  delete(key: string): boolean {
    return this.#store.delete(this.#fullKey(key));
  }

  /** Remove all entries from the store. */
  clear(): void {
    this.#store.clear();
  }

  /** Get all non-expired keys (without namespace prefix). */
  keys(): string[] {
    const prefix = this.#namespace ? `${this.#namespace}:` : '';
    const result: string[] = [];
    for (const [fullKey, entry] of this.#store) {
      if (!this.#isExpired(entry)) {
        result.push(prefix ? fullKey.slice(prefix.length) : fullKey);
      }
    }
    return result;
  }

  /** Get all non-expired values. */
  values(): T[] {
    const result: T[] = [];
    for (const entry of this.#store.values()) {
      if (!this.#isExpired(entry)) {
        result.push(entry.value);
      }
    }
    return result;
  }

  /** Get all non-expired [key, value] pairs (keys without namespace prefix). */
  entries(): [string, T][] {
    const prefix = this.#namespace ? `${this.#namespace}:` : '';
    const result: [string, T][] = [];
    for (const [fullKey, entry] of this.#store) {
      if (!this.#isExpired(entry)) {
        const key = prefix ? fullKey.slice(prefix.length) : fullKey;
        result.push([key, entry.value]);
      }
    }
    return result;
  }

  /** Count of all non-expired entries. */
  get size(): number {
    let count = 0;
    for (const entry of this.#store.values()) {
      if (!this.#isExpired(entry)) count++;
    }
    return count;
  }

  /** Remove expired entries. Returns the number of entries removed. */
  prune(): number {
    let removed = 0;
    for (const [key, entry] of this.#store) {
      if (this.#isExpired(entry)) {
        this.#store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get or set: if the key exists and has not expired, return its current value.
   * Otherwise set it to the provided value (with optional TTL) and return that value.
   */
  getOrSet(key: string, value: T, ttl?: number): T {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    this.set(key, value, ttl);
    return value;
  }
}
