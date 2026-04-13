// @ts-check
// ─── Promise / Async Utilities ───────────────────────────────────────────────
// A collection of Promise and async utility functions.
// Pure JS — no DOM, no browser APIs.

// ─── TimeoutError ─────────────────────────────────────────────────────────────

/** Thrown by `timeout()` when the promise does not settle within the time limit. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Promise timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

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
 * Rejects with a `TimeoutError` if the timer fires first.
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => { clearTimeout(id); resolve(value); },
      (reason) => { clearTimeout(id); reject(reason); },
    );
  });
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

// ─── race ─────────────────────────────────────────────────────────────────────

/**
 * Resolves or rejects with the first settled promise in `promises`.
 */
export function race<T>(promises: Promise<T>[]): Promise<T> {
  return Promise.race(promises);
}

// ─── any ──────────────────────────────────────────────────────────────────────

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

// ─── retry ────────────────────────────────────────────────────────────────────

export interface SimpleRetryOptions {
  /** Number of retry attempts after the first failure. Default: 3 */
  retries?: number;
  /** Base delay in ms between retries. Default: 0 */
  delay?: number;
  /** Backoff multiplier applied to delay after each failure. Default: 1 */
  backoff?: number;
}

/**
 * Calls `fn` repeatedly on failure until it succeeds or the attempt budget is
 * exhausted. Uses simple linear/multiplicative backoff. The last error is
 * re-thrown when all attempts fail.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: SimpleRetryOptions,
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelay = options?.delay ?? 0;
  const backoff = options?.backoff ?? 1;

  let lastError: unknown;
  let currentDelay = baseDelay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries && currentDelay > 0) {
        await delay(currentDelay);
        currentDelay *= backoff;
      } else if (attempt < retries) {
        currentDelay = baseDelay * Math.pow(backoff, attempt + 1);
      }
    }
  }

  throw lastError;
}

// ─── mapConcurrent ────────────────────────────────────────────────────────────

/**
 * Maps `items` through async `fn` with at most `concurrency` in-flight at once.
 * Preserves input order in the result array.
 */
export async function mapConcurrent<T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
  concurrency: number,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const cap = Math.min(concurrency, items.length);
  if (cap === 0) return results;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < cap; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ─── pDebounce ────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn`. Repeated calls within `ms` reset the
 * timer; only the last call's promise settles all pending callers.
 */
export function pDebounce<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  ms: number,
): (...args: T) => Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Array<{ resolve: (v: R) => void; reject: (e: unknown) => void }> = [];

  return (...args: T): Promise<R> => {
    return new Promise<R>((resolve, reject) => {
      pending.push({ resolve, reject });
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const batch = pending;
        pending = [];
        fn(...args).then(
          (v) => { for (const p of batch) p.resolve(v); },
          (e) => { for (const p of batch) p.reject(e); },
        );
      }, ms);
    });
  };
}

// ─── pThrottle ────────────────────────────────────────────────────────────────

/**
 * Returns a throttled version of `fn`. At most one invocation per `ms` window.
 * Calls made during the cooldown are queued; the most-recent arguments win.
 */
export function pThrottle<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  ms: number,
): (...args: T) => Promise<R> {
  let lastCall = -Infinity;
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  let queued: { args: T; resolve: (v: R) => void; reject: (e: unknown) => void } | undefined;

  function flush(args: T, resolve: (v: R) => void, reject: (e: unknown) => void): void {
    lastCall = Date.now();
    fn(...args).then(resolve, reject);
    cooldownTimer = setTimeout(() => {
      cooldownTimer = undefined;
      if (queued) {
        const { args: qa, resolve: qr, reject: qj } = queued;
        queued = undefined;
        flush(qa, qr, qj);
      }
    }, ms);
  }

  return (...args: T): Promise<R> => {
    return new Promise<R>((resolve, reject) => {
      const now = Date.now();
      if (cooldownTimer === undefined && now - lastCall >= ms) {
        flush(args, resolve, reject);
      } else {
        queued = { args, resolve, reject };
      }
    });
  };
}

// ─── withAbort ────────────────────────────────────────────────────────────────

export interface WithAbortResult<T> {
  promise: Promise<T>;
  abort: () => void;
}

/**
 * Runs `fn` with an `AbortSignal`. Returns the promise and an `abort()` helper.
 * When `abort()` is called the signal fires and the promise rejects with an
 * `AbortError` (DOMException name "AbortError").
 */
export function withAbort<T>(
  fn: (signal: AbortSignal) => Promise<T>,
): WithAbortResult<T> {
  const controller = new AbortController();

  const promise = new Promise<T>((resolve, reject) => {
    if (controller.signal.aborted) {
      reject(controller.signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    controller.signal.addEventListener('abort', () => {
      reject(controller.signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });

    fn(controller.signal).then(resolve, reject);
  });

  return {
    promise,
    abort: () => controller.abort(new DOMException('Aborted', 'AbortError')),
  };
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
