// ─── Unit Tests: trie ─────────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Trie } from '../../app/modules/trie.js';

// ─── insert + search ──────────────────────────────────────────────────────────

describe('insert + search', () => {
  it('finds a word after inserting it', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.search('hello'), true);
  });

  it('returns false for a word not inserted', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.search('world'), false);
  });

  it('returns false for a prefix that is not a complete word', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.search('hell'), false);
  });

  it('handles inserting the same word twice without double-counting', () => {
    const trie = new Trie();
    trie.insert('apple');
    trie.insert('apple');
    assert.equal(trie.search('apple'), true);
    assert.equal(trie.size, 1);
  });

  it('handles empty string insertion and search', () => {
    const trie = new Trie();
    trie.insert('');
    assert.equal(trie.search(''), true);
  });
});

// ─── startsWith ───────────────────────────────────────────────────────────────

describe('startsWith', () => {
  it('returns true for a matching prefix', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.startsWith('hel'), true);
  });

  it('returns true for the full word as prefix', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.startsWith('hello'), true);
  });

  it('returns false for a non-matching prefix', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.startsWith('world'), false);
  });

  it('returns true for empty prefix (matches everything)', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.startsWith(''), true);
  });

  it('returns false on empty trie with non-empty prefix', () => {
    const trie = new Trie();
    assert.equal(trie.startsWith('a'), false);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('delete', () => {
  it('removes a word and returns true', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.equal(trie.delete('hello'), true);
    assert.equal(trie.search('hello'), false);
  });

  it('returns false for a word not in the trie', () => {
    const trie = new Trie();
    assert.equal(trie.delete('missing'), false);
  });

  it('does not remove a prefix when only the full word is deleted', () => {
    const trie = new Trie();
    trie.insert('hello');
    trie.insert('hell');
    trie.delete('hello');
    assert.equal(trie.search('hell'), true);
    assert.equal(trie.search('hello'), false);
  });

  it('does not affect other words sharing a prefix', () => {
    const trie = new Trie();
    trie.insert('apple');
    trie.insert('app');
    trie.delete('app');
    assert.equal(trie.search('apple'), true);
    assert.equal(trie.search('app'), false);
  });

  it('decrements size after deletion', () => {
    const trie = new Trie();
    trie.insert('foo');
    trie.insert('bar');
    trie.delete('foo');
    assert.equal(trie.size, 1);
  });
});

// ─── wordsWithPrefix ──────────────────────────────────────────────────────────

describe('wordsWithPrefix', () => {
  it('returns correct subset of words matching prefix', () => {
    const trie = new Trie();
    trie.insert('apple');
    trie.insert('app');
    trie.insert('apply');
    trie.insert('banana');
    const result = trie.wordsWithPrefix('app');
    assert.equal(result.length, 3);
    assert.ok(result.includes('app'));
    assert.ok(result.includes('apple'));
    assert.ok(result.includes('apply'));
    assert.ok(!result.includes('banana'));
  });

  it('returns empty array for a prefix with no matches', () => {
    const trie = new Trie();
    trie.insert('hello');
    assert.deepEqual(trie.wordsWithPrefix('xyz'), []);
  });

  it('returns all words when prefix is empty string', () => {
    const trie = new Trie();
    trie.insert('foo');
    trie.insert('bar');
    const result = trie.wordsWithPrefix('');
    assert.equal(result.length, 2);
  });

  it('returns single word when prefix exactly matches it', () => {
    const trie = new Trie();
    trie.insert('cat');
    trie.insert('car');
    const result = trie.wordsWithPrefix('cat');
    assert.deepEqual(result, ['cat']);
  });
});

// ─── allWords ─────────────────────────────────────────────────────────────────

describe('allWords', () => {
  it('returns all inserted words', () => {
    const trie = new Trie();
    const words = ['one', 'two', 'three', 'four'];
    for (const w of words) trie.insert(w);
    const result = trie.allWords();
    assert.equal(result.length, words.length);
    for (const w of words) assert.ok(result.includes(w));
  });

  it('returns empty array for empty trie', () => {
    const trie = new Trie();
    assert.deepEqual(trie.allWords(), []);
  });

  it('does not return duplicates for words inserted multiple times', () => {
    const trie = new Trie();
    trie.insert('hello');
    trie.insert('hello');
    assert.deepEqual(trie.allWords(), ['hello']);
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('size', () => {
  it('starts at 0', () => {
    const trie = new Trie();
    assert.equal(trie.size, 0);
  });

  it('increments with each new unique word', () => {
    const trie = new Trie();
    trie.insert('a');
    trie.insert('b');
    trie.insert('c');
    assert.equal(trie.size, 3);
  });

  it('does not increment for duplicate inserts', () => {
    const trie = new Trie();
    trie.insert('word');
    trie.insert('word');
    assert.equal(trie.size, 1);
  });

  it('decrements after delete', () => {
    const trie = new Trie();
    trie.insert('x');
    trie.insert('y');
    trie.delete('x');
    assert.equal(trie.size, 1);
  });

  it('does not decrement for deleting a non-existent word', () => {
    const trie = new Trie();
    trie.insert('foo');
    trie.delete('bar');
    assert.equal(trie.size, 1);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('empties the trie', () => {
    const trie = new Trie();
    trie.insert('hello');
    trie.insert('world');
    trie.clear();
    assert.equal(trie.size, 0);
    assert.equal(trie.search('hello'), false);
    assert.equal(trie.search('world'), false);
    assert.deepEqual(trie.allWords(), []);
  });

  it('allows new insertions after clear', () => {
    const trie = new Trie();
    trie.insert('old');
    trie.clear();
    trie.insert('new');
    assert.equal(trie.search('new'), true);
    assert.equal(trie.search('old'), false);
    assert.equal(trie.size, 1);
  });
});
