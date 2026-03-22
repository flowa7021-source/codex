// @ts-check
// ─── Internationalization Module ─────────────────────────────────────────────

import ru from '../locales/ru.json' with { type: 'json' };
import en from '../locales/en.json' with { type: 'json' };
import de from '../locales/de.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };
import es from '../locales/es.json' with { type: 'json' };
import pt from '../locales/pt.json' with { type: 'json' };
import zh from '../locales/zh.json' with { type: 'json' };
import ja from '../locales/ja.json' with { type: 'json' };
import ko from '../locales/ko.json' with { type: 'json' };
import ar from '../locales/ar.json' with { type: 'json' };

const translations = { ru, en, de, fr, es, pt, zh, ja, ko, ar };

let currentLang = 'ru';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('novareader-ui-lang', lang);
    // RTL support for Arabic
    document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].includes(lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
}

export function getLanguage() {
  return currentLang;
}

export function loadLanguage() {
  const saved = localStorage.getItem('novareader-ui-lang');
  if (saved && translations[saved]) {
    currentLang = saved;
  }
  return currentLang;
}

export function t(key, params = {}) {
  const dict = translations[currentLang] || translations.ru;
  let text = dict[key] || translations.ru[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

export function applyI18nToDOM() {
  const lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) /** @type {any} */ (el).title = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) /** @type {any} */ (el).placeholder = t(key);
  });

  document.documentElement.lang = lang;
  document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].includes(lang) ? 'rtl' : 'ltr';
}

export function getAvailableLanguages() {
  return Object.keys(translations);
}
