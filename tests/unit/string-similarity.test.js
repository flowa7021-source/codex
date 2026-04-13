// ─── Unit Tests: String Similarity ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levenshtein,
  damerauLevenshtein,
  hammingDistance,
  jaccardSimilarity,
  cosineSimilarityStr,
  longestCommonSubsequence,
  longestCommonSubstring,
  similarityRatio,
} from '../../app/modules/string-similarity.js';

describe('levenshtein', () => {
  it('identical strings have distance 0', () => assert.equal(levenshtein('abc', 'abc'), 0));
  it('empty to non-empty', () => assert.equal(levenshtein('', 'abc'), 3));
  it('non-empty to empty', () => assert.equal(levenshtein('abc', ''), 3));
  it('single substitution', () => assert.equal(levenshtein('cat', 'bat'), 1));
  it('classic kitten/sitting', () => assert.equal(levenshtein('kitten', 'sitting'), 3));
  it('single insertion', () => assert.equal(levenshtein('abc', 'abcd'), 1));
  it('single deletion', () => assert.equal(levenshtein('abcd', 'abc'), 1));
});

describe('damerauLevenshtein', () => {
  it('identical strings have distance 0', () => assert.equal(damerauLevenshtein('abc', 'abc'), 0));
  it('transposition counts as 1', () => assert.equal(damerauLevenshtein('ab', 'ba'), 1));
  it('levenshtein gives 2 for same transposition', () => assert.equal(levenshtein('ab', 'ba'), 2));
});

describe('hammingDistance', () => {
  it('equal strings distance 0', () => assert.equal(hammingDistance('abc', 'abc'), 0));
  it('all different', () => assert.equal(hammingDistance('abc', 'xyz'), 3));
  it('one difference', () => assert.equal(hammingDistance('cat', 'bat'), 1));
  it('throws for different lengths', () => assert.throws(() => hammingDistance('ab', 'abc')));
});

describe('jaccardSimilarity', () => {
  it('identical strings return 1', () => assert.equal(jaccardSimilarity('abc', 'abc'), 1));
  it('partial overlap is between 0 and 1', () => {
    // 'abc' bigrams: {ab, bc}; 'abd' bigrams: {ab, bd} — share 'ab'
    const s = jaccardSimilarity('abc', 'abd');
    assert.ok(s > 0 && s < 1);
  });
});

describe('cosineSimilarityStr', () => {
  it('identical strings return 1', () => {
    assert.ok(Math.abs(cosineSimilarityStr('hello', 'hello') - 1) < 1e-9);
  });
  it('returns value between 0 and 1', () => {
    const s = cosineSimilarityStr('hello', 'world');
    assert.ok(s >= 0 && s <= 1);
  });
});

describe('longestCommonSubsequence', () => {
  it('LCS of identical strings is full length', () => assert.equal(longestCommonSubsequence('abc', 'abc'), 3));
  it('LCS of disjoint strings is 0', () => assert.equal(longestCommonSubsequence('abc', 'xyz'), 0));
  it('ABCBDAB / BDCAB = 4', () => assert.equal(longestCommonSubsequence('ABCBDAB', 'BDCAB'), 4));
});

describe('longestCommonSubstring', () => {
  it('returns common substring', () => assert.equal(longestCommonSubstring('abcdef', 'bcde'), 'bcde'));
  it('returns empty for disjoint strings', () => assert.equal(longestCommonSubstring('abc', 'xyz'), ''));
  it('identical strings return full string', () => assert.equal(longestCommonSubstring('hello', 'hello'), 'hello'));
});

describe('similarityRatio', () => {
  it('identical strings return 1', () => assert.equal(similarityRatio('abc', 'abc'), 1));
  it('ratio is between 0 and 1', () => {
    const r = similarityRatio('hello', 'hallo');
    assert.ok(r >= 0 && r <= 1);
  });
  it('empty strings return 1', () => assert.equal(similarityRatio('', ''), 1));
});
