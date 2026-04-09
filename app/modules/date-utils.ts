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
