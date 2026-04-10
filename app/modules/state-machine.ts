// @ts-check
// ─── Hierarchical State Machine ───────────────────────────────────────────────
// A generic finite state machine (FSM) with guards, actions, onEnter/onExit
// hooks, transition history, and a convenience factory function.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Transition<S extends string, E extends string> {
  from: S | S[];
  event: E;
  to: S;
  guard?: (context: Record<string, unknown>) => boolean;
  action?: (context: Record<string, unknown>) => void;
}

export interface StateConfig<S extends string, E extends string> {
  states: S[];
  initial: S;
  transitions: Transition<S, E>[];
  onEnter?: Partial<Record<S, (ctx: Record<string, unknown>) => void>>;
  onExit?: Partial<Record<S, (ctx: Record<string, unknown>) => void>>;
}

// ─── StateMachine ─────────────────────────────────────────────────────────────

export class StateMachine<S extends string, E extends string> {
  readonly #config: StateConfig<S, E>;
  #current: S;
  #context: Record<string, unknown>;
  #history: S[];

  constructor(
    config: StateConfig<S, E>,
    context: Record<string, unknown> = {},
  ) {
    this.#config = config;
    this.#current = config.initial;
    this.#context = { ...context };
    this.#history = [config.initial];
  }

  /** Current state. */
  get state(): S {
    return this.#current;
  }

  /** Shared mutable context object. */
  get context(): Record<string, unknown> {
    return this.#context;
  }

  /** History of states visited (including the initial state). */
  get history(): S[] {
    return [...this.#history];
  }

  /**
   * Send an event to the machine.
   * Executes onExit -> transition action -> onEnter in order.
   * Returns the new state.
   * Throws an Error if no valid transition exists.
   */
  send(event: E): S {
    const transition = this.#findTransition(event);
    if (!transition) {
      throw new Error(
        `No valid transition for event "${event}" in state "${this.#current}"`,
      );
    }

    const from = this.#current;
    const to = transition.to;

    // onExit hook for the departing state
    const exitHook = this.#config.onExit?.[from];
    if (exitHook) exitHook(this.#context);

    // Transition action
    if (transition.action) transition.action(this.#context);

    // Move to new state
    this.#current = to;
    this.#history.push(to);

    // onEnter hook for the arriving state
    const enterHook = this.#config.onEnter?.[to];
    if (enterHook) enterHook(this.#context);

    return this.#current;
  }

  /**
   * Returns true if the event can be dispatched from the current state
   * (a matching transition exists and its guard, if any, passes).
   */
  can(event: E): boolean {
    return this.#findTransition(event) !== undefined;
  }

  /** All events that can currently be dispatched. */
  validEvents(): E[] {
    const seen = new Set<E>();
    const result: E[] = [];
    for (const t of this.#config.transitions) {
      const froms = Array.isArray(t.from) ? t.from : [t.from];
      if (!froms.includes(this.#current)) continue;
      if (t.guard && !t.guard(this.#context)) continue;
      if (!seen.has(t.event)) {
        seen.add(t.event);
        result.push(t.event);
      }
    }
    return result;
  }

  /** Reset to initial state and clear history. Context is preserved. */
  reset(): void {
    this.#current = this.#config.initial;
    this.#history = [this.#config.initial];
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  #findTransition(event: E): Transition<S, E> | undefined {
    for (const t of this.#config.transitions) {
      const froms = Array.isArray(t.from) ? t.from : [t.from];
      if (!froms.includes(this.#current)) continue;
      if (t.event !== event) continue;
      if (t.guard && !t.guard(this.#context)) continue;
      return t;
    }
    return undefined;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new StateMachine with the given configuration and optional context. */
export function createMachine<S extends string, E extends string>(
  config: StateConfig<S, E>,
  context?: Record<string, unknown>,
): StateMachine<S, E> {
  return new StateMachine(config, context);
}
