// ─── Unit Tests: Fuzzy Search ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fuzzyMatch,
  fuzzyScore,
  fuzzySearch,
  createFuzzySearcher,
} from '../../app/modules/fuzzy-search.js';

describe('fuzzyMatch', () => {
  it('exact match returns true', () => assert.equal(fuzzyMatch('abc', 'abc'), true));
  it('pattern chars in order returns true', () => assert.equal(fuzzyMatch('abc', 'axbxcx'), true));
  it('missing char returns false', () => assert.equal(fuzzyMatch('abz', 'abc'), false));
  it('empty pattern always matches', () => assert.equal(fuzzyMatch('', 'anything'), true));
  it('pattern longer than text returns false', () => assert.equal(fuzzyMatch('abcdef', 'abc'), false));
});

describe('fuzzyScore', () => {
  it('exact match returns 1', () => assert.equal(fuzzyScore('abc', 'abc'), 1));
  it('no match returns 0', () => assert.equal(fuzzyScore('xyz', 'abc'), 0));
  it('consecutive bonus: score is higher for consecutive chars', () => {
    const consecutive = fuzzyScore('abc', 'abc');
    const scattered = fuzzyScore('abc', 'axbxcx');
    assert.ok(consecutive >= scattered);
  });
  it('score is between 0 and 1', () => {
    const s = fuzzyScore('he', 'hello');
    assert.ok(s >= 0 && s <= 1);
  });
});

describe('fuzzySearch', () => {
  const items = ['hello', 'world', 'help', 'helm', 'helicopter'];

  it('returns matching items sorted by score', () => {
    const results = fuzzySearch('hel', items);
    assert.ok(results.length > 0);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score);
    }
  });

  it('excludes non-matching items', () => {
    const results = fuzzySearch('xyz', items);
    assert.equal(results.length, 0);
  });

  it('each result has item, score, indices', () => {
    const results = fuzzySearch('hel', items);
    assert.ok(results.length > 0);
    assert.ok(typeof results[0].item === 'string');
    assert.ok(typeof results[0].score === 'number');
    assert.ok(Array.isArray(results[0].indices));
  });

  it('empty pattern matches all items', () => {
    const results = fuzzySearch('', items);
    assert.equal(results.length, items.length);
  });
});

describe('createFuzzySearcher', () => {
  it('returns a function', () => {
    const searcher = createFuzzySearcher(['a', 'b', 'c']);
    assert.equal(typeof searcher, 'function');
  });

  it('searcher works like fuzzySearch', () => {
    const items = ['apple', 'application', 'apply', 'banana'];
    const searcher = createFuzzySearcher(items);
    const results = searcher('app');
    assert.ok(results.length >= 2);
    assert.ok(results.every(r => fuzzyMatch('app', r.item)));
  });
});
