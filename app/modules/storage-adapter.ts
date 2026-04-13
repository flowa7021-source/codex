// @ts-check
// ─── Storage Adapter ─────────────────────────────────────────────────────────
// Unified storage interface with pluggable backends.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface StorageAdapterOptions {
  /** Key prefix prepended to all keys. Default: '' */
  prefix?: string;
  /** Storage backend. Default: MemoryBackend */
  backend?: StorageBackend;
  /** Custom serializer/deserializer. Default: JSON */
  serializer?: {
    serialize(v: unknown): string;
    deserialize(s: string): unknown;
  };
}

// ─── MemoryBackend ────────────────────────────────────────────────────────────

/** In-memory backend (default). */
export class MemoryBackend implements StorageBackend {
  #store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.#store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.#store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.#store.delete(key);
  }

  async clear(): Promise<void> {
    this.#store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.#store.keys());
  }
}

// ─── Default serializer ───────────────────────────────────────────────────────

const jsonSerializer = {
  serialize(v: unknown): string {
    return JSON.stringify(v);
  },
  deserialize(s: string): unknown {
    return JSON.parse(s);
  },
};

// ─── StorageAdapter ───────────────────────────────────────────────────────────

export class StorageAdapter {
  #prefix: string;
  #backend: StorageBackend;
  #serializer: { serialize(v: unknown): string; deserialize(s: string): unknown };

  constructor(options?: StorageAdapterOptions) {
    this.#prefix = options?.prefix ?? '';
    this.#backend = options?.backend ?? new MemoryBackend();
    this.#serializer = options?.serializer ?? jsonSerializer;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  #prefixedKey(key: string): string {
    return this.#prefix ? `${this.#prefix}${key}` : key;
  }

  #unprefixedKey(prefixedKey: string): string {
    return this.#prefix ? prefixedKey.slice(this.#prefix.length) : prefixedKey;
  }

  // ─── Core API ───────────────────────────────────────────────────────────────

  /** Get a stored value, deserializing it. Returns null if not found. */
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.#backend.get(this.#prefixedKey(key));
    if (raw === null) return null;
    return this.#serializer.deserialize(raw) as T;
  }

  /** Serialize and store a value. */
  async set<T>(key: string, value: T): Promise<void> {
    const raw = this.#serializer.serialize(value);
    await this.#backend.set(this.#prefixedKey(key), raw);
  }

  /** Delete a key. */
  async delete(key: string): Promise<void> {
    await this.#backend.delete(this.#prefixedKey(key));
  }

  /**
   * Clear ALL keys visible through this adapter (respects prefix: only keys
   * matching this adapter's prefix are removed).
   */
  async clear(): Promise<void> {
    if (!this.#prefix) {
      await this.#backend.clear();
      return;
    }
    // Only delete keys belonging to this prefix
    const allKeys = await this.#backend.keys();
    for (const k of allKeys) {
      if (k.startsWith(this.#prefix)) {
        await this.#backend.delete(k);
      }
    }
  }

  /**
   * List keys visible through this adapter (strips the prefix from results).
   */
  async keys(): Promise<string[]> {
    const allKeys = await this.#backend.keys();
    if (!this.#prefix) return allKeys;
    return allKeys
      .filter((k) => k.startsWith(this.#prefix))
      .map((k) => this.#unprefixedKey(k));
  }

  /** Returns true if the key exists. */
  async has(key: string): Promise<boolean> {
    const raw = await this.#backend.get(this.#prefixedKey(key));
    return raw !== null;
  }

  /**
   * Get a value or compute and store it via fn().
   * Useful for lazy initialisation / caching.
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) return existing;
    const value = await fn();
    await this.set(key, value);
    return value;
  }

  /** Retrieve multiple keys in one call. Missing keys return null. */
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  /** Store multiple key/value pairs in one call. */
  async setMany(entries: [string, unknown][]): Promise<void> {
    await Promise.all(entries.map(([k, v]) => this.set(k, v)));
  }
}
