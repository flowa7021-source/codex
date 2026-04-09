// @ts-check
// ─── Config Loader ────────────────────────────────────────────────────────────
// Configuration loading and merging from multiple sources with typed access.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfigSource = 'defaults' | 'file' | 'env' | 'args' | 'runtime';

export interface ConfigEntry<T> {
  value: T;
  source: ConfigSource;
  key: string;
}

// ─── ConfigLoader ─────────────────────────────────────────────────────────────

/**
 * Configuration loader that merges values from multiple sources.
 * Later calls to `loadObject` overwrite earlier ones for the same key.
 * Source precedence (lowest to highest): defaults → file → env → args → runtime.
 *
 * @example
 *   const loader = new ConfigLoader<{ port: number; debug: boolean }>();
 *   loader.loadDefaults({ port: 3000, debug: false });
 *   loader.loadEnv('APP_', { port: 'APP_PORT', debug: 'APP_DEBUG' });
 *   console.log(loader.get('port'));
 */
export class ConfigLoader<T extends Record<string, unknown>> {
  #entries: Map<string, ConfigEntry<unknown>> = new Map();
  #schema: Partial<Record<keyof T, unknown>>;

  constructor(schema?: Partial<Record<keyof T, unknown>>) {
    this.#schema = schema ?? {};
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  /** Set default values. These have the lowest precedence. */
  loadDefaults(defaults: Partial<T>): void {
    this.#mergeObject(defaults, 'defaults', /* overwrite */ false);
  }

  /**
   * Merge values from an arbitrary object.
   * Defaults to source `'runtime'` when no source is given.
   * Overwrites any previously loaded value for the same key.
   */
  loadObject(obj: Partial<T>, source: ConfigSource = 'runtime'): void {
    this.#mergeObject(obj, source, /* overwrite */ true);
  }

  /**
   * Load values from `process.env`.
   *
   * @param prefix  - Optional env-var prefix to strip (e.g. `'APP_'`).
   * @param mapping - Explicit key→envVar map; takes priority over prefix-based
   *                  discovery when provided.
   */
  loadEnv(
    prefix?: string,
    mapping?: Partial<Record<keyof T, string>>,
  ): void {
    const env: Record<string, string | undefined> =
      typeof process !== 'undefined' ? process.env : {};

    if (mapping) {
      for (const [key, envVar] of Object.entries(mapping) as [string, string][]) {
        if (envVar === undefined) continue;
        const raw = env[envVar];
        if (raw !== undefined) {
          this.#setEntry(key, raw, 'env');
        }
      }
    } else if (prefix) {
      for (const [envKey, raw] of Object.entries(env)) {
        if (!envKey.startsWith(prefix)) continue;
        const key = envKey.slice(prefix.length).toLowerCase();
        if (raw !== undefined) {
          this.#setEntry(key, raw, 'env');
        }
      }
    }
  }

  // ─── Access ───────────────────────────────────────────────────────────────

  /** Returns the current value for `key`, or `undefined` if not set. */
  get<K extends keyof T>(key: K): T[K] | undefined {
    const entry = this.#entries.get(key as string);
    return entry !== undefined ? (entry.value as T[K]) : undefined;
  }

  /** Returns the current value for `key`, falling back to `defaultValue`. */
  getOrDefault<K extends keyof T>(key: K, defaultValue: T[K]): T[K] {
    const entry = this.#entries.get(key as string);
    return entry !== undefined ? (entry.value as T[K]) : defaultValue;
  }

  /** Returns the source that last set this key, or `null` if not set. */
  getSource(key: string): ConfigSource | null {
    const entry = this.#entries.get(key);
    return entry !== undefined ? entry.source : null;
  }

  /** Return all currently resolved key/value pairs as a plain object. */
  toObject(): Partial<T> {
    const result: Partial<T> = {};
    for (const [key, entry] of this.#entries) {
      (result as Record<string, unknown>)[key] = entry.value;
    }
    return result;
  }

  /** Clear all loaded configuration. */
  reset(): void {
    this.#entries.clear();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #mergeObject(
    obj: Partial<T>,
    source: ConfigSource,
    overwrite: boolean,
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (!overwrite && this.#entries.has(key)) continue;
      this.#setEntry(key, value, source);
    }
  }

  #setEntry(key: string, value: unknown, source: ConfigSource): void {
    this.#entries.set(key, { key, value, source });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new `ConfigLoader` without `new`. */
export function createConfigLoader<
  T extends Record<string, unknown>,
>(): ConfigLoader<T> {
  return new ConfigLoader<T>();
}
