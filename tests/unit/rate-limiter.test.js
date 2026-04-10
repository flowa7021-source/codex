// ─── Unit Tests: Rate Limiter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SlidingWindowRateLimiter,
  LeakyBucket,
  createSlidingWindowLimiter,
  createLeakyBucket,
} from '../../app/modules/rate-limiter.js';

// ─── SlidingWindowRateLimiter — constructor ───────────────────────────────────

describe('SlidingWindowRateLimiter – constructor', () => {
  it('creates an instance with limit and windowMs', () => {
    const limiter = new SlidingWindowRateLimiter(5, 1000);
    assert.ok(limiter instanceof SlidingWindowRateLimiter);
  });

  it('starts with full remaining capacity', () => {
    const limiter = new SlidingWindowRateLimiter(10, 5000);
    assert.equal(limiter.remaining('user:1'), 10);
  });
});

// ─── SlidingWindowRateLimiter — isAllowed ─────────────────────────────────────

describe('SlidingWindowRateLimiter – isAllowed', () => {
  it('allows requests within the limit', () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);
    const t = 100000;
    assert.equal(limiter.isAllowed('u', t), true);
    assert.equal(limiter.isAllowed('u', t + 1), true);
    assert.equal(limiter.isAllowed('u', t + 2), true);
  });

  it('denies the request that exceeds the limit', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    const t = 200000;
    limiter.isAllowed('u', t);
    limiter.isAllowed('u', t + 1);
    assert.equal(limiter.isAllowed('u', t + 2), false);
  });

  it('consumes a slot on each allowed call', () => {
    const limiter = new SlidingWindowRateLimiter(5, 1000);
    const t = 300000;
    limiter.isAllowed('u', t);
    assert.equal(limiter.remaining('u', t), 4);
    limiter.isAllowed('u', t + 1);
    assert.equal(limiter.remaining('u', t + 1), 3);
  });

  it('tracks separate ids independently', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    const t = 400000;
    limiter.isAllowed('alice', t);
    limiter.isAllowed('alice', t + 1);
    assert.equal(limiter.isAllowed('alice', t + 2), false);
    assert.equal(limiter.isAllowed('bob', t + 2), true);
  });

  it('allows requests again after the window slides forward', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    const t = 500000;
    limiter.isAllowed('u', t);
    limiter.isAllowed('u', t + 100);
    assert.equal(limiter.isAllowed('u', t + 200), false);
    // At t+1101, both entries at t and t+100 are outside the 1000ms window
    assert.equal(limiter.isAllowed('u', t + 1101), true);
  });

  it('uses Date.now() when no now argument is provided', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    assert.equal(limiter.isAllowed('x'), true);
    assert.equal(limiter.isAllowed('x'), false);
  });

  it('a limit of 1 allows exactly one request per window', () => {
    const limiter = new SlidingWindowRateLimiter(1, 5000);
    const t = 600000;
    assert.equal(limiter.isAllowed('u', t), true);
    assert.equal(limiter.isAllowed('u', t + 1), false);
    assert.equal(limiter.isAllowed('u', t + 5001), true);
  });
});

// ─── SlidingWindowRateLimiter — remaining ─────────────────────────────────────

describe('SlidingWindowRateLimiter – remaining', () => {
  it('starts at limit for a new id', () => {
    const limiter = new SlidingWindowRateLimiter(7, 1000);
    assert.equal(limiter.remaining('new-id'), 7);
  });

  it('decrements after each allowed request', () => {
    const limiter = new SlidingWindowRateLimiter(5, 1000);
    const t = 700000;
    limiter.isAllowed('u', t);
    limiter.isAllowed('u', t + 1);
    assert.equal(limiter.remaining('u', t + 1), 3);
  });

  it('returns 0 when fully consumed', () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);
    const t = 800000;
    limiter.isAllowed('u', t);
    limiter.isAllowed('u', t + 1);
    limiter.isAllowed('u', t + 2);
    assert.equal(limiter.remaining('u', t + 2), 0);
  });

  it('never goes below 0', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    const t = 900000;
    limiter.isAllowed('u', t);
    limiter.isAllowed('u', t + 1);
    limiter.isAllowed('u', t + 2); // denied, but remaining stays 0
    assert.equal(limiter.remaining('u', t + 2), 0);
  });

  it('recovers as old entries leave the window', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    const t = 1000000;
    limiter.isAllowed('u', t);
    limiter.isAllowed('u', t + 100);
    assert.equal(limiter.remaining('u', t + 100), 0);
    // At t+1101 both entries expire
    assert.equal(limiter.remaining('u', t + 1101), 2);
  });
});

// ─── SlidingWindowRateLimiter — advance ──────────────────────────────────────

describe('SlidingWindowRateLimiter – advance', () => {
  it('advances the internal clock so old entries expire', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    limiter.isAllowed('u');
    limiter.isAllowed('u');
    assert.equal(limiter.remaining('u'), 0);
    limiter.advance(1001);
    assert.equal(limiter.remaining('u'), 2);
  });

  it('allows requests after clock advance', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    assert.equal(limiter.isAllowed('u'), true);
    assert.equal(limiter.isAllowed('u'), false);
    limiter.advance(1001);
    assert.equal(limiter.isAllowed('u'), true);
  });

  it('advance is cumulative across multiple calls', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    limiter.isAllowed('u');
    limiter.advance(500);
    limiter.advance(501); // total 1001ms
    assert.equal(limiter.isAllowed('u'), true);
  });

  it('advance of 0 does not change behavior', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    limiter.isAllowed('u');
    limiter.advance(0);
    assert.equal(limiter.isAllowed('u'), false);
  });
});

// ─── createSlidingWindowLimiter factory ──────────────────────────────────────

describe('createSlidingWindowLimiter – factory', () => {
  it('returns a SlidingWindowRateLimiter instance', () => {
    const limiter = createSlidingWindowLimiter(5, 1000);
    assert.ok(limiter instanceof SlidingWindowRateLimiter);
  });

  it('factory-created instance behaves correctly', () => {
    const limiter = createSlidingWindowLimiter(2, 500);
    const t = 2000000;
    assert.equal(limiter.isAllowed('u', t), true);
    assert.equal(limiter.isAllowed('u', t + 1), true);
    assert.equal(limiter.isAllowed('u', t + 2), false);
  });
});

// ─── LeakyBucket — constructor ────────────────────────────────────────────────

describe('LeakyBucket – constructor', () => {
  it('creates an instance', () => {
    const bucket = new LeakyBucket(100, 0.1);
    assert.ok(bucket instanceof LeakyBucket);
  });

  it('starts with level 0', () => {
    const bucket = new LeakyBucket(100, 0.1);
    assert.equal(bucket.level(), 0);
  });
});

// ─── LeakyBucket — add ────────────────────────────────────────────────────────

describe('LeakyBucket – add', () => {
  it('returns true when adding within capacity', () => {
    const bucket = new LeakyBucket(10, 0.1);
    assert.equal(bucket.add(5), true);
  });

  it('increases level after add', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add(4);
    assert.equal(bucket.level(), 4);
  });

  it('returns false when add would exceed capacity', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add(8);
    assert.equal(bucket.add(3), false);
  });

  it('does not change level on overflow', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add(9);
    bucket.add(2); // would overflow → rejected
    assert.equal(bucket.level(), 9);
  });

  it('allows adding exactly to capacity', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add(7);
    assert.equal(bucket.add(3), true);
    assert.equal(bucket.level(), 10);
  });

  it('returns false when adding 1 to a full bucket', () => {
    const bucket = new LeakyBucket(5, 0.1);
    bucket.add(5);
    assert.equal(bucket.add(1), false);
    assert.equal(bucket.add(), false);
  });

  it('default amount is 1', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add();
    assert.equal(bucket.level(), 1);
  });

  it('accepts fractional amounts', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add(0.5);
    assert.ok(Math.abs(bucket.level() - 0.5) < 0.001);
  });
});

// ─── LeakyBucket — level ─────────────────────────────────────────────────────

describe('LeakyBucket – level', () => {
  it('reflects current fill after several adds', () => {
    const bucket = new LeakyBucket(20, 0.001);
    bucket.add(5);
    bucket.add(3);
    assert.equal(bucket.level(), 8);
  });

  it('accounts for leak when reading level', () => {
    const bucket = new LeakyBucket(100, 0.1); // leaks 0.1/ms = 100ms drains 10
    bucket.add(50);
    bucket.advance(100); // drains 10
    const lvl = bucket.level();
    assert.ok(lvl >= 39.9 && lvl <= 40.1, `expected ~40, got ${lvl}`);
  });

  it('never reports below 0', () => {
    const bucket = new LeakyBucket(10, 1); // leaks 1/ms
    bucket.add(5);
    bucket.advance(10000); // drains far more than 5
    assert.equal(bucket.level(), 0);
  });
});

// ─── LeakyBucket — advance ────────────────────────────────────────────────────

describe('LeakyBucket – advance', () => {
  it('leaks tokens over advanced time', () => {
    const bucket = new LeakyBucket(100, 0.01); // 0.01/ms
    bucket.add(10);
    bucket.advance(500); // drains 5
    const lvl = bucket.level();
    assert.ok(lvl >= 4.9 && lvl <= 5.1, `expected ~5, got ${lvl}`);
  });

  it('advance makes room for more adds', () => {
    const bucket = new LeakyBucket(10, 0.01); // 0.01/ms
    bucket.add(10); // full
    assert.equal(bucket.add(1), false);
    bucket.advance(200); // drains 2
    assert.equal(bucket.add(1), true);
  });

  it('cumulative advances drain correctly', () => {
    const bucket = new LeakyBucket(100, 0.1); // 0.1/ms
    bucket.add(100);
    bucket.advance(500); // drains 50
    bucket.advance(500); // drains another 50
    assert.equal(bucket.level(), 0);
  });

  it('advance of 0 does not change level', () => {
    const bucket = new LeakyBucket(10, 0.1);
    bucket.add(5);
    bucket.advance(0);
    assert.equal(bucket.level(), 5);
  });
});

// ─── createLeakyBucket factory ────────────────────────────────────────────────

describe('createLeakyBucket – factory', () => {
  it('returns a LeakyBucket instance', () => {
    const bucket = createLeakyBucket(50, 0.05);
    assert.ok(bucket instanceof LeakyBucket);
  });

  it('factory-created bucket starts at level 0', () => {
    const bucket = createLeakyBucket(50, 0.05);
    assert.equal(bucket.level(), 0);
  });

  it('factory-created bucket enforces capacity', () => {
    const bucket = createLeakyBucket(5, 0.001);
    bucket.add(5);
    assert.equal(bucket.add(1), false);
  });
});
