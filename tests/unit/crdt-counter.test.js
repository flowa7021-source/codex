// ─── Unit Tests: CRDT Counters ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  GCounter,
  PNCounter,
  createGCounter,
  createPNCounter,
} from '../../app/modules/crdt-counter.js';

// ─── GCounter ────────────────────────────────────────────────────────────────

describe('GCounter – basics', () => {
  it('starts at zero', () => {
    const c = new GCounter('a');
    assert.equal(c.value, 0);
  });

  it('exposes nodeId', () => {
    const c = new GCounter('node-1');
    assert.equal(c.nodeId, 'node-1');
  });

  it('increments by 1 by default', () => {
    const c = new GCounter('a');
    c.increment();
    assert.equal(c.value, 1);
  });

  it('increments by a custom amount', () => {
    const c = new GCounter('a');
    c.increment(5);
    assert.equal(c.value, 5);
    c.increment(3);
    assert.equal(c.value, 8);
  });

  it('throws on negative increment', () => {
    const c = new GCounter('a');
    assert.throws(() => c.increment(-1), RangeError);
  });

  it('toJSON returns per-node counts', () => {
    const c = new GCounter('a');
    c.increment(3);
    const json = c.toJSON();
    assert.deepEqual(json, { a: 3 });
  });
});

describe('GCounter – merge', () => {
  it('merges two independent counters', () => {
    const a = new GCounter('a');
    const b = new GCounter('b');
    a.increment(3);
    b.increment(7);
    const merged = a.merge(b);
    assert.equal(merged.value, 10);
    assert.equal(merged.nodeId, 'a');
  });

  it('takes the max for the same node across replicas', () => {
    const a1 = new GCounter('a');
    const a2 = new GCounter('a');
    a1.increment(5);
    a2.increment(3);
    const merged = a1.merge(a2);
    assert.equal(merged.value, 5);
  });

  it('merge is commutative', () => {
    const a = new GCounter('a');
    const b = new GCounter('b');
    a.increment(2);
    b.increment(4);
    assert.equal(a.merge(b).value, b.merge(a).value);
  });

  it('merge is idempotent', () => {
    const a = new GCounter('a');
    a.increment(3);
    const b = new GCounter('b');
    b.increment(5);
    const m1 = a.merge(b);
    const m2 = m1.merge(b);
    assert.equal(m1.value, m2.value);
  });

  it('merge does not mutate the originals', () => {
    const a = new GCounter('a');
    const b = new GCounter('b');
    a.increment(2);
    b.increment(3);
    a.merge(b);
    assert.equal(a.value, 2);
    assert.equal(b.value, 3);
  });
});

// ─── PNCounter ───────────────────────────────────────────────────────────────

describe('PNCounter – basics', () => {
  it('starts at zero', () => {
    const c = new PNCounter('a');
    assert.equal(c.value, 0);
  });

  it('exposes nodeId', () => {
    const c = new PNCounter('node-x');
    assert.equal(c.nodeId, 'node-x');
  });

  it('increments and decrements', () => {
    const c = new PNCounter('a');
    c.increment(10);
    c.decrement(3);
    assert.equal(c.value, 7);
  });

  it('allows negative net value', () => {
    const c = new PNCounter('a');
    c.decrement(5);
    assert.equal(c.value, -5);
  });

  it('defaults to amount 1', () => {
    const c = new PNCounter('a');
    c.increment();
    c.increment();
    c.decrement();
    assert.equal(c.value, 1);
  });
});

describe('PNCounter – merge', () => {
  it('merges two counters from different nodes', () => {
    const a = new PNCounter('a');
    const b = new PNCounter('b');
    a.increment(10);
    a.decrement(2);
    b.increment(5);
    b.decrement(1);
    const merged = a.merge(b);
    // a: 10-2=8, b: 5-1=4, total = 12
    assert.equal(merged.value, 12);
  });

  it('merge is commutative', () => {
    const a = new PNCounter('a');
    const b = new PNCounter('b');
    a.increment(7);
    a.decrement(2);
    b.increment(3);
    b.decrement(1);
    assert.equal(a.merge(b).value, b.merge(a).value);
  });

  it('merge does not mutate originals', () => {
    const a = new PNCounter('a');
    const b = new PNCounter('b');
    a.increment(5);
    b.decrement(3);
    a.merge(b);
    assert.equal(a.value, 5);
    assert.equal(b.value, -3);
  });
});

// ─── Factories ───────────────────────────────────────────────────────────────

describe('CRDT counter factories', () => {
  it('createGCounter returns a GCounter', () => {
    const c = createGCounter('f1');
    assert.equal(c.nodeId, 'f1');
    c.increment(4);
    assert.equal(c.value, 4);
  });

  it('createPNCounter returns a PNCounter', () => {
    const c = createPNCounter('f2');
    assert.equal(c.nodeId, 'f2');
    c.increment(3);
    c.decrement(1);
    assert.equal(c.value, 2);
  });
});
