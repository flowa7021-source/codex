// ─── Unit Tests: time-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDate,
  formatRelative,
  parseDate,
  addDays,
  addMonths,
  addYears,
  addHours,
  addMinutes,
  addSeconds,
  isBefore,
  isAfter,
  isSameDay,
  diffInDays,
  diffInHours,
  diffInMinutes,
  isWeekend,
  isLeapYear,
  daysInMonth,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  dateRange,
} from '../../app/modules/time-utils.js';

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  // Use local-time constructor so tests are timezone-agnostic.
  const d = new Date(2024, 2, 15, 10, 30, 45, 123); // 2024-03-15 10:30:45.123

  it('formats YYYY-MM-DD', () => {
    assert.equal(formatDate(d, 'YYYY-MM-DD'), '2024-03-15');
  });

  it('formats DD/MM/YYYY', () => {
    assert.equal(formatDate(d, 'DD/MM/YYYY'), '15/03/2024');
  });

  it('formats HH:mm:ss', () => {
    assert.equal(formatDate(d, 'HH:mm:ss'), '10:30:45');
  });

  it('formats SSS (milliseconds)', () => {
    assert.equal(formatDate(d, 'SSS'), '123');
  });

  it('formats a full datetime string', () => {
    assert.equal(formatDate(d, 'YYYY-MM-DD HH:mm:ss.SSS'), '2024-03-15 10:30:45.123');
  });

  it('pads single-digit month and day', () => {
    const jan1 = new Date(2024, 0, 1, 9, 5, 7, 8);
    assert.equal(formatDate(jan1, 'YYYY-MM-DD HH:mm:ss.SSS'), '2024-01-01 09:05:07.008');
  });

  it('pads milliseconds to 3 digits', () => {
    const tiny = new Date(2024, 0, 1, 0, 0, 0, 5);
    assert.equal(formatDate(tiny, 'SSS'), '005');
  });

  it('handles year 2000', () => {
    const y2k = new Date(2000, 0, 1);
    assert.equal(formatDate(y2k, 'YYYY'), '2000');
  });
});

// ─── formatRelative ───────────────────────────────────────────────────────────

describe('formatRelative', () => {
  // Helper: create a "now" and a date that is `secs` seconds in the past.
  function past(secs) {
    const now = new Date(2024, 5, 15, 12, 0, 0);
    const date = new Date(now.getTime() - secs * 1000);
    return { date, now };
  }

  it('returns "just now" for 10 seconds ago', () => {
    const { date, now } = past(10);
    assert.equal(formatRelative(date, now), 'just now');
  });

  it('returns "just now" for 44 seconds ago', () => {
    const { date, now } = past(44);
    assert.equal(formatRelative(date, now), 'just now');
  });

  it('returns "1 minute ago" for 60 seconds ago', () => {
    const { date, now } = past(60);
    assert.equal(formatRelative(date, now), '1 minute ago');
  });

  it('returns "5 minutes ago" for 5 minutes ago', () => {
    const { date, now } = past(5 * 60);
    assert.equal(formatRelative(date, now), '5 minutes ago');
  });

  it('returns "1 hour ago" for 70 minutes ago', () => {
    const { date, now } = past(70 * 60);
    assert.equal(formatRelative(date, now), '1 hour ago');
  });

  it('returns "2 hours ago" for 2 hours ago', () => {
    const { date, now } = past(2 * 3600);
    assert.equal(formatRelative(date, now), '2 hours ago');
  });

  it('returns "yesterday" for 25 hours ago', () => {
    const { date, now } = past(25 * 3600);
    assert.equal(formatRelative(date, now), 'yesterday');
  });

  it('returns "3 days ago" for 3 days ago', () => {
    const { date, now } = past(3 * 86400);
    assert.equal(formatRelative(date, now), '3 days ago');
  });

  it('returns "1 month ago" for 35 days ago', () => {
    const { date, now } = past(35 * 86400);
    assert.equal(formatRelative(date, now), '1 month ago');
  });

  it('returns "2 months ago" for 65 days ago', () => {
    const { date, now } = past(65 * 86400);
    assert.equal(formatRelative(date, now), '2 months ago');
  });

  it('returns "1 year ago" for 400 days ago', () => {
    const { date, now } = past(400 * 86400);
    assert.equal(formatRelative(date, now), '1 year ago');
  });

  it('returns "2 years ago" for 800 days ago', () => {
    const { date, now } = past(800 * 86400);
    assert.equal(formatRelative(date, now), '2 years ago');
  });

  it('defaults now to the current time when omitted', () => {
    const veryRecent = new Date(Date.now() - 5000);
    assert.equal(formatRelative(veryRecent), 'just now');
  });
});

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses YYYY-MM-DD', () => {
    const d = parseDate('2024-03-15', 'YYYY-MM-DD');
    assert.equal(d.getFullYear(), 2024);
    assert.equal(d.getMonth(), 2); // 0-indexed
    assert.equal(d.getDate(), 15);
  });

  it('parses DD/MM/YYYY', () => {
    const d = parseDate('15/03/2024', 'DD/MM/YYYY');
    assert.equal(d.getFullYear(), 2024);
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 15);
  });

  it('parses YYYY-MM-DD HH:mm:ss', () => {
    const d = parseDate('2024-03-15 10:30:45', 'YYYY-MM-DD HH:mm:ss');
    assert.equal(d.getHours(), 10);
    assert.equal(d.getMinutes(), 30);
    assert.equal(d.getSeconds(), 45);
  });

  it('parses milliseconds with SSS token', () => {
    const d = parseDate('123', 'SSS');
    assert.equal(d.getMilliseconds(), 123);
  });

  it('defaults missing time parts to 0', () => {
    const d = parseDate('2024-03-15', 'YYYY-MM-DD');
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
    assert.equal(d.getSeconds(), 0);
    assert.equal(d.getMilliseconds(), 0);
  });

  it('throws RangeError for a string that does not match the format', () => {
    assert.throws(
      () => parseDate('not-a-date', 'YYYY-MM-DD'),
      RangeError,
    );
  });

  it('round-trips with formatDate', () => {
    const original = new Date(2024, 10, 7, 14, 5, 9, 0);
    const fmt = 'YYYY-MM-DD HH:mm:ss';
    const str = formatDate(original, fmt);
    const parsed = parseDate(str, fmt);
    assert.equal(parsed.getFullYear(), original.getFullYear());
    assert.equal(parsed.getMonth(), original.getMonth());
    assert.equal(parsed.getDate(), original.getDate());
    assert.equal(parsed.getHours(), original.getHours());
    assert.equal(parsed.getMinutes(), original.getMinutes());
    assert.equal(parsed.getSeconds(), original.getSeconds());
  });
});

// ─── addDays ─────────────────────────────────────────────────────────────────

describe('addDays', () => {
  const base = new Date(2024, 2, 15); // 2024-03-15

  it('adds positive days', () => {
    const result = addDays(base, 5);
    assert.equal(result.getDate(), 20);
    assert.equal(result.getMonth(), 2);
  });

  it('adds days across a month boundary', () => {
    const result = addDays(base, 20); // Mar 15 + 20 = Apr 4
    assert.equal(result.getMonth(), 3);
    assert.equal(result.getDate(), 4);
  });

  it('subtracts days with negative n', () => {
    const result = addDays(base, -5); // Mar 10
    assert.equal(result.getDate(), 10);
    assert.equal(result.getMonth(), 2);
  });

  it('adds 0 days returns a copy of the same date', () => {
    const result = addDays(base, 0);
    assert.equal(result.getTime(), base.getTime());
    assert.notEqual(result, base); // new object
  });

  it('does not mutate the original date', () => {
    const original = new Date(2024, 2, 15);
    addDays(original, 10);
    assert.equal(original.getDate(), 15);
  });
});

// ─── addMonths ────────────────────────────────────────────────────────────────

describe('addMonths', () => {
  it('adds positive months', () => {
    const result = addMonths(new Date(2024, 0, 15), 2); // Jan -> Mar
    assert.equal(result.getMonth(), 2);
  });

  it('adds months across a year boundary', () => {
    const result = addMonths(new Date(2024, 11, 15), 2); // Dec -> Feb next year
    assert.equal(result.getFullYear(), 2025);
    assert.equal(result.getMonth(), 1);
  });

  it('subtracts months with negative n', () => {
    const result = addMonths(new Date(2024, 5, 15), -3); // Jun -> Mar
    assert.equal(result.getMonth(), 2);
  });

  it('does not mutate the original date', () => {
    const original = new Date(2024, 0, 15);
    addMonths(original, 3);
    assert.equal(original.getMonth(), 0);
  });
});

// ─── addYears ─────────────────────────────────────────────────────────────────

describe('addYears', () => {
  it('adds positive years', () => {
    const result = addYears(new Date(2024, 2, 15), 3);
    assert.equal(result.getFullYear(), 2027);
  });

  it('subtracts years with negative n', () => {
    const result = addYears(new Date(2024, 2, 15), -4);
    assert.equal(result.getFullYear(), 2020);
  });

  it('preserves month and day', () => {
    const result = addYears(new Date(2024, 5, 20), 1);
    assert.equal(result.getMonth(), 5);
    assert.equal(result.getDate(), 20);
  });
});

// ─── addHours ─────────────────────────────────────────────────────────────────

describe('addHours', () => {
  it('adds hours within the same day', () => {
    const result = addHours(new Date(2024, 2, 15, 10, 0, 0), 3);
    assert.equal(result.getHours(), 13);
  });

  it('adds hours across a day boundary', () => {
    const result = addHours(new Date(2024, 2, 15, 23, 0, 0), 2);
    assert.equal(result.getDate(), 16);
    assert.equal(result.getHours(), 1);
  });

  it('subtracts hours with negative n', () => {
    const result = addHours(new Date(2024, 2, 15, 5, 0, 0), -3);
    assert.equal(result.getHours(), 2);
  });
});

// ─── addMinutes ───────────────────────────────────────────────────────────────

describe('addMinutes', () => {
  it('adds minutes', () => {
    const result = addMinutes(new Date(2024, 2, 15, 10, 20, 0), 15);
    assert.equal(result.getMinutes(), 35);
  });

  it('adds minutes across an hour boundary', () => {
    const result = addMinutes(new Date(2024, 2, 15, 10, 50, 0), 20);
    assert.equal(result.getHours(), 11);
    assert.equal(result.getMinutes(), 10);
  });

  it('subtracts minutes with negative n', () => {
    const result = addMinutes(new Date(2024, 2, 15, 10, 20, 0), -5);
    assert.equal(result.getMinutes(), 15);
  });
});

// ─── addSeconds ───────────────────────────────────────────────────────────────

describe('addSeconds', () => {
  it('adds seconds', () => {
    const result = addSeconds(new Date(2024, 2, 15, 10, 0, 30), 20);
    assert.equal(result.getSeconds(), 50);
  });

  it('adds seconds across a minute boundary', () => {
    const result = addSeconds(new Date(2024, 2, 15, 10, 0, 50), 20);
    assert.equal(result.getMinutes(), 1);
    assert.equal(result.getSeconds(), 10);
  });

  it('subtracts seconds with negative n', () => {
    const result = addSeconds(new Date(2024, 2, 15, 10, 0, 30), -10);
    assert.equal(result.getSeconds(), 20);
  });
});

// ─── isBefore / isAfter ───────────────────────────────────────────────────────

describe('isBefore', () => {
  const a = new Date(2024, 2, 15);
  const b = new Date(2024, 2, 16);

  it('returns true when a is before b', () => {
    assert.equal(isBefore(a, b), true);
  });

  it('returns false when a is after b', () => {
    assert.equal(isBefore(b, a), false);
  });

  it('returns false when a equals b', () => {
    assert.equal(isBefore(a, new Date(a.getTime())), false);
  });
});

describe('isAfter', () => {
  const a = new Date(2024, 2, 15);
  const b = new Date(2024, 2, 16);

  it('returns true when a is after b', () => {
    assert.equal(isAfter(b, a), true);
  });

  it('returns false when a is before b', () => {
    assert.equal(isAfter(a, b), false);
  });

  it('returns false when a equals b', () => {
    assert.equal(isAfter(a, new Date(a.getTime())), false);
  });
});

// ─── isSameDay ────────────────────────────────────────────────────────────────

describe('isSameDay', () => {
  it('returns true for two dates on the same day', () => {
    const a = new Date(2024, 2, 15, 8, 0, 0);
    const b = new Date(2024, 2, 15, 23, 59, 59);
    assert.equal(isSameDay(a, b), true);
  });

  it('returns false for dates on different days', () => {
    const a = new Date(2024, 2, 15);
    const b = new Date(2024, 2, 16);
    assert.equal(isSameDay(a, b), false);
  });

  it('returns false for same day but different month', () => {
    const a = new Date(2024, 2, 15);
    const b = new Date(2024, 3, 15);
    assert.equal(isSameDay(a, b), false);
  });

  it('returns false for same day and month but different year', () => {
    const a = new Date(2024, 2, 15);
    const b = new Date(2025, 2, 15);
    assert.equal(isSameDay(a, b), false);
  });
});

// ─── diffInDays ───────────────────────────────────────────────────────────────

describe('diffInDays', () => {
  it('returns positive value when a is after b', () => {
    const a = new Date(2024, 2, 20);
    const b = new Date(2024, 2, 15);
    assert.equal(diffInDays(a, b), 5);
  });

  it('returns negative value when a is before b', () => {
    const a = new Date(2024, 2, 10);
    const b = new Date(2024, 2, 15);
    assert.equal(diffInDays(a, b), -5);
  });

  it('returns 0 for equal dates', () => {
    const a = new Date(2024, 2, 15);
    assert.equal(diffInDays(a, new Date(a.getTime())), 0);
  });

  it('truncates partial days', () => {
    const a = new Date(2024, 2, 15, 23, 0, 0);
    const b = new Date(2024, 2, 15, 0, 0, 0);
    assert.equal(diffInDays(a, b), 0); // less than 24 h
  });
});

// ─── diffInHours ──────────────────────────────────────────────────────────────

describe('diffInHours', () => {
  it('returns positive value when a is after b', () => {
    const a = new Date(2024, 2, 15, 14, 0, 0);
    const b = new Date(2024, 2, 15, 10, 0, 0);
    assert.equal(diffInHours(a, b), 4);
  });

  it('returns negative value when a is before b', () => {
    const a = new Date(2024, 2, 15, 8, 0, 0);
    const b = new Date(2024, 2, 15, 10, 0, 0);
    assert.equal(diffInHours(a, b), -2);
  });

  it('truncates partial hours', () => {
    const a = new Date(2024, 2, 15, 10, 59, 59);
    const b = new Date(2024, 2, 15, 10, 0, 0);
    assert.equal(diffInHours(a, b), 0);
  });
});

// ─── diffInMinutes ────────────────────────────────────────────────────────────

describe('diffInMinutes', () => {
  it('returns positive value when a is after b', () => {
    const a = new Date(2024, 2, 15, 10, 45, 0);
    const b = new Date(2024, 2, 15, 10, 30, 0);
    assert.equal(diffInMinutes(a, b), 15);
  });

  it('returns negative value when a is before b', () => {
    const a = new Date(2024, 2, 15, 10, 15, 0);
    const b = new Date(2024, 2, 15, 10, 30, 0);
    assert.equal(diffInMinutes(a, b), -15);
  });

  it('truncates partial minutes', () => {
    const a = new Date(2024, 2, 15, 10, 30, 59);
    const b = new Date(2024, 2, 15, 10, 30, 0);
    assert.equal(diffInMinutes(a, b), 0);
  });
});

// ─── isWeekend ────────────────────────────────────────────────────────────────

describe('isWeekend', () => {
  it('returns true for Saturday', () => {
    const sat = new Date(2024, 2, 16); // 2024-03-16 is a Saturday
    assert.equal(isWeekend(sat), true);
  });

  it('returns true for Sunday', () => {
    const sun = new Date(2024, 2, 17); // 2024-03-17 is a Sunday
    assert.equal(isWeekend(sun), true);
  });

  it('returns false for Monday', () => {
    const mon = new Date(2024, 2, 18); // 2024-03-18 is a Monday
    assert.equal(isWeekend(mon), false);
  });

  it('returns false for Friday', () => {
    const fri = new Date(2024, 2, 15); // 2024-03-15 is a Friday
    assert.equal(isWeekend(fri), false);
  });
});

// ─── isLeapYear ───────────────────────────────────────────────────────────────

describe('isLeapYear', () => {
  it('returns true for 2024 (divisible by 4)', () => {
    assert.equal(isLeapYear(2024), true);
  });

  it('returns false for 2023', () => {
    assert.equal(isLeapYear(2023), false);
  });

  it('returns false for 1900 (divisible by 100 but not 400)', () => {
    assert.equal(isLeapYear(1900), false);
  });

  it('returns true for 2000 (divisible by 400)', () => {
    assert.equal(isLeapYear(2000), true);
  });

  it('returns true for 1600 (divisible by 400)', () => {
    assert.equal(isLeapYear(1600), true);
  });

  it('returns false for 1700 (divisible by 100 but not 400)', () => {
    assert.equal(isLeapYear(1700), false);
  });
});

// ─── daysInMonth ─────────────────────────────────────────────────────────────

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    assert.equal(daysInMonth(2024, 1), 31);
  });

  it('returns 29 for February in a leap year', () => {
    assert.equal(daysInMonth(2024, 2), 29);
  });

  it('returns 28 for February in a non-leap year', () => {
    assert.equal(daysInMonth(2023, 2), 28);
  });

  it('returns 30 for April', () => {
    assert.equal(daysInMonth(2024, 4), 30);
  });

  it('returns 31 for December', () => {
    assert.equal(daysInMonth(2024, 12), 31);
  });
});

// ─── startOfDay / endOfDay ───────────────────────────────────────────────────

describe('startOfDay', () => {
  const d = new Date(2024, 2, 15, 14, 30, 45, 500);

  it('sets hours, minutes, seconds, ms to 0', () => {
    const result = startOfDay(d);
    assert.equal(result.getHours(), 0);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
  });

  it('preserves the year, month, and day', () => {
    const result = startOfDay(d);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 2);
    assert.equal(result.getDate(), 15);
  });

  it('does not mutate the original', () => {
    startOfDay(d);
    assert.equal(d.getHours(), 14);
  });
});

describe('endOfDay', () => {
  const d = new Date(2024, 2, 15, 8, 0, 0, 0);

  it('sets time to 23:59:59.999', () => {
    const result = endOfDay(d);
    assert.equal(result.getHours(), 23);
    assert.equal(result.getMinutes(), 59);
    assert.equal(result.getSeconds(), 59);
    assert.equal(result.getMilliseconds(), 999);
  });

  it('preserves the year, month, and day', () => {
    const result = endOfDay(d);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 2);
    assert.equal(result.getDate(), 15);
  });
});

// ─── startOfMonth / endOfMonth ───────────────────────────────────────────────

describe('startOfMonth', () => {
  const d = new Date(2024, 2, 15, 14, 30, 45);

  it('sets day to 1 and time to 00:00:00.000', () => {
    const result = startOfMonth(d);
    assert.equal(result.getDate(), 1);
    assert.equal(result.getHours(), 0);
    assert.equal(result.getMinutes(), 0);
    assert.equal(result.getSeconds(), 0);
    assert.equal(result.getMilliseconds(), 0);
  });

  it('preserves year and month', () => {
    const result = startOfMonth(d);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 2);
  });
});

describe('endOfMonth', () => {
  it('returns last day of March (31) at 23:59:59.999', () => {
    const d = new Date(2024, 2, 15);
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 31);
    assert.equal(result.getHours(), 23);
    assert.equal(result.getMinutes(), 59);
    assert.equal(result.getSeconds(), 59);
    assert.equal(result.getMilliseconds(), 999);
  });

  it('returns last day of February in a leap year (29)', () => {
    const d = new Date(2024, 1, 10); // Feb 2024
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 29);
  });

  it('returns last day of February in a non-leap year (28)', () => {
    const d = new Date(2023, 1, 10); // Feb 2023
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 28);
  });

  it('returns last day of April (30)', () => {
    const d = new Date(2024, 3, 5); // April
    const result = endOfMonth(d);
    assert.equal(result.getDate(), 30);
  });
});

// ─── dateRange ────────────────────────────────────────────────────────────────

describe('dateRange', () => {
  it('returns a single date when start equals end', () => {
    const d = new Date(2024, 2, 15);
    const range = dateRange(d, d);
    assert.equal(range.length, 1);
    assert.equal(range[0].getDate(), 15);
  });

  it('returns daily range inclusive of start and end', () => {
    const start = new Date(2024, 2, 1);
    const end   = new Date(2024, 2, 5);
    const range = dateRange(start, end);
    assert.equal(range.length, 5);
    assert.equal(range[0].getDate(), 1);
    assert.equal(range[4].getDate(), 5);
  });

  it('returns empty array when end is before start', () => {
    const start = new Date(2024, 2, 15);
    const end   = new Date(2024, 2, 10);
    assert.equal(dateRange(start, end).length, 0);
  });

  it('steps by month when step="month"', () => {
    const start = new Date(2024, 0, 1); // Jan
    const end   = new Date(2024, 2, 1); // Mar
    const range = dateRange(start, end, 'month');
    assert.equal(range.length, 3);
    assert.equal(range[0].getMonth(), 0);
    assert.equal(range[1].getMonth(), 1);
    assert.equal(range[2].getMonth(), 2);
  });

  it('steps by year when step="year"', () => {
    const start = new Date(2022, 0, 1);
    const end   = new Date(2024, 0, 1);
    const range = dateRange(start, end, 'year');
    assert.equal(range.length, 3);
    assert.equal(range[0].getFullYear(), 2022);
    assert.equal(range[2].getFullYear(), 2024);
  });

  it('returns new Date objects (not the same reference)', () => {
    const start = new Date(2024, 2, 1);
    const end   = new Date(2024, 2, 3);
    const range = dateRange(start, end);
    for (const d of range) {
      assert.notEqual(d, start);
    }
  });

  it('defaults to day step', () => {
    const start = new Date(2024, 2, 10);
    const end   = new Date(2024, 2, 12);
    const range = dateRange(start, end);
    assert.equal(range.length, 3);
  });
});
