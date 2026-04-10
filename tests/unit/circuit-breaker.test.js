// ─── Unit Tests: CircuitBreaker ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CircuitBreaker, CircuitBreakerError } from '../../app/modules/circuit-breaker.js';

const pass = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('boom'));

// ─── Initial state ────────────────────────────────────────────────────────────

describe('CircuitBreaker – initial state', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker();
    assert.equal(cb.state, 'closed');
  });

  it('starts with zero failure and success counts', () => {
    const cb = new CircuitBreaker();
    assert.equal(cb.failureCount, 0);
    assert.equal(cb.successCount, 0);
  });
});

// ─── Execute success ──────────────────────────────────────────────────────────

describe('CircuitBreaker – execute success', () => {
  it('returns the value from the function', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(() => Promise.resolve(42));
    assert.equal(result, 42);
  });

  it('stays closed after a success', async () => {
    const cb = new CircuitBreaker();
    await cb.execute(pass);
    assert.equal(cb.state, 'closed');
  });

  it('resets failure count on success in closed state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    // Trigger some failures but not enough to open
    for (let i = 0; i < 3; i++) {
      await cb.execute(fail).catch(() => {});
    }
    assert.equal(cb.failureCount, 3);
    await cb.execute(pass);
    assert.equal(cb.failureCount, 0);
  });
});

// ─── Execute failure ──────────────────────────────────────────────────────────

describe('CircuitBreaker – execute failure', () => {
  it('increments failure count on failure', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.failureCount, 1);
  });

  it('opens after reaching failure threshold (failureThreshold option)', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    for (let i = 0; i < 3; i++) {
      await cb.execute(fail).catch(() => {});
    }
    assert.equal(cb.state, 'open');
  });

  it('re-throws the original error', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    const err = new Error('specific error');
    await assert.rejects(
      () => cb.execute(() => Promise.reject(err)),
      (thrown) => thrown === err,
    );
  });
});

// ─── Open circuit ─────────────────────────────────────────────────────────────

describe('CircuitBreaker – open circuit', () => {
  it('throws CircuitBreakerError without calling fn when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    let called = false;
    await assert.rejects(
      () => cb.execute(() => { called = true; return Promise.resolve(); }),
      (err) => err instanceof CircuitBreakerError,
    );
    assert.equal(called, false);
  });

  it('thrown error message matches "Circuit is open"', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await cb.execute(fail).catch(() => {});
    await assert.rejects(
      () => cb.execute(pass),
      /Circuit is open/,
    );
  });
});

// ─── CircuitBreakerError ──────────────────────────────────────────────────────

describe('CircuitBreakerError', () => {
  it('is an instance of Error', () => {
    const err = new CircuitBreakerError();
    assert.ok(err instanceof Error);
  });

  it('has default message', () => {
    const err = new CircuitBreakerError();
    assert.equal(err.message, 'Circuit is open');
  });

  it('accepts a custom message', () => {
    const err = new CircuitBreakerError('custom message');
    assert.equal(err.message, 'custom message');
  });

  it('has name CircuitBreakerError', () => {
    const err = new CircuitBreakerError();
    assert.equal(err.name, 'CircuitBreakerError');
  });
});

// ─── trip() ──────────────────────────────────────────────────────────────────

describe('CircuitBreaker – trip', () => {
  it('forces circuit open immediately', () => {
    const cb = new CircuitBreaker({ failureThreshold: 100 });
    cb.trip();
    assert.equal(cb.state, 'open');
  });

  it('throws when circuit was tripped', async () => {
    const cb = new CircuitBreaker();
    cb.trip();
    await assert.rejects(
      () => cb.execute(pass),
      (err) => err instanceof CircuitBreakerError,
    );
  });
});

// ─── advance() — timeout to half-open ────────────────────────────────────────

describe('CircuitBreaker – advance to half-open', () => {
  it('transitions to half-open after advancing past timeout', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 1000 });
    cb.trip();
    assert.equal(cb.state, 'open');

    cb.advance(1001); // advance 1001ms > 1000ms timeout
    assert.equal(cb.state, 'half-open');
  });

  it('stays open before timeout elapses', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 2000 });
    cb.trip();
    cb.advance(500);
    assert.equal(cb.state, 'open');
  });

  it('throws on negative advance', () => {
    const cb = new CircuitBreaker();
    assert.throws(() => cb.advance(-1), RangeError);
  });

  it('supports resetTimeoutMs for backward compatibility', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    cb.trip();
    cb.advance(1001);
    assert.equal(cb.state, 'half-open');
  });
});

// ─── half-open → closed (success path) ───────────────────────────────────────

describe('CircuitBreaker – half-open success path', () => {
  it('closes circuit after successThreshold successes in half-open', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      timeout: 1000,
      successThreshold: 2,
    });

    // Open the circuit
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    // Advance time to trigger half-open
    cb.advance(1001);
    assert.equal(cb.state, 'half-open');

    await cb.execute(pass);
    assert.equal(cb.state, 'half-open'); // still half-open after 1 success

    await cb.execute(pass);
    assert.equal(cb.state, 'closed'); // closed after 2 successes
  });

  it('successCount increments in half-open', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      timeout: 1000,
      successThreshold: 3,
    });
    await cb.execute(fail).catch(() => {});
    cb.advance(1001);

    await cb.execute(pass);
    assert.equal(cb.successCount, 1);
    await cb.execute(pass);
    assert.equal(cb.successCount, 2);
  });

  it('clears counters when transitioning to closed', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      timeout: 1000,
      successThreshold: 1,
    });
    await cb.execute(fail).catch(() => {});
    cb.advance(1001);
    await cb.execute(pass);
    assert.equal(cb.state, 'closed');
    assert.equal(cb.successCount, 0);
    assert.equal(cb.failureCount, 0);
  });
});

// ─── half-open → open (failure path) ─────────────────────────────────────────

describe('CircuitBreaker – half-open failure path', () => {
  it('reopens circuit on first failure in half-open state', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      timeout: 1000,
      successThreshold: 3,
    });

    // Open the circuit
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    cb.advance(1001);
    assert.equal(cb.state, 'half-open');

    // Fail in half-open
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');
  });

  it('can transition to half-open again after re-opening from half-open', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      timeout: 1000,
      successThreshold: 2,
    });
    await cb.execute(fail).catch(() => {});
    cb.advance(1001); // → half-open
    await cb.execute(fail).catch(() => {}); // → open again
    assert.equal(cb.state, 'open');

    cb.advance(1001); // → half-open again
    assert.equal(cb.state, 'half-open');
  });
});

// ─── reset() ─────────────────────────────────────────────────────────────────

describe('CircuitBreaker – reset', () => {
  it('returns to closed state from open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');
    cb.reset();
    assert.equal(cb.state, 'closed');
  });

  it('clears failure and success counts', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.failureCount, 1);
    cb.reset();
    assert.equal(cb.failureCount, 0);
    assert.equal(cb.successCount, 0);
  });

  it('allows execution after reset from open state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await cb.execute(fail).catch(() => {});
    cb.reset();
    const result = await cb.execute(() => Promise.resolve('restored'));
    assert.equal(result, 'restored');
  });

  it('transitions back to open after failures following a reset', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    for (let i = 0; i < 2; i++) await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');
    cb.reset();
    assert.equal(cb.state, 'closed');
    for (let i = 0; i < 2; i++) await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');
  });
});

// ─── Backward compatibility — resetTimeoutMs ─────────────────────────────────

describe('CircuitBreaker – resetTimeoutMs (legacy)', () => {
  it('transitions to half-open after resetTimeoutMs elapses', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    const realNow = Date.now;
    Date.now = () => realNow() + 2000;
    try {
      assert.equal(cb.state, 'half-open');
    } finally {
      Date.now = realNow;
    }
  });

  it('closes circuit after successThreshold successes in half-open (resetTimeoutMs)', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 2,
    });

    // Open the circuit
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    // Advance time to trigger half-open
    const realNow = Date.now;
    Date.now = () => realNow() + 2000;
    try {
      assert.equal(cb.state, 'half-open');

      await cb.execute(pass);
      assert.equal(cb.state, 'half-open'); // still half-open after 1 success

      await cb.execute(pass);
      assert.equal(cb.state, 'closed'); // closed after 2 successes
    } finally {
      Date.now = realNow;
    }
  });

  it('reopens circuit on failure in half-open state (resetTimeoutMs)', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      successThreshold: 3,
    });

    // Open the circuit
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    const realNow = Date.now;
    Date.now = () => realNow() + 2000;
    try {
      assert.equal(cb.state, 'half-open');

      // Fail in half-open
      await cb.execute(fail).catch(() => {});
      assert.equal(cb.state, 'open');
    } finally {
      Date.now = realNow;
    }
  });
});
