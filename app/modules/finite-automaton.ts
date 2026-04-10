// @ts-check
// ─── Finite Automata ─────────────────────────────────────────────────────────
// Deterministic (DFA) and Non-Deterministic (NFA) finite automata with
// subset-construction conversion from NFA to DFA.

// ─── Legacy DFA Types (kept for backward compatibility) ───────────────────────

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

// ─── New DFA / NFA Config Types ───────────────────────────────────────────────

export interface DFAConfig {
  states: string[];
  alphabet: string[];
  /** transitions[state][char] = nextState */
  transitions: Record<string, Record<string, string>>;
  initial: string;
  accepting: string[];
}

export interface NFAConfig {
  states: string[];
  alphabet: string[];
  /** transitions[state][char] = set of next states; use '' for epsilon transitions */
  transitions: Record<string, Record<string, string[]>>;
  initial: string;
  accepting: string[];
}

// ─── DFA ─────────────────────────────────────────────────────────────────────

export class DFA {
  /** transition map: stateId -> symbol -> stateId */
  readonly #transitionMap: Map<string, Map<string, string>>;
  readonly #initial: string;
  readonly #accepting: Set<string>;
  /** Legacy: states map for acceptingStates() / isComplete() */
  readonly #statesMap: Map<string, boolean>;

  constructor(config: DFAConfig | DFAOptions) {
    this.#transitionMap = new Map();

    if (isDFAOptions(config)) {
      // Legacy DFAOptions path
      this.#initial = config.initial;
      this.#statesMap = new Map(config.states.map(s => [s.id, s.accepting]));
      this.#accepting = new Set(
        config.states.filter(s => s.accepting).map(s => s.id),
      );
      for (const t of config.transitions) {
        let inner = this.#transitionMap.get(t.from);
        if (!inner) {
          inner = new Map();
          this.#transitionMap.set(t.from, inner);
        }
        inner.set(t.symbol, t.to);
      }
    } else {
      // New DFAConfig path
      this.#initial = config.initial;
      this.#accepting = new Set(config.accepting);
      this.#statesMap = new Map(config.states.map(s => [s, config.accepting.includes(s)]));
      for (const [state, charMap] of Object.entries(config.transitions)) {
        const inner = new Map<string, string>();
        for (const [ch, next] of Object.entries(charMap)) {
          inner.set(ch, next);
        }
        this.#transitionMap.set(state, inner);
      }
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
    return finalState !== null && this.#accepting.has(finalState);
  }

  /** Return the ids of all accepting states. */
  acceptingStates(): string[] {
    const result: string[] = [];
    for (const [id, accepting] of this.#statesMap) {
      if (accepting) result.push(id);
    }
    return result;
  }

  /**
   * Check whether the DFA is complete — every state has a transition for
   * every symbol in the given alphabet.
   */
  isComplete(alphabet: string[]): boolean {
    for (const [id] of this.#statesMap) {
      for (const symbol of alphabet) {
        if (this.step(id, symbol) === null) return false;
      }
    }
    return true;
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isDFAOptions(config: DFAConfig | DFAOptions): config is DFAOptions {
  return Array.isArray((config as DFAOptions).states) &&
    (config as DFAOptions).states.length > 0 &&
    typeof (config as DFAOptions).states[0] === 'object' &&
    'accepting' in (config as DFAOptions).states[0];
}

// ─── NFA ─────────────────────────────────────────────────────────────────────

export class NFA {
  readonly #transitions: Record<string, Record<string, string[]>>;
  readonly #initial: string;
  readonly #accepting: Set<string>;

  constructor(config: NFAConfig) {
    this.#transitions = config.transitions;
    this.#initial = config.initial;
    this.#accepting = new Set(config.accepting);
  }

  /** Epsilon-closure of a set of states: all states reachable via epsilon transitions. */
  epsilonClosure(states: Set<string>): Set<string> {
    const closure = new Set<string>(states);
    const stack = [...states];
    while (stack.length > 0) {
      const s = stack.pop()!;
      const row = this.#transitions[s];
      if (!row) continue;
      const epsilonTargets = row[''] ?? [];
      for (const t of epsilonTargets) {
        if (!closure.has(t)) {
          closure.add(t);
          stack.push(t);
        }
      }
    }
    return closure;
  }

  /** Move from a set of states on a character (without applying epsilon-closure). */
  move(states: Set<string>, char: string): Set<string> {
    const result = new Set<string>();
    for (const s of states) {
      const row = this.#transitions[s];
      if (!row) continue;
      const targets = row[char] ?? [];
      for (const t of targets) {
        result.add(t);
      }
    }
    return result;
  }

  /** Test if string is accepted. */
  accepts(input: string): boolean {
    let current = this.epsilonClosure(new Set([this.#initial]));
    for (const ch of input) {
      current = this.epsilonClosure(this.move(current, ch));
      if (current.size === 0) return false;
    }
    for (const s of current) {
      if (this.#accepting.has(s)) return true;
    }
    return false;
  }
}

// ─── Subset Construction (NFA → DFA) ─────────────────────────────────────────

/** Convert NFA to DFA using subset construction. */
export function nfaToDfa(nfaConfig: NFAConfig): DFA {
  const nfa = new NFA(nfaConfig);
  const alphabet = nfaConfig.alphabet;

  const setKey = (states: Set<string>): string =>
    [...states].sort().join(',');

  const initialSet = nfa.epsilonClosure(new Set([nfaConfig.initial]));
  const initialKey = setKey(initialSet);

  const dfaTransitions: Record<string, Record<string, string>> = {};
  const dfaAccepting: string[] = [];
  const dfaStates: string[] = [];

  const nfaAccepting = new Set(nfaConfig.accepting);
  const workList: Set<string>[] = [initialSet];
  const seen = new Set<string>([initialKey]);

  while (workList.length > 0) {
    const current = workList.pop()!;
    const currentKey = setKey(current);

    dfaStates.push(currentKey);

    for (const s of current) {
      if (nfaAccepting.has(s)) {
        dfaAccepting.push(currentKey);
        break;
      }
    }

    dfaTransitions[currentKey] = {};

    for (const ch of alphabet) {
      const moved = nfa.epsilonClosure(nfa.move(current, ch));
      if (moved.size === 0) continue;
      const movedKey = setKey(moved);
      dfaTransitions[currentKey][ch] = movedKey;
      if (!seen.has(movedKey)) {
        seen.add(movedKey);
        workList.push(moved);
      }
    }
  }

  return new DFA({
    states: dfaStates,
    alphabet,
    transitions: dfaTransitions,
    initial: initialKey,
    accepting: dfaAccepting,
  });
}
