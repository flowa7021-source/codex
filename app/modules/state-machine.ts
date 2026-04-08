// @ts-check
// ─── State Machine ───────────────────────────────────────────────────────────
// A simple synchronous finite state machine with entry/exit hooks and
// transition subscriptions.

/**
 * State machine configuration.
 */
export interface StateMachineConfig<S extends string, E extends string> {
  initial: S;
  states: {
    [state in S]: {
      on?: { [event in E]?: S };
      entry?: () => void;
      exit?: () => void;
    };
  };
}

/**
 * A simple synchronous finite state machine.
 */
export class StateMachine<S extends string, E extends string> {
  #config: StateMachineConfig<S, E>;
  #current: S;
  #listeners: Array<(from: S, to: S, event: E) => void> = [];

  constructor(config: StateMachineConfig<S, E>) {
    this.#config = config;
    this.#current = config.initial;
    // Run entry callback for the initial state if defined.
    config.states[config.initial]?.entry?.();
  }

  /**
   * The current state of the machine.
   */
  get current(): S {
    return this.#current;
  }

  /**
   * Send an event to the machine, triggering a transition if defined.
   * Returns the new state (same state if no transition exists).
   */
  send(event: E): S {
    const stateDef = this.#config.states[this.#current];
    const next = stateDef?.on?.[event];
    if (next === undefined) return this.#current;

    const from = this.#current;
    stateDef?.exit?.();
    this.#current = next;
    this.#config.states[next]?.entry?.();

    for (const cb of this.#listeners.slice()) {
      cb(from, next, event);
    }

    return this.#current;
  }

  /**
   * Whether the machine can transition from the current state on the given event.
   */
  can(event: E): boolean {
    return this.#config.states[this.#current]?.on?.[event] !== undefined;
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  onTransition(callback: (from: S, to: S, event: E) => void): () => void {
    this.#listeners.push(callback);
    return () => {
      const idx = this.#listeners.indexOf(callback);
      if (idx !== -1) this.#listeners.splice(idx, 1);
    };
  }

  /**
   * Whether the machine is in a given state.
   */
  matches(state: S): boolean {
    return this.#current === state;
  }

  /**
   * Reset the machine to its initial state, firing exit on current state
   * and entry on the initial state.
   */
  reset(): void {
    if (this.#current !== this.#config.initial) {
      this.#config.states[this.#current]?.exit?.();
    }
    this.#current = this.#config.initial;
    this.#config.states[this.#config.initial]?.entry?.();
  }
}

/**
 * Create a state machine from a config.
 */
export function createMachine<S extends string, E extends string>(
  config: StateMachineConfig<S, E>
): StateMachine<S, E> {
  return new StateMachine(config);
}
