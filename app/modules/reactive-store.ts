// @ts-check
// ─── Reactive Store ──────────────────────────────────────────────────────────
// A Vuex/Redux-inspired reactive state store with mutations, getters,
// subscriptions, and property watching.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreOptions<S, M extends Record<string, (state: S, payload?: unknown) => S>> {
  state: S;
  mutations: M;
  getters?: Record<string, (state: S) => unknown>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class Store<S, M extends Record<string, (state: S, payload?: unknown) => S>> {
  #state: S;
  #mutations: M;
  #getters: Record<string, (state: S) => unknown>;
  #subscribers: Array<(state: S, mutation: string) => void> = [];

  constructor(options: StoreOptions<S, M>) {
    this.#state = options.state;
    this.#mutations = options.mutations;
    this.#getters = options.getters ?? {};
  }

  /** Return the current state (read-only view). */
  get state(): S {
    return this.#state;
  }

  /** Commit a mutation by name with optional payload. */
  commit(mutation: keyof M, payload?: unknown): void {
    const fn = this.#mutations[mutation];
    if (!fn) throw new Error(`Unknown mutation: ${String(mutation)}`);
    this.#state = fn(this.#state, payload);
    const name = String(mutation);
    const snapshot = this.#state;
    for (const sub of this.#subscribers.slice()) {
      sub(snapshot, name);
    }
  }

  /** Get a derived value by getter name. */
  get<K extends string>(getter: K): unknown {
    const fn = this.#getters[getter];
    if (!fn) throw new Error(`Unknown getter: ${getter}`);
    return fn(this.#state);
  }

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(fn: (state: S, mutation: string) => void): () => void {
    this.#subscribers.push(fn);
    return () => {
      const idx = this.#subscribers.indexOf(fn);
      if (idx !== -1) this.#subscribers.splice(idx, 1);
    };
  }

  /**
   * Watch a specific derived value. Calls `fn` whenever the selector result
   * changes (by strict equality). Returns unsubscribe function.
   */
  watch<T>(selector: (state: S) => T, fn: (newVal: T, oldVal: T) => void): () => void {
    let prev = selector(this.#state);
    return this.subscribe((state) => {
      const next = selector(state);
      if (!Object.is(next, prev)) {
        const old = prev;
        prev = next;
        fn(next, old);
      }
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createStore<S, M extends Record<string, (state: S, payload?: unknown) => S>>(
  options: StoreOptions<S, M>,
): Store<S, M> {
  return new Store(options);
}
