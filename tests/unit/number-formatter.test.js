// ─── Unit Tests: Number Formatter ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatCompact,
  parseFormattedNumber,
  formatBytes,
  clampNumber,
  roundDecimal,
  isNumeric,
  toOrdinal,
} from '../../app/modules/number-formatter.js';

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats a basic number with default options', () => {
    assert.equal(formatNumber(1234567.891), '1,234,567.89');
  });

  it('formats zero', () => {
    assert.equal(formatNumber(0), '0.00');
  });

  it('formats a negative number', () => {
    assert.equal(formatNumber(-1234), '-1,234.00');
  });

  it('respects decimals option', () => {
    assert.equal(formatNumber(1234.5678, { decimals: 3 }), '1,234.568');
  });

  it('respects decimals: 0', () => {
    assert.equal(formatNumber(1234.9, { decimals: 0 }), '1,235');
  });

  it('uses custom thousands separator', () => {
    assert.equal(formatNumber(1234567, { thousands: '.', decimal: ',', decimals: 2 }), '1.234.567,00');
  });

  it('adds prefix', () => {
    assert.equal(formatNumber(42, { prefix: '$', decimals: 2 }), '$42.00');
  });

  it('adds suffix', () => {
    assert.equal(formatNumber(12.5, { suffix: '%', decimals: 1 }), '12.5%');
  });

  it('handles no thousands separator when thousands is empty string', () => {
    assert.equal(formatNumber(1234567, { thousands: '', decimals: 0 }), '1234567');
  });

  it('formats small numbers correctly', () => {
    assert.equal(formatNumber(0.5, { decimals: 2 }), '0.50');
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('includes the $ symbol for USD', () => {
    const result = formatCurrency(1234.56, 'USD', 'en-US');
    assert.ok(result.includes('$'), `expected '$' in "${result}"`);
  });

  it('includes the numeric value', () => {
    const result = formatCurrency(1234.56, 'USD', 'en-US');
    assert.ok(result.includes('1,234.56'), `expected '1,234.56' in "${result}"`);
  });

  it('defaults to USD and en-US', () => {
    const result = formatCurrency(100);
    assert.ok(result.includes('$'));
    assert.ok(result.includes('100'));
  });

  it('formats EUR currency', () => {
    const result = formatCurrency(99.99, 'EUR', 'de-DE');
    assert.ok(result.includes('€') || result.includes('EUR'), `expected EUR symbol in "${result}"`);
  });

  it('formats zero value', () => {
    const result = formatCurrency(0, 'USD', 'en-US');
    assert.ok(result.includes('$'));
    assert.ok(result.includes('0'));
  });
});

// ─── formatPercent ────────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('formats 12.5 as "12.50%"', () => {
    assert.equal(formatPercent(12.5), '12.50%');
  });

  it('formats 0 as "0.00%"', () => {
    assert.equal(formatPercent(0), '0.00%');
  });

  it('formats 100 as "100.00%"', () => {
    assert.equal(formatPercent(100), '100.00%');
  });

  it('respects decimals parameter', () => {
    assert.equal(formatPercent(33.333, 1), '33.3%');
  });

  it('decimals: 0 gives no decimal part', () => {
    assert.equal(formatPercent(50, 0), '50%');
  });

  it('always appends % sign', () => {
    const result = formatPercent(75);
    assert.ok(result.endsWith('%'));
  });
});

// ─── formatCompact ────────────────────────────────────────────────────────────

describe('formatCompact', () => {
  it('1000 → "1K"', () => {
    assert.equal(formatCompact(1000), '1K');
  });

  it('1500 → "1.5K"', () => {
    assert.equal(formatCompact(1500), '1.5K');
  });

  it('1000000 → "1M"', () => {
    assert.equal(formatCompact(1000000), '1M');
  });

  it('1000000000 → "1B"', () => {
    assert.equal(formatCompact(1000000000), '1B');
  });

  it('1000000000000 → "1T"', () => {
    assert.equal(formatCompact(1000000000000), '1T');
  });

  it('values < 1000 are returned as-is (formatted with decimals)', () => {
    assert.equal(formatCompact(999), '999');
  });

  it('respects decimals parameter', () => {
    assert.equal(formatCompact(1234567, 2), '1.23M');
  });

  it('handles negative numbers', () => {
    const result = formatCompact(-1500);
    assert.ok(result.includes('-') && result.includes('K'));
  });
});

// ─── parseFormattedNumber ─────────────────────────────────────────────────────

describe('parseFormattedNumber', () => {
  it('"1,234.56" → 1234.56', () => {
    assert.equal(parseFormattedNumber('1,234.56'), 1234.56);
  });

  it('"$1,234.56" → 1234.56', () => {
    assert.equal(parseFormattedNumber('$1,234.56'), 1234.56);
  });

  it('"1234.56" (no commas) → 1234.56', () => {
    assert.equal(parseFormattedNumber('1234.56'), 1234.56);
  });

  it('"42" → 42', () => {
    assert.equal(parseFormattedNumber('42'), 42);
  });

  it('"0.00" → 0', () => {
    assert.equal(parseFormattedNumber('0.00'), 0);
  });

  it('handles negative numbers: "-1,234.56" → -1234.56', () => {
    assert.equal(parseFormattedNumber('-1,234.56'), -1234.56);
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('0 bytes → "0 Bytes"', () => {
    assert.equal(formatBytes(0), '0 Bytes');
  });

  it('1024 → "1 KB"', () => {
    assert.equal(formatBytes(1024), '1 KB');
  });

  it('1048576 → "1 MB"', () => {
    assert.equal(formatBytes(1048576), '1 MB');
  });

  it('1073741824 → "1 GB"', () => {
    assert.equal(formatBytes(1073741824), '1 GB');
  });

  it('1099511627776 → "1 TB"', () => {
    assert.equal(formatBytes(1099511627776), '1 TB');
  });

  it('respects decimals parameter', () => {
    const result = formatBytes(1536, 1);
    assert.ok(result.includes('1.5') && result.includes('KB'), `got: ${result}`);
  });

  it('small byte values use "Bytes"', () => {
    const result = formatBytes(512);
    assert.ok(result.includes('Bytes'), `got: ${result}`);
  });
});

// ─── clampNumber ─────────────────────────────────────────────────────────────

describe('clampNumber', () => {
  it('returns value when within range', () => {
    assert.equal(clampNumber(5, 0, 10), 5);
  });

  it('returns min when value < min', () => {
    assert.equal(clampNumber(-5, 0, 10), 0);
  });

  it('returns max when value > max', () => {
    assert.equal(clampNumber(15, 0, 10), 10);
  });

  it('returns min when value equals min', () => {
    assert.equal(clampNumber(0, 0, 10), 0);
  });

  it('returns max when value equals max', () => {
    assert.equal(clampNumber(10, 0, 10), 10);
  });
});

// ─── roundDecimal ─────────────────────────────────────────────────────────────

describe('roundDecimal', () => {
  it('rounds to 2 decimal places', () => {
    assert.equal(roundDecimal(1.2345, 2), 1.23);
  });

  it('rounds up correctly', () => {
    assert.equal(roundDecimal(1.235, 2), 1.24);
  });

  it('rounds to 0 decimal places', () => {
    assert.equal(roundDecimal(1.6, 0), 2);
  });

  it('handles integers', () => {
    assert.equal(roundDecimal(5, 2), 5);
  });

  it('rounds negative numbers', () => {
    assert.equal(roundDecimal(-1.555, 2), -1.55);
  });
});

// ─── isNumeric ────────────────────────────────────────────────────────────────

describe('isNumeric', () => {
  it('returns true for integer string', () => {
    assert.equal(isNumeric('42'), true);
  });

  it('returns true for float string', () => {
    assert.equal(isNumeric('3.14'), true);
  });

  it('returns true for negative number string', () => {
    assert.equal(isNumeric('-7.5'), true);
  });

  it('returns false for non-numeric string', () => {
    assert.equal(isNumeric('abc'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isNumeric(''), false);
  });

  it('returns false for whitespace only', () => {
    assert.equal(isNumeric('   '), false);
  });

  it('returns true for "0"', () => {
    assert.equal(isNumeric('0'), true);
  });
});

// ─── toOrdinal ────────────────────────────────────────────────────────────────

describe('toOrdinal', () => {
  it('1 → "1st"', () => {
    assert.equal(toOrdinal(1), '1st');
  });

  it('2 → "2nd"', () => {
    assert.equal(toOrdinal(2), '2nd');
  });

  it('3 → "3rd"', () => {
    assert.equal(toOrdinal(3), '3rd');
  });

  it('4 → "4th"', () => {
    assert.equal(toOrdinal(4), '4th');
  });

  it('11 → "11th" (special case)', () => {
    assert.equal(toOrdinal(11), '11th');
  });

  it('12 → "12th" (special case)', () => {
    assert.equal(toOrdinal(12), '12th');
  });

  it('13 → "13th" (special case)', () => {
    assert.equal(toOrdinal(13), '13th');
  });

  it('21 → "21st"', () => {
    assert.equal(toOrdinal(21), '21st');
  });

  it('22 → "22nd"', () => {
    assert.equal(toOrdinal(22), '22nd');
  });

  it('23 → "23rd"', () => {
    assert.equal(toOrdinal(23), '23rd');
  });

  it('100 → "100th"', () => {
    assert.equal(toOrdinal(100), '100th');
  });

  it('101 → "101st"', () => {
    assert.equal(toOrdinal(101), '101st');
  });

  it('111 → "111th"', () => {
    assert.equal(toOrdinal(111), '111th');
  });
});
