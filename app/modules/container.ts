// @ts-check
// ─── Dependency Injection Container ─────────────────────────────────────────
// A lightweight DI container supporting transient and singleton bindings,
// child containers, and multi-token resolution.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A factory function that receives the container and produces a value. */
export type Factory<T> = (container: Container) => T;

/** Options for factory registration. */
export interface BindingOptions {
  /** Cache the produced value after first resolution (default false = transient). */
  singleton?: boolean;
}

// ─── Internal binding shapes ─────────────────────────────────────────────────

interface ValueBinding<T> {
  kind: 'value';
  value: T;
}

interface FactoryBinding<T> {
  kind: 'factory';
  factory: Factory<T>;
  singleton: boolean;
  /** Cached instance (only used when singleton === true). */
  cache?: T;
  resolved: boolean;
}

type Binding<T> = ValueBinding<T> | FactoryBinding<T>;

// ─── Container ────────────────────────────────────────────────────────────────

/**
 * Dependency injection container.
 *
 * @example
 *   const c = createContainer();
 *   c.singleton('config', () => ({ debug: true }));
 *   c.factory('logger', (ctr) => new Logger(ctr.resolve('config')));
 *   const logger = c.resolve('logger');
 */
export class Container {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #bindings: Map<string, Binding<any>> = new Map();
  #parent: Container | null = null;

  /** @internal — used only by createChild() */
  static #createWithParent(parent: Container): Container {
    const child = new Container();
    child.#parent = parent;
    return child;
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a plain value under `token`.
   * Resolving the token always returns this exact value.
   */
  bind<T>(token: string, value: T): void {
    this.#bindings.set(token, { kind: 'value', value });
  }

  /**
   * Register a factory function under `token`.
   * By default (transient) the factory is called on every `resolve`.
   * Pass `{ singleton: true }` to cache the first result.
   */
  factory<T>(token: string, factory: Factory<T>, options?: BindingOptions): void {
    const singleton = options?.singleton ?? false;
    this.#bindings.set(token, { kind: 'factory', factory, singleton, resolved: false });
  }

  /**
   * Shorthand for `factory(token, factory, { singleton: true })`.
   * The factory is called once and the result is cached for all future resolutions.
   */
  singleton<T>(token: string, factory: Factory<T>): void {
    this.factory(token, factory, { singleton: true });
  }

  // ─── Resolution ────────────────────────────────────────────────────────────

  /**
   * Resolve a dependency by token.
   * Walks up to parent containers when the token is not found locally.
   * @throws {Error} when no binding exists for `token`.
   */
  resolve<T>(token: string): T {
    const binding = this.#bindings.get(token) as Binding<T> | undefined;

    if (binding === undefined) {
      if (this.#parent !== null) {
        return this.#parent.resolve<T>(token);
      }
      throw new Error(`Container: no binding registered for token "${token}"`);
    }

    if (binding.kind === 'value') {
      return binding.value;
    }

    // factory binding
    if (binding.singleton) {
      if (!binding.resolved) {
        binding.cache = binding.factory(this);
        binding.resolved = true;
      }
      return binding.cache as T;
    }

    // transient — call factory every time
    return binding.factory(this);
  }

  /**
   * Resolve multiple tokens at once.
   * Returns an array of resolved values in the same order as `tokens`.
   */
  resolveAll(tokens: string[]): unknown[] {
    return tokens.map((t) => this.resolve(t));
  }

  // ─── Introspection / Management ────────────────────────────────────────────

  /**
   * Return `true` if `token` is registered in this container or any ancestor.
   */
  has(token: string): boolean {
    if (this.#bindings.has(token)) return true;
    return this.#parent !== null ? this.#parent.has(token) : false;
  }

  /**
   * Remove the binding for `token` from this container only.
   * @returns `true` if a binding was removed, `false` if none existed.
   */
  unbind(token: string): boolean {
    return this.#bindings.delete(token);
  }

  /** Remove all bindings from this container (does not affect parent). */
  clear(): void {
    this.#bindings.clear();
  }

  // ─── Child Containers ──────────────────────────────────────────────────────

  /**
   * Create a child container that inherits all registrations from this container.
   * Registrations in the child shadow the parent but never mutate it.
   */
  createChild(): Container {
    return Container.#createWithParent(this);
  }
}

// ─── Factory function ─────────────────────────────────────────────────────────

/** Create and return a new, empty {@link Container}. */
export function createContainer(): Container {
  return new Container();
}
