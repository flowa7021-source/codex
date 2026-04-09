// @ts-check
// ─── Work Queue ──────────────────────────────────────────────────────────────
// Persistent work queue with job tracking, concurrency control, and retry
// support. Jobs survive stop/start cycles; state is held in-memory.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A job in the work queue.
 */
export interface Job<T = unknown> {
  id: string;
  data: T;
  status: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// ─── WorkQueue ───────────────────────────────────────────────────────────────

interface WorkQueueOptions<T> {
  processor: (job: Job<T>) => Promise<void>;
  concurrency?: number;
  maxAttempts?: number;
  onJobComplete?: (job: Job<T>) => void;
  onJobFail?: (job: Job<T>) => void;
}

/**
 * A work queue that processes jobs with configurable concurrency.
 *
 * Jobs are processed in FIFO order. Failed jobs (where the processor throws)
 * are retried up to `maxAttempts` times before being marked as `'failed'`.
 * The queue can be paused and resumed without losing pending jobs.
 *
 * @template T - The job data type.
 *
 * @example
 *   const queue = new WorkQueue({
 *     processor: async (job) => { await convertPage(job.data); },
 *     concurrency: 2,
 *   });
 *   queue.enqueue({ page: 1 });
 *   queue.start();
 *   await queue.drain();
 */
export class WorkQueue<T = unknown> {
  readonly concurrency: number;
  readonly #maxAttempts: number;
  readonly #processor: (job: Job<T>) => Promise<void>;
  readonly #onJobComplete: ((job: Job<T>) => void) | undefined;
  readonly #onJobFail: ((job: Job<T>) => void) | undefined;

  #jobs: Map<string, Job<T>> = new Map();
  #running = 0;
  #active = false;
  #drainResolvers: Array<() => void> = [];

  constructor(options: WorkQueueOptions<T>) {
    this.#processor = options.processor;
    this.concurrency = options.concurrency ?? 1;
    this.#maxAttempts = options.maxAttempts ?? 1;
    this.#onJobComplete = options.onJobComplete;
    this.#onJobFail = options.onJobFail;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Enqueue a new job. Returns the created job with `'pending'` status.
   * If an `id` is provided it is used as-is; otherwise a unique id is generated.
   */
  enqueue(data: T, id?: string): Job<T> {
    const jobId = id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const job: Job<T> = {
      id: jobId,
      data,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };
    this.#jobs.set(jobId, job);
    if (this.#active) {
      this.#tick();
    }
    return job;
  }

  /** Get all jobs (in insertion order). */
  getJobs(): Job<T>[] {
    return [...this.#jobs.values()];
  }

  /** Get a specific job by id. */
  getJob(id: string): Job<T> | undefined {
    return this.#jobs.get(id);
  }

  /** Get all jobs with a specific status. */
  getByStatus(status: Job<T>['status']): Job<T>[] {
    return [...this.#jobs.values()].filter((j) => j.status === status);
  }

  /** Start processing pending jobs. */
  start(): void {
    this.#active = true;
    this.#tick();
  }

  /**
   * Stop processing new jobs. Any currently running jobs complete normally;
   * pending jobs remain in the queue and will resume on `start()`.
   */
  stop(): void {
    this.#active = false;
  }

  /**
   * Wait for all currently enqueued jobs to reach a terminal state
   * (`'done'` or `'failed'`). Resolves immediately if the queue is already
   * empty. Does not automatically call `start()`.
   */
  drain(): Promise<void> {
    if (this.#allTerminal()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.#drainResolvers.push(resolve);
    });
  }

  /** Remove all jobs with status `'done'` or `'failed'`. */
  clearCompleted(): void {
    for (const [id, job] of this.#jobs) {
      if (job.status === 'done' || job.status === 'failed') {
        this.#jobs.delete(id);
      }
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  #allTerminal(): boolean {
    for (const job of this.#jobs.values()) {
      if (job.status === 'pending' || job.status === 'running') return false;
    }
    return true;
  }

  #tick(): void {
    if (!this.#active) return;

    while (this.#running < this.concurrency) {
      const job = this.#nextPending();
      if (!job) break;
      this.#process(job);
    }
  }

  #nextPending(): Job<T> | undefined {
    for (const job of this.#jobs.values()) {
      if (job.status === 'pending') return job;
    }
    return undefined;
  }

  #process(job: Job<T>): void {
    job.status = 'running';
    job.startedAt = Date.now();
    job.attempts += 1;
    this.#running++;

    Promise.resolve()
      .then(() => this.#processor(job))
      .then(() => {
        job.status = 'done';
        job.completedAt = Date.now();
        this.#onJobComplete?.(job);
      })
      .catch((err: unknown) => {
        if (job.attempts < this.#maxAttempts) {
          // Retry
          job.status = 'pending';
        } else {
          job.status = 'failed';
          job.completedAt = Date.now();
          job.error = err instanceof Error ? err.message : String(err);
          this.#onJobFail?.(job);
        }
      })
      .finally(() => {
        this.#running--;
        this.#tick();
        if (this.#allTerminal()) {
          for (const resolve of this.#drainResolvers) {
            resolve();
          }
          this.#drainResolvers = [];
        }
      });
  }
}
