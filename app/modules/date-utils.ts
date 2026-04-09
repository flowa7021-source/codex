// @ts-check
// ─── Date Utilities ───────────────────────────────────────────────────────────
// General-purpose date manipulation helpers.

// ─── Public API ──────────────────────────────────────────────────────────────

/** Add days to a date. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/** Add months to a date. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  // If the day overflowed (e.g., Jan 31 + 1 month → Mar 3), clamp to last day of the target month.
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

/** Add years to a date. */
export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

/** Get the start of a day (midnight). */
export function startOfDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Get the end of a day (23:59:59.999). */
export function endOfDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

/** Get the start of a month. */
export function startOfMonth(date: Date): Date {
  const result = new Date(date.getTime());
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Get the end of a month. */
export function endOfMonth(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

/** Check if two dates are the same day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whether a date is today. */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Check if a date is before another date. */
export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/** Check if a date is after another date. */
export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

/** Get the difference between two dates in the given unit. */
export function diffDates(
  a: Date,
  b: Date,
  unit: 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds',
): number {
  const ms = a.getTime() - b.getTime();
  switch (unit) {
    case 'milliseconds': return ms;
    case 'seconds':      return ms / 1_000;
    case 'minutes':      return ms / 60_000;
    case 'hours':        return ms / 3_600_000;
    case 'days':         return ms / 86_400_000;
  }
}

/** Get the difference between two dates in days. */
export function diffInDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.trunc((a.getTime() - b.getTime()) / msPerDay);
}

/** Get the difference between two dates in months. */
export function diffInMonths(a: Date, b: Date): number {
  return (
    (a.getFullYear() - b.getFullYear()) * 12 +
    (a.getMonth() - b.getMonth())
  );
}

/** Get the start of the week (Monday, midnight). */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getTime());
  // getDay() returns 0 (Sun) – 6 (Sat); convert to ISO Mon=0 … Sun=6
  const dow = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - dow);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Get the number of days in a month (month is 1-based: 1=Jan … 12=Dec). */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of the given month
  return new Date(year, month, 0).getDate();
}

/** Parse a date string in ISO format (YYYY-MM-DD). Returns null on failure. */
export function parseISODate(str: string): Date | null {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [year, month, day] = str.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return new Date(year, month - 1, day);
}

/** Format a date as ISO date string (YYYY-MM-DD). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get the ISO week number of a date (1-53). */
export function getWeekNumber(date: Date): number {
  // Copy date and shift to Thursday in the current week (ISO week starts Monday).
  const target = new Date(date.getTime());
  target.setHours(0, 0, 0, 0);
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1 … Sun=7)
  const dayOfWeek = target.getDay() || 7; // Sunday = 7 instead of 0
  target.setDate(target.getDate() + 4 - dayOfWeek);
  // Get first day of year
  const yearStart = new Date(target.getFullYear(), 0, 1);
  // Calculate full weeks to nearest Thursday
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Check if a year is a leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse a date from a string (ISO 8601 or common formats). Returns null on failure. */
export function parseDate(str: string): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Format a date as YYYY-MM-DD. */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Format a date using a simple format string: YYYY, MM, DD, HH, mm, ss */
export function formatDate(date: Date, format: string): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/** Parse a date from ISO string or numeric timestamp. */
export function parseDateInput(input: string | number): Date {
  if (typeof input === 'number') return new Date(input);
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new RangeError(`Invalid date: ${input}`);
  return d;
}

/** Add an amount of time to a date. Returns a new Date. */
export function addTime(
  date: Date,
  amount: number,
  unit: 'days' | 'hours' | 'minutes' | 'seconds' | 'months' | 'years',
): Date {
  const result = new Date(date.getTime());
  switch (unit) {
    case 'seconds':
      result.setSeconds(result.getSeconds() + amount);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount);
      break;
    case 'hours':
      result.setHours(result.getHours() + amount);
      break;
    case 'days':
      result.setDate(result.getDate() + amount);
      break;
    case 'months': {
      const day = result.getDate();
      result.setMonth(result.getMonth() + amount);
      if (result.getDate() !== day) result.setDate(0);
      break;
    }
    case 'years': {
      const day = result.getDate();
      result.setFullYear(result.getFullYear() + amount);
      if (result.getDate() !== day) result.setDate(0);
      break;
    }
  }
  return result;
}

/** Get the difference between two dates in the specified unit (truncated). */
export function diffTime(
  a: Date,
  b: Date,
  unit: 'days' | 'hours' | 'minutes' | 'seconds' | 'months' | 'years',
): number {
  switch (unit) {
    case 'seconds':  return Math.trunc((a.getTime() - b.getTime()) / 1_000);
    case 'minutes':  return Math.trunc((a.getTime() - b.getTime()) / 60_000);
    case 'hours':    return Math.trunc((a.getTime() - b.getTime()) / 3_600_000);
    case 'days':     return Math.trunc((a.getTime() - b.getTime()) / 86_400_000);
    case 'months':
      return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
    case 'years':
      return a.getFullYear() - b.getFullYear();
  }
}

/** Check if a date is between two others (inclusive). */
export function isBetween(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Get the day of the year (1-366). */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Get the ISO week of the year (1-53). */
export function weekOfYear(date: Date): number {
  return getWeekNumber(date);
}

/** Relative time string: '2 hours ago', 'in 3 days', 'just now'. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);

  const seconds = Math.round(absDiffMs / 1_000);
  const minutes = Math.round(absDiffMs / 60_000);
  const hours   = Math.round(absDiffMs / 3_600_000);
  const days    = Math.round(absDiffMs / 86_400_000);
  const months  = Math.round(absDiffMs / (30 * 86_400_000));
  const years   = Math.round(absDiffMs / (365 * 86_400_000));

  let label: string;
  if (seconds < 45) {
    label = 'just now';
    return label;
  } else if (seconds < 90) {
    label = '1 minute';
  } else if (minutes < 45) {
    label = `${minutes} minutes`;
  } else if (minutes < 90) {
    label = '1 hour';
  } else if (hours < 22) {
    label = `${hours} hours`;
  } else if (hours < 36) {
    label = '1 day';
  } else if (days < 26) {
    label = `${days} days`;
  } else if (days < 45) {
    label = '1 month';
  } else if (days < 345) {
    label = `${months} months`;
  } else if (days < 545) {
    label = '1 year';
  } else {
    label = `${years} years`;
  }

  return diffMs < 0 ? `${label} ago` : `in ${label}`;
}
