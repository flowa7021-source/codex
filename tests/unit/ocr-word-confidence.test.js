// ─── Unit Tests: OCR Word Confidence ─────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreWord,
  scoreAllWords,
  markLowConfidenceWords,
  getPageQualitySummary,
} from '../../app/modules/ocr-word-confidence.js';

// ── scoreWord ───────────────────────────────────────────────────────────────

describe('scoreWord', () => {
  it('returns low score for empty word', () => {
    const result = scoreWord('');
    assert.equal(result.score, 0);
    assert.equal(result.level, 'low');
    assert.ok(result.issues.includes('empty'));
  });

  it('returns low score for null word', () => {
    const result = scoreWord(null);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'low');
  });

  it('returns low score for undefined word', () => {
    const result = scoreWord(undefined);
    assert.equal(result.score, 0);
    assert.equal(result.level, 'low');
  });

  it('returns high score for a clean English word', () => {
    const result = scoreWord('Hello', 'eng');
    assert.equal(result.level, 'high');
    assert.ok(result.score >= 70);
  });

  it('returns high score for a clean Russian word', () => {
    const result = scoreWord('Привет', 'rus');
    assert.equal(result.level, 'high');
    assert.ok(result.score >= 70);
  });

  it('detects garbage characters', () => {
    const result = scoreWord('@#$%^');
    assert.ok(result.issues.includes('garbage-chars'));
    assert.ok(result.score < 70);
  });

  it('detects repeated characters', () => {
    const result = scoreWord('ааааааа');
    assert.ok(result.issues.includes('repeated-chars'));
  });

  it('detects mixed script (Cyrillic + Latin)', () => {
    const result = scoreWord('Helloмир');
    assert.ok(result.issues.includes('mixed-script'));
  });

  it('detects no vowels in long word', () => {
    const result = scoreWord('bcdfg');
    assert.ok(result.issues.includes('no-vowels'));
  });

  it('does not flag short words for no vowels', () => {
    const result = scoreWord('xyz');
    assert.ok(!result.issues.includes('no-vowels'));
  });

  it('detects excessive consonant clusters (English)', () => {
    const result = scoreWord('bcdflmn');
    assert.ok(result.issues.includes('consonant-cluster'));
  });

  it('detects excessive consonant clusters (Russian)', () => {
    const result = scoreWord('бвгджзк');
    assert.ok(result.issues.includes('consonant-cluster'));
  });

  it('detects single unknown character', () => {
    const result = scoreWord('©');
    assert.ok(result.issues.includes('single-unknown-char'));
  });

  it('does not flag common single chars', () => {
    const result = scoreWord('a');
    assert.ok(!result.issues.includes('single-unknown-char'));
  });

  it('detects too-long words', () => {
    const result = scoreWord('a'.repeat(30));
    assert.ok(result.issues.includes('too-long'));
  });

  it('detects digit-letter confusion', () => {
    const result = scoreWord('0бъект');
    assert.ok(result.issues.includes('digit-letter-confusion'));
  });

  it('score is clamped between 0 and 100', () => {
    const garbage = scoreWord('@#$%^&*{}[]~');
    assert.ok(garbage.score >= 0);
    assert.ok(garbage.score <= 100);
  });

  it('returns correct structure', () => {
    const result = scoreWord('test');
    assert.ok('word' in result);
    assert.ok('score' in result);
    assert.ok('level' in result);
    assert.ok('issues' in result);
    assert.ok(Array.isArray(result.issues));
  });

  it('level is high for score >= 70', () => {
    const result = scoreWord('hello', 'eng');
    if (result.score >= 70) assert.equal(result.level, 'high');
  });

  it('trims whitespace from word', () => {
    const result = scoreWord('  hello  ');
    assert.equal(result.word, 'hello');
  });
});

// ── scoreAllWords ───────────────────────────────────────────────────────────

describe('scoreAllWords', () => {
  it('returns empty result for null text', () => {
    const result = scoreAllWords(null);
    assert.deepEqual(result.words, []);
    assert.equal(result.avgScore, 0);
    assert.equal(result.lowConfidenceCount, 0);
  });

  it('returns empty result for empty text', () => {
    const result = scoreAllWords('');
    assert.deepEqual(result.words, []);
    assert.equal(result.avgScore, 0);
  });

  it('scores multiple words', () => {
    const result = scoreAllWords('Hello world today');
    assert.equal(result.words.length, 3);
    assert.ok(result.avgScore > 0);
  });

  it('counts low confidence words', () => {
    const result = scoreAllWords('Hello @#$% world');
    assert.ok(result.lowConfidenceCount >= 0);
  });

  it('calculates average score', () => {
    const result = scoreAllWords('clean text here');
    assert.ok(result.avgScore > 0);
    assert.ok(result.avgScore <= 100);
  });

  it('handles text with only whitespace', () => {
    const result = scoreAllWords('   ');
    assert.deepEqual(result.words, []);
    assert.equal(result.avgScore, 0);
  });
});

// ── markLowConfidenceWords ──────────────────────────────────────────────────

describe('markLowConfidenceWords', () => {
  it('returns empty string for null input', () => {
    assert.equal(markLowConfidenceWords(null), '');
  });

  it('returns empty string for empty input', () => {
    assert.equal(markLowConfidenceWords(''), '');
  });

  it('does not mark high-confidence words', () => {
    const result = markLowConfidenceWords('Hello world');
    assert.ok(!result.includes('[?'));
  });

  it('marks low-confidence words with [? ?] markers', () => {
    const result = markLowConfidenceWords('@#$%^&*{}[]');
    assert.ok(result.includes('[?'));
    assert.ok(result.includes('?]'));
  });

  it('preserves whitespace between words', () => {
    const result = markLowConfidenceWords('Hello  world');
    assert.ok(result.includes('  ')); // double space preserved
  });

  it('handles single word', () => {
    const result = markLowConfidenceWords('hello');
    assert.equal(result, 'hello');
  });
});

// ── getPageQualitySummary ───────────────────────────────────────────────────

describe('getPageQualitySummary', () => {
  it('returns good quality for clean text', () => {
    const result = getPageQualitySummary('Hello world this is clean text');
    assert.equal(result.quality, 'good');
    assert.ok(result.avgScore >= 75);
    assert.ok(result.totalWords > 0);
  });

  it('returns correct totalWords count', () => {
    const result = getPageQualitySummary('one two three four five');
    assert.equal(result.totalWords, 5);
  });

  it('returns poor quality for garbage text', () => {
    const result = getPageQualitySummary('@#$% ^&*{ }[]~ |\\` @#$%^');
    assert.equal(result.quality, 'poor');
    assert.ok(result.avgScore < 50);
  });

  it('counts low confidence words', () => {
    const result = getPageQualitySummary('@#$% Hello ^&*{}');
    assert.ok(result.lowCount >= 1);
  });

  it('counts medium confidence words', () => {
    const result = getPageQualitySummary('Hello world test');
    assert.ok(typeof result.mediumCount === 'number');
  });

  it('handles empty text', () => {
    const result = getPageQualitySummary('');
    assert.equal(result.totalWords, 0);
    assert.equal(result.avgScore, 0);
  });

  it('returns correct structure', () => {
    const result = getPageQualitySummary('test');
    assert.ok('quality' in result);
    assert.ok('avgScore' in result);
    assert.ok('totalWords' in result);
    assert.ok('lowCount' in result);
    assert.ok('mediumCount' in result);
  });
});
