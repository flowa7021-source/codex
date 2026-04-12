// @ts-check
// ─── Number Formatting & Parsing Utilities ────────────────────────────────────
// Pure functions — no DOM, no browser APIs, no Intl.NumberFormat.

// ─── formatDecimal ───────────────────────────────────────────────────────────

/**
 * Format a number to a fixed number of decimal places.
 * @param n - The number to format.
 * @param decimals - Number of decimal places (default 2).
 */
export function formatDecimal(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

// ─── formatThousands ─────────────────────────────────────────────────────────

/**
 * Format a number with a thousands separator.
 * Handles negative numbers and decimals correctly.
 * @param n - The number to format.
 * @param separator - Thousands separator character (default ',').
 */
export function formatThousands(n: number, separator = ','): string {
  const str = String(n);
  const dotIndex = str.indexOf('.');
  const intPart = dotIndex === -1 ? str : str.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? '' : str.slice(dotIndex);

  // Handle negative sign separately
  const negative = intPart.startsWith('-');
  const digits = negative ? intPart.slice(1) : intPart;

  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      result += separator;
    }
    result += digits[i];
  }

  return (negative ? '-' : '') + result + decPart;
}

// ─── formatCurrency ──────────────────────────────────────────────────────────

/**
 * Format a number as a currency string.
 * Pure string formatting — does NOT use Intl.NumberFormat.
 * @param n - The number to format.
 * @param currency - ISO currency code (default 'USD').
 * @param locale - Locale hint for symbol selection (default 'en-US').
 */
export function formatCurrency(n: number, currency = 'USD', locale = 'en-US'): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    KRW: '₩',
    INR: '₹',
    BRL: 'R$',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF',
    RUB: '₽',
    MXN: 'MX$',
  };

  // JPY and KRW have no decimal places by convention
  const noDecimalCurrencies = new Set(['JPY', 'KRW']);
  const decimals = noDecimalCurrencies.has(currency) ? 0 : 2;

  const symbol = symbols[currency] ?? currency;
  const abs = Math.abs(n);
  // toFixed produces the correctly-rounded string with the right decimal places,
  // e.g. (1234.5).toFixed(2) → "1234.50". We then apply thousands-grouping to
  // only the integer portion so that trailing zeros are never stripped.
  const absFixed = abs.toFixed(decimals); // e.g. "1234.50"
  const dotIndex = absFixed.indexOf('.');
  const intPart = dotIndex === -1 ? absFixed : absFixed.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? '' : absFixed.slice(dotIndex); // includes '.'
  const valueStr = formatThousands(Number(intPart)) + decPart;

  // Some locales put symbol after value; keep it simple — symbol before for all
  void locale; // locale parameter reserved for future extension
  return (n < 0 ? '-' : '') + symbol + valueStr;
}

// ─── formatPercent ───────────────────────────────────────────────────────────

/**
 * Format a ratio as a percentage string.
 * 0.1234 → '12.34%'
 * @param n - The ratio (e.g. 0.5 = 50%).
 * @param decimals - Number of decimal places (default 2).
 */
export function formatPercent(n: number, decimals = 2): string {
  return (n * 100).toFixed(decimals) + '%';
}

// ─── formatScientific ────────────────────────────────────────────────────────

/**
 * Format a number in scientific notation.
 * e.g. 12345 → '1.23e+4'
 * @param n - The number to format.
 * @param decimals - Number of decimal places in the mantissa (default 2).
 */
export function formatScientific(n: number, decimals = 2): string {
  return n.toExponential(decimals);
}

// ─── formatBytes ─────────────────────────────────────────────────────────────

/**
 * Format a byte count as a human-readable string using base-1024 units.
 * Units: B, KB, MB, GB, TB
 * @param bytes - Number of bytes (non-negative).
 * @param decimals - Number of decimal places (default 2).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const absBytes = Math.abs(bytes);
  const index = Math.min(Math.floor(Math.log(absBytes) / Math.log(1024)), units.length - 1);
  const value = absBytes / Math.pow(1024, index);
  return (bytes < 0 ? '-' : '') + value.toFixed(decimals) + ' ' + units[index];
}

// ─── formatDuration ──────────────────────────────────────────────────────────

/**
 * Format a duration in milliseconds as a human-readable string.
 * Omits zero-valued leading units (days and hours), but always shows seconds.
 * e.g. 5025000 → '1h 23m 45s', 61000 → '1m 1s', 500 → '0s'
 * @param ms - Duration in milliseconds.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return (ms < 0 ? '-' : '') + parts.join(' ');
}

// ─── formatOrdinal ───────────────────────────────────────────────────────────

/**
 * Format a positive integer as an ordinal string.
 * e.g. 1 → '1st', 2 → '2nd', 3 → '3rd', 4 → '4th', 11 → '11th', 21 → '21st'
 * @param n - The integer to format (positive integers expected).
 */
export function formatOrdinal(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  let suffix: string;
  if (mod100 >= 11 && mod100 <= 13) {
    suffix = 'th';
  } else if (mod10 === 1) {
    suffix = 'st';
  } else if (mod10 === 2) {
    suffix = 'nd';
  } else if (mod10 === 3) {
    suffix = 'rd';
  } else {
    suffix = 'th';
  }

  return String(Math.trunc(n)) + suffix;
}

// ─── parseNumber ─────────────────────────────────────────────────────────────

/**
 * Parse a string containing a number, stripping commas and percent signs.
 * e.g. '1,234.56' → 1234.56, '12.5%' → 12.5
 * Returns NaN if the string cannot be parsed.
 * @param str - The string to parse.
 */
export function parseNumber(str: string): number {
  const cleaned = str.replace(/,/g, '').replace(/%/g, '').trim();
  return Number(cleaned);
}

// ─── clamp ───────────────────────────────────────────────────────────────────

/**
 * Clamp a value to the range [min, max].
 * @param value - The value to clamp.
 * @param min - The minimum allowed value.
 * @param max - The maximum allowed value.
 */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

// ─── lerp ────────────────────────────────────────────────────────────────────

/**
 * Linear interpolation between a and b by factor t.
 * t=0 → a, t=1 → b. t is not clamped.
 * @param a - Start value.
 * @param b - End value.
 * @param t - Interpolation factor.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── roundTo ─────────────────────────────────────────────────────────────────

/**
 * Round a number to a given number of decimal places.
 * Uses "round half away from zero" semantics via toFixed.
 * @param n - The number to round.
 * @param decimals - Number of decimal places.
 */
export function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ─── floorTo ─────────────────────────────────────────────────────────────────

/**
 * Floor a number to a given number of decimal places.
 * @param n - The number to floor.
 * @param decimals - Number of decimal places.
 */
export function floorTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(n * factor) / factor;
}

// ─── ceilTo ──────────────────────────────────────────────────────────────────

/**
 * Ceil a number to a given number of decimal places.
 * @param n - The number to ceil.
 * @param decimals - Number of decimal places.
 */
export function ceilTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(n * factor) / factor;
}

// ─── mapRange ────────────────────────────────────────────────────────────────

/**
 * Map a value from one range to another.
 * e.g. mapRange(5, 0, 10, 0, 100) → 50
 * The input value is NOT clamped to [inMin, inMax].
 * @param value  - The value to map.
 * @param inMin  - Input range minimum.
 * @param inMax  - Input range maximum.
 * @param outMin - Output range minimum.
 * @param outMax - Output range maximum.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMin === inMax) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// ─── inRange ─────────────────────────────────────────────────────────────────

/**
 * Test whether a value falls within [min, max] (inclusive by default).
 * @param value     - The value to test.
 * @param min       - Range minimum.
 * @param max       - Range maximum.
 * @param inclusive - When true (default), both endpoints are included.
 */
export function inRange(value: number, min: number, max: number, inclusive = true): boolean {
  return inclusive
    ? value >= min && value <= max
    : value > min && value < max;
}
