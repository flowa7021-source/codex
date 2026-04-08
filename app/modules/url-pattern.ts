// ─── URL Pattern API ──────────────────────────────────────────────────────────
// Wrapper for the URLPattern API for matching and routing URLs.

// @ts-check

// ─── Local type aliases ───────────────────────────────────────────────────────

/** URLPatternInit as defined by the URLPattern spec. */
type URLPatternInit = Record<string, string>;

/** URLPatternResult as defined by the URLPattern spec. */
type URLPatternResult = {
  pathname: { groups: Record<string, string>; input: string };
  search: { groups: Record<string, string>; input: string };
  hash: { groups: Record<string, string>; input: string };
  [key: string]: any;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the URLPattern API is supported.
 */
export function isURLPatternSupported(): boolean {
  return typeof (globalThis as any).URLPattern !== 'undefined';
}

/**
 * Match a URL against a pattern.
 * Returns match result or null if no match.
 *
 * @param pattern - URL pattern string or URLPatternInit
 * @param url - URL to test
 */
export function matchURLPattern(
  pattern: string | URLPatternInit,
  url: string,
): URLPatternResult | null {
  if (!isURLPatternSupported()) return null;
  try {
    const p = new (globalThis as any).URLPattern(pattern);
    return p.exec(url) ?? null;
  } catch {
    return null;
  }
}

/**
 * Test whether a URL matches a pattern (boolean).
 */
export function testURLPattern(pattern: string | URLPatternInit, url: string): boolean {
  if (!isURLPatternSupported()) return false;
  try {
    const p = new (globalThis as any).URLPattern(pattern);
    return p.test(url);
  } catch {
    return false;
  }
}

/**
 * Extract named groups from a URL match.
 * Returns Record<string, string> of all named groups, or null.
 */
export function extractURLGroups(
  pattern: string | URLPatternInit,
  url: string,
): Record<string, string> | null {
  const result = matchURLPattern(pattern, url);
  if (!result) return null;

  const groups: Record<string, string> = {};

  // Collect groups from all URL components
  const components = ['pathname', 'search', 'hash', 'hostname', 'port', 'protocol', 'username', 'password'];
  for (const component of components) {
    const part = result[component];
    if (part && typeof part === 'object' && part.groups) {
      for (const [key, value] of Object.entries(part.groups)) {
        if (value !== undefined) {
          groups[key] = value as string;
        }
      }
    }
  }

  return groups;
}

/**
 * Route a URL to a handler based on the first matching pattern.
 */
export function routeURL(
  url: string,
  routes: Array<{ pattern: string; handler: (groups: Record<string, string>) => void }>,
): boolean {
  for (const route of routes) {
    const result = matchURLPattern(route.pattern, url);
    if (result) {
      const groups = extractURLGroups(route.pattern, url) ?? {};
      route.handler(groups);
      return true;
    }
  }
  return false;
}
