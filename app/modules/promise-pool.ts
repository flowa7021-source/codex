// @ts-check
// ─── Promise Pool ─────────────────────────────────────────────────────────────
// Utilities for controlled concurrent async operations.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run tasks with a concurrency limit. Returns all results in order.
 * At most `concurrency` tasks run simultaneously.
 */
export async function promisePool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Map over items with a concurrency limit.
 * Equivalent to `promisePool` but accepts items and a mapping function.
 */
export async function pMap<T, U>(
  items: T[],
  fn: (item: T, index: number) => Promise<U>,
  concurrency: number,
): Promise<U[]> {
  return promisePool(
    items.map((item, index) => () => fn(item, index)),
    concurrency,
  );
}

/**
 * Like Promise.all but with a concurrency limit.
 * Alias for `promisePool` for API symmetry.
 */
export async function pAll<T>(
  factories: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  return promisePool(factories, concurrency);
}

/**
 * Run tasks in series (one at a time), collecting results in order.
 */
export async function pSeries<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  return promisePool(tasks, 1);
}

/**
 * Retry a task up to `maxAttempts` times with optional delay and exponential backoff.
 * Throws the last error if all attempts fail.
 */
export async function pRetry<T>(
  task: () => Promise<T>,
  options: { maxAttempts: number; delay?: number; backoff?: number },
): Promise<T> {
  const { maxAttempts, delay = 0, backoff = 1 } = options;
  let lastError: unknown;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && currentDelay > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, currentDelay));
        currentDelay = Math.round(currentDelay * backoff);
      }
    }
  }

  throw lastError;
}

/**
 * Run a promise with a timeout. Throws a `TimeoutError` if not resolved in time.
 */
export async function pTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Promise timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Debounce an async function: only the last call within `ms` milliseconds
 * will actually execute. Earlier calls resolve with the same result as the
 * trailing call.
 */
export function pDebounce<T extends unknown[]>(
  fn: (...args: T) => Promise<unknown>,
  ms: number,
): (...args: T) => Promise<unknown> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let pendingResolvers: Array<(value: unknown) => void> = [];
  let pendingRejecters: Array<(reason: unknown) => void> = [];

  return function (...args: T): Promise<unknown> {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }

    return new Promise<unknown>((resolve, reject) => {
      pendingResolvers.push(resolve);
      pendingRejecters.push(reject);

      timerId = setTimeout(() => {
        timerId = undefined;
        const resolvers = pendingResolvers;
        const rejecters = pendingRejecters;
        pendingResolvers = [];
        pendingRejecters = [];

        fn(...args).then(
          (value) => resolvers.forEach((r) => r(value)),
          (err) => rejecters.forEach((r) => r(err)),
        );
      }, ms);
    });
  };
}
