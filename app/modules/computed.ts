// @ts-check
// ─── Computed / Reactive Signals ─────────────────────────────────────────────
// Lightweight reactive primitives: Signal (ref), Computed (derived/memoized),
// batch (atomic multi-update), and effect (side-effect on dep changes).

// ─── Batch state ─────────────────────────────────────────────────────────────

/** Whether a batch is currently in progress. */
let _batching = false;

/** Signals that were mutated during a batch, in insertion order. */
const _pendingSignals: Set<Signal<unknown>> = new Set();

// ─── Signal ───────────────────────────────────────────────────────────────────

/** A reactive signal (like Vue's ref). */
export class Signal<T> {
  #value: T;
  #subscribers: Array<(newVal: T, oldVal: T) => void> = [];

  constructor(value: T) {
    this.#value = value;
  }

  get value(): T {
    return this.#value;
  }

  set value(v: T) {
    if (Object.is(this.#value, v)) return;
    const old = this.#value;
    this.#value = v;

    if (_batching) {
      // Queue notification; store old value only on first queue insertion.
      _pendingSignals.add(this as unknown as Signal<unknown>);
      // Keep track of the "old" value at the moment we entered the batch for
      // this signal so we can fire with the correct before/after pair.
      const sig = this as unknown as _BatchedSignal;
      if (sig._batchOld === undefined) {
        sig._batchOld = old;
      }
      return;
    }

    this._notifySubscribers(v, old);
  }

  /** Notify all subscribers with new/old values. */
  _notifySubscribers(newVal: T, oldVal: T): void {
    for (const fn of this.#subscribers.slice()) {
      fn(newVal, oldVal);
    }
  }

  /** Subscribe to value changes. Returns unsubscribe function. */
  subscribe(fn: (newVal: T, oldVal: T) => void): () => void {
    this.#subscribers.push(fn);
    return () => {
      const idx = this.#subscribers.indexOf(fn);
      if (idx !== -1) this.#subscribers.splice(idx, 1);
    };
  }
}

/** Internal interface used only inside batch flushing. */
interface _BatchedSignal {
  _batchOld: unknown;
}

// ─── Computed ─────────────────────────────────────────────────────────────────

/** A derived computed value (memoized). */
export class Computed<T> {
  #fn: () => T;
  #deps: Signal<unknown>[];
  #value: T;
  #dirty = true;
  #subscribers: Array<(newVal: T, oldVal: T) => void> = [];
  #unsubscribeDeps: Array<() => void> = [];

  constructor(fn: () => T, deps: Signal<unknown>[]) {
    this.#fn = fn;
    this.#deps = deps;
    // Lazily compute initial value on first access.
    this.#value = undefined as unknown as T;
    // Subscribe to each dep to invalidate and notify.
    for (const dep of this.#deps) {
      const unsub = dep.subscribe(() => {
        this.invalidate();
      });
      this.#unsubscribeDeps.push(unsub);
    }
  }

  get value(): T {
    if (this.#dirty) {
      const old = this.#value;
      this.#value = this.#fn();
      this.#dirty = false;
      if (!Object.is(this.#value, old) && this.#subscribers.length > 0) {
        // Already recomputed; notify was triggered from invalidate(), but we
        // need the new value — this path fires only if accessed during a dep
        // subscriber callback before invalidate() completes. Safe to skip here
        // since invalidate() always notifies after recomputing.
      }
    }
    return this.#value;
  }

  /** Force recompute on next access and notify subscribers. */
  invalidate(): void {
    if (this.#subscribers.length === 0) {
      this.#dirty = true;
      return;
    }
    const old = this.#value; // value was eagerly computed when first subscriber registered
    this.#dirty = true;
    const newVal = this.value; // triggers recompute
    if (!Object.is(newVal, old)) {
      for (const fn of this.#subscribers.slice()) {
        fn(newVal, old);
      }
    }
  }

  /** Subscribe to computed value changes. Returns unsubscribe function. */
  subscribe(fn: (newVal: T, oldVal: T) => void): () => void {
    // Eagerly compute initial value so invalidate() has a valid old value to
    // diff against when a dependency changes before the next .value access.
    if (this.#dirty) {
      this.#value = this.#fn();
      this.#dirty = false;
    }
    this.#subscribers.push(fn);
    return () => {
      const idx = this.#subscribers.indexOf(fn);
      if (idx !== -1) this.#subscribers.splice(idx, 1);
    };
  }

  /** Detach from all dep subscriptions. */
  dispose(): void {
    for (const unsub of this.#unsubscribeDeps) unsub();
    this.#unsubscribeDeps = [];
  }
}

// ─── batch ────────────────────────────────────────────────────────────────────

/**
 * Run `fn` as a batch: all signal mutations inside are collected and their
 * subscribers are notified once at the end (atomically).
 */
export function batch(fn: () => void): void {
  if (_batching) {
    // Nested batch — just run; outer batch will flush.
    fn();
    return;
  }
  _batching = true;
  try {
    fn();
  } finally {
    _batching = false;
    // Flush notifications in insertion order.
    const pending = Array.from(_pendingSignals);
    _pendingSignals.clear();
    for (const sig of pending) {
      const bsig = sig as unknown as _BatchedSignal;
      const oldVal = bsig._batchOld;
      bsig._batchOld = undefined;
      sig._notifySubscribers(sig.value, oldVal as never);
    }
  }
}

// ─── effect ───────────────────────────────────────────────────────────────────

/**
 * Run `fn` whenever any of `deps` changes. Returns an unsubscribe function
 * that stops the effect.
 */
export function effect(fn: () => void, deps: Signal<unknown>[]): () => void {
  const unsubs: Array<() => void> = [];
  for (const dep of deps) {
    unsubs.push(dep.subscribe(() => fn()));
  }
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

// ─── Factories ────────────────────────────────────────────────────────────────

export function signal<T>(value: T): Signal<T> {
  return new Signal(value);
}

export function computed<T>(fn: () => T, deps: Signal<unknown>[]): Computed<T> {
  return new Computed(fn, deps);
}
