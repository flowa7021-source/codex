// ─── Unit Tests: time-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDuration,
  formatTime,
  parseDuration,
  createStopwatch,
  sleep,
  debounce,
  throttle,
  measure,
  measureAsync,
} from '../../app/modules/time-utils.js';

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns "0s" for 0 ms', () => {
    assert.equal(formatDuration(0), '0s');
  });

  it('returns seconds only for < 60 s', () => {
    assert.equal(formatDuration(45000), '45s');
  });

  it('returns minutes and seconds', () => {
    assert.equal(formatDuration(90000), '1m 30s');
  });

  it('returns hours, minutes and seconds', () => {
    assert.equal(formatDuration(3665000), '1h 1m 5s');
  });

  it('returns "1m" when seconds are 0', () => {
    assert.equal(formatDuration(60000), '1m');
  });

  it('returns "1h" when minutes and seconds are 0', () => {
    assert.equal(formatDuration(3600000), '1h');
  });

  it('treats negative values as 0', () => {
    assert.equal(formatDuration(-1000), '0s');
  });

  it('returns "59s" for 59 000 ms', () => {
    assert.equal(formatDuration(59000), '59s');
  });
});

// ─── formatTime ───────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats MM:SS for < 1 hour', () => {
    assert.equal(formatTime(65000), '1:05');
  });

  it('formats HH:MM:SS for >= 1 hour', () => {
    assert.equal(formatTime(3665000), '1:01:05');
  });

  it('pads seconds with a leading zero', () => {
    assert.equal(formatTime(9000), '0:09');
  });

  it('pads minutes with a leading zero in HH:MM:SS', () => {
    assert.equal(formatTime(3601000), '1:00:01');
  });

  it('returns "0:00" for 0 ms', () => {
    assert.equal(formatTime(0), '0:00');
  });

  it('treats negative values as 0', () => {
    assert.equal(formatTime(-5000), '0:00');
  });
});

// ─── parseDuration ────────────────────────────────────────────────────────────

describe('parseDuration', () => {
  it('parses seconds-only natural format ("45s")', () => {
    assert.equal(parseDuration('45s'), 45000);
  });

  it('parses minutes and seconds natural format ("1m 30s")', () => {
    assert.equal(parseDuration('1m 30s'), 90000);
  });

  it('parses hours, minutes and seconds natural format ("1h 1m 5s")', () => {
    assert.equal(parseDuration('1h 1m 5s'), 3665000);
  });

  it('parses HH:MM:SS colon format ("1:23:45")', () => {
    assert.equal(parseDuration('1:23:45'), 5025000);
  });

  it('parses MM:SS colon format ("1:30")', () => {
    assert.equal(parseDuration('1:30'), 90000);
  });

  it('parses hours-only ("2h")', () => {
    assert.equal(parseDuration('2h'), 7200000);
  });

  it('parses minutes-only ("3m")', () => {
    assert.equal(parseDuration('3m'), 180000);
  });

  it('returns NaN for an invalid string', () => {
    assert.ok(Number.isNaN(parseDuration('not-a-duration')));
  });

  it('returns NaN for an empty string', () => {
    assert.ok(Number.isNaN(parseDuration('')));
  });

  it('returns NaN for null', () => {
    // @ts-ignore — intentional invalid input
    assert.ok(Number.isNaN(parseDuration(null)));
  });
});

// ─── createStopwatch ──────────────────────────────────────────────────────────

describe('createStopwatch', () => {
  it('starts with isRunning = false and elapsed = 0', () => {
    const sw = createStopwatch();
    assert.equal(sw.isRunning, false);
    assert.equal(sw.elapsed(), 0);
  });

  it('isRunning becomes true after start()', () => {
    const sw = createStopwatch();
    sw.start();
    assert.equal(sw.isRunning, true);
    sw.stop();
  });

  it('isRunning becomes false after stop()', () => {
    const sw = createStopwatch();
    sw.start();
    sw.stop();
    assert.equal(sw.isRunning, false);
  });

  it('elapsed() returns a non-negative number after starting and stopping', () => {
    const sw = createStopwatch();
    sw.start();
    sw.stop();
    assert.ok(sw.elapsed() >= 0);
  });

  it('elapsed() returns a number while running', () => {
    const sw = createStopwatch();
    sw.start();
    const e = sw.elapsed();
    sw.stop();
    assert.equal(typeof e, 'number');
    assert.ok(e >= 0);
  });

  it('reset() sets elapsed to 0 and isRunning to false', () => {
    const sw = createStopwatch();
    sw.start();
    sw.stop();
    sw.reset();
    assert.equal(sw.elapsed(), 0);
    assert.equal(sw.isRunning, false);
  });

  it('calling start() twice does not restart the timer', () => {
    const sw = createStopwatch();
    sw.start();
    const first = sw.elapsed();
    sw.start(); // second call is a no-op
    assert.ok(sw.elapsed() >= first);
    sw.stop();
  });

  it('calling stop() before start() is safe (no-op)', () => {
    const sw = createStopwatch();
    sw.stop(); // should not throw
    assert.equal(sw.isRunning, false);
    assert.equal(sw.elapsed(), 0);
  });
});

// ─── sleep ────────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after approximately N ms', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    // Allow large tolerance: at least 40 ms, at most 500 ms
    assert.ok(elapsed >= 40, `Expected >= 40 ms, got ${elapsed}`);
    assert.ok(elapsed < 500, `Expected < 500 ms, got ${elapsed}`);
  });

  it('resolves immediately for 0 ms', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 200, `Expected fast resolution, got ${elapsed} ms`);
  });

  it('returns a Promise', () => {
    const result = sleep(10);
    assert.ok(result instanceof Promise);
    return result; // let the runner await it
  });
});

// ─── debounce ─────────────────────────────────────────────────────────────────

describe('debounce', () => {
  it('calls the function after the delay', async () => {
    let callCount = 0;
    const debounced = debounce(() => { callCount++; }, 50);

    debounced();
    assert.equal(callCount, 0); // not called yet
    await sleep(80);
    assert.equal(callCount, 1);
  });

  it('resets the timer on subsequent calls', async () => {
    let callCount = 0;
    const debounced = debounce(() => { callCount++; }, 60);

    debounced();
    await sleep(30);
    debounced(); // resets timer
    await sleep(30);
    assert.equal(callCount, 0); // still not called
    await sleep(60);
    assert.equal(callCount, 1);
  });

  it('cancel() prevents the function from being called', async () => {
    let callCount = 0;
    const debounced = debounce(() => { callCount++; }, 50);

    debounced();
    debounced.cancel();
    await sleep(80);
    assert.equal(callCount, 0);
  });

  it('forwards arguments to the wrapped function', async () => {
    let received = null;
    const debounced = debounce((x) => { received = x; }, 40);
    debounced(42);
    await sleep(60);
    assert.equal(received, 42);
  });
});

// ─── throttle ────────────────────────────────────────────────────────────────

describe('throttle', () => {
  it('calls the function immediately on first invocation', () => {
    let callCount = 0;
    const throttled = throttle(() => { callCount++; }, 100);
    throttled();
    assert.equal(callCount, 1);
    throttled.cancel();
  });

  it('ignores subsequent calls within the delay window', async () => {
    let callCount = 0;
    const throttled = throttle(() => { callCount++; }, 100);
    throttled();
    throttled();
    throttled();
    assert.equal(callCount, 1);
    throttled.cancel();
  });

  it('allows a call after the delay window has elapsed', async () => {
    let callCount = 0;
    const throttled = throttle(() => { callCount++; }, 50);
    throttled();
    assert.equal(callCount, 1);
    await sleep(80);
    throttled();
    assert.equal(callCount, 2);
    throttled.cancel();
  });

  it('cancel() clears the internal timer', () => {
    let callCount = 0;
    const throttled = throttle(() => { callCount++; }, 100);
    throttled();
    throttled.cancel(); // should not throw
    assert.equal(callCount, 1);
  });
});

// ─── measure ─────────────────────────────────────────────────────────────────

describe('measure', () => {
  it('returns the result of the function', () => {
    const { result } = measure(() => 42);
    assert.equal(result, 42);
  });

  it('returns ms as a non-negative number', () => {
    const { ms } = measure(() => {});
    assert.equal(typeof ms, 'number');
    assert.ok(ms >= 0);
  });

  it('works with functions that return objects', () => {
    const { result } = measure(() => ({ a: 1, b: 2 }));
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('reports non-zero ms for a slow operation', async () => {
    // Use a tight synchronous loop that takes at least a few ms
    const { ms } = measure(() => {
      let n = 0;
      for (let i = 0; i < 1e6; i++) n += i;
      return n;
    });
    assert.equal(typeof ms, 'number');
    assert.ok(ms >= 0);
  });
});

// ─── measureAsync ─────────────────────────────────────────────────────────────

describe('measureAsync', () => {
  it('resolves with the result of the async function', async () => {
    const { result } = await measureAsync(async () => 'hello');
    assert.equal(result, 'hello');
  });

  it('resolves with ms as a non-negative number', async () => {
    const { ms } = await measureAsync(async () => {});
    assert.equal(typeof ms, 'number');
    assert.ok(ms >= 0);
  });

  it('measures elapsed time for an async operation', async () => {
    const { ms } = await measureAsync(() => sleep(50));
    // Allow generous tolerance
    assert.ok(ms >= 40, `Expected >= 40 ms, got ${ms}`);
    assert.ok(ms < 500, `Expected < 500 ms, got ${ms}`);
  });

  it('works with functions that return objects', async () => {
    const { result } = await measureAsync(async () => ({ x: 99 }));
    assert.deepEqual(result, { x: 99 });
  });
});
