// @ts-check
// ─── Rate Limiter 2 ──────────────────────────────────────────────────────────
// Fixed-window and sliding-window rate limiters with injectable clock.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  /** Max tokens allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Injectable clock function (defaults to Date.now) */
  clock?: () => number;
}

interface FixedBucket {
  tokens: number;
  windowStart: number;
}

interface TimestampEntry {
  ts: number;
}

// ─── Fixed-Window Rate Limiter ────────────────────────────────────────────────

export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #clock: () => number;
  #buckets: Map<string, FixedBucket> = new Map();

  constructor(options: RateLimiterOptions) {
    if (options.limit <= 0) throw new RangeError('limit must be positive');
    if (options.windowMs <= 0) throw new RangeError('windowMs must be positive');
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#clock = options.clock ?? (() => Date.now());
  }

  /**
   * Attempt to consume `tokens` (default 1) for the given key.
   * Returns true if allowed, false if rate limited.
   */
  consume(key = 'default', tokens = 1): boolean {
    const bucket = this.#getOrCreate(key);
    if (bucket.tokens < tokens) return false;
    bucket.tokens -= tokens;
    return true;
  }

  /** How many tokens remain for a key in the current window. */
  getRemainingTokens(key = 'default'): number {
    return this.#getOrCreate(key).tokens;
  }

  /** Timestamp (ms) when the current window resets for a key. */
  getResetTime(key = 'default'): number {
    return this.#getOrCreate(key).windowStart + this.#windowMs;
  }

  /** Reset state for a specific key. */
  reset(key = 'default'): void {
    this.#buckets.delete(key);
  }

  /** Reset state for all keys. */
  resetAll(): void {
    this.#buckets.clear();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  #getOrCreate(key: string): FixedBucket {
    const now = this.#clock();
    const existing = this.#buckets.get(key);

    if (existing) {
      if (now >= existing.windowStart + this.#windowMs) {
        const fresh: FixedBucket = { tokens: this.#limit, windowStart: now };
        this.#buckets.set(key, fresh);
        return fresh;
      }
      return existing;
    }

    const fresh: FixedBucket = { tokens: this.#limit, windowStart: now };
    this.#buckets.set(key, fresh);
    return fresh;
  }
}

// ─── Sliding-Window Rate Limiter ──────────────────────────────────────────────

export class SlidingWindowRateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #clock: () => number;
  #windows: Map<string, TimestampEntry[]> = new Map();

  constructor(options: RateLimiterOptions) {
    if (options.limit <= 0) throw new RangeError('limit must be positive');
    if (options.windowMs <= 0) throw new RangeError('windowMs must be positive');
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#clock = options.clock ?? (() => Date.now());
  }

  /**
   * Attempt to consume `tokens` (default 1) for the given key.
   * Uses a sliding window: only requests within the last windowMs count.
   * Returns true if allowed, false if rate limited.
   */
  consume(key = 'default', tokens = 1): boolean {
    const now = this.#clock();
    const cutoff = now - this.#windowMs;
    const entries = this.#getEntries(key, cutoff);

    if (entries.length + tokens > this.#limit) return false;

    for (let i = 0; i < tokens; i++) {
      entries.push({ ts: now });
    }
    this.#windows.set(key, entries);
    return true;
  }

  /** How many tokens remain for a key given the current sliding window. */
  getRemainingTokens(key = 'default'): number {
    const now = this.#clock();
    const cutoff = now - this.#windowMs;
    const entries = this.#getEntries(key, cutoff);
    return Math.max(0, this.#limit - entries.length);
  }

  /**
   * Timestamp (ms) when the oldest request in the window will expire,
   * freeing a token. Returns now + windowMs if no requests exist yet.
   */
  getResetTime(key = 'default'): number {
    const now = this.#clock();
    const cutoff = now - this.#windowMs;
    const entries = this.#getEntries(key, cutoff);
    if (entries.length === 0) return now + this.#windowMs;
    return entries[0].ts + this.#windowMs;
  }

  /** Reset state for a specific key. */
  reset(key = 'default'): void {
    this.#windows.delete(key);
  }

  /** Reset state for all keys. */
  resetAll(): void {
    this.#windows.clear();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  #getEntries(key: string, cutoff: number): TimestampEntry[] {
    const existing = this.#windows.get(key);
    if (!existing) return [];
    // Filter out expired entries
    const active = existing.filter(e => e.ts > cutoff);
    this.#windows.set(key, active);
    return active;
  }
}

// ─── Factories ────────────────────────────────────────────────────────────────

/** Create a fixed-window RateLimiter. */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}

/** Create a sliding-window SlidingWindowRateLimiter. */
export function createSlidingWindowRateLimiter(options: RateLimiterOptions): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(options);
}
