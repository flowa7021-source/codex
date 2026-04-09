// @ts-check
// ─── Chain of Responsibility ──────────────────────────────────────────────────
// Passes a request along a dynamic chain of handlers until one handles it.

// ─── Handler interface ────────────────────────────────────────────────────────

/** A single link in a chain of responsibility. */
export interface Handler<TRequest, TResponse> {
  /** Process the request, or return null to pass it to the next handler. */
  handle(request: TRequest): TResponse | null;
  /**
   * Attach the next handler in the chain.
   * Returns the next handler so calls can be chained fluently.
   */
  setNext(handler: Handler<TRequest, TResponse>): Handler<TRequest, TResponse>;
}

// ─── BaseHandler ──────────────────────────────────────────────────────────────

/**
 * Abstract-style base class providing the `setNext` wiring and default
 * `handle` delegation. Subclasses override `handle` and call `super.handle`
 * (or invoke `this.next?.handle(request) ?? null`) when they choose not to
 * handle the request.
 */
export class BaseHandler<TRequest, TResponse>
  implements Handler<TRequest, TResponse>
{
  protected next: Handler<TRequest, TResponse> | null = null;

  setNext(
    handler: Handler<TRequest, TResponse>,
  ): Handler<TRequest, TResponse> {
    this.next = handler;
    return handler;
  }

  handle(request: TRequest): TResponse | null {
    return this.next !== null ? this.next.handle(request) : null;
  }
}

// ─── createHandler ────────────────────────────────────────────────────────────

/**
 * Create a handler from a plain function.
 *
 * The function receives the request and a `next` callback.
 * Call `next()` to delegate to the next handler in the chain.
 *
 * @example
 *   const h = createHandler((req, next) =>
 *     req > 0 ? req * 2 : next()
 *   );
 */
export function createHandler<TRequest, TResponse>(
  fn: (request: TRequest, next: () => TResponse | null) => TResponse | null,
): Handler<TRequest, TResponse> {
  return new FunctionHandler(fn);
}

class FunctionHandler<TRequest, TResponse> extends BaseHandler<
  TRequest,
  TResponse
> {
  #fn: (
    request: TRequest,
    next: () => TResponse | null,
  ) => TResponse | null;

  constructor(
    fn: (
      request: TRequest,
      next: () => TResponse | null,
    ) => TResponse | null,
  ) {
    super();
    this.#fn = fn;
  }

  override handle(request: TRequest): TResponse | null {
    const next = (): TResponse | null =>
      this.next !== null ? this.next.handle(request) : null;
    return this.#fn(request, next);
  }
}

// ─── chain ────────────────────────────────────────────────────────────────────

/**
 * Link an ordered list of handlers together and return the first one.
 * Requests flow left-to-right through the list.
 *
 * @throws {Error} when called with an empty array.
 */
export function chain<TRequest, TResponse>(
  ...handlers: Handler<TRequest, TResponse>[]
): Handler<TRequest, TResponse> {
  if (handlers.length === 0) {
    throw new Error('chain() requires at least one handler');
  }
  for (let i = 0; i < handlers.length - 1; i++) {
    handlers[i].setNext(handlers[i + 1]);
  }
  return handlers[0];
}

// ─── FallbackHandler ─────────────────────────────────────────────────────────

/**
 * A terminal handler that always returns a fixed default response.
 * Useful as the last link in a chain to guarantee a non-null result.
 */
export class FallbackHandler<TRequest, TResponse>
  extends BaseHandler<TRequest, TResponse>
{
  #defaultResponse: TResponse;

  constructor(defaultResponse: TResponse) {
    super();
    this.#defaultResponse = defaultResponse;
  }

  override handle(_request: TRequest): TResponse {
    return this.#defaultResponse;
  }
}
