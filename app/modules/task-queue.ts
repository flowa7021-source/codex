// @ts-check
// ─── Task Queue ───────────────────────────────────────────────────────────────
// Priority-based task queue with concurrency control.
// Tasks with higher priority values run first; equal-priority tasks run FIFO.

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task<T = unknown> {
  id: string;
  priority: number;
  fn: () => Promise<T>;
  status: TaskStatus;
  result?: T;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskQueueOptions {
  /** Max tasks running in parallel. Default: 1. */
  concurrency?: number;
  /** Task timeout in ms. Default: none. */
  timeout?: number;
}

// ─── TaskQueue ────────────────────────────────────────────────────────────────

export class TaskQueue {
  #tasks: Map<string, Task> = new Map();
  #concurrency: number;
  #timeout: number | undefined;
  #running = 0;
  #paused = false;
  #drainResolvers: Array<() => void> = [];
  #insertionCounter = 0;

  constructor(options: TaskQueueOptions = {}) {
    this.#concurrency = options.concurrency ?? 1;
    this.#timeout = options.timeout;
  }

  /**
   * Add a task to the queue. Returns its id.
   */
  add<T>(
    fn: () => Promise<T>,
    options: { id?: string; priority?: number } = {},
  ): string {
    const id = options.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const priority = options.priority ?? 0;

    const task: Task<T> = {
      id,
      priority,
      fn,
      status: 'pending',
      createdAt: this.#insertionCounter++,
    };

    // Store createdAt as insertion order for FIFO tie-breaking
    // We reuse createdAt for the wall-clock timestamp below after cast
    (task as Task<T> & { _insertOrder: number })._insertOrder = task.createdAt;
    task.createdAt = Date.now();

    this.#tasks.set(id, task as unknown as Task);
    this.#schedule();
    return id;
  }

  /**
   * Cancel a pending task. Returns true if it was cancelled.
   */
  cancel(id: string): boolean {
    const task = this.#tasks.get(id);
    if (!task || task.status !== 'pending') return false;
    task.status = 'cancelled';
    this.#checkDrain();
    return true;
  }

  /** Get a task by id. */
  get(id: string): Task | undefined {
    return this.#tasks.get(id);
  }

  /** Get all tasks. */
  getAll(): Task[] {
    return Array.from(this.#tasks.values());
  }

  /** Number of pending tasks. */
  get pendingCount(): number {
    let count = 0;
    for (const t of this.#tasks.values()) {
      if (t.status === 'pending') count++;
    }
    return count;
  }

  /** Number of running tasks. */
  get runningCount(): number {
    return this.#running;
  }

  /**
   * Resolves when no pending or running tasks remain.
   */
  drain(): Promise<void> {
    if (this.#running === 0 && this.pendingCount === 0) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.#drainResolvers.push(resolve);
    });
  }

  /** Remove completed and failed tasks from the internal map. */
  cleanup(): void {
    for (const [id, task] of this.#tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.#tasks.delete(id);
      }
    }
  }

  /** Pause — stops starting new tasks but does not interrupt running ones. */
  pause(): void {
    this.#paused = true;
  }

  /** Resume — starts processing pending tasks again. */
  resume(): void {
    this.#paused = false;
    this.#schedule();
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  #schedule(): void {
    if (this.#paused) return;
    while (this.#running < this.#concurrency) {
      const next = this.#nextPending();
      if (!next) break;
      this.#run(next);
    }
  }

  #nextPending(): Task | undefined {
    let best: Task | undefined;
    for (const task of this.#tasks.values()) {
      if (task.status !== 'pending') continue;
      if (!best) {
        best = task;
        continue;
      }
      if (task.priority > best.priority) {
        best = task;
      } else if (task.priority === best.priority) {
        // FIFO: lower insertion order wins
        const taskOrder = (task as Task & { _insertOrder?: number })._insertOrder ?? task.createdAt;
        const bestOrder = (best as Task & { _insertOrder?: number })._insertOrder ?? best.createdAt;
        if (taskOrder < bestOrder) {
          best = task;
        }
      }
    }
    return best;
  }

  #run(task: Task): void {
    task.status = 'running';
    task.startedAt = Date.now();
    this.#running++;

    let settled = false;

    const settle = (status: 'completed' | 'failed', result?: unknown, error?: Error) => {
      if (settled) return;
      settled = true;
      task.status = status;
      task.completedAt = Date.now();
      if (status === 'completed') task.result = result;
      if (status === 'failed') task.error = error;
      this.#running--;
      this.#checkDrain();
      this.#schedule();
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (this.#timeout !== undefined) {
      timeoutId = setTimeout(() => {
        settle('failed', undefined, new Error(`Task ${task.id} timed out after ${this.#timeout}ms`));
      }, this.#timeout);
    }

    Promise.resolve()
      .then(() => task.fn())
      .then(result => {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        settle('completed', result);
      })
      .catch((err: unknown) => {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        settle('failed', undefined, err instanceof Error ? err : new Error(String(err)));
      });
  }

  #checkDrain(): void {
    if (this.#running === 0 && this.pendingCount === 0) {
      const resolvers = this.#drainResolvers.splice(0);
      for (const resolve of resolvers) resolve();
    }
  }
}
