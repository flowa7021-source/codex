// @ts-check
// ─── Dependency Injection Container ──────────────────────────────────────────
// A string-token based DI container supporting singleton and transient
// registrations, value registration, and child containers.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A factory function that receives the container and produces a service. */
export type ServiceFactory<T> = (container: DIContainer) => T;

/** Internal registration record. */
interface Registration {
  factory: ServiceFactory<unknown>;
  singleton: boolean;
  instance: unknown;
  hasInstance: boolean;
}

// ─── DIContainer ─────────────────────────────────────────────────────────────

/**
 * A simple dependency injection container backed by string tokens.
 *
 * @example
 *   const container = createContainer();
 *   container.register('db', () => new Database(), true);
 *   container.registerValue('config', { host: 'localhost' });
 *   const db = container.resolve('db');
 */
export class DIContainer {
  #registrations: Map<string, Registration>;
  #parent: DIContainer | null;

  constructor(parent: DIContainer | null = null) {
    this.#registrations = new Map();
    this.#parent = parent;
  }

  /**
   * Register a factory for a string token.
   * @param token - Unique string identifier for the service.
   * @param factory - Function that creates the service, receives the container.
   * @param singleton - If true, the instance is cached after the first resolve.
   */
  register<T>(token: string, factory: ServiceFactory<T>, singleton = false): void {
    this.#registrations.set(token, {
      factory: factory as ServiceFactory<unknown>,
      singleton,
      instance: undefined,
      hasInstance: false,
    });
  }

  /**
   * Register a pre-existing value directly under a token.
   * The value is stored as a singleton (returned as-is on every resolve).
   */
  registerValue<T>(token: string, value: T): void {
    this.#registrations.set(token, {
      factory: () => value,
      singleton: true,
      instance: value,
      hasInstance: true,
    });
  }

  /**
   * Resolve a service by token.
   * Singletons are cached after first creation.
   * Looks in own registrations first, then walks up to the parent.
   * @throws {Error} if the token is not registered in this container or any ancestor.
   */
  resolve<T>(token: string): T {
    const reg = this.#registrations.get(token);

    if (reg !== undefined) {
      if (reg.singleton) {
        if (!reg.hasInstance) {
          reg.instance = reg.factory(this);
          reg.hasInstance = true;
        }
        return reg.instance as T;
      }
      return reg.factory(this) as T;
    }

    if (this.#parent !== null) {
      return this.#parent.resolve<T>(token);
    }

    throw new Error(`DIContainer: no registration found for token "${token}"`);
  }

  /**
   * Check whether a token is registered in this container or any ancestor.
   */
  has(token: string): boolean {
    if (this.#registrations.has(token)) return true;
    return this.#parent !== null && this.#parent.has(token);
  }

  /**
   * Remove a registration from this container only.
   * Does not affect ancestor containers or their singleton caches.
   */
  unregister(token: string): void {
    this.#registrations.delete(token);
  }

  /**
   * Create a child container that inherits all registrations from this container.
   * Registrations added to the child do not affect the parent.
   */
  child(): DIContainer {
    return new DIContainer(this);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new empty DIContainer. */
export function createContainer(): DIContainer {
  return new DIContainer();
}
