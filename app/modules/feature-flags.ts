// @ts-check
// ─── Feature Flags ────────────────────────────────────────────────────────────
// Class-based feature flag system with subscription support.

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlagValue = boolean | string | number;

export interface FeatureFlag {
  key: string;
  value: FlagValue;
  description?: string;
  enabled: boolean;
}

export interface FeatureFlagsOptions {
  defaults?: Record<string, FlagValue>;
}

// ─── FeatureFlags ─────────────────────────────────────────────────────────────

export class FeatureFlags {
  #flags: Map<string, FeatureFlag> = new Map();
  #subscribers: Map<string, Set<(value: FlagValue | undefined, enabled: boolean) => void>> = new Map();

  constructor(options?: FeatureFlagsOptions) {
    if (options?.defaults) {
      for (const [key, value] of Object.entries(options.defaults)) {
        this.set(key, value, true);
      }
    }
  }

  /** Define/update a flag. */
  set(key: string, value: FlagValue, enabled = true): void {
    const existing = this.#flags.get(key);
    this.#flags.set(key, {
      key,
      value,
      description: existing?.description,
      enabled,
    });
    this.#notify(key);
  }

  /** Get flag value (returns undefined if not set). */
  get(key: string): FlagValue | undefined {
    return this.#flags.get(key)?.value;
  }

  /** Check if flag is enabled and truthy. */
  isEnabled(key: string): boolean {
    const flag = this.#flags.get(key);
    if (!flag) return false;
    return flag.enabled && Boolean(flag.value);
  }

  /** Get all flags. */
  getAll(): FeatureFlag[] {
    return Array.from(this.#flags.values());
  }

  /** Enable a flag (keeps existing value). */
  enable(key: string): void {
    const flag = this.#flags.get(key);
    if (!flag) return;
    flag.enabled = true;
    this.#notify(key);
  }

  /** Disable a flag (keeps existing value). */
  disable(key: string): void {
    const flag = this.#flags.get(key);
    if (!flag) return;
    flag.enabled = false;
    this.#notify(key);
  }

  /** Remove a flag. */
  remove(key: string): void {
    this.#flags.delete(key);
    this.#notify(key);
  }

  /** Load flags from a plain object. */
  load(flags: Record<string, FlagValue | { value: FlagValue; enabled: boolean }>): void {
    for (const [key, entry] of Object.entries(flags)) {
      if (
        entry !== null &&
        typeof entry === 'object' &&
        'value' in (entry as object) &&
        'enabled' in (entry as object)
      ) {
        const typed = entry as { value: FlagValue; enabled: boolean };
        this.set(key, typed.value, typed.enabled);
      } else {
        this.set(key, entry as FlagValue, true);
      }
    }
  }

  /** Subscribe to flag changes. Returns unsubscribe fn. */
  subscribe(
    key: string,
    callback: (value: FlagValue | undefined, enabled: boolean) => void,
  ): () => void {
    let listeners = this.#subscribers.get(key);
    if (!listeners) {
      listeners = new Set();
      this.#subscribers.set(key, listeners);
    }
    listeners.add(callback);
    return () => {
      listeners!.delete(callback);
    };
  }

  #notify(key: string): void {
    const listeners = this.#subscribers.get(key);
    if (!listeners || listeners.size === 0) return;
    const flag = this.#flags.get(key);
    const value = flag?.value;
    const enabled = flag?.enabled ?? false;
    for (const cb of listeners) {
      cb(value, enabled);
    }
  }
}
