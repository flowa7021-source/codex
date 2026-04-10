// @ts-check
// ─── Workflow Engine ──────────────────────────────────────────────────────────
// Sequential/parallel workflow execution with dependency ordering and
// circular dependency detection.

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface WorkflowTask {
  id: string;
  /** IDs of tasks that must complete before this one starts. */
  dependsOn?: string[];
  run: (ctx: Record<string, unknown>) => Promise<unknown>;
}

export interface WorkflowResult {
  status: 'completed' | 'failed';
  results: Map<string, unknown>;
  errors: Map<string, Error>;
  taskStatuses: Map<string, TaskStatus>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect cycles in the dependency graph using depth-first search.
 * Returns an array of cycles (each cycle is an array of task IDs).
 */
function detectCycles(tasks: WorkflowTask[]): string[][] {
  const deps = new Map<string, string[]>(
    tasks.map((t) => [t.id, t.dependsOn ?? []]),
  );

  const WHITE = 0; // unvisited
  const GRAY  = 1; // in current DFS path
  const BLACK = 2; // fully explored

  const color = new Map<string, number>(tasks.map((t) => [t.id, WHITE]));
  const parent = new Map<string, string | null>(tasks.map((t) => [t.id, null]));
  const cycles: string[][] = [];

  function dfs(id: string): void {
    color.set(id, GRAY);
    for (const dep of deps.get(id) ?? []) {
      if (!color.has(dep)) continue; // unknown dependency — ignore for cycle purposes
      if (color.get(dep) === GRAY) {
        // Found a back edge: reconstruct the cycle path
        const cycle: string[] = [dep];
        let cur: string | null = id;
        while (cur !== null && cur !== dep) {
          cycle.unshift(cur);
          cur = parent.get(cur) ?? null;
        }
        cycle.unshift(dep);
        cycles.push(cycle);
      } else if (color.get(dep) === WHITE) {
        parent.set(dep, id);
        dfs(dep);
      }
    }
    color.set(id, BLACK);
  }

  for (const task of tasks) {
    if (color.get(task.id) === WHITE) {
      dfs(task.id);
    }
  }

  return cycles;
}

/**
 * Build execution waves: each wave is a set of tasks whose dependencies are
 * all satisfied by previous waves.  Returns waves in order; tasks within
 * the same wave can run in parallel.
 */
function buildWaves(tasks: WorkflowTask[]): WorkflowTask[][] {
  const taskMap = new Map<string, WorkflowTask>(tasks.map((t) => [t.id, t]));
  const satisfied = new Set<string>();
  const remaining = new Set<string>(tasks.map((t) => t.id));
  const waves: WorkflowTask[][] = [];

  while (remaining.size > 0) {
    const wave: WorkflowTask[] = [];

    for (const id of remaining) {
      const task = taskMap.get(id)!;
      const deps = task.dependsOn ?? [];
      if (deps.every((d) => satisfied.has(d))) {
        wave.push(task);
      }
    }

    if (wave.length === 0) break; // Circular — stop here; remaining tasks won't run

    for (const task of wave) {
      remaining.delete(task.id);
      satisfied.add(task.id);
    }

    waves.push(wave);
  }

  // Leftover tasks (circular deps) form their own wave so they are tracked
  for (const id of remaining) {
    waves.push([taskMap.get(id)!]);
  }

  return waves;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export class Workflow {
  readonly #tasks: WorkflowTask[];

  constructor(tasks: WorkflowTask[]) {
    this.#tasks = tasks;
  }

  /**
   * Validate that there are no circular dependencies.
   * Returns `{ valid: true, cycles: [] }` when clean.
   */
  validate(): { valid: boolean; cycles: string[][] } {
    const cycles = detectCycles(this.#tasks);
    return { valid: cycles.length === 0, cycles };
  }

  /**
   * Execute the workflow respecting task dependencies.
   * Independent tasks run in parallel within the same wave.
   * A failed task causes its dependants to be skipped.
   */
  async run(ctx: Record<string, unknown> = {}): Promise<WorkflowResult> {
    const results     = new Map<string, unknown>();
    const errors      = new Map<string, Error>();
    const taskStatuses = new Map<string, TaskStatus>(
      this.#tasks.map((t) => [t.id, 'pending'] as [string, TaskStatus]),
    );

    let overallFailed = false;
    const waves = buildWaves(this.#tasks);

    for (const wave of waves) {
      await Promise.all(
        wave.map(async (task) => {
          // Skip if any dependency failed or was skipped
          const deps = task.dependsOn ?? [];
          const depBlocked = deps.some(
            (d) =>
              taskStatuses.get(d) === 'failed' ||
              taskStatuses.get(d) === 'skipped',
          );

          if (depBlocked) {
            taskStatuses.set(task.id, 'skipped');
            return;
          }

          taskStatuses.set(task.id, 'running');

          try {
            const result = await task.run(ctx);
            results.set(task.id, result);
            taskStatuses.set(task.id, 'done');
          } catch (err) {
            errors.set(task.id, err instanceof Error ? err : new Error(String(err)));
            taskStatuses.set(task.id, 'failed');
            overallFailed = true;
          }
        }),
      );
    }

    return {
      status: overallFailed ? 'failed' : 'completed',
      results,
      errors,
      taskStatuses,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new `Workflow` from the given task list. */
export function createWorkflow(tasks: WorkflowTask[]): Workflow {
  return new Workflow(tasks);
}
