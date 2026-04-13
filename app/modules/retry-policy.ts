// @ts-check
// ─── Retry Policy ─────────────────────────────────────────────────────────────
// Configurable retry logic with exponential backoff, linear, and fixed delays.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts?: number;  // default 3
  baseDelay?: number;    // base delay ms, default 100
  maxDelay?: number;     // cap delay ms, default 30000
  backoff?: 'fixed' | 'linear' | 'exponential'; // default 'exponential'
  jitter?: boolean;      // add randomness, default false
  retryIf?: (error: unknown) => boolean; // default: always retry
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

// ─── calcDelay ────────────────────────────────────────────────────────────────

/**
 * Calculate the delay for attempt N (0-indexed).
 *
 * Strategies:
 * - fixed:       baseDelay always
 * - linear:      baseDelay * (attempt + 1)
 * - exponential: baseDelay * 2^attempt
 *
 * Result is clamped to maxDelay. If jitter is enabled, the result is
 * multiplied by a random factor in [0.5, 1.0).
 */
export function calcDelay(attempt: number, options: RetryOptions): number {
  const baseDelay = options.baseDelay ?? 100;
  const maxDelay = options.maxDelay ?? 30_000;
  const backoff = options.backoff ?? 'exponential';
  const jitter = options.jitter ?? false;

  let delay: number;

  switch (backoff) {
    case 'fixed':
      delay = baseDelay;
      break;
    case 'linear':
      delay = baseDelay * (attempt + 1);
      break;
    case 'exponential':
    default:
      delay = baseDelay * Math.pow(2, attempt);
      break;
  }

  // Clamp to maxDelay
  delay = Math.min(delay, maxDelay);

  // Apply jitter: multiply by random factor in [0.5, 1.0)
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return delay;
}

// ─── withRetry ────────────────────────────────────────────────────────────────

/**
 * Execute fn with the given retry policy.
 * Returns an object containing the resolved value and the total attempt count.
 *
 * @throws The last error encountered if all attempts are exhausted.
 *
 * @example
 *   const { value, attempts } = await withRetry(() => fetchData(), {
 *     maxAttempts: 5,
 *     backoff: 'exponential',
 *     baseDelay: 200,
 *   });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<RetryResult<T>> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const retryIf = options?.retryIf;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const value = await fn();
      return { value, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;

      // Check whether this error is retryable
      if (retryIf !== undefined && !retryIf(err)) {
        throw err;
      }

      // No delay needed after the last attempt
      if (attempt < maxAttempts - 1) {
        const delay = calcDelay(attempt, options ?? {});
        if (delay > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError;
}

// ─── RetryPolicy ──────────────────────────────────────────────────────────────

/**
 * Class-based wrapper around {@link withRetry} that encapsulates a fixed set
 * of options and can be reused across multiple calls.
 *
 * @example
 *   const policy = new RetryPolicy({ maxAttempts: 5, backoff: 'linear' });
 *   const { value } = await policy.execute(() => fetch('/api/data'));
 */
export class RetryPolicy {
  #options: Required<Omit<RetryOptions, 'retryIf'>> & {
    retryIf?: (error: unknown) => boolean;
  };

  constructor(options?: RetryOptions) {
    this.#options = {
      maxAttempts: options?.maxAttempts ?? 3,
      baseDelay: options?.baseDelay ?? 100,
      maxDelay: options?.maxDelay ?? 30_000,
      backoff: options?.backoff ?? 'exponential',
      jitter: options?.jitter ?? false,
      retryIf: options?.retryIf,
    };
  }

  /** Execute fn using this policy's options. */
  execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    return withRetry(fn, this.#options);
  }

  /** The resolved options for this policy. */
  get options(): Required<Omit<RetryOptions, 'retryIf'>> & {
    retryIf?: (error: unknown) => boolean;
  } {
    return { ...this.#options };
  }
}
