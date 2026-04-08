// @ts-check
// ─── Request Queue ────────────────────────────────────────────────────────────
// Concurrency-limited async task queue with priority ordering.
// Used to throttle outgoing HTTP requests and parallel OCR jobs so the browser
// is never overwhelmed by too many simultaneous operations.

// ─── Internal types ──────────────────────────────────────────────────────────

interface QueueEntry<T> {
  task: () => Promise<T>;
  priority: number;
  /** Insertion sequence — lower means earlier (FIFO tiebreaker). */
  seq: number;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

// ─── RequestQueue ─────────────────────────────────────────────────────────────

/**
 * A queue that limits the number of concurrently-running async operations.
 *
 * Tasks are dequeued in priority order (higher number = higher priority).
 * Equal-priority tasks run in FIFO order. Tasks added while the queue is
 * {@link pause paused} accumulate and run once {@link resume} is called.
 *
 * @example
 *   const q = new RequestQueue(2); // at most 2 concurrent tasks
 *   const result = await q.add(() => fetch('/api/page/1').then(r => r.json()));
 *   await q.drain(); // wait for all in-flight tasks
 */
export class RequestQueue {
  readonly concurrency: number;

  #running = 0;
  #seq = 0;
  #paused = false;
  /** Min-heap sorted so highest priority + lowest seq comes first. */
  #pending: QueueEntry<unknown>[] = [];
  /** Resolvers waiting on drain(). */
  #drainWaiters: Array<() => void> = [];

  constructor(concurrency = 4) {
    if (concurrency < 1) throw new RangeError('RequestQueue concurrency must be >= 1');
    this.concurrency = concurrency;
  }

  // ─── Public properties ────────────────────────────────────────────────────

  /** Number of tasks waiting to start. */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** Number of tasks currently running. */
  get runningCount(): number {
    return this.#running;
  }

  /** Whether the queue is currently paused. */
  get isPaused(): boolean {
    return this.#paused;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Add a task to the queue.
   * Returns a promise that resolves/rejects with the task's result.
   *
   * @param task - Async function to run
   * @param priority - Higher numbers run first (default 0); equal priority is FIFO
   */
  add<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry<T> = {
        task,
        priority,
        seq: this.#seq++,
        resolve,
        reject,
      };
      this.#enqueue(entry as unknown as QueueEntry<unknown>);
      this.#tick();
    });
  }

  /**
   * Clear all pending (not yet started) tasks.
   * Each cleared task's promise is rejected with a `DOMException` named
   * `'AbortError'` (same convention as `AbortController`).
   */
  clearPending(): void {
    const cleared = this.#pending.splice(0);
    for (const entry of cleared) {
      entry.reject(new DOMException('Task cleared from queue', 'AbortError'));
    }
  }

  /**
   * Pause processing. Currently-running tasks continue to completion.
   * New tasks may still be `add`ed; they will start once `resume()` is called.
   */
  pause(): void {
    this.#paused = true;
  }

  /**
   * Resume processing after a `pause()`.
   */
  resume(): void {
    this.#paused = false;
    this.#tick();
  }

  /**
   * Returns a promise that resolves once all currently pending and running
   * tasks have completed (i.e. `pendingCount + runningCount === 0`).
   * If the queue is already empty, resolves immediately.
   */
  drain(): Promise<void> {
    if (this.#running === 0 && this.#pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.#drainWaiters.push(resolve);
    });
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /** Insert entry into the pending list maintaining priority order. */
  #enqueue(entry: QueueEntry<unknown>): void {
    // Binary-insert so the list stays sorted: highest priority first,
    // then lowest seq (FIFO) for ties.
    let lo = 0;
    let hi = this.#pending.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const m = this.#pending[mid];
      if (
        m.priority > entry.priority ||
        (m.priority === entry.priority && m.seq < entry.seq)
      ) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this.#pending.splice(lo, 0, entry);
  }

  /** Start as many tasks as concurrency and pause state allow. */
  #tick(): void {
    while (!this.#paused && this.#running < this.concurrency && this.#pending.length > 0) {
      const entry = this.#pending.shift()!;
      this.#running++;
      entry.task().then(
        (result) => {
          entry.resolve(result);
          this.#onTaskDone();
        },
        (err) => {
          entry.reject(err);
          this.#onTaskDone();
        },
      );
    }
  }

  /** Called when a running task finishes (success or failure). */
  #onTaskDone(): void {
    this.#running--;
    this.#tick();
    if (this.#running === 0 && this.#pending.length === 0) {
      const waiters = this.#drainWaiters.splice(0);
      for (const resolve of waiters) resolve();
    }
  }
}
