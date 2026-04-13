// ─── Unit Tests: SuffixAutomaton ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SuffixAutomaton, createSuffixAutomaton } from '../../app/modules/suffix-automaton.js';

// ─── contains ────────────────────────────────────────────────────────────────

describe('SuffixAutomaton – contains', () => {
  it('finds single characters that are substrings', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.contains('a'), true);
    assert.equal(sa.contains('b'), true);
    assert.equal(sa.contains('c'), true);
  });

  it('finds multi-character substrings', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.contains('ab'), true);
    assert.equal(sa.contains('bc'), true);
    assert.equal(sa.contains('abc'), true);
  });

  it('rejects strings that are not substrings', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.contains('ac'), false);
    assert.equal(sa.contains('ba'), false);
  });

  it('empty pattern is always a substring of any text', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.contains(''), true);
  });

  it('empty text contains only the empty pattern', () => {
    const sa = new SuffixAutomaton('');
    assert.equal(sa.contains(''), true);
    assert.equal(sa.contains('a'), false);
    assert.equal(sa.contains('abc'), false);
  });
});

// ─── countOccurrences ────────────────────────────────────────────────────────

describe('SuffixAutomaton – countOccurrences', () => {
  it("counts 3 occurrences of 'aa' in 'aaaa'", () => {
    const sa = new SuffixAutomaton('aaaa');
    assert.equal(sa.countOccurrences('aa'), 3);
  });

  it("counts 3 occurrences of 'a' in 'banana'", () => {
    const sa = new SuffixAutomaton('banana');
    assert.equal(sa.countOccurrences('a'), 3);
  });

  it('returns 0 for a pattern that does not occur', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.countOccurrences('z'), 0);
    assert.equal(sa.countOccurrences('ac'), 0);
  });

  it('counts 1 for the full text itself', () => {
    const sa = new SuffixAutomaton('hello');
    assert.equal(sa.countOccurrences('hello'), 1);
  });

  it('returns 0 on empty text for a non-empty pattern', () => {
    const sa = new SuffixAutomaton('');
    assert.equal(sa.countOccurrences('a'), 0);
  });
});

// ─── longestCommonSubstring ───────────────────────────────────────────────────

describe('SuffixAutomaton – longestCommonSubstring', () => {
  it("finds 'bcd' as the LCS of 'abcdef' and 'xbcdy'", () => {
    const sa = new SuffixAutomaton('abcdef');
    assert.equal(sa.longestCommonSubstring('xbcdy'), 'bcd');
  });

  it('returns the original string when compared with an identical string', () => {
    const text = 'hello';
    const sa = new SuffixAutomaton(text);
    assert.equal(sa.longestCommonSubstring(text), text);
  });

  it('returns empty string when there is no common substring', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.longestCommonSubstring('xyz'), '');
  });

  it('returns empty string when text is empty', () => {
    const sa = new SuffixAutomaton('');
    assert.equal(sa.longestCommonSubstring('abc'), '');
  });

  it('returns empty string when other is empty', () => {
    const sa = new SuffixAutomaton('abc');
    assert.equal(sa.longestCommonSubstring(''), '');
  });

  it('handles a single shared character', () => {
    const sa = new SuffixAutomaton('abc');
    const lcs = sa.longestCommonSubstring('xay');
    assert.equal(lcs, 'a');
  });
});

// ─── allSubstrings ────────────────────────────────────────────────────────────

describe('SuffixAutomaton – allSubstrings', () => {
  it("allSubstrings of 'ab' equals {'', 'a', 'b', 'ab'}", () => {
    const sa = new SuffixAutomaton('ab');
    const result = sa.allSubstrings();
    assert.ok(result instanceof Set);
    assert.equal(result.size, 4);
    assert.ok(result.has(''));
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.ok(result.has('ab'));
  });

  it('allSubstrings of empty text is just the empty string', () => {
    const sa = new SuffixAutomaton('');
    const result = sa.allSubstrings();
    assert.equal(result.size, 1);
    assert.ok(result.has(''));
  });

  it('allSubstrings of a single character contains empty and that character', () => {
    const sa = new SuffixAutomaton('x');
    const result = sa.allSubstrings();
    assert.equal(result.size, 2);
    assert.ok(result.has(''));
    assert.ok(result.has('x'));
  });

  it('all returned strings are genuine substrings of the text', () => {
    const text = 'abcd';
    const sa = new SuffixAutomaton(text);
    for (const sub of sa.allSubstrings()) {
      if (sub === '') continue;
      assert.ok(text.includes(sub), `Expected '${sub}' to be a substring of '${text}'`);
    }
  });
});

// ─── stateCount ──────────────────────────────────────────────────────────────

describe('SuffixAutomaton – stateCount', () => {
  it('stateCount is greater than 0 for non-empty text', () => {
    const sa = new SuffixAutomaton('abc');
    assert.ok(sa.stateCount > 0);
  });

  it('stateCount is 1 for empty text (only the initial state)', () => {
    const sa = new SuffixAutomaton('');
    assert.equal(sa.stateCount, 1);
  });

  it('stateCount is at most 2 * text.length for any text', () => {
    for (const text of ['a', 'ab', 'abc', 'abcdef', 'aaaa', 'banana', 'aababc']) {
      const sa = new SuffixAutomaton(text);
      assert.ok(
        sa.stateCount <= 2 * text.length,
        `stateCount ${sa.stateCount} exceeds 2*${text.length} for text '${text}'`,
      );
    }
  });
});

// ─── text getter ─────────────────────────────────────────────────────────────

describe('SuffixAutomaton – text getter', () => {
  it('returns the original text', () => {
    const text = 'hello world';
    const sa = new SuffixAutomaton(text);
    assert.equal(sa.text, text);
  });

  it('returns empty string when built with empty text', () => {
    const sa = new SuffixAutomaton('');
    assert.equal(sa.text, '');
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('createSuffixAutomaton factory', () => {
  it('returns a SuffixAutomaton instance', () => {
    const sa = createSuffixAutomaton('test');
    assert.ok(sa instanceof SuffixAutomaton);
  });

  it('produced instance works correctly', () => {
    const sa = createSuffixAutomaton('abcabc');
    assert.equal(sa.contains('cab'), true);
    assert.equal(sa.countOccurrences('abc'), 2);
    assert.equal(sa.text, 'abcabc');
  });
});
