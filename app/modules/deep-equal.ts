// @ts-check
// ─── Deep Equality ────────────────────────────────────────────────────────────
// Recursive structural equality, shallow equality, structured cloning,
// diff computation and patch application.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single difference between two values at a given path. */
export interface Difference {
  /** Dot-separated property path, e.g. `"a.b[2].c"`. */
  path: string;
  oldVal: unknown;
  newVal: unknown;
}

// ─── deepEqual() ──────────────────────────────────────────────────────────────

/**
 * Recursively compare `a` and `b` for structural equality.
 *
 * - Primitives are compared with `Object.is`.
 * - `Date` instances are compared by their time value.
 * - `RegExp` instances are compared by source and flags.
 * - `Map` / `Set` are compared by their entries / values (order-insensitive
 *   for Sets, key-order-insensitive for Maps).
 * - Arrays are compared element by element.
 * - Plain objects are compared by their own enumerable keys.
 * - Functions are compared by reference.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return _deepEqual(a, b, new Set());
}

function _deepEqual(a: unknown, b: unknown, seen: Set<unknown>): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' && typeof b !== 'object') return false;
  if (typeof a !== typeof b) return false;

  // Protect against circular refs
  if (seen.has(a)) return false;

  // Date
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof Date || b instanceof Date) return false;

  // RegExp
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (a instanceof RegExp || b instanceof RegExp) return false;

  // Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    seen.add(a);
    for (const [key, val] of a) {
      if (!b.has(key)) { seen.delete(a); return false; }
      if (!_deepEqual(val, b.get(key), seen)) { seen.delete(a); return false; }
    }
    seen.delete(a);
    return true;
  }
  if (a instanceof Map || b instanceof Map) return false;

  // Set
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    seen.add(a);
    // Each value in `a` must have a structural match in `b`
    const bArr = Array.from(b);
    const matched = new Array(bArr.length).fill(false);
    for (const aVal of a) {
      let found = false;
      for (let i = 0; i < bArr.length; i++) {
        if (!matched[i] && _deepEqual(aVal, bArr[i], seen)) {
          matched[i] = true;
          found = true;
          break;
        }
      }
      if (!found) { seen.delete(a); return false; }
    }
    seen.delete(a);
    return true;
  }
  if (a instanceof Set || b instanceof Set) return false;

  // Array
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    seen.add(a);
    for (let i = 0; i < a.length; i++) {
      if (!_deepEqual(a[i], b[i], seen)) { seen.delete(a); return false; }
    }
    seen.delete(a);
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;

  // Plain objects
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  seen.add(a);
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, key)) { seen.delete(a); return false; }
    if (!_deepEqual(ao[key], bo[key], seen)) { seen.delete(a); return false; }
  }
  seen.delete(a);
  return true;
}

// ─── shallowEqual() ───────────────────────────────────────────────────────────

/**
 * Compare `a` and `b` one level deep.
 *
 * - Primitives: `Object.is`.
 * - Arrays: same length and `Object.is` element equality.
 * - Objects: same own enumerable keys and `Object.is` value equality for each.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, key)) return false;
    if (!Object.is(ao[key], bo[key])) return false;
  }
  return true;
}

// ─── deepCloneStructured() ────────────────────────────────────────────────────

/**
 * Return a deep clone of `value` using recursive copying (no circular
 * reference support — circular refs will throw a `TypeError`).
 *
 * Supports: primitives, plain objects, arrays, `Date`, `RegExp`, `Map`, `Set`.
 */
export function deepCloneStructured(value: unknown): unknown {
  return _clone(value, new Map());
}

function _clone(value: unknown, seen: Map<unknown, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) {
    throw new TypeError('deepCloneStructured: circular reference detected');
  }

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  if (value instanceof Map) {
    const result = new Map<unknown, unknown>();
    seen.set(value, result);
    for (const [k, v] of value) {
      result.set(_clone(k, seen), _clone(v, seen));
    }
    seen.delete(value);
    return result;
  }

  if (value instanceof Set) {
    const result = new Set<unknown>();
    seen.set(value, result);
    for (const v of value) {
      result.add(_clone(v, seen));
    }
    seen.delete(value);
    return result;
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(value, result);
    for (const item of value) {
      result.push(_clone(item, seen));
    }
    seen.delete(value);
    return result;
  }

  // Plain object
  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  seen.set(value, result);
  for (const key of Object.keys(obj)) {
    result[key] = _clone(obj[key], seen);
  }
  seen.delete(value);
  return result;
}

// ─── diff() ───────────────────────────────────────────────────────────────────

/**
 * Compute a list of differences between `a` and `b`.
 * Each entry records the dot/bracket path, the old value, and the new value.
 *
 * Recursion is performed for plain objects and arrays; all other values are
 * compared with `deepEqual` and recorded as a single diff when unequal.
 */
export function diff(a: unknown, b: unknown): Difference[] {
  const result: Difference[] = [];
  _diff(a, b, '', result);
  return result;
}

function _diff(a: unknown, b: unknown, path: string, result: Difference[]): void {
  if (deepEqual(a, b)) return;

  const bothObjects =
    a !== null && b !== null &&
    typeof a === 'object' && typeof b === 'object' &&
    !Array.isArray(a) && !Array.isArray(b) &&
    !(a instanceof Date) && !(b instanceof Date) &&
    !(a instanceof RegExp) && !(b instanceof RegExp) &&
    !(a instanceof Map) && !(b instanceof Map) &&
    !(a instanceof Set) && !(b instanceof Set);

  const bothArrays = Array.isArray(a) && Array.isArray(b);

  if (bothObjects) {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const key of keys) {
      const childPath = path === '' ? key : `${path}.${key}`;
      _diff(ao[key], bo[key], childPath, result);
    }
    return;
  }

  if (bothArrays) {
    const aa = a as unknown[];
    const ba = b as unknown[];
    const len = Math.max(aa.length, ba.length);
    for (let i = 0; i < len; i++) {
      const childPath = `${path}[${i}]`;
      _diff(aa[i], ba[i], childPath, result);
    }
    return;
  }

  // Leaf-level difference
  result.push({ path, oldVal: a, newVal: b });
}

// ─── patch() ─────────────────────────────────────────────────────────────────

/**
 * Apply a list of diffs (as produced by `diff()`) to `target`, returning a
 * new deeply-cloned object with the changes applied.
 *
 * Supports dot-separated keys and bracket-index notation, e.g.:
 *   `"a.b[2].c"`
 *
 * If a path segment does not exist in the target clone, intermediate objects
 * or arrays are created as needed.
 */
export function patch(
  target: unknown,
  diffs: Array<{ path: string; newVal: unknown }>,
): unknown {
  const result = deepCloneStructured(target);
  for (const { path, newVal } of diffs) {
    _applyPath(result, path, newVal);
  }
  return result;
}

/**
 * Parse a dot/bracket path string into an array of string/number segments.
 * e.g. `"a.b[2].c"` → `['a', 'b', 2, 'c']`
 */
function parsePath(path: string): Array<string | number> {
  const segments: Array<string | number> = [];
  // Split on '.' but also handle '[N]' bracket notation
  const parts = path.split('.');
  for (const part of parts) {
    // part might be like "arr[0]" or "[0]" or "key"
    const bracketRe = /([^\[]*)\[(\d+)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let matched = false;
    while ((m = bracketRe.exec(part)) !== null) {
      matched = true;
      if (m[1] !== '') segments.push(m[1]);
      segments.push(parseInt(m[2], 10));
      last = bracketRe.lastIndex;
    }
    if (!matched) {
      if (part !== '') segments.push(part);
    } else {
      const tail = part.slice(last);
      if (tail !== '') segments.push(tail);
    }
  }
  return segments;
}

function _applyPath(root: unknown, path: string, newVal: unknown): void {
  if (path === '') {
    // Cannot reassign root in-place for a primitive; caller handles via clone
    return;
  }
  const segments = parsePath(path);
  let current: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current === null || typeof current !== 'object') return;
    const obj = current as Record<string | number, unknown>;
    if (obj[seg] === undefined) {
      // Create intermediate: next segment determines type
      const next = segments[i + 1];
      obj[seg] = typeof next === 'number' ? [] : {};
    }
    current = obj[seg];
  }
  if (current === null || typeof current !== 'object') return;
  const last = segments[segments.length - 1];
  (current as Record<string | number, unknown>)[last] = newVal;
}
