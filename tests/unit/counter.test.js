// ─── Unit Tests: Counter Patterns ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AtomicCounter,
  PNCounter,
  DistributedCounter,
} from '../../app/modules/counter.js';

// ─── AtomicCounter ────────────────────────────────────────────────────────────

describe('AtomicCounter', () => {
  it('initialises to 0 by default', () => {
    const c = new AtomicCounter();
    assert.equal(c.get(), 0);
  });

  it('initialises to a given value', () => {
    const c = new AtomicCounter(10);
    assert.equal(c.get(), 10);
  });

  it('increments by 1 by default', () => {
    const c = new AtomicCounter();
    assert.equal(c.increment(), 1);
    assert.equal(c.get(), 1);
  });

  it('increments by a custom amount', () => {
    const c = new AtomicCounter(5);
    assert.equal(c.increment(3), 8);
  });

  it('decrements by 1 by default', () => {
    const c = new AtomicCounter(5);
    assert.equal(c.decrement(), 4);
  });

  it('decrements by a custom amount', () => {
    const c = new AtomicCounter(10);
    assert.equal(c.decrement(4), 6);
  });

  it('set() overrides the value', () => {
    const c = new AtomicCounter(3);
    c.set(42);
    assert.equal(c.get(), 42);
  });

  it('reset() sets value to 0', () => {
    const c = new AtomicCounter(99);
    c.reset();
    assert.equal(c.get(), 0);
  });

  it('compareAndSwap succeeds when values match', () => {
    const c = new AtomicCounter(5);
    assert.equal(c.compareAndSwap(5, 10), true);
    assert.equal(c.get(), 10);
  });

  it('compareAndSwap fails when values do not match', () => {
    const c = new AtomicCounter(5);
    assert.equal(c.compareAndSwap(3, 10), false);
    assert.equal(c.get(), 5);
  });
});

// ─── PNCounter ────────────────────────────────────────────────────────────────

describe('PNCounter', () => {
  it('starts at 0', () => {
    const c = new PNCounter('A');
    assert.equal(c.value(), 0);
  });

  it('increments correctly', () => {
    const c = new PNCounter('A');
    c.increment(3);
    assert.equal(c.value(), 3);
  });

  it('decrements correctly', () => {
    const c = new PNCounter('A');
    c.increment(5);
    c.decrement(2);
    assert.equal(c.value(), 3);
  });

  it('merges two counters from different nodes', () => {
    const a = new PNCounter('A');
    const b = new PNCounter('B');
    a.increment(10);
    b.increment(5);
    a.merge(b);
    assert.equal(a.value(), 15);
  });

  it('merge is idempotent', () => {
    const a = new PNCounter('A');
    const b = new PNCounter('A');
    a.increment(4);
    b.increment(4);
    a.merge(b);
    assert.equal(a.value(), 4); // max, not sum
  });

  it('state() returns a defensive copy', () => {
    const c = new PNCounter('A');
    c.increment(2);
    const { p } = c.state();
    p['A'] = 999;
    assert.equal(c.value(), 2);
  });
});

// ─── DistributedCounter ───────────────────────────────────────────────────────

describe('DistributedCounter', () => {
  it('records events and returns count', () => {
    const dc = new DistributedCounter(1000);
    dc.record(100);
    dc.record(200);
    assert.equal(dc.count(300), 2);
  });

  it('expires events outside the window', () => {
    const dc = new DistributedCounter(1000);
    dc.record(0);
    dc.record(500);
    // at t=1100, the event at 0 is outside the 1000ms window
    assert.equal(dc.count(1100), 1);
  });

  it('record() returns updated count', () => {
    const dc = new DistributedCounter(5000);
    assert.equal(dc.record(1000), 1);
    assert.equal(dc.record(2000), 2);
  });

  it('advance() moves internal clock forward', () => {
    const dc = new DistributedCounter(1000);
    dc.record();      // recorded at internal now
    dc.advance(1001); // window expires
    assert.equal(dc.count(), 0);
  });

  it('count() without args uses internal clock', () => {
    const dc = new DistributedCounter(5000);
    dc.record();
    assert.equal(dc.count(), 1);
  });
});
