// ─── Unit Tests: OcrSearchIndex ─────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OcrSearchIndex } from '../../app/modules/ocr-search.js';

describe('OcrSearchIndex', () => {
  let idx;

  beforeEach(() => {
    idx = new OcrSearchIndex();
  });

  // ─── indexPage / getPageText ─────────────────────────────────────────────

  it('indexes a page and retrieves its text', () => {
    idx.indexPage(1, 'Hello World');
    assert.equal(idx.getPageText(1), 'Hello World');
  });

  it('returns empty string for non-indexed page', () => {
    assert.equal(idx.getPageText(99), '');
  });

  it('stores word-level data', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
      { text: 'World', bbox: { x0: 70, y0: 20, x1: 120, y1: 40 } },
    ];
    idx.indexPage(1, 'Hello World', words);
    const entry = idx.pages.get(1);
    assert.equal(entry.words.length, 2);
    assert.equal(entry.words[0].word, 'Hello');
    assert.equal(entry.words[0].w, 50); // x1 - x0
    assert.equal(entry.words[0].h, 20); // y1 - y0
  });

  // ─── search ──────────────────────────────────────────────────────────────

  it('finds text across multiple pages', () => {
    idx.indexPage(1, 'The quick brown fox');
    idx.indexPage(2, 'jumps over the lazy dog');
    idx.indexPage(3, 'the fox ran away');

    const results = idx.search('the');
    assert.equal(results.length, 3); // page 1 "The", page 2 "the", page 3 "the"
  });

  it('returns empty for empty query', () => {
    idx.indexPage(1, 'Hello');
    assert.deepEqual(idx.search(''), []);
  });

  it('case-insensitive search by default', () => {
    idx.indexPage(1, 'JavaScript is GREAT');
    const results = idx.search('great');
    assert.equal(results.length, 1);
    assert.equal(results[0].page, 1);
  });

  it('case-sensitive search when enabled', () => {
    idx.indexPage(1, 'JavaScript is GREAT');
    const sensitive = idx.search('great', { caseSensitive: true });
    assert.equal(sensitive.length, 0);
    const found = idx.search('GREAT', { caseSensitive: true });
    assert.equal(found.length, 1);
  });

  it('whole word search filters partial matches', () => {
    idx.indexPage(1, 'the them there');
    const results = idx.search('the', { wholeWord: true });
    assert.equal(results.length, 1); // only standalone "the"
  });

  it('respects maxResults limit', () => {
    idx.indexPage(1, 'a a a a a a a a a a a a a');
    const results = idx.search('a', { maxResults: 3 });
    assert.equal(results.length, 3);
  });

  it('provides context around matches', () => {
    idx.indexPage(1, 'The quick brown fox jumps over the lazy dog');
    const results = idx.search('fox');
    assert.ok(results[0].context.includes('fox'));
    assert.ok(results[0].context.length < 100);
  });

  // ─── getMatchCoordinates ────────────────────────────────────────────────

  it('returns word coordinates for matching words', () => {
    const words = [
      { text: 'hello', bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
      { text: 'world', bbox: { x0: 70, y0: 20, x1: 120, y1: 40 } },
    ];
    idx.indexPage(1, 'hello world', words);
    const coords = idx.getMatchCoordinates(1, 'hello');
    assert.equal(coords.length, 1);
    assert.equal(coords[0].x, 10);
    assert.equal(coords[0].y, 20);
  });

  it('returns empty coords for non-indexed page', () => {
    assert.deepEqual(idx.getMatchCoordinates(99, 'test'), []);
  });

  // ─── getIndexedPages / getWordCount ─────────────────────────────────────

  it('lists indexed pages sorted', () => {
    idx.indexPage(3, 'c');
    idx.indexPage(1, 'a');
    idx.indexPage(2, 'b');
    assert.deepEqual(idx.getIndexedPages(), [1, 2, 3]);
  });

  it('counts total words', () => {
    idx.indexPage(1, 'a b', [
      { text: 'a', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      { text: 'b', bbox: { x0: 20, y0: 0, x1: 30, y1: 10 } },
    ]);
    idx.indexPage(2, 'c', [
      { text: 'c', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
    ]);
    assert.equal(idx.getWordCount(), 3);
  });

  // ─── removePage / clear ─────────────────────────────────────────────────

  it('removes a page from the index', () => {
    idx.indexPage(1, 'test');
    idx.indexPage(2, 'keep');
    idx.removePage(1);
    assert.equal(idx.getPageText(1), '');
    assert.equal(idx.getPageText(2), 'keep');
  });

  it('clears entire index', () => {
    idx.indexPage(1, 'a');
    idx.indexPage(2, 'b');
    idx.clear();
    assert.equal(idx.pages.size, 0);
  });

  // ─── Search History ────────────────────────────────────────────────────

  it('tracks search history', () => {
    idx.indexPage(1, 'hello world');
    idx.search('hello');
    idx.search('world');
    const history = idx.getHistory();
    assert.equal(history[0], 'world');
    assert.equal(history[1], 'hello');
  });

  it('deduplicates history entries', () => {
    idx.indexPage(1, 'test');
    idx.search('test');
    idx.search('other');
    idx.search('test'); // should move to front, not duplicate
    const history = idx.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0], 'test');
  });

  it('clears history', () => {
    idx.indexPage(1, 'test');
    idx.search('test');
    idx.clearHistory();
    assert.deepEqual(idx.getHistory(), []);
  });

  // ─── export / import ───────────────────────────────────────────────────

  it('exports and re-imports index', () => {
    const words = [
      { text: 'hello', bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
    ];
    idx.indexPage(1, 'hello world', words);
    idx.search('hello'); // add to history

    const exported = idx.export();
    assert.ok(exported.pages['1']);
    assert.equal(exported.history[0], 'hello');

    const idx2 = new OcrSearchIndex();
    idx2.import(exported);
    assert.equal(idx2.getPageText(1), 'hello world');
    assert.equal(idx2.pages.get(1).words.length, 1);
    assert.deepEqual(idx2.getHistory(), ['hello']);
  });
});
