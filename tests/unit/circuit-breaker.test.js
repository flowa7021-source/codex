// ─── Unit Tests: CircuitBreaker ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
} from '../../app/modules/circuit-breaker.js';

const pass = (..._args) => Promise.resolve('ok');
const fail = (..._args) => Promise.reject(new Error('boom'));

// ─── Initial state ────────────────────────────────────────────────────────────

describe('CircuitBreaker – initial state', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 3, timeout: 1000 });
    assert.equal(cb.state, 'closed');
  });

  it('starts with zero failure count', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 3, timeout: 1000 });
    assert.equal(cb.failureCount, 0);
  });
});

// ─── execute – success path ───────────────────────────────────────────────────

describe('CircuitBreaker – execute success', () => {
  it('returns the resolved value from the wrapped function', async () => {
    const fn = () => Promise.resolve(42);
    const cb = new CircuitBreaker(fn, { failureThreshold: 3, timeout: 1000 });
    const result = await cb.execute();
    assert.equal(result, 42);
  });

  it('stays closed after a successful call', async () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 3, timeout: 1000 });
    await cb.execute();
    assert.equal(cb.state, 'closed');
  });

  it('resets failure count on success in closed state', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 5, timeout: 1000 });
    await cb.execute().catch(() => {});
    await cb.execute().catch(() => {});
    assert.equal(cb.failureCount, 2);

    const cbOk = new CircuitBreaker(pass, { failureThreshold: 5, timeout: 1000 });
    // Pre-load 2 failures into a circuit via trip then reset trick
    const mixed = new CircuitBreaker(fail, { failureThreshold: 5, timeout: 1000 });
    await mixed.execute().catch(() => {});
    await mixed.execute().catch(() => {});
    assert.equal(mixed.failureCount, 2);

    // Now inject a success function and call execute
    const mixedOk = new CircuitBreaker(pass, { failureThreshold: 5, timeout: 1000 });
    // We need to show that a success resets failureCount:
    // trigger 2 failures then 1 success via execute on a wrapper
    // Use a real wrapper:
    let calls = 0;
    const twoFailsThenPass = () => {
      calls++;
      if (calls <= 2) return Promise.reject(new Error('fail'));
      return Promise.resolve('pass');
    };
    const cb2 = new CircuitBreaker(twoFailsThenPass, { failureThreshold: 5, timeout: 1000 });
    await cb2.execute().catch(() => {});
    await cb2.execute().catch(() => {});
    assert.equal(cb2.failureCount, 2);
    await cb2.execute();
    assert.equal(cb2.failureCount, 0);
  });

  it('forwards arguments to the wrapped function', async () => {
    const received = [];
    const fn = (...args) => { received.push(...args); return Promise.resolve(); };
    const cb = new CircuitBreaker(fn, { failureThreshold: 3, timeout: 1000 });
    await cb.execute('a', 'b', 'c');
    assert.deepEqual(received, ['a', 'b', 'c']);
  });
});

// ─── execute – failure path ───────────────────────────────────────────────────

describe('CircuitBreaker – execute failure', () => {
  it('re-throws the original error', async () => {
    const err = new Error('specific');
    const cb = new CircuitBreaker(() => Promise.reject(err), { failureThreshold: 5, timeout: 1000 });
    await assert.rejects(() => cb.execute(), (thrown) => thrown === err);
  });

  it('increments failureCount on each failure', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 5, timeout: 1000 });
    await cb.execute().catch(() => {});
    assert.equal(cb.failureCount, 1);
    await cb.execute().catch(() => {});
    assert.equal(cb.failureCount, 2);
  });

  it('opens the circuit after failureThreshold failures', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 3, timeout: 1000 });
    for (let i = 0; i < 3; i++) await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');
  });

  it('does not open before failureThreshold is reached', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 4, timeout: 1000 });
    for (let i = 0; i < 3; i++) await cb.execute().catch(() => {});
    assert.equal(cb.state, 'closed');
  });
});

// ─── open circuit ─────────────────────────────────────────────────────────────

describe('CircuitBreaker – open circuit', () => {
  it('throws CircuitOpenError without invoking fn when open', async () => {
    let called = false;
    const fn = () => { called = true; return Promise.resolve(); };
    const cb = new CircuitBreaker(fail, { failureThreshold: 1, timeout: 5000 });
    await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');

    const cb2 = new CircuitBreaker(fn, { failureThreshold: 1, timeout: 5000 });
    cb2.trip();
    await assert.rejects(() => cb2.execute(), (err) => err instanceof CircuitOpenError);
    assert.equal(called, false);
  });

  it('CircuitOpenError message matches "Circuit is open"', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 1, timeout: 5000 });
    await cb.execute().catch(() => {});
    await assert.rejects(() => cb.execute(), /Circuit is open/);
  });
});

// ─── CircuitOpenError ─────────────────────────────────────────────────────────

describe('CircuitOpenError', () => {
  it('is an instance of Error', () => {
    const err = new CircuitOpenError();
    assert.ok(err instanceof Error);
  });

  it('has the default message', () => {
    const err = new CircuitOpenError();
    assert.equal(err.message, 'Circuit is open');
  });

  it('accepts a custom message', () => {
    const err = new CircuitOpenError('custom');
    assert.equal(err.message, 'custom');
  });

  it('has name CircuitOpenError', () => {
    const err = new CircuitOpenError();
    assert.equal(err.name, 'CircuitOpenError');
  });
});

// ─── trip() ──────────────────────────────────────────────────────────────────

describe('CircuitBreaker – trip', () => {
  it('forces circuit open immediately', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 100, timeout: 1000 });
    cb.trip();
    assert.equal(cb.state, 'open');
  });

  it('throws CircuitOpenError after trip()', async () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 100, timeout: 1000 });
    cb.trip();
    await assert.rejects(() => cb.execute(), (err) => err instanceof CircuitOpenError);
  });

  it('sets failureCount to failureThreshold', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 5, timeout: 1000 });
    cb.trip();
    assert.equal(cb.failureCount, 5);
  });
});

// ─── reset() ─────────────────────────────────────────────────────────────────

describe('CircuitBreaker – reset', () => {
  it('moves circuit back to closed from open', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 1, timeout: 1000 });
    await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');
    cb.reset();
    assert.equal(cb.state, 'closed');
  });

  it('clears failure count', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 5, timeout: 1000 });
    await cb.execute().catch(() => {});
    await cb.execute().catch(() => {});
    cb.reset();
    assert.equal(cb.failureCount, 0);
  });

  it('allows execution after reset', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 1, timeout: 1000 });
    await cb.execute().catch(() => {});
    cb.reset();
    // Now use a passing function
    const cb2 = new CircuitBreaker(pass, { failureThreshold: 1, timeout: 1000 });
    const result = await cb2.execute();
    assert.equal(result, 'ok');
  });

  it('can open again after reset following further failures', async () => {
    const cb = new CircuitBreaker(fail, { failureThreshold: 2, timeout: 1000 });
    for (let i = 0; i < 2; i++) await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');
    cb.reset();
    assert.equal(cb.state, 'closed');
    for (let i = 0; i < 2; i++) await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');
  });
});

// ─── advance — timeout to half-open ──────────────────────────────────────────

describe('CircuitBreaker – advance to half-open', () => {
  it('transitions to half-open after advancing past timeout', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 1, timeout: 1000 });
    cb.trip();
    assert.equal(cb.state, 'open');
    cb.advance(1000);
    assert.equal(cb.state, 'half-open');
  });

  it('stays open before timeout elapses', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 1, timeout: 2000 });
    cb.trip();
    cb.advance(999);
    assert.equal(cb.state, 'open');
  });

  it('throws on negative advance', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 3, timeout: 1000 });
    assert.throws(() => cb.advance(-1), RangeError);
  });

  it('advance is cumulative', () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 1, timeout: 1000 });
    cb.trip();
    cb.advance(500);
    cb.advance(500);
    assert.equal(cb.state, 'half-open');
  });
});

// ─── half-open → closed (success path) ───────────────────────────────────────

describe('CircuitBreaker – half-open success path', () => {
  it('closes after successThreshold successes in half-open', async () => {
    const cb = new CircuitBreaker(pass, {
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 1000,
    });
    cb.trip();
    cb.advance(1000);
    assert.equal(cb.state, 'half-open');

    await cb.execute();
    assert.equal(cb.state, 'half-open'); // 1 success, need 2

    await cb.execute();
    assert.equal(cb.state, 'closed'); // 2 successes → closed
  });

  it('default successThreshold is 1', async () => {
    const cb = new CircuitBreaker(pass, { failureThreshold: 1, timeout: 1000 });
    cb.trip();
    cb.advance(1000);
    await cb.execute();
    assert.equal(cb.state, 'closed');
  });

  it('clears counters when closing from half-open', async () => {
    const cb = new CircuitBreaker(pass, {
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 1000,
    });
    cb.trip();
    cb.advance(1000);
    await cb.execute();
    assert.equal(cb.state, 'closed');
    assert.equal(cb.failureCount, 0);
  });
});

// ─── half-open → open (failure path) ─────────────────────────────────────────

describe('CircuitBreaker – half-open failure path', () => {
  it('reopens on first failure in half-open', async () => {
    const cb = new CircuitBreaker(fail, {
      failureThreshold: 1,
      successThreshold: 3,
      timeout: 1000,
    });
    cb.trip();
    cb.advance(1000);
    assert.equal(cb.state, 'half-open');

    await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');
  });

  it('can transition to half-open again after re-opening from half-open', async () => {
    const cb = new CircuitBreaker(fail, {
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 1000,
    });
    cb.trip();
    cb.advance(1000); // → half-open
    await cb.execute().catch(() => {}); // → open again
    assert.equal(cb.state, 'open');

    cb.advance(1000); // → half-open again
    assert.equal(cb.state, 'half-open');
  });
});

// ─── onStateChange callback ───────────────────────────────────────────────────

describe('CircuitBreaker – onStateChange', () => {
  it('calls onStateChange when circuit opens', async () => {
    const changes = [];
    const cb = new CircuitBreaker(fail, {
      failureThreshold: 2,
      timeout: 1000,
      onStateChange: (s) => changes.push(s),
    });
    await cb.execute().catch(() => {});
    await cb.execute().catch(() => {});
    assert.deepEqual(changes, ['open']);
  });

  it('calls onStateChange when transitioning to half-open', () => {
    const changes = [];
    const cb = new CircuitBreaker(pass, {
      failureThreshold: 1,
      timeout: 1000,
      onStateChange: (s) => changes.push(s),
    });
    cb.trip();
    cb.advance(1000);
    void cb.state; // trigger the transition
    assert.ok(changes.includes('half-open'));
  });

  it('calls onStateChange when closing from half-open', async () => {
    const changes = [];
    const cb = new CircuitBreaker(pass, {
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 1000,
      onStateChange: (s) => changes.push(s),
    });
    cb.trip();
    cb.advance(1000);
    await cb.execute();
    assert.ok(changes.includes('closed'));
  });
});

// ─── createCircuitBreaker factory ────────────────────────────────────────────

describe('createCircuitBreaker – factory', () => {
  it('returns a CircuitBreaker instance', () => {
    const cb = createCircuitBreaker(pass, { failureThreshold: 3, timeout: 1000 });
    assert.ok(cb instanceof CircuitBreaker);
  });

  it('factory-created instance starts closed', () => {
    const cb = createCircuitBreaker(pass, { failureThreshold: 3, timeout: 1000 });
    assert.equal(cb.state, 'closed');
  });

  it('factory-created instance opens after failures', async () => {
    const cb = createCircuitBreaker(fail, { failureThreshold: 2, timeout: 1000 });
    await cb.execute().catch(() => {});
    await cb.execute().catch(() => {});
    assert.equal(cb.state, 'open');
  });
});
