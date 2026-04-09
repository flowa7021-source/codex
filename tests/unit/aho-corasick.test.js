// ─── Unit Tests: AhoCorasick ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AhoCorasick, createAhoCorasick } from '../../app/modules/aho-corasick.js';

// ─── constructor / patternCount ──────────────────────────────────────────────

describe('AhoCorasick – constructor', () => {
  it('reports correct patternCount', () => {
    const ac = new AhoCorasick(['he', 'she', 'his', 'hers']);
    assert.equal(ac.patternCount, 4);
  });

  it('deduplicates identical patterns', () => {
    const ac = new AhoCorasick(['abc', 'abc', 'def', 'def', 'def']);
    assert.equal(ac.patternCount, 2);
  });

  it('ignores empty-string patterns', () => {
    const ac = new AhoCorasick(['', 'a', '', 'b']);
    assert.equal(ac.patternCount, 2);
  });

  it('handles zero valid patterns gracefully', () => {
    const ac = new AhoCorasick([]);
    assert.equal(ac.patternCount, 0);
    assert.deepEqual(ac.search('anything'), []);
  });
});

// ─── search ──────────────────────────────────────────────────────────────────

describe('AhoCorasick – search', () => {
  it('finds all occurrences of multiple patterns', () => {
    const ac = new AhoCorasick(['he', 'she', 'his', 'hers']);
    const matches = ac.search('ushers');
    const patterns = matches.map(m => m.pattern).sort();
    assert.ok(patterns.includes('he'));
    assert.ok(patterns.includes('she'));
    assert.ok(patterns.includes('hers'));
  });

  it('returns correct indices', () => {
    const ac = new AhoCorasick(['ab']);
    const matches = ac.search('ababab');
    const indices = matches.map(m => m.index);
    assert.deepEqual(indices, [0, 2, 4]);
  });

  it('returns empty array when no match', () => {
    const ac = new AhoCorasick(['xyz']);
    assert.deepEqual(ac.search('abcdef'), []);
  });

  it('handles overlapping patterns', () => {
    const ac = new AhoCorasick(['a', 'ab', 'abc']);
    const matches = ac.search('abc');
    const patterns = matches.map(m => m.pattern).sort();
    assert.ok(patterns.includes('a'));
    assert.ok(patterns.includes('ab'));
    assert.ok(patterns.includes('abc'));
  });

  it('works with single-character patterns', () => {
    const ac = new AhoCorasick(['a', 'b']);
    const matches = ac.search('abba');
    assert.equal(matches.length, 4);
  });

  it('handles pattern longer than text', () => {
    const ac = new AhoCorasick(['longpattern']);
    assert.deepEqual(ac.search('short'), []);
  });
});

// ─── contains ────────────────────────────────────────────────────────────────

describe('AhoCorasick – contains', () => {
  it('returns true when any pattern matches', () => {
    const ac = new AhoCorasick(['foo', 'bar']);
    assert.equal(ac.contains('foobar'), true);
  });

  it('returns false when no pattern matches', () => {
    const ac = new AhoCorasick(['foo', 'bar']);
    assert.equal(ac.contains('baz'), false);
  });

  it('returns false on empty text with patterns', () => {
    const ac = new AhoCorasick(['a']);
    assert.equal(ac.contains(''), false);
  });

  it('returns false when automaton has no patterns', () => {
    const ac = new AhoCorasick([]);
    assert.equal(ac.contains('hello'), false);
  });
});

// ─── factory ─────────────────────────────────────────────────────────────────

describe('createAhoCorasick factory', () => {
  it('returns an AhoCorasick instance', () => {
    const ac = createAhoCorasick(['test']);
    assert.ok(ac instanceof AhoCorasick);
  });

  it('produced instance works correctly', () => {
    const ac = createAhoCorasick(['cat', 'at']);
    const matches = ac.search('cat');
    assert.equal(matches.length, 2);
  });
});
