// @ts-check
// ─── Promise / Async Utilities ───────────────────────────────────────────────
// A collection of Promise and async utility functions.
// Pure JS — no DOM, no browser APIs.

// ─── Types ───────────────────────────────────────────────────────────────────

/** A deferred promise that exposes resolve and reject externally. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/** Result of a settled promise (fulfilled). */
interface FulfilledResult<T> {
  status: 'fulfilled';
  value: T;
}

/** Result of a settled promise (rejected). */
interface RejectedResult {
  status: 'rejected';
  reason: unknown;
}

/** Union result type for allSettled. */
export type SettledResult<T> = FulfilledResult<T> | RejectedResult;

/** Options for retryWithBackoff. */
export interface RetryOptions {
  /** Maximum number of attempts (default 3). */
  maxAttempts?: number;
  /** Initial delay in ms before the first retry (default 100). */
  initialDelay?: number;
  /** Maximum delay cap in ms (default 5000). */
  maxDelay?: number;
  /** Exponential backoff factor (default 2). */
  factor?: number;
  /** Called after each failed attempt with the error and attempt number. */
  onError?: (err: unknown, attempt: number) => void;
}

// ─── Timing ──────────────────────────────────────────────────────────────────

/**
 * Returns a promise that resolves after `ms` milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Races `promise` against a timer of `ms` milliseconds.
 * Rejects with an Error if the timer fires first.
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timer = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      reject(new Error(`Promise timed out after ${ms}ms`));
    }, ms);
    // Clear the timer if the original promise settles first.
    promise.then(() => clearTimeout(id), () => clearTimeout(id));
  });
  return Promise.race([promise, timer]);
}

// ─── Control flow ────────────────────────────────────────────────────────────

/**
 * Maps `items` through an async `fn`, processing at most `limit` items
 * concurrently. Preserves order of results.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const concurrency = Math.min(limit, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * Filters `items` asynchronously using an async `predicate`.
 * Runs all predicates concurrently and preserves order.
 */
export async function filterAsync<T>(
  items: T[],
  predicate: (item: T) => Promise<boolean>,
): Promise<T[]> {
  const flags = await Promise.all(items.map(predicate));
  return items.filter((_, i) => flags[i]);
}

/**
 * Reduces `items` asynchronously, applying `fn` serially left-to-right.
 */
export async function reduceAsync<T, R>(
  items: T[],
  fn: (acc: R, item: T, index: number) => Promise<R>,
  initial: R,
): Promise<R> {
  let acc = initial;
  for (let i = 0; i < items.length; i++) {
    acc = await fn(acc, items[i], i);
  }
  return acc;
}

/**
 * Like `Promise.allSettled`, but fully typed with an explicit discriminated union.
 * Returns an array of settled results in the same order as the input promises.
 */
export function allSettled<T>(
  promises: Promise<T>[],
): Promise<Array<SettledResult<T>>> {
  return Promise.all(
    promises.map(p =>
      p.then(
        (value): FulfilledResult<T> => ({ status: 'fulfilled', value }),
        (reason): RejectedResult => ({ status: 'rejected', reason }),
      ),
    ),
  );
}

/**
 * Resolves with the value of the first fulfilled promise.
 * Rejects with an AggregateError if all promises reject.
 */
export function any<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (promises.length === 0) {
      reject(new AggregateError([], 'any(): empty array'));
      return;
    }
    let remaining = promises.length;
    const errors: unknown[] = new Array(promises.length);
    promises.forEach((p, i) => {
      p.then(
        value => resolve(value),
        reason => {
          errors[i] = reason;
          remaining--;
          if (remaining === 0) {
            reject(new AggregateError(errors, 'All promises were rejected'));
          }
        },
      );
    });
  });
}

// ─── Retry with backoff ──────────────────────────────────────────────────────

/**
 * Retries an async `fn` up to `maxAttempts` times with exponential backoff.
 * On the final failure the error is re-thrown.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelay = options?.initialDelay ?? 100;
  const maxDelay = options?.maxDelay ?? 5000;
  const factor = options?.factor ?? 2;
  const onError = options?.onError;

  let currentDelay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (onError) onError(err, attempt);
      if (attempt === maxAttempts) throw err;
      await delay(currentDelay);
      currentDelay = Math.min(currentDelay * factor, maxDelay);
    }
  }
  // TypeScript requires a definite return; unreachable in practice.
  throw new Error('retryWithBackoff: exhausted all attempts');
}

// ─── Deferred promise ────────────────────────────────────────────────────────

/**
 * Creates a deferred promise — a promise whose resolve/reject are exposed
 * so external code can settle it.
 */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ─── Queue ───────────────────────────────────────────────────────────────────

/**
 * Runs an array of task factories through a concurrency-limited queue.
 * Resolves with results in the same order as the input tasks.
 *
 * @param tasks - Array of zero-argument async factories.
 * @param concurrency - Maximum number of concurrent tasks (default 1 = serial).
 */
export async function pQueue<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 1,
): Promise<T[]> {
  return mapLimit(tasks, concurrency, task => task());
}

// ─── Misc ────────────────────────────────────────────────────────────────────

/**
 * Wraps a Node-style callback function `fn(...args, (err, result) => void)`
 * into a Promise<T>.
 *
 * The callback convention expected is `(err: unknown, result: T) => void`.
 */
export function promisify<T>(
  fn: (...args: unknown[]) => void,
  ...args: unknown[]
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn(...args, (err: unknown, result: T) => {
      if (err != null) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Runs `fn` with the resolved value of `promise` as a side effect,
 * then returns the original resolved value unchanged.
 * If `promise` rejects the rejection propagates immediately.
 */
export function tap<T>(promise: Promise<T>, fn: (value: T) => unknown): Promise<T> {
  return promise.then(value => {
    const result = fn(value);
    if (result instanceof Promise) {
      return result.then(() => value);
    }
    return value;
  });
}
