// @ts-check
// ─── Async Lock ─────────────────────────────────────────────────────────────
// Mutex for protecting async state transitions from race conditions.
// Used primarily by OCR background scan to prevent concurrent mutations.

/**
 * Simple async mutex. Only one holder at a time; others wait in FIFO queue.
 *
 * @example
 *   const lock = new AsyncLock();
 *   async function criticalSection() {
 *     const release = await lock.acquire();
 *     try { await doWork(); }
 *     finally { release(); }
 *   }
 */
export class AsyncLock {
  /** @type {boolean} */
  #locked = false;
  /** @type {Array<() => void>} */
  #queue = [];

  /**
   * Acquire the lock. Resolves with a release function.
   * If the lock is held, the caller waits until it's released.
   * @returns {Promise<() => void>} release function — MUST be called in finally
   */
  acquire() {
    if (!this.#locked) {
      this.#locked = true;
      return Promise.resolve(this.#createRelease());
    }
    return new Promise(resolve => {
      this.#queue.push(() => resolve(this.#createRelease()));
    });
  }

  /** @returns {() => void} */
  #createRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.#queue.length > 0) {
        const next = this.#queue.shift();
        next();
      } else {
        this.#locked = false;
      }
    };
  }

  /** Whether the lock is currently held. */
  get isLocked() {
    return this.#locked;
  }

  /** Number of waiters in the queue. */
  get queueLength() {
    return this.#queue.length;
  }
}
