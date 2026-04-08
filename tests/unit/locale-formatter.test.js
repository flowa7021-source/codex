// ─── Unit Tests: Locale Formatter ────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDate,
  formatRelativeTime,
  formatTime,
  formatShortDate,
  getWeekdayNames,
  getMonthNames,
} from '../../app/modules/locale-formatter.js';

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns a string', () => {
    const result = formatDate(new Date(2024, 3, 8), undefined, 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('formats a date with explicit options', () => {
    const result = formatDate(
      new Date(2024, 3, 8),
      { year: 'numeric', month: 'long', day: 'numeric' },
      'en-US',
    );
    assert.ok(result.includes('2024'), `expected '2024' in "${result}"`);
    assert.ok(result.includes('April'), `expected 'April' in "${result}"`);
    assert.ok(result.includes('8'), `expected '8' in "${result}"`);
  });

  it('accepts a numeric timestamp', () => {
    const ts = new Date(2024, 0, 1).getTime();
    const result = formatDate(ts, { year: 'numeric' }, 'en-US');
    assert.ok(result.includes('2024'));
  });

  it('uses the provided locale (different structure for en-US vs de-DE)', () => {
    // en-US: "April 8, 2024" — de-DE: "8. April 2024" (different order/punctuation)
    const en = formatDate(
      new Date(2024, 3, 8),
      { year: 'numeric', month: 'long', day: 'numeric' },
      'en-US',
    );
    const de = formatDate(
      new Date(2024, 3, 8),
      { year: 'numeric', month: 'long', day: 'numeric' },
      'de-DE',
    );
    assert.notEqual(en, de);
  });
});

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns a string', () => {
    const result = formatRelativeTime(Date.now(), undefined, 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('returns "now" or "just now" for a date close to the base', () => {
    const base = new Date(2024, 3, 8, 12, 0, 0).getTime();
    const result = formatRelativeTime(base + 1000, base, 'en-US');
    // Intl.RelativeTimeFormat numeric:'auto' returns "now" for 0 seconds
    assert.ok(
      result === 'now' || result.includes('second'),
      `expected near-zero relative time, got "${result}"`,
    );
  });

  it('returns "in X hours" for a future date', () => {
    const base = new Date(2024, 3, 8, 12, 0, 0).getTime();
    const future = base + 3 * 3600 * 1000; // 3 hours later
    const result = formatRelativeTime(future, base, 'en-US');
    assert.ok(result.includes('hour'), `expected 'hour' in "${result}"`);
    assert.ok(result.startsWith('in '), `expected result to start with "in ", got "${result}"`);
  });

  it('returns "X hours ago" for a past date', () => {
    const base = new Date(2024, 3, 8, 12, 0, 0).getTime();
    const past = base - 5 * 3600 * 1000; // 5 hours before
    const result = formatRelativeTime(past, base, 'en-US');
    assert.ok(result.includes('hour'), `expected 'hour' in "${result}"`);
    assert.ok(result.includes('ago'), `expected 'ago' in "${result}"`);
  });

  it('returns "yesterday" or day-relative for ~1 day ago', () => {
    const base = new Date(2024, 3, 8, 12, 0, 0).getTime();
    const past = base - 24 * 3600 * 1000;
    const result = formatRelativeTime(past, base, 'en-US');
    assert.ok(
      result === 'yesterday' || result.includes('day'),
      `expected day-relative string, got "${result}"`,
    );
  });

  it('returns "in X minutes" for a near future date', () => {
    const base = new Date(2024, 3, 8, 12, 0, 0).getTime();
    const future = base + 30 * 60 * 1000; // 30 minutes
    const result = formatRelativeTime(future, base, 'en-US');
    assert.ok(result.includes('minute'), `expected 'minute' in "${result}"`);
  });

  it('uses Date objects as well as timestamps', () => {
    const base = new Date(2024, 3, 8, 12, 0, 0);
    const future = new Date(base.getTime() + 2 * 3600 * 1000);
    const result = formatRelativeTime(future, base, 'en-US');
    assert.ok(result.includes('hour'));
  });
});

// ─── formatTime ───────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('returns a string', () => {
    const result = formatTime(new Date(2024, 3, 8, 15, 45), 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('includes the hour and minute components', () => {
    const result = formatTime(new Date(2024, 3, 8, 15, 45), 'en-US');
    // en-US 12-hour: "3:45 PM"
    assert.ok(result.includes('3'), `expected hour in "${result}"`);
    assert.ok(result.includes('45'), `expected minutes in "${result}"`);
  });

  it('accepts a numeric timestamp', () => {
    const ts = new Date(2024, 3, 8, 9, 5).getTime();
    const result = formatTime(ts, 'en-US');
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('9') || result.includes('09'));
  });
});

// ─── formatShortDate ──────────────────────────────────────────────────────────

describe('formatShortDate', () => {
  it('returns a string', () => {
    const result = formatShortDate(new Date(2024, 3, 8), 'en-US');
    assert.equal(typeof result, 'string');
  });

  it('contains the month abbreviation and year', () => {
    const result = formatShortDate(new Date(2024, 3, 8), 'en-US');
    // en-US: "Apr 8, 2024"
    assert.ok(result.includes('Apr'), `expected 'Apr' in "${result}"`);
    assert.ok(result.includes('2024'), `expected '2024' in "${result}"`);
  });

  it('contains the day number', () => {
    const result = formatShortDate(new Date(2024, 3, 8), 'en-US');
    assert.ok(result.includes('8'), `expected '8' in "${result}"`);
  });

  it('accepts a numeric timestamp', () => {
    const ts = new Date(2024, 11, 25).getTime();
    const result = formatShortDate(ts, 'en-US');
    assert.ok(result.includes('Dec'));
    assert.ok(result.includes('25'));
  });
});

// ─── getWeekdayNames ──────────────────────────────────────────────────────────

describe('getWeekdayNames', () => {
  it('returns an array of 7 strings', () => {
    const names = getWeekdayNames('en-US');
    assert.equal(Array.isArray(names), true);
    assert.equal(names.length, 7);
    for (const name of names) {
      assert.equal(typeof name, 'string');
      assert.ok(name.length > 0);
    }
  });

  it('returns long names by default', () => {
    const names = getWeekdayNames('en-US');
    // Long names should be more than 2 characters each
    assert.ok(names.every(n => n.length > 2), `expected long names, got: ${names}`);
  });

  it('returns short names when format is "short"', () => {
    const long = getWeekdayNames('en-US', 'long');
    const short = getWeekdayNames('en-US', 'short');
    assert.equal(short.length, 7);
    // Short names should be shorter or equal in length
    assert.ok(short.every(s => s.length <= 3), `expected short names (≤3 chars), got: ${short}`);
    // At least one should differ
    assert.notDeepEqual(long, short);
  });

  it('returns narrow names when format is "narrow"', () => {
    const narrow = getWeekdayNames('en-US', 'narrow');
    assert.equal(narrow.length, 7);
    assert.ok(narrow.every(n => n.length <= 2), `expected narrow names (≤2 chars), got: ${narrow}`);
  });

  it('includes expected English weekday names (long)', () => {
    const names = getWeekdayNames('en-US', 'long');
    assert.ok(names.includes('Sunday'), `expected Sunday in ${names}`);
    assert.ok(names.includes('Monday'), `expected Monday in ${names}`);
    assert.ok(names.includes('Saturday'), `expected Saturday in ${names}`);
  });
});

// ─── getMonthNames ────────────────────────────────────────────────────────────

describe('getMonthNames', () => {
  it('returns an array of 12 strings', () => {
    const names = getMonthNames('en-US');
    assert.equal(Array.isArray(names), true);
    assert.equal(names.length, 12);
    for (const name of names) {
      assert.equal(typeof name, 'string');
      assert.ok(name.length > 0);
    }
  });

  it('returns long names by default', () => {
    const names = getMonthNames('en-US');
    assert.ok(names.every(n => n.length > 2), `expected long names, got: ${names}`);
  });

  it('returns short month names when format is "short"', () => {
    const short = getMonthNames('en-US', 'short');
    assert.equal(short.length, 12);
    assert.ok(short.every(s => s.length <= 3), `expected short names (≤3 chars), got: ${short}`);
  });

  it('includes expected English month names (long)', () => {
    const names = getMonthNames('en-US', 'long');
    assert.ok(names.includes('January'), `expected January in ${names}`);
    assert.ok(names.includes('June'), `expected June in ${names}`);
    assert.ok(names.includes('December'), `expected December in ${names}`);
  });

  it('first entry is January and last is December (long, en-US)', () => {
    const names = getMonthNames('en-US', 'long');
    assert.equal(names[0], 'January');
    assert.equal(names[11], 'December');
  });
});
