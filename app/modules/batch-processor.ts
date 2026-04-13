// @ts-check
// ─── Batch Processor ──────────────────────────────────────────────────────────
// Collects individual items and processes them together in groups for
// efficiency. Supports configurable batch size, max-wait timeout, and
// concurrency limiting.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchProcessorOptions<T, R> {
  /** Function that processes a batch of items and returns results in the same order. */
  process: (batch: T[]) => Promise<R[]>;
  /** Maximum number of items per batch (default: 10). */
  batchSize?: number;
  /** Maximum milliseconds to wait before flushing a partial batch (default: 50). */
  maxWait?: number;
  /** Maximum number of batches that may be in-flight simultaneously (default: 1). */
  concurrency?: number;
}

/** @internal */
interface PendingItem<T, R> {
  item: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

// ─── BatchProcessor ───────────────────────────────────────────────────────────

/**
 * Collects individual items and processes them in batches for efficiency.
 *
 * Items added via `add()` are grouped into batches of up to `batchSize`
 * items, or flushed automatically after `maxWait` milliseconds, whichever
 * comes first.  The returned promise resolves with the result for that
 * specific item.
 *
 * @example
 *   const processor = new BatchProcessor({
 *     process: async (ids) => fetchUsers(ids),
 *     batchSize: 50,
 *     maxWait: 20,
 *   });
 *   const user = await processor.add(userId);
 */
export class BatchProcessor<T, R> {
  #process: (batch: T[]) => Promise<R[]>;
  #batchSize: number;
  #maxWait: number;
  #concurrency: number;

  #pending: Array<PendingItem<T, R>> = [];
  #timer: ReturnType<typeof setTimeout> | null = null;
  #activeCount = 0;
  #totalProcessed = 0;
  #destroyed = false;

  constructor(options: BatchProcessorOptions<T, R>) {
    this.#process = options.process;
    this.#batchSize = options.batchSize ?? 10;
    this.#maxWait = options.maxWait ?? 50;
    this.#concurrency = options.concurrency ?? 1;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Add an item to the next pending batch.
   * Returns a promise that resolves with the result for this specific item.
   */
  add(item: T): Promise<R> {
    if (this.#destroyed) {
      return Promise.reject(new Error('BatchProcessor has been destroyed'));
    }

    return new Promise<R>((resolve, reject) => {
      this.#pending.push({ item, resolve, reject });

      if (this.#pending.length >= this.#batchSize) {
        // Batch is full — flush immediately
        this.#clearTimer();
        this.#scheduledFlush();
      } else if (this.#timer === null) {
        // Start the max-wait timer for the first item in a new batch
        this.#timer = setTimeout(() => {
          this.#timer = null;
          this.#scheduledFlush();
        }, this.#maxWait);
      }
    });
  }

  /**
   * Immediately process all pending items without waiting for the timer or
   * the batch to fill.
   */
  async flush(): Promise<void> {
    this.#clearTimer();
    if (this.#pending.length > 0) {
      await this.#dispatchBatch(this.#pending.splice(0));
    }
  }

  /** Number of items waiting to be included in the next batch. */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** Number of batches currently being processed. */
  get processingCount(): number {
    return this.#activeCount;
  }

  /** Total number of items that have completed processing. */
  get totalProcessed(): number {
    return this.#totalProcessed;
  }

  /**
   * Cancel all pending items (rejecting their promises) and release resources.
   * After `destroy()`, calls to `add()` will reject immediately.
   */
  destroy(): void {
    this.#destroyed = true;
    this.#clearTimer();

    const pending = this.#pending.splice(0);
    for (const { reject } of pending) {
      reject(new Error('BatchProcessor destroyed'));
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Flush called from the timer or when the batch is full. */
  #scheduledFlush(): void {
    if (this.#pending.length === 0) return;

    if (this.#activeCount >= this.#concurrency) {
      // Over concurrency limit — a new timer will be scheduled once a batch
      // finishes via #drainQueue().
      return;
    }

    const batch = this.#pending.splice(0, this.#batchSize);
    void this.#dispatchBatch(batch);
  }

  /** Send a batch to the process function. */
  async #dispatchBatch(batch: Array<PendingItem<T, R>>): Promise<void> {
    if (batch.length === 0) return;

    this.#activeCount++;
    try {
      const items = batch.map(p => p.item);
      const results = await this.#process(items);

      if (results.length !== batch.length) {
        // Result count mismatch — reject all items in this batch.
        const err = new Error(
          `process() returned ${results.length} results for ${batch.length} items`,
        );
        for (const { reject } of batch) reject(err);
      } else {
        for (let i = 0; i < batch.length; i++) {
          batch[i].resolve(results[i]);
        }
        this.#totalProcessed += batch.length;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      for (const { reject } of batch) reject(error);
    } finally {
      this.#activeCount--;
      this.#drainQueue();
    }
  }

  /** After a batch finishes, check if pending items need dispatching. */
  #drainQueue(): void {
    if (this.#destroyed || this.#pending.length === 0) return;
    if (this.#activeCount >= this.#concurrency) return;

    // Dispatch the next batch immediately (or re-arm timer if < batchSize)
    if (this.#pending.length >= this.#batchSize) {
      const batch = this.#pending.splice(0, this.#batchSize);
      void this.#dispatchBatch(batch);
    } else if (this.#timer === null) {
      // Items waiting but not enough to fill a batch — use the timer
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.#scheduledFlush();
      }, this.#maxWait);
    }
  }

  #clearTimer(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory that creates a `BatchProcessor<T, R>`.
 *
 * @example
 *   const loader = createBatchProcessor({
 *     process: async (keys) => db.getMany(keys),
 *     batchSize: 100,
 *   });
 */
export function createBatchProcessor<T, R>(
  options: BatchProcessorOptions<T, R>,
): BatchProcessor<T, R> {
  return new BatchProcessor(options);
}
