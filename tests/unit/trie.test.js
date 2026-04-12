// ─── Unit Tests: Trie ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Trie, createTrie } from '../../app/modules/trie.js';

// ─── insert / search (exact match) ───────────────────────────────────────────

describe('Trie – insert / search (exact match)', () => {
  it('returns false for a word never inserted', () => {
    const t = new Trie();
    assert.equal(t.search('hello'), false);
  });

  it('returns true after inserting a word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.search('hello'), true);
  });

  it('does not match a prefix as a word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.search('hell'), false);
  });

  it('does not match a word that extends an inserted word', () => {
    const t = new Trie();
    t.insert('hell');
    assert.equal(t.search('hello'), false);
  });

  it('supports inserting and searching the empty string', () => {
    const t = new Trie();
    t.insert('');
    assert.equal(t.search(''), true);
  });

  it('search returns false for empty string when not inserted', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.search(''), false);
  });

  it('is case-sensitive – "Hello" and "hello" are distinct words', () => {
    const t = new Trie();
    t.insert('Hello');
    assert.equal(t.search('Hello'), true);
    assert.equal(t.search('hello'), false);
  });

  it('duplicate insert does not increase size', () => {
    const t = new Trie();
    t.insert('abc');
    t.insert('abc');
    assert.equal(t.size, 1);
  });

  it('can insert multiple words and search each', () => {
    const t = new Trie();
    const words = ['apple', 'app', 'application', 'apply', 'banana'];
    for (const w of words) t.insert(w);
    for (const w of words) assert.equal(t.search(w), true);
  });

  it('single-character words work correctly', () => {
    const t = new Trie();
    t.insert('a');
    assert.equal(t.search('a'), true);
    assert.equal(t.search('ab'), false);
  });

  it('unicode characters are handled correctly', () => {
    const t = new Trie();
    t.insert('café');
    assert.equal(t.search('café'), true);
    assert.equal(t.search('cafe'), false);
  });

  it('returns false on empty trie', () => {
    const t = new Trie();
    assert.equal(t.search('anything'), false);
  });
});

// ─── startsWith ───────────────────────────────────────────────────────────────

describe('Trie – startsWith', () => {
  it('returns true when a stored word starts with the prefix', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.startsWith('he'), true);
  });

  it('returns true for the full word as its own prefix', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.startsWith('hello'), true);
  });

  it('returns false when no word starts with the prefix', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.startsWith('world'), false);
  });

  it('returns false on empty trie', () => {
    const t = new Trie();
    assert.equal(t.startsWith('a'), false);
  });

  it('empty prefix returns true when trie is non-empty', () => {
    const t = new Trie();
    t.insert('x');
    assert.equal(t.startsWith(''), true);
  });

  it('empty prefix returns false on empty trie', () => {
    const t = new Trie();
    assert.equal(t.startsWith(''), false);
  });

  it('prefix longer than any stored word returns false', () => {
    const t = new Trie();
    t.insert('hi');
    assert.equal(t.startsWith('hiya'), false);
  });

  it('single character prefix returns true when words share it', () => {
    const t = new Trie();
    t.insert('apple');
    t.insert('avocado');
    assert.equal(t.startsWith('a'), true);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('Trie – delete', () => {
  it('returns true when the word exists and is removed', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.delete('hello'), true);
    assert.equal(t.search('hello'), false);
  });

  it('returns false when the word does not exist', () => {
    const t = new Trie();
    assert.equal(t.delete('missing'), false);
  });

  it('decrements size on successful delete', () => {
    const t = new Trie();
    t.insert('a');
    t.insert('b');
    t.delete('a');
    assert.equal(t.size, 1);
  });

  it('does not affect other words sharing a prefix', () => {
    const t = new Trie();
    t.insert('app');
    t.insert('apple');
    t.delete('app');
    assert.equal(t.search('app'), false);
    assert.equal(t.search('apple'), true);
  });

  it('deleting a word that is a prefix of another keeps the longer word', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('hell');
    t.delete('hell');
    assert.equal(t.search('hell'), false);
    assert.equal(t.search('hello'), true);
  });

  it('deleting the only word empties the trie', () => {
    const t = new Trie();
    t.insert('solo');
    t.delete('solo');
    assert.equal(t.size, 0);
    assert.equal(t.startsWith('s'), false);
  });

  it('double delete returns false the second time', () => {
    const t = new Trie();
    t.insert('word');
    assert.equal(t.delete('word'), true);
    assert.equal(t.delete('word'), false);
  });

  it('deleting a non-word prefix returns false', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.delete('hell'), false);
  });

  it('size does not change on a failed delete', () => {
    const t = new Trie();
    t.insert('x');
    t.delete('nothere');
    assert.equal(t.size, 1);
  });
});

// ─── wordsWithPrefix / autocomplete ──────────────────────────────────────────

describe('Trie – wordsWithPrefix', () => {
  it('returns all words with a given prefix', () => {
    const t = new Trie();
    ['apple', 'app', 'application', 'apply', 'banana'].forEach(w => t.insert(w));
    const result = t.wordsWithPrefix('app');
    assert.deepEqual(result, ['app', 'apple', 'application', 'apply']);
  });

  it('returns results in lexicographic order', () => {
    const t = new Trie();
    ['cb', 'ca', 'cc', 'a'].forEach(w => t.insert(w));
    const result = t.wordsWithPrefix('c');
    assert.deepEqual(result, ['ca', 'cb', 'cc']);
  });

  it('returns empty array when no word matches prefix', () => {
    const t = new Trie();
    t.insert('hello');
    assert.deepEqual(t.wordsWithPrefix('world'), []);
  });

  it('empty prefix returns all words in lexicographic order', () => {
    const t = new Trie();
    ['zebra', 'ant', 'monkey'].forEach(w => t.insert(w));
    assert.deepEqual(t.wordsWithPrefix(''), ['ant', 'monkey', 'zebra']);
  });

  it('returns a single-element array when only one word matches', () => {
    const t = new Trie();
    t.insert('unique');
    assert.deepEqual(t.wordsWithPrefix('uni'), ['unique']);
  });

  it('includes the prefix word itself when it is a stored word', () => {
    const t = new Trie();
    t.insert('he');
    t.insert('hello');
    const result = t.wordsWithPrefix('he');
    assert.ok(result.includes('he'));
    assert.ok(result.includes('hello'));
  });

  it('returns empty array on empty trie', () => {
    const t = new Trie();
    assert.deepEqual(t.wordsWithPrefix('any'), []);
  });
});

describe('Trie – autocomplete', () => {
  it('without maxResults returns all matches', () => {
    const t = new Trie();
    ['cat', 'car', 'card', 'care'].forEach(w => t.insert(w));
    const result = t.autocomplete('ca');
    assert.deepEqual(result, ['car', 'card', 'care', 'cat']);
  });

  it('limits results to maxResults', () => {
    const t = new Trie();
    ['cat', 'car', 'card', 'care', 'carpenter'].forEach(w => t.insert(w));
    const result = t.autocomplete('ca', 2);
    assert.equal(result.length, 2);
    assert.deepEqual(result, ['car', 'card']);
  });

  it('maxResults larger than matches returns all matches', () => {
    const t = new Trie();
    ['fox', 'fog'].forEach(w => t.insert(w));
    const result = t.autocomplete('fo', 100);
    assert.deepEqual(result, ['fog', 'fox']);
  });

  it('returns empty array when prefix does not match anything', () => {
    const t = new Trie();
    t.insert('hello');
    assert.deepEqual(t.autocomplete('xyz', 5), []);
  });

  it('maxResults of 0 returns empty array', () => {
    const t = new Trie();
    t.insert('test');
    assert.deepEqual(t.autocomplete('te', 0), []);
  });

  it('autocomplete with no limit returns same as wordsWithPrefix', () => {
    const t = new Trie();
    ['banana', 'apple', 'cherry'].forEach(w => t.insert(w));
    assert.deepEqual(t.autocomplete(''), t.wordsWithPrefix(''));
  });
});

// ─── longestCommonPrefix ─────────────────────────────────────────────────────

describe('Trie – longestCommonPrefix', () => {
  it('returns empty string for an empty trie', () => {
    const t = new Trie();
    assert.equal(t.longestCommonPrefix(), '');
  });

  it('returns the full word when only one word is stored', () => {
    const t = new Trie();
    t.insert('flower');
    assert.equal(t.longestCommonPrefix(), 'flower');
  });

  it('returns shared prefix of multiple words', () => {
    const t = new Trie();
    ['flower', 'flow', 'flight'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), 'fl');
  });

  it('returns empty string when words share no common prefix', () => {
    const t = new Trie();
    ['apple', 'banana'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), '');
  });

  it('returns the shorter word when one word is a prefix of another', () => {
    const t = new Trie();
    ['abc', 'abcdef'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), 'abc');
  });

  it('handles all identical words (single unique word)', () => {
    const t = new Trie();
    t.insert('same');
    t.insert('same');
    assert.equal(t.longestCommonPrefix(), 'same');
  });

  it('returns empty string when words diverge at the root', () => {
    const t = new Trie();
    ['a', 'b', 'c'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), '');
  });

  it('returns full common prefix across many words', () => {
    const t = new Trie();
    ['interview', 'interact', 'internal', 'international'].forEach(w => t.insert(w));
    assert.equal(t.longestCommonPrefix(), 'inter');
  });

  it('returns empty string when the empty string is inserted alongside other words', () => {
    const t = new Trie();
    t.insert('');
    t.insert('apple');
    assert.equal(t.longestCommonPrefix(), '');
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('Trie – size', () => {
  it('starts at 0', () => {
    const t = new Trie();
    assert.equal(t.size, 0);
  });

  it('increments on each distinct insert', () => {
    const t = new Trie();
    t.insert('a');
    assert.equal(t.size, 1);
    t.insert('b');
    assert.equal(t.size, 2);
  });

  it('does not increment for duplicate words', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('hello');
    assert.equal(t.size, 1);
  });

  it('decrements on delete', () => {
    const t = new Trie();
    t.insert('x');
    t.delete('x');
    assert.equal(t.size, 0);
  });

  it('does not change on failed delete', () => {
    const t = new Trie();
    t.insert('x');
    t.delete('nothere');
    assert.equal(t.size, 1);
  });

  it('tracks many insertions correctly', () => {
    const t = new Trie();
    const words = ['one', 'two', 'three', 'four', 'five'];
    for (const w of words) t.insert(w);
    assert.equal(t.size, 5);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('Trie – clear', () => {
  it('resets size to 0', () => {
    const t = new Trie();
    t.insert('a');
    t.insert('b');
    t.clear();
    assert.equal(t.size, 0);
  });

  it('previously inserted words are no longer found', () => {
    const t = new Trie();
    t.insert('hello');
    t.clear();
    assert.equal(t.search('hello'), false);
  });

  it('startsWith returns false after clear', () => {
    const t = new Trie();
    t.insert('hello');
    t.clear();
    assert.equal(t.startsWith('h'), false);
  });

  it('trie is usable again after clear', () => {
    const t = new Trie();
    t.insert('before');
    t.clear();
    t.insert('after');
    assert.equal(t.search('after'), true);
    assert.equal(t.search('before'), false);
    assert.equal(t.size, 1);
  });

  it('toArray returns empty after clear', () => {
    const t = new Trie();
    t.insert('foo');
    t.clear();
    assert.deepEqual(t.toArray(), []);
  });
});

// ─── toArray ─────────────────────────────────────────────────────────────────

describe('Trie – toArray', () => {
  it('returns empty array on empty trie', () => {
    const t = new Trie();
    assert.deepEqual(t.toArray(), []);
  });

  it('returns all words in lexicographic order', () => {
    const t = new Trie();
    ['zebra', 'ant', 'cat', 'bear'].forEach(w => t.insert(w));
    assert.deepEqual(t.toArray(), ['ant', 'bear', 'cat', 'zebra']);
  });

  it('includes words that are prefixes of other words', () => {
    const t = new Trie();
    t.insert('a');
    t.insert('ab');
    t.insert('abc');
    assert.deepEqual(t.toArray(), ['a', 'ab', 'abc']);
  });

  it('handles a single word', () => {
    const t = new Trie();
    t.insert('only');
    assert.deepEqual(t.toArray(), ['only']);
  });

  it('reflects deletions', () => {
    const t = new Trie();
    ['apple', 'banana', 'cherry'].forEach(w => t.insert(w));
    t.delete('banana');
    assert.deepEqual(t.toArray(), ['apple', 'cherry']);
  });

  it('length equals size', () => {
    const t = new Trie();
    t.insert('x');
    t.insert('y');
    t.insert('z');
    assert.equal(t.toArray().length, t.size);
  });

  it('does not return duplicates', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('hello');
    assert.deepEqual(t.toArray(), ['hello']);
  });
});

// ─── createTrie factory ───────────────────────────────────────────────────────

describe('createTrie factory', () => {
  it('returns a Trie instance', () => {
    const t = createTrie();
    assert.ok(t instanceof Trie);
  });

  it('creates an empty trie when called with no arguments', () => {
    const t = createTrie();
    assert.equal(t.size, 0);
  });

  it('creates an empty trie when called with undefined', () => {
    const t = createTrie(undefined);
    assert.equal(t.size, 0);
  });

  it('pre-populates words from the array argument', () => {
    const t = createTrie(['hello', 'world']);
    assert.equal(t.search('hello'), true);
    assert.equal(t.search('world'), true);
    assert.equal(t.size, 2);
  });

  it('handles an empty array argument', () => {
    const t = createTrie([]);
    assert.equal(t.size, 0);
  });

  it('deduplicates words in the initial array', () => {
    const t = createTrie(['a', 'a', 'b']);
    assert.equal(t.size, 2);
  });

  it('resulting trie supports all operations', () => {
    const t = createTrie(['foo', 'bar', 'baz']);
    assert.equal(t.startsWith('ba'), true);
    assert.deepEqual(t.wordsWithPrefix('ba'), ['bar', 'baz']);
    assert.deepEqual(t.toArray(), ['bar', 'baz', 'foo']);
    t.delete('bar');
    assert.equal(t.size, 2);
  });

  it('pre-populated trie has correct longestCommonPrefix', () => {
    const t = createTrie(['interview', 'interact', 'internal']);
    assert.equal(t.longestCommonPrefix(), 'inter');
  });

  it('search works correctly on factory-created trie', () => {
    const t = createTrie(['cat', 'car', 'card']);
    assert.equal(t.search('cat'), true);
    assert.equal(t.search('ca'), false);
  });
});
