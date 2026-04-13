// ─── Unit Tests: timer-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TimerRegistry,
  sleep,
  measureTime,
  measureTimeAsync,
  withTimeout,
  debounce,
  throttle,
} from '../../app/modules/timer-utils.js';

// ─── TimerRegistry ───────────────────────────────────────────────────────────

describe('TimerRegistry – setTimeout', () => {
  it('starts with count 0', () => {
    const registry = new TimerRegistry();
    assert.equal(registry.count, 0);
  });

  it('setTimeout returns a numeric id', () => {
    const registry = new TimerRegistry();
    const id = registry.setTimeout(() => {}, 10000);
    assert.equal(typeof id, 'number');
    registry.clearAll();
  });

  it('count increments after setTimeout', () => {
    const registry = new TimerRegistry();
    registry.setTimeout(() => {}, 10000);
    assert.equal(registry.count, 1);
    registry.clearAll();
  });

  it('count decrements after timeout fires', async () => {
    const registry = new TimerRegistry();
    await new Promise((resolve) => {
      registry.setTimeout(resolve, 10);
    });
    // Give event loop a tick to let the registry remove the entry.
    await new Promise((r) => globalThis.setTimeout(r, 0));
    assert.equal(registry.count, 0);
  });

  it('getAll returns registered timers', () => {
    const registry = new TimerRegistry();
    registry.setTimeout(() => {}, 10000);
    registry.setTimeout(() => {}, 20000);
    const all = registry.getAll();
    assert.equal(all.length, 2);
    assert.ok(all.every((t) => t.type === 'timeout'));
    registry.clearAll();
  });

  it('Timer object has expected fields', () => {
    const registry = new TimerRegistry();
    const cb = () => {};
    const id = registry.setTimeout(cb, 5000);
    const timer = registry.getAll().find((t) => t.id === id);
    assert.ok(timer);
    assert.equal(timer.type, 'timeout');
    assert.equal(timer.delay, 5000);
    assert.equal(typeof timer.scheduledAt, 'number');
    assert.ok(timer.scheduledAt > 0);
    registry.clearAll();
  });
});

describe('TimerRegistry – setInterval', () => {
  it('setInterval returns a numeric id', () => {
    const registry = new TimerRegistry();
    const id = registry.setInterval(() => {}, 10000);
    assert.equal(typeof id, 'number');
    registry.clearAll();
  });

  it('count increments after setInterval', () => {
    const registry = new TimerRegistry();
    registry.setInterval(() => {}, 10000);
    assert.equal(registry.count, 1);
    registry.clearAll();
  });

  it('Timer type is "interval"', () => {
    const registry = new TimerRegistry();
    const id = registry.setInterval(() => {}, 5000);
    const timer = registry.getAll().find((t) => t.id === id);
    assert.ok(timer);
    assert.equal(timer.type, 'interval');
    registry.clearAll();
  });
});

describe('TimerRegistry – clear', () => {
  it('clear removes a specific timer', () => {
    const registry = new TimerRegistry();
    const id = registry.setTimeout(() => {}, 10000);
    assert.equal(registry.count, 1);
    registry.clear(id);
    assert.equal(registry.count, 0);
  });

  it('clear is a no-op for unknown id', () => {
    const registry = new TimerRegistry();
    assert.doesNotThrow(() => registry.clear(9999));
  });

  it('cleared timeout does not fire', async () => {
    const registry = new TimerRegistry();
    let fired = false;
    const id = registry.setTimeout(() => { fired = true; }, 20);
    registry.clear(id);
    await sleep(50);
    assert.equal(fired, false);
  });
});

describe('TimerRegistry – clearAll', () => {
  it('clearAll removes all timers', () => {
    const registry = new TimerRegistry();
    registry.setTimeout(() => {}, 10000);
    registry.setTimeout(() => {}, 20000);
    registry.setInterval(() => {}, 10000);
    assert.equal(registry.count, 3);
    registry.clearAll();
    assert.equal(registry.count, 0);
  });

  it('clearAll is safe when registry is empty', () => {
    const registry = new TimerRegistry();
    assert.doesNotThrow(() => registry.clearAll());
  });

  it('timers do not fire after clearAll', async () => {
    const registry = new TimerRegistry();
    let fired = 0;
    registry.setTimeout(() => { fired++; }, 20);
    registry.setTimeout(() => { fired++; }, 20);
    registry.clearAll();
    await sleep(50);
    assert.equal(fired, 0);
  });
});

describe('TimerRegistry – getAll / count', () => {
  it('getAll returns a snapshot (adding after does not mutate old result)', () => {
    const registry = new TimerRegistry();
    registry.setTimeout(() => {}, 10000);
    const snap = registry.getAll();
    registry.setTimeout(() => {}, 10000);
    assert.equal(snap.length, 1);
    registry.clearAll();
  });

  it('multiple independent registries do not interfere', () => {
    const r1 = new TimerRegistry();
    const r2 = new TimerRegistry();
    r1.setTimeout(() => {}, 10000);
    r1.setTimeout(() => {}, 10000);
    r2.setTimeout(() => {}, 10000);
    assert.equal(r1.count, 2);
    assert.equal(r2.count, 1);
    r1.clearAll();
    r2.clearAll();
  });
});

// ─── sleep ───────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after approximately N ms', async () => {
    const start = Date.now();
    await sleep(20);
    const elapsed = Date.now() - start;
    // Allow generous tolerance for slow CI environments.
    assert.ok(elapsed >= 10, `expected >=10ms but got ${elapsed}ms`);
  });

  it('returns a Promise', () => {
    const p = sleep(5);
    assert.ok(p instanceof Promise);
    return p;
  });

  it('sleep(0) resolves quickly', async () => {
    await sleep(0);
  });
});

// ─── measureTime ─────────────────────────────────────────────────────────────

describe('measureTime', () => {
  it('returns the function result as first element', () => {
    const [result] = measureTime(() => 42);
    assert.equal(result, 42);
  });

  it('returns duration as second element', () => {
    const [, duration] = measureTime(() => {});
    assert.equal(typeof duration, 'number');
    assert.ok(duration >= 0);
  });

  it('measures non-trivial synchronous work', () => {
    const [, duration] = measureTime(() => {
      let x = 0;
      for (let i = 0; i < 1e6; i++) x += i;
      return x;
    });
    assert.ok(duration >= 0);
  });

  it('propagates exceptions from fn', () => {
    assert.throws(
      () => measureTime(() => { throw new Error('boom'); }),
      /boom/,
    );
  });
});

describe('measureTimeAsync', () => {
  it('returns the resolved value as first element', async () => {
    const [result] = await measureTimeAsync(async () => 'hello');
    assert.equal(result, 'hello');
  });

  it('returns duration as second element', async () => {
    const [, duration] = await measureTimeAsync(async () => {});
    assert.equal(typeof duration, 'number');
    assert.ok(duration >= 0);
  });

  it('measures async sleep', async () => {
    const [, duration] = await measureTimeAsync(() => sleep(20));
    assert.ok(duration >= 10, `expected >=10ms but got ${duration}ms`);
  });

  it('propagates async rejection', async () => {
    await assert.rejects(
      () => measureTimeAsync(async () => { throw new Error('async-boom'); }),
      /async-boom/,
    );
  });
});

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves when fn completes before timeout', async () => {
    const result = await withTimeout(async () => 'ok', 1000);
    assert.equal(result, 'ok');
  });

  it('rejects with timeout error when fn takes too long', async () => {
    await assert.rejects(
      () => withTimeout(() => sleep(500), 30),
      /timed out/i,
    );
  });

  it('propagates fn rejection', async () => {
    await assert.rejects(
      () => withTimeout(async () => { throw new Error('fn-err'); }, 1000),
      /fn-err/,
    );
  });
});

// ─── debounce ────────────────────────────────────────────────────────────────

describe('debounce', () => {
  it('does not call fn immediately', () => {
    let calls = 0;
    const d = debounce(() => { calls++; }, 50);
    d();
    assert.equal(calls, 0);
  });

  it('calls fn once after delay', async () => {
    let calls = 0;
    const d = debounce(() => { calls++; }, 30);
    d();
    await sleep(60);
    assert.equal(calls, 1);
  });

  it('resets timer on rapid calls (trailing edge)', async () => {
    let calls = 0;
    const d = debounce(() => { calls++; }, 40);
    d();
    d();
    d();
    await sleep(80);
    // Should only fire once.
    assert.equal(calls, 1);
  });

  it('passes arguments to fn', async () => {
    const received = [];
    const d = debounce((...args) => { received.push(...args); }, 20);
    d('a', 'b');
    await sleep(50);
    assert.deepEqual(received, ['a', 'b']);
  });
});

// ─── throttle ────────────────────────────────────────────────────────────────

describe('throttle', () => {
  it('calls fn on first invocation (leading edge)', () => {
    let calls = 0;
    const t = throttle(() => { calls++; }, 100);
    t();
    assert.equal(calls, 1);
  });

  it('ignores calls within the delay window', () => {
    let calls = 0;
    const t = throttle(() => { calls++; }, 200);
    t();
    t();
    t();
    assert.equal(calls, 1);
  });

  it('allows second call after delay has passed', async () => {
    let calls = 0;
    const t = throttle(() => { calls++; }, 30);
    t(); // call 1 at t=0
    await sleep(50);
    t(); // call 2 after delay
    assert.equal(calls, 2);
  });

  it('passes arguments to fn', () => {
    const received = [];
    const t = throttle((...args) => { received.push(...args); }, 1000);
    t('x', 'y');
    assert.deepEqual(received, ['x', 'y']);
  });
});
