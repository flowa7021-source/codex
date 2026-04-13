// @ts-check
// ─── Localization ─────────────────────────────────────────────────────────────
// Simple i18n/localization system with named interpolation and fallback locale.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalizationOptions {
  locale?: string;    // default 'en'
  fallback?: string;  // fallback locale, default 'en'
}

// ─── Localization ─────────────────────────────────────────────────────────────

export class Localization {
  #locale: string;
  #fallback: string;
  #store: Map<string, Record<string, string>> = new Map();

  constructor(options?: LocalizationOptions) {
    this.#locale = options?.locale ?? 'en';
    this.#fallback = options?.fallback ?? 'en';
  }

  /** Load translations for a locale. */
  load(locale: string, translations: Record<string, string>): void {
    this.#store.set(locale, { ...translations });
  }

  /**
   * Translate a key. Supports named interpolation: t('hello', { name: 'World' })
   * with template '{{name}}' → 'World'.
   * Falls back to fallback locale, then returns the key itself.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const currentTranslations = this.#store.get(this.#locale);
    const fallbackTranslations = this.#store.get(this.#fallback);

    let template: string | undefined =
      currentTranslations?.[key] ??
      (this.#locale !== this.#fallback ? fallbackTranslations?.[key] : undefined) ??
      key;

    if (params) {
      template = template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
        return name in params ? String(params[name]) : `{{${name}}}`;
      });
    }

    return template;
  }

  /** Change current locale. */
  setLocale(locale: string): void {
    this.#locale = locale;
  }

  /** Get current locale. */
  getLocale(): string {
    return this.#locale;
  }

  /** Check if a key exists in current or fallback locale. */
  has(key: string): boolean {
    const current = this.#store.get(this.#locale);
    if (current && key in current) return true;
    if (this.#locale !== this.#fallback) {
      const fallback = this.#store.get(this.#fallback);
      if (fallback && key in fallback) return true;
    }
    return false;
  }

  /** Get all keys for the current locale. */
  keys(): string[] {
    const current = this.#store.get(this.#locale);
    return current ? Object.keys(current) : [];
  }

  /** Get all loaded locale names. */
  locales(): string[] {
    return Array.from(this.#store.keys());
  }
}
