// @ts-check
// ─── Progress Tracker ─────────────────────────────────────────────────────────
// Multi-task progress tracking with subscribe support.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressTask {
  id: string;
  label: string;
  progress: number;   // 0-100
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export interface ProgressSnapshot {
  tasks: ProgressTask[];
  overall: number;   // 0-100, weighted average
  done: boolean;     // all tasks done or errored
}

// ─── ProgressTracker ──────────────────────────────────────────────────────────

export class ProgressTracker {
  #tasks: Map<string, ProgressTask> = new Map();
  #subscribers: Set<(snapshot: ProgressSnapshot) => void> = new Set();

  /** Register a task. */
  add(id: string, label: string): void {
    this.#tasks.set(id, { id, label, progress: 0, status: 'pending' });
    this.#notify();
  }

  /** Start a task (status=running). */
  start(id: string): void {
    const task = this.#tasks.get(id);
    if (!task) return;
    task.status = 'running';
    this.#notify();
  }

  /** Update progress (0-100) for a task. */
  update(id: string, progress: number): void {
    const task = this.#tasks.get(id);
    if (!task) return;
    task.progress = Math.max(0, Math.min(100, progress));
    this.#notify();
  }

  /** Mark a task as done (progress=100). */
  complete(id: string): void {
    const task = this.#tasks.get(id);
    if (!task) return;
    task.progress = 100;
    task.status = 'done';
    this.#notify();
  }

  /** Mark a task as errored. */
  fail(id: string, error?: string): void {
    const task = this.#tasks.get(id);
    if (!task) return;
    task.status = 'error';
    if (error !== undefined) task.error = error;
    this.#notify();
  }

  /** Remove a task. */
  remove(id: string): void {
    this.#tasks.delete(id);
    this.#notify();
  }

  /** Reset all tasks. */
  reset(): void {
    this.#tasks.clear();
    this.#notify();
  }

  /** Current snapshot of all tasks and overall progress. */
  get snapshot(): ProgressSnapshot {
    const tasks = Array.from(this.#tasks.values()).map((t) => ({ ...t }));
    const count = tasks.length;
    const overall = count === 0 ? 0 : Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / count);
    const done = count > 0 && tasks.every((t) => t.status === 'done' || t.status === 'error');
    return { tasks, overall, done };
  }

  /** Subscribe to changes. Returns unsubscribe function. */
  subscribe(fn: (snapshot: ProgressSnapshot) => void): () => void {
    this.#subscribers.add(fn);
    return () => {
      this.#subscribers.delete(fn);
    };
  }

  #notify(): void {
    const snap = this.snapshot;
    for (const fn of this.#subscribers) {
      fn(snap);
    }
  }
}
