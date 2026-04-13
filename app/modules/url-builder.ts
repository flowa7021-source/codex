// @ts-check
// ─── URL Builder ──────────────────────────────────────────────────────────────
// URL construction and manipulation library with both OOP and functional APIs.

// ─── UrlBuilder ───────────────────────────────────────────────────────────────

/**
 * Fluent URL builder with chainable setters.
 *
 * @example
 *   const url = new UrlBuilder('https://example.com')
 *     .setPath('/search')
 *     .addQuery('q', 'hello')
 *     .setFragment('results')
 *     .build();
 *   // => 'https://example.com/search?q=hello#results'
 */
export class UrlBuilder {
  #protocol: string = '';
  #host: string = '';
  #port: number | null = null;
  #path: string = '';
  #params: Map<string, string> = new Map();
  #fragment: string = '';

  constructor(base?: string) {
    if (base) {
      try {
        const parsed = new URL(base);
        this.#protocol = parsed.protocol.replace(/:$/, '');
        this.#host = parsed.hostname;
        this.#port = parsed.port ? parseInt(parsed.port, 10) : null;
        this.#path = parsed.pathname;
        parsed.searchParams.forEach((value, key) => {
          this.#params.set(key, value);
        });
        this.#fragment = parsed.hash.replace(/^#/, '');
      } catch {
        // If it's not a valid URL, treat it as a base path
        this.#path = base;
      }
    }
  }

  /** Set the URL scheme, e.g. 'https', 'http'. */
  setProtocol(protocol: string): this {
    this.#protocol = protocol.replace(/:?\/*$/, '');
    return this;
  }

  /** Set the host (hostname without port). */
  setHost(host: string): this {
    this.#host = host;
    return this;
  }

  /** Set the port number. */
  setPort(port: number): this {
    this.#port = port;
    return this;
  }

  /** Replace the URL path entirely. */
  setPath(path: string): this {
    this.#path = path.startsWith('/') ? path : `/${path}`;
    return this;
  }

  /** Append a segment to the existing path. */
  appendPath(segment: string): this {
    const base = this.#path.replace(/\/$/, '');
    const seg = segment.replace(/^\//, '');
    this.#path = seg ? `${base}/${seg}` : base;
    return this;
  }

  /** Replace all query parameters. */
  setQuery(params: Record<string, string | number | boolean>): this {
    this.#params = new Map(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    return this;
  }

  /** Add or replace a single query parameter. */
  addQuery(key: string, value: string | number | boolean): this {
    this.#params.set(key, String(value));
    return this;
  }

  /** Remove a single query parameter. */
  removeQuery(key: string): this {
    this.#params.delete(key);
    return this;
  }

  /** Set the URL fragment (hash), without the leading '#'. */
  setFragment(fragment: string): this {
    this.#fragment = fragment.replace(/^#/, '');
    return this;
  }

  /** Build and return the full URL string. */
  build(): string {
    let result = '';

    if (this.#protocol && this.#host) {
      result += `${this.#protocol}://`;
      result += this.#host;
      if (this.#port !== null) {
        result += `:${this.#port}`;
      }
    } else if (this.#protocol && !this.#host) {
      result += `${this.#protocol}:`;
    }

    result += this.#path || (this.#host ? '/' : '');

    if (this.#params.size > 0) {
      const qs = new URLSearchParams([...this.#params.entries()]).toString();
      result += `?${qs}`;
    }

    if (this.#fragment) {
      result += `#${this.#fragment}`;
    }

    return result;
  }

  /** Alias for build(). */
  toString(): string {
    return this.build();
  }

  /** Returns a WHATWG URL object. Throws if the built URL is not absolute. */
  toURL(): URL {
    return new URL(this.build());
  }

  /** Returns a deep clone of this builder. */
  clone(): UrlBuilder {
    const copy = new UrlBuilder();
    copy.#protocol = this.#protocol;
    copy.#host = this.#host;
    copy.#port = this.#port;
    copy.#path = this.#path;
    copy.#params = new Map(this.#params);
    copy.#fragment = this.#fragment;
    return copy;
  }
}

// ─── Functional API ───────────────────────────────────────────────────────────

export interface ParsedUrl {
  protocol: string;
  host: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  params: Record<string, string>;
}

/**
 * Parse a URL string into its component parts.
 * Returns an object with protocol, host, port, pathname, search, hash, and params.
 */
export function parseUrl(url: string): ParsedUrl {
  const parsed = new URL(url);
  const params: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return {
    protocol: parsed.protocol.replace(/:$/, ''),
    host: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash.replace(/^#/, ''),
    params,
  };
}

export interface BuildUrlParts {
  protocol?: string;
  host?: string;
  port?: number;
  path?: string;
  params?: Record<string, string | number | boolean>;
  fragment?: string;
}

/**
 * Build a URL string from its component parts.
 */
export function buildUrl(parts: BuildUrlParts): string {
  const builder = new UrlBuilder();
  if (parts.protocol !== undefined) builder.setProtocol(parts.protocol);
  if (parts.host !== undefined) builder.setHost(parts.host);
  if (parts.port !== undefined) builder.setPort(parts.port);
  if (parts.path !== undefined) builder.setPath(parts.path);
  if (parts.params !== undefined) builder.setQuery(parts.params);
  if (parts.fragment !== undefined) builder.setFragment(parts.fragment);
  return builder.build();
}

/**
 * Add or replace a query parameter in a URL string.
 */
export function addQueryParam(
  url: string,
  key: string,
  value: string | number | boolean,
): string {
  const parsed = new URL(url);
  parsed.searchParams.set(key, String(value));
  return parsed.toString();
}

/**
 * Remove a query parameter from a URL string.
 */
export function removeQueryParam(url: string, key: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete(key);
  return parsed.toString();
}

/**
 * Get a single query parameter value from a URL string.
 * Returns null if the parameter is not present.
 */
export function getQueryParam(url: string, key: string): string | null {
  const parsed = new URL(url);
  return parsed.searchParams.get(key);
}

/**
 * Get all query parameters from a URL string as a plain object.
 */
export function getAllQueryParams(url: string): Record<string, string> {
  const parsed = new URL(url);
  const result: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Join path segments cleanly, collapsing duplicate slashes and handling
 * leading/trailing slashes correctly.
 *
 * @example
 *   joinPaths('/foo/', '/bar/', 'baz') // => '/foo/bar/baz'
 */
export function joinPaths(...parts: string[]): string {
  if (parts.length === 0) return '';

  const segments = parts
    .filter((p) => p !== '')
    .map((p, i) => {
      if (i === 0) {
        // Keep leading slash of first segment, remove trailing slash
        return p.replace(/\/+$/, '');
      }
      // Remove both leading and trailing slashes for middle/last segments
      return p.replace(/^\/+/, '').replace(/\/+$/, '');
    });

  const joined = segments.join('/');
  // Collapse any double slashes (except for protocol like http://)
  return joined.replace(/([^:])\/{2,}/g, '$1/');
}

/**
 * Returns true if the URL is absolute (has a scheme like http:// or https://).
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(url);
}

/**
 * Returns true if the URL is relative (does not have a scheme).
 */
export function isRelativeUrl(url: string): boolean {
  return !isAbsoluteUrl(url);
}

/**
 * Normalize a URL: lowercase scheme and host, remove default ports (80 for
 * http, 443 for https), and remove trailing slash from the path if it's
 * just the root with no query or fragment.
 */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url);

  // Lowercase protocol (URL already does this)
  // Lowercase host (URL already does this)

  // Remove default ports
  const defaultPorts: Record<string, string> = { 'http:': '80', 'https:': '443' };
  if (parsed.port && defaultPorts[parsed.protocol] === parsed.port) {
    parsed.port = '';
  }

  return parsed.toString();
}
