// ─── Unit Tests: observable ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Observable,
  observable,
  combineLatest,
} from '../../app/modules/observable.js';

// ─── observable() factory ─────────────────────────────────────────────────────

describe('observable()', () => {
  it('creates an Observable with the given initial value', () => {
    const o = observable(42);
    assert.ok(o instanceof Observable);
    assert.equal(o.value, 42);
  });

  it('works with string initial values', () => {
    const o = observable('hello');
    assert.equal(o.value, 'hello');
  });

  it('works with null initial values', () => {
    const o = observable(null);
    assert.equal(o.value, null);
  });
});

// ─── value getter ─────────────────────────────────────────────────────────────

describe('value getter', () => {
  it('returns the current value', () => {
    const o = new Observable(10);
    assert.equal(o.value, 10);
  });

  it('reflects updates after assignment', () => {
    const o = new Observable(10);
    o.value = 20;
    assert.equal(o.value, 20);
  });
});

// ─── value setter ─────────────────────────────────────────────────────────────

describe('value setter', () => {
  it('updates the stored value', () => {
    const o = new Observable('a');
    o.value = 'b';
    assert.equal(o.value, 'b');
  });

  it('accepts falsy values', () => {
    const o = new Observable(1);
    o.value = 0;
    assert.equal(o.value, 0);
  });

  it('accepts object values', () => {
    const obj = { x: 1 };
    const o = new Observable({});
    o.value = obj;
    assert.strictEqual(o.value, obj);
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('subscribe()', () => {
  it('calls the callback with the new and previous value when changed', () => {
    const o = new Observable(1);
    const calls = [];
    o.subscribe((val, prev) => calls.push({ val, prev }));
    o.value = 2;
    o.value = 3;
    assert.deepEqual(calls, [
      { val: 2, prev: 1 },
      { val: 3, prev: 2 },
    ]);
  });

  it('does not call subscriber when value is set to the same reference', () => {
    const o = new Observable(5);
    let calls = 0;
    o.subscribe(() => { calls++; });
    o.value = 5; // same value
    assert.equal(calls, 0);
  });

  it('returns an unsubscribe function', () => {
    const o = new Observable(0);
    const unsubscribe = o.subscribe(() => {});
    assert.equal(typeof unsubscribe, 'function');
  });

  it('multiple subscribers are all called', () => {
    const o = new Observable('start');
    const log1 = [];
    const log2 = [];
    o.subscribe((v) => log1.push(v));
    o.subscribe((v) => log2.push(v));
    o.value = 'end';
    assert.deepEqual(log1, ['end']);
    assert.deepEqual(log2, ['end']);
  });
});

// ─── subscribe unsubscribe ────────────────────────────────────────────────────

describe('subscribe() with unsubscribe', () => {
  it('no longer calls callback after unsubscribing', () => {
    const o = new Observable(0);
    const received = [];
    const unsubscribe = o.subscribe((v) => received.push(v));
    o.value = 1;
    unsubscribe();
    o.value = 2;
    assert.deepEqual(received, [1]);
  });

  it('calling unsubscribe twice is safe', () => {
    const o = new Observable(0);
    const unsubscribe = o.subscribe(() => {});
    unsubscribe();
    assert.doesNotThrow(() => unsubscribe());
  });
});

// ─── once ─────────────────────────────────────────────────────────────────────

describe('once()', () => {
  it('calls the callback only once', () => {
    const o = new Observable(0);
    const received = [];
    o.once((v) => received.push(v));
    o.value = 1;
    o.value = 2;
    o.value = 3;
    assert.deepEqual(received, [1]);
  });

  it('passes new and previous value to callback', () => {
    const o = new Observable('a');
    let args = null;
    o.once((val, prev) => { args = { val, prev }; });
    o.value = 'b';
    assert.deepEqual(args, { val: 'b', prev: 'a' });
  });

  it('returns an unsubscribe function that cancels before first call', () => {
    const o = new Observable(0);
    const received = [];
    const cancel = o.once((v) => received.push(v));
    cancel();
    o.value = 1;
    assert.deepEqual(received, []);
  });
});

// ─── map ──────────────────────────────────────────────────────────────────────

describe('map()', () => {
  it('applies transform to current value and returns result', () => {
    const o = new Observable(5);
    const result = o.map((v) => v * 2);
    assert.equal(result, 10);
  });

  it('works with string transforms', () => {
    const o = new Observable('hello');
    const result = o.map((v) => v.toUpperCase());
    assert.equal(result, 'HELLO');
  });

  it('reflects the current value — not stale after assignment', () => {
    const o = new Observable(1);
    o.value = 7;
    assert.equal(o.map((v) => v + 1), 8);
  });
});

// ─── derive ───────────────────────────────────────────────────────────────────

describe('derive()', () => {
  it('creates a new Observable with initial derived value', () => {
    const o = new Observable(4);
    const derived = o.derive((v) => v * v);
    assert.ok(derived instanceof Observable);
    assert.equal(derived.value, 16);
  });

  it('updates when the parent observable changes', () => {
    const o = new Observable(2);
    const derived = o.derive((v) => v * 10);
    o.value = 5;
    assert.equal(derived.value, 50);
  });

  it('derived observable can be subscribed to', () => {
    const o = new Observable(1);
    const doubled = o.derive((v) => v * 2);
    const received = [];
    doubled.subscribe((v) => received.push(v));
    o.value = 3;
    o.value = 5;
    assert.deepEqual(received, [6, 10]);
  });

  it('multiple derives from same parent all update independently', () => {
    const o = new Observable(10);
    const plus1 = o.derive((v) => v + 1);
    const times2 = o.derive((v) => v * 2);
    o.value = 20;
    assert.equal(plus1.value, 21);
    assert.equal(times2.value, 40);
  });
});

// ─── when ─────────────────────────────────────────────────────────────────────

describe('when()', () => {
  it('resolves immediately if predicate is already true', async () => {
    const o = new Observable(10);
    const result = await o.when((v) => v > 5);
    assert.equal(result, 10);
  });

  it('waits until value satisfies the predicate', async () => {
    const o = new Observable(0);
    const p = o.when((v) => v >= 3);
    o.value = 1;
    o.value = 2;
    o.value = 3;
    const result = await p;
    assert.equal(result, 3);
  });

  it('resolves with the value that satisfies the predicate', async () => {
    const o = new Observable('');
    const p = o.when((v) => v.length > 3);
    o.value = 'hi';
    o.value = 'hello';
    const result = await p;
    assert.equal(result, 'hello');
  });
});

// ─── subscriberCount ─────────────────────────────────────────────────────────

describe('subscriberCount', () => {
  it('starts at 0 for a new observable', () => {
    const o = new Observable(0);
    assert.equal(o.subscriberCount, 0);
  });

  it('increments when subscribers are added', () => {
    const o = new Observable(0);
    o.subscribe(() => {});
    o.subscribe(() => {});
    assert.equal(o.subscriberCount, 2);
  });

  it('decrements when a subscriber unsubscribes', () => {
    const o = new Observable(0);
    const unsub1 = o.subscribe(() => {});
    const unsub2 = o.subscribe(() => {});
    assert.equal(o.subscriberCount, 2);
    unsub1();
    assert.equal(o.subscriberCount, 1);
    unsub2();
    assert.equal(o.subscriberCount, 0);
  });

  it('once() subscriber is removed automatically after firing', () => {
    const o = new Observable(0);
    o.once(() => {});
    assert.equal(o.subscriberCount, 1);
    o.value = 1;
    assert.equal(o.subscriberCount, 0);
  });
});

// ─── combineLatest ────────────────────────────────────────────────────────────

describe('combineLatest()', () => {
  it('creates an observable with initial combined values', () => {
    const a = observable(1);
    const b = observable('hello');
    const combined = combineLatest(a, b);
    assert.ok(combined instanceof Observable);
    assert.deepEqual(combined.value, [1, 'hello']);
  });

  it('updates when any source observable changes', () => {
    const a = observable(10);
    const b = observable(20);
    const combined = combineLatest(a, b);

    a.value = 99;
    assert.deepEqual(combined.value, [99, 20]);

    b.value = 42;
    assert.deepEqual(combined.value, [99, 42]);
  });

  it('notifies subscribers on any change', () => {
    const x = observable(0);
    const y = observable(0);
    const combined = combineLatest(x, y);
    const log = [];
    combined.subscribe((v) => log.push([...v]));

    x.value = 1;
    y.value = 2;
    x.value = 3;

    assert.deepEqual(log, [
      [1, 0],
      [1, 2],
      [3, 2],
    ]);
  });

  it('works with a single observable', () => {
    const a = observable(7);
    const combined = combineLatest(a);
    assert.deepEqual(combined.value, [7]);
    a.value = 14;
    assert.deepEqual(combined.value, [14]);
  });

  it('handles three observables', () => {
    const a = observable(1);
    const b = observable(2);
    const c = observable(3);
    const combined = combineLatest(a, b, c);
    assert.deepEqual(combined.value, [1, 2, 3]);
    b.value = 99;
    assert.deepEqual(combined.value, [1, 99, 3]);
  });
});
