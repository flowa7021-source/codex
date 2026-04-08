// @ts-check
// ─── Number Formatter ────────────────────────────────────────────────────────
// Intl.NumberFormat wrapper for localized number, currency, and byte formatting.

// ─── Internal constants ───────────────────────────────────────────────────────

const KB = 1024;
const MB = 1024 ** 2;
const GB = 1024 ** 3;
const TB = 1024 ** 4;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Format a number as a localized string.
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a number as a currency string (e.g., "$1,234.56").
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

/**
 * Format a number as a percentage (e.g., "42%").
 * Pass a value between 0 and 1 — internally divides by 100 before Intl formatting.
 */
export function formatPercent(value: number, decimals?: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: decimals ?? 0,
  }).format(value / 100);
}

/**
 * Format a byte size as a human-readable string (e.g., "1.5 MB").
 */
export function formatBytes(bytes: number, locale?: string): string {
  if (bytes < KB) {
    return `${formatNumber(bytes, undefined, locale)} B`;
  } else if (bytes < MB) {
    const val = bytes / KB;
    const decimals = Number.isInteger(val) ? 0 : 1;
    return `${formatNumber(val, { maximumFractionDigits: decimals }, locale)} KB`;
  } else if (bytes < GB) {
    const val = bytes / MB;
    const decimals = Number.isInteger(val) ? 0 : 1;
    return `${formatNumber(val, { maximumFractionDigits: decimals }, locale)} MB`;
  } else if (bytes < TB) {
    const val = bytes / GB;
    const decimals = Number.isInteger(val) ? 0 : 1;
    return `${formatNumber(val, { maximumFractionDigits: decimals }, locale)} GB`;
  } else {
    const val = bytes / TB;
    const decimals = Number.isInteger(val) ? 0 : 1;
    return `${formatNumber(val, { maximumFractionDigits: decimals }, locale)} TB`;
  }
}

/**
 * Format a compact number (e.g., 1234567 → "1.2M").
 */
export function formatCompact(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}

/**
 * Parse a localized number string back to a number.
 * Returns NaN if parsing fails.
 */
export function parseLocalizedNumber(str: string, locale?: string): number {
  // Detect decimal and group separators from a sample formatted number
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89);
  let decimal = '.';
  let group = ',';
  for (const part of parts) {
    if (part.type === 'decimal') decimal = part.value;
    if (part.type === 'group') group = part.value;
  }

  // Strip group separators and replace decimal separator with '.'
  const normalized = str
    .trim()
    .replace(new RegExp(`[${escapeRegex(group)}]`, 'g'), '')
    .replace(new RegExp(`[${escapeRegex(decimal)}]`), '.');

  const result = parseFloat(normalized);
  return result;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
