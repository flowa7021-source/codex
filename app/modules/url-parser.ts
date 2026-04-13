// @ts-check
// ─── URL Parser ───────────────────────────────────────────────────────────────
// Pure-JS URL parsing without the URL API, for broad compatibility.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedURL {
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  username: string;
  password: string;
  origin: string;
  href: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Default ports for well-known schemes. */
const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
  'ftp:': '21',
  'ftps:': '990',
  'ws:': '80',
  'wss:': '443',
};

/** Returns an empty ParsedURL shell. */
function emptyParsed(): ParsedURL {
  return {
    protocol: '',
    host: '',
    hostname: '',
    port: '',
    pathname: '',
    search: '',
    hash: '',
    username: '',
    password: '',
    origin: '',
    href: '',
  };
}

// ─── parseUrl ─────────────────────────────────────────────────────────────────

/**
 * Parse a URL string into its component parts.
 * Works with absolute URLs (scheme://authority/path?query#hash) and
 * also path-only / relative URLs (fills in empty strings for missing parts).
 */
export function parseUrl(url: string): ParsedURL {
  const result = emptyParsed();
  if (!url) return result;

  let rest = url;
  result.href = url;

  // ── hash ──────────────────────────────────────────────────────────────────
  const hashIdx = rest.indexOf('#');
  if (hashIdx !== -1) {
    result.hash = rest.slice(hashIdx); // includes '#'
    rest = rest.slice(0, hashIdx);
  }

  // ── search ────────────────────────────────────────────────────────────────
  const searchIdx = rest.indexOf('?');
  if (searchIdx !== -1) {
    result.search = rest.slice(searchIdx); // includes '?'
    rest = rest.slice(0, searchIdx);
  }

  // ── protocol ──────────────────────────────────────────────────────────────
  const protoMatch = /^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//.exec(rest);
  if (protoMatch) {
    result.protocol = protoMatch[1].toLowerCase() + ':';
    rest = rest.slice(protoMatch[0].length);

    // ── authority (userinfo@host:port) ──────────────────────────────────────
    const slashIdx = rest.indexOf('/');
    const authority = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    result.pathname = slashIdx === -1 ? '/' : rest.slice(slashIdx);

    // userinfo
    const atIdx = authority.indexOf('@');
    let hostPart = authority;
    if (atIdx !== -1) {
      const userinfo = authority.slice(0, atIdx);
      hostPart = authority.slice(atIdx + 1);
      const colonIdx = userinfo.indexOf(':');
      if (colonIdx !== -1) {
        result.username = userinfo.slice(0, colonIdx);
        result.password = userinfo.slice(colonIdx + 1);
      } else {
        result.username = userinfo;
      }
    }

    // host / hostname / port
    // IPv6 address: [::1] or [::1]:8080
    if (hostPart.startsWith('[')) {
      const closeBracket = hostPart.indexOf(']');
      if (closeBracket !== -1) {
        result.hostname = hostPart.slice(0, closeBracket + 1);
        const afterBracket = hostPart.slice(closeBracket + 1);
        if (afterBracket.startsWith(':')) {
          result.port = afterBracket.slice(1);
        }
      } else {
        result.hostname = hostPart;
      }
    } else {
      const colonIdx = hostPart.lastIndexOf(':');
      if (colonIdx !== -1) {
        result.hostname = hostPart.slice(0, colonIdx);
        result.port = hostPart.slice(colonIdx + 1);
      } else {
        result.hostname = hostPart;
      }
    }

    result.host = result.port ? `${result.hostname}:${result.port}` : result.hostname;
    result.origin = `${result.protocol}//${result.host}`;
  } else {
    // No scheme — treat the remainder as a path (relative URL)
    result.pathname = rest || '/';
  }

  return result;
}

// ─── buildUrl ─────────────────────────────────────────────────────────────────

/**
 * Construct a URL string from partial ParsedURL parts.
 * Any missing part is treated as an empty string / default.
 */
export function buildUrl(parts: Partial<ParsedURL>): string {
  const protocol = parts.protocol ?? '';
  const hostname = parts.hostname ?? '';
  const port = parts.port ?? '';
  const pathname = parts.pathname ?? '';
  const search = parts.search ?? '';
  const hash = parts.hash ?? '';
  const username = parts.username ?? '';
  const password = parts.password ?? '';

  let url = '';

  if (protocol) {
    url += protocol + '//';
    if (username) {
      url += username;
      if (password) url += ':' + password;
      url += '@';
    }
    url += hostname;
    if (port) url += ':' + port;
  }

  // Ensure pathname starts with '/' when there is an authority
  if (hostname && pathname && !pathname.startsWith('/')) {
    url += '/' + pathname;
  } else {
    url += pathname;
  }

  if (search) url += search.startsWith('?') ? search : '?' + search;
  if (hash) url += hash.startsWith('#') ? hash : '#' + hash;

  return url;
}

// ─── resolveUrl ───────────────────────────────────────────────────────────────

/**
 * Resolve a relative URL against an absolute base URL.
 * Returns the relative URL unchanged when it is already absolute.
 */
export function resolveUrl(base: string, relative: string): string {
  if (!relative) return base;

  // Absolute relative — return as-is
  if (isAbsolute(relative)) return relative;

  // Protocol-relative
  if (relative.startsWith('//')) {
    const baseParsed = parseUrl(base);
    return baseParsed.protocol + relative;
  }

  const baseParsed = parseUrl(base);

  // Absolute path
  if (relative.startsWith('/')) {
    return buildUrl({ ...baseParsed, pathname: relative, search: '', hash: '' });
  }

  // Fragment-only
  if (relative.startsWith('#')) {
    return buildUrl({ ...baseParsed, hash: relative });
  }

  // Query-only
  if (relative.startsWith('?')) {
    return buildUrl({ ...baseParsed, search: relative, hash: '' });
  }

  // Relative path — merge with base directory
  const baseDir = baseParsed.pathname.slice(0, baseParsed.pathname.lastIndexOf('/') + 1);
  const merged = baseDir + relative;

  // Remove dot segments
  const resolved = removeDotSegments(merged);
  return buildUrl({ ...baseParsed, pathname: resolved, search: '', hash: '' });
}

/** Remove . and .. segments from a path (RFC 3986 §5.2.4). */
function removeDotSegments(path: string): string {
  const parts = path.split('/');
  const output: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      if (output.length > 1) output.pop();
    } else if (part !== '.') {
      output.push(part);
    }
  }
  return output.join('/') || '/';
}

// ─── isAbsolute / isRelative ──────────────────────────────────────────────────

/** Returns true when the URL begins with a scheme (e.g. `https://`). */
export function isAbsolute(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(url);
}

/** Returns true when the URL does NOT begin with a scheme. */
export function isRelative(url: string): boolean {
  return !isAbsolute(url);
}

// ─── getOrigin ────────────────────────────────────────────────────────────────

/** Return the origin (scheme + "://" + host) of a URL, or '' for relative URLs. */
export function getOrigin(url: string): string {
  return parseUrl(url).origin;
}

// ─── stripHash ────────────────────────────────────────────────────────────────

/** Remove the hash fragment (including the `#`) from a URL. */
export function stripHash(url: string): string {
  const idx = url.indexOf('#');
  return idx === -1 ? url : url.slice(0, idx);
}

// ─── stripSearch ──────────────────────────────────────────────────────────────

/** Remove the query string (including the `?`) from a URL, preserving any hash. */
export function stripSearch(url: string): string {
  // Find '?' that appears before any '#'
  const hashIdx = url.indexOf('#');
  const searchIdx = url.indexOf('?');
  if (searchIdx === -1) return url;
  if (hashIdx !== -1 && hashIdx < searchIdx) return url; // '?' is inside hash
  const hash = hashIdx !== -1 ? url.slice(hashIdx) : '';
  return url.slice(0, searchIdx) + hash;
}

// ─── normalizeUrl ─────────────────────────────────────────────────────────────

/**
 * Normalize a URL:
 *   - Lowercase scheme and hostname
 *   - Remove the port when it matches the scheme's default (80 for http, 443 for https, …)
 *   - Ensure pathname is at least '/'
 */
export function normalizeUrl(url: string): string {
  if (!isAbsolute(url)) return url;
  const parsed = parseUrl(url);

  // Lowercase scheme and hostname
  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  // Drop default port
  let port = parsed.port;
  if (port && DEFAULT_PORTS[protocol] === port) {
    port = '';
  }

  const host = port ? `${hostname}:${port}` : hostname;
  const pathname = parsed.pathname || '/';

  return buildUrl({ ...parsed, protocol, hostname, host, port, pathname });
}
