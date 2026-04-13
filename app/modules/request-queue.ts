// @ts-check
// ─── Request Queue ────────────────────────────────────────────────────────────
// HTTP request queue with rate limiting, priority ordering, and deduplication.

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface RequestOptions {
  /** Higher number = higher priority. Default 0. */
  priority?: number;
  /** Deduplicate by URL + method. Default true. */
  dedupe?: boolean;
  /** Request timeout in ms. Default none. */
  timeout?: number;
  /** Number of retries on failure. Default 0. */
  retries?: number;
}

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  options: RequestOptions;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAt: number;
}

export interface RequestQueueOptions {
  /** Max concurrent requests. Default 4. */
  concurrency?: number;
  /** Max requests per second. Default none. */
  rateLimit?: number;
  /** Custom fetch function for testing. */
  fetch?: (url: string, method: string) => Promise<unknown>;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface InternalEntry {
  queued: QueuedRequest;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  retriesLeft: number;
}

// ─── RequestQueue ─────────────────────────────────────────────────────────────

let _nextId = 1;

function generateId(): string {
  return `rq-${_nextId++}`;
}

/**
 * HTTP request queue with concurrency limiting, priority ordering, rate
 * limiting, and optional URL+method deduplication.
 *
 * @example
 *   const q = new RequestQueue({ concurrency: 2 });
 *   const data = await q.enqueue('/api/items', 'GET');
 */
export class RequestQueue {
  #concurrency: number;
  #rateLimit: number | undefined;
  #fetchFn: (url: string, method: string) => Promise<unknown>;

  #pending: InternalEntry[] = [];
  #running = 0;
  #paused = false;

  /** Timestamps of completed requests within the current second window. */
  #completionTimes: number[] = [];

  /** Dedupe map: "<method>:<url>" -> existing promise. */
  #dedupeMap = new Map<string, Promise<unknown>>();

  constructor(options?: RequestQueueOptions) {
    this.#concurrency = options?.concurrency ?? 4;
    this.#rateLimit = options?.rateLimit;
    this.#fetchFn = options?.fetch ?? ((url, method) => fetch(url, { method }));
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Enqueue a request. Returns a promise resolving to the response.
   */
  enqueue<T>(url: string, method = 'GET', options: RequestOptions = {}): Promise<T> {
    const priority = options.priority ?? 0;
    const dedupe = options.dedupe !== false;
    const retriesLeft = options.retries ?? 0;

    // Deduplication: same URL+method shares one in-flight promise
    if (dedupe) {
      const key = `${method}:${url}`;
      const existing = this.#dedupeMap.get(key);
      if (existing) return existing as Promise<T>;
    }

    const id = generateId();
    const queued: QueuedRequest = {
      id,
      url,
      method,
      options: { priority, dedupe, timeout: options.timeout, retries: options.retries },
      status: 'pending',
      createdAt: Date.now(),
    };

    let resolve!: (value: unknown) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res as (value: unknown) => void;
      reject = rej;
    });

    const entry: InternalEntry = { queued, resolve, reject, retriesLeft };

    // Insert in priority order (higher priority first, FIFO tiebreak)
    let insertIdx = this.#pending.length;
    for (let i = 0; i < this.#pending.length; i++) {
      const existingPriority = this.#pending[i].queued.options.priority ?? 0;
      if (priority > existingPriority) {
        insertIdx = i;
        break;
      }
    }
    this.#pending.splice(insertIdx, 0, entry);

    if (dedupe) {
      const key = `${method}:${url}`;
      this.#dedupeMap.set(key, promise);
      promise.finally(() => {
        if (this.#dedupeMap.get(key) === promise) {
          this.#dedupeMap.delete(key);
        }
      });
    }

    this.#drain();
    return promise;
  }

  /**
   * Cancel a pending request by id. Returns true if found and cancelled.
   */
  cancel(id: string): boolean {
    const idx = this.#pending.findIndex(e => e.queued.id === id);
    if (idx === -1) return false;
    const [entry] = this.#pending.splice(idx, 1);
    entry.queued.status = 'failed';
    entry.reject(new Error(`Request ${id} was cancelled`));
    return true;
  }

  /**
   * Get all queued (pending) requests as snapshots.
   */
  getAll(): QueuedRequest[] {
    return this.#pending.map(e => ({ ...e.queued }));
  }

  /** Number of pending requests. */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** Clear all pending requests (rejects their promises). */
  clearPending(): void {
    const entries = this.#pending.splice(0);
    for (const entry of entries) {
      entry.queued.status = 'failed';
      entry.reject(new Error('Queue cleared'));
    }
  }

  /** Pause processing. In-flight requests continue to completion. */
  pause(): void {
    this.#paused = true;
  }

  /** Resume processing after pause(). */
  resume(): void {
    this.#paused = false;
    this.#drain();
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  #drain(): void {
    if (this.#paused) return;

    while (this.#pending.length > 0 && this.#running < this.#concurrency) {
      if (!this.#checkRateLimit()) break;
      const entry = this.#pending.shift()!;
      this.#execute(entry);
    }
  }

  /** Returns true if within rate limit (or no rate limit configured). */
  #checkRateLimit(): boolean {
    if (!this.#rateLimit) return true;
    const now = Date.now();
    // Trim completions older than 1 second
    this.#completionTimes = this.#completionTimes.filter(t => now - t < 1000);
    return this.#completionTimes.length < this.#rateLimit;
  }

  async #execute(entry: InternalEntry): Promise<void> {
    const { queued } = entry;
    queued.status = 'running';
    this.#running++;

    try {
      let fetchPromise = this.#fetchFn(queued.url, queued.method);

      if (queued.options.timeout != null) {
        const timeoutMs = queued.options.timeout;
        const timeoutPromise = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs),
        );
        fetchPromise = Promise.race([fetchPromise, timeoutPromise]) as Promise<unknown>;
      }

      const result = await fetchPromise;
      queued.status = 'done';
      this.#completionTimes.push(Date.now());
      entry.resolve(result);
    } catch (err) {
      if (entry.retriesLeft > 0) {
        entry.retriesLeft--;
        queued.status = 'pending';
        // Re-insert at front of same-priority bucket for retry
        this.#pending.unshift(entry);
      } else {
        queued.status = 'failed';
        entry.reject(err);
      }
    } finally {
      this.#running--;
      this.#drain();
    }
  }
}
