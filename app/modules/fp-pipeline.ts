// @ts-check
// ─── Functional Pipeline / Composition Utilities ─────────────────────────────
// pipe, compose, curry, partial, memoize, applyN, transduce.

// ─── pipe ─────────────────────────────────────────────────────────────────────

/**
 * Apply a sequence of functions left-to-right to a value (up to 10 stages).
 * Falls back to a runtime reduce for additional stages.
 */
export function pipe<A>(value: A): A;
export function pipe<A, B>(value: A, f1: (a: A) => B): B;
export function pipe<A, B, C>(value: A, f1: (a: A) => B, f2: (b: B) => C): C;
export function pipe<A, B, C, D>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
  f7: (g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
  f7: (g: G) => H,
  f8: (h: H) => I,
): I;
export function pipe<A, B, C, D, E, F, G, H, I, J>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
  f7: (g: G) => H,
  f8: (h: H) => I,
  f9: (i: I) => J,
): J;
export function pipe<A, B, C, D, E, F, G, H, I, J, K>(
  value: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
  f6: (f: F) => G,
  f7: (g: G) => H,
  f8: (h: H) => I,
  f9: (i: I) => J,
  f10: (j: J) => K,
): K;
export function pipe(value: unknown, ...fns: Array<(x: unknown) => unknown>): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// ─── compose ──────────────────────────────────────────────────────────────────

/**
 * Compose functions right-to-left, returning a new function that accepts the
 * initial value and threads it through the composed pipeline.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function compose<A>(...fns: Function[]): (a: A) => unknown {
  return (a: A) => {
    const reversed = [...fns].reverse();
    return reversed.reduce((acc: unknown, fn) => fn(acc), a as unknown);
  };
}

// ─── curry ────────────────────────────────────────────────────────────────────

/**
 * Curry a function so it can be called with partial arguments and will
 * accumulate them until the original arity is satisfied.
 */
export function curry<T extends unknown[], R>(fn: (...args: T) => R): unknown {
  const arity = fn.length;
  function curried(...args: unknown[]): unknown {
    if (args.length >= arity) {
      return fn(...(args as T));
    }
    return (...moreArgs: unknown[]) => curried(...args, ...moreArgs);
  }
  return curried;
}

// ─── partial ──────────────────────────────────────────────────────────────────

/**
 * Partially apply a function, binding the given leading arguments and returning
 * a new function that accepts the remaining arguments.
 */
export function partial<T extends unknown[], R>(
  fn: (...args: T) => R,
  ...partialArgs: Partial<T>
): (...remainingArgs: unknown[]) => R {
  return (...remainingArgs: unknown[]): R => {
    return fn(...([...partialArgs, ...remainingArgs] as T));
  };
}

// ─── memoize ──────────────────────────────────────────────────────────────────

/**
 * Memoize a function using a Map keyed on a JSON-serialized representation of
 * its arguments.  Works for any JSON-serializable argument list.
 */
export function memoize<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R {
  const cache = new Map<string, R>();
  return (...args: T): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as R;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// ─── applyN ───────────────────────────────────────────────────────────────────

/**
 * Apply `fn` to `initial` exactly `n` times, threading the result of each
 * application into the next call.
 */
export function applyN<T>(fn: (x: T) => T, n: number, initial: T): T {
  let result = initial;
  for (let i = 0; i < n; i++) {
    result = fn(result);
  }
  return result;
}

// ─── transduce ────────────────────────────────────────────────────────────────

/**
 * Apply a composition of transducer transformers to an array, producing a new
 * array.  Each transformer is a function that wraps a reducer:
 *
 *   (reducer) => (acc, item) => newAcc
 *
 * Transformers are applied left-to-right (first transformer sees items first).
 */
export function transduce<T, U>(
  items: T[],
  ...transformers: Array<
    (reducer: (acc: U[], item: T) => U[]) => (acc: U[], item: unknown) => U[]
  >
): U[] {
  const baseReducer = (acc: U[], item: T): U[] => {
    acc.push(item as unknown as U);
    return acc;
  };

  // Compose transformers right-to-left around the base reducer so that the
  // first transformer in the list is the outermost (sees items first).
  const composed = [...transformers]
    .reverse()
    .reduce(
      (
        reducer: (acc: U[], item: unknown) => U[],
        transformer,
      ) =>
        transformer(
          reducer as unknown as (acc: U[], item: T) => U[],
        ) as (acc: U[], item: unknown) => U[],
      baseReducer as unknown as (acc: U[], item: unknown) => U[],
    );

  return items.reduce((acc: U[], item: T) => composed(acc, item), [] as U[]);
}
