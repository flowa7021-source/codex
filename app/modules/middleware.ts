// @ts-check
// ─── Middleware ───────────────────────────────────────────────────────────────
// Middleware chain / request-response pipeline (Express-style).
// Each middleware receives a context object and a `next` function to advance
// the chain. Middleware can mutate the context and await subsequent handlers.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Context object passed through the middleware chain.
 */
export interface Context {
  [key: string]: unknown;
}

/**
 * A middleware function.
 */
export type Middleware<T extends Context = Context> = (
  ctx: T,
  next: () => Promise<void>,
) => Promise<void> | void;

// ─── MiddlewareChain ─────────────────────────────────────────────────────────

/**
 * A middleware chain executor.
 */
export class MiddlewareChain<T extends Context = Context> {
  #stack: Array<Middleware<T>> = [];

  /** Add middleware to the chain. */
  use(middleware: Middleware<T>): this {
    this.#stack.push(middleware);
    return this;
  }

  /** Execute the chain with a context. Resolves when done. */
  run(ctx: T): Promise<void> {
    const stack = this.#stack;
    let index = -1;

    const dispatch = (i: number): Promise<void> => {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;
      const fn = stack[i];
      if (!fn) return Promise.resolve();
      try {
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    };

    return dispatch(0);
  }

  /** Number of registered middleware. */
  get length(): number {
    return this.#stack.length;
  }
}

/**
 * Create a middleware chain.
 */
export function createMiddlewareChain<T extends Context>(): MiddlewareChain<T> {
  return new MiddlewareChain<T>();
}

// ─── Built-in Middleware ──────────────────────────────────────────────────────

/**
 * Create a logging middleware that logs context.
 */
export function createLogMiddleware(
  logger: (ctx: Context) => void = (ctx) => console.log(ctx),
): Middleware {
  return async (ctx, next) => {
    logger(ctx);
    await next();
  };
}

/**
 * Create a timing middleware that measures execution time.
 * Adds `duration` (milliseconds) to the context after the chain completes.
 */
export function createTimingMiddleware(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    ctx['duration'] = Date.now() - start;
  };
}
