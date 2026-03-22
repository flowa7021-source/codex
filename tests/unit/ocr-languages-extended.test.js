// ─── Extended Unit Tests: OCR Languages ─────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreTextByLanguage,
  detectLanguage,
  getLanguageProfile,
  getSupportedLanguages,
  getLanguageName,
  postCorrectByLanguage,
} from '../../app/modules/ocr-languages.js';

describe('scoreTextByLanguage', () => {
  it('returns 0 for empty text', () => {
    assert.equal(scoreTextByLanguage('', 'eng'), 0);
    assert.equal(scoreTextByLanguage(null, 'eng'), 0);
  });

  it('returns 0 for unknown language', () => {
    assert.equal(scoreTextByLanguage('hello world', 'xyz'), 0);
  });

  it('returns positive score for English text with eng profile', () => {
    const text = 'the quick brown fox jumps over the lazy dog and he was not on';
    const score = scoreTextByLanguage(text, 'eng');
    assert.ok(score > 0, `score should be > 0, got ${score}`);
  });

  it('returns positive score for Russian text with rus profile', () => {
    const text = 'это простой текст на русском языке и он не был готов для проверки';
    const score = scoreTextByLanguage(text, 'rus');
    assert.ok(score > 0, `score should be > 0, got ${score}`);
  });

  it('scores English text higher for eng than for rus', () => {
    const text = 'the quick brown fox jumps over the lazy dog and he was not on it';
    const engScore = scoreTextByLanguage(text, 'eng');
    const rusScore = scoreTextByLanguage(text, 'rus');
    assert.ok(engScore > rusScore, `eng ${engScore} should be > rus ${rusScore}`);
  });

  it('scores Russian text higher for rus than for eng', () => {
    const text = 'он не был на работе потому что это было время для отдыха';
    const rusScore = scoreTextByLanguage(text, 'rus');
    const engScore = scoreTextByLanguage(text, 'eng');
    assert.ok(rusScore > engScore, `rus ${rusScore} should be > eng ${engScore}`);
  });

  it('applies bigram scoring for Russian', () => {
    const text = 'стоит обратить внимание на новости потому что это важно';
    const score = scoreTextByLanguage(text, 'rus');
    assert.ok(score > 0);
  });

  it('applies bigram scoring for English', () => {
    const text = 'the weather in the northern hemisphere is changing';
    const score = scoreTextByLanguage(text, 'eng');
    assert.ok(score > 0);
  });

  it('penalizes mixed Cyrillic-Latin tokens for Russian', () => {
    const cleanText = 'это простой текст на русском языке';
    const mixedText = 'этоА прAbтой текст руssком языке';
    const cleanScore = scoreTextByLanguage(cleanText, 'rus');
    const mixedScore = scoreTextByLanguage(mixedText, 'rus');
    assert.ok(cleanScore > mixedScore, 'mixed text should score lower');
  });

  it('returns 0 for whitespace-only text', () => {
    assert.equal(scoreTextByLanguage('   ', 'eng'), 0);
  });

  it('handles German text', () => {
    const text = 'der die und in den von zu das mit sich';
    const score = scoreTextByLanguage(text, 'deu');
    assert.ok(score > 0);
  });

  it('handles French text', () => {
    const text = 'de la le et les des en un du une que';
    const score = scoreTextByLanguage(text, 'fra');
    assert.ok(score > 0);
  });

  it('adds digit bonus', () => {
    const text = 'the quick fox 12345';
    const score = scoreTextByLanguage(text, 'eng');
    assert.ok(score > 0);
  });
});

describe('detectLanguage', () => {
  it('returns eng for short text', () => {
    assert.equal(detectLanguage('hi'), 'eng');
    assert.equal(detectLanguage(''), 'eng');
    assert.equal(detectLanguage(null), 'eng');
  });

  it('detects English text', () => {
    const text = 'the quick brown fox jumps over the lazy dog and he was not on it for them';
    assert.equal(detectLanguage(text), 'eng');
  });

  it('detects Russian text', () => {
    const text = 'это простой текст на русском языке он не был готов для проверки что это такое';
    assert.equal(detectLanguage(text), 'rus');
  });
});

describe('getLanguageProfile', () => {
  it('returns profile for known language', () => {
    const profile = getLanguageProfile('rus');
    assert.equal(profile.name, 'Russian');
    assert.ok(profile.alphabet);
    assert.ok(Array.isArray(profile.commonWords));
  });

  it('falls back to English for unknown language', () => {
    const profile = getLanguageProfile('zzz');
    assert.equal(profile.name, 'English');
  });
});

describe('getSupportedLanguages', () => {
  it('returns array of language codes', () => {
    const langs = getSupportedLanguages();
    assert.ok(Array.isArray(langs));
    assert.ok(langs.includes('rus'));
    assert.ok(langs.includes('eng'));
    assert.ok(langs.includes('deu'));
  });

  it('includes Phase 3 and 4 languages', () => {
    const langs = getSupportedLanguages();
    assert.ok(langs.includes('chi_sim'));
    assert.ok(langs.includes('jpn'));
    assert.ok(langs.includes('kor'));
    assert.ok(langs.includes('ukr'));
  });
});

describe('getLanguageName', () => {
  it('returns human-readable name', () => {
    assert.equal(getLanguageName('eng'), 'English');
    assert.equal(getLanguageName('rus'), 'Russian');
  });

  it('returns code if unknown', () => {
    assert.equal(getLanguageName('zzz'), 'zzz');
  });
});

describe('postCorrectByLanguage', () => {
  it('returns input unchanged for unknown language', () => {
    assert.equal(postCorrectByLanguage('hello', 'zzz'), 'hello');
  });

  it('returns falsy input unchanged', () => {
    assert.equal(postCorrectByLanguage('', 'eng'), '');
    assert.equal(postCorrectByLanguage(null, 'eng'), null);
  });

  it('applies English fixes (rn -> m)', () => {
    const corrected = postCorrectByLanguage('the rn is here', 'eng');
    assert.equal(corrected, 'the m is here');
  });

  it('applies Russian fixes', () => {
    const corrected = postCorrectByLanguage('по3воляет', 'rus');
    assert.ok(corrected.includes('поз'));
  });

  it('trims extra whitespace', () => {
    const corrected = postCorrectByLanguage('hello   world', 'eng');
    assert.equal(corrected, 'hello world');
  });
});
