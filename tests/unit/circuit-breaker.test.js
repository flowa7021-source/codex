// ─── Unit Tests: CircuitBreaker ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CircuitBreaker } from '../../app/modules/circuit-breaker.js';

const pass = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('boom'));

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

describe('CircuitBreaker – execute failure', () => {
  it('increments failure count on failure', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.failureCount, 1);
  });

  it('opens after reaching failure threshold', async () => {
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

describe('CircuitBreaker – open circuit', () => {
  it('throws immediately without calling fn when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await cb.execute(fail).catch(() => {});
    assert.equal(cb.state, 'open');

    let called = false;
    await assert.rejects(
      () => cb.execute(() => { called = true; return Promise.resolve(); }),
      /Circuit is open/,
    );
    assert.equal(called, false);
  });
});

describe('CircuitBreaker – half-open after timeout', () => {
  it('transitions to half-open after resetTimeoutMs', async () => {
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
});

describe('CircuitBreaker – half-open success path', () => {
  it('closes circuit after successThreshold successes in half-open', async () => {
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
});

describe('CircuitBreaker – half-open failure path', () => {
  it('reopens circuit on failure in half-open state', async () => {
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
});
