// ─── Unit Tests: Markov Chain ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MarkovChain, createMarkovChain } from '../../app/modules/markov-chain.js';

// ─── Deterministic RNG ────────────────────────────────────────────────────────

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

// ─── Constructor & order getter ───────────────────────────────────────────────

describe('MarkovChain – constructor', () => {
  it('defaults to order 1', () => {
    const mc = new MarkovChain();
    assert.equal(mc.order, 1);
  });

  it('stores explicit order', () => {
    const mc = new MarkovChain(3);
    assert.equal(mc.order, 3);
  });

  it('throws RangeError for order < 1', () => {
    assert.throws(() => new MarkovChain(0), RangeError);
    assert.throws(() => new MarkovChain(-1), RangeError);
  });

  it('throws RangeError for non-integer order', () => {
    assert.throws(() => new MarkovChain(1.5), RangeError);
  });
});

// ─── train / states ───────────────────────────────────────────────────────────

describe('MarkovChain – train / states', () => {
  it('registers all tokens as states', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b', 'c', 'a']);
    const s = mc.states().sort();
    assert.deepEqual(s, ['a', 'b', 'c']);
  });

  it('accumulates states across multiple train calls', () => {
    const mc = new MarkovChain();
    mc.train(['x', 'y']);
    mc.train(['y', 'z']);
    const s = mc.states().sort();
    assert.deepEqual(s, ['x', 'y', 'z']);
  });

  it('handles numeric tokens', () => {
    const mc = new MarkovChain();
    mc.train([1, 2, 3, 1, 2]);
    const s = mc.states().sort((a, b) => a - b);
    assert.deepEqual(s, [1, 2, 3]);
  });

  it('sequence equal to or shorter than order contributes states but no transitions', () => {
    const mc = new MarkovChain(2);
    mc.train(['a', 'b']); // length === order → no transition possible
    assert.deepEqual(mc.states().sort(), ['a', 'b']);
    // no next probabilities because context ['a','b'] was never followed
    const probs = mc.nextProbabilities(['a', 'b']);
    assert.equal(probs.size, 0);
  });
});

// ─── nextProbabilities ────────────────────────────────────────────────────────

describe('MarkovChain – nextProbabilities', () => {
  it('returns correct probabilities for a simple sequence', () => {
    const mc = new MarkovChain();
    // a→b appears twice, a→c appears once  →  P(b|a)=2/3, P(c|a)=1/3
    mc.train(['a', 'b', 'a', 'b', 'a', 'c']);
    const probs = mc.nextProbabilities(['a']);
    assert.ok(Math.abs((probs.get('b') ?? 0) - 2 / 3) < 1e-9);
    assert.ok(Math.abs((probs.get('c') ?? 0) - 1 / 3) < 1e-9);
  });

  it('probabilities sum to 1', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b', 'c', 'a', 'c', 'b', 'a', 'b']);
    const probs = mc.nextProbabilities(['a']);
    let total = 0;
    for (const p of probs.values()) total += p;
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  it('returns empty map for unseen state', () => {
    const mc = new MarkovChain();
    mc.train(['x', 'y']);
    const probs = mc.nextProbabilities(['z']);
    assert.equal(probs.size, 0);
  });

  it('throws RangeError when state length !== order', () => {
    const mc = new MarkovChain(2);
    mc.train(['a', 'b', 'c']);
    assert.throws(() => mc.nextProbabilities(['a']), RangeError);
    assert.throws(() => mc.nextProbabilities(['a', 'b', 'c']), RangeError);
  });

  it('works for order-2 chain', () => {
    const mc = new MarkovChain(2);
    // ['a','b'] always followed by 'c'
    mc.train(['a', 'b', 'c', 'a', 'b', 'c']);
    const probs = mc.nextProbabilities(['a', 'b']);
    assert.ok(Math.abs((probs.get('c') ?? 0) - 1) < 1e-9);
  });
});

// ─── probability ─────────────────────────────────────────────────────────────

describe('MarkovChain – probability', () => {
  it('returns 1 for a sequence not longer than order', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b', 'c']);
    assert.equal(mc.probability(['a']), 1);
  });

  it('returns correct probability for a deterministic chain', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b', 'a', 'b', 'a', 'b']);
    // Only transition from 'a' is 'b' and from 'b' is 'a'
    assert.ok(Math.abs(mc.probability(['a', 'b', 'a']) - 1) < 1e-9);
  });

  it('returns 0 for an impossible transition', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b', 'c']);
    // 'b' → 'a' was never seen
    assert.equal(mc.probability(['a', 'b', 'a']), 0);
  });

  it('returns 0 for a sequence with an unseen context', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b']);
    assert.equal(mc.probability(['x', 'y']), 0);
  });

  it('multiplies independent step probabilities correctly', () => {
    const mc = new MarkovChain();
    // Train: a→b once, a→c once  →  P(b|a)=0.5, P(c|a)=0.5
    //        b→a once             →  P(a|b)=1
    // Sequence [a,b,a]:  P = P(b|a) × P(a|b) = 0.5 × 1 = 0.5
    mc.train(['a', 'b', 'a', 'c']); // transitions: a→b(1), b→a(1), a→c(1)
    const p = mc.probability(['a', 'b', 'a']);
    assert.ok(Math.abs(p - 0.5) < 1e-9, `expected ~0.5, got ${p}`);
  });
});

// ─── generate ─────────────────────────────────────────────────────────────────

describe('MarkovChain – generate', () => {
  it('generates the requested number of tokens', () => {
    const mc = new MarkovChain(1, makeLcg(1));
    mc.train(['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c']);
    const out = mc.generate(['a'], 5);
    assert.equal(out.length, 5);
  });

  it('returns empty array when length is 0', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b']);
    assert.deepEqual(mc.generate(['a'], 0), []);
  });

  it('generated tokens are all known states', () => {
    const mc = new MarkovChain(1, makeLcg(99));
    mc.train(['x', 'y', 'z', 'x', 'y', 'z', 'x', 'y', 'z']);
    const out = mc.generate(['x'], 10);
    const allowed = new Set(['x', 'y', 'z']);
    for (const t of out) {
      assert.ok(allowed.has(t), `unexpected token: ${t}`);
    }
  });

  it('deterministic chain always produces same output', () => {
    // a→b always, b→a always
    const mc = new MarkovChain(1, makeLcg(7));
    mc.train(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']);
    const out = mc.generate(['a'], 4);
    assert.deepEqual(out, ['b', 'a', 'b', 'a']);
  });

  it('throws when start is too short', () => {
    const mc = new MarkovChain(2);
    mc.train(['a', 'b', 'c']);
    assert.throws(() => mc.generate(['a'], 1), RangeError);
  });

  it('throws when context has no successor', () => {
    const mc = new MarkovChain();
    mc.train(['a', 'b']); // only 'a'→'b' trained; 'b' has no successor
    assert.throws(() => mc.generate(['b'], 1));
  });

  it('respects trained probabilities over many samples', () => {
    // a→b twice, a→c once
    const rng = makeLcg(42);
    const mc = new MarkovChain(1, rng);
    mc.train(['a', 'b', 'a', 'b', 'a', 'c', 'a', 'b', 'a', 'b', 'a', 'c']);

    // Count how many times 'b' vs 'c' appears after 'a'
    let countB = 0;
    let countC = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      const [next] = mc.generate(['a'], 1);
      if (next === 'b') countB++;
      else countC++;
    }
    // Expect roughly 2:1 ratio; allow wide margin
    assert.ok(countB > countC, `expected b(${countB}) > c(${countC})`);
  });
});

// ─── createMarkovChain factory ────────────────────────────────────────────────

describe('createMarkovChain factory', () => {
  it('creates a MarkovChain with default order 1', () => {
    const mc = createMarkovChain();
    assert.equal(mc.order, 1);
  });

  it('creates a MarkovChain with the given order', () => {
    const mc = createMarkovChain(3);
    assert.equal(mc.order, 3);
  });

  it('returned instance is a MarkovChain', () => {
    const mc = createMarkovChain();
    assert.ok(mc instanceof MarkovChain);
  });
});
