// @ts-check
// ─── Deep Link Handling ───────────────────────────────────────────────────────
// Utilities for parsing, building, dispatching, and handling deep link URLs.
// Supports custom protocol-like formats: app://action?param=value

// ─── Module-level state ──────────────────────────────────────────────────────

/** Handlers keyed by action name. */
const _handlers = new Map<string, (params: Record<string, string>) => void>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a deep link URL and extract its parameters.
 * Supports custom protocol-like formats: app://action?param=value
 */
export function parseDeepLink(
  url: string,
): { protocol: string; action: string; params: Record<string, string> } | null {
  if (typeof url !== 'string') return null;

  const separatorIndex = url.indexOf('://');
  if (separatorIndex === -1) return null;

  const protocol = url.slice(0, separatorIndex);
  if (!protocol) return null;

  const rest = url.slice(separatorIndex + 3);
  const queryIndex = rest.indexOf('?');

  const action = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? '' : rest.slice(queryIndex + 1);

  const params: Record<string, string> = {};
  if (queryString) {
    try {
      const searchParams = new URLSearchParams(queryString);
      for (const [key, value] of searchParams) {
        params[key] = value;
      }
    } catch {
      // malformed query string — return empty params
    }
  }

  return { protocol, action, params };
}

/**
 * Build a deep link URL from components.
 */
export function buildDeepLink(
  protocol: string,
  action: string,
  params?: Record<string, string>,
): string {
  const base = `${protocol}://${action}`;
  if (!params || Object.keys(params).length === 0) return base;
  return `${base}?${new URLSearchParams(params).toString()}`;
}

/**
 * Check if the current page URL contains deep link parameters (in hash or search).
 * Looks for `#deep-link:action?params` format in window.location.hash.
 */
export function getCurrentDeepLink(): { action: string; params: Record<string, string> } | null {
  try {
    const hash = window.location.hash;
    if (!hash) return null;

    // Remove leading '#'
    const fragment = hash.slice(1);
    const prefix = 'deep-link:';
    if (!fragment.startsWith(prefix)) return null;

    const rest = fragment.slice(prefix.length);
    const queryIndex = rest.indexOf('?');
    const action = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
    const queryString = queryIndex === -1 ? '' : rest.slice(queryIndex + 1);

    if (!action) return null;

    const params: Record<string, string> = {};
    if (queryString) {
      try {
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams) {
          params[key] = value;
        }
      } catch {
        // malformed query string — return empty params
      }
    }

    return { action, params };
  } catch {
    return null;
  }
}

/**
 * Register a handler for a specific deep link action.
 * Returns an unregister function.
 */
export function onDeepLink(
  action: string,
  handler: (params: Record<string, string>) => void,
): () => void {
  _handlers.set(action, handler);
  return () => {
    if (_handlers.get(action) === handler) {
      _handlers.delete(action);
    }
  };
}

/**
 * Dispatch a deep link to registered handlers.
 * Returns true if a handler was found and called.
 */
export function dispatchDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);
  if (!parsed) return false;

  const handler = _handlers.get(parsed.action);
  if (!handler) return false;

  handler(parsed.params);
  return true;
}
