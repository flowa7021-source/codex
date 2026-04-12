// ─── Unit Tests: number-format ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNumber,
  parseNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
  formatOrdinal,
  toRoman,
  fromRoman,
  clamp,
  lerp,
  roundTo,
  floorTo,
  ceilTo,
  isPrime,
  primeFactors,
  gcd,
  lcm,
  fibonacci,
  factorial,
} from '../../app/modules/number-format.js';

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber - defaults', () => {
  it('formats an integer with default options (no decimals, comma thousands)', () => {
    assert.equal(formatNumber(1000), '1,000');
  });

  it('formats zero', () => {
    assert.equal(formatNumber(0), '0');
  });

  it('formats a number below 1000 with no thousands separator', () => {
    assert.equal(formatNumber(999), '999');
  });

  it('formats a large number with multiple thousands groups', () => {
    assert.equal(formatNumber(1234567), '1,234,567');
  });

  it('rounds to 0 decimals by default', () => {
    assert.equal(formatNumber(1.6), '2');
  });

  it('formats a negative number', () => {
    assert.equal(formatNumber(-1500), '-1,500');
  });
});

describe('formatNumber - decimals option', () => {
  it('formats with 2 decimal places', () => {
    assert.equal(formatNumber(1234.5, { decimals: 2 }), '1,234.50');
  });

  it('rounds correctly at the specified decimal place', () => {
    assert.equal(formatNumber(1.125, { decimals: 2 }), '1.13');
  });

  it('formats with 3 decimal places', () => {
    assert.equal(formatNumber(3.14159, { decimals: 3 }), '3.142');
  });

  it('formats zero with decimals', () => {
    assert.equal(formatNumber(0, { decimals: 2 }), '0.00');
  });
});

describe('formatNumber - custom separators', () => {
  it('uses a period as thousands separator and comma as decimal separator', () => {
    assert.equal(formatNumber(1234567.89, { decimals: 2, thousandsSep: '.', decimalSep: ',' }), '1.234.567,89');
  });

  it('uses space as thousands separator', () => {
    assert.equal(formatNumber(1000000, { thousandsSep: ' ' }), '1 000 000');
  });

  it('uses empty string as thousands separator (no grouping)', () => {
    assert.equal(formatNumber(1234567, { thousandsSep: '' }), '1234567');
  });

  it('handles negative number with custom separators', () => {
    assert.equal(formatNumber(-9999.5, { decimals: 1, thousandsSep: '.', decimalSep: ',' }), '-9.999,5');
  });
});

// ─── parseNumber ─────────────────────────────────────────────────────────────

describe('parseNumber - defaults', () => {
  it('parses a plain integer string', () => {
    assert.equal(parseNumber('42'), 42);
  });

  it('parses a number with comma thousands separator', () => {
    assert.equal(parseNumber('1,234,567'), 1234567);
  });

  it('parses a decimal number', () => {
    assert.equal(parseNumber('3.14'), 3.14);
  });

  it('parses a formatted number with thousands and decimals', () => {
    assert.equal(parseNumber('1,234.56'), 1234.56);
  });

  it('parses a negative number', () => {
    assert.equal(parseNumber('-1,500'), -1500);
  });

  it('returns NaN for invalid input', () => {
    assert.ok(isNaN(parseNumber('abc')));
  });
});

describe('parseNumber - custom separators', () => {
  it('parses European format (dot thousands, comma decimal)', () => {
    assert.equal(parseNumber('1.234,56', { thousandsSep: '.', decimalSep: ',' }), 1234.56);
  });

  it('parses with space thousands separator', () => {
    assert.equal(parseNumber('1 000 000', { thousandsSep: ' ' }), 1000000);
  });

  it('round-trips formatNumber → parseNumber', () => {
    const original = 1234567.89;
    const formatted = formatNumber(original, { decimals: 2 });
    assert.equal(parseNumber(formatted), original);
  });

  it('round-trips European format', () => {
    const original = 9876.54;
    const opts = { decimals: 2, thousandsSep: '.', decimalSep: ',' };
    const formatted = formatNumber(original, opts);
    assert.equal(parseNumber(formatted, { thousandsSep: '.', decimalSep: ',' }), original);
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency - defaults', () => {
  it('formats with default dollar symbol before', () => {
    assert.equal(formatCurrency(1234.5), '$1,234.50');
  });

  it('formats zero', () => {
    assert.equal(formatCurrency(0), '$0.00');
  });

  it('formats a large amount', () => {
    assert.equal(formatCurrency(1000000), '$1,000,000.00');
  });

  it('formats a negative amount', () => {
    assert.equal(formatCurrency(-99.99), '$-99.99');
  });
});

describe('formatCurrency - options', () => {
  it('uses a custom symbol', () => {
    assert.equal(formatCurrency(10, { symbol: '€' }), '€10.00');
  });

  it('places symbol after when symbolBefore is false', () => {
    assert.equal(formatCurrency(42, { symbol: '£', symbolBefore: false }), '42.00£');
  });

  it('uses custom decimal places', () => {
    assert.equal(formatCurrency(9.9, { decimals: 0 }), '$10');
  });

  it('uses custom symbol and decimals combined', () => {
    assert.equal(formatCurrency(1.5, { symbol: '¥', decimals: 0 }), '¥2');
  });
});

// ─── formatPercent ────────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('formats 0.5 as 50% (no decimals)', () => {
    assert.equal(formatPercent(0.5), '50%');
  });

  it('formats 0.1234 with 1 decimal', () => {
    assert.equal(formatPercent(0.1234, 1), '12.3%');
  });

  it('formats 1.0 as 100%', () => {
    assert.equal(formatPercent(1.0), '100%');
  });

  it('formats 0 as 0%', () => {
    assert.equal(formatPercent(0), '0%');
  });

  it('formats 0.001 with 2 decimals', () => {
    assert.equal(formatPercent(0.001, 2), '0.10%');
  });

  it('formats a value greater than 1', () => {
    assert.equal(formatPercent(1.5), '150%');
  });

  it('formats negative percent', () => {
    assert.equal(formatPercent(-0.25), '-25%');
  });
});

// ─── formatFileSize ───────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes under 1024', () => {
    assert.equal(formatFileSize(500), '500.0 B');
  });

  it('formats exactly 1024 bytes as 1.0 KB', () => {
    assert.equal(formatFileSize(1024), '1.0 KB');
  });

  it('formats 1536 bytes as 1.5 KB', () => {
    assert.equal(formatFileSize(1536), '1.5 KB');
  });

  it('formats megabytes', () => {
    assert.equal(formatFileSize(1024 * 1024 * 2.3, 1), '2.3 MB');
  });

  it('formats gigabytes', () => {
    assert.equal(formatFileSize(1024 * 1024 * 1024), '1.0 GB');
  });

  it('formats terabytes', () => {
    assert.equal(formatFileSize(1024 ** 4), '1.0 TB');
  });

  it('respects custom decimal places', () => {
    assert.equal(formatFileSize(1536, 2), '1.50 KB');
  });

  it('formats zero bytes', () => {
    assert.equal(formatFileSize(0), '0.0 B');
  });
});

// ─── formatOrdinal ────────────────────────────────────────────────────────────

describe('formatOrdinal', () => {
  it('1 → 1st', () => { assert.equal(formatOrdinal(1), '1st'); });
  it('2 → 2nd', () => { assert.equal(formatOrdinal(2), '2nd'); });
  it('3 → 3rd', () => { assert.equal(formatOrdinal(3), '3rd'); });
  it('4 → 4th', () => { assert.equal(formatOrdinal(4), '4th'); });
  it('11 → 11th (teen exception)', () => { assert.equal(formatOrdinal(11), '11th'); });
  it('12 → 12th (teen exception)', () => { assert.equal(formatOrdinal(12), '12th'); });
  it('13 → 13th (teen exception)', () => { assert.equal(formatOrdinal(13), '13th'); });
  it('21 → 21st', () => { assert.equal(formatOrdinal(21), '21st'); });
  it('22 → 22nd', () => { assert.equal(formatOrdinal(22), '22nd'); });
  it('23 → 23rd', () => { assert.equal(formatOrdinal(23), '23rd'); });
  it('100 → 100th', () => { assert.equal(formatOrdinal(100), '100th'); });
  it('101 → 101st', () => { assert.equal(formatOrdinal(101), '101st'); });
  it('111 → 111th (teen exception)', () => { assert.equal(formatOrdinal(111), '111th'); });
  it('0 → 0th', () => { assert.equal(formatOrdinal(0), '0th'); });
});

// ─── toRoman ─────────────────────────────────────────────────────────────────

describe('toRoman', () => {
  it('converts 1 → I', () => { assert.equal(toRoman(1), 'I'); });
  it('converts 4 → IV', () => { assert.equal(toRoman(4), 'IV'); });
  it('converts 9 → IX', () => { assert.equal(toRoman(9), 'IX'); });
  it('converts 14 → XIV', () => { assert.equal(toRoman(14), 'XIV'); });
  it('converts 40 → XL', () => { assert.equal(toRoman(40), 'XL'); });
  it('converts 90 → XC', () => { assert.equal(toRoman(90), 'XC'); });
  it('converts 400 → CD', () => { assert.equal(toRoman(400), 'CD'); });
  it('converts 900 → CM', () => { assert.equal(toRoman(900), 'CM'); });
  it('converts 1994 → MCMXCIV', () => { assert.equal(toRoman(1994), 'MCMXCIV'); });
  it('converts 3999 → MMMCMXCIX', () => { assert.equal(toRoman(3999), 'MMMCMXCIX'); });
  it('converts 2024 → MMXXIV', () => { assert.equal(toRoman(2024), 'MMXXIV'); });

  it('throws RangeError for 0', () => {
    assert.throws(() => toRoman(0), RangeError);
  });

  it('throws RangeError for 4000', () => {
    assert.throws(() => toRoman(4000), RangeError);
  });

  it('throws RangeError for negative numbers', () => {
    assert.throws(() => toRoman(-1), RangeError);
  });

  it('throws RangeError for non-integer', () => {
    assert.throws(() => toRoman(1.5), RangeError);
  });
});

// ─── fromRoman ────────────────────────────────────────────────────────────────

describe('fromRoman', () => {
  it('parses I → 1', () => { assert.equal(fromRoman('I'), 1); });
  it('parses IV → 4', () => { assert.equal(fromRoman('IV'), 4); });
  it('parses IX → 9', () => { assert.equal(fromRoman('IX'), 9); });
  it('parses XIV → 14', () => { assert.equal(fromRoman('XIV'), 14); });
  it('parses MCMXCIV → 1994', () => { assert.equal(fromRoman('MCMXCIV'), 1994); });
  it('parses MMMCMXCIX → 3999', () => { assert.equal(fromRoman('MMMCMXCIX'), 3999); });
  it('parses lowercase input', () => { assert.equal(fromRoman('xiv'), 14); });
  it('parses mixed case input', () => { assert.equal(fromRoman('McM'), 1900); });

  it('throws TypeError for empty string', () => {
    assert.throws(() => fromRoman(''), TypeError);
  });

  it('throws TypeError for invalid characters', () => {
    assert.throws(() => fromRoman('ABC'), TypeError);
  });

  it('throws TypeError for IIII (invalid Roman)', () => {
    assert.throws(() => fromRoman('IIII'), TypeError);
  });

  it('round-trips toRoman → fromRoman for all values 1–20', () => {
    for (let i = 1; i <= 20; i++) {
      assert.equal(fromRoman(toRoman(i)), i);
    }
  });

  it('round-trips toRoman → fromRoman for 1994', () => {
    assert.equal(fromRoman(toRoman(1994)), 1994);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns n when within range', () => {
    assert.equal(clamp(5, 1, 10), 5);
  });

  it('returns min when n is below min', () => {
    assert.equal(clamp(-5, 0, 10), 0);
  });

  it('returns max when n is above max', () => {
    assert.equal(clamp(15, 0, 10), 10);
  });

  it('returns n when n equals min', () => {
    assert.equal(clamp(0, 0, 10), 0);
  });

  it('returns n when n equals max', () => {
    assert.equal(clamp(10, 0, 10), 10);
  });

  it('works with negative range', () => {
    assert.equal(clamp(-5, -10, -1), -5);
  });

  it('works with floating point values', () => {
    assert.equal(clamp(0.5, 0, 1), 0.5);
  });
});

// ─── lerp ─────────────────────────────────────────────────────────────────────

describe('lerp', () => {
  it('returns a when t=0', () => {
    assert.equal(lerp(0, 10, 0), 0);
  });

  it('returns b when t=1', () => {
    assert.equal(lerp(0, 10, 1), 10);
  });

  it('returns midpoint when t=0.5', () => {
    assert.equal(lerp(0, 10, 0.5), 5);
  });

  it('works with negative values', () => {
    assert.equal(lerp(-10, 10, 0.5), 0);
  });

  it('extrapolates when t > 1', () => {
    assert.equal(lerp(0, 10, 2), 20);
  });

  it('extrapolates when t < 0', () => {
    assert.equal(lerp(0, 10, -1), -10);
  });
});

// ─── roundTo / floorTo / ceilTo ───────────────────────────────────────────────

describe('roundTo', () => {
  it('rounds to 0 decimal places', () => {
    assert.equal(roundTo(2.6, 0), 3);
  });

  it('rounds to 2 decimal places', () => {
    assert.equal(roundTo(3.14159, 2), 3.14);
  });

  it('rounds up correctly', () => {
    assert.equal(roundTo(1.125, 2), 1.13);
  });

  it('handles negative numbers', () => {
    assert.equal(roundTo(-1.5, 0), -1);
  });
});

describe('floorTo', () => {
  it('floors to 0 decimal places', () => {
    assert.equal(floorTo(2.9, 0), 2);
  });

  it('floors to 2 decimal places', () => {
    assert.equal(floorTo(3.149, 2), 3.14);
  });

  it('handles negative numbers', () => {
    assert.equal(floorTo(-1.1, 0), -2);
  });
});

describe('ceilTo', () => {
  it('ceils to 0 decimal places', () => {
    assert.equal(ceilTo(2.1, 0), 3);
  });

  it('ceils to 2 decimal places', () => {
    assert.equal(ceilTo(3.141, 2), 3.15);
  });

  it('handles negative numbers', () => {
    assert.equal(ceilTo(-1.9, 0), -1);
  });
});

// ─── isPrime ──────────────────────────────────────────────────────────────────

describe('isPrime', () => {
  it('returns false for 0', () => { assert.equal(isPrime(0), false); });
  it('returns false for 1', () => { assert.equal(isPrime(1), false); });
  it('returns true for 2', () => { assert.equal(isPrime(2), true); });
  it('returns true for 3', () => { assert.equal(isPrime(3), true); });
  it('returns false for 4', () => { assert.equal(isPrime(4), false); });
  it('returns true for 5', () => { assert.equal(isPrime(5), true); });
  it('returns false for 9', () => { assert.equal(isPrime(9), false); });
  it('returns true for 97', () => { assert.equal(isPrime(97), true); });
  it('returns false for 100', () => { assert.equal(isPrime(100), false); });
  it('returns false for negative numbers', () => { assert.equal(isPrime(-7), false); });
  it('returns false for non-integers', () => { assert.equal(isPrime(2.5), false); });
});

// ─── primeFactors ─────────────────────────────────────────────────────────────

describe('primeFactors', () => {
  it('returns [] for 1', () => { assert.deepEqual(primeFactors(1), []); });
  it('returns [2] for 2', () => { assert.deepEqual(primeFactors(2), [2]); });
  it('returns [3] for 3', () => { assert.deepEqual(primeFactors(3), [3]); });
  it('returns [2, 2] for 4', () => { assert.deepEqual(primeFactors(4), [2, 2]); });
  it('returns [2, 3] for 6', () => { assert.deepEqual(primeFactors(6), [2, 3]); });
  it('returns [2, 2, 3] for 12', () => { assert.deepEqual(primeFactors(12), [2, 2, 3]); });
  it('returns [2, 2, 2, 2, 2] for 32', () => { assert.deepEqual(primeFactors(32), [2, 2, 2, 2, 2]); });
  it('returns [13] for prime 13', () => { assert.deepEqual(primeFactors(13), [13]); });
  it('returns [] for 0', () => { assert.deepEqual(primeFactors(0), []); });
  it('returns [] for negative numbers', () => { assert.deepEqual(primeFactors(-12), []); });
});

// ─── gcd ─────────────────────────────────────────────────────────────────────

describe('gcd', () => {
  it('gcd(12, 8) = 4', () => { assert.equal(gcd(12, 8), 4); });
  it('gcd(100, 75) = 25', () => { assert.equal(gcd(100, 75), 25); });
  it('gcd(7, 13) = 1 (coprime)', () => { assert.equal(gcd(7, 13), 1); });
  it('gcd(0, 5) = 5', () => { assert.equal(gcd(0, 5), 5); });
  it('gcd(5, 0) = 5', () => { assert.equal(gcd(5, 0), 5); });
  it('gcd(0, 0) = 0', () => { assert.equal(gcd(0, 0), 0); });
  it('works with negative inputs', () => { assert.equal(gcd(-12, 8), 4); });
});

// ─── lcm ─────────────────────────────────────────────────────────────────────

describe('lcm', () => {
  it('lcm(4, 6) = 12', () => { assert.equal(lcm(4, 6), 12); });
  it('lcm(3, 5) = 15', () => { assert.equal(lcm(3, 5), 15); });
  it('lcm(0, 5) = 0', () => { assert.equal(lcm(0, 5), 0); });
  it('lcm(7, 7) = 7', () => { assert.equal(lcm(7, 7), 7); });
  it('lcm(1, n) = n', () => { assert.equal(lcm(1, 42), 42); });
});

// ─── fibonacci ────────────────────────────────────────────────────────────────

describe('fibonacci', () => {
  it('fibonacci(0) = 0', () => { assert.equal(fibonacci(0), 0); });
  it('fibonacci(1) = 1', () => { assert.equal(fibonacci(1), 1); });
  it('fibonacci(2) = 1', () => { assert.equal(fibonacci(2), 1); });
  it('fibonacci(3) = 2', () => { assert.equal(fibonacci(3), 2); });
  it('fibonacci(7) = 13', () => { assert.equal(fibonacci(7), 13); });
  it('fibonacci(10) = 55', () => { assert.equal(fibonacci(10), 55); });

  it('throws RangeError for negative n', () => {
    assert.throws(() => fibonacci(-1), RangeError);
  });

  it('throws RangeError for non-integer n', () => {
    assert.throws(() => fibonacci(1.5), RangeError);
  });
});

// ─── factorial ────────────────────────────────────────────────────────────────

describe('factorial', () => {
  it('factorial(0) = 1', () => { assert.equal(factorial(0), 1); });
  it('factorial(1) = 1', () => { assert.equal(factorial(1), 1); });
  it('factorial(5) = 120', () => { assert.equal(factorial(5), 120); });
  it('factorial(10) = 3628800', () => { assert.equal(factorial(10), 3628800); });

  it('throws RangeError for negative n', () => {
    assert.throws(() => factorial(-1), RangeError);
  });

  it('throws RangeError for non-integer n', () => {
    assert.throws(() => factorial(2.5), RangeError);
  });
});
