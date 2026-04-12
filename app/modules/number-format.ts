// @ts-check
// ─── Number Formatting & Parsing Library ─────────────────────────────────────
// Pure functions for formatting numbers, currencies, percentages, bytes,
// ordinals, durations, and scientific notation, plus parsing and math utilities.

// ─── formatNumber ────────────────────────────────────────────────────────────

/**
 * Formats a number with configurable decimal places and separators.
 * @param n - The number to format.
 * @param options - Optional formatting options.
 * @param options.decimals - Number of decimal places (default 2).
 * @param options.decimalSep - Decimal separator character (default '.').
 * @param options.thousandsSep - Thousands separator character (default ',').
 */
export function formatNumber(
  n: number,
  options?: { decimals?: number; decimalSep?: string; thousandsSep?: string },
): string {
  const decimals = options?.decimals ?? 2;
  const decimalSep = options?.decimalSep ?? '.';
  const thousandsSep = options?.thousandsSep ?? ',';

  const fixed = Math.abs(n).toFixed(decimals);
  const dotIndex = fixed.indexOf('.');
  const intPart = dotIndex === -1 ? fixed : fixed.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? '' : fixed.slice(dotIndex + 1);

  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);

  const sign = n < 0 ? '-' : '';
  if (fracPart.length > 0) {
    return `${sign}${intFormatted}${decimalSep}${fracPart}`;
  }
  return `${sign}${intFormatted}`;
}

// ─── formatThousands (internal helper) ───────────────────────────────────────

/** Internal helper: adds thousands separators to integer n. */
function formatThousands(n: number, separator = ','): string {
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
 * Formats a number as a currency string using Intl.NumberFormat.
 * @param amount - The monetary amount to format.
 * @param currency - ISO 4217 currency code (default 'USD').
 * @param options - Optional options.
 * @param options.decimals - Number of decimal places (default 2).
 * @param options.locale - BCP 47 locale string (default 'en-US').
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  options?: { decimals?: number; locale?: string },
): string {
  const cur = currency ?? 'USD';
  const decimals = options?.decimals ?? 2;
  const locale = options?.locale ?? 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
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
 * Formats a number in scientific notation.
 * e.g. 1234.5 → '1.23e+3'
 * @param n - The number to format.
 * @param decimals - Number of decimal places in the mantissa (default 2).
 */
export function formatScientific(n: number, decimals = 2): string {
  if (n === 0) return `0.${'0'.repeat(decimals)}e+0`;
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mantissa = n / Math.pow(10, exp);
  const sign = exp < 0 ? '-' : '+';
  const absExp = Math.abs(exp);
  return `${mantissa.toFixed(decimals)}e${sign}${absExp}`;
}

// ─── formatBytes ─────────────────────────────────────────────────────────────

/**
 * Formats a byte count as a human-readable string using base-1024 units.
 * Units: Bytes, KB, MB, GB, TB
 * @param bytes - Number of bytes.
 * @param decimals - Number of decimal places (default 2).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  if (bytes === 0) return '0 Bytes';
  const absBytes = Math.abs(bytes);
  const index = Math.min(Math.floor(Math.log(absBytes) / Math.log(1024)), units.length - 1);
  const value = absBytes / Math.pow(1024, index);
  return (bytes < 0 ? '-' : '') + value.toFixed(decimals) + ' ' + units[index];
}

// ─── formatDuration ──────────────────────────────────────────────────────────

/**
 * Formats a duration in milliseconds as a human-readable string.
 * Examples: '2h 30m', '45s', '1m 30s', '500ms'
 * Sub-second durations are shown as 'Xms'.
 * Hours: shows hours and optionally minutes (omits seconds).
 * Minutes: shows minutes and optionally seconds.
 * Seconds: shows only seconds.
 * @param ms - Duration in milliseconds.
 */
export function formatDuration(ms: number): string {
  const absMs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';

  if (absMs < 1000) {
    return `${sign}${Math.round(absMs)}ms`;
  }

  const totalSeconds = Math.floor(absMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    const parts = [`${hours}h`];
    if (minutes > 0) parts.push(`${minutes}m`);
    return sign + parts.join(' ');
  }
  if (minutes > 0) {
    const parts = [`${minutes}m`];
    if (seconds > 0) parts.push(`${seconds}s`);
    return sign + parts.join(' ');
  }
  return `${sign}${seconds}s`;
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
 * Parses a formatted number string (e.g. '1,234.56') into a number.
 * Strips thousands separators (commas) before parsing.
 * Throws if the result is NaN.
 * @param str - The string to parse.
 */
export function parseNumber(str: string): number {
  const cleaned = str.replace(/,/g, '').trim();
  const result = Number(cleaned);
  if (Number.isNaN(result)) {
    throw new Error(`parseNumber: invalid number string "${str}"`);
  }
  return result;
}

// ─── parsePercent ────────────────────────────────────────────────────────────

/**
 * Parses a percentage string (e.g. '12.34%') into a fractional number.
 * '12.34%' → 0.1234
 * @param str - The percentage string to parse.
 */
export function parsePercent(str: string): number {
  const cleaned = str.replace(/%/g, '').trim();
  const result = Number(cleaned);
  if (Number.isNaN(result)) {
    throw new Error(`parsePercent: invalid percent string "${str}"`);
  }
  return result / 100;
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

// ─── toFixed ─────────────────────────────────────────────────────────────────

/**
 * Behaves identically to Number.prototype.toFixed.
 * @param n - The number to format.
 * @param decimals - Number of decimal places.
 */
export function toFixed(n: number, decimals: number): string {
  return n.toFixed(decimals);
}

// ─── isPrime ─────────────────────────────────────────────────────────────────

/**
 * Returns true if n is a prime number.
 * Returns false for n < 2 and for non-integers.
 * @param n - The integer to test.
 */
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  const limit = Math.sqrt(n);
  for (let i = 3; i <= limit; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// ─── gcd ─────────────────────────────────────────────────────────────────────

/**
 * Returns the greatest common divisor of two integers using the Euclidean
 * algorithm. Always returns a non-negative value.
 * @param a - First integer.
 * @param b - Second integer.
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// ─── lcm ─────────────────────────────────────────────────────────────────────

/**
 * Returns the least common multiple of two integers.
 * Returns 0 if either operand is 0.
 * @param a - First integer.
 * @param b - Second integer.
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.round(a) * Math.round(b)) / gcd(a, b);
}

// ─── factorial ───────────────────────────────────────────────────────────────

/**
 * Returns the factorial of a non-negative integer n.
 * Throws for negative n or n > 20 (to avoid unsafe integer overflow).
 * @param n - The non-negative integer.
 */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`factorial: n must be a non-negative integer, got ${n}`);
  }
  if (n > 20) {
    throw new Error(`factorial: n must be ≤ 20, got ${n}`);
  }
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

// ─── fibonacci ───────────────────────────────────────────────────────────────

/**
 * Returns the nth Fibonacci number (0-indexed).
 * fib(0) = 0, fib(1) = 1, fib(2) = 1, fib(3) = 2, ...
 * @param n - The index (non-negative integer).
 */
export function fibonacci(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`fibonacci: n must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return 0;
  if (n === 1) return 1;
  let a = 0;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

// ─── randomInt ───────────────────────────────────────────────────────────────

/**
 * Returns a random integer in the inclusive range [min, max].
 * @param min - Minimum value (inclusive).
 * @param max - Maximum value (inclusive).
 */
export function randomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── randomFloat ─────────────────────────────────────────────────────────────

/**
 * Returns a random float in the range [min, max).
 * @param min - Minimum value (inclusive).
 * @param max - Maximum value (exclusive).
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}


// ─── Additional exports ───────────────────────────────────────────────────────

/** Format a number to a fixed number of decimal places (default 2). */
export function formatDecimal(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

export { formatThousands };
