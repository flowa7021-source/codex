// @ts-check
// ─── Reactive State ───────────────────────────────────────────────────────────
// Lightweight signal/atom primitives: Signal, computed, effect, batch.

// ─── Batch queue ──────────────────────────────────────────────────────────────

let _batchDepth = 0;
// Signals that have been written during the current batch.
const _pendingSignals: Set<Signal<unknown>> = new Set();

// ─── Signal ───────────────────────────────────────────────────────────────────

export class Signal<T> {
  #value: T;
  #subscribers: Set<(value: T) => void> = new Set();

  constructor(initialValue: T) {
    this.#value = initialValue;
  }

  /** Current value. Setting triggers subscribers (or queues them if batching). */
  get value(): T {
    return this.#value;
  }

  set value(v: T) {
    if (Object.is(this.#value, v)) return; // no-op if value did not change
    this.#value = v;
    if (_batchDepth > 0) {
      _pendingSignals.add(this as unknown as Signal<unknown>);
    } else {
      this.#flush();
    }
  }

  /** Read the current value without participating in any reactive tracking. */
  peek(): T {
    return this.#value;
  }

  /**
   * Subscribe to future value changes. The listener is called with the new
   * value on every change. Returns an unsubscribe function.
   */
  subscribe(fn: (value: T) => void): () => void {
    this.#subscribers.add(fn);
    return () => {
      this.#subscribers.delete(fn);
    };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** Notify all subscribers with the current value. Called after batching ends. */
  _flush(): void {
    this.#flush();
  }

  #flush(): void {
    for (const fn of this.#subscribers) {
      fn(this.#value);
    }
  }
}

// ─── computed ─────────────────────────────────────────────────────────────────

/**
 * Create a derived Signal whose value is recomputed whenever any of the given
 * dependency Signals change. The initial value is computed immediately.
 *
 * The returned Signal is read-only by convention — setting its `value`
 * property directly is not recommended because it will be overwritten on the
 * next dependency change.
 */
export function computed<T>(fn: () => T, deps: Signal<unknown>[]): Signal<T> {
  const sig = new Signal<T>(fn());

  for (const dep of deps) {
    dep.subscribe(() => {
      sig.value = fn();
    });
  }

  return sig;
}

// ─── effect ───────────────────────────────────────────────────────────────────

/**
 * Register a side-effect function that re-runs whenever any of the given
 * dependency Signals change. The effect is NOT run immediately on registration.
 * Returns a cleanup / unsubscribe function.
 */
export function effect(fn: () => void, deps: Signal<unknown>[]): () => void {
  const unsubs: Array<() => void> = deps.map((dep) =>
    dep.subscribe(() => fn())
  );

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

// ─── batch ────────────────────────────────────────────────────────────────────

/**
 * Execute `fn` in a batch context. All signal writes during the batch are
 * collected, and subscribers are notified exactly once per signal after `fn`
 * returns, regardless of how many times each signal was written.
 */
export function batch(fn: () => void): void {
  _batchDepth += 1;
  try {
    fn();
  } finally {
    _batchDepth -= 1;
    if (_batchDepth === 0) {
      // Snapshot the pending set before flushing so that flush-triggered writes
      // (if any) end up in a new batch or fire immediately.
      const toFlush = Array.from(_pendingSignals);
      _pendingSignals.clear();
      for (const sig of toFlush) {
        sig._flush();
      }
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Convenience factory — equivalent to `new Signal(value)`. */
export function createSignal<T>(value: T): Signal<T> {
  return new Signal(value);
}
