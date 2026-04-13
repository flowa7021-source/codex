// ─── Unit Tests: debounce-throttle ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  debounce,
  throttle,
  debouncedPromise,
  delay,
  onFrame,
} from '../../app/modules/debounce-throttle.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Tiny helper: wait `ms` milliseconds. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── debounce ─────────────────────────────────────────────────────────────────

describe('debounce – basic behaviour', () => {
  it('calls fn after the wait period', async () => {
    let count = 0;
    const fn = debounce(() => { count++; }, 10);
    fn();
    assert.equal(count, 0, 'should not fire immediately');
    await wait(30);
    assert.equal(count, 1, 'should fire once after wait');
  });

  it('calling rapidly only fires once', async () => {
    let count = 0;
    const fn = debounce(() => { count++; }, 15);
    fn(); fn(); fn(); fn();
    await wait(40);
    assert.equal(count, 1, 'should fire exactly once despite multiple calls');
  });

  it('passes the latest arguments to fn', async () => {
    let received = null;
    const fn = debounce((x) => { received = x; }, 10);
    fn('first');
    fn('second');
    fn('third');
    await wait(30);
    assert.equal(received, 'third');
  });
});

describe('debounce – cancel()', () => {
  it('does not fire after cancel()', async () => {
    let count = 0;
    const fn = debounce(() => { count++; }, 10);
    fn();
    fn.cancel();
    await wait(30);
    assert.equal(count, 0, 'should not fire after cancel');
  });

  it('cancel() is a no-op when nothing is pending', () => {
    const fn = debounce(() => {}, 10);
    assert.doesNotThrow(() => fn.cancel());
  });
});

describe('debounce – flush()', () => {
  it('fires immediately when called with a pending invocation', async () => {
    let count = 0;
    const fn = debounce(() => { count++; }, 50);
    fn();
    assert.equal(count, 0);
    fn.flush();
    assert.equal(count, 1, 'flush should fire synchronously');
    // Ensure no extra fire after the original wait
    await wait(80);
    assert.equal(count, 1, 'should not fire again after flush');
  });

  it('flush() is a no-op when nothing is pending', () => {
    const fn = debounce(() => {}, 10);
    assert.doesNotThrow(() => fn.flush());
  });
});

// ─── throttle ─────────────────────────────────────────────────────────────────

describe('throttle – basic behaviour', () => {
  it('fires immediately on first call', () => {
    let count = 0;
    const fn = throttle(() => { count++; }, 50);
    fn();
    assert.equal(count, 1, 'should fire immediately on first call');
    fn.cancel();
  });

  it('rate-limits subsequent calls within interval', async () => {
    let count = 0;
    const fn = throttle(() => { count++; }, 30);
    fn(); // fires immediately
    fn(); // within interval, schedules trailing
    fn(); // within interval, replaces trailing
    await wait(60);
    // First call fires immediately + one trailing call
    assert.ok(count <= 2, `count should be <= 2, got ${count}`);
    assert.ok(count >= 1, `count should be >= 1, got ${count}`);
    fn.cancel();
  });

  it('allows another call after the interval has passed', async () => {
    let count = 0;
    const fn = throttle(() => { count++; }, 20);
    fn();
    assert.equal(count, 1);
    await wait(40);
    fn.cancel(); // cancel trailing if any
    fn();
    assert.equal(count, 2, 'second call after interval should fire immediately');
    fn.cancel();
  });
});

describe('throttle – cancel()', () => {
  it('prevents a trailing call from running', async () => {
    let count = 0;
    const fn = throttle(() => { count++; }, 50);
    fn(); // fires immediately
    fn(); // schedules trailing
    fn.cancel();
    await wait(80);
    assert.equal(count, 1, 'trailing call should be cancelled');
  });
});

// ─── debouncedPromise ─────────────────────────────────────────────────────────

describe('debouncedPromise', () => {
  it('resolves with the return value of fn', async () => {
    const fn = debouncedPromise((x) => x * 2, 10);
    const result = await fn(21);
    assert.equal(result, 42);
  });

  it('multiple rapid calls share the same result', async () => {
    let callCount = 0;
    const fn = debouncedPromise((x) => { callCount++; return x; }, 15);
    const p1 = fn(1);
    const p2 = fn(2);
    const p3 = fn(3);
    const results = await Promise.all([p1, p2, p3]);
    assert.equal(callCount, 1, 'underlying fn should be called only once');
    // All promises resolve with the result of the last-args call
    assert.deepEqual(results, [3, 3, 3]);
  });

  it('can be called again after the first debounce resolves', async () => {
    const fn = debouncedPromise((x) => x + 1, 10);
    const r1 = await fn(10);
    assert.equal(r1, 11);
    const r2 = await fn(20);
    assert.equal(r2, 21);
  });
});

// ─── delay ────────────────────────────────────────────────────────────────────

describe('delay', () => {
  it('fires the callback after ms', async () => {
    let fired = false;
    delay(() => { fired = true; }, 10);
    assert.equal(fired, false);
    await wait(30);
    assert.equal(fired, true);
  });

  it('cancel prevents the callback from firing', async () => {
    let fired = false;
    const cancel = delay(() => { fired = true; }, 10);
    cancel();
    await wait(30);
    assert.equal(fired, false, 'callback should not fire after cancel');
  });
});

// ─── onFrame ──────────────────────────────────────────────────────────────────

describe('onFrame', () => {
  it('calls the callback at least once', async () => {
    let callCount = 0;
    const cancel = onFrame(() => { callCount++; });
    await wait(60);
    cancel();
    assert.ok(callCount >= 1, `callback should have been called, got ${callCount}`);
  });

  it('cancel() stops further callbacks', async () => {
    let callCount = 0;
    const cancel = onFrame(() => { callCount++; });
    await wait(50);
    cancel();
    const countAtCancel = callCount;
    await wait(50);
    assert.equal(callCount, countAtCancel, 'no more calls after cancel');
  });

  it('passes a numeric timestamp to the callback', async () => {
    let ts = null;
    const cancel = onFrame((t) => { ts = t; });
    await wait(40);
    cancel();
    assert.equal(typeof ts, 'number');
  });
});
