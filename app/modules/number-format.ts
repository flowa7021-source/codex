// @ts-check
// ─── Number Formatting Utilities ─────────────────────────────────────────────
// Pure math/string number formatting, parsing, and math utilities.
// No browser APIs (no Intl, no toLocaleString).

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormatNumberOptions {
  /** Number of decimal places. Default: `0` */
  decimals?: number;
  /** Thousands separator. Default: `','` */
  thousandsSep?: string;
  /** Decimal separator. Default: `'.'` */
  decimalSep?: string;
}

export interface ParseNumberOptions {
  /** Thousands separator. Default: `','` */
  thousandsSep?: string;
  /** Decimal separator. Default: `'.'` */
  decimalSep?: string;
}

export interface FormatCurrencyOptions {
  /** Currency symbol. Default: `'$'` */
  symbol?: string;
  /** Number of decimal places. Default: `2` */
  decimals?: number;
  /** Place symbol before the number. Default: `true` */
  symbolBefore?: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Split a non-negative integer string into groups of 3 with a separator. */
function insertThousandsSep(intStr: string, sep: string): string {
  if (sep === '') return intStr;
  let result = '';
  const len = intStr.length;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) {
      result += sep;
    }
    result += intStr[i];
  }
  return result;
}

// ─── Formatting functions ─────────────────────────────────────────────────────

/**
 * Format a number as a string with configurable thousands separator,
 * decimal separator, and number of decimal places.
 *
 * Defaults: 0 decimals, `','` thousands separator, `'.'` decimal separator.
 */
export function formatNumber(n: number, options?: FormatNumberOptions): string {
  const decimals = options?.decimals ?? 0;
  const thousandsSep = options?.thousandsSep ?? ',';
  const decimalSep = options?.decimalSep ?? '.';

  const negative = n < 0;
  const abs = Math.abs(n);

  // Round to the requested number of decimal places
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(abs * factor) / factor;

  // Split into integer and fractional parts
  const fixed = rounded.toFixed(decimals);
  const dotIndex = fixed.indexOf('.');
  const intPart = dotIndex === -1 ? fixed : fixed.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? '' : fixed.slice(dotIndex + 1);

  const intFormatted = insertThousandsSep(intPart, thousandsSep);

  let result = intFormatted;
  if (decimals > 0) {
    result += decimalSep + fracPart;
  }

  return negative ? '-' + result : result;
}

/**
 * Parse a formatted number string back to a JavaScript number.
 * Inverse of `formatNumber`.
 *
 * Defaults: `','` thousands separator, `'.'` decimal separator.
 */
export function parseNumber(str: string, options?: ParseNumberOptions): number {
  const thousandsSep = options?.thousandsSep ?? ',';
  const decimalSep = options?.decimalSep ?? '.';

  // Remove thousands separators
  let cleaned = str;
  if (thousandsSep !== '') {
    const sepEscaped = thousandsSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(sepEscaped, 'g'), '');
  }

  // Replace decimal separator with '.' for parseFloat
  if (decimalSep !== '.') {
    const sepEscaped = decimalSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(sepEscaped), '.');
  }

  const result = parseFloat(cleaned);
  if (isNaN(result)) return NaN;
  return result;
}

/**
 * Format a currency amount.
 *
 * Defaults: symbol `'$'`, 2 decimal places, symbol placed before the number.
 */
export function formatCurrency(amount: number, options?: FormatCurrencyOptions): string {
  const symbol = options?.symbol ?? '$';
  const decimals = options?.decimals ?? 2;
  const symbolBefore = options?.symbolBefore ?? true;

  const formatted = formatNumber(amount, { decimals, thousandsSep: ',', decimalSep: '.' });

  return symbolBefore ? symbol + formatted : formatted + symbol;
}

/**
 * Format a fraction as a percentage string.
 *
 * e.g. `formatPercent(0.1234, 1)` → `"12.3%"`
 */
export function formatPercent(n: number, decimals: number = 0): string {
  const pct = n * 100;
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(pct * factor) / factor;
  return formatNumber(rounded, { decimals, thousandsSep: '', decimalSep: '.' }) + '%';
}

/**
 * Format a byte count as a human-readable file size string.
 * Uses 1024-based units: B, KB, MB, GB, TB.
 *
 * e.g. `formatFileSize(1536, 1)` → `"1.5 KB"`
 */
export function formatFileSize(bytes: number, decimals: number = 1): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.abs(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const formatted = formatNumber(bytes < 0 ? -value : value, {
    decimals,
    thousandsSep: '',
    decimalSep: '.',
  });

  return formatted + ' ' + units[unitIndex];
}

/**
 * Format an integer as an ordinal string.
 *
 * e.g. `1` → `"1st"`, `11` → `"11th"`, `21` → `"21st"`
 */
export function formatOrdinal(n: number): string {
  const abs = Math.abs(n);
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

  return String(n) + suffix;
}

// ─── Roman numerals ───────────────────────────────────────────────────────────

const ROMAN_MAP: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/**
 * Convert a positive integer (1–3999) to a Roman numeral string.
 * Throws a `RangeError` for values outside [1, 3999].
 */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError(`toRoman: value must be an integer between 1 and 3999, got ${n}`);
  }

  let result = '';
  let remaining = n;

  for (const [value, numeral] of ROMAN_MAP) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

/**
 * Parse a Roman numeral string to a positive integer.
 * Throws a `TypeError` for invalid input.
 */
export function fromRoman(s: string): number {
  const upper = s.toUpperCase().trim();
  if (upper === '') {
    throw new TypeError(`fromRoman: empty string is not a valid Roman numeral`);
  }

  let result = 0;
  let prev = 0;

  for (let i = upper.length - 1; i >= 0; i--) {
    const ch = upper[i];
    const val = ROMAN_VALUES[ch];
    if (val === undefined) {
      throw new TypeError(`fromRoman: invalid character '${ch}' in Roman numeral '${s}'`);
    }
    if (val < prev) {
      result -= val;
    } else {
      result += val;
    }
    prev = val;
  }

  if (result < 1 || result > 3999) {
    throw new RangeError(`fromRoman: parsed value ${result} is outside range [1, 3999]`);
  }

  // Validate round-trip to reject malformed strings like "IIII"
  if (toRoman(result) !== upper) {
    throw new TypeError(`fromRoman: '${s}' is not a valid Roman numeral`);
  }

  return result;
}

// ─── Math utilities ───────────────────────────────────────────────────────────

/**
 * Clamp a number to the range [min, max].
 */
export function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * Linear interpolation between `a` and `b` by factor `t`.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Round a number to `decimals` decimal places.
 */
export function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Floor a number to `decimals` decimal places.
 */
export function floorTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(n * factor) / factor;
}

/**
 * Ceil a number to `decimals` decimal places.
 */
export function ceilTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(n * factor) / factor;
}

// ─── Number theory ────────────────────────────────────────────────────────────

/**
 * Return `true` if `n` is a prime number.
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

/**
 * Return the sorted prime factors of `n` (with repetition).
 * e.g. `primeFactors(12)` → `[2, 2, 3]`
 */
export function primeFactors(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) return [];
  const factors: number[] = [];
  let remaining = n;

  for (let d = 2; d * d <= remaining; d++) {
    while (remaining % d === 0) {
      factors.push(d);
      remaining = Math.floor(remaining / d);
    }
  }
  if (remaining > 1) {
    factors.push(remaining);
  }

  return factors;
}

/**
 * Greatest common divisor of two non-negative integers (Euclidean algorithm).
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.floor(a));
  b = Math.abs(Math.floor(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Least common multiple of two non-negative integers.
 */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.floor(a) * Math.floor(b)) / gcd(a, b);
}

/**
 * Return the nth Fibonacci number (0-indexed).
 * `fibonacci(0)` → 0, `fibonacci(1)` → 1, `fibonacci(2)` → 1, …
 * Throws a `RangeError` for `n < 0`.
 */
export function fibonacci(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`fibonacci: n must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return 0;
  let a = 0;
  let b = 1;
  for (let i = 1; i < n; i++) {
    const tmp = a + b;
    a = b;
    b = tmp;
  }
  return b;
}

/**
 * Return `n!` (factorial).
 * Throws a `RangeError` for `n < 0` or non-integer `n`.
 */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`factorial: n must be a non-negative integer, got ${n}`);
  }
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
