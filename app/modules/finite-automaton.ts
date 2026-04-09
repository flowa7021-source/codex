// @ts-check
// ─── Deterministic Finite Automaton ──────────────────────────────────────────
// DFA for string pattern recognition. No browser APIs used.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DFAState {
  id: string;
  accepting: boolean;
}

export interface DFATransition {
  /** Source state id. */
  from: string;
  /** Single input character. */
  symbol: string;
  /** Target state id. */
  to: string;
}

export interface DFAOptions {
  states: DFAState[];
  initial: string;
  transitions: DFATransition[];
}

// ─── DFA ─────────────────────────────────────────────────────────────────────

export class DFA {
  #states: Map<string, DFAState>;
  #initial: string;
  /** transition map: stateId -> symbol -> stateId */
  #transitionMap: Map<string, Map<string, string>>;

  constructor(options: DFAOptions) {
    this.#states = new Map(options.states.map((s) => [s.id, s]));
    this.#initial = options.initial;
    this.#transitionMap = new Map();

    for (const t of options.transitions) {
      let inner = this.#transitionMap.get(t.from);
      if (!inner) {
        inner = new Map();
        this.#transitionMap.set(t.from, inner);
      }
      inner.set(t.symbol, t.to);
    }
  }

  /**
   * Step from a given state on one symbol.
   * Returns the resulting state id, or null if no transition exists.
   */
  step(stateId: string, symbol: string): string | null {
    const inner = this.#transitionMap.get(stateId);
    if (!inner) return null;
    return inner.get(symbol) ?? null;
  }

  /**
   * Run the DFA over the entire input string starting from the initial state.
   * Returns the final state id, or null if the machine gets stuck.
   */
  run(input: string): string | null {
    let current: string | null = this.#initial;
    for (const ch of input) {
      current = this.step(current, ch);
      if (current === null) return null;
    }
    return current;
  }

  /**
   * Test whether the DFA accepts the given input string.
   * A string is accepted if the machine ends in an accepting state.
   */
  accepts(input: string): boolean {
    const finalState = this.run(input);
    if (finalState === null) return false;
    return this.#states.get(finalState)?.accepting ?? false;
  }

  /** Return the ids of all accepting states. */
  acceptingStates(): string[] {
    const result: string[] = [];
    for (const [id, s] of this.#states) {
      if (s.accepting) result.push(id);
    }
    return result;
  }

  /**
   * Check whether the DFA is complete — i.e. every state has a transition for
   * every symbol in the given alphabet.
   */
  isComplete(alphabet: string[]): boolean {
    for (const [id] of this.#states) {
      for (const symbol of alphabet) {
        if (this.step(id, symbol) === null) return false;
      }
    }
    return true;
  }
}
