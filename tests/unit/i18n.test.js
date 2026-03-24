import { describe, it, beforeEach, mock } from 'node:test';
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

    it('sets lang attribute on documentElement', () => {
      setLanguage('de');
      assert.strictEqual(document.documentElement.lang, 'de');
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
      const result = t('completely.missing.{name}', { name: 'World' });
      assert.ok(result.includes('World'));
    });

    it('substitutes multiple parameters', () => {
      const result = t('{a} and {b}', { a: 'foo', b: 'bar' });
      assert.ok(result.includes('foo'));
      assert.ok(result.includes('bar'));
    });

    it('works with no params (default)', () => {
      setLanguage('ru');
      const text = t('sidebar.open');
      assert.ok(typeof text === 'string');
    });
  });

  describe('applyI18nToDOM()', () => {
    it('sets textContent for [data-i18n] elements via querySelectorAll override', () => {
      setLanguage('en');
      const el = document.createElement('span');
      el.setAttribute('data-i18n', 'sidebar.open');

      // Override querySelectorAll to return our test elements
      const origQSA = document.querySelectorAll.bind(document);
      document.querySelectorAll = (selector) => {
        if (selector === '[data-i18n]') return [el];
        if (selector === '[data-i18n-title]') return [];
        if (selector === '[data-i18n-placeholder]') return [];
        return origQSA(selector);
      };

      applyI18nToDOM();
      assert.strictEqual(el.textContent, 'Open');
      document.querySelectorAll = origQSA;
    });

    it('sets title for [data-i18n-title] elements', () => {
      setLanguage('en');
      const el = document.createElement('button');
      el.setAttribute('data-i18n-title', 'sidebar.open');

      const origQSA = document.querySelectorAll.bind(document);
      document.querySelectorAll = (selector) => {
        if (selector === '[data-i18n]') return [];
        if (selector === '[data-i18n-title]') return [el];
        if (selector === '[data-i18n-placeholder]') return [];
        return origQSA(selector);
      };

      applyI18nToDOM();
      assert.strictEqual(/** @type {any} */ (el).title, 'Open');
      document.querySelectorAll = origQSA;
    });

    it('sets placeholder for [data-i18n-placeholder] elements', () => {
      setLanguage('en');
      const el = document.createElement('input');
      el.setAttribute('data-i18n-placeholder', 'sidebar.open');

      const origQSA = document.querySelectorAll.bind(document);
      document.querySelectorAll = (selector) => {
        if (selector === '[data-i18n]') return [];
        if (selector === '[data-i18n-title]') return [];
        if (selector === '[data-i18n-placeholder]') return [el];
        return origQSA(selector);
      };

      applyI18nToDOM();
      assert.strictEqual(/** @type {any} */ (el).placeholder, 'Open');
      document.querySelectorAll = origQSA;
    });

    it('sets documentElement.lang to current language', () => {
      setLanguage('de');
      applyI18nToDOM();
      assert.strictEqual(document.documentElement.lang, 'de');
    });

    it('sets documentElement.dir to rtl for Arabic', () => {
      setLanguage('ar');
      applyI18nToDOM();
      assert.strictEqual(document.documentElement.dir, 'rtl');
    });

    it('sets documentElement.dir to ltr for non-RTL languages', () => {
      setLanguage('en');
      applyI18nToDOM();
      assert.strictEqual(document.documentElement.dir, 'ltr');
    });

    it('skips [data-i18n] elements with empty key', () => {
      const el = document.createElement('span');
      el.setAttribute('data-i18n', '');
      el.textContent = 'original';

      const origQSA = document.querySelectorAll.bind(document);
      document.querySelectorAll = (selector) => {
        if (selector === '[data-i18n]') return [el];
        if (selector === '[data-i18n-title]') return [];
        if (selector === '[data-i18n-placeholder]') return [];
        return origQSA(selector);
      };

      applyI18nToDOM();
      // Empty key means getAttribute returns '' which is falsy, so textContent unchanged
      assert.strictEqual(el.textContent, 'original');
      document.querySelectorAll = origQSA;
    });
  });
});
