// @ts-check
// ─── Finite State Machine ─────────────────────────────────────────────────────
// A lightweight, typed finite state machine (FSM) with guards, actions,
// onEnter/onExit lifecycle hooks, transition listeners, and a convenience
// factory function.

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single transition rule describing when and how to move between states.
 *
 * @template S - Union of valid state strings
 * @template E - Union of valid event strings
 */
export interface Transition<S extends string, E extends string> {
  /** Source state(s) this transition applies to. */
  from: S | S[];
  /** Event that triggers this transition. */
  event: E;
  /** Target state after a successful transition. */
  to: S;
  /**
   * Optional guard: if it returns false the transition is blocked and
   * `send` returns false without mutating state.
   */
  guard?: (context: unknown) => boolean;
  /**
   * Optional action: called when the transition fires (after the guard
   * passes, between onExit and onEnter hooks).
   */
  action?: (context: unknown) => void;
}

/**
 * Full configuration for a StateMachine instance.
 *
 * @template S - Union of valid state strings
 * @template E - Union of valid event strings
 */
export interface StateMachineConfig<S extends string, E extends string> {
  /** The state the machine starts in and resets to. */
  initial: S;
  /** All valid transitions for this machine. */
  transitions: Transition<S, E>[];
  /**
   * Optional map of state → callback invoked when that state is entered.
   * Called after the transition action fires.
   */
  onEnter?: Partial<Record<S, (context: unknown) => void>>;
  /**
   * Optional map of state → callback invoked just before leaving that state.
   * Called after the guard passes, before the action.
   */
  onExit?: Partial<Record<S, (context: unknown) => void>>;
}

/** Signature for a listener registered via {@link StateMachine.onTransition}. */
export type TransitionListener<S extends string, E extends string> = (
  from: S,
  event: E,
  to: S,
) => void;

// ─── StateMachine ─────────────────────────────────────────────────────────────

/**
 * Typed finite state machine with guards, actions, and lifecycle hooks.
 *
 * @template S - Union of valid state strings
 * @template E - Union of valid event strings
 *
 * @example
 *   type States = 'idle' | 'loading' | 'done';
 *   type Events = 'fetch' | 'resolve';
 *
 *   const machine = createStateMachine<States, Events>({
 *     initial: 'idle',
 *     transitions: [
 *       { from: 'idle',    event: 'fetch',   to: 'loading' },
 *       { from: 'loading', event: 'resolve', to: 'done'    },
 *     ],
 *   });
 *
 *   machine.send('fetch');   // true
 *   machine.state;           // 'loading'
 */
export class StateMachine<S extends string, E extends string> {
  #current: S;
  #config: StateMachineConfig<S, E>;
  #context: unknown;
  #listeners: Set<TransitionListener<S, E>> = new Set();

  /**
   * @param config  - Machine configuration (initial state + transitions)
   * @param context - Optional arbitrary context passed to guards / actions / hooks
   */
  constructor(config: StateMachineConfig<S, E>, context: unknown = undefined) {
    this.#config = config;
    this.#current = config.initial;
    this.#context = context;
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  /** Returns the current state. */
  get state(): S {
    return this.#current;
  }

  /** Returns the context object supplied at construction time. */
  get context(): unknown {
    return this.#context;
  }

  // ─── send ─────────────────────────────────────────────────────────────────

  /**
   * Send an event to the machine.
   *
   * Finds the first matching transition (matching current state + event)
   * whose guard (if any) returns true, then:
   *   1. Calls `onExit` for the current state (if defined).
   *   2. Calls `action` on the transition (if defined).
   *   3. Moves to the target state.
   *   4. Calls `onEnter` for the new state (if defined).
   *   5. Notifies all `onTransition` listeners.
   *
   * @param event - The event to send
   * @returns `true` if a transition occurred, `false` otherwise
   */
  send(event: E): boolean {
    const transition = this.#findTransition(event);
    if (!transition) return false;

    const from = this.#current;
    const to = transition.to;

    // onExit for the state being left
    this.#config.onExit?.[from]?.(this.#context);

    // Transition action
    transition.action?.(this.#context);

    // Move to new state
    this.#current = to;

    // onEnter for the state just entered
    this.#config.onEnter?.[to]?.(this.#context);

    // Notify listeners
    for (const listener of this.#listeners) {
      listener(from, event, to);
    }

    return true;
  }

  // ─── can ──────────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the given event can trigger a transition from the
   * current state (a matching, guard-passing transition exists).
   *
   * @param event - The event to test
   */
  can(event: E): boolean {
    return this.#findTransition(event) !== null;
  }

  // ─── matches ──────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the machine is currently in the given state.
   *
   * @param state - State to compare against
   */
  matches(state: S): boolean {
    return this.#current === state;
  }

  // ─── onTransition ─────────────────────────────────────────────────────────

  /**
   * Register a listener that is called after every successful transition.
   *
   * @param listener - Called with (from, event, to) on each transition
   * @returns An unsubscribe function — call it to remove this listener
   */
  onTransition(listener: TransitionListener<S, E>): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // ─── reset ────────────────────────────────────────────────────────────────

  /**
   * Resets the machine to its initial state without firing any hooks,
   * actions, or transition listeners.
   */
  reset(): void {
    this.#current = this.#config.initial;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Find the first eligible transition for the given event from the current
   * state. Returns `null` if no matching guard-passing transition exists.
   */
  #findTransition(event: E): Transition<S, E> | null {
    for (const t of this.#config.transitions) {
      const froms = Array.isArray(t.from) ? t.from : [t.from];
      if (t.event !== event) continue;
      if (!froms.includes(this.#current)) continue;
      // Absent guard is treated as always-true
      if (t.guard && !t.guard(this.#context)) continue;
      return t;
    }
    return null;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory — equivalent to `new StateMachine(config, context)`.
 *
 * @template S - Union of valid state strings
 * @template E - Union of valid event strings
 *
 * @param config  - Machine configuration
 * @param context - Optional context object
 * @returns A new {@link StateMachine} instance
 */
export function createStateMachine<S extends string, E extends string>(
  config: StateMachineConfig<S, E>,
  context: unknown = undefined,
): StateMachine<S, E> {
  return new StateMachine(config, context);
}
