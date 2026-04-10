// @ts-check
// ─── Saga ────────────────────────────────────────────────────────────────────
// Saga pattern for distributed transactions: execute a sequence of steps
// with automatic compensation (rollback) on failure.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A single step in a saga. Each step transforms a context value and
 * provides a compensating action for rollback.
 */
export interface SagaStep<T> {
  name: string;
  execute: (ctx: T) => Promise<T>;
  compensate: (ctx: T) => Promise<T>;
}

/** The result returned after a saga execution attempt. */
export interface SagaResult<T> {
  success: boolean;
  context: T;
  completedSteps: string[];
  failedStep?: string;
  error?: Error;
}

// ─── Saga ────────────────────────────────────────────────────────────────────

/**
 * Executes an ordered list of saga steps. On failure, runs compensating
 * actions for all previously completed steps in reverse order.
 *
 * @example
 *   const saga = createSaga([
 *     { name: 'ReserveInventory', execute: reserve, compensate: release },
 *     { name: 'ChargePayment',    execute: charge,  compensate: refund  },
 *   ]);
 *   const result = await saga.execute({ orderId: '123' });
 *   if (!result.success) console.error(result.error);
 */
export class Saga<T> {
  private _steps: SagaStep<T>[];

  constructor(steps: SagaStep<T>[]) {
    this._steps = steps;
  }

  /** The number of steps in this saga. */
  get stepCount(): number {
    return this._steps.length;
  }

  /**
   * Execute all steps in order with the given initial context.
   * If a step throws, compensating actions are run in reverse for all
   * previously completed steps, then a failed SagaResult is returned.
   * Compensation errors are silently swallowed to ensure all compensations run.
   */
  async execute(initialContext: T): Promise<SagaResult<T>> {
    let ctx = initialContext;
    const completedSteps: string[] = [];

    for (const step of this._steps) {
      try {
        ctx = await step.execute(ctx);
        completedSteps.push(step.name);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Compensate completed steps in reverse order
        for (let i = completedSteps.length - 1; i >= 0; i--) {
          const completedStep = this._steps.find((s) => s.name === completedSteps[i])!;
          try {
            ctx = await completedStep.compensate(ctx);
          } catch {
            // Swallow compensation errors — keep rolling back
          }
        }

        return {
          success: false,
          context: ctx,
          completedSteps,
          failedStep: step.name,
          error,
        };
      }
    }

    return {
      success: true,
      context: ctx,
      completedSteps,
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new Saga instance. */
export function createSaga<T>(steps: SagaStep<T>[]): Saga<T> {
  return new Saga<T>(steps);
}
