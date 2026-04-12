// @ts-check
// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Multiple rate limiting algorithms: Token Bucket, Sliding Window Counter,
// Fixed Window Counter, and Leaky Bucket.

// ─── TokenBucket ──────────────────────────────────────────────────────────────

export interface TokenBucketOptions {
  capacity: number;
  refillRate: number;
  refillInterval?: number;
}

/**
 * Token Bucket rate limiter.
 * Tokens are added at `refillRate` per `refillInterval` ms (default 1000ms).
 * Consume tokens for each request; returns false when insufficient tokens.
 *
 * @example
 *   const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
 *   if (bucket.consume()) { /* handle request *\/ }
 */
export class TokenBucket {
  #capacity: number;
  #tokens: number;
  #refillRate: number;
  #refillInterval: number;
  #lastRefill: number;

  constructor(options: TokenBucketOptions) {
    const { capacity, refillRate, refillInterval = 1000 } = options;
    if (capacity <= 0) throw new RangeError('capacity must be > 0');
    if (refillRate <= 0) throw new RangeError('refillRate must be > 0');
    if (refillInterval <= 0) throw new RangeError('refillInterval must be > 0');

    this.#capacity = capacity;
    this.#tokens = capacity;
    this.#refillRate = refillRate;
    this.#refillInterval = refillInterval;
    this.#lastRefill = Date.now();
  }

  /** Refill tokens based on elapsed time since last refill. */
  #doRefill(): void {
    const now = Date.now();
    const elapsed = now - this.#lastRefill;
    const intervals = Math.floor(elapsed / this.#refillInterval);
    if (intervals > 0) {
      this.#tokens = Math.min(this.#capacity, this.#tokens + intervals * this.#refillRate);
      this.#lastRefill += intervals * this.#refillInterval;
    }
  }

  /**
   * Consume tokens. Returns true if the request is allowed, false otherwise.
   * @param tokens - Number of tokens to consume (default 1).
   */
  consume(tokens = 1): boolean {
    this.#doRefill();
    if (this.#tokens >= tokens) {
      this.#tokens -= tokens;
      return true;
    }
    return false;
  }

  /** Alias for consume. */
  tryConsume(tokens = 1): boolean {
    return this.consume(tokens);
  }

  /** Returns the current token count (after applying any pending refill). */
  getTokens(): number {
    this.#doRefill();
    return this.#tokens;
  }

  /** Refills bucket to capacity and resets the refill timer. */
  reset(): void {
    this.#tokens = this.#capacity;
    this.#lastRefill = Date.now();
  }

  /** The maximum number of tokens this bucket can hold. */
  get capacity(): number {
    return this.#capacity;
  }

  // ─── Internal helpers for testing ───────────────────────────────────────────

  /** @internal Rewind the internal refill clock by ms (simulates time passing). */
  _advanceTime(ms: number): void {
    this.#lastRefill -= ms;
  }
}

// ─── SlidingWindowCounter ─────────────────────────────────────────────────────

export interface SlidingWindowOptions {
  limit: number;
  windowMs: number;
}

interface TimestampEntry {
  timestamps: number[];
}

/**
 * Sliding Window Counter rate limiter.
 * Tracks request timestamps per key within a rolling time window.
 *
 * @example
 *   const counter = new SlidingWindowCounter({ limit: 5, windowMs: 1000 });
 *   if (counter.hit('user:42')) { /* handle request *\/ }
 */
export class SlidingWindowCounter {
  #limit: number;
  #windowMs: number;
  #store: Map<string, TimestampEntry>;

  constructor(options: SlidingWindowOptions) {
    const { limit, windowMs } = options;
    if (limit <= 0) throw new RangeError('limit must be > 0');
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');

    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#store = new Map();
  }

  /** Prune timestamps older than the current window for a given key. */
  #prune(key: string, now: number): TimestampEntry {
    let entry = this.#store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.#store.set(key, entry);
    }
    const cutoff = now - this.#windowMs;
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    return entry;
  }

  /**
   * Record a hit for the given key. Returns true if the request is allowed.
   * @param key - Identifier for the rate-limited entity (default 'default').
   */
  hit(key = 'default'): boolean {
    const now = Date.now();
    const entry = this.#prune(key, now);
    if (entry.timestamps.length < this.#limit) {
      entry.timestamps.push(now);
      return true;
    }
    return false;
  }

  /** Returns the number of requests recorded in the current window. */
  getCount(key = 'default'): number {
    const now = Date.now();
    const entry = this.#prune(key, now);
    return entry.timestamps.length;
  }

  /** Clears all recorded hits for the given key. */
  reset(key = 'default'): void {
    this.#store.delete(key);
  }

  /** The maximum number of requests allowed per window. */
  get limit(): number {
    return this.#limit;
  }

  /** The window duration in milliseconds. */
  get windowMs(): number {
    return this.#windowMs;
  }
}

// ─── FixedWindowCounter ───────────────────────────────────────────────────────

export interface FixedWindowOptions {
  limit: number;
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

/**
 * Fixed Window Counter rate limiter.
 * Counts requests within a fixed time window that resets periodically.
 *
 * @example
 *   const counter = new FixedWindowCounter({ limit: 100, windowMs: 60_000 });
 *   if (counter.hit('ip:1.2.3.4')) { /* handle request *\/ }
 */
export class FixedWindowCounter {
  #limit: number;
  #windowMs: number;
  #store: Map<string, WindowEntry>;

  constructor(options: FixedWindowOptions) {
    const { limit, windowMs } = options;
    if (limit <= 0) throw new RangeError('limit must be > 0');
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');

    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#store = new Map();
  }

  /** Get or create a window entry, resetting it if the window has expired. */
  #getEntry(key: string, now: number): WindowEntry {
    let entry = this.#store.get(key);
    if (!entry || now - entry.windowStart >= this.#windowMs) {
      entry = { count: 0, windowStart: now };
      this.#store.set(key, entry);
    }
    return entry;
  }

  /**
   * Record a hit for the given key. Returns true if the request is allowed.
   * @param key - Identifier for the rate-limited entity (default 'default').
   */
  hit(key = 'default'): boolean {
    const now = Date.now();
    const entry = this.#getEntry(key, now);
    if (entry.count < this.#limit) {
      entry.count++;
      return true;
    }
    return false;
  }

  /** Returns the number of requests in the current window. */
  getCount(key = 'default'): number {
    const now = Date.now();
    const entry = this.#getEntry(key, now);
    return entry.count;
  }

  /** Clears the counter for the given key. */
  reset(key = 'default'): void {
    this.#store.delete(key);
  }

  /** The maximum number of requests allowed per window. */
  get limit(): number {
    return this.#limit;
  }

  /** The window duration in milliseconds. */
  get windowMs(): number {
    return this.#windowMs;
  }
}

// ─── LeakyBucket ──────────────────────────────────────────────────────────────

export interface LeakyBucketOptions {
  capacity: number;
  leakRate: number;
}

/**
 * Leaky Bucket rate limiter.
 * Requests are queued in a bucket that drains at a fixed `leakRate` per second.
 * New requests are rejected when the bucket is full.
 *
 * @example
 *   const bucket = new LeakyBucket({ capacity: 10, leakRate: 2 });
 *   if (bucket.push()) { /* request accepted *\/ }
 */
export class LeakyBucket {
  #capacity: number;
  #leakRate: number;
  #size: number;
  #lastLeak: number;

  constructor(options: LeakyBucketOptions) {
    const { capacity, leakRate } = options;
    if (capacity <= 0) throw new RangeError('capacity must be > 0');
    if (leakRate <= 0) throw new RangeError('leakRate must be > 0');

    this.#capacity = capacity;
    this.#leakRate = leakRate;
    this.#size = 0;
    this.#lastLeak = Date.now();
  }

  /** Drain the bucket based on elapsed time. */
  #doLeak(): void {
    const now = Date.now();
    const elapsed = (now - this.#lastLeak) / 1000; // convert ms → seconds
    if (elapsed > 0) {
      const leaked = elapsed * this.#leakRate;
      this.#size = Math.max(0, this.#size - leaked);
      this.#lastLeak = now;
    }
  }

  /**
   * Push a request into the bucket.
   * Returns true if accepted, false if the bucket is full.
   */
  push(): boolean {
    this.#doLeak();
    if (this.#size < this.#capacity) {
      this.#size++;
      return true;
    }
    return false;
  }

  /** The current number of requests in the bucket (after draining). */
  get size(): number {
    this.#doLeak();
    return this.#size;
  }

  /** The maximum capacity of the bucket. */
  get capacity(): number {
    return this.#capacity;
  }

  /** The leak rate in requests per second. */
  get leakRate(): number {
    return this.#leakRate;
  }

  /** Empties the bucket and resets the leak timer. */
  reset(): void {
    this.#size = 0;
    this.#lastLeak = Date.now();
  }

  // ─── Internal helpers for testing ───────────────────────────────────────────

  /** @internal Rewind the internal leak clock by ms (simulates time passing). */
  _advanceTime(ms: number): void {
    this.#lastLeak -= ms;
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a TokenBucket with the given capacity and refill rate (tokens/second by default).
 */
export function createTokenBucket(capacity: number, refillRate: number): TokenBucket {
  return new TokenBucket({ capacity, refillRate });
}

/**
 * Create a SlidingWindowCounter with the given limit and window duration.
 */
export function createSlidingWindow(limit: number, windowMs: number): SlidingWindowCounter {
  return new SlidingWindowCounter({ limit, windowMs });
}

/**
 * Create a FixedWindowCounter with the given limit and window duration.
 */
export function createFixedWindow(limit: number, windowMs: number): FixedWindowCounter {
  return new FixedWindowCounter({ limit, windowMs });
}
