// @ts-check
// ─── Pattern Matching ─────────────────────────────────────────────────────────
// Functional-style pattern matching utilities: builder pattern, structural
// matching, and guard-based dispatch.

// ─── MatchBuilder ─────────────────────────────────────────────────────────────

/** Represents a branch: a predicate and the result to produce when it matches. */
interface Branch<T, R> {
  predicate: (v: T) => boolean;
  result: R | ((v: T) => R);
}

/** Resolve a result value — either call the function or return the literal. */
function resolve<T, R>(value: T, result: R | ((v: T) => R)): R {
  return typeof result === 'function'
    ? (result as (v: T) => R)(value)
    : result;
}

/**
 * Builder that accumulates match branches and is terminated by `.otherwise()`
 * or `.exhaustive()`.
 */
export class MatchBuilder<T, R> {
  #value: T;
  #branches: Branch<T, R>[];

  constructor(value: T) {
    this.#value = value;
    this.#branches = [];
  }

  /**
   * Add a branch that fires when `predicate` returns `true` for the value.
   * `result` may be a plain value or a mapper function.
   */
  when(predicate: (v: T) => boolean, result: R | ((v: T) => R)): MatchBuilder<T, R> {
    this.#branches.push({ predicate, result });
    return this;
  }

  /**
   * Add a branch that fires when every key in `pattern` deeply equals the
   * corresponding key on the value (structural / partial object match).
   */
  with(pattern: Partial<T>, result: R | ((v: T) => R)): MatchBuilder<T, R> {
    const predicate = (v: T): boolean => isMatch(v, pattern);
    this.#branches.push({ predicate, result });
    return this;
  }

  /**
   * Evaluate all branches in order and return the first match, or return the
   * fallback `result` if none matched. Terminates the builder.
   */
  otherwise(result: R | ((v: T) => R)): R {
    for (const branch of this.#branches) {
      if (branch.predicate(this.#value)) {
        return resolve(this.#value, branch.result);
      }
    }
    return resolve(this.#value, result);
  }

  /**
   * Evaluate all branches in order and return the first match.
   * Throws a `TypeError` if no branch matches. Terminates the builder.
   */
  exhaustive(): R {
    for (const branch of this.#branches) {
      if (branch.predicate(this.#value)) {
        return resolve(this.#value, branch.result);
      }
    }
    throw new TypeError(
      `exhaustive(): no branch matched for value: ${JSON.stringify(this.#value)}`,
    );
  }
}

// ─── match() factory ──────────────────────────────────────────────────────────

/**
 * Start a pattern-match expression on `value`.
 *
 * @example
 * const label = match<number, string>(status)
 *   .when(n => n === 0, 'zero')
 *   .when(n => n > 0, n => `positive(${n})`)
 *   .otherwise('negative');
 */
export function match<T, R>(value: T): MatchBuilder<T, R> {
  return new MatchBuilder<T, R>(value);
}

// ─── isMatch() ────────────────────────────────────────────────────────────────

/**
 * Structural pattern matching: returns `true` when every key present in
 * `pattern` exists in `value` with a deeply equal value.
 *
 * - Primitives are compared with `===`.
 * - Arrays require the same length and element-wise structural matching.
 * - Plain objects recurse into nested keys.
 * - `null` matches only `null`.
 */
export function isMatch(value: unknown, pattern: unknown): boolean {
  // Identical reference / primitive equality
  if (Object.is(value, pattern)) return true;

  // null
  if (pattern === null || value === null) return pattern === value;

  // Primitives after identity check failed → not equal
  if (typeof pattern !== 'object' || typeof value !== 'object') return false;

  // Array pattern: lengths must match and each element must match
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) return false;
    if (pattern.length !== value.length) return false;
    for (let i = 0; i < pattern.length; i++) {
      if (!isMatch(value[i], pattern[i])) return false;
    }
    return true;
  }

  // Plain object pattern: check every key in pattern against value
  if (Array.isArray(value)) return false; // pattern is object, value is array

  const patternObj = pattern as Record<string, unknown>;
  const valueObj = value as Record<string, unknown>;

  for (const key of Object.keys(patternObj)) {
    if (!Object.prototype.hasOwnProperty.call(valueObj, key)) return false;
    if (!isMatch(valueObj[key], patternObj[key])) return false;
  }

  return true;
}

// ─── guard() ─────────────────────────────────────────────────────────────────

/**
 * Evaluate an ordered list of `[predicate, handler]` pairs and return the
 * result of the first predicate that returns `true`.
 * Returns `undefined` when no guard matches.
 *
 * @example
 * const result = guard(score, [
 *   [s => s >= 90, () => 'A'],
 *   [s => s >= 80, () => 'B'],
 *   [() => true,  () => 'C'],
 * ]);
 */
export function guard<T>(
  value: T,
  guards: Array<[(v: T) => boolean, (v: T) => unknown]>,
): unknown {
  for (const [predicate, handler] of guards) {
    if (predicate(value)) {
      return handler(value);
    }
  }
  return undefined;
}
