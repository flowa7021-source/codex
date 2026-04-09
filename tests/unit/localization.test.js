// ─── Unit Tests: Localization ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Localization } from '../../app/modules/localization.js';

// ─── constructor / defaults ───────────────────────────────────────────────────

describe('Localization – constructor defaults', () => {
  it('defaults to locale "en"', () => {
    const l = new Localization();
    assert.equal(l.getLocale(), 'en');
  });

  it('accepts locale option', () => {
    const l = new Localization({ locale: 'fr' });
    assert.equal(l.getLocale(), 'fr');
  });

  it('starts with no loaded locales', () => {
    const l = new Localization();
    assert.deepEqual(l.locales(), []);
  });
});

// ─── load + t (basic translation) ────────────────────────────────────────────

describe('Localization – load + t', () => {
  it('returns the translation for a loaded key', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { greeting: 'Hello' });
    assert.equal(l.t('greeting'), 'Hello');
  });

  it('returns the key itself when no translation found', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', {});
    assert.equal(l.t('missing.key'), 'missing.key');
  });

  it('loads multiple translations for the same locale', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { a: 'Alpha', b: 'Beta' });
    assert.equal(l.t('a'), 'Alpha');
    assert.equal(l.t('b'), 'Beta');
  });

  it('overrides a previously loaded locale', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { greeting: 'Hello' });
    l.load('en', { greeting: 'Hi' });
    assert.equal(l.t('greeting'), 'Hi');
  });
});

// ─── interpolation ────────────────────────────────────────────────────────────

describe('Localization – interpolation', () => {
  it('replaces {{name}} placeholder with string value', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { hello: 'Hello, {{name}}!' });
    assert.equal(l.t('hello', { name: 'World' }), 'Hello, World!');
  });

  it('replaces {{count}} placeholder with numeric value', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { items: 'You have {{count}} items' });
    assert.equal(l.t('items', { count: 5 }), 'You have 5 items');
  });

  it('leaves unknown placeholders intact', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { msg: 'Hello {{name}} and {{other}}' });
    assert.equal(l.t('msg', { name: 'Alice' }), 'Hello Alice and {{other}}');
  });

  it('replaces multiple different placeholders', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { msg: '{{a}} + {{b}} = {{c}}' });
    assert.equal(l.t('msg', { a: '1', b: '2', c: '3' }), '1 + 2 = 3');
  });

  it('no params passed — placeholders remain in output', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { msg: 'Hello {{name}}' });
    assert.equal(l.t('msg'), 'Hello {{name}}');
  });
});

// ─── fallback locale ──────────────────────────────────────────────────────────

describe('Localization – fallback locale', () => {
  it('falls back to fallback locale when key is missing in current locale', () => {
    const l = new Localization({ locale: 'fr', fallback: 'en' });
    l.load('en', { greeting: 'Hello' });
    l.load('fr', {});
    assert.equal(l.t('greeting'), 'Hello');
  });

  it('uses current locale first when key exists in both', () => {
    const l = new Localization({ locale: 'fr', fallback: 'en' });
    l.load('en', { greeting: 'Hello' });
    l.load('fr', { greeting: 'Bonjour' });
    assert.equal(l.t('greeting'), 'Bonjour');
  });

  it('returns key when missing from both current and fallback', () => {
    const l = new Localization({ locale: 'fr', fallback: 'en' });
    l.load('en', {});
    l.load('fr', {});
    assert.equal(l.t('no.such.key'), 'no.such.key');
  });

  it('falls back correctly after setLocale', () => {
    const l = new Localization({ locale: 'en', fallback: 'en' });
    l.load('en', { greeting: 'Hello' });
    l.load('de', {});
    l.setLocale('de');
    // 'de' has no greeting → should fall back to 'en'
    assert.equal(l.t('greeting'), 'Hello');
  });
});

// ─── setLocale / getLocale ────────────────────────────────────────────────────

describe('Localization – setLocale / getLocale', () => {
  it('setLocale changes the current locale', () => {
    const l = new Localization({ locale: 'en' });
    l.setLocale('de');
    assert.equal(l.getLocale(), 'de');
  });

  it('t uses the updated locale after setLocale', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { greeting: 'Hello' });
    l.load('fr', { greeting: 'Bonjour' });
    l.setLocale('fr');
    assert.equal(l.t('greeting'), 'Bonjour');
  });
});

// ─── has ──────────────────────────────────────────────────────────────────────

describe('Localization – has', () => {
  it('returns true when key exists in current locale', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { greeting: 'Hello' });
    assert.equal(l.has('greeting'), true);
  });

  it('returns false when key does not exist in current or fallback locale', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', {});
    assert.equal(l.has('missing'), false);
  });

  it('returns true when key exists only in fallback locale', () => {
    const l = new Localization({ locale: 'fr', fallback: 'en' });
    l.load('en', { greeting: 'Hello' });
    l.load('fr', {});
    assert.equal(l.has('greeting'), true);
  });

  it('returns false when no locales are loaded', () => {
    const l = new Localization();
    assert.equal(l.has('any.key'), false);
  });
});

// ─── keys ─────────────────────────────────────────────────────────────────────

describe('Localization – keys', () => {
  it('returns all keys for the current locale', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { a: '1', b: '2', c: '3' });
    const k = l.keys().sort();
    assert.deepEqual(k, ['a', 'b', 'c']);
  });

  it('returns empty array when current locale has no translations', () => {
    const l = new Localization({ locale: 'en' });
    assert.deepEqual(l.keys(), []);
  });

  it('does not include keys from other locales', () => {
    const l = new Localization({ locale: 'en' });
    l.load('en', { only_en: 'x' });
    l.load('fr', { only_fr: 'y' });
    assert.deepEqual(l.keys(), ['only_en']);
  });
});

// ─── locales ─────────────────────────────────────────────────────────────────

describe('Localization – locales', () => {
  it('returns all loaded locale names', () => {
    const l = new Localization();
    l.load('en', { a: '1' });
    l.load('fr', { b: '2' });
    l.load('de', { c: '3' });
    const result = l.locales().sort();
    assert.deepEqual(result, ['de', 'en', 'fr']);
  });

  it('returns empty array when nothing is loaded', () => {
    const l = new Localization();
    assert.deepEqual(l.locales(), []);
  });

  it('does not duplicate a locale loaded multiple times', () => {
    const l = new Localization();
    l.load('en', { a: '1' });
    l.load('en', { b: '2' });
    assert.deepEqual(l.locales(), ['en']);
  });
});
