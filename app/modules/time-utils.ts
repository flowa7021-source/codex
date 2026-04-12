// @ts-check
// ─── Date/Time Utilities ──────────────────────────────────────────────────────
// Formatting, parsing, arithmetic, comparison, and range helpers for Date.
// No external dependencies — uses only the built-in JS Date object.
// All functions operate in local time (getFullYear, getMonth, etc.) so that
// behaviour is predictable when tests construct dates with the local-time
// constructor new Date(year, month-1, day, ...).

// ─── Duration constants ───────────────────────────────────────────────────────

const _MS_PER_SECOND = 1_000;
const _MS_PER_MINUTE = 60 * _MS_PER_SECOND;
const _MS_PER_HOUR   = 60 * _MS_PER_MINUTE;
const _MS_PER_DAY    = 24 * _MS_PER_HOUR;
const _MS_PER_MONTH  = 30 * _MS_PER_DAY;   // approximate for humanizeRelative
const _MS_PER_YEAR   = 365 * _MS_PER_DAY;  // approximate for humanizeRelative

// ─── Duration formatting & parsing ───────────────────────────────────────────

/**
 * Format milliseconds as "Xh Ym Zs".
 * Zero-valued units are omitted. Input of 0 ms returns "0s".
 *
 * @example
 *   formatDuration(9_000_000) // "2h 30m"
 *   formatDuration(45_000)    // "45s"
 *   formatDuration(3_605_000) // "1h 5s"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / _MS_PER_SECOND);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Parse a duration string of the form "Xh Ym Zs" back to milliseconds.
 * Each component is optional but at least one must be present.
 * Throws `RangeError` on invalid format.
 *
 * @example
 *   parseDuration("2h 30m") // 9_000_000
 *   parseDuration("45s")    // 45_000
 *   parseDuration("1h 5s")  // 3_605_000
 */
export function parseDuration(str: string): number {
  const trimmed = str.trim();
  if (trimmed === '') throw new RangeError(`Invalid duration string: "${str}"`);

  const pattern = /^(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s\s*)?$/;
  const match = pattern.exec(trimmed);

  if (!match || (match[1] === undefined && match[2] === undefined && match[3] === undefined)) {
    throw new RangeError(`Invalid duration string: "${str}"`);
  }

  const hours   = match[1] !== undefined ? parseInt(match[1], 10) : 0;
  const minutes = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  const seconds = match[3] !== undefined ? parseInt(match[3], 10) : 0;

  return (hours * _MS_PER_HOUR) + (minutes * _MS_PER_MINUTE) + (seconds * _MS_PER_SECOND);
}

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

// ─── Absolute day difference ──────────────────────────────────────────────────

/**
 * Return the absolute number of whole calendar days between two dates.
 * Time-of-day is ignored (dates are normalised to midnight UTC for the
 * arithmetic so that DST changes do not distort the result).
 */
export function diffDays(a: Date, b: Date): number {
  const msA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const msB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.abs(Math.round((msA - msB) / _MS_PER_DAY));
}

// ─── Clamping ─────────────────────────────────────────────────────────────────

/**
 * Clamp `date` so that it falls within [min, max].
 * Returns a new Date equal to `min` if `date < min`, `max` if `date > max`,
 * or a copy of `date` otherwise.
 */
export function clampDate(date: Date, min: Date, max: Date): Date {
  if (date.getTime() < min.getTime()) return new Date(min);
  if (date.getTime() > max.getTime()) return new Date(max);
  return new Date(date);
}

// ─── Unix timestamps ──────────────────────────────────────────────────────────

/** Convert a Date to a Unix timestamp (whole seconds since the Unix epoch). */
export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / _MS_PER_SECOND);
}

/** Convert a Unix timestamp (seconds since epoch) to a Date. */
export function fromUnixTimestamp(ts: number): Date {
  return new Date(ts * _MS_PER_SECOND);
}

// ─── Humanised relative time ──────────────────────────────────────────────────

/**
 * Return a human-readable description of a duration given in milliseconds.
 *
 * Thresholds (applied to the absolute value of `ms`):
 *   < 5 s              → "just now"
 *   < 60 s             → "X seconds ago"
 *   < 60 min           → "X minutes ago"
 *   < 24 h             → "X hours ago"
 *   < 30 days (~month) → "X days ago"
 *   < 365 days (~year) → "X months ago"
 *   else               → "X years ago"
 *
 * @example
 *   humanizeRelative(3_000)       // "just now"
 *   humanizeRelative(30_000)      // "30 seconds ago"
 *   humanizeRelative(3_600_000)   // "1 hour ago"
 *   humanizeRelative(86_400_000)  // "1 day ago"
 */
export function humanizeRelative(ms: number): string {
  const abs = Math.abs(ms);

  if (abs < 5 * _MS_PER_SECOND) return 'just now';

  if (abs < _MS_PER_MINUTE) {
    const s = Math.floor(abs / _MS_PER_SECOND);
    return `${s} second${s === 1 ? '' : 's'} ago`;
  }

  if (abs < _MS_PER_HOUR) {
    const m = Math.floor(abs / _MS_PER_MINUTE);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }

  if (abs < _MS_PER_DAY) {
    const h = Math.floor(abs / _MS_PER_HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }

  if (abs < _MS_PER_MONTH) {
    const d = Math.floor(abs / _MS_PER_DAY);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }

  if (abs < _MS_PER_YEAR) {
    const mo = Math.floor(abs / _MS_PER_MONTH);
    return `${mo} month${mo === 1 ? '' : 's'} ago`;
  }

  const y = Math.floor(abs / _MS_PER_YEAR);
  return `${y} year${y === 1 ? '' : 's'} ago`;
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
