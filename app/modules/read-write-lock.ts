// @ts-check
// ─── Read-Write Lock ────────────────────────────────────────────────────────
// Allows multiple concurrent readers OR a single exclusive writer.
// Writers are given priority over new readers to prevent write-starvation.

/**
 * Read-write lock. Multiple readers can hold the lock simultaneously,
 * but writers require exclusive access. Writers have priority over
 * new readers to prevent starvation.
 *
 * @example
 *   const rwLock = new ReadWriteLock();
 *   // Reader
 *   await rwLock.acquireRead();
 *   try { readData(); }
 *   finally { rwLock.releaseRead(); }
 *   // Writer
 *   await rwLock.acquireWrite();
 *   try { writeData(); }
 *   finally { rwLock.releaseWrite(); }
 */
export class ReadWriteLock {
  #readers = 0;
  #writer = false;
  #readQueue: Array<() => void> = [];
  #writeQueue: Array<() => void> = [];

  /**
   * Acquire a read lock. Multiple readers can hold simultaneously.
   * Waits if a writer holds the lock or writers are waiting (priority).
   */
  acquireRead(): Promise<void> {
    if (!this.#writer && this.#writeQueue.length === 0) {
      this.#readers++;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.#readQueue.push(resolve);
    });
  }

  /**
   * Release a read lock. If no readers remain and writers are waiting,
   * the next writer is woken.
   */
  releaseRead(): void {
    if (this.#readers <= 0) {
      throw new Error('releaseRead called without a matching acquireRead');
    }
    this.#readers--;
    if (this.#readers === 0 && this.#writeQueue.length > 0) {
      this.#writer = true;
      const next = this.#writeQueue.shift()!;
      Promise.resolve().then(next);
    }
  }

  /**
   * Acquire an exclusive write lock. Waits until all readers release
   * and no other writer holds the lock.
   */
  acquireWrite(): Promise<void> {
    if (!this.#writer && this.#readers === 0) {
      this.#writer = true;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.#writeQueue.push(resolve);
    });
  }

  /**
   * Release the write lock. Wakes waiting writers first (priority),
   * otherwise wakes all waiting readers.
   */
  releaseWrite(): void {
    if (!this.#writer) {
      throw new Error('releaseWrite called without a matching acquireWrite');
    }
    this.#writer = false;
    if (this.#writeQueue.length > 0) {
      // Give priority to the next writer
      this.#writer = true;
      const next = this.#writeQueue.shift()!;
      Promise.resolve().then(next);
    } else if (this.#readQueue.length > 0) {
      // Wake all waiting readers
      const readers = this.#readQueue.splice(0);
      this.#readers += readers.length;
      for (const resolve of readers) {
        Promise.resolve().then(resolve);
      }
    }
  }

  /** Number of active readers. */
  get readers(): number {
    return this.#readers;
  }

  /** Whether a writer currently holds the lock. */
  get isWriteLocked(): boolean {
    return this.#writer;
  }

  /** Number of readers waiting to acquire. */
  get waitingReaders(): number {
    return this.#readQueue.length;
  }

  /** Number of writers waiting to acquire. */
  get waitingWriters(): number {
    return this.#writeQueue.length;
  }
}

/**
 * Execute `fn` while holding a read lock, releasing it automatically.
 * @param lock - the ReadWriteLock instance
 * @param fn   - function to execute under the read lock
 */
export async function withReadLock<T>(
  lock: ReadWriteLock,
  fn: () => T | Promise<T>,
): Promise<T> {
  await lock.acquireRead();
  try {
    return await fn();
  } finally {
    lock.releaseRead();
  }
}

/**
 * Execute `fn` while holding a write lock, releasing it automatically.
 * @param lock - the ReadWriteLock instance
 * @param fn   - function to execute under the write lock
 */
export async function withWriteLock<T>(
  lock: ReadWriteLock,
  fn: () => T | Promise<T>,
): Promise<T> {
  await lock.acquireWrite();
  try {
    return await fn();
  } finally {
    lock.releaseWrite();
  }
}

/**
 * Factory function for creating a ReadWriteLock.
 */
export function createReadWriteLock(): ReadWriteLock {
  return new ReadWriteLock();
}
