// @ts-check
// ─── Token Bucket ─────────────────────────────────────────────────────────────
// Rate limiter using the token bucket algorithm.
// Tokens are added at a fixed refill rate and consumed on each request.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenBucketOptions {
  /** Maximum number of tokens in the bucket. */
  capacity: number;
  /** Tokens added per second. */
  refillRate: number;
  /** Initial token count (default: capacity). */
  initialTokens?: number;
  /** Clock function for testing (default: Date.now). */
  now?: () => number;
}

// ─── TokenBucket ──────────────────────────────────────────────────────────────

export class TokenBucket {
  #capacity: number;
  #refillRate: number;
  #tokens: number;
  #lastRefill: number;
  #now: () => number;

  constructor(options: TokenBucketOptions) {
    const { capacity, refillRate, initialTokens, now = Date.now } = options;
    if (capacity <= 0) throw new RangeError('capacity must be > 0');
    if (refillRate <= 0) throw new RangeError('refillRate must be > 0');
    this.#capacity = capacity;
    this.#refillRate = refillRate;
    this.#now = now;
    this.#lastRefill = now();
    this.#tokens = initialTokens !== undefined
      ? Math.min(Math.max(0, initialTokens), capacity)
      : capacity;
  }

  // ─── Internal refill ──────────────────────────────────────────────────────

  #applyRefill(): void {
    const now = this.#now();
    const elapsed = (now - this.#lastRefill) / 1000; // seconds
    if (elapsed > 0) {
      this.#tokens = Math.min(
        this.#capacity,
        this.#tokens + elapsed * this.#refillRate,
      );
      this.#lastRefill = now;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Try to consume n tokens. Returns true if successful. */
  consume(tokens: number = 1): boolean {
    if (tokens < 0) throw new RangeError('tokens must be >= 0');
    this.#applyRefill();
    if (this.#tokens >= tokens) {
      this.#tokens -= tokens;
      return true;
    }
    return false;
  }

  /** Consume tokens, throwing if not enough. */
  consumeOrThrow(tokens: number = 1): void {
    if (!this.consume(tokens)) {
      throw new Error(
        `Rate limit exceeded: need ${tokens} token(s), have ${this.#tokens.toFixed(3)}`,
      );
    }
  }

  /** Get current token count (after applying refill). */
  get tokens(): number {
    this.#applyRefill();
    return this.#tokens;
  }

  /**
   * Get time in ms until N tokens are available.
   * Returns 0 if tokens are already available.
   */
  waitTime(tokens: number = 1): number {
    this.#applyRefill();
    if (this.#tokens >= tokens) return 0;
    const needed = tokens - this.#tokens;
    return Math.ceil((needed / this.#refillRate) * 1000);
  }

  /** Add tokens manually (capped at capacity). */
  add(tokens: number): void {
    if (tokens < 0) throw new RangeError('tokens must be >= 0');
    this.#applyRefill();
    this.#tokens = Math.min(this.#capacity, this.#tokens + tokens);
  }

  /** Reset bucket to full capacity. */
  reset(): void {
    this.#tokens = this.#capacity;
    this.#lastRefill = this.#now();
  }

  /** Check if consuming would succeed without actually consuming. */
  canConsume(tokens: number = 1): boolean {
    this.#applyRefill();
    return this.#tokens >= tokens;
  }
}

// ─── rateLimited ──────────────────────────────────────────────────────────────

/**
 * Create a rate-limited version of a function.
 * Calls that exceed the rate are silently dropped (return undefined).
 */
export function rateLimited<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: TokenBucketOptions,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  const bucket = new TokenBucket(options);
  return function (...args: Parameters<T>): ReturnType<T> | undefined {
    if (bucket.consume(1)) {
      return fn(...args) as ReturnType<T>;
    }
    return undefined;
  };
}
