// @ts-check
// ─── Pipeline2 ────────────────────────────────────────────────────────────────
// Composable, type-safe data processing pipeline.  Each step transforms the
// value produced by the previous step; steps may be synchronous or async.

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single pipeline transformation step.
 * Receives a value of `TIn` and returns a value of `TOut` (or a Promise of it).
 */
export type PipelineStep<TIn, TOut> = (input: TIn) => TOut | Promise<TOut>;

/** @internal */
type AnyStep = PipelineStep<unknown, unknown>;

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Composable, type-safe data processing pipeline.
 *
 * Build a pipeline with `pipe()` / `tap()` / `catch()`, then execute it
 * with `process()` or `processAll()`.
 *
 * @example
 *   const pipeline = createPipeline<string>()
 *     .pipe(s => s.trim())
 *     .pipe(s => s.toUpperCase())
 *     .tap(s => console.log('value:', s));
 *
 *   const result = await pipeline.process('  hello  ');
 *   // result === 'HELLO'
 */
export class Pipeline<TIn, TOut> {
  /** @internal Ordered list of transformation steps. */
  readonly #steps: AnyStep[];

  /** @internal */
  constructor(steps: AnyStep[] = []) {
    this.#steps = steps;
  }

  // ─── Building ─────────────────────────────────────────────────────────────

  /**
   * Append a transformation step.
   * Returns a new `Pipeline<TIn, TNext>` leaving the original unchanged.
   */
  pipe<TNext>(step: PipelineStep<TOut, TNext>): Pipeline<TIn, TNext> {
    return new Pipeline<TIn, TNext>([...this.#steps, step as AnyStep]);
  }

  /**
   * Append a side-effect step that receives the current value but does not
   * change it.  Useful for logging, metrics, etc.
   * Returns a new `Pipeline<TIn, TOut>`.
   */
  tap(fn: (value: TOut) => void): Pipeline<TIn, TOut> {
    const tapStep: AnyStep = async (value: unknown) => {
      fn(value as TOut);
      return value;
    };
    return new Pipeline<TIn, TOut>([...this.#steps, tapStep]);
  }

  /**
   * Append an error-recovery step.  When any earlier step throws, `handler`
   * is called with the error and its return value becomes the pipeline result.
   * Returns a new `Pipeline<TIn, TOut>`.
   */
  catch(handler: (error: Error) => TOut): Pipeline<TIn, TOut> {
    return new Pipeline<TIn, TOut>([
      ...this.#steps,
      // Sentinel marker — recognised by #runSteps
      { __catchHandler: handler } as unknown as AnyStep,
    ]);
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  /**
   * Run `input` through all pipeline steps and return the final result.
   */
  async process(input: TIn): Promise<TOut> {
    return this.#runSteps(input) as Promise<TOut>;
  }

  /**
   * Run each element of `inputs` through the pipeline in parallel.
   * Returns an array of results in the same order.
   */
  processAll(inputs: TIn[]): Promise<TOut[]> {
    return Promise.all(inputs.map(item => this.process(item)));
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /**
   * Create a shallow copy of this pipeline (same steps, independent chain).
   */
  clone(): Pipeline<TIn, TOut> {
    return new Pipeline<TIn, TOut>([...this.#steps]);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async #runSteps(input: unknown): Promise<unknown> {
    let value: unknown = input;
    let errorPending: Error | null = null;

    for (const step of this.#steps) {
      // Detect catch-handler sentinels
      if (isCatchSentinel(step)) {
        if (errorPending !== null) {
          const handler = (step as unknown as CatchSentinel).__catchHandler;
          try {
            value = await Promise.resolve(handler(errorPending));
            errorPending = null;
          } catch (handlerErr) {
            errorPending = handlerErr instanceof Error
              ? handlerErr
              : new Error(String(handlerErr));
          }
        }
        continue;
      }

      // If we have an unhandled error, skip non-catch steps
      if (errorPending !== null) continue;

      try {
        value = await Promise.resolve((step as (v: unknown) => unknown)(value));
      } catch (err) {
        errorPending = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (errorPending !== null) throw errorPending;
    return value;
  }
}

// ─── Sentinel helpers ─────────────────────────────────────────────────────────

interface CatchSentinel {
  __catchHandler: (error: Error) => unknown;
}

function isCatchSentinel(step: AnyStep): step is AnyStep & CatchSentinel {
  return typeof step === 'object' && step !== null && '__catchHandler' in step;
}

// ─── Factories & composers ────────────────────────────────────────────────────

/**
 * Create an identity pipeline that passes the value through unchanged.
 * Use `pipe()` to add transformation steps.
 *
 * @example
 *   const p = createPipeline<number>().pipe(n => n * 2);
 */
export function createPipeline<T>(): Pipeline<T, T> {
  return new Pipeline<T, T>();
}

/**
 * Connect two pipelines end-to-end.
 * Equivalent to a pipeline that first applies `f` then applies `g`.
 *
 * @example
 *   const ab = createPipeline<string>().pipe(s => s.trim());
 *   const bc = createPipeline<string>().pipe(s => s.length);
 *   const ac = compose(ab, bc);
 *   await ac.process('  hi  '); // 2
 */
export function compose<A, B, C>(f: Pipeline<A, B>, g: Pipeline<B, C>): Pipeline<A, C> {
  // Combine by piping through both pipelines
  return f.pipe((value: B) => g.process(value)) as unknown as Pipeline<A, C>;
}
