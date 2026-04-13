// @ts-check
// ─── Immutable Data Structure Utilities ──────────────────────────────────────
// Pure functions for working with data immutably. All operations return new
// values and never mutate their inputs.

// ─── Deep Freeze ─────────────────────────────────────────────────────────────

/**
 * Recursively freezes an object and all its nested plain-object / array
 * properties, returning the same reference typed as `Readonly<T>`.
 */
export function freeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj as Readonly<T>;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      freeze(val);
    }
  }
  return obj as Readonly<T>;
}

/**
 * Returns `true` when every nested plain-object / array property of `obj` is
 * frozen (i.e. the same guarantee as `freeze` would produce).
 */
export function isFrozen(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') return true;
  if (!Object.isFrozen(obj)) return false;
  for (const key of Object.keys(obj as object)) {
    if (!isFrozen((obj as Record<string, unknown>)[key])) return false;
  }
  return true;
}

// ─── Immutable Array Operations ───────────────────────────────────────────────

/**
 * Returns a new array with `items` appended, equivalent to `Array.prototype.push`
 * but without mutating the original.
 */
export function push<T>(arr: readonly T[], ...items: T[]): T[] {
  return [...arr, ...items];
}

/**
 * Returns a new array with the last element removed, equivalent to
 * `Array.prototype.pop` but without mutating the original.
 */
export function pop<T>(arr: readonly T[]): T[] {
  if (arr.length === 0) return [];
  return arr.slice(0, arr.length - 1);
}

/**
 * Returns a new array with the first element removed, equivalent to
 * `Array.prototype.shift` but without mutating the original.
 */
export function shift<T>(arr: readonly T[]): T[] {
  if (arr.length === 0) return [];
  return arr.slice(1);
}

/**
 * Returns a new array with `items` prepended, equivalent to
 * `Array.prototype.unshift` but without mutating the original.
 */
export function unshift<T>(arr: readonly T[], ...items: T[]): T[] {
  return [...items, ...arr];
}

/**
 * Returns a new array produced by splicing `deleteCount` elements starting at
 * `start` and inserting `items`, equivalent to `Array.prototype.splice` but
 * without mutating the original.
 *
 * When `deleteCount` is omitted all elements from `start` onward are removed.
 */
export function splice<T>(
  arr: readonly T[],
  start: number,
  deleteCount?: number,
  ...items: T[]
): T[] {
  const copy = [...arr];
  if (deleteCount === undefined) {
    copy.splice(start);
  } else {
    copy.splice(start, deleteCount, ...items);
  }
  return copy;
}

/**
 * Returns a new array where the element at `index` is replaced with `value`.
 * Supports negative indices (counted from the end).
 */
export function set<T>(arr: readonly T[], index: number, value: T): T[] {
  const len = arr.length;
  const i = index < 0 ? len + index : index;
  const copy = [...arr];
  copy[i] = value;
  return copy;
}

/**
 * Returns a new array with the element at `index` removed.
 * Supports negative indices (counted from the end).
 */
export function remove<T>(arr: readonly T[], index: number): T[] {
  const len = arr.length;
  const i = index < 0 ? len + index : index;
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

// ─── Immutable Object Operations ──────────────────────────────────────────────

/**
 * Returns a shallow copy of `obj` with `key` set to `value`.
 */
export function setKey<T extends object>(
  obj: T,
  key: keyof T,
  value: T[keyof T],
): T {
  return { ...obj, [key]: value };
}

/**
 * Returns a shallow copy of `obj` with `key` removed.
 */
export function deleteKey<T extends object>(
  obj: T,
  key: keyof T,
): Omit<T, keyof T> {
  const copy = { ...obj };
  delete copy[key];
  return copy as Omit<T, keyof T>;
}

/**
 * Returns a new object that is a shallow merge of `target` and `source`.
 * Properties in `source` override those in `target`.
 */
export function merge<T extends object, U extends object>(
  target: T,
  source: U,
): T & U {
  return { ...target, ...source };
}

/**
 * Returns a shallow copy of `obj` where the value at `key` has been replaced
 * with the result of calling `updater` on the current value.
 */
export function updateKey<T extends object>(
  obj: T,
  key: keyof T,
  updater: (v: T[keyof T]) => T[keyof T],
): T {
  return { ...obj, [key]: updater(obj[key]) };
}

// ─── Deep Operations ─────────────────────────────────────────────────────────

/**
 * Creates a deep clone of `value`.
 *
 * Handles: primitives, arrays, plain objects, `Date`, `Map`, and `Set`.
 * Circular references are not supported.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;

  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }

  if (value instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    for (const [k, v] of value) {
      cloned.set(deepClone(k), deepClone(v));
    }
    return cloned as unknown as T;
  }

  if (value instanceof Set) {
    const cloned = new Set<unknown>();
    for (const item of value) {
      cloned.add(deepClone(item));
    }
    return cloned as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }

  // Plain object
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as object)) {
    result[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return result as T;
}

/**
 * Recursively merges `source` into `target` and returns a new object.
 * For each key, if both values are plain objects they are merged recursively;
 * otherwise the source value wins.
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const srcVal = source[key];
    const tgtVal = result[key as string];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      !(srcVal instanceof Date) &&
      !(srcVal instanceof Map) &&
      !(srcVal instanceof Set) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal) &&
      !(tgtVal instanceof Date) &&
      !(tgtVal instanceof Map) &&
      !(tgtVal instanceof Set)
    ) {
      result[key as string] = deepMerge(
        tgtVal as object,
        srcVal as Partial<object>,
      );
    } else {
      result[key as string] = srcVal;
    }
  }
  return result as T;
}

/**
 * Returns `true` when `a` and `b` are structurally equal.
 *
 * Handles: primitives, arrays, plain objects, `Date`, `Map`, and `Set`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k)) return false;
      if (!deepEqual(v, b.get(k))) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    )
      return false;
  }
  return true;
}

// ─── Path-Based Operations ───────────────────────────────────────────────────

/**
 * Splits a dot-notation path string into an array of string keys.
 * e.g. `'a.b.c'` → `['a', 'b', 'c']`
 */
function parsePath(path: string): string[] {
  return path.split('.');
}

/**
 * Reads the value at a dot-notation `path` from `obj`.
 * Returns `undefined` if any segment is missing.
 *
 * @example getPath({ a: { b: 1 } }, 'a.b') // → 1
 */
export function getPath(obj: object, path: string): unknown {
  const keys = parsePath(path);
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Returns a new object with the value at dot-notation `path` set to `value`.
 * Intermediate objects are created as needed (they are not deep-cloned).
 *
 * @example setPath({ a: { b: 1 } }, 'a.b', 2) // → { a: { b: 2 } }
 */
export function setPath<T extends object>(
  obj: T,
  path: string,
  value: unknown,
): T {
  const keys = parsePath(path);
  function inner(current: unknown, depth: number): unknown {
    const key = keys[depth];
    const src =
      current !== null && typeof current === 'object'
        ? (current as Record<string, unknown>)
        : {};
    if (depth === keys.length - 1) {
      return { ...src, [key]: value };
    }
    return { ...src, [key]: inner(src[key], depth + 1) };
  }
  return inner(obj, 0) as T;
}

/**
 * Returns a new object with the property at dot-notation `path` removed.
 * Ancestor objects are shallow-copied; unrelated siblings are preserved.
 *
 * @example deletePath({ a: { b: 1, c: 2 } }, 'a.b') // → { a: { c: 2 } }
 */
export function deletePath<T extends object>(obj: T, path: string): T {
  const keys = parsePath(path);
  function inner(current: unknown, depth: number): unknown {
    if (current === null || typeof current !== 'object') return current;
    const src = current as Record<string, unknown>;
    if (depth === keys.length - 1) {
      const copy = { ...src };
      delete copy[keys[depth]];
      return copy;
    }
    const key = keys[depth];
    return { ...src, [key]: inner(src[key], depth + 1) };
  }
  return inner(obj, 0) as T;
}
