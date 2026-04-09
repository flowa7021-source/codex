// ─── Unit Tests: RateLimiter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RateLimiter } from '../../app/modules/rate-limiter.js';

describe('RateLimiter – constructor', () => {
  it('exposes limit and windowMs', () => {
    const rl = new RateLimiter({ limit: 10, windowMs: 1000 });
    assert.equal(rl.limit, 10);
    assert.equal(rl.windowMs, 1000);
  });

  it('throws on non-positive limit', () => {
    assert.throws(() => new RateLimiter({ limit: 0, windowMs: 1000 }), RangeError);
  });

  it('throws on non-positive windowMs', () => {
    assert.throws(() => new RateLimiter({ limit: 5, windowMs: 0 }), RangeError);
  });
});

describe('RateLimiter – tryConsume', () => {
  it('allows requests up to the limit', () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 60000 });
    assert.equal(rl.tryConsume(), true);
    assert.equal(rl.tryConsume(), true);
    assert.equal(rl.tryConsume(), true);
  });

  it('blocks after limit is reached', () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 60000 });
    rl.tryConsume();
    rl.tryConsume();
    assert.equal(rl.tryConsume(), false);
  });

  it('uses default key when none provided', () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60000 });
    assert.equal(rl.tryConsume(), true);
    assert.equal(rl.tryConsume(), false);
  });
});

describe('RateLimiter – remaining', () => {
  it('starts at limit', () => {
    const rl = new RateLimiter({ limit: 5, windowMs: 60000 });
    assert.equal(rl.remaining(), 5);
  });

  it('decrements as tokens are consumed', () => {
    const rl = new RateLimiter({ limit: 5, windowMs: 60000 });
    rl.tryConsume();
    assert.equal(rl.remaining(), 4);
    rl.tryConsume();
    assert.equal(rl.remaining(), 3);
  });

  it('returns 0 when exhausted', () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 60000 });
    rl.tryConsume();
    rl.tryConsume();
    assert.equal(rl.remaining(), 0);
  });
});

describe('RateLimiter – resetAt', () => {
  it('returns a future timestamp', () => {
    const rl = new RateLimiter({ limit: 5, windowMs: 1000 });
    const before = Date.now();
    const reset = rl.resetAt();
    const after = Date.now();
    assert.ok(reset > before, 'resetAt should be in the future');
    assert.ok(reset <= after + 1000, 'resetAt should be within one window');
  });
});

describe('RateLimiter – reset', () => {
  it('clears all state so tokens replenish', () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 60000 });
    rl.tryConsume();
    rl.tryConsume();
    assert.equal(rl.remaining(), 0);
    rl.reset();
    assert.equal(rl.remaining(), 2);
  });

  it('clears state for all keys', () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60000 });
    rl.tryConsume('user1');
    rl.tryConsume('user2');
    rl.reset();
    assert.equal(rl.remaining('user1'), 1);
    assert.equal(rl.remaining('user2'), 1);
  });
});

describe('RateLimiter – multiple keys', () => {
  it('tracks keys independently', () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 60000 });
    rl.tryConsume('alice');
    rl.tryConsume('alice');
    assert.equal(rl.remaining('alice'), 0);
    assert.equal(rl.remaining('bob'), 2);
  });

  it('blocking one key does not block another', () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60000 });
    rl.tryConsume('alice');
    assert.equal(rl.tryConsume('alice'), false);
    assert.equal(rl.tryConsume('bob'), true);
  });
});

describe('RateLimiter – window expiry', () => {
  it('replenishes tokens after the window expires', () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 1000 });
    rl.tryConsume();
    rl.tryConsume();
    rl.tryConsume();
    assert.equal(rl.remaining(), 0);

    // Advance time by 2 seconds (past the 1s window)
    const realNow = Date.now;
    Date.now = () => realNow() + 60000;
    try {
      assert.equal(rl.remaining(), 3);
      assert.equal(rl.tryConsume(), true);
    } finally {
      Date.now = realNow;
    }
  });

  it('resetAt updates after window expires', () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 1000 });
    const firstReset = rl.resetAt();

    const realNow = Date.now;
    const offset = 60000;
    Date.now = () => realNow() + offset;
    try {
      // Accessing remaining after window expiry creates a new window
      rl.remaining();
      const newReset = rl.resetAt();
      assert.ok(newReset > firstReset, 'resetAt should advance after window expires');
    } finally {
      Date.now = realNow;
    }
  });
});
