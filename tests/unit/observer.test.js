// ─── Unit Tests: Observer / Subject ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Subject,
  BehaviorSubject,
  ReplaySubject,
  createSubject,
  createBehaviorSubject,
  createReplaySubject,
} from '../../app/modules/observer.js';

// ---------------------------------------------------------------------------
// Subject: subscribe / next (basic notification)
// ---------------------------------------------------------------------------
describe('Subject – subscribe/next', () => {
  it('notifies a single observer', () => {
    const s = new Subject();
    const received = [];
    s.subscribe(v => received.push(v));
    s.next(1);
    assert.deepEqual(received, [1]);
  });

  it('notifies multiple observers', () => {
    const s = new Subject();
    const a = [], b = [];
    s.subscribe(v => a.push(v));
    s.subscribe(v => b.push(v));
    s.next('x');
    assert.deepEqual(a, ['x']);
    assert.deepEqual(b, ['x']);
  });

  it('accepts an Observer object with update method', () => {
    const s = new Subject();
    const received = [];
    s.subscribe({ update: v => received.push(v) });
    s.next(42);
    assert.deepEqual(received, [42]);
  });

  it('emits multiple values in order', () => {
    const s = new Subject();
    const log = [];
    s.subscribe(v => log.push(v));
    s.next(1);
    s.next(2);
    s.next(3);
    assert.deepEqual(log, [1, 2, 3]);
  });

  it('does not emit to observers added after next() was called', () => {
    const s = new Subject();
    const log = [];
    s.next(0);                        // no subscribers yet
    s.subscribe(v => log.push(v));
    assert.deepEqual(log, []);
  });

  it('subscribe returns a function', () => {
    const s = new Subject();
    const unsub = s.subscribe(() => {});
    assert.equal(typeof unsub, 'function');
  });
});

// ---------------------------------------------------------------------------
// Subject: unsubscribe function (returned from subscribe)
// ---------------------------------------------------------------------------
describe('Subject – unsubscribe function', () => {
  it('calling unsub stops notifications', () => {
    const s = new Subject();
    const log = [];
    const unsub = s.subscribe(v => log.push(v));
    s.next(1);
    unsub();
    s.next(2);
    assert.deepEqual(log, [1]);
  });

  it('calling unsub twice is safe', () => {
    const s = new Subject();
    const unsub = s.subscribe(() => {});
    unsub();
    assert.doesNotThrow(() => unsub());
  });

  it('unsubscribing one observer does not affect another', () => {
    const s = new Subject();
    const a = [], b = [];
    const unsubA = s.subscribe(v => a.push(v));
    s.subscribe(v => b.push(v));
    s.next(1);
    unsubA();
    s.next(2);
    assert.deepEqual(a, [1]);
    assert.deepEqual(b, [1, 2]);
  });

  it('unsubscribing inside next does not throw', () => {
    const s = new Subject();
    let unsub;
    const log = [];
    unsub = s.subscribe(v => {
      log.push(v);
      unsub();
    });
    assert.doesNotThrow(() => { s.next(1); s.next(2); });
    assert.deepEqual(log, [1]);
  });

  it('observerCount decrements after unsubscribe', () => {
    const s = new Subject();
    const unsub = s.subscribe(() => {});
    assert.equal(s.observerCount, 1);
    unsub();
    assert.equal(s.observerCount, 0);
  });
});

// ---------------------------------------------------------------------------
// Subject: error handling
// ---------------------------------------------------------------------------
describe('Subject – error handling', () => {
  it('calls error handler on observers that define it', () => {
    const s = new Subject();
    const errors = [];
    s.subscribe({ update: () => {}, error: e => errors.push(e.message) });
    const err = new Error('boom');
    s.error(err);
    assert.deepEqual(errors, ['boom']);
  });

  it('does not throw if observer has no error handler', () => {
    const s = new Subject();
    s.subscribe(() => {});
    assert.doesNotThrow(() => s.error(new Error('silent')));
  });

  it('sets hasError to true after error()', () => {
    const s = new Subject();
    s.subscribe(() => {});
    s.error(new Error('oops'));
    assert.equal(s.hasError, true);
  });

  it('stops future next() calls after error', () => {
    const s = new Subject();
    const log = [];
    s.subscribe({ update: v => log.push(v), error: () => {} });
    s.error(new Error('halt'));
    s.next(99);
    assert.deepEqual(log, []);
  });

  it('clears all observers after error()', () => {
    const s = new Subject();
    s.subscribe({ update: () => {}, error: () => {} });
    s.subscribe({ update: () => {}, error: () => {} });
    s.error(new Error('x'));
    assert.equal(s.observerCount, 0);
  });

  it('calling error() twice has no extra effect', () => {
    const s = new Subject();
    const errors = [];
    s.subscribe({ update: () => {}, error: e => errors.push(e) });
    s.error(new Error('first'));
    s.error(new Error('second'));
    assert.equal(errors.length, 1);
  });

  it('subscribing after error returns a no-op unsubscribe', () => {
    const s = new Subject();
    s.error(new Error('done'));
    const log = [];
    const unsub = s.subscribe(v => log.push(v));
    s.next(1);
    assert.deepEqual(log, []);
    assert.doesNotThrow(() => unsub());
  });
});

// ---------------------------------------------------------------------------
// Subject: complete (no more notifications after complete)
// ---------------------------------------------------------------------------
describe('Subject – complete', () => {
  it('calls complete handler on all observers', () => {
    const s = new Subject();
    let called = 0;
    s.subscribe({ update: () => {}, complete: () => called++ });
    s.subscribe({ update: () => {}, complete: () => called++ });
    s.complete();
    assert.equal(called, 2);
  });

  it('sets isCompleted to true', () => {
    const s = new Subject();
    s.complete();
    assert.equal(s.isCompleted, true);
  });

  it('stops future next() after complete', () => {
    const s = new Subject();
    const log = [];
    s.subscribe({ update: v => log.push(v), complete: () => {} });
    s.complete();
    s.next(1);
    assert.deepEqual(log, []);
  });

  it('clears observers after complete', () => {
    const s = new Subject();
    s.subscribe({ update: () => {}, complete: () => {} });
    s.complete();
    assert.equal(s.observerCount, 0);
  });

  it('calling complete() twice is harmless', () => {
    const s = new Subject();
    let count = 0;
    s.subscribe({ update: () => {}, complete: () => count++ });
    s.complete();
    s.complete();
    assert.equal(count, 1);
  });

  it('subscribing after complete returns a no-op', () => {
    const s = new Subject();
    s.complete();
    const log = [];
    s.subscribe(v => log.push(v));
    s.next(1);
    assert.deepEqual(log, []);
    assert.equal(s.observerCount, 0);
  });

  it('complete does not fire if error already emitted', () => {
    const s = new Subject();
    let completeCalled = false;
    s.subscribe({ update: () => {}, error: () => {}, complete: () => { completeCalled = true; } });
    s.error(new Error('err'));
    s.complete();
    assert.equal(completeCalled, false);
  });
});

// ---------------------------------------------------------------------------
// Subject: observerCount
// ---------------------------------------------------------------------------
describe('Subject – observerCount', () => {
  it('starts at 0', () => {
    const s = new Subject();
    assert.equal(s.observerCount, 0);
  });

  it('increments per subscribe', () => {
    const s = new Subject();
    s.subscribe(() => {});
    s.subscribe(() => {});
    assert.equal(s.observerCount, 2);
  });

  it('isCompleted and hasError start false', () => {
    const s = new Subject();
    assert.equal(s.isCompleted, false);
    assert.equal(s.hasError, false);
  });
});

// ---------------------------------------------------------------------------
// BehaviorSubject: emits current value on subscribe
// ---------------------------------------------------------------------------
describe('BehaviorSubject – emits current value on subscribe', () => {
  it('emits initial value synchronously on subscribe', () => {
    const bs = new BehaviorSubject(10);
    const log = [];
    bs.subscribe(v => log.push(v));
    assert.deepEqual(log, [10]);
  });

  it('emits latest value to a late subscriber', () => {
    const bs = new BehaviorSubject(0);
    bs.next(1);
    bs.next(2);
    const log = [];
    bs.subscribe(v => log.push(v));
    assert.deepEqual(log, [2]);
  });

  it('each new subscriber gets the current value independently', () => {
    const bs = new BehaviorSubject('hello');
    const a = [], b = [];
    bs.subscribe(v => a.push(v));
    bs.subscribe(v => b.push(v));
    assert.deepEqual(a, ['hello']);
    assert.deepEqual(b, ['hello']);
  });

  it('does not emit to new subscribers after complete', () => {
    const bs = new BehaviorSubject(5);
    bs.complete();
    const log = [];
    bs.subscribe(v => log.push(v));
    assert.deepEqual(log, []);
  });

  it('does not emit to new subscribers after error', () => {
    const bs = new BehaviorSubject(5);
    bs.error(new Error('x'));
    const log = [];
    bs.subscribe(v => log.push(v));
    assert.deepEqual(log, []);
  });
});

// ---------------------------------------------------------------------------
// BehaviorSubject: value getter
// ---------------------------------------------------------------------------
describe('BehaviorSubject – value getter', () => {
  it('returns the initial value', () => {
    const bs = new BehaviorSubject(42);
    assert.equal(bs.value, 42);
  });

  it('updates after next()', () => {
    const bs = new BehaviorSubject(0);
    bs.next(7);
    assert.equal(bs.value, 7);
  });

  it('value stays after complete', () => {
    const bs = new BehaviorSubject('keep');
    bs.complete();
    assert.equal(bs.value, 'keep');
  });
});

// ---------------------------------------------------------------------------
// BehaviorSubject: notifications work normally
// ---------------------------------------------------------------------------
describe('BehaviorSubject – notifications', () => {
  it('notifies subscribers on next()', () => {
    const bs = new BehaviorSubject(0);
    const log = [];
    bs.subscribe(v => log.push(v));  // gets 0 immediately
    bs.next(1);
    bs.next(2);
    assert.deepEqual(log, [0, 1, 2]);
  });

  it('unsubscribe stops future notifications', () => {
    const bs = new BehaviorSubject(0);
    const log = [];
    const unsub = bs.subscribe(v => log.push(v));
    unsub();
    bs.next(1);
    assert.deepEqual(log, [0]);
  });

  it('observerCount is correct', () => {
    const bs = new BehaviorSubject(0);
    assert.equal(bs.observerCount, 0);
    const unsub = bs.subscribe(() => {});
    assert.equal(bs.observerCount, 1);
    unsub();
    assert.equal(bs.observerCount, 0);
  });

  it('error on BehaviorSubject stops notifications', () => {
    const bs = new BehaviorSubject(0);
    const log = [];
    bs.subscribe({ update: v => log.push(v), error: () => {} });
    bs.error(new Error('fail'));
    bs.next(99);
    assert.deepEqual(log, [0]);
  });
});

// ---------------------------------------------------------------------------
// ReplaySubject: replays last N values on subscribe
// ---------------------------------------------------------------------------
describe('ReplaySubject – buffer replay', () => {
  it('replays last 1 value by default', () => {
    const rs = new ReplaySubject();
    rs.next(1);
    rs.next(2);
    rs.next(3);
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, [3]);
  });

  it('replays up to bufferSize values', () => {
    const rs = new ReplaySubject(3);
    rs.next(1);
    rs.next(2);
    rs.next(3);
    rs.next(4);
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, [2, 3, 4]);
  });

  it('replays fewer than bufferSize when not enough emitted', () => {
    const rs = new ReplaySubject(5);
    rs.next('a');
    rs.next('b');
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, ['a', 'b']);
  });

  it('new subscriber receives replayed then live values', () => {
    const rs = new ReplaySubject(2);
    rs.next(1);
    rs.next(2);
    const log = [];
    rs.subscribe(v => log.push(v));
    rs.next(3);
    assert.deepEqual(log, [1, 2, 3]);
  });

  it('subscriber after complete still receives replay then complete', () => {
    const rs = new ReplaySubject(2);
    rs.next(10);
    rs.next(20);
    rs.complete();
    const log = [];
    let completed = false;
    rs.subscribe({ update: v => log.push(v), complete: () => { completed = true; } });
    assert.deepEqual(log, [10, 20]);
    assert.equal(completed, true);
  });

  it('does not replay to observers if no values emitted', () => {
    const rs = new ReplaySubject(3);
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, []);
  });

  it('observerCount tracks active subscribers', () => {
    const rs = new ReplaySubject(1);
    assert.equal(rs.observerCount, 0);
    const unsub = rs.subscribe(() => {});
    assert.equal(rs.observerCount, 1);
    unsub();
    assert.equal(rs.observerCount, 0);
  });

  it('error() stops future nexts and calls error handlers', () => {
    const rs = new ReplaySubject(2);
    rs.next(1);
    const errors = [];
    const log = [];
    rs.subscribe({ update: v => log.push(v), error: e => errors.push(e.message) });
    rs.error(new Error('rs-err'));
    rs.next(99);
    assert.deepEqual(log, [1]);
    assert.deepEqual(errors, ['rs-err']);
    assert.equal(rs.observerCount, 0);
  });

  it('complete() clears observers and stops future nexts', () => {
    const rs = new ReplaySubject(1);
    let completed = false;
    rs.subscribe({ update: () => {}, complete: () => { completed = true; } });
    rs.complete();
    rs.next(99);
    assert.equal(completed, true);
    assert.equal(rs.observerCount, 0);
  });

  it('bufferSize of 0 is treated as 1', () => {
    const rs = new ReplaySubject(0);
    rs.next('only');
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, ['only']);
  });
});

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------
describe('Factory functions', () => {
  it('createSubject returns a Subject', () => {
    const s = createSubject();
    assert.ok(s instanceof Subject);
  });

  it('createSubject Subject works end-to-end', () => {
    const s = createSubject();
    const log = [];
    s.subscribe(v => log.push(v));
    s.next(1);
    s.next(2);
    assert.deepEqual(log, [1, 2]);
  });

  it('createBehaviorSubject returns a BehaviorSubject', () => {
    const bs = createBehaviorSubject(0);
    assert.ok(bs instanceof BehaviorSubject);
  });

  it('createBehaviorSubject emits initial value', () => {
    const bs = createBehaviorSubject('init');
    const log = [];
    bs.subscribe(v => log.push(v));
    assert.deepEqual(log, ['init']);
  });

  it('createBehaviorSubject value getter works', () => {
    const bs = createBehaviorSubject(99);
    assert.equal(bs.value, 99);
    bs.next(100);
    assert.equal(bs.value, 100);
  });

  it('createReplaySubject returns a ReplaySubject', () => {
    const rs = createReplaySubject();
    assert.ok(rs instanceof ReplaySubject);
  });

  it('createReplaySubject with default bufferSize replays 1 value', () => {
    const rs = createReplaySubject();
    rs.next('a');
    rs.next('b');
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, ['b']);
  });

  it('createReplaySubject with custom bufferSize', () => {
    const rs = createReplaySubject(3);
    rs.next(1);
    rs.next(2);
    rs.next(3);
    rs.next(4);
    const log = [];
    rs.subscribe(v => log.push(v));
    assert.deepEqual(log, [2, 3, 4]);
  });
});
