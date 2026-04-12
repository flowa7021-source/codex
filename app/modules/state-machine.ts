// @ts-check
// ─── Finite State Machine ──────────────────────────────────────────────────────
// A generic, strongly-typed finite state machine supporting enter/exit hooks,
// transition listeners, history tracking, and programmatic resets.

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Per-state configuration: optional transition map and lifecycle hooks. */
export interface StateConfig<S extends string, E extends string> {
  /** Maps events to target states. Only listed events trigger transitions. */
  on?: Partial<Record<E, S>>;
  /** Called when the machine enters this state. */
  onEnter?: () => void;
  /** Called when the machine exits this state. */
  onExit?: () => void;
}

/** Full machine configuration supplied to the constructor or factory. */
export interface MachineConfig<S extends string, E extends string> {
  /** The state the machine starts in (and resets to). */
  initial: S;
  /** Complete map of every state to its configuration. */
  states: Record<S, StateConfig<S, E>>;
}

type TransitionHandler<S extends string, E extends string> = (
  from: S,
  to: S,
  via: E,
) => void;

// ─── StateMachine ──────────────────────────────────────────────────────────────

export class StateMachine<S extends string, E extends string> {
  #initial: S;
  #current: S;
  #config: MachineConfig<S, E>;
  #history: S[];
  #listeners: Set<TransitionHandler<S, E>>;

  constructor(config: MachineConfig<S, E>) {
    this.#config = config;
    this.#initial = config.initial;
    this.#current = config.initial;
    this.#history = [config.initial];
    this.#listeners = new Set();

    // Fire onEnter for the initial state, if provided.
    this.#config.states[this.#initial]?.onEnter?.();
  }

  // ── Getters ───────────────────────────────────────────────────────────────────

  /** The name of the currently active state. */
  get current(): S {
    return this.#current;
  }

  /**
   * Ordered list of states visited since the machine was created or last reset.
   * The first element is always the initial state.
   * Returns a copy — mutations have no effect on the machine.
   */
  get history(): S[] {
    return [...this.#history];
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  /**
   * Returns true if the given event can trigger a transition from the current state.
   */
  can(event: E): boolean {
    return this.#config.states[this.#current]?.on?.[event] !== undefined;
  }

  /** Returns true if the machine is currently in the given state. */
  matches(state: S): boolean {
    return this.#current === state;
  }

  // ── Mutation ──────────────────────────────────────────────────────────────────

  /**
   * Fire an event. If the current state has a transition for `event`,
   * executes onExit → onEnter → notifies listeners.
   * Returns true if a transition occurred, false otherwise.
   */
  send(event: E): boolean {
    const to = this.#config.states[this.#current]?.on?.[event];
    if (to === undefined) return false;

    const from = this.#current;

    this.#config.states[from]?.onExit?.();
    this.#current = to;
    this.#history.push(to);
    this.#config.states[to]?.onEnter?.();

    for (const listener of this.#listeners) {
      listener(from, to, event);
    }

    return true;
  }

  /**
   * Reset the machine to its initial state. Fires onExit on the current state
   * and onEnter on the initial state (unless already at initial).
   * Transition listeners are NOT fired.
   */
  reset(): void {
    if (this.#current !== this.#initial) {
      this.#config.states[this.#current]?.onExit?.();
      this.#current = this.#initial;
      this.#config.states[this.#initial]?.onEnter?.();
    }
    this.#history = [this.#initial];
  }

  /**
   * Subscribe to transition events. The handler is called after each successful
   * transition with (from, to, event). Returns an unsubscribe function.
   */
  on(
    _event: 'transition',
    handler: TransitionHandler<S, E>,
  ): () => void {
    this.#listeners.add(handler);
    return () => {
      this.#listeners.delete(handler);
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory — equivalent to `new StateMachine(config)`.
 */
export function createMachine<S extends string, E extends string>(
  config: MachineConfig<S, E>,
): StateMachine<S, E> {
  return new StateMachine(config);
}
