// @ts-check
// ─── Error Handler ───────────────────────────────────────────────────────────
// Error boundary utilities: safe wrappers, type guards, and error factories.

// ─── Safe execution wrappers ─────────────────────────────────────────────────

/**
 * Safely execute a function and return [result, null] or [null, error].
 */
export function tryCatch<T>(fn: () => T): [T, null] | [null, Error] {
  try {
    const result = fn();
    return [result, null];
  } catch (thrown) {
    return [null, toError(thrown)];
  }
}

/**
 * Safely execute an async function and return [result, null] or [null, Error].
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<[T, null] | [null, Error]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (thrown) {
    return [null, toError(thrown)];
  }
}

// ─── Error type utilities ────────────────────────────────────────────────────

/**
 * Convert any thrown value to an Error instance.
 * - If the value is already an Error, it is returned as-is.
 * - If the value is a string, it is used as the error message.
 * - Otherwise the value is serialised and wrapped in an Error.
 */
export function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  if (typeof thrown === 'string') return new Error(thrown);
  try {
    return new Error(String(thrown));
  } catch {
    return new Error('Unknown error');
  }
}

/**
 * Check if a value is an Error instance.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Get a human-readable message from any error-like value.
 * - Error instances return their `.message`.
 * - Strings are returned directly.
 * - Everything else returns 'Unknown error'.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Check if an error matches a specific type or message pattern.
 * - When `type` is a string it is compared to the error's constructor name.
 * - When `type` is a RegExp it is tested against the error message.
 */
export function isErrorType(error: unknown, type: string | RegExp): boolean {
  if (typeof type === 'string') {
    if (!(error instanceof Error)) return false;
    return error.constructor.name === type || error.name === type;
  }
  // RegExp: test against message
  const msg = getErrorMessage(error);
  return type.test(msg);
}

// ─── Global unhandled rejection handler ──────────────────────────────────────

/**
 * Register a global unhandled rejection handler.
 * Returns an unregister function.
 */
export function onUnhandledRejection(
  handler: (reason: unknown, promise: Promise<unknown>) => void
): () => void {
  const listener = (event: PromiseRejectionEvent) => {
    handler(event.reason, event.promise);
  };

  globalThis.addEventListener('unhandledrejection', listener as EventListener);

  return () => {
    globalThis.removeEventListener('unhandledrejection', listener as EventListener);
  };
}

// ─── Typed error class factory ───────────────────────────────────────────────

/**
 * Create a typed error subclass with an optional code property.
 *
 * @example
 *   const NetworkError = createErrorClass('NetworkError');
 *   throw new NetworkError('timeout', 'NET_TIMEOUT');
 */
export function createErrorClass(
  name: string
): new (message: string, code?: string) => Error & { code?: string } {
  class CustomError extends Error {
    code?: string;

    constructor(message: string, code?: string) {
      super(message);
      this.name = name;
      if (code !== undefined) this.code = code;
      // Fix prototype chain for transpiled environments.
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }

  Object.defineProperty(CustomError, 'name', { value: name });

  return CustomError as unknown as new (message: string, code?: string) => Error & { code?: string };
}
