// @ts-check
// ─── Transformer ─────────────────────────────────────────────────────────────
// Data transformation utilities: deep clone, merge, pick/omit, flatten,
// unflatten, groupBy, sortBy, chunk, zip.

// ─── deepClone ────────────────────────────────────────────────────────────────

/**
 * Deep clone an object. Handles circular references gracefully by returning
 * the already-cloned reference.
 */
export function deepClone<T>(obj: T): T {
  return _cloneWithSeen(obj, new Map()) as T;
}

function _cloneWithSeen(obj: unknown, seen: Map<unknown, unknown>): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);

  if (Array.isArray(obj)) {
    const cloned: unknown[] = [];
    seen.set(obj, cloned);
    for (const item of obj) {
      cloned.push(_cloneWithSeen(item, seen));
    }
    return cloned;
  }

  const cloned: Record<string, unknown> = {};
  seen.set(obj, cloned);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    cloned[key] = _cloneWithSeen((obj as Record<string, unknown>)[key], seen);
  }
  return cloned;
}

// ─── deepMerge ────────────────────────────────────────────────────────────────

/**
 * Deep merge objects. Later arguments override earlier ones. Arrays are replaced
 * (not merged).
 */
export function deepMerge<T extends object>(...objects: Partial<T>[]): T {
  const result: Record<string, unknown> = {};
  for (const obj of objects) {
    if (obj == null) continue;
    for (const key of Object.keys(obj)) {
      const val = (obj as Record<string, unknown>)[key];
      const existing = result[key];
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        existing !== null &&
        typeof existing === 'object' &&
        !Array.isArray(existing)
      ) {
        result[key] = deepMerge(
          existing as Record<string, unknown>,
          val as Record<string, unknown>,
        );
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}

// ─── pick ─────────────────────────────────────────────────────────────────────

/** Pick specific keys from an object, returning a new object with only those keys. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ─── omit ─────────────────────────────────────────────────────────────────────

/** Omit specific keys from an object, returning a new object without those keys. */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const omitSet = new Set(keys as string[]);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!omitSet.has(key)) {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result as Omit<T, K>;
}

// ─── flatten ──────────────────────────────────────────────────────────────────

/**
 * Flatten a nested object to dot-path keys.
 * e.g. { a: { b: 1 } } -> { 'a.b': 1 }
 */
export function flatten(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const nested = flatten(val as Record<string, unknown>, fullKey);
      Object.assign(result, nested);
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

// ─── unflatten ────────────────────────────────────────────────────────────────

/**
 * Unflatten dot-path keys back to a nested object.
 * e.g. { 'a.b': 1 } -> { a: { b: 1 } }
 */
export function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = obj[key];
  }
  return result;
}

// ─── groupBy ──────────────────────────────────────────────────────────────────

/** Group an array by a key function, returning a Record mapping keys to arrays. */
export function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = fn(item);
    if (key in result) {
      result[key].push(item);
    } else {
      result[key] = [item];
    }
  }
  return result;
}

// ─── sortBy ───────────────────────────────────────────────────────────────────

/**
 * Sort an array of objects by multiple keys or key functions.
 * Sorting is stable and returns a new array (does not mutate).
 */
export function sortBy<T>(arr: T[], ...keys: Array<keyof T | ((item: T) => unknown)>): T[] {
  return [...arr].sort((a, b) => {
    for (const key of keys) {
      const getVal = typeof key === 'function' ? key : (item: T) => item[key];
      const av = getVal(a) as number | string;
      const bv = getVal(b) as number | string;
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  });
}

// ─── chunk ────────────────────────────────────────────────────────────────────

/** Chunk an array into groups of size n. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── zip ──────────────────────────────────────────────────────────────────────

/**
 * Zip multiple arrays together into an array of tuples.
 * Stops at the length of the shortest array.
 */
export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  const minLength = Math.min(...arrays.map((a) => a.length));
  return Array.from({ length: minLength }, (_, i) => arrays.map((a) => a[i]));
}
