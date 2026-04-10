// @ts-check
// ─── 1D Cellular Automata (Wolfram Rules) ────────────────────────────────────
// Implements elementary 1D cellular automata using Wolfram's rule numbering
// system (rules 0-255). Each cell is either 0 (dead) or 1 (alive) and the
// next state is determined by the cell and its two immediate neighbours.

// ─── CellularAutomaton1D ──────────────────────────────────────────────────────

export class CellularAutomaton1D {
  readonly #rule: number;
  readonly #width: number;
  readonly #wrap: boolean;
  #state: number[];
  #generation: number;

  /** Precomputed rule table: index is the 3-bit neighbourhood (left, center, right). */
  readonly #ruleTable: boolean[];

  constructor(rule: number, width: number, wrap: boolean = true) {
    if (rule < 0 || rule > 255 || !Number.isInteger(rule)) {
      throw new RangeError(`Rule must be an integer 0-255, got ${rule}`);
    }
    if (width < 1) {
      throw new RangeError('Width must be at least 1');
    }
    this.#rule = rule;
    this.#width = width;
    this.#wrap = wrap;
    this.#generation = 0;

    // Build the 8-entry lookup table from the rule number.
    // Bit i of the rule byte gives the output for pattern i (0b111 = 7 down to 0b000 = 0).
    this.#ruleTable = Array.from({ length: 8 }, (_, i) => ((rule >> i) & 1) === 1);

    // Default state: all zeros
    this.#state = new Array<number>(width).fill(0);
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  get state(): number[] {
    return [...this.#state];
  }

  get width(): number {
    return this.#width;
  }

  get generation(): number {
    return this.#generation;
  }

  get rule(): number {
    return this.#rule;
  }

  // ─── State Management ─────────────────────────────────────────────────────

  /** Set the current state. Array is truncated or zero-padded to match width. */
  setState(state: number[]): void {
    this.#state = Array.from({ length: this.#width }, (_, i) =>
      i < state.length ? (state[i] ? 1 : 0) : 0,
    );
    this.#generation = 0;
  }

  // ─── Evolution ────────────────────────────────────────────────────────────

  /** Advance one generation in-place. */
  step(): void {
    const next = new Array<number>(this.#width).fill(0);
    for (let i = 0; i < this.#width; i++) {
      const left = this.#cellAt(i - 1);
      const center = this.#state[i];
      const right = this.#cellAt(i + 1);
      const pattern = (left << 2) | (center << 1) | right;
      next[i] = this.#ruleTable[pattern] ? 1 : 0;
    }
    this.#state = next;
    this.#generation++;
  }

  /**
   * Run n generations, returning the history as an array of states.
   * The first element is the state before any steps (generation 0 snapshot),
   * followed by the state after each step.
   */
  run(n: number): number[][] {
    const history: number[][] = [this.state];
    for (let i = 0; i < n; i++) {
      this.step();
      history.push(this.state);
    }
    return history;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  #cellAt(index: number): number {
    if (this.#wrap) {
      return this.#state[((index % this.#width) + this.#width) % this.#width];
    }
    if (index < 0 || index >= this.#width) return 0;
    return this.#state[index];
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a 1D cellular automaton whose initial state is a single live cell
 * in the centre of a row of `width` dead cells.
 */
export function singleCenterAutomaton(rule: number, width: number): CellularAutomaton1D {
  const ca = new CellularAutomaton1D(rule, width, false);
  const initial = new Array<number>(width).fill(0);
  initial[Math.floor(width / 2)] = 1;
  ca.setState(initial);
  return ca;
}

// ─── Well-Known Rules ─────────────────────────────────────────────────────────

/** Wolfram rule constants. */
export const RULES = {
  /** Chaotic rule; used as a pseudo-random number generator. */
  RULE_30: 30,
  /** Produces a Sierpinski triangle pattern. */
  RULE_90: 90,
  /** Proven Turing-complete rule. */
  RULE_110: 110,
  /** Models one-dimensional traffic flow. */
  RULE_184: 184,
} as const;
