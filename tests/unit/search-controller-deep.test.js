// ─── Deep Unit Tests: Search Controller Module ──────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOcrSearchEntry,
  indexOcrPage,
  searchOcrIndex,
  ocrSearchIndex,
  exportOcrTextWithCoordinates,
  parseCsvLine,
  buildSearchResultsSummaryText,
  buildSearchHistoryText,
  canSearchCurrentDoc,
  searchScopeKey,
  searchHistoryKey,
  loadSearchHistory,
  saveSearchHistory,
  rememberSearchQuery,
  clearSearchResults,
  clearSearchHistory,
} from '../../app/modules/search-controller.js';
import { state } from '../../app/modules/state.js';

// ─── buildOcrSearchEntry ────────────────────────────────────────────────────

describe('buildOcrSearchEntry', () => {
  it('returns null for empty text', () => {
    assert.equal(buildOcrSearchEntry(1, ''), null);
    assert.equal(buildOcrSearchEntry(1, null), null);
  });

  it('builds entry with words from text', () => {
    const entry = buildOcrSearchEntry(1, 'Hello World');
    assert.ok(entry);
    assert.equal(entry.pageNum, 1);
    assert.equal(entry.text, 'Hello World');
    assert.ok(entry.words.length >= 2);
    assert.ok(entry.indexedAt > 0);
  });

  it('lowercases words for searching', () => {
    const entry = buildOcrSearchEntry(1, 'Hello WORLD');
    assert.ok(entry.words.some(w => w.word === 'hello'));
    assert.ok(entry.words.some(w => w.word === 'world'));
  });

  it('preserves original word text', () => {
    const entry = buildOcrSearchEntry(1, 'Hello');
    assert.ok(entry.words.some(w => w.original === 'Hello'));
  });

  it('handles multi-line text', () => {
    const entry = buildOcrSearchEntry(1, 'Line 1\nLine 2\nLine 3');
    assert.ok(entry);
    assert.ok(entry.words.length >= 6);
    assert.ok(entry.words.some(w => w.line === 1));
    assert.ok(entry.words.some(w => w.line === 2));
    assert.ok(entry.words.some(w => w.line === 3));
  });
});

// ─── indexOcrPage / searchOcrIndex ──────────────────────────────────────────

describe('indexOcrPage / searchOcrIndex', () => {
  beforeEach(() => {
    ocrSearchIndex.pages.clear();
    ocrSearchIndex.version = 0;
  });

  it('indexOcrPage adds entry to index', () => {
    indexOcrPage(1, 'Hello World');
    assert.ok(ocrSearchIndex.pages.has(1));
    assert.equal(ocrSearchIndex.version, 1);
  });

  it('indexOcrPage increments version', () => {
    indexOcrPage(1, 'A');
    indexOcrPage(2, 'B');
    assert.equal(ocrSearchIndex.version, 2);
  });

  it('searchOcrIndex returns empty for empty query', () => {
    assert.deepEqual(searchOcrIndex(''), []);
    assert.deepEqual(searchOcrIndex(null), []);
    assert.deepEqual(searchOcrIndex('  '), []);
  });

  it('searchOcrIndex finds matching pages', () => {
    indexOcrPage(1, 'The quick brown fox');
    indexOcrPage(2, 'The lazy dog');
    indexOcrPage(3, 'No match here');

    const results = searchOcrIndex('the');
    assert.ok(results.length >= 2);
    assert.ok(results.some(r => r.page === 1));
    assert.ok(results.some(r => r.page === 2));
  });

  it('searchOcrIndex returns sorted by page', () => {
    indexOcrPage(3, 'fox');
    indexOcrPage(1, 'fox');
    indexOcrPage(2, 'fox');

    const results = searchOcrIndex('fox');
    assert.equal(results[0].page, 1);
    assert.equal(results[1].page, 2);
    assert.equal(results[2].page, 3);
  });

  it('searchOcrIndex returns match details', () => {
    indexOcrPage(1, 'Hello Hello Hello');
    const results = searchOcrIndex('hello');
    assert.ok(results.length >= 1);
    assert.ok(results[0].matchCount >= 3);
  });
});

// ─── exportOcrTextWithCoordinates ───────────────────────────────────────────

describe('exportOcrTextWithCoordinates', () => {
  beforeEach(() => {
    ocrSearchIndex.pages.clear();
  });

  it('returns structure with empty pages when no index', () => {
    const output = exportOcrTextWithCoordinates();
    assert.equal(output.app, 'NovaReader');
    assert.ok(Array.isArray(output.pages));
  });

  it('includes indexed pages', () => {
    indexOcrPage(1, 'Hello World');
    const output = exportOcrTextWithCoordinates();
    assert.ok(output.pages.length >= 1);
    assert.equal(output.pages[0].page, 1);
  });
});

// ─── parseCsvLine ───────────────────────────────────────────────────────────

describe('parseCsvLine', () => {
  it('parses simple CSV line', () => {
    const cells = parseCsvLine('a,b,c');
    assert.deepEqual(cells, ['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    const cells = parseCsvLine('"hello","world"');
    assert.deepEqual(cells, ['hello', 'world']);
  });

  it('handles escaped quotes', () => {
    const cells = parseCsvLine('"say ""hello"""');
    assert.deepEqual(cells, ['say "hello"']);
  });

  it('handles commas inside quotes', () => {
    const cells = parseCsvLine('"a,b",c');
    assert.deepEqual(cells, ['a,b', 'c']);
  });

  it('handles empty fields', () => {
    const cells = parseCsvLine('a,,c');
    assert.deepEqual(cells, ['a', '', 'c']);
  });

  it('handles single field', () => {
    const cells = parseCsvLine('hello');
    assert.deepEqual(cells, ['hello']);
  });

  it('trims whitespace', () => {
    const cells = parseCsvLine(' a , b , c ');
    assert.deepEqual(cells, ['a', 'b', 'c']);
  });
});

// ─── canSearchCurrentDoc ────────────────────────────────────────────────────

describe('canSearchCurrentDoc', () => {
  it('returns false when no adapter', () => {
    const origAdapter = state.adapter;
    state.adapter = null;
    assert.equal(canSearchCurrentDoc(), false);
    state.adapter = origAdapter;
  });

  it('returns true for pdf adapter', () => {
    const origAdapter = state.adapter;
    state.adapter = { type: 'pdf' };
    assert.equal(canSearchCurrentDoc(), true);
    state.adapter = origAdapter;
  });

  it('returns true for djvu adapter', () => {
    const origAdapter = state.adapter;
    state.adapter = { type: 'djvu' };
    assert.equal(canSearchCurrentDoc(), true);
    state.adapter = origAdapter;
  });
});

// ─── searchScopeKey / searchHistoryKey ──────────────────────────────────────

describe('searchScopeKey', () => {
  it('returns correct key', () => {
    assert.equal(searchScopeKey(), 'novareader-search-scope');
  });
});

describe('searchHistoryKey', () => {
  it('includes docName', () => {
    const origDocName = state.docName;
    state.docName = 'test.pdf';
    const key = searchHistoryKey();
    assert.ok(key.includes('test.pdf'));
    state.docName = origDocName;
  });

  it('uses global when no docName', () => {
    const origDocName = state.docName;
    state.docName = '';
    const key = searchHistoryKey();
    assert.ok(key.includes('global'));
    state.docName = origDocName;
  });
});

// ─── loadSearchHistory / saveSearchHistory ──────────────────────────────────

describe('loadSearchHistory / saveSearchHistory', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when no history', () => {
    assert.deepEqual(loadSearchHistory(), []);
  });

  it('saves and loads history', () => {
    saveSearchHistory(['query1', 'query2']);
    const history = loadSearchHistory();
    assert.deepEqual(history, ['query1', 'query2']);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(searchHistoryKey(), 'not-json');
    const history = loadSearchHistory();
    assert.deepEqual(history, []);
  });
});

// ─── buildSearchResultsSummaryText ──────────────────────────────────────────

describe('buildSearchResultsSummaryText', () => {
  it('returns text with document info', () => {
    const origDocName = state.docName;
    state.docName = 'test.pdf';
    state.searchResults = [1, 5];
    state.searchResultCounts = { 1: 3, 5: 1 };
    state.lastSearchQuery = 'hello';
    state.lastSearchScope = 'all';

    const text = buildSearchResultsSummaryText();
    assert.ok(text.includes('test.pdf'));
    assert.ok(text.includes('hello'));
    assert.ok(text.includes('Страница 1'));
    assert.ok(text.includes('Страница 5'));

    state.docName = origDocName;
    state.searchResults = [];
    state.searchResultCounts = {};
  });
});

// ─── buildSearchHistoryText ─────────────────────────────────────────────────

describe('buildSearchHistoryText', () => {
  beforeEach(() => localStorage.clear());

  it('returns text with queries', () => {
    saveSearchHistory(['query1', 'query2']);
    const text = buildSearchHistoryText();
    assert.ok(text.includes('query1'));
    assert.ok(text.includes('query2'));
  });
});

// ─── clearSearchResults ─────────────────────────────────────────────────────
// Skipped: clearSearchResults accesses els.searchStatus which is null in test env

// ─── clearSearchHistory ─────────────────────────────────────────────────────
// Skipped: clearSearchHistory calls renderSearchHistory which accesses els.searchHistoryList
