// ─── Unit Tests: Constraint Satisfaction Problem Solver ───────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CSPSolver,
  createCSPSolver,
} from '../../app/modules/constraint-solver.js';

// ─── CSPSolver basics ──────────────────────────────────────────────────────────

describe('CSPSolver — basics', () => {
  it('starts with 0 variables and 0 constraints', () => {
    const solver = new CSPSolver();
    assert.equal(solver.variableCount, 0);
    assert.equal(solver.constraintCount, 0);
  });

  it('tracks variable and constraint counts', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2, 3]);
    solver.addVariable('y', [4, 5]);
    assert.equal(solver.variableCount, 2);
    solver.addConstraint(['x', 'y'], () => true);
    assert.equal(solver.constraintCount, 1);
  });

  it('returns null from solve() when no solution exists', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2]);
    solver.addConstraint(['x'], (a) => a.get('x') === 99);
    assert.equal(solver.solve(), null);
  });

  it('solve() returns a Map', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [42]);
    const result = solver.solve();
    assert.ok(result instanceof Map);
    assert.equal(result.get('x'), 42);
  });
});

// ─── Simple two-variable problems ──────────────────────────────────────────────

describe('CSPSolver — two variables', () => {
  it('finds x + y === 5', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2, 3, 4]);
    solver.addVariable('y', [1, 2, 3, 4]);
    solver.addConstraint(['x', 'y'], (a) => a.get('x') + a.get('y') === 5);

    const result = solver.solve();
    assert.ok(result);
    assert.equal(result.get('x') + result.get('y'), 5);
  });

  it('solveAll() returns all matching pairs', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2, 3]);
    solver.addVariable('y', [1, 2, 3]);
    solver.addConstraint(['x', 'y'], (a) => a.get('x') + a.get('y') === 4);

    const all = solver.solveAll();
    // (1,3), (2,2), (3,1)
    assert.equal(all.length, 3);
    for (const sol of all) {
      assert.equal(sol.get('x') + sol.get('y'), 4);
    }
  });

  it('solveAll() respects limit', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2, 3, 4, 5]);
    solver.addVariable('y', [1, 2, 3, 4, 5]);
    // Every assignment is a solution (no constraints).
    const limited = solver.solveAll(3);
    assert.equal(limited.length, 3);
  });

  it('enforces x !== y', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2]);
    solver.addVariable('y', [1, 2]);
    solver.addConstraint(['x', 'y'], (a) => a.get('x') !== a.get('y'));

    const all = solver.solveAll();
    assert.equal(all.length, 2);
    for (const sol of all) {
      assert.notEqual(sol.get('x'), sol.get('y'));
    }
  });
});

// ─── Multiple constraints ──────────────────────────────────────────────────────

describe('CSPSolver — multiple constraints', () => {
  it('applies all constraints simultaneously', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [1, 2, 3, 4, 5]);
    solver.addVariable('y', [1, 2, 3, 4, 5]);
    solver.addConstraint(['x'], (a) => a.get('x') % 2 === 0); // x is even
    solver.addConstraint(['y'], (a) => a.get('y') % 2 === 1); // y is odd
    solver.addConstraint(['x', 'y'], (a) => a.get('x') + a.get('y') === 5);

    const all = solver.solveAll();
    // x even, y odd, sum 5 → (2,3) (4,1)
    assert.equal(all.length, 2);
    for (const sol of all) {
      assert.equal(sol.get('x') % 2, 0);
      assert.equal(sol.get('y') % 2, 1);
      assert.equal(sol.get('x') + sol.get('y'), 5);
    }
  });
});

// ─── Graph colouring ───────────────────────────────────────────────────────────

describe('CSPSolver — graph colouring', () => {
  it('colours a triangle with 3 colours', () => {
    const solver = new CSPSolver();
    const colours = ['red', 'green', 'blue'];
    solver.addVariable('A', colours);
    solver.addVariable('B', colours);
    solver.addVariable('C', colours);

    // Triangle: all pairs must differ.
    solver.addConstraint(['A', 'B'], (a) => a.get('A') !== a.get('B'));
    solver.addConstraint(['B', 'C'], (a) => a.get('B') !== a.get('C'));
    solver.addConstraint(['A', 'C'], (a) => a.get('A') !== a.get('C'));

    const all = solver.solveAll();
    // 3 colours, triangle: 3! = 6 solutions
    assert.equal(all.length, 6);
    for (const sol of all) {
      assert.notEqual(sol.get('A'), sol.get('B'));
      assert.notEqual(sol.get('B'), sol.get('C'));
      assert.notEqual(sol.get('A'), sol.get('C'));
    }
  });

  it('returns null for a triangle with only 2 colours', () => {
    const solver = new CSPSolver();
    solver.addVariable('A', [0, 1]);
    solver.addVariable('B', [0, 1]);
    solver.addVariable('C', [0, 1]);
    solver.addConstraint(['A', 'B'], (a) => a.get('A') !== a.get('B'));
    solver.addConstraint(['B', 'C'], (a) => a.get('B') !== a.get('C'));
    solver.addConstraint(['A', 'C'], (a) => a.get('A') !== a.get('C'));

    assert.equal(solver.solve(), null);
  });
});

// ─── createCSPSolver factory ───────────────────────────────────────────────────

describe('createCSPSolver', () => {
  it('returns a CSPSolver instance', () => {
    const solver = createCSPSolver();
    assert.ok(solver instanceof CSPSolver);
  });

  it('works end-to-end via factory', () => {
    const solver = createCSPSolver();
    solver.addVariable('n', [1, 2, 3]);
    solver.addConstraint(['n'], (a) => a.get('n') > 1);

    const all = solver.solveAll();
    assert.equal(all.length, 2); // n=2, n=3
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('CSPSolver — edge cases', () => {
  it('handles single variable with single domain value', () => {
    const solver = new CSPSolver();
    solver.addVariable('x', [7]);
    const result = solver.solve();
    assert.ok(result);
    assert.equal(result.get('x'), 7);
  });

  it('handles no constraints — all combos are solutions', () => {
    const solver = new CSPSolver();
    solver.addVariable('a', [1, 2]);
    solver.addVariable('b', [3, 4]);
    const all = solver.solveAll();
    assert.equal(all.length, 4); // 2 × 2
  });
});
