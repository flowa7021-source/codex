// @ts-check
// ─── API Client ───────────────────────────────────────────────────────────────
// Typed HTTP API client with composable middleware and scoped sub-clients.

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ApiRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  url: string;
}

export type Middleware = (
  req: ApiRequest,
  next: (req: ApiRequest) => Promise<ApiResponse>,
) => Promise<ApiResponse>;

export interface ApiClientOptions {
  /** Base URL prepended to all relative paths. */
  baseURL?: string;
  /** Default headers merged into every request. */
  headers?: Record<string, string>;
  /** Request timeout in ms. */
  timeout?: number;
  /** Custom fetch implementation (for testing). */
  fetch?: (req: ApiRequest) => Promise<ApiResponse>;
}

// ─── ApiClient ────────────────────────────────────────────────────────────────

/**
 * Typed HTTP API client with middleware support and scoped sub-clients.
 *
 * @example
 *   const api = new ApiClient({ baseURL: 'https://api.example.com' });
 *   api.use(async (req, next) => {
 *     req.headers = { ...req.headers, Authorization: 'Bearer token' };
 *     return next(req);
 *   });
 *   const { data } = await api.get('/users');
 */
export class ApiClient {
  #baseURL: string;
  #defaultHeaders: Record<string, string>;
  #timeout: number | undefined;
  #fetchFn: (req: ApiRequest) => Promise<ApiResponse>;
  #middleware: Middleware[] = [];

  constructor(options?: ApiClientOptions) {
    this.#baseURL = options?.baseURL ?? '';
    this.#defaultHeaders = options?.headers ?? {};
    this.#timeout = options?.timeout;
    this.#fetchFn = options?.fetch ?? defaultFetch;
  }

  // ─── Middleware ────────────────────────────────────────────────────────────

  /**
   * Add middleware (runs in the order added).
   * Returns `this` for chaining.
   */
  use(middleware: Middleware): this {
    this.#middleware.push(middleware);
    return this;
  }

  // ─── HTTP Verbs ───────────────────────────────────────────────────────────

  get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({ url: path, method: 'GET', params });
  }

  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ url: path, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ url: path, method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ url: path, method: 'PATCH', body });
  }

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>({ url: path, method: 'DELETE' });
  }

  // ─── Generic Request ──────────────────────────────────────────────────────

  /**
   * Send a request, running it through all registered middleware.
   */
  request<T>(req: Partial<ApiRequest> & { url: string }): Promise<ApiResponse<T>> {
    const fullReq: ApiRequest = {
      method: 'GET',
      ...req,
      url: buildUrl(this.#baseURL, req.url, req.params),
      headers: { ...this.#defaultHeaders, ...req.headers },
    };

    // Build middleware chain ending in the real fetch
    const fetchWithTimeout = this.#timeout != null
      ? (r: ApiRequest) => withTimeout(this.#fetchFn(r), this.#timeout!)
      : this.#fetchFn;

    const chain = buildChain(this.#middleware, fetchWithTimeout);
    return chain(fullReq) as Promise<ApiResponse<T>>;
  }

  // ─── Scoped Sub-client ────────────────────────────────────────────────────

  /**
   * Create a scoped client that prepends `prefix` to every request URL.
   * Middleware and headers are inherited from the parent.
   */
  scope(prefix: string): ApiClient {
    const scoped = new ApiClient({
      baseURL: joinPath(this.#baseURL, prefix),
      headers: { ...this.#defaultHeaders },
      timeout: this.#timeout,
      fetch: this.#fetchFn,
    });
    // Share the parent's middleware array (shallow copy so scope additions don't bleed back)
    scoped.#middleware = [...this.#middleware];
    return scoped;
  }
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/** Build the middleware dispatch chain. */
function buildChain(
  middleware: Middleware[],
  finalHandler: (req: ApiRequest) => Promise<ApiResponse>,
): (req: ApiRequest) => Promise<ApiResponse> {
  // Wrap from right to left so first middleware runs first
  let chain: (req: ApiRequest) => Promise<ApiResponse> = finalHandler;
  for (let i = middleware.length - 1; i >= 0; i--) {
    const mw = middleware[i];
    const next = chain;
    chain = (req: ApiRequest) => mw(req, next);
  }
  return chain;
}

/** Append query params to a URL string. */
function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  const url = base ? joinPath(base, path) : path;
  if (!params || Object.keys(params).length === 0) return url;
  const qs = new URLSearchParams(params).toString();
  return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
}

/** Join base and path, avoiding double slashes. */
function joinPath(base: string, path: string): string {
  if (!base) return path;
  if (!path) return base;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

/** Default fetch implementation using the global `fetch`. */
async function defaultFetch(req: ApiRequest): Promise<ApiResponse> {
  const init: RequestInit = {
    method: req.method,
    headers: req.headers as Record<string, string>,
  };

  if (req.body != null) {
    init.body = JSON.stringify(req.body);
    (init.headers as Record<string, string>)['Content-Type'] =
      (init.headers as Record<string, string>)['Content-Type'] ?? 'application/json';
  }

  const response = await fetch(req.url, init);
  const text = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { data, status: response.status, headers, url: response.url };
}
