// ─── Unit Tests: levenshtein-automaton ───────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LevenshteinAutomaton,
  fuzzySearch,
  createLevenshteinAutomaton,
} from '../../app/modules/levenshtein-automaton.js';

// ─── distance ────────────────────────────────────────────────────────────────

describe('LevenshteinAutomaton – distance', () => {
  it('returns 0 for identical strings', () => {
    const a = new LevenshteinAutomaton('kitten', 2);
    assert.equal(a.distance('kitten'), 0);
  });

  it('returns correct distance for single substitution', () => {
    const a = new LevenshteinAutomaton('cat', 2);
    assert.equal(a.distance('car'), 1);
  });

  it('returns correct distance for insertion', () => {
    const a = new LevenshteinAutomaton('cat', 2);
    assert.equal(a.distance('cats'), 1);
  });

  it('returns correct distance for deletion', () => {
    const a = new LevenshteinAutomaton('cats', 2);
    assert.equal(a.distance('cat'), 1);
  });

  it('computes classic kitten/sitting distance = 3', () => {
    const a = new LevenshteinAutomaton('kitten', 5);
    assert.equal(a.distance('sitting'), 3);
  });

  it('handles empty reference word', () => {
    const a = new LevenshteinAutomaton('', 3);
    assert.equal(a.distance('abc'), 3);
  });

  it('handles empty candidate', () => {
    const a = new LevenshteinAutomaton('abc', 5);
    assert.equal(a.distance(''), 3);
  });

  it('handles both strings empty', () => {
    const a = new LevenshteinAutomaton('', 0);
    assert.equal(a.distance(''), 0);
  });
});

// ─── matches ─────────────────────────────────────────────────────────────────

describe('LevenshteinAutomaton – matches', () => {
  it('returns true when within maxDistance', () => {
    const a = new LevenshteinAutomaton('book', 1);
    assert.equal(a.matches('books'), true);
    assert.equal(a.matches('look'), true);
    assert.equal(a.matches('boo'), true);
  });

  it('returns false when beyond maxDistance', () => {
    const a = new LevenshteinAutomaton('book', 1);
    assert.equal(a.matches('booklet'), false);
    assert.equal(a.matches('table'), false);
  });

  it('returns true for exact match at distance 0', () => {
    const a = new LevenshteinAutomaton('hello', 0);
    assert.equal(a.matches('hello'), true);
  });

  it('returns false for any mismatch at distance 0', () => {
    const a = new LevenshteinAutomaton('hello', 0);
    assert.equal(a.matches('hallo'), false);
  });
});

// ─── getters ─────────────────────────────────────────────────────────────────

describe('LevenshteinAutomaton – getters', () => {
  it('exposes word getter', () => {
    const a = new LevenshteinAutomaton('test', 2);
    assert.equal(a.word, 'test');
  });

  it('exposes maxDistance getter', () => {
    const a = new LevenshteinAutomaton('test', 2);
    assert.equal(a.maxDistance, 2);
  });
});

// ─── fuzzySearch ─────────────────────────────────────────────────────────────

describe('fuzzySearch', () => {
  const dict = ['apple', 'apply', 'ape', 'maple', 'orange', 'grape', 'grapefruit'];

  it('finds exact matches at distance 0', () => {
    const results = fuzzySearch(dict, 'apple', 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].word, 'apple');
    assert.equal(results[0].distance, 0);
  });

  it('finds close matches within distance 1', () => {
    const results = fuzzySearch(dict, 'apple', 1);
    const words = results.map(r => r.word);
    assert.ok(words.includes('apple'));
    assert.ok(words.includes('apply'));
  });

  it('sorts results by distance ascending then alphabetically', () => {
    const results = fuzzySearch(dict, 'apple', 2);
    // Distance 0 first, then 1, then 2
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i].distance > results[i - 1].distance ||
        (results[i].distance === results[i - 1].distance &&
         results[i].word >= results[i - 1].word),
      );
    }
  });

  it('returns empty array when nothing matches', () => {
    const results = fuzzySearch(dict, 'zzzzz', 1);
    assert.deepEqual(results, []);
  });

  it('handles empty dictionary', () => {
    const results = fuzzySearch([], 'test', 3);
    assert.deepEqual(results, []);
  });

  it('handles empty query', () => {
    const results = fuzzySearch(['a', 'ab', 'abc'], '', 2);
    const words = results.map(r => r.word);
    assert.ok(words.includes('a'));
    assert.ok(words.includes('ab'));
    assert.ok(!words.includes('abc')); // distance 3 > maxDistance 2
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('createLevenshteinAutomaton', () => {
  it('returns a LevenshteinAutomaton instance', () => {
    const a = createLevenshteinAutomaton('test', 2);
    assert.ok(a instanceof LevenshteinAutomaton);
  });

  it('returned instance is fully functional', () => {
    const a = createLevenshteinAutomaton('hello', 1);
    assert.equal(a.matches('hallo'), true);
    assert.equal(a.matches('world'), false);
    assert.equal(a.word, 'hello');
    assert.equal(a.maxDistance, 1);
  });
});
