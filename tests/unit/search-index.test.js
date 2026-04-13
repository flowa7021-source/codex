// ─── Unit Tests: search-index ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SearchIndex } from '../../app/modules/search-index.js';

// ─── constructor ─────────────────────────────────────────────────────────────

describe('new SearchIndex()', () => {
  it('creates an instance', () => {
    const idx = new SearchIndex(['title']);
    assert.ok(idx instanceof SearchIndex);
  });

  it('size is 0 on creation', () => {
    const idx = new SearchIndex(['title', 'body']);
    assert.equal(idx.size, 0);
  });
});

// ─── add() ───────────────────────────────────────────────────────────────────

describe('add()', () => {
  it('increases size by 1', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Hello world' });
    assert.equal(idx.size, 1);
  });

  it('increases size for multiple documents', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'First document' });
    idx.add({ id: '2', title: 'Second document' });
    assert.equal(idx.size, 2);
  });

  it('makes the document searchable by its field content', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Quick brown fox' });
    const results = idx.search('fox');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, '1');
  });

  it('indexes multiple fields', () => {
    const idx = new SearchIndex(['title', 'body']);
    idx.add({ id: '1', title: 'Cats', body: 'Dogs are friendly' });
    assert.equal(idx.search('cats').length, 1);
    assert.equal(idx.search('dogs').length, 1);
  });

  it('adding the same id again replaces the document (no size increase)', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Original title' });
    idx.add({ id: '1', title: 'Replaced title' });
    assert.equal(idx.size, 1);
    // Old term no longer searchable.
    assert.equal(idx.search('original').length, 0);
    // New term is searchable.
    assert.equal(idx.search('replaced').length, 1);
  });
});

// ─── search() ────────────────────────────────────────────────────────────────

describe('search()', () => {
  it('returns matching documents', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'JavaScript programming' });
    idx.add({ id: '2', title: 'Python programming' });
    const results = idx.search('javascript');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, '1');
  });

  it('results include id, score, and document', () => {
    const idx = new SearchIndex(['title']);
    const doc = { id: '1', title: 'Hello world' };
    idx.add(doc);
    const results = idx.search('hello');
    assert.equal(results.length, 1);
    assert.ok('id' in results[0]);
    assert.ok('score' in results[0]);
    assert.ok('document' in results[0]);
    assert.equal(results[0].id, '1');
    assert.deepEqual(results[0].document, doc);
  });

  it('results have numeric score > 0', () => {
    const idx = new SearchIndex(['body']);
    idx.add({ id: '1', body: 'searching for something' });
    const results = idx.search('searching');
    assert.ok(typeof results[0].score === 'number');
    assert.ok(results[0].score > 0);
  });

  it('returns empty array when no documents match', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Hello world' });
    const results = idx.search('nomatch');
    assert.deepEqual(results, []);
  });

  it('returns empty array for an empty index', () => {
    const idx = new SearchIndex(['title']);
    assert.deepEqual(idx.search('hello'), []);
  });

  it('multiple matches are sorted by score descending', () => {
    const idx = new SearchIndex(['body']);
    // doc1 mentions 'search' twice, doc2 once.
    idx.add({ id: '1', body: 'search search again' });
    idx.add({ id: '2', body: 'search something' });
    const results = idx.search('search');
    assert.equal(results.length, 2);
    assert.ok(results[0].score >= results[1].score);
    assert.equal(results[0].id, '1');
  });

  it('respects the limit parameter', () => {
    const idx = new SearchIndex(['body']);
    idx.add({ id: '1', body: 'match one' });
    idx.add({ id: '2', body: 'match two' });
    idx.add({ id: '3', body: 'match three' });
    const results = idx.search('match', 2);
    assert.equal(results.length, 2);
  });

  it('multi-word query matches docs containing any term', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Hello world' });
    idx.add({ id: '2', title: 'Goodbye world' });
    idx.add({ id: '3', title: 'Unrelated content' });
    const results = idx.search('hello world');
    // Both doc1 and doc2 contain 'world'; doc1 also matches 'hello'.
    assert.ok(results.length >= 2);
    const ids = results.map((r) => r.id);
    assert.ok(ids.includes('1'));
    assert.ok(ids.includes('2'));
  });

  it('search is case-insensitive', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'TypeScript Module' });
    assert.equal(idx.search('typescript').length, 1);
    assert.equal(idx.search('TYPESCRIPT').length, 1);
  });
});

// ─── update() ────────────────────────────────────────────────────────────────

describe('update()', () => {
  it('replaces an existing document', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Original content' });
    idx.update({ id: '1', title: 'Updated content' });
    assert.equal(idx.size, 1);
  });

  it('old content is no longer searchable after update', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Original content' });
    idx.update({ id: '1', title: 'Completely different' });
    assert.equal(idx.search('original').length, 0);
  });

  it('new content is searchable after update', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Before' });
    idx.update({ id: '1', title: 'After update' });
    assert.equal(idx.search('after').length, 1);
  });

  it('update of non-existent document adds it', () => {
    const idx = new SearchIndex(['title']);
    idx.update({ id: '99', title: 'New document' });
    assert.equal(idx.size, 1);
    assert.equal(idx.search('new').length, 1);
  });
});

// ─── remove() ────────────────────────────────────────────────────────────────

describe('remove()', () => {
  it('decreases size by 1', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Hello' });
    idx.remove('1');
    assert.equal(idx.size, 0);
  });

  it('removed document is no longer searchable', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Removable document' });
    idx.remove('1');
    assert.deepEqual(idx.search('removable'), []);
  });

  it('does not affect other documents', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Keep this' });
    idx.add({ id: '2', title: 'Remove this' });
    idx.remove('2');
    assert.equal(idx.size, 1);
    assert.equal(idx.search('keep').length, 1);
  });

  it('removing a non-existent id is a no-op', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Hello' });
    assert.doesNotThrow(() => idx.remove('nonexistent'));
    assert.equal(idx.size, 1);
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('clear()', () => {
  it('empties the index', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Doc one' });
    idx.add({ id: '2', title: 'Doc two' });
    idx.clear();
    assert.equal(idx.size, 0);
  });

  it('documents are no longer searchable after clear', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Findable' });
    idx.clear();
    assert.deepEqual(idx.search('findable'), []);
  });

  it('allows adding documents after clear', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'Old' });
    idx.clear();
    idx.add({ id: '2', title: 'Fresh start' });
    assert.equal(idx.size, 1);
    assert.equal(idx.search('fresh').length, 1);
  });
});

// ─── size getter ─────────────────────────────────────────────────────────────

describe('size getter', () => {
  it('returns 0 for an empty index', () => {
    const idx = new SearchIndex([]);
    assert.equal(idx.size, 0);
  });

  it('increments as documents are added', () => {
    const idx = new SearchIndex(['title']);
    assert.equal(idx.size, 0);
    idx.add({ id: '1', title: 'One' });
    assert.equal(idx.size, 1);
    idx.add({ id: '2', title: 'Two' });
    assert.equal(idx.size, 2);
    idx.add({ id: '3', title: 'Three' });
    assert.equal(idx.size, 3);
  });

  it('decrements when documents are removed', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'One' });
    idx.add({ id: '2', title: 'Two' });
    idx.remove('1');
    assert.equal(idx.size, 1);
  });

  it('resets to 0 after clear', () => {
    const idx = new SearchIndex(['title']);
    idx.add({ id: '1', title: 'One' });
    idx.add({ id: '2', title: 'Two' });
    idx.clear();
    assert.equal(idx.size, 0);
  });
});
