// @ts-check
// ─── Counter Patterns ────────────────────────────────────────────────────────
// Atomic counter, PN-Counter CRDT, and distributed sliding-window counter.

// ─── AtomicCounter ───────────────────────────────────────────────────────────

/** Thread-safe atomic counter (single-threaded JS but useful for patterns). */
export class AtomicCounter {
  #value: number;

  constructor(initial: number = 0) {
    this.#value = initial;
  }

  /** Increment the counter by `by` (default 1) and return the new value. */
  increment(by: number = 1): number {
    this.#value += by;
    return this.#value;
  }

  /** Decrement the counter by `by` (default 1) and return the new value. */
  decrement(by: number = 1): number {
    this.#value -= by;
    return this.#value;
  }

  /** Return the current value. */
  get(): number {
    return this.#value;
  }

  /** Set the counter to an explicit value. */
  set(value: number): void {
    this.#value = value;
  }

  /**
   * Atomically compare and swap.
   * If the current value equals `expected`, replace it with `newValue` and
   * return true; otherwise leave it unchanged and return false.
   */
  compareAndSwap(expected: number, newValue: number): boolean {
    if (this.#value !== expected) return false;
    this.#value = newValue;
    return true;
  }

  /** Reset the counter to 0. */
  reset(): void {
    this.#value = 0;
  }
}

// ─── PNCounter ───────────────────────────────────────────────────────────────

/**
 * PN-Counter CRDT (increment/decrement).
 * Maintains separate grow-only P (positive) and N (negative) maps per node so
 * that two replicas can always be merged to produce a consistent value.
 */
export class PNCounter {
  #nodeId: string;
  #p: Record<string, number>;
  #n: Record<string, number>;

  constructor(nodeId: string) {
    this.#nodeId = nodeId;
    this.#p = {};
    this.#n = {};
  }

  /** Increment by `by` (default 1). */
  increment(by: number = 1): void {
    this.#p[this.#nodeId] = (this.#p[this.#nodeId] ?? 0) + by;
  }

  /** Decrement by `by` (default 1). */
  decrement(by: number = 1): void {
    this.#n[this.#nodeId] = (this.#n[this.#nodeId] ?? 0) + by;
  }

  /** Return the current logical value (sum of P minus sum of N across all nodes). */
  value(): number {
    const sumP = Object.values(this.#p).reduce((a, b) => a + b, 0);
    const sumN = Object.values(this.#n).reduce((a, b) => a + b, 0);
    return sumP - sumN;
  }

  /**
   * Merge another PNCounter into this one (CRDT merge = per-node max).
   * After merging, `this.value()` reflects the union of both replicas.
   */
  merge(other: PNCounter): void {
    const { p: otherP, n: otherN } = other.state();
    for (const [nodeId, val] of Object.entries(otherP)) {
      this.#p[nodeId] = Math.max(this.#p[nodeId] ?? 0, val);
    }
    for (const [nodeId, val] of Object.entries(otherN)) {
      this.#n[nodeId] = Math.max(this.#n[nodeId] ?? 0, val);
    }
  }

  /** Return a snapshot of the internal P/N state maps. */
  state(): { p: Record<string, number>; n: Record<string, number> } {
    return {
      p: { ...this.#p },
      n: { ...this.#n },
    };
  }
}

// ─── DistributedCounter ──────────────────────────────────────────────────────

/**
 * Distributed rate counter using a sliding window.
 * Keeps individual event timestamps so it can accurately compute the count of
 * events that fall within the last `windowMs` milliseconds.
 */
export class DistributedCounter {
  #windowMs: number;
  #events: number[];   // sorted list of timestamps
  #now: number;

  constructor(windowMs: number) {
    this.#windowMs = windowMs;
    this.#events = [];
    this.#now = Date.now();
  }

  /** Expire events that are older than the current window. */
  #evict(now: number): void {
    const cutoff = now - this.#windowMs;
    // Remove entries at the front that are outside the window
    let i = 0;
    while (i < this.#events.length && this.#events[i] <= cutoff) i++;
    if (i > 0) this.#events.splice(0, i);
  }

  /**
   * Record an event at `timestamp` (defaults to internal clock).
   * Returns the current count within the window after recording.
   */
  record(timestamp?: number): number {
    const ts = timestamp ?? this.#now;
    this.#evict(ts);
    this.#events.push(ts);
    return this.#events.length;
  }

  /** Return the current count of events within the sliding window. */
  count(now?: number): number {
    const ts = now ?? this.#now;
    this.#evict(ts);
    return this.#events.length;
  }

  /** Advance the internal clock by `ms` milliseconds. */
  advance(ms: number): void {
    this.#now += ms;
  }
}
