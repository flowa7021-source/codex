// ─── Unit Tests: Observable ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Observable,
  Computed,
  batch,
  createObservable,
  createComputed,
} from '../../app/modules/observable.js';

// ─── Observable: initial value and get ───────────────────────────────────────

describe('Observable – initial value and get', () => {
  it('stores the initial value passed to the constructor', () => {
    const o = new Observable(42);
    assert.equal(o.value, 42);
  });

  it('works with string initial values', () => {
    const o = new Observable('hello');
    assert.equal(o.value, 'hello');
  });

  it('works with null as initial value', () => {
    const o = new Observable(null);
    assert.equal(o.value, null);
  });

  it('works with false as initial value', () => {
    const o = new Observable(false);
    assert.equal(o.value, false);
  });

  it('works with an object as initial value', () => {
    const obj = { x: 1 };
    const o = new Observable(obj);
    assert.strictEqual(o.value, obj);
  });
});

// ─── Observable: set ─────────────────────────────────────────────────────────

describe('Observable – set', () => {
  it('updates the stored value', () => {
    const o = new Observable(1);
    o.set(2);
    assert.equal(o.value, 2);
  });

  it('accepts falsy values including 0', () => {
    const o = new Observable(5);
    o.set(0);
    assert.equal(o.value, 0);
  });

  it('accepts an empty string', () => {
    const o = new Observable('non-empty');
    o.set('');
    assert.equal(o.value, '');
  });

  it('does not notify subscribers when value is strictly equal', () => {
    const o = new Observable(7);
    let calls = 0;
    o.subscribe(() => { calls++; });
    o.set(7);
    assert.equal(calls, 0);
  });

  it('notifies subscribers when value changes', () => {
    const o = new Observable(0);
    let calls = 0;
    o.subscribe(() => { calls++; });
    o.set(1);
    assert.equal(calls, 1);
  });
});

// ─── Observable: update ──────────────────────────────────────────────────────

describe('Observable – update', () => {
  it('applies the function and stores the result', () => {
    const o = new Observable(10);
    o.update((n) => n + 5);
    assert.equal(o.value, 15);
  });

  it('notifies subscribers after update', () => {
    const o = new Observable(1);
    const log = [];
    o.subscribe((v) => log.push(v));
    o.update((n) => n * 3);
    assert.deepEqual(log, [3]);
  });

  it('receives the current value as argument', () => {
    const o = new Observable('foo');
    o.update((s) => s.toUpperCase());
    assert.equal(o.value, 'FOO');
  });

  it('does not notify when the function returns the same value', () => {
    const o = new Observable(5);
    let calls = 0;
    o.subscribe(() => { calls++; });
    o.update((n) => n); // identity — no change
    assert.equal(calls, 0);
  });
});

// ─── Observable: subscribe ───────────────────────────────────────────────────

describe('Observable – subscribe', () => {
  it('receives the new value as first argument', () => {
    const o = new Observable(0);
    const received = [];
    o.subscribe((v) => received.push(v));
    o.set(99);
    assert.deepEqual(received, [99]);
  });

  it('receives the previous value as second argument', () => {
    const o = new Observable(10);
    let prevSeen;
    o.subscribe((_v, prev) => { prevSeen = prev; });
    o.set(20);
    assert.equal(prevSeen, 10);
  });

  it('tracks prev correctly across multiple changes', () => {
    const o = new Observable('a');
    const pairs = [];
    o.subscribe((v, prev) => pairs.push([v, prev]));
    o.set('b');
    o.set('c');
    assert.deepEqual(pairs, [
      ['b', 'a'],
      ['c', 'b'],
    ]);
  });

  it('multiple subscribers are all called on change', () => {
    const o = new Observable(0);
    const log1 = [];
    const log2 = [];
    o.subscribe((v) => log1.push(v));
    o.subscribe((v) => log2.push(v));
    o.set(1);
    assert.deepEqual(log1, [1]);
    assert.deepEqual(log2, [1]);
  });

  it('returns an unsubscribe function', () => {
    const o = new Observable(0);
    const unsub = o.subscribe(() => {});
    assert.equal(typeof unsub, 'function');
  });
});

// ─── Observable: unsubscribe ─────────────────────────────────────────────────

describe('Observable – unsubscribe', () => {
  it('subscriber is not called after unsubscribing', () => {
    const o = new Observable(0);
    const received = [];
    const unsub = o.subscribe((v) => received.push(v));
    o.set(1);
    unsub();
    o.set(2);
    assert.deepEqual(received, [1]);
  });

  it('calling unsubscribe twice does not throw', () => {
    const o = new Observable(0);
    const unsub = o.subscribe(() => {});
    unsub();
    assert.doesNotThrow(() => unsub());
  });

  it('only the unsubscribed callback is removed; others keep firing', () => {
    const o = new Observable(0);
    const log1 = [];
    const log2 = [];
    const unsub1 = o.subscribe((v) => log1.push(v));
    o.subscribe((v) => log2.push(v));
    o.set(1);
    unsub1();
    o.set(2);
    assert.deepEqual(log1, [1]);
    assert.deepEqual(log2, [1, 2]);
  });
});

// ─── Observable: once ────────────────────────────────────────────────────────

describe('Observable – once', () => {
  it('fires exactly once on the first change', () => {
    const o = new Observable(0);
    const received = [];
    o.once((v) => received.push(v));
    o.set(1);
    o.set(2);
    o.set(3);
    assert.deepEqual(received, [1]);
  });

  it('receives new and previous value', () => {
    const o = new Observable('start');
    let args = null;
    o.once((v, prev) => { args = { v, prev }; });
    o.set('end');
    assert.deepEqual(args, { v: 'end', prev: 'start' });
  });

  it('returns a cancel function that suppresses the callback', () => {
    const o = new Observable(0);
    const received = [];
    const cancel = o.once((v) => received.push(v));
    cancel();
    o.set(1);
    assert.deepEqual(received, []);
  });

  it('auto-cleanup: once subscriber does not appear after firing', () => {
    const o = new Observable(0);
    let fireCount = 0;
    o.once(() => { fireCount++; });
    o.set(1); // fires once
    o.set(2); // must not fire again
    o.set(3);
    assert.equal(fireCount, 1);
  });
});

// ─── Observable: pipe ────────────────────────────────────────────────────────

describe('Observable – pipe (derived observable)', () => {
  it('initialises the derived observable with the transformed value', () => {
    const o = new Observable(4);
    const doubled = o.pipe((n) => n * 2);
    assert.equal(doubled.value, 8);
  });

  it('derived value updates when the source changes', () => {
    const o = new Observable(3);
    const squared = o.pipe((n) => n * n);
    o.set(5);
    assert.equal(squared.value, 25);
  });

  it('derived observable is itself subscribable', () => {
    const o = new Observable(1);
    const upper = o.pipe((s) => String(s).toUpperCase());
    const log = [];
    upper.subscribe((v) => log.push(v));
    o.set(2);
    o.set(3);
    assert.deepEqual(log, ['2', '3']);
  });

  it('multiple pipe chains from the same source all update', () => {
    const o = new Observable(10);
    const plus1 = o.pipe((n) => n + 1);
    const times2 = o.pipe((n) => n * 2);
    o.set(20);
    assert.equal(plus1.value, 21);
    assert.equal(times2.value, 40);
  });

  it('chained pipes (pipe of a pipe) work correctly', () => {
    const o = new Observable(2);
    const doubled = o.pipe((n) => n * 2);
    const quadrupled = doubled.pipe((n) => n * 2);
    o.set(3);
    assert.equal(quadrupled.value, 12);
  });
});

// ─── Computed ─────────────────────────────────────────────────────────────────

describe('Computed – derived from observables', () => {
  it('computes initial value from deps', () => {
    const a = new Observable(2);
    const b = new Observable(3);
    const sum = new Computed([a, b], (x, y) => x + y);
    assert.equal(sum.value, 5);
  });

  it('recomputes when a single dep changes', () => {
    const a = new Observable(10);
    const doubled = new Computed([a], (x) => x * 2);
    a.set(7);
    assert.equal(doubled.value, 14);
  });

  it('recomputes when any dep in a multi-dep computed changes', () => {
    const a = new Observable(1);
    const b = new Observable(2);
    const c = new Observable(3);
    const total = new Computed([a, b, c], (x, y, z) => x + y + z);
    b.set(10);
    assert.equal(total.value, 14);
  });

  it('notifies subscribers when computed value changes', () => {
    const a = new Observable(0);
    const derived = new Computed([a], (x) => x * x);
    const log = [];
    derived.subscribe((v) => log.push(v));
    a.set(3);
    a.set(4);
    assert.deepEqual(log, [9, 16]);
  });

  it('passes new and prev to computed subscriber', () => {
    const a = new Observable(5);
    const derived = new Computed([a], (x) => x + 1);
    const pairs = [];
    derived.subscribe((v, prev) => pairs.push([v, prev]));
    a.set(9);
    assert.deepEqual(pairs, [[10, 6]]);
  });

  it('subscribe returns a working unsubscribe function', () => {
    const a = new Observable(0);
    const comp = new Computed([a], (x) => x);
    const log = [];
    const unsub = comp.subscribe((v) => log.push(v));
    a.set(1);
    unsub();
    a.set(2);
    assert.deepEqual(log, [1]);
  });
});

// ─── batch ────────────────────────────────────────────────────────────────────

describe('batch', () => {
  it('suppresses intermediate notifications, firing only once', () => {
    const o = new Observable(0);
    const log = [];
    o.subscribe((v) => log.push(v));
    batch(() => {
      o.set(1);
      o.set(2);
      o.set(3);
    });
    assert.deepEqual(log, [3]);
  });

  it('delivers the pre-batch value as prev', () => {
    const o = new Observable(10);
    const pairs = [];
    o.subscribe((v, prev) => pairs.push([v, prev]));
    batch(() => {
      o.set(20);
      o.set(30);
    });
    assert.deepEqual(pairs, [[30, 10]]);
  });

  it('does not notify at all when value is reset to original inside batch', () => {
    const o = new Observable(5);
    let calls = 0;
    o.subscribe(() => { calls++; });
    batch(() => {
      o.set(99);
      o.set(5); // back to original — strict-equal, so no notification queued
    });
    assert.equal(calls, 0);
  });

  it('batches multiple observables independently', () => {
    const a = new Observable(0);
    const b = new Observable(0);
    const logA = [];
    const logB = [];
    a.subscribe((v) => logA.push(v));
    b.subscribe((v) => logB.push(v));
    batch(() => {
      a.set(1);
      b.set(10);
      a.set(2);
      b.set(20);
    });
    assert.deepEqual(logA, [2]);
    assert.deepEqual(logB, [20]);
  });

  it('nested batch still notifies once at the outermost flush', () => {
    const o = new Observable(0);
    const log = [];
    o.subscribe((v) => log.push(v));
    batch(() => {
      batch(() => {
        o.set(1);
        o.set(2);
      });
      o.set(3);
    });
    assert.deepEqual(log, [3]);
  });

  it('computed inside batch fires once', () => {
    const a = new Observable(0);
    const comp = new Computed([a], (x) => x * 2);
    const log = [];
    comp.subscribe((v) => log.push(v));
    batch(() => {
      a.set(1);
      a.set(5);
    });
    assert.deepEqual(log, [10]);
  });
});

// ─── createObservable / createComputed factories ──────────────────────────────

describe('createObservable factory', () => {
  it('returns an Observable instance', () => {
    const o = createObservable(0);
    assert.ok(o instanceof Observable);
  });

  it('initial value is accessible via .value', () => {
    const o = createObservable('test');
    assert.equal(o.value, 'test');
  });

  it('supports set and subscribe like the class constructor', () => {
    const o = createObservable(1);
    const log = [];
    o.subscribe((v) => log.push(v));
    o.set(2);
    assert.deepEqual(log, [2]);
  });
});

describe('createComputed factory', () => {
  it('returns a Computed instance', () => {
    const a = createObservable(1);
    const c = createComputed([a], (x) => x);
    assert.ok(c instanceof Computed);
  });

  it('initial computed value is correct', () => {
    const a = createObservable(4);
    const b = createObservable(6);
    const sum = createComputed([a, b], (x, y) => x + y);
    assert.equal(sum.value, 10);
  });

  it('updates when deps change', () => {
    const x = createObservable(3);
    const squared = createComputed([x], (n) => n * n);
    x.set(5);
    assert.equal(squared.value, 25);
  });

  it('subscribe fires when computed value changes', () => {
    const a = createObservable(2);
    const comp = createComputed([a], (n) => n + 100);
    const log = [];
    comp.subscribe((v) => log.push(v));
    a.set(8);
    assert.deepEqual(log, [108]);
  });
});
