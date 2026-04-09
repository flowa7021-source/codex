// ─── Unit Tests: BoyerMoore ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BoyerMoore, boyerMooreSearch, createBoyerMoore } from '../../app/modules/boyer-moore.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('BoyerMoore – constructor', () => {
  it('stores the pattern via getter', () => {
    const bm = new BoyerMoore('needle');
    assert.equal(bm.pattern, 'needle');
  });

  it('throws on empty pattern', () => {
    assert.throws(() => new BoyerMoore(''), { message: /must not be empty/i });
  });
});

// ─── search ──────────────────────────────────────────────────────────────────

describe('BoyerMoore – search', () => {
  it('finds all occurrences', () => {
    const bm = new BoyerMoore('ab');
    assert.deepEqual(bm.search('ababab'), [0, 2, 4]);
  });

  it('returns empty array when no match', () => {
    const bm = new BoyerMoore('xyz');
    assert.deepEqual(bm.search('abcdef'), []);
  });

  it('finds pattern at end of text', () => {
    const bm = new BoyerMoore('end');
    assert.deepEqual(bm.search('the end'), [4]);
  });

  it('finds pattern at start of text', () => {
    const bm = new BoyerMoore('the');
    assert.deepEqual(bm.search('the end'), [0]);
  });

  it('handles single-character pattern', () => {
    const bm = new BoyerMoore('a');
    assert.deepEqual(bm.search('banana'), [1, 3, 5]);
  });

  it('returns empty array when pattern is longer than text', () => {
    const bm = new BoyerMoore('longpattern');
    assert.deepEqual(bm.search('short'), []);
  });

  it('finds overlapping occurrences', () => {
    const bm = new BoyerMoore('aa');
    assert.deepEqual(bm.search('aaaa'), [0, 1, 2]);
  });

  it('handles pattern equal to text', () => {
    const bm = new BoyerMoore('exact');
    assert.deepEqual(bm.search('exact'), [0]);
  });
});

// ─── searchFirst ─────────────────────────────────────────────────────────────

describe('BoyerMoore – searchFirst', () => {
  it('returns index of first occurrence', () => {
    const bm = new BoyerMoore('ab');
    assert.equal(bm.searchFirst('xxabyyab'), 2);
  });

  it('returns -1 when not found', () => {
    const bm = new BoyerMoore('missing');
    assert.equal(bm.searchFirst('nothing here'), -1);
  });

  it('returns -1 when pattern is longer than text', () => {
    const bm = new BoyerMoore('toolong');
    assert.equal(bm.searchFirst('hi'), -1);
  });

  it('returns 0 when pattern matches at start', () => {
    const bm = new BoyerMoore('hello');
    assert.equal(bm.searchFirst('hello world'), 0);
  });
});

// ─── boyerMooreSearch standalone ─────────────────────────────────────────────

describe('boyerMooreSearch standalone', () => {
  it('returns all occurrence indices', () => {
    assert.deepEqual(boyerMooreSearch('abcabc', 'abc'), [0, 3]);
  });

  it('returns empty array for no match', () => {
    assert.deepEqual(boyerMooreSearch('hello', 'xyz'), []);
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('createBoyerMoore factory', () => {
  it('returns a BoyerMoore instance', () => {
    const bm = createBoyerMoore('test');
    assert.ok(bm instanceof BoyerMoore);
  });

  it('produced instance works correctly', () => {
    const bm = createBoyerMoore('is');
    assert.deepEqual(bm.search('this is'), [2, 5]);
  });
});
