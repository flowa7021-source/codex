// @ts-check
// ─── Error Boundary ──────────────────────────────────────────────────────────
// Application-level error handling utilities: structured errors, retry,
// fallback and timeout helpers, all integrated with the Result monad.

import { type Result, Ok, Err } from './result.js';

// ─── AppError ────────────────────────────────────────────────────────────────

/**
 * Structured application error with a machine-readable `code`, optional
 * `context` bag and optional causal `cause` chain.
 */
export class AppError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  override readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
    this.cause = cause;
  }

  toJSON(): Record<string, unknown> {
    const json: Record<string, unknown> = {
      name: this.name,
      message: this.message,
      code: this.code,
    };
    if (this.context !== undefined) json['context'] = this.context;
    if (this.cause !== undefined) {
      json['cause'] =
        this.cause instanceof AppError
          ? this.cause.toJSON()
          : { name: this.cause.name, message: this.cause.message };
    }
    return json;
  }
}

// ─── tryCatch ────────────────────────────────────────────────────────────────

/**
 * Wrap a synchronous function so thrown errors become `Err` values instead of
 * propagating as exceptions.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return new Ok(fn());
  } catch (thrown) {
    return new Err(
      thrown instanceof Error ? thrown : new Error(String(thrown)),
    );
  }
}

/**
 * Async variant of {@link tryCatch}.
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
): Promise<Result<T, Error>> {
  try {
    return new Ok(await fn());
  } catch (thrown) {
    return new Err(
      thrown instanceof Error ? thrown : new Error(String(thrown)),
    );
  }
}

// ─── withRetry ───────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (including the first). */
  maxAttempts: number;
  /** Initial delay in ms between attempts (default 0). */
  delay?: number;
  /** Multiplier applied to `delay` after each failure (default 1 = no backoff). */
  backoff?: number;
  /** Return `false` to abort retrying immediately (default: always retry). */
  shouldRetry?: (err: Error) => boolean;
}

/**
 * Call `fn` up to `options.maxAttempts` times, waiting `delay * backoff^n`
 * milliseconds between attempts.  Resolves with the first successful value or
 * rejects with the last error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, delay = 0, backoff = 1, shouldRetry } = options;
  let lastError: Error = new Error('withRetry: no attempts made');
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (thrown) {
      lastError = thrown instanceof Error ? thrown : new Error(String(thrown));
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }
      if (attempt < maxAttempts && currentDelay > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, currentDelay));
      }
      currentDelay = currentDelay * backoff;
    }
  }

  throw lastError;
}

// ─── withFallback ─────────────────────────────────────────────────────────────

/**
 * Try `primary`.  If it rejects, try `fallback`.  Rejects only if both fail
 * (with the fallback error).
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch {
    return fallback();
  }
}

// ─── withTimeout ─────────────────────────────────────────────────────────────

/**
 * Race `fn()` against a timer.  Rejects with a timeout error if `ms`
 * milliseconds elapse before `fn` settles.
 */
export async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timerId);
    return result;
  } catch (err) {
    clearTimeout(timerId);
    throw err;
  }
}
