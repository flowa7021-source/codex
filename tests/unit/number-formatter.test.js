// ─── Unit Tests: Number Formatter ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatBytes,
  formatCompact,
  parseLocalizedNumber,
} from '../../app/modules/number-formatter.js';

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('returns a string', () => {
    const result = formatNumber(1234, undefined, 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('formats an integer with thousands separator in en-US', () => {
    const result = formatNumber(1234567, undefined, 'en-US');
    assert.equal(result, '1,234,567');
  });

  it('formats a decimal number', () => {
    const result = formatNumber(1234.56, { minimumFractionDigits: 2 }, 'en-US');
    assert.equal(result, '1,234.56');
  });

  it('respects locale differences', () => {
    const en = formatNumber(1234.5, undefined, 'en-US');
    const de = formatNumber(1234.5, undefined, 'de-DE');
    assert.notEqual(en, de);
  });

  it('formats zero', () => {
    const result = formatNumber(0, undefined, 'en-US');
    assert.equal(result, '0');
  });

  it('formats negative numbers', () => {
    const result = formatNumber(-42, undefined, 'en-US');
    assert.ok(result.includes('42'));
    assert.ok(result.startsWith('-') || result.includes('−'));
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('returns a string', () => {
    const result = formatCurrency(1234.56, 'USD', 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('includes the USD currency symbol', () => {
    const result = formatCurrency(1234.56, 'USD', 'en-US');
    assert.ok(result.includes('$'), `expected '$' in "${result}"`);
  });

  it('includes the numeric value', () => {
    const result = formatCurrency(1234.56, 'USD', 'en-US');
    assert.ok(result.includes('1,234.56'), `expected '1,234.56' in "${result}"`);
  });

  it('formats EUR currency', () => {
    const result = formatCurrency(99.99, 'EUR', 'de-DE');
    // de-DE EUR: "99,99 €"
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
  it('returns a string with %', () => {
    const result = formatPercent(50, 0, 'en-US');
    assert.ok(result.includes('%'), `expected '%' in "${result}"`);
  });

  it('converts 50 → "50%"', () => {
    const result = formatPercent(50, 0, 'en-US');
    assert.equal(result, '50%');
  });

  it('converts 0 → "0%"', () => {
    const result = formatPercent(0, 0, 'en-US');
    assert.equal(result, '0%');
  });

  it('converts 100 → "100%"', () => {
    const result = formatPercent(100, 0, 'en-US');
    assert.equal(result, '100%');
  });

  it('rounds decimals when decimals=0 (default)', () => {
    const result = formatPercent(33.3, 0, 'en-US');
    assert.equal(result, '33%');
  });

  it('respects decimal places when provided', () => {
    const result = formatPercent(33.3, 1, 'en-US');
    assert.ok(result.includes('33.3'), `expected '33.3' in "${result}"`);
    assert.ok(result.includes('%'));
  });

  it('returns a string when decimals is omitted', () => {
    const result = formatPercent(75, undefined, 'en-US');
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('%'));
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    assert.equal(formatBytes(0, 'en-US'), '0 B');
  });

  it('formats bytes under 1 KB', () => {
    assert.equal(formatBytes(1023, 'en-US'), '1,023 B');
  });

  it('formats exactly 1 KB', () => {
    assert.equal(formatBytes(1024, 'en-US'), '1 KB');
  });

  it('formats exactly 1 MB (1048576 bytes)', () => {
    assert.equal(formatBytes(1048576, 'en-US'), '1 MB');
  });

  it('formats exactly 1 GB (1073741824 bytes)', () => {
    assert.equal(formatBytes(1073741824, 'en-US'), '1 GB');
  });

  it('formats 1.5 KB', () => {
    const result = formatBytes(1536, 'en-US');
    assert.ok(result.includes('KB'), `expected 'KB' in "${result}"`);
    assert.ok(result.includes('1.5'), `expected '1.5' in "${result}"`);
  });

  it('formats 1.5 MB', () => {
    const result = formatBytes(1572864, 'en-US');
    assert.ok(result.includes('MB'), `expected 'MB' in "${result}"`);
    assert.ok(result.includes('1.5'), `expected '1.5' in "${result}"`);
  });

  it('formats TB values', () => {
    const result = formatBytes(1099511627776, 'en-US'); // 1 TB
    assert.ok(result.includes('TB'), `expected 'TB' in "${result}"`);
    assert.ok(result.includes('1'), `expected '1' in "${result}"`);
  });
});

// ─── formatCompact ────────────────────────────────────────────────────────────

describe('formatCompact', () => {
  it('returns a string', () => {
    const result = formatCompact(1234567, 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('compacts large numbers', () => {
    const result = formatCompact(1234567, 'en-US');
    // Should be something like "1.2M" — much shorter than the full number
    assert.ok(result.length < String(1234567).length, `expected compact form, got "${result}"`);
    assert.ok(result.toUpperCase().includes('M'), `expected 'M' suffix in "${result}"`);
  });

  it('compacts thousands', () => {
    const result = formatCompact(5000, 'en-US');
    assert.ok(result.toUpperCase().includes('K'), `expected 'K' suffix in "${result}"`);
  });

  it('small numbers are not compacted unexpectedly', () => {
    const result = formatCompact(42, 'en-US');
    assert.ok(result.includes('42'), `expected '42' in "${result}"`);
  });

  it('formats billion-scale numbers', () => {
    const result = formatCompact(1_000_000_000, 'en-US');
    assert.ok(result.toUpperCase().includes('B'), `expected 'B' suffix in "${result}"`);
  });
});

// ─── parseLocalizedNumber ─────────────────────────────────────────────────────

describe('parseLocalizedNumber', () => {
  it('parses a standard en-US number string', () => {
    const result = parseLocalizedNumber('1,234.56', 'en-US');
    assert.equal(result, 1234.56);
  });

  it('parses an integer string', () => {
    const result = parseLocalizedNumber('42', 'en-US');
    assert.equal(result, 42);
  });

  it('parses zero', () => {
    const result = parseLocalizedNumber('0', 'en-US');
    assert.equal(result, 0);
  });

  it('returns NaN for a non-numeric string', () => {
    const result = parseLocalizedNumber('not-a-number', 'en-US');
    assert.ok(Number.isNaN(result), `expected NaN, got ${result}`);
  });

  it('handles a number without group separator', () => {
    const result = parseLocalizedNumber('1234.56', 'en-US');
    assert.equal(result, 1234.56);
  });

  it('round-trips formatNumber → parseLocalizedNumber', () => {
    const original = 9876543.21;
    const formatted = formatNumber(original, { minimumFractionDigits: 2 }, 'en-US');
    const parsed = parseLocalizedNumber(formatted, 'en-US');
    assert.ok(Math.abs(parsed - original) < 0.01, `expected ~${original}, got ${parsed}`);
  });
});
