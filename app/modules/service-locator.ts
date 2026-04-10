// @ts-check
// ─── Service Locator ─────────────────────────────────────────────────────────
// A string-keyed service registry and a composable middleware chain.

// ─── ServiceLocator ───────────────────────────────────────────────────────────

/**
 * A simple service locator that stores services by name.
 *
 * @example
 *   const locator = createServiceLocator();
 *   locator.register('logger', new Logger());
 *   const logger = locator.get('logger');
 */
export class ServiceLocator {
  #services: Map<string, unknown>;

  constructor() {
    this.#services = new Map();
  }

  /**
   * Register a service instance under a name.
   * Overwrites any previously registered service with the same name.
   */
  register<T>(name: string, service: T): void {
    this.#services.set(name, service);
  }

  /**
   * Retrieve a service by name.
   * @throws {Error} if no service is registered under that name.
   */
  get<T>(name: string): T {
    if (!this.#services.has(name)) {
      throw new Error(`ServiceLocator: service "${name}" is not registered`);
    }
    return this.#services.get(name) as T;
  }

  /** Return true if a service is registered under the given name. */
  has(name: string): boolean {
    return this.#services.has(name);
  }

  /**
   * Remove a service registration by name.
   * No-op if the name is not registered.
   */
  unregister(name: string): void {
    this.#services.delete(name);
  }

  /** Return a sorted list of all registered service names. */
  list(): string[] {
    return Array.from(this.#services.keys());
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/** A middleware function that processes a context and optionally calls next. */
type MiddlewareFn<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

/**
 * A composable middleware chain.
 * Middleware functions are executed in the order they were added via `use()`.
 *
 * @example
 *   const mw = createMiddleware();
 *   mw.use(async (ctx, next) => { console.log('before'); await next(); console.log('after'); });
 *   await mw.execute({ req: ... });
 */
export class Middleware<T> {
  #fns: Array<MiddlewareFn<T>>;

  constructor() {
    this.#fns = [];
  }

  /** Add a middleware function to the chain. */
  use(fn: MiddlewareFn<T>): void {
    this.#fns.push(fn);
  }

  /**
   * Execute the middleware chain for a given context.
   * Each middleware receives `next` which advances to the next middleware.
   * If a middleware does not call `next`, the chain stops there.
   */
  execute(ctx: T): Promise<void> {
    const fns = this.#fns;
    let index = -1;

    const dispatch = (i: number): Promise<void> => {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;
      if (i >= fns.length) {
        return Promise.resolve();
      }
      const fn = fns[i];
      return fn(ctx, () => dispatch(i + 1));
    };

    return dispatch(0);
  }
}

// ─── Factories ────────────────────────────────────────────────────────────────

/** Create a new empty ServiceLocator. */
export function createServiceLocator(): ServiceLocator {
  return new ServiceLocator();
}

/** Create a new empty Middleware chain. */
export function createMiddleware<T>(): Middleware<T> {
  return new Middleware<T>();
}
