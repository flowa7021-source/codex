// @ts-check
// ─── Workflow Engine ──────────────────────────────────────────────────────────
// Sequential/parallel workflow execution with dependency resolution.

// ─── Types ────────────────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  id: string;
  name: string;
  fn: (ctx: WorkflowContext) => Promise<unknown> | unknown;
  condition?: (ctx: WorkflowContext) => boolean;
  depends?: string[];
  timeout?: number;
}

export interface WorkflowContext {
  results: Record<string, unknown>;
  errors: Record<string, Error>;
  metadata: Record<string, unknown>;
}

export interface WorkflowResult {
  success: boolean;
  context: WorkflowContext;
  stepStatuses: Record<string, StepStatus>;
  duration: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Topological sort of steps based on their dependency declarations.
 * Returns steps in execution batches: each batch can run in parallel.
 * Steps with no dependencies are in the first batch; steps whose dependencies
 * are all satisfied come next, and so on.
 */
function buildExecutionBatches(steps: WorkflowStep[]): WorkflowStep[][] {
  const stepMap = new Map<string, WorkflowStep>(steps.map((s) => [s.id, s]));
  const satisfied = new Set<string>();
  const remaining = new Set<string>(steps.map((s) => s.id));
  const batches: WorkflowStep[][] = [];

  while (remaining.size > 0) {
    const batch: WorkflowStep[] = [];

    for (const id of remaining) {
      const step = stepMap.get(id)!;
      const deps = step.depends ?? [];
      if (deps.every((dep) => satisfied.has(dep))) {
        batch.push(step);
      }
    }

    if (batch.length === 0) {
      // Circular or unsatisfiable dependencies — break to avoid infinite loop
      // Remaining steps will never be scheduled; mark them failed upstream.
      break;
    }

    for (const step of batch) {
      remaining.delete(step.id);
      satisfied.add(step.id);
    }

    batches.push(batch);
  }

  // Any still-remaining steps have unsatisfiable dependencies
  for (const id of remaining) {
    batches.push([stepMap.get(id)!]);
  }

  return batches;
}

/**
 * Run a single step function with an optional timeout.
 * Rejects if the timeout fires before the step resolves.
 */
function runWithTimeout(
  fn: () => Promise<unknown> | unknown,
  timeoutMs: number | undefined,
): Promise<unknown> {
  const promise = Promise.resolve().then(fn);
  if (timeoutMs === undefined) return promise;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── WorkflowEngine ───────────────────────────────────────────────────────────

export class WorkflowEngine {
  #steps: WorkflowStep[] = [];

  /** Add a step to the workflow. Returns `this` for chaining. */
  addStep(step: WorkflowStep): this {
    this.#steps.push(step);
    return this;
  }

  /** Execute all steps respecting dependency order. */
  async run(initialMetadata: Record<string, unknown> = {}): Promise<WorkflowResult> {
    const start = Date.now();

    const ctx: WorkflowContext = {
      results: {},
      errors: {},
      metadata: { ...initialMetadata },
    };

    const stepStatuses: Record<string, StepStatus> = {};
    for (const step of this.#steps) {
      stepStatuses[step.id] = 'pending';
    }

    let overallSuccess = true;
    const batches = buildExecutionBatches(this.#steps);

    for (const batch of batches) {
      // Run all steps in the current batch concurrently
      await Promise.all(
        batch.map(async (step) => {
          // A step whose dependency failed cannot run — skip it
          const deps = step.depends ?? [];
          const depFailed = deps.some(
            (dep) =>
              stepStatuses[dep] === 'failed' ||
              stepStatuses[dep] === 'skipped',
          );

          if (depFailed) {
            stepStatuses[step.id] = 'skipped';
            return;
          }

          // Evaluate optional condition
          if (step.condition !== undefined && !step.condition(ctx)) {
            stepStatuses[step.id] = 'skipped';
            return;
          }

          stepStatuses[step.id] = 'running';

          try {
            const result = await runWithTimeout(() => step.fn(ctx), step.timeout);
            ctx.results[step.id] = result;
            stepStatuses[step.id] = 'completed';
          } catch (err) {
            ctx.errors[step.id] = err instanceof Error ? err : new Error(String(err));
            stepStatuses[step.id] = 'failed';
            overallSuccess = false;
          }
        }),
      );
    }

    return {
      success: overallSuccess,
      context: ctx,
      stepStatuses,
      duration: Date.now() - start,
    };
  }

  /** Remove all registered steps. */
  reset(): void {
    this.#steps = [];
  }
}
