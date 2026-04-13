// ─── Unit Tests: Finite Automata ─────────────────────────────────────────────
// Covers: DFA (legacy DFAOptions API), DFA (new DFAConfig API), NFA, nfaToDfa
//
// Legacy DFA: accepts strings ending in 'ab' over alphabet {a, b, x}
//   q0 --a--> q1
//   q0 --b--> q0   q0 --x--> q0
//   q1 --a--> q1   q1 --b--> q2   q1 --x--> q0
//   q2 --a--> q1   q2 --b--> q0   q2 --x--> q0
//   accepting: q2

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DFA, NFA, nfaToDfa } from '../../app/modules/finite-automaton.js';

// ─── Legacy DFAOptions helpers ────────────────────────────────────────────────

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

// ─── Legacy DFA – accepts() ───────────────────────────────────────────────────

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

// ─── Legacy DFA – run() ──────────────────────────────────────────────────────

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
      transitions: [],
    });
    assert.equal(dfa.run('a'), null);
  });
});

// ─── Legacy DFA – step() ─────────────────────────────────────────────────────

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

// ─── Legacy DFA – acceptingStates() ──────────────────────────────────────────

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

// ─── Legacy DFA – isComplete() ───────────────────────────────────────────────

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

// ─── DFA (DFAConfig) ─────────────────────────────────────────────────────────
// A DFA accepting binary strings divisible by 2 (ending in 0).
// States: even (initial, accepting), odd

describe('DFA via DFAConfig', () => {
  function makeBinaryDivisibleBy2() {
    return new DFA({
      states: ['even', 'odd'],
      alphabet: ['0', '1'],
      transitions: {
        even: { '0': 'even', '1': 'odd' },
        odd:  { '0': 'even', '1': 'odd' },
      },
      initial: 'even',
      accepting: ['even'],
    });
  }

  it('accepts "0"', () => {
    assert.equal(makeBinaryDivisibleBy2().accepts('0'), true);
  });

  it('accepts "10" (binary 2)', () => {
    assert.equal(makeBinaryDivisibleBy2().accepts('10'), true);
  });

  it('accepts "100" (binary 4)', () => {
    assert.equal(makeBinaryDivisibleBy2().accepts('100'), true);
  });

  it('rejects "1"', () => {
    assert.equal(makeBinaryDivisibleBy2().accepts('1'), false);
  });

  it('rejects "11"', () => {
    assert.equal(makeBinaryDivisibleBy2().accepts('11'), false);
  });

  it('accepts "" (empty string: even is initial accepting)', () => {
    assert.equal(makeBinaryDivisibleBy2().accepts(''), true);
  });

  it('step from "even" on "0" -> "even"', () => {
    assert.equal(makeBinaryDivisibleBy2().step('even', '0'), 'even');
  });

  it('step from "even" on "1" -> "odd"', () => {
    assert.equal(makeBinaryDivisibleBy2().step('even', '1'), 'odd');
  });

  it('step returns null for unknown transition', () => {
    assert.equal(makeBinaryDivisibleBy2().step('even', 'x'), null);
  });

  it('run("101") returns "odd"', () => {
    assert.equal(makeBinaryDivisibleBy2().run('101'), 'odd');
  });

  it('run("110") returns "even"', () => {
    assert.equal(makeBinaryDivisibleBy2().run('110'), 'even');
  });
});

// ─── NFA – epsilon transitions ────────────────────────────────────────────────
// NFA accepting "" | "a" | "ab"  (via epsilon transitions)
//   s0 --ε--> s1    s0 --ε--> s3
//   s1 --a--> s2    (s2 accepting)
//   s3 --a--> s4    s4 --b--> s5   (s5 accepting)
//   Also s2 is accepting and s5 is accepting

describe('NFA – epsilonClosure()', () => {
  function makeEpsNfa() {
    return new NFA({
      states: ['s0', 's1', 's2', 's3', 's4', 's5'],
      alphabet: ['a', 'b'],
      transitions: {
        s0: { '': ['s1', 's3'] },
        s1: { a: ['s2'] },
        s3: { a: ['s4'] },
        s4: { b: ['s5'] },
      },
      initial: 's0',
      accepting: ['s2', 's5'],
    });
  }

  it('closure of {s0} includes s0, s1, s3 via epsilon', () => {
    const nfa = makeEpsNfa();
    const cl = nfa.epsilonClosure(new Set(['s0']));
    assert.ok(cl.has('s0'));
    assert.ok(cl.has('s1'));
    assert.ok(cl.has('s3'));
  });

  it('closure of {s2} with no epsilon transitions is just {s2}', () => {
    const nfa = makeEpsNfa();
    const cl = nfa.epsilonClosure(new Set(['s2']));
    assert.deepEqual([...cl].sort(), ['s2']);
  });
});

describe('NFA – accepts() with epsilon transitions', () => {
  function makeEpsNfa() {
    return new NFA({
      states: ['s0', 's1', 's2', 's3', 's4', 's5'],
      alphabet: ['a', 'b'],
      transitions: {
        s0: { '': ['s1', 's3'] },
        s1: { a: ['s2'] },
        s3: { a: ['s4'] },
        s4: { b: ['s5'] },
      },
      initial: 's0',
      accepting: ['s2', 's5'],
    });
  }

  it('accepts "a" (via s0->eps->s1->a->s2)', () => {
    assert.equal(makeEpsNfa().accepts('a'), true);
  });

  it('accepts "ab" (via s0->eps->s3->a->s4->b->s5)', () => {
    assert.equal(makeEpsNfa().accepts('ab'), true);
  });

  it('rejects "b"', () => {
    assert.equal(makeEpsNfa().accepts('b'), false);
  });

  it('rejects "ba"', () => {
    assert.equal(makeEpsNfa().accepts('ba'), false);
  });

  it('rejects "aa"', () => {
    assert.equal(makeEpsNfa().accepts('aa'), false);
  });
});

describe('NFA – accepts() with non-determinism', () => {
  // NFA accepting strings that end in "ab" OR end in "ba" (non-deterministic)
  // States: q0 (initial), qa, qab (accept), qb, qba (accept)
  // q0 --a--> qa   q0 --a--> q0   q0 --b--> q0   q0 --b--> qb
  // qa --b--> qab
  // qb --a--> qba
  function makeNdNfa() {
    return new NFA({
      states: ['q0', 'qa', 'qab', 'qb', 'qba'],
      alphabet: ['a', 'b'],
      transitions: {
        q0: { a: ['qa', 'q0'], b: ['qb', 'q0'] },
        qa: { b: ['qab'] },
        qb: { a: ['qba'] },
      },
      initial: 'q0',
      accepting: ['qab', 'qba'],
    });
  }

  it('accepts "ab"', () => {
    assert.equal(makeNdNfa().accepts('ab'), true);
  });

  it('accepts "ba"', () => {
    assert.equal(makeNdNfa().accepts('ba'), true);
  });

  it('accepts "xab" (ends in ab, extra chars at start)', () => {
    assert.equal(makeNdNfa().accepts('aab'), true);
  });

  it('accepts "bba" (ends in ba)', () => {
    assert.equal(makeNdNfa().accepts('bba'), true);
  });

  it('rejects "a"', () => {
    assert.equal(makeNdNfa().accepts('a'), false);
  });

  it('rejects "b"', () => {
    assert.equal(makeNdNfa().accepts('b'), false);
  });

  it('rejects ""', () => {
    assert.equal(makeNdNfa().accepts(''), false);
  });
});

describe('NFA – move()', () => {
  function makeSimpleNfa() {
    return new NFA({
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      transitions: {
        q0: { a: ['q1', 'q2'] },
        q1: { b: ['q2'] },
      },
      initial: 'q0',
      accepting: ['q2'],
    });
  }

  it('move({q0}, "a") = {q1, q2}', () => {
    const nfa = makeSimpleNfa();
    const result = nfa.move(new Set(['q0']), 'a');
    assert.deepEqual([...result].sort(), ['q1', 'q2']);
  });

  it('move({q0}, "b") = {} (no transitions)', () => {
    const nfa = makeSimpleNfa();
    const result = nfa.move(new Set(['q0']), 'b');
    assert.equal(result.size, 0);
  });

  it('move({q1, q2}, "b") = {q2}', () => {
    const nfa = makeSimpleNfa();
    const result = nfa.move(new Set(['q1', 'q2']), 'b');
    assert.deepEqual([...result].sort(), ['q2']);
  });
});

// ─── nfaToDfa – subset construction ──────────────────────────────────────────

describe('nfaToDfa – converted DFA matches NFA', () => {
  // NFA accepting strings ending in "ab"
  function makeNfaEndsInAb() {
    return /** @type {import('../../app/modules/finite-automaton.js').NFAConfig} */ ({
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      transitions: {
        q0: { a: ['q0', 'q1'], b: ['q0'] },
        q1: { b: ['q2'] },
      },
      initial: 'q0',
      accepting: ['q2'],
    });
  }

  it('converted DFA accepts "ab"', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts('ab'), true);
  });

  it('converted DFA accepts "xab" (represented as "bab")', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts('bab'), true);
  });

  it('converted DFA accepts "aab"', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts('aab'), true);
  });

  it('converted DFA rejects "a"', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts('a'), false);
  });

  it('converted DFA rejects ""', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts(''), false);
  });

  it('converted DFA rejects "ba"', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts('ba'), false);
  });

  it('converted DFA rejects "abx" (ab + b)', () => {
    const dfa = nfaToDfa(makeNfaEndsInAb());
    assert.equal(dfa.accepts('abb'), false);
  });

  it('nfaToDfa results match NFA for several strings', () => {
    const nfaConfig = makeNfaEndsInAb();
    const nfa = new NFA(nfaConfig);
    const dfa = nfaToDfa(nfaConfig);
    const tests = ['', 'a', 'b', 'ab', 'ba', 'aab', 'abb', 'bab', 'abab', 'ababab'];
    for (const s of tests) {
      assert.equal(
        dfa.accepts(s),
        nfa.accepts(s),
        `mismatch for "${s}"`,
      );
    }
  });
});

describe('nfaToDfa – NFA with epsilon transitions', () => {
  // NFA with epsilon: accepts "a" or "ab"
  function makeEpsilonNfaConfig() {
    return /** @type {import('../../app/modules/finite-automaton.js').NFAConfig} */ ({
      states: ['s0', 's1', 's2', 's3', 's4'],
      alphabet: ['a', 'b'],
      transitions: {
        s0: { '': ['s1', 's3'] },
        s1: { a: ['s2'] },
        s3: { a: ['s4'] },
        s4: { b: ['s2'] }, // reuse s2 as single accepting state
      },
      initial: 's0',
      accepting: ['s2'],
    });
  }

  it('converted DFA accepts "a"', () => {
    const dfa = nfaToDfa(makeEpsilonNfaConfig());
    assert.equal(dfa.accepts('a'), true);
  });

  it('converted DFA accepts "ab"', () => {
    const dfa = nfaToDfa(makeEpsilonNfaConfig());
    assert.equal(dfa.accepts('ab'), true);
  });

  it('converted DFA rejects "b"', () => {
    const dfa = nfaToDfa(makeEpsilonNfaConfig());
    assert.equal(dfa.accepts('b'), false);
  });

  it('converted DFA rejects "aa"', () => {
    const dfa = nfaToDfa(makeEpsilonNfaConfig());
    assert.equal(dfa.accepts('aa'), false);
  });

  it('epsilon NFA and derived DFA agree on test strings', () => {
    const nfaConfig = makeEpsilonNfaConfig();
    const nfa = new NFA(nfaConfig);
    const dfa = nfaToDfa(nfaConfig);
    const tests = ['', 'a', 'b', 'ab', 'ba', 'aa', 'bb', 'aba'];
    for (const s of tests) {
      assert.equal(
        dfa.accepts(s),
        nfa.accepts(s),
        `mismatch for "${s}"`,
      );
    }
  });
});
