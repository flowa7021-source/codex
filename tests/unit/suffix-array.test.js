// ─── Unit Tests: suffix-array ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SuffixArray, createSuffixArray } from '../../app/modules/suffix-array.js';

// ─── constructor / accessors ────────────────────────────────────────────────

describe('SuffixArray constructor & accessors', () => {
  it('stores the original text', () => {
    const sa = new SuffixArray('banana');
    assert.equal(sa.text, 'banana');
  });

  it('has correct size', () => {
    const sa = new SuffixArray('banana');
    assert.equal(sa.size, 6);
  });

  it('handles empty text', () => {
    const sa = new SuffixArray('');
    assert.equal(sa.size, 0);
    assert.equal(sa.text, '');
  });

  it('toArray returns a copy of the suffix array', () => {
    const sa = new SuffixArray('abc');
    const arr = sa.toArray();
    assert.equal(arr.length, 3);
    // Mutating the copy should not affect the original
    arr[0] = 999;
    assert.notDeepEqual(sa.toArray(), arr);
  });
});

// ─── createSuffixArray factory ──────────────────────────────────────────────

describe('createSuffixArray', () => {
  it('returns a SuffixArray instance', () => {
    const sa = createSuffixArray('test');
    assert.ok(sa instanceof SuffixArray);
    assert.equal(sa.text, 'test');
  });
});

// ─── suffix array correctness ───────────────────────────────────────────────

describe('suffix array ordering', () => {
  it('produces suffixes in lexicographic order for "banana"', () => {
    const sa = new SuffixArray('banana');
    const arr = sa.toArray();
    // Expected sorted suffixes: a, ana, anana, banana, na, nana
    // Positions:                 5,  3,   1,      0,   4,   2
    assert.deepEqual(arr, [5, 3, 1, 0, 4, 2]);
  });

  it('produces correct order for "abracadabra"', () => {
    const sa = new SuffixArray('abracadabra');
    const suffixes = [];
    for (let i = 0; i < sa.size; i++) {
      suffixes.push(sa.suffixAt(i));
    }
    // Verify suffixes are in sorted order
    for (let i = 1; i < suffixes.length; i++) {
      assert.ok(suffixes[i - 1] <= suffixes[i],
        `Expected "${suffixes[i - 1]}" <= "${suffixes[i]}" at rank ${i}`);
    }
  });

  it('single character text', () => {
    const sa = new SuffixArray('a');
    assert.deepEqual(sa.toArray(), [0]);
    assert.equal(sa.suffixAt(0), 'a');
  });
});

// ─── suffixAt ───────────────────────────────────────────────────────────────

describe('SuffixArray.suffixAt', () => {
  it('returns the suffix at a given rank', () => {
    const sa = new SuffixArray('banana');
    assert.equal(sa.suffixAt(0), 'a');
    assert.equal(sa.suffixAt(3), 'banana');
    assert.equal(sa.suffixAt(5), 'nana');
  });

  it('returns empty string for out-of-range rank', () => {
    const sa = new SuffixArray('abc');
    assert.equal(sa.suffixAt(-1), '');
    assert.equal(sa.suffixAt(3), '');
  });
});

// ─── search ─────────────────────────────────────────────────────────────────

describe('SuffixArray.search', () => {
  it('finds all occurrences of a pattern', () => {
    const sa = new SuffixArray('banana');
    const positions = sa.search('an');
    assert.deepEqual(positions, [1, 3]);
  });

  it('returns empty array when pattern is not found', () => {
    const sa = new SuffixArray('banana');
    assert.deepEqual(sa.search('xyz'), []);
  });

  it('returns empty array for empty pattern', () => {
    const sa = new SuffixArray('banana');
    assert.deepEqual(sa.search(''), []);
  });

  it('finds pattern at start of text', () => {
    const sa = new SuffixArray('banana');
    assert.deepEqual(sa.search('ban'), [0]);
  });

  it('finds pattern at end of text', () => {
    const sa = new SuffixArray('banana');
    assert.deepEqual(sa.search('ana'), [1, 3]);
  });

  it('finds the entire text as a pattern', () => {
    const sa = new SuffixArray('hello');
    assert.deepEqual(sa.search('hello'), [0]);
  });

  it('returns empty for longer-than-text pattern', () => {
    const sa = new SuffixArray('hi');
    assert.deepEqual(sa.search('hello'), []);
  });
});

// ─── contains ───────────────────────────────────────────────────────────────

describe('SuffixArray.contains', () => {
  it('returns true when pattern exists', () => {
    const sa = new SuffixArray('hello world');
    assert.equal(sa.contains('world'), true);
    assert.equal(sa.contains('hello'), true);
    assert.equal(sa.contains('lo wo'), true);
  });

  it('returns false when pattern does not exist', () => {
    const sa = new SuffixArray('hello world');
    assert.equal(sa.contains('xyz'), false);
  });

  it('returns true for empty pattern', () => {
    const sa = new SuffixArray('abc');
    assert.equal(sa.contains(''), true);
  });
});

// ─── count ──────────────────────────────────────────────────────────────────

describe('SuffixArray.count', () => {
  it('counts occurrences correctly', () => {
    const sa = new SuffixArray('abcabcabc');
    assert.equal(sa.count('abc'), 3);
    assert.equal(sa.count('bca'), 2);
    assert.equal(sa.count('xyz'), 0);
  });

  it('returns 0 for empty pattern', () => {
    const sa = new SuffixArray('abc');
    assert.equal(sa.count(''), 0);
  });

  it('counts single character', () => {
    const sa = new SuffixArray('aabaa');
    assert.equal(sa.count('a'), 4);
    assert.equal(sa.count('b'), 1);
  });
});

// ─── longestCommonPrefix ────────────────────────────────────────────────────

describe('SuffixArray.longestCommonPrefix', () => {
  it('computes LCP of two adjacent suffixes', () => {
    const sa = new SuffixArray('banana');
    // rank 0 -> suffix "a" (pos 5), rank 1 -> suffix "ana" (pos 3)
    const lcp = sa.longestCommonPrefix(0, 1);
    assert.equal(lcp, 'a');
  });

  it('returns empty string for out-of-range indices', () => {
    const sa = new SuffixArray('abc');
    assert.equal(sa.longestCommonPrefix(-1, 0), '');
    assert.equal(sa.longestCommonPrefix(0, 10), '');
  });

  it('returns the full suffix when both ranks are the same', () => {
    const sa = new SuffixArray('abc');
    const lcp = sa.longestCommonPrefix(0, 0);
    // Same suffix compared with itself
    assert.equal(lcp, sa.suffixAt(0));
  });
});

// ─── longestRepeatedSubstring ───────────────────────────────────────────────

describe('SuffixArray.longestRepeatedSubstring', () => {
  it('finds the longest repeated substring in "banana"', () => {
    const sa = new SuffixArray('banana');
    assert.equal(sa.longestRepeatedSubstring(), 'ana');
  });

  it('returns empty string when no repeated substring exists', () => {
    const sa = new SuffixArray('abcdef');
    // No substring of length > 0 repeats... actually "a" doesn't repeat.
    // But single chars might not repeat either. Let's check:
    // abcdef has all unique chars so LRS = ""
    assert.equal(sa.longestRepeatedSubstring(), '');
  });

  it('returns empty string for single character text', () => {
    const sa = new SuffixArray('x');
    assert.equal(sa.longestRepeatedSubstring(), '');
  });

  it('returns empty string for empty text', () => {
    const sa = new SuffixArray('');
    assert.equal(sa.longestRepeatedSubstring(), '');
  });

  it('finds repeated substring in "abcabc"', () => {
    const sa = new SuffixArray('abcabc');
    assert.equal(sa.longestRepeatedSubstring(), 'abc');
  });

  it('handles all-same characters', () => {
    const sa = new SuffixArray('aaaa');
    assert.equal(sa.longestRepeatedSubstring(), 'aaa');
  });
});
