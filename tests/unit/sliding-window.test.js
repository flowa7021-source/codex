// ─── Unit Tests: SlidingWindow / WindowCounter ───────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SlidingWindow, WindowCounter } from '../../app/modules/sliding-window.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a fake clock that starts at `start` ms and can be advanced. */
function makeClock(start = 1000) {
  let time = start;
  return {
    now: () => time,
    advance: (ms) => { time += ms; },
    set: (ms) => { time = ms; },
  };
}

// ─── SlidingWindow – constructor ─────────────────────────────────────────────

describe('SlidingWindow – constructor', () => {
  it('throws on windowMs <= 0', () => {
    assert.throws(() => new SlidingWindow({ windowMs: 0, maxRequests: 5 }), RangeError);
    assert.throws(() => new SlidingWindow({ windowMs: -1, maxRequests: 5 }), RangeError);
  });

  it('throws on maxRequests <= 0', () => {
    assert.throws(() => new SlidingWindow({ windowMs: 1000, maxRequests: 0 }), RangeError);
    assert.throws(() => new SlidingWindow({ windowMs: 1000, maxRequests: -1 }), RangeError);
  });

  it('starts with count 0 and remaining equal to maxRequests', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 5, now: clock.now });
    assert.equal(sw.count, 0);
    assert.equal(sw.remaining, 5);
  });
});

// ─── SlidingWindow – record (allowed / denied) ───────────────────────────────

describe('SlidingWindow – record', () => {
  it('records up to maxRequests, then denies', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 3, now: clock.now });

    assert.equal(sw.record(), true);
    assert.equal(sw.record(), true);
    assert.equal(sw.record(), true);
    assert.equal(sw.record(), false); // limit exceeded
  });

  it('returns false without recording when at limit', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 1, now: clock.now });
    sw.record();
    assert.equal(sw.count, 1);
    const result = sw.record();
    assert.equal(result, false);
    assert.equal(sw.count, 1); // still 1, not recorded
  });

  it('allows new requests after old ones slide out of the window', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 2, now: clock.now });

    // Record 2 requests at t=0
    assert.equal(sw.record(), true);  // ts=0
    assert.equal(sw.record(), true);  // ts=0
    assert.equal(sw.record(), false); // denied

    // Advance past the window boundary (> 1000ms after the oldest request at ts=0)
    clock.advance(1001);

    // Both old requests are now outside the window
    assert.equal(sw.record(), true);
    assert.equal(sw.record(), true);
    assert.equal(sw.record(), false); // new limit hit
  });

  it('partial slide: only expired requests leave the window', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 3, now: clock.now });

    sw.record(); // t=0
    clock.advance(500);
    sw.record(); // t=500
    sw.record(); // t=500

    // At t=1001, the request at t=0 falls out; t=500 requests remain
    clock.advance(501); // now t=1001
    assert.equal(sw.count, 2); // t=500 and t=500 are still in window
    assert.equal(sw.record(), true); // room for 1 more
    assert.equal(sw.record(), false); // now at 3 again
  });
});

// ─── SlidingWindow – count / remaining ───────────────────────────────────────

describe('SlidingWindow – count and remaining', () => {
  it('count increases with each recorded request', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 5000, maxRequests: 10, now: clock.now });
    assert.equal(sw.count, 0);
    sw.record();
    assert.equal(sw.count, 1);
    sw.record();
    assert.equal(sw.count, 2);
  });

  it('remaining decreases with each recorded request', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 5000, maxRequests: 3, now: clock.now });
    assert.equal(sw.remaining, 3);
    sw.record();
    assert.equal(sw.remaining, 2);
    sw.record();
    assert.equal(sw.remaining, 1);
    sw.record();
    assert.equal(sw.remaining, 0);
  });

  it('count decreases as requests expire from the window', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 10, now: clock.now });
    sw.record(); // t=0
    sw.record(); // t=0
    assert.equal(sw.count, 2);

    clock.advance(1001);
    assert.equal(sw.count, 0);
  });

  it('remaining is never negative', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 1, now: clock.now });
    sw.record();
    // Attempt an extra record (it fails but should not go negative)
    sw.record();
    assert.equal(sw.remaining, 0);
  });
});

// ─── SlidingWindow – resetIn ──────────────────────────────────────────────────

describe('SlidingWindow – resetIn', () => {
  it('returns 0 when window is empty', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 5, now: clock.now });
    assert.equal(sw.resetIn, 0);
  });

  it('returns time until oldest request expires', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 5, now: clock.now });
    sw.record(); // oldest at t=0, expires at t=1000

    assert.equal(sw.resetIn, 1000); // at t=0, 1000 ms remaining

    clock.advance(400);
    assert.equal(sw.resetIn, 600); // at t=400, 600 ms remaining
  });

  it('returns 0 once all requests have expired', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 500, maxRequests: 5, now: clock.now });
    sw.record(); // at t=0, expires at t=500

    clock.advance(501);
    assert.equal(sw.resetIn, 0);
  });

  it('tracks the oldest request when multiple exist', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 10, now: clock.now });
    sw.record(); // oldest: t=0
    clock.advance(200);
    sw.record(); // t=200

    // resetIn should refer to the t=0 request which expires at t=1000
    // Current time is t=200, so 800 ms remaining
    assert.equal(sw.resetIn, 800);
  });
});

// ─── SlidingWindow – reset / canRecord ───────────────────────────────────────

describe('SlidingWindow – reset', () => {
  it('clears all recorded requests', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 5000, maxRequests: 3, now: clock.now });
    sw.record();
    sw.record();
    sw.record();
    assert.equal(sw.count, 3);
    sw.reset();
    assert.equal(sw.count, 0);
    assert.equal(sw.remaining, 3);
  });

  it('allows recording again after reset', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 5000, maxRequests: 1, now: clock.now });
    sw.record();
    assert.equal(sw.record(), false);
    sw.reset();
    assert.equal(sw.record(), true);
  });
});

describe('SlidingWindow – canRecord', () => {
  it('returns true when below limit', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 3, now: clock.now });
    assert.equal(sw.canRecord(), true);
  });

  it('returns false when at limit', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 2, now: clock.now });
    sw.record();
    sw.record();
    assert.equal(sw.canRecord(), false);
  });

  it('does not record a request', () => {
    const clock = makeClock();
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 5, now: clock.now });
    sw.canRecord();
    sw.canRecord();
    assert.equal(sw.count, 0); // not recorded
  });

  it('returns true again after requests expire', () => {
    const clock = makeClock(0);
    const sw = new SlidingWindow({ windowMs: 1000, maxRequests: 1, now: clock.now });
    sw.record();
    assert.equal(sw.canRecord(), false);
    clock.advance(1001);
    assert.equal(sw.canRecord(), true);
  });
});

// ─── WindowCounter – constructor ─────────────────────────────────────────────

describe('WindowCounter – constructor', () => {
  it('starts with total 0', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    assert.equal(wc.total, 0);
  });

  it('throws on windowMs <= 0', () => {
    assert.throws(() => new WindowCounter(0), RangeError);
    assert.throws(() => new WindowCounter(-1), RangeError);
  });

  it('throws on buckets <= 0', () => {
    assert.throws(() => new WindowCounter(1000, 0), RangeError);
    assert.throws(() => new WindowCounter(1000, -1), RangeError);
  });

  it('defaults to 10 buckets', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, undefined, clock.now);
    assert.equal(wc.getBuckets().length, 10);
  });
});

// ─── WindowCounter – increment / total ───────────────────────────────────────

describe('WindowCounter – increment and total', () => {
  it('increment increases total', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment();
    assert.equal(wc.total, 1);
    wc.increment();
    assert.equal(wc.total, 2);
  });

  it('increment(by) adds the given amount', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(5);
    assert.equal(wc.total, 5);
    wc.increment(3);
    assert.equal(wc.total, 8);
  });

  it('increment defaults to 1', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment();
    assert.equal(wc.total, 1);
  });

  it('total drops to 0 after window expires', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(10);
    assert.equal(wc.total, 10);
    clock.advance(2000); // full window has passed
    assert.equal(wc.total, 0);
  });

  it('increments in different time buckets accumulate', () => {
    const clock = makeClock(0);
    // 1000ms window, 10 buckets → 100ms per bucket
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(3); // bucket at t=0
    clock.advance(100);
    wc.increment(5); // bucket at t=100
    clock.advance(100);
    wc.increment(2); // bucket at t=200
    assert.equal(wc.total, 10);
  });
});

// ─── WindowCounter – ratePerSecond ───────────────────────────────────────────

describe('WindowCounter – ratePerSecond', () => {
  it('calculates rate per second correctly', () => {
    const clock = makeClock(0);
    // window = 1000ms = 1 second
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(10);
    // 10 events in 1 second = 10/sec
    assert.equal(wc.ratePerSecond, 10);
  });

  it('rate is 0 when no events', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(2000, 10, clock.now);
    assert.equal(wc.ratePerSecond, 0);
  });

  it('rate uses full window duration regardless of when events occurred', () => {
    const clock = makeClock(0);
    // 2000ms window → rate = total / 2
    const wc = new WindowCounter(2000, 10, clock.now);
    wc.increment(20);
    assert.equal(wc.ratePerSecond, 10);
  });
});

// ─── WindowCounter – getBuckets ──────────────────────────────────────────────

describe('WindowCounter – getBuckets', () => {
  it('returns an array of length equal to bucket count', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 5, clock.now);
    assert.equal(wc.getBuckets().length, 5);
  });

  it('all buckets are 0 initially', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    assert.deepEqual(wc.getBuckets(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('bucket sums equal total', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(3);
    clock.advance(100);
    wc.increment(7);
    const buckets = wc.getBuckets();
    const sum = buckets.reduce((a, b) => a + b, 0);
    assert.equal(sum, wc.total);
  });

  it('stale buckets appear as 0', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(5); // at t=0
    clock.advance(2000); // all buckets are stale
    const buckets = wc.getBuckets();
    assert.deepEqual(buckets, new Array(10).fill(0));
  });
});

// ─── WindowCounter – reset ───────────────────────────────────────────────────

describe('WindowCounter – reset', () => {
  it('clears all data', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(42);
    assert.equal(wc.total, 42);
    wc.reset();
    assert.equal(wc.total, 0);
    assert.equal(wc.ratePerSecond, 0);
    assert.deepEqual(wc.getBuckets(), new Array(10).fill(0));
  });

  it('can increment again after reset', () => {
    const clock = makeClock(0);
    const wc = new WindowCounter(1000, 10, clock.now);
    wc.increment(10);
    wc.reset();
    wc.increment(3);
    assert.equal(wc.total, 3);
  });
});
