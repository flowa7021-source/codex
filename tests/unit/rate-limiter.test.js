// ─── Unit Tests: Rate Limiter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TokenBucket,
  SlidingWindowLimiter,
  FixedWindowLimiter,
  LeakyBucket,
  RateLimiter,
} from '../../app/modules/rate-limiter.js';

// ─── TokenBucket ──────────────────────────────────────────────────────────────

describe('TokenBucket – constructor', () => {
  it('starts full (tokens === capacity)', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    assert.equal(bucket.tokens, 10);
  });

  it('throws on non-positive capacity', () => {
    assert.throws(() => new TokenBucket({ capacity: 0, refillRate: 1 }), RangeError);
  });

  it('throws on non-positive refillRate', () => {
    assert.throws(() => new TokenBucket({ capacity: 10, refillRate: 0 }), RangeError);
  });
});

describe('TokenBucket – consume', () => {
  it('returns true when tokens are available', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    assert.equal(bucket.consume(), true);
  });

  it('decrements token count on each consume', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    bucket.consume();
    bucket.consume();
    assert.equal(bucket.tokens, 3);
  });

  it('returns false when no tokens remain', () => {
    const bucket = new TokenBucket({ capacity: 2, refillRate: 1 });
    bucket.consume();
    bucket.consume();
    assert.equal(bucket.consume(), false);
  });

  it('consumes multiple tokens at once', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    assert.equal(bucket.consume(5), true);
    assert.equal(bucket.tokens, 5);
  });

  it('returns false when requesting more tokens than available', () => {
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1 });
    assert.equal(bucket.consume(4), false);
  });

  it('throws on non-positive token request', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    assert.throws(() => bucket.consume(0), RangeError);
  });
});

describe('TokenBucket – advance (refill)', () => {
  it('refills tokens after advancing time', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 5 }); // 5 tokens/sec
    bucket.consume(5); // consume 5 tokens
    assert.equal(bucket.tokens, 5);

    bucket.advance(1000); // advance 1 second → should refill 5 tokens
    assert.ok(bucket.tokens >= 9.9, `expected ~10, got ${bucket.tokens}`);
  });

  it('does not exceed capacity after refill', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 100 }); // fast refill
    bucket.consume(1);
    bucket.advance(5000); // advance 5 seconds
    assert.equal(bucket.tokens, 10); // capped at capacity
  });

  it('allows consuming after refill', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 5 }); // 5 tokens/sec
    // Drain completely
    bucket.consume(5);
    assert.equal(bucket.consume(), false);

    // Advance 1 second to refill 5 tokens
    bucket.advance(1000);
    assert.equal(bucket.consume(), true);
  });

  it('throws on negative advance', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    assert.throws(() => bucket.advance(-1), RangeError);
  });

  it('partial refill works correctly', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 2 }); // 2 tokens/sec
    bucket.consume(4); // 6 remaining
    bucket.advance(500); // 0.5 seconds → +1 token
    assert.ok(bucket.tokens >= 6.9 && bucket.tokens <= 7.1,
      `expected ~7, got ${bucket.tokens}`);
  });
});

// ─── SlidingWindowLimiter ─────────────────────────────────────────────────────

describe('SlidingWindowLimiter – constructor', () => {
  it('throws on non-positive windowMs', () => {
    assert.throws(
      () => new SlidingWindowLimiter({ windowMs: 0, maxRequests: 5 }),
      RangeError,
    );
  });

  it('throws on non-positive maxRequests', () => {
    assert.throws(
      () => new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 0 }),
      RangeError,
    );
  });
});

describe('SlidingWindowLimiter – hit', () => {
  it('allows requests up to the limit', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 3 });
    const t = 1000;
    assert.equal(sw.hit(t), true);
    assert.equal(sw.hit(t + 1), true);
    assert.equal(sw.hit(t + 2), true);
  });

  it('rejects requests over the limit', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 2 });
    const t = 2000;
    sw.hit(t);
    sw.hit(t + 1);
    assert.equal(sw.hit(t + 2), false);
  });

  it('allows requests after window slides past old entries', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 2 });
    const t = 5000;
    sw.hit(t);       // at t=5000
    sw.hit(t + 100); // at t=5100
    // Both are within the 1s window; blocked
    assert.equal(sw.hit(t + 200), false);

    // Advance to t=6100: the entry at 5000 is now exactly 1000ms old → outside
    // cutoff = 6100 - 1000 = 5100, so entries <= 5100 expire
    // Entry at t=5000 (5000 <= 5100) → gone; entry at t=5100 (5100 <= 5100) → gone
    assert.equal(sw.hit(t + 1101), true);
  });

  it('count is 0 for a fresh instance', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 5 });
    assert.equal(sw.count(Date.now()), 0);
  });
});

describe('SlidingWindowLimiter – count', () => {
  it('reflects active requests in window', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 2000, maxRequests: 10 });
    const t = 10000;
    sw.hit(t);
    sw.hit(t + 500);
    sw.hit(t + 1000);
    assert.equal(sw.count(t + 1000), 3);
  });

  it('expires old entries from count', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 10 });
    const t = 20000;
    sw.hit(t);       // will expire when now >= t + 1000
    sw.hit(t + 500); // will expire when now >= t + 1500
    // At t + 1001: entry at t is expired (t + 1001 - 1000 = t + 1, so cutoff = t+1, t <= t+1)
    assert.equal(sw.count(t + 1001), 1);
  });
});

describe('SlidingWindowLimiter – purge', () => {
  it('manually removes expired entries', () => {
    const sw = new SlidingWindowLimiter({ windowMs: 1000, maxRequests: 10 });
    const t = 30000;
    sw.hit(t);
    sw.purge(t + 2000); // purge entries older than 1 second relative to t+2000
    assert.equal(sw.count(t + 2000), 0);
  });
});

// ─── FixedWindowLimiter ───────────────────────────────────────────────────────

describe('FixedWindowLimiter – constructor', () => {
  it('throws on non-positive windowMs', () => {
    assert.throws(
      () => new FixedWindowLimiter({ windowMs: 0, maxRequests: 5 }),
      RangeError,
    );
  });

  it('throws on non-positive maxRequests', () => {
    assert.throws(
      () => new FixedWindowLimiter({ windowMs: 1000, maxRequests: 0 }),
      RangeError,
    );
  });
});

describe('FixedWindowLimiter – hit', () => {
  it('allows requests up to the limit', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 3 });
    const t = Date.now();
    assert.equal(fw.hit(t), true);
    assert.equal(fw.hit(t + 1), true);
    assert.equal(fw.hit(t + 2), true);
  });

  it('rejects requests over the limit in same window', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 2 });
    const t = Date.now();
    fw.hit(t);
    fw.hit(t + 1);
    assert.equal(fw.hit(t + 2), false);
  });

  it('resets counter in a new window', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 2 });
    const t = Date.now();
    fw.hit(t);
    fw.hit(t + 1);
    assert.equal(fw.hit(t + 2), false); // blocked in current window

    // Advance into the next window
    assert.equal(fw.hit(t + 1500), true);
  });
});

describe('FixedWindowLimiter – count', () => {
  it('starts at 0', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 5 });
    assert.equal(fw.count(Date.now()), 0);
  });

  it('increments after each hit', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 5 });
    const t = Date.now();
    fw.hit(t);
    fw.hit(t + 1);
    assert.equal(fw.count(t + 1), 2);
  });

  it('resets to 0 in a new window', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 5 });
    const t = Date.now();
    fw.hit(t);
    fw.hit(t + 100);
    assert.equal(fw.count(t + 100), 2);
    assert.equal(fw.count(t + 1500), 0); // new window
  });
});

describe('FixedWindowLimiter – reset', () => {
  it('clears the count immediately', () => {
    const fw = new FixedWindowLimiter({ windowMs: 1000, maxRequests: 2 });
    const t = Date.now();
    fw.hit(t);
    fw.hit(t + 1);
    assert.equal(fw.hit(t + 2), false); // blocked
    fw.reset();
    assert.equal(fw.count(Date.now()), 0);
    assert.equal(fw.hit(Date.now()), true);
  });
});

// ─── LeakyBucket ─────────────────────────────────────────────────────────────

describe('LeakyBucket – constructor', () => {
  it('starts with level 0', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 1 });
    assert.equal(lb.level, 0);
  });

  it('throws on non-positive capacity', () => {
    assert.throws(() => new LeakyBucket({ capacity: 0, drainRate: 1 }), RangeError);
  });

  it('throws on non-positive drainRate', () => {
    assert.throws(() => new LeakyBucket({ capacity: 10, drainRate: 0 }), RangeError);
  });
});

describe('LeakyBucket – add', () => {
  it('accepts water when bucket is empty', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 1 });
    assert.equal(lb.add(3), true);
    assert.equal(lb.level, 3);
  });

  it('accepts multiple adds up to capacity', () => {
    const lb = new LeakyBucket({ capacity: 5, drainRate: 1 });
    assert.equal(lb.add(3), true);
    assert.equal(lb.add(2), true);
    assert.equal(lb.level, 5);
  });

  it('rejects add that would overflow', () => {
    const lb = new LeakyBucket({ capacity: 5, drainRate: 1 });
    lb.add(4);
    assert.equal(lb.add(2), false); // 4+2=6 > 5
    assert.equal(lb.level, 4); // level unchanged on reject
  });

  it('rejects add when bucket is full', () => {
    const lb = new LeakyBucket({ capacity: 3, drainRate: 1 });
    lb.add(3);
    assert.equal(lb.add(1), false);
  });

  it('throws on non-positive amount', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 1 });
    assert.throws(() => lb.add(0), RangeError);
  });

  it('adds default amount of 1', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 1 });
    lb.add();
    assert.equal(lb.level, 1);
  });
});

describe('LeakyBucket – advance (drain)', () => {
  it('drains over time', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 2 }); // 2 units/sec
    lb.add(6);
    assert.equal(lb.level, 6);

    lb.advance(1000); // 1 second → drain 2 units
    assert.ok(lb.level >= 3.9 && lb.level <= 4.1,
      `expected ~4, got ${lb.level}`);
  });

  it('does not drain below 0', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 5 });
    lb.add(2);
    lb.advance(2000); // drain 10 units but only 2 in bucket
    assert.equal(lb.level, 0);
  });

  it('allows more adds after draining', () => {
    const lb = new LeakyBucket({ capacity: 5, drainRate: 5 }); // drains 5/sec
    lb.add(5); // full
    assert.equal(lb.add(1), false); // can't add — full

    lb.advance(1000); // drain 5 units → empty
    assert.equal(lb.add(3), true);
    assert.equal(lb.level, 3);
  });

  it('throws on negative advance', () => {
    const lb = new LeakyBucket({ capacity: 10, drainRate: 1 });
    assert.throws(() => lb.advance(-1), RangeError);
  });
});

// ─── Legacy RateLimiter (backward-compatible) ─────────────────────────────────

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
