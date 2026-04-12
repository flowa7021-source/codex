// @ts-check
// ─── Functional Programming Utilities ────────────────────────────────────────
// Pure functional helpers: composition, currying, partial application,
// Maybe monad, Result/Either monad, and point-free array utilities.

// ─── Function Composition ─────────────────────────────────────────────────────

/**
 * Compose functions right-to-left.
 * compose(f, g, h)(x) === f(g(h(x)))
 */
export function compose<T>(...fns: Array<(x: T) => T>): (x: T) => T {
  return (x: T): T => fns.reduceRight((acc, fn) => fn(acc), x);
}

/**
 * Pipe functions left-to-right.
 * pipe(f, g, h)(x) === h(g(f(x)))
 */
export function pipe<T>(...fns: Array<(x: T) => T>): (x: T) => T {
  return (x: T): T => fns.reduce((acc, fn) => fn(acc), x);
}

// ─── Currying ─────────────────────────────────────────────────────────────────

/**
 * Auto-curry a function based on its declared arity (`fn.length`).
 * Calling the curried function with fewer arguments than the arity
 * returns a new function waiting for the remaining arguments.
 *
 * @example
 *   const add = curry((a: number, b: number) => a + b);
 *   const add5 = add(5);
 *   add5(3); // 8
 */
export function curry<T extends (...args: any[]) => any>(fn: T): any {
  const arity = fn.length;

  function curried(...args: any[]): any {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...more: any[]) => curried(...args, ...more);
  }

  return curried;
}

// ─── Partial Application ──────────────────────────────────────────────────────

/**
 * Partially apply a function with the provided leading arguments.
 * Returns a new function that accepts the remaining arguments.
 *
 * @example
 *   const multiply = (a: number, b: number) => a * b;
 *   const double = partial(multiply, 2);
 *   double(4); // 8
 */
export function partial<T extends (...args: any[]) => any>(
  fn: T,
  ...args: any[]
): (...rest: any[]) => ReturnType<T> {
  return (...rest: any[]): ReturnType<T> => fn(...args, ...rest);
}

// ─── Maybe Monad ─────────────────────────────────────────────────────────────

/** Discriminated union representing an optional value. */
export type Maybe<T> = { type: 'some'; value: T } | { type: 'none' };

/** Wrap a value in Some. */
export function some<T>(value: T): Maybe<T> {
  return { type: 'some', value };
}

/** Return a None (no value). */
export function none<T>(): Maybe<T> {
  return { type: 'none' };
}

/** Type guard: true when the Maybe contains a value. */
export function isSome<T>(m: Maybe<T>): m is { type: 'some'; value: T } {
  return m.type === 'some';
}

/** True when the Maybe contains no value. */
export function isNone<T>(m: Maybe<T>): boolean {
  return m.type === 'none';
}

/**
 * Lift a nullable value into a Maybe.
 * null and undefined become None; anything else becomes Some.
 */
export function fromNullable<T>(value: T | null | undefined): Maybe<T> {
  return value == null ? none<T>() : some(value);
}

/**
 * Apply a function to the inner value of a Some, returning a new Maybe.
 * None propagates unchanged.
 */
export function mapMaybe<T, U>(m: Maybe<T>, fn: (x: T) => U): Maybe<U> {
  if (isSome(m)) return some(fn(m.value));
  return none<U>();
}

/** Extract the value from a Some, or return the default for None. */
export function getOrElse<T>(m: Maybe<T>, defaultValue: T): T {
  return isSome(m) ? m.value : defaultValue;
}

/**
 * FlatMap (chain) over a Maybe.
 * Applies fn to the inner value and returns the resulting Maybe.
 * None propagates unchanged.
 */
export function chainMaybe<T, U>(m: Maybe<T>, fn: (x: T) => Maybe<U>): Maybe<U> {
  if (isSome(m)) return fn(m.value);
  return none<U>();
}

// ─── Result / Either Monad ────────────────────────────────────────────────────

/** Discriminated union representing success (Ok) or failure (Err). */
export type Result<T, E = Error> = { type: 'ok'; value: T } | { type: 'err'; error: E };

/** Wrap a value in an Ok. */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return { type: 'ok', value };
}

/** Wrap an error in an Err. */
export function err<T, E = Error>(error: E): Result<T, E> {
  return { type: 'err', error };
}

/** Type guard: true when the Result is Ok. */
export function isOk<T, E>(r: Result<T, E>): r is { type: 'ok'; value: T } {
  return r.type === 'ok';
}

/** True when the Result is Err. */
export function isErr<T, E>(r: Result<T, E>): boolean {
  return r.type === 'err';
}

/**
 * Apply a function to the value inside an Ok.
 * Err propagates unchanged.
 */
export function mapResult<T, U, E>(r: Result<T, E>, fn: (x: T) => U): Result<U, E> {
  if (isOk(r)) return ok<U, E>(fn(r.value));
  return r as unknown as Result<U, E>;
}

/**
 * Execute a function and wrap the outcome in a Result.
 * Returns Ok on success or Err if the function throws.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok<T, Error>(fn());
  } catch (e) {
    return err<T, Error>(e instanceof Error ? e : new Error(String(e)));
  }
}

// ─── Point-Free Array Utilities ───────────────────────────────────────────────

/** Curried map: returns a function that maps fn over an array. */
export function map<T, U>(fn: (x: T) => U): (arr: T[]) => U[] {
  return (arr: T[]): U[] => arr.map(fn);
}

/** Curried filter: returns a function that filters an array by predicate. */
export function filter<T>(fn: (x: T) => boolean): (arr: T[]) => T[] {
  return (arr: T[]): T[] => arr.filter(fn);
}

/** Curried reduce: returns a function that reduces an array to a single value. */
export function reduce<T, U>(fn: (acc: U, x: T) => U, initial: U): (arr: T[]) => U {
  return (arr: T[]): U => arr.reduce(fn, initial);
}

/** Return the first element as a Maybe. */
export function head<T>(arr: T[]): Maybe<T> {
  return arr.length > 0 ? some(arr[0]) : none<T>();
}

/** Return all elements except the first. */
export function tail<T>(arr: T[]): T[] {
  return arr.slice(1);
}

/** Return the last element as a Maybe. */
export function last<T>(arr: T[]): Maybe<T> {
  return arr.length > 0 ? some(arr[arr.length - 1]) : none<T>();
}

/** Flatten one level of nesting. */
export function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}

/**
 * Zip two arrays into an array of pairs.
 * Stops at the shorter array's length.
 */
export function zip<A, B>(as: A[], bs: B[]): Array<[A, B]> {
  const length = Math.min(as.length, bs.length);
  const result: Array<[A, B]> = [];
  for (let i = 0; i < length; i++) {
    result.push([as[i], bs[i]]);
  }
  return result;
}

/**
 * Curried groupBy: returns a function that partitions an array into a record
 * of arrays keyed by the string returned from fn.
 */
export function groupBy<T>(fn: (x: T) => string): (arr: T[]) => Record<string, T[]> {
  return (arr: T[]): Record<string, T[]> => {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
      const key = fn(item);
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = [];
      }
      result[key].push(item);
    }
    return result;
  };
}
