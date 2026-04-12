// @ts-check
// ─── Pipeline ────────────────────────────────────────────────────────────────
// Data transformation pipeline builder with synchronous and asynchronous
// variants. Supports pipe, map, filter, tap, catch, execute/run.

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Sentinel wrapper used to propagate errors through the step chain. */
class _ErrorSentinel {
  #error: Error;

  constructor(error: Error) {
    this.#error = error;
  }

  get error(): Error {
    return this.#error;
  }
}

type SyncStep = (value: unknown) => unknown;
type AsyncStep = (value: unknown) => unknown | Promise<unknown>;

/**
 * Re-wrap a list of sync steps so that errors thrown by each step are captured
 * into an `_ErrorSentinel` rather than propagating immediately.
 */
function _wrapStepsWithErrorCapture(steps: SyncStep[]): SyncStep[] {
  return steps.map((step) => (value: unknown) => {
    if (value instanceof _ErrorSentinel) {
      return value; // propagate sentinel
    }
    try {
      return step(value);
    } catch (err) {
      return new _ErrorSentinel(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Re-wrap a list of async steps so that errors are captured into sentinels.
 */
function _wrapAsyncStepsWithErrorCapture(steps: AsyncStep[]): AsyncStep[] {
  return steps.map((step) => async (value: unknown) => {
    if (value instanceof _ErrorSentinel) {
      return value;
    }
    try {
      return await step(value);
    } catch (err) {
      return new _ErrorSentinel(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// ─── Pipeline (Synchronous) ───────────────────────────────────────────────────

/**
 * A synchronous data transformation pipeline.
 *
 * @template T - The input type
 * @template R - The current output type (defaults to T)
 *
 * @example
 *   const result = new Pipeline<number>()
 *     .pipe(x => x * 2)
 *     .pipe(x => x + 1)
 *     .execute(5); // 11
 */
export class Pipeline<T, R = T> {
  #steps: SyncStep[];

  constructor() {
    this.#steps = [];
  }

  /** @internal Constructor used by step methods to carry steps forward. */
  static #fromSteps<T, R>(steps: SyncStep[]): Pipeline<T, R> {
    const p = new Pipeline<T, R>();
    p.#steps = steps;
    return p;
  }

  /**
   * Add a transformation step. Returns a new Pipeline with the transformed type.
   */
  pipe<U>(fn: (value: R) => U): Pipeline<T, U> {
    return Pipeline.#fromSteps<T, U>([...this.#steps, fn as SyncStep]);
  }

  /**
   * Map over each item in the array value. Returns a new Pipeline whose output
   * is an array of mapped values.
   */
  map<U>(fn: (value: R extends Array<infer I> ? I : R) => U): Pipeline<T, U[]> {
    return this.pipe((value) => {
      const arr = Array.isArray(value) ? value : [value];
      return arr.map(fn as (x: unknown) => U);
    }) as unknown as Pipeline<T, U[]>;
  }

  /**
   * Filter items in the array value.
   * For array values: keeps only items that pass the predicate.
   * For scalar values: passes the value through unchanged.
   */
  filter(pred: (value: R extends Array<infer I> ? I : R) => boolean): Pipeline<T, R> {
    return this.pipe((value) => {
      if (Array.isArray(value)) {
        return value.filter(pred as (x: unknown) => boolean);
      }
      return value;
    }) as unknown as Pipeline<T, R>;
  }

  /**
   * Side-effect step: calls `fn` with the current value, then passes the value
   * through unchanged.
   */
  tap(fn: (value: R) => void): Pipeline<T, R> {
    return this.pipe((value) => {
      fn(value as R);
      return value;
    }) as unknown as Pipeline<T, R>;
  }

  /**
   * Register an error handler. If a prior step throws, `fn` is called with the
   * error and its return value becomes the new pipeline value.
   */
  catch(fn: (err: Error) => R): Pipeline<T, R> {
    const catchStep: SyncStep = (value: unknown) => {
      if (value instanceof _ErrorSentinel) {
        return fn(value.error);
      }
      return value;
    };
    return Pipeline.#fromSteps<T, R>([
      ..._wrapStepsWithErrorCapture(this.#steps),
      catchStep,
    ]);
  }

  /**
   * Execute the pipeline with the given input, returning the final output.
   */
  execute(input: T): R {
    let value: unknown = input;
    for (const step of this.#steps) {
      if (value instanceof _ErrorSentinel) {
        // propagate error sentinel through non-catch steps
        value = step(value);
      } else {
        try {
          value = step(value);
        } catch (err) {
          value = new _ErrorSentinel(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
    if (value instanceof _ErrorSentinel) {
      throw value.error;
    }
    return value as R;
  }

  /**
   * Alias for `execute`.
   */
  run(input: T): R {
    return this.execute(input);
  }
}

// ─── AsyncPipeline ────────────────────────────────────────────────────────────

/**
 * An asynchronous data transformation pipeline.
 *
 * @template T - The input type
 * @template R - The current output type (defaults to T)
 *
 * @example
 *   const result = await new AsyncPipeline<number>()
 *     .pipe(async x => x * 2)
 *     .execute(5); // 10
 */
export class AsyncPipeline<T, R = T> {
  #steps: AsyncStep[];

  constructor() {
    this.#steps = [];
  }

  /** @internal Constructor used by step methods to carry steps forward. */
  static #fromSteps<T, R>(steps: AsyncStep[]): AsyncPipeline<T, R> {
    const p = new AsyncPipeline<T, R>();
    p.#steps = steps;
    return p;
  }

  /**
   * Add an async (or sync) transformation step.
   */
  pipe<U>(fn: (value: R) => U | Promise<U>): AsyncPipeline<T, U> {
    return AsyncPipeline.#fromSteps<T, U>([...this.#steps, fn as AsyncStep]);
  }

  /**
   * Async map over array items.
   */
  map<U>(fn: (value: R extends Array<infer I> ? I : R) => U | Promise<U>): AsyncPipeline<T, U[]> {
    return this.pipe(async (value) => {
      const arr = Array.isArray(value) ? value : [value];
      return Promise.all(arr.map(fn as (x: unknown) => U | Promise<U>));
    }) as unknown as AsyncPipeline<T, U[]>;
  }

  /**
   * Async filter over array items (or scalar values).
   */
  filter(
    pred: (value: R extends Array<infer I> ? I : R) => boolean | Promise<boolean>,
  ): AsyncPipeline<T, R> {
    return this.pipe(async (value) => {
      if (Array.isArray(value)) {
        const results = await Promise.all(
          value.map(async (item: unknown) => ({
            item,
            keep: await (pred as (x: unknown) => boolean | Promise<boolean>)(item),
          })),
        );
        return results.filter((r) => r.keep).map((r) => r.item);
      }
      return value;
    }) as unknown as AsyncPipeline<T, R>;
  }

  /**
   * Async side-effect step.
   */
  tap(fn: (value: R) => void | Promise<void>): AsyncPipeline<T, R> {
    return this.pipe(async (value) => {
      await fn(value as R);
      return value;
    }) as unknown as AsyncPipeline<T, R>;
  }

  /**
   * Async error handler.
   */
  catch(fn: (err: Error) => R | Promise<R>): AsyncPipeline<T, R> {
    const catchStep: AsyncStep = async (value: unknown) => {
      if (value instanceof _ErrorSentinel) {
        return fn(value.error);
      }
      return value;
    };
    return AsyncPipeline.#fromSteps<T, R>([
      ..._wrapAsyncStepsWithErrorCapture(this.#steps),
      catchStep,
    ]);
  }

  /**
   * Execute the async pipeline with the given input.
   */
  async execute(input: T): Promise<R> {
    let value: unknown = input;
    for (const step of this.#steps) {
      if (value instanceof _ErrorSentinel) {
        value = await step(value);
      } else {
        try {
          value = await step(value);
        } catch (err) {
          value = new _ErrorSentinel(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }
    if (value instanceof _ErrorSentinel) {
      throw value.error;
    }
    return value as R;
  }

  /**
   * Alias for `execute`.
   */
  run(input: T): Promise<R> {
    return this.execute(input);
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a new synchronous pipeline.
 *
 * @template T
 * @returns {Pipeline<T, T>}
 *
 * @example
 *   const result = pipeline<number>().pipe(x => x * 2).execute(5); // 10
 */
export function pipeline<T>(): Pipeline<T, T> {
  return new Pipeline<T, T>();
}

/**
 * Create a new asynchronous pipeline.
 *
 * @template T
 * @returns {AsyncPipeline<T, T>}
 *
 * @example
 *   const result = await asyncPipeline<number>().pipe(async x => x * 2).execute(5); // 10
 */
export function asyncPipeline<T>(): AsyncPipeline<T, T> {
  return new AsyncPipeline<T, T>();
}

/**
 * Apply a sequence of transformation functions to an initial value (one-time use).
 *
 * @param {unknown} value - The initial value
 * @param {...((x: unknown) => unknown)} fns - Functions to apply in order
 * @returns {unknown}
 *
 * @example
 *   pipeValue(5, x => x * 2, x => x + 1) // 11
 */
export function pipeValue<T>(value: T, ...fns: Array<(x: unknown) => unknown>): unknown {
  return fns.reduce((acc: unknown, fn) => fn(acc), value as unknown);
}
