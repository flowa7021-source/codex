// @ts-check
// ─── Date/Time Utilities ──────────────────────────────────────────────────────
// Formatting, parsing, arithmetic, comparison, and range helpers for Date.
// No external dependencies — uses only the built-in JS Date object.
// All functions operate in local time (getFullYear, getMonth, etc.) so that
// behaviour is predictable when tests construct dates with the local-time
// constructor new Date(year, month-1, day, ...).

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format a Date using a template string.
 *
 * Supported tokens:
 *   YYYY  – 4-digit year
 *   MM    – 2-digit month (01-12)
 *   DD    – 2-digit day   (01-31)
 *   HH    – 2-digit hours (00-23)
 *   mm    – 2-digit minutes (00-59)
 *   ss    – 2-digit seconds (00-59)
 *   SSS   – 3-digit milliseconds (000-999)
 */
export function formatDate(date: Date, format: string): string {
  const year  = date.getFullYear();
  const month = date.getMonth() + 1;
  const day   = date.getDate();
  const hours = date.getHours();
  const mins  = date.getMinutes();
  const secs  = date.getSeconds();
  const ms    = date.getMilliseconds();

  return format
    .replace('YYYY', String(year).padStart(4, '0'))
    .replace('MM',   String(month).padStart(2, '0'))
    .replace('DD',   String(day).padStart(2, '0'))
    .replace('HH',   String(hours).padStart(2, '0'))
    .replace('mm',   String(mins).padStart(2, '0'))
    .replace('ss',   String(secs).padStart(2, '0'))
    .replace('SSS',  String(ms).padStart(3, '0'));
}

/**
 * Return a human-readable relative time string.
 *
 * Thresholds (using absolute difference in seconds):
 *   < 45 s           → 'just now'
 *   < 90 s           → '1 minute ago'
 *   < 45 min         → 'N minutes ago'
 *   < 90 min         → '1 hour ago'
 *   < 22 h           → 'N hours ago'
 *   < 36 h           → 'yesterday'
 *   < 25 d           → 'N days ago'
 *   < 45 d           → '1 month ago'
 *   < 345 d          → 'N months ago'
 *   < 545 d          → '1 year ago'
 *   else             → 'N years ago'
 *
 * @param date - The date to describe.
 * @param now  - Reference point (defaults to current time).
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs   = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const absSecs  = Math.abs(diffSecs);

  if (absSecs < 45)            return 'just now';
  if (absSecs < 90)            return '1 minute ago';
  if (absSecs < 45 * 60)      return `${Math.round(absSecs / 60)} minutes ago`;
  if (absSecs < 90 * 60)      return '1 hour ago';
  if (absSecs < 22 * 3600)    return `${Math.round(absSecs / 3600)} hours ago`;
  if (absSecs < 36 * 3600)    return 'yesterday';
  if (absSecs < 25 * 86400)   return `${Math.round(absSecs / 86400)} days ago`;
  if (absSecs < 45 * 86400)   return '1 month ago';
  if (absSecs < 345 * 86400)  return `${Math.round(absSecs / (30 * 86400))} months ago`;
  if (absSecs < 545 * 86400)  return '1 year ago';
  return `${Math.round(absSecs / (365 * 86400))} years ago`;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a date string using a format template (same tokens as formatDate).
 * Throws a RangeError when the string does not match the format or the
 * resulting date is invalid.
 *
 * Token defaults when absent from the format:
 *   month, day → 1;  hours, mins, secs, ms → 0
 */
export function parseDate(str: string, format: string): Date {
  // Build a regex from the format by replacing tokens with named capturing groups.
  // Order matters: replace longer tokens first to avoid partial collisions.
  const tokenRegexMap: Record<string, string> = {
    YYYY: '(?<YYYY>\\d{4})',
    SSS:  '(?<SSS>\\d{3})',
    MM:   '(?<MM>\\d{2})',
    DD:   '(?<DD>\\d{2})',
    HH:   '(?<HH>\\d{2})',
    mm:   '(?<mm>\\d{2})',
    ss:   '(?<ss>\\d{2})',
  };
  const tokenOrder = ['YYYY', 'SSS', 'MM', 'DD', 'HH', 'mm', 'ss'];

  // Escape regex meta-characters in the literal parts of the format string,
  // then substitute each token placeholder for its capturing group pattern.
  let regexStr = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const token of tokenOrder) {
    regexStr = regexStr.split(token).join(tokenRegexMap[token]);
  }

  const regex = new RegExp(`^${regexStr}$`);
  const match = str.match(regex);
  if (!match || !match.groups) {
    throw new RangeError(`Cannot parse "${str}" with format "${format}"`);
  }

  const g = match.groups;
  const year  = g['YYYY'] !== undefined ? parseInt(g['YYYY'], 10) : 1970;
  const month = g['MM']   !== undefined ? parseInt(g['MM'],   10) : 1;
  const day   = g['DD']   !== undefined ? parseInt(g['DD'],   10) : 1;
  const hours = g['HH']   !== undefined ? parseInt(g['HH'],   10) : 0;
  const mins  = g['mm']   !== undefined ? parseInt(g['mm'],   10) : 0;
  const secs  = g['ss']   !== undefined ? parseInt(g['ss'],   10) : 0;
  const ms    = g['SSS']  !== undefined ? parseInt(g['SSS'],  10) : 0;

  const result = new Date(year, month - 1, day, hours, mins, secs, ms);
  if (isNaN(result.getTime())) {
    throw new RangeError(`Invalid date values in "${str}"`);
  }
  return result;
}

// ─── Arithmetic ──────────────────────────────────────────────────────────────

/** Return a new Date that is `n` days after (or before if negative) `date`. */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Return a new Date that is `n` months after (or before if negative) `date`.
 * The day is clamped automatically by the JS Date engine to the last day of
 * the resulting month (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function addMonths(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + n);
  return result;
}

/** Return a new Date that is `n` years after (or before if negative) `date`. */
export function addYears(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setFullYear(result.getFullYear() + n);
  return result;
}

/** Return a new Date that is `n` hours after (or before if negative) `date`. */
export function addHours(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 3_600_000);
}

/** Return a new Date that is `n` minutes after (or before if negative) `date`. */
export function addMinutes(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 60_000);
}

/** Return a new Date that is `n` seconds after (or before if negative) `date`. */
export function addSeconds(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 1_000);
}

// ─── Comparison ──────────────────────────────────────────────────────────────

/** Return true when `a` is strictly before `b`. */
export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/** Return true when `a` is strictly after `b`. */
export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

/** Return true when `a` and `b` fall on the same calendar day (local time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

/**
 * Signed difference in whole days: how many whole days is `a` ahead of `b`.
 * Positive when a > b, negative when a < b.
 */
export function diffInDays(a: Date, b: Date): number {
  return Math.trunc((a.getTime() - b.getTime()) / 86_400_000);
}

/** Signed difference in whole hours (a - b). */
export function diffInHours(a: Date, b: Date): number {
  return Math.trunc((a.getTime() - b.getTime()) / 3_600_000);
}

/** Signed difference in whole minutes (a - b). */
export function diffInMinutes(a: Date, b: Date): number {
  return Math.trunc((a.getTime() - b.getTime()) / 60_000);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Return true when `date` falls on Saturday (6) or Sunday (0). */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Return true when `year` is a leap year (Gregorian). */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Return the number of days in the given month.
 * @param month - 1-indexed (1 = January, 12 = December).
 */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month equals the last day of the given month.
  return new Date(year, month, 0).getDate();
}

/** Return a new Date representing midnight (00:00:00.000) of the same day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** Return a new Date representing the last millisecond (23:59:59.999) of the same day. */
export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Return a new Date for the first day of the same month at 00:00:00.000. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/** Return a new Date for the last day of the same month at 23:59:59.999. */
export function endOfMonth(date: Date): Date {
  const lastDay = daysInMonth(date.getFullYear(), date.getMonth() + 1);
  return new Date(date.getFullYear(), date.getMonth(), lastDay, 23, 59, 59, 999);
}

// ─── Ranges ──────────────────────────────────────────────────────────────────

/**
 * Build an array of dates from `start` to `end` (inclusive), stepping by
 * 'day' (default), 'month', or 'year'.
 *
 * If `end` is before `start` an empty array is returned.
 */
export function dateRange(
  start: Date,
  end: Date,
  step: 'day' | 'month' | 'year' = 'day',
): Date[] {
  const result: Date[] = [];
  let current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    result.push(new Date(current.getTime()));
    switch (step) {
      case 'day':
        current = addDays(current, 1);
        break;
      case 'month':
        current = addMonths(current, 1);
        break;
      case 'year':
        current = addYears(current, 1);
        break;
    }
  }

  return result;
}
