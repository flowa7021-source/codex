// @ts-check
// ─── Object Utilities ────────────────────────────────────────────────────────
// General-purpose object manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Deep clone an object using structuredClone or JSON fallback. */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj)) as T;
}

/** Deep merge two objects (second overwrites first, recursively). */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...(target as Record<string, unknown>) } as Record<string, unknown>;
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const srcVal = (source as Record<string, unknown>)[key];
    const tgtVal = (target as Record<string, unknown>)[key];
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      result[key] = deepMerge(tgtVal as object, srcVal as Partial<object>);
    } else {
      result[key] = srcVal;
    }
  }
  return result as T;
}

/** Get a nested property value by dot-notation path. */
export function getByPath(obj: object, path: string): unknown {
  if (path === '') return obj;
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Set a nested property value by dot-notation path. Mutates and returns obj. */
export function setByPath(obj: object, path: string, value: unknown): object {
  const keys = path.split('.');
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

/** Delete a nested property by dot-notation path. Returns true if deleted. */
export function deleteByPath(obj: object, path: string): boolean {
  const keys = path.split('.');
  let current: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[keys[i]];
  }
  if (current === null || current === undefined || typeof current !== 'object') {
    return false;
  }
  const lastKey = keys[keys.length - 1];
  const record = current as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, lastKey)) {
    return false;
  }
  delete record[lastKey];
  return true;
}

/** Flatten a nested object to a flat path-keyed object. */
export function flattenObject(
  obj: object,
  separator = '.',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function recurse(current: unknown, prefix: string): void {
    if (isPlainObject(current)) {
      for (const key of Object.keys(current as Record<string, unknown>)) {
        const fullKey = prefix ? `${prefix}${separator}${key}` : key;
        recurse((current as Record<string, unknown>)[key], fullKey);
      }
    } else {
      if (prefix) result[prefix] = current;
    }
  }

  recurse(obj, '');
  return result;
}

/** Unflatten a flat path-keyed object to nested. */
export function unflattenObject(
  flat: Record<string, unknown>,
  separator = '.',
): object {
  const result: Record<string, unknown> = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const keys = flatKey.split(separator);
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!isPlainObject(current[key])) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }
  return result;
}

/** Pick specific keys from an object. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Omit specific keys from an object. */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const keySet = new Set<unknown>(keys);
  const result = {} as Omit<T, K>;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (!keySet.has(key)) {
      (result as Record<string, unknown>)[key as string] = obj[key];
    }
  }
  return result;
}

/** Check if two objects are deeply equal. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, (b as unknown[])[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}

/** Get all own enumerable keys recursively (as dot-notation paths). */
export function deepKeys(obj: object, prefix = ''): string[] {
  const result: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    result.push(fullKey);
    if (isPlainObject(value)) {
      result.push(...deepKeys(value as object, fullKey));
    }
  }
  return result;
}

/** Get a nested value by dot-separated path. */
export function getPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return undefined;
  return getByPath(obj as object, path);
}

/** Set a nested value by dot-separated path. */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  setByPath(obj, path, value);
}

/** Delete a nested value by dot-separated path. */
export function deletePath(obj: Record<string, unknown>, path: string): void {
  deleteByPath(obj, path);
}

/** Check if a value is a plain object (not array, not class instance). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Get the type of a value as a string: 'null' | 'undefined' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'function' */
export function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
