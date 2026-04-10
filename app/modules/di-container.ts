// @ts-check
// ─── Dependency Injection Container ──────────────────────────────────────────
// A typed DI container supporting singleton, transient, and scoped lifetimes.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A typed token used to register and resolve dependencies. */
export interface Token<T> {
  id: symbol;
  type?: T;
}

/** Lifetime scope for a registered dependency. */
export type LifetimeScope = 'singleton' | 'transient' | 'scoped';

interface Registration<T> {
  factory: (container: DIContainer) => T;
  scope: LifetimeScope;
}

// ─── createToken ──────────────────────────────────────────────────────────────

/**
 * Create a typed token from a string identifier.
 * Each call produces a unique token even if the same string is used.
 */
export function createToken<T>(id: string): Token<T> {
  return { id: Symbol(id) };
}

// ─── DIContainer ──────────────────────────────────────────────────────────────

export class DIContainer {
  #parent: DIContainer | undefined;
  #registrations: Map<symbol, Registration<unknown>> = new Map();
  #singletons: Map<symbol, unknown> = new Map();

  constructor(parent?: DIContainer) {
    this.#parent = parent;
  }

  /**
   * Register a factory function for a token.
   * @param scope defaults to 'singleton'
   */
  register<T>(
    token: Token<T>,
    factory: (container: DIContainer) => T,
    scope: LifetimeScope = 'singleton',
  ): void {
    this.#registrations.set(token.id, { factory, scope } as Registration<unknown>);
  }

  /** Register a pre-constructed value as a singleton. */
  registerValue<T>(token: Token<T>, value: T): void {
    this.#registrations.set(token.id, {
      factory: () => value,
      scope: 'singleton',
    } as Registration<unknown>);
    // Pre-populate the singleton cache so the value is returned directly.
    this.#singletons.set(token.id, value);
  }

  /** Walk up the container hierarchy to find the closest registration. */
  #findRegistration<T>(tokenId: symbol): Registration<T> | undefined {
    const local = this.#registrations.get(tokenId) as Registration<T> | undefined;
    if (local !== undefined) return local;
    return this.#parent?.#findRegistration<T>(tokenId);
  }

  /**
   * Resolve a token to its value.
   * - singleton: cached on the container that owns the registration.
   * - scoped: cached on the resolving container (child scope gets its own instance).
   * - transient: new instance on every call.
   * Throws if no registration is found in this container or any ancestor.
   */
  resolve<T>(token: Token<T>): T {
    const reg = this.#findRegistration<T>(token.id);

    if (reg === undefined) {
      throw new Error(`DIContainer: no registration found for token "${String(token.id)}"`);
    }

    if (reg.scope === 'transient') {
      return reg.factory(this);
    }

    if (reg.scope === 'scoped') {
      // Each scope caches its own instance.
      if (this.#singletons.has(token.id)) {
        return this.#singletons.get(token.id) as T;
      }
      const instance = reg.factory(this);
      this.#singletons.set(token.id, instance);
      return instance;
    }

    // singleton: cache on the container that owns the registration.
    const owner = this.#findOwner(token.id) ?? this;
    if (owner.#singletons.has(token.id)) {
      return owner.#singletons.get(token.id) as T;
    }
    const instance = reg.factory(this);
    owner.#singletons.set(token.id, instance);
    return instance;
  }

  /** Return the container (self or ancestor) that holds the registration for tokenId. */
  #findOwner(tokenId: symbol): DIContainer | undefined {
    if (this.#registrations.has(tokenId)) return this;
    return this.#parent?.#findOwner(tokenId);
  }

  /**
   * Check whether a token is registered in this container or any ancestor.
   */
  has(token: Token<unknown>): boolean {
    if (this.#registrations.has(token.id)) return true;
    return this.#parent?.has(token) ?? false;
  }

  /**
   * Create a child container for scoped lifetime resolution.
   * Scoped registrations resolved on the child are cached on the child,
   * while singleton registrations stay cached on the parent.
   */
  createScope(): DIContainer {
    return new DIContainer(this);
  }
}

// ─── createContainer ──────────────────────────────────────────────────────────

/** Factory function that creates a new DIContainer. */
export function createContainer(parent?: DIContainer): DIContainer {
  return new DIContainer(parent);
}
