// @ts-check
// ─── Observable ──────────────────────────────────────────────────────────────
// Reactive state primitive with derived observables, computed values, and
// batched notifications.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Function that removes a subscription when called. */
export type Unsubscribe = () => void;

/** Callback invoked when an observable value changes. */
export type Observer<T> = (value: T, prev: T | undefined) => void;

// ─── Batch machinery ─────────────────────────────────────────────────────────

/** Notifier record used by the batch queue. */
interface PendingNotification {
  notify: () => void;
}

let _batchDepth = 0;
const _batchQueue: PendingNotification[] = [];

/**
 * Flush all pending notifications accumulated during a batch.
 * Runs in insertion order; each notifier fires once per batch.
 */
function flushBatch(): void {
  // Snapshot to allow re-entrant batches spawned inside a notifier
  const queue = _batchQueue.splice(0, _batchQueue.length);
  for (const entry of queue) {
    entry.notify();
  }
}

/**
 * Run `fn` as a batch: all observable notifications are deferred until `fn`
 * returns, then every subscriber is called at most once with the final value.
 *
 * @example
 *   batch(() => {
 *     count.set(1);
 *     count.set(2);
 *   });
 *   // subscribers see only one notification: value=2, prev=0
 */
export function batch(fn: () => void): void {
  _batchDepth++;
  try {
    fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0) {
      flushBatch();
    }
  }
}

// ─── Observable ──────────────────────────────────────────────────────────────

/**
 * A reactive state container. Subscribers are notified synchronously (or once
 * at the end of a `batch()`) whenever the value changes.
 *
 * @template T - Type of the held value
 *
 * @example
 *   const count = new Observable(0);
 *   const unsub = count.subscribe((val, prev) => console.log(val, prev));
 *   count.set(1); // logs: 1, 0
 *   unsub();
 */
export class Observable<T> {
  #value: T;
  #observers: Set<Observer<T>> = new Set();

  /** Pre-batch value recorded when this observable is first dirtied. */
  #pendingPrev: T | undefined = undefined;
  /** Whether this observable is already queued in the current batch. */
  #queued = false;

  constructor(initialValue: T) {
    this.#value = initialValue;
  }

  // ─── value ───────────────────────────────────────────────────────────────

  /** Current value. */
  get value(): T {
    return this.#value;
  }

  // ─── set ─────────────────────────────────────────────────────────────────

  /**
   * Update the value. Notifies subscribers (or queues notification inside a
   * `batch()`). No-ops when the new value is strictly equal to the current one.
   */
  set(newValue: T): void {
    if (newValue === this.#value) return;

    const prev = this.#value;
    this.#value = newValue;

    if (_batchDepth > 0) {
      if (!this.#queued) {
        // First mutation in this batch — record the value before the batch
        this.#pendingPrev = prev;
        this.#queued = true;
        _batchQueue.push({
          notify: () => {
            this.#queued = false;
            const batchPrev = this.#pendingPrev;
            this.#pendingPrev = undefined;
            // If the value was mutated back to the pre-batch value, skip notification
            if (this.#value === batchPrev) return;
            this._notifyObservers(this.#value, batchPrev);
          },
        });
      }
      // Subsequent mutations in the same batch: keep the original pendingPrev
      // so subscribers receive (finalValue, valueBefore‑the‑batch).
    } else {
      this._notifyObservers(this.#value, prev);
    }
  }

  // ─── update ──────────────────────────────────────────────────────────────

  /**
   * Derive a new value from the current one and set it.
   *
   * @param fn - Pure function receiving the current value, returning the next
   */
  update(fn: (current: T) => T): void {
    this.set(fn(this.#value));
  }

  // ─── subscribe ───────────────────────────────────────────────────────────

  /**
   * Register an observer called on every future change.
   *
   * @param observer - Receives `(newValue, prevValue)`
   * @returns Unsubscribe function
   */
  subscribe(observer: Observer<T>): Unsubscribe {
    this.#observers.add(observer);
    return () => {
      this.#observers.delete(observer);
    };
  }

  // ─── once ────────────────────────────────────────────────────────────────

  /**
   * Subscribe for a single notification, then auto-unsubscribe.
   *
   * @param observer - Receives `(newValue, prevValue)` exactly once
   * @returns Unsubscribe function to cancel before the first change
   */
  once(observer: Observer<T>): Unsubscribe {
    const wrapper: Observer<T> = (value, prev) => {
      unsub();
      observer(value, prev);
    };
    const unsub = this.subscribe(wrapper);
    return unsub;
  }

  // ─── pipe ────────────────────────────────────────────────────────────────

  /**
   * Create a derived `Observable<U>` whose value is `transform(this.value)`.
   * The derived observable updates automatically whenever this one changes.
   *
   * @param transform - Pure mapping function
   * @returns New derived observable
   *
   * @example
   *   const doubled = count.pipe(n => n * 2);
   *   doubled.value; // 0
   *   count.set(5);
   *   doubled.value; // 10
   */
  pipe<U>(transform: (value: T) => U): Observable<U> {
    const derived = new Observable<U>(transform(this.#value));
    this.subscribe((value) => {
      derived.set(transform(value));
    });
    return derived;
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  /** @internal Notify all current observers. Snapshot to guard against mid-call mutation. */
  _notifyObservers(value: T, prev: T | undefined): void {
    for (const observer of [...this.#observers]) {
      observer(value, prev);
    }
  }
}

// ─── Computed ────────────────────────────────────────────────────────────────

/**
 * A read-only reactive value derived from one or more `Observable` sources.
 * Recomputes whenever any dependency changes.
 *
 * @template T - Type of the computed result
 *
 * @example
 *   const a = new Observable(2);
 *   const b = new Observable(3);
 *   const sum = new Computed([a, b], (x, y) => x + y);
 *   console.log(sum.value); // 5
 *   a.set(10);
 *   console.log(sum.value); // 13
 */
export class Computed<T> {
  #deps: Observable<unknown>[];
  #compute: (...values: unknown[]) => T;
  #inner: Observable<T>;

  constructor(
    deps: Observable<unknown>[],
    compute: (...values: unknown[]) => T,
  ) {
    this.#deps = deps;
    this.#compute = compute;
    this.#inner = new Observable<T>(this.#recompute());

    for (const dep of this.#deps) {
      dep.subscribe(() => {
        this.#inner.set(this.#recompute());
      });
    }
  }

  // ─── value ───────────────────────────────────────────────────────────────

  /** Current computed value. */
  get value(): T {
    return this.#inner.value;
  }

  // ─── subscribe ───────────────────────────────────────────────────────────

  /**
   * Subscribe to changes in the computed value.
   *
   * @param observer - Receives `(newValue, prevValue)`
   * @returns Unsubscribe function
   */
  subscribe(observer: Observer<T>): Unsubscribe {
    return this.#inner.subscribe(observer);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  #recompute(): T {
    const values = this.#deps.map((dep) => dep.value);
    return this.#compute(...values);
  }
}

// ─── Factory functions ────────────────────────────────────────────────────────

/**
 * Create a new `Observable` with the given initial value.
 *
 * @example
 *   const name = createObservable('Alice');
 *   name.subscribe((v, prev) => console.log(prev, '->', v));
 *   name.set('Bob'); // logs: Alice -> Bob
 */
export function createObservable<T>(initialValue: T): Observable<T> {
  return new Observable<T>(initialValue);
}

/**
 * Create a new `Computed` value derived from the given dependencies.
 *
 * @example
 *   const total = createComputed([price, qty], (p, q) => p * q);
 */
export function createComputed<T>(
  deps: Observable<unknown>[],
  compute: (...values: unknown[]) => T,
): Computed<T> {
  return new Computed<T>(deps, compute);
}
