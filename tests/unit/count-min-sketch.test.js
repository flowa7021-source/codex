// ─── Unit Tests: count-min-sketch ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CountMinSketch,
  createCountMinSketch,
  createOptimalSketch,
} from '../../app/modules/count-min-sketch.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('CountMinSketch constructor', () => {
  it('creates a sketch with given dimensions', () => {
    const cms = new CountMinSketch(100, 5);
    assert.equal(cms.width, 100);
    assert.equal(cms.depth, 5);
  });

  it('throws on non-positive width', () => {
    assert.throws(() => new CountMinSketch(0, 5), RangeError);
    assert.throws(() => new CountMinSketch(-1, 5), RangeError);
  });

  it('throws on non-positive depth', () => {
    assert.throws(() => new CountMinSketch(100, 0), RangeError);
    assert.throws(() => new CountMinSketch(100, -3), RangeError);
  });

  it('throws on non-integer dimensions', () => {
    assert.throws(() => new CountMinSketch(10.5, 5), RangeError);
    assert.throws(() => new CountMinSketch(10, 5.5), RangeError);
  });
});

// ─── add + estimate ──────────────────────────────────────────────────────────

describe('add + estimate', () => {
  it('returns 0 for unseen items', () => {
    const cms = new CountMinSketch(200, 5);
    assert.equal(cms.estimate('never-added'), 0);
  });

  it('returns exact count for a single item added multiple times', () => {
    const cms = new CountMinSketch(1000, 10);
    for (let i = 0; i < 42; i++) cms.add('hello');
    assert.equal(cms.estimate('hello'), 42);
  });

  it('supports custom count parameter', () => {
    const cms = new CountMinSketch(500, 7);
    cms.add('batch', 100);
    assert.ok(cms.estimate('batch') >= 100);
  });

  it('never underestimates the true count', () => {
    const cms = new CountMinSketch(200, 5);
    cms.add('alpha', 10);
    cms.add('beta', 20);
    cms.add('gamma', 30);
    assert.ok(cms.estimate('alpha') >= 10);
    assert.ok(cms.estimate('beta') >= 20);
    assert.ok(cms.estimate('gamma') >= 30);
  });

  it('handles many distinct items with reasonable overcount', () => {
    const cms = new CountMinSketch(500, 5);
    const n = 200;
    for (let i = 0; i < n; i++) cms.add(`item-${i}`, i + 1);

    // Check a sample — estimate should be >= true count
    for (let i = 0; i < n; i += 20) {
      assert.ok(
        cms.estimate(`item-${i}`) >= i + 1,
        `Underestimate for item-${i}: got ${cms.estimate(`item-${i}`)}, expected >= ${i + 1}`,
      );
    }
  });
});

// ─── merge ───────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('combines counts from two sketches', () => {
    const a = new CountMinSketch(500, 5);
    const b = new CountMinSketch(500, 5);
    a.add('shared', 10);
    b.add('shared', 20);
    const merged = a.merge(b);
    assert.ok(merged.estimate('shared') >= 30);
  });

  it('returns a new sketch (does not mutate originals)', () => {
    const a = new CountMinSketch(100, 3);
    const b = new CountMinSketch(100, 3);
    a.add('x', 5);
    b.add('y', 10);
    const merged = a.merge(b);
    // originals unchanged
    assert.equal(a.estimate('y'), 0);
    assert.equal(b.estimate('x'), 0);
    // merged has both
    assert.ok(merged.estimate('x') >= 5);
    assert.ok(merged.estimate('y') >= 10);
  });

  it('throws when merging sketches with different dimensions', () => {
    const a = new CountMinSketch(100, 3);
    const b = new CountMinSketch(200, 3);
    assert.throws(() => a.merge(b), /different dimensions/);
  });

  it('preserves dimensions in the merged sketch', () => {
    const a = new CountMinSketch(300, 7);
    const b = new CountMinSketch(300, 7);
    const merged = a.merge(b);
    assert.equal(merged.width, 300);
    assert.equal(merged.depth, 7);
  });
});

// ─── clear ───────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('resets all estimates to 0', () => {
    const cms = new CountMinSketch(200, 5);
    cms.add('a', 50);
    cms.add('b', 100);
    cms.clear();
    assert.equal(cms.estimate('a'), 0);
    assert.equal(cms.estimate('b'), 0);
  });

  it('allows new adds after clear', () => {
    const cms = new CountMinSketch(200, 5);
    cms.add('before', 10);
    cms.clear();
    cms.add('after', 7);
    assert.ok(cms.estimate('after') >= 7);
    assert.equal(cms.estimate('before'), 0);
  });
});

// ─── createCountMinSketch factory ────────────────────────────────────────────

describe('createCountMinSketch factory', () => {
  it('returns a CountMinSketch instance', () => {
    const cms = createCountMinSketch(100, 5);
    assert.ok(cms instanceof CountMinSketch);
    assert.equal(cms.width, 100);
    assert.equal(cms.depth, 5);
  });
});

// ─── createOptimalSketch ─────────────────────────────────────────────────────

describe('createOptimalSketch', () => {
  it('computes width = ceil(e / epsilon)', () => {
    const cms = createOptimalSketch(0.01, 0.01);
    assert.equal(cms.width, Math.ceil(Math.E / 0.01));
  });

  it('computes depth = ceil(ln(1 / delta))', () => {
    const cms = createOptimalSketch(0.01, 0.01);
    assert.equal(cms.depth, Math.ceil(Math.log(1 / 0.01)));
  });

  it('throws on invalid epsilon', () => {
    assert.throws(() => createOptimalSketch(0, 0.5), RangeError);
    assert.throws(() => createOptimalSketch(1, 0.5), RangeError);
  });

  it('throws on invalid delta', () => {
    assert.throws(() => createOptimalSketch(0.5, 0), RangeError);
    assert.throws(() => createOptimalSketch(0.5, 1), RangeError);
  });

  it('returns a functional sketch', () => {
    const cms = createOptimalSketch(0.001, 0.01);
    cms.add('test', 5);
    assert.ok(cms.estimate('test') >= 5);
  });
});
