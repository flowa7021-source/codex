// @ts-check
// ─── Promise Utilities ───────────────────────────────────────────────────────
// General-purpose async/promise helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Resolve after N milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run promises in series (one after another). */
export async function series<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
  const results: T[] = [];
  for (const fn of fns) {
    results.push(await fn());
  }
  return results;
}

/** Run promises in parallel with a concurrency limit. */
export async function parallel<T>(
  fns: Array<() => Promise<T>>,
  concurrency = Infinity,
): Promise<T[]> {
  const results: T[] = new Array(fns.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < fns.length) {
      const current = index++;
      results[current] = await fns[current]();
    }
  }

  const limit = Math.min(concurrency, fns.length);
  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < limit; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/** Retry a promise-returning function up to maxAttempts times. */
export async function pRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 0,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && delayMs > 0) {
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

/** Race a set of promises, returning the first to resolve. */
export async function pRace<T>(promises: Array<Promise<T>>): Promise<T> {
  return Promise.race(promises);
}

/** Resolve all, but return both fulfilled and rejected results. */
export async function pSettle<T>(
  promises: Array<Promise<T>>,
): Promise<Array<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }>> {
  return Promise.allSettled(promises) as Promise<
    Array<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }>
  >;
}

/** Create a deferred promise (resolve/reject from outside). */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Memoize an async function (cache by first argument). */
export function memoizeAsync<TKey, TValue>(
  fn: (key: TKey) => Promise<TValue>,
  keyFn: (key: TKey) => string = (key) => String(key),
): (key: TKey) => Promise<TValue> {
  const cache = new Map<string, Promise<TValue>>();
  return (key: TKey): Promise<TValue> => {
    const cacheKey = keyFn(key);
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    const promise = fn(key);
    cache.set(cacheKey, promise);
    // Remove from cache on rejection so a future call can retry
    promise.catch(() => {
      if (cache.get(cacheKey) === promise) {
        cache.delete(cacheKey);
      }
    });
    return promise;
  };
}
