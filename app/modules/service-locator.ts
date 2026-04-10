// @ts-check
// ─── Service Locator ─────────────────────────────────────────────────────────
// A string-keyed service locator supporting singleton and transient factories.

// ─── ServiceEntry ─────────────────────────────────────────────────────────────

interface ServiceEntry<T> {
  factory: () => T;
  singleton: boolean;
  cache: T | undefined;
  hasCache: boolean;
}

// ─── ServiceLocator ───────────────────────────────────────────────────────────

export class ServiceLocator {
  #services: Map<string, ServiceEntry<unknown>> = new Map();

  /**
   * Register a factory for a service key.
   * @param singleton when true (default false) the first resolved instance is cached.
   */
  register<T>(key: string, factory: () => T, singleton: boolean = false): void {
    this.#services.set(key, {
      factory: factory as () => unknown,
      singleton,
      cache: undefined,
      hasCache: false,
    });
  }

  /** Register an already-constructed instance (always behaves as a singleton). */
  registerInstance<T>(key: string, instance: T): void {
    this.#services.set(key, {
      factory: () => instance,
      singleton: true,
      cache: instance,
      hasCache: true,
    });
  }

  /**
   * Retrieve a service by key.
   * Throws if the key has not been registered.
   */
  get<T>(key: string): T {
    const entry = this.#services.get(key) as ServiceEntry<T> | undefined;
    if (entry === undefined) {
      throw new Error(`ServiceLocator: service "${key}" is not registered`);
    }

    if (entry.singleton) {
      if (!entry.hasCache) {
        entry.cache = entry.factory();
        entry.hasCache = true;
      }
      return entry.cache as T;
    }

    return entry.factory();
  }

  /** Return true if the key has been registered. */
  has(key: string): boolean {
    return this.#services.has(key);
  }

  /**
   * Clear the singleton cache for a specific key, or for all keys when
   * called without arguments.  Non-singleton entries are unaffected.
   * Passing an unknown key is a no-op.
   */
  reset(key?: string): void {
    if (key !== undefined) {
      const entry = this.#services.get(key);
      if (entry !== undefined) {
        entry.cache = undefined;
        entry.hasCache = false;
      }
      return;
    }
    // Reset all caches.
    for (const entry of this.#services.values()) {
      entry.cache = undefined;
      entry.hasCache = false;
    }
  }

  /** Return all registered service keys. */
  keys(): string[] {
    return Array.from(this.#services.keys());
  }
}

// ─── GlobalServiceLocator ─────────────────────────────────────────────────────

/** Module-level singleton instance for global service location. */
export const GlobalServiceLocator: ServiceLocator = new ServiceLocator();

// ─── createServiceLocator ─────────────────────────────────────────────────────

/** Factory function that creates a new ServiceLocator. */
export function createServiceLocator(): ServiceLocator {
  return new ServiceLocator();
}
