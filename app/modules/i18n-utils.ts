// @ts-check
// ─── i18n Utilities ───────────────────────────────────────────────────────────
// Internationalization utilities: message catalog, pluralization, number/date
// formatting, text direction, locale-aware sorting, and string truncation.
// Pure JS — no external dependencies, no Intl API.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A map of translation keys to message strings. */
export type MessageMap = Record<string, string>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Interpolate `{param}` placeholders in a template string. */
function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = params[key];
    return val === undefined ? `{${key}}` : String(val);
  });
}

// ─── I18n ─────────────────────────────────────────────────────────────────────

/**
 * Simple message catalog / translation store.
 *
 * Usage:
 *   const i18n = new I18n('en');
 *   i18n.addTranslations('en', { hello: 'Hello, {name}!' });
 *   i18n.t('hello', { name: 'World' }); // → 'Hello, World!'
 */
export class I18n {
  #locale: string;
  #catalog: Map<string, MessageMap>;

  constructor(locale: string = 'en') {
    this.#locale = locale;
    this.#catalog = new Map();
  }

  /** Current active locale. */
  get locale(): string {
    return this.#locale;
  }

  /** Switch the active locale. */
  setLocale(locale: string): void {
    this.#locale = locale;
  }

  /**
   * Register (or merge) translations for a locale.
   * Calling this multiple times merges the new messages into the existing map.
   */
  addTranslations(locale: string, messages: MessageMap): void {
    const existing = this.#catalog.get(locale);
    if (existing) {
      Object.assign(existing, messages);
    } else {
      this.#catalog.set(locale, { ...messages });
    }
  }

  /**
   * Translate a key using the active locale, with optional parameter
   * interpolation.  Falls back to the key itself when not found.
   */
  t(key: string, params?: Record<string, unknown>): string {
    const map = this.#catalog.get(this.#locale);
    const template = map?.[key] ?? key;
    return params ? interpolate(template, params) : template;
  }

  /** Returns `true` when the key exists in the active locale. */
  has(key: string): boolean {
    const map = this.#catalog.get(this.#locale);
    return map !== undefined && Object.prototype.hasOwnProperty.call(map, key);
  }

  /**
   * Return all messages for `locale` (defaults to the active locale).
   * Returns an empty object when the locale has no translations.
   */
  getAll(locale?: string): MessageMap {
    const target = locale ?? this.#locale;
    const map = this.#catalog.get(target);
    return map ? { ...map } : {};
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a new `I18n` instance (convenience factory). */
export function createI18n(locale?: string): I18n {
  return new I18n(locale);
}

// ─── Pluralization ────────────────────────────────────────────────────────────

/**
 * Return `"<count> <singular>"` or `"<count> <plural>"` depending on `count`.
 *
 * @example
 *   pluralize(1, 'item', 'items') // → '1 item'
 *   pluralize(5, 'item', 'items') // → '5 items'
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Like `pluralize`, but handles the zero case with a custom string.
 *
 * @example
 *   pluralizeWithZero(0, 'no items', 'item', 'items') // → 'no items'
 *   pluralizeWithZero(1, 'no items', 'item', 'items') // → '1 item'
 *   pluralizeWithZero(3, 'no items', 'item', 'items') // → '3 items'
 */
export function pluralizeWithZero(
  count: number,
  zero: string,
  singular: string,
  plural: string,
): string {
  if (count === 0) return zero;
  return pluralize(count, singular, plural);
}

// ─── Number formatting ────────────────────────────────────────────────────────

/**
 * Format a number according to common locale conventions (no Intl).
 *
 * Supported locales:
 *  - 'en'  → 1,234.56   (comma thousands, period decimal)
 *  - 'de'  → 1.234,56   (period thousands, comma decimal)
 *  - 'fr'  → 1 234,56   (space thousands, comma decimal)
 *
 * All other locales fall back to 'en' style.
 */
export function formatNumberLocale(n: number, locale: string): string {
  const lang = locale.split('-')[0].toLowerCase();

  const isNegative = n < 0;
  const abs = Math.abs(n);

  // Split into integer and fractional parts
  const parts = abs.toString().split('.');
  const intPart = parts[0];
  const fracPart = parts[1] ?? '';

  let thousandsSep: string;
  let decimalSep: string;

  switch (lang) {
    case 'de':
      thousandsSep = '.';
      decimalSep = ',';
      break;
    case 'fr':
      thousandsSep = '\u00a0'; // non-breaking space
      decimalSep = ',';
      break;
    default: // 'en' and everything else
      thousandsSep = ',';
      decimalSep = '.';
  }

  // Insert thousands separators
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);

  const formatted = fracPart.length > 0
    ? `${grouped}${decimalSep}${fracPart}`
    : grouped;

  return isNegative ? `-${formatted}` : formatted;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Format a `Date` according to locale conventions (no Intl).
 *
 * Supported locales & formats:
 *  - 'en' short  → MM/DD/YYYY
 *  - 'en' medium → Mon DD, YYYY   (abbreviated month)
 *  - 'en' long   → Month DD, YYYY (full month)
 *  - 'de' short  → DD.MM.YYYY
 *  - 'de' medium → DD. Mon YYYY
 *  - 'de' long   → DD. Month YYYY
 *  - 'fr' short  → DD/MM/YYYY
 *  - 'fr' medium → DD Mon YYYY
 *  - 'fr' long   → DD Month YYYY
 *
 * All other locales fall back to 'en' formatting.
 */
export function formatDateLocale(
  date: Date,
  locale: string,
  format: 'short' | 'medium' | 'long' = 'short',
): string {
  const lang = locale.split('-')[0].toLowerCase();

  const d = date.getDate();
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();

  const dd = pad2(d);
  const mm = pad2(m + 1);
  const yyyy = String(y);
  const monShort = MONTH_SHORT[m];
  const monLong = MONTH_LONG[m];

  switch (lang) {
    case 'de':
      if (format === 'short') return `${dd}.${mm}.${yyyy}`;
      if (format === 'medium') return `${d}. ${monShort} ${yyyy}`;
      return `${d}. ${monLong} ${yyyy}`;

    case 'fr':
      if (format === 'short') return `${dd}/${mm}/${yyyy}`;
      if (format === 'medium') return `${d} ${monShort} ${yyyy}`;
      return `${d} ${monLong} ${yyyy}`;

    default: // 'en' and everything else
      if (format === 'short') return `${mm}/${dd}/${yyyy}`;
      if (format === 'medium') return `${monShort} ${dd}, ${yyyy}`;
      return `${monLong} ${dd}, ${yyyy}`;
  }
}

// ─── Text direction ───────────────────────────────────────────────────────────

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'yi']);

/**
 * Return the text direction for a locale.
 * RTL locales: ar, he, fa, ur, yi.
 */
export function getTextDirection(locale: string): 'ltr' | 'rtl' {
  const lang = locale.split('-')[0].toLowerCase();
  return RTL_LOCALES.has(lang) ? 'rtl' : 'ltr';
}

// ─── Locale-aware sorting ─────────────────────────────────────────────────────

/**
 * Return a sorted copy of `arr` using locale-aware string comparison.
 * Falls back to `localeCompare` with the provided locale hint.
 */
export function sortLocale(arr: string[], locale?: string): string[] {
  return arr.slice().sort((a, b) => {
    if (locale) {
      return a.localeCompare(b, locale);
    }
    return a.localeCompare(b);
  });
}

// ─── String truncation ────────────────────────────────────────────────────────

/**
 * Truncate `str` to at most `maxLength` characters (Unicode code points),
 * appending `suffix` if truncation occurred.
 *
 * Uses spread (`[...str]`) to correctly count multibyte/emoji characters.
 *
 * @example
 *   truncateLocale('Hello, World!', 5)        // → 'Hello…'
 *   truncateLocale('Hello, World!', 5, '...') // → 'Hello...'
 */
export function truncateLocale(
  str: string,
  maxLength: number,
  suffix: string = '…',
): string {
  const chars = [...str];
  if (chars.length <= maxLength) return str;
  return chars.slice(0, maxLength).join('') + suffix;
}
