// ─── Unit Tests: Lazy Evaluation & Infinite Sequences ────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Lazy,
  LazySeq,
  lazy,
  lazySeq,
  naturals,
  fibonacci,
  primes,
} from '../../app/modules/lazy.js';

// ─── Lazy ─────────────────────────────────────────────────────────────────────

describe('Lazy – value', () => {
  it('does not compute on construction', () => {
    let calls = 0;
    new Lazy(() => { calls++; return 42; });
    assert.equal(calls, 0);
  });

  it('computes on first access', () => {
    let calls = 0;
    const l = new Lazy(() => { calls++; return 42; });
    assert.equal(l.value, 42);
    assert.equal(calls, 1);
  });

  it('caches the result', () => {
    let calls = 0;
    const l = new Lazy(() => { calls++; return 7; });
    l.value; l.value; l.value;
    assert.equal(calls, 1);
  });

  it('isComputed reflects state', () => {
    const l = new Lazy(() => 1);
    assert.equal(l.isComputed, false);
    l.value;
    assert.equal(l.isComputed, true);
  });

  it('reset() clears cache', () => {
    let calls = 0;
    const l = new Lazy(() => { calls++; return 5; });
    l.value;
    l.reset();
    assert.equal(l.isComputed, false);
    l.value;
    assert.equal(calls, 2);
  });
});

describe('Lazy – map', () => {
  it('maps a lazy value', () => {
    const l = new Lazy(() => 10);
    const m = l.map(x => x * 2);
    assert.equal(m.value, 20);
  });

  it('map is also lazy', () => {
    let calls = 0;
    const l = new Lazy(() => 3);
    const m = l.map(x => { calls++; return x + 1; });
    assert.equal(calls, 0);
    m.value;
    assert.equal(calls, 1);
  });
});

describe('lazy factory', () => {
  it('creates a Lazy', () => {
    const l = lazy(() => 'hello');
    assert.equal(l.value, 'hello');
  });
});

// ─── LazySeq ─────────────────────────────────────────────────────────────────

describe('LazySeq – take', () => {
  it('takes n items', () => {
    const seq = lazySeq(function* () { let i = 0; while (true) yield i++; });
    assert.deepEqual(seq.take(5), [0, 1, 2, 3, 4]);
  });

  it('take(0) returns empty', () => {
    const seq = lazySeq(function* () { yield 1; });
    assert.deepEqual(seq.take(0), []);
  });

  it('can be called multiple times (restarts)', () => {
    const seq = lazySeq(function* () { yield 'a'; yield 'b'; });
    assert.deepEqual(seq.take(2), ['a', 'b']);
    assert.deepEqual(seq.take(2), ['a', 'b']);
  });
});

describe('LazySeq – takeWhile', () => {
  it('stops at first false', () => {
    const seq = lazySeq(function* () { let i = 0; while (true) yield i++; });
    assert.deepEqual(seq.takeWhile(x => x < 5), [0, 1, 2, 3, 4]);
  });
});

describe('LazySeq – map & filter', () => {
  it('maps', () => {
    const seq = lazySeq(function* () { yield 1; yield 2; yield 3; });
    assert.deepEqual(seq.map(x => x * 10).take(3), [10, 20, 30]);
  });

  it('filter', () => {
    const seq = lazySeq(function* () { let i = 0; while (true) yield i++; });
    assert.deepEqual(seq.filter(x => x % 2 === 0).take(4), [0, 2, 4, 6]);
  });
});

describe('LazySeq – find & nth', () => {
  it('find returns first match', () => {
    const seq = lazySeq(function* () { let i = 0; while (true) yield i++; });
    assert.equal(seq.find(x => x > 10), 11);
  });

  it('nth returns the correct item', () => {
    const seq = lazySeq(function* () { let i = 0; while (true) yield i++; });
    assert.equal(seq.nth(5), 5);
  });

  it('nth(-1) returns undefined', () => {
    const seq = lazySeq(function* () { yield 1; });
    assert.equal(seq.nth(-1), undefined);
  });
});

// ─── Built-in sequences ───────────────────────────────────────────────────────

describe('naturals', () => {
  it('starts at 0 by default', () => {
    assert.deepEqual(naturals().take(5), [0, 1, 2, 3, 4]);
  });

  it('starts at a custom value', () => {
    assert.deepEqual(naturals(10).take(3), [10, 11, 12]);
  });
});

describe('fibonacci', () => {
  it('produces correct sequence', () => {
    assert.deepEqual(fibonacci().take(8), [0, 1, 1, 2, 3, 5, 8, 13]);
  });
});

describe('primes', () => {
  it('starts with 2, 3, 5, 7, 11', () => {
    assert.deepEqual(primes().take(5), [2, 3, 5, 7, 11]);
  });

  it('100th prime is 541', () => {
    assert.equal(primes().nth(99), 541);
  });
});
