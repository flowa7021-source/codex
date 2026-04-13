// @ts-check
// ─── Async / Promise Utilities ───────────────────────────────────────────────
// General-purpose helpers for async control flow: sleep, timeout, concurrency,
// retry, deferred promises, polling, and a bounded task queue.

// ─── Sleep ───────────────────────────────────────────────────────────────────

/**
 * Resolves after `ms` milliseconds.
 *
 * @example
 *   await sleep(200); // pause for 200 ms
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Timeout ─────────────────────────────────────────────────────────────────

/**
 * Races `promise` against a deadline of `ms` milliseconds.
 * If the deadline fires first the returned promise is rejected with an Error
 * whose message defaults to `"Timeout after ${ms}ms"`.
 *
 * @example
 *   const data = await timeout(fetch('/api'), 5000, 'API call timed out');
 */
export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  const deadline = new Promise<never>((_resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(message ?? `Timeout after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, deadline]);
}

// ─── Parallel ────────────────────────────────────────────────────────────────

/**
 * Run an array of async task factories, collecting all results in the original
 * order.  When `concurrency` is supplied (and > 0) at most that many tasks run
 * simultaneously; otherwise all tasks are started at once.
 *
 * @example
 *   const results = await parallel([() => fetchA(), () => fetchB()], 2);
 */
export async function parallel<T>(
  tasks: Array<() => Promise<T>>,
  concurrency?: number,
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const limit = (concurrency !== undefined && concurrency > 0) ? concurrency : tasks.length;
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ─── Series ──────────────────────────────────────────────────────────────────

/**
 * Run an array of async task factories one after another, collecting results
 * in order.  Each task only starts once the previous has resolved.
 *
 * @example
 *   const [a, b] = await series([() => stepA(), () => stepB()]);
 */
export async function series<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
  const results: T[] = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

// ─── Race ────────────────────────────────────────────────────────────────────

/**
 * Start all task factories simultaneously and resolve with the value of the
 * first one that settles (or reject if the first settled task rejects).
 *
 * @example
 *   const fastest = await race([() => fetchMirror1(), () => fetchMirror2()]);
 */
export function race<T>(tasks: Array<() => Promise<T>>): Promise<T> {
  return Promise.race(tasks.map(t => t()));
}

// ─── Retry ───────────────────────────────────────────────────────────────────

/**
 * Options accepted by {@link retryAsync}.
 */
export interface RetryOptions {
  /** Delay before the first retry in milliseconds (default 0). */
  delayMs?: number;
  /**
   * Back-off strategy applied to `delayMs` between successive retries.
   * - `"linear"` — delay stays constant.
   * - `"exponential"` — delay doubles on every retry (default).
   */
  backoff?: 'linear' | 'exponential';
  /** Called after each failed attempt before the next retry is scheduled. */
  onError?: (err: Error, attempt: number) => void;
}

/**
 * Call `fn` up to `maxAttempts` times, retrying on rejection.
 * Resolves with the first successful result; rejects with the last error if
 * all attempts are exhausted.
 *
 * @example
 *   const data = await retryAsync(() => fetchUnstable(), 3, { delayMs: 50, backoff: 'exponential' });
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  options?: RetryOptions,
): Promise<T> {
  const delayMs = options?.delayMs ?? 0;
  const backoff = options?.backoff ?? 'exponential';
  const onError = options?.onError;

  let lastError: Error = new Error('No attempts made');
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (onError) onError(lastError, attempt);
      if (attempt < maxAttempts && currentDelay > 0) {
        await sleep(currentDelay);
        if (backoff === 'exponential') currentDelay *= 2;
      }
    }
  }
  throw lastError;
}

// ─── Deferred ────────────────────────────────────────────────────────────────

/**
 * A promise together with its externally accessible `resolve` and `reject`
 * callbacks, useful when an async result must be signalled from a different
 * call-site.
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Create a {@link Deferred} whose settlement can be triggered from outside.
 *
 * @example
 *   const d = createDeferred<string>();
 *   setTimeout(() => d.resolve('done'), 100);
 *   const result = await d.promise; // 'done'
 */
export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ─── Poll ────────────────────────────────────────────────────────────────────

/**
 * Options accepted by {@link poll}.
 */
export interface PollOptions<T> {
  /** How long to wait between invocations of `fn` in milliseconds. */
  intervalMs: number;
  /** Maximum total wait time in milliseconds before rejecting. */
  timeoutMs: number;
  /**
   * Optional predicate; when omitted the poll resolves as soon as `fn` returns
   * a non-null/undefined value.
   */
  condition?: (value: T) => boolean;
}

/**
 * Repeatedly call `fn` every `intervalMs` milliseconds until:
 * - `fn` returns a non-null/undefined value **and** `condition` (if supplied)
 *   returns `true` for that value, **or**
 * - `timeoutMs` elapses, in which case the promise rejects.
 *
 * @example
 *   const el = await poll(() => document.querySelector('#ready'), {
 *     intervalMs: 50, timeoutMs: 3000,
 *   });
 */
export function poll<T>(
  fn: () => Promise<T | null | undefined>,
  options: PollOptions<T>,
): Promise<T> {
  const { intervalMs, timeoutMs, condition } = options;
  return new Promise((resolve, reject) => {
    let done = false;
    let intervalId: ReturnType<typeof setTimeout> | undefined;

    const timeoutId = setTimeout(() => {
      done = true;
      clearTimeout(intervalId);
      reject(new Error(`poll: timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const check = async (): Promise<void> => {
      if (done) return;
      try {
        const value = await fn();
        if (done) return;
        if (value !== null && value !== undefined) {
          if (!condition || condition(value)) {
            done = true;
            clearTimeout(timeoutId);
            clearTimeout(intervalId);
            resolve(value);
            return;
          }
        }
      } catch {
        // swallow per-iteration errors and keep polling
      }
      if (!done) {
        intervalId = setTimeout(check, intervalMs);
      }
    };

    // Kick off immediately
    intervalId = setTimeout(check, 0);
  });
}

// ─── AsyncQueue ──────────────────────────────────────────────────────────────

/**
 * A FIFO task queue that limits how many async tasks run concurrently.
 * Tasks are enqueued as factory functions and resolved with their individual
 * results.  `drain()` resolves once the queue is idle.
 *
 * @example
 *   const q = new AsyncQueue(2);
 *   const [a, b, c] = await Promise.all([
 *     q.enqueue(() => fetchA()),
 *     q.enqueue(() => fetchB()),
 *     q.enqueue(() => fetchC()),
 *   ]);
 */
export class AsyncQueue<T> {
  #concurrency: number;
  #running = 0;
  #pending = 0;
  #queue: Array<() => void> = [];
  #drainWaiters: Array<() => void> = [];

  /**
   * @param concurrency Maximum number of tasks that may run simultaneously
   *   (default 1 — serial execution).
   */
  constructor(concurrency = 1) {
    this.#concurrency = Math.max(1, concurrency);
  }

  /** Number of tasks waiting to start. */
  get pending(): number {
    return this.#pending;
  }

  /** Number of tasks currently running. */
  get running(): number {
    return this.#running;
  }

  /**
   * Add a task to the queue.  Resolves (or rejects) with the task's result
   * once it has been executed.
   */
  enqueue(task: () => Promise<T>): Promise<T> {
    this.#pending++;
    return new Promise<T>((resolve, reject) => {
      this.#queue.push(async () => {
        this.#pending--;
        this.#running++;
        try {
          resolve(await task());
        } catch (err) {
          reject(err);
        } finally {
          this.#running--;
          this.#dispatch();
        }
      });
      this.#dispatch();
    });
  }

  /**
   * Returns a promise that resolves once all currently enqueued and running
   * tasks have completed.  Resolves immediately if the queue is already idle.
   */
  drain(): Promise<void> {
    if (this.#running === 0 && this.#pending === 0) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.#drainWaiters.push(resolve);
    });
  }

  #dispatch(): void {
    while (this.#running < this.#concurrency && this.#queue.length > 0) {
      const next = this.#queue.shift()!;
      next();
    }
    if (this.#running === 0 && this.#pending === 0 && this.#drainWaiters.length > 0) {
      const waiters = this.#drainWaiters.splice(0);
      for (const w of waiters) w();
    }
  }
}
