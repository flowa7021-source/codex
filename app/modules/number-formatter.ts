// @ts-check
// ─── Number Formatter ─────────────────────────────────────────────────────────
// Number and currency formatting utilities.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormatOptions {
  decimals?: number;   // decimal places, default 2
  thousands?: string;  // thousands separator, default ','
  decimal?: string;    // decimal separator, default '.'
  prefix?: string;     // e.g. '$'
  suffix?: string;     // e.g. '%'
}

// ─── formatNumber ─────────────────────────────────────────────────────────────

/** Format a number with separators. */
export function formatNumber(value: number, options?: FormatOptions): string {
  const decimals = options?.decimals ?? 2;
  const thousands = options?.thousands ?? ',';
  const decimalSep = options?.decimal ?? '.';
  const prefix = options?.prefix ?? '';
  const suffix = options?.suffix ?? '';

  const isNegative = value < 0;
  const abs = Math.abs(value);
  const fixed = abs.toFixed(decimals);

  const parts = fixed.split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Insert thousands separators
  let formattedInt = '';
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0 && thousands !== '') {
      formattedInt += thousands;
    }
    formattedInt += intPart[i];
  }

  const numStr =
    decimals > 0 ? `${formattedInt}${decimalSep}${decPart}` : formattedInt;

  return `${prefix}${isNegative ? '-' : ''}${numStr}${suffix}`;
}

// ─── formatCurrency ───────────────────────────────────────────────────────────

/** Format as currency (e.g., '$1,234.56'). */
export function formatCurrency(
  value: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

// ─── formatPercent ────────────────────────────────────────────────────────────

/** Format as percentage. Input is 0-100 (e.g., 12.5 → '12.50%'). */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// ─── formatCompact ────────────────────────────────────────────────────────────

/** Format a large number with suffix (K, M, B, T). */
export function formatCompact(value: number, decimals = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const thresholds: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];

  for (const [threshold, suffix] of thresholds) {
    if (abs >= threshold) {
      const divided = abs / threshold;
      // Remove trailing zeros after decimal point
      const formatted = parseFloat(divided.toFixed(decimals)).toString();
      return `${sign}${formatted}${suffix}`;
    }
  }

  return `${sign}${parseFloat(abs.toFixed(decimals)).toString()}`;
}

// ─── parseFormattedNumber ─────────────────────────────────────────────────────

/** Parse a formatted number string back to number. */
export function parseFormattedNumber(str: string): number {
  // Remove thousands separators (commas) and strip non-numeric chars except dot and leading minus
  const withoutCommas = str.replace(/,/g, '');
  // Keep only digits, decimal point, and a leading minus
  const match = withoutCommas.match(/^[^0-9\-]*(-?[0-9]*\.?[0-9]*)/);
  if (!match || match[1] === '' || match[1] === '.') return NaN;
  return parseFloat(match[1]);
}

// ─── formatBytes ─────────────────────────────────────────────────────────────

/** Format bytes as human-readable string. */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${parseFloat(value.toFixed(decimals))} ${sizes[i]}`;
}

// ─── clampNumber ─────────────────────────────────────────────────────────────

/** Clamp a number between min and max. */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ─── roundDecimal ─────────────────────────────────────────────────────────────

/** Round to N decimal places. */
export function roundDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── isNumeric ────────────────────────────────────────────────────────────────

/** Check if a string is a valid number. */
export function isNumeric(value: string): boolean {
  if (value.trim() === '') return false;
  return !isNaN(Number(value));
}

// ─── toOrdinal ────────────────────────────────────────────────────────────────

/** Convert number to ordinal string (1 → '1st', 2 → '2nd', etc.). */
export function toOrdinal(n: number): string {
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

  return `${n}${suffix}`;
}
