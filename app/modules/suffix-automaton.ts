// @ts-check
// ─── Suffix Automaton (DAWG) ─────────────────────────────────────────────────
// Builds a Directed Acyclic Word Graph from a string in O(n) time and space.
// Supports substring containment, occurrence counting, longest common substring,
// and enumeration of all distinct substrings.

// ─── Internal State Node ─────────────────────────────────────────────────────

interface SAMState {
  /** Length of the longest string in this equivalence class. */
  len: number;
  /** Suffix link — points to the state representing the longest proper suffix
   *  of this state's endpos class. */
  link: number;
  /** Transition function: character → state index. */
  next: Map<string, number>;
  /** Number of times the substrings in this state appear in the text.
   *  Computed after the automaton is fully built. */
  cnt: number;
}

function createState(len: number): SAMState {
  return { len, link: -1, next: new Map(), cnt: 0 };
}

// ─── SuffixAutomaton ─────────────────────────────────────────────────────────

export class SuffixAutomaton {
  readonly #text: string;
  readonly #states: SAMState[];
  readonly #stateCount: number;

  constructor(text: string) {
    this.#text = text;

    if (text.length === 0) {
      // Automaton with a single initial state and no transitions.
      const initial = createState(0);
      initial.link = -1;
      this.#states = [initial];
      this.#stateCount = 1;
      return;
    }

    // ── Build the automaton ──────────────────────────────────────────────────
    // Pre-allocate: SAM has at most 2n − 1 states.
    const maxStates = 2 * text.length;
    const states: SAMState[] = [];

    // State 0 is the initial state.
    states.push(createState(0)); // index 0
    let last = 0;

    for (const ch of text) {
      // Create a new state for the current prefix.
      const cur = states.length;
      states.push(createState(states[last].len + 1));
      states[cur].cnt = 1; // this state is reached by exactly one new suffix

      let p = last;

      // Walk up suffix links until we find a state that already has a
      // transition on `ch`, or we reach the initial state's parent (−1).
      while (p !== -1 && !states[p].next.has(ch)) {
        states[p].next.set(ch, cur);
        p = states[p].link;
      }

      if (p === -1) {
        // No state had a transition on `ch` — link to the initial state.
        states[cur].link = 0;
      } else {
        const q = states[p].next.get(ch)!;
        if (states[p].len + 1 === states[q].len) {
          // `q` is already the right suffix link for `cur`.
          states[cur].link = q;
        } else {
          // Clone `q` into a new state `clone` with a shorter length.
          const clone = states.length;
          states.push({
            len: states[p].len + 1,
            link: states[q].link,
            next: new Map(states[q].next),
            cnt: 0, // clone does not represent an additional occurrence
          });
          // Re-wire `q` and `cur` to the clone.
          states[q].link = clone;
          states[cur].link = clone;
          // Redirect transitions from `p` upward that pointed to `q`.
          while (p !== -1 && states[p].next.get(ch) === q) {
            states[p].next.set(ch, clone);
            p = states[p].link;
          }
        }
      }

      last = cur;
    }

    // ── Compute occurrence counts via topological sort ───────────────────────
    // Sort states by their `len` in descending order (longer first), then
    // propagate cnt up via suffix links.
    const sorted = states
      .map((_, i) => i)
      .sort((a, b) => states[b].len - states[a].len);

    for (const v of sorted) {
      const lnk = states[v].link;
      if (lnk !== -1) {
        states[lnk].cnt += states[v].cnt;
      }
    }

    this.#states = states;
    this.#stateCount = states.length;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Returns `true` if `pattern` is a substring of the text.
   *  An empty pattern is always a substring of any text. */
  contains(pattern: string): boolean {
    if (pattern.length === 0) return true;
    let cur = 0;
    for (const ch of pattern) {
      const next = this.#states[cur].next.get(ch);
      if (next === undefined) return false;
      cur = next;
    }
    return true;
  }

  /** Returns the number of times `pattern` appears in the text. */
  countOccurrences(pattern: string): number {
    if (pattern.length === 0) {
      // The empty string occurs (text.length + 1) times by convention
      // (at every position including after the last character).
      return this.#text.length + 1;
    }
    let cur = 0;
    for (const ch of pattern) {
      const next = this.#states[cur].next.get(ch);
      if (next === undefined) return 0;
      cur = next;
    }
    return this.#states[cur].cnt;
  }

  /** Returns the longest string that is a substring of both `this.text`
   *  and `other`. */
  longestCommonSubstring(other: string): string {
    if (this.#text.length === 0 || other.length === 0) return '';

    const states = this.#states;
    let cur = 0;  // current state in this automaton
    let len = 0;  // current match length

    let bestLen = 0;
    let bestEnd = 0; // end index (exclusive) in `other`

    for (let i = 0; i < other.length; i++) {
      const ch = other[i];

      // Shrink via suffix links until we can extend with `ch` or reach root.
      while (cur !== 0 && !states[cur].next.has(ch)) {
        cur = states[cur].link;
        len = states[cur].len;
      }

      if (states[cur].next.has(ch)) {
        cur = states[cur].next.get(ch)!;
        len++;
      }
      // else: cur === 0 and root has no `ch` transition → len stays 0

      if (len > bestLen) {
        bestLen = len;
        bestEnd = i + 1;
      }
    }

    return other.slice(bestEnd - bestLen, bestEnd);
  }

  /** Returns a `Set` containing every distinct substring of the text,
   *  including the empty string. */
  allSubstrings(): Set<string> {
    const result = new Set<string>();
    result.add(''); // empty string is always a substring

    if (this.#text.length === 0) return result;

    // DFS/BFS over automaton states, reconstructing substrings.
    // We store [stateIndex, substringSoFar] pairs.
    const stack: [number, string][] = [[0, '']];

    while (stack.length > 0) {
      const [stateIdx, prefix] = stack.pop()!;
      const state = this.#states[stateIdx];

      for (const [ch, nextIdx] of state.next) {
        const sub = prefix + ch;
        if (!result.has(sub)) {
          result.add(sub);
          stack.push([nextIdx, sub]);
        }
      }
    }

    return result;
  }

  /** The original text used to build this automaton. */
  get text(): string {
    return this.#text;
  }

  /** Number of states in the automaton. */
  get stateCount(): number {
    return this.#stateCount;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new `SuffixAutomaton` for the given text. */
export function createSuffixAutomaton(text: string): SuffixAutomaton {
  return new SuffixAutomaton(text);
}
