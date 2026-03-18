// ─── Unit Tests: OCR Post-Correction ────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDictionary,
  computeBigramFreqs,
  scoreBigrams,
  generateCandidates,
  correctOcrText,
  recoverParagraphs,
  computeQualityScore,
} from '../../app/modules/ocr-post-correct.js';

describe('buildDictionary', () => {
  it('builds a Set of lowercase words', () => {
    const dict = buildDictionary('Hello World JavaScript');
    assert.ok(dict.has('hello'));
    assert.ok(dict.has('world'));
    assert.ok(dict.has('javascript'));
    assert.ok(!dict.has('Hello')); // lowercase only
  });

  it('ignores single-char words', () => {
    const dict = buildDictionary('a I am the');
    assert.ok(!dict.has('a'));
    assert.ok(!dict.has('i'));
    assert.ok(dict.has('am'));
    assert.ok(dict.has('the'));
  });

  it('handles empty input', () => {
    const dict = buildDictionary('');
    assert.equal(dict.size, 0);
  });
});

describe('computeBigramFreqs', () => {
  it('computes bigram frequencies', () => {
    const freqs = computeBigramFreqs('the the the');
    assert.ok(freqs.has('th'));
    assert.ok(freqs.has('he'));
    assert.ok(freqs.get('th') > 0);
  });

  it('returns normalized frequencies', () => {
    const freqs = computeBigramFreqs('abab');
    // bigrams: ab, ba, ab → total 3
    assert.ok(Math.abs(freqs.get('ab') - 2/3) < 0.01);
    assert.ok(Math.abs(freqs.get('ba') - 1/3) < 0.01);
  });

  it('handles empty input', () => {
    const freqs = computeBigramFreqs('');
    assert.equal(freqs.size, 0);
  });
});

describe('scoreBigrams', () => {
  it('scores known words higher than unknown', () => {
    const freqs = computeBigramFreqs('the quick brown fox jumps over the lazy dog');
    const theScore = scoreBigrams('the', freqs);
    const xyzScore = scoreBigrams('xyz', freqs);
    assert.ok(theScore > xyzScore);
  });

  it('returns 1 for single-char words', () => {
    const freqs = computeBigramFreqs('test');
    assert.equal(scoreBigrams('a', freqs), 1);
  });
});

describe('generateCandidates', () => {
  it('generates OCR substitution candidates', () => {
    const candidates = generateCandidates('rnight');
    // Should include 'might' via rn→m substitution? No, "rn" in "rnight" → "might"
    // Actually "rnight" contains "rn" → replace with "m" → "might"
    assert.ok(candidates.includes('might'));
  });

  it('generates transposition candidates', () => {
    const candidates = generateCandidates('teh');
    assert.ok(candidates.includes('the'));
  });

  it('generates deletion candidates', () => {
    const candidates = generateCandidates('helllo');
    assert.ok(candidates.includes('hello'));
  });

  it('does not include the original word', () => {
    const candidates = generateCandidates('test');
    assert.ok(!candidates.includes('test'));
  });
});

describe('correctOcrText', () => {
  it('corrects known OCR errors', () => {
    const dict = buildDictionary('the quick brown fox might jump');
    const result = correctOcrText('teh quick brown fox', dict);
    assert.equal(result.corrected, 'the quick brown fox');
    assert.ok(result.corrections.length > 0);
    assert.equal(result.corrections[0].original, 'teh');
    assert.equal(result.corrections[0].replacement, 'the');
  });

  it('preserves words already in dictionary', () => {
    const dict = buildDictionary('hello world test');
    const result = correctOcrText('hello world', dict);
    assert.equal(result.corrected, 'hello world');
    assert.equal(result.corrections.length, 0);
  });

  it('preserves case pattern', () => {
    const dict = buildDictionary('the hello');
    const result = correctOcrText('TEH world', dict);
    // "TEH" → all uppercase, so correction should be "THE"
    assert.equal(result.corrections[0].replacement, 'THE');
  });

  it('respects maxCorrections', () => {
    const dict = buildDictionary('the');
    const text = 'teh teh teh teh teh';
    const result = correctOcrText(text, dict, null, { maxCorrections: 2 });
    assert.equal(result.corrections.length, 2);
  });

  it('uses bigram scoring when provided', () => {
    const dict = buildDictionary('the them test');
    const freqs = computeBigramFreqs('the them their there these');
    const result = correctOcrText('teh quick', dict, freqs);
    assert.ok(result.corrections.length >= 1);
  });
});

describe('recoverParagraphs', () => {
  it('merges lines within a paragraph', () => {
    const text = 'Hello this is a\nlong sentence that\ncontinues here.';
    const result = recoverParagraphs(text);
    assert.ok(result.includes('Hello this is a long sentence that continues here.'));
  });

  it('splits on blank lines', () => {
    const text = 'First paragraph.\n\nSecond paragraph.';
    const result = recoverParagraphs(text);
    assert.ok(result.includes('First paragraph.\n\nSecond paragraph.'));
  });

  it('handles hyphenation by removing trailing hyphen', () => {
    const text = 'This is a hyphen-\nated word here.';
    const result = recoverParagraphs(text);
    // Hyphen removed, next line merged: "hyphen" + " " + "ated word here."
    assert.ok(!result.includes('hyphen-'));
    assert.ok(result.includes('hyphen ated'));
  });

  it('handles empty input', () => {
    assert.equal(recoverParagraphs(''), '');
  });
});

describe('computeQualityScore', () => {
  it('returns 100 for all known words', () => {
    const dict = buildDictionary('hello world test');
    assert.equal(computeQualityScore('hello world test', dict), 100);
  });

  it('returns 0 for all unknown words', () => {
    const dict = buildDictionary('apple banana');
    assert.equal(computeQualityScore('xyz abc def', dict), 0);
  });

  it('returns 100 for empty text', () => {
    const dict = buildDictionary('test');
    assert.equal(computeQualityScore('', dict), 100);
  });

  it('handles mixed known/unknown words', () => {
    const dict = buildDictionary('hello world');
    const score = computeQualityScore('hello world xyz', dict);
    // 2 known out of 3 words with length >=3
    assert.ok(score > 50 && score < 100);
  });
});
