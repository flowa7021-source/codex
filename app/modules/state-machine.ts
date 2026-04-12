// @ts-check
// ─── Finite State Machine ─────────────────────────────────────────────────────
// A lightweight, type-safe finite state machine with guards, actions,
// enter/exit hooks, history tracking, and event subscription.

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

/** Handler called whenever a transition completes successfully. */
export type TransitionHandler<S extends string, E extends string> = (
  from: S,
  to: S,
  event: E,
) => void;

// ─── StateMachine ─────────────────────────────────────────────────────────────

/**
 * Typed finite state machine with guards, actions, lifecycle hooks, and
 * full state history.
 *
 * @template S - Union of valid state strings
 * @template E - Union of valid event strings
 *
 * @example
 *   type States = 'idle' | 'running' | 'done';
 *   type Events = 'start' | 'finish';
 *
 *   const machine = createMachine<States, Events>({
 *     initial: 'idle',
 *     transitions: [
 *       { from: 'idle',    event: 'start',  to: 'running' },
 *       { from: 'running', event: 'finish', to: 'done'    },
 *     ],
 *   });
 *
 *   machine.send('start');  // true
 *   machine.state;          // 'running'
 */
export class StateMachine<S extends string, E extends string> {
  #current: S;
  #initial: S;
  #transitions: Transition<S, E>[];
  #onEnter: Partial<Record<S, (context: unknown) => void>>;
  #onExit: Partial<Record<S, (context: unknown) => void>>;
  #history: S[];
  #listeners: Set<TransitionHandler<S, E>>;

  constructor(config: {
    initial: S;
    transitions: Transition<S, E>[];
    onEnter?: Partial<Record<S, (context: unknown) => void>>;
    onExit?: Partial<Record<S, (context: unknown) => void>>;
  }) {
    this.#initial = config.initial;
    this.#current = config.initial;
    this.#transitions = config.transitions;
    this.#onEnter = config.onEnter ?? {};
    this.#onExit = config.onExit ?? {};
    this.#history = [config.initial];
    this.#listeners = new Set();
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  /** Returns the current state. */
  get state(): S {
    return this.#current;
  }

  /**
   * Returns a snapshot of all states visited (including the initial state).
   * Mutating the returned array has no effect on the machine.
   */
  get history(): S[] {
    return [...this.#history];
  }

  // ─── send ─────────────────────────────────────────────────────────────────

  /**
   * Send an event to the machine.
   *
   * Finds the first matching transition (matching current state + event)
   * whose guard (if any) returns true, then:
   *   1. Calls `onExit` for the current state (if defined).
   *   2. Calls `action` on the transition (if defined).
   *   3. Moves to the target state and records it in history.
   *   4. Calls `onEnter` for the new state (if defined).
   *   5. Notifies all `on('transition', …)` listeners.
   *
   * @param event   - The event to send
   * @param context - Optional value forwarded to guards, actions and hooks
   * @returns `true` if a transition occurred, `false` otherwise
   */
  send(event: E, context: unknown = undefined): boolean {
    const transition = this.#findTransition(event, context);
    if (!transition) return false;

    const from = this.#current;
    const to = transition.to;

    // Exit hook for the state being left
    this.#onExit[from]?.(context);

    // Transition side-effect
    transition.action?.(context);

    // Advance state and record in history
    this.#current = to;
    this.#history.push(to);

    // Enter hook for the new state
    this.#onEnter[to]?.(context);

    // Notify transition listeners
    for (const handler of this.#listeners) {
      handler(from, to, event);
    }

    return true;
  }

  // ─── can ──────────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the given event can trigger a transition from the
   * current state (a matching, guard-passing transition exists).
   *
   * @param event   - The event to test
   * @param context - Optional context forwarded to the guard
   */
  can(event: E, context: unknown = undefined): boolean {
    return this.#findTransition(event, context) !== null;
  }

  // ─── reset ────────────────────────────────────────────────────────────────

  /**
   * Resets the machine back to its initial state and clears the history.
   * No hooks, actions or listeners are invoked.
   */
  reset(): void {
    this.#current = this.#initial;
    this.#history = [this.#initial];
  }

  // ─── matches ──────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the machine is currently in `state`.
   *
   * @param state - State to compare against
   */
  matches(state: S): boolean {
    return this.#current === state;
  }

  // ─── on ───────────────────────────────────────────────────────────────────

  /**
   * Subscribe to machine events.  Currently only `'transition'` is supported.
   *
   * The handler receives `(from, to, event)` after every successful
   * transition.
   *
   * @returns An unsubscribe function — call it to remove this listener.
   */
  on(
    event: 'transition',
    handler: TransitionHandler<S, E>,
  ): () => void {
    this.#listeners.add(handler);
    return () => {
      this.#listeners.delete(handler);
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Find the first eligible transition for the given event from the current
   * state.  Returns `null` when no matching, guard-passing transition exists.
   */
  #findTransition(event: E, context: unknown): Transition<S, E> | null {
    for (const t of this.#transitions) {
      const sources = Array.isArray(t.from) ? t.from : [t.from];
      if (t.event !== event) continue;
      if (!sources.includes(this.#current)) continue;
      // An absent guard is treated as always-true
      if (t.guard && !t.guard(context)) continue;
      return t;
    }
    return null;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Convenience factory — equivalent to `new StateMachine(config)`.
 *
 * @template S - Union of valid state strings
 * @template E - Union of valid event strings
 *
 * @example
 *   const m = createMachine({ initial: 'idle', transitions: [...] });
 */
export function createMachine<S extends string, E extends string>(config: {
  initial: S;
  transitions: Transition<S, E>[];
  onEnter?: Partial<Record<S, (context: unknown) => void>>;
  onExit?: Partial<Record<S, (context: unknown) => void>>;
}): StateMachine<S, E> {
  return new StateMachine(config);
}
