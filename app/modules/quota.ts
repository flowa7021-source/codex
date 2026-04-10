// @ts-check
// ─── Quota & Throttle Management ─────────────────────────────────────────────
// Per-key quota tracking with sliding fixed windows and token-bucket dispensing.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotaOptions {
  /** Max requests per window. */
  limit: number;
  /** Window size in ms. */
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

// ─── QuotaManager ─────────────────────────────────────────────────────────────

/** Per-key quota tracker using a fixed-window algorithm. */
export class QuotaManager {
  #limit: number;
  #windowMs: number;
  #windows: Map<string, WindowEntry>;
  #now: number;

  constructor(options: QuotaOptions) {
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#windows = new Map();
    this.#now = Date.now();
  }

  /** Return the current wall-clock time (overridden by advance()). */
  #currentTime(): number {
    return this.#now;
  }

  /** Get or create the active window entry for a key. */
  #getWindow(key: string): WindowEntry {
    const now = this.#currentTime();
    const entry = this.#windows.get(key);
    if (entry === undefined || now >= entry.windowStart + this.#windowMs) {
      // Start a new window
      const newEntry: WindowEntry = { count: 0, windowStart: now };
      this.#windows.set(key, newEntry);
      return newEntry;
    }
    return entry;
  }

  /**
   * Check and consume quota for a key.
   * Returns `{ allowed, remaining, resetAt }`.
   */
  consume(key: string, amount: number = 1): { allowed: boolean; remaining: number; resetAt: number } {
    const entry = this.#getWindow(key);
    const resetAt = entry.windowStart + this.#windowMs;

    if (entry.count + amount > this.#limit) {
      return {
        allowed: false,
        remaining: Math.max(0, this.#limit - entry.count),
        resetAt,
      };
    }

    entry.count += amount;
    return {
      allowed: true,
      remaining: this.#limit - entry.count,
      resetAt,
    };
  }

  /** Peek at current usage without consuming quota. */
  peek(key: string): { count: number; remaining: number; resetAt: number } {
    const entry = this.#getWindow(key);
    return {
      count: entry.count,
      remaining: Math.max(0, this.#limit - entry.count),
      resetAt: entry.windowStart + this.#windowMs,
    };
  }

  /** Manually reset quota for a key (discards its window entry). */
  reset(key: string): void {
    this.#windows.delete(key);
  }

  /** Return all currently tracked keys. */
  keys(): string[] {
    return Array.from(this.#windows.keys());
  }

  /** Advance internal clock by `ms` milliseconds (for testing). */
  advance(ms: number): void {
    this.#now += ms;
  }
}

// ─── TokenDispenser ───────────────────────────────────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Token-bucket dispenser: each key has its own bucket that refills
 * continuously at `tokensPerSecond` up to `maxTokens`.
 */
export class TokenDispenser {
  #tokensPerSecond: number;
  #maxTokens: number;
  #buckets: Map<string, TokenBucket>;
  #now: number;

  constructor(options: { tokensPerSecond: number; maxTokens: number }) {
    this.#tokensPerSecond = options.tokensPerSecond;
    this.#maxTokens = options.maxTokens;
    this.#buckets = new Map();
    this.#now = Date.now();
  }

  /** Get or create a bucket for `key`, applying any pending refill first. */
  #getBucket(key: string): TokenBucket {
    const now = this.#now;
    const bucket = this.#buckets.get(key);
    if (bucket === undefined) {
      const newBucket: TokenBucket = { tokens: this.#maxTokens, lastRefill: now };
      this.#buckets.set(key, newBucket);
      return newBucket;
    }

    // Refill tokens based on elapsed time
    const elapsedMs = now - bucket.lastRefill;
    if (elapsedMs > 0) {
      const refill = (elapsedMs / 1000) * this.#tokensPerSecond;
      bucket.tokens = Math.min(this.#maxTokens, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    return bucket;
  }

  /**
   * Try to acquire `tokens` (default 1) for `key`.
   * Returns true if the bucket had enough tokens (and deducts them).
   */
  acquire(key: string, tokens: number = 1): boolean {
    const bucket = this.#getBucket(key);
    if (bucket.tokens < tokens) return false;
    bucket.tokens -= tokens;
    return true;
  }

  /** Return the current token count for `key` (without acquiring). */
  tokens(key: string): number {
    return this.#getBucket(key).tokens;
  }

  /** Advance internal clock by `ms` milliseconds (for testing). */
  advance(ms: number): void {
    this.#now += ms;
  }
}
