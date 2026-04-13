// @ts-check
// ─── URL Router / Pattern Matcher ────────────────────────────────────────────
// Simple URL router with named params and wildcard support.
// No DOM, no browser APIs — pure logic, fully unit-testable.

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of a successful route match.
 * @template T
 */
export interface RouteMatch<T = unknown> {
  /** Extracted named params (e.g. { id: '42' }) and wildcard capture. */
  params: Record<string, string>;
  /** Parsed query string key/value pairs. */
  query: Record<string, string>;
  /** The data associated with the matched route. */
  data: T;
}

/** Internal representation of a registered route entry. */
interface RouteEntry<T> {
  pattern: string;
  segments: string[];
  hasWildcard: boolean;
  data: T;
}

// ─── Router class ────────────────────────────────────────────────────────────

/**
 * Simple URL router that matches path patterns with named parameters
 * and wildcard segments. Query strings are parsed separately.
 *
 * Pattern syntax:
 *   /users/:id          → named param (matches one segment)
 *   /files/*            → wildcard (matches rest of path, captured as 'wildcard')
 *   /static/path        → literal segment match
 *
 * @template T - Type of data associated with each route.
 *
 * @example
 *   const router = new Router<{ handler: string }>();
 *   router.add('/users/:id', { handler: 'userDetail' });
 *   const result = router.match('/users/42?tab=profile');
 *   // result.params  → { id: '42' }
 *   // result.query   → { tab: 'profile' }
 *   // result.data    → { handler: 'userDetail' }
 */
export class Router<T = unknown> {
  private _entries: Array<RouteEntry<T>>;

  constructor() {
    this._entries = [];
  }

  /**
   * Register a route pattern and its associated data.
   * Returns `this` for chaining.
   */
  add(pattern: string, data: T): Router<T> {
    const normalized = normalizePath(pattern);
    const segments = normalized.split('/').filter(Boolean);
    const hasWildcard = segments.length > 0 && segments[segments.length - 1] === '*';

    this._entries.push({ pattern: normalized, segments, hasWildcard, data });
    return this;
  }

  /**
   * Match a URL path (with optional query string) against registered routes.
   * Returns the first match, or null if none found.
   */
  match(url: string): RouteMatch<T> | null {
    const { path, query } = parseUrl(url);
    const pathSegments = path.split('/').filter(Boolean);

    for (const entry of this._entries) {
      const params = _matchSegments(entry, pathSegments);
      if (params !== null) {
        return { params, query, data: entry.data };
      }
    }

    return null;
  }

  /**
   * Match a URL against ALL registered routes (middleware-style).
   * Returns every match in registration order.
   */
  matchAll(url: string): Array<RouteMatch<T>> {
    const { path, query } = parseUrl(url);
    const pathSegments = path.split('/').filter(Boolean);
    const results: Array<RouteMatch<T>> = [];

    for (const entry of this._entries) {
      const params = _matchSegments(entry, pathSegments);
      if (params !== null) {
        results.push({ params, query, data: entry.data });
      }
    }

    return results;
  }

  /**
   * All registered route patterns in registration order.
   */
  get routes(): string[] {
    return this._entries.map(e => e.pattern);
  }
}

// ─── Internal match helper ────────────────────────────────────────────────────

/**
 * Attempt to match path segments against a route entry.
 * Returns extracted params on success, null on mismatch.
 */
function _matchSegments<T>(
  entry: RouteEntry<T>,
  pathSegments: string[],
): Record<string, string> | null {
  const { segments, hasWildcard } = entry;

  if (hasWildcard) {
    // Wildcard route: pattern segments (minus '*') must match as prefix
    const prefixSegments = segments.slice(0, -1);
    if (pathSegments.length < prefixSegments.length) return null;

    const params: Record<string, string> = {};

    for (let i = 0; i < prefixSegments.length; i++) {
      const patSeg = prefixSegments[i];
      const pathSeg = pathSegments[i];
      if (patSeg.startsWith(':')) {
        params[patSeg.slice(1)] = pathSeg;
      } else if (patSeg !== pathSeg) {
        return null;
      }
    }

    // Capture the rest as 'wildcard'
    params['wildcard'] = pathSegments.slice(prefixSegments.length).join('/');
    return params;
  }

  // Exact segment count required for non-wildcard routes
  if (segments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < segments.length; i++) {
    const patSeg = segments[i];
    const pathSeg = pathSegments[i];
    if (patSeg.startsWith(':')) {
      params[patSeg.slice(1)] = pathSeg;
    } else if (patSeg !== pathSeg) {
      return null;
    }
  }

  return params;
}

// ─── URL Utilities ────────────────────────────────────────────────────────────

/**
 * Parse a URL path string into its path and query components.
 * Does not require an absolute URL — relative paths like `/users/1?q=foo` work.
 *
 * @example
 *   parseUrl('/search?q=hello&page=2')
 *   // → { path: '/search', query: { q: 'hello', page: '2' } }
 */
export function parseUrl(url: string): { path: string; query: Record<string, string> } {
  const qIndex = url.indexOf('?');

  if (qIndex === -1) {
    return { path: normalizePath(url), query: {} };
  }

  const rawPath = url.slice(0, qIndex);
  const rawQuery = url.slice(qIndex + 1);

  const query: Record<string, string> = {};
  if (rawQuery.length > 0) {
    for (const pair of rawQuery.split('&')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) {
        if (pair.length > 0) query[decodeURIComponent(pair)] = '';
      } else {
        const key = decodeURIComponent(pair.slice(0, eqIndex));
        const val = decodeURIComponent(pair.slice(eqIndex + 1));
        if (key.length > 0) query[key] = val;
      }
    }
  }

  return { path: normalizePath(rawPath), query };
}

/**
 * Build a URL from a path template, substituting `:param` placeholders and
 * appending optional query parameters.
 *
 * @example
 *   buildUrl('/users/:id/posts/:post', { id: '5', post: '12' }, { tab: 'comments' })
 *   // → '/users/5/posts/12?tab=comments'
 */
export function buildUrl(
  path: string,
  params?: Record<string, string | number>,
  query?: Record<string, string>,
): string {
  let result = path;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }

  if (query && Object.keys(query).length > 0) {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
    result = `${result}?${pairs.join('&')}`;
  }

  return result;
}

/**
 * Join path segments into a single normalized path.
 * Handles leading/trailing slashes and deduplicates internal slashes.
 *
 * @example
 *   joinPaths('/api/', '/users/', '/42/')  // → '/api/users/42'
 *   joinPaths('api', 'users')             // → '/api/users'
 */
export function joinPaths(...parts: string[]): string {
  const joined = parts
    .map((p, i) => {
      // Strip leading slash from all but first if first starts with /
      if (i === 0) return p.replace(/\/+$/, '');
      return p.replace(/^\/+/, '').replace(/\/+$/, '');
    })
    .filter(p => p.length > 0)
    .join('/');

  // Ensure leading slash
  const withLeading = joined.startsWith('/') ? joined : `/${joined}`;
  return normalizePath(withLeading);
}

/**
 * Normalize a path: collapse multiple consecutive slashes into one,
 * and remove trailing slashes (except for the root '/').
 *
 * @example
 *   normalizePath('//api//users//') // → '/api/users'
 *   normalizePath('/')              // → '/'
 *   normalizePath('')               // → '/'
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') return '/';

  // Collapse repeated slashes
  let result = path.replace(/\/\/+/g, '/');

  // Remove trailing slash (unless root)
  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  return result;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new Router instance. Provides a functional alternative to `new Router()`.
 * @template T
 */
export function createRouter<T = unknown>(): Router<T> {
  return new Router<T>();
}
