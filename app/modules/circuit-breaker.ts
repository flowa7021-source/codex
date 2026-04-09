// @ts-check
// ─── Circuit Breaker ─────────────────────────────────────────────────────────
// Implements the circuit breaker pattern to prevent cascading failures.
// States: closed (normal) → open (failing) → half-open (probing) → closed.

// ─── Types ───────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening. Default 5. */
  failureThreshold?: number;
  /** How long (ms) to stay open before trying half-open. Default 10000. */
  resetTimeoutMs?: number;
  /** Number of successes in half-open to close. Default 2. */
  successThreshold?: number;
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

  constructor(options: CircuitBreakerOptions = {}) {
    this.#failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.#resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
    this.#successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
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
   * Throws if circuit is open.
   * On failure, increments failure count; may open circuit.
   * On success, increments success count; may close circuit from half-open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.#maybeTransitionToHalfOpen();

    if (this.#state === 'open') {
      throw new Error('Circuit is open');
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

  /** Manually reset to closed state. */
  reset(): void {
    this.#state = 'closed';
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#openedAt = 0;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  #maybeTransitionToHalfOpen(): void {
    if (
      this.#state === 'open' &&
      Date.now() - this.#openedAt >= this.#resetTimeoutMs
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
      this.#openedAt = Date.now();
      this.#successCount = 0;
    } else {
      this.#failureCount += 1;
      if (this.#failureCount >= this.#failureThreshold) {
        this.#state = 'open';
        this.#openedAt = Date.now();
      }
    }
  }
}
