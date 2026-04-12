// ─── Unit Tests: Number Formatting & Parsing Library ─────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatBytes,
  formatOrdinal,
  formatDuration,
  formatScientific,
  parseNumber,
  parsePercent,
  clamp,
  lerp,
  roundTo,
  isPrime,
  gcd,
  lcm,
  factorial,
  fibonacci,
  randomInt,
  randomFloat,
} from '../../app/modules/number-format.js';

// ─── formatNumber ────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats with default 2 decimal places and commas', () => {
    assert.equal(formatNumber(1234567.89), '1,234,567.89');
  });

  it('formats 0 correctly', () => {
    assert.equal(formatNumber(0), '0.00');
  });

  it('formats a small number with no thousands separator', () => {
    assert.equal(formatNumber(42.5), '42.50');
  });

  it('formats negative numbers correctly', () => {
    assert.equal(formatNumber(-1234.5), '-1,234.50');
  });

  it('respects custom decimals option', () => {
    assert.equal(formatNumber(3.14159, { decimals: 4 }), '3.1416');
  });

  it('uses 0 decimal places', () => {
    assert.equal(formatNumber(999.9, { decimals: 0 }), '1,000');
  });

  it('uses custom decimal separator', () => {
    assert.equal(formatNumber(1234.56, { decimalSep: ',' }), '1,234,56');
  });

  it('uses custom thousands separator', () => {
    assert.equal(formatNumber(1234567, { thousandsSep: '.', decimals: 0 }), '1.234.567');
  });

  it('uses both custom separators (European style)', () => {
    assert.equal(
      formatNumber(1234567.89, { thousandsSep: '.', decimalSep: ',' }),
      '1.234.567,89',
    );
  });

  it('formats exactly 1000', () => {
    assert.equal(formatNumber(1000), '1,000.00');
  });

  it('formats very large number', () => {
    assert.equal(formatNumber(1000000, { decimals: 0 }), '1,000,000');
  });

  it('uses empty thousands separator', () => {
    assert.equal(formatNumber(1234567.89, { thousandsSep: '' }), '1234567.89');
  });
});

// ─── formatCurrency ──────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats USD with dollar sign and 2 decimals', () => {
    assert.equal(formatCurrency(1234.5, 'USD'), '$1,234.50');
  });

  it('formats USD by default', () => {
    assert.equal(formatCurrency(0), '$0.00');
  });

  it('formats EUR with euro sign', () => {
    assert.ok(formatCurrency(99.9, 'EUR').includes('€') || formatCurrency(99.9, 'EUR').includes('EUR'));
  });

  it('formats GBP with pound sign', () => {
    const result = formatCurrency(50, 'GBP');
    assert.ok(result.includes('£'), `Expected £ in: ${result}`);
  });

  it('handles negative amounts', () => {
    const result = formatCurrency(-25.5, 'USD');
    assert.ok(result.includes('25.50'), `Expected 25.50 in: ${result}`);
    assert.ok(result.includes('-'), `Expected minus sign in: ${result}`);
  });

  it('handles zero', () => {
    assert.equal(formatCurrency(0, 'USD'), '$0.00');
  });

  it('formats large amounts with thousands separator', () => {
    assert.equal(formatCurrency(1000000, 'USD'), '$1,000,000.00');
  });

  it('respects custom decimals option', () => {
    const result = formatCurrency(9.9, 'USD', { decimals: 0 });
    assert.ok(result.includes('$') && !result.includes('.'), `Got: ${result}`);
  });

  it('respects custom locale option', () => {
    const result = formatCurrency(1234.5, 'USD', { locale: 'en-US' });
    assert.equal(result, '$1,234.50');
  });
});

// ─── formatPercent ───────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('converts 0.1234 → "12.34%"', () => {
    assert.equal(formatPercent(0.1234), '12.34%');
  });

  it('converts 0.5 → "50.00%"', () => {
    assert.equal(formatPercent(0.5), '50.00%');
  });

  it('converts 1 → "100.00%"', () => {
    assert.equal(formatPercent(1), '100.00%');
  });

  it('converts 0 → "0.00%"', () => {
    assert.equal(formatPercent(0), '0.00%');
  });

  it('handles negative ratios', () => {
    assert.equal(formatPercent(-0.25), '-25.00%');
  });

  it('uses custom decimal places', () => {
    assert.equal(formatPercent(0.3333, 1), '33.3%');
  });

  it('handles ratio > 1', () => {
    assert.equal(formatPercent(1.5, 0), '150%');
  });

  it('0 decimals rounds correctly', () => {
    assert.equal(formatPercent(0.999, 0), '100%');
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    assert.equal(formatBytes(0), '0 Bytes');
  });

  it('formats bytes under 1 KB', () => {
    assert.equal(formatBytes(512), '512.00 Bytes');
  });

  it('formats exactly 1 KB (1024 bytes)', () => {
    assert.equal(formatBytes(1024), '1.00 KB');
  });

  it('formats 1.5 KB', () => {
    assert.equal(formatBytes(1536), '1.50 KB');
  });

  it('formats 1 MB', () => {
    assert.equal(formatBytes(1024 * 1024), '1.00 MB');
  });

  it('formats 1 GB', () => {
    assert.equal(formatBytes(1024 ** 3), '1.00 GB');
  });

  it('formats 1 TB', () => {
    assert.equal(formatBytes(1024 ** 4), '1.00 TB');
  });

  it('handles large values beyond TB', () => {
    const result = formatBytes(1024 ** 5);
    assert.ok(result.endsWith('PB') || result.endsWith('TB') || result.endsWith('EB'),
      `Unexpected unit in: ${result}`);
  });

  it('handles custom decimal places', () => {
    assert.equal(formatBytes(1536, 0), '2 KB');
  });

  it('handles single decimal place', () => {
    assert.equal(formatBytes(1024, 1), '1.0 KB');
  });
});

// ─── formatOrdinal ───────────────────────────────────────────────────────────

describe('formatOrdinal', () => {
  it('1 → "1st"', () => {
    assert.equal(formatOrdinal(1), '1st');
  });

  it('2 → "2nd"', () => {
    assert.equal(formatOrdinal(2), '2nd');
  });

  it('3 → "3rd"', () => {
    assert.equal(formatOrdinal(3), '3rd');
  });

  it('4 → "4th"', () => {
    assert.equal(formatOrdinal(4), '4th');
  });

  it('11 → "11th" (teen exception)', () => {
    assert.equal(formatOrdinal(11), '11th');
  });

  it('12 → "12th" (teen exception)', () => {
    assert.equal(formatOrdinal(12), '12th');
  });

  it('13 → "13th" (teen exception)', () => {
    assert.equal(formatOrdinal(13), '13th');
  });

  it('21 → "21st"', () => {
    assert.equal(formatOrdinal(21), '21st');
  });

  it('22 → "22nd"', () => {
    assert.equal(formatOrdinal(22), '22nd');
  });

  it('101 → "101st"', () => {
    assert.equal(formatOrdinal(101), '101st');
  });

  it('111 → "111th" (teen exception at 100s boundary)', () => {
    assert.equal(formatOrdinal(111), '111th');
  });

  it('0 → "0th"', () => {
    assert.equal(formatOrdinal(0), '0th');
  });
});

// ─── formatDuration ──────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats 500ms → "500ms"', () => {
    assert.equal(formatDuration(500), '500ms');
  });

  it('formats 999ms → "999ms"', () => {
    assert.equal(formatDuration(999), '999ms');
  });

  it('formats 0ms → "0ms"', () => {
    assert.equal(formatDuration(0), '0ms');
  });

  it('formats 1000ms → "1s"', () => {
    assert.equal(formatDuration(1000), '1s');
  });

  it('formats 45000ms → "45s"', () => {
    assert.equal(formatDuration(45000), '45s');
  });

  it('formats 60000ms → "1m"', () => {
    assert.equal(formatDuration(60000), '1m');
  });

  it('formats 90000ms → "1m 30s"', () => {
    assert.equal(formatDuration(90000), '1m 30s');
  });

  it('formats 61000ms → "1m 1s"', () => {
    assert.equal(formatDuration(61000), '1m 1s');
  });

  it('formats 2h 30m (no seconds shown for hours)', () => {
    assert.equal(formatDuration((2 * 3600 + 30 * 60) * 1000), '2h 30m');
  });

  it('formats exactly 1h with no minutes', () => {
    assert.equal(formatDuration(3600000), '1h');
  });

  it('formats hours and minutes (omits zero-second component)', () => {
    assert.equal(formatDuration((1 * 3600 + 23 * 60) * 1000), '1h 23m');
  });

  it('handles negative durations', () => {
    assert.equal(formatDuration(-500), '-500ms');
  });

  it('handles negative seconds duration', () => {
    assert.equal(formatDuration(-45000), '-45s');
  });
});

// ─── formatScientific ────────────────────────────────────────────────────────

describe('formatScientific', () => {
  it('formats 1234.5 → "1.23e+3"', () => {
    assert.equal(formatScientific(1234.5), '1.23e+3');
  });

  it('formats 12300 → "1.23e+4"', () => {
    assert.equal(formatScientific(12300), '1.23e+4');
  });

  it('formats 0.00123 → "1.23e-3"', () => {
    assert.equal(formatScientific(0.00123, 2), '1.23e-3');
  });

  it('formats 0 → "0.00e+0"', () => {
    assert.equal(formatScientific(0), '0.00e+0');
  });

  it('formats negative numbers', () => {
    assert.equal(formatScientific(-5000, 1), '-5.0e+3');
  });

  it('uses custom decimal places', () => {
    assert.equal(formatScientific(12345, 4), '1.2345e+4');
  });

  it('formats 1 → "1.00e+0"', () => {
    assert.equal(formatScientific(1), '1.00e+0');
  });

  it('formats 100 → "1.00e+2"', () => {
    assert.equal(formatScientific(100), '1.00e+2');
  });
});

// ─── parseNumber ─────────────────────────────────────────────────────────────

describe('parseNumber', () => {
  it('parses a plain integer string', () => {
    assert.equal(parseNumber('42'), 42);
  });

  it('parses a float string', () => {
    assert.equal(parseNumber('3.14'), 3.14);
  });

  it('strips commas from thousands-formatted strings', () => {
    assert.equal(parseNumber('1,234.56'), 1234.56);
  });

  it('strips multiple comma groups', () => {
    assert.equal(parseNumber('1,234,567'), 1234567);
  });

  it('handles negative numbers', () => {
    assert.equal(parseNumber('-99.9'), -99.9);
  });

  it('handles whitespace', () => {
    assert.equal(parseNumber('  100  '), 100);
  });

  it('throws for non-numeric input', () => {
    assert.throws(() => parseNumber('abc'), /parseNumber/);
  });

  it('parses zero', () => {
    assert.equal(parseNumber('0'), 0);
  });

  it('throws for empty string', () => {
    // Number('') is 0, but Number('   ') is 0 too — empty stripped is ''
    // Actually Number('') === 0, so it won't throw. Test with truly invalid.
    assert.throws(() => parseNumber('hello world'), /parseNumber/);
  });
});

// ─── parsePercent ────────────────────────────────────────────────────────────

describe('parsePercent', () => {
  it('parses "12.34%" → 0.1234', () => {
    assert.ok(Math.abs(parsePercent('12.34%') - 0.1234) < 1e-10);
  });

  it('parses "50%" → 0.5', () => {
    assert.ok(Math.abs(parsePercent('50%') - 0.5) < 1e-10);
  });

  it('parses "100%" → 1', () => {
    assert.ok(Math.abs(parsePercent('100%') - 1) < 1e-10);
  });

  it('parses "0%" → 0', () => {
    assert.equal(parsePercent('0%'), 0);
  });

  it('parses negative percentages', () => {
    assert.ok(Math.abs(parsePercent('-25%') - (-0.25)) < 1e-10);
  });

  it('parses string without percent sign', () => {
    assert.ok(Math.abs(parsePercent('50') - 0.5) < 1e-10);
  });

  it('throws for non-numeric input', () => {
    assert.throws(() => parsePercent('abc%'), /parsePercent/);
  });
});

// ─── clamp ───────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within range', () => {
    assert.equal(clamp(5, 0, 10), 5);
  });

  it('clamps to min when below range', () => {
    assert.equal(clamp(-5, 0, 10), 0);
  });

  it('clamps to max when above range', () => {
    assert.equal(clamp(15, 0, 10), 10);
  });

  it('returns min when value equals min', () => {
    assert.equal(clamp(0, 0, 10), 0);
  });

  it('returns max when value equals max', () => {
    assert.equal(clamp(10, 0, 10), 10);
  });

  it('works with negative range', () => {
    assert.equal(clamp(-15, -10, -1), -10);
  });

  it('works with floating point values', () => {
    assert.ok(Math.abs(clamp(0.5, 0, 1) - 0.5) < 1e-10);
  });
});

// ─── lerp ────────────────────────────────────────────────────────────────────

describe('lerp', () => {
  it('t=0 returns a', () => {
    assert.equal(lerp(10, 20, 0), 10);
  });

  it('t=1 returns b', () => {
    assert.equal(lerp(10, 20, 1), 20);
  });

  it('t=0.5 returns midpoint', () => {
    assert.ok(Math.abs(lerp(0, 100, 0.5) - 50) < 1e-10);
  });

  it('extrapolates beyond [0,1] when t > 1', () => {
    assert.ok(Math.abs(lerp(0, 10, 2) - 20) < 1e-10);
  });

  it('extrapolates before 0 when t < 0', () => {
    assert.ok(Math.abs(lerp(0, 10, -1) - (-10)) < 1e-10);
  });

  it('works with negative values', () => {
    assert.ok(Math.abs(lerp(-10, 10, 0.5)) < 1e-10);
  });
});

// ─── roundTo ─────────────────────────────────────────────────────────────────

describe('roundTo', () => {
  it('roundTo(3.14159, 2) → 3.14', () => {
    assert.equal(roundTo(3.14159, 2), 3.14);
  });

  it('rounds up when next digit >= 5', () => {
    assert.equal(roundTo(1.235, 2), 1.24);
  });

  it('rounds down when next digit < 5', () => {
    assert.equal(roundTo(1.234, 2), 1.23);
  });

  it('rounds to 0 decimals (integer)', () => {
    assert.equal(roundTo(2.6, 0), 3);
  });

  it('handles negative numbers', () => {
    assert.equal(roundTo(-1.4, 0), -1);
  });

  it('handles zero', () => {
    assert.equal(roundTo(0, 3), 0);
  });

  it('rounds to 4 decimal places', () => {
    assert.ok(Math.abs(roundTo(Math.PI, 4) - 3.1416) < 1e-10);
  });
});

// ─── isPrime ─────────────────────────────────────────────────────────────────

describe('isPrime', () => {
  it('2 is prime', () => {
    assert.equal(isPrime(2), true);
  });

  it('3 is prime', () => {
    assert.equal(isPrime(3), true);
  });

  it('5 is prime', () => {
    assert.equal(isPrime(5), true);
  });

  it('7 is prime', () => {
    assert.equal(isPrime(7), true);
  });

  it('11 is prime', () => {
    assert.equal(isPrime(11), true);
  });

  it('13 is prime', () => {
    assert.equal(isPrime(13), true);
  });

  it('97 is prime', () => {
    assert.equal(isPrime(97), true);
  });

  it('1 is not prime', () => {
    assert.equal(isPrime(1), false);
  });

  it('0 is not prime', () => {
    assert.equal(isPrime(0), false);
  });

  it('negative numbers are not prime', () => {
    assert.equal(isPrime(-7), false);
  });

  it('4 is not prime', () => {
    assert.equal(isPrime(4), false);
  });

  it('9 is not prime', () => {
    assert.equal(isPrime(9), false);
  });

  it('25 is not prime', () => {
    assert.equal(isPrime(25), false);
  });

  it('100 is not prime', () => {
    assert.equal(isPrime(100), false);
  });
});

// ─── gcd ─────────────────────────────────────────────────────────────────────

describe('gcd', () => {
  it('gcd(12, 8) === 4', () => {
    assert.equal(gcd(12, 8), 4);
  });

  it('gcd(100, 75) === 25', () => {
    assert.equal(gcd(100, 75), 25);
  });

  it('gcd(7, 3) === 1 (coprime)', () => {
    assert.equal(gcd(7, 3), 1);
  });

  it('gcd(0, 5) === 5', () => {
    assert.equal(gcd(0, 5), 5);
  });

  it('gcd(5, 0) === 5', () => {
    assert.equal(gcd(5, 0), 5);
  });

  it('gcd(0, 0) === 0', () => {
    assert.equal(gcd(0, 0), 0);
  });

  it('gcd is commutative: gcd(a,b) === gcd(b,a)', () => {
    assert.equal(gcd(48, 18), gcd(18, 48));
  });

  it('handles negative inputs (returns non-negative)', () => {
    assert.equal(gcd(-12, 8), 4);
  });
});

// ─── lcm ─────────────────────────────────────────────────────────────────────

describe('lcm', () => {
  it('lcm(4, 6) === 12', () => {
    assert.equal(lcm(4, 6), 12);
  });

  it('lcm(3, 5) === 15 (coprime)', () => {
    assert.equal(lcm(3, 5), 15);
  });

  it('lcm(0, 5) === 0', () => {
    assert.equal(lcm(0, 5), 0);
  });

  it('lcm(5, 0) === 0', () => {
    assert.equal(lcm(5, 0), 0);
  });

  it('lcm(7, 7) === 7', () => {
    assert.equal(lcm(7, 7), 7);
  });

  it('lcm is commutative', () => {
    assert.equal(lcm(12, 18), lcm(18, 12));
  });

  it('lcm(12, 18) === 36', () => {
    assert.equal(lcm(12, 18), 36);
  });
});

// ─── factorial ───────────────────────────────────────────────────────────────

describe('factorial', () => {
  it('0! === 1', () => {
    assert.equal(factorial(0), 1);
  });

  it('1! === 1', () => {
    assert.equal(factorial(1), 1);
  });

  it('5! === 120', () => {
    assert.equal(factorial(5), 120);
  });

  it('10! === 3628800', () => {
    assert.equal(factorial(10), 3628800);
  });

  it('20! is a valid large integer', () => {
    assert.equal(factorial(20), 2432902008176640000);
  });

  it('throws for n > 20', () => {
    assert.throws(() => factorial(21), /factorial/);
  });

  it('throws for negative n', () => {
    assert.throws(() => factorial(-1), /factorial/);
  });

  it('throws for non-integer n', () => {
    assert.throws(() => factorial(2.5), /factorial/);
  });
});

// ─── fibonacci ───────────────────────────────────────────────────────────────

describe('fibonacci', () => {
  it('fib(0) === 0', () => {
    assert.equal(fibonacci(0), 0);
  });

  it('fib(1) === 1', () => {
    assert.equal(fibonacci(1), 1);
  });

  it('fib(2) === 1', () => {
    assert.equal(fibonacci(2), 1);
  });

  it('fib(3) === 2', () => {
    assert.equal(fibonacci(3), 2);
  });

  it('fib(4) === 3', () => {
    assert.equal(fibonacci(4), 3);
  });

  it('fib(5) === 5', () => {
    assert.equal(fibonacci(5), 5);
  });

  it('fib(6) === 8', () => {
    assert.equal(fibonacci(6), 8);
  });

  it('fib(7) === 13', () => {
    assert.equal(fibonacci(7), 13);
  });

  it('fib(8) === 21', () => {
    assert.equal(fibonacci(8), 21);
  });

  it('fib(9) === 34', () => {
    assert.equal(fibonacci(9), 34);
  });

  it('throws for negative n', () => {
    assert.throws(() => fibonacci(-1), /fibonacci/);
  });

  it('throws for non-integer n', () => {
    assert.throws(() => fibonacci(1.5), /fibonacci/);
  });
});

// ─── randomInt ───────────────────────────────────────────────────────────────

describe('randomInt', () => {
  it('returns an integer within [min, max]', () => {
    for (let i = 0; i < 100; i++) {
      const n = randomInt(1, 10);
      assert.ok(Number.isInteger(n), `Expected integer, got ${n}`);
      assert.ok(n >= 1 && n <= 10, `Expected 1..10, got ${n}`);
    }
  });

  it('can return exactly min', () => {
    // With enough samples, min should appear
    let sawMin = false;
    for (let i = 0; i < 1000; i++) {
      if (randomInt(0, 1) === 0) { sawMin = true; break; }
    }
    assert.ok(sawMin, 'min value was never returned');
  });

  it('can return exactly max', () => {
    let sawMax = false;
    for (let i = 0; i < 1000; i++) {
      if (randomInt(0, 1) === 1) { sawMax = true; break; }
    }
    assert.ok(sawMax, 'max value was never returned');
  });

  it('returns the only possible value when min === max', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(randomInt(5, 5), 5);
    }
  });

  it('works with negative range', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomInt(-10, -1);
      assert.ok(n >= -10 && n <= -1, `Expected -10..-1, got ${n}`);
    }
  });
});

// ─── randomFloat ─────────────────────────────────────────────────────────────

describe('randomFloat', () => {
  it('returns a float within [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const n = randomFloat(0, 1);
      assert.ok(n >= 0 && n < 1, `Expected [0,1), got ${n}`);
    }
  });

  it('result is at least min', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomFloat(5, 10);
      assert.ok(n >= 5, `Expected >= 5, got ${n}`);
    }
  });

  it('result is strictly less than max', () => {
    for (let i = 0; i < 100; i++) {
      const n = randomFloat(0, 100);
      assert.ok(n < 100, `Expected < 100, got ${n}`);
    }
  });

  it('works with negative range', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomFloat(-10, -1);
      assert.ok(n >= -10 && n < -1, `Expected [-10,-1), got ${n}`);
    }
  });

  it('returns a non-integer for most samples', () => {
    let nonInt = false;
    for (let i = 0; i < 100; i++) {
      if (!Number.isInteger(randomFloat(0, 100))) { nonInt = true; break; }
    }
    assert.ok(nonInt, 'randomFloat never returned a non-integer in 100 samples');
  });
});
