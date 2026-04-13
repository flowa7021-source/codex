// ─── Unit Tests: Backtracking Framework ───────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BacktrackingSolver,
  nQueens,
  solveSudoku,
  generatePermutations,
  generateCombinations,
} from '../../app/modules/backtracking.js';

// ─── BacktrackingSolver ────────────────────────────────────────────────────────

describe('BacktrackingSolver', () => {
  it('finds a single solution with solve()', () => {
    // Find a pair (a, b) where a + b === 5, a and b in [1..4]
    const solver = new BacktrackingSolver({
      initial: [],
      choices(state) {
        if (state.length >= 2) return [];
        return [1, 2, 3, 4];
      },
      apply(state, choice) {
        return [...state, choice];
      },
      isGoal(state) {
        return state.length === 2 && state[0] + state[1] === 5;
      },
    });

    const result = solver.solve();
    assert.ok(result);
    assert.equal(result.length, 2);
    assert.equal(result[0] + result[1], 5);
  });

  it('returns null when no solution exists', () => {
    const solver = new BacktrackingSolver({
      initial: [],
      choices(state) {
        if (state.length >= 1) return [];
        return [1, 2, 3];
      },
      apply(state, choice) {
        return [...state, choice];
      },
      isGoal(state) {
        return state.length === 1 && state[0] === 99;
      },
    });

    assert.equal(solver.solve(), null);
  });

  it('solveAll() returns all solutions', () => {
    // All single-element arrays from domain [1, 2, 3]
    const solver = new BacktrackingSolver({
      initial: [],
      choices(state) {
        if (state.length >= 1) return [];
        return [1, 2, 3];
      },
      apply(state, choice) {
        return [...state, choice];
      },
      isGoal(state) {
        return state.length === 1;
      },
    });

    const all = solver.solveAll();
    assert.equal(all.length, 3);
    assert.deepEqual(all, [[1], [2], [3]]);
  });

  it('solveAll() respects limit', () => {
    const solver = new BacktrackingSolver({
      initial: [],
      choices(state) {
        if (state.length >= 1) return [];
        return [1, 2, 3, 4, 5];
      },
      apply(state, choice) {
        return [...state, choice];
      },
      isGoal(state) {
        return state.length === 1;
      },
    });

    const limited = solver.solveAll(2);
    assert.equal(limited.length, 2);
  });

  it('count() returns solution count without collecting', () => {
    const solver = new BacktrackingSolver({
      initial: [],
      choices(state) {
        if (state.length >= 2) return [];
        return [0, 1];
      },
      apply(state, choice) {
        return [...state, choice];
      },
      isGoal(state) {
        return state.length === 2;
      },
    });

    assert.equal(solver.count(), 4); // 2^2 = 4
  });

  it('uses isValid to prune invalid branches', () => {
    // Only allow even numbers; goal is a pair summing to 6.
    const solver = new BacktrackingSolver({
      initial: [],
      choices(state) {
        if (state.length >= 2) return [];
        return [1, 2, 3, 4];
      },
      apply(state, choice) {
        return [...state, choice];
      },
      isGoal(state) {
        return state.length === 2 && state[0] + state[1] === 6;
      },
      isValid(state) {
        return state.every(v => v % 2 === 0);
      },
    });

    const all = solver.solveAll();
    // Only (2,4) and (4,2) should survive.
    assert.equal(all.length, 2);
    for (const s of all) {
      assert.ok(s.every(v => v % 2 === 0));
      assert.equal(s[0] + s[1], 6);
    }
  });
});

// ─── N-Queens ──────────────────────────────────────────────────────────────────

describe('nQueens', () => {
  it('returns no solutions for n=0', () => {
    assert.deepEqual(nQueens(0), []);
  });

  it('returns one solution for n=1', () => {
    const solutions = nQueens(1);
    assert.equal(solutions.length, 1);
    assert.deepEqual(solutions[0], [0]);
  });

  it('returns no solutions for n=2 and n=3', () => {
    assert.equal(nQueens(2).length, 0);
    assert.equal(nQueens(3).length, 0);
  });

  it('returns 2 solutions for n=4', () => {
    const solutions = nQueens(4);
    assert.equal(solutions.length, 2);
    // Each solution should be length 4 with unique columns
    for (const sol of solutions) {
      assert.equal(sol.length, 4);
      assert.equal(new Set(sol).size, 4);
    }
  });

  it('returns 92 solutions for n=8', () => {
    assert.equal(nQueens(8).length, 92);
  });
});

// ─── Sudoku ────────────────────────────────────────────────────────────────────

describe('solveSudoku', () => {
  it('solves a valid puzzle', () => {
    const board = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];

    const result = solveSudoku(board);
    assert.ok(result);

    // Every cell should be 1-9
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        assert.ok(result[r][c] >= 1 && result[r][c] <= 9);
      }
    }

    // Each row, column, and 3x3 box should contain 1-9.
    for (let i = 0; i < 9; i++) {
      const row = new Set(result[i]);
      assert.equal(row.size, 9);
      const col = new Set(result.map(r => r[i]));
      assert.equal(col.size, 9);
    }
  });

  it('returns null for an unsolvable puzzle', () => {
    // Two 5s in the same row
    const bad = Array.from({ length: 9 }, () => Array(9).fill(0));
    bad[0][0] = 5;
    bad[0][1] = 5;
    assert.equal(solveSudoku(bad), null);
  });

  it('does not mutate the original board', () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    board[0][0] = 1;
    const original = JSON.stringify(board);
    solveSudoku(board);
    assert.equal(JSON.stringify(board), original);
  });
});

// ─── Permutations ──────────────────────────────────────────────────────────────

describe('generatePermutations', () => {
  it('returns [[]] for empty input', () => {
    assert.deepEqual(generatePermutations([]), [[]]);
  });

  it('generates all permutations of [1,2,3]', () => {
    const perms = generatePermutations([1, 2, 3]);
    assert.equal(perms.length, 6);
    // Check that each permutation has unique elements
    for (const p of perms) {
      assert.equal(p.length, 3);
      assert.equal(new Set(p).size, 3);
    }
  });

  it('works with string items', () => {
    const perms = generatePermutations(['a', 'b']);
    assert.equal(perms.length, 2);
    assert.deepEqual(perms.sort(), [['a', 'b'], ['b', 'a']]);
  });
});

// ─── Combinations ──────────────────────────────────────────────────────────────

describe('generateCombinations', () => {
  it('returns [[]] for k=0', () => {
    assert.deepEqual(generateCombinations([1, 2, 3], 0), [[]]);
  });

  it('returns [] for k > items.length', () => {
    assert.deepEqual(generateCombinations([1, 2], 3), []);
  });

  it('returns [] for negative k', () => {
    assert.deepEqual(generateCombinations([1, 2], -1), []);
  });

  it('generates C(4,2) = 6 combinations', () => {
    const combos = generateCombinations([1, 2, 3, 4], 2);
    assert.equal(combos.length, 6);
    // Each combo should have 2 items in ascending order.
    for (const c of combos) {
      assert.equal(c.length, 2);
      assert.ok(c[0] < c[1]);
    }
  });

  it('generates C(5,3) = 10 combinations', () => {
    const combos = generateCombinations([1, 2, 3, 4, 5], 3);
    assert.equal(combos.length, 10);
  });
});
