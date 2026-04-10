// @ts-check
// ─── CRDT Counters ───────────────────────────────────────────────────────────
// Convergent replicated data types: GCounter (grow-only) and PNCounter
// (positive-negative) for distributed counting without coordination.

// ─── GCounter ────────────────────────────────────────────────────────────────

/**
 * Grow-only counter. Each node tracks its own monotonically increasing count.
 * The global value is the sum of all per-node counts.
 */
export class GCounter {
  #nodeId: string;
  #counts: Map<string, number>;

  constructor(nodeId: string) {
    this.#nodeId = nodeId;
    this.#counts = new Map<string, number>();
    this.#counts.set(nodeId, 0);
  }

  /** Unique identifier of this replica. */
  get nodeId(): string {
    return this.#nodeId;
  }

  /** Increment this node's counter by `amount` (default 1). */
  increment(amount: number = 1): void {
    if (amount < 0) {
      throw new RangeError('GCounter cannot be decremented');
    }
    const current = this.#counts.get(this.#nodeId) ?? 0;
    this.#counts.set(this.#nodeId, current + amount);
  }

  /** The aggregated counter value across all nodes. */
  get value(): number {
    let sum = 0;
    for (const v of this.#counts.values()) {
      sum += v;
    }
    return sum;
  }

  /**
   * Merge with another GCounter, taking the max per node.
   * Returns a **new** GCounter whose nodeId matches `this`.
   */
  merge(other: GCounter): GCounter {
    const merged = new GCounter(this.#nodeId);
    const allKeys = new Set([
      ...this.#counts.keys(),
      ...other.#counts.keys(),
    ]);
    for (const key of allKeys) {
      const a = this.#counts.get(key) ?? 0;
      const b = other.#counts.get(key) ?? 0;
      merged.#counts.set(key, Math.max(a, b));
    }
    return merged;
  }

  /** Serialise the internal state to a plain object. */
  toJSON(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.#counts) {
      obj[k] = v;
    }
    return obj;
  }
}

// ─── PNCounter ───────────────────────────────────────────────────────────────

/**
 * Positive-Negative counter composed of two GCounters —
 * one for increments and one for decrements.
 */
export class PNCounter {
  #p: GCounter;
  #n: GCounter;

  constructor(nodeId: string) {
    this.#p = new GCounter(nodeId);
    this.#n = new GCounter(nodeId);
  }

  /** Unique identifier of this replica. */
  get nodeId(): string {
    return this.#p.nodeId;
  }

  /** Increment the counter by `amount` (default 1). */
  increment(amount: number = 1): void {
    this.#p.increment(amount);
  }

  /** Decrement the counter by `amount` (default 1). */
  decrement(amount: number = 1): void {
    this.#n.increment(amount);
  }

  /** The net counter value (increments minus decrements). */
  get value(): number {
    return this.#p.value - this.#n.value;
  }

  /**
   * Merge with another PNCounter.
   * Returns a **new** PNCounter whose nodeId matches `this`.
   */
  merge(other: PNCounter): PNCounter {
    const merged = new PNCounter(this.nodeId);
    // Replace internal counters with merged versions
    const mp = this.#p.merge(other.#p);
    const mn = this.#n.merge(other.#n);
    merged.#p = mp;
    merged.#n = mn;
    return merged;
  }
}

// ─── Factories ───────────────────────────────────────────────────────────────

/** Create a new grow-only counter for the given node. */
export function createGCounter(nodeId: string): GCounter {
  return new GCounter(nodeId);
}

/** Create a new positive-negative counter for the given node. */
export function createPNCounter(nodeId: string): PNCounter {
  return new PNCounter(nodeId);
}
