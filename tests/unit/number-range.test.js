// ─── Unit Tests: NumberRange ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createRange,
  isEmpty,
  contains,
  overlaps,
  length,
  clamp,
  intersection,
  union,
  difference,
  merge,
  invert,
} from '../../app/modules/number-range.js';

// ─── createRange ──────────────────────────────────────────────────────────────

describe('createRange – factory', () => {
  it('creates a range with start and end', () => {
    const r = createRange(2, 8);
    assert.equal(r.start, 2);
    assert.equal(r.end, 8);
  });

  it('creates an empty range when start equals end', () => {
    const r = createRange(5, 5);
    assert.equal(r.start, 5);
    assert.equal(r.end, 5);
  });

  it('creates a range starting at zero', () => {
    const r = createRange(0, 10);
    assert.equal(r.start, 0);
    assert.equal(r.end, 10);
  });

  it('creates a range with negative values', () => {
    const r = createRange(-5, -1);
    assert.equal(r.start, -5);
    assert.equal(r.end, -1);
  });

  it('creates a range with floating-point numbers', () => {
    const r = createRange(1.5, 3.5);
    assert.equal(r.start, 1.5);
    assert.equal(r.end, 3.5);
  });

  it('throws RangeError when start > end', () => {
    assert.throws(() => createRange(10, 5), RangeError);
  });

  it('throws RangeError with informative message', () => {
    assert.throws(
      () => createRange(10, 2),
      (err) => {
        assert.ok(err instanceof RangeError);
        assert.ok(err.message.includes('10'));
        assert.ok(err.message.includes('2'));
        return true;
      },
    );
  });

  it('does not throw when start equals end (empty range is valid)', () => {
    assert.doesNotThrow(() => createRange(3, 3));
  });
});

// ─── isEmpty ──────────────────────────────────────────────────────────────────

describe('isEmpty – predicate', () => {
  it('returns true for a zero-length range', () => {
    assert.equal(isEmpty({ start: 5, end: 5 }), true);
  });

  it('returns false for a non-empty range', () => {
    assert.equal(isEmpty({ start: 0, end: 1 }), false);
  });

  it('returns false for a large range', () => {
    assert.equal(isEmpty({ start: 0, end: 1000 }), false);
  });

  it('returns true when start and end are zero', () => {
    assert.equal(isEmpty({ start: 0, end: 0 }), true);
  });

  it('returns true for negative zero-length range', () => {
    assert.equal(isEmpty({ start: -3, end: -3 }), true);
  });

  it('returns false for a range of length 0.001', () => {
    assert.equal(isEmpty({ start: 1.0, end: 1.001 }), false);
  });

  it('returns false for a range starting at negative number', () => {
    assert.equal(isEmpty({ start: -5, end: 0 }), false);
  });

  it('isEmpty result matches length === 0', () => {
    const r = { start: 7, end: 7 };
    assert.equal(isEmpty(r), length(r) === 0);
  });
});

// ─── contains ─────────────────────────────────────────────────────────────────

describe('contains – predicate', () => {
  it('returns true for a value at start (inclusive)', () => {
    assert.equal(contains({ start: 2, end: 8 }, 2), true);
  });

  it('returns false for a value at end (exclusive)', () => {
    assert.equal(contains({ start: 2, end: 8 }, 8), false);
  });

  it('returns true for a value strictly inside the range', () => {
    assert.equal(contains({ start: 2, end: 8 }, 5), true);
  });

  it('returns false for a value below start', () => {
    assert.equal(contains({ start: 2, end: 8 }, 1), false);
  });

  it('returns false for a value above end', () => {
    assert.equal(contains({ start: 2, end: 8 }, 9), false);
  });

  it('returns false for any value in an empty range', () => {
    assert.equal(contains({ start: 5, end: 5 }, 5), false);
  });

  it('works with negative ranges', () => {
    assert.equal(contains({ start: -10, end: -2 }, -5), true);
    assert.equal(contains({ start: -10, end: -2 }, -2), false);
  });

  it('works with floating-point values', () => {
    assert.equal(contains({ start: 1.0, end: 2.0 }, 1.5), true);
    assert.equal(contains({ start: 1.0, end: 2.0 }, 2.0), false);
  });
});

// ─── overlaps ─────────────────────────────────────────────────────────────────

describe('overlaps – predicate', () => {
  it('returns true for ranges that share a common segment', () => {
    assert.equal(overlaps({ start: 0, end: 5 }, { start: 3, end: 8 }), true);
  });

  it('returns false for adjacent ranges that only touch at a point', () => {
    assert.equal(overlaps({ start: 0, end: 5 }, { start: 5, end: 10 }), false);
  });

  it('returns false for disjoint ranges', () => {
    assert.equal(overlaps({ start: 0, end: 3 }, { start: 5, end: 8 }), false);
  });

  it('returns true when one range is fully inside another', () => {
    assert.equal(overlaps({ start: 0, end: 10 }, { start: 3, end: 7 }), true);
  });

  it('returns true for identical ranges', () => {
    assert.equal(overlaps({ start: 2, end: 6 }, { start: 2, end: 6 }), true);
  });

  it('returns false when an empty range sits at the boundary', () => {
    assert.equal(overlaps({ start: 0, end: 5 }, { start: 5, end: 5 }), false);
  });

  it('is symmetric', () => {
    const a = { start: 1, end: 4 };
    const b = { start: 3, end: 7 };
    assert.equal(overlaps(a, b), overlaps(b, a));
  });

  it('returns false for two empty ranges at the same point', () => {
    assert.equal(overlaps({ start: 3, end: 3 }, { start: 3, end: 3 }), false);
  });
});

// ─── length ───────────────────────────────────────────────────────────────────

describe('length – measurement', () => {
  it('returns end minus start', () => {
    assert.equal(length({ start: 2, end: 8 }), 6);
  });

  it('returns 0 for an empty range', () => {
    assert.equal(length({ start: 5, end: 5 }), 0);
  });

  it('returns correct length for a unit range', () => {
    assert.equal(length({ start: 0, end: 1 }), 1);
  });

  it('works with large ranges', () => {
    assert.equal(length({ start: 0, end: 1_000_000 }), 1_000_000);
  });

  it('works with negative ranges', () => {
    assert.equal(length({ start: -10, end: -3 }), 7);
  });

  it('works with mixed sign ranges', () => {
    assert.equal(length({ start: -5, end: 5 }), 10);
  });

  it('works with floating-point ranges', () => {
    assert.ok(Math.abs(length({ start: 1.1, end: 2.4 }) - 1.3) < 1e-10);
  });

  it('is always non-negative for a valid range', () => {
    assert.ok(length({ start: 3, end: 9 }) >= 0);
    assert.ok(length({ start: 5, end: 5 }) >= 0);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe('clamp – measurement', () => {
  it('returns value unchanged when inside range', () => {
    assert.equal(clamp(5, { start: 0, end: 10 }), 5);
  });

  it('returns start when value is below start', () => {
    assert.equal(clamp(-3, { start: 0, end: 10 }), 0);
  });

  it('returns end when value is above end', () => {
    assert.equal(clamp(15, { start: 0, end: 10 }), 10);
  });

  it('returns start when value equals start', () => {
    assert.equal(clamp(0, { start: 0, end: 10 }), 0);
  });

  it('returns end when value equals end', () => {
    assert.equal(clamp(10, { start: 0, end: 10 }), 10);
  });

  it('works with negative ranges', () => {
    assert.equal(clamp(-20, { start: -10, end: -1 }), -10);
    assert.equal(clamp(5, { start: -10, end: -1 }), -1);
  });

  it('works with an empty range', () => {
    // both boundaries are the same, value is clamped to that point
    assert.equal(clamp(3, { start: 5, end: 5 }), 5);
    assert.equal(clamp(7, { start: 5, end: 5 }), 5);
  });

  it('works with floating-point values', () => {
    assert.equal(clamp(1.5, { start: 1.0, end: 2.0 }), 1.5);
    assert.equal(clamp(0.5, { start: 1.0, end: 2.0 }), 1.0);
  });
});

// ─── intersection ─────────────────────────────────────────────────────────────

describe('intersection – set operation', () => {
  it('returns the overlapping region', () => {
    assert.deepEqual(
      intersection({ start: 0, end: 5 }, { start: 3, end: 8 }),
      { start: 3, end: 5 },
    );
  });

  it('returns null for disjoint ranges', () => {
    assert.equal(intersection({ start: 0, end: 3 }, { start: 5, end: 8 }), null);
  });

  it('returns null for adjacent (touching) ranges', () => {
    assert.equal(intersection({ start: 0, end: 5 }, { start: 5, end: 10 }), null);
  });

  it('returns the inner range when one is fully inside another', () => {
    assert.deepEqual(
      intersection({ start: 0, end: 10 }, { start: 3, end: 7 }),
      { start: 3, end: 7 },
    );
  });

  it('returns the range itself when both are equal', () => {
    assert.deepEqual(
      intersection({ start: 2, end: 6 }, { start: 2, end: 6 }),
      { start: 2, end: 6 },
    );
  });

  it('is symmetric', () => {
    const a = { start: 1, end: 5 };
    const b = { start: 3, end: 9 };
    assert.deepEqual(intersection(a, b), intersection(b, a));
  });

  it('returns null when one range is empty and outside the other', () => {
    assert.equal(intersection({ start: 0, end: 5 }, { start: 7, end: 7 }), null);
  });

  it('returns null when one empty range sits at the end boundary', () => {
    assert.equal(intersection({ start: 0, end: 5 }, { start: 5, end: 5 }), null);
  });
});

// ─── union ────────────────────────────────────────────────────────────────────

describe('union – set operation', () => {
  it('returns the bounding range for overlapping ranges', () => {
    assert.deepEqual(
      union({ start: 0, end: 5 }, { start: 3, end: 8 }),
      { start: 0, end: 8 },
    );
  });

  it('returns the bounding range for adjacent ranges', () => {
    assert.deepEqual(
      union({ start: 0, end: 5 }, { start: 5, end: 10 }),
      { start: 0, end: 10 },
    );
  });

  it('returns null for disjoint ranges', () => {
    assert.equal(union({ start: 0, end: 3 }, { start: 5, end: 8 }), null);
  });

  it('returns the larger range when one is fully inside the other', () => {
    assert.deepEqual(
      union({ start: 0, end: 10 }, { start: 3, end: 7 }),
      { start: 0, end: 10 },
    );
  });

  it('returns the range itself for identical ranges', () => {
    assert.deepEqual(
      union({ start: 2, end: 6 }, { start: 2, end: 6 }),
      { start: 2, end: 6 },
    );
  });

  it('is symmetric', () => {
    const a = { start: 1, end: 4 };
    const b = { start: 4, end: 7 };
    assert.deepEqual(union(a, b), union(b, a));
  });

  it('returns null when gap between ranges is > 0', () => {
    assert.equal(union({ start: 0, end: 3 }, { start: 4, end: 7 }), null);
  });

  it('returns the bounding range touching on the left side', () => {
    assert.deepEqual(
      union({ start: 5, end: 10 }, { start: 0, end: 5 }),
      { start: 0, end: 10 },
    );
  });
});

// ─── difference ───────────────────────────────────────────────────────────────

describe('difference – set operation', () => {
  it('returns the original range when ranges do not overlap', () => {
    assert.deepEqual(
      difference({ start: 0, end: 5 }, { start: 7, end: 10 }),
      [{ start: 0, end: 5 }],
    );
  });

  it('returns a left remainder when b overlaps the right side', () => {
    assert.deepEqual(
      difference({ start: 0, end: 8 }, { start: 5, end: 10 }),
      [{ start: 0, end: 5 }],
    );
  });

  it('returns a right remainder when b overlaps the left side', () => {
    assert.deepEqual(
      difference({ start: 2, end: 10 }, { start: 0, end: 5 }),
      [{ start: 5, end: 10 }],
    );
  });

  it('returns two remainders when b is fully inside a', () => {
    assert.deepEqual(
      difference({ start: 0, end: 10 }, { start: 3, end: 7 }),
      [{ start: 0, end: 3 }, { start: 7, end: 10 }],
    );
  });

  it('returns an empty array when b fully covers a', () => {
    assert.deepEqual(
      difference({ start: 2, end: 6 }, { start: 0, end: 10 }),
      [],
    );
  });

  it('returns empty array when a equals b', () => {
    assert.deepEqual(
      difference({ start: 0, end: 5 }, { start: 0, end: 5 }),
      [],
    );
  });

  it('returns original range when b is adjacent but does not overlap', () => {
    assert.deepEqual(
      difference({ start: 0, end: 5 }, { start: 5, end: 10 }),
      [{ start: 0, end: 5 }],
    );
  });

  it('trims exactly at the boundary when b starts at a.start', () => {
    assert.deepEqual(
      difference({ start: 0, end: 10 }, { start: 0, end: 4 }),
      [{ start: 4, end: 10 }],
    );
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('merge – multi-range operation', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(merge([]), []);
  });

  it('returns a single range unchanged', () => {
    assert.deepEqual(merge([{ start: 2, end: 5 }]), [{ start: 2, end: 5 }]);
  });

  it('merges two overlapping ranges', () => {
    assert.deepEqual(
      merge([{ start: 0, end: 5 }, { start: 3, end: 8 }]),
      [{ start: 0, end: 8 }],
    );
  });

  it('merges adjacent ranges', () => {
    assert.deepEqual(
      merge([{ start: 0, end: 5 }, { start: 5, end: 10 }]),
      [{ start: 0, end: 10 }],
    );
  });

  it('keeps disjoint ranges separate', () => {
    assert.deepEqual(
      merge([{ start: 0, end: 3 }, { start: 5, end: 8 }]),
      [{ start: 0, end: 3 }, { start: 5, end: 8 }],
    );
  });

  it('sorts ranges before merging', () => {
    assert.deepEqual(
      merge([{ start: 5, end: 8 }, { start: 0, end: 3 }]),
      [{ start: 0, end: 3 }, { start: 5, end: 8 }],
    );
  });

  it('merges multiple overlapping ranges into one', () => {
    assert.deepEqual(
      merge([
        { start: 0, end: 4 },
        { start: 2, end: 6 },
        { start: 5, end: 10 },
      ]),
      [{ start: 0, end: 10 }],
    );
  });

  it('handles duplicates by collapsing them', () => {
    assert.deepEqual(
      merge([{ start: 1, end: 5 }, { start: 1, end: 5 }]),
      [{ start: 1, end: 5 }],
    );
  });
});

// ─── invert ───────────────────────────────────────────────────────────────────

describe('invert – multi-range operation', () => {
  it('inverts a single range inside total to two gaps', () => {
    assert.deepEqual(
      invert([{ start: 3, end: 7 }], { start: 0, end: 10 }),
      [{ start: 0, end: 3 }, { start: 7, end: 10 }],
    );
  });

  it('returns the total range when the input list is empty', () => {
    assert.deepEqual(
      invert([], { start: 0, end: 10 }),
      [{ start: 0, end: 10 }],
    );
  });

  it('returns empty when input covers the full total range', () => {
    assert.deepEqual(
      invert([{ start: 0, end: 10 }], { start: 0, end: 10 }),
      [],
    );
  });

  it('trims ranges that extend beyond total', () => {
    assert.deepEqual(
      invert([{ start: -5, end: 15 }], { start: 0, end: 10 }),
      [],
    );
  });

  it('merges overlapping input ranges before inverting', () => {
    assert.deepEqual(
      invert(
        [{ start: 2, end: 5 }, { start: 4, end: 8 }],
        { start: 0, end: 10 },
      ),
      [{ start: 0, end: 2 }, { start: 8, end: 10 }],
    );
  });

  it('handles a range that starts at total.start', () => {
    assert.deepEqual(
      invert([{ start: 0, end: 5 }], { start: 0, end: 10 }),
      [{ start: 5, end: 10 }],
    );
  });

  it('handles a range that ends at total.end', () => {
    assert.deepEqual(
      invert([{ start: 5, end: 10 }], { start: 0, end: 10 }),
      [{ start: 0, end: 5 }],
    );
  });

  it('ignores ranges entirely outside total', () => {
    assert.deepEqual(
      invert([{ start: 20, end: 30 }], { start: 0, end: 10 }),
      [{ start: 0, end: 10 }],
    );
  });
});
