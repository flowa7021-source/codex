// @ts-check
// ─── Date/Time Utilities ─────────────────────────────────────────────────────
// Date manipulation, formatting, parsing, arithmetic, and comparison helpers.
// No external dependencies — pure Date API.

// ─── Internal constants ──────────────────────────────────────────────────────

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format a Date using a format string.
 *
 * Supported tokens (longest match wins):
 *   YYYY  — 4-digit year
 *   MMMM  — full month name (January)
 *   MMM   — abbreviated month (Jan)
 *   MM    — 2-digit month (01-12)
 *   DD    — 2-digit day of month (01-31)
 *   HH    — 2-digit hour, 24h (00-23)
 *   mm    — 2-digit minute (00-59)
 *   ss    — 2-digit second (00-59)
 *   dddd  — full weekday name (Monday)
 *   ddd   — abbreviated weekday (Mon)
 */
export function formatDate(date: Date, format: string): string {
  const dow = date.getDay();
  const month = date.getMonth();

  // Replace tokens longest-first to prevent partial matches
  return format
    .replace('YYYY', String(date.getFullYear()))
    .replace('MMMM', MONTHS_LONG[month])
    .replace('MMM', MONTHS_SHORT[month])
    .replace('MM', pad2(month + 1))
    .replace('DD', pad2(date.getDate()))
    .replace('HH', pad2(date.getHours()))
    .replace('mm', pad2(date.getMinutes()))
    .replace('ss', pad2(date.getSeconds()))
    .replace('dddd', DAYS_LONG[dow])
    .replace('ddd', DAYS_SHORT[dow]);
}

/**
 * Return a human-readable relative time string (past only).
 *
 * Examples: 'just now', '1 minute ago', '5 minutes ago', '1 hour ago',
 *           '2 hours ago', 'yesterday', '3 days ago', '2 weeks ago',
 *           '3 months ago', '2 years ago'
 *
 * @param date - The date to describe.
 * @param from - Reference point in time (defaults to now).
 */
export function formatRelative(date: Date, from: Date = new Date()): string {
  const diffMs = from.getTime() - date.getTime();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 45_000) return 'just now';

  const minutes = Math.round(absDiffMs / MS_PER_MINUTE);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  const hours = Math.round(absDiffMs / MS_PER_HOUR);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const days = Math.round(absDiffMs / MS_PER_DAY);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 8) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  const months = Math.round(days / 30.44);
  if (months < 24) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.round(days / 365.25);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a date string using the given format string.
 * Supports the same tokens as formatDate.
 * Throws an Error if the format or value is invalid.
 */
export function parseDate(str: string, format: string): Date {
  // Token definitions ordered longest-first to avoid prefix ambiguity
  const TOKEN_DEFS: Array<[string, string, string]> = [
    ['YYYY',  'year',       '(\\d{4})'],
    ['MMMM',  'monthLong',  '([A-Za-z]+)'],
    ['MMM',   'monthShort', '([A-Za-z]+)'],
    ['MM',    'month',      '(\\d{2})'],
    ['DD',    'day',        '(\\d{2})'],
    ['HH',    'hour',       '(\\d{2})'],
    ['mm',    'minute',     '(\\d{2})'],
    ['ss',    'second',     '(\\d{2})'],
    ['dddd',  'dowLong',    '([A-Za-z]+)'],
    ['ddd',   'dowShort',   '([A-Za-z]+)'],
  ];

  // Walk through the format string left-to-right, picking tokens greedily
  const groupOrder: string[] = [];
  let regexSource = '';
  let pos = 0;

  while (pos < format.length) {
    let matched = false;
    for (const [token, groupName, pattern] of TOKEN_DEFS) {
      if (format.startsWith(token, pos)) {
        regexSource += pattern;
        groupOrder.push(groupName);
        pos += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Escape the literal character for use in a regex
      regexSource += format[pos].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pos++;
    }
  }

  const regex = new RegExp(`^${regexSource}$`);
  const result = regex.exec(str);

  if (!result) {
    throw new Error(`parseDate: "${str}" does not match format "${format}"`);
  }

  let year = 1970;
  let month = 0; // 0-based
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  groupOrder.forEach((groupName, i) => {
    const value = result[i + 1];
    switch (groupName) {
      case 'year':
        year = parseInt(value, 10);
        break;
      case 'month':
        month = parseInt(value, 10) - 1;
        break;
      case 'monthShort': {
        const idx = MONTHS_SHORT.indexOf(value);
        if (idx === -1) throw new Error(`parseDate: unknown month abbreviation "${value}"`);
        month = idx;
        break;
      }
      case 'monthLong': {
        const idx = MONTHS_LONG.indexOf(value);
        if (idx === -1) throw new Error(`parseDate: unknown month name "${value}"`);
        month = idx;
        break;
      }
      case 'day':
        day = parseInt(value, 10);
        break;
      case 'hour':
        hour = parseInt(value, 10);
        break;
      case 'minute':
        minute = parseInt(value, 10);
        break;
      case 'second':
        second = parseInt(value, 10);
        break;
      // dowShort / dowLong are informational — ignored for construction
    }
  });

  const parsed = new Date(year, month, day, hour, minute, second, 0);

  // Validate: JS Date silently overflows (e.g. Feb 31 → Mar 3)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    throw new Error(`parseDate: invalid date values in "${str}"`);
  }

  return parsed;
}

// ─── Arithmetic ──────────────────────────────────────────────────────────────

/** Return a new Date with `days` added (may be negative). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Return a new Date with `months` added (may be negative).
 * If the resulting day overflows the target month (e.g. Jan 31 + 1 → Feb),
 * it is clamped to the last valid day of that month.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  // Overflow guard: if setMonth pushed into the next month, back up to last day
  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }
  return result;
}

/** Return a new Date with `years` added (may be negative). */
export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

/** Return a new Date with `hours` added (may be negative). */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR);
}

/** Return a new Date with `minutes` added (may be negative). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

// ─── Comparison ──────────────────────────────────────────────────────────────

/** Return true if date `a` is strictly before date `b`. */
export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/** Return true if date `a` is strictly after date `b`. */
export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

/** Return true if `a` and `b` fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Return the absolute difference between `a` and `b` in whole days. */
export function diffInDays(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY);
}

/** Return the absolute difference between `a` and `b` in whole hours. */
export function diffInHours(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / MS_PER_HOUR);
}

// ─── Info ────────────────────────────────────────────────────────────────────

/** Return a new Date set to midnight (00:00:00.000) on the same calendar day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** Return a new Date set to 23:59:59.999 on the same calendar day. */
export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Return a new Date set to the first day of the month at midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/** Return a new Date set to the last day of the month at 23:59:59.999. */
export function endOfMonth(date: Date): Date {
  // Day 0 of next month = last day of current month
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999);
}

/** Return the number of days in the month of the given date. */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Return true if the given year is a leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Return the 1-based day of the year (1–366). */
export function dayOfYear(date: Date): number {
  const jan1 = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
  const startOfToday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return Math.floor((startOfToday.getTime() - jan1.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Return the ISO 8601 week number (1–53).
 *
 * ISO weeks start on Monday. Week 1 contains the first Thursday of the year
 * (equivalently, the week containing January 4th).
 */
export function weekOfYear(date: Date): number {
  // Move to the nearest Thursday in the current ISO week (pivot day for ISO week numbering)
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // Sun=0 → 7, Mon=1 … Sat=6
  d.setDate(d.getDate() + 4 - dayOfWeek);
  // Jan 1 of the Thursday's year
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
}
