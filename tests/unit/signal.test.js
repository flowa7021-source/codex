// ─── Unit Tests: Signals ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  signal,
  computed,
  effect,
  batch,
} from '../../app/modules/signal.js';

// ─── signal(): returns current value via call ─────────────────────────────────

describe('signal()', () => {
  it('returns initial value when called', () => {
    const s = signal(10);
    assert.equal(s(), 10);
  });

  it('works with string initial value', () => {
    const s = signal('hello');
    assert.equal(s(), 'hello');
  });

  it('works with object initial value', () => {
    const s = signal({ a: 1 });
    assert.deepEqual(s(), { a: 1 });
  });
});

// ─── signal.set(): updates value, notifies subscribers ────────────────────────

describe('signal.set()', () => {
  it('updates the value', () => {
    const s = signal(0);
    s.set(5);
    assert.equal(s(), 5);
  });

  it('notifies subscribers when value changes', () => {
    const s = signal(0);
    const received = [];
    s.subscribe((v) => received.push(v));
    s.set(1);
    s.set(2);
    // First call is immediate (initial), then 1 and 2
    assert.deepEqual(received, [0, 1, 2]);
  });

  it('does not notify subscribers when value is the same', () => {
    const s = signal(42);
    const received = [];
    s.subscribe((v) => received.push(v));
    s.set(42); // same value
    // Only the initial subscription call
    assert.deepEqual(received, [42]);
  });
});

// ─── signal.update(): applies function to current value ───────────────────────

describe('signal.update()', () => {
  it('applies the update function to current value', () => {
    const s = signal(3);
    s.update((v) => v * 2);
    assert.equal(s(), 6);
  });

  it('chains multiple updates correctly', () => {
    const s = signal(1);
    s.update((v) => v + 1);
    s.update((v) => v + 1);
    assert.equal(s(), 3);
  });
});

// ─── signal.subscribe(): called with new value on change ─────────────────────

describe('signal.subscribe()', () => {
  it('calls callback immediately with current value', () => {
    const s = signal('init');
    let called;
    s.subscribe((v) => { called = v; });
    assert.equal(called, 'init');
  });

  it('calls callback with each new value', () => {
    const s = signal(0);
    const log = [];
    s.subscribe((v) => log.push(v));
    s.set(1);
    s.set(2);
    assert.deepEqual(log, [0, 1, 2]);
  });
});

// ─── unsubscribe: stops receiving updates ────────────────────────────────────

describe('unsubscribe from signal', () => {
  it('stops receiving updates after unsubscribe', () => {
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
});

// ─── signal.value: getter works ──────────────────────────────────────────────

describe('signal.value getter', () => {
  it('returns the current value via .value', () => {
    const s = signal(99);
    assert.equal(s.value, 99);
  });

  it('reflects updates via .value', () => {
    const s = signal(1);
    s.set(2);
    assert.equal(s.value, 2);
  });
});

// ─── computed(): derives value from signals ───────────────────────────────────

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

  it('has a .value getter', () => {
    const s = signal(7);
    const c = computed(() => s() + 1);
    assert.equal(c.value, 8);
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
});

// ─── effect(): runs immediately, re-runs on dependency change ─────────────────

describe('effect()', () => {
  it('runs immediately on creation', () => {
    const s = signal(0);
    let runCount = 0;
    const stop = effect(() => {
      s(); // track dependency
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

  it('does not re-run after dispose', () => {
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

  it('cleanup function is called before each re-run', () => {
    const s = signal(0);
    const log = [];
    const stop = effect(() => {
      log.push('run:' + s());
      return () => {
        log.push('cleanup:' + s());
      };
    });
    s.set(1);
    stop();
    // First run, then cleanup before second run, then cleanup on stop
    assert.ok(log.includes('run:0'));
    assert.ok(log.includes('cleanup:1'));
    assert.ok(log.includes('run:1'));
  });

  it('cleanup function is called on dispose', () => {
    const s = signal(0);
    let cleanupCount = 0;
    const stop = effect(() => {
      s(); // track
      return () => { cleanupCount++; };
    });
    stop();
    assert.equal(cleanupCount, 1);
  });
});

// ─── batch(): subscribers notified only once ─────────────────────────────────

describe('batch()', () => {
  it('defers notifications until batch completes', () => {
    const s = signal(0);
    const log = [];
    s.subscribe((v) => log.push(v));
    // Clear initial subscription call
    log.length = 0;

    batch(() => {
      s.set(1);
      s.set(2);
      s.set(3);
    });

    // Should be notified only once with the final value
    assert.deepEqual(log, [3]);
  });

  it('works with multiple signals', () => {
    const a = signal(0);
    const b = signal(0);
    const aLog = [];
    const bLog = [];
    a.subscribe((v) => aLog.push(v));
    b.subscribe((v) => bLog.push(v));
    aLog.length = 0;
    bLog.length = 0;

    batch(() => {
      a.set(1);
      b.set(2);
    });

    assert.deepEqual(aLog, [1]);
    assert.deepEqual(bLog, [2]);
  });

  it('effects inside batch only re-run once', () => {
    const s = signal(0);
    let runCount = 0;
    const stop = effect(() => {
      s();
      runCount++;
    });
    runCount = 0; // reset after initial run

    batch(() => {
      s.set(1);
      s.set(2);
    });

    assert.equal(runCount, 1);
    stop();
  });
});
