// ─── Unit Tests: Reactive State ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Signal,
  createSignal,
  computed,
  effect,
  batch,
} from '../../app/modules/reactive-state.js';

// ─── Signal – basic get / set ─────────────────────────────────────────────────

describe('Signal – basic get / set', () => {
  it('initial value is accessible via .value', () => {
    const sig = new Signal(42);
    assert.equal(sig.value, 42);
  });

  it('setting .value updates the stored value', () => {
    const sig = new Signal('hello');
    sig.value = 'world';
    assert.equal(sig.value, 'world');
  });

  it('peek returns the current value', () => {
    const sig = new Signal(7);
    assert.equal(sig.peek(), 7);
    sig.value = 8;
    assert.equal(sig.peek(), 8);
  });

  it('createSignal factory returns a Signal instance', () => {
    const sig = createSignal(100);
    assert.ok(sig instanceof Signal);
    assert.equal(sig.value, 100);
  });
});

// ─── Signal – subscribe ───────────────────────────────────────────────────────

describe('Signal – subscribe', () => {
  it('subscriber is called when value changes', () => {
    const sig = createSignal(0);
    const calls = [];
    sig.subscribe((v) => calls.push(v));
    sig.value = 1;
    assert.deepEqual(calls, [1]);
  });

  it('subscriber is NOT called when value is set to the same value', () => {
    const sig = createSignal('same');
    const calls = [];
    sig.subscribe(() => calls.push(1));
    sig.value = 'same';
    assert.equal(calls.length, 0);
  });

  it('unsubscribe stops future notifications', () => {
    const sig = createSignal(0);
    const calls = [];
    const unsub = sig.subscribe((v) => calls.push(v));
    sig.value = 1;
    unsub();
    sig.value = 2;
    assert.deepEqual(calls, [1]);
  });

  it('multiple subscribers are all notified', () => {
    const sig = createSignal('a');
    const log = [];
    sig.subscribe(() => log.push('sub1'));
    sig.subscribe(() => log.push('sub2'));
    sig.value = 'b';
    assert.deepEqual(log, ['sub1', 'sub2']);
  });

  it('subscriber is called with the new value', () => {
    const sig = createSignal(10);
    let received;
    sig.subscribe((v) => { received = v; });
    sig.value = 20;
    assert.equal(received, 20);
  });
});

// ─── computed ─────────────────────────────────────────────────────────────────

describe('computed', () => {
  it('initial value is computed immediately from deps', () => {
    const a = createSignal(2);
    const b = createSignal(3);
    const sum = computed(() => a.value + b.value, [a, b]);
    assert.equal(sum.value, 5);
  });

  it('recomputes when a dependency changes', () => {
    const n = createSignal(4);
    const doubled = computed(() => n.value * 2, [n]);
    n.value = 10;
    assert.equal(doubled.value, 20);
  });

  it('recomputes when any of multiple deps changes', () => {
    const x = createSignal(1);
    const y = createSignal(1);
    const product = computed(() => x.value * y.value, [x, y]);
    x.value = 3;
    assert.equal(product.value, 3);
    y.value = 4;
    assert.equal(product.value, 12);
  });

  it('computed signal can be subscribed to', () => {
    const base = createSignal(5);
    const squared = computed(() => base.value ** 2, [base]);
    const values = [];
    squared.subscribe((v) => values.push(v));
    base.value = 3;
    assert.deepEqual(values, [9]);
  });

  it('chained computed signals propagate changes', () => {
    const n = createSignal(2);
    const doubled = computed(() => n.value * 2, [n]);
    const quadrupled = computed(() => doubled.value * 2, [doubled]);
    n.value = 5;
    assert.equal(quadrupled.value, 20);
  });
});

// ─── effect ───────────────────────────────────────────────────────────────────

describe('effect', () => {
  it('runs when a dependency signal changes', () => {
    const sig = createSignal(0);
    const calls = [];
    effect(() => calls.push(sig.value), [sig]);
    sig.value = 1;
    assert.deepEqual(calls, [1]);
  });

  it('does NOT run immediately on registration', () => {
    const sig = createSignal(42);
    const calls = [];
    effect(() => calls.push(sig.value), [sig]);
    assert.equal(calls.length, 0);
  });

  it('unsubscribing stops future effect invocations', () => {
    const sig = createSignal(0);
    const calls = [];
    const stop = effect(() => calls.push(sig.value), [sig]);
    sig.value = 1;
    stop();
    sig.value = 2;
    assert.equal(calls.length, 1);
  });

  it('runs for each dependency that changes', () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const calls = [];
    effect(() => calls.push('fired'), [a, b]);
    a.value = 1;
    b.value = 1;
    assert.equal(calls.length, 2);
  });

  it('stops all dependency subscriptions when cleanup is called', () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const calls = [];
    const stop = effect(() => calls.push(1), [a, b]);
    stop();
    a.value = 1;
    b.value = 1;
    assert.equal(calls.length, 0);
  });
});

// ─── batch ────────────────────────────────────────────────────────────────────

describe('batch', () => {
  it('defers subscriber notifications until the batch ends', () => {
    const sig = createSignal(0);
    const calls = [];
    sig.subscribe((v) => calls.push(v));

    batch(() => {
      sig.value = 1;
      sig.value = 2;
      // Inside the batch, no notifications yet
      assert.equal(calls.length, 0);
    });

    // After the batch, notified once with the final value
    assert.deepEqual(calls, [2]);
  });

  it('notifies once per signal even if written multiple times', () => {
    const sig = createSignal('a');
    let callCount = 0;
    sig.subscribe(() => callCount++);

    batch(() => {
      sig.value = 'b';
      sig.value = 'c';
      sig.value = 'd';
    });

    assert.equal(callCount, 1);
  });

  it('handles multiple independent signals in one batch', () => {
    const x = createSignal(0);
    const y = createSignal(0);
    const xCalls = [];
    const yCalls = [];
    x.subscribe((v) => xCalls.push(v));
    y.subscribe((v) => yCalls.push(v));

    batch(() => {
      x.value = 10;
      y.value = 20;
    });

    assert.deepEqual(xCalls, [10]);
    assert.deepEqual(yCalls, [20]);
  });

  it('signals not changed during the batch are not notified', () => {
    const a = createSignal(1);
    const b = createSignal(2);
    const aCalls = [];
    const bCalls = [];
    a.subscribe((v) => aCalls.push(v));
    b.subscribe((v) => bCalls.push(v));

    batch(() => {
      a.value = 10;
      // b is not touched
    });

    assert.deepEqual(aCalls, [10]);
    assert.equal(bCalls.length, 0);
  });

  it('nested batch flushes only after the outermost batch ends', () => {
    const sig = createSignal(0);
    const calls = [];
    sig.subscribe((v) => calls.push(v));

    batch(() => {
      batch(() => {
        sig.value = 1;
      });
      // Still inside outer batch — no flush yet
      assert.equal(calls.length, 0);
      sig.value = 2;
    });

    assert.deepEqual(calls, [2]);
  });

  it('non-batched writes still fire immediately outside a batch', () => {
    const sig = createSignal(0);
    const calls = [];
    sig.subscribe((v) => calls.push(v));
    sig.value = 5;
    assert.deepEqual(calls, [5]);
  });
});
