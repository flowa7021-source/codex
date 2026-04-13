// ─── Unit Tests: Roman Numeral Conversion ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  toRoman,
  fromRoman,
  isValidRoman,
  romanAdd,
  romanCompare,
} from '../../app/modules/roman-numeral.js';

// ─── toRoman ─────────────────────────────────────────────────────────────────

describe('toRoman', () => {
  it('converts 1 to "I"', () => {
    assert.equal(toRoman(1), 'I');
  });

  it('converts 4 to "IV"', () => {
    assert.equal(toRoman(4), 'IV');
  });

  it('converts 9 to "IX"', () => {
    assert.equal(toRoman(9), 'IX');
  });

  it('converts 14 to "XIV"', () => {
    assert.equal(toRoman(14), 'XIV');
  });

  it('converts 40 to "XL"', () => {
    assert.equal(toRoman(40), 'XL');
  });

  it('converts 90 to "XC"', () => {
    assert.equal(toRoman(90), 'XC');
  });

  it('converts 400 to "CD"', () => {
    assert.equal(toRoman(400), 'CD');
  });

  it('converts 900 to "CM"', () => {
    assert.equal(toRoman(900), 'CM');
  });

  it('converts 1994 to "MCMXCIV"', () => {
    assert.equal(toRoman(1994), 'MCMXCIV');
  });

  it('converts 3999 to "MMMCMXCIX"', () => {
    assert.equal(toRoman(3999), 'MMMCMXCIX');
  });

  it('throws RangeError for 0', () => {
    assert.throws(() => toRoman(0), RangeError);
  });

  it('throws RangeError for 4000', () => {
    assert.throws(() => toRoman(4000), RangeError);
  });

  it('throws RangeError for negative numbers', () => {
    assert.throws(() => toRoman(-1), RangeError);
    assert.throws(() => toRoman(-100), RangeError);
  });

  it('throws RangeError for non-integer input', () => {
    assert.throws(() => toRoman(1.5), RangeError);
    assert.throws(() => toRoman(3.14), RangeError);
    assert.throws(() => toRoman(NaN), RangeError);
  });
});

// ─── fromRoman ────────────────────────────────────────────────────────────────

describe('fromRoman', () => {
  it('converts "I" to 1', () => {
    assert.equal(fromRoman('I'), 1);
  });

  it('converts "IV" to 4', () => {
    assert.equal(fromRoman('IV'), 4);
  });

  it('converts "IX" to 9', () => {
    assert.equal(fromRoman('IX'), 9);
  });

  it('converts "XIV" to 14', () => {
    assert.equal(fromRoman('XIV'), 14);
  });

  it('converts "MCMXCIV" to 1994', () => {
    assert.equal(fromRoman('MCMXCIV'), 1994);
  });

  it('throws for an empty string', () => {
    assert.throws(() => fromRoman(''), Error);
  });

  it('throws for a string with unknown characters', () => {
    assert.throws(() => fromRoman('ABC'), Error);
    assert.throws(() => fromRoman('XIIZ'), Error);
  });

  it('throws for invalid patterns (too many of one symbol)', () => {
    assert.throws(() => fromRoman('IIII'), Error);
    assert.throws(() => fromRoman('VV'), Error);
    assert.throws(() => fromRoman('MMMM'), Error);
  });

  it('throws for other malformed patterns', () => {
    assert.throws(() => fromRoman('IIX'), Error);
    assert.throws(() => fromRoman('IM'), Error);
  });
});

// ─── toRoman / fromRoman roundtrip ───────────────────────────────────────────

describe('toRoman / fromRoman roundtrip', () => {
  it('roundtrips every integer from 1 to 20', () => {
    for (let n = 1; n <= 20; n++) {
      assert.equal(fromRoman(toRoman(n)), n, `roundtrip failed for ${n}`);
    }
  });

  it('roundtrips selected larger values', () => {
    for (const n of [50, 99, 400, 500, 900, 1000, 1776, 1994, 2024, 3999]) {
      assert.equal(fromRoman(toRoman(n)), n, `roundtrip failed for ${n}`);
    }
  });

  it('fromRoman(toRoman(n)) produces the canonical form', () => {
    // toRoman always produces canonical strings, so the roundtrip should be stable.
    for (const n of [4, 9, 14, 40, 90, 400, 900, 1994, 3999]) {
      const roman = toRoman(n);
      assert.equal(toRoman(fromRoman(roman)), roman, `canonical form failed for ${n}`);
    }
  });
});

// ─── isValidRoman ─────────────────────────────────────────────────────────────

describe('isValidRoman', () => {
  it('returns true for "VIII"', () => {
    assert.equal(isValidRoman('VIII'), true);
  });

  it('returns true for other valid strings', () => {
    assert.equal(isValidRoman('I'), true);
    assert.equal(isValidRoman('IV'), true);
    assert.equal(isValidRoman('MCMXCIV'), true);
    assert.equal(isValidRoman('MMMCMXCIX'), true);
  });

  it('returns false for "IIII" (invalid pattern)', () => {
    assert.equal(isValidRoman('IIII'), false);
  });

  it('returns false for "MMMM" (exceeds 3999)', () => {
    assert.equal(isValidRoman('MMMM'), false);
  });

  it('returns false for strings with unknown characters', () => {
    assert.equal(isValidRoman('ABC'), false);
    assert.equal(isValidRoman('XIIZ'), false);
  });

  it('returns false for an empty string', () => {
    assert.equal(isValidRoman(''), false);
  });

  it('returns false for other invalid patterns', () => {
    assert.equal(isValidRoman('VV'), false);
    assert.equal(isValidRoman('IIX'), false);
    assert.equal(isValidRoman('IM'), false);
  });
});

// ─── romanAdd ────────────────────────────────────────────────────────────────

describe('romanAdd', () => {
  it('"III" + "IV" = "VII"', () => {
    assert.equal(romanAdd('III', 'IV'), 'VII');
  });

  it('"I" + "I" = "II"', () => {
    assert.equal(romanAdd('I', 'I'), 'II');
  });

  it('"M" + "M" = "MM"', () => {
    assert.equal(romanAdd('M', 'M'), 'MM');
  });

  it('"MCMXCIX" + "I" = "MM"', () => {
    assert.equal(romanAdd('MCMXCIX', 'I'), 'MM');
  });

  it('throws RangeError when sum exceeds 3999', () => {
    assert.throws(() => romanAdd('MMMCMXCIX', 'I'), RangeError);
  });

  it('throws for invalid Roman numeral inputs', () => {
    assert.throws(() => romanAdd('IIII', 'I'), Error);
    assert.throws(() => romanAdd('III', ''), Error);
  });
});

// ─── romanCompare ─────────────────────────────────────────────────────────────

describe('romanCompare', () => {
  it('"V" > "IV" (positive result)', () => {
    assert.ok(romanCompare('V', 'IV') > 0);
  });

  it('"X" > "V" (positive result)', () => {
    assert.ok(romanCompare('X', 'V') > 0);
  });

  it('"I" < "II" (negative result)', () => {
    assert.ok(romanCompare('I', 'II') < 0);
  });

  it('equal numerals return 0', () => {
    assert.equal(romanCompare('X', 'X'), 0);
    assert.equal(romanCompare('MCMXCIV', 'MCMXCIV'), 0);
  });

  it('can be used to sort an array of Roman numerals', () => {
    const numerals = ['X', 'I', 'V', 'L', 'C'];
    const sorted = [...numerals].sort(romanCompare);
    assert.deepEqual(sorted, ['I', 'V', 'X', 'L', 'C']);
  });

  it('throws for invalid Roman numeral inputs', () => {
    assert.throws(() => romanCompare('IIII', 'I'), Error);
    assert.throws(() => romanCompare('I', ''), Error);
  });
});
