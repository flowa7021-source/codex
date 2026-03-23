import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levenshtein,
  wordErrorRate,
  computeTextCER,
  computeLayoutScore,
  validateConversion,
} from '../../app/modules/conversion-qa.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(levenshtein('hello', 'hello'), 0);
  });

  it('returns length of other string when one is empty', () => {
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
  });

  it('computes correct distance for simple edits', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
    assert.equal(levenshtein('abc', 'axc'), 1);
  });

  it('is symmetric', () => {
    assert.equal(levenshtein('foo', 'bar'), levenshtein('bar', 'foo'));
  });
});

describe('wordErrorRate', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(wordErrorRate('hello world', 'hello world'), 0);
  });

  it('returns 0 when both are empty', () => {
    assert.equal(wordErrorRate('', ''), 0);
  });

  it('returns hypothesis length when reference is empty', () => {
    assert.equal(wordErrorRate('', 'one two'), 2);
  });

  it('computes word-level error rate', () => {
    // 1 substitution out of 3 ref words
    const wer = wordErrorRate('the cat sat', 'the dog sat');
    assert.ok(Math.abs(wer - 1 / 3) < 0.01);
  });
});

describe('computeTextCER', () => {
  it('returns 0 cer for identical text', () => {
    const result = computeTextCER('hello world', 'hello world');
    assert.equal(result.cer, 0);
    assert.equal(result.wer, 0);
    assert.equal(result.distance, 0);
  });

  it('normalises whitespace before comparison', () => {
    const result = computeTextCER('hello   world', 'hello world');
    assert.equal(result.cer, 0);
  });

  it('returns correct lengths', () => {
    const result = computeTextCER('abc', 'abcdef');
    assert.equal(result.pdfLength, 3);
    assert.equal(result.docxLength, 6);
  });
});

describe('computeLayoutScore', () => {
  it('returns totalScore between 0 and 1', () => {
    const result = computeLayoutScore({
      cer: 0, ssim: 1,
      tablesCorrect: 5, tablesTotal: 5,
      fontsCorrect: 3, fontsTotal: 3,
      headingsCorrect: 2, headingsTotal: 2,
      listsCorrect: 1, listsTotal: 1,
    });
    assert.ok(result.totalScore >= 0 && result.totalScore <= 1);
    assert.ok(result.totalScore > 0.9);
  });

  it('handles zero totals gracefully', () => {
    const result = computeLayoutScore({
      cer: 0, ssim: 0,
      tablesCorrect: 0, tablesTotal: 0,
      fontsCorrect: 0, fontsTotal: 0,
      headingsCorrect: 0, headingsTotal: 0,
      listsCorrect: 0, listsTotal: 0,
    });
    assert.equal(typeof result.totalScore, 'number');
  });

  it('textCER dimension maps high CER to 0', () => {
    const result = computeLayoutScore({
      cer: 0.2, ssim: 0,
      tablesCorrect: 0, tablesTotal: 0,
      fontsCorrect: 0, fontsTotal: 0,
      headingsCorrect: 0, headingsTotal: 0,
      listsCorrect: 0, listsTotal: 0,
    });
    assert.equal(result.scores.textCER, 0);
  });
});

describe('validateConversion', () => {
  it('returns score, textMetrics and details', async () => {
    const pages = [
      { textRuns: [{ text: 'hello' }, { text: 'world' }], tables: [1], headings: [1] },
    ];
    const result = await validateConversion(pages, 'hello world');
    assert.ok(result.score);
    assert.ok(result.textMetrics);
    assert.equal(result.details.pageCount, 1);
    assert.equal(result.details.tables, 1);
    assert.equal(result.details.headings, 1);
  });

  it('handles empty pages', async () => {
    const result = await validateConversion([], '');
    assert.equal(result.details.pageCount, 0);
  });
});
