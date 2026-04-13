// ─── Unit Tests: Rate Limiter ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TokenBucket,
  SlidingWindowCounter,
  FixedWindowCounter,
  LeakyBucket,
  createTokenBucket,
  createSlidingWindow,
  createFixedWindow,
} from '../../app/modules/rate-limiter.js';

// ─── TokenBucket — constructor ────────────────────────────────────────────────

describe('TokenBucket – constructor', () => {
  it('creates an instance with valid options', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    assert.ok(bucket instanceof TokenBucket);
  });

  it('starts full (tokens === capacity)', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    assert.equal(bucket.getTokens(), 5);
  });

  it('exposes capacity via getter', () => {
    const bucket = new TokenBucket({ capacity: 20, refillRate: 2 });
    assert.equal(bucket.capacity, 20);
  });

  it('accepts a custom refillInterval', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 5, refillInterval: 500 });
    assert.equal(bucket.capacity, 10);
    assert.equal(bucket.getTokens(), 10);
  });

  it('throws on zero capacity', () => {
    assert.throws(() => new TokenBucket({ capacity: 0, refillRate: 1 }), RangeError);
  });

  it('throws on negative refillRate', () => {
    assert.throws(() => new TokenBucket({ capacity: 10, refillRate: -1 }), RangeError);
  });

  it('throws on zero refillInterval', () => {
    assert.throws(() => new TokenBucket({ capacity: 10, refillRate: 1, refillInterval: 0 }), RangeError);
  });
});

// ─── TokenBucket — consume ────────────────────────────────────────────────────

describe('TokenBucket – consume', () => {
  it('returns true when there are enough tokens', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    assert.equal(bucket.consume(3), true);
  });

  it('reduces token count after consume', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    bucket.consume(4);
    assert.equal(bucket.getTokens(), 6);
  });

  it('returns false when not enough tokens', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    bucket.consume(5); // empty it
    assert.equal(bucket.consume(1), false);
  });

  it('does not change tokens when consume fails', () => {
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1 });
    bucket.consume(3); // empty it
    bucket.consume(1); // should fail
    assert.equal(bucket.getTokens(), 0);
  });

  it('defaults to consuming 1 token', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    bucket.consume();
    assert.equal(bucket.getTokens(), 4);
  });

  it('can consume multiple tokens at once', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    assert.equal(bucket.consume(10), true);
    assert.equal(bucket.getTokens(), 0);
  });

  it('returns false when requesting more than capacity', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    assert.equal(bucket.consume(6), false);
  });
});

// ─── TokenBucket — tryConsume ─────────────────────────────────────────────────

describe('TokenBucket – tryConsume', () => {
  it('is an alias for consume (returns true)', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    assert.equal(bucket.tryConsume(2), true);
  });

  it('is an alias for consume (returns false)', () => {
    const bucket = new TokenBucket({ capacity: 2, refillRate: 1 });
    bucket.consume(2);
    assert.equal(bucket.tryConsume(1), false);
  });
});

// ─── TokenBucket — getTokens ──────────────────────────────────────────────────

describe('TokenBucket – getTokens', () => {
  it('returns full capacity initially', () => {
    const bucket = new TokenBucket({ capacity: 7, refillRate: 1 });
    assert.equal(bucket.getTokens(), 7);
  });

  it('reflects remaining tokens after consume', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    bucket.consume(3);
    assert.equal(bucket.getTokens(), 7);
  });
});

// ─── TokenBucket — reset ──────────────────────────────────────────────────────

describe('TokenBucket – reset', () => {
  it('refills to capacity after partial consume', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1 });
    bucket.consume(7);
    bucket.reset();
    assert.equal(bucket.getTokens(), 10);
  });

  it('refills to capacity after total consume', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1 });
    bucket.consume(5);
    assert.equal(bucket.getTokens(), 0);
    bucket.reset();
    assert.equal(bucket.getTokens(), 5);
  });
});

// ─── TokenBucket — refill (time-based) ───────────────────────────────────────

describe('TokenBucket – refill', () => {
  it('refills tokens after advancing internal clock past one interval', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 5, refillInterval: 1000 });
    bucket.consume(10); // empty it
    assert.equal(bucket.getTokens(), 0);
    // Simulate 1000ms passing
    bucket._advanceTime(1000);
    assert.equal(bucket.getTokens(), 5);
  });

  it('refills across multiple intervals', () => {
    const bucket = new TokenBucket({ capacity: 20, refillRate: 3, refillInterval: 1000 });
    bucket.consume(20); // empty it
    bucket._advanceTime(3000); // 3 intervals = 9 tokens
    assert.equal(bucket.getTokens(), 9);
  });

  it('does not exceed capacity on refill', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRate: 10, refillInterval: 1000 });
    // starts full, advance time – should stay capped at capacity
    bucket._advanceTime(2000);
    assert.equal(bucket.getTokens(), 5);
  });

  it('partial interval does not yet refill', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 5, refillInterval: 1000 });
    bucket.consume(10);
    bucket._advanceTime(999); // just under one interval
    assert.equal(bucket.getTokens(), 0);
  });

  it('refills with very small interval via actual time passage', async () => {
    const bucket = new TokenBucket({ capacity: 10, refillRate: 5, refillInterval: 20 });
    bucket.consume(10);
    await new Promise(res => setTimeout(res, 50));
    assert.ok(bucket.getTokens() >= 5, 'should have refilled at least 5 tokens');
  });
});

// ─── SlidingWindowCounter — basic hit tracking ────────────────────────────────

describe('SlidingWindowCounter – basic hit tracking', () => {
  it('creates an instance', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 1000 });
    assert.ok(counter instanceof SlidingWindowCounter);
  });

  it('exposes limit getter', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 1000 });
    assert.equal(counter.limit, 5);
  });

  it('exposes windowMs getter', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 2000 });
    assert.equal(counter.windowMs, 2000);
  });

  it('allows hits within limit', () => {
    const counter = new SlidingWindowCounter({ limit: 3, windowMs: 10000 });
    assert.equal(counter.hit('a'), true);
    assert.equal(counter.hit('a'), true);
    assert.equal(counter.hit('a'), true);
  });

  it('blocks hit when limit exceeded', () => {
    const counter = new SlidingWindowCounter({ limit: 2, windowMs: 10000 });
    counter.hit('a');
    counter.hit('a');
    assert.equal(counter.hit('a'), false);
  });

  it('uses default key when no key provided', () => {
    const counter = new SlidingWindowCounter({ limit: 2, windowMs: 10000 });
    assert.equal(counter.hit(), true);
    assert.equal(counter.hit(), true);
    assert.equal(counter.hit(), false);
  });

  it('throws on zero limit', () => {
    assert.throws(() => new SlidingWindowCounter({ limit: 0, windowMs: 1000 }), RangeError);
  });

  it('throws on zero windowMs', () => {
    assert.throws(() => new SlidingWindowCounter({ limit: 5, windowMs: 0 }), RangeError);
  });
});

// ─── SlidingWindowCounter — getCount ─────────────────────────────────────────

describe('SlidingWindowCounter – getCount', () => {
  it('returns 0 for a new key', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 1000 });
    assert.equal(counter.getCount('x'), 0);
  });

  it('returns correct count after hits', () => {
    const counter = new SlidingWindowCounter({ limit: 10, windowMs: 10000 });
    counter.hit('k');
    counter.hit('k');
    counter.hit('k');
    assert.equal(counter.getCount('k'), 3);
  });

  it('count does not exceed limit', () => {
    const counter = new SlidingWindowCounter({ limit: 2, windowMs: 10000 });
    counter.hit('k');
    counter.hit('k');
    counter.hit('k'); // denied
    assert.equal(counter.getCount('k'), 2);
  });
});

// ─── SlidingWindowCounter — multiple keys ─────────────────────────────────────

describe('SlidingWindowCounter – multiple keys', () => {
  it('tracks keys independently', () => {
    const counter = new SlidingWindowCounter({ limit: 2, windowMs: 10000 });
    counter.hit('alice');
    counter.hit('alice');
    assert.equal(counter.hit('alice'), false); // alice at limit
    assert.equal(counter.hit('bob'), true);    // bob not affected
  });

  it('count for one key does not affect another', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 10000 });
    counter.hit('alice');
    counter.hit('alice');
    assert.equal(counter.getCount('alice'), 2);
    assert.equal(counter.getCount('bob'), 0);
  });
});

// ─── SlidingWindowCounter — reset ─────────────────────────────────────────────

describe('SlidingWindowCounter – reset', () => {
  it('clears count for a key', () => {
    const counter = new SlidingWindowCounter({ limit: 3, windowMs: 10000 });
    counter.hit('u');
    counter.hit('u');
    counter.reset('u');
    assert.equal(counter.getCount('u'), 0);
  });

  it('allows hits again after reset', () => {
    const counter = new SlidingWindowCounter({ limit: 2, windowMs: 10000 });
    counter.hit('u');
    counter.hit('u');
    assert.equal(counter.hit('u'), false);
    counter.reset('u');
    assert.equal(counter.hit('u'), true);
  });

  it('reset only affects specified key', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 10000 });
    counter.hit('a');
    counter.hit('b');
    counter.reset('a');
    assert.equal(counter.getCount('a'), 0);
    assert.equal(counter.getCount('b'), 1);
  });

  it('resets default key when no key given', () => {
    const counter = new SlidingWindowCounter({ limit: 5, windowMs: 10000 });
    counter.hit();
    counter.hit();
    counter.reset();
    assert.equal(counter.getCount(), 0);
  });
});

// ─── SlidingWindowCounter — window expiry ─────────────────────────────────────

describe('SlidingWindowCounter – window expiry', () => {
  it('allows hits after window expires (actual time)', async () => {
    const counter = new SlidingWindowCounter({ limit: 2, windowMs: 30 });
    counter.hit('u');
    counter.hit('u');
    assert.equal(counter.hit('u'), false);
    await new Promise(res => setTimeout(res, 50));
    assert.equal(counter.hit('u'), true);
  });

  it('getCount drops old entries after window expires', async () => {
    const counter = new SlidingWindowCounter({ limit: 10, windowMs: 30 });
    counter.hit('u');
    counter.hit('u');
    await new Promise(res => setTimeout(res, 50));
    assert.equal(counter.getCount('u'), 0);
  });
});

// ─── FixedWindowCounter — basic hit tracking ─────────────────────────────────

describe('FixedWindowCounter – basic hit tracking', () => {
  it('creates an instance', () => {
    const counter = new FixedWindowCounter({ limit: 10, windowMs: 1000 });
    assert.ok(counter instanceof FixedWindowCounter);
  });

  it('allows hits within limit', () => {
    const counter = new FixedWindowCounter({ limit: 3, windowMs: 10000 });
    assert.equal(counter.hit('a'), true);
    assert.equal(counter.hit('a'), true);
    assert.equal(counter.hit('a'), true);
  });

  it('blocks hit when limit is exceeded', () => {
    const counter = new FixedWindowCounter({ limit: 2, windowMs: 10000 });
    counter.hit('a');
    counter.hit('a');
    assert.equal(counter.hit('a'), false);
  });

  it('uses default key when no key provided', () => {
    const counter = new FixedWindowCounter({ limit: 2, windowMs: 10000 });
    assert.equal(counter.hit(), true);
    assert.equal(counter.hit(), true);
    assert.equal(counter.hit(), false);
  });

  it('exposes limit getter', () => {
    const counter = new FixedWindowCounter({ limit: 7, windowMs: 1000 });
    assert.equal(counter.limit, 7);
  });

  it('exposes windowMs getter', () => {
    const counter = new FixedWindowCounter({ limit: 5, windowMs: 5000 });
    assert.equal(counter.windowMs, 5000);
  });

  it('throws on zero limit', () => {
    assert.throws(() => new FixedWindowCounter({ limit: 0, windowMs: 1000 }), RangeError);
  });

  it('throws on zero windowMs', () => {
    assert.throws(() => new FixedWindowCounter({ limit: 5, windowMs: 0 }), RangeError);
  });
});

// ─── FixedWindowCounter — getCount ────────────────────────────────────────────

describe('FixedWindowCounter – getCount', () => {
  it('returns 0 initially', () => {
    const counter = new FixedWindowCounter({ limit: 5, windowMs: 1000 });
    assert.equal(counter.getCount('x'), 0);
  });

  it('increments with each hit', () => {
    const counter = new FixedWindowCounter({ limit: 10, windowMs: 10000 });
    counter.hit('k');
    counter.hit('k');
    assert.equal(counter.getCount('k'), 2);
  });

  it('caps count at limit (blocked hits not counted)', () => {
    const counter = new FixedWindowCounter({ limit: 2, windowMs: 10000 });
    counter.hit('k');
    counter.hit('k');
    counter.hit('k'); // denied
    assert.equal(counter.getCount('k'), 2);
  });
});

// ─── FixedWindowCounter — reset ───────────────────────────────────────────────

describe('FixedWindowCounter – reset', () => {
  it('clears the counter for a key', () => {
    const counter = new FixedWindowCounter({ limit: 10, windowMs: 10000 });
    counter.hit('u');
    counter.hit('u');
    counter.reset('u');
    assert.equal(counter.getCount('u'), 0);
  });

  it('allows hits again after reset', () => {
    const counter = new FixedWindowCounter({ limit: 1, windowMs: 10000 });
    counter.hit('u');
    assert.equal(counter.hit('u'), false);
    counter.reset('u');
    assert.equal(counter.hit('u'), true);
  });

  it('resets default key when no key given', () => {
    const counter = new FixedWindowCounter({ limit: 5, windowMs: 10000 });
    counter.hit();
    counter.hit();
    counter.reset();
    assert.equal(counter.getCount(), 0);
  });

  it('reset only affects the specified key', () => {
    const counter = new FixedWindowCounter({ limit: 5, windowMs: 10000 });
    counter.hit('a');
    counter.hit('b');
    counter.reset('a');
    assert.equal(counter.getCount('a'), 0);
    assert.equal(counter.getCount('b'), 1);
  });

  it('window auto-resets after windowMs expires', async () => {
    const counter = new FixedWindowCounter({ limit: 2, windowMs: 30 });
    counter.hit('u');
    counter.hit('u');
    assert.equal(counter.hit('u'), false);
    await new Promise(res => setTimeout(res, 50));
    assert.equal(counter.hit('u'), true);
  });
});

// ─── LeakyBucket — constructor ────────────────────────────────────────────────

describe('LeakyBucket – constructor', () => {
  it('creates an instance', () => {
    const bucket = new LeakyBucket({ capacity: 10, leakRate: 1 });
    assert.ok(bucket instanceof LeakyBucket);
  });

  it('starts empty (size === 0)', () => {
    const bucket = new LeakyBucket({ capacity: 10, leakRate: 1 });
    assert.equal(bucket.size, 0);
  });

  it('exposes capacity getter', () => {
    const bucket = new LeakyBucket({ capacity: 20, leakRate: 2 });
    assert.equal(bucket.capacity, 20);
  });

  it('exposes leakRate getter', () => {
    const bucket = new LeakyBucket({ capacity: 10, leakRate: 5 });
    assert.equal(bucket.leakRate, 5);
  });

  it('throws on zero capacity', () => {
    assert.throws(() => new LeakyBucket({ capacity: 0, leakRate: 1 }), RangeError);
  });

  it('throws on zero leakRate', () => {
    assert.throws(() => new LeakyBucket({ capacity: 10, leakRate: 0 }), RangeError);
  });
});

// ─── LeakyBucket — push until full ────────────────────────────────────────────

describe('LeakyBucket – push until full', () => {
  it('returns true while bucket has space', () => {
    const bucket = new LeakyBucket({ capacity: 5, leakRate: 1 });
    assert.equal(bucket.push(), true);
    assert.equal(bucket.push(), true);
    assert.equal(bucket.push(), true);
  });

  it('returns false when bucket is full', () => {
    const bucket = new LeakyBucket({ capacity: 3, leakRate: 1 });
    bucket.push();
    bucket.push();
    bucket.push();
    assert.equal(bucket.push(), false);
  });

  it('filling exactly to capacity returns true', () => {
    const bucket = new LeakyBucket({ capacity: 2, leakRate: 1 });
    assert.equal(bucket.push(), true);
    assert.equal(bucket.push(), true);
  });

  it('size is 0 after leak fully drains bucket', () => {
    const bucket = new LeakyBucket({ capacity: 5, leakRate: 100 }); // fast leak
    bucket.push();
    bucket._advanceTime(100); // 100ms * 100/s = 10 tokens drained
    assert.equal(bucket.size, 0);
  });

  it('accepts more requests after partial drain', () => {
    const bucket = new LeakyBucket({ capacity: 2, leakRate: 100 }); // leaks 100/s
    bucket.push();
    bucket.push(); // full
    assert.equal(bucket.push(), false);
    bucket._advanceTime(1000); // 1s * 100/s = 100 tokens leaked, bucket empty
    assert.equal(bucket.push(), true);
  });
});

// ─── LeakyBucket — size tracking ──────────────────────────────────────────────

describe('LeakyBucket – size tracking', () => {
  it('tracks size after pushes', () => {
    const bucket = new LeakyBucket({ capacity: 10, leakRate: 0.001 }); // very slow leak
    bucket.push();
    bucket.push();
    bucket.push();
    // Size should be approximately 3 (tiny leak over ns)
    assert.ok(bucket.size >= 2 && bucket.size <= 3);
  });

  it('size decreases after time passes', () => {
    const bucket = new LeakyBucket({ capacity: 10, leakRate: 2 }); // 2 per second
    bucket.push();
    bucket.push();
    bucket.push(); // size = 3
    bucket._advanceTime(1000); // 1s * 2/s = 2 leaked
    const sz = bucket.size;
    assert.ok(sz >= 0.9 && sz <= 1.1, `expected ~1, got ${sz}`);
  });

  it('size never goes below 0', () => {
    const bucket = new LeakyBucket({ capacity: 10, leakRate: 100 });
    bucket.push();
    bucket._advanceTime(10000); // way more than needed
    assert.equal(bucket.size, 0);
  });
});

// ─── LeakyBucket — reset ──────────────────────────────────────────────────────

describe('LeakyBucket – reset', () => {
  it('empties the bucket', () => {
    const bucket = new LeakyBucket({ capacity: 5, leakRate: 1 });
    bucket.push();
    bucket.push();
    bucket.reset();
    assert.equal(bucket.size, 0);
  });

  it('allows pushes again after reset', () => {
    const bucket = new LeakyBucket({ capacity: 2, leakRate: 1 });
    bucket.push();
    bucket.push();
    assert.equal(bucket.push(), false);
    bucket.reset();
    assert.equal(bucket.push(), true);
  });
});

// ─── Factory functions ────────────────────────────────────────────────────────

describe('createTokenBucket – factory', () => {
  it('returns a TokenBucket instance', () => {
    const bucket = createTokenBucket(10, 2);
    assert.ok(bucket instanceof TokenBucket);
  });

  it('has correct capacity', () => {
    const bucket = createTokenBucket(15, 3);
    assert.equal(bucket.capacity, 15);
  });

  it('starts full', () => {
    const bucket = createTokenBucket(8, 1);
    assert.equal(bucket.getTokens(), 8);
  });

  it('allows consume after creation', () => {
    const bucket = createTokenBucket(5, 1);
    assert.equal(bucket.consume(3), true);
    assert.equal(bucket.getTokens(), 2);
  });
});

describe('createSlidingWindow – factory', () => {
  it('returns a SlidingWindowCounter instance', () => {
    const counter = createSlidingWindow(5, 1000);
    assert.ok(counter instanceof SlidingWindowCounter);
  });

  it('has correct limit', () => {
    const counter = createSlidingWindow(7, 2000);
    assert.equal(counter.limit, 7);
  });

  it('has correct windowMs', () => {
    const counter = createSlidingWindow(3, 5000);
    assert.equal(counter.windowMs, 5000);
  });

  it('enforces limit correctly', () => {
    const counter = createSlidingWindow(2, 10000);
    assert.equal(counter.hit('u'), true);
    assert.equal(counter.hit('u'), true);
    assert.equal(counter.hit('u'), false);
  });
});

describe('createFixedWindow – factory', () => {
  it('returns a FixedWindowCounter instance', () => {
    const counter = createFixedWindow(10, 1000);
    assert.ok(counter instanceof FixedWindowCounter);
  });

  it('has correct limit', () => {
    const counter = createFixedWindow(6, 500);
    assert.equal(counter.limit, 6);
  });

  it('has correct windowMs', () => {
    const counter = createFixedWindow(4, 3000);
    assert.equal(counter.windowMs, 3000);
  });

  it('enforces limit correctly', () => {
    const counter = createFixedWindow(1, 10000);
    assert.equal(counter.hit('u'), true);
    assert.equal(counter.hit('u'), false);
  });
});
