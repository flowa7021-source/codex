// ─── Unit Tests: Trie ─────────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Trie, createTrie } from '../../app/modules/trie.js';

// ─── insert / size ────────────────────────────────────────────────────────────

describe('Trie – insert / size', () => {
  it('starts with size 0', () => {
    const t = new Trie();
    assert.equal(t.size, 0);
  });

  it('size increments for each unique word', () => {
    const t = new Trie();
    t.insert('apple');
    t.insert('banana');
    t.insert('cherry');
    assert.equal(t.size, 3);
  });

  it('duplicate insert does not increase size', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('hello');
    assert.equal(t.size, 1);
  });

  it('inserting many words tracks all of them', () => {
    const t = new Trie();
    const words = ['one', 'two', 'three', 'four', 'five'];
    for (const w of words) t.insert(w);
    assert.equal(t.size, 5);
  });

  it('can insert an empty string', () => {
    const t = new Trie();
    t.insert('');
    assert.equal(t.size, 1);
  });

  it('words sharing a prefix are counted individually', () => {
    const t = new Trie();
    t.insert('app');
    t.insert('apple');
    t.insert('apply');
    assert.equal(t.size, 3);
  });
});

// ─── has() ────────────────────────────────────────────────────────────────────

describe('Trie – has()', () => {
  it('returns true for an inserted word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.has('hello'), true);
  });

  it('returns false for a word not inserted', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.has('world'), false);
  });

  it('returns false for a strict prefix of a stored word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.has('hell'), false);
  });

  it('returns false for a word that extends a stored word', () => {
    const t = new Trie();
    t.insert('hell');
    assert.equal(t.has('hello'), false);
  });

  it('returns true for the empty string when it was inserted', () => {
    const t = new Trie();
    t.insert('');
    assert.equal(t.has(''), true);
  });

  it('returns false for the empty string when it was not inserted', () => {
    const t = new Trie();
    t.insert('abc');
    assert.equal(t.has(''), false);
  });

  it('returns false on an empty trie', () => {
    const t = new Trie();
    assert.equal(t.has('anything'), false);
  });
});

// ─── hasPrefix() ──────────────────────────────────────────────────────────────

describe('Trie – hasPrefix()', () => {
  it('returns true for a proper prefix of a stored word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.hasPrefix('hel'), true);
  });

  it('returns true when the prefix equals a stored word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.hasPrefix('hello'), true);
  });

  it('returns false for a prefix not present', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.hasPrefix('world'), false);
  });

  it('returns true for an empty-string prefix when words exist', () => {
    const t = new Trie();
    t.insert('abc');
    assert.equal(t.hasPrefix(''), true);
  });

  it('returns false on an empty trie', () => {
    const t = new Trie();
    assert.equal(t.hasPrefix(''), false);
    assert.equal(t.hasPrefix('a'), false);
  });

  it('returns false when prefix overshoots a stored word', () => {
    const t = new Trie();
    t.insert('hi');
    assert.equal(t.hasPrefix('hint'), false);
  });
});

// ─── delete() ─────────────────────────────────────────────────────────────────

describe('Trie – delete()', () => {
  it('returns true and removes the word', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.delete('hello'), true);
    assert.equal(t.has('hello'), false);
  });

  it('returns false for a word that was never inserted', () => {
    const t = new Trie();
    assert.equal(t.delete('missing'), false);
  });

  it('decrements size after deletion', () => {
    const t = new Trie();
    t.insert('foo');
    t.insert('bar');
    t.delete('foo');
    assert.equal(t.size, 1);
  });

  it('does not affect sibling words sharing a prefix', () => {
    const t = new Trie();
    t.insert('apple');
    t.insert('app');
    t.delete('app');
    assert.equal(t.has('apple'), true);
    assert.equal(t.has('app'), false);
  });

  it('keeps the prefix intact when only the full word is deleted', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('hell');
    t.delete('hello');
    assert.equal(t.has('hell'), true);
    assert.equal(t.hasPrefix('hell'), true);
  });

  it('deleting a non-existent word does not change size', () => {
    const t = new Trie();
    t.insert('foo');
    t.delete('bar');
    assert.equal(t.size, 1);
  });

  it('returns false when deleting a word twice', () => {
    const t = new Trie();
    t.insert('once');
    t.delete('once');
    assert.equal(t.delete('once'), false);
  });
});

// ─── search() / startsWith() ──────────────────────────────────────────────────

describe('Trie – search() / startsWith()', () => {
  it('search returns all words with a given prefix, sorted', () => {
    const t = new Trie();
    t.insert('apple');
    t.insert('app');
    t.insert('apply');
    t.insert('banana');
    assert.deepEqual(t.search('app'), ['app', 'apple', 'apply']);
  });

  it('startsWith is an alias for search', () => {
    const t = new Trie();
    t.insert('cat');
    t.insert('car');
    t.insert('card');
    assert.deepEqual(t.startsWith('car'), t.search('car'));
  });

  it('search with empty prefix returns all words sorted', () => {
    const t = new Trie();
    t.insert('zebra');
    t.insert('ant');
    t.insert('mango');
    assert.deepEqual(t.search(''), ['ant', 'mango', 'zebra']);
  });

  it('search returns empty array for non-existent prefix', () => {
    const t = new Trie();
    t.insert('hello');
    assert.deepEqual(t.search('xyz'), []);
  });

  it('search returns single word when prefix matches exactly one word', () => {
    const t = new Trie();
    t.insert('cat');
    t.insert('dog');
    assert.deepEqual(t.search('dog'), ['dog']);
  });

  it('search returns empty array on empty trie', () => {
    const t = new Trie();
    assert.deepEqual(t.search('a'), []);
  });

  it('search result includes the prefix word itself when it is stored', () => {
    const t = new Trie();
    t.insert('pre');
    t.insert('prefix');
    assert.ok(t.search('pre').includes('pre'));
    assert.ok(t.search('pre').includes('prefix'));
  });
});

// ─── autocomplete() ───────────────────────────────────────────────────────────

describe('Trie – autocomplete()', () => {
  it('returns up to the default limit of 10', () => {
    const t = new Trie();
    for (let i = 0; i < 15; i++) t.insert(`word${i}`);
    const result = t.autocomplete('word');
    assert.equal(result.length, 10);
  });

  it('respects a custom limit', () => {
    const t = new Trie();
    t.insert('apple');
    t.insert('apply');
    t.insert('apt');
    t.insert('art');
    assert.equal(t.autocomplete('a', 2).length, 2);
  });

  it('returns fewer than limit when fewer words match', () => {
    const t = new Trie();
    t.insert('cat');
    t.insert('car');
    assert.equal(t.autocomplete('ca', 10).length, 2);
  });

  it('returns results in alphabetical order', () => {
    const t = new Trie();
    t.insert('zebra');
    t.insert('apple');
    t.insert('mango');
    const result = t.autocomplete('', 3);
    assert.deepEqual(result, ['apple', 'mango', 'zebra']);
  });

  it('returns empty array when prefix does not match', () => {
    const t = new Trie();
    t.insert('hello');
    assert.deepEqual(t.autocomplete('xyz'), []);
  });

  it('limit of 0 returns empty array', () => {
    const t = new Trie();
    t.insert('hello');
    assert.deepEqual(t.autocomplete('h', 0), []);
  });

  it('autocomplete with limit 1 returns the alphabetically first match', () => {
    const t = new Trie();
    t.insert('banana');
    t.insert('apple');
    t.insert('cherry');
    assert.deepEqual(t.autocomplete('', 1), ['apple']);
  });
});

// ─── countWithPrefix() ────────────────────────────────────────────────────────

describe('Trie – countWithPrefix()', () => {
  it('counts all words sharing a prefix', () => {
    const t = new Trie();
    t.insert('app');
    t.insert('apple');
    t.insert('apply');
    t.insert('banana');
    assert.equal(t.countWithPrefix('app'), 3);
  });

  it('returns 0 for a non-existent prefix', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.countWithPrefix('xyz'), 0);
  });

  it('returns 0 on empty trie', () => {
    const t = new Trie();
    assert.equal(t.countWithPrefix('a'), 0);
  });

  it('counts with empty prefix equals total size', () => {
    const t = new Trie();
    t.insert('one');
    t.insert('two');
    t.insert('three');
    assert.equal(t.countWithPrefix(''), t.size);
  });

  it('counts correctly when prefix is an exact stored word', () => {
    const t = new Trie();
    t.insert('cat');
    t.insert('cats');
    assert.equal(t.countWithPrefix('cat'), 2);
  });

  it('decreases after deletion', () => {
    const t = new Trie();
    t.insert('app');
    t.insert('apple');
    t.delete('app');
    assert.equal(t.countWithPrefix('app'), 1);
  });
});

// ─── clear() ──────────────────────────────────────────────────────────────────

describe('Trie – clear()', () => {
  it('resets size to 0', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('world');
    t.clear();
    assert.equal(t.size, 0);
  });

  it('removes all words', () => {
    const t = new Trie();
    t.insert('foo');
    t.insert('bar');
    t.clear();
    assert.equal(t.has('foo'), false);
    assert.equal(t.has('bar'), false);
  });

  it('allows insertions after clearing', () => {
    const t = new Trie();
    t.insert('old');
    t.clear();
    t.insert('new');
    assert.equal(t.has('new'), true);
    assert.equal(t.size, 1);
  });

  it('toArray returns empty after clear', () => {
    const t = new Trie();
    t.insert('a');
    t.clear();
    assert.deepEqual(t.toArray(), []);
  });
});

// ─── toArray() ────────────────────────────────────────────────────────────────

describe('Trie – toArray()', () => {
  it('returns all words in alphabetical order', () => {
    const t = new Trie();
    t.insert('mango');
    t.insert('apple');
    t.insert('banana');
    assert.deepEqual(t.toArray(), ['apple', 'banana', 'mango']);
  });

  it('returns empty array for empty trie', () => {
    const t = new Trie();
    assert.deepEqual(t.toArray(), []);
  });

  it('does not return duplicates', () => {
    const t = new Trie();
    t.insert('hello');
    t.insert('hello');
    assert.deepEqual(t.toArray(), ['hello']);
  });

  it('length equals size', () => {
    const t = new Trie();
    t.insert('x');
    t.insert('y');
    t.insert('z');
    assert.equal(t.toArray().length, t.size);
  });

  it('reflects deletions', () => {
    const t = new Trie();
    t.insert('cat');
    t.insert('dog');
    t.delete('cat');
    assert.deepEqual(t.toArray(), ['dog']);
  });
});

// ─── longestCommonPrefix() ────────────────────────────────────────────────────

describe('Trie – longestCommonPrefix()', () => {
  it('returns empty string for an empty trie', () => {
    const t = new Trie();
    assert.equal(t.longestCommonPrefix(), '');
  });

  it('returns the whole word when only one word is stored', () => {
    const t = new Trie();
    t.insert('hello');
    assert.equal(t.longestCommonPrefix(), 'hello');
  });

  it('returns the shared prefix of multiple words', () => {
    const t = new Trie();
    t.insert('flower');
    t.insert('flow');
    t.insert('flight');
    assert.equal(t.longestCommonPrefix(), 'fl');
  });

  it('returns empty string when words share no common prefix', () => {
    const t = new Trie();
    t.insert('apple');
    t.insert('banana');
    assert.equal(t.longestCommonPrefix(), '');
  });

  it('returns empty string when one of the words is the empty string', () => {
    const t = new Trie();
    t.insert('');
    t.insert('apple');
    assert.equal(t.longestCommonPrefix(), '');
  });

  it('returns the common prefix for words with same start', () => {
    const t = new Trie();
    t.insert('interview');
    t.insert('interact');
    t.insert('internal');
    assert.equal(t.longestCommonPrefix(), 'inter');
  });
});

// ─── createTrie factory ───────────────────────────────────────────────────────

describe('createTrie factory', () => {
  it('returns a Trie instance', () => {
    const t = createTrie();
    assert.ok(t instanceof Trie);
  });

  it('creates an empty trie when no words are provided', () => {
    const t = createTrie();
    assert.equal(t.size, 0);
  });

  it('pre-populates with the given words', () => {
    const t = createTrie(['apple', 'banana', 'cherry']);
    assert.equal(t.size, 3);
    assert.equal(t.has('apple'), true);
    assert.equal(t.has('banana'), true);
    assert.equal(t.has('cherry'), true);
  });

  it('deduplicates words passed to the factory', () => {
    const t = createTrie(['foo', 'foo', 'bar']);
    assert.equal(t.size, 2);
  });

  it('supports all Trie methods on the created instance', () => {
    const t = createTrie(['prefix', 'pre', 'prelude']);
    assert.deepEqual(t.search('pre'), ['pre', 'prefix', 'prelude']);
    assert.equal(t.countWithPrefix('pre'), 3);
    assert.equal(t.longestCommonPrefix(), 'pre');
  });

  it('works with an empty array argument', () => {
    const t = createTrie([]);
    assert.equal(t.size, 0);
    assert.deepEqual(t.toArray(), []);
  });
});
