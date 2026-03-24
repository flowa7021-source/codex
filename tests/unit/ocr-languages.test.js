// ─── Unit Tests: OCR Languages ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getLanguageProfile,
  getSupportedLanguages,
  getLanguageName,
  postCorrectByLanguage,
  scoreTextByLanguage,
  detectLanguage,
} from '../../app/modules/ocr-languages.js';

// ─── getLanguageProfile ─────────────────────────────────────────────────────

describe('getLanguageProfile', () => {
  it('returns the profile for a known language', () => {
    const profile = getLanguageProfile('eng');
    assert.equal(profile.name, 'English');
    assert.ok(Array.isArray(profile.commonWords));
    assert.ok(profile.alphabet instanceof RegExp);
    assert.ok(Array.isArray(profile.fixes));
  });

  it('returns the profile for Russian', () => {
    const profile = getLanguageProfile('rus');
    assert.equal(profile.name, 'Russian');
  });

  it('returns the profile for German', () => {
    const profile = getLanguageProfile('deu');
    assert.equal(profile.name, 'German');
  });

  it('returns the profile for French', () => {
    const profile = getLanguageProfile('fra');
    assert.equal(profile.name, 'French');
  });

  it('returns English profile as fallback for unknown language', () => {
    const profile = getLanguageProfile('xyz');
    assert.equal(profile.name, 'English');
  });

  it('returns English profile when lang is undefined', () => {
    const profile = getLanguageProfile(undefined);
    assert.equal(profile.name, 'English');
  });
});

// ─── getSupportedLanguages ──────────────────────────────────────────────────

describe('getSupportedLanguages', () => {
  it('returns an array of language codes', () => {
    const langs = getSupportedLanguages();
    assert.ok(Array.isArray(langs));
    assert.ok(langs.length > 0);
  });

  it('includes core languages', () => {
    const langs = getSupportedLanguages();
    for (const code of ['eng', 'rus', 'deu', 'fra', 'spa', 'ita', 'por']) {
      assert.ok(langs.includes(code), `missing ${code}`);
    }
  });

  it('includes Phase 3.2 languages', () => {
    const langs = getSupportedLanguages();
    for (const code of ['chi_sim', 'chi_tra', 'jpn', 'kor', 'ara', 'hin']) {
      assert.ok(langs.includes(code), `missing ${code}`);
    }
  });

  it('includes Phase 4 languages', () => {
    const langs = getSupportedLanguages();
    for (const code of ['ukr', 'bel', 'nld', 'swe', 'nor', 'fin', 'ell', 'heb', 'vie', 'tha', 'ron', 'bul', 'tur', 'pol', 'ces']) {
      assert.ok(langs.includes(code), `missing ${code}`);
    }
  });
});

// ─── getLanguageName ────────────────────────────────────────────────────────

describe('getLanguageName', () => {
  it('returns the human-readable name for known languages', () => {
    assert.equal(getLanguageName('eng'), 'English');
    assert.equal(getLanguageName('rus'), 'Russian');
    assert.equal(getLanguageName('deu'), 'German');
    assert.equal(getLanguageName('fra'), 'French');
    assert.equal(getLanguageName('spa'), 'Spanish');
    assert.equal(getLanguageName('jpn'), 'Japanese');
    assert.equal(getLanguageName('kor'), 'Korean');
    assert.equal(getLanguageName('ara'), 'Arabic');
  });

  it('returns the lang code itself for unknown languages', () => {
    assert.equal(getLanguageName('xyz'), 'xyz');
    assert.equal(getLanguageName('unknown'), 'unknown');
  });

  it('returns undefined for undefined input (optional chaining)', () => {
    assert.equal(getLanguageName(undefined), undefined);
  });
});

// ─── postCorrectByLanguage ──────────────────────────────────────────────────

describe('postCorrectByLanguage', () => {
  it('returns falsy input unchanged', () => {
    assert.equal(postCorrectByLanguage('', 'eng'), '');
    assert.equal(postCorrectByLanguage(null, 'eng'), null);
    assert.equal(postCorrectByLanguage(undefined, 'eng'), undefined);
  });

  it('returns text unchanged for unknown language', () => {
    assert.equal(postCorrectByLanguage('hello world', 'xyz'), 'hello world');
  });

  it('collapses multiple spaces', () => {
    const result = postCorrectByLanguage('hello   world', 'eng');
    assert.equal(result, 'hello world');
  });

  it('trims whitespace', () => {
    const result = postCorrectByLanguage('  hello world  ', 'eng');
    assert.equal(result, 'hello world');
  });

  // English fixes
  it('applies English rn → m fix', () => {
    const result = postCorrectByLanguage('rn is wrong', 'eng');
    assert.equal(result, 'm is wrong');
  });

  it('applies English cI → cl fix', () => {
    const result = postCorrectByLanguage('cI ean', 'eng');
    assert.equal(result, 'cl ean');
  });

  it('applies English tI → tl fix', () => {
    const result = postCorrectByLanguage('tI e', 'eng');
    assert.equal(result, 'tl e');
  });

  // German fixes
  it('applies German fiir → für fix', () => {
    const result = postCorrectByLanguage('fiir mich', 'deu');
    assert.equal(result, 'für mich');
  });

  // French fixes
  it("applies French I' → l' fix", () => {
    const result = postCorrectByLanguage("I'homme", 'fra');
    assert.equal(result, "l'homme");
  });

  it("applies French qu ' → qu' fix", () => {
    const result = postCorrectByLanguage("qu 'il", 'fra');
    assert.equal(result, "qu'il");
  });

  // Spanish fixes
  it('applies Spanish rn → m fix', () => {
    const result = postCorrectByLanguage('rnañana', 'spa');
    assert.equal(result, 'mañana');
  });

  // Portuguese fixes
  it('applies Portuguese cao → ção fix', () => {
    const result = postCorrectByLanguage('cao de', 'por');
    assert.equal(result, 'ção de');
  });

  it('applies Portuguese nao → não fix', () => {
    const result = postCorrectByLanguage('nao sei', 'por');
    assert.equal(result, 'não sei');
  });

  // Russian fixes
  it('applies Russian rn → т fix', () => {
    const result = postCorrectByLanguage('rnе', 'rus');
    assert.equal(result, 'те');
  });

  it('applies Russian 0 → О before Cyrillic fix', () => {
    const result = postCorrectByLanguage('0на', 'rus');
    assert.equal(result, 'Она');
  });

  it('applies Russian 3 → з before lowercase Cyrillic fix', () => {
    const result = postCorrectByLanguage('3ная', 'rus');
    assert.equal(result, 'зная');
  });

  // Italian fixes
  it("applies Italian I' → l' fix", () => {
    const result = postCorrectByLanguage("I'uomo", 'ita');
    assert.equal(result, "l'uomo");
  });

  it('applies Italian piu → più fix', () => {
    const result = postCorrectByLanguage('piu grande', 'ita');
    assert.equal(result, 'più grande');
  });

  // Ukrainian fixes
  it('applies Ukrainian rn → т fix', () => {
    const result = postCorrectByLanguage('rnак', 'ukr');
    assert.equal(result, 'так');
  });

  // Romanian fixes
  it('applies Romanian s, → ș fix', () => {
    const result = postCorrectByLanguage('s,coala', 'ron');
    assert.equal(result, 'școala');
  });

  it('applies Romanian t, → ț fix', () => {
    const result = postCorrectByLanguage('t,ara', 'ron');
    assert.equal(result, 'țara');
  });
});

// ─── scoreTextByLanguage ────────────────────────────────────────────────────

describe('scoreTextByLanguage', () => {
  it('returns 0 for empty/null text', () => {
    assert.equal(scoreTextByLanguage('', 'eng'), 0);
    assert.equal(scoreTextByLanguage(null, 'eng'), 0);
    assert.equal(scoreTextByLanguage(undefined, 'eng'), 0);
  });

  it('returns 0 for unknown language', () => {
    assert.equal(scoreTextByLanguage('hello world', 'xyz'), 0);
  });

  it('returns 0 for whitespace-only text', () => {
    assert.equal(scoreTextByLanguage('   ', 'eng'), 0);
  });

  it('scores English text higher for eng than for rus', () => {
    const text = 'the quick brown fox jumps over the lazy dog and then he runs away from the house';
    const engScore = scoreTextByLanguage(text, 'eng');
    const rusScore = scoreTextByLanguage(text, 'rus');
    assert.ok(engScore > rusScore, `eng ${engScore} should beat rus ${rusScore}`);
  });

  it('scores Russian text higher for rus than for eng', () => {
    const text = 'он говорил что это было не так и она думала что все было хорошо но потом стало ясно';
    const rusScore = scoreTextByLanguage(text, 'rus');
    const engScore = scoreTextByLanguage(text, 'eng');
    assert.ok(rusScore > engScore, `rus ${rusScore} should beat eng ${engScore}`);
  });

  it('scores German text higher for deu than for eng', () => {
    const text = 'der Mann und die Frau sind in dem Haus mit den Kindern für das Fest';
    const deuScore = scoreTextByLanguage(text, 'deu');
    const engScore = scoreTextByLanguage(text, 'eng');
    assert.ok(deuScore > engScore, `deu ${deuScore} should beat eng ${engScore}`);
  });

  it('scores French text higher for fra than for eng', () => {
    const text = 'le chat est dans la maison et les enfants sont avec une belle femme pour le dîner';
    const fraScore = scoreTextByLanguage(text, 'fra');
    const engScore = scoreTextByLanguage(text, 'eng');
    assert.ok(fraScore > engScore, `fra ${fraScore} should beat eng ${engScore}`);
  });

  it('scores Japanese text higher for jpn', () => {
    const text = 'この本はとても面白いです。彼はまだ学校にいます。';
    const jpnScore = scoreTextByLanguage(text, 'jpn');
    const engScore = scoreTextByLanguage(text, 'eng');
    assert.ok(jpnScore > engScore, `jpn ${jpnScore} should beat eng ${engScore}`);
  });

  it('penalizes mixed Cyrillic-Latin tokens for Russian', () => {
    const cleanText = 'он говорил что это было не так';
    const mixedText = 'он говоrilл что это было не так';
    const cleanScore = scoreTextByLanguage(cleanText, 'rus');
    const mixedScore = scoreTextByLanguage(mixedText, 'rus');
    assert.ok(cleanScore > mixedScore, 'clean text should score higher than mixed');
  });

  it('penalizes mixed Cyrillic-Latin tokens for English', () => {
    const cleanText = 'the quick brown fox jumps over the lazy dog';
    const mixedText = 'the quiсk brown fox jumps over the lazy dog'; // с is Cyrillic
    const cleanScore = scoreTextByLanguage(cleanText, 'eng');
    const mixedScore = scoreTextByLanguage(mixedText, 'eng');
    assert.ok(cleanScore > mixedScore, 'clean text should score higher than mixed');
  });

  it('returns a positive score for text with digits', () => {
    const text = 'the year 2024 was great for the company';
    const score = scoreTextByLanguage(text, 'eng');
    assert.ok(score > 0);
  });

  it('returns a rounded integer', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const score = scoreTextByLanguage(text, 'eng');
    assert.equal(score, Math.round(score));
  });

  it('never returns a negative score', () => {
    // Even with heavy penalties the score is clamped to 0
    const score = scoreTextByLanguage('x', 'eng');
    assert.ok(score >= 0);
  });
});

// ─── detectLanguage ─────────────────────────────────────────────────────────

describe('detectLanguage', () => {
  it('returns eng for empty/null/short text', () => {
    assert.equal(detectLanguage(''), 'eng');
    assert.equal(detectLanguage(null), 'eng');
    assert.equal(detectLanguage(undefined), 'eng');
    assert.equal(detectLanguage('short'), 'eng');
    assert.equal(detectLanguage('less than twenty'), 'eng');
  });

  it('detects English text', () => {
    const text = 'the quick brown fox jumps over the lazy dog and then he runs away from the big house';
    assert.equal(detectLanguage(text), 'eng');
  });

  it('detects Russian text', () => {
    const text = 'он говорил что это было не так и она думала что все было хорошо но потом стало ясно что нет';
    assert.equal(detectLanguage(text), 'rus');
  });

  it('detects German text', () => {
    const text = 'der Mann und die Frau sind in dem Haus mit den Kindern für das große Fest im Garten';
    assert.equal(detectLanguage(text), 'deu');
  });

  it('detects French text', () => {
    const text = 'le chat est dans la maison et les enfants sont avec une belle femme pour le dîner ce soir';
    assert.equal(detectLanguage(text), 'fra');
  });

  it('detects Spanish text', () => {
    const text = 'el gato está en la casa y los niños están con una mujer para la cena de esta noche';
    assert.equal(detectLanguage(text), 'spa');
  });

  it('detects Italian text', () => {
    const text = 'il gatto è in una casa e i bambini sono con una donna per la cena di questa sera che è bella';
    assert.equal(detectLanguage(text), 'ita');
  });

  it('detects Portuguese text', () => {
    const text = 'o gato está em uma casa e as crianças estão com uma mulher para o jantar desta noite que é bonito';
    assert.equal(detectLanguage(text), 'por');
  });

  it('detects Japanese text', () => {
    const text = 'この本はとても面白いです。彼はまだ学校にいます。私たちは毎日勉強しています。';
    assert.equal(detectLanguage(text), 'jpn');
  });

  it('detects Korean text', () => {
    const text = '이 책은 매우 재미있습니다. 그는 아직 학교에 있습니다. 우리는 매일 공부하고 있습니다.';
    assert.equal(detectLanguage(text), 'kor');
  });

  it('detects Arabic text', () => {
    const text = 'هذا الكتاب ممتع للغاية. هو لا يزال في المدرسة. نحن ندرس كل يوم من أيام الأسبوع.';
    assert.equal(detectLanguage(text), 'ara');
  });

  it('detects Chinese Simplified text', () => {
    const text = '这本书非常有趣。他还在学校。我们每天都在学习。这是一个很好的地方。';
    const result = detectLanguage(text);
    assert.ok(result === 'chi_sim' || result === 'chi_tra', `expected chi_sim or chi_tra, got ${result}`);
  });

  it('detects Ukrainian text', () => {
    const text = 'він говорив що це було не так і вона думала що все було добре але потім стало ясно що ні її їх ще ви ми';
    const result = detectLanguage(text);
    assert.ok(result === 'ukr' || result === 'rus', `expected ukr or rus for Ukrainian text, got ${result}`);
  });

  it('detects Turkish text', () => {
    const text = 'bir adam ve bir kadın bu evde çocuklar ile birlikte yaşıyor ve daha çok mutlu olarak hayatlarını sürdürüyor';
    assert.equal(detectLanguage(text), 'tur');
  });

  it('detects Polish text', () => {
    const text = 'ten człowiek i ta kobieta są w domu z dziećmi na wielkie święto w ogrodzie które jest bardzo piękne';
    assert.equal(detectLanguage(text), 'pol');
  });

  it('detects Greek text', () => {
    const text = 'ο άνδρας και η γυναίκα είναι στο σπίτι με τα παιδιά για τη μεγάλη γιορτή στον κήπο';
    assert.equal(detectLanguage(text), 'ell');
  });

  it('detects Thai text', () => {
    const text = 'ที่ และ ใน มี ไม่ ของ จะ ได้ ว่า เป็น การ ให้ กับ ก็ แต่ คน นี้ จาก หรือ ไป มา อยู่ แล้ว ทำ เรา';
    assert.equal(detectLanguage(text), 'tha');
  });

  it('defaults to eng for text shorter than 20 chars', () => {
    assert.equal(detectLanguage('tiny'), 'eng');
    assert.equal(detectLanguage('1234567890123456789'), 'eng');
  });
});
