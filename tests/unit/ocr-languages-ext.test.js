// ─── Extended Unit Tests: OCR Languages Module ──────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getLanguageProfile, getSupportedLanguages, getLanguageName,
  postCorrectByLanguage, scoreTextByLanguage, detectLanguage,
} from '../../app/modules/ocr-languages.js';

describe('getLanguageProfile', () => {
  it('returns profile for Russian', () => {
    const p = getLanguageProfile('rus');
    assert.equal(p.name, 'Russian');
    assert.ok(Array.isArray(p.commonWords));
  });
  it('returns English for unknown language', () => {
    assert.equal(getLanguageProfile('xyz').name, 'English');
  });
  it('returns profiles for CJK', () => {
    for (const l of ['chi_sim', 'chi_tra', 'jpn', 'kor']) assert.ok(getLanguageProfile(l));
  });
  it('returns profiles for European langs', () => {
    for (const l of ['deu', 'fra', 'spa', 'ita', 'por', 'nld', 'swe', 'nor', 'fin', 'pol', 'ces', 'ron', 'bul', 'ukr', 'bel']) assert.ok(getLanguageProfile(l));
  });
});

describe('getSupportedLanguages', () => {
  it('returns many languages', () => {
    const langs = getSupportedLanguages();
    assert.ok(langs.length > 10);
    assert.ok(langs.includes('rus'));
    assert.ok(langs.includes('eng'));
  });
});

describe('getLanguageName', () => {
  it('returns human-readable name', () => {
    assert.equal(getLanguageName('rus'), 'Russian');
    assert.equal(getLanguageName('jpn'), 'Japanese');
  });
  it('returns code for unknown', () => {
    assert.equal(getLanguageName('xyz'), 'xyz');
  });
});

describe('postCorrectByLanguage', () => {
  it('returns empty/null unchanged', () => {
    assert.equal(postCorrectByLanguage('', 'rus'), '');
    assert.equal(postCorrectByLanguage(null, 'rus'), null);
  });
  it('applies Russian OCR fixes', () => {
    const r = postCorrectByLanguage('0бъявление', 'rus');
    assert.ok(r.includes('О'));
  });
  it('collapses multiple spaces', () => {
    assert.equal(postCorrectByLanguage('hello   world', 'eng'), 'hello world');
  });
  it('returns input unchanged for unknown profile', () => {
    assert.equal(postCorrectByLanguage('hello world', 'xyz'), 'hello world');
  });
  it('applies German fixes', () => {
    assert.ok(postCorrectByLanguage('fiir', 'deu').includes('für'));
  });
  it('applies French fixes', () => {
    assert.ok(postCorrectByLanguage("I'homme", 'fra').includes("l'homme"));
  });
  it('applies Portuguese fixes', () => {
    assert.ok(postCorrectByLanguage('nao', 'por').includes('não'));
  });
  it('applies Romanian fixes', () => {
    const r = postCorrectByLanguage('s,i t,ara', 'ron');
    assert.ok(r.includes('ș'));
    assert.ok(r.includes('ț'));
  });
  it('trims trailing spaces', () => {
    assert.equal(postCorrectByLanguage('  hello  world  ', 'eng'), 'hello world');
  });
});

describe('scoreTextByLanguage', () => {
  it('returns 0 for empty text', () => {
    assert.equal(scoreTextByLanguage('', 'eng'), 0);
  });
  it('returns 0 for unknown language', () => {
    assert.equal(scoreTextByLanguage('hello', 'xyz'), 0);
  });
  it('scores Russian text higher for rus than eng', () => {
    const text = 'Это текст на русском языке для проверки';
    assert.ok(scoreTextByLanguage(text, 'rus') > scoreTextByLanguage(text, 'eng'));
  });
  it('scores English text higher for eng than rus', () => {
    const text = 'This is an English text for testing the scoring function';
    assert.ok(scoreTextByLanguage(text, 'eng') > scoreTextByLanguage(text, 'rus'));
  });
});

describe('detectLanguage', () => {
  it('returns eng for short text', () => {
    assert.equal(detectLanguage('hi'), 'eng');
    assert.equal(detectLanguage(''), 'eng');
  });
  it('detects Russian', () => {
    assert.equal(detectLanguage('Это текст на русском языке с достаточным количеством символов для определения языка'), 'rus');
  });
  it('detects English', () => {
    assert.equal(detectLanguage('The quick brown fox jumps over the lazy dog and the cat sleeps in the warm sunlight'), 'eng');
  });
  it('detects German', () => {
    assert.equal(detectLanguage('Der schnelle braune Fuchs springt über den faulen Hund und die Katze schläft in der warmen Sonne'), 'deu');
  });
});
