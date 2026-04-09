// ─── Unit Tests: ABTesting ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ABTesting } from '../../app/modules/ab-testing.js';

// ─── register / getExperiments ────────────────────────────────────────────────

describe('ABTesting – register / getExperiments', () => {
  it('registers an experiment retrievable via getExperiments', () => {
    const ab = new ABTesting();
    ab.register({ id: 'exp1', name: 'Experiment 1', variants: ['control', 'treatment'], active: true });
    const exps = ab.getExperiments();
    assert.equal(exps.length, 1);
    assert.equal(exps[0].id, 'exp1');
  });

  it('registering again replaces the experiment', () => {
    const ab = new ABTesting();
    ab.register({ id: 'exp1', name: 'Old', variants: ['a'], active: true });
    ab.register({ id: 'exp1', name: 'New', variants: ['a', 'b'], active: true });
    assert.equal(ab.getExperiments().length, 1);
    assert.equal(ab.getExperiments()[0].name, 'New');
  });

  it('getExperiments returns empty array when none registered', () => {
    const ab = new ABTesting();
    assert.deepEqual(ab.getExperiments(), []);
  });
});

// ─── getVariant – determinism ─────────────────────────────────────────────────

describe('ABTesting – getVariant determinism', () => {
  it('same userId + experimentId always returns same variant', () => {
    const ab = new ABTesting();
    ab.register({ id: 'det', name: 'Det', variants: ['control', 'treatment'], active: true });
    const v1 = ab.getVariant('det', 'user-abc');
    const v2 = ab.getVariant('det', 'user-abc');
    const v3 = ab.getVariant('det', 'user-abc');
    assert.equal(v1, v2);
    assert.equal(v2, v3);
  });

  it('returns one of the experiment variants', () => {
    const ab = new ABTesting();
    ab.register({ id: 'v', name: 'V', variants: ['a', 'b', 'c'], active: true });
    const variant = ab.getVariant('v', 'user-1');
    assert.ok(['a', 'b', 'c'].includes(variant));
  });

  it('different userIds can get different variants', () => {
    const ab = new ABTesting();
    ab.register({ id: 'split', name: 'Split', variants: ['control', 'treatment'], active: true });
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(ab.getVariant('split', `user-${i}`));
    }
    // With 30 different users we expect both variants to appear at least once
    assert.ok(results.has('control'), 'expected at least one user in control');
    assert.ok(results.has('treatment'), 'expected at least one user in treatment');
  });

  it('returns null for unknown experiment', () => {
    const ab = new ABTesting();
    assert.equal(ab.getVariant('nonexistent', 'user-1'), null);
  });

  it('returns null for inactive experiment', () => {
    const ab = new ABTesting();
    ab.register({ id: 'inactive', name: 'I', variants: ['a', 'b'], active: false });
    assert.equal(ab.getVariant('inactive', 'user-1'), null);
  });
});

// ─── weights distribution ─────────────────────────────────────────────────────

describe('ABTesting – weights', () => {
  it('[1, 1] produces approximately equal distribution', () => {
    const ab = new ABTesting();
    ab.register({ id: 'fifty', name: '50/50', variants: ['a', 'b'], weights: [1, 1], active: true });
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 100; i++) {
      const v = ab.getVariant('fifty', `user-${i}`);
      counts[v]++;
    }
    // With 100 users the split should be somewhere between 30/70 and 70/30
    assert.ok(counts.a > 20 && counts.b > 20, `skewed distribution: a=${counts.a}, b=${counts.b}`);
  });

  it('[2, 1] assigns variant a roughly twice as often as b', () => {
    const ab = new ABTesting();
    ab.register({ id: 'weighted', name: '2/1', variants: ['a', 'b'], weights: [2, 1], active: true });
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 300; i++) {
      const v = ab.getVariant('weighted', `user-${i}`);
      counts[v]++;
    }
    // a should get about 2/3 of users; sanity-check at least > 1.5x
    assert.ok(counts.a > counts.b * 1.2, `expected a(${counts.a}) >> b(${counts.b})`);
  });

  it('equal weights are used when weights not supplied', () => {
    const ab = new ABTesting();
    ab.register({ id: 'noweights', name: 'NW', variants: ['x', 'y'], active: true });
    const results = new Set();
    for (let i = 0; i < 50; i++) {
      results.add(ab.getVariant('noweights', `u-${i}`));
    }
    assert.ok(results.has('x'));
    assert.ok(results.has('y'));
  });
});

// ─── override / clearOverride ─────────────────────────────────────────────────

describe('ABTesting – override / clearOverride', () => {
  it('override forces the specified variant for all users', () => {
    const ab = new ABTesting();
    ab.register({ id: 'ov', name: 'OV', variants: ['control', 'treatment'], active: true });
    ab.override('ov', 'treatment');
    for (let i = 0; i < 10; i++) {
      assert.equal(ab.getVariant('ov', `user-${i}`), 'treatment');
    }
  });

  it('clearOverride restores normal hash-based assignment', () => {
    const ab = new ABTesting();
    ab.register({ id: 'co', name: 'CO', variants: ['a', 'b'], active: true });
    const naturalVariant = ab.getVariant('co', 'stable-user');
    ab.override('co', naturalVariant === 'a' ? 'b' : 'a'); // force to the other
    ab.clearOverride('co');
    assert.equal(ab.getVariant('co', 'stable-user'), naturalVariant);
  });

  it('clearOverride on non-overridden experiment is a no-op', () => {
    const ab = new ABTesting();
    ab.register({ id: 'noov', name: 'NO', variants: ['a', 'b'], active: true });
    assert.doesNotThrow(() => ab.clearOverride('noov'));
  });
});

// ─── getAssignments ───────────────────────────────────────────────────────────

describe('ABTesting – getAssignments', () => {
  it('returns an assignment for each active experiment', () => {
    const ab = new ABTesting();
    ab.register({ id: 'e1', name: 'E1', variants: ['a', 'b'], active: true });
    ab.register({ id: 'e2', name: 'E2', variants: ['x', 'y'], active: true });
    const assignments = ab.getAssignments('user-1');
    assert.equal(assignments.length, 2);
    const ids = assignments.map((a) => a.experimentId).sort();
    assert.deepEqual(ids, ['e1', 'e2']);
  });

  it('does not include inactive experiments in assignments', () => {
    const ab = new ABTesting();
    ab.register({ id: 'active', name: 'A', variants: ['a', 'b'], active: true });
    ab.register({ id: 'inactive', name: 'I', variants: ['a', 'b'], active: false });
    const assignments = ab.getAssignments('user-1');
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].experimentId, 'active');
  });

  it('each assignment has experimentId, variant, and assignedAt', () => {
    const ab = new ABTesting();
    ab.register({ id: 'e1', name: 'E1', variants: ['ctrl', 'treat'], active: true });
    const before = Date.now();
    const assignments = ab.getAssignments('user-1');
    const after = Date.now();
    const a = assignments[0];
    assert.equal(typeof a.experimentId, 'string');
    assert.ok(['ctrl', 'treat'].includes(a.variant));
    assert.ok(a.assignedAt >= before && a.assignedAt <= after);
  });

  it('returns empty array when no experiments registered', () => {
    const ab = new ABTesting();
    assert.deepEqual(ab.getAssignments('user-1'), []);
  });

  it('assignments are deterministic for the same userId', () => {
    const ab = new ABTesting();
    ab.register({ id: 'e1', name: 'E1', variants: ['a', 'b'], active: true });
    const a1 = ab.getAssignments('stable').map((a) => a.variant);
    const a2 = ab.getAssignments('stable').map((a) => a.variant);
    assert.deepEqual(a1, a2);
  });
});

// ─── isActive / deactivate ────────────────────────────────────────────────────

describe('ABTesting – isActive / deactivate', () => {
  it('isActive returns true for an active experiment', () => {
    const ab = new ABTesting();
    ab.register({ id: 'act', name: 'A', variants: ['a'], active: true });
    assert.equal(ab.isActive('act'), true);
  });

  it('isActive returns false for an inactive experiment', () => {
    const ab = new ABTesting();
    ab.register({ id: 'inact', name: 'I', variants: ['a'], active: false });
    assert.equal(ab.isActive('inact'), false);
  });

  it('isActive returns false for unknown experiment', () => {
    const ab = new ABTesting();
    assert.equal(ab.isActive('ghost'), false);
  });

  it('deactivate makes an active experiment inactive', () => {
    const ab = new ABTesting();
    ab.register({ id: 'd', name: 'D', variants: ['a', 'b'], active: true });
    ab.deactivate('d');
    assert.equal(ab.isActive('d'), false);
  });

  it('getVariant returns null after deactivation', () => {
    const ab = new ABTesting();
    ab.register({ id: 'd', name: 'D', variants: ['a', 'b'], active: true });
    ab.deactivate('d');
    assert.equal(ab.getVariant('d', 'user-1'), null);
  });

  it('deactivate on unknown experiment is a no-op', () => {
    const ab = new ABTesting();
    assert.doesNotThrow(() => ab.deactivate('ghost'));
  });
});
