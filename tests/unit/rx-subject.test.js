// ─── Unit Tests: RxSubject ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RxSubject,
  ReplaySubject,
  BehaviorSubject,
  AsyncSubject,
} from '../../app/modules/rx-subject.js';

// ─── RxSubject – basics ───────────────────────────────────────────────────────

describe('RxSubject – basics', () => {
  it('starts open (closed = false)', () => {
    const s = new RxSubject();
    assert.equal(s.closed, false);
  });

  it('delivers next to active subscribers', () => {
    const s = new RxSubject();
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(1);
    s.next(2);
    assert.deepEqual(received, [1, 2]);
  });

  it('broadcasts to multiple subscribers', () => {
    const s = new RxSubject();
    const log1 = [];
    const log2 = [];
    s.subscribe((v) => log1.push(v));
    s.subscribe((v) => log2.push(v));
    s.next('hello');
    assert.deepEqual(log1, ['hello']);
    assert.deepEqual(log2, ['hello']);
  });

  it('observerCount reflects active subscriptions', () => {
    const s = new RxSubject();
    assert.equal(s.observerCount, 0);
    const sub1 = s.subscribe(() => {});
    const sub2 = s.subscribe(() => {});
    assert.equal(s.observerCount, 2);
    sub1.unsubscribe();
    assert.equal(s.observerCount, 1);
    sub2.unsubscribe();
    assert.equal(s.observerCount, 0);
  });
});

// ─── RxSubject – complete ─────────────────────────────────────────────────────

describe('RxSubject – complete()', () => {
  it('calls complete on all subscribers then closes', () => {
    const s = new RxSubject();
    let completed = false;
    s.subscribe({ next: () => {}, complete: () => { completed = true; } });
    s.complete();
    assert.equal(completed, true);
    assert.equal(s.closed, true);
  });

  it('ignores next() after complete()', () => {
    const s = new RxSubject();
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(1);
    s.complete();
    s.next(2);
    assert.deepEqual(received, [1]);
  });

  it('new subscriber after complete() gets complete immediately', () => {
    const s = new RxSubject();
    s.complete();
    let completed = false;
    s.subscribe({ next: () => {}, complete: () => { completed = true; } });
    assert.equal(completed, true);
  });

  it('calling complete() twice is safe', () => {
    const s = new RxSubject();
    s.complete();
    assert.doesNotThrow(() => s.complete());
  });
});

// ─── RxSubject – error ────────────────────────────────────────────────────────

describe('RxSubject – error()', () => {
  it('propagates error to all subscribers', () => {
    const s = new RxSubject();
    const errors = [];
    s.subscribe({ next: () => {}, error: (e) => errors.push(e) });
    s.subscribe({ next: () => {}, error: (e) => errors.push(e) });
    const err = new Error('oops');
    s.error(err);
    assert.equal(errors.length, 2);
    assert.strictEqual(errors[0], err);
    assert.strictEqual(errors[1], err);
  });

  it('closes the subject on error', () => {
    const s = new RxSubject();
    s.subscribe({ next: () => {}, error: () => {} });
    s.error(new Error('bad'));
    assert.equal(s.closed, true);
  });

  it('late subscriber gets error immediately after subject errored', () => {
    const s = new RxSubject();
    const err = new Error('x');
    s.error(err);
    let received = null;
    s.subscribe({ next: () => {}, error: (e) => { received = e; } });
    assert.strictEqual(received, err);
  });
});

// ─── RxSubject – late subscribers ────────────────────────────────────────────

describe('RxSubject – late subscribers get nothing (no replay)', () => {
  it('does not replay past values to new subscriber', () => {
    const s = new RxSubject();
    s.next(1);
    s.next(2);
    const received = [];
    s.subscribe((v) => received.push(v));
    assert.deepEqual(received, []);
  });

  it('late subscriber receives future values normally', () => {
    const s = new RxSubject();
    s.next(1);
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(2);
    s.next(3);
    assert.deepEqual(received, [2, 3]);
  });
});

// ─── ReplaySubject ────────────────────────────────────────────────────────────

describe('ReplaySubject', () => {
  it('replays all buffered values to new subscriber (default = Infinity)', () => {
    const s = new ReplaySubject();
    s.next(10);
    s.next(20);
    s.next(30);
    const received = [];
    s.subscribe((v) => received.push(v));
    assert.deepEqual(received, [10, 20, 30]);
  });

  it('respects bufferSize limit', () => {
    const s = new ReplaySubject(2);
    s.next(1);
    s.next(2);
    s.next(3);
    const received = [];
    s.subscribe((v) => received.push(v));
    assert.deepEqual(received, [2, 3]);
  });

  it('buffer getter returns snapshot', () => {
    const s = new ReplaySubject(3);
    s.next('a');
    s.next('b');
    assert.deepEqual(s.buffer, ['a', 'b']);
  });

  it('new subscriber after complete() gets buffered values + complete', () => {
    const s = new ReplaySubject(2);
    s.next(1);
    s.next(2);
    s.complete();
    const received = [];
    let completed = false;
    s.subscribe({ next: (v) => received.push(v), complete: () => { completed = true; } });
    assert.deepEqual(received, [1, 2]);
    assert.equal(completed, true);
  });

  it('live subscriber receives values as they arrive', () => {
    const s = new ReplaySubject(2);
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(1);
    s.next(2);
    assert.deepEqual(received, [1, 2]);
  });

  it('late subscriber gets replay + future values', () => {
    const s = new ReplaySubject(2);
    s.next(1);
    s.next(2);
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(3);
    assert.deepEqual(received, [1, 2, 3]);
  });
});

// ─── BehaviorSubject ──────────────────────────────────────────────────────────

describe('BehaviorSubject', () => {
  it('exposes current value via .value', () => {
    const s = new BehaviorSubject(42);
    assert.equal(s.value, 42);
  });

  it('new subscriber immediately receives current value', () => {
    const s = new BehaviorSubject('hello');
    const received = [];
    s.subscribe((v) => received.push(v));
    assert.deepEqual(received, ['hello']);
  });

  it('value updates on next()', () => {
    const s = new BehaviorSubject(0);
    s.next(1);
    s.next(2);
    assert.equal(s.value, 2);
  });

  it('new subscriber after next() receives latest value', () => {
    const s = new BehaviorSubject(0);
    s.next(99);
    const received = [];
    s.subscribe((v) => received.push(v));
    assert.deepEqual(received, [99]);
  });

  it('live subscriber gets initial value then updates', () => {
    const s = new BehaviorSubject(1);
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(2);
    s.next(3);
    assert.deepEqual(received, [1, 2, 3]);
  });

  it('multiple subscribers each get current value on subscribe', () => {
    const s = new BehaviorSubject(7);
    const log1 = [];
    const log2 = [];
    s.subscribe((v) => log1.push(v));
    s.subscribe((v) => log2.push(v));
    assert.deepEqual(log1, [7]);
    assert.deepEqual(log2, [7]);
  });

  it('new subscriber after complete gets current value + complete', () => {
    const s = new BehaviorSubject(5);
    s.next(10);
    s.complete();
    const received = [];
    let completed = false;
    s.subscribe({ next: (v) => received.push(v), complete: () => { completed = true; } });
    assert.deepEqual(received, [10]);
    assert.equal(completed, true);
  });
});

// ─── AsyncSubject ─────────────────────────────────────────────────────────────

describe('AsyncSubject', () => {
  it('emits nothing until complete()', () => {
    const s = new AsyncSubject();
    const received = [];
    s.subscribe((v) => received.push(v));
    s.next(1);
    s.next(2);
    assert.deepEqual(received, []);
  });

  it('emits only the last value on complete()', () => {
    const s = new AsyncSubject();
    const received = [];
    let completed = false;
    s.subscribe({ next: (v) => received.push(v), complete: () => { completed = true; } });
    s.next(1);
    s.next(2);
    s.next(3);
    s.complete();
    assert.deepEqual(received, [3]);
    assert.equal(completed, true);
  });

  it('emits nothing and completes if complete() with no values', () => {
    const s = new AsyncSubject();
    const received = [];
    let completed = false;
    s.subscribe({ next: (v) => received.push(v), complete: () => { completed = true; } });
    s.complete();
    assert.deepEqual(received, []);
    assert.equal(completed, true);
  });

  it('late subscriber after complete gets last value + complete', () => {
    const s = new AsyncSubject();
    s.next(99);
    s.complete();
    const received = [];
    let completed = false;
    s.subscribe({ next: (v) => received.push(v), complete: () => { completed = true; } });
    assert.deepEqual(received, [99]);
    assert.equal(completed, true);
  });

  it('late subscriber after complete with no values gets only complete', () => {
    const s = new AsyncSubject();
    s.complete();
    const received = [];
    let completed = false;
    s.subscribe({ next: (v) => received.push(v), complete: () => { completed = true; } });
    assert.deepEqual(received, []);
    assert.equal(completed, true);
  });

  it('multiple subscribers all get the last value on complete', () => {
    const s = new AsyncSubject();
    const log1 = [];
    const log2 = [];
    s.subscribe((v) => log1.push(v));
    s.subscribe((v) => log2.push(v));
    s.next('a');
    s.next('b');
    s.complete();
    assert.deepEqual(log1, ['b']);
    assert.deepEqual(log2, ['b']);
  });
});
