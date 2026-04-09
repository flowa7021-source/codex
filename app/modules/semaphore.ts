// @ts-check
// ─── Counting Semaphore ─────────────────────────────────────────────────────
// Limits concurrent access to a shared resource by N permits.
// Used for throttling parallel async operations (e.g. tile rendering, fetches).

/**
 * Counting semaphore for concurrency control.
 * Up to `permits` holders can proceed concurrently; additional callers wait.
 *
 * @example
 *   const sem = new Semaphore(3);
 *   async function throttled() {
 *     await sem.acquire();
 *     try { await doWork(); }
 *     finally { sem.release(); }
 *   }
 */
export class Semaphore {
  #max: number;
  #available: number;
  #queue: Array<() => void> = [];

  constructor(permits: number) {
    if (!Number.isInteger(permits) || permits < 1) {
      throw new RangeError('permits must be a positive integer');
    }
    this.#max = permits;
    this.#available = permits;
  }

  /**
   * Acquire a permit. Resolves immediately if one is available,
   * otherwise waits in FIFO order until a permit is released.
   */
  acquire(): Promise<void> {
    if (this.#available > 0) {
      this.#available--;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.#queue.push(resolve);
    });
  }

  /**
   * Try to acquire a permit without waiting.
   * @returns `true` if a permit was acquired, `false` otherwise.
   */
  tryAcquire(): boolean {
    if (this.#available > 0) {
      this.#available--;
      return true;
    }
    return false;
  }

  /**
   * Release a permit. If waiters are queued, the next one is woken.
   * Throws if releasing would exceed the max permits (unbalanced release).
   */
  release(): void {
    if (this.#available + this.#queue.length >= this.#max) {
      // All permits accounted for — releasing without a matching acquire
      if (this.#queue.length === 0 && this.#available >= this.#max) {
        throw new Error('release called without a matching acquire');
      }
    }
    if (this.#queue.length > 0) {
      const next = this.#queue.shift()!;
      // Wake the next waiter asynchronously to avoid re-entrancy issues
      Promise.resolve().then(next);
    } else {
      this.#available++;
    }
  }

  /** Number of permits currently available. */
  get available(): number {
    return this.#available;
  }

  /** Number of callers waiting to acquire a permit. */
  get waiting(): number {
    return this.#queue.length;
  }

  /** Maximum number of permits (as configured in the constructor). */
  get permits(): number {
    return this.#max;
  }
}

/**
 * Factory function for creating a Semaphore.
 * @param permits - maximum concurrent holders
 */
export function createSemaphore(permits: number): Semaphore {
  return new Semaphore(permits);
}
