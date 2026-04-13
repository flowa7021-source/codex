// ─── Unit Tests: 1D Cellular Automata ────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CellularAutomaton1D,
  singleCenterAutomaton,
  RULES,
} from '../../app/modules/cellular-automata.js';

// ─── Construction ─────────────────────────────────────────────────────────────

describe('CellularAutomaton1D – construction', () => {
  it('stores rule, width, generation', () => {
    const ca = new CellularAutomaton1D(30, 11);
    assert.equal(ca.rule, 30);
    assert.equal(ca.width, 11);
    assert.equal(ca.generation, 0);
  });

  it('initial state is all zeros', () => {
    const ca = new CellularAutomaton1D(90, 7);
    assert.deepEqual(ca.state, [0, 0, 0, 0, 0, 0, 0]);
  });

  it('throws for out-of-range rule', () => {
    assert.throws(() => new CellularAutomaton1D(-1, 10), RangeError);
    assert.throws(() => new CellularAutomaton1D(256, 10), RangeError);
  });

  it('throws for width < 1', () => {
    assert.throws(() => new CellularAutomaton1D(30, 0), RangeError);
  });
});

// ─── setState ─────────────────────────────────────────────────────────────────

describe('CellularAutomaton1D – setState', () => {
  it('sets state and resets generation to 0', () => {
    const ca = new CellularAutomaton1D(30, 5);
    ca.setState([1, 0, 1, 0, 1]);
    assert.deepEqual(ca.state, [1, 0, 1, 0, 1]);
    assert.equal(ca.generation, 0);
  });

  it('pads with zeros if input is shorter than width', () => {
    const ca = new CellularAutomaton1D(30, 7);
    ca.setState([1, 1]);
    assert.deepEqual(ca.state, [1, 1, 0, 0, 0, 0, 0]);
  });

  it('truncates if input is longer than width', () => {
    const ca = new CellularAutomaton1D(30, 3);
    ca.setState([1, 0, 1, 1, 1]);
    assert.deepEqual(ca.state, [1, 0, 1]);
  });

  it('state getter returns a copy, not the internal array', () => {
    const ca = new CellularAutomaton1D(30, 3);
    ca.setState([1, 0, 1]);
    const s = ca.state;
    s[0] = 0;
    assert.equal(ca.state[0], 1); // internal state unchanged
  });
});

// ─── step() / generation ──────────────────────────────────────────────────────

describe('CellularAutomaton1D – step', () => {
  it('increments generation on each step', () => {
    const ca = new CellularAutomaton1D(90, 5);
    ca.step();
    assert.equal(ca.generation, 1);
    ca.step();
    assert.equal(ca.generation, 2);
  });

  it('rule 0 produces all-zeros from any state', () => {
    // Rule 0: every neighbourhood maps to 0
    const ca = new CellularAutomaton1D(0, 7);
    ca.setState([1, 1, 1, 0, 1, 1, 1]);
    ca.step();
    assert.deepEqual(ca.state, [0, 0, 0, 0, 0, 0, 0]);
  });

  it('rule 255 produces all-ones from any state', () => {
    // Rule 255: every neighbourhood maps to 1
    const ca = new CellularAutomaton1D(255, 7);
    ca.setState([0, 0, 1, 0, 0, 0, 0]);
    ca.step();
    assert.deepEqual(ca.state, [1, 1, 1, 1, 1, 1, 1]);
  });
});

// ─── run() ────────────────────────────────────────────────────────────────────

describe('CellularAutomaton1D – run', () => {
  it('run(n) returns n+1 rows (initial + n steps)', () => {
    const ca = singleCenterAutomaton(RULES.RULE_90, 9);
    const history = ca.run(5);
    assert.equal(history.length, 6); // gen 0 through gen 5
  });

  it('first row equals state before run started', () => {
    const ca = singleCenterAutomaton(RULES.RULE_90, 9);
    const initial = ca.state;
    const history = ca.run(3);
    assert.deepEqual(history[0], initial);
  });

  it('run(0) returns just the current state', () => {
    const ca = singleCenterAutomaton(RULES.RULE_30, 11);
    const history = ca.run(0);
    assert.equal(history.length, 1);
    assert.deepEqual(history[0], ca.state);
  });

  it('generation counter advances by n after run(n)', () => {
    const ca = singleCenterAutomaton(RULES.RULE_110, 11);
    ca.run(7);
    assert.equal(ca.generation, 7);
  });
});

// ─── Rule 30 ──────────────────────────────────────────────────────────────────

describe('CellularAutomaton1D – Rule 30 (chaotic)', () => {
  // Rule 30 from a single centre cell on width=11 (no wrap):
  // gen 0: 00000100000   (centre index 5)
  // gen 1: 00001110000   (Wolfram's known output)
  // gen 2: 00011001000
  // gen 3: 00110111100
  it('gen 0 is a single centre cell', () => {
    const ca = singleCenterAutomaton(RULES.RULE_30, 11);
    const expected = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    assert.deepEqual(ca.state, expected);
  });

  it('gen 1 matches rule-30 computation', () => {
    const ca = singleCenterAutomaton(RULES.RULE_30, 11);
    ca.step();
    // Pattern for rule 30 from centre cell:
    // neighbours of centre = (0,1,0) → pattern 2 → bit 2 of 30 = (30>>2)&1 = 1 ✓
    // cell to the left of centre = (0,0,1) → pattern 1 → bit 1 of 30 = (30>>1)&1 = 1 ✓
    // cell to the right of centre = (1,0,0) → pattern 4 → bit 4 of 30 = (30>>4)&1 = 1 ✓
    const expected = [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0];
    assert.deepEqual(ca.state, expected);
  });

  it('gen 2 is correct', () => {
    const ca = singleCenterAutomaton(RULES.RULE_30, 11);
    ca.step(); // gen1
    ca.step(); // gen2
    // gen2 from known Rule 30 evolution:
    // 0 0 0 1 1 0 0 1 0 0 0
    const expected = [0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0];
    assert.deepEqual(ca.state, expected);
  });
});

// ─── Rule 90 (Sierpinski) ─────────────────────────────────────────────────────

describe('CellularAutomaton1D – Rule 90 (Sierpinski)', () => {
  it('gen 0 is a single centre cell', () => {
    const ca = singleCenterAutomaton(RULES.RULE_90, 9);
    const expected = [0, 0, 0, 0, 1, 0, 0, 0, 0];
    assert.deepEqual(ca.state, expected);
  });

  it('rule 90 produces symmetric patterns from a single centre cell', () => {
    const ca = singleCenterAutomaton(RULES.RULE_90, 11);
    // Run several generations and check each row is palindromic
    const history = ca.run(5);
    for (const row of history) {
      const reversed = [...row].reverse();
      assert.deepEqual(row, reversed, `Row ${JSON.stringify(row)} should be symmetric`);
    }
  });

  it('gen 1 is XOR of neighbours: cells at centre±1', () => {
    const ca = singleCenterAutomaton(RULES.RULE_90, 9);
    ca.step();
    const state = ca.state;
    // centre is index 4; after one step from single centre, the two cells
    // adjacent to centre become 1, centre itself becomes 0
    assert.equal(state[3], 1);
    assert.equal(state[4], 0);
    assert.equal(state[5], 1);
  });
});

// ─── singleCenterAutomaton ────────────────────────────────────────────────────

describe('singleCenterAutomaton', () => {
  it('places a single 1 at the centre', () => {
    const ca = singleCenterAutomaton(30, 7);
    assert.equal(ca.state[3], 1);
    assert.equal(ca.state.filter(x => x === 1).length, 1);
  });

  it('odd width: centre is at Math.floor(width/2)', () => {
    const ca = singleCenterAutomaton(30, 9);
    assert.equal(ca.state[4], 1);
  });

  it('even width: centre is at Math.floor(width/2)', () => {
    const ca = singleCenterAutomaton(30, 10);
    assert.equal(ca.state[5], 1);
  });

  it('generation starts at 0', () => {
    const ca = singleCenterAutomaton(90, 11);
    assert.equal(ca.generation, 0);
  });
});

// ─── RULES constants ──────────────────────────────────────────────────────────

describe('RULES', () => {
  it('RULE_30 is 30', () => assert.equal(RULES.RULE_30, 30));
  it('RULE_90 is 90', () => assert.equal(RULES.RULE_90, 90));
  it('RULE_110 is 110', () => assert.equal(RULES.RULE_110, 110));
  it('RULE_184 is 184', () => assert.equal(RULES.RULE_184, 184));
});

// ─── Wrapping vs No-wrap ──────────────────────────────────────────────────────

describe('CellularAutomaton1D – wrap boundary', () => {
  it('no-wrap: leftmost cell sees a dead cell on the left', () => {
    // Rule 254: pattern 000 → 0, all others → 1
    // Without wrap, the leftmost cell has an implicit 0 on its left.
    // With state [1,0,0,...], left cell neighbourhood is (0,1,0) → pattern 2 → bit 2 of 254 = 1
    const ca = new CellularAutomaton1D(254, 5, false);
    ca.setState([1, 0, 0, 0, 0]);
    ca.step();
    // (0,1,0) = 2 → (254>>2)&1 = 1 → leftmost should be 1
    assert.equal(ca.state[0], 1);
  });

  it('wrap: last cell wraps to first', () => {
    // Rule 90 (XOR of neighbours). With wrap on [0,0,0,0,1]:
    // last cell (index 4): left=state[3]=0, self=1, right=state[0]=0
    // neighbourhood (0,1,0) → pattern 2 → (90>>2)&1 = (22)&1 = ... let's compute:
    // 90 = 0101 1010. bit 2 = 1 (0-indexed from LSB).  → next[4] = 1? No wait:
    // actually 90 >> 2 = 22, 22 & 1 = 0. So next[4] = 0.
    // left neighbour of 4 (index 3): left=state[2]=0, self=0, right=state[4]=1
    // pattern (0,0,1) = 1 → (90>>1)&1 = 45&1 = 1 → next[3] = 1
    // right neighbour of 4 (index 0 via wrap): left=state[4]=1, self=0, right=state[1]=0
    // pattern (1,0,0) = 4 → (90>>4)&1 = 5&1 = 1 → next[0] = 1
    const ca = new CellularAutomaton1D(90, 5, true);
    ca.setState([0, 0, 0, 0, 1]);
    ca.step();
    // next[0] should be 1 (via wrap), next[3] should be 1
    assert.equal(ca.state[0], 1);
    assert.equal(ca.state[3], 1);
    // next[4] should be 0 (centre of (0,1,0) under rule 90)
    assert.equal(ca.state[4], 0);
  });
});
