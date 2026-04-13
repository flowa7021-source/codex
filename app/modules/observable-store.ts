// @ts-check
// ─── Observable Store ─────────────────────────────────────────────────────────
// Minimal reactive state store with reducers, subscriptions, and selectors.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreOptions<S> {
  initialState: S;
  reducers?: Record<string, (state: S, payload: unknown) => S>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a deep clone of a value using JSON round-trip.
 * Works correctly for plain JSON-serialisable state objects.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class Store<S> {
  #state: S;
  #initialState: S;
  #reducers: Record<string, (state: S, payload: unknown) => S>;
  #listeners: Set<(state: S, prevState: S) => void> = new Set();

  constructor(options: StoreOptions<S>) {
    this.#initialState = deepClone(options.initialState);
    this.#state = deepClone(options.initialState);
    this.#reducers = options.reducers ? { ...options.reducers } : {};
  }

  /** Returns a deep clone of the current state. */
  getState(): S {
    return deepClone(this.#state);
  }

  /**
   * Update state with either a partial object (shallow-merged) or an updater
   * function that receives the current state and returns the next state.
   */
  setState(updater: Partial<S> | ((state: S) => S)): void {
    const prev = this.#state;
    if (typeof updater === 'function') {
      this.#state = updater(deepClone(prev));
    } else {
      this.#state = { ...prev, ...updater };
    }
    this.#notify(prev);
  }

  /**
   * Dispatch a named action. The matching reducer receives a deep clone of the
   * current state and the supplied payload, and returns the next state.
   * Unknown actions are silently ignored.
   */
  dispatch(action: string, payload?: unknown): void {
    const reducer = this.#reducers[action];
    if (!reducer) return;
    const prev = this.#state;
    this.#state = reducer(deepClone(prev), payload);
    this.#notify(prev);
  }

  /**
   * Subscribe to all state changes. The listener is called with the next state
   * and the previous state after every update. Returns an unsubscribe function.
   */
  subscribe(listener: (state: S, prevState: S) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Select a derived value from the current state (synchronous read). */
  select<T>(selector: (state: S) => T): T {
    return selector(deepClone(this.#state));
  }

  /**
   * Watch a specific slice of state. The listener is only called when the
   * selected value changes (compared with strict equality). Returns an
   * unsubscribe function.
   */
  watch<T>(selector: (state: S) => T, listener: (value: T, prev: T) => void): () => void {
    let prev = selector(deepClone(this.#state));
    return this.subscribe((state) => {
      const next = selector(state);
      if (next !== prev) {
        const old = prev;
        prev = next;
        listener(next, old);
      }
    });
  }

  /** Reset state to the initial value passed to the constructor. */
  reset(): void {
    const prev = this.#state;
    this.#state = deepClone(this.#initialState);
    this.#notify(prev);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  #notify(prev: S): void {
    const next = deepClone(this.#state);
    const prevClone = deepClone(prev);
    for (const listener of this.#listeners) {
      listener(next, prevClone);
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Convenience factory — equivalent to `new Store(options)`. */
export function createStore<S>(options: StoreOptions<S>): Store<S> {
  return new Store(options);
}
