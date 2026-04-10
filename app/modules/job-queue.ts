// @ts-check
// ─── Priority Job Queue ───────────────────────────────────────────────────────
// A concurrency-limited job queue with priority ordering and retry support.

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'retrying';

export interface Job<T = unknown> {
  id: string;
  payload: T;
  priority: number;   // higher = runs first
  maxRetries: number;
  retryDelay: number; // ms
  attempts: number;
  status: JobStatus;
  error?: Error;
  result?: unknown;
}

export interface JobQueueOptions {
  concurrency: number;
  defaultPriority?: number;
  defaultMaxRetries?: number;
  defaultRetryDelay?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;

function generateId(): string {
  return `job-${Date.now()}-${++_idCounter}`;
}

// ─── JobQueue ─────────────────────────────────────────────────────────────────

export class JobQueue<T = unknown> {
  readonly #handler: (job: Job<T>) => Promise<unknown>;
  readonly #concurrency: number;
  readonly #defaultPriority: number;
  readonly #defaultMaxRetries: number;
  readonly #defaultRetryDelay: number;

  /** All jobs, keyed by id */
  readonly #jobs: Map<string, Job<T>> = new Map();

  /** Pending job ids ordered by insertion; sorted before each dispatch */
  readonly #pending: string[] = [];

  #running: number = 0;
  #completed: number = 0;
  #failed: number = 0;

  #started: boolean = false;
  #stopping: boolean = false;
  #drainResolvers: (() => void)[] = [];

  constructor(
    handler: (job: Job<T>) => Promise<unknown>,
    options?: JobQueueOptions,
  ) {
    this.#handler = handler;
    this.#concurrency      = options?.concurrency      ?? 1;
    this.#defaultPriority  = options?.defaultPriority  ?? 0;
    this.#defaultMaxRetries = options?.defaultMaxRetries ?? 0;
    this.#defaultRetryDelay = options?.defaultRetryDelay ?? 0;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Add a job. Returns its id. */
  enqueue(
    payload: T,
    options?: Partial<Pick<Job<T>, 'priority' | 'maxRetries' | 'retryDelay'>>,
  ): string {
    if (this.#stopping) throw new Error('Queue is stopping; no new jobs accepted');

    const id = generateId();
    const job: Job<T> = {
      id,
      payload,
      priority:   options?.priority   ?? this.#defaultPriority,
      maxRetries: options?.maxRetries  ?? this.#defaultMaxRetries,
      retryDelay: options?.retryDelay  ?? this.#defaultRetryDelay,
      attempts: 0,
      status: 'pending',
    };
    this.#jobs.set(id, job);
    this.#pending.push(id);
    this.#dispatch();
    return id;
  }

  /** Remove a pending job by id. Returns false if not found or already running. */
  cancel(id: string): boolean {
    const job = this.#jobs.get(id);
    if (!job || job.status !== 'pending') return false;
    const idx = this.#pending.indexOf(id);
    if (idx === -1) return false;
    this.#pending.splice(idx, 1);
    this.#jobs.delete(id);
    return true;
  }

  /** Get job by id. */
  get(id: string): Job<T> | undefined {
    return this.#jobs.get(id);
  }

  /** Start processing. */
  start(): void {
    this.#started = true;
    this.#dispatch();
  }

  /**
   * Stop accepting new jobs (finish running ones).
   * Returns a promise that resolves when the queue is drained.
   */
  stop(): Promise<void> {
    this.#stopping = true;
    if (this.#running === 0 && this.#pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.#drainResolvers.push(resolve);
    });
  }

  // ─── Counters ────────────────────────────────────────────────────────────────

  get pending(): number  { return this.#pending.length; }
  get running(): number  { return this.#running; }
  get completed(): number { return this.#completed; }
  get failed(): number   { return this.#failed; }

  // ─── Internal ────────────────────────────────────────────────────────────────

  #dispatch(): void {
    if (!this.#started) return;
    while (this.#running < this.#concurrency && this.#pending.length > 0) {
      // Sort pending by priority descending before picking next
      this.#pending.sort((a, b) => {
        const ja = this.#jobs.get(a);
        const jb = this.#jobs.get(b);
        return (jb?.priority ?? 0) - (ja?.priority ?? 0);
      });
      const id = this.#pending.shift()!;
      const job = this.#jobs.get(id);
      if (!job) continue;
      this.#runJob(job);
    }
  }

  #runJob(job: Job<T>): void {
    job.status = 'running';
    job.attempts += 1;
    this.#running += 1;

    Promise.resolve()
      .then(() => this.#handler(job))
      .then(result => {
        job.result = result;
        job.status = 'done';
        this.#running -= 1;
        this.#completed += 1;
        this.#afterJob();
      })
      .catch((err: unknown) => {
        job.error = err instanceof Error ? err : new Error(String(err));
        this.#running -= 1;

        if (job.attempts <= job.maxRetries) {
          job.status = 'retrying';
          const delay = job.retryDelay;
          if (delay > 0) {
            setTimeout(() => {
              if (this.#jobs.has(job.id)) {
                job.status = 'pending';
                this.#pending.push(job.id);
                this.#dispatch();
              }
            }, delay);
          } else {
            job.status = 'pending';
            this.#pending.push(job.id);
            this.#dispatch();
          }
          this.#afterJob();
        } else {
          job.status = 'failed';
          this.#failed += 1;
          this.#afterJob();
        }
      });
  }

  #afterJob(): void {
    this.#dispatch();
    if (this.#stopping && this.#running === 0 && this.#pending.length === 0) {
      for (const resolve of this.#drainResolvers) resolve();
      this.#drainResolvers.length = 0;
    }
  }
}
