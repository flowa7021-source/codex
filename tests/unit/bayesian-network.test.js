// ─── Unit Tests: BayesianNetwork ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BayesianNetwork } from '../../app/modules/bayesian-network.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the classic Rain → Sprinkler / Rain → WetGrass ← Sprinkler network.
 *
 *   Rain:        P(T) = 0.2
 *   Sprinkler:   P(T|Rain=T) = 0.01,  P(T|Rain=F) = 0.4
 *   WetGrass:    P(T|S=T,R=T) = 0.99, P(T|S=T,R=F) = 0.9
 *                P(T|S=F,R=T) = 0.8,  P(T|S=F,R=F) = 0.0
 */
function buildSprinklerNetwork() {
  return new BayesianNetwork([
    {
      name: 'Rain',
      parents: [],
      cpt: { T: 0.2 },
    },
    {
      name: 'Sprinkler',
      parents: ['Rain'],
      cpt: {
        'T|T': 0.01,
        'T|F': 0.4,
      },
    },
    {
      name: 'WetGrass',
      parents: ['Sprinkler', 'Rain'],
      cpt: {
        'T|T,T': 0.99,
        'T|T,F': 0.9,
        'T|F,T': 0.8,
        'T|F,F': 0.0,
      },
    },
  ]);
}

// ─── topologicalOrder ────────────────────────────────────────────────────────

describe('BayesianNetwork – topologicalOrder', () => {
  it('returns all node names', () => {
    const net = buildSprinklerNetwork();
    const order = net.topologicalOrder();
    assert.equal(order.length, 3);
    assert.ok(order.includes('Rain'));
    assert.ok(order.includes('Sprinkler'));
    assert.ok(order.includes('WetGrass'));
  });

  it('puts parents before children', () => {
    const net = buildSprinklerNetwork();
    const order = net.topologicalOrder();
    const iRain = order.indexOf('Rain');
    const iSprinkler = order.indexOf('Sprinkler');
    const iWet = order.indexOf('WetGrass');
    assert.ok(iRain < iSprinkler, 'Rain should come before Sprinkler');
    assert.ok(iRain < iWet, 'Rain should come before WetGrass');
    assert.ok(iSprinkler < iWet, 'Sprinkler should come before WetGrass');
  });

  it('handles a single-node network', () => {
    const net = new BayesianNetwork([{ name: 'X', parents: [], cpt: { T: 0.5 } }]);
    assert.deepEqual(net.topologicalOrder(), ['X']);
  });
});

// ─── addNode ─────────────────────────────────────────────────────────────────

describe('BayesianNetwork – addNode', () => {
  it('adds a node that did not exist', () => {
    const net = new BayesianNetwork();
    net.addNode({ name: 'A', parents: [], cpt: { T: 0.3 } });
    assert.ok(net.topologicalOrder().includes('A'));
  });

  it('replaces an existing node with the same name', () => {
    const net = new BayesianNetwork([{ name: 'A', parents: [], cpt: { T: 0.3 } }]);
    net.addNode({ name: 'A', parents: [], cpt: { T: 0.9 } });
    // Query should reflect the new CPT
    const p = net.query('A', true);
    assert.ok(Math.abs(p - 0.9) < 1e-9);
  });
});

// ─── query – root node (no evidence) ────────────────────────────────────────

describe('BayesianNetwork – query (root node)', () => {
  it('P(Rain=T) matches the CPT prior', () => {
    const net = buildSprinklerNetwork();
    const p = net.query('Rain', true);
    assert.ok(Math.abs(p - 0.2) < 1e-9, `Expected 0.2, got ${p}`);
  });

  it('P(Rain=F) = 1 - P(Rain=T)', () => {
    const net = buildSprinklerNetwork();
    const pT = net.query('Rain', true);
    const pF = net.query('Rain', false);
    assert.ok(Math.abs(pT + pF - 1) < 1e-9);
  });

  it('P(X=T) = 0.5 when only T=0.5 row stored (uniform)', () => {
    const net = new BayesianNetwork([{ name: 'X', parents: [], cpt: { T: 0.5 } }]);
    assert.ok(Math.abs(net.query('X', true) - 0.5) < 1e-9);
  });
});

// ─── query – with evidence ────────────────────────────────────────────────────

describe('BayesianNetwork – query (with evidence)', () => {
  it('P(Sprinkler=T | Rain=T) ≈ 0.01', () => {
    const net = buildSprinklerNetwork();
    const p = net.query('Sprinkler', true, { Rain: true });
    assert.ok(Math.abs(p - 0.01) < 1e-9, `Expected 0.01, got ${p}`);
  });

  it('P(Sprinkler=T | Rain=F) ≈ 0.4', () => {
    const net = buildSprinklerNetwork();
    const p = net.query('Sprinkler', true, { Rain: false });
    assert.ok(Math.abs(p - 0.4) < 1e-9, `Expected 0.4, got ${p}`);
  });

  it('P(WetGrass=T | Sprinkler=T, Rain=T) ≈ 0.99', () => {
    const net = buildSprinklerNetwork();
    const p = net.query('WetGrass', true, { Sprinkler: true, Rain: true });
    assert.ok(Math.abs(p - 0.99) < 1e-9, `Expected 0.99, got ${p}`);
  });

  it('P(WetGrass=F | Sprinkler=F, Rain=F) ≈ 1.0', () => {
    const net = buildSprinklerNetwork();
    const p = net.query('WetGrass', false, { Sprinkler: false, Rain: false });
    assert.ok(Math.abs(p - 1.0) < 1e-9, `Expected 1.0, got ${p}`);
  });

  it('query with evidence sums to 1', () => {
    const net = buildSprinklerNetwork();
    const pT = net.query('Sprinkler', true, { Rain: true });
    const pF = net.query('Sprinkler', false, { Rain: true });
    assert.ok(Math.abs(pT + pF - 1) < 1e-9);
  });

  it('marginal P(WetGrass=T) with no evidence is between 0 and 1', () => {
    const net = buildSprinklerNetwork();
    const p = net.query('WetGrass', true);
    assert.ok(p >= 0 && p <= 1, `Expected probability in [0,1], got ${p}`);
  });
});

// ─── Two-node network: X → Y ─────────────────────────────────────────────────

describe('BayesianNetwork – simple two-node network', () => {
  /**
   * X: P(T) = 0.6
   * Y: P(T|X=T) = 0.8, P(T|X=F) = 0.3
   */
  function buildXY() {
    return new BayesianNetwork([
      { name: 'X', parents: [], cpt: { T: 0.6 } },
      { name: 'Y', parents: ['X'], cpt: { 'T|T': 0.8, 'T|F': 0.3 } },
    ]);
  }

  it('P(X=T) = 0.6', () => {
    const net = buildXY();
    assert.ok(Math.abs(net.query('X', true) - 0.6) < 1e-9);
  });

  it('P(Y=T | X=T) = 0.8', () => {
    const net = buildXY();
    assert.ok(Math.abs(net.query('Y', true, { X: true }) - 0.8) < 1e-9);
  });

  it('P(Y=T | X=F) = 0.3', () => {
    const net = buildXY();
    assert.ok(Math.abs(net.query('Y', true, { X: false }) - 0.3) < 1e-9);
  });

  it('marginal P(Y=T) = P(Y|X=T)*P(X=T) + P(Y|X=F)*P(X=F)', () => {
    const net = buildXY();
    const expected = 0.8 * 0.6 + 0.3 * 0.4; // 0.60
    const actual = net.query('Y', true);
    assert.ok(Math.abs(actual - expected) < 1e-9, `Expected ${expected}, got ${actual}`);
  });

  it('marginal probabilities sum to 1', () => {
    const net = buildXY();
    const pT = net.query('Y', true);
    const pF = net.query('Y', false);
    assert.ok(Math.abs(pT + pF - 1) < 1e-9);
  });
});

// ─── sample ──────────────────────────────────────────────────────────────────

describe('BayesianNetwork – sample', () => {
  it('sample() returns an assignment for every node', () => {
    const net = buildSprinklerNetwork();
    const s = net.sample();
    assert.ok('Rain' in s);
    assert.ok('Sprinkler' in s);
    assert.ok('WetGrass' in s);
    assert.equal(typeof s.Rain, 'boolean');
    assert.equal(typeof s.Sprinkler, 'boolean');
    assert.equal(typeof s.WetGrass, 'boolean');
  });

  it('prior sampling frequency of Rain=T is close to 0.2 over many samples', () => {
    const net = buildSprinklerNetwork();
    const N = 5000;
    let trueCount = 0;
    for (let i = 0; i < N; i++) {
      if (net.sample().Rain) trueCount++;
    }
    const freq = trueCount / N;
    // Allow generous tolerance for a stochastic test (±0.05)
    assert.ok(
      Math.abs(freq - 0.2) < 0.05,
      `Expected ~0.2, got ${freq.toFixed(3)}`,
    );
  });

  it('Rain=F → Sprinkler=T samples should be roughly 40%', () => {
    const net = new BayesianNetwork([
      { name: 'Rain', parents: [], cpt: { T: 0 } }, // Rain always false
      { name: 'Sprinkler', parents: ['Rain'], cpt: { 'T|T': 0.01, 'T|F': 0.4 } },
    ]);
    const N = 4000;
    let trueCount = 0;
    for (let i = 0; i < N; i++) {
      if (net.sample().Sprinkler) trueCount++;
    }
    const freq = trueCount / N;
    assert.ok(Math.abs(freq - 0.4) < 0.05, `Expected ~0.4, got ${freq.toFixed(3)}`);
  });
});
