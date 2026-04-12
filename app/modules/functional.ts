// @ts-check
// ─── Functional Programming Utilities ────────────────────────────────────────
// Pure functional helpers: composition, currying, Maybe/Either monads,
// memoization, and trampoline for stack-safe recursion.

// ─── Function Composition ─────────────────────────────────────────────────────

/**
 * Compose functions right-to-left.
 * `compose(f, g, h)(x)` evaluates as `f(g(h(x)))`.
 */
export function compose<T>(...fns: Array<(x: T) => T>): (x: T) => T {
  if (fns.length === 0) return (x: T) => x;
  return (x: T) => fns.reduceRight((acc, fn) => fn(acc), x);
}

/**
 * Pipe functions left-to-right.
 * `pipe(f, g, h)(x)` evaluates as `h(g(f(x)))`.
 */
export function pipe<T>(...fns: Array<(x: T) => T>): (x: T) => T {
  if (fns.length === 0) return (x: T) => x;
  return (x: T) => fns.reduce((acc, fn) => fn(acc), x);
}

/** Returns its argument unchanged. */
export function identity<T>(x: T): T {
  return x;
}

/** Returns a function that always returns `x`, ignoring its argument. */
export function constant<T>(x: T): () => T {
  return () => x;
}

// ─── Currying and Partial Application ────────────────────────────────────────

/**
 * Auto-curry a function based on its declared arity (`fn.length`).
 * Calling the curried function with fewer arguments than the arity
 * returns a new function waiting for the remaining arguments.
 *
 * @example
 *   const add = curry((a, b) => a + b);
 *   const add5 = add(5);
 *   add5(3); // 8
 */
export function curry<T>(fn: (...args: any[]) => T): (...args: any[]) => any {
  const arity = fn.length;

  function curried(...args: any[]): any {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs: any[]) => curried(...args, ...moreArgs);
  }

  return curried;
}

/**
 * Partially apply a function with the provided leading arguments.
 *
 * @example
 *   const multiply = (a, b) => a * b;
 *   const double = partial(multiply, 2);
 *   double(4); // 8
 */
export function partial<T>(
  fn: (...args: any[]) => T,
  ...partialArgs: any[]
): (...args: any[]) => T {
  return (...args: any[]) => fn(...partialArgs, ...args);
}

/**
 * Flip the first two arguments of a binary function.
 *
 * @example
 *   const sub = (a, b) => a - b;
 *   const flippedSub = flip(sub);
 *   flippedSub(3, 10); // 10 - 3 = 7
 */
export function flip<A, B, C>(fn: (a: A, b: B) => C): (b: B, a: A) => C {
  return (b: B, a: A) => fn(a, b);
}

// ─── Maybe Monad ─────────────────────────────────────────────────────────────

/**
 * A simple null-safe wrapper (Maybe monad).
 * Holds either a present value (`Just`) or the absence of a value (`Nothing`).
 */
export class Maybe<T> {
  private readonly _value: T | undefined;
  private readonly _isNothing: boolean;

  private constructor(value: T | null | undefined) {
    if (value === null || value === undefined) {
      this._isNothing = true;
      this._value = undefined;
    } else {
      this._isNothing = false;
      this._value = value;
    }
  }

  /** Wrap a value that may be null or undefined. */
  static of<T>(value: T | null | undefined): Maybe<T> {
    return new Maybe<T>(value);
  }

  /** Return a Nothing (empty) Maybe. */
  static empty<T>(): Maybe<T> {
    return new Maybe<T>(undefined);
  }

  /** True when this Maybe holds no value. */
  get isNothing(): boolean {
    return this._isNothing;
  }

  /** The underlying value, or `undefined` if Nothing. */
  get value(): T | undefined {
    return this._value;
  }

  /**
   * Apply `fn` to the value if present, wrapping the result in a new Maybe.
   * Short-circuits to Nothing when this is Nothing.
   */
  map<U>(fn: (value: T) => U): Maybe<U> {
    if (this._isNothing) return Maybe.empty<U>();
    return Maybe.of(fn(this._value as T));
  }

  /**
   * Apply `fn` to the value if present; `fn` must return a Maybe.
   * Short-circuits to Nothing when this is Nothing.
   */
  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this._isNothing) return Maybe.empty<U>();
    return fn(this._value as T);
  }

  /** Return the value if present, otherwise return `defaultValue`. */
  getOrElse(defaultValue: T): T {
    return this._isNothing ? defaultValue : (this._value as T);
  }

  /**
   * Keep the value only if it satisfies the predicate.
   * Returns Nothing if the predicate returns false, or if this is Nothing.
   */
  filter(predicate: (value: T) => boolean): Maybe<T> {
    if (this._isNothing) return this;
    return predicate(this._value as T) ? this : Maybe.empty<T>();
  }

  /** Human-readable representation: `'Just(value)'` or `'Nothing'`. */
  toString(): string {
    return this._isNothing ? 'Nothing' : `Just(${String(this._value)})`;
  }
}

// ─── Either Monad ────────────────────────────────────────────────────────────

/**
 * A right-biased disjunction (Either monad).
 * `Right` represents success; `Left` represents failure or an alternate path.
 */
export class Either<L, R> {
  private readonly _left: L | undefined;
  private readonly _right: R | undefined;
  private readonly _isRight: boolean;

  private constructor(isRight: boolean, value: L | R) {
    this._isRight = isRight;
    if (isRight) {
      this._right = value as R;
      this._left = undefined;
    } else {
      this._left = value as L;
      this._right = undefined;
    }
  }

  /** Wrap a success value in the Right branch. */
  static right<L, R>(value: R): Either<L, R> {
    return new Either<L, R>(true, value);
  }

  /** Wrap a failure value in the Left branch. */
  static left<L, R>(value: L): Either<L, R> {
    return new Either<L, R>(false, value);
  }

  /** True when this is the Right (success) branch. */
  get isRight(): boolean {
    return this._isRight;
  }

  /** True when this is the Left (failure) branch. */
  get isLeft(): boolean {
    return !this._isRight;
  }

  /**
   * Apply `fn` to the Right value, wrapping the result in a new Right.
   * Passes Left values through unchanged.
   */
  map<U>(fn: (value: R) => U): Either<L, U> {
    if (!this._isRight) return Either.left<L, U>(this._left as L);
    return Either.right<L, U>(fn(this._right as R));
  }

  /**
   * Apply `fn` to the Left value, wrapping the result in a new Left.
   * Passes Right values through unchanged.
   */
  mapLeft<U>(fn: (value: L) => U): Either<U, R> {
    if (this._isRight) return Either.right<U, R>(this._right as R);
    return Either.left<U, R>(fn(this._left as L));
  }

  /**
   * Apply `fn` to the Right value; `fn` must return an Either.
   * Passes Left values through unchanged.
   */
  flatMap<U>(fn: (value: R) => Either<L, U>): Either<L, U> {
    if (!this._isRight) return Either.left<L, U>(this._left as L);
    return fn(this._right as R);
  }

  /** Return the Right value if present, otherwise return `defaultValue`. */
  getOrElse(defaultValue: R): R {
    return this._isRight ? (this._right as R) : defaultValue;
  }

  /**
   * Eliminate the Either by providing handlers for both branches.
   * `onLeft` is called for Left, `onRight` for Right.
   */
  fold<U>(onLeft: (l: L) => U, onRight: (r: R) => U): U {
    return this._isRight ? onRight(this._right as R) : onLeft(this._left as L);
  }
}

// ─── Additional Combinators ───────────────────────────────────────────────────

/**
 * Negate combinator: inverts the boolean result of a predicate.
 *
 * @example
 *   const isOdd = negate((n: number) => n % 2 === 0);
 *   isOdd(3); // true
 */
export function negate<T extends unknown[]>(
  fn: (...args: T) => boolean,
): (...args: T) => boolean {
  return (...args: T): boolean => !fn(...args);
}

/**
 * Juxtaposition combinator: applies multiple functions to the same argument.
 * `juxt(f, g, h)(x)` = `[f(x), g(x), h(x)]`
 *
 * @example
 *   const stats = juxt(Math.min, Math.max);
 *   stats(3); // [3, 3]
 */
export function juxt<T, R>(...fns: Array<(x: T) => R>): (x: T) => R[] {
  return (x: T): R[] => fns.map((fn) => fn(x));
}

// ─── Array Utilities ──────────────────────────────────────────────────────────

/** Returns a curried function that takes the first `n` elements of an array. */
export function take<T>(n: number): (arr: T[]) => T[] {
  return (arr: T[]): T[] => arr.slice(0, n);
}

/** Returns a curried function that drops the first `n` elements of an array. */
export function drop<T>(n: number): (arr: T[]) => T[] {
  return (arr: T[]): T[] => arr.slice(n);
}

/** Returns a curried function that takes elements while the predicate holds. */
export function takeWhile<T>(pred: (x: T) => boolean): (arr: T[]) => T[] {
  return (arr: T[]): T[] => {
    const result: T[] = [];
    for (const item of arr) {
      if (!pred(item)) break;
      result.push(item);
    }
    return result;
  };
}

/** Returns a curried function that drops elements while the predicate holds. */
export function dropWhile<T>(pred: (x: T) => boolean): (arr: T[]) => T[] {
  return (arr: T[]): T[] => {
    let i = 0;
    while (i < arr.length && pred(arr[i])) i++;
    return arr.slice(i);
  };
}

/** Zips two arrays into an array of pairs, stopping at the shorter length. */
export function zip<A, B>(a: A[], b: B[]): Array<[A, B]> {
  const length = Math.min(a.length, b.length);
  const result: Array<[A, B]> = [];
  for (let i = 0; i < length; i++) {
    result.push([a[i], b[i]]);
  }
  return result;
}

/** Zips two arrays by applying a combining function, stopping at the shorter length. */
export function zipWith<A, B, C>(fn: (a: A, b: B) => C, a: A[], b: B[]): C[] {
  const length = Math.min(a.length, b.length);
  const result: C[] = [];
  for (let i = 0; i < length; i++) {
    result.push(fn(a[i], b[i]));
  }
  return result;
}

/** Flattens one level of nesting from an array. */
export function flatten<T>(arr: Array<T | T[]>): T[] {
  const result: T[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      for (const sub of item) result.push(sub);
    } else {
      result.push(item as T);
    }
  }
  return result;
}

/** Maps a function that returns an array over an array and flattens the result. */
export function flatMap<T, R>(fn: (x: T) => R[], arr: T[]): R[] {
  const result: R[] = [];
  for (const item of arr) {
    for (const sub of fn(item)) result.push(sub);
  }
  return result;
}

/** Groups array elements by the string result of a key function. */
export function groupBy<T>(fn: (x: T) => string, arr: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = fn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/** Returns a new array with duplicate values removed (using ===). */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Returns a new array with duplicates removed, using a key function for comparison. */
export function uniqueBy<T>(fn: (x: T) => unknown, arr: T[]): T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (const item of arr) {
    const key = fn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/** Splits an array into consecutive chunks of the given size. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk: size must be a positive integer');
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Returns elements that appear in both arrays (intersection). */
export function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

/** Returns elements that are in `a` but not in `b` (set difference). */
export function difference<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

/** Returns all unique elements from either array (set union). */
export function union<T>(a: T[], b: T[]): T[] {
  return unique([...a, ...b]);
}

// ─── Object Utilities ─────────────────────────────────────────────────────────

/** Returns a new object containing only the specified keys. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Returns a new object with the specified keys removed. */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const keySet = new Set<string>(keys as unknown as string[]);
  const result = {} as Omit<T, K>;
  for (const key of Object.keys(obj) as string[]) {
    if (!keySet.has(key)) {
      (result as Record<string, unknown>)[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result;
}

/** Returns a new object with all values transformed by a mapping function. */
export function mapValues<T, R>(
  obj: Record<string, T>,
  fn: (v: T, k: string) => R,
): Record<string, R> {
  const result: Record<string, R> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value, key);
  }
  return result;
}

/** Returns a new object containing only entries for which the predicate returns true. */
export function filterValues<T>(
  obj: Record<string, T>,
  pred: (v: T, k: string) => boolean,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (pred(value, key)) {
      result[key] = value;
    }
  }
  return result;
}

// ─── Memoization ─────────────────────────────────────────────────────────────

/**
 * Wrap a function so that repeated calls with the same arguments return the
 * cached result.  Cache key is computed by `JSON.stringify`-ing all arguments.
 *
 * @example
 *   const fib = memoize(n => n <= 1 ? n : fib(n - 1) + fib(n - 2));
 */
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return function (...args: any[]): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  } as T;
}

// ─── Trampoline ──────────────────────────────────────────────────────────────

/**
 * Enables tail-call optimisation by bouncing thunks on the heap instead of
 * growing the call stack.  When `fn` returns a function (a thunk), it is
 * called again; when it returns a plain value the loop stops.
 *
 * @example
 *   const factorial = trampoline(function fact(n, acc = 1) {
 *     if (n <= 1) return acc;
 *     return () => fact(n - 1, n * acc);
 *   });
 *   factorial(10000); // no stack overflow
 */
export function trampoline<T>(
  fn: (...args: any[]) => T | (() => T),
): (...args: any[]) => T {
  return function (...args: any[]): T {
    let result: T | (() => T) = fn(...args);
    while (typeof result === 'function') {
      result = (result as () => T | (() => T))();
    }
    return result;
  };
}
