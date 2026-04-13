// @ts-check
// ─── Type Coercion Utilities ──────────────────────────────────────────────────
// Functions for coercing unknown runtime values to specific TypeScript types.
// Each function handles a wide range of inputs gracefully and never throws.

// ─── coerceToString ───────────────────────────────────────────────────────────

/**
 * Coerce any value to a string.
 * - `null` / `undefined` → `''`
 * - Arrays / objects → `JSON.stringify`
 * - Everything else → `String(value)`
 */
export function coerceToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

// ─── coerceToNumber ───────────────────────────────────────────────────────────

/**
 * Coerce any value to a number.
 * Returns `null` when the value cannot be meaningfully converted
 * (e.g. `null`, `undefined`, non-numeric strings, objects, arrays, booleans are
 * converted as follows: `true` → 1, `false` → 0).
 */
export function coerceToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ─── coerceToBoolean ──────────────────────────────────────────────────────────

/**
 * Coerce any value to a boolean.
 * - Strings: `'false'`, `'0'`, `'no'`, `'off'`, `''` → `false`; everything else → `true`
 * - Numbers: `0` / `NaN` → `false`; anything else → `true`
 * - `null` / `undefined` → `false`
 * - Everything else: standard JS truthiness
 */
export function coerceToBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    return lower !== '' && lower !== 'false' && lower !== '0' && lower !== 'no' && lower !== 'off';
  }
  return Boolean(value);
}

// ─── coerceToArray ────────────────────────────────────────────────────────────

/**
 * Coerce any value to an array.
 * - If the value is already an array it is returned as-is (typed as `T[]`).
 * - `null` / `undefined` → `[]`
 * - Everything else is wrapped: `[value]`
 */
export function coerceToArray<T>(value: unknown): T[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value as T[];
  return [value as T];
}

// ─── coerceToDate ─────────────────────────────────────────────────────────────

/**
 * Coerce any value to a `Date`.
 * Returns `null` when coercion produces an invalid date.
 * - Numbers are treated as Unix-millisecond timestamps.
 * - Strings are parsed via `new Date(string)`.
 * - `Date` instances are returned directly (after validity check).
 * - Everything else → `null`.
 */
export function coerceToDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── coerceObject ─────────────────────────────────────────────────────────────

/**
 * Coerce each property of an object according to a field-level schema.
 *
 * @param obj    - The source object (if not a plain object, returns `{}` cast to `T`).
 * @param schema - Maps each field name to the target type.
 *
 * Missing keys in `obj` that appear in `schema` are coerced from `undefined`
 * (e.g. → `''`, `null`, `false`, `[]`).
 */
export function coerceObject<T extends Record<string, unknown>>(
  obj: unknown,
  schema: Record<keyof T, 'string' | 'number' | 'boolean' | 'date'>,
): T {
  const source: Record<string, unknown> =
    obj !== null && typeof obj === 'object' && !Array.isArray(obj)
      ? (obj as Record<string, unknown>)
      : {};

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(schema) as Array<keyof T & string>) {
    const type = schema[key];
    const raw = source[key];
    switch (type) {
      case 'string':
        result[key] = coerceToString(raw);
        break;
      case 'number':
        result[key] = coerceToNumber(raw);
        break;
      case 'boolean':
        result[key] = coerceToBoolean(raw);
        break;
      case 'date':
        result[key] = coerceToDate(raw);
        break;
    }
  }

  return result as T;
}

// ─── sanitize ─────────────────────────────────────────────────────────────────

/**
 * Recursively sanitize a value so it is safe to serialize:
 * - Removes functions and `undefined` values.
 * - Detects and breaks circular references (replaced with `'[Circular]'`).
 * - Stops recursion once `maxDepth` is reached (remaining nested values → `null`).
 *
 * @param value    - The value to sanitize.
 * @param maxDepth - Maximum recursion depth (default: 20).
 */
export function sanitize(value: unknown, maxDepth: number = 20): unknown {
  return sanitizeInner(value, maxDepth, new Set<unknown>());
}

function sanitizeInner(value: unknown, depth: number, seen: Set<unknown>): unknown {
  if (typeof value === 'function') return undefined;
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value !== 'object') return value;

  if (depth <= 0) return null;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (const item of value) {
      const sanitized = sanitizeInner(item, depth - 1, seen);
      if (sanitized !== undefined) {
        result.push(sanitized);
      }
    }
    seen.delete(value);
    return result;
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const sanitized = sanitizeInner(obj[key], depth - 1, seen);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  seen.delete(value);
  return result;
}
