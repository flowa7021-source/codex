// @ts-check
// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Implements four rate limiting algorithms: Token Bucket, Sliding Window,
// Fixed Window, and Leaky Bucket. Also exports the original RateLimiter class
// for backward compatibility.

// ─── Token Bucket ─────────────────────────────────────────────────────────────

export interface TokenBucketOptions {
  /** Maximum number of tokens in the bucket. */
  capacity: number;
  /** Tokens added per second. */
  refillRate: number;
}

/**
 * Token bucket algorithm: allows bursts up to `capacity` while sustaining
 * a long-term rate of `refillRate` tokens per second.
 * Uses an internal clock that can be advanced deterministically for testing.
 */
export class TokenBucket {
  #capacity: number;
  #refillRate: number;
  #tokens: number;
  #lastRefill: number;

  constructor(options: TokenBucketOptions) {
    if (options.capacity <= 0) throw new RangeError('capacity must be > 0');
    if (options.refillRate <= 0) throw new RangeError('refillRate must be > 0');
    this.#capacity = options.capacity;
    this.#refillRate = options.refillRate;
    this.#tokens = options.capacity;
    this.#lastRefill = Date.now();
  }

  /** Refill tokens based on elapsed time since last refill. */
  #doRefill(now: number): void {
    const elapsed = (now - this.#lastRefill) / 1000; // seconds
    const added = elapsed * this.#refillRate;
    this.#tokens = Math.min(this.#capacity, this.#tokens + added);
    this.#lastRefill = now;
  }

  /**
   * Try to consume `tokens` tokens (default 1).
   * Returns true if successful, false if insufficient tokens.
   */
  consume(tokens: number = 1): boolean {
    if (tokens <= 0) throw new RangeError('tokens must be > 0');
    // Refill based on real time relative to last recorded time
    this.#doRefill(this.#lastRefill);
    if (this.#tokens >= tokens) {
      this.#tokens -= tokens;
      return true;
    }
    return false;
  }

  /** Current token count. */
  get tokens(): number {
    return this.#tokens;
  }

  /** Advance the internal clock by `ms` milliseconds (for deterministic testing). */
  advance(ms: number): void {
    if (ms < 0) throw new RangeError('ms must be >= 0');
    this.#doRefill(this.#lastRefill + ms);
  }
}

// ─── Sliding Window ───────────────────────────────────────────────────────────

export interface SlidingWindowOptions {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  maxRequests: number;
}

/**
 * Sliding window log algorithm: tracks timestamps of each request and only
 * allows `maxRequests` within any rolling window of `windowMs` ms.
 */
export class SlidingWindowLimiter {
  #windowMs: number;
  #maxRequests: number;
  #log: number[];

  constructor(options: SlidingWindowOptions) {
    if (options.windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (options.maxRequests <= 0) throw new RangeError('maxRequests must be > 0');
    this.#windowMs = options.windowMs;
    this.#maxRequests = options.maxRequests;
    this.#log = [];
  }

  /** Remove entries older than the current window. */
  purge(now: number = Date.now()): void {
    const cutoff = now - this.#windowMs;
    let i = 0;
    while (i < this.#log.length && this.#log[i] <= cutoff) {
      i++;
    }
    if (i > 0) this.#log.splice(0, i);
  }

  /**
   * Record a request at `now` (ms, default Date.now()).
   * Returns true if the request is allowed, false if rate limit exceeded.
   */
  hit(now: number = Date.now()): boolean {
    this.purge(now);
    if (this.#log.length < this.#maxRequests) {
      this.#log.push(now);
      return true;
    }
    return false;
  }

  /** Number of requests recorded within the current window at `now`. */
  count(now: number = Date.now()): number {
    this.purge(now);
    return this.#log.length;
  }
}

// ─── Fixed Window ─────────────────────────────────────────────────────────────

export interface FixedWindowOptions {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within each window. */
  maxRequests: number;
}

/**
 * Fixed window counter algorithm: counts requests within aligned time windows.
 * Resets the counter at the start of each new window.
 */
export class FixedWindowLimiter {
  #windowMs: number;
  #maxRequests: number;
  #requestCount: number;
  #windowStart: number;

  constructor(options: FixedWindowOptions) {
    if (options.windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (options.maxRequests <= 0) throw new RangeError('maxRequests must be > 0');
    this.#windowMs = options.windowMs;
    this.#maxRequests = options.maxRequests;
    this.#requestCount = 0;
    this.#windowStart = Date.now();
  }

  /** Check if we are in a new window and reset if so. */
  #maybeReset(now: number): void {
    if (now - this.#windowStart >= this.#windowMs) {
      const elapsed = now - this.#windowStart;
      const windows = Math.floor(elapsed / this.#windowMs);
      this.#windowStart += windows * this.#windowMs;
      this.#requestCount = 0;
    }
  }

  /**
   * Record a request at `now` (ms, default Date.now()).
   * Returns true if allowed, false if limit reached within this window.
   */
  hit(now: number = Date.now()): boolean {
    this.#maybeReset(now);
    if (this.#requestCount < this.#maxRequests) {
      this.#requestCount++;
      return true;
    }
    return false;
  }

  /** Number of requests recorded in the current window. */
  count(now: number = Date.now()): number {
    this.#maybeReset(now);
    return this.#requestCount;
  }

  /** Manually reset the counter and start a new window at Date.now(). */
  reset(): void {
    this.#requestCount = 0;
    this.#windowStart = Date.now();
  }
}

// ─── Leaky Bucket ─────────────────────────────────────────────────────────────

export interface LeakyBucketOptions {
  /** Maximum bucket level (capacity). */
  capacity: number;
  /** Drain rate in units per second. */
  drainRate: number;
}

/**
 * Leaky bucket algorithm: smooths bursts by draining at a fixed rate.
 * Requests are accepted if there is room in the bucket; excess is dropped.
 * Uses an internal clock that can be advanced deterministically for testing.
 */
export class LeakyBucket {
  #capacity: number;
  #drainRate: number;
  #level: number;
  #lastDrain: number;

  constructor(options: LeakyBucketOptions) {
    if (options.capacity <= 0) throw new RangeError('capacity must be > 0');
    if (options.drainRate <= 0) throw new RangeError('drainRate must be > 0');
    this.#capacity = options.capacity;
    this.#drainRate = options.drainRate;
    this.#level = 0;
    this.#lastDrain = Date.now();
  }

  /** Drain the bucket based on elapsed time. */
  #doDrain(now: number): void {
    const elapsed = (now - this.#lastDrain) / 1000; // seconds
    const drained = elapsed * this.#drainRate;
    this.#level = Math.max(0, this.#level - drained);
    this.#lastDrain = now;
  }

  /**
   * Add `amount` units to the bucket (default 1).
   * Returns true if accepted (bucket has room), false if overflow.
   */
  add(amount: number = 1): boolean {
    if (amount <= 0) throw new RangeError('amount must be > 0');
    // Drain based on current internal clock (no real time advance here)
    this.#doDrain(this.#lastDrain);
    if (this.#level + amount <= this.#capacity) {
      this.#level += amount;
      return true;
    }
    return false;
  }

  /** Advance the internal clock by `ms` milliseconds (for deterministic testing). */
  advance(ms: number): void {
    if (ms < 0) throw new RangeError('ms must be >= 0');
    this.#doDrain(this.#lastDrain + ms);
  }

  /** Current bucket level. */
  get level(): number {
    return this.#level;
  }
}

// ─── Legacy RateLimiter (backward-compatible) ─────────────────────────────────

export interface RateLimiterOptions {
  /** Max tokens (requests) allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface BucketState {
  tokens: number;
  windowStart: number;
}

const DEFAULT_KEY = 'default';

/**
 * Fixed-window rate limiter supporting multiple independent keys.
 * Kept for backward compatibility.
 */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  #buckets: Map<string, BucketState> = new Map();

  constructor(options: RateLimiterOptions) {
    if (options.limit <= 0) throw new RangeError('limit must be positive');
    if (options.windowMs <= 0) throw new RangeError('windowMs must be positive');
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
  }

  get limit(): number {
    return this.#limit;
  }

  get windowMs(): number {
    return this.#windowMs;
  }

  /** Try to consume 1 token. Returns true if allowed, false if rate limited. */
  tryConsume(key = DEFAULT_KEY): boolean {
    const bucket = this.#getOrCreate(key);
    if (bucket.tokens <= 0) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** How many tokens remain for a key. */
  remaining(key = DEFAULT_KEY): number {
    return this.#getOrCreate(key).tokens;
  }

  /** When the window resets for a key (ms timestamp). */
  resetAt(key = DEFAULT_KEY): number {
    return this.#getOrCreate(key).windowStart + this.#windowMs;
  }

  /** Reset all state. */
  reset(): void {
    this.#buckets.clear();
  }

  #getOrCreate(key: string): BucketState {
    const now = Date.now();
    const existing = this.#buckets.get(key);

    if (existing) {
      if (now >= existing.windowStart + this.#windowMs) {
        const fresh: BucketState = { tokens: this.#limit, windowStart: now };
        this.#buckets.set(key, fresh);
        return fresh;
      }
      return existing;
    }

    const fresh: BucketState = { tokens: this.#limit, windowStart: now };
    this.#buckets.set(key, fresh);
    return fresh;
  }
}
