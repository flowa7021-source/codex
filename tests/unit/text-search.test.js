// ─── Unit Tests: text-search ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  findAll,
  kmpSearch,
  rabinKarp,
  fuzzyMatch,
  levenshtein,
  lcs,
  longestCommonSubstring,
  SearchIndex,
  createSearchIndex,
  highlight,
  TextSearch,
} from '../../app/modules/text-search.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDoc(id, overrides = {}) {
  return {
    id,
    content: `Content for document ${id}.`,
    title: `Title ${id}`,
    tags: [`tag-${id}`],
    ...overrides,
  };
}

// ─── findAll (Boyer-Moore-Horspool) ───────────────────────────────────────────

describe('findAll', () => {
  it('finds single occurrence', () => {
    assert.deepEqual(findAll('hello world', 'world'), [6]);
  });

  it('finds multiple non-overlapping occurrences', () => {
    assert.deepEqual(findAll('ababab', 'ab'), [0, 2, 4]);
  });

  it('finds pattern at the very start', () => {
    assert.deepEqual(findAll('foobar', 'foo'), [0]);
  });

  it('finds pattern at the very end', () => {
    assert.deepEqual(findAll('foobar', 'bar'), [3]);
  });

  it('returns empty array when pattern not found', () => {
    assert.deepEqual(findAll('hello', 'xyz'), []);
  });

  it('is case sensitive', () => {
    assert.deepEqual(findAll('Hello', 'hello'), []);
    assert.deepEqual(findAll('Hello', 'Hello'), [0]);
  });

  it('empty pattern matches every position 0..n', () => {
    const result = findAll('abc', '');
    assert.deepEqual(result, [0, 1, 2, 3]);
  });

  it('empty text with empty pattern returns [0]', () => {
    assert.deepEqual(findAll('', ''), [0]);
  });

  it('pattern longer than text returns empty array', () => {
    assert.deepEqual(findAll('hi', 'hello'), []);
  });

  it('single character pattern', () => {
    assert.deepEqual(findAll('banana', 'a'), [1, 3, 5]);
  });

  it('pattern equals text', () => {
    assert.deepEqual(findAll('abc', 'abc'), [0]);
  });
});

// ─── kmpSearch ───────────────────────────────────────────────────────────────

describe('kmpSearch', () => {
  it('returns index of first occurrence', () => {
    assert.equal(kmpSearch('hello world', 'world'), 6);
  });

  it('returns -1 when not found', () => {
    assert.equal(kmpSearch('hello', 'xyz'), -1);
  });

  it('returns first occurrence only when pattern repeats', () => {
    assert.equal(kmpSearch('ababab', 'ab'), 0);
  });

  it('empty pattern returns 0', () => {
    assert.equal(kmpSearch('hello', ''), 0);
  });

  it('pattern longer than text returns -1', () => {
    assert.equal(kmpSearch('hi', 'hello'), -1);
  });

  it('finds pattern at start', () => {
    assert.equal(kmpSearch('foobar', 'foo'), 0);
  });

  it('finds pattern at end', () => {
    assert.equal(kmpSearch('foobar', 'bar'), 3);
  });

  it('is case sensitive', () => {
    assert.equal(kmpSearch('Hello World', 'world'), -1);
    assert.equal(kmpSearch('Hello World', 'World'), 6);
  });

  it('pattern with repeated prefix (KMP table edge case)', () => {
    assert.equal(kmpSearch('aabaabaab', 'aab'), 0);
  });

  it('text equal to pattern', () => {
    assert.equal(kmpSearch('abc', 'abc'), 0);
  });
});

// ─── rabinKarp ───────────────────────────────────────────────────────────────

describe('rabinKarp', () => {
  it('finds all occurrences', () => {
    assert.deepEqual(rabinKarp('ababab', 'ab'), [0, 2, 4]);
  });

  it('returns empty array when no match', () => {
    assert.deepEqual(rabinKarp('hello', 'xyz'), []);
  });

  it('empty pattern returns all positions', () => {
    const result = rabinKarp('abc', '');
    assert.deepEqual(result, [0, 1, 2, 3]);
  });

  it('pattern longer than text returns empty', () => {
    assert.deepEqual(rabinKarp('hi', 'hello'), []);
  });

  it('single character pattern', () => {
    assert.deepEqual(rabinKarp('banana', 'a'), [1, 3, 5]);
  });

  it('pattern equals text', () => {
    assert.deepEqual(rabinKarp('abc', 'abc'), [0]);
  });

  it('is case sensitive', () => {
    assert.deepEqual(rabinKarp('Hello', 'hello'), []);
  });

  it('multiple occurrences in longer text', () => {
    const result = rabinKarp('the cat sat on the mat with the cat', 'cat');
    assert.deepEqual(result, [4, 32]);
  });
});

// ─── fuzzyMatch ───────────────────────────────────────────────────────────────

describe('fuzzyMatch', () => {
  it('exact subsequence match returns true', () => {
    assert.equal(fuzzyMatch('hello world', 'hlo'), true);
  });

  it('full string is a subsequence of itself', () => {
    assert.equal(fuzzyMatch('abc', 'abc'), true);
  });

  it('non-match returns false', () => {
    assert.equal(fuzzyMatch('hello', 'xyz'), false);
  });

  it('empty pattern always matches', () => {
    assert.equal(fuzzyMatch('hello', ''), true);
    assert.equal(fuzzyMatch('', ''), true);
  });

  it('non-empty pattern against empty text returns false', () => {
    assert.equal(fuzzyMatch('', 'a'), false);
  });

  it('subsequence with skips', () => {
    assert.equal(fuzzyMatch('subsequence', 'sub'), true);
    assert.equal(fuzzyMatch('subsequence', 'sqe'), true);
  });

  it('characters in wrong order fails', () => {
    assert.equal(fuzzyMatch('abc', 'cba'), false);
  });

  it('is case sensitive', () => {
    assert.equal(fuzzyMatch('Hello', 'hello'), false);
    assert.equal(fuzzyMatch('Hello', 'Hello'), true);
  });
});

// ─── levenshtein ──────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it('same string has distance 0', () => {
    assert.equal(levenshtein('abc', 'abc'), 0);
  });

  it('empty strings have distance 0', () => {
    assert.equal(levenshtein('', ''), 0);
  });

  it('insert one character', () => {
    assert.equal(levenshtein('cat', 'cats'), 1);
  });

  it('delete one character', () => {
    assert.equal(levenshtein('cats', 'cat'), 1);
  });

  it('substitute one character', () => {
    assert.equal(levenshtein('cat', 'bat'), 1);
  });

  it('completely different strings', () => {
    assert.equal(levenshtein('abc', 'xyz'), 3);
  });

  it('empty a to non-empty b equals b length', () => {
    assert.equal(levenshtein('', 'hello'), 5);
  });

  it('non-empty a to empty b equals a length', () => {
    assert.equal(levenshtein('hello', ''), 5);
  });

  it('is symmetric', () => {
    assert.equal(levenshtein('kitten', 'sitting'), levenshtein('sitting', 'kitten'));
  });

  it('kitten → sitting classic example', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
  });

  it('sunday → saturday', () => {
    assert.equal(levenshtein('saturday', 'sunday'), 3);
  });
});

// ─── lcs ─────────────────────────────────────────────────────────────────────

describe('lcs', () => {
  it('identical strings return full length', () => {
    assert.equal(lcs('abcd', 'abcd'), 4);
  });

  it('empty string returns 0', () => {
    assert.equal(lcs('', 'abc'), 0);
    assert.equal(lcs('abc', ''), 0);
    assert.equal(lcs('', ''), 0);
  });

  it('no common characters returns 0', () => {
    assert.equal(lcs('abc', 'xyz'), 0);
  });

  it('classic ABCBDAB / BDCAB example', () => {
    assert.equal(lcs('ABCBDAB', 'BDCAB'), 4);
  });

  it('subsequence within longer string', () => {
    assert.equal(lcs('abc', 'aXbYc'), 3);
  });

  it('is symmetric', () => {
    assert.equal(lcs('abcde', 'ace'), lcs('ace', 'abcde'));
  });

  it('single common character', () => {
    assert.equal(lcs('a', 'a'), 1);
    assert.equal(lcs('a', 'b'), 0);
  });
});

// ─── longestCommonSubstring ───────────────────────────────────────────────────

describe('longestCommonSubstring', () => {
  it('identical strings return full length', () => {
    assert.equal(longestCommonSubstring('abcde', 'abcde'), 5);
  });

  it('no common substring returns 0', () => {
    assert.equal(longestCommonSubstring('abc', 'xyz'), 0);
  });

  it('empty inputs return 0', () => {
    assert.equal(longestCommonSubstring('', 'abc'), 0);
    assert.equal(longestCommonSubstring('abc', ''), 0);
    assert.equal(longestCommonSubstring('', ''), 0);
  });

  it('overlapping strings', () => {
    assert.equal(longestCommonSubstring('abcde', 'cdefg'), 3); // 'cde'
  });

  it('substring at start', () => {
    assert.equal(longestCommonSubstring('hello world', 'hello there'), 6); // 'hello '
  });

  it('single matching character', () => {
    assert.equal(longestCommonSubstring('abc', 'xbz'), 1);
  });

  it('is symmetric', () => {
    assert.equal(
      longestCommonSubstring('abcdef', 'cdefgh'),
      longestCommonSubstring('cdefgh', 'abcdef'),
    );
  });
});

// ─── SearchIndex ──────────────────────────────────────────────────────────────

describe('SearchIndex – addDocument / documentCount', () => {
  it('starts empty', () => {
    const idx = new SearchIndex();
    assert.equal(idx.documentCount, 0);
  });

  it('adds a document and increments count', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello world');
    assert.equal(idx.documentCount, 1);
  });

  it('re-adding same id replaces previous document', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'foo bar');
    idx.addDocument('a', 'baz qux');
    assert.equal(idx.documentCount, 1);
    assert.deepEqual(idx.search('foo'), []);
    assert.deepEqual(idx.search('baz'), ['a']);
  });

  it('multiple documents are counted', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'alpha');
    idx.addDocument('2', 'beta');
    idx.addDocument('3', 'gamma');
    assert.equal(idx.documentCount, 3);
  });
});

describe('SearchIndex – search (AND)', () => {
  it('finds doc containing all query terms', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'the quick brown fox');
    idx.addDocument('b', 'the lazy dog');
    const results = idx.search('the fox');
    assert.deepEqual(results, ['a']);
  });

  it('returns empty for blank query', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello');
    assert.deepEqual(idx.search(''), []);
    assert.deepEqual(idx.search('   '), []);
  });

  it('returns empty when one term is missing', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello world');
    assert.deepEqual(idx.search('hello xyz'), []);
  });

  it('AND semantics: both terms must be present', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'apple banana');
    idx.addDocument('2', 'apple cherry');
    idx.addDocument('3', 'banana cherry');
    const results = idx.search('apple banana');
    assert.deepEqual(results, ['1']);
  });

  it('is case-insensitive', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'Hello World');
    assert.ok(idx.search('hello').includes('a'));
    assert.ok(idx.search('WORLD').includes('a'));
  });
});

describe('SearchIndex – searchAny (OR)', () => {
  it('returns docs containing any query term', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'apple pie');
    idx.addDocument('2', 'cherry cake');
    idx.addDocument('3', 'lemon tart');
    const results = idx.searchAny('apple cherry');
    assert.ok(results.includes('1'));
    assert.ok(results.includes('2'));
    assert.ok(!results.includes('3'));
  });

  it('returns empty for blank query', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello');
    assert.deepEqual(idx.searchAny(''), []);
  });

  it('OR returns more results than AND', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'alpha beta');
    idx.addDocument('2', 'alpha gamma');
    idx.addDocument('3', 'delta epsilon');
    const andResults = idx.search('alpha gamma');
    const orResults = idx.searchAny('alpha gamma');
    assert.ok(orResults.length >= andResults.length);
  });

  it('is case-insensitive', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'Hello World');
    assert.ok(idx.searchAny('HELLO').includes('a'));
  });
});

describe('SearchIndex – removeDocument', () => {
  it('removes document and decrements count', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello world');
    idx.removeDocument('a');
    assert.equal(idx.documentCount, 0);
  });

  it('removed document no longer appears in search', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello world');
    idx.addDocument('b', 'hello there');
    idx.removeDocument('a');
    const results = idx.search('hello');
    assert.ok(!results.includes('a'));
    assert.ok(results.includes('b'));
  });

  it('removing non-existent id is a no-op', () => {
    const idx = new SearchIndex();
    idx.addDocument('a', 'hello');
    idx.removeDocument('nonexistent');
    assert.equal(idx.documentCount, 1);
  });
});

describe('SearchIndex – clear', () => {
  it('empties the index', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'apple');
    idx.addDocument('2', 'banana');
    idx.clear();
    assert.equal(idx.documentCount, 0);
  });

  it('search returns nothing after clear', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'hello');
    idx.clear();
    assert.deepEqual(idx.search('hello'), []);
  });

  it('can add documents after clear', () => {
    const idx = new SearchIndex();
    idx.addDocument('1', 'old content');
    idx.clear();
    idx.addDocument('2', 'new content');
    assert.equal(idx.documentCount, 1);
    assert.ok(idx.search('new').includes('2'));
  });
});

// ─── createSearchIndex factory ────────────────────────────────────────────────

describe('createSearchIndex', () => {
  it('returns a SearchIndex instance', () => {
    const idx = createSearchIndex();
    assert.ok(idx instanceof SearchIndex);
  });

  it('produced instance works correctly', () => {
    const idx = createSearchIndex();
    idx.addDocument('doc1', 'hello world');
    assert.equal(idx.documentCount, 1);
    assert.ok(idx.search('hello').includes('doc1'));
  });

  it('each call returns a fresh index', () => {
    const a = createSearchIndex();
    const b = createSearchIndex();
    a.addDocument('x', 'test');
    assert.equal(b.documentCount, 0);
  });
});

// ─── highlight ────────────────────────────────────────────────────────────────

describe('highlight', () => {
  it('wraps matches in <mark> by default', () => {
    assert.equal(highlight('hello world', 'world'), 'hello <mark>world</mark>');
  });

  it('wraps all occurrences', () => {
    assert.equal(
      highlight('cat and cat', 'cat'),
      '<mark>cat</mark> and <mark>cat</mark>',
    );
  });

  it('uses custom tag when provided', () => {
    assert.equal(highlight('hello', 'hello', 'strong'), '<strong>hello</strong>');
  });

  it('returns original text when pattern not found', () => {
    assert.equal(highlight('hello world', 'xyz'), 'hello world');
  });

  it('returns original text for empty pattern', () => {
    assert.equal(highlight('hello', ''), 'hello');
  });

  it('is case sensitive', () => {
    assert.equal(highlight('Hello World', 'hello'), 'Hello World');
    assert.equal(highlight('Hello World', 'Hello'), '<mark>Hello</mark> World');
  });

  it('handles pattern at start and end', () => {
    assert.equal(highlight('xhellox', 'x'), '<mark>x</mark>hello<mark>x</mark>');
  });

  it('preserves text outside matches', () => {
    const result = highlight('the quick brown fox', 'quick');
    assert.ok(result.includes('the '));
    assert.ok(result.includes(' brown fox'));
  });

  it('empty text returns empty string', () => {
    assert.equal(highlight('', 'abc'), '');
  });
});

// ─── TextSearch (legacy scoring engine – preserved tests) ─────────────────────

describe('TextSearch – add / size', () => {
  it('starts empty', () => {
    const ts = new TextSearch();
    assert.equal(ts.size, 0);
  });

  it('add single document increases size', () => {
    const ts = new TextSearch();
    ts.add(makeDoc('1'));
    assert.equal(ts.size, 1);
  });

  it('add array of documents increases size by count', () => {
    const ts = new TextSearch();
    ts.add([makeDoc('a'), makeDoc('b'), makeDoc('c')]);
    assert.equal(ts.size, 3);
  });

  it('adding same id overwrites previous document', () => {
    const ts = new TextSearch();
    ts.add({ id: 'x', content: 'old' });
    ts.add({ id: 'x', content: 'new' });
    assert.equal(ts.size, 1);
    const results = ts.search('new');
    assert.equal(results.length, 1);
    assert.equal(results[0].document.content, 'new');
  });
});

describe('TextSearch – search basic', () => {
  it('returns empty array for empty query', () => {
    const ts = new TextSearch();
    ts.add(makeDoc('1'));
    assert.deepEqual(ts.search(''), []);
  });

  it('finds documents matching query in content', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'The quick brown fox' });
    ts.add({ id: '2', content: 'Hello world' });
    const results = ts.search('fox');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, '1');
  });

  it('returns no results when nothing matches', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'Hello world' });
    assert.equal(ts.search('zzz').length, 0);
  });

  it('result includes document reference', () => {
    const ts = new TextSearch();
    const doc = { id: 'doc1', content: 'sample text' };
    ts.add(doc);
    const results = ts.search('sample');
    assert.equal(results[0].document, doc);
  });
});

describe('TextSearch – clear', () => {
  it('empties the index', () => {
    const ts = new TextSearch();
    ts.add([makeDoc('a'), makeDoc('b')]);
    ts.clear();
    assert.equal(ts.size, 0);
  });

  it('search returns nothing after clear', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'hello' });
    ts.clear();
    assert.equal(ts.search('hello').length, 0);
  });
});
