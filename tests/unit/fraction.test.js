// ─── Unit Tests: Fraction ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Fraction, gcd, createFraction } from '../../app/modules/fraction.js';

// ─── gcd ─────────────────────────────────────────────────────────────────────

describe('gcd', () => {
  it('gcd(12, 8) === 4', () => {
    assert.equal(gcd(12, 8), 4);
  });

  it('gcd(8, 12) === 4 (order-independent)', () => {
    assert.equal(gcd(8, 12), 4);
  });

  it('gcd(0, 5) === 5', () => {
    assert.equal(gcd(0, 5), 5);
  });

  it('gcd(5, 0) === 5', () => {
    assert.equal(gcd(5, 0), 5);
  });

  it('gcd(7, 7) === 7', () => {
    assert.equal(gcd(7, 7), 7);
  });

  it('gcd(1, 1) === 1', () => {
    assert.equal(gcd(1, 1), 1);
  });

  it('gcd(100, 75) === 25', () => {
    assert.equal(gcd(100, 75), 25);
  });

  it('is always non-negative for negative inputs', () => {
    assert.equal(gcd(-12, 8), 4);
    assert.equal(gcd(12, -8), 4);
  });
});

// ─── Construction & reduction ─────────────────────────────────────────────────

describe('Fraction construction', () => {
  it('auto-reduces 6/4 to 3/2', () => {
    const f = new Fraction(6, 4);
    assert.equal(f.numerator, 3);
    assert.equal(f.denominator, 2);
  });

  it('auto-reduces 10/5 to 2/1', () => {
    const f = new Fraction(10, 5);
    assert.equal(f.numerator, 2);
    assert.equal(f.denominator, 1);
  });

  it('keeps 1/2 unreduced', () => {
    const f = new Fraction(1, 2);
    assert.equal(f.numerator, 1);
    assert.equal(f.denominator, 2);
  });

  it('sign normalisation: -1/2 → numerator=-1, denominator=2', () => {
    const f = new Fraction(-1, 2);
    assert.equal(f.numerator, -1);
    assert.equal(f.denominator, 2);
  });

  it('sign normalisation: 1/-2 → numerator=-1, denominator=2', () => {
    const f = new Fraction(1, -2);
    assert.equal(f.numerator, -1);
    assert.equal(f.denominator, 2);
  });

  it('sign normalisation: -1/-2 → numerator=1, denominator=2', () => {
    const f = new Fraction(-1, -2);
    assert.equal(f.numerator, 1);
    assert.equal(f.denominator, 2);
  });

  it('zero numerator → 0/1 after reduction', () => {
    const f = new Fraction(0, 99);
    assert.equal(f.numerator, 0);
    assert.equal(f.denominator, 1);
  });

  it('throws RangeError for denominator 0', () => {
    assert.throws(() => new Fraction(1, 0), RangeError);
  });
});

// ─── createFraction factory ───────────────────────────────────────────────────

describe('createFraction', () => {
  it('returns a Fraction instance', () => {
    const f = createFraction(3, 4);
    assert.ok(f instanceof Fraction);
  });

  it('applies the same reduction as the constructor', () => {
    const f = createFraction(6, 4);
    assert.equal(f.numerator, 3);
    assert.equal(f.denominator, 2);
  });

  it('throws RangeError for denominator 0', () => {
    assert.throws(() => createFraction(1, 0), RangeError);
  });
});

// ─── Arithmetic ───────────────────────────────────────────────────────────────

describe('Fraction.add', () => {
  it('1/2 + 1/3 = 5/6', () => {
    const result = new Fraction(1, 2).add(new Fraction(1, 3));
    assert.equal(result.numerator, 5);
    assert.equal(result.denominator, 6);
  });

  it('1/4 + 1/4 = 1/2', () => {
    const result = new Fraction(1, 4).add(new Fraction(1, 4));
    assert.equal(result.numerator, 1);
    assert.equal(result.denominator, 2);
  });

  it('adding zero returns equivalent fraction', () => {
    const half = new Fraction(1, 2);
    const result = half.add(Fraction.ZERO);
    assert.ok(result.equals(half));
  });
});

describe('Fraction.sub', () => {
  it('3/4 - 1/4 = 1/2', () => {
    const result = new Fraction(3, 4).sub(new Fraction(1, 4));
    assert.equal(result.numerator, 1);
    assert.equal(result.denominator, 2);
  });

  it('1/2 - 1/2 = 0', () => {
    const result = new Fraction(1, 2).sub(new Fraction(1, 2));
    assert.ok(result.equals(Fraction.ZERO));
  });

  it('1/3 - 1/2 = -1/6', () => {
    const result = new Fraction(1, 3).sub(new Fraction(1, 2));
    assert.equal(result.numerator, -1);
    assert.equal(result.denominator, 6);
  });
});

describe('Fraction.mul', () => {
  it('3/4 * 4/3 = 1', () => {
    const result = new Fraction(3, 4).mul(new Fraction(4, 3));
    assert.equal(result.numerator, 1);
    assert.equal(result.denominator, 1);
  });

  it('1/2 * 2/3 = 1/3', () => {
    const result = new Fraction(1, 2).mul(new Fraction(2, 3));
    assert.equal(result.numerator, 1);
    assert.equal(result.denominator, 3);
  });

  it('multiplying by zero gives zero', () => {
    const result = new Fraction(7, 3).mul(Fraction.ZERO);
    assert.ok(result.equals(Fraction.ZERO));
  });
});

describe('Fraction.div', () => {
  it('1/2 ÷ 1/4 = 2', () => {
    const result = new Fraction(1, 2).div(new Fraction(1, 4));
    assert.equal(result.numerator, 2);
    assert.equal(result.denominator, 1);
  });

  it('2/3 ÷ 4/3 = 1/2', () => {
    const result = new Fraction(2, 3).div(new Fraction(4, 3));
    assert.equal(result.numerator, 1);
    assert.equal(result.denominator, 2);
  });

  it('throws RangeError when dividing by zero fraction', () => {
    assert.throws(() => new Fraction(1, 2).div(Fraction.ZERO), RangeError);
  });
});

// ─── Unary operations ────────────────────────────────────────────────────────

describe('Fraction.negate', () => {
  it('negate 1/2 → -1/2', () => {
    const result = new Fraction(1, 2).negate();
    assert.equal(result.numerator, -1);
    assert.equal(result.denominator, 2);
  });

  it('negate -3/4 → 3/4', () => {
    const result = new Fraction(-3, 4).negate();
    assert.equal(result.numerator, 3);
    assert.equal(result.denominator, 4);
  });

  it('negate zero → zero', () => {
    assert.ok(Fraction.ZERO.negate().equals(Fraction.ZERO));
  });
});

describe('Fraction.reciprocal', () => {
  it('reciprocal of 2/3 = 3/2', () => {
    const result = new Fraction(2, 3).reciprocal();
    assert.equal(result.numerator, 3);
    assert.equal(result.denominator, 2);
  });

  it('reciprocal of 1/4 = 4', () => {
    const result = new Fraction(1, 4).reciprocal();
    assert.equal(result.numerator, 4);
    assert.equal(result.denominator, 1);
  });

  it('reciprocal of negative fraction preserves sign', () => {
    const result = new Fraction(-1, 2).reciprocal();
    assert.equal(result.numerator, -2);
    assert.equal(result.denominator, 1);
  });

  it('throws RangeError for zero fraction', () => {
    assert.throws(() => Fraction.ZERO.reciprocal(), RangeError);
  });
});

describe('Fraction.abs', () => {
  it('abs of -3/4 = 3/4', () => {
    const result = new Fraction(-3, 4).abs();
    assert.equal(result.numerator, 3);
    assert.equal(result.denominator, 4);
  });

  it('abs of positive fraction is unchanged', () => {
    const f = new Fraction(5, 7);
    assert.ok(f.abs().equals(f));
  });
});

// ─── Conversion ───────────────────────────────────────────────────────────────

describe('Fraction.toNumber', () => {
  it('1/4 = 0.25', () => {
    assert.equal(new Fraction(1, 4).toNumber(), 0.25);
  });

  it('1/2 = 0.5', () => {
    assert.equal(new Fraction(1, 2).toNumber(), 0.5);
  });

  it('3/1 = 3', () => {
    assert.equal(new Fraction(3, 1).toNumber(), 3);
  });

  it('-1/2 = -0.5', () => {
    assert.equal(new Fraction(-1, 2).toNumber(), -0.5);
  });
});

describe('Fraction.toString', () => {
  it('returns "1/2" for 1/2', () => {
    assert.equal(new Fraction(1, 2).toString(), '1/2');
  });

  it('returns "3" for 3/1', () => {
    assert.equal(new Fraction(3, 1).toString(), '3');
  });

  it('returns "-5/6" for -5/6', () => {
    assert.equal(new Fraction(-5, 6).toString(), '-5/6');
  });

  it('returns "0" for 0/anything', () => {
    assert.equal(new Fraction(0, 7).toString(), '0');
  });
});

// ─── Comparison ───────────────────────────────────────────────────────────────

describe('Fraction.equals', () => {
  it('2/4 equals 1/2', () => {
    assert.ok(new Fraction(2, 4).equals(new Fraction(1, 2)));
  });

  it('1/3 does not equal 1/2', () => {
    assert.ok(!new Fraction(1, 3).equals(new Fraction(1, 2)));
  });

  it('reflexive: x equals x', () => {
    const f = new Fraction(7, 9);
    assert.ok(f.equals(f));
  });
});

describe('Fraction.compareTo', () => {
  it('1/3 < 1/2 (negative result)', () => {
    const cmp = new Fraction(1, 3).compareTo(new Fraction(1, 2));
    assert.ok(cmp < 0);
  });

  it('2/3 > 1/2 (positive result)', () => {
    const cmp = new Fraction(2, 3).compareTo(new Fraction(1, 2));
    assert.ok(cmp > 0);
  });

  it('1/2 compared to 1/2 is 0', () => {
    const cmp = new Fraction(1, 2).compareTo(new Fraction(1, 2));
    assert.equal(cmp, 0);
  });

  it('-1/4 < 1/4', () => {
    const cmp = new Fraction(-1, 4).compareTo(new Fraction(1, 4));
    assert.ok(cmp < 0);
  });
});

// ─── Static properties ────────────────────────────────────────────────────────

describe('Fraction.ZERO', () => {
  it('has numerator 0 and denominator 1', () => {
    assert.equal(Fraction.ZERO.numerator, 0);
    assert.equal(Fraction.ZERO.denominator, 1);
  });

  it('toString is "0"', () => {
    assert.equal(Fraction.ZERO.toString(), '0');
  });
});

describe('Fraction.ONE', () => {
  it('has numerator 1 and denominator 1', () => {
    assert.equal(Fraction.ONE.numerator, 1);
    assert.equal(Fraction.ONE.denominator, 1);
  });

  it('toString is "1"', () => {
    assert.equal(Fraction.ONE.toString(), '1');
  });
});

// ─── fromNumber ───────────────────────────────────────────────────────────────

describe('Fraction.fromNumber', () => {
  it('fromNumber(3) → 3/1', () => {
    const f = Fraction.fromNumber(3);
    assert.equal(f.numerator, 3);
    assert.equal(f.denominator, 1);
  });

  it('fromNumber(0) → 0/1', () => {
    const f = Fraction.fromNumber(0);
    assert.ok(f.equals(Fraction.ZERO));
  });

  it('fromNumber(0.5) → 1/2', () => {
    const f = Fraction.fromNumber(0.5);
    assert.equal(f.numerator, 1);
    assert.equal(f.denominator, 2);
  });

  it('fromNumber(0.25) → 1/4', () => {
    const f = Fraction.fromNumber(0.25);
    assert.equal(f.numerator, 1);
    assert.equal(f.denominator, 4);
  });

  it('fromNumber(-2) → -2/1', () => {
    const f = Fraction.fromNumber(-2);
    assert.equal(f.numerator, -2);
    assert.equal(f.denominator, 1);
  });
});
