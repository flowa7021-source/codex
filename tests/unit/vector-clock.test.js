// ─── Unit Tests: VectorClock ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VectorClock,
  compareClocks,
  createVectorClock,
} from '../../app/modules/vector-clock.js';

describe('VectorClock – construction', () => {
  it('factory creates a clock with the given nodeId', () => {
    const c = createVectorClock('A');
    assert.equal(c.nodeId, 'A');
    assert.equal(c.get('A'), 0);
  });

  it('constructor creates an empty clock', () => {
    const c = new VectorClock('X');
    assert.equal(c.nodeId, 'X');
    assert.deepEqual(c.toJSON(), {});
  });
});

describe('VectorClock – increment', () => {
  it('increment advances the owning node by 1', () => {
    const c = createVectorClock('A').increment();
    assert.equal(c.get('A'), 1);
  });

  it('multiple increments accumulate', () => {
    const c = createVectorClock('A').increment().increment().increment();
    assert.equal(c.get('A'), 3);
  });

  it('increment returns a new instance (immutability)', () => {
    const c1 = createVectorClock('A');
    const c2 = c1.increment();
    assert.notEqual(c1, c2);
    assert.equal(c1.get('A'), 0);
    assert.equal(c2.get('A'), 1);
  });
});

describe('VectorClock – merge', () => {
  it('merge takes component-wise max', () => {
    const a = createVectorClock('A').increment().increment(); // A:2
    const b = createVectorClock('B').increment();              // B:1

    const merged = a.merge(b);
    assert.equal(merged.get('A'), 2);
    assert.equal(merged.get('B'), 1);
    assert.equal(merged.nodeId, 'A'); // preserves nodeId
  });

  it('merge of equal clocks yields same values', () => {
    const a = createVectorClock('A').increment();
    const b = a.clone();
    const merged = a.merge(b);
    assert.deepEqual(merged.toJSON(), a.toJSON());
  });

  it('merge does not auto-increment', () => {
    const a = createVectorClock('A').increment(); // A:1
    const b = createVectorClock('B').increment(); // B:1
    const merged = a.merge(b);
    // Should still be A:1, B:1 (no +1 applied)
    assert.equal(merged.get('A'), 1);
    assert.equal(merged.get('B'), 1);
  });
});

describe('VectorClock – causality', () => {
  it('happensBefore detects causal ordering', () => {
    const a1 = createVectorClock('A').increment(); // {A:1}
    const a2 = a1.increment();                     // {A:2}
    assert.equal(a1.happensBefore(a2), true);
    assert.equal(a2.happensBefore(a1), false);
  });

  it('happensAfter is the inverse of happensBefore', () => {
    const a1 = createVectorClock('A').increment();
    const a2 = a1.increment();
    assert.equal(a2.happensAfter(a1), true);
    assert.equal(a1.happensAfter(a2), false);
  });

  it('concurrent events on different nodes', () => {
    const a = createVectorClock('A').increment(); // {A:1}
    const b = createVectorClock('B').increment(); // {B:1}
    assert.equal(a.isConcurrent(b), true);
    assert.equal(b.isConcurrent(a), true);
  });

  it('merged clocks happen after both parents', () => {
    const a = createVectorClock('A').increment();
    const b = createVectorClock('B').increment();
    const m = a.merge(b).increment(); // {A:2, B:1}
    assert.equal(a.happensBefore(m), true);
    assert.equal(b.happensBefore(m), true);
  });
});

describe('compareClocks', () => {
  it('returns equal for two fresh clocks', () => {
    const a = createVectorClock('A');
    const b = createVectorClock('B');
    assert.equal(compareClocks(a, b), 'equal');
  });

  it('returns before / after correctly', () => {
    const a = createVectorClock('A').increment();
    const a2 = a.increment();
    assert.equal(compareClocks(a, a2), 'before');
    assert.equal(compareClocks(a2, a), 'after');
  });

  it('returns concurrent for independent events', () => {
    const a = createVectorClock('A').increment();
    const b = createVectorClock('B').increment();
    assert.equal(compareClocks(a, b), 'concurrent');
  });
});

describe('VectorClock – clone and toJSON', () => {
  it('clone produces an independent copy', () => {
    const a = createVectorClock('A').increment();
    const c = a.clone();
    assert.deepEqual(c.toJSON(), a.toJSON());
    assert.equal(c.nodeId, a.nodeId);
    assert.notEqual(c, a);
    // Mutating the clone (via increment) does not affect original
    const c2 = c.increment();
    assert.equal(a.get('A'), 1);
    assert.equal(c2.get('A'), 2);
  });

  it('toJSON returns a plain object snapshot', () => {
    const c = createVectorClock('A').increment().increment();
    const json = c.toJSON();
    assert.deepEqual(json, { A: 2 });
    // Modifying the returned object should not affect the clock
    json.A = 999;
    assert.equal(c.get('A'), 2);
  });
});
