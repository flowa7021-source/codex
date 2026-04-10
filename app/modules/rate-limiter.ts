// @ts-check
// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Sliding-window and leaky-bucket rate limiting patterns.
// Unlike quota.ts (fixed windows), these use continuous-time algorithms.

// ─── SlidingWindowRateLimiter ─────────────────────────────────────────────────

/**
 * Per-id rate limiter using a sliding-window log algorithm.
 * Each request timestamp is stored; old entries outside the window are pruned
 * before each check so the count reflects only the most recent `windowMs`.
 *
 * @example
 *   const limiter = new SlidingWindowRateLimiter(10, 60_000);
 *   if (limiter.isAllowed('user:42')) { /* process request *\/ }
 */
export class SlidingWindowRateLimiter {
  #limit: number;
  #windowMs: number;
  /** Map of id → sorted array of timestamps (ms). */
  #log: Map<string, number[]>;
  #offset: number;

  constructor(limit: number, windowMs: number) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#log = new Map();
    this.#offset = 0;
  }

  /** Return the effective current time (real clock + any advance() offset). */
  #currentTime(now?: number): number {
    return (now ?? Date.now()) + this.#offset;
  }

  /** Prune timestamps outside the current window and return the live log. */
  #prune(id: string, now: number): number[] {
    const cutoff = now - this.#windowMs;
    const timestamps = this.#log.get(id);
    if (timestamps === undefined) {
      const empty: number[] = [];
      this.#log.set(id, empty);
      return empty;
    }
    // Remove entries older than the window (cutoff is exclusive)
    let i = 0;
    while (i < timestamps.length && timestamps[i] <= cutoff) i++;
    if (i > 0) timestamps.splice(0, i);
    return timestamps;
  }

  /**
   * Check whether a new request for `id` is allowed.
   * If allowed, records the timestamp and returns `true`.
   * Pass `now` (ms) to override the wall-clock (useful in deterministic tests).
   */
  isAllowed(id: string, now?: number): boolean {
    const t = this.#currentTime(now);
    const timestamps = this.#prune(id, t);
    if (timestamps.length >= this.#limit) return false;
    timestamps.push(t);
    return true;
  }

  /**
   * Return the number of additional requests allowed for `id`
   * within the current window, without consuming a slot.
   * Pass `now` (ms) to override the wall-clock.
   */
  remaining(id: string, now?: number): number {
    const t = this.#currentTime(now);
    const timestamps = this.#prune(id, t);
    return Math.max(0, this.#limit - timestamps.length);
  }

  /**
   * Advance the internal clock offset by `ms` milliseconds.
   * Useful in tests to simulate time passing without mocking Date.now().
   */
  advance(ms: number): void {
    this.#offset += ms;
  }
}

// ─── LeakyBucket ──────────────────────────────────────────────────────────────

/**
 * Leaky-bucket rate limiter.
 * The bucket fills when `add()` is called and drains continuously at
 * `leakRatePerMs` tokens per millisecond. Calls to `add()` return false
 * (overflow) when the bucket is full and the amount would exceed capacity.
 *
 * @example
 *   const bucket = new LeakyBucket(100, 0.1); // 100-token cap, leak 0.1/ms
 *   bucket.add(10);     // true
 *   bucket.advance(50); // drains 5 tokens
 *   bucket.level();     // 5
 */
export class LeakyBucket {
  #capacity: number;
  #leakRatePerMs: number;
  #fill: number;
  #lastLeakAt: number;
  #offset: number;

  constructor(capacity: number, leakRatePerMs: number) {
    this.#capacity = capacity;
    this.#leakRatePerMs = leakRatePerMs;
    this.#fill = 0;
    this.#lastLeakAt = Date.now();
    this.#offset = 0;
  }

  /** Return the effective current time. */
  #now(): number {
    return Date.now() + this.#offset;
  }

  /** Apply any pending leak since the last check. */
  #applyLeak(): void {
    const now = this.#now();
    const elapsed = now - this.#lastLeakAt;
    if (elapsed > 0) {
      this.#fill = Math.max(0, this.#fill - elapsed * this.#leakRatePerMs);
      this.#lastLeakAt = now;
    }
  }

  /**
   * Add `amount` tokens (default 1) to the bucket.
   * Returns `false` if adding would exceed capacity (overflow); the tokens are
   * NOT added in that case.
   */
  add(amount: number = 1): boolean {
    this.#applyLeak();
    if (this.#fill + amount > this.#capacity) return false;
    this.#fill += amount;
    return true;
  }

  /** Return the current fill level (after applying any pending leak). */
  level(): number {
    this.#applyLeak();
    return this.#fill;
  }

  /**
   * Advance the internal clock by `ms` milliseconds, simulating time passing.
   * Useful in tests to trigger leaking without waiting for real time.
   */
  advance(ms: number): void {
    this.#offset += ms;
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/** Create a new {@link SlidingWindowRateLimiter}. */
export function createSlidingWindowLimiter(
  limit: number,
  windowMs: number,
): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(limit, windowMs);
}

/** Create a new {@link LeakyBucket}. */
export function createLeakyBucket(
  capacity: number,
  leakRatePerMs: number,
): LeakyBucket {
  return new LeakyBucket(capacity, leakRatePerMs);
}
