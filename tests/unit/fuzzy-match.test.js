// ─── Unit Tests: fuzzy-match ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levenshtein,
  similarity,
  fuzzyMatch,
  findBestMatch,
  fuzzyFilter,
  highlightMatches,
} from '../../app/modules/fuzzy-match.js';

// ─── levenshtein ─────────────────────────────────────────────────────────────

describe('levenshtein()', () => {
  it("'kitten' vs 'sitting' → 3", () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
  });

  it('identical strings → 0', () => {
    assert.equal(levenshtein('hello', 'hello'), 0);
    assert.equal(levenshtein('', ''), 0);
  });

  it('empty string vs non-empty → length of non-empty', () => {
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
  });

  it('single-character difference → 1', () => {
    assert.equal(levenshtein('cat', 'bat'), 1);
  });

  it('completely different same-length strings', () => {
    assert.equal(levenshtein('abc', 'xyz'), 3);
  });

  it('insertion at end → 1', () => {
    assert.equal(levenshtein('car', 'cars'), 1);
  });

  it('deletion at start → 1', () => {
    assert.equal(levenshtein('scat', 'cat'), 1);
  });

  it('is symmetric', () => {
    assert.equal(levenshtein('hello', 'world'), levenshtein('world', 'hello'));
  });
});

// ─── similarity ──────────────────────────────────────────────────────────────

describe('similarity()', () => {
  it('identical strings → 1.0', () => {
    assert.equal(similarity('hello', 'hello'), 1);
    assert.equal(similarity('', ''), 1);
  });

  it('completely different strings → low score', () => {
    const score = similarity('abc', 'xyz');
    assert.ok(score < 0.5, `expected score < 0.5, got ${score}`);
  });

  it('score is in range [0, 1]', () => {
    const pairs = [
      ['', 'hello'],
      ['a', 'aaaa'],
      ['kitten', 'sitting'],
      ['test', 'test'],
    ];
    for (const [a, b] of pairs) {
      const s = similarity(a, b);
      assert.ok(s >= 0 && s <= 1, `similarity('${a}','${b}') = ${s} out of range`);
    }
  });

  it('more similar strings have higher score than dissimilar ones', () => {
    const closePair = similarity('colour', 'color');
    const farPair = similarity('colour', 'xyzzy');
    assert.ok(closePair > farPair, `expected ${closePair} > ${farPair}`);
  });
});

// ─── fuzzyMatch ──────────────────────────────────────────────────────────────

describe('fuzzyMatch()', () => {
  it('exact match → score 1.0 with all indices', () => {
    const result = fuzzyMatch('abc', 'abc');
    assert.ok(result !== null);
    assert.equal(result.score, 1);
    assert.deepEqual(result.indices, [0, 1, 2]);
  });

  it('partial match → returns indices array', () => {
    const result = fuzzyMatch('ac', 'abcd');
    assert.ok(result !== null);
    assert.ok(result.indices.includes(0)); // 'a' at 0
    assert.ok(result.indices.includes(2)); // 'c' at 2
  });

  it('no match → returns null', () => {
    const result = fuzzyMatch('xyz', 'hello');
    assert.equal(result, null);
  });

  it('empty query → score 1, empty indices', () => {
    const result = fuzzyMatch('', 'anything');
    assert.ok(result !== null);
    assert.equal(result.score, 1);
    assert.deepEqual(result.indices, []);
  });

  it('query longer than text → returns null when not a subsequence', () => {
    const result = fuzzyMatch('abcdef', 'abc');
    assert.equal(result, null);
  });

  it('score is between 0 and 1', () => {
    const result = fuzzyMatch('wrd', 'world');
    assert.ok(result !== null);
    assert.ok(result.score > 0 && result.score <= 1);
  });

  it('consecutive matches yield higher score than scattered matches', () => {
    const consecutive = fuzzyMatch('abc', 'abcdef');    // abc at 0,1,2
    const scattered   = fuzzyMatch('abc', 'aXbXcXXX'); // a,b,c scattered
    assert.ok(consecutive !== null && scattered !== null);
    assert.ok(consecutive.score >= scattered.score);
  });

  it('match is case-insensitive', () => {
    const result = fuzzyMatch('ABC', 'abcdef');
    assert.ok(result !== null);
    assert.deepEqual(result.indices, [0, 1, 2]);
  });
});

// ─── findBestMatch ───────────────────────────────────────────────────────────

describe('findBestMatch()', () => {
  it('returns the best match from a list', () => {
    const result = findBestMatch('wrld', ['word', 'world', 'ward']);
    assert.ok(result !== null);
    assert.equal(result.match, 'world');
  });

  it('returns correct index of the match', () => {
    const candidates = ['alpha', 'beta', 'gamma'];
    const result = findBestMatch('beta', candidates);
    assert.ok(result !== null);
    assert.equal(result.index, 1);
  });

  it('returns null when all candidates are below threshold', () => {
    const result = findBestMatch('zzz', ['abc', 'def', 'ghi'], 0.99);
    assert.equal(result, null);
  });

  it('returns null for empty candidates list', () => {
    const result = findBestMatch('hello', []);
    assert.equal(result, null);
  });

  it('score is in range [0, 1]', () => {
    const result = findBestMatch('test', ['testing', 'other']);
    assert.ok(result !== null);
    assert.ok(result.score >= 0 && result.score <= 1);
  });

  it('exact match in list has highest score', () => {
    const result = findBestMatch('hello', ['hi', 'hello', 'hey']);
    assert.ok(result !== null);
    assert.equal(result.match, 'hello');
    assert.equal(result.score, 1);
  });
});

// ─── fuzzyFilter ─────────────────────────────────────────────────────────────

describe('fuzzyFilter()', () => {
  it('filters and sorts by score descending', () => {
    const candidates = ['world', 'word', 'ward', 'unrelated'];
    const results = fuzzyFilter('wrd', candidates);
    assert.ok(results.length >= 1);
    // Verify sorted order.
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1].score >= results[i].score,
        `Expected sorted: ${results[i - 1].score} >= ${results[i].score}`,
      );
    }
  });

  it('excludes candidates below threshold', () => {
    const results = fuzzyFilter('abc', ['abc', 'xyz'], 0.99);
    assert.ok(results.every((r) => r.score >= 0.99));
  });

  it('empty query → all results with score 1, original order', () => {
    const candidates = ['alpha', 'beta', 'gamma'];
    const results = fuzzyFilter('', candidates);
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.score === 1));
    assert.deepEqual(
      results.map((r) => r.item),
      candidates,
    );
  });

  it('returns empty array when no candidates match', () => {
    const results = fuzzyFilter('zzz', ['abc', 'def'], 0.99);
    assert.deepEqual(results, []);
  });

  it('each result contains item, score, and index', () => {
    const candidates = ['hello', 'world'];
    const results = fuzzyFilter('hello', candidates);
    assert.ok(results.length >= 1);
    const first = results[0];
    assert.ok('item' in first);
    assert.ok('score' in first);
    assert.ok('index' in first);
  });

  it('index corresponds to position in original candidates array', () => {
    const candidates = ['alpha', 'beta', 'gamma'];
    const results = fuzzyFilter('beta', candidates);
    assert.ok(results.length >= 1);
    const betaResult = results.find((r) => r.item === 'beta');
    assert.ok(betaResult);
    assert.equal(betaResult.index, 1);
  });
});

// ─── highlightMatches ────────────────────────────────────────────────────────

describe('highlightMatches()', () => {
  it('wraps matched characters with <mark> tags', () => {
    const result = highlightMatches('hello', [0, 1]);
    assert.equal(result, '<mark>he</mark>llo');
  });

  it('handles non-adjacent indices as separate <mark> spans', () => {
    const result = highlightMatches('abcd', [0, 2]);
    assert.equal(result, '<mark>a</mark>b<mark>c</mark>d');
  });

  it('no indices → returns plain text', () => {
    assert.equal(highlightMatches('hello', []), 'hello');
  });

  it('all indices → entire string wrapped', () => {
    const result = highlightMatches('hi', [0, 1]);
    assert.equal(result, '<mark>hi</mark>');
  });

  it('single matched character', () => {
    const result = highlightMatches('world', [2]);
    assert.equal(result, 'wo<mark>r</mark>ld');
  });

  it('escapes HTML special characters in non-matched text', () => {
    const result = highlightMatches('<div>', []);
    assert.equal(result, '&lt;div&gt;');
  });

  it('escapes HTML special characters inside <mark> tags', () => {
    const result = highlightMatches('<b>', [0, 1, 2]);
    assert.equal(result, '<mark>&lt;b&gt;</mark>');
  });

  it('empty text → empty string', () => {
    assert.equal(highlightMatches('', []), '');
  });
});
