// ─── Unit Tests: date-utils ───────────────────────────────────────────────────
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
  isBefore,
  isAfter,
  isSameDay,
  diffInDays,
  diffInHours,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  daysInMonth,
  isLeapYear,
  dayOfYear,
  weekOfYear,
} from '../../app/modules/date-utils.js';

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats YYYY-MM-DD', () => {
    const d = new Date(2024, 0, 5); // Jan 5, 2024
    assert.equal(formatDate(d, 'YYYY-MM-DD'), '2024-01-05');
  });

  it('formats DD/MM/YYYY', () => {
    const d = new Date(2024, 11, 31); // Dec 31, 2024
    assert.equal(formatDate(d, 'DD/MM/YYYY'), '31/12/2024');
  });

  it('formats HH:mm:ss', () => {
    const d = new Date(2024, 0, 1, 9, 7, 3);
    assert.equal(formatDate(d, 'HH:mm:ss'), '09:07:03');
  });

  it('formats abbreviated weekday ddd', () => {
    const d = new Date(2024, 0, 1); // Monday Jan 1, 2024
    assert.equal(formatDate(d, 'ddd'), 'Mon');
  });

  it('formats full weekday dddd', () => {
    const d = new Date(2024, 0, 1); // Monday
    assert.equal(formatDate(d, 'dddd'), 'Monday');
  });

  it('formats abbreviated month MMM', () => {
    const d = new Date(2024, 5, 15); // Jun 15
    assert.equal(formatDate(d, 'MMM DD, YYYY'), 'Jun 15, 2024');
  });

  it('formats full month MMMM', () => {
    const d = new Date(2024, 5, 15); // Jun 15
    assert.equal(formatDate(d, 'MMMM DD, YYYY'), 'June 15, 2024');
  });

  it('does not mutate the input date', () => {
    const d = new Date(2024, 0, 15, 12, 0, 0);
    const ts = d.getTime();
    formatDate(d, 'YYYY-MM-DD HH:mm:ss');
    assert.equal(d.getTime(), ts);
  });

  it('handles all months correctly', () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    for (let m = 0; m < 12; m++) {
      const d = new Date(2024, m, 1);
      assert.equal(formatDate(d, 'MMMM'), monthNames[m]);
    }
  });

  it('pads single-digit days and months', () => {
    const d = new Date(2024, 0, 1); // Jan 1
    assert.equal(formatDate(d, 'MM/DD'), '01/01');
  });
});

// ─── formatRelative ───────────────────────────────────────────────────────────

describe('formatRelative', () => {
  it('returns "just now" for < 45 seconds ago', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 30_000); // 30s ago
    assert.equal(formatRelative(past, now), 'just now');
  });

  it('returns "1 minute ago" for ~1 minute', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 60_000);
    assert.equal(formatRelative(past, now), '1 minute ago');
  });

  it('returns "5 minutes ago" for ~5 minutes', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 5 * 60_000);
    assert.equal(formatRelative(past, now), '5 minutes ago');
  });

  it('returns "1 hour ago" for ~1 hour', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 3_600_000);
    assert.equal(formatRelative(past, now), '1 hour ago');
  });

  it('returns "2 hours ago" for ~2 hours', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 2 * 3_600_000);
    assert.equal(formatRelative(past, now), '2 hours ago');
  });

  it('returns "yesterday" for ~24 hours ago', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 86_400_000);
    assert.equal(formatRelative(past, now), 'yesterday');
  });

  it('returns "3 days ago" for 3 days', () => {
    const now = new Date(2024, 0, 15, 12, 0, 0);
    const past = new Date(now.getTime() - 3 * 86_400_000);
    assert.equal(formatRelative(past, now), '3 days ago');
  });

  it('returns "2 weeks ago" for 2 weeks', () => {
    const now = new Date(2024, 0, 30, 12, 0, 0);
    const past = new Date(now.getTime() - 14 * 86_400_000);
    assert.equal(formatRelative(past, now), '2 weeks ago');
  });

  it('returns "3 months ago" for ~3 months', () => {
    const now = new Date(2024, 5, 1, 0, 0, 0);
    const past = new Date(2024, 2, 1, 0, 0, 0); // ~3 months earlier
    assert.equal(formatRelative(past, now), '3 months ago');
  });

  it('returns "2 years ago" for ~2 years', () => {
    const now = new Date(2024, 0, 1);
    const past = new Date(2022, 0, 1);
    assert.equal(formatRelative(past, now), '2 years ago');
  });
});

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses YYYY-MM-DD', () => {
    const d = parseDate('2024-03-15', 'YYYY-MM-DD');
    assert.equal(d.getFullYear(), 2024);
    assert.equal(d.getMonth(), 2); // March = 2
    assert.equal(d.getDate(), 15);
  });

  it('parses DD/MM/YYYY', () => {
    const d = parseDate('31/12/2023', 'DD/MM/YYYY');
    assert.equal(d.getFullYear(), 2023);
    assert.equal(d.getMonth(), 11); // Dec = 11
    assert.equal(d.getDate(), 31);
  });

  it('parses with time tokens HH:mm:ss', () => {
    const d = parseDate('2024-01-15 09:30:45', 'YYYY-MM-DD HH:mm:ss');
    assert.equal(d.getHours(), 9);
    assert.equal(d.getMinutes(), 30);
    assert.equal(d.getSeconds(), 45);
  });

  it('parses abbreviated month name MMM', () => {
    const d = parseDate('Jan 15, 2024', 'MMM DD, YYYY');
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 15);
  });

  it('parses full month name MMMM', () => {
    const d = parseDate('March 01, 2024', 'MMMM DD, YYYY');
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 1);
  });

  it('throws on string that does not match format', () => {
    assert.throws(() => parseDate('not-a-date', 'YYYY-MM-DD'), /parseDate/);
  });

  it('throws on invalid calendar date (Feb 30)', () => {
    assert.throws(() => parseDate('2024-02-30', 'YYYY-MM-DD'), /parseDate/);
  });

  it('throws on unknown month abbreviation', () => {
    assert.throws(() => parseDate('Xyz 15, 2024', 'MMM DD, YYYY'), /parseDate/);
  });

  it('round-trips with formatDate (YYYY-MM-DD)', () => {
    const original = new Date(2024, 6, 4); // Jul 4
    const str = formatDate(original, 'YYYY-MM-DD');
    const parsed = parseDate(str, 'YYYY-MM-DD');
    assert.equal(parsed.getFullYear(), original.getFullYear());
    assert.equal(parsed.getMonth(), original.getMonth());
    assert.equal(parsed.getDate(), original.getDate());
  });
});

// ─── addDays ──────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('adds 1 day', () => {
    const d = new Date(2024, 0, 15);
    const r = addDays(d, 1);
    assert.equal(r.getDate(), 16);
    assert.equal(r.getMonth(), 0);
  });

  it('crosses month boundary', () => {
    const d = new Date(2024, 0, 31); // Jan 31
    const r = addDays(d, 1);
    assert.equal(r.getDate(), 1);
    assert.equal(r.getMonth(), 1); // Feb
  });

  it('subtracts days with negative value', () => {
    const d = new Date(2024, 0, 5);
    const r = addDays(d, -3);
    assert.equal(r.getDate(), 2);
  });

  it('does not mutate input', () => {
    const d = new Date(2024, 0, 15);
    const ts = d.getTime();
    addDays(d, 5);
    assert.equal(d.getTime(), ts);
  });
});

// ─── addMonths ────────────────────────────────────────────────────────────────

describe('addMonths', () => {
  it('adds 1 month normally', () => {
    const d = new Date(2024, 0, 15); // Jan 15
    const r = addMonths(d, 1);
    assert.equal(r.getMonth(), 1);
    assert.equal(r.getFullYear(), 2024);
    assert.equal(r.getDate(), 15);
  });

  it('crosses year boundary when adding', () => {
    const d = new Date(2024, 11, 15); // Dec 15
    const r = addMonths(d, 1);
    assert.equal(r.getMonth(), 0);
    assert.equal(r.getFullYear(), 2025);
  });

  it('crosses year boundary when subtracting', () => {
    const d = new Date(2024, 0, 15); // Jan 15
    const r = addMonths(d, -1);
    assert.equal(r.getMonth(), 11);
    assert.equal(r.getFullYear(), 2023);
  });

  it('clamps overflow: Jan 31 + 1 month (non-leap) → Feb 28', () => {
    const d = new Date(2023, 0, 31); // Jan 31, 2023 (not leap)
    const r = addMonths(d, 1);
    assert.equal(r.getMonth(), 1);
    assert.equal(r.getDate(), 28);
  });

  it('clamps overflow: Jan 31 + 1 month (leap) → Feb 29', () => {
    const d = new Date(2024, 0, 31); // Jan 31, 2024 (leap)
    const r = addMonths(d, 1);
    assert.equal(r.getMonth(), 1);
    assert.equal(r.getDate(), 29);
  });

  it('does not mutate input', () => {
    const d = new Date(2024, 0, 15);
    const ts = d.getTime();
    addMonths(d, 2);
    assert.equal(d.getTime(), ts);
  });
});

// ─── addYears ─────────────────────────────────────────────────────────────────

describe('addYears', () => {
  it('adds 1 year', () => {
    const d = new Date(2023, 5, 15);
    const r = addYears(d, 1);
    assert.equal(r.getFullYear(), 2024);
    assert.equal(r.getMonth(), 5);
    assert.equal(r.getDate(), 15);
  });

  it('subtracts 1 year', () => {
    const d = new Date(2024, 5, 15);
    const r = addYears(d, -1);
    assert.equal(r.getFullYear(), 2023);
  });

  it('handles leap day Feb 29 → Feb 28 in non-leap year', () => {
    const d = new Date(2024, 1, 29); // Feb 29, 2024 (leap)
    const r = addYears(d, 1);      // 2025 is not a leap year
    assert.equal(r.getFullYear(), 2025);
    assert.equal(r.getMonth(), 1);
    assert.equal(r.getDate(), 28);
  });

  it('does not mutate input', () => {
    const d = new Date(2024, 5, 15);
    const ts = d.getTime();
    addYears(d, 3);
    assert.equal(d.getTime(), ts);
  });
});

// ─── addHours / addMinutes ────────────────────────────────────────────────────

describe('addHours', () => {
  it('adds hours within the same day', () => {
    const d = new Date(2024, 0, 15, 10, 0, 0);
    const r = addHours(d, 3);
    assert.equal(r.getHours(), 13);
    assert.equal(r.getDate(), 15);
  });

  it('crosses midnight when adding hours', () => {
    const d = new Date(2024, 0, 15, 23, 0, 0);
    const r = addHours(d, 2);
    assert.equal(r.getHours(), 1);
    assert.equal(r.getDate(), 16);
  });

  it('subtracts hours with negative value', () => {
    const d = new Date(2024, 0, 15, 5, 0, 0);
    const r = addHours(d, -3);
    assert.equal(r.getHours(), 2);
  });

  it('does not mutate input', () => {
    const d = new Date(2024, 0, 15, 10, 0, 0);
    const ts = d.getTime();
    addHours(d, 5);
    assert.equal(d.getTime(), ts);
  });
});

describe('addMinutes', () => {
  it('adds minutes within the same hour', () => {
    const d = new Date(2024, 0, 15, 10, 20, 0);
    const r = addMinutes(d, 15);
    assert.equal(r.getMinutes(), 35);
    assert.equal(r.getHours(), 10);
  });

  it('rolls over to next hour', () => {
    const d = new Date(2024, 0, 15, 10, 50, 0);
    const r = addMinutes(d, 20);
    assert.equal(r.getMinutes(), 10);
    assert.equal(r.getHours(), 11);
  });

  it('subtracts minutes with negative value', () => {
    const d = new Date(2024, 0, 15, 10, 10, 0);
    const r = addMinutes(d, -15);
    assert.equal(r.getMinutes(), 55);
    assert.equal(r.getHours(), 9);
  });

  it('does not mutate input', () => {
    const d = new Date(2024, 0, 15, 10, 20, 0);
    const ts = d.getTime();
    addMinutes(d, 30);
    assert.equal(d.getTime(), ts);
  });
});

// ─── isBefore / isAfter ──────────────────────────────────────────────────────

describe('isBefore', () => {
  it('returns true when a is before b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 2);
    assert.equal(isBefore(a, b), true);
  });

  it('returns false when a is after b', () => {
    const a = new Date(2024, 0, 2);
    const b = new Date(2024, 0, 1);
    assert.equal(isBefore(a, b), false);
  });

  it('returns false when a equals b', () => {
    const d = new Date(2024, 0, 1);
    assert.equal(isBefore(d, d), false);
  });
});

describe('isAfter', () => {
  it('returns true when a is after b', () => {
    const a = new Date(2024, 0, 2);
    const b = new Date(2024, 0, 1);
    assert.equal(isAfter(a, b), true);
  });

  it('returns false when a is before b', () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 2);
    assert.equal(isAfter(a, b), false);
  });

  it('returns false when a equals b', () => {
    const d = new Date(2024, 0, 1);
    assert.equal(isAfter(d, d), false);
  });
});

// ─── isSameDay ────────────────────────────────────────────────────────────────

describe('isSameDay', () => {
  it('returns true for the same day at different times', () => {
    const a = new Date(2024, 3, 10, 8, 0, 0);
    const b = new Date(2024, 3, 10, 20, 0, 0);
    assert.equal(isSameDay(a, b), true);
  });

  it('returns false for different days', () => {
    const a = new Date(2024, 3, 10);
    const b = new Date(2024, 3, 11);
    assert.equal(isSameDay(a, b), false);
  });

  it('returns false for same day in different months', () => {
    const a = new Date(2024, 2, 10);
    const b = new Date(2024, 3, 10);
    assert.equal(isSameDay(a, b), false);
  });

  it('returns false for same month/day in different years', () => {
    const a = new Date(2023, 3, 10);
    const b = new Date(2024, 3, 10);
    assert.equal(isSameDay(a, b), false);
  });
});

// ─── diffInDays / diffInHours ─────────────────────────────────────────────────

describe('diffInDays', () => {
  it('returns whole days between two dates', () => {
    const a = new Date(2024, 0, 20);
    const b = new Date(2024, 0, 15);
    assert.equal(diffInDays(a, b), 5);
  });

  it('is symmetric (absolute value)', () => {
    const a = new Date(2024, 0, 15);
    const b = new Date(2024, 0, 20);
    assert.equal(diffInDays(a, b), 5);
  });

  it('returns 0 for the same day', () => {
    const d = new Date(2024, 0, 15, 10, 30);
    assert.equal(diffInDays(d, d), 0);
  });

  it('handles dates across month boundaries', () => {
    const a = new Date(2024, 1, 1); // Feb 1
    const b = new Date(2024, 0, 1); // Jan 1
    assert.equal(diffInDays(a, b), 31);
  });
});

describe('diffInHours', () => {
  it('returns whole hours between two dates', () => {
    const a = new Date(2024, 0, 15, 14, 0, 0);
    const b = new Date(2024, 0, 15, 9, 0, 0);
    assert.equal(diffInHours(a, b), 5);
  });

  it('is symmetric (absolute value)', () => {
    const a = new Date(2024, 0, 15, 9, 0, 0);
    const b = new Date(2024, 0, 15, 14, 0, 0);
    assert.equal(diffInHours(a, b), 5);
  });

  it('returns 0 for same timestamp', () => {
    const d = new Date(2024, 0, 15, 10, 30, 0);
    assert.equal(diffInHours(d, d), 0);
  });

  it('truncates partial hours', () => {
    const a = new Date(2024, 0, 15, 10, 0, 0);
    const b = new Date(2024, 0, 15, 8, 45, 0);
    assert.equal(diffInHours(a, b), 1); // 1h15m → floors to 1
  });
});

// ─── startOfDay / endOfDay ────────────────────────────────────────────────────

describe('startOfDay', () => {
  it('returns midnight on the same calendar day', () => {
    const d = new Date(2024, 3, 10, 14, 30, 45, 500);
    const r = startOfDay(d);
    assert.equal(r.getFullYear(), 2024);
    assert.equal(r.getMonth(), 3);
    assert.equal(r.getDate(), 10);
    assert.equal(r.getHours(), 0);
    assert.equal(r.getMinutes(), 0);
    assert.equal(r.getSeconds(), 0);
    assert.equal(r.getMilliseconds(), 0);
  });

  it('does not mutate the input', () => {
    const d = new Date(2024, 3, 10, 14, 30, 45);
    const ts = d.getTime();
    startOfDay(d);
    assert.equal(d.getTime(), ts);
  });
});

describe('endOfDay', () => {
  it('returns 23:59:59.999 on the same calendar day', () => {
    const d = new Date(2024, 3, 10, 8, 0, 0, 0);
    const r = endOfDay(d);
    assert.equal(r.getDate(), 10);
    assert.equal(r.getHours(), 23);
    assert.equal(r.getMinutes(), 59);
    assert.equal(r.getSeconds(), 59);
    assert.equal(r.getMilliseconds(), 999);
  });

  it('does not mutate the input', () => {
    const d = new Date(2024, 3, 10, 8, 0, 0);
    const ts = d.getTime();
    endOfDay(d);
    assert.equal(d.getTime(), ts);
  });
});

// ─── startOfMonth / endOfMonth ────────────────────────────────────────────────

describe('startOfMonth', () => {
  it('returns the first day of the month at midnight', () => {
    const d = new Date(2024, 3, 15, 10, 30, 0); // Apr 15
    const r = startOfMonth(d);
    assert.equal(r.getDate(), 1);
    assert.equal(r.getMonth(), 3);
    assert.equal(r.getFullYear(), 2024);
    assert.equal(r.getHours(), 0);
    assert.equal(r.getMinutes(), 0);
    assert.equal(r.getSeconds(), 0);
  });

  it('does not mutate the input', () => {
    const d = new Date(2024, 3, 15);
    const ts = d.getTime();
    startOfMonth(d);
    assert.equal(d.getTime(), ts);
  });
});

describe('endOfMonth', () => {
  it('returns last day of month at 23:59:59.999 (31-day month)', () => {
    const d = new Date(2024, 0, 15); // Jan
    const r = endOfMonth(d);
    assert.equal(r.getDate(), 31);
    assert.equal(r.getMonth(), 0);
    assert.equal(r.getHours(), 23);
    assert.equal(r.getMinutes(), 59);
    assert.equal(r.getSeconds(), 59);
    assert.equal(r.getMilliseconds(), 999);
  });

  it('returns Feb 29 for leap year February', () => {
    const d = new Date(2024, 1, 1); // Feb 2024 (leap)
    const r = endOfMonth(d);
    assert.equal(r.getDate(), 29);
    assert.equal(r.getMonth(), 1);
  });

  it('returns Feb 28 for non-leap year February', () => {
    const d = new Date(2023, 1, 1); // Feb 2023 (not leap)
    const r = endOfMonth(d);
    assert.equal(r.getDate(), 28);
  });

  it('does not mutate the input', () => {
    const d = new Date(2024, 3, 15);
    const ts = d.getTime();
    endOfMonth(d);
    assert.equal(d.getTime(), ts);
  });
});

// ─── daysInMonth ─────────────────────────────────────────────────────────────

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    assert.equal(daysInMonth(new Date(2024, 0, 1)), 31);
  });

  it('returns 28 for February in a non-leap year', () => {
    assert.equal(daysInMonth(new Date(2023, 1, 1)), 28);
  });

  it('returns 29 for February in a leap year', () => {
    assert.equal(daysInMonth(new Date(2024, 1, 1)), 29);
  });

  it('returns 30 for April', () => {
    assert.equal(daysInMonth(new Date(2024, 3, 1)), 30);
  });

  it('returns 31 for December', () => {
    assert.equal(daysInMonth(new Date(2024, 11, 1)), 31);
  });
});

// ─── isLeapYear ───────────────────────────────────────────────────────────────

describe('isLeapYear', () => {
  it('returns true for divisible by 4 but not 100', () => {
    assert.equal(isLeapYear(2024), true);
  });

  it('returns false for divisible by 100 but not 400', () => {
    assert.equal(isLeapYear(1900), false);
  });

  it('returns true for divisible by 400', () => {
    assert.equal(isLeapYear(2000), true);
  });

  it('returns false for a common year', () => {
    assert.equal(isLeapYear(2023), false);
  });

  it('returns false for year 1', () => {
    assert.equal(isLeapYear(1), false);
  });

  it('returns true for year 2000 (400-year rule)', () => {
    assert.equal(isLeapYear(2000), true);
  });
});

// ─── dayOfYear ────────────────────────────────────────────────────────────────

describe('dayOfYear', () => {
  it('returns 1 for January 1st', () => {
    assert.equal(dayOfYear(new Date(2024, 0, 1)), 1);
  });

  it('returns 32 for February 1st', () => {
    assert.equal(dayOfYear(new Date(2024, 1, 1)), 32);
  });

  it('returns 366 for December 31st in a leap year', () => {
    assert.equal(dayOfYear(new Date(2024, 11, 31)), 366);
  });

  it('returns 365 for December 31st in a non-leap year', () => {
    assert.equal(dayOfYear(new Date(2023, 11, 31)), 365);
  });

  it('is time-of-day independent', () => {
    const morning = new Date(2024, 2, 15, 6, 0, 0);
    const evening = new Date(2024, 2, 15, 22, 59, 59);
    assert.equal(dayOfYear(morning), dayOfYear(evening));
  });
});

// ─── weekOfYear ───────────────────────────────────────────────────────────────

describe('weekOfYear', () => {
  it('returns week 1 for Jan 1, 2024 (Monday)', () => {
    // Jan 1, 2024 is a Monday → ISO week 1
    assert.equal(weekOfYear(new Date(2024, 0, 1)), 1);
  });

  it('returns week 2 for Jan 8, 2024', () => {
    assert.equal(weekOfYear(new Date(2024, 0, 8)), 2);
  });

  it('returns week 52 or 53 for Dec 28 in most years', () => {
    const w = weekOfYear(new Date(2024, 11, 28));
    assert.ok(w === 52 || w === 53);
  });

  it('returns a value in range 1-53', () => {
    for (let month = 0; month < 12; month++) {
      const w = weekOfYear(new Date(2024, month, 15));
      assert.ok(w >= 1 && w <= 53, `week ${w} out of range for month ${month}`);
    }
  });

  it('Jan 1, 2023 (Sunday) belongs to week 52 of 2022', () => {
    // 2023-01-01 is a Sunday. ISO week: belongs to week 52 of 2022.
    assert.equal(weekOfYear(new Date(2023, 0, 1)), 52);
  });
});
