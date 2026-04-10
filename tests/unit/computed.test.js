// ─── Unit Tests: computed signals ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Signal,
  Computed,
  signal,
  computed,
  effect,
  batch,
} from '../../app/modules/computed.js';

// ─── Signal ───────────────────────────────────────────────────────────────────

describe('Signal – basic get/set', () => {
  it('returns initial value', () => {
    const s = signal(42);
    assert.equal(s.value, 42);
  });

  it('updates value via setter', () => {
    const s = signal(0);
    s.value = 10;
    assert.equal(s.value, 10);
  });

  it('Signal constructor is exported directly', () => {
    const s = new Signal('hello');
    assert.equal(s.value, 'hello');
  });

  it('accepts falsy values', () => {
    const s = signal(false);
    assert.equal(s.value, false);
    s.value = true;
    assert.equal(s.value, true);
  });
});

describe('Signal – subscribe', () => {
  it('fires subscriber when value changes', () => {
    const s = signal(1);
    const log = [];
    s.subscribe((n, o) => log.push([n, o]));
    s.value = 2;
    assert.deepEqual(log, [[2, 1]]);
  });

  it('does NOT fire when value is set to the same value', () => {
    const s = signal('x');
    const log = [];
    s.subscribe(() => log.push(1));
    s.value = 'x'; // same value
    assert.equal(log.length, 0);
  });

  it('fires for each distinct change', () => {
    const s = signal(0);
    const log = [];
    s.subscribe((n) => log.push(n));
    s.value = 1;
    s.value = 2;
    s.value = 3;
    assert.deepEqual(log, [1, 2, 3]);
  });

  it('unsubscribe stops receiving notifications', () => {
    const s = signal(0);
    const log = [];
    const unsub = s.subscribe((n) => log.push(n));
    s.value = 1;
    unsub();
    s.value = 2;
    assert.deepEqual(log, [1]);
  });

  it('multiple subscribers each receive the change', () => {
    const s = signal(0);
    let a = 0, b = 0;
    s.subscribe(() => { a++; });
    s.subscribe(() => { b++; });
    s.value = 99;
    assert.equal(a, 1);
    assert.equal(b, 1);
  });

  it('unsubscribing one does not affect others', () => {
    const s = signal(0);
    let a = 0, b = 0;
    const unsub = s.subscribe(() => { a++; });
    s.subscribe(() => { b++; });
    unsub();
    s.value = 1;
    assert.equal(a, 0);
    assert.equal(b, 1);
  });
});

// ─── Computed ─────────────────────────────────────────────────────────────────

describe('Computed – derives value', () => {
  it('computes derived value from a dep signal', () => {
    const s = signal(3);
    const c = computed(() => s.value * 2, [s]);
    assert.equal(c.value, 6);
  });

  it('Computed constructor is exported directly', () => {
    const s = signal(5);
    const c = new Computed(() => s.value + 1, [s]);
    assert.equal(c.value, 6);
  });

  it('updates when dep changes', () => {
    const s = signal(1);
    const c = computed(() => s.value + 10, [s]);
    s.value = 4;
    assert.equal(c.value, 14);
  });

  it('tracks multiple deps', () => {
    const a = signal(2);
    const b = signal(3);
    const c = computed(() => a.value + b.value, [a, b]);
    assert.equal(c.value, 5);
    a.value = 10;
    assert.equal(c.value, 13);
    b.value = 0;
    assert.equal(c.value, 10);
  });
});

describe('Computed – memoization', () => {
  it('does not re-run fn when dep has not changed', () => {
    const s = signal(7);
    let callCount = 0;
    const c = computed(() => { callCount++; return s.value; }, [s]);
    void c.value; // trigger first computation
    void c.value; // should use cached
    void c.value;
    assert.equal(callCount, 1);
  });

  it('re-runs fn exactly once per dep change', () => {
    const s = signal(0);
    let callCount = 0;
    const c = computed(() => { callCount++; return s.value * 2; }, [s]);
    void c.value; // first compute
    s.value = 1;  // invalidates
    void c.value; // recomputes
    void c.value; // cached again
    assert.equal(callCount, 2);
  });

  it('invalidate() forces recompute on next access', () => {
    const s = signal(5);
    let callCount = 0;
    const c = computed(() => { callCount++; return s.value; }, [s]);
    void c.value; // first compute (callCount=1)
    c.invalidate();
    void c.value; // forced recompute (callCount=2)
    assert.equal(callCount, 2);
  });
});

describe('Computed – subscribe', () => {
  it('notifies subscriber when dep changes', () => {
    const s = signal(1);
    const c = computed(() => s.value * 10, [s]);
    const log = [];
    c.subscribe((n, o) => log.push([n, o]));
    s.value = 3;
    assert.deepEqual(log, [[30, 10]]);
  });

  it('does not notify when computed value does not change', () => {
    const s = signal(1);
    // abs(x) is same for 1 and -1 if we use Math.abs, but simpler: value % 2 === value % 2
    const c = computed(() => 42, [s]); // always 42
    const log = [];
    c.subscribe(() => log.push(1));
    s.value = 99; // dep changes, but computed stays 42
    assert.equal(log.length, 0);
  });

  it('unsubscribe stops future notifications', () => {
    const s = signal(0);
    const c = computed(() => s.value, [s]);
    const log = [];
    const unsub = c.subscribe((n) => log.push(n));
    s.value = 1;
    unsub();
    s.value = 2;
    assert.deepEqual(log, [1]);
  });
});

// ─── effect ───────────────────────────────────────────────────────────────────

describe('effect', () => {
  it('runs when a dep signal changes', () => {
    const s = signal(0);
    const log = [];
    effect(() => log.push(s.value), [s]);
    s.value = 1;
    assert.deepEqual(log, [1]);
  });

  it('does not run immediately (only on dep change)', () => {
    const s = signal(42);
    const log = [];
    effect(() => log.push(s.value), [s]);
    assert.equal(log.length, 0);
  });

  it('runs on each subsequent dep change', () => {
    const s = signal(0);
    const log = [];
    effect(() => log.push(s.value), [s]);
    s.value = 1;
    s.value = 2;
    s.value = 3;
    assert.deepEqual(log, [1, 2, 3]);
  });

  it('unsubscribe stops the effect', () => {
    const s = signal(0);
    const log = [];
    const stop = effect(() => log.push(s.value), [s]);
    s.value = 1;
    stop();
    s.value = 2;
    assert.deepEqual(log, [1]);
  });

  it('tracks multiple deps independently', () => {
    const a = signal(0);
    const b = signal(0);
    const log = [];
    effect(() => log.push('fired'), [a, b]);
    a.value = 1;
    b.value = 1;
    assert.equal(log.length, 2);
  });
});

// ─── batch ────────────────────────────────────────────────────────────────────

describe('batch', () => {
  it('updates multiple signals atomically — subscriber called once', () => {
    const a = signal(0);
    const b = signal(0);
    const log = [];
    // Subscribe to both individually
    a.subscribe(() => log.push('a'));
    b.subscribe(() => log.push('b'));
    batch(() => {
      a.value = 1;
      b.value = 1;
    });
    // Each signal's subscriber should fire once after the batch
    assert.deepEqual(log, ['a', 'b']);
  });

  it('subscriber sees the final value after batch', () => {
    const s = signal(0);
    const seen = [];
    s.subscribe((n) => seen.push(n));
    batch(() => {
      s.value = 1;
      s.value = 2;
      s.value = 3;
    });
    // Only one notification; value is the last one set
    assert.deepEqual(seen, [3]);
  });

  it('a single signal subscriber fires once even when set N times in batch', () => {
    const s = signal('a');
    let calls = 0;
    s.subscribe(() => { calls++; });
    batch(() => {
      s.value = 'b';
      s.value = 'c';
      s.value = 'd';
    });
    assert.equal(calls, 1);
    assert.equal(s.value, 'd');
  });

  it('outside of batch, each change fires immediately', () => {
    const s = signal(0);
    const log = [];
    s.subscribe((n) => log.push(n));
    s.value = 1;
    s.value = 2;
    assert.deepEqual(log, [1, 2]);
  });

  it('batch with no mutations fires no subscribers', () => {
    const s = signal(0);
    let calls = 0;
    s.subscribe(() => { calls++; });
    batch(() => {
      // nothing
    });
    assert.equal(calls, 0);
  });

  it('nested batch flushes once after outermost batch completes', () => {
    const s = signal(0);
    const log = [];
    s.subscribe((n) => log.push(n));
    batch(() => {
      batch(() => {
        s.value = 10;
      });
      s.value = 20;
    });
    // Outer batch flushes — value is 20, one notification
    assert.deepEqual(log, [20]);
    assert.equal(s.value, 20);
  });
});
