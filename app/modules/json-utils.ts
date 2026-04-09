// @ts-check
// ─── JSON Utilities ──────────────────────────────────────────────────────────
// Safe JSON parsing, manipulation, and transformation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Safe JSON parse. Returns null on error instead of throwing. */
export function jsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Safe JSON stringify. Returns null on error (circular refs etc). */
export function jsonStringify(value: unknown, indent?: number): string | null {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return null;
  }
}

/** Deep clone via JSON roundtrip (loses non-JSON types). */
export function jsonClone<T>(value: T): T | null {
  const str = jsonStringify(value);
  if (str === null) return null;
  return jsonParse<T>(str);
}

/** Check if a string is valid JSON. */
export function isValidJSON(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Merge two JSON-compatible objects deeply. */
export function jsonMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseVal = (base as Record<string, unknown>)[key as string];
    const overVal = (override as Record<string, unknown>)[key as string];
    if (
      overVal !== null &&
      typeof overVal === 'object' &&
      !Array.isArray(overVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key as string] = jsonMerge(
        baseVal as Record<string, unknown>,
        overVal as Partial<Record<string, unknown>>,
      );
    } else {
      result[key as string] = overVal;
    }
  }
  return result as T;
}

/** Get a value at a dot-notation path in a JSON object. */
export function jsonGet(obj: unknown, path: string): unknown {
  if (path === '') return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Set a value at a dot-notation path in a JSON object. Returns new object. */
export function jsonSet(obj: unknown, path: string, value: unknown): unknown {
  if (path === '') return value;
  const parts = path.split('.');
  const root =
    obj !== null && typeof obj === 'object' && !Array.isArray(obj)
      ? { ...(obj as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  let current: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];
    if (next !== null && typeof next === 'object' && !Array.isArray(next)) {
      current[part] = { ...(next as Record<string, unknown>) };
    } else {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return root;
}

/** Flatten a nested JSON object to dot-notation keys. */
export function jsonFlatten(obj: object, separator = '.'): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  function recurse(current: unknown, prefix: string): void {
    if (
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      Object.keys(current as object).length > 0
    ) {
      for (const [key, val] of Object.entries(current as Record<string, unknown>)) {
        const newKey = prefix ? `${prefix}${separator}${key}` : key;
        recurse(val, newKey);
      }
    } else {
      result[prefix] = current;
    }
  }

  recurse(obj, '');
  return result;
}

/** Unflatten dot-notation keys back to nested object. */
export function jsonUnflatten(flat: Record<string, unknown>, separator = '.'): object {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(separator);
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

/** Minify JSON string (remove whitespace). */
export function jsonMinify(text: string): string | null {
  const parsed = jsonParse(text);
  if (parsed === null && !isValidJSON(text)) return null;
  return JSON.stringify(parsed);
}

/** Pretty-print JSON with custom indent. */
export function jsonPretty(value: unknown, indent = 2): string | null {
  return jsonStringify(value, indent);
}
