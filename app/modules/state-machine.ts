// @ts-check
// ─── State Machine ───────────────────────────────────────────────────────────
// Generic finite state machine with guards, actions, and subscriptions.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Transition<S extends string, E extends string> {
  /** Source state(s) this transition applies from. */
  from: S | S[];
  /** Event that triggers this transition. */
  event: E;
  /** Target state to move to. */
  to: S;
  /** Optional guard — if it returns false the transition is blocked. */
  guard?: (context: unknown) => boolean;
  /** Optional side effect — receives context + event, returns updated context. */
  action?: (context: unknown, event: E) => unknown;
}

export interface StateMachineOptions<S extends string, E extends string> {
  initial: S;
  transitions: Transition<S, E>[];
  onTransition?: (from: S, to: S, event: E) => void;
}

// ─── StateMachine ─────────────────────────────────────────────────────────────

export class StateMachine<S extends string, E extends string> {
  #initial: S;
  #state: S;
  #context: unknown;
  #transitions: Transition<S, E>[];
  #onTransition: ((from: S, to: S, event: E) => void) | undefined;
  #listeners: Set<(state: S, event: E) => void>;

  constructor(options: StateMachineOptions<S, E>) {
    this.#initial = options.initial;
    this.#state = options.initial;
    this.#context = undefined;
    this.#transitions = options.transitions;
    this.#onTransition = options.onTransition;
    this.#listeners = new Set();
  }

  /** Current state. */
  get state(): S {
    return this.#state;
  }

  /** Current context value (may be undefined). */
  get context(): unknown {
    return this.#context;
  }

  /**
   * Send an event. Returns true if a transition occurred, false if blocked or
   * no matching transition exists.
   * An optional context value is passed to the guard / action.
   */
  send(event: E, context?: unknown): boolean {
    const transition = this.#findTransition(event);
    if (!transition) return false;

    const ctx = context !== undefined ? context : this.#context;

    if (transition.guard && !transition.guard(ctx)) return false;

    const from = this.#state;

    if (transition.action) {
      this.#context = transition.action(ctx, event);
    } else if (context !== undefined) {
      this.#context = context;
    }

    this.#state = transition.to;

    this.#onTransition?.(from, transition.to, event);

    for (const listener of this.#listeners) {
      listener(this.#state, event);
    }

    return true;
  }

  /** Check whether an event is valid from the current state (guard respected). */
  can(event: E): boolean {
    const transition = this.#findTransition(event);
    if (!transition) return false;
    if (transition.guard && !transition.guard(this.#context)) return false;
    return true;
  }

  /** Return all events that can be sent from the current state (guards respected). */
  validEvents(): E[] {
    const seen = new Set<E>();
    const result: E[] = [];
    for (const t of this.#transitions) {
      const froms: S[] = Array.isArray(t.from) ? t.from : [t.from];
      if (!froms.includes(this.#state)) continue;
      if (seen.has(t.event)) continue;
      if (t.guard && !t.guard(this.#context)) continue;
      seen.add(t.event);
      result.push(t.event);
    }
    return result;
  }

  /** Reset to the initial state and clear context. */
  reset(): void {
    this.#state = this.#initial;
    this.#context = undefined;
  }

  /**
   * Subscribe to state changes. The listener is called after every successful
   * transition with the new state and the triggering event.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (state: S, event: E) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  #findTransition(event: E): Transition<S, E> | undefined {
    return this.#transitions.find((t) => {
      const froms: S[] = Array.isArray(t.from) ? t.from : [t.from];
      return t.event === event && froms.includes(this.#state);
    });
  }
}
