// ─── Unit Tests: Edit Distance / String Alignment ────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levenshtein,
  damerauLevenshtein,
  longestCommonSubsequence,
  lcsLength,
  alignment,
  similarity,
} from '../../app/modules/edit-distance.js';

// ─── levenshtein ─────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it("levenshtein('', '') === 0", () => {
    assert.equal(levenshtein('', ''), 0);
  });

  it("levenshtein('a', '') === 1", () => {
    assert.equal(levenshtein('a', ''), 1);
  });

  it("levenshtein('', 'abc') === 3", () => {
    assert.equal(levenshtein('', 'abc'), 3);
  });

  it("levenshtein('kitten', 'sitting') === 3", () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
  });

  it('equal strings have distance 0', () => {
    assert.equal(levenshtein('hello', 'hello'), 0);
    assert.equal(levenshtein('abc', 'abc'), 0);
  });

  it('single-character difference costs 1 (substitution)', () => {
    assert.equal(levenshtein('abc', 'axc'), 1);
  });

  it('single insertion costs 1', () => {
    assert.equal(levenshtein('abc', 'abcd'), 1);
  });

  it('single deletion costs 1', () => {
    assert.equal(levenshtein('abcd', 'abc'), 1);
  });

  it('is symmetric', () => {
    assert.equal(levenshtein('kitten', 'sitting'), levenshtein('sitting', 'kitten'));
    assert.equal(levenshtein('abc', 'xyz'), levenshtein('xyz', 'abc'));
  });

  it("levenshtein('saturday', 'sunday') === 3", () => {
    assert.equal(levenshtein('saturday', 'sunday'), 3);
  });
});

// ─── damerauLevenshtein ───────────────────────────────────────────────────────

describe('damerauLevenshtein', () => {
  it("damerauLevenshtein('', '') === 0", () => {
    assert.equal(damerauLevenshtein('', ''), 0);
  });

  it("damerauLevenshtein('a', '') === 1", () => {
    assert.equal(damerauLevenshtein('a', ''), 1);
  });

  it("damerauLevenshtein('', 'abc') === 3", () => {
    assert.equal(damerauLevenshtein('', 'abc'), 3);
  });

  it("transposition 'ca' → 'ac' costs 1", () => {
    assert.equal(damerauLevenshtein('ca', 'ac'), 1);
  });

  it("'abc' → 'ca' — insert 'a', transpose 'bc'→'cb' not needed, verify ≤ levenshtein", () => {
    // Damerau-Levenshtein should be ≤ plain Levenshtein (transpositions help).
    assert.ok(damerauLevenshtein('ca', 'abc') <= levenshtein('ca', 'abc'));
  });

  it("'ca' → 'abc': distance is 3", () => {
    // 'ca' → 'abc': sub 'c'→'a' (1), sub 'a'→'b' (1), insert 'c' (1) = 3.
    // No combination of transpositions reduces this below 3.
    assert.equal(damerauLevenshtein('ca', 'abc'), 3);
  });

  it('equal strings have distance 0', () => {
    assert.equal(damerauLevenshtein('hello', 'hello'), 0);
  });

  it('agrees with levenshtein when no transpositions are beneficial', () => {
    // 'kitten'→'sitting': no adjacent transposition helps here.
    assert.equal(damerauLevenshtein('kitten', 'sitting'), levenshtein('kitten', 'sitting'));
  });

  it('transposition of adjacent chars: ab→ba costs 1', () => {
    assert.equal(damerauLevenshtein('ab', 'ba'), 1);
  });

  it('result is always non-negative', () => {
    for (const [a, b] of [['foo', 'bar'], ['', 'x'], ['abc', 'abc']]) {
      assert.ok(damerauLevenshtein(a, b) >= 0);
    }
  });
});

// ─── lcsLength ───────────────────────────────────────────────────────────────

describe('lcsLength', () => {
  it("lcsLength('ABCBDAB', 'BDCAB') === 4", () => {
    assert.equal(lcsLength('ABCBDAB', 'BDCAB'), 4);
  });

  it('returns 0 for empty strings', () => {
    assert.equal(lcsLength('', ''), 0);
    assert.equal(lcsLength('abc', ''), 0);
    assert.equal(lcsLength('', 'abc'), 0);
  });

  it('identical strings have LCS length equal to string length', () => {
    assert.equal(lcsLength('hello', 'hello'), 5);
  });

  it('completely disjoint strings have LCS length 0', () => {
    assert.equal(lcsLength('abc', 'xyz'), 0);
  });

  it('single matching character', () => {
    assert.equal(lcsLength('a', 'a'), 1);
    assert.equal(lcsLength('a', 'b'), 0);
  });

  it('is symmetric', () => {
    assert.equal(lcsLength('ABCBDAB', 'BDCAB'), lcsLength('BDCAB', 'ABCBDAB'));
  });

  it("lcsLength('AGGTAB', 'GXTXAYB') === 4", () => {
    assert.equal(lcsLength('AGGTAB', 'GXTXAYB'), 4);
  });
});

// ─── longestCommonSubsequence ─────────────────────────────────────────────────

describe('longestCommonSubsequence', () => {
  it("LCS of 'ABCBDAB' and 'BDCAB' has length 4", () => {
    const lcs = longestCommonSubsequence('ABCBDAB', 'BDCAB');
    assert.equal(lcs.length, 4);
  });

  it("LCS of 'ABCBDAB' and 'BDCAB' is a valid subsequence of both", () => {
    const lcs = longestCommonSubsequence('ABCBDAB', 'BDCAB');
    assert.ok(isSubsequence(lcs, 'ABCBDAB'), `'${lcs}' is not a subsequence of 'ABCBDAB'`);
    assert.ok(isSubsequence(lcs, 'BDCAB'),   `'${lcs}' is not a subsequence of 'BDCAB'`);
  });

  it('returns empty string when one input is empty', () => {
    assert.equal(longestCommonSubsequence('', 'abc'), '');
    assert.equal(longestCommonSubsequence('abc', ''), '');
  });

  it('returns the string itself for identical inputs', () => {
    assert.equal(longestCommonSubsequence('hello', 'hello'), 'hello');
  });

  it('returns empty string for disjoint inputs', () => {
    assert.equal(longestCommonSubsequence('abc', 'xyz'), '');
  });

  it('LCS length matches lcsLength()', () => {
    const pairs = [
      ['ABCBDAB', 'BDCAB'],
      ['hello', 'hallo'],
      ['abc', 'abc'],
      ['', 'xyz'],
    ];
    for (const [a, b] of pairs) {
      assert.equal(longestCommonSubsequence(a, b).length, lcsLength(a, b));
    }
  });
});

// ─── alignment ───────────────────────────────────────────────────────────────

describe('alignment', () => {
  it('aligned strings always have the same length', () => {
    const pairs = [
      ['AGTACGCA', 'TATGC'],
      ['abc', 'abc'],
      ['abc', 'xyz'],
      ['', 'abc'],
      ['abc', ''],
      ['', ''],
      ['kitten', 'sitting'],
    ];
    for (const [a, b] of pairs) {
      const result = alignment(a, b);
      assert.equal(
        result.alignedA.length,
        result.alignedB.length,
        `aligned lengths differ for ('${a}', '${b}'): '${result.alignedA}' vs '${result.alignedB}'`,
      );
    }
  });

  it("gaps are represented as '-'", () => {
    const { alignedA, alignedB } = alignment('AGTACGCA', 'TATGC');
    // At least one gap must be present (strings differ in length).
    assert.ok(
      alignedA.includes('-') || alignedB.includes('-'),
      'expected at least one gap character',
    );
  });

  it('identical strings: score = string length, no gaps', () => {
    const { score, alignedA, alignedB } = alignment('abc', 'abc');
    assert.equal(score, 3); // 3 matches × 1
    assert.equal(alignedA, 'abc');
    assert.equal(alignedB, 'abc');
  });

  it('both empty: score = 0, aligned strings are empty', () => {
    const { score, alignedA, alignedB } = alignment('', '');
    assert.equal(score, 0);
    assert.equal(alignedA, '');
    assert.equal(alignedB, '');
  });

  it("one empty string: score = -2 × length (all gaps)", () => {
    const { score } = alignment('abc', '');
    assert.equal(score, -6); // 3 gaps × −2
  });

  it('alignedA without gaps equals original a', () => {
    const a = 'AGTACGCA';
    const b = 'TATGC';
    const { alignedA } = alignment(a, b);
    assert.equal(alignedA.replace(/-/g, ''), a);
  });

  it('alignedB without gaps equals original b', () => {
    const a = 'AGTACGCA';
    const b = 'TATGC';
    const { alignedB } = alignment(a, b);
    assert.equal(alignedB.replace(/-/g, ''), b);
  });

  it('score is a finite number', () => {
    const { score } = alignment('hello', 'world');
    assert.ok(Number.isFinite(score));
  });

  it('all-mismatch score: each position costs −1', () => {
    // 'ab' vs 'xy': 2 mismatches, no gaps → score = −2
    const { score } = alignment('ab', 'xy');
    assert.equal(score, -2);
  });
});

// ─── similarity ──────────────────────────────────────────────────────────────

describe('similarity', () => {
  it("similarity('hello', 'hello') === 1", () => {
    assert.equal(similarity('hello', 'hello'), 1);
  });

  it("similarity('', '') === 1 (both empty → identical)", () => {
    assert.equal(similarity('', ''), 1);
  });

  it("similarity('', 'abc') === 0", () => {
    assert.equal(similarity('', 'abc'), 0);
  });

  it("similarity('abc', '') === 0", () => {
    assert.equal(similarity('abc', ''), 0);
  });

  it("similarity('abc', 'abd') is close to 1", () => {
    const s = similarity('abc', 'abd');
    assert.ok(s > 0.6 && s <= 1, `expected value close to 1, got ${s}`);
  });

  it('result is always in [0, 1]', () => {
    const pairs = [
      ['', ''],
      ['', 'abc'],
      ['abc', ''],
      ['abc', 'abc'],
      ['kitten', 'sitting'],
      ['completely', 'different'],
    ];
    for (const [a, b] of pairs) {
      const s = similarity(a, b);
      assert.ok(s >= 0 && s <= 1, `similarity('${a}', '${b}') = ${s} out of [0,1]`);
    }
  });

  it('is symmetric', () => {
    const pairs = [['kitten', 'sitting'], ['abc', 'xyz'], ['hello', 'hallo']];
    for (const [a, b] of pairs) {
      assert.ok(Math.abs(similarity(a, b) - similarity(b, a)) < 1e-10);
    }
  });

  it('more similar strings score higher', () => {
    // 'abc'/'abd' differ by 1; 'abc'/'xyz' differ by 3
    assert.ok(similarity('abc', 'abd') > similarity('abc', 'xyz'));
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if `sub` is a subsequence of `str`. */
function isSubsequence(sub, str) {
  let si = 0;
  for (let i = 0; i < str.length && si < sub.length; i++) {
    if (str[i] === sub[si]) si++;
  }
  return si === sub.length;
}
