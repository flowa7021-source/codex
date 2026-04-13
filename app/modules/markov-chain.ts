// @ts-check
// ─── Markov Chain ─────────────────────────────────────────────────────────────
// Generic higher-order Markov chain for sequence modelling. Supports training
// on multiple sequences, probability queries, and random text generation.

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Encode a state tuple as a stable string key.
 * Uses JSON so that arbitrary values (numbers, objects …) round-trip safely.
 */
function encodeState<T>(tokens: T[]): string {
  return JSON.stringify(tokens);
}

// ─── MarkovChain ──────────────────────────────────────────────────────────────

/**
 * A higher-order Markov chain over an arbitrary token type `T`.
 *
 * @template T  Token type (must support Map-key identity via `===`).
 */
export class MarkovChain<T> {
  readonly #order: number;
  readonly #rng: () => number;

  /**
   * Transition table:
   *   key   → JSON-encoded state (T[] of length `order`)
   *   value → Map<T, count>
   */
  readonly #transitions: Map<string, Map<T, number>> = new Map();

  /** All distinct tokens ever seen during training. */
  readonly #states: Set<T> = new Set();

  /**
   * @param order  Number of preceding tokens used as context (default 1).
   * @param rng    Random number generator returning [0, 1) (default Math.random).
   */
  constructor(order: number = 1, rng: () => number = Math.random) {
    if (order < 1 || !Number.isInteger(order)) {
      throw new RangeError(`order must be a positive integer, got ${order}`);
    }
    this.#order = order;
    this.#rng = rng;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** The context length used by this chain. */
  get order(): number {
    return this.#order;
  }

  /**
   * Train on a sequence of tokens, updating transition counts.
   * Sequences shorter than or equal to `order` contribute state registrations
   * but no transitions.
   */
  train(sequence: T[]): void {
    for (const token of sequence) {
      this.#states.add(token);
    }

    for (let i = 0; i < sequence.length - this.#order; i++) {
      const context = sequence.slice(i, i + this.#order);
      const next = sequence[i + this.#order];
      const key = encodeState(context);

      if (!this.#transitions.has(key)) {
        this.#transitions.set(key, new Map());
      }
      const counts = this.#transitions.get(key)!;
      counts.set(next, (counts.get(next) ?? 0) + 1);
    }
  }

  /**
   * Generate a sequence of `length` tokens seeded with `start`.
   *
   * The `start` slice must have at least `order` tokens so the chain has a
   * valid initial context.  If `start.length > order` the last `order` tokens
   * are used as the initial context.
   *
   * Throws if `start` is too short or if a state has no known successors.
   */
  generate(start: T[], length: number): T[] {
    if (start.length < this.#order) {
      throw new RangeError(
        `start must have at least ${this.#order} token(s), got ${start.length}`,
      );
    }
    if (length <= 0) return [];

    const result: T[] = [...start];

    for (let i = 0; i < length; i++) {
      const context = result.slice(result.length - this.#order);
      const key = encodeState(context);
      const counts = this.#transitions.get(key);

      if (!counts || counts.size === 0) {
        throw new Error(
          `No known transitions from state ${key}`,
        );
      }

      const next = this.#sampleWeighted(counts);
      result.push(next);
    }

    // Return only the newly generated tokens (not the seed)
    return result.slice(start.length);
  }

  /**
   * Compute the probability of a sequence given the trained model.
   *
   * P(sequence) = Π P(token_i | context_i)
   *
   * Returns 0 if any required context has no transitions.
   * Sequences with length ≤ order have no internal transitions and return 1.
   */
  probability(sequence: T[]): number {
    if (sequence.length <= this.#order) return 1;

    let prob = 1;

    for (let i = 0; i < sequence.length - this.#order; i++) {
      const context = sequence.slice(i, i + this.#order);
      const next = sequence[i + this.#order];
      const key = encodeState(context);
      const counts = this.#transitions.get(key);

      if (!counts || counts.size === 0) return 0;

      const total = sumValues(counts);
      const count = counts.get(next) ?? 0;

      if (count === 0) return 0;
      prob *= count / total;
    }

    return prob;
  }

  /**
   * Return a map of possible next tokens to their probabilities, given the
   * provided state (context) of length `order`.
   *
   * Returns an empty map if the context has never been seen.
   */
  nextProbabilities(state: T[]): Map<T, number> {
    if (state.length !== this.#order) {
      throw new RangeError(
        `state must have exactly ${this.#order} token(s), got ${state.length}`,
      );
    }

    const key = encodeState(state);
    const counts = this.#transitions.get(key);
    const result = new Map<T, number>();

    if (!counts || counts.size === 0) return result;

    const total = sumValues(counts);
    for (const [token, count] of counts) {
      result.set(token, count / total);
    }

    return result;
  }

  /** Return all token values that have been seen during training. */
  states(): T[] {
    return Array.from(this.#states);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Pick a token from `counts` using weighted random sampling. */
  #sampleWeighted(counts: Map<T, number>): T {
    const total = sumValues(counts);
    let threshold = this.#rng() * total;

    for (const [token, count] of counts) {
      threshold -= count;
      if (threshold <= 0) return token;
    }

    // Floating-point rounding guard: return the last entry
    return [...counts.keys()].at(-1)!;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sumValues<K>(map: Map<K, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Convenience factory for creating a `MarkovChain<T>`. */
export function createMarkovChain<T>(order: number = 1): MarkovChain<T> {
  return new MarkovChain<T>(order);
}
