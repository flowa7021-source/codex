// ─── Unit Tests: DFA ─────────────────────────────────────────────────────────
// Tests a DFA that accepts strings ending in 'ab' over the alphabet {a, b, x}.
//
// States:
//   q0  — start (not accepting)
//   q1  — just saw 'a' (not accepting)
//   q2  — just saw 'ab' (accepting)
//
// Transition table:
//   q0 --a--> q1
//   q0 --b--> q0  (no progress)
//   q0 --x--> q0  (no progress)
//   q1 --a--> q1  (still have trailing 'a')
//   q1 --b--> q2  (complete 'ab')
//   q1 --x--> q0  (reset)
//   q2 --a--> q1  (new potential start)
//   q2 --b--> q0  (lost the 'a')
//   q2 --x--> q0  (reset)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DFA } from '../../app/modules/finite-automaton.js';

// ─── Shared DFA factory ───────────────────────────────────────────────────────

function makeEndsInAb() {
  return new DFA({
    states: [
      { id: 'q0', accepting: false },
      { id: 'q1', accepting: false },
      { id: 'q2', accepting: true  },
    ],
    initial: 'q0',
    transitions: [
      { from: 'q0', symbol: 'a', to: 'q1' },
      { from: 'q0', symbol: 'b', to: 'q0' },
      { from: 'q0', symbol: 'x', to: 'q0' },
      { from: 'q1', symbol: 'a', to: 'q1' },
      { from: 'q1', symbol: 'b', to: 'q2' },
      { from: 'q1', symbol: 'x', to: 'q0' },
      { from: 'q2', symbol: 'a', to: 'q1' },
      { from: 'q2', symbol: 'b', to: 'q0' },
      { from: 'q2', symbol: 'x', to: 'q0' },
    ],
  });
}

// ─── accepts() ───────────────────────────────────────────────────────────────

describe('DFA – accepts()', () => {
  it('accepts "ab"', () => {
    assert.equal(makeEndsInAb().accepts('ab'), true);
  });

  it('accepts "xab"', () => {
    assert.equal(makeEndsInAb().accepts('xab'), true);
  });

  it('accepts "aab"', () => {
    assert.equal(makeEndsInAb().accepts('aab'), true);
  });

  it('accepts "xyzab" (long prefix)', () => {
    assert.equal(makeEndsInAb().accepts('xxab'), true);
  });

  it('rejects "a" (no b at end)', () => {
    assert.equal(makeEndsInAb().accepts('a'), false);
  });

  it('rejects "" (empty string)', () => {
    assert.equal(makeEndsInAb().accepts(''), false);
  });

  it('rejects "ba" (ends in a, not ab)', () => {
    assert.equal(makeEndsInAb().accepts('ba'), false);
  });

  it('rejects "b"', () => {
    assert.equal(makeEndsInAb().accepts('b'), false);
  });

  it('rejects "abx" (ab followed by x)', () => {
    assert.equal(makeEndsInAb().accepts('abx'), false);
  });
});

// ─── run() ───────────────────────────────────────────────────────────────────

describe('DFA – run()', () => {
  it('run("ab") returns the accepting state q2', () => {
    assert.equal(makeEndsInAb().run('ab'), 'q2');
  });

  it('run("a") returns q1', () => {
    assert.equal(makeEndsInAb().run('a'), 'q1');
  });

  it('run("") returns the initial state q0', () => {
    assert.equal(makeEndsInAb().run(''), 'q0');
  });

  it('run("b") returns q0 (no progress on b from start)', () => {
    assert.equal(makeEndsInAb().run('b'), 'q0');
  });

  it('run() returns null when the machine gets stuck', () => {
    const dfa = new DFA({
      states: [{ id: 's0', accepting: false }],
      initial: 's0',
      transitions: [], // no transitions at all
    });
    assert.equal(dfa.run('a'), null);
  });
});

// ─── step() ──────────────────────────────────────────────────────────────────

describe('DFA – step()', () => {
  it('step("q0", "a") -> "q1"', () => {
    assert.equal(makeEndsInAb().step('q0', 'a'), 'q1');
  });

  it('step("q1", "b") -> "q2"', () => {
    assert.equal(makeEndsInAb().step('q1', 'b'), 'q2');
  });

  it('step("q0", "b") -> "q0"', () => {
    assert.equal(makeEndsInAb().step('q0', 'b'), 'q0');
  });

  it('step returns null for an undefined transition', () => {
    const dfa = new DFA({
      states: [{ id: 's0', accepting: false }],
      initial: 's0',
      transitions: [],
    });
    assert.equal(dfa.step('s0', 'z'), null);
  });

  it('step returns null for an unknown state id', () => {
    assert.equal(makeEndsInAb().step('q99', 'a'), null);
  });
});

// ─── acceptingStates() ───────────────────────────────────────────────────────

describe('DFA – acceptingStates()', () => {
  it('returns only the accepting state(s)', () => {
    const result = makeEndsInAb().acceptingStates();
    assert.deepEqual(result, ['q2']);
  });

  it('returns empty array when no accepting states', () => {
    const dfa = new DFA({
      states: [
        { id: 'a', accepting: false },
        { id: 'b', accepting: false },
      ],
      initial: 'a',
      transitions: [],
    });
    assert.deepEqual(dfa.acceptingStates(), []);
  });

  it('returns multiple accepting states', () => {
    const dfa = new DFA({
      states: [
        { id: 'x', accepting: true  },
        { id: 'y', accepting: false },
        { id: 'z', accepting: true  },
      ],
      initial: 'x',
      transitions: [],
    });
    assert.deepEqual(dfa.acceptingStates(), ['x', 'z']);
  });
});

// ─── isComplete() ─────────────────────────────────────────────────────────────

describe('DFA – isComplete()', () => {
  it('returns true when every state has a transition for every alphabet symbol', () => {
    assert.equal(makeEndsInAb().isComplete(['a', 'b', 'x']), true);
  });

  it('returns false when a state is missing a transition for a symbol', () => {
    const dfa = new DFA({
      states: [
        { id: 'q0', accepting: false },
        { id: 'q1', accepting: true  },
      ],
      initial: 'q0',
      transitions: [
        { from: 'q0', symbol: 'a', to: 'q1' },
        // q1 has no transitions at all
      ],
    });
    assert.equal(dfa.isComplete(['a']), false);
  });

  it('returns true for empty alphabet', () => {
    assert.equal(makeEndsInAb().isComplete([]), true);
  });

  it('returns false for a symbol not covered by any transition', () => {
    assert.equal(makeEndsInAb().isComplete(['a', 'b', 'x', 'y']), false);
  });
});
