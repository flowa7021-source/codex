// @ts-check
// ─── Circuit Breaker ─────────────────────────────────────────────────────────
// Implements the circuit breaker pattern to prevent cascading failures.
// States: closed (normal) → open (failing) → half-open (probing) → closed.

// ─── Types ───────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold: number;
  /** Number of consecutive successes in half-open before closing. Default 1. */
  successThreshold?: number;
  /** How long (ms) to stay open before moving to half-open. */
  timeout: number;
  /** Called whenever the circuit changes state. */
  onStateChange?: (state: CircuitState) => void;
}

// ─── CircuitBreaker ───────────────────────────────────────────────────────────

/**
 * Circuit breaker wrapping an async function.
 * Tracks failures; opens after `failureThreshold` consecutive failures.
 * After `timeout` ms, transitions to half-open (probe mode).
 * Closes again after `successThreshold` consecutive successes in half-open.
 *
 * @example
 *   const cb = new CircuitBreaker(fetchUser, { failureThreshold: 3, timeout: 5000 });
 *   const user = await cb.execute(userId);
 */
export class CircuitBreaker<T> {
  #fn: (...args: unknown[]) => Promise<T>;
  #failureThreshold: number;
  #successThreshold: number;
  #timeout: number;
  #onStateChange: ((state: CircuitState) => void) | undefined;

  #state: CircuitState;
  #failureCount: number;
  #successCount: number;
  #openedAt: number;
  #clockOffset: number;

  constructor(
    fn: (...args: unknown[]) => Promise<T>,
    options: CircuitBreakerOptions,
  ) {
    this.#fn = fn;
    this.#failureThreshold = options.failureThreshold;
    this.#successThreshold = options.successThreshold ?? 1;
    this.#timeout = options.timeout;
    this.#onStateChange = options.onStateChange;

    this.#state = 'closed';
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#openedAt = 0;
    this.#clockOffset = 0;
  }

  // ─── Public Accessors ─────────────────────────────────────────────────────

  /** Current circuit state (may transition to half-open on read). */
  get state(): CircuitState {
    this.#maybeTransitionToHalfOpen();
    return this.#state;
  }

  /** Number of consecutive failures recorded. */
  get failureCount(): number {
    return this.#failureCount;
  }

  // ─── Public Methods ───────────────────────────────────────────────────────

  /**
   * Execute the wrapped function with the given arguments.
   * Throws `CircuitOpenError` immediately if the circuit is open.
   * Records the outcome (success or failure) and updates state accordingly.
   */
  async execute(...args: unknown[]): Promise<T> {
    this.#maybeTransitionToHalfOpen();

    if (this.#state === 'open') {
      throw new CircuitOpenError();
    }

    try {
      const result = await this.#fn(...args);
      this.#onSuccess();
      return result;
    } catch (err) {
      this.#onFailure();
      throw err;
    }
  }

  /** Manually close the circuit and reset all counters. */
  reset(): void {
    this.#transition('closed');
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#openedAt = 0;
    this.#clockOffset = 0;
  }

  /** Manually open the circuit (trip). */
  trip(): void {
    this.#failureCount = this.#failureThreshold;
    this.#successCount = 0;
    this.#openedAt = this.#now();
    this.#transition('open');
  }

  /**
   * Advance the internal clock by `ms` milliseconds.
   * Allows deterministic testing of timeout behavior.
   */
  advance(ms: number): void {
    if (ms < 0) throw new RangeError('ms must be >= 0');
    this.#clockOffset += ms;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  #now(): number {
    return Date.now() + this.#clockOffset;
  }

  #transition(next: CircuitState): void {
    if (this.#state !== next) {
      this.#state = next;
      this.#onStateChange?.(next);
    }
  }

  #maybeTransitionToHalfOpen(): void {
    if (
      this.#state === 'open' &&
      this.#now() - this.#openedAt >= this.#timeout
    ) {
      this.#successCount = 0;
      this.#transition('half-open');
    }
  }

  #onSuccess(): void {
    if (this.#state === 'half-open') {
      this.#successCount += 1;
      if (this.#successCount >= this.#successThreshold) {
        this.#failureCount = 0;
        this.#successCount = 0;
        this.#transition('closed');
      }
    } else {
      // Closed: reset failure streak on success
      this.#failureCount = 0;
    }
  }

  #onFailure(): void {
    if (this.#state === 'half-open') {
      // Any failure in half-open immediately reopens
      this.#successCount = 0;
      this.#openedAt = this.#now();
      this.#transition('open');
    } else {
      this.#failureCount += 1;
      if (this.#failureCount >= this.#failureThreshold) {
        this.#openedAt = this.#now();
        this.#transition('open');
      }
    }
  }
}

// ─── CircuitOpenError ─────────────────────────────────────────────────────────

/**
 * Thrown by `CircuitBreaker.execute()` when the circuit is open.
 */
export class CircuitOpenError extends Error {
  constructor(message: string = 'Circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/** Create a new {@link CircuitBreaker}. */
export function createCircuitBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: CircuitBreakerOptions,
): CircuitBreaker<T> {
  return new CircuitBreaker(fn, options);
}
