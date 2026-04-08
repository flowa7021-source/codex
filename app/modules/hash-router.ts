// @ts-check
// ─── Hash-Based Router ────────────────────────────────────────────────────────
// Lightweight client-side router using the URL hash.
// Supports :param segments, hashchange events, and clean cleanup.

// ─── Module-level state ──────────────────────────────────────────────────────

/** Registered route handlers keyed by pattern. */
const _routes = new Map<string, (params: Record<string, string>) => void>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current hash route (without the #).
 * Returns the path portion only (before any '?').
 */
export function getCurrentRoute(): string {
  const hash = window.location.hash.slice(1);
  const queryIndex = hash.indexOf('?');
  return queryIndex === -1 ? hash : hash.slice(0, queryIndex);
}

/**
 * Navigate to a hash route.
 */
export function navigateTo(route: string, params?: Record<string, string>): void {
  if (params && Object.keys(params).length > 0) {
    window.location.hash = `${route}?${new URLSearchParams(params).toString()}`;
  } else {
    window.location.hash = route;
  }
}

/**
 * Go back in history.
 */
export function goBack(): void {
  window.history.back();
}

/**
 * Register a route handler. Returns an unregister function.
 */
export function onRoute(
  pattern: string,
  handler: (params: Record<string, string>) => void,
): () => void {
  _routes.set(pattern, handler);
  return () => {
    if (_routes.get(pattern) === handler) {
      _routes.delete(pattern);
    }
  };
}

/**
 * Match a route pattern against a path. Returns params or null.
 * Supports :param segments (e.g. '/book/:id/page/:page').
 */
export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const patSeg = patternSegments[i];
    const pathSeg = pathSegments[i];

    if (patSeg.startsWith(':')) {
      // Named parameter segment
      params[patSeg.slice(1)] = pathSeg;
    } else if (patSeg !== pathSeg) {
      // Literal segment mismatch
      return null;
    }
  }

  return params;
}

/**
 * Start the router (begins listening to hashchange events).
 * Returns a stop function.
 */
export function startRouter(): () => void {
  const handler = () => resolveCurrentRoute();
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

/**
 * Trigger route resolution for the current hash.
 * Iterates registered patterns and calls the first matching handler.
 */
export function resolveCurrentRoute(): void {
  const currentPath = getCurrentRoute();

  for (const [pattern, handler] of _routes) {
    const params = matchRoute(pattern, currentPath);
    if (params !== null) {
      handler(params);
      return;
    }
  }
}
