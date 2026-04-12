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
