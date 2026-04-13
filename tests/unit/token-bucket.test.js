// ─── Unit Tests: TokenBucket ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TokenBucket, rateLimited } from '../../app/modules/token-bucket.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a fake clock that starts at `start` ms and can be advanced. */
function makeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance: (ms) => { time += ms; },
    set: (ms) => { time = ms; },
  };
}

// ─── Constructor / initialTokens ─────────────────────────────────────────────

describe('TokenBucket – constructor', () => {
  it('starts full by default', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1, now: clock.now });
    assert.equal(bucket.tokens, 10);
  });

  it('respects initialTokens', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1, initialTokens: 4, now: clock.now });
    assert.equal(bucket.tokens, 4);
  });

  it('clamps initialTokens to capacity', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 99, now: clock.now });
    assert.equal(bucket.tokens, 5);
  });

  it('clamps initialTokens to 0 when negative', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: -1, now: clock.now });
    assert.equal(bucket.tokens, 0);
  });

  it('throws on capacity <= 0', () => {
    assert.throws(() => new TokenBucket({ capacity: 0, refillRate: 1 }), RangeError);
    assert.throws(() => new TokenBucket({ capacity: -5, refillRate: 1 }), RangeError);
  });

  it('throws on refillRate <= 0', () => {
    assert.throws(() => new TokenBucket({ capacity: 10, refillRate: 0 }), RangeError);
    assert.throws(() => new TokenBucket({ capacity: 10, refillRate: -1 }), RangeError);
  });
});

// ─── consume ─────────────────────────────────────────────────────────────────

describe('TokenBucket – consume', () => {
  it('consume(1) succeeds when tokens available', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    assert.equal(bucket.consume(1), true);
    assert.equal(bucket.tokens, 4);
  });

  it('consume(n) succeeds when exactly n tokens available', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1, initialTokens: 3, now: clock.now });
    assert.equal(bucket.consume(3), true);
    assert.equal(bucket.tokens, 0);
  });

  it('consume fails when insufficient tokens', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 2, now: clock.now });
    assert.equal(bucket.consume(3), false);
    // tokens should not change on failure
    assert.equal(bucket.tokens, 2);
  });

  it('consume defaults to 1 token', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    bucket.consume();
    assert.equal(bucket.tokens, 4);
  });

  it('consume(0) always succeeds and does not change tokens', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 0, now: clock.now });
    assert.equal(bucket.consume(0), true);
    assert.equal(bucket.tokens, 0);
  });

  it('throws on negative tokens argument', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    assert.throws(() => bucket.consume(-1), RangeError);
  });

  it('multiple consumes drain the bucket', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1, initialTokens: 3, now: clock.now });
    assert.equal(bucket.consume(1), true);
    assert.equal(bucket.consume(1), true);
    assert.equal(bucket.consume(1), true);
    assert.equal(bucket.consume(1), false); // empty
  });
});

// ─── consumeOrThrow ───────────────────────────────────────────────────────────

describe('TokenBucket – consumeOrThrow', () => {
  it('does not throw when tokens available', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    assert.doesNotThrow(() => bucket.consumeOrThrow(3));
    assert.equal(bucket.tokens, 2);
  });

  it('throws when tokens insufficient', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 1, now: clock.now });
    assert.throws(() => bucket.consumeOrThrow(3), Error);
  });

  it('defaults to 1 token', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 1, refillRate: 1, initialTokens: 1, now: clock.now });
    assert.doesNotThrow(() => bucket.consumeOrThrow());
    assert.throws(() => bucket.consumeOrThrow(), Error); // now empty
  });
});

// ─── tokens (refill) ─────────────────────────────────────────────────────────

describe('TokenBucket – tokens refill over time', () => {
  it('tokens increase as time passes', () => {
    const clock = makeClock(0);
    // 2 tokens/sec, starts at 0
    const bucket = new TokenBucket({ capacity: 10, refillRate: 2, initialTokens: 0, now: clock.now });
    assert.equal(bucket.tokens, 0);

    clock.advance(1000); // 1 second → +2 tokens
    assert.equal(bucket.tokens, 2);

    clock.advance(1000); // another second → +2 tokens
    assert.equal(bucket.tokens, 4);
  });

  it('tokens are capped at capacity', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 10, initialTokens: 0, now: clock.now });
    clock.advance(5000); // would add 50 tokens, capped at 5
    assert.equal(bucket.tokens, 5);
  });

  it('partial refill (sub-second elapsed)', () => {
    const clock = makeClock(0);
    // 1000 tokens/sec → after 1 ms, +1 token
    const bucket = new TokenBucket({ capacity: 100, refillRate: 1000, initialTokens: 0, now: clock.now });
    clock.advance(1); // 1 ms → +1 token
    assert.equal(bucket.tokens, 1);
  });
});

// ─── waitTime ─────────────────────────────────────────────────────────────────

describe('TokenBucket – waitTime', () => {
  it('returns 0 when enough tokens available', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    assert.equal(bucket.waitTime(5), 0);
  });

  it('returns > 0 when not enough tokens', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 0, now: clock.now });
    // need 1 token at 1 token/sec → 1000 ms
    assert.equal(bucket.waitTime(1), 1000);
  });

  it('calculates wait time correctly for fractional tokens needed', () => {
    const clock = makeClock(0);
    // 10 tokens/sec, 0 tokens, need 5 → 500 ms
    const bucket = new TokenBucket({ capacity: 10, refillRate: 10, initialTokens: 0, now: clock.now });
    assert.equal(bucket.waitTime(5), 500);
  });

  it('defaults to 1 token', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 0, now: clock.now });
    assert.equal(bucket.waitTime(), 1000);
  });

  it('accounts for existing partial tokens', () => {
    const clock = makeClock(0);
    // 2 tokens/sec, currently 1 token, need 3 → need 2 more → 1000 ms
    const bucket = new TokenBucket({ capacity: 10, refillRate: 2, initialTokens: 1, now: clock.now });
    assert.equal(bucket.waitTime(3), 1000);
  });
});

// ─── add ─────────────────────────────────────────────────────────────────────

describe('TokenBucket – add', () => {
  it('adds tokens up to capacity', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1, initialTokens: 0, now: clock.now });
    bucket.add(5);
    assert.equal(bucket.tokens, 5);
  });

  it('add is capped at capacity', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 3, now: clock.now });
    bucket.add(100);
    assert.equal(bucket.tokens, 5);
  });

  it('throws on negative add amount', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    assert.throws(() => bucket.add(-1), RangeError);
  });

  it('add(0) is a no-op', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 3, now: clock.now });
    bucket.add(0);
    assert.equal(bucket.tokens, 3);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('TokenBucket – reset', () => {
  it('resets bucket to full capacity', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 10, refillRate: 1, initialTokens: 2, now: clock.now });
    bucket.reset();
    assert.equal(bucket.tokens, 10);
  });

  it('reset after partial consume restores full capacity', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    bucket.consume(3);
    assert.equal(bucket.tokens, 2);
    bucket.reset();
    assert.equal(bucket.tokens, 5);
  });
});

// ─── canConsume ───────────────────────────────────────────────────────────────

describe('TokenBucket – canConsume', () => {
  it('returns true when enough tokens', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    assert.equal(bucket.canConsume(5), true);
  });

  it('returns false when not enough tokens', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 2, now: clock.now });
    assert.equal(bucket.canConsume(3), false);
  });

  it('does not consume tokens', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, now: clock.now });
    bucket.canConsume(3);
    assert.equal(bucket.tokens, 5); // unchanged
  });

  it('defaults to 1 token', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 1, refillRate: 1, initialTokens: 0, now: clock.now });
    assert.equal(bucket.canConsume(), false);
    bucket.add(1);
    assert.equal(bucket.canConsume(), true);
  });

  it('accounts for refill before checking', () => {
    const clock = makeClock(0);
    const bucket = new TokenBucket({ capacity: 5, refillRate: 1, initialTokens: 0, now: clock.now });
    assert.equal(bucket.canConsume(1), false);
    clock.advance(2000); // +2 tokens
    assert.equal(bucket.canConsume(1), true);
  });
});

// ─── rateLimited ─────────────────────────────────────────────────────────────

describe('rateLimited wrapper', () => {
  it('calls function when tokens available', () => {
    const clock = makeClock(0);
    let calls = 0;
    const fn = () => { calls++; return 42; };
    const limited = rateLimited(fn, { capacity: 3, refillRate: 1, now: clock.now });

    const result = limited();
    assert.equal(result, 42);
    assert.equal(calls, 1);
  });

  it('returns undefined when rate limit exceeded', () => {
    const clock = makeClock(0);
    let calls = 0;
    const fn = () => { calls++; return 'ok'; };
    const limited = rateLimited(fn, { capacity: 2, refillRate: 1, initialTokens: 2, now: clock.now });

    assert.equal(limited(), 'ok');
    assert.equal(limited(), 'ok');
    assert.equal(limited(), undefined); // exhausted
    assert.equal(calls, 2);
  });

  it('resumes calling after tokens refill', () => {
    const clock = makeClock(0);
    let calls = 0;
    const fn = () => { calls++; };
    const limited = rateLimited(fn, { capacity: 1, refillRate: 1, initialTokens: 1, now: clock.now });

    limited(); // consume the 1 token
    assert.equal(limited(), undefined); // empty
    clock.advance(1000); // refill 1 token
    limited(); // should work again
    assert.equal(calls, 2);
  });

  it('passes arguments through to the wrapped function', () => {
    const clock = makeClock(0);
    const received = [];
    const fn = (a, b) => { received.push(a, b); return a + b; };
    const limited = rateLimited(fn, { capacity: 5, refillRate: 1, now: clock.now });

    const result = limited(3, 4);
    assert.equal(result, 7);
    assert.deepEqual(received, [3, 4]);
  });

  it('each rateLimited wrapper has its own bucket', () => {
    const clock = makeClock(0);
    let callsA = 0;
    let callsB = 0;
    const fnA = () => { callsA++; };
    const fnB = () => { callsB++; };
    const limitedA = rateLimited(fnA, { capacity: 1, refillRate: 1, initialTokens: 1, now: clock.now });
    const limitedB = rateLimited(fnB, { capacity: 1, refillRate: 1, initialTokens: 1, now: clock.now });

    limitedA();
    limitedA(); // should be blocked
    limitedB(); // separate bucket, should work
    assert.equal(callsA, 1);
    assert.equal(callsB, 1);
  });
});
