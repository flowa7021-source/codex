// ─── Unit Tests: Signals ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  signal,
  computed,
  effect,
  batch,
  isSignal,
  fromPromise,
  combine,
} from '../../app/modules/signal.js';

// ─── signal() basic ───────────────────────────────────────────────────────────

describe('signal() basic', () => {
  it('returns initial value when called', () => {
    const s = signal(10);
    assert.equal(s(), 10);
  });

  it('works with string initial value', () => {
    const s = signal('hello');
    assert.equal(s(), 'hello');
  });

  it('works with boolean initial value', () => {
    const s = signal(false);
    assert.equal(s(), false);
  });

  it('works with null initial value', () => {
    const s = signal(null);
    assert.equal(s(), null);
  });

  it('works with object initial value', () => {
    const s = signal({ a: 1 });
    assert.deepEqual(s(), { a: 1 });
  });

  it('set() updates the value', () => {
    const s = signal(0);
    s.set(5);
    assert.equal(s(), 5);
  });

  it('set() does not notify when value is unchanged (===)', () => {
    const s = signal(42);
    let callCount = 0;
    const unsub = s.subscribe(() => { callCount++; });
    callCount = 0; // reset after initial call
    s.set(42);
    assert.equal(callCount, 0);
    unsub();
  });

  it('update() applies function to current value', () => {
    const s = signal(3);
    s.update((v) => v * 2);
    assert.equal(s(), 6);
  });

  it('update() chains correctly', () => {
    const s = signal(1);
    s.update((v) => v + 1);
    s.update((v) => v + 1);
    assert.equal(s(), 3);
  });

  it('set() followed by () returns latest value', () => {
    const s = signal(0);
    s.set(7);
    s.set(8);
    assert.equal(s(), 8);
  });

  it('multiple independent signals do not interfere', () => {
    const a = signal(1);
    const b = signal(2);
    a.set(10);
    assert.equal(a(), 10);
    assert.equal(b(), 2);
  });
});

// ─── signal() subscribe ───────────────────────────────────────────────────────

describe('signal() subscribe', () => {
  it('calls callback immediately with current value', () => {
    const s = signal('init');
    let called;
    s.subscribe((v) => { called = v; });
    assert.equal(called, 'init');
  });

  it('receives each new value after set()', () => {
    const s = signal(0);
    const log = [];
    s.subscribe((v) => log.push(v));
    s.set(1);
    s.set(2);
    assert.deepEqual(log, [0, 1, 2]);
  });

  it('unsubscribe stops receiving updates', () => {
    const s = signal(0);
    const log = [];
    const unsub = s.subscribe((v) => log.push(v));
    s.set(1);
    unsub();
    s.set(2);
    assert.deepEqual(log, [0, 1]);
  });

  it('calling unsubscribe twice is safe', () => {
    const s = signal(0);
    const unsub = s.subscribe(() => {});
    unsub();
    assert.doesNotThrow(() => unsub());
  });

  it('multiple subscribers each receive updates', () => {
    const s = signal(0);
    const log1 = [];
    const log2 = [];
    s.subscribe((v) => log1.push(v));
    s.subscribe((v) => log2.push(v));
    s.set(5);
    assert.deepEqual(log1, [0, 5]);
    assert.deepEqual(log2, [0, 5]);
  });

  it('unsubscribing one does not affect the other', () => {
    const s = signal(0);
    const log1 = [];
    const log2 = [];
    const unsub1 = s.subscribe((v) => log1.push(v));
    s.subscribe((v) => log2.push(v));
    unsub1();
    s.set(3);
    assert.deepEqual(log1, [0]);
    assert.deepEqual(log2, [0, 3]);
  });

  it('subscribe returns a function', () => {
    const s = signal(0);
    const unsub = s.subscribe(() => {});
    assert.equal(typeof unsub, 'function');
    unsub();
  });
});

// ─── computed() ──────────────────────────────────────────────────────────────

describe('computed()', () => {
  it('derives initial value from signal', () => {
    const s = signal(4);
    const doubled = computed(() => s() * 2);
    assert.equal(doubled(), 8);
  });

  it('updates when dependency signal changes', () => {
    const s = signal(3);
    const triple = computed(() => s() * 3);
    assert.equal(triple(), 9);
    s.set(5);
    assert.equal(triple(), 15);
  });

  it('works with multiple dependencies', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a() + b());
    assert.equal(sum(), 3);
    a.set(10);
    assert.equal(sum(), 12);
    b.set(20);
    assert.equal(sum(), 30);
  });

  it('chain of computed signals updates correctly', () => {
    const base = signal(2);
    const doubled = computed(() => base() * 2);
    const quadrupled = computed(() => doubled() * 2);
    assert.equal(quadrupled(), 8);
    base.set(3);
    assert.equal(quadrupled(), 12);
  });

  it('can be subscribed to', () => {
    const s = signal(0);
    const c = computed(() => s() * 10);
    const log = [];
    const unsub = c.subscribe((v) => log.push(v));
    s.set(1);
    s.set(2);
    unsub();
    s.set(3);
    assert.deepEqual(log, [0, 10, 20]);
  });

  it('subscribe on computed fires immediately with current value', () => {
    const s = signal(5);
    const c = computed(() => s() + 1);
    let received;
    c.subscribe((v) => { received = v; });
    assert.equal(received, 6);
  });

  it('computed does not have set() method', () => {
    const c = computed(() => 42);
    assert.equal(typeof (c).set, 'undefined');
  });

  it('computed does not have update() method', () => {
    const c = computed(() => 42);
    assert.equal(typeof (c).update, 'undefined');
  });

  it('is identified as a signal by isSignal()', () => {
    const c = computed(() => 1);
    assert.equal(isSignal(c), true);
  });
});

// ─── effect() ────────────────────────────────────────────────────────────────

describe('effect()', () => {
  it('runs immediately on creation', () => {
    const s = signal(0);
    let runCount = 0;
    const stop = effect(() => {
      s(); // track
      runCount++;
    });
    assert.equal(runCount, 1);
    stop();
  });

  it('re-runs when a tracked signal changes', () => {
    const s = signal(0);
    const log = [];
    const stop = effect(() => {
      log.push(s());
    });
    s.set(1);
    s.set(2);
    stop();
    assert.deepEqual(log, [0, 1, 2]);
  });

  it('does not re-run after stop/dispose', () => {
    const s = signal(0);
    let count = 0;
    const stop = effect(() => {
      s();
      count++;
    });
    stop();
    s.set(1);
    assert.equal(count, 1);
  });

  it('tracks multiple signals', () => {
    const a = signal(1);
    const b = signal(2);
    const log = [];
    const stop = effect(() => {
      log.push(a() + b());
    });
    a.set(10);
    b.set(20);
    stop();
    assert.deepEqual(log, [3, 12, 30]);
  });

  it('returns a cleanup function', () => {
    const stop = effect(() => {});
    assert.equal(typeof stop, 'function');
    stop();
  });

  it('calling stop twice is safe', () => {
    const stop = effect(() => {});
    stop();
    assert.doesNotThrow(() => stop());
  });

  it('effect does not run for signals it no longer reads after conditional', () => {
    const flag = signal(true);
    const a = signal(1);
    const b = signal(100);
    const log = [];
    const stop = effect(() => {
      log.push(flag() ? a() : b());
    });
    // Currently tracking flag + a
    a.set(2);        // re-runs because tracking a
    flag.set(false); // re-runs, now tracks flag + b instead
    b.set(200);      // re-runs
    a.set(3);        // should NOT re-run (a no longer tracked)
    stop();
    assert.deepEqual(log, [1, 2, 100, 200]);
  });
});

// ─── batch() ─────────────────────────────────────────────────────────────────

describe('batch()', () => {
  it('defers notifications until batch completes', () => {
    const s = signal(0);
    const log = [];
    const unsub = s.subscribe((v) => log.push(v));
    log.length = 0; // clear initial

    batch(() => {
      s.set(1);
      s.set(2);
      s.set(3);
    });

    assert.deepEqual(log, [3]);
    unsub();
  });

  it('works with multiple signals', () => {
    const a = signal(0);
    const b = signal(0);
    const aLog = [];
    const bLog = [];
    const u1 = a.subscribe((v) => aLog.push(v));
    const u2 = b.subscribe((v) => bLog.push(v));
    aLog.length = 0;
    bLog.length = 0;

    batch(() => {
      a.set(1);
      b.set(2);
    });

    assert.deepEqual(aLog, [1]);
    assert.deepEqual(bLog, [2]);
    u1(); u2();
  });

  it('effects inside batch only re-run once', () => {
    const s = signal(0);
    let runCount = 0;
    const stop = effect(() => {
      s();
      runCount++;
    });
    runCount = 0;

    batch(() => {
      s.set(1);
      s.set(2);
    });

    assert.equal(runCount, 1);
    stop();
  });

  it('nested batch flushes only at outermost end', () => {
    const s = signal(0);
    const log = [];
    const unsub = s.subscribe((v) => log.push(v));
    log.length = 0;

    batch(() => {
      batch(() => {
        s.set(10);
      });
      // Still inside outer batch — no notification yet
      assert.deepEqual(log, []);
      s.set(20);
    });

    assert.deepEqual(log, [20]);
    unsub();
  });

  it('computed inside batch re-evaluates once', () => {
    const s = signal(0);
    let evalCount = 0;
    const c = computed(() => {
      evalCount++;
      return s() * 2;
    });
    c(); // trigger initial eval
    evalCount = 0;

    batch(() => {
      s.set(1);
      s.set(2);
    });

    assert.equal(c(), 4);
    assert.equal(evalCount, 1);
  });
});

// ─── isSignal() ──────────────────────────────────────────────────────────────

describe('isSignal()', () => {
  it('returns true for a writable signal', () => {
    const s = signal(0);
    assert.equal(isSignal(s), true);
  });

  it('returns true for a computed signal', () => {
    const c = computed(() => 42);
    assert.equal(isSignal(c), true);
  });

  it('returns true for a fromPromise signal', () => {
    const s = fromPromise(Promise.resolve(1), 0);
    assert.equal(isSignal(s), true);
  });

  it('returns true for a combine signal', () => {
    const x = signal(1);
    const s = combine({ x });
    assert.equal(isSignal(s), true);
  });

  it('returns false for a plain function', () => {
    assert.equal(isSignal(() => 42), false);
  });

  it('returns false for a number', () => {
    assert.equal(isSignal(42), false);
  });

  it('returns false for a plain object', () => {
    assert.equal(isSignal({ __isSignal: true }), false);
  });

  it('returns false for null', () => {
    assert.equal(isSignal(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isSignal(undefined), false);
  });

  it('returns false for a string', () => {
    assert.equal(isSignal('signal'), false);
  });
});

// ─── fromPromise() ───────────────────────────────────────────────────────────

describe('fromPromise()', () => {
  it('returns initial value synchronously', () => {
    const s = fromPromise(Promise.resolve(99), 0);
    assert.equal(s(), 0);
  });

  it('updates to resolved value after promise resolves', async () => {
    const s = fromPromise(Promise.resolve(42), 0);
    await Promise.resolve(); // flush microtasks
    assert.equal(s(), 42);
  });

  it('notifies subscribers when promise resolves', async () => {
    const log = [];
    const s = fromPromise(Promise.resolve('done'), 'pending');
    s.subscribe((v) => log.push(v));
    await Promise.resolve();
    assert.deepEqual(log, ['pending', 'done']);
  });

  it('stays at initial value if promise rejects', async () => {
    const s = fromPromise(Promise.reject(new Error('fail')), 'default');
    await Promise.resolve();
    assert.equal(s(), 'default');
  });

  it('is identified as a signal by isSignal()', () => {
    const s = fromPromise(Promise.resolve(1), 0);
    assert.equal(isSignal(s), true);
  });

  it('peek() works on fromPromise signal', () => {
    const s = fromPromise(Promise.resolve(5), 0);
    assert.equal(s.peek(), 0);
  });
});

// ─── combine() ───────────────────────────────────────────────────────────────

describe('combine()', () => {
  it('returns object with current signal values', () => {
    const x = signal(1);
    const y = signal(2);
    const pos = combine({ x, y });
    assert.deepEqual(pos(), { x: 1, y: 2 });
  });

  it('updates when any contained signal changes', () => {
    const a = signal(10);
    const b = signal(20);
    const c = combine({ a, b });
    a.set(100);
    assert.deepEqual(c(), { a: 100, b: 20 });
  });

  it('combine of a single signal works', () => {
    const n = signal(7);
    const c = combine({ n });
    assert.deepEqual(c(), { n: 7 });
  });

  it('combined signal is identified by isSignal()', () => {
    const s = signal(1);
    assert.equal(isSignal(combine({ s })), true);
  });

  it('subscribe on combined signal fires immediately', () => {
    const x = signal(3);
    const c = combine({ x });
    let received;
    c.subscribe((v) => { received = v; });
    assert.deepEqual(received, { x: 3 });
  });

  it('subscribe on combined signal receives updates', () => {
    const a = signal(1);
    const b = signal(2);
    const c = combine({ a, b });
    const log = [];
    const unsub = c.subscribe((v) => log.push({ ...v }));
    a.set(10);
    unsub();
    assert.deepEqual(log, [{ a: 1, b: 2 }, { a: 10, b: 2 }]);
  });

  it('combines computed signals too', () => {
    const x = signal(2);
    const doubled = computed(() => x() * 2);
    const c = combine({ x, doubled });
    assert.deepEqual(c(), { x: 2, doubled: 4 });
    x.set(5);
    assert.deepEqual(c(), { x: 5, doubled: 10 });
  });
});

// ─── peek() ──────────────────────────────────────────────────────────────────

describe('peek()', () => {
  it('returns current value without creating a dependency', () => {
    const s = signal(99);
    assert.equal(s.peek(), 99);
  });

  it('peek inside effect does not create a dependency', () => {
    const s = signal(0);
    const other = signal(0);
    let runCount = 0;
    const stop = effect(() => {
      other(); // real dependency
      s.peek(); // should NOT be a dependency
      runCount++;
    });
    runCount = 0; // reset after first run
    s.set(1);    // should NOT trigger re-run
    assert.equal(runCount, 0);
    other.set(1); // SHOULD trigger re-run
    assert.equal(runCount, 1);
    stop();
  });

  it('peek on computed returns value without side effects', () => {
    const s = signal(5);
    const c = computed(() => s() + 1);
    assert.equal(c.peek(), 6);
  });

  it('peek returns updated value after set', () => {
    const s = signal(10);
    s.set(20);
    assert.equal(s.peek(), 20);
  });

  it('peek inside computed does not create nested dependency', () => {
    const a = signal(1);
    const b = signal(100);
    // c only depends on a; reads b via peek
    const c = computed(() => a() + b.peek());
    assert.equal(c(), 101);
    b.set(200); // should NOT cause c to recompute
    assert.equal(c(), 101);
    a.set(2); // SHOULD cause recompute, b.peek() will now be 200
    assert.equal(c(), 202);
  });
});
