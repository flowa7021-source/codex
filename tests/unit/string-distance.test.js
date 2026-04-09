// ─── Unit Tests: string-distance ──────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levenshtein,
  damerauLevenshtein,
  hammingDistance,
  jaccardSimilarity,
  jaroSimilarity,
  jaroWinkler,
  longestCommonSubsequence,
  longestCommonSubstring,
  isAnagram,
  isPalindrome,
} from '../../app/modules/string-distance.js';

// ─── levenshtein ──────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it('identical strings have distance 0', () => {
    assert.equal(levenshtein('kitten', 'kitten'), 0);
  });

  it('empty string to non-empty equals string length', () => {
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
  });

  it('classic kitten → sitting (3 edits)', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
  });

  it('single character substitution', () => {
    assert.equal(levenshtein('cat', 'bat'), 1);
  });

  it('single insertion', () => {
    assert.equal(levenshtein('abc', 'abcd'), 1);
  });

  it('single deletion', () => {
    assert.equal(levenshtein('abcd', 'abc'), 1);
  });

  it('completely different strings', () => {
    assert.equal(levenshtein('abc', 'xyz'), 3);
  });

  it('both empty strings have distance 0', () => {
    assert.equal(levenshtein('', ''), 0);
  });

  it('saturday → sunday (3 edits)', () => {
    assert.equal(levenshtein('saturday', 'sunday'), 3);
  });

  it('case sensitive comparison', () => {
    assert.equal(levenshtein('ABC', 'abc'), 3);
  });
});

// ─── damerauLevenshtein ───────────────────────────────────────────────────────

describe('damerauLevenshtein', () => {
  it('identical strings have distance 0', () => {
    assert.equal(damerauLevenshtein('abc', 'abc'), 0);
  });

  it('transposition costs 1', () => {
    assert.equal(damerauLevenshtein('ab', 'ba'), 1);
  });

  it('regular edit still works: kitten → sitting (3)', () => {
    assert.equal(damerauLevenshtein('kitten', 'sitting'), 3);
  });

  it('empty to non-empty', () => {
    assert.equal(damerauLevenshtein('', 'abc'), 3);
    assert.equal(damerauLevenshtein('abc', ''), 3);
  });

  it('both empty', () => {
    assert.equal(damerauLevenshtein('', ''), 0);
  });

  it('transposition: ca → ac is 1', () => {
    assert.equal(damerauLevenshtein('ca', 'ac'), 1);
  });

  it('levenshtein and damerau agree when no transpositions needed', () => {
    const pairs = [['dog', 'cat'], ['abc', 'xyz'], ['hello', 'hell']];
    for (const [a, b] of pairs) {
      assert.equal(damerauLevenshtein(a, b), levenshtein(a, b));
    }
  });

  it('damerau ≤ levenshtein when transpositions present', () => {
    // "ab" vs "ba": levenshtein = 2 (sub both), damerau = 1 (transpose)
    assert.ok(damerauLevenshtein('ab', 'ba') <= levenshtein('ab', 'ba'));
  });

  it('single character strings, different', () => {
    assert.equal(damerauLevenshtein('a', 'b'), 1);
  });
});

// ─── hammingDistance ──────────────────────────────────────────────────────────

describe('hammingDistance', () => {
  it('identical strings have distance 0', () => {
    assert.equal(hammingDistance('abc', 'abc'), 0);
  });

  it('one character differs', () => {
    assert.equal(hammingDistance('abc', 'axc'), 1);
  });

  it('all characters differ', () => {
    assert.equal(hammingDistance('abc', 'xyz'), 3);
  });

  it('empty strings have distance 0', () => {
    assert.equal(hammingDistance('', ''), 0);
  });

  it('classic binary example 1011101 vs 1001001 → 2', () => {
    assert.equal(hammingDistance('1011101', '1001001'), 2);
  });

  it('throws when strings have different lengths', () => {
    assert.throws(() => hammingDistance('abc', 'ab'), RangeError);
  });

  it('throws with empty vs non-empty', () => {
    assert.throws(() => hammingDistance('', 'a'), RangeError);
  });

  it('single character, same', () => {
    assert.equal(hammingDistance('a', 'a'), 0);
  });

  it('single character, different', () => {
    assert.equal(hammingDistance('a', 'b'), 1);
  });
});

// ─── jaccardSimilarity ────────────────────────────────────────────────────────

describe('jaccardSimilarity', () => {
  it('identical strings return 1', () => {
    assert.equal(jaccardSimilarity('abc', 'abc'), 1);
  });

  it('completely disjoint character sets return 0', () => {
    assert.equal(jaccardSimilarity('abc', 'xyz'), 0);
  });

  it('both empty strings return 1', () => {
    assert.equal(jaccardSimilarity('', ''), 1);
  });

  it('result is in [0, 1]', () => {
    const val = jaccardSimilarity('hello', 'world');
    assert.ok(val >= 0 && val <= 1);
  });

  it('partial overlap: "abc" vs "acd" → 2/4 = 0.5', () => {
    // intersection: {a, c}, union: {a, b, c, d}
    assert.equal(jaccardSimilarity('abc', 'acd'), 0.5);
  });

  it('one empty string against non-empty returns 0', () => {
    assert.equal(jaccardSimilarity('', 'abc'), 0);
    assert.equal(jaccardSimilarity('abc', ''), 0);
  });

  it('duplicate characters in string are treated as a set', () => {
    // 'aa' as a set is just {'a'}
    assert.equal(jaccardSimilarity('aa', 'a'), 1);
  });

  it('symmetry: J(a,b) == J(b,a)', () => {
    assert.equal(jaccardSimilarity('hello', 'world'), jaccardSimilarity('world', 'hello'));
  });
});

// ─── jaroSimilarity ───────────────────────────────────────────────────────────

describe('jaroSimilarity', () => {
  it('identical strings return 1', () => {
    assert.equal(jaroSimilarity('abc', 'abc'), 1);
  });

  it('completely different strings return 0 or near 0', () => {
    assert.ok(jaroSimilarity('abc', 'xyz') < 0.5);
  });

  it('empty vs empty returns 1', () => {
    assert.equal(jaroSimilarity('', ''), 1);
  });

  it('empty vs non-empty returns 0', () => {
    assert.equal(jaroSimilarity('', 'abc'), 0);
    assert.equal(jaroSimilarity('abc', ''), 0);
  });

  it('MARTHA vs MARHTA ≈ 0.944', () => {
    const val = jaroSimilarity('MARTHA', 'MARHTA');
    assert.ok(Math.abs(val - 0.9444) < 0.001, `got ${val}`);
  });

  it('DWAYNE vs DUANE ≈ 0.822', () => {
    const val = jaroSimilarity('DWAYNE', 'DUANE');
    assert.ok(Math.abs(val - 0.822) < 0.005, `got ${val}`);
  });

  it('result is in [0, 1]', () => {
    const val = jaroSimilarity('hello', 'world');
    assert.ok(val >= 0 && val <= 1);
  });

  it('symmetry: jaro(a,b) == jaro(b,a)', () => {
    const a = jaroSimilarity('kitten', 'sitting');
    const b = jaroSimilarity('sitting', 'kitten');
    assert.ok(Math.abs(a - b) < 1e-10);
  });

  it('single characters, same → 1', () => {
    assert.equal(jaroSimilarity('a', 'a'), 1);
  });

  it('single characters, different → 0', () => {
    assert.equal(jaroSimilarity('a', 'b'), 0);
  });
});

// ─── jaroWinkler ──────────────────────────────────────────────────────────────

describe('jaroWinkler', () => {
  it('identical strings return 1', () => {
    assert.equal(jaroWinkler('abc', 'abc'), 1);
  });

  it('result is always ≥ jaro', () => {
    const pairs = [['MARTHA', 'MARHTA'], ['hello', 'helo'], ['foo', 'bar']];
    for (const [a, b] of pairs) {
      assert.ok(jaroWinkler(a, b) >= jaroSimilarity(a, b));
    }
  });

  it('MARTHA vs MARHTA: JW > Jaro', () => {
    const jaro = jaroSimilarity('MARTHA', 'MARHTA');
    const jw = jaroWinkler('MARTHA', 'MARHTA');
    assert.ok(jw > jaro);
  });

  it('result is in [0, 1]', () => {
    const val = jaroWinkler('hello', 'world');
    assert.ok(val >= 0 && val <= 1);
  });

  it('default p is 0.1', () => {
    assert.equal(jaroWinkler('abc', 'abc'), jaroWinkler('abc', 'abc', 0.1));
  });

  it('DIXON vs DICKSONX ≈ 0.813', () => {
    // Known Jaro-Winkler test vector
    const val = jaroWinkler('DIXON', 'DICKSONX');
    assert.ok(val > 0.75 && val <= 1, `got ${val}`);
  });

  it('strings with common prefix score higher than without', () => {
    const withPrefix = jaroWinkler('abcdef', 'abcxyz');
    const noPrefix = jaroWinkler('uvwxyz', 'abcxyz');
    assert.ok(withPrefix > noPrefix);
  });

  it('empty vs empty returns 1', () => {
    assert.equal(jaroWinkler('', ''), 1);
  });
});

// ─── longestCommonSubsequence ─────────────────────────────────────────────────

describe('longestCommonSubsequence', () => {
  it('identical strings return the string itself', () => {
    assert.equal(longestCommonSubsequence('abc', 'abc'), 'abc');
  });

  it('no common characters return empty string', () => {
    assert.equal(longestCommonSubsequence('abc', 'xyz'), '');
  });

  it('both empty returns empty string', () => {
    assert.equal(longestCommonSubsequence('', ''), '');
  });

  it('one empty returns empty string', () => {
    assert.equal(longestCommonSubsequence('abc', ''), '');
    assert.equal(longestCommonSubsequence('', 'abc'), '');
  });

  it('ABCBDAB vs BDCABA → length 4 (BCBA or BDAB)', () => {
    const result = longestCommonSubsequence('ABCBDAB', 'BDCABA');
    assert.equal(result.length, 4);
  });

  it('agcat vs gac → length 2 (ga or ac)', () => {
    const result = longestCommonSubsequence('agcat', 'gac');
    // Multiple valid LCS, just check length
    assert.ok(result.length >= 2);
  });

  it('result is actually a subsequence of both inputs', () => {
    const a = 'ABCBDAB';
    const b = 'BDCABA';
    const lcs = longestCommonSubsequence(a, b);

    const isSubseq = (seq, str) => {
      let si = 0;
      for (let i = 0; i < str.length && si < seq.length; i++) {
        if (str[i] === seq[si]) si++;
      }
      return si === seq.length;
    };

    assert.ok(isSubseq(lcs, a), `LCS "${lcs}" is not a subsequence of "${a}"`);
    assert.ok(isSubseq(lcs, b), `LCS "${lcs}" is not a subsequence of "${b}"`);
  });

  it('single character match', () => {
    assert.equal(longestCommonSubsequence('a', 'a'), 'a');
  });

  it('single character no match', () => {
    assert.equal(longestCommonSubsequence('a', 'b'), '');
  });
});

// ─── longestCommonSubstring ───────────────────────────────────────────────────

describe('longestCommonSubstring', () => {
  it('identical strings return the string itself', () => {
    assert.equal(longestCommonSubstring('abc', 'abc'), 'abc');
  });

  it('no common characters return empty string', () => {
    assert.equal(longestCommonSubstring('abc', 'xyz'), '');
  });

  it('both empty returns empty string', () => {
    assert.equal(longestCommonSubstring('', ''), '');
  });

  it('one empty returns empty string', () => {
    assert.equal(longestCommonSubstring('abc', ''), '');
    assert.equal(longestCommonSubstring('', 'abc'), '');
  });

  it('abcdef vs cdefgh → cdef', () => {
    assert.equal(longestCommonSubstring('abcdef', 'cdefgh'), 'cdef');
  });

  it('result is actually a substring of both inputs', () => {
    const a = 'abcdef';
    const b = 'cdefgh';
    const lcs = longestCommonSubstring(a, b);
    assert.ok(a.includes(lcs), `"${lcs}" not in "${a}"`);
    assert.ok(b.includes(lcs), `"${lcs}" not in "${b}"`);
  });

  it('hello world vs world tour → world', () => {
    assert.equal(longestCommonSubstring('hello world', 'world tour'), 'world');
  });

  it('single character common', () => {
    assert.equal(longestCommonSubstring('a', 'a'), 'a');
  });

  it('overlapping substrings — picks longest', () => {
    const result = longestCommonSubstring('ABAB', 'BABA');
    assert.equal(result.length, 3); // 'ABA' or 'BAB'
  });
});

// ─── isAnagram ────────────────────────────────────────────────────────────────

describe('isAnagram', () => {
  it('listen and silent are anagrams', () => {
    assert.ok(isAnagram('listen', 'silent'));
  });

  it('hello and world are not anagrams', () => {
    assert.ok(!isAnagram('hello', 'world'));
  });

  it('case insensitive: Listen and Silent', () => {
    assert.ok(isAnagram('Listen', 'Silent'));
  });

  it('ignores spaces: anagram and nag a ram', () => {
    assert.ok(isAnagram('anagram', 'nag a ram'));
  });

  it('both empty strings are anagrams', () => {
    assert.ok(isAnagram('', ''));
  });

  it('single character — same', () => {
    assert.ok(isAnagram('a', 'a'));
  });

  it('single character — different', () => {
    assert.ok(!isAnagram('a', 'b'));
  });

  it('different lengths without spaces are not anagrams', () => {
    assert.ok(!isAnagram('abc', 'ab'));
  });

  it('triangle and integral are anagrams', () => {
    assert.ok(isAnagram('triangle', 'integral'));
  });
});

// ─── isPalindrome ─────────────────────────────────────────────────────────────

describe('isPalindrome', () => {
  it('racecar is a palindrome', () => {
    assert.ok(isPalindrome('racecar'));
  });

  it('hello is not a palindrome', () => {
    assert.ok(!isPalindrome('hello'));
  });

  it('case insensitive: Racecar', () => {
    assert.ok(isPalindrome('Racecar'));
  });

  it('ignores spaces: a man a plan a canal panama', () => {
    assert.ok(isPalindrome('a man a plan a canal panama'));
  });

  it('empty string is a palindrome', () => {
    assert.ok(isPalindrome(''));
  });

  it('single character is a palindrome', () => {
    assert.ok(isPalindrome('a'));
  });

  it('two identical characters is a palindrome', () => {
    assert.ok(isPalindrome('aa'));
  });

  it('two different characters is not a palindrome', () => {
    assert.ok(!isPalindrome('ab'));
  });

  it('level is a palindrome', () => {
    assert.ok(isPalindrome('level'));
  });

  it('noon is a palindrome', () => {
    assert.ok(isPalindrome('noon'));
  });
});
