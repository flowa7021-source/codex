// @ts-check
// ─── Task Scheduler ───────────────────────────────────────────────────────────
// Priority-aware task scheduler with delays, recurring intervals, run limits,
// injectable clock for testing, and cron-like pattern helpers.

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskId = string;

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface TaskOptions {
  /** Higher value runs first (default 0). */
  priority?: number;
  /** Milliseconds before the first run (default 0). */
  delay?: number;
  /** Repeat every N ms. Omit for a one-shot task. */
  interval?: number;
  /** Maximum number of executions (default Infinity). */
  maxRuns?: number;
  /** Called when the task function throws (default: silent). */
  onError?: (err: Error) => void;
}

export interface TaskInfo {
  id: TaskId;
  priority: number;
  runCount: number;
  lastRunAt: number | null;
  nextRunAt: number;
  cancelled: boolean;
}

// ─── Internal task record ─────────────────────────────────────────────────────

interface Task {
  id: TaskId;
  fn: () => void | Promise<void>;
  priority: number;
  delay: number;
  interval: number | undefined;
  maxRuns: number;
  onError: ((err: Error) => void) | undefined;
  runCount: number;
  lastRunAt: number | null;
  nextRunAt: number;
  cancelled: boolean;
  timerId: unknown;
}

// ─── Unique id generator ──────────────────────────────────────────────────────

let _seq = 0;
function nextId(): TaskId {
  return `task-${++_seq}`;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class Scheduler {
  #clock: Clock;
  #tasks: Map<TaskId, Task> = new Map();

  constructor(clock?: Clock) {
    this.#clock = clock ?? {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    };
  }

  /**
   * Schedule a task. Returns a unique id that can be used to cancel it.
   */
  schedule(fn: () => void | Promise<void>, options?: TaskOptions): TaskId {
    const id = nextId();
    const priority = options?.priority ?? 0;
    const delay = options?.delay ?? 0;
    const interval = options?.interval;
    const maxRuns = options?.maxRuns ?? Infinity;
    const onError = options?.onError;
    const nextRunAt = this.#clock.now() + delay;

    const task: Task = {
      id,
      fn,
      priority,
      delay,
      interval,
      maxRuns,
      onError,
      runCount: 0,
      lastRunAt: null,
      nextRunAt,
      cancelled: false,
      timerId: null,
    };

    this.#tasks.set(id, task);
    this.#arm(task);
    return id;
  }

  /** Cancel a scheduled task. Returns true if it was found and cancelled. */
  cancel(id: TaskId): boolean {
    const task = this.#tasks.get(id);
    if (!task || task.cancelled) return false;
    task.cancelled = true;
    this.#clock.clearTimeout(task.timerId);
    return true;
  }

  /** Returns true if the task exists and has not been cancelled or exhausted. */
  isScheduled(id: TaskId): boolean {
    const task = this.#tasks.get(id);
    return task !== undefined && !task.cancelled;
  }

  /** Returns a snapshot of task metadata, or undefined if not found. */
  getTask(id: TaskId): TaskInfo | undefined {
    const task = this.#tasks.get(id);
    if (!task) return undefined;
    return {
      id: task.id,
      priority: task.priority,
      runCount: task.runCount,
      lastRunAt: task.lastRunAt,
      nextRunAt: task.nextRunAt,
      cancelled: task.cancelled,
    };
  }

  /**
   * All pending (non-cancelled) task ids sorted by priority descending,
   * then by nextRunAt ascending.
   */
  get pending(): TaskId[] {
    const active: Task[] = [];
    for (const task of this.#tasks.values()) {
      if (!task.cancelled) active.push(task);
    }
    active.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.nextRunAt - b.nextRunAt;
    });
    return active.map((t) => t.id);
  }

  /** Cancel every scheduled task. */
  cancelAll(): void {
    for (const task of this.#tasks.values()) {
      if (!task.cancelled) {
        task.cancelled = true;
        this.#clock.clearTimeout(task.timerId);
      }
    }
  }

  /**
   * Run all tasks whose nextRunAt <= now (defaults to clock.now()).
   * Useful in unit tests with a mock clock that never fires real timers.
   */
  async tick(now?: number): Promise<void> {
    const at = now ?? this.#clock.now();
    const due: Task[] = [];
    for (const task of this.#tasks.values()) {
      if (!task.cancelled && task.nextRunAt <= at) {
        due.push(task);
      }
    }
    // Sort by priority desc, then nextRunAt asc — consistent with pending
    due.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.nextRunAt - b.nextRunAt;
    });
    for (const task of due) {
      await this.#runTask(task, at);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  #arm(task: Task): void {
    if (task.cancelled) return;
    const delay = Math.max(0, task.nextRunAt - this.#clock.now());
    task.timerId = this.#clock.setTimeout(() => {
      if (!task.cancelled) {
        void this.#runTask(task, this.#clock.now());
      }
    }, delay);
  }

  async #runTask(task: Task, at: number): Promise<void> {
    if (task.cancelled) return;
    // Clear any pending timer to avoid double-firing
    this.#clock.clearTimeout(task.timerId);
    task.timerId = null;

    task.runCount += 1;
    task.lastRunAt = at;

    try {
      await task.fn();
    } catch (err) {
      if (task.onError) {
        task.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    const exhausted = task.runCount >= task.maxRuns;
    if (exhausted || task.interval === undefined) {
      task.cancelled = true;
      return;
    }

    // Schedule next recurrence
    task.nextRunAt = at + task.interval;
    this.#arm(task);
  }
}

// ─── createScheduler factory ──────────────────────────────────────────────────

/** Convenience factory that returns a Scheduler with the default (real) clock. */
export function createScheduler(): Scheduler {
  return new Scheduler();
}

// ─── Cron helpers ─────────────────────────────────────────────────────────────

export interface CronFields {
  minute: number[];
  hour: number[];
  dom: number[];
  month: number[];
  dow: number[];
}

/**
 * Parse a 5-field cron pattern into arrays of allowed values.
 *
 * Supported syntax per field:
 *   - `*`        every value in range
 *   - `5`        single value
 *   - `1,3,5`    list
 *   - `1-5`      inclusive range
 *   - `*\/2`     step (every 2 within the full range)
 *   - `1-5\/2`   step within a range
 *
 * Field order:  minute  hour  day-of-month  month  day-of-week
 * Ranges:       0-59    0-23  1-31          1-12   0-6 (0 = Sunday)
 */
export function parseCronPattern(pattern: string): CronFields {
  const parts = pattern.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron pattern "${pattern}": expected 5 fields, got ${parts.length}`,
    );
  }

  const [minuteStr, hourStr, domStr, monthStr, dowStr] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  return {
    minute: parseField(minuteStr, 0, 59),
    hour: parseField(hourStr, 0, 23),
    dom: parseField(domStr, 1, 31),
    month: parseField(monthStr, 1, 12),
    dow: parseField(dowStr, 0, 6),
  };
}

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    if (stepMatch) {
      const [, rangePart, stepStr] = stepMatch as [string, string, string];
      const step = parseInt(stepStr, 10);
      const [lo, hi] =
        rangePart === '*' ? [min, max] : parseRange(rangePart, min, max);
      for (let v = lo; v <= hi; v += step) {
        values.add(v);
      }
      continue;
    }

    if (part === '*') {
      for (let v = min; v <= max; v++) values.add(v);
      continue;
    }

    const [lo, hi] = parseRange(part, min, max);
    for (let v = lo; v <= hi; v++) values.add(v);
  }

  return Array.from(values).sort((a, b) => a - b);
}

function parseRange(expr: string, min: number, max: number): [number, number] {
  const dashMatch = expr.match(/^(\d+)-(\d+)$/);
  if (dashMatch) {
    const lo = parseInt(dashMatch[1], 10);
    const hi = parseInt(dashMatch[2], 10);
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`Cron range "${expr}" is out of bounds [${min}-${max}]`);
    }
    return [lo, hi];
  }
  const v = parseInt(expr, 10);
  if (isNaN(v) || v < min || v > max) {
    throw new Error(`Cron value "${expr}" is out of bounds [${min}-${max}]`);
  }
  return [v, v];
}

/**
 * Return the next Date (strictly after `from`) that matches `pattern`.
 * Searches up to 4 years ahead before throwing.
 */
export function nextCronDate(pattern: string, from?: Date): Date {
  const fields = parseCronPattern(pattern);
  const start = from ?? new Date();

  // Advance by 1 minute so we are strictly *after* `from`
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const limit = new Date(cursor);
  limit.setFullYear(limit.getFullYear() + 4);

  while (cursor < limit) {
    // month is 1-based in cron, 0-based in JS Date
    if (!fields.month.includes(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.dom.includes(cursor.getDate())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.dow.includes(cursor.getDay())) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.hour.includes(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!fields.minute.includes(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }
    return new Date(cursor);
  }

  throw new Error(
    `No matching date found for cron pattern "${pattern}" within 4 years`,
  );
}
