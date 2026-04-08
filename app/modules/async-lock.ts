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
  #locked = false;
  #queue: Array<() => void> = [];

  /**
   * Acquire the lock. Resolves with a release function.
   * If the lock is held, the caller waits until it's released.
   * @returns release function — MUST be called in finally
   */
  acquire(): Promise<() => void> {
    if (!this.#locked) {
      this.#locked = true;
      return Promise.resolve(this.#createRelease());
    }
    return new Promise(resolve => {
      this.#queue.push(() => resolve(this.#createRelease()));
    });
  }

  #createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.#queue.length > 0) {
        const next = this.#queue.shift()!;
        Promise.resolve().then(next);
      } else {
        this.#locked = false;
      }
    };
  }

  /** Whether the lock is currently held. */
  get isLocked(): boolean {
    return this.#locked;
  }

  /** Number of waiters in the queue. */
  get queueLength(): number {
    return this.#queue.length;
  }
}
