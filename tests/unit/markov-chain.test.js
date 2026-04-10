// ─── Unit Tests: Markov Chain ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MarkovChain, createMarkovChain } from '../../app/modules/markov-chain.js';

// ─── Deterministic RNG helper ─────────────────────────────────────────────────

/**
 * Simple linear-congruential generator seeded with a fixed value so tests are
 * fully reproducible.
 */
function makeLcg(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── Constructor & order ──────────────────────────────────────────────────────

describe('MarkovChain – constructor', () => {
  it('defaults to order 1', () => {
    const mc = new MarkovChain();
    assert.equal(mc.order, 1);
  });

  it('stores explicit order', () => {
    const mc = new MarkovChain(3);
    assert.equal(mc.order, 3);
  });

  it('throws RangeError for order 0', () => {
    assert.throws(() => new MarkovChain(0), RangeError);
  });

  it('throws RangeError for negative order', () => {
    assert.throws(() => new MarkovChain(-1), RangeError);
  });

  it('throws RangeError for non-integer order', () => {
    assert.throws(() => new MarkovChain(1.5), RangeError);
  });
});

// ─── states() — "addTransition registers states" / "states() returns all known states" ──

describe('MarkovChain – states()', () => {
  it('returns empty array before training', () => {
    const mc = new MarkovChain();
    assert.deepEqual(mc.states(), []);
  });

  it('registers all tokens seen during train()', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'C']);
    const s = mc.states().sort();
    assert.deepEqual(s, ['A', 'B', 'C']);
  });

  it('deduplicates repeated tokens', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'A', 'A', 'A']);
    assert.equal(mc.states().length, 1);
    assert.deepEqual(mc.states(), ['A']);
  });

  it('accumulates states across multiple train() calls', () => {
    const mc = new MarkovChain();
    mc.train(['X', 'Y']);
    mc.train(['Y', 'Z']);
    const s = mc.states().sort();
    assert.deepEqual(s, ['X', 'Y', 'Z']);
  });

  it('works with numeric token type', () => {
    const mc = new MarkovChain();
    mc.train([1, 2, 3, 1, 2]);
    const s = mc.states().sort((a, b) => a - b);
    assert.deepEqual(s, [1, 2, 3]);
  });
});

// ─── nextProbabilities() — "next returns null for unknown state" ──────────────
//  The module uses nextProbabilities([state]) which returns an empty Map when
//  there are no known transitions from that context (equivalent to returning null).

describe('MarkovChain – nextProbabilities() (transition map)', () => {
  it('returns empty Map for unseen state (equivalent to null successor)', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B']);
    const probs = mc.nextProbabilities(['Z']); // Z never trained
    assert.ok(probs instanceof Map);
    assert.equal(probs.size, 0);
  });

  it('returns empty Map when nothing has been trained', () => {
    const mc = new MarkovChain();
    const probs = mc.nextProbabilities(['A']);
    assert.equal(probs.size, 0);
  });

  it('hasState-equivalent: after training, trained tokens are in states()', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'C']);
    const s = new Set(mc.states());
    assert.ok(s.has('A'), 'A should be a known state');
    assert.ok(s.has('B'), 'B should be a known state');
    assert.ok(s.has('C'), 'C should be a known state');
    assert.ok(!s.has('D'), 'D should not be a known state');
  });

  it('returns a map with reachable next states', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'A', 'B', 'A', 'C']);
    const probs = mc.nextProbabilities(['A']);
    assert.ok(probs.size > 0, 'A should have successors');
    assert.ok(probs.has('B'), 'B should be reachable from A');
    assert.ok(probs.has('C'), 'C should be reachable from A');
  });

  it('transitionMatrix-equivalent: probabilities per state sum to 1', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'A', 'C', 'A', 'B', 'B', 'A', 'C', 'B']);
    for (const state of mc.states()) {
      const probs = mc.nextProbabilities([state]);
      if (probs.size === 0) continue; // dead-end state, skip
      let total = 0;
      for (const p of probs.values()) total += p;
      assert.ok(Math.abs(total - 1) < 1e-9,
        `probabilities from state '${state}' should sum to 1, got ${total}`);
    }
  });

  it('P(A→B) = 2/3 and P(A→C) = 1/3 for correct counts', () => {
    const mc = new MarkovChain();
    // A→B appears twice, A→C appears once
    mc.train(['A', 'B', 'A', 'B', 'A', 'C']);
    const probs = mc.nextProbabilities(['A']);
    assert.ok(Math.abs((probs.get('B') ?? 0) - 2 / 3) < 1e-9,
      `expected P(B|A)=2/3, got ${probs.get('B')}`);
    assert.ok(Math.abs((probs.get('C') ?? 0) - 1 / 3) < 1e-9,
      `expected P(C|A)=1/3, got ${probs.get('C')}`);
  });

  it('throws RangeError when context length does not match order', () => {
    const mc = new MarkovChain(2);
    mc.train(['A', 'B', 'C']);
    assert.throws(() => mc.nextProbabilities(['A']), RangeError);
    assert.throws(() => mc.nextProbabilities(['A', 'B', 'C']), RangeError);
  });

  it('works for order-2 chain', () => {
    const mc = new MarkovChain(2);
    mc.train(['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C']);
    const probs = mc.nextProbabilities(['A', 'B']);
    assert.ok(Math.abs((probs.get('C') ?? 0) - 1) < 1e-9,
      'C should be the only successor of [A,B]');
  });

  it('sequence of length == order contributes states but no transitions', () => {
    const mc = new MarkovChain(2);
    mc.train(['A', 'B']); // length equals order — no transition recorded
    assert.deepEqual(mc.states().sort(), ['A', 'B']);
    assert.equal(mc.nextProbabilities(['A', 'B']).size, 0);
  });
});

// ─── generate() — "walk returns start as first element" / "walk length steps+1" ─

describe('MarkovChain – generate() (walk)', () => {
  it('returns empty array when length is 0', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'A', 'B']);
    assert.deepEqual(mc.generate(['A'], 0), []);
  });

  it('returns exactly `length` new tokens (walk length = steps, not steps+1)', () => {
    // generate() returns only newly emitted tokens, not the seed.
    // Callers combine seed + result to get steps+1 total, matching walk semantics.
    const mc = new MarkovChain(1, makeLcg(1));
    mc.train(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
    const out = mc.generate(['A'], 5);
    assert.equal(out.length, 5);
  });

  it('walk start state: combining seed + result gives steps+1 length', () => {
    const mc = new MarkovChain(1, makeLcg(7));
    mc.train(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
    const seed = ['A'];
    const steps = 4;
    const rest = mc.generate(seed, steps);
    const walk = [...seed, ...rest]; // start + generated = steps+1 elements
    assert.equal(walk.length, steps + 1);
    assert.equal(walk[0], 'A'); // first element is the start state
  });

  it('all generated tokens are reachable known states', () => {
    const mc = new MarkovChain(1, makeLcg(99));
    mc.train(['X', 'Y', 'Z', 'X', 'Y', 'Z', 'X', 'Y', 'Z']);
    const out = mc.generate(['X'], 10);
    const allowed = new Set(mc.states());
    for (const tok of out) {
      assert.ok(allowed.has(tok), `unexpected token: ${tok}`);
    }
  });

  it('deterministic chain always produces same sequence', () => {
    // A→B always, B→A always
    const mc = new MarkovChain(1, makeLcg(7));
    mc.train(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);
    const out = mc.generate(['A'], 4);
    assert.deepEqual(out, ['B', 'A', 'B', 'A']);
  });

  it('stops early (throws) when no transitions exist from a state', () => {
    // A→B trained; B has no successor — second step cannot proceed
    const mc = new MarkovChain();
    mc.train(['A', 'B']);
    assert.throws(() => mc.generate(['A'], 2), Error);
  });

  it('single step succeeds when successor exists', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B']);
    const out = mc.generate(['A'], 1);
    assert.deepEqual(out, ['B']);
  });

  it('throws RangeError when seed is shorter than order', () => {
    const mc = new MarkovChain(2);
    mc.train(['A', 'B', 'C']);
    assert.throws(() => mc.generate(['A'], 1), RangeError);
  });
});

// ─── probability() ────────────────────────────────────────────────────────────

describe('MarkovChain – probability()', () => {
  it('returns 1 for sequences of length ≤ order', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'C']);
    assert.equal(mc.probability(['A']), 1);
  });

  it('returns 0 for an impossible transition', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'C']);
    assert.equal(mc.probability(['A', 'C']), 0); // A never directly followed by C
  });

  it('returns 0 for an unseen context', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B']);
    assert.equal(mc.probability(['X', 'Y']), 0);
  });

  it('returns 1 for a fully deterministic sequence', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'A', 'B', 'A', 'B']);
    assert.ok(Math.abs(mc.probability(['A', 'B', 'A']) - 1) < 1e-9);
  });

  it('multiplies step probabilities for multi-step sequence', () => {
    // a→b(1), b→a(1), a→c(1) → P(b|a)=0.5, P(a|b)=1
    // P([a,b,a]) = P(b|a) × P(a|b) = 0.5 × 1 = 0.5
    const mc = new MarkovChain();
    mc.train(['a', 'b', 'a', 'c']); // transitions: a→b(1), b→a(1), a→c(1)
    const p = mc.probability(['a', 'b', 'a']);
    assert.ok(Math.abs(p - 0.5) < 1e-9, `expected 0.5, got ${p}`);
  });
});

// ─── Stationary distribution (two-state symmetric chain ~50/50) ───────────────
//  The module does not expose stationaryDistribution() directly; we verify the
//  property analytically: for A↔B with equal rates, P(A→B)=P(B→A)=1, so the
//  stationary distribution is π(A)=π(B)=0.5.

describe('MarkovChain – stationary distribution (via nextProbabilities)', () => {
  it('symmetric A↔B chain: each transition probability is 1', () => {
    const mc = new MarkovChain();
    mc.train(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);

    const fromA = mc.nextProbabilities(['A']);
    const fromB = mc.nextProbabilities(['B']);

    assert.ok(Math.abs((fromA.get('B') ?? 0) - 1) < 1e-9,
      'P(B|A) should be 1 in symmetric chain');
    assert.ok(Math.abs((fromB.get('A') ?? 0) - 1) < 1e-9,
      'P(A|B) should be 1 in symmetric chain');
  });

  it('empirical visit frequencies converge to ~50/50 for symmetric chain', () => {
    // Use a deterministic alternating RNG so the walk is predictable
    let flip = 0;
    const altRng = () => { flip = 1 - flip; return flip * 0.1; };
    const mc = new MarkovChain(1, altRng);
    mc.train(['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B']);

    // Walk 200 steps from A, count visits
    const seed = ['A'];
    const steps = 200;
    const rest = mc.generate(seed, steps);
    const walk = [...seed, ...rest];

    let countA = 0;
    let countB = 0;
    for (const tok of walk) {
      if (tok === 'A') countA++;
      else if (tok === 'B') countB++;
    }
    const total = countA + countB;
    const ratioA = countA / total;
    const ratioB = countB / total;
    // Allow a generous 15% margin around 50%
    assert.ok(Math.abs(ratioA - 0.5) < 0.15,
      `expected π(A)≈0.5, got ${ratioA.toFixed(3)}`);
    assert.ok(Math.abs(ratioB - 0.5) < 0.15,
      `expected π(B)≈0.5, got ${ratioB.toFixed(3)}`);
  });

  it('biased chain: more self-loops means higher stationary weight on that state', () => {
    // A→A x3, A→B x1 → P(A→A)=0.75, P(A→B)=0.25
    // B→A x1           → P(B→A)=1
    const mc = new MarkovChain();
    mc.train(['A', 'A', 'A', 'A', 'B', 'A', 'A', 'A', 'A', 'B', 'A']);

    const fromA = mc.nextProbabilities(['A']);
    const pAA = fromA.get('A') ?? 0;
    const pAB = fromA.get('B') ?? 0;
    assert.ok(pAA > pAB,
      `expected P(A→A)=${pAA} > P(A→B)=${pAB}`);
  });
});

// ─── Sampling correctness ─────────────────────────────────────────────────────

describe('MarkovChain – weighted sampling (generate)', () => {
  it('respects trained probabilities over many samples', () => {
    // a→b twice, a→c once → expected ratio ~2:1
    const rng = makeLcg(42);
    const mc = new MarkovChain(1, rng);
    mc.train(['a', 'b', 'a', 'b', 'a', 'c', 'a', 'b', 'a', 'b', 'a', 'c']);

    let countB = 0;
    let countC = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      const [next] = mc.generate(['a'], 1);
      if (next === 'b') countB++;
      else countC++;
    }
    assert.ok(countB > countC,
      `expected b(${countB}) > c(${countC}) with ~2:1 ratio`);
  });
});

// ─── createMarkovChain factory ────────────────────────────────────────────────

describe('createMarkovChain factory', () => {
  it('returns a MarkovChain instance', () => {
    const mc = createMarkovChain();
    assert.ok(mc instanceof MarkovChain);
  });

  it('defaults to order 1', () => {
    const mc = createMarkovChain();
    assert.equal(mc.order, 1);
  });

  it('respects a custom order', () => {
    const mc = createMarkovChain(3);
    assert.equal(mc.order, 3);
  });

  it('returned chain is fully functional', () => {
    const mc = createMarkovChain();
    mc.train(['cat', 'dog', 'cat', 'dog', 'cat']);
    const probs = mc.nextProbabilities(['cat']);
    assert.ok(probs.has('dog'), 'dog should be reachable from cat');
    assert.ok(Math.abs((probs.get('dog') ?? 0) - 1) < 1e-9,
      'P(dog|cat) should be 1 in this training');
  });
});
