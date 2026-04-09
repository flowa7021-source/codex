// @ts-check
// ─── Task Scheduler ──────────────────────────────────────────────────────────
// Priority-aware task scheduler with delay and repeat support.
// Designed for testability: tick(now) drives execution without real timers.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string;
  fn: () => void | Promise<void>;
  priority: number;
  delay: number;
  /** Repeat interval in ms. 0 = no repeat. */
  repeat: number;
  runCount: number;
  /** Unix timestamp (ms) at which task should next run. */
  nextRun: number;
  cancelled: boolean;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class Scheduler {
  #tasks = new Map<string, ScheduledTask>();
  #idCounter = 0;

  // ─── Internal helpers ──────────────────────────────────────────────────────

  #nextId(): string {
    return `task-${++this.#idCounter}`;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Schedule a one-shot task.
   * @param fn       Function to run (sync or async).
   * @param options  delay (ms before run, default 0), priority (higher runs first, default 0).
   * @returns Task id.
   */
  schedule(
    fn: () => void | Promise<void>,
    options?: { delay?: number; priority?: number },
  ): string {
    const id = this.#nextId();
    const delay = options?.delay ?? 0;
    const priority = options?.priority ?? 0;
    const now = Date.now();

    const task: ScheduledTask = {
      id,
      fn,
      priority,
      delay,
      repeat: 0,
      runCount: 0,
      nextRun: now + delay,
      cancelled: false,
    };

    this.#tasks.set(id, task);
    return id;
  }

  /**
   * Schedule a repeating task.
   * @param fn        Function to run on each interval.
   * @param interval  Time in ms between runs.
   * @param options   priority (default 0), delay (initial delay, default 0).
   * @returns Task id.
   */
  repeat(
    fn: () => void | Promise<void>,
    interval: number,
    options?: { priority?: number; delay?: number },
  ): string {
    const id = this.#nextId();
    const delay = options?.delay ?? 0;
    const priority = options?.priority ?? 0;
    const now = Date.now();

    const task: ScheduledTask = {
      id,
      fn,
      priority,
      delay,
      repeat: interval,
      runCount: 0,
      nextRun: now + delay,
      cancelled: false,
    };

    this.#tasks.set(id, task);
    return id;
  }

  /**
   * Cancel a task by id.
   * @returns true if the task was found and cancelled, false otherwise.
   */
  cancel(id: string): boolean {
    const task = this.#tasks.get(id);
    if (!task) return false;
    task.cancelled = true;
    this.#tasks.delete(id);
    return true;
  }

  /** Cancel all pending tasks. */
  cancelAll(): void {
    for (const task of this.#tasks.values()) {
      task.cancelled = true;
    }
    this.#tasks.clear();
  }

  /**
   * Run all tasks whose nextRun <= now.
   * Tasks are executed in descending priority order (higher number = higher priority).
   * Repeating tasks are rescheduled; one-shot tasks are removed.
   * @param now  Current timestamp in ms. Defaults to Date.now().
   */
  async tick(now: number = Date.now()): Promise<void> {
    // Collect due tasks (not cancelled)
    const due: ScheduledTask[] = [];
    for (const task of this.#tasks.values()) {
      if (!task.cancelled && task.nextRun <= now) {
        due.push(task);
      }
    }

    // Sort: higher priority first; equal priority preserves insertion order (stable)
    due.sort((a, b) => b.priority - a.priority);

    for (const task of due) {
      // Re-check cancellation (a task run may cancel another)
      if (task.cancelled || !this.#tasks.has(task.id)) continue;

      task.runCount++;

      if (task.repeat > 0) {
        // Reschedule before running so the task can cancel itself
        task.nextRun = now + task.repeat;
      } else {
        // One-shot: remove before running
        this.#tasks.delete(task.id);
      }

      await task.fn();
    }
  }

  /** Number of active (non-cancelled) pending tasks. */
  get pendingCount(): number {
    return this.#tasks.size;
  }
}
