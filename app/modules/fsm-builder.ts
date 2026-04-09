// @ts-check
// ─── Fluent Finite State Machine Builder ────────────────────────────────────
// Provides a builder pattern for constructing FSMs with typed states and events.
// No browser APIs used.

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransitionEntry<S extends string> {
  to: S;
  action?: () => void;
}

interface FSMConfig<S extends string, E extends string> {
  initialState: S;
  states: Set<S>;
  finalStates: Set<S>;
  transitions: Map<string, TransitionEntry<S>>;
  enterHooks: Map<S, () => void>;
  exitHooks: Map<S, () => void>;
}

// ─── FSM ─────────────────────────────────────────────────────────────────────

export class FSM<S extends string, E extends string> {
  #initialState: S;
  #current: S;
  #states: Set<S>;
  #finalStates: Set<S>;
  #transitions: Map<string, TransitionEntry<S>>;
  #enterHooks: Map<S, () => void>;
  #exitHooks: Map<S, () => void>;
  #history: S[];

  constructor(config: FSMConfig<S, E>) {
    this.#initialState = config.initialState;
    this.#current = config.initialState;
    this.#states = config.states;
    this.#finalStates = config.finalStates;
    this.#transitions = config.transitions;
    this.#enterHooks = config.enterHooks;
    this.#exitHooks = config.exitHooks;
    this.#history = [config.initialState];
  }

  /** The current state of the FSM. */
  get current(): S {
    return this.#current;
  }

  /**
   * Send an event to the FSM, triggering a transition if one exists.
   * Returns true if a transition was taken, false otherwise.
   */
  send(event: E): boolean {
    const key = `${this.#current}::${event}`;
    const entry = this.#transitions.get(key);
    if (!entry) return false;

    const exitHook = this.#exitHooks.get(this.#current);
    if (exitHook) exitHook();

    if (entry.action) entry.action();

    this.#current = entry.to;
    this.#history.push(this.#current);

    const enterHook = this.#enterHooks.get(this.#current);
    if (enterHook) enterHook();

    return true;
  }

  /** Check whether the given event would trigger a transition from the current state. */
  canSend(event: E): boolean {
    const key = `${this.#current}::${event}`;
    return this.#transitions.has(key);
  }

  /** Whether the FSM is currently in a final (accepting) state. */
  get isInFinalState(): boolean {
    return this.#finalStates.has(this.#current);
  }

  /** Reset the FSM to its initial state, clearing history. */
  reset(): void {
    this.#current = this.#initialState;
    this.#history = [this.#initialState];
  }

  /** The full state history (including the initial state). */
  get history(): S[] {
    return [...this.#history];
  }
}

// ─── FSMBuilder ──────────────────────────────────────────────────────────────

export class FSMBuilder<S extends string, E extends string> {
  #initialState: S;
  #states: Set<S>;
  #finalStates: Set<S>;
  #transitions: Map<string, TransitionEntry<S>>;
  #enterHooks: Map<S, () => void>;
  #exitHooks: Map<S, () => void>;

  constructor(initialState: S) {
    this.#initialState = initialState;
    this.#states = new Set<S>([initialState]);
    this.#finalStates = new Set<S>();
    this.#transitions = new Map();
    this.#enterHooks = new Map();
    this.#exitHooks = new Map();
  }

  /** Register a state in the FSM. */
  addState(state: S): this {
    this.#states.add(state);
    return this;
  }

  /** Register a transition from one state to another on the given event. */
  addTransition(from: S, event: E, to: S, action?: () => void): this {
    this.#states.add(from);
    this.#states.add(to);
    const key = `${from}::${event}`;
    this.#transitions.set(key, { to, action });
    return this;
  }

  /** Mark a state as a final (accepting) state. */
  addFinalState(state: S): this {
    this.#states.add(state);
    this.#finalStates.add(state);
    return this;
  }

  /** Register a callback to run when entering the given state. */
  onEnter(state: S, fn: () => void): this {
    this.#enterHooks.set(state, fn);
    return this;
  }

  /** Register a callback to run when exiting the given state. */
  onExit(state: S, fn: () => void): this {
    this.#exitHooks.set(state, fn);
    return this;
  }

  /** Build and return the FSM. */
  build(): FSM<S, E> {
    return new FSM<S, E>({
      initialState: this.#initialState,
      states: new Set(this.#states),
      finalStates: new Set(this.#finalStates),
      transitions: new Map(this.#transitions),
      enterHooks: new Map(this.#enterHooks),
      exitHooks: new Map(this.#exitHooks),
    });
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new FSMBuilder with the given initial state. */
export function createFSMBuilder<S extends string, E extends string>(
  initial: S,
): FSMBuilder<S, E> {
  return new FSMBuilder<S, E>(initial);
}
