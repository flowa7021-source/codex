// ─── Unit Tests: RxObservable ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RxObservable,
  of,
  from,
  interval,
  fromPromise,
} from '../../app/modules/rx-observable.js';

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('RxObservable – subscribe', () => {
  it('delivers values via observer object', () => {
    const received = [];
    const obs = new RxObservable((observer) => {
      observer.next(1);
      observer.next(2);
      observer.complete?.();
    });
    obs.subscribe({ next: (v) => received.push(v) });
    assert.deepEqual(received, [1, 2]);
  });

  it('delivers values via function shorthand', () => {
    const received = [];
    of(10, 20, 30).subscribe((v) => received.push(v));
    assert.deepEqual(received, [10, 20, 30]);
  });

  it('calls complete handler when observable completes', () => {
    let completed = false;
    of(1).subscribe({ next: () => {}, complete: () => { completed = true; } });
    assert.equal(completed, true);
  });

  it('calls error handler on error', () => {
    let caughtErr = null;
    const obs = new RxObservable((observer) => {
      observer.error?.(new Error('boom'));
    });
    obs.subscribe({ next: () => {}, error: (e) => { caughtErr = e; } });
    assert.ok(caughtErr instanceof Error);
    assert.equal(/** @type {Error} */(caughtErr).message, 'boom');
  });

  it('subscribe returns a Subscription object', () => {
    const sub = of(1).subscribe(() => {});
    assert.equal(typeof sub.unsubscribe, 'function');
    assert.equal(typeof sub.closed, 'boolean');
  });
});

// ─── Subscription ─────────────────────────────────────────────────────────────

describe('Subscription', () => {
  it('closed is false before unsubscribe', () => {
    const obs = new RxObservable(() => {}); // never completes
    const sub = obs.subscribe(() => {});
    assert.equal(sub.closed, false);
  });

  it('closed is true after unsubscribe', () => {
    const obs = new RxObservable(() => {});
    const sub = obs.subscribe(() => {});
    sub.unsubscribe();
    assert.equal(sub.closed, true);
  });

  it('closed is true after observable completes', () => {
    let sub;
    of(1).subscribe({
      next: () => {},
      complete: () => {},
      // capture the sub externally
    });
    // Re-check via direct subscribe capture
    let capturedSub;
    of(42).subscribe({
      next: () => {},
      complete() { /* capturedSub.closed will be true by here */ },
    });
    // verify via a simpler pattern
    const received = [];
    capturedSub = of(1, 2, 3).subscribe({ next: (v) => received.push(v) });
    // after synchronous completion, closed should be true
    assert.equal(capturedSub.closed, true);
  });

  it('unsubscribe stops value delivery', () => {
    const received = [];
    let emitter;
    const obs = new RxObservable((observer) => {
      emitter = observer;
    });
    const sub = obs.subscribe((v) => received.push(v));
    emitter.next(1);
    sub.unsubscribe();
    emitter.next(2);
    assert.deepEqual(received, [1]);
  });

  it('calling unsubscribe twice is safe', () => {
    const sub = of(1).subscribe(() => {});
    sub.unsubscribe();
    assert.doesNotThrow(() => sub.unsubscribe());
  });

  it('cleanup teardown runs on unsubscribe', () => {
    let cleaned = false;
    const obs = new RxObservable(() => {
      return () => { cleaned = true; };
    });
    const sub = obs.subscribe(() => {});
    assert.equal(cleaned, false);
    sub.unsubscribe();
    assert.equal(cleaned, true);
  });
});

// ─── map ──────────────────────────────────────────────────────────────────────

describe('RxObservable#map', () => {
  it('transforms each value', async () => {
    const result = await of(1, 2, 3).map((x) => x * 10).toArray();
    assert.deepEqual(result, [10, 20, 30]);
  });

  it('can chain multiple maps', async () => {
    const result = await of(1, 2).map((x) => x + 1).map((x) => x * 2).toArray();
    assert.deepEqual(result, [4, 6]);
  });

  it('propagates completion', async () => {
    let completed = false;
    await new Promise((resolve) => {
      of(1).map((x) => x).subscribe({ next: () => {}, complete: () => { completed = true; resolve(null); } });
    });
    assert.equal(completed, true);
  });
});

// ─── filter ───────────────────────────────────────────────────────────────────

describe('RxObservable#filter', () => {
  it('keeps only matching values', async () => {
    const result = await of(1, 2, 3, 4, 5).filter((x) => x % 2 === 0).toArray();
    assert.deepEqual(result, [2, 4]);
  });

  it('returns empty when nothing matches', async () => {
    const result = await of(1, 3, 5).filter((x) => x % 2 === 0).toArray();
    assert.deepEqual(result, []);
  });
});

// ─── take ─────────────────────────────────────────────────────────────────────

describe('RxObservable#take', () => {
  it('takes first n values', async () => {
    const result = await of(1, 2, 3, 4, 5).take(3).toArray();
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('take(0) returns empty and completes immediately', async () => {
    const result = await of(1, 2, 3).take(0).toArray();
    assert.deepEqual(result, []);
  });

  it('take more than available returns all', async () => {
    const result = await of(1, 2).take(10).toArray();
    assert.deepEqual(result, [1, 2]);
  });

  it('completes after n values from infinite stream', async () => {
    // Use a manually controlled observable
    const result = await new RxObservable((observer) => {
      let i = 0;
      const id = setInterval(() => observer.next(i++), 1);
      return () => clearInterval(id);
    }).take(3).toArray();
    assert.deepEqual(result, [0, 1, 2]);
  });
});

// ─── skip ─────────────────────────────────────────────────────────────────────

describe('RxObservable#skip', () => {
  it('skips first n values', async () => {
    const result = await of(1, 2, 3, 4, 5).skip(2).toArray();
    assert.deepEqual(result, [3, 4, 5]);
  });

  it('skip(0) returns all values', async () => {
    const result = await of(1, 2, 3).skip(0).toArray();
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('skip more than available returns empty', async () => {
    const result = await of(1, 2).skip(5).toArray();
    assert.deepEqual(result, []);
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('RxObservable#merge', () => {
  it('merges two synchronous observables', async () => {
    const result = await of(1, 2).merge(of(3, 4)).toArray();
    // A completes first (sync), then B — order is [1,2,3,4]
    assert.deepEqual(result, [1, 2, 3, 4]);
  });

  it('completes only when both sources complete', async () => {
    let completed = false;
    await new Promise((resolve) => {
      of(1).merge(of(2)).subscribe({
        next: () => {},
        complete: () => { completed = true; resolve(null); },
      });
    });
    assert.equal(completed, true);
  });

  it('forwards errors from either source', () => {
    const err = new Error('fail');
    const errObs = new RxObservable((observer) => { observer.error?.(err); });
    let received = null;
    of(1).merge(errObs).subscribe({ next: () => {}, error: (e) => { received = e; } });
    assert.strictEqual(received, err);
  });

  it('unsubscribe tears down both sources', () => {
    let cleanedA = false;
    let cleanedB = false;
    const a = new RxObservable(() => () => { cleanedA = true; });
    const b = new RxObservable(() => () => { cleanedB = true; });
    const sub = a.merge(b).subscribe(() => {});
    sub.unsubscribe();
    assert.equal(cleanedA, true);
    assert.equal(cleanedB, true);
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe('RxObservable#toArray', () => {
  it('resolves with all emitted values', async () => {
    const result = await of(5, 6, 7).toArray();
    assert.deepEqual(result, [5, 6, 7]);
  });

  it('resolves with empty array for empty observable', async () => {
    const result = await of().toArray();
    assert.deepEqual(result, []);
  });

  it('rejects on error', async () => {
    const obs = new RxObservable((observer) => { observer.error?.(new Error('x')); });
    await assert.rejects(() => obs.toArray());
  });
});

// ─── of ───────────────────────────────────────────────────────────────────────

describe('of()', () => {
  it('emits all args then completes', async () => {
    const result = await of('a', 'b', 'c').toArray();
    assert.deepEqual(result, ['a', 'b', 'c']);
  });

  it('emits nothing for zero args', async () => {
    const result = await of().toArray();
    assert.deepEqual(result, []);
  });
});

// ─── from ─────────────────────────────────────────────────────────────────────

describe('from()', () => {
  it('emits values from an array', async () => {
    const result = await from([10, 20, 30]).toArray();
    assert.deepEqual(result, [10, 20, 30]);
  });

  it('emits values from a Set', async () => {
    const result = await from(new Set([1, 2, 3])).toArray();
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('emits characters from a string', async () => {
    const result = await from('abc').toArray();
    assert.deepEqual(result, ['a', 'b', 'c']);
  });

  it('handles empty iterable', async () => {
    const result = await from([]).toArray();
    assert.deepEqual(result, []);
  });
});

// ─── interval ─────────────────────────────────────────────────────────────────

describe('interval()', () => {
  it('emits incrementing integers starting from 0', async () => {
    const result = await interval(10).take(4).toArray();
    assert.deepEqual(result, [0, 1, 2, 3]);
  });

  it('can be unsubscribed to stop', (t, done) => {
    const received = [];
    const sub = interval(10).subscribe((v) => received.push(v));
    setTimeout(() => {
      sub.unsubscribe();
      assert.equal(sub.closed, true);
      done();
    }, 35);
  });
});

// ─── fromPromise ──────────────────────────────────────────────────────────────

describe('fromPromise()', () => {
  it('emits resolved value then completes', async () => {
    const result = await fromPromise(Promise.resolve(42)).toArray();
    assert.deepEqual(result, [42]);
  });

  it('emits error on rejection', async () => {
    const obs = fromPromise(Promise.reject(new Error('rejected')));
    await assert.rejects(() => obs.toArray());
  });
});
