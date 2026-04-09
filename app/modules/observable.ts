// @ts-check
// ─── Observable ──────────────────────────────────────────────────────────────
// Simple reactive value that notifies subscribers on change.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * A reactive value that notifies subscribers on change.
 *
 * @example
 *   const count = new Observable(0);
 *   count.subscribe((val, prev) => console.log(prev, '->', val));
 *   count.value = 1; // logs: 0 -> 1
 */
export class Observable<T> {
  #value: T;
  #subscribers = new Set<(value: T, prev: T) => void>();

  constructor(initialValue: T) {
    this.#value = initialValue;
  }

  /** Get the current value. */
  get value(): T {
    return this.#value;
  }

  /** Set a new value. Notifies all subscribers if changed. */
  set value(newValue: T) {
    if (Object.is(this.#value, newValue)) return;
    const prev = this.#value;
    this.#value = newValue;
    for (const subscriber of [...this.#subscribers]) {
      subscriber(newValue, prev);
    }
  }

  /**
   * Subscribe to value changes.
   * @returns Unsubscribe function — call to stop receiving updates.
   */
  subscribe(callback: (value: T, prev: T) => void): () => void {
    this.#subscribers.add(callback);
    return () => {
      this.#subscribers.delete(callback);
    };
  }

  /** Subscribe to the next change only (once). */
  once(callback: (value: T, prev: T) => void): () => void {
    const unsubscribe = this.subscribe((value, prev) => {
      unsubscribe();
      callback(value, prev);
    });
    return unsubscribe;
  }

  /** Apply a transform to get the current value (like .map in streams). */
  map<U>(fn: (value: T) => U): U {
    return fn(this.#value);
  }

  /**
   * Create a derived observable that updates when this one changes.
   * The derived value is computed from the current value via `fn`.
   */
  derive<U>(fn: (value: T) => U): Observable<U> {
    const derived = new Observable<U>(fn(this.#value));
    this.subscribe((value) => {
      derived.value = fn(value);
    });
    return derived;
  }

  /**
   * Wait for the value to satisfy a condition.
   * Resolves immediately if the predicate is already true.
   */
  when(predicate: (value: T) => boolean): Promise<T> {
    if (predicate(this.#value)) {
      return Promise.resolve(this.#value);
    }
    return new Promise<T>((resolve) => {
      const unsubscribe = this.subscribe((value) => {
        if (predicate(value)) {
          unsubscribe();
          resolve(value);
        }
      });
    });
  }

  /** Number of active subscribers. */
  get subscriberCount(): number {
    return this.#subscribers.size;
  }
}

/**
 * Create an observable value.
 *
 * @example
 *   const name = observable('Alice');
 *   name.subscribe((v) => console.log('Name changed to', v));
 *   name.value = 'Bob';
 */
export function observable<T>(initial: T): Observable<T> {
  return new Observable<T>(initial);
}

/**
 * Combine multiple observables into one that emits an array of their current
 * values whenever any of them changes.
 *
 * @example
 *   const a = observable(1);
 *   const b = observable('hi');
 *   const combined = combineLatest(a, b);
 *   combined.subscribe(([aVal, bVal]) => console.log(aVal, bVal));
 */
export function combineLatest<T extends unknown[]>(
  ...observables: { [K in keyof T]: Observable<T[K]> }
): Observable<T> {
  const getCurrent = (): T =>
    observables.map((obs) => obs.value) as unknown as T;

  const combined = new Observable<T>(getCurrent());

  for (const obs of observables) {
    obs.subscribe(() => {
      combined.value = getCurrent();
    });
  }

  return combined;
}
