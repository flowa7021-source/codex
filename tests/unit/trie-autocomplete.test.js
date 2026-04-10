// ─── Unit Tests: trie-autocomplete ───────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { AutocompleteTrie, createAutocompleteTrie } from '../../app/modules/trie-autocomplete.js';

// ─── insert + has ────────────────────────────────────────────────────────────

describe('AutocompleteTrie – insert + has', () => {
  it('finds a word after inserting it', () => {
    const trie = new AutocompleteTrie();
    trie.insert('hello');
    assert.equal(trie.has('hello'), true);
  });

  it('returns false for a word not inserted', () => {
    const trie = new AutocompleteTrie();
    trie.insert('hello');
    assert.equal(trie.has('world'), false);
  });

  it('returns false for a prefix that is not a complete word', () => {
    const trie = new AutocompleteTrie();
    trie.insert('hello');
    assert.equal(trie.has('hell'), false);
  });

  it('does not double-count the same word inserted twice', () => {
    const trie = new AutocompleteTrie();
    trie.insert('apple', 5);
    trie.insert('apple', 10);
    assert.equal(trie.size, 1);
  });

  it('updates weight when inserting the same word again', () => {
    const trie = new AutocompleteTrie();
    trie.insert('apple', 5);
    trie.insert('apple', 10);
    const results = trie.search('apple');
    assert.equal(results.length, 1);
    assert.equal(results[0].weight, 10);
  });
});

// ─── search (autocomplete) ──────────────────────────────────────────────────

describe('AutocompleteTrie – search', () => {
  /** @type {AutocompleteTrie} */
  let trie;

  beforeEach(() => {
    trie = new AutocompleteTrie();
    trie.insert('apple', 10);
    trie.insert('app', 5);
    trie.insert('application', 8);
    trie.insert('banana', 3);
    trie.insert('appetizer', 7);
  });

  it('returns all words matching a prefix sorted by weight desc', () => {
    const results = trie.search('app');
    assert.equal(results.length, 4);
    assert.equal(results[0].word, 'apple');
    assert.equal(results[0].weight, 10);
    assert.equal(results[1].word, 'application');
    assert.equal(results[2].word, 'appetizer');
    assert.equal(results[3].word, 'app');
  });

  it('respects the limit parameter', () => {
    const results = trie.search('app', 2);
    assert.equal(results.length, 2);
    assert.equal(results[0].word, 'apple');
    assert.equal(results[1].word, 'application');
  });

  it('returns an empty array for a non-matching prefix', () => {
    const results = trie.search('xyz');
    assert.deepEqual(results, []);
  });

  it('returns all words when prefix is empty string', () => {
    const results = trie.search('');
    assert.equal(results.length, 5);
    // Highest weight first
    assert.equal(results[0].word, 'apple');
  });

  it('uses default weight of 1', () => {
    const t = new AutocompleteTrie();
    t.insert('foo');
    const results = t.search('foo');
    assert.equal(results[0].weight, 1);
  });
});

// ─── delete ──────────────────────────────────────────────────────────────────

describe('AutocompleteTrie – delete', () => {
  it('removes a word and decrements size', () => {
    const trie = new AutocompleteTrie();
    trie.insert('hello');
    trie.insert('help');
    assert.equal(trie.delete('hello'), true);
    assert.equal(trie.has('hello'), false);
    assert.equal(trie.size, 1);
  });

  it('returns false when deleting a non-existent word', () => {
    const trie = new AutocompleteTrie();
    assert.equal(trie.delete('ghost'), false);
  });

  it('does not affect other words sharing a prefix', () => {
    const trie = new AutocompleteTrie();
    trie.insert('hello');
    trie.insert('help');
    trie.delete('hello');
    assert.equal(trie.has('help'), true);
  });
});

// ─── size + words + clear ────────────────────────────────────────────────────

describe('AutocompleteTrie – size, words, clear', () => {
  it('tracks size correctly', () => {
    const trie = new AutocompleteTrie();
    assert.equal(trie.size, 0);
    trie.insert('a');
    trie.insert('b');
    assert.equal(trie.size, 2);
  });

  it('returns all words', () => {
    const trie = new AutocompleteTrie();
    trie.insert('cat');
    trie.insert('car');
    trie.insert('card');
    const w = trie.words().sort();
    assert.deepEqual(w, ['car', 'card', 'cat']);
  });

  it('clears all words', () => {
    const trie = new AutocompleteTrie();
    trie.insert('a');
    trie.insert('b');
    trie.clear();
    assert.equal(trie.size, 0);
    assert.deepEqual(trie.words(), []);
    assert.equal(trie.has('a'), false);
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('createAutocompleteTrie', () => {
  it('returns an AutocompleteTrie instance', () => {
    const trie = createAutocompleteTrie();
    assert.ok(trie instanceof AutocompleteTrie);
  });

  it('returned instance is fully functional', () => {
    const trie = createAutocompleteTrie();
    trie.insert('test', 42);
    assert.equal(trie.has('test'), true);
    assert.equal(trie.search('te')[0].weight, 42);
  });
});
