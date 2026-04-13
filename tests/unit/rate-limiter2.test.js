// ─── Unit Tests: rate-limiter2 ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RateLimiter,
  SlidingWindowRateLimiter,
  createRateLimiter,
  createSlidingWindowRateLimiter,
} from '../../app/modules/rate-limiter2.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a controllable clock starting at `start` ms. */
function makeClock(start = 0) {
  let now = start;
  const clock = () => now;
  clock.advance = (ms) => { now += ms; };
  clock.set = (ms) => { now = ms; };
  return clock;
}

// ─── RateLimiter (fixed-window) ───────────────────────────────────────────────

describe('RateLimiter – constructor', () => {
  it('throws RangeError for non-positive limit', () => {
    assert.throws(() => new RateLimiter({ limit: 0, windowMs: 1000 }), RangeError);
    assert.throws(() => new RateLimiter({ limit: -1, windowMs: 1000 }), RangeError);
  });

  it('throws RangeError for non-positive windowMs', () => {
    assert.throws(() => new RateLimiter({ limit: 5, windowMs: 0 }), RangeError);
    assert.throws(() => new RateLimiter({ limit: 5, windowMs: -100 }), RangeError);
  });

  it('accepts valid options', () => {
    assert.doesNotThrow(() => new RateLimiter({ limit: 1, windowMs: 1 }));
  });
});

describe('RateLimiter – consume', () => {
  it('allows requests up to the limit', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 3, windowMs: 60000, clock });
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), true);
  });

  it('blocks after limit is exhausted', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume();
    rl.consume();
    assert.equal(rl.consume(), false);
  });

  it('consumes multiple tokens at once', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 5, windowMs: 60000, clock });
    assert.equal(rl.consume('key', 3), true);
    assert.equal(rl.getRemainingTokens('key'), 2);
  });

  it('rejects if not enough tokens for multi-token consume', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 2, windowMs: 60000, clock });
    assert.equal(rl.consume('key', 3), false);
  });

  it('uses default key when none provided', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 1, windowMs: 60000, clock });
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), false);
  });

  it('tracks keys independently', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('alice');
    assert.equal(rl.consume('alice'), false);
    assert.equal(rl.consume('bob'), true);
  });
});

describe('RateLimiter – getRemainingTokens', () => {
  it('starts at limit', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 5, windowMs: 60000, clock });
    assert.equal(rl.getRemainingTokens(), 5);
  });

  it('decrements as tokens are consumed', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 5, windowMs: 60000, clock });
    rl.consume();
    assert.equal(rl.getRemainingTokens(), 4);
    rl.consume();
    assert.equal(rl.getRemainingTokens(), 3);
  });

  it('returns 0 when exhausted', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume();
    rl.consume();
    assert.equal(rl.getRemainingTokens(), 0);
  });

  it('replenishes after window expires', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 3, windowMs: 1000, clock });
    rl.consume();
    rl.consume();
    rl.consume();
    assert.equal(rl.getRemainingTokens(), 0);
    clock.advance(1001);
    assert.equal(rl.getRemainingTokens(), 3);
  });
});

describe('RateLimiter – getResetTime', () => {
  it('returns windowStart + windowMs', () => {
    const clock = makeClock(5000);
    const rl = new RateLimiter({ limit: 5, windowMs: 1000, clock });
    rl.getRemainingTokens(); // trigger bucket creation at t=5000
    assert.equal(rl.getResetTime(), 6000);
  });

  it('advances after window expires', () => {
    const clock = makeClock(5000);
    const rl = new RateLimiter({ limit: 1, windowMs: 1000, clock });
    const firstReset = rl.getResetTime(); // window starts at 5000
    clock.advance(2000); // now at 7000, window expired
    rl.getRemainingTokens(); // new window starts at 7000
    const newReset = rl.getResetTime();
    assert.ok(newReset > firstReset, 'reset time should advance after window expires');
    assert.equal(newReset, 8000);
  });
});

describe('RateLimiter – reset (per-key)', () => {
  it('resets state for the specified key', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('alice');
    assert.equal(rl.getRemainingTokens('alice'), 0);
    rl.reset('alice');
    assert.equal(rl.getRemainingTokens('alice'), 2);
  });

  it('does not affect other keys', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('bob');
    rl.reset('alice');
    assert.equal(rl.getRemainingTokens('alice'), 2);
    assert.equal(rl.getRemainingTokens('bob'), 1);
  });
});

describe('RateLimiter – resetAll', () => {
  it('clears all keys', () => {
    const clock = makeClock(1000);
    const rl = new RateLimiter({ limit: 1, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('bob');
    rl.resetAll();
    assert.equal(rl.getRemainingTokens('alice'), 1);
    assert.equal(rl.getRemainingTokens('bob'), 1);
  });
});

// ─── SlidingWindowRateLimiter ─────────────────────────────────────────────────

describe('SlidingWindowRateLimiter – constructor', () => {
  it('throws RangeError for non-positive limit', () => {
    assert.throws(() => new SlidingWindowRateLimiter({ limit: 0, windowMs: 1000 }), RangeError);
  });

  it('throws RangeError for non-positive windowMs', () => {
    assert.throws(() => new SlidingWindowRateLimiter({ limit: 5, windowMs: 0 }), RangeError);
  });

  it('accepts valid options', () => {
    assert.doesNotThrow(() => new SlidingWindowRateLimiter({ limit: 1, windowMs: 1 }));
  });
});

describe('SlidingWindowRateLimiter – consume', () => {
  it('allows requests up to the limit', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 3, windowMs: 60000, clock });
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), true);
  });

  it('blocks after limit is exhausted', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume();
    rl.consume();
    assert.equal(rl.consume(), false);
  });

  it('consumes multiple tokens at once', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 5, windowMs: 60000, clock });
    assert.equal(rl.consume('key', 3), true);
    assert.equal(rl.getRemainingTokens('key'), 2);
  });

  it('rejects if not enough tokens for multi-token consume', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60000, clock });
    assert.equal(rl.consume('key', 3), false);
  });

  it('tracks keys independently', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('alice');
    assert.equal(rl.consume('alice'), false);
    assert.equal(rl.consume('bob'), true);
  });

  it('allows more requests after old ones slide out of window', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000, clock });
    // Fill window at t=1000
    rl.consume();
    rl.consume();
    rl.consume();
    assert.equal(rl.consume(), false);
    // Advance past the window — all prior requests expire
    clock.advance(1001);
    assert.equal(rl.consume(), true);
  });

  it('sliding window allows partial refill as old requests expire', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000, clock });
    // t=1000: consume 2 tokens
    rl.consume();
    rl.consume();
    // t=1500: consume 1 more (total 3, window full)
    clock.advance(500);
    rl.consume();
    assert.equal(rl.consume(), false);
    // t=2001: first 2 tokens (from t=1000) have expired; 1 (from t=1500) remains
    clock.advance(501);
    assert.equal(rl.getRemainingTokens(), 2);
    assert.equal(rl.consume(), true);
  });
});

describe('SlidingWindowRateLimiter – getRemainingTokens', () => {
  it('starts at limit', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 5, windowMs: 60000, clock });
    assert.equal(rl.getRemainingTokens(), 5);
  });

  it('decrements as tokens are consumed', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 5, windowMs: 60000, clock });
    rl.consume();
    assert.equal(rl.getRemainingTokens(), 4);
  });

  it('increases as old requests slide out', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000, clock });
    rl.consume();
    rl.consume();
    assert.equal(rl.getRemainingTokens(), 0);
    clock.advance(1001);
    assert.equal(rl.getRemainingTokens(), 2);
  });
});

describe('SlidingWindowRateLimiter – getResetTime', () => {
  it('returns now + windowMs when no requests have been made', () => {
    const clock = makeClock(5000);
    const rl = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000, clock });
    assert.equal(rl.getResetTime(), 6000);
  });

  it('returns expiry of oldest request in the window', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000, clock });
    rl.consume(); // recorded at t=1000
    clock.advance(200);
    rl.consume(); // recorded at t=1200
    // oldest is t=1000, expires at 2000
    assert.equal(rl.getResetTime(), 2000);
  });
});

describe('SlidingWindowRateLimiter – reset (per-key)', () => {
  it('resets state for the specified key', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('alice');
    assert.equal(rl.getRemainingTokens('alice'), 0);
    rl.reset('alice');
    assert.equal(rl.getRemainingTokens('alice'), 2);
  });

  it('does not affect other keys', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('bob');
    rl.reset('alice');
    assert.equal(rl.getRemainingTokens('alice'), 2);
    assert.equal(rl.getRemainingTokens('bob'), 1);
  });
});

describe('SlidingWindowRateLimiter – resetAll', () => {
  it('clears all keys', () => {
    const clock = makeClock(1000);
    const rl = new SlidingWindowRateLimiter({ limit: 1, windowMs: 60000, clock });
    rl.consume('alice');
    rl.consume('bob');
    rl.resetAll();
    assert.equal(rl.getRemainingTokens('alice'), 1);
    assert.equal(rl.getRemainingTokens('bob'), 1);
  });
});

// ─── Factories ────────────────────────────────────────────────────────────────

describe('createRateLimiter', () => {
  it('returns a RateLimiter instance', () => {
    const clock = makeClock(1000);
    const rl = createRateLimiter({ limit: 5, windowMs: 1000, clock });
    assert.ok(rl instanceof RateLimiter);
  });

  it('works correctly as a factory', () => {
    const clock = makeClock(1000);
    const rl = createRateLimiter({ limit: 2, windowMs: 60000, clock });
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), false);
  });
});

describe('createSlidingWindowRateLimiter', () => {
  it('returns a SlidingWindowRateLimiter instance', () => {
    const clock = makeClock(1000);
    const rl = createSlidingWindowRateLimiter({ limit: 5, windowMs: 1000, clock });
    assert.ok(rl instanceof SlidingWindowRateLimiter);
  });

  it('works correctly as a factory', () => {
    const clock = makeClock(1000);
    const rl = createSlidingWindowRateLimiter({ limit: 2, windowMs: 60000, clock });
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), true);
    assert.equal(rl.consume(), false);
  });
});
