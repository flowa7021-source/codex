// @ts-check
// ─── Locale Formatter ────────────────────────────────────────────────────────
// Intl.DateTimeFormat / Intl.RelativeTimeFormat wrapper for localized date/time.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Format a date as a localized string.
 */
export function formatDate(
  date: Date | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Format a date as a relative time string (e.g., "3 days ago", "in 2 hours").
 */
export function formatRelativeTime(
  date: Date | number,
  baseDate?: Date | number,
  locale?: string,
): string {
  const dateMs = typeof date === 'number' ? date : date.getTime();
  const baseMs = baseDate === undefined
    ? Date.now()
    : typeof baseDate === 'number' ? baseDate : baseDate.getTime();

  const diffSeconds = (dateMs - baseMs) / 1000;
  const absSeconds = Math.abs(diffSeconds);

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (absSeconds < 45) {
    value = Math.round(diffSeconds);
    unit = 'second';
  } else if (absSeconds < 2700) {
    // < 45 minutes
    value = Math.round(diffSeconds / 60);
    unit = 'minute';
  } else if (absSeconds < 79200) {
    // < 22 hours
    value = Math.round(diffSeconds / 3600);
    unit = 'hour';
  } else if (absSeconds < 1814400) {
    // < 21 days
    value = Math.round(diffSeconds / 86400);
    unit = 'day';
  } else if (absSeconds < 7776000) {
    // < 90 days
    value = Math.round(diffSeconds / 604800);
    unit = 'week';
  } else if (absSeconds < 31536000) {
    // < 1 year
    value = Math.round(diffSeconds / 2592000);
    unit = 'month';
  } else {
    value = Math.round(diffSeconds / 31536000);
    unit = 'year';
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}

/**
 * Format a date as a short time string (e.g., "3:45 PM").
 */
export function formatTime(date: Date | number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * Format a date as a short date string (e.g., "Apr 8, 2024").
 */
export function formatShortDate(date: Date | number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Get an array of weekday names in the given locale.
 */
export function getWeekdayNames(
  locale?: string,
  format: 'long' | 'short' | 'narrow' = 'long',
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  // Use a known Monday (2024-01-01 is a Monday) as day 0 offset
  // Jan 7, 2024 = Sunday; Jan 1 = Monday ... iterate Sun through Sat
  // Use fixed week: 2024-01-07 (Sun) through 2024-01-13 (Sat)
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    // 2024-01-07 is a Sunday (day index 0 = Sun)
    const d = new Date(2024, 0, 7 + i);
    names.push(formatter.format(d));
  }
  return names;
}

/**
 * Get an array of month names in the given locale.
 */
export function getMonthNames(
  locale?: string,
  format: 'long' | 'short' | 'narrow' = 'long',
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: format });
  const names: string[] = [];
  for (let m = 0; m < 12; m++) {
    names.push(formatter.format(new Date(2024, m, 1)));
  }
  return names;
}
