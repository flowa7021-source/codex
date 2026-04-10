// ─── Unit Tests: IntervalArithmetic ──────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Interval, createInterval } from '../../app/modules/interval-arithmetic.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('Interval – constructor', () => {
  it('creates a valid interval [lo, hi]', () => {
    const iv = new Interval(1, 5);
    assert.equal(iv.lo, 1);
    assert.equal(iv.hi, 5);
  });

  it('allows lo === hi (degenerate/point interval)', () => {
    const iv = new Interval(3, 3);
    assert.equal(iv.lo, 3);
    assert.equal(iv.hi, 3);
  });

  it('throws RangeError when lo > hi', () => {
    assert.throws(() => new Interval(5, 3), RangeError);
  });

  it('RangeError message includes the bad bounds', () => {
    assert.throws(
      () => new Interval(10, 2),
      (err) => {
        assert.ok(err instanceof RangeError);
        assert.ok(err.message.includes('10'));
        assert.ok(err.message.includes('2'));
        return true;
      }
    );
  });
});

// ─── Arithmetic operations ────────────────────────────────────────────────────

describe('Interval – add', () => {
  it('[1,2] + [3,4] = [4,6]', () => {
    const result = new Interval(1, 2).add(new Interval(3, 4));
    assert.equal(result.lo, 4);
    assert.equal(result.hi, 6);
  });

  it('handles negative bounds', () => {
    const result = new Interval(-3, -1).add(new Interval(1, 2));
    assert.equal(result.lo, -2);
    assert.equal(result.hi, 1);
  });
});

describe('Interval – sub', () => {
  it('[3,5] - [1,2] = [1,4]', () => {
    const result = new Interval(3, 5).sub(new Interval(1, 2));
    assert.equal(result.lo, 1);
    assert.equal(result.hi, 4);
  });

  it('[0,0] - [1,1] = [-1,-1]', () => {
    const result = new Interval(0, 0).sub(new Interval(1, 1));
    assert.equal(result.lo, -1);
    assert.equal(result.hi, -1);
  });
});

describe('Interval – mul', () => {
  it('[2,3] * [4,5] = [8,15]', () => {
    const result = new Interval(2, 3).mul(new Interval(4, 5));
    assert.equal(result.lo, 8);
    assert.equal(result.hi, 15);
  });

  it('[-2,3] * [-1,4] spans all four products', () => {
    // products: (-2)(-1)=2, (-2)(4)=-8, (3)(-1)=-3, (3)(4)=12 → [-8,12]
    const result = new Interval(-2, 3).mul(new Interval(-1, 4));
    assert.equal(result.lo, -8);
    assert.equal(result.hi, 12);
  });

  it('[-3,-1] * [-4,-2] = [2,12] (neg*neg)', () => {
    const result = new Interval(-3, -1).mul(new Interval(-4, -2));
    assert.equal(result.lo, 2);
    assert.equal(result.hi, 12);
  });
});

describe('Interval – div', () => {
  it('[4,6] / [2,3] = [4/3, 3]', () => {
    const result = new Interval(4, 6).div(new Interval(2, 3));
    assert.ok(Math.abs(result.lo - 4 / 3) < 1e-10);
    assert.equal(result.hi, 3);
  });

  it('throws RangeError when divisor contains 0 (straddles)', () => {
    assert.throws(() => new Interval(1, 2).div(new Interval(-1, 1)), RangeError);
  });

  it('throws RangeError when divisor is exactly [0,0]', () => {
    assert.throws(() => new Interval(1, 2).div(new Interval(0, 0)), RangeError);
  });

  it('throws RangeError when divisor lo == 0', () => {
    assert.throws(() => new Interval(1, 2).div(new Interval(0, 3)), RangeError);
  });

  it('throws RangeError when divisor hi == 0', () => {
    assert.throws(() => new Interval(1, 2).div(new Interval(-3, 0)), RangeError);
  });

  it('does NOT throw when divisor is strictly positive', () => {
    assert.doesNotThrow(() => new Interval(1, 2).div(new Interval(1, 2)));
  });

  it('does NOT throw when divisor is strictly negative', () => {
    assert.doesNotThrow(() => new Interval(1, 2).div(new Interval(-3, -1)));
  });
});

// ─── Unary operations ─────────────────────────────────────────────────────────

describe('Interval – neg', () => {
  it('[-3,2].neg() = [-2,3]', () => {
    const result = new Interval(-3, 2).neg();
    assert.equal(result.lo, -2);
    assert.equal(result.hi, 3);
  });

  it('[0,0].neg() = [0,0]', () => {
    const result = new Interval(0, 0).neg();
    assert.equal(result.lo, -0); // -0 === 0 under strict equality
    assert.equal(result.hi, -0);
  });

  it('[1,4].neg() = [-4,-1]', () => {
    const result = new Interval(1, 4).neg();
    assert.equal(result.lo, -4);
    assert.equal(result.hi, -1);
  });
});

describe('Interval – abs', () => {
  it('positive interval is unchanged', () => {
    const result = new Interval(2, 5).abs();
    assert.equal(result.lo, 2);
    assert.equal(result.hi, 5);
  });

  it('negative interval is flipped', () => {
    const result = new Interval(-5, -2).abs();
    assert.equal(result.lo, 2);
    assert.equal(result.hi, 5);
  });

  it('straddling interval: [0, max(|lo|,hi)]', () => {
    const result = new Interval(-3, 2).abs();
    assert.equal(result.lo, 0);
    assert.equal(result.hi, 3);
  });

  it('straddling interval where hi > |lo|', () => {
    const result = new Interval(-2, 4).abs();
    assert.equal(result.lo, 0);
    assert.equal(result.hi, 4);
  });
});

// ─── Scalar properties ────────────────────────────────────────────────────────

describe('Interval – width', () => {
  it('[1,5].width() = 4', () => {
    assert.equal(new Interval(1, 5).width(), 4);
  });

  it('point interval has width 0', () => {
    assert.equal(new Interval(7, 7).width(), 0);
  });

  it('negative bounds', () => {
    assert.equal(new Interval(-3, -1).width(), 2);
  });
});

describe('Interval – midpoint', () => {
  it('[1,5].midpoint() = 3', () => {
    assert.equal(new Interval(1, 5).midpoint(), 3);
  });

  it('[0,1].midpoint() = 0.5', () => {
    assert.equal(new Interval(0, 1).midpoint(), 0.5);
  });

  it('[-4,4].midpoint() = 0', () => {
    assert.equal(new Interval(-4, 4).midpoint(), 0);
  });
});

// ─── Containment and overlap ──────────────────────────────────────────────────

describe('Interval – contains', () => {
  it('[1,5].contains(3) is true', () => {
    assert.equal(new Interval(1, 5).contains(3), true);
  });

  it('[1,5].contains(0) is false', () => {
    assert.equal(new Interval(1, 5).contains(0), false);
  });

  it('[1,5].contains(1) is true (boundary lo)', () => {
    assert.equal(new Interval(1, 5).contains(1), true);
  });

  it('[1,5].contains(5) is true (boundary hi)', () => {
    assert.equal(new Interval(1, 5).contains(5), true);
  });

  it('[1,5].contains(6) is false', () => {
    assert.equal(new Interval(1, 5).contains(6), false);
  });
});

describe('Interval – overlaps', () => {
  it('[1,3].overlaps([2,4]) is true (partial overlap)', () => {
    assert.equal(new Interval(1, 3).overlaps(new Interval(2, 4)), true);
  });

  it('[1,2].overlaps([3,4]) is false (disjoint)', () => {
    assert.equal(new Interval(1, 2).overlaps(new Interval(3, 4)), false);
  });

  it('[1,3].overlaps([3,5]) is true (touching at endpoint)', () => {
    assert.equal(new Interval(1, 3).overlaps(new Interval(3, 5)), true);
  });

  it('[1,5].overlaps([2,3]) is true (containment)', () => {
    assert.equal(new Interval(1, 5).overlaps(new Interval(2, 3)), true);
  });

  it('[3,4].overlaps([1,2]) is false (disjoint, reversed)', () => {
    assert.equal(new Interval(3, 4).overlaps(new Interval(1, 2)), false);
  });
});

// ─── Set-like operations ──────────────────────────────────────────────────────

describe('Interval – intersect', () => {
  it('[1,3] intersect [2,4] = [2,3]', () => {
    const result = new Interval(1, 3).intersect(new Interval(2, 4));
    assert.notEqual(result, null);
    assert.equal(result.lo, 2);
    assert.equal(result.hi, 3);
  });

  it('[1,2] intersect [3,4] = null', () => {
    const result = new Interval(1, 2).intersect(new Interval(3, 4));
    assert.equal(result, null);
  });

  it('[1,5] intersect [2,3] = [2,3] (containment)', () => {
    const result = new Interval(1, 5).intersect(new Interval(2, 3));
    assert.notEqual(result, null);
    assert.equal(result.lo, 2);
    assert.equal(result.hi, 3);
  });

  it('[1,3] intersect [3,5] = [3,3] (single point)', () => {
    const result = new Interval(1, 3).intersect(new Interval(3, 5));
    assert.notEqual(result, null);
    assert.equal(result.lo, 3);
    assert.equal(result.hi, 3);
  });
});

describe('Interval – hull', () => {
  it('[1,2].hull([4,5]) = [1,5]', () => {
    const result = new Interval(1, 2).hull(new Interval(4, 5));
    assert.equal(result.lo, 1);
    assert.equal(result.hi, 5);
  });

  it('[1,5].hull([2,3]) = [1,5] (containment)', () => {
    const result = new Interval(1, 5).hull(new Interval(2, 3));
    assert.equal(result.lo, 1);
    assert.equal(result.hi, 5);
  });

  it('overlapping intervals', () => {
    const result = new Interval(1, 4).hull(new Interval(3, 7));
    assert.equal(result.lo, 1);
    assert.equal(result.hi, 7);
  });
});

// ─── toString ─────────────────────────────────────────────────────────────────

describe('Interval – toString', () => {
  it('formats as [lo, hi]', () => {
    assert.equal(new Interval(1, 5).toString(), '[1, 5]');
  });

  it('works with negative values', () => {
    assert.equal(new Interval(-3, 2).toString(), '[-3, 2]');
  });

  it('works with point interval', () => {
    assert.equal(new Interval(7, 7).toString(), '[7, 7]');
  });
});

// ─── Static factories ─────────────────────────────────────────────────────────

describe('Interval.point', () => {
  it('Interval.point(3) = [3,3]', () => {
    const iv = Interval.point(3);
    assert.equal(iv.lo, 3);
    assert.equal(iv.hi, 3);
  });

  it('Interval.point(0) = [0,0]', () => {
    const iv = Interval.point(0);
    assert.equal(iv.lo, 0);
    assert.equal(iv.hi, 0);
  });

  it('Interval.point(-7) = [-7,-7]', () => {
    const iv = Interval.point(-7);
    assert.equal(iv.lo, -7);
    assert.equal(iv.hi, -7);
  });
});

describe('Interval.fromRadius', () => {
  it('Interval.fromRadius(5, 2) = [3,7]', () => {
    const iv = Interval.fromRadius(5, 2);
    assert.equal(iv.lo, 3);
    assert.equal(iv.hi, 7);
  });

  it('radius 0 gives a point interval', () => {
    const iv = Interval.fromRadius(4, 0);
    assert.equal(iv.lo, 4);
    assert.equal(iv.hi, 4);
  });

  it('throws RangeError for negative radius', () => {
    assert.throws(() => Interval.fromRadius(5, -1), RangeError);
  });

  it('works with negative center', () => {
    const iv = Interval.fromRadius(-3, 1);
    assert.equal(iv.lo, -4);
    assert.equal(iv.hi, -2);
  });
});

// ─── createInterval factory ───────────────────────────────────────────────────

describe('createInterval factory', () => {
  it('returns an Interval instance', () => {
    const iv = createInterval(2, 8);
    assert.ok(iv instanceof Interval);
    assert.equal(iv.lo, 2);
    assert.equal(iv.hi, 8);
  });

  it('throws RangeError for lo > hi', () => {
    assert.throws(() => createInterval(5, 1), RangeError);
  });

  it('accepts equal lo and hi', () => {
    const iv = createInterval(4, 4);
    assert.equal(iv.lo, 4);
    assert.equal(iv.hi, 4);
  });
});
