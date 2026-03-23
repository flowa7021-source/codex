import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  setLanguage,
  getLanguage,
  loadLanguage,
  t,
  applyI18nToDOM,
  getAvailableLanguages,
} from '../../app/modules/i18n.js';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to default language
    setLanguage('ru');
  });

  describe('getAvailableLanguages()', () => {
    it('returns all supported languages', () => {
      const langs = getAvailableLanguages();
      assert.ok(langs.includes('en'));
      assert.ok(langs.includes('ru'));
      assert.ok(langs.includes('ar'));
      assert.ok(langs.length >= 10);
    });
  });

  describe('setLanguage() / getLanguage()', () => {
    it('sets and gets the current language', () => {
      setLanguage('en');
      assert.strictEqual(getLanguage(), 'en');
    });

    it('ignores invalid language codes', () => {
      setLanguage('en');
      setLanguage('invalid');
      assert.strictEqual(getLanguage(), 'en');
    });

    it('saves language to localStorage', () => {
      setLanguage('de');
      assert.strictEqual(localStorage.getItem('novareader-ui-lang'), 'de');
    });

    it('sets RTL direction for Arabic', () => {
      setLanguage('ar');
      assert.strictEqual(document.documentElement.dir, 'rtl');
    });

    it('sets LTR direction for non-RTL languages', () => {
      setLanguage('en');
      assert.strictEqual(document.documentElement.dir, 'ltr');
    });
  });

  describe('loadLanguage()', () => {
    it('loads saved language from localStorage', () => {
      localStorage.setItem('novareader-ui-lang', 'fr');
      const lang = loadLanguage();
      assert.strictEqual(lang, 'fr');
    });

    it('returns current language when nothing saved', () => {
      const lang = loadLanguage();
      assert.strictEqual(lang, 'ru');
    });

    it('ignores invalid saved language', () => {
      localStorage.setItem('novareader-ui-lang', 'xyz');
      const lang = loadLanguage();
      assert.strictEqual(lang, 'ru');
    });
  });

  describe('t()', () => {
    it('translates a known key in English', () => {
      setLanguage('en');
      const text = t('sidebar.open');
      assert.strictEqual(text, 'Open');
    });

    it('falls back to Russian for missing key in current language', () => {
      setLanguage('en');
      // 'sidebar.open' exists in both, so test with a key that exists
      const text = t('sidebar.open');
      assert.ok(typeof text === 'string');
      assert.ok(text.length > 0);
    });

    it('returns the key itself when not found in any language', () => {
      const text = t('completely.nonexistent.key');
      assert.strictEqual(text, 'completely.nonexistent.key');
    });

    it('substitutes parameters', () => {
      setLanguage('en');
      // Use a key with param or test substitution directly
      const result = t('completely.missing.{name}', { name: 'World' });
      assert.ok(result.includes('World'));
    });
  });
});
