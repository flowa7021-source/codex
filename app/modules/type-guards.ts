// @ts-check
// ─── Type Guards ─────────────────────────────────────────────────────────────
// TypeScript type guard functions for runtime value classification.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Whether value is null. */
export function isNull(value: unknown): value is null {
  return value === null;
}

/** Whether value is undefined. */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/** Whether value is null or undefined. */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Whether value is a non-null object (not array). */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether value is an array. */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** Whether value is a string. */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Whether value is a number (excludes NaN). */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/** Whether value is a boolean. */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Whether value is a function. */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/** Whether value is a Promise. */
export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value instanceof Promise ||
    (isObject(value) &&
      isFunction((value as Record<string, unknown>)['then']) &&
      isFunction((value as Record<string, unknown>)['catch']))
  );
}

/** Whether value is a Date instance. */
export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/** Whether value is a RegExp instance. */
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/** Whether value is a finite number. */
export function isFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Whether value is an integer. */
export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** Assert that value is not null/undefined, throw if it is. */
export function assertDefined<T>(value: T, message?: string): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message ?? 'Expected value to be defined, but received null or undefined');
  }
}
