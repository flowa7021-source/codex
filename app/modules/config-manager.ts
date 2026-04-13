// @ts-check
// ─── Config Manager ───────────────────────────────────────────────────────────
// Generic typed configuration management with change notifications and validation.

// ─── ConfigManager ────────────────────────────────────────────────────────────

export class ConfigManager<T extends Record<string, unknown>> {
  #defaults: T;
  #current: T;
  #handlers: Set<(key: keyof T, value: unknown) => void> = new Set();

  constructor(defaults: T) {
    this.#defaults = { ...defaults };
    this.#current = { ...defaults };
  }

  /** Get the current value for a key. */
  get<K extends keyof T>(key: K): T[K] {
    return this.#current[key];
  }

  /** Set the value for a key and notify listeners. */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.#current[key] = value;
    for (const handler of this.#handlers) {
      handler(key, value);
    }
  }

  /** Merge a partial config object, calling set for each key. */
  merge(partial: Partial<T>): void {
    for (const key of Object.keys(partial) as (keyof T)[]) {
      if (Object.prototype.hasOwnProperty.call(partial, key)) {
        this.set(key, partial[key] as T[typeof key]);
      }
    }
  }

  /**
   * Reset one key (or all keys) to their default values.
   * Notifies listeners for each key that is reset.
   */
  reset(key?: keyof T): void {
    if (key !== undefined) {
      this.set(key, this.#defaults[key]);
    } else {
      for (const k of Object.keys(this.#defaults) as (keyof T)[]) {
        this.set(k, this.#defaults[k]);
      }
    }
  }

  /** Check if a key exists in the current config. */
  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.#current, key);
  }

  /** Return a shallow copy of the current config. */
  all(): T {
    return { ...this.#current };
  }

  /**
   * Register a change listener.
   * Returns an unsubscribe function.
   */
  onChange(handler: (key: keyof T, value: unknown) => void): () => void {
    this.#handlers.add(handler);
    return () => {
      this.#handlers.delete(handler);
    };
  }

  /**
   * Validate the current config against a schema of validator functions.
   * Returns true if all provided validators pass; false otherwise.
   */
  validate(schema: Partial<Record<keyof T, (v: unknown) => boolean>>): boolean {
    for (const key of Object.keys(schema) as (keyof T)[]) {
      const validator = schema[key];
      if (validator !== undefined && !validator(this.#current[key])) {
        return false;
      }
    }
    return true;
  }
}

/** Factory function that creates a new ConfigManager with the given defaults. */
export function createConfig<T extends Record<string, unknown>>(defaults: T): ConfigManager<T> {
  return new ConfigManager(defaults);
}
