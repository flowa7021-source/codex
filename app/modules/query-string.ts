// @ts-check
// ─── Query String ─────────────────────────────────────────────────────────────
// Parse, build, and manipulate URL query strings.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A parsed query object. Values can be a single string or an array of strings. */
export type ParsedQuery = Record<string, string | string[]>;

// ─── encode / decode ──────────────────────────────────────────────────────────

/**
 * Percent-encode a query string value.
 * Encodes all characters except unreserved ones (RFC 3986) and leaves
 * common safe characters ('-', '_', '.', '!', '~', '*', "'", '(', ')') intact.
 * Spaces are encoded as '%20' (not '+').
 */
export function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Percent-decode a query string value.
 * Handles both '%20' and '+' as space characters.
 */
export function decode(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

// ─── parse ────────────────────────────────────────────────────────────────────

/**
 * Parse a query string into a `ParsedQuery` object.
 * Accepts both the leading `?` form (`?foo=1&bar=2`) and the bare form (`foo=1&bar=2`).
 * Repeated keys become string arrays.
 */
export function parse(queryString: string): ParsedQuery {
  const result: ParsedQuery = {};
  if (!queryString) return result;

  // Strip leading '?'
  const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  if (!qs) return result;

  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    const rawKey = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
    const rawVal = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);

    let key: string;
    let val: string;
    try {
      key = decode(rawKey);
      val = decode(rawVal);
    } catch {
      key = rawKey;
      val = rawVal;
    }

    if (key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(val);
      } else {
        result[key] = [existing, val];
      }
    } else {
      result[key] = val;
    }
  }

  return result;
}

// ─── stringify ────────────────────────────────────────────────────────────────

/**
 * Convert a `ParsedQuery` object back into a query string (without leading `?`).
 * Array values produce repeated key=value pairs.
 * Keys/values are percent-encoded.
 */
export function stringify(params: ParsedQuery): string {
  const pairs: string[] = [];

  for (const key of Object.keys(params)) {
    const val = params[key];
    const encodedKey = encode(key);
    if (Array.isArray(val)) {
      for (const v of val) {
        pairs.push(`${encodedKey}=${encode(v)}`);
      }
    } else {
      pairs.push(`${encodedKey}=${encode(val)}`);
    }
  }

  return pairs.join('&');
}

// ─── get ──────────────────────────────────────────────────────────────────────

/**
 * Get a value (or array of values) by key from a query string.
 * Returns `null` when the key is absent.
 */
export function get(queryString: string, key: string): string | string[] | null {
  const parsed = parse(queryString);
  return key in parsed ? parsed[key] : null;
}

// ─── set ──────────────────────────────────────────────────────────────────────

/**
 * Set (or replace) a key in a query string.
 * Returns the updated query string without a leading `?`.
 * Any existing entries for `key` (including multi-value) are removed first.
 */
export function set(queryString: string, key: string, value: string): string {
  const parsed = parse(queryString);
  parsed[key] = value;
  return stringify(parsed);
}

// ─── append ───────────────────────────────────────────────────────────────────

/**
 * Append a key-value pair without replacing existing values.
 * If `key` already exists the result will contain multiple values for that key.
 * Returns the updated query string without a leading `?`.
 */
export function append(queryString: string, key: string, value: string): string {
  const parsed = parse(queryString);
  if (key in parsed) {
    const existing = parsed[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      parsed[key] = [existing, value];
    }
  } else {
    parsed[key] = value;
  }
  return stringify(parsed);
}

// ─── remove ───────────────────────────────────────────────────────────────────

/**
 * Remove all entries for a key from a query string.
 * Returns the updated query string without a leading `?`.
 * Returns the original (without `?`) when the key is not present.
 */
export function remove(queryString: string, key: string): string {
  const parsed = parse(queryString);
  delete parsed[key];
  return stringify(parsed);
}

// ─── merge ────────────────────────────────────────────────────────────────────

/**
 * Merge two query strings. Values in `overrides` take precedence over `base`.
 * Returns the merged query string without a leading `?`.
 */
export function merge(base: string, overrides: string): string {
  const baseParsed = parse(base);
  const overrideParsed = parse(overrides);
  const merged: ParsedQuery = { ...baseParsed, ...overrideParsed };
  return stringify(merged);
}
