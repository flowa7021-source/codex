// @ts-check
// ─── URL Utilities ───────────────────────────────────────────────────────────
// URL manipulation helpers for parsing, querying, and normalizing URLs.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Parse a URL string. Returns null on invalid input. */
export function parseURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Get a specific query parameter value. Returns null if not found. */
export function getQueryParam(url: string, key: string): string | null {
  const parsed = parseURL(url);
  if (!parsed) return null;
  return parsed.searchParams.get(key);
}

/** Set/update a query parameter and return the new URL string. */
export function setQueryParam(url: string, key: string, value: string): string {
  const parsed = parseURL(url);
  if (!parsed) return url;
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

/** Remove a query parameter and return the new URL string. */
export function removeQueryParam(url: string, key: string): string {
  const parsed = parseURL(url);
  if (!parsed) return url;
  parsed.searchParams.delete(key);
  return parsed.toString();
}

/** Get all query parameters as an object. */
export function getAllQueryParams(url: string): Record<string, string> {
  const parsed = parseURL(url);
  if (!parsed) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams.entries()) {
    result[key] = value;
  }
  return result;
}

/** Check if a URL is absolute (has a scheme). */
export function isAbsoluteURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol.length > 0;
  } catch {
    return false;
  }
}

/** Join a base URL with a path segment (handles slashes). */
export function joinURL(base: string, ...parts: string[]): string {
  let result = base.replace(/\/+$/, '');
  for (const part of parts) {
    const segment = part.replace(/^\/+/, '').replace(/\/+$/, '');
    if (segment) {
      result = result + '/' + segment;
    }
  }
  return result;
}

/** Extract the file extension from a URL path. Returns '' if none. */
export function getURLExtension(url: string): string {
  const parsed = parseURL(url);
  const pathname = parsed ? parsed.pathname : url.split('?')[0].split('#')[0];
  const lastSegment = pathname.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return lastSegment.slice(dotIndex + 1);
}

/** Extract the filename from a URL path (without query/hash). */
export function getURLFilename(url: string): string {
  const parsed = parseURL(url);
  const pathname = parsed ? parsed.pathname : url.split('?')[0].split('#')[0];
  return pathname.split('/').pop() ?? '';
}

/** Check if two URLs have the same origin. */
export function sameOrigin(a: string, b: string): boolean {
  const parsedA = parseURL(a);
  const parsedB = parseURL(b);
  if (!parsedA || !parsedB) return false;
  return parsedA.origin === parsedB.origin;
}

/** Normalize a URL: lowercase host, remove default ports, sort query params. */
export function normalizeURL(url: string): string {
  const parsed = parseURL(url);
  if (!parsed) return url;

  // Lowercase the hostname
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove default ports
  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  // Sort query params
  parsed.searchParams.sort();

  return parsed.toString();
}
