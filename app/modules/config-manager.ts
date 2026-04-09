// @ts-check
// ─── Config Manager ───────────────────────────────────────────────────────────
// Hierarchical configuration manager with dot-notation key access,
// change subscriptions, and defaults/reset support.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfigManagerOptions {
  defaults?: Record<string, unknown>;
  /** If true, throw on access of undefined key; default false */
  strict?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Split a dot-notation key into path segments. */
function splitKey(key: string): string[] {
  return key.split('.');
}

/** Read a value from a nested object by path segments. */
function getByPath(obj: Record<string, unknown>, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** Set a value in a nested object by path segments, creating intermediate objects. */
function setByPath(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown,
): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = current[seg];
    if (next === null || typeof next !== 'object') {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

/** Delete a key from a nested object by path segments. Returns true if the key existed. */
function deleteByPath(obj: Record<string, unknown>, segments: string[]): boolean {
  let current: unknown = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (current === null || typeof current !== 'object') return false;
    current = (current as Record<string, unknown>)[segments[i]];
  }
  if (current === null || typeof current !== 'object') return false;
  const parent = current as Record<string, unknown>;
  const lastSeg = segments[segments.length - 1];
  if (!(lastSeg in parent)) return false;
  delete parent[lastSeg];
  return true;
}

/** Deep clone a plain object (no functions, no class instances). */
function deepClone(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

// ─── ConfigManager ────────────────────────────────────────────────────────────

export class ConfigManager {
  #data: Record<string, unknown>;
  #defaults: Record<string, unknown>;
  #strict: boolean;
  #listeners: Map<string, Set<(value: unknown) => void>>;

  constructor(options?: ConfigManagerOptions) {
    this.#defaults = options?.defaults ? deepClone(options.defaults) : {};
    this.#strict = options?.strict ?? false;
    this.#data = deepClone(this.#defaults);
    this.#listeners = new Map();
  }

  /** Set a single key (dot-notation: 'db.host'). */
  set(key: string, value: unknown): void {
    const segments = splitKey(key);
    setByPath(this.#data, segments, value);
    this.#notifyListeners(key, value);
  }

  /** Get value by key (dot-notation). Returns undefined if absent. */
  get<T = unknown>(key: string): T | undefined {
    const segments = splitKey(key);
    const value = getByPath(this.#data, segments) as T | undefined;
    if (this.#strict && value === undefined) {
      throw new Error(`ConfigManager: key "${key}" is not defined`);
    }
    return value;
  }

  /** Get with a fallback default. */
  getOrDefault<T>(key: string, defaultValue: T): T {
    const segments = splitKey(key);
    const value = getByPath(this.#data, segments);
    return value !== undefined ? (value as T) : defaultValue;
  }

  /** Check if key exists. */
  has(key: string): boolean {
    const segments = splitKey(key);
    return getByPath(this.#data, segments) !== undefined;
  }

  /** Delete a key. */
  delete(key: string): boolean {
    const segments = splitKey(key);
    const deleted = deleteByPath(this.#data, segments);
    if (deleted) {
      this.#notifyListeners(key, undefined);
    }
    return deleted;
  }

  /** Merge a plain object into config (shallow merge at root level). */
  merge(obj: Record<string, unknown>): void {
    Object.assign(this.#data, obj);
    for (const key of Object.keys(obj)) {
      this.#notifyListeners(key, obj[key]);
    }
  }

  /** Get entire config as plain object. */
  toObject(): Record<string, unknown> {
    return deepClone(this.#data);
  }

  /** Reset to defaults. */
  reset(): void {
    this.#data = deepClone(this.#defaults);
  }

  /** Subscribe to changes on a specific key. Returns unsubscribe fn. */
  onChange(key: string, callback: (value: unknown) => void): () => void {
    if (!this.#listeners.has(key)) {
      this.#listeners.set(key, new Set());
    }
    const callbacks = this.#listeners.get(key)!;
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.#listeners.delete(key);
      }
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  #notifyListeners(key: string, value: unknown): void {
    const callbacks = this.#listeners.get(key);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(value);
      }
    }
  }
}

/**
 * Factory function: create a ConfigManager pre-loaded with defaults.
 * If storageKey is provided, persists changes to localStorage (browser only).
 */
export function createConfig(
  defaults: Record<string, unknown>,
  storageKey?: string,
): ConfigManager {
  const manager = new ConfigManager({ defaults });
  if (storageKey && typeof globalThis.localStorage !== 'undefined') {
    // Persist on every change
    const persist = () => {
      try {
        globalThis.localStorage.setItem(storageKey, JSON.stringify(manager.toObject()));
      } catch {
        // ignore storage errors
      }
    };
    // Wrap set/delete/merge/reset to persist after each call
    const origSet = manager.set.bind(manager);
    manager.set = (key: string, value: unknown) => { origSet(key, value); persist(); };
    const origDelete = manager.delete.bind(manager);
    manager.delete = (key: string) => { const r = origDelete(key); persist(); return r; };
    const origMerge = manager.merge.bind(manager);
    manager.merge = (obj: Record<string, unknown>) => { origMerge(obj); persist(); };
    const origReset = manager.reset.bind(manager);
    manager.reset = () => { origReset(); persist(); };
    persist();
  }
  return manager;
}
