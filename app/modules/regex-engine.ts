// @ts-check
// ─── Simple NFA-based Regex Engine ──────────────────────────────────────────
// Supports: . * + ? | () [abc] [a-z]
// No browser APIs used.

// ─── NFA Types ───────────────────────────────────────────────────────────────

interface NFAState {
  id: number;
  transitions: Map<string, NFAState[]>;
  epsilons: NFAState[];
}

interface NFAFragment {
  start: NFAState;
  accept: NFAState;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EPSILON = '\0';
const DOT = '.';
const STAR = '*';
const PLUS = '+';
const QUESTION = '?';
const PIPE = '|';
const LPAREN = '(';
const RPAREN = ')';
const LBRACKET = '[';
const RBRACKET = ']';

// ─── RegexEngine ─────────────────────────────────────────────────────────────

export class RegexEngine {
  #pattern: string;
  #nfa: NFAFragment;
  #nextId: number;

  constructor(pattern: string) {
    this.#pattern = pattern;
    this.#nextId = 0;
    this.#nfa = this.#parse(pattern, 0).fragment;
  }

  /** The original pattern string. */
  get pattern(): string {
    return this.#pattern;
  }

  /** Test whether the entire input matches the pattern. */
  test(input: string): boolean {
    const reachable = this.#simulate(this.#nfa, input);
    return reachable.has(this.#nfa.accept);
  }

  /** Find the first match anywhere in the input. */
  search(input: string): { match: string; index: number } | null {
    for (let i = 0; i <= input.length; i++) {
      for (let j = i; j <= input.length; j++) {
        const sub = input.slice(i, j);
        if (this.test(sub)) {
          return { match: sub, index: i };
        }
      }
    }
    return null;
  }

  /** Find all non-overlapping matches in the input. */
  searchAll(input: string): { match: string; index: number }[] {
    const results: { match: string; index: number }[] = [];
    let pos = 0;
    while (pos <= input.length) {
      let bestMatch: string | null = null;
      let bestEnd = pos;
      // Try longest match first by iterating from end
      for (let j = input.length; j >= pos; j--) {
        const sub = input.slice(pos, j);
        if (this.test(sub)) {
          bestMatch = sub;
          bestEnd = j;
          break;
        }
      }
      if (bestMatch !== null) {
        results.push({ match: bestMatch, index: pos });
        pos = bestEnd > pos ? bestEnd : pos + 1;
      } else {
        pos++;
      }
    }
    return results;
  }

  // ─── NFA State Creation ──────────────────────────────────────────────────

  #createState(): NFAState {
    return { id: this.#nextId++, transitions: new Map(), epsilons: [] };
  }

  // ─── NFA Simulation ──────────────────────────────────────────────────────

  #epsilonClosure(states: Set<NFAState>): Set<NFAState> {
    const stack = [...states];
    const closure = new Set(states);
    while (stack.length > 0) {
      const state = stack.pop()!;
      for (const next of state.epsilons) {
        if (!closure.has(next)) {
          closure.add(next);
          stack.push(next);
        }
      }
    }
    return closure;
  }

  #simulate(nfa: NFAFragment, input: string): Set<NFAState> {
    let current = this.#epsilonClosure(new Set([nfa.start]));
    for (const ch of input) {
      const next = new Set<NFAState>();
      for (const state of current) {
        // Check exact character transitions
        const targets = state.transitions.get(ch);
        if (targets) {
          for (const t of targets) next.add(t);
        }
        // Check dot (any character) transitions
        const dotTargets = state.transitions.get(DOT);
        if (dotTargets) {
          for (const t of dotTargets) next.add(t);
        }
      }
      current = this.#epsilonClosure(next);
    }
    return current;
  }

  // ─── Parser ──────────────────────────────────────────────────────────────

  #parse(
    pattern: string,
    pos: number,
  ): { fragment: NFAFragment; pos: number } {
    return this.#parseAlternation(pattern, pos);
  }

  #parseAlternation(
    pattern: string,
    pos: number,
  ): { fragment: NFAFragment; pos: number } {
    let result = this.#parseConcatenation(pattern, pos);
    while (result.pos < pattern.length && pattern[result.pos] === PIPE) {
      const right = this.#parseConcatenation(pattern, result.pos + 1);
      result = {
        fragment: this.#makeAlternation(result.fragment, right.fragment),
        pos: right.pos,
      };
    }
    return result;
  }

  #parseConcatenation(
    pattern: string,
    pos: number,
  ): { fragment: NFAFragment; pos: number } {
    const parts: NFAFragment[] = [];
    while (
      pos < pattern.length &&
      pattern[pos] !== PIPE &&
      pattern[pos] !== RPAREN
    ) {
      const result = this.#parseQuantifier(pattern, pos);
      parts.push(result.fragment);
      pos = result.pos;
    }
    if (parts.length === 0) {
      // Empty pattern — match empty string
      const s = this.#createState();
      const a = this.#createState();
      s.epsilons.push(a);
      return { fragment: { start: s, accept: a }, pos };
    }
    let combined = parts[0];
    for (let i = 1; i < parts.length; i++) {
      combined = this.#makeConcatenation(combined, parts[i]);
    }
    return { fragment: combined, pos };
  }

  #parseQuantifier(
    pattern: string,
    pos: number,
  ): { fragment: NFAFragment; pos: number } {
    let result = this.#parseAtom(pattern, pos);
    if (result.pos < pattern.length) {
      const ch = pattern[result.pos];
      if (ch === STAR) {
        result = {
          fragment: this.#makeStar(result.fragment),
          pos: result.pos + 1,
        };
      } else if (ch === PLUS) {
        result = {
          fragment: this.#makePlus(result.fragment),
          pos: result.pos + 1,
        };
      } else if (ch === QUESTION) {
        result = {
          fragment: this.#makeQuestion(result.fragment),
          pos: result.pos + 1,
        };
      }
    }
    return result;
  }

  #parseAtom(
    pattern: string,
    pos: number,
  ): { fragment: NFAFragment; pos: number } {
    const ch = pattern[pos];

    if (ch === LPAREN) {
      const result = this.#parse(pattern, pos + 1);
      if (result.pos >= pattern.length || pattern[result.pos] !== RPAREN) {
        throw new Error(`Unmatched '(' in pattern at position ${pos}`);
      }
      return { fragment: result.fragment, pos: result.pos + 1 };
    }

    if (ch === LBRACKET) {
      return this.#parseCharClass(pattern, pos);
    }

    if (ch === DOT) {
      return { fragment: this.#makeDot(), pos: pos + 1 };
    }

    if (ch === '\\' && pos + 1 < pattern.length) {
      // Escaped character
      const escaped = pattern[pos + 1];
      return { fragment: this.#makeChar(escaped), pos: pos + 2 };
    }

    // Literal character
    return { fragment: this.#makeChar(ch), pos: pos + 1 };
  }

  #parseCharClass(
    pattern: string,
    pos: number,
  ): { fragment: NFAFragment; pos: number } {
    // pos points at '['
    let i = pos + 1;
    const chars: string[] = [];
    while (i < pattern.length && pattern[i] !== RBRACKET) {
      if (i + 2 < pattern.length && pattern[i + 1] === '-' && pattern[i + 2] !== RBRACKET) {
        // Range like a-z
        const from = pattern.charCodeAt(i);
        const to = pattern.charCodeAt(i + 2);
        for (let c = from; c <= to; c++) {
          chars.push(String.fromCharCode(c));
        }
        i += 3;
      } else {
        chars.push(pattern[i]);
        i++;
      }
    }
    if (i >= pattern.length) {
      throw new Error(`Unmatched '[' in pattern at position ${pos}`);
    }
    // i now points at ']'
    const fragment = this.#makeCharSet(chars);
    return { fragment, pos: i + 1 };
  }

  // ─── NFA Construction Helpers ────────────────────────────────────────────

  #makeChar(ch: string): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    const targets = start.transitions.get(ch) ?? [];
    targets.push(accept);
    start.transitions.set(ch, targets);
    return { start, accept };
  }

  #makeDot(): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    // Use the DOT symbol as a wildcard marker in transitions
    start.transitions.set(DOT, [accept]);
    return { start, accept };
  }

  #makeCharSet(chars: string[]): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    for (const ch of chars) {
      const targets = start.transitions.get(ch) ?? [];
      targets.push(accept);
      start.transitions.set(ch, targets);
    }
    return { start, accept };
  }

  #makeConcatenation(a: NFAFragment, b: NFAFragment): NFAFragment {
    a.accept.epsilons.push(b.start);
    return { start: a.start, accept: b.accept };
  }

  #makeAlternation(a: NFAFragment, b: NFAFragment): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    start.epsilons.push(a.start, b.start);
    a.accept.epsilons.push(accept);
    b.accept.epsilons.push(accept);
    return { start, accept };
  }

  #makeStar(a: NFAFragment): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    start.epsilons.push(a.start, accept);
    a.accept.epsilons.push(a.start, accept);
    return { start, accept };
  }

  #makePlus(a: NFAFragment): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    start.epsilons.push(a.start);
    a.accept.epsilons.push(a.start, accept);
    return { start, accept };
  }

  #makeQuestion(a: NFAFragment): NFAFragment {
    const start = this.#createState();
    const accept = this.#createState();
    start.epsilons.push(a.start, accept);
    a.accept.epsilons.push(accept);
    return { start, accept };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new RegexEngine with the given pattern. */
export function createRegexEngine(pattern: string): RegexEngine {
  return new RegexEngine(pattern);
}
