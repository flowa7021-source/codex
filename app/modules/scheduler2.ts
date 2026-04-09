// @ts-check
// ─── Scheduler2 ───────────────────────────────────────────────────────────────
// Cooperative task scheduler with named tasks, intervals, and one-shot support.
// Uses an injectable clock for full testability without real timers.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledTask {
  id: string;
  name: string;
  fn: () => void | Promise<void>;
  interval?: number;
  nextRun?: number;
}

export interface Scheduler2Options {
  /** Custom clock for testing. Default: Date.now. */
  clock?: () => number;
}

// ─── Internal task state ──────────────────────────────────────────────────────

interface InternalTask {
  id: string;
  name: string;
  fn: () => void | Promise<void>;
  /** Undefined means one-shot with no repeat. */
  interval?: number;
  nextRun: number;
  paused: boolean;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  _counter += 1;
  return `sched2-${_counter}`;
}

// ─── Scheduler2 ───────────────────────────────────────────────────────────────

export class Scheduler2 {
  #tasks: Map<string, InternalTask> = new Map();
  #clock: () => number;

  constructor(options?: Scheduler2Options) {
    this.#clock = options?.clock ?? (() => Date.now());
  }

  /**
   * Schedule a named task.
   * @param name       Human-readable label for the task.
   * @param fn         Function to run (sync or async).
   * @param intervalMs If provided, the task repeats every `intervalMs` ms.
   *                   If omitted, the task runs once immediately on the next
   *                   `runDue()` call.
   * @returns Unique task id.
   */
  schedule(
    name: string,
    fn: () => void | Promise<void>,
    intervalMs?: number,
  ): string {
    const id = generateId();
    const now = this.#clock();

    const task: InternalTask = {
      id,
      name,
      fn,
      interval: intervalMs,
      nextRun: now + (intervalMs ?? 0),
      paused: false,
    };

    this.#tasks.set(id, task);
    return id;
  }

  /**
   * Schedule a one-shot task to run at a specific timestamp.
   * @param name      Human-readable label.
   * @param fn        Function to run.
   * @param timestamp Unix timestamp (ms) at which to run the task.
   * @returns Unique task id.
   */
  scheduleAt(
    name: string,
    fn: () => void | Promise<void>,
    timestamp: number,
  ): string {
    const id = generateId();

    const task: InternalTask = {
      id,
      name,
      fn,
      interval: undefined,
      nextRun: timestamp,
      paused: false,
    };

    this.#tasks.set(id, task);
    return id;
  }

  /**
   * Cancel a task by id.
   * @returns true if the task was found and removed, false otherwise.
   */
  cancel(id: string): boolean {
    return this.#tasks.delete(id);
  }

  /**
   * Pause a task — it will be skipped by `runDue()` until resumed.
   * No-op if the task does not exist.
   */
  pause(id: string): void {
    const task = this.#tasks.get(id);
    if (task) task.paused = true;
  }

  /**
   * Resume a previously paused task.
   * No-op if the task does not exist.
   */
  resume(id: string): void {
    const task = this.#tasks.get(id);
    if (task) task.paused = false;
  }

  /**
   * Run all tasks whose `nextRun` time is <= now (and are not paused).
   * One-shot tasks are removed after running; repeating tasks are rescheduled.
   */
  async runDue(): Promise<void> {
    const now = this.#clock();
    const due: InternalTask[] = [];

    for (const task of this.#tasks.values()) {
      if (!task.paused && task.nextRun <= now) {
        due.push(task);
      }
    }

    for (const task of due) {
      // Re-check: a previous task run may have cancelled this one
      if (!this.#tasks.has(task.id)) continue;

      if (task.interval !== undefined && task.interval > 0) {
        // Reschedule before running so the task can cancel itself
        task.nextRun = now + task.interval;
      } else {
        // One-shot: remove before running
        this.#tasks.delete(task.id);
      }

      try {
        await task.fn();
      } catch {
        // Task errors are silently swallowed so other due tasks can still run.
      }
    }
  }

  /**
   * Get a snapshot of all pending tasks (paused and active).
   */
  pending(): ScheduledTask[] {
    return Array.from(this.#tasks.values()).map((t) => ({
      id: t.id,
      name: t.name,
      fn: t.fn,
      interval: t.interval,
      nextRun: t.nextRun,
    }));
  }

  /**
   * Remove all scheduled tasks.
   */
  clear(): void {
    this.#tasks.clear();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new Scheduler2 instance.
 *
 * @example
 *   const scheduler = createScheduler2({ clock: () => fakeTime });
 *   const id = scheduler.schedule('ping', pingServer, 5000);
 *   await scheduler.runDue();
 */
export function createScheduler2(options?: Scheduler2Options): Scheduler2 {
  return new Scheduler2(options);
}
