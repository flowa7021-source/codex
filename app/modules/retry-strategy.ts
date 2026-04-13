// @ts-check
// ─── Retry Strategy ──────────────────────────────────────────────────────────
// Configurable retry/backoff utilities for async operations.

/** Delay helpers ────────────────────────────────────────────────────────── */

/**
 * Compute the delay for a given attempt using the specified strategy.
 *
 * @param attempt  1-based attempt number of the *failed* attempt.
 * @param options  Delay configuration.
 */
export function computeDelay(
  attempt: number,
  options: {
    delayMs?: number;
    backoff?: 'fixed' | 'linear' | 'exponential';
    maxDelayMs?: number;
  } = {}
): number {
  const { delayMs = 1000, backoff = 'exponential', maxDelayMs = 30000 } = options;

  let delay: number;
  switch (backoff) {
    case 'fixed':
      delay = delayMs;
      break;
    case 'linear':
      delay = delayMs * attempt;
      break;
    case 'exponential':
    default:
      delay = delayMs * Math.pow(2, attempt - 1);
      break;
  }

  return Math.min(delay, maxDelayMs);
}

/** Sleep helper — resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** retry() ──────────────────────────────────────────────────────────────── */

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: 'fixed' | 'linear' | 'exponential';
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Retry a function up to maxAttempts times with configurable delay.
 * Returns the result or throws on final failure.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = 'exponential',
    maxDelayMs = 30000,
    shouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Check if we should continue retrying.
      if (shouldRetry && !shouldRetry(err, attempt)) {
        throw err;
      }

      // No more attempts remaining.
      if (attempt === maxAttempts) break;

      onRetry?.(err, attempt);

      const delay = computeDelay(attempt, { delayMs, backoff, maxDelayMs });
      await sleep(delay);
    }
  }

  throw lastError;
}

/** createRetry() ────────────────────────────────────────────────────────── */

/**
 * Create a retry wrapper that can be reused with the same options.
 */
export function createRetry(
  options: RetryOptions
): <T>(fn: () => Promise<T>) => Promise<T> {
  return <T>(fn: () => Promise<T>) => retry(fn, options);
}

/** withTimeout() ────────────────────────────────────────────────────────── */

/**
 * Run a function with a timeout. Throws if it doesn't complete in time.
 */
export function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  );
  return Promise.race([fn(), timeoutPromise]);
}

/** raceTimeout() ────────────────────────────────────────────────────────── */

/**
 * Race a promise against a timeout. Resolves to null on timeout.
 */
export function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  const timeoutPromise = new Promise<null>(resolve =>
    setTimeout(() => resolve(null), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}
