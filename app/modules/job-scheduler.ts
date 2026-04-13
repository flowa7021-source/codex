// @ts-check
// ─── Job Scheduler ────────────────────────────────────────────────────────────
// Interval-based job scheduler. Runs jobs when their nextRun time is reached.
// Designed to be testable: expose tick() for manual advancement in tests.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  name: string;
  fn: () => void | Promise<void>;
  interval: number;
  runImmediately?: boolean;
  lastRun?: number;
  nextRun: number;
  enabled: boolean;
  runCount: number;
}

export interface JobSchedulerOptions {
  /** Custom clock function for testing. Default: Date.now. */
  now?: () => number;
  /** Tick interval in ms. Default: 100. */
  tickInterval?: number;
}

// ─── JobScheduler ─────────────────────────────────────────────────────────────

export class JobScheduler {
  #jobs: Map<string, Job> = new Map();
  #now: () => number;
  #tickInterval: number;
  #timerId: ReturnType<typeof setInterval> | undefined;
  #running = false;

  constructor(options: JobSchedulerOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#tickInterval = options.tickInterval ?? 100;
  }

  /**
   * Register a job. Returns its id.
   */
  register(options: {
    id?: string;
    name: string;
    fn: () => void | Promise<void>;
    interval: number;
    runImmediately?: boolean;
  }): string {
    const id = options.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = this.#now();

    const job: Job = {
      id,
      name: options.name,
      fn: options.fn,
      interval: options.interval,
      runImmediately: options.runImmediately ?? false,
      nextRun: options.runImmediately ? now : now + options.interval,
      enabled: true,
      runCount: 0,
    };

    this.#jobs.set(id, job);
    return id;
  }

  /** Remove a job by id. */
  unregister(id: string): void {
    this.#jobs.delete(id);
  }

  /** Enable or disable a job. */
  setEnabled(id: string, enabled: boolean): void {
    const job = this.#jobs.get(id);
    if (job) job.enabled = enabled;
  }

  /** Get a job by id. */
  get(id: string): Job | undefined {
    return this.#jobs.get(id);
  }

  /** Get all registered jobs. */
  getAll(): Job[] {
    return Array.from(this.#jobs.values());
  }

  /**
   * Manually trigger a job regardless of its schedule or enabled state.
   */
  async trigger(id: string): Promise<void> {
    const job = this.#jobs.get(id);
    if (!job) return;
    await this.#runJob(job);
  }

  /**
   * Start the scheduler — calls tick on each tickInterval.
   * Uses real setInterval; for tests use tick() manually instead.
   */
  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#timerId = setInterval(() => {
      void this.tick();
    }, this.#tickInterval);
  }

  /** Stop the scheduler. */
  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timerId !== undefined) {
      clearInterval(this.#timerId);
      this.#timerId = undefined;
    }
  }

  /**
   * Check all jobs and run any that are due. Safe to call manually in tests.
   */
  async tick(): Promise<void> {
    const now = this.#now();
    const due: Job[] = [];

    for (const job of this.#jobs.values()) {
      if (job.enabled && now >= job.nextRun) {
        due.push(job);
      }
    }

    await Promise.all(due.map(job => this.#runJob(job)));
  }

  get isRunning(): boolean {
    return this.#running;
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  async #runJob(job: Job): Promise<void> {
    const now = this.#now();
    job.lastRun = now;
    job.nextRun = now + job.interval;
    job.runCount++;
    try {
      await Promise.resolve(job.fn());
    } catch {
      // Swallow errors — callers can attach their own error handling inside fn
    }
  }
}
