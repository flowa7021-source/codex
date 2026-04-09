// @ts-check
// ─── Pipeline ────────────────────────────────────────────────────────────────
// Data transformation pipeline utilities for chaining synchronous and
// asynchronous transforms in a readable, functional style.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A function that transforms a value.
 */
export type Transform<TIn, TOut> = (value: TIn) => TOut | Promise<TOut>;

// ─── Pipeline ────────────────────────────────────────────────────────────────

/**
 * A synchronous pipeline that chains transform functions.
 */
export class Pipeline<T> {
  #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  /** Apply a synchronous transform. Returns a new Pipeline. */
  pipe<U>(fn: (value: T) => U): Pipeline<U> {
    return new Pipeline(fn(this.#value));
  }

  /** Get the current value. */
  value(): T {
    return this.#value;
  }

  /** Apply a transform only if a condition is true. */
  when(condition: boolean | ((value: T) => boolean), fn: (value: T) => T): Pipeline<T> {
    const met =
      typeof condition === 'function' ? condition(this.#value) : condition;
    return met ? new Pipeline(fn(this.#value)) : this;
  }

  /** Apply a side effect without changing the value. */
  tap(fn: (value: T) => void): Pipeline<T> {
    fn(this.#value);
    return this;
  }
}

/**
 * Create a pipeline from a value.
 */
export function pipeline<T>(value: T): Pipeline<T> {
  return new Pipeline(value);
}

// ─── AsyncPipeline ───────────────────────────────────────────────────────────

/**
 * An async pipeline that chains async transform functions.
 */
export class AsyncPipeline<T> {
  #promise: Promise<T>;

  constructor(value: T | Promise<T>) {
    this.#promise = Promise.resolve(value);
  }

  /** Apply an async or sync transform. Returns a new AsyncPipeline. */
  pipe<U>(fn: (value: T) => U | Promise<U>): AsyncPipeline<U> {
    return new AsyncPipeline<U>(this.#promise.then(fn));
  }

  /** Apply a transform only if a condition is true. */
  when(
    condition: boolean | ((value: T) => boolean | Promise<boolean>),
    fn: (value: T) => T | Promise<T>,
  ): AsyncPipeline<T> {
    const next = this.#promise.then(async (value) => {
      const met =
        typeof condition === 'function'
          ? await condition(value)
          : condition;
      return met ? fn(value) : value;
    });
    return new AsyncPipeline<T>(next);
  }

  /** Apply a side effect without changing the value. */
  tap(fn: (value: T) => void | Promise<void>): AsyncPipeline<T> {
    const next = this.#promise.then(async (value) => {
      await fn(value);
      return value;
    });
    return new AsyncPipeline<T>(next);
  }

  /** Resolve the pipeline and get the final value. */
  resolve(): Promise<T> {
    return this.#promise;
  }
}

/**
 * Create an async pipeline.
 */
export function asyncPipeline<T>(value: T | Promise<T>): AsyncPipeline<T> {
  return new AsyncPipeline(value);
}

// ─── Compose / PipeThrough ───────────────────────────────────────────────────

/**
 * Compose multiple functions (right to left, like math compose).
 */
export function compose<T>(...fns: Array<(value: T) => T>): (value: T) => T {
  return (value: T) => {
    let result = value;
    for (let i = fns.length - 1; i >= 0; i--) {
      result = fns[i](result);
    }
    return result;
  };
}

/**
 * Pipe value through multiple functions (left to right).
 */
export function pipeThrough<T>(value: T, ...fns: Array<(value: T) => T>): T {
  let result = value;
  for (const fn of fns) {
    result = fn(result);
  }
  return result;
}
