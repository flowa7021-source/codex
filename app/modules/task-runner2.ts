// @ts-check
// ─── TaskRunner2 ──────────────────────────────────────────────────────────────
// Parallel task runner with dependency resolution and concurrency control.
// Tasks run as soon as their deps complete; concurrency limits simultaneous work.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Task<T = unknown> {
  id: string;
  fn: () => Promise<T>;
  /** IDs of tasks that must complete successfully before this one runs. */
  deps?: string[];
  /** Optional timeout in ms. Task result becomes 'timeout' if exceeded. */
  timeout?: number;
}

export type TaskStatus = 'success' | 'error' | 'timeout';

export interface TaskResult<T = unknown> {
  id: string;
  value?: T;
  error?: Error;
  duration: number;
  status: TaskStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wrap a promise with a timeout. Resolves with the original value or rejects
 * with a timeout error after `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error(`Task timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (val) => {
        clearTimeout(timerId);
        resolve(val);
      },
      (err: unknown) => {
        clearTimeout(timerId);
        reject(err);
      },
    );
  });
}

// ─── TaskRunner2 ──────────────────────────────────────────────────────────────

export class TaskRunner2 {
  #tasks: Map<string, Task<unknown>> = new Map();
  #concurrency: number;

  constructor(options?: { concurrency?: number }) {
    this.#concurrency = options?.concurrency ?? Infinity;
  }

  /**
   * Add a task to the runner. Throws if a task with the same id already exists.
   */
  add<T>(task: Task<T>): void {
    if (this.#tasks.has(task.id)) {
      throw new Error(`Task with id "${task.id}" already exists`);
    }
    this.#tasks.set(task.id, task as Task<unknown>);
  }

  /**
   * Run all registered tasks, respecting dependency order and concurrency.
   * Tasks whose deps failed or timed out are skipped with an error result.
   * @returns Map from task id → TaskResult.
   */
  async run(): Promise<Map<string, TaskResult<unknown>>> {
    const results = new Map<string, TaskResult<unknown>>();

    if (this.#tasks.size === 0) return results;

    // Build a working copy of tasks as an array
    const remaining = new Map<string, Task<unknown>>(this.#tasks);
    const inFlight = new Set<string>();
    const failed = new Set<string>();

    await new Promise<void>((resolveAll) => {
      const trySchedule = () => {
        if (remaining.size === 0 && inFlight.size === 0) {
          resolveAll();
          return;
        }

        for (const [id, task] of remaining) {
          if (inFlight.size >= this.#concurrency) break;

          // Check if any dependency has failed
          const blockedByFailure = task.deps?.some((dep) => failed.has(dep));
          if (blockedByFailure) {
            remaining.delete(id);
            results.set(id, {
              id,
              error: new Error(
                `Skipped: dependency failed — ${task.deps?.find((d) => failed.has(d))}`,
              ),
              duration: 0,
              status: 'error',
            });
            // Don't recurse inside the loop — schedule on next microtask
            Promise.resolve().then(trySchedule);
            continue;
          }

          // Check if all deps have completed successfully
          const depsReady = (task.deps ?? []).every(
            (dep) => results.has(dep) && results.get(dep)!.status === 'success',
          );

          // Check if any dep is still pending (not yet completed)
          const depsPending = (task.deps ?? []).some(
            (dep) => !results.has(dep) && !failed.has(dep),
          );

          if (!depsReady && !blockedByFailure) {
            // Some deps still running — cannot start yet
            if (depsPending || (task.deps ?? []).some((dep) => inFlight.has(dep))) {
              continue;
            }
          }

          if (!depsReady) continue;

          remaining.delete(id);
          inFlight.add(id);

          this.#runOne(task).then((result) => {
            results.set(id, result);
            inFlight.delete(id);

            if (result.status !== 'success') {
              failed.add(id);
            }

            trySchedule();
          });
        }

        // If nothing is in flight and tasks remain, they are all blocked by
        // failed deps — resolve them as errors.
        if (inFlight.size === 0 && remaining.size > 0) {
          for (const [id, task] of remaining) {
            const blockedDep = task.deps?.find((dep) => failed.has(dep)) ??
              task.deps?.find((dep) => !results.has(dep) && !remaining.has(dep));
            results.set(id, {
              id,
              error: new Error(
                `Skipped: dependency failed — ${blockedDep ?? 'unknown'}`,
              ),
              duration: 0,
              status: 'error',
            });
          }
          remaining.clear();
          resolveAll();
        }
      };

      trySchedule();
    });

    return results;
  }

  /**
   * Run a single registered task by id, ignoring its deps.
   * @returns TaskResult for that task.
   */
  async runOne<T>(id: string): Promise<TaskResult<T>> {
    const task = this.#tasks.get(id);
    if (!task) {
      return {
        id,
        error: new Error(`Task "${id}" not found`),
        duration: 0,
        status: 'error',
      } as TaskResult<T>;
    }
    return this.#runOne(task) as Promise<TaskResult<T>>;
  }

  /** Remove all registered tasks. */
  clear(): void {
    this.#tasks.clear();
  }

  /** Returns true if a task with the given id is registered. */
  has(id: string): boolean {
    return this.#tasks.has(id);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  async #runOne(task: Task<unknown>): Promise<TaskResult<unknown>> {
    const start = Date.now();

    let promise = task.fn();
    if (task.timeout !== undefined && task.timeout > 0) {
      promise = withTimeout(promise, task.timeout);
    }

    try {
      const value = await promise;
      return {
        id: task.id,
        value,
        duration: Date.now() - start,
        status: 'success',
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const isTimeout = error.message.startsWith('Task timed out after');

      return {
        id: task.id,
        error,
        duration: Date.now() - start,
        status: isTimeout ? 'timeout' : 'error',
      };
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new TaskRunner2 instance.
 *
 * @example
 *   const runner = createTaskRunner2({ concurrency: 4 });
 *   runner.add({ id: 'fetch', fn: () => fetchData() });
 *   const results = await runner.run();
 */
export function createTaskRunner2(options?: { concurrency?: number }): TaskRunner2 {
  return new TaskRunner2(options);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Run an array of async functions in parallel (all start at the same time).
 * Waits for all to settle and collects their results in order.
 * Throws if any function rejects.
 *
 * @example
 *   const results = await parallel(() => fetch('/a'), () => fetch('/b'));
 */
export async function parallel<T>(
  ...fns: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(fns.map((fn) => fn()));
}

/**
 * Run an array of async functions one after another (in sequence).
 * Each function waits for the previous to complete before starting.
 * Throws immediately if any function rejects.
 *
 * @example
 *   const results = await sequential(() => step1(), () => step2());
 */
export async function sequential<T>(
  ...fns: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  for (const fn of fns) {
    results.push(await fn());
  }
  return results;
}
