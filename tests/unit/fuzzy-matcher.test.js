// ─── Unit Tests: fuzzy-matcher ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fuzzyMatch,
  fuzzySearch,
  similarity,
  highlight,
} from '../../app/modules/fuzzy-matcher.js';

// ─── fuzzyMatch ───────────────────────────────────────────────────────────────

describe('fuzzyMatch – basic matching', () => {
  it('exact match returns score close to 1', () => {
    const result = fuzzyMatch('abc', 'abc');
    assert.ok(result !== null);
    assert.ok(result.score >= 0.9, `Expected score >= 0.9, got ${result.score}`);
  });

  it('exact match has all indices in order', () => {
    const result = fuzzyMatch('abc', 'abc');
    assert.ok(result !== null);
    assert.deepEqual(result.indices, [0, 1, 2]);
  });

  it('returns the original item string', () => {
    const result = fuzzyMatch('js', 'JavaScript');
    assert.ok(result !== null);
    assert.equal(result.item, 'JavaScript');
  });

  it('pattern not a subsequence returns null', () => {
    // 'xyz' cannot be found in-order in 'abc'
    const result = fuzzyMatch('xyz', 'abc');
    assert.equal(result, null);
  });

  it('returns null when score is below threshold', () => {
    // Single char match in a very long string scores very low
    const longStr = 'a' + 'b'.repeat(200);
    const result = fuzzyMatch('a', longStr, { threshold: 0.9 });
    assert.equal(result, null);
  });

  it('empty pattern matches everything with score 1', () => {
    const result = fuzzyMatch('', 'anything');
    assert.ok(result !== null);
    assert.equal(result.score, 1);
    assert.deepEqual(result.indices, []);
  });

  it('score is in [0, 1] range', () => {
    const result = fuzzyMatch('abc', 'xaxbxcx', { threshold: 0 });
    assert.ok(result !== null);
    assert.ok(result.score >= 0 && result.score <= 1);
  });

  it('case-insensitive by default', () => {
    const result = fuzzyMatch('abc', 'ABC');
    assert.ok(result !== null);
  });

  it('case-sensitive returns null when case differs', () => {
    const result = fuzzyMatch('abc', 'ABC', { caseSensitive: true });
    assert.equal(result, null);
  });

  it('case-sensitive matches when case is identical', () => {
    const result = fuzzyMatch('ABC', 'ABC', { caseSensitive: true });
    assert.ok(result !== null);
  });

  it('indices reference positions in original item', () => {
    // pattern 'js' in 'JavaScript' — case-insensitive
    const result = fuzzyMatch('js', 'JavaScript');
    assert.ok(result !== null);
    // j is at index 0, s is somewhere after
    assert.ok(result.indices.includes(0));
    assert.ok(result.indices.length === 2);
  });

  it('consecutive match scores higher than scattered match', () => {
    const consecutive = fuzzyMatch('abc', 'xabcx');
    const scattered = fuzzyMatch('abc', 'xaxbxcxxxxxxxxxxxxxxxxxxxxx', { threshold: 0 });
    assert.ok(consecutive !== null && scattered !== null);
    assert.ok(consecutive.score > scattered.score);
  });
});

describe('fuzzyMatch – threshold option', () => {
  it('default threshold is 0.3', () => {
    // A decent match should pass the default threshold
    const result = fuzzyMatch('abc', 'abcdef');
    assert.ok(result !== null);
  });

  it('custom threshold 0 accepts any valid subsequence', () => {
    const result = fuzzyMatch('a', 'a' + 'z'.repeat(100), { threshold: 0 });
    assert.ok(result !== null);
  });

  it('custom threshold 1 only accepts near-perfect matches', () => {
    const result = fuzzyMatch('abc', 'xaxbxcx', { threshold: 1 });
    assert.equal(result, null);
  });
});

// ─── fuzzySearch ──────────────────────────────────────────────────────────────

describe('fuzzySearch – ranked results', () => {
  it('returns matches sorted by score descending', () => {
    const items = ['abcdef', 'xaxbxcxdxexfx', 'abc'];
    const results = fuzzySearch('abc', items);
    assert.ok(results.length >= 2);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score);
    }
  });

  it('items with no match are excluded', () => {
    const items = ['hello', 'world', 'foobar'];
    const results = fuzzySearch('xyz', items);
    assert.equal(results.length, 0);
  });

  it('respects default limit of 10', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item${i}`);
    const results = fuzzySearch('item', items);
    assert.ok(results.length <= 10);
  });

  it('respects custom limit', () => {
    const items = Array.from({ length: 10 }, (_, i) => `word${i}`);
    const results = fuzzySearch('word', items, { limit: 3 });
    assert.equal(results.length, 3);
  });

  it('returns empty array for empty items list', () => {
    assert.deepEqual(fuzzySearch('test', []), []);
  });

  it('each result has item, score, and indices properties', () => {
    const results = fuzzySearch('js', ['JavaScript', 'JSON', 'Python']);
    assert.ok(results.length > 0);
    for (const r of results) {
      assert.ok('item' in r);
      assert.ok('score' in r);
      assert.ok('indices' in r);
    }
  });

  it('exact match item ranks first among mixed items', () => {
    const items = ['xjavascriptx', 'javascript', 'jxaxvxaxsxcxrxixtpt'];
    const results = fuzzySearch('javascript', items);
    assert.equal(results[0].item, 'javascript');
  });
});

// ─── similarity ───────────────────────────────────────────────────────────────

describe('similarity', () => {
  it('identical strings return 1', () => {
    assert.equal(similarity('hello', 'hello'), 1);
  });

  it('completely different strings return low similarity', () => {
    const s = similarity('abc', 'xyz');
    assert.ok(s < 0.5, `Expected < 0.5, got ${s}`);
  });

  it('empty strings are identical (both empty)', () => {
    assert.equal(similarity('', ''), 1);
  });

  it('one empty string returns 0', () => {
    assert.equal(similarity('', 'abc'), 0);
    assert.equal(similarity('abc', ''), 0);
  });

  it('result is between 0 and 1 inclusive', () => {
    const pairs = [
      ['kitten', 'sitting'],
      ['hello', 'helo'],
      ['abc', 'abcd'],
      ['a', 'z'],
    ];
    for (const [a, b] of pairs) {
      const s = similarity(a, b);
      assert.ok(s >= 0 && s <= 1, `similarity('${a}','${b}') = ${s} not in [0,1]`);
    }
  });

  it('is symmetric', () => {
    const s1 = similarity('kitten', 'sitting');
    const s2 = similarity('sitting', 'kitten');
    assert.equal(s1, s2);
  });

  it('single edit returns high similarity', () => {
    // 'helo' vs 'hello' — one insertion
    const s = similarity('helo', 'hello');
    assert.ok(s > 0.7, `Expected > 0.7, got ${s}`);
  });
});

// ─── highlight ────────────────────────────────────────────────────────────────

describe('highlight', () => {
  it('wraps matched characters with default tags', () => {
    const result = highlight('hello', [0, 1]);
    assert.equal(result, '<mark>h</mark><mark>e</mark>llo');
  });

  it('uses custom open/close tags', () => {
    const result = highlight('abc', [1], '[', ']');
    assert.equal(result, 'a[b]c');
  });

  it('returns original string when indices is empty', () => {
    assert.equal(highlight('hello', []), 'hello');
  });

  it('highlights all characters when all indices provided', () => {
    const str = 'abc';
    const result = highlight(str, [0, 1, 2], '<b>', '</b>');
    assert.equal(result, '<b>a</b><b>b</b><b>c</b>');
  });

  it('highlighted string contains all original characters', () => {
    const str = 'fuzzy';
    const indices = [0, 2, 4];
    const result = highlight(str, indices, '[', ']');
    // Remove tags and check original chars are preserved in order
    const stripped = result.replace(/\[|\]/g, '');
    assert.equal(stripped, str);
  });

  it('non-matched characters appear unmodified', () => {
    const result = highlight('hello', [0], '<b>', '</b>');
    assert.ok(result.includes('ello'));
    assert.equal(result, '<b>h</b>ello');
  });

  it('works correctly with fuzzyMatch indices', () => {
    const match = fuzzyMatch('js', 'JavaScript');
    assert.ok(match !== null);
    const highlighted = highlight(match.item, match.indices, '[', ']');
    // The characters at matched indices should be wrapped
    assert.ok(highlighted.includes('['));
    assert.ok(highlighted.includes(']'));
  });
});
