// ─── Pure Function Tests: Search Controller ─────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOcrSearchEntry,
  indexOcrPage,
  searchOcrIndex,
  ocrSearchIndex,
  parseCsvLine,
  searchScopeKey,
  searchHistoryKey,
  canSearchCurrentDoc,
  buildSearchResultsSummaryText,
  clearSearchResults,
  loadSearchHistory,
  saveSearchHistory,
  rememberSearchQuery,
  buildSearchHistoryText,
  clearSearchHistory,
  exportOcrTextWithCoordinates,
} from '../../app/modules/search-controller.js';

import { state, els as _els } from '../../app/modules/state.js';

const els = _els;

beforeEach(() => {
  // Mock DOM elements needed by search controller
  els.searchStatus = { textContent: '' };
  els.searchResultsList = { innerHTML: '', appendChild() {} };
  els.searchHistory = { innerHTML: '', appendChild() {} };
  els.searchHistoryList = { innerHTML: '', appendChild() {} };
  els.searchScope = { value: 'all' };
  els.searchInput = { value: '' };
  state.adapter = { type: 'pdf' };
  ocrSearchIndex.pages.clear();
  ocrSearchIndex.version = 0;
  state.searchResults = [];
  state.searchResultCounts = {};
  state.lastSearchQuery = '';
  state.lastSearchScope = 'all';
  state.docName = 'test.pdf';
  localStorage.clear();
});

// ─── buildOcrSearchEntry ────────────────────────────────────────────────────

describe('buildOcrSearchEntry', () => {
  it('returns null for empty text', () => {
    assert.equal(buildOcrSearchEntry(1, ''), null);
    assert.equal(buildOcrSearchEntry(1, null), null);
  });

  it('builds entry with words array', () => {
    const entry = buildOcrSearchEntry(1, 'Hello World');
    assert.ok(entry);
    assert.equal(entry.pageNum, 1);
    assert.equal(entry.text, 'Hello World');
    assert.equal(entry.words.length, 2);
    assert.equal(entry.words[0].word, 'hello');
    assert.equal(entry.words[0].original, 'Hello');
    assert.equal(entry.words[1].word, 'world');
  });

  it('tracks line numbers', () => {
    const entry = buildOcrSearchEntry(1, 'Line one\nLine two');
    assert.ok(entry);
    const lineOne = entry.words.filter(w => w.line === 1);
    const lineTwo = entry.words.filter(w => w.line === 2);
    assert.ok(lineOne.length > 0);
    assert.ok(lineTwo.length > 0);
  });
});

// ─── indexOcrPage / searchOcrIndex ──────────────────────────────────────────

describe('indexOcrPage + searchOcrIndex', () => {
  it('indexes a page and searches it', () => {
    indexOcrPage(1, 'The quick brown fox');
    indexOcrPage(2, 'jumps over the lazy dog');
    assert.equal(ocrSearchIndex.pages.size, 2);
    assert.equal(ocrSearchIndex.version, 2);

    const results = searchOcrIndex('fox');
    assert.equal(results.length, 1);
    assert.equal(results[0].page, 1);
    assert.equal(results[0].matchCount, 1);
  });

  it('returns empty for no matches', () => {
    indexOcrPage(1, 'hello world');
    const results = searchOcrIndex('xyz');
    assert.equal(results.length, 0);
  });

  it('returns empty for empty query', () => {
    indexOcrPage(1, 'hello world');
    assert.deepEqual(searchOcrIndex(''), []);
    assert.deepEqual(searchOcrIndex(null), []);
  });

  it('searches across multiple pages', () => {
    indexOcrPage(1, 'the cat sat');
    indexOcrPage(2, 'the dog ran');
    indexOcrPage(3, 'the bird flew');
    const results = searchOcrIndex('the');
    assert.equal(results.length, 3);
  });

  it('sorts results by page number', () => {
    indexOcrPage(3, 'hello');
    indexOcrPage(1, 'hello');
    indexOcrPage(2, 'hello');
    const results = searchOcrIndex('hello');
    assert.deepEqual(results.map(r => r.page), [1, 2, 3]);
  });
});

// ─── parseCsvLine ───────────────────────────────────────────────────────────

describe('parseCsvLine', () => {
  it('parses simple CSV', () => {
    assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    assert.deepEqual(parseCsvLine('"hello","world"'), ['hello', 'world']);
  });

  it('handles commas inside quotes', () => {
    assert.deepEqual(parseCsvLine('"a,b",c'), ['a,b', 'c']);
  });

  it('handles escaped quotes (double quotes)', () => {
    assert.deepEqual(parseCsvLine('"he said ""hi""",ok'), ['he said "hi"', 'ok']);
  });

  it('trims whitespace', () => {
    assert.deepEqual(parseCsvLine(' a , b , c '), ['a', 'b', 'c']);
  });

  it('handles empty fields', () => {
    assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c']);
  });
});

// ─── Key helpers ────────────────────────────────────────────────────────────

describe('searchScopeKey', () => {
  it('returns expected key', () => {
    assert.equal(searchScopeKey(), 'novareader-search-scope');
  });
});

describe('searchHistoryKey', () => {
  it('returns key based on docName', () => {
    state.docName = 'myfile.pdf';
    assert.equal(searchHistoryKey(), 'novareader-search-history:myfile.pdf');
  });

  it('uses global when no docName', () => {
    state.docName = null;
    assert.equal(searchHistoryKey(), 'novareader-search-history:global');
  });
});

// ─── canSearchCurrentDoc ────────────────────────────────────────────────────

describe('canSearchCurrentDoc', () => {
  it('returns false when no adapter', () => {
    state.adapter = null;
    assert.equal(canSearchCurrentDoc(), false);
  });

  it('returns true for pdf adapter', () => {
    state.adapter = { type: 'pdf' };
    assert.equal(canSearchCurrentDoc(), true);
  });

  it('returns true for djvu adapter', () => {
    state.adapter = { type: 'djvu' };
    assert.equal(canSearchCurrentDoc(), true);
  });

  it('returns false for unknown adapter type', () => {
    state.adapter = { type: 'unknown' };
    assert.equal(canSearchCurrentDoc(), false);
  });
});

// ─── buildSearchResultsSummaryText ──────────────────────────────────────────

describe('buildSearchResultsSummaryText', () => {
  it('builds summary text from results', () => {
    state.searchResults = [1, 3, 5];
    state.searchResultCounts = { 1: 2, 3: 1, 5: 4 };
    state.lastSearchQuery = 'test';
    state.docName = 'doc.pdf';
    const text = buildSearchResultsSummaryText();
    assert.ok(text.includes('doc.pdf'));
    assert.ok(text.includes('test'));
    assert.ok(text.includes('3'));
  });

  it('handles empty results', () => {
    state.searchResults = [];
    const text = buildSearchResultsSummaryText();
    assert.ok(text.includes('0'));
  });
});

// ─── clearSearchResults ─────────────────────────────────────────────────────

describe('clearSearchResults', () => {
  it('clears search results arrays', () => {
    state.searchResults = [1, 2, 3];
    state.searchResultCounts = { 1: 5 };
    clearSearchResults();
    assert.deepEqual(state.searchResults, []);
  });
});

// ─── Search History ─────────────────────────────────────────────────────────

describe('loadSearchHistory', () => {
  it('returns empty array when nothing stored', () => {
    const history = loadSearchHistory();
    assert.deepEqual(history, []);
  });

  it('loads stored history', () => {
    const key = searchHistoryKey();
    localStorage.setItem(key, JSON.stringify(['query1', 'query2']));
    const history = loadSearchHistory();
    assert.deepEqual(history, ['query1', 'query2']);
  });
});

describe('saveSearchHistory', () => {
  it('saves history to localStorage', () => {
    saveSearchHistory(['a', 'b']);
    const stored = JSON.parse(localStorage.getItem(searchHistoryKey()));
    assert.deepEqual(stored, ['a', 'b']);
  });
});

describe('rememberSearchQuery', () => {
  it('adds query to front of history', () => {
    rememberSearchQuery('test1');
    rememberSearchQuery('test2');
    const history = loadSearchHistory();
    assert.equal(history[0], 'test2');
  });

  it('deduplicates queries', () => {
    rememberSearchQuery('test');
    rememberSearchQuery('other');
    rememberSearchQuery('test');
    const history = loadSearchHistory();
    const testCount = history.filter(h => h === 'test').length;
    assert.equal(testCount, 1);
  });
});

describe('buildSearchHistoryText', () => {
  it('builds text from search history', () => {
    rememberSearchQuery('query1');
    rememberSearchQuery('query2');
    const text = buildSearchHistoryText();
    assert.ok(text.includes('query1'));
    assert.ok(text.includes('query2'));
  });
});

describe('clearSearchHistory', () => {
  it('clears search history', () => {
    rememberSearchQuery('test');
    clearSearchHistory();
    const history = loadSearchHistory();
    assert.deepEqual(history, []);
  });
});

// ─── exportOcrTextWithCoordinates ───────────────────────────────────────────

describe('exportOcrTextWithCoordinates', () => {
  it('returns object with pages', () => {
    indexOcrPage(1, 'hello world');
    const result = exportOcrTextWithCoordinates();
    assert.equal(result.app, 'NovaReader');
    assert.ok(Array.isArray(result.pages));
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].page, 1);
  });

  it('returns empty pages when nothing indexed', () => {
    const result = exportOcrTextWithCoordinates();
    assert.equal(result.pages.length, 0);
  });
});
