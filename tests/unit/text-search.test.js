// ─── Unit Tests: TextSearch ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TextSearch } from '../../app/modules/text-search.js';

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

// ─── add / size ───────────────────────────────────────────────────────────────

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

// ─── search – basic ───────────────────────────────────────────────────────────

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

// ─── scoring: title matches score higher ──────────────────────────────────────

describe('TextSearch – scoring', () => {
  it('title match scores higher than content-only match', () => {
    const ts = new TextSearch();
    ts.add({ id: 'title-match', title: 'javascript tutorial', content: 'other stuff here' });
    ts.add({ id: 'content-match', title: 'unrelated heading', content: 'learn javascript today' });
    const results = ts.search('javascript');
    assert.equal(results.length, 2);
    assert.equal(results[0].id, 'title-match');
  });

  it('tag match scores higher than single content occurrence', () => {
    const ts = new TextSearch();
    ts.add({ id: 'tag-doc', content: 'some text', tags: ['keyword'] });
    ts.add({ id: 'content-doc', content: 'keyword appears here once' });
    const results = ts.search('keyword');
    assert.equal(results.length, 2);
    assert.equal(results[0].id, 'tag-doc');
  });

  it('more occurrences yield higher score', () => {
    const ts = new TextSearch();
    ts.add({ id: 'few', content: 'cat sat on mat' });
    ts.add({ id: 'many', content: 'cat cat cat cat cat' });
    const results = ts.search('cat');
    assert.equal(results[0].id, 'many');
  });

  it('score is a positive integer', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'hello world' });
    const [result] = ts.search('hello');
    assert.ok(result.score > 0);
  });
});

// ─── highlights ───────────────────────────────────────────────────────────────

describe('TextSearch – highlights', () => {
  it('highlights array is non-empty when match is found', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'The quick brown fox jumps over the lazy dog' });
    const [result] = ts.search('fox');
    assert.ok(result.highlights.length > 0);
  });

  it('each highlight snippet contains the matched term', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'I love apples and apples love me' });
    const [result] = ts.search('apples');
    for (const snippet of result.highlights) {
      assert.ok(snippet.toLowerCase().includes('apples'));
    }
  });

  it('returns at most 3 highlights', () => {
    const ts = new TextSearch();
    // 5 occurrences scattered far apart
    const content = Array.from({ length: 5 }, (_, i) =>
      'x'.repeat(100) + 'needle' + 'x'.repeat(100),
    ).join(' ');
    ts.add({ id: '1', content });
    const [result] = ts.search('needle');
    assert.ok(result.highlights.length <= 3);
  });

  it('highlight snippet is shorter than full content for long text', () => {
    const ts = new TextSearch();
    const content = 'a'.repeat(200) + ' keyword ' + 'b'.repeat(200);
    ts.add({ id: '1', content });
    const [result] = ts.search('keyword');
    assert.ok(result.highlights[0].length < content.length);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('TextSearch – remove', () => {
  it('removes document from index', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'hello world' });
    ts.remove('1');
    assert.equal(ts.size, 0);
    assert.equal(ts.search('hello').length, 0);
  });

  it('removing non-existent id is a no-op', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'hello' });
    ts.remove('999');
    assert.equal(ts.size, 1);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('TextSearch – update', () => {
  it('replaces existing document content', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'old content here' });
    ts.update({ id: '1', content: 'brand new content' });
    assert.equal(ts.search('old').length, 0);
    assert.equal(ts.search('brand').length, 1);
  });

  it('size does not increase after update', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'original' });
    ts.update({ id: '1', content: 'updated' });
    assert.equal(ts.size, 1);
  });
});

// ─── wholeWord option ─────────────────────────────────────────────────────────

describe('TextSearch – wholeWord option', () => {
  it('whole-word search does not match substring', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'typescript is typed' });
    const results = ts.search('type', { wholeWord: true });
    assert.equal(results.length, 0);
  });

  it('whole-word search matches standalone word', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'I love cats and cat food' });
    const results = ts.search('cat', { wholeWord: true });
    assert.equal(results.length, 1);
    assert.ok(results[0].score > 0);
  });

  it('without wholeWord, substring matches', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'typescript is great' });
    assert.equal(ts.search('type').length, 1);
  });
});

// ─── caseSensitive option ─────────────────────────────────────────────────────

describe('TextSearch – caseSensitive option', () => {
  it('case-insensitive by default', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'Hello World' });
    assert.equal(ts.search('hello').length, 1);
    assert.equal(ts.search('WORLD').length, 1);
  });

  it('case-sensitive misses when case differs', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'Hello World' });
    assert.equal(ts.search('hello', { caseSensitive: true }).length, 0);
    assert.equal(ts.search('Hello', { caseSensitive: true }).length, 1);
  });

  it('case-sensitive title search', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', title: 'TypeScript Guide', content: 'nothing here' });
    assert.equal(ts.search('typescript', { caseSensitive: true }).length, 0);
    assert.equal(ts.search('TypeScript', { caseSensitive: true }).length, 1);
  });
});

// ─── limit option ─────────────────────────────────────────────────────────────

describe('TextSearch – limit option', () => {
  it('default limit is 20', () => {
    const ts = new TextSearch();
    for (let i = 0; i < 25; i++) {
      ts.add({ id: String(i), content: 'common word appears here' });
    }
    assert.ok(ts.search('common').length <= 20);
  });

  it('respects custom limit', () => {
    const ts = new TextSearch();
    for (let i = 0; i < 10; i++) {
      ts.add({ id: String(i), content: `target document ${i}` });
    }
    const results = ts.search('target', { limit: 3 });
    assert.equal(results.length, 3);
  });
});

// ─── minScore option ──────────────────────────────────────────────────────────

describe('TextSearch – minScore option', () => {
  it('filters out results below minScore', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'word appears once here' });
    ts.add({ id: '2', content: 'word word word word word' });
    // Score for id=1 is 1; score for id=2 is 5
    const results = ts.search('word', { minScore: 3 });
    assert.ok(results.every((r) => r.score >= 3));
    assert.ok(results.some((r) => r.id === '2'));
    assert.ok(!results.some((r) => r.id === '1'));
  });

  it('returns all results when minScore is 0', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'alpha' });
    ts.add({ id: '2', content: 'alpha alpha' });
    assert.equal(ts.search('alpha', { minScore: 0 }).length, 2);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

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

  it('can add documents after clear', () => {
    const ts = new TextSearch();
    ts.add({ id: '1', content: 'first' });
    ts.clear();
    ts.add({ id: '2', content: 'second' });
    assert.equal(ts.size, 1);
    assert.equal(ts.search('second').length, 1);
  });
});
