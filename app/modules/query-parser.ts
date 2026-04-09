// @ts-check
// ─── Query Parser ────────────────────────────────────────────────────────────
// Query string serialization and deserialization utilities.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Parse a query string into an object. Handles arrays (key[]=v). */
export function parseQuery(query: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  // Strip leading '?' if present
  const qs = query.startsWith('?') ? query.slice(1) : query;
  if (!qs) return result;

  for (const part of qs.split('&')) {
    if (!part) continue;
    const eqIndex = part.indexOf('=');
    const rawKey = eqIndex === -1 ? part : part.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : part.slice(eqIndex + 1);
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue);

    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      const existing = result[arrayKey];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (existing !== undefined) {
        result[arrayKey] = [existing, value];
      } else {
        result[arrayKey] = [value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Stringify an object into a query string. */
export function stringifyQuery(
  params: Record<string, string | string[] | number | boolean | null | undefined>
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(
          encodeURIComponent(key + '[]') + '=' + encodeURIComponent(String(item))
        );
      }
    } else {
      parts.push(
        encodeURIComponent(key) + '=' + encodeURIComponent(String(value))
      );
    }
  }
  return parts.join('&');
}

/** Get a single value from parsed query (first value if array). */
export function getQueryValue(
  params: Record<string, string | string[]>,
  key: string
): string | null {
  const value = params[key];
  if (value === undefined) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/** Check if a query param exists. */
export function hasQueryKey(
  params: Record<string, string | string[]>,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(params, key);
}

/** Merge two query param objects (b overrides a). */
export function mergeQuery(
  a: Record<string, string | string[]>,
  b: Record<string, string | string[]>
): Record<string, string | string[]> {
  return { ...a, ...b };
}

/** Remove keys from a query object. Returns new object. */
export function omitQuery(
  params: Record<string, string | string[]>,
  keys: string[]
): Record<string, string | string[]> {
  const keySet = new Set(keys);
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!keySet.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/** Pick only specific keys from a query object. Returns new object. */
export function pickQuery(
  params: Record<string, string | string[]>,
  keys: string[]
): Record<string, string | string[]> {
  const keySet = new Set(keys);
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (keySet.has(key)) {
      result[key] = value;
    }
  }
  return result;
}
