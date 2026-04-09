// @ts-check
// ─── Config Manager ──────────────────────────────────────────────────────────
// Layered configuration: defaults < stored (localStorage) < runtime overrides.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Configuration manager that supports layered configs (defaults < stored < runtime).
 */
export class ConfigManager<T extends Record<string, unknown>> {
  #defaults: T;
  #current: T;
  #storageKey: string | undefined;
  #listeners: Map<keyof T, Set<(value: unknown) => void>>;

  constructor(defaults: T, storageKey?: string) {
    this.#defaults = { ...defaults };
    this.#storageKey = storageKey;
    this.#listeners = new Map();

    // Load persisted values if a storage key was given
    const stored = storageKey ? this.#loadFromStorage() : {};
    this.#current = { ...defaults, ...stored };
  }

  /** Get a config value by key. */
  get<K extends keyof T>(key: K): T[K] {
    return this.#current[key];
  }

  /** Set a config value. Persists to localStorage if storageKey was given. */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.#current[key] = value;
    this.#persist();
    this.#notify(key, value);
  }

  /** Set multiple values at once. */
  setMany(values: Partial<T>): void {
    for (const key of Object.keys(values) as (keyof T)[]) {
      if (key in values) {
        this.#current[key] = values[key] as T[keyof T];
        this.#notify(key, values[key]);
      }
    }
    this.#persist();
  }

  /** Reset a key to its default value. */
  reset<K extends keyof T>(key: K): void {
    this.#current[key] = this.#defaults[key];
    this.#persist();
    this.#notify(key, this.#defaults[key]);
  }

  /** Reset all keys to defaults. */
  resetAll(): void {
    for (const key of Object.keys(this.#defaults) as (keyof T)[]) {
      this.#current[key] = this.#defaults[key];
      this.#notify(key, this.#defaults[key]);
    }
    this.#persist();
  }

  /**
   * Subscribe to changes for a specific key.
   * @returns unsubscribe function
   */
  onChange<K extends keyof T>(key: K, callback: (value: T[K]) => void): () => void {
    if (!this.#listeners.has(key)) {
      this.#listeners.set(key, new Set());
    }
    const cb = callback as (value: unknown) => void;
    this.#listeners.get(key)!.add(cb);
    return () => {
      this.#listeners.get(key)?.delete(cb);
    };
  }

  /** Get the full current config (shallow copy). */
  getAll(): T {
    return { ...this.#current };
  }

  /** Whether a key has been overridden from its default. */
  isModified<K extends keyof T>(key: K): boolean {
    return this.#current[key] !== this.#defaults[key];
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #notify<K extends keyof T>(key: K, value: unknown): void {
    const listeners = this.#listeners.get(key);
    if (listeners) {
      for (const cb of listeners) {
        cb(value);
      }
    }
  }

  #persist(): void {
    if (!this.#storageKey) return;
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(this.#current));
    } catch {
      // Storage unavailable — silently ignore
    }
  }

  #loadFromStorage(): Partial<T> {
    try {
      const raw = localStorage.getItem(this.#storageKey!);
      if (raw !== null) return JSON.parse(raw) as Partial<T>;
    } catch {
      // Corrupt or unavailable storage — fall back to defaults
    }
    return {};
  }
}

/**
 * Create a ConfigManager instance.
 */
export function createConfig<T extends Record<string, unknown>>(
  defaults: T,
  storageKey?: string,
): ConfigManager<T> {
  return new ConfigManager(defaults, storageKey);
}
