// @ts-check
// ─── Backtracking Framework ─────────────────────────────────────────────────
// Generic backtracking solver plus common combinatorial helpers: N-Queens,
// Sudoku, permutations, and combinations.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Configuration for the generic backtracking solver. */
export interface BacktrackingConfig<S, C> {
  /** Initial state to begin search from. */
  initial: S;
  /** Generate all possible choices from the current state. */
  choices: (state: S) => C[];
  /** Apply a choice to a state, returning a new state. */
  apply: (state: S, choice: C) => S;
  /** Return true if the state represents a complete solution. */
  isGoal: (state: S) => boolean;
  /** Optional pruning predicate — return false to abandon this branch. */
  isValid?: (state: S) => boolean;
}

// ─── BacktrackingSolver ──────────────────────────────────────────────────────

/**
 * Generic backtracking solver parameterised by state type `S` and choice type `C`.
 */
export class BacktrackingSolver<S, C> {
  private readonly config: BacktrackingConfig<S, C>;

  constructor(config: BacktrackingConfig<S, C>) {
    this.config = config;
  }

  /** Return the first solution found, or `null` if none exists. */
  solve(): S | null {
    const { initial, choices, apply, isGoal, isValid } = this.config;
    const stack: S[] = [initial];

    while (stack.length > 0) {
      const state = stack.pop()!;

      if (isValid && !isValid(state)) continue;
      if (isGoal(state)) return state;

      const cs = choices(state);
      for (let i = cs.length - 1; i >= 0; i--) {
        stack.push(apply(state, cs[i]));
      }
    }

    return null;
  }

  /** Return all solutions, optionally capped at `limit`. */
  solveAll(limit?: number): S[] {
    const { initial, choices, apply, isGoal, isValid } = this.config;
    const solutions: S[] = [];
    const stack: S[] = [initial];

    while (stack.length > 0) {
      if (limit !== undefined && solutions.length >= limit) break;

      const state = stack.pop()!;

      if (isValid && !isValid(state)) continue;
      if (isGoal(state)) {
        solutions.push(state);
        continue;
      }

      const cs = choices(state);
      for (let i = cs.length - 1; i >= 0; i--) {
        stack.push(apply(state, cs[i]));
      }
    }

    return solutions;
  }

  /** Count solutions without collecting them. */
  count(): number {
    const { initial, choices, apply, isGoal, isValid } = this.config;
    let total = 0;
    const stack: S[] = [initial];

    while (stack.length > 0) {
      const state = stack.pop()!;

      if (isValid && !isValid(state)) continue;
      if (isGoal(state)) {
        total++;
        continue;
      }

      const cs = choices(state);
      for (let i = cs.length - 1; i >= 0; i--) {
        stack.push(apply(state, cs[i]));
      }
    }

    return total;
  }
}

// ─── N-Queens ────────────────────────────────────────────────────────────────

/**
 * Return all solutions to the N-Queens problem.
 * Each solution is an array of length `n` where index = row, value = column.
 */
export function nQueens(n: number): number[][] {
  if (n <= 0) return [];

  /** State: partial placement (column per row). */
  type QState = number[];

  function isValidPlacement(cols: number[]): boolean {
    const row = cols.length - 1;
    for (let r = 0; r < row; r++) {
      if (cols[r] === cols[row]) return false;
      if (Math.abs(cols[r] - cols[row]) === row - r) return false;
    }
    return true;
  }

  const solver = new BacktrackingSolver<QState, number>({
    initial: [],
    choices(state) {
      if (state.length >= n) return [];
      const cols: number[] = [];
      for (let c = 0; c < n; c++) cols.push(c);
      return cols;
    },
    apply(state, choice) {
      return [...state, choice];
    },
    isGoal(state) {
      return state.length === n;
    },
    isValid(state) {
      if (state.length === 0) return true;
      return isValidPlacement(state);
    },
  });

  return solver.solveAll();
}

// ─── Sudoku ──────────────────────────────────────────────────────────────────

/**
 * Solve a 9x9 Sudoku board (0 = empty cell).
 * Returns the completed board or `null` if unsolvable.
 */
export function solveSudoku(board: number[][]): number[][] | null {
  // Deep-copy the board.
  type Board = number[][];

  function clone(b: Board): Board {
    return b.map(row => [...row]);
  }

  function findEmpty(b: Board): [number, number] | null {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function canPlace(b: Board, r: number, c: number, v: number): boolean {
    // Row
    for (let j = 0; j < 9; j++) {
      if (b[r][j] === v) return false;
    }
    // Column
    for (let i = 0; i < 9; i++) {
      if (b[i][c] === v) return false;
    }
    // 3x3 box
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = br; i < br + 3; i++) {
      for (let j = bc; j < bc + 3; j++) {
        if (b[i][j] === v) return false;
      }
    }
    return true;
  }

  type SudokuState = { board: Board; pos: [number, number] | null };

  function nextState(b: Board): SudokuState {
    return { board: b, pos: findEmpty(b) };
  }

  const solver = new BacktrackingSolver<SudokuState, number>({
    initial: nextState(clone(board)),
    choices(state) {
      if (!state.pos) return [];
      const [r, c] = state.pos;
      const valid: number[] = [];
      for (let v = 1; v <= 9; v++) {
        if (canPlace(state.board, r, c, v)) valid.push(v);
      }
      return valid;
    },
    apply(state, choice) {
      const b = clone(state.board);
      const [r, c] = state.pos!;
      b[r][c] = choice;
      return nextState(b);
    },
    isGoal(state) {
      return state.pos === null;
    },
  });

  const result = solver.solve();
  return result ? result.board : null;
}

// ─── Permutations ────────────────────────────────────────────────────────────

/** Generate all permutations of `items`. */
export function generatePermutations<T>(items: T[]): T[][] {
  if (items.length === 0) return [[]];

  type PState = { chosen: T[]; remaining: T[] };

  const solver = new BacktrackingSolver<PState, number>({
    initial: { chosen: [], remaining: [...items] },
    choices(state) {
      const indices: number[] = [];
      for (let i = 0; i < state.remaining.length; i++) indices.push(i);
      return indices;
    },
    apply(state, idx) {
      const chosen = [...state.chosen, state.remaining[idx]];
      const remaining = state.remaining.filter((_, i) => i !== idx);
      return { chosen, remaining };
    },
    isGoal(state) {
      return state.remaining.length === 0;
    },
  });

  return solver.solveAll().map(s => s.chosen);
}

// ─── Combinations ────────────────────────────────────────────────────────────

/** Generate all combinations of `k` items from `items`. */
export function generateCombinations<T>(items: T[], k: number): T[][] {
  if (k < 0 || k > items.length) return [];
  if (k === 0) return [[]];

  type CState = { chosen: T[]; startIdx: number };

  const solver = new BacktrackingSolver<CState, number>({
    initial: { chosen: [], startIdx: 0 },
    choices(state) {
      if (state.chosen.length >= k) return [];
      const indices: number[] = [];
      for (let i = state.startIdx; i < items.length; i++) indices.push(i);
      return indices;
    },
    apply(state, idx) {
      return { chosen: [...state.chosen, items[idx]], startIdx: idx + 1 };
    },
    isGoal(state) {
      return state.chosen.length === k;
    },
  });

  return solver.solveAll().map(s => s.chosen);
}
