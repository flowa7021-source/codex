// ─── Unit Tests: i18n Utilities ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  I18n,
  createI18n,
  pluralize,
  pluralizeWithZero,
  formatNumberLocale,
  formatDateLocale,
  getTextDirection,
  sortLocale,
  truncateLocale,
} from '../../app/modules/i18n-utils.js';

// ─── I18n – constructor / locale ──────────────────────────────────────────────

describe('I18n – constructor / locale', () => {
  it('defaults locale to "en"', () => {
    const i18n = new I18n();
    assert.equal(i18n.locale, 'en');
  });

  it('accepts a custom locale', () => {
    const i18n = new I18n('de');
    assert.equal(i18n.locale, 'de');
  });

  it('setLocale changes the active locale', () => {
    const i18n = new I18n('en');
    i18n.setLocale('fr');
    assert.equal(i18n.locale, 'fr');
  });
});

// ─── I18n – addTranslations / t ───────────────────────────────────────────────

describe('I18n – addTranslations / t', () => {
  it('translates a simple key', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { greeting: 'Hello' });
    assert.equal(i18n.t('greeting'), 'Hello');
  });

  it('returns the key itself when not found', () => {
    const i18n = new I18n('en');
    assert.equal(i18n.t('missing.key'), 'missing.key');
  });

  it('interpolates {param} placeholders', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { hello: 'Hello, {name}!' });
    assert.equal(i18n.t('hello', { name: 'World' }), 'Hello, World!');
  });

  it('interpolates multiple placeholders', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { msg: '{a} + {b} = {c}' });
    assert.equal(i18n.t('msg', { a: 1, b: 2, c: 3 }), '1 + 2 = 3');
  });

  it('leaves unknown placeholders as-is', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { msg: 'Hello {name}' });
    assert.equal(i18n.t('msg', {}), 'Hello {name}');
  });

  it('merges subsequent addTranslations calls', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { a: 'A' });
    i18n.addTranslations('en', { b: 'B' });
    assert.equal(i18n.t('a'), 'A');
    assert.equal(i18n.t('b'), 'B');
  });

  it('overrides existing key on re-add', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { key: 'old' });
    i18n.addTranslations('en', { key: 'new' });
    assert.equal(i18n.t('key'), 'new');
  });

  it('returns key when locale has no translations', () => {
    const i18n = new I18n('ja');
    assert.equal(i18n.t('anything'), 'anything');
  });

  it('uses the active locale, not a different one', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { word: 'Cat' });
    i18n.addTranslations('de', { word: 'Katze' });
    assert.equal(i18n.t('word'), 'Cat');
    i18n.setLocale('de');
    assert.equal(i18n.t('word'), 'Katze');
  });

  it('works without params argument', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { msg: 'No params here' });
    assert.equal(i18n.t('msg'), 'No params here');
  });
});

// ─── I18n – has ───────────────────────────────────────────────────────────────

describe('I18n – has', () => {
  it('returns true for existing key', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { present: 'yes' });
    assert.equal(i18n.has('present'), true);
  });

  it('returns false for missing key', () => {
    const i18n = new I18n('en');
    assert.equal(i18n.has('nope'), false);
  });

  it('returns false when locale has no catalog at all', () => {
    const i18n = new I18n('zz');
    assert.equal(i18n.has('any'), false);
  });
});

// ─── I18n – getAll ────────────────────────────────────────────────────────────

describe('I18n – getAll', () => {
  it('returns all messages for active locale', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { a: 'A', b: 'B' });
    const all = i18n.getAll();
    assert.deepEqual(all, { a: 'A', b: 'B' });
  });

  it('returns messages for a specified locale', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('fr', { bonjour: 'Bonjour' });
    const all = i18n.getAll('fr');
    assert.deepEqual(all, { bonjour: 'Bonjour' });
  });

  it('returns empty object for unknown locale', () => {
    const i18n = new I18n('en');
    assert.deepEqual(i18n.getAll('zz'), {});
  });

  it('returns a copy, not the internal map', () => {
    const i18n = new I18n('en');
    i18n.addTranslations('en', { x: 'X' });
    const all = i18n.getAll();
    all['x'] = 'mutated';
    assert.equal(i18n.t('x'), 'X'); // internal map unchanged
  });
});

// ─── createI18n ───────────────────────────────────────────────────────────────

describe('createI18n', () => {
  it('creates an I18n instance with default locale', () => {
    const i18n = createI18n();
    assert.ok(i18n instanceof I18n);
    assert.equal(i18n.locale, 'en');
  });

  it('creates an I18n instance with specified locale', () => {
    const i18n = createI18n('es');
    assert.equal(i18n.locale, 'es');
  });
});

// ─── pluralize ────────────────────────────────────────────────────────────────

describe('pluralize', () => {
  it('uses singular for count 1', () => {
    assert.equal(pluralize(1, 'item', 'items'), '1 item');
  });

  it('uses plural for count 0', () => {
    assert.equal(pluralize(0, 'item', 'items'), '0 items');
  });

  it('uses plural for count > 1', () => {
    assert.equal(pluralize(5, 'item', 'items'), '5 items');
  });

  it('uses plural for count 2', () => {
    assert.equal(pluralize(2, 'file', 'files'), '2 files');
  });

  it('handles negative numbers with plural', () => {
    assert.equal(pluralize(-3, 'step', 'steps'), '-3 steps');
  });

  it('includes count in the result string', () => {
    assert.ok(pluralize(42, 'point', 'points').startsWith('42'));
  });
});

// ─── pluralizeWithZero ────────────────────────────────────────────────────────

describe('pluralizeWithZero', () => {
  it('returns zero string for count 0', () => {
    assert.equal(pluralizeWithZero(0, 'no items', 'item', 'items'), 'no items');
  });

  it('returns singular form for count 1', () => {
    assert.equal(pluralizeWithZero(1, 'no items', 'item', 'items'), '1 item');
  });

  it('returns plural form for count > 1', () => {
    assert.equal(pluralizeWithZero(5, 'no items', 'item', 'items'), '5 items');
  });

  it('zero string can be any message', () => {
    assert.equal(pluralizeWithZero(0, 'empty cart', 'product', 'products'), 'empty cart');
  });
});

// ─── formatNumberLocale ───────────────────────────────────────────────────────

describe('formatNumberLocale', () => {
  it('en: formats integer with comma thousands separator', () => {
    assert.equal(formatNumberLocale(1234, 'en'), '1,234');
  });

  it('en: formats decimal number', () => {
    assert.equal(formatNumberLocale(1234.56, 'en'), '1,234.56');
  });

  it('en: formats large number', () => {
    assert.equal(formatNumberLocale(1234567, 'en'), '1,234,567');
  });

  it('en: formats small number without separator', () => {
    assert.equal(formatNumberLocale(999, 'en'), '999');
  });

  it('de: formats integer with period thousands separator', () => {
    assert.equal(formatNumberLocale(1234, 'de'), '1.234');
  });

  it('de: formats decimal with comma decimal separator', () => {
    assert.equal(formatNumberLocale(1234.56, 'de'), '1.234,56');
  });

  it('fr: formats integer with non-breaking space thousands separator', () => {
    assert.equal(formatNumberLocale(1234, 'fr'), '1\u00a0234');
  });

  it('fr: formats decimal with comma decimal separator', () => {
    assert.equal(formatNumberLocale(1234.56, 'fr'), '1\u00a0234,56');
  });

  it('unknown locale falls back to en style', () => {
    assert.equal(formatNumberLocale(1234, 'ja'), '1,234');
  });

  it('handles negative en number', () => {
    assert.equal(formatNumberLocale(-1234.56, 'en'), '-1,234.56');
  });

  it('handles zero', () => {
    assert.equal(formatNumberLocale(0, 'en'), '0');
  });
});

// ─── formatDateLocale ─────────────────────────────────────────────────────────

describe('formatDateLocale', () => {
  const d = new Date(2024, 0, 5); // Jan 5, 2024

  it('en short: MM/DD/YYYY', () => {
    assert.equal(formatDateLocale(d, 'en', 'short'), '01/05/2024');
  });

  it('en medium: Mon DD, YYYY', () => {
    assert.equal(formatDateLocale(d, 'en', 'medium'), 'Jan 05, 2024');
  });

  it('en long: Month DD, YYYY', () => {
    assert.equal(formatDateLocale(d, 'en', 'long'), 'January 05, 2024');
  });

  it('en defaults to short format', () => {
    assert.equal(formatDateLocale(d, 'en'), '01/05/2024');
  });

  it('de short: DD.MM.YYYY', () => {
    assert.equal(formatDateLocale(d, 'de', 'short'), '05.01.2024');
  });

  it('de medium: DD. Mon YYYY', () => {
    assert.equal(formatDateLocale(d, 'de', 'medium'), '5. Jan 2024');
  });

  it('de long: DD. Month YYYY', () => {
    assert.equal(formatDateLocale(d, 'de', 'long'), '5. January 2024');
  });

  it('fr short: DD/MM/YYYY', () => {
    assert.equal(formatDateLocale(d, 'fr', 'short'), '05/01/2024');
  });

  it('fr medium: DD Mon YYYY', () => {
    assert.equal(formatDateLocale(d, 'fr', 'medium'), '5 Jan 2024');
  });

  it('fr long: DD Month YYYY', () => {
    assert.equal(formatDateLocale(d, 'fr', 'long'), '5 January 2024');
  });

  it('unknown locale falls back to en short', () => {
    assert.equal(formatDateLocale(d, 'ja', 'short'), '01/05/2024');
  });

  it('handles December correctly', () => {
    const dec = new Date(2023, 11, 31); // Dec 31, 2023
    assert.equal(formatDateLocale(dec, 'en', 'long'), 'December 31, 2023');
  });
});

// ─── getTextDirection ─────────────────────────────────────────────────────────

describe('getTextDirection', () => {
  it('returns rtl for Arabic', () => {
    assert.equal(getTextDirection('ar'), 'rtl');
  });

  it('returns rtl for Hebrew', () => {
    assert.equal(getTextDirection('he'), 'rtl');
  });

  it('returns rtl for Farsi', () => {
    assert.equal(getTextDirection('fa'), 'rtl');
  });

  it('returns rtl for Urdu', () => {
    assert.equal(getTextDirection('ur'), 'rtl');
  });

  it('returns rtl for Yiddish', () => {
    assert.equal(getTextDirection('yi'), 'rtl');
  });

  it('returns ltr for English', () => {
    assert.equal(getTextDirection('en'), 'ltr');
  });

  it('returns ltr for German', () => {
    assert.equal(getTextDirection('de'), 'ltr');
  });

  it('returns ltr for French', () => {
    assert.equal(getTextDirection('fr'), 'ltr');
  });

  it('returns ltr for unknown locale', () => {
    assert.equal(getTextDirection('xx'), 'ltr');
  });

  it('handles locale with region tag (ar-SA)', () => {
    assert.equal(getTextDirection('ar-SA'), 'rtl');
  });

  it('handles locale with region tag (en-US)', () => {
    assert.equal(getTextDirection('en-US'), 'ltr');
  });
});

// ─── sortLocale ───────────────────────────────────────────────────────────────

describe('sortLocale', () => {
  it('sorts a simple English array', () => {
    const result = sortLocale(['banana', 'apple', 'cherry']);
    assert.deepEqual(result, ['apple', 'banana', 'cherry']);
  });

  it('does not mutate the original array', () => {
    const original = ['c', 'a', 'b'];
    sortLocale(original);
    assert.deepEqual(original, ['c', 'a', 'b']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(sortLocale([]), []);
  });

  it('returns single-element array unchanged', () => {
    assert.deepEqual(sortLocale(['only']), ['only']);
  });

  it('sorts with locale hint', () => {
    const result = sortLocale(['Zebra', 'apple', 'Mango'], 'en');
    // Basic check: result is an array of the same length
    assert.equal(result.length, 3);
    assert.ok(result.includes('apple'));
    assert.ok(result.includes('Mango'));
    assert.ok(result.includes('Zebra'));
  });

  it('already-sorted array stays sorted', () => {
    const arr = ['alpha', 'beta', 'gamma'];
    assert.deepEqual(sortLocale(arr), ['alpha', 'beta', 'gamma']);
  });
});

// ─── truncateLocale ───────────────────────────────────────────────────────────

describe('truncateLocale', () => {
  it('does not truncate when string is shorter than maxLength', () => {
    assert.equal(truncateLocale('Hello', 10), 'Hello');
  });

  it('does not truncate when string equals maxLength', () => {
    assert.equal(truncateLocale('Hello', 5), 'Hello');
  });

  it('truncates and appends default ellipsis', () => {
    assert.equal(truncateLocale('Hello, World!', 5), 'Hello…');
  });

  it('truncates and appends custom suffix', () => {
    assert.equal(truncateLocale('Hello, World!', 5, '...'), 'Hello...');
  });

  it('handles multibyte emoji characters correctly', () => {
    const str = '🎉🎊🎈🎁🎀'; // 5 emoji, each multibyte
    assert.equal(truncateLocale(str, 3), '🎉🎊🎈…');
  });

  it('handles empty string', () => {
    assert.equal(truncateLocale('', 5), '');
  });

  it('handles maxLength 0', () => {
    assert.equal(truncateLocale('abc', 0), '…');
  });

  it('handles maxLength 1', () => {
    assert.equal(truncateLocale('abc', 1), 'a…');
  });

  it('suffix can be empty string (hard truncate)', () => {
    assert.equal(truncateLocale('Hello World', 5, ''), 'Hello');
  });
});
