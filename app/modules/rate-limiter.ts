// @ts-check
// ─── Rate Limiter ────────────────────────────────────────────────────────────
// Fixed-window token bucket rate limiter supporting multiple independent keys.

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Implementation ──────────────────────────────────────────────────────────

const DEFAULT_KEY = 'default';

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

  // ─── Private ─────────────────────────────────────────────────────────────

  #getOrCreate(key: string): BucketState {
    const now = Date.now();
    const existing = this.#buckets.get(key);

    if (existing) {
      // Check if the window has expired and reset if so
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
