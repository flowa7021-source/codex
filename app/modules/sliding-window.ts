// @ts-check
// ─── Sliding Window ───────────────────────────────────────────────────────────
// Sliding window rate limiter and time-series statistics counter.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlidingWindowOptions {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed in the window. */
  maxRequests: number;
  /** Clock function for testing (default: Date.now). */
  now?: () => number;
}

// ─── SlidingWindow ────────────────────────────────────────────────────────────

export class SlidingWindow {
  #windowMs: number;
  #maxRequests: number;
  #now: () => number;
  /** Timestamps of recorded requests. */
  #timestamps: number[] = [];

  constructor(options: SlidingWindowOptions) {
    const { windowMs, maxRequests, now = Date.now } = options;
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (maxRequests <= 0) throw new RangeError('maxRequests must be > 0');
    this.#windowMs = windowMs;
    this.#maxRequests = maxRequests;
    this.#now = now;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  #prune(): void {
    const cutoff = this.#now() - this.#windowMs;
    // Remove timestamps older than the window
    let i = 0;
    while (i < this.#timestamps.length && this.#timestamps[i] <= cutoff) {
      i++;
    }
    if (i > 0) this.#timestamps.splice(0, i);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Record a request.
   * Returns true if allowed (within limit), false if the limit is exceeded.
   */
  record(): boolean {
    this.#prune();
    if (this.#timestamps.length >= this.#maxRequests) {
      return false;
    }
    this.#timestamps.push(this.#now());
    return true;
  }

  /** Get count of requests in the current window. */
  get count(): number {
    this.#prune();
    return this.#timestamps.length;
  }

  /** Get remaining allowed requests in the current window. */
  get remaining(): number {
    this.#prune();
    return Math.max(0, this.#maxRequests - this.#timestamps.length);
  }

  /**
   * Get ms until the oldest request falls outside the window.
   * Returns 0 if there are no recorded requests.
   */
  get resetIn(): number {
    this.#prune();
    if (this.#timestamps.length === 0) return 0;
    const oldest = this.#timestamps[0];
    const expiry = oldest + this.#windowMs;
    return Math.max(0, expiry - this.#now());
  }

  /** Clear all recorded requests. */
  reset(): void {
    this.#timestamps = [];
  }

  /** Check if a request would be allowed without recording it. */
  canRecord(): boolean {
    this.#prune();
    return this.#timestamps.length < this.#maxRequests;
  }
}

// ─── WindowCounter ────────────────────────────────────────────────────────────

/**
 * Sliding window counter for time-series statistics.
 * Divides the window into fixed-size buckets for efficient counting.
 */
export class WindowCounter {
  #windowMs: number;
  #bucketCount: number;
  #bucketMs: number;
  #now: () => number;
  /** Ring buffer of bucket counts. */
  #counts: number[];
  /** Timestamps of when each bucket started (used to detect staleness). */
  #bucketStartTimes: number[];

  constructor(windowMs: number, buckets: number = 10, now: () => number = Date.now) {
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (buckets <= 0) throw new RangeError('buckets must be > 0');
    this.#windowMs = windowMs;
    this.#bucketCount = buckets;
    this.#bucketMs = windowMs / buckets;
    this.#now = now;
    this.#counts = new Array(buckets).fill(0);
    this.#bucketStartTimes = new Array(buckets).fill(-Infinity);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  #currentBucketIndex(): number {
    const now = this.#now();
    return Math.floor(now / this.#bucketMs) % this.#bucketCount;
  }

  #clearStaleBuckets(): void {
    const now = this.#now();
    const windowStart = now - this.#windowMs;
    for (let i = 0; i < this.#bucketCount; i++) {
      if (this.#bucketStartTimes[i] < windowStart) {
        this.#counts[i] = 0;
        this.#bucketStartTimes[i] = -Infinity;
      }
    }
  }

  #ensureBucket(index: number): void {
    const now = this.#now();
    const expectedStart = Math.floor(now / this.#bucketMs) * this.#bucketMs;
    // If the bucket is stale (belongs to a previous cycle), clear it
    if (this.#bucketStartTimes[index] < expectedStart - this.#windowMs) {
      this.#counts[index] = 0;
      this.#bucketStartTimes[index] = expectedStart;
    } else if (this.#bucketStartTimes[index] < expectedStart) {
      // Bucket wraps: it was from a previous period in this window cycle
      this.#counts[index] = 0;
      this.#bucketStartTimes[index] = expectedStart;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Increment the counter by `by` (default 1). */
  increment(by: number = 1): void {
    const idx = this.#currentBucketIndex();
    this.#ensureBucket(idx);
    this.#counts[idx] += by;
  }

  /** Get total count within the current window. */
  get total(): number {
    this.#clearStaleBuckets();
    return this.#counts.reduce((a, b) => a + b, 0);
  }

  /** Get rate per second (total / window seconds). */
  get ratePerSecond(): number {
    return this.total / (this.#windowMs / 1000);
  }

  /**
   * Get count per bucket in chronological order (oldest first).
   * Stale buckets are returned as 0.
   */
  getBuckets(): number[] {
    this.#clearStaleBuckets();
    const now = this.#now();
    const currentBucketFloor = Math.floor(now / this.#bucketMs);
    const result: number[] = [];
    for (let i = this.#bucketCount - 1; i >= 0; i--) {
      const bucketFloor = currentBucketFloor - i;
      const bucketStart = bucketFloor * this.#bucketMs;
      const bucketIndex = bucketFloor % this.#bucketCount;
      // Only include if the bucket's recorded start matches this slot
      if (
        this.#bucketStartTimes[bucketIndex] === bucketStart &&
        bucketStart >= now - this.#windowMs
      ) {
        result.push(this.#counts[bucketIndex]);
      } else {
        result.push(0);
      }
    }
    return result;
  }

  /** Reset all buckets. */
  reset(): void {
    this.#counts.fill(0);
    this.#bucketStartTimes.fill(-Infinity);
  }
}
