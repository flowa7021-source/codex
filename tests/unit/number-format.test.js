// ─── Unit Tests: Number Formatting & Parsing Utilities ───────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDecimal,
  formatThousands,
  formatCurrency,
  formatPercent,
  formatScientific,
  formatBytes,
  formatDuration,
  formatOrdinal,
  parseNumber,
  clamp,
  lerp,
  roundTo,
  floorTo,
  ceilTo,
  mapRange,
  inRange,
} from '../../app/modules/number-format.js';

// ─── formatDecimal ───────────────────────────────────────────────────────────

describe('formatDecimal', () => {
  it('formats to 2 decimal places by default', () => {
    assert.equal(formatDecimal(3.14159), '3.14');
  });

  it('formats to 0 decimal places', () => {
    assert.equal(formatDecimal(3.7, 0), '4');
  });

  it('formats to 4 decimal places', () => {
    assert.equal(formatDecimal(1.23456789, 4), '1.2346');
  });

  it('pads trailing zeros when value has fewer decimals', () => {
    assert.equal(formatDecimal(1, 3), '1.000');
  });

  it('handles negative numbers', () => {
    assert.equal(formatDecimal(-9.999, 2), '-10.00');
  });

  it('handles zero', () => {
    assert.equal(formatDecimal(0, 2), '0.00');
  });

  it('handles very large numbers', () => {
    assert.equal(formatDecimal(1e9, 0), '1000000000');
  });
});

// ─── formatThousands ─────────────────────────────────────────────────────────

describe('formatThousands', () => {
  it('adds comma separator every three digits', () => {
    assert.equal(formatThousands(1000), '1,000');
  });

  it('handles six-digit numbers', () => {
    assert.equal(formatThousands(1234567), '1,234,567');
  });

  it('uses a custom separator', () => {
    assert.equal(formatThousands(1234567, '.'), '1.234.567');
  });

  it('leaves numbers < 1000 unchanged', () => {
    assert.equal(formatThousands(999), '999');
  });

  it('handles negative numbers', () => {
    assert.equal(formatThousands(-1234567), '-1,234,567');
  });

  it('preserves decimal part', () => {
    assert.equal(formatThousands(1234567.89), '1,234,567.89');
  });

  it('handles zero', () => {
    assert.equal(formatThousands(0), '0');
  });
});

// ─── formatCurrency ──────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats USD with dollar sign and 2 decimals', () => {
    assert.equal(formatCurrency(1234.5), '$1,234.50');
  });

  it('formats EUR with euro sign', () => {
    assert.equal(formatCurrency(99.9, 'EUR'), '€99.90');
  });

  it('formats GBP with pound sign', () => {
    assert.equal(formatCurrency(50, 'GBP'), '£50.00');
  });

  it('formats JPY with no decimal places', () => {
    assert.equal(formatCurrency(1500, 'JPY'), '¥1,500');
  });

  it('handles negative amounts', () => {
    assert.equal(formatCurrency(-25.5, 'USD'), '-$25.50');
  });

  it('handles zero', () => {
    assert.equal(formatCurrency(0, 'USD'), '$0.00');
  });

  it('falls back to the currency code as symbol for unknown currencies', () => {
    const result = formatCurrency(10, 'XYZ');
    assert.ok(result.startsWith('XYZ'), `Expected XYZ prefix, got: ${result}`);
  });

  it('formats large amounts with thousands separator', () => {
    assert.equal(formatCurrency(1000000, 'USD'), '$1,000,000.00');
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
});

// ─── formatScientific ────────────────────────────────────────────────────────

describe('formatScientific', () => {
  it('formats 12300 → "1.23e+4"', () => {
    assert.equal(formatScientific(12300), '1.23e+4');
  });

  it('formats 0.00123 in scientific notation', () => {
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
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    assert.equal(formatBytes(0), '0 B');
  });

  it('formats bytes under 1 KB', () => {
    assert.equal(formatBytes(512), '512.00 B');
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

  it('handles large values beyond TB by capping at TB', () => {
    const result = formatBytes(1024 ** 5);
    assert.ok(result.endsWith('TB'), `Expected TB suffix, got: ${result}`);
  });

  it('handles custom decimal places', () => {
    assert.equal(formatBytes(1536, 0), '2 KB');
  });

  it('handles negative byte counts', () => {
    assert.equal(formatBytes(-1024), '-1.00 KB');
  });
});

// ─── formatDuration ──────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats 0 ms → "0s"', () => {
    assert.equal(formatDuration(0), '0s');
  });

  it('formats 1000 ms → "1s"', () => {
    assert.equal(formatDuration(1000), '1s');
  });

  it('formats 61000 ms → "1m 1s"', () => {
    assert.equal(formatDuration(61000), '1m 1s');
  });

  it('formats 1h 23m 45s', () => {
    const ms = (1 * 3600 + 23 * 60 + 45) * 1000;
    assert.equal(formatDuration(ms), '1h 23m 45s');
  });

  it('formats exactly 1 day', () => {
    assert.equal(formatDuration(86400000), '1d 0h 0m 0s');
  });

  it('always shows seconds even when zero within a larger unit', () => {
    assert.equal(formatDuration(60000), '1m 0s');
  });

  it('omits days and hours when they are zero', () => {
    assert.equal(formatDuration(90000), '1m 30s');
  });

  it('omits hours when zero but shows minutes', () => {
    assert.equal(formatDuration(3661000), '1h 1m 1s');
  });

  it('handles sub-second durations (rounds down to 0s)', () => {
    assert.equal(formatDuration(500), '0s');
  });

  it('handles negative durations', () => {
    assert.equal(formatDuration(-61000), '-1m 1s');
  });

  it('handles multi-day durations', () => {
    const ms = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    assert.equal(formatDuration(ms), '2d 3h 4m 5s');
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
});

// ─── parseNumber ─────────────────────────────────────────────────────────────

describe('parseNumber', () => {
  it('parses a plain integer string', () => {
    assert.equal(parseNumber('42'), 42);
  });

  it('strips commas from thousands-formatted strings', () => {
    assert.equal(parseNumber('1,234,567'), 1234567);
  });

  it('strips percent signs', () => {
    assert.equal(parseNumber('12.5%'), 12.5);
  });

  it('strips both commas and percent', () => {
    assert.equal(parseNumber('1,234.56%'), 1234.56);
  });

  it('handles negative numbers', () => {
    assert.equal(parseNumber('-99.9'), -99.9);
  });

  it('handles whitespace', () => {
    assert.equal(parseNumber('  100  '), 100);
  });

  it('returns NaN for non-numeric input', () => {
    assert.ok(Number.isNaN(parseNumber('abc')));
  });

  it('parses zero', () => {
    assert.equal(parseNumber('0'), 0);
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

// ─── roundTo / floorTo / ceilTo ──────────────────────────────────────────────

describe('roundTo', () => {
  it('rounds 1.235 to 2 decimal places → 1.24', () => {
    assert.equal(roundTo(1.235, 2), 1.24);
  });

  it('rounds down when appropriate', () => {
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
});

describe('floorTo', () => {
  it('floors 1.999 to 2 decimal places → 1.99', () => {
    assert.equal(floorTo(1.999, 2), 1.99);
  });

  it('floors to integer', () => {
    assert.equal(floorTo(2.9, 0), 2);
  });

  it('floors 1.5 to 0 decimals → 1', () => {
    assert.equal(floorTo(1.5, 0), 1);
  });

  it('handles negative numbers', () => {
    assert.equal(floorTo(-1.1, 0), -2);
  });
});

describe('ceilTo', () => {
  it('ceils 1.001 to 2 decimal places → 1.01', () => {
    assert.equal(ceilTo(1.001, 2), 1.01);
  });

  it('ceils to integer', () => {
    assert.equal(ceilTo(1.1, 0), 2);
  });

  it('ceils 1.5 to 0 decimals → 2', () => {
    assert.equal(ceilTo(1.5, 0), 2);
  });

  it('handles negative numbers', () => {
    assert.equal(ceilTo(-1.9, 0), -1);
  });
});

// ─── mapRange ────────────────────────────────────────────────────────────────

describe('mapRange', () => {
  it('maps midpoint of input to midpoint of output', () => {
    assert.equal(mapRange(5, 0, 10, 0, 100), 50);
  });

  it('maps inMin to outMin', () => {
    assert.equal(mapRange(0, 0, 10, 50, 150), 50);
  });

  it('maps inMax to outMax', () => {
    assert.equal(mapRange(10, 0, 10, 50, 150), 150);
  });

  it('works with inverted output range', () => {
    assert.equal(mapRange(0, 0, 10, 100, 0), 100);
    assert.equal(mapRange(10, 0, 10, 100, 0), 0);
  });

  it('extrapolates beyond the input range', () => {
    assert.ok(Math.abs(mapRange(20, 0, 10, 0, 100) - 200) < 1e-10);
  });

  it('handles negative input ranges', () => {
    assert.ok(Math.abs(mapRange(0, -10, 10, 0, 100) - 50) < 1e-10);
  });

  it('returns outMin when inMin equals inMax', () => {
    assert.equal(mapRange(5, 3, 3, 0, 100), 0);
  });
});

// ─── inRange ─────────────────────────────────────────────────────────────────

describe('inRange', () => {
  it('returns true for a value within the range', () => {
    assert.equal(inRange(5, 0, 10), true);
  });

  it('returns true for value at min (inclusive by default)', () => {
    assert.equal(inRange(0, 0, 10), true);
  });

  it('returns true for value at max (inclusive by default)', () => {
    assert.equal(inRange(10, 0, 10), true);
  });

  it('returns false for value below min', () => {
    assert.equal(inRange(-1, 0, 10), false);
  });

  it('returns false for value above max', () => {
    assert.equal(inRange(11, 0, 10), false);
  });

  it('exclusive: returns false when value equals min', () => {
    assert.equal(inRange(0, 0, 10, false), false);
  });

  it('exclusive: returns false when value equals max', () => {
    assert.equal(inRange(10, 0, 10, false), false);
  });

  it('exclusive: returns true for value strictly inside', () => {
    assert.equal(inRange(5, 0, 10, false), true);
  });

  it('handles floating point boundaries', () => {
    assert.equal(inRange(0.5, 0, 1), true);
    assert.equal(inRange(1.0001, 0, 1), false);
  });

  it('handles negative ranges', () => {
    assert.equal(inRange(-5, -10, 0), true);
    assert.equal(inRange(-11, -10, 0), false);
  });
});
