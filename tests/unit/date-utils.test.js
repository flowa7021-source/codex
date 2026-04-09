// ─── Unit Tests: date-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isBefore,
  isAfter,
  diffInDays,
  diffInMonths,
  getWeekNumber,
  isLeapYear,
  parseDate,
  formatDateISO,
  // new exports
  diffDates,
  isToday,
  startOfWeek,
  daysInMonth,
  parseISODate,
  toISODate,
} from '../../app/modules/date-utils.js';

// ─── addDays ──────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('adds 1 day', () => {
    const d = new Date(2024, 0, 15); // Jan 15
    const result = addDays(d, 1);
    assert.equal(result.getDate(), 16);
    assert.equal(result.getMonth(), 0);
  });

  it('adds 7 days', () => {
    const d = new Date(2024, 0, 25); // Jan 25
    const result = addDays(d, 7);
    assert.equal(result.getDate(), 1);
    assert.equal(result.getMonth(), 1); // Feb
  });

  it('subtracts 3 days with negative value', () => {
    const d = new Date(2024, 0, 5); // Jan 5
    const result = addDays(d, -3);
    assert.equal(result.getDate(), 2);
    assert.equal(result.getMonth(), 0);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 0, 15);
    const original = d.getTime();
    addDays(d, 5);
    assert.equal(d.getTime(), original);
  });
});

// ─── addMonths ────────────────────────────────────────────────────────────────

describe('addMonths', () => {
  it('adds 1 month', () => {
    const d = new Date(2024, 0, 15); // Jan 15
    const result = addMonths(d, 1);
    assert.equal(result.getMonth(), 1); // Feb
    assert.equal(result.getFullYear(), 2024);
  });

  it('subtracts 1 month', () => {
    const d = new Date(2024, 2, 15); // Mar 15
    const result = addMonths(d, -1);
    assert.equal(result.getMonth(), 1); // Feb
    assert.equal(result.getFullYear(), 2024);
  });

  it('handles year boundary when adding', () => {
    const d = new Date(2024, 11, 15); // Dec 15
    const result = addMonths(d, 1);
    assert.equal(result.getMonth(), 0); // Jan
    assert.equal(result.getFullYear(), 2025);
  });

  it('handles year boundary when subtracting', () => {
    const d = new Date(2024, 0, 15); // Jan 15
    const result = addMonths(d, -1);
    assert.equal(result.getMonth(), 11); // Dec
    assert.equal(result.getFullYear(), 2023);
  });

  it('clamps day overflow (Jan 31 + 1 month → last day of Feb)', () => {
    const d = new Date(2024, 0, 31); // Jan 31, 2024 (leap year)
    const result = addMonths(d, 1);
    assert.equal(result.getMonth(), 1); // Feb
    assert.equal(result.getDate(), 29); // Feb 29, 2024
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 0, 15);
    const original = d.getTime();
    addMonths(d, 2);
    assert.equal(d.getTime(), original);
  });
});

// ─── addYears ─────────────────────────────────────────────────────────────────

describe('addYears', () => {
  it('adds 1 year', () => {
    const d = new Date(2023, 5, 15); // Jun 15, 2023
    const result = addYears(d, 1);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 5);
    assert.equal(result.getDate(), 15);
  });

  it('subtracts 1 year', () => {
    const d = new Date(2024, 5, 15); // Jun 15, 2024
    const result = addYears(d, -1);
    assert.equal(result.getFullYear(), 2023);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 5, 15);
    const original = d.getTime();
    addYears(d, 1);
    assert.equal(d.getTime(), original);
  });
});

// ─── startOfDay ───────────────────────────────────────────────────────────────

describe('startOfDay', () => {
  it('returns midnight (00:00:00.000)', () => {
    const d = new Date(2024, 3, 10, 14, 30, 45, 500);
    const result = startOfDay(d);
    assert.equal(result.getHours(), 0);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
  });

  it('preserves the date part', () => {
    const d = new Date(2024, 3, 10, 14, 30, 45, 500);
    const result = startOfDay(d);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 3);
    assert.equal(result.getDate(), 10);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 3, 10, 14, 30, 45, 500);
    const original = d.getTime();
    startOfDay(d);
    assert.equal(d.getTime(), original);
  });
});

// ─── endOfDay ─────────────────────────────────────────────────────────────────

describe('endOfDay', () => {
  it('returns 23:59:59.999', () => {
    const d = new Date(2024, 3, 10, 8, 0, 0, 0);
    const result = endOfDay(d);
    assert.equal(result.getHours(), 23);
    assert.equal(result.getMinutes(), 59);
    assert.equal(result.getSeconds(), 59);
    assert.equal(result.getMilliseconds(), 999);
  });

  it('preserves the date part', () => {
    const d = new Date(2024, 3, 10, 8, 0, 0, 0);
    const result = endOfDay(d);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 3);
    assert.equal(result.getDate(), 10);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 3, 10, 8, 0, 0, 0);
    const original = d.getTime();
    endOfDay(d);
    assert.equal(d.getTime(), original);
  });
});

// ─── startOfMonth ─────────────────────────────────────────────────────────────

describe('startOfMonth', () => {
  it('returns the 1st of the month at midnight', () => {
    const d = new Date(2024, 3, 15, 10, 30, 0); // Apr 15
    const result = startOfMonth(d);
    assert.equal(result.getDate(), 1);
    assert.equal(result.getMonth(), 3);
    assert.equal(result.getHours(), 0);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 3, 15);
    const original = d.getTime();
    startOfMonth(d);
    assert.equal(d.getTime(), original);
  });
});

// ─── endOfMonth ───────────────────────────────────────────────────────────────

describe('endOfMonth', () => {
  it('returns the last day of the month at 23:59:59.999 (April has 30 days)', () => {
    const d = new Date(2024, 3, 10); // Apr 10
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 30);
    assert.equal(result.getMonth(), 3);
    assert.equal(result.getHours(), 23);
    assert.equal(result.getMinutes(), 59);
    assert.equal(result.getSeconds(), 59);
    assert.equal(result.getMilliseconds(), 999);
  });

  it('handles February in a leap year (29 days)', () => {
    const d = new Date(2024, 1, 5); // Feb 2024
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 29);
    assert.equal(result.getMonth(), 1);
  });

  it('handles February in a non-leap year (28 days)', () => {
    const d = new Date(2023, 1, 5); // Feb 2023
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 28);
    assert.equal(result.getMonth(), 1);
  });

  it('handles December (31 days)', () => {
    const d = new Date(2024, 11, 1); // Dec 2024
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 31);
    assert.equal(result.getMonth(), 11);
  });
});

// ─── isSameDay ────────────────────────────────────────────────────────────────

describe('isSameDay', () => {
  it('returns true for the same day at different times', () => {
    const a = new Date(2024, 3, 10, 8, 0, 0);
    const b = new Date(2024, 3, 10, 23, 59, 59);
    assert.equal(isSameDay(a, b), true);
  });

  it('returns false for different days', () => {
    const a = new Date(2024, 3, 10);
    const b = new Date(2024, 3, 11);
    assert.equal(isSameDay(a, b), false);
  });

  it('returns false for the same day in different months', () => {
    const a = new Date(2024, 3, 10);
    const b = new Date(2024, 4, 10);
    assert.equal(isSameDay(a, b), false);
  });

  it('returns false for the same day in different years', () => {
    const a = new Date(2024, 3, 10);
    const b = new Date(2023, 3, 10);
    assert.equal(isSameDay(a, b), false);
  });
});

// ─── isBefore / isAfter ───────────────────────────────────────────────────────

describe('isBefore', () => {
  it('returns true when a is earlier than b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 2);
    assert.equal(isBefore(a, b), true);
  });

  it('returns false when a is later than b', () => {
    const a = new Date(2024, 0, 2);
    const b = new Date(2024, 0, 1);
    assert.equal(isBefore(a, b), false);
  });

  it('returns false when a equals b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 1);
    assert.equal(isBefore(a, b), false);
  });
});

describe('isAfter', () => {
  it('returns true when a is later than b', () => {
    const a = new Date(2024, 0, 2);
    const b = new Date(2024, 0, 1);
    assert.equal(isAfter(a, b), true);
  });

  it('returns false when a is earlier than b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 2);
    assert.equal(isAfter(a, b), false);
  });

  it('returns false when a equals b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 1);
    assert.equal(isAfter(a, b), false);
  });
});

// ─── diffInDays ───────────────────────────────────────────────────────────────

describe('diffInDays', () => {
  it('returns positive days when a is after b', () => {
    const a = new Date(2024, 0, 11);
    const b = new Date(2024, 0, 1);
    assert.equal(diffInDays(a, b), 10);
  });

  it('returns negative days when a is before b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 11);
    assert.equal(diffInDays(a, b), -10);
  });

  it('returns 0 for the same date', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 1);
    assert.equal(diffInDays(a, b), 0);
  });

  it('handles month boundaries', () => {
    const a = new Date(2024, 1, 1); // Feb 1
    const b = new Date(2024, 0, 1); // Jan 1
    assert.equal(diffInDays(a, b), 31);
  });
});

// ─── diffInMonths ─────────────────────────────────────────────────────────────

describe('diffInMonths', () => {
  it('returns positive months when a is after b', () => {
    const a = new Date(2024, 5, 1); // Jun 2024
    const b = new Date(2024, 0, 1); // Jan 2024
    assert.equal(diffInMonths(a, b), 5);
  });

  it('returns negative months when a is before b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 5, 1);
    assert.equal(diffInMonths(a, b), -5);
  });

  it('returns 0 for the same month', () => {
    const a = new Date(2024, 3, 5);
    const b = new Date(2024, 3, 20);
    assert.equal(diffInMonths(a, b), 0);
  });

  it('handles year boundaries', () => {
    const a = new Date(2025, 0, 1); // Jan 2025
    const b = new Date(2024, 0, 1); // Jan 2024
    assert.equal(diffInMonths(a, b), 12);
  });
});

// ─── getWeekNumber ────────────────────────────────────────────────────────────

describe('getWeekNumber', () => {
  it('returns week 1 for Jan 1, 2024 (Monday)', () => {
    // Jan 1, 2024 is a Monday — week 1
    const d = new Date(2024, 0, 1);
    const week = getWeekNumber(d);
    assert.equal(week, 1);
  });

  it('returns a value between 1 and 53', () => {
    const d = new Date(2024, 6, 15); // Jul 15
    const week = getWeekNumber(d);
    assert.ok(week >= 1 && week <= 53, `Expected 1-53, got ${week}`);
  });

  it('returns 52 or 53 for late December dates', () => {
    const d = new Date(2024, 11, 28); // Dec 28
    const week = getWeekNumber(d);
    assert.ok(week >= 52 && week <= 53, `Expected 52 or 53, got ${week}`);
  });

  it('returns week 28 for Jul 8, 2024', () => {
    // Jul 8, 2024 is in ISO week 28
    const d = new Date(2024, 6, 8);
    const week = getWeekNumber(d);
    assert.equal(week, 28);
  });
});

// ─── isLeapYear ───────────────────────────────────────────────────────────────

describe('isLeapYear', () => {
  it('2000 is a leap year (divisible by 400)', () => {
    assert.equal(isLeapYear(2000), true);
  });

  it('2024 is a leap year (divisible by 4, not 100)', () => {
    assert.equal(isLeapYear(2024), true);
  });

  it('1900 is not a leap year (divisible by 100 but not 400)', () => {
    assert.equal(isLeapYear(1900), false);
  });

  it('2023 is not a leap year', () => {
    assert.equal(isLeapYear(2023), false);
  });

  it('2100 is not a leap year (divisible by 100 but not 400)', () => {
    assert.equal(isLeapYear(2100), false);
  });

  it('1600 is a leap year (divisible by 400)', () => {
    assert.equal(isLeapYear(1600), true);
  });
});

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses a valid ISO 8601 date string', () => {
    const result = parseDate('2024-04-10');
    assert.ok(result instanceof Date);
    assert.equal(isNaN(result.getTime()), false);
  });

  it('parses a valid ISO 8601 datetime string', () => {
    const result = parseDate('2024-04-10T12:00:00.000Z');
    assert.ok(result instanceof Date);
    assert.equal(result.getUTCFullYear(), 2024);
    assert.equal(result.getUTCMonth(), 3);
    assert.equal(result.getUTCDate(), 10);
  });

  it('returns null for an invalid string', () => {
    assert.equal(parseDate('not-a-date'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(parseDate(''), null);
  });

  it('returns null for a whitespace-only string', () => {
    assert.equal(parseDate('   '), null);
  });

  it('trims whitespace before parsing', () => {
    const result = parseDate('  2024-04-10  ');
    assert.ok(result instanceof Date);
    assert.equal(isNaN(result.getTime()), false);
  });
});

// ─── formatDateISO ────────────────────────────────────────────────────────────

describe('formatDateISO', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2024, 3, 10); // Apr 10, 2024
    assert.equal(formatDateISO(d), '2024-04-10');
  });

  it('pads single-digit month and day with zeros', () => {
    const d = new Date(2024, 0, 5); // Jan 5, 2024
    assert.equal(formatDateISO(d), '2024-01-05');
  });

  it('handles December (month 12)', () => {
    const d = new Date(2024, 11, 31); // Dec 31, 2024
    assert.equal(formatDateISO(d), '2024-12-31');
  });

  it('returns a string of length 10', () => {
    const d = new Date(2024, 3, 10);
    assert.equal(formatDateISO(d).length, 10);
  });

  it('matches the pattern YYYY-MM-DD', () => {
    const d = new Date(2024, 3, 10);
    assert.match(formatDateISO(d), /^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── diffDates ────────────────────────────────────────────────────────────────

describe('diffDates', () => {
  it('returns positive days when a is after b', () => {
    const a = new Date(2024, 0, 11); // Jan 11
    const b = new Date(2024, 0, 1);  // Jan 1
    assert.equal(diffDates(a, b, 'days'), 10);
  });

  it('returns negative days when a is before b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 11);
    assert.equal(diffDates(a, b, 'days'), -10);
  });

  it('returns difference in hours', () => {
    const a = new Date(2024, 0, 2, 6, 0, 0);  // Jan 2, 06:00
    const b = new Date(2024, 0, 1, 0, 0, 0);  // Jan 1, 00:00
    assert.equal(diffDates(a, b, 'hours'), 30);
  });

  it('returns difference in minutes', () => {
    const a = new Date(2024, 0, 1, 1, 30, 0); // 01:30
    const b = new Date(2024, 0, 1, 0, 0, 0);  // 00:00
    assert.equal(diffDates(a, b, 'minutes'), 90);
  });

  it('returns difference in seconds', () => {
    const a = new Date(2024, 0, 1, 0, 2, 0); // 00:02:00
    const b = new Date(2024, 0, 1, 0, 0, 0); // 00:00:00
    assert.equal(diffDates(a, b, 'seconds'), 120);
  });

  it('returns difference in milliseconds', () => {
    const a = new Date(2024, 0, 1, 0, 0, 1, 500); // + 1.5 s
    const b = new Date(2024, 0, 1, 0, 0, 0, 0);
    assert.equal(diffDates(a, b, 'milliseconds'), 1500);
  });

  it('returns 0 when dates are equal', () => {
    const d = new Date(2024, 3, 10, 12, 0, 0);
    assert.equal(diffDates(d, d, 'days'), 0);
  });
});

// ─── isToday ──────────────────────────────────────────────────────────────────

describe('isToday', () => {
  it('returns true for today\'s date', () => {
    const today = new Date();
    assert.equal(isToday(today), true);
  });

  it('returns true for today with a different time', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    assert.equal(isToday(today), true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    assert.equal(isToday(yesterday), false);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.equal(isToday(tomorrow), false);
  });
});

// ─── startOfWeek ─────────────────────────────────────────────────────────────

describe('startOfWeek', () => {
  it('returns Monday when given a Wednesday', () => {
    const wed = new Date(2024, 3, 10); // Apr 10, 2024 is Wednesday
    const result = startOfWeek(wed);
    assert.equal(result.getDay(), 1); // Monday
    assert.equal(result.getDate(), 8); // Apr 8
    assert.equal(result.getMonth(), 3);
  });

  it('returns the same day when given a Monday', () => {
    const mon = new Date(2024, 3, 8); // Apr 8, 2024 is Monday
    const result = startOfWeek(mon);
    assert.equal(result.getDay(), 1);
    assert.equal(result.getDate(), 8);
  });

  it('returns previous Monday when given a Sunday', () => {
    const sun = new Date(2024, 3, 14); // Apr 14, 2024 is Sunday
    const result = startOfWeek(sun);
    assert.equal(result.getDay(), 1); // Monday
    assert.equal(result.getDate(), 8); // Apr 8
  });

  it('returns midnight (00:00:00.000)', () => {
    const d = new Date(2024, 3, 10, 15, 30, 0);
    const result = startOfWeek(d);
    assert.equal(result.getHours(), 0);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 3, 10);
    const original = d.getTime();
    startOfWeek(d);
    assert.equal(d.getTime(), original);
  });
});

// ─── daysInMonth ─────────────────────────────────────────────────────────────

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    assert.equal(daysInMonth(2024, 1), 31);
  });

  it('returns 28 for February in a non-leap year', () => {
    assert.equal(daysInMonth(2023, 2), 28);
  });

  it('returns 29 for February in a leap year', () => {
    assert.equal(daysInMonth(2024, 2), 29);
  });

  it('returns 30 for April', () => {
    assert.equal(daysInMonth(2024, 4), 30);
  });

  it('returns 31 for December', () => {
    assert.equal(daysInMonth(2024, 12), 31);
  });

  it('returns 31 for March', () => {
    assert.equal(daysInMonth(2024, 3), 31);
  });
});

// ─── parseISODate ─────────────────────────────────────────────────────────────

describe('parseISODate', () => {
  it('parses a valid ISO date string', () => {
    const result = parseISODate('2024-04-08');
    assert.ok(result instanceof Date);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 3); // April = 3 (0-based)
    assert.equal(result.getDate(), 8);
  });

  it('returns null for an invalid format (not YYYY-MM-DD)', () => {
    assert.equal(parseISODate('April 8, 2024'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(parseISODate(''), null);
  });

  it('returns null for an out-of-range month', () => {
    assert.equal(parseISODate('2024-13-01'), null);
  });

  it('returns null for an out-of-range day', () => {
    assert.equal(parseISODate('2024-02-30'), null);
  });

  it('returns null for a non-string input', () => {
    // @ts-ignore — intentional invalid input
    assert.equal(parseISODate(null), null);
  });

  it('parses the earliest valid date (Jan 1)', () => {
    const result = parseISODate('2024-01-01');
    assert.ok(result instanceof Date);
    assert.equal(result.getMonth(), 0);
    assert.equal(result.getDate(), 1);
  });
});

// ─── toISODate ────────────────────────────────────────────────────────────────

describe('toISODate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2024, 3, 8); // Apr 8, 2024
    assert.equal(toISODate(d), '2024-04-08');
  });

  it('pads single-digit month and day with zeros', () => {
    const d = new Date(2024, 0, 5); // Jan 5
    assert.equal(toISODate(d), '2024-01-05');
  });

  it('handles December (month 12)', () => {
    const d = new Date(2024, 11, 31); // Dec 31
    assert.equal(toISODate(d), '2024-12-31');
  });

  it('returns a string matching YYYY-MM-DD pattern', () => {
    const d = new Date(2024, 3, 8);
    assert.match(toISODate(d), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('roundtrips through parseISODate', () => {
    const d = new Date(2024, 3, 8);
    const str = toISODate(d);
    const parsed = parseISODate(str);
    assert.ok(parsed instanceof Date);
    assert.equal(parsed.getFullYear(), d.getFullYear());
    assert.equal(parsed.getMonth(), d.getMonth());
    assert.equal(parsed.getDate(), d.getDate());
  });
});
