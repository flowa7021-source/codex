// @ts-check
// ─── Circuit Breaker ─────────────────────────────────────────────────────────
// Implements the circuit breaker pattern to prevent cascading failures.
// States: closed (normal) → open (failing) → half-open (probing) → closed.

// ─── Types ───────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening. Default 5. */
  failureThreshold?: number;
  /** Number of successes in half-open before closing. Default 2. */
  successThreshold?: number;
  /**
   * How long (ms) to stay open before attempting half-open. Default 10000.
   * Alias: `resetTimeoutMs` is also accepted for backward compatibility.
   */
  timeout?: number;
  /** @deprecated Use `timeout` instead. */
  resetTimeoutMs?: number;
}

// ─── CircuitBreakerError ──────────────────────────────────────────────────────

/**
 * Thrown when `execute()` is called while the circuit is open.
 */
export class CircuitBreakerError extends Error {
  constructor(message: string = 'Circuit is open') {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// ─── Implementation ──────────────────────────────────────────────────────────

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 10_000;
const DEFAULT_SUCCESS_THRESHOLD = 2;

export class CircuitBreaker {
  readonly #failureThreshold: number;
  readonly #resetTimeoutMs: number;
  readonly #successThreshold: number;

  #state: CircuitState = 'closed';
  #failureCount = 0;
  #successCount = 0;
  #openedAt = 0;
  /** Internal clock offset in ms — advanced via advance() for testing. */
  #clockOffset = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.#failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.#successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    // Support both `timeout` (new API) and `resetTimeoutMs` (legacy API)
    this.#resetTimeoutMs =
      options.timeout ?? options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  }

  /** Returns the current internal time (Date.now + any advance offset). */
  #now(): number {
    return Date.now() + this.#clockOffset;
  }

  get state(): CircuitState {
    this.#maybeTransitionToHalfOpen();
    return this.#state;
  }

  get failureCount(): number {
    return this.#failureCount;
  }

  get successCount(): number {
    return this.#successCount;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws `CircuitBreakerError` if circuit is open.
   * On failure, increments failure count; may open circuit.
   * On success, increments success count; may close circuit from half-open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.#maybeTransitionToHalfOpen();

    if (this.#state === 'open') {
      throw new CircuitBreakerError();
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (err) {
      this.#onFailure();
      throw err;
    }
  }

  /** Force the circuit open (trip). */
  trip(): void {
    this.#state = 'open';
    this.#openedAt = this.#now();
    this.#successCount = 0;
  }

  /** Manually reset to closed state and clear all counters. */
  reset(): void {
    this.#state = 'closed';
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#openedAt = 0;
    this.#clockOffset = 0;
  }

  /**
   * Advance the internal clock by `ms` milliseconds.
   * This allows deterministic testing of the timeout behaviour without
   * patching `Date.now`.
   */
  advance(ms: number): void {
    if (ms < 0) throw new RangeError('ms must be >= 0');
    this.#clockOffset += ms;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  #maybeTransitionToHalfOpen(): void {
    if (
      this.#state === 'open' &&
      this.#now() - this.#openedAt >= this.#resetTimeoutMs
    ) {
      this.#state = 'half-open';
      this.#successCount = 0;
    }
  }

  #onSuccess(): void {
    if (this.#state === 'half-open') {
      this.#successCount += 1;
      if (this.#successCount >= this.#successThreshold) {
        this.#state = 'closed';
        this.#failureCount = 0;
        this.#successCount = 0;
      }
    } else {
      // In closed state, reset failure count on success
      this.#failureCount = 0;
    }
  }

  #onFailure(): void {
    if (this.#state === 'half-open') {
      // Any failure in half-open immediately reopens
      this.#state = 'open';
      this.#openedAt = this.#now();
      this.#successCount = 0;
    } else {
      this.#failureCount += 1;
      if (this.#failureCount >= this.#failureThreshold) {
        this.#state = 'open';
        this.#openedAt = this.#now();
      }
    }
  }
}
