// ─── Unit Tests: SearchController ────────────────────────────────────────────
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
  searchScopeKey,
  searchHistoryKey,
  loadSearchHistory,
  saveSearchHistory,
  rememberSearchQuery,
  clearSearchResults,
  clearSearchHistory,
  canSearchCurrentDoc,
} from '../../app/modules/search-controller.js';
import { state, els } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockEl() {
  return {
    innerHTML: '',
    textContent: '',
    value: 'all',
    appendChild() {},
    querySelectorAll() { return []; },
  };
}

function resetSearchState() {
  ocrSearchIndex.pages.clear();
  ocrSearchIndex.version = 0;
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};
  state.lastSearchQuery = '';
  state.lastSearchScope = 'all';
  state.docName = 'test.pdf';
  state.adapter = null;
  state.pageCount = 10;
  localStorage.clear();

  // Provide mock DOM elements that search-controller touches
  els.searchHistoryList = makeMockEl();
  els.searchResultsList = makeMockEl();
  els.searchStatus = makeMockEl();
  els.searchInput = makeMockEl();
  els.searchScope = makeMockEl();
  els.textLayerDiv = makeMockEl();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildOcrSearchEntry', () => {
  it('returns null for empty text', () => {
    assert.equal(buildOcrSearchEntry(1, ''), null);
    assert.equal(buildOcrSearchEntry(1, null), null);
    assert.equal(buildOcrSearchEntry(1, undefined), null);
  });

  it('builds word index from text', () => {
    const entry = buildOcrSearchEntry(1, 'Hello World');
    assert.equal(entry.pageNum, 1);
    assert.equal(entry.text, 'Hello World');
    assert.equal(entry.words.length, 2);
    assert.equal(entry.words[0].word, 'hello');
    assert.equal(entry.words[0].original, 'Hello');
    assert.equal(entry.words[1].word, 'world');
    assert.equal(entry.words[1].original, 'World');
  });

  it('records line numbers', () => {
    const entry = buildOcrSearchEntry(1, 'line one\nline two');
    assert.ok(entry.words.length >= 4);
    assert.equal(entry.words[0].line, 1);
    // Words from the second line
    const line2words = entry.words.filter(w => w.line === 2);
    assert.ok(line2words.length >= 2);
  });

  it('tracks character offsets', () => {
    const entry = buildOcrSearchEntry(1, 'abc def');
    assert.equal(entry.words[0].offset, 0);
    assert.equal(entry.words[0].length, 3);
    assert.equal(entry.words[1].offset, 4);
    assert.equal(entry.words[1].length, 3);
  });
});

describe('indexOcrPage / searchOcrIndex', () => {
  beforeEach(resetSearchState);

  it('indexes and searches a single page', () => {
    indexOcrPage(1, 'The quick brown fox');
    assert.equal(ocrSearchIndex.pages.size, 1);
    assert.ok(ocrSearchIndex.version > 0);

    const results = searchOcrIndex('quick');
    assert.equal(results.length, 1);
    assert.equal(results[0].page, 1);
    assert.equal(results[0].matchCount, 1);
  });

  it('searches across multiple pages', () => {
    indexOcrPage(1, 'Alpha beta gamma');
    indexOcrPage(2, 'Delta beta epsilon');
    indexOcrPage(3, 'Zeta theta');

    const results = searchOcrIndex('beta');
    assert.equal(results.length, 2);
    assert.equal(results[0].page, 1);
    assert.equal(results[1].page, 2);
  });

  it('returns empty for no match', () => {
    indexOcrPage(1, 'Hello World');
    const results = searchOcrIndex('xyz');
    assert.equal(results.length, 0);
  });

  it('handles empty query', () => {
    indexOcrPage(1, 'Hello World');
    assert.deepEqual(searchOcrIndex(''), []);
    assert.deepEqual(searchOcrIndex('   '), []);
    assert.deepEqual(searchOcrIndex(null), []);
  });

  it('search is case-insensitive', () => {
    indexOcrPage(1, 'Hello World');
    const results = searchOcrIndex('HELLO');
    assert.equal(results.length, 1);
    assert.equal(results[0].matchCount, 1);
  });

  it('partial word match works', () => {
    indexOcrPage(1, 'programming language');
    const results = searchOcrIndex('gram');
    assert.equal(results.length, 1);
  });

  it('results are sorted by page number', () => {
    indexOcrPage(5, 'test data');
    indexOcrPage(2, 'test data');
    indexOcrPage(8, 'test data');
    const results = searchOcrIndex('test');
    assert.deepEqual(results.map(r => r.page), [2, 5, 8]);
  });
});

describe('exportOcrTextWithCoordinates', () => {
  beforeEach(resetSearchState);

  it('exports indexed pages', () => {
    indexOcrPage(1, 'Page one text');
    indexOcrPage(2, 'Page two text');
    const output = exportOcrTextWithCoordinates();
    assert.equal(output.app, 'NovaReader');
    assert.equal(output.pages.length, 2);
    assert.equal(output.pages[0].page, 1);
    assert.equal(output.pages[0].text, 'Page one text');
    assert.ok(output.pages[0].wordCount > 0);
  });

  it('returns empty pages array when nothing indexed', () => {
    const output = exportOcrTextWithCoordinates();
    assert.equal(output.pages.length, 0);
  });
});

describe('parseCsvLine', () => {
  it('parses simple CSV', () => {
    assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    assert.deepEqual(parseCsvLine('"hello","world"'), ['hello', 'world']);
  });

  it('handles escaped quotes', () => {
    assert.deepEqual(parseCsvLine('"say ""hi""",other'), ['say "hi"', 'other']);
  });

  it('handles commas inside quotes', () => {
    assert.deepEqual(parseCsvLine('"a,b",c'), ['a,b', 'c']);
  });

  it('trims whitespace from cells', () => {
    assert.deepEqual(parseCsvLine('  a , b , c '), ['a', 'b', 'c']);
  });

  it('handles empty input', () => {
    assert.deepEqual(parseCsvLine(''), ['']);
  });
});

describe('searchScopeKey / searchHistoryKey', () => {
  it('returns fixed scope key', () => {
    assert.equal(searchScopeKey(), 'novareader-search-scope');
  });

  it('includes docName in history key', () => {
    state.docName = 'myfile.pdf';
    assert.equal(searchHistoryKey(), 'novareader-search-history:myfile.pdf');
  });

  it('uses global when no docName', () => {
    state.docName = null;
    assert.equal(searchHistoryKey(), 'novareader-search-history:global');
  });
});

describe('search history persistence', () => {
  beforeEach(() => {
    resetSearchState();
    state.docName = 'test.pdf';
  });

  it('loadSearchHistory returns empty array by default', () => {
    const history = loadSearchHistory();
    assert.deepEqual(history, []);
  });

  it('saveSearchHistory / loadSearchHistory round-trip', () => {
    saveSearchHistory(['foo', 'bar']);
    const history = loadSearchHistory();
    assert.deepEqual(history, ['foo', 'bar']);
  });

  it('rememberSearchQuery deduplicates and caps at 10', () => {
    // Need adapter for canSearchCurrentDoc
    state.adapter = { type: 'pdf' };
    for (let i = 0; i < 15; i++) {
      rememberSearchQuery(`query-${i}`);
    }
    const history = loadSearchHistory();
    assert.equal(history.length, 10);
    // Most recent should be first
    assert.equal(history[0], 'query-14');
  });

  it('rememberSearchQuery moves existing to front', () => {
    state.adapter = { type: 'pdf' };
    rememberSearchQuery('first');
    rememberSearchQuery('second');
    rememberSearchQuery('first');
    const history = loadSearchHistory();
    assert.equal(history[0], 'first');
    assert.equal(history[1], 'second');
    assert.equal(history.length, 2);
  });

  it('rememberSearchQuery skips empty', () => {
    state.adapter = { type: 'pdf' };
    rememberSearchQuery('');
    rememberSearchQuery('   ');
    assert.deepEqual(loadSearchHistory(), []);
  });

  it('clearSearchHistory empties storage', () => {
    saveSearchHistory(['a', 'b']);
    clearSearchHistory();
    assert.deepEqual(loadSearchHistory(), []);
  });
});

describe('canSearchCurrentDoc', () => {
  it('returns false without adapter', () => {
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

  it('returns false for unsupported adapter type', () => {
    state.adapter = { type: 'epub' };
    assert.equal(canSearchCurrentDoc(), false);
  });
});

describe('clearSearchResults', () => {
  beforeEach(resetSearchState);

  it('resets all search state', () => {
    state.searchResults = [1, 2, 3];
    state.searchCursor = 1;
    state.searchResultCounts = { 1: 5, 2: 3 };
    state.lastSearchQuery = 'test';
    state.lastSearchScope = 'current';

    clearSearchResults();

    assert.deepEqual(state.searchResults, []);
    assert.equal(state.searchCursor, -1);
    assert.deepEqual(state.searchResultCounts, {});
    assert.equal(state.lastSearchQuery, '');
    assert.equal(state.lastSearchScope, 'all');
  });
});

describe('buildSearchResultsSummaryText', () => {
  beforeEach(resetSearchState);

  it('builds formatted summary', () => {
    state.docName = 'sample.pdf';
    state.lastSearchQuery = 'hello';
    state.lastSearchScope = 'all';
    state.searchResults = [1, 5];
    state.searchResultCounts = { 1: 3, 5: 1 };

    const text = buildSearchResultsSummaryText();
    assert.ok(text.includes('sample.pdf'));
    assert.ok(text.includes('hello'));
    assert.ok(text.includes('Страница 1'));
    assert.ok(text.includes('Страница 5'));
    assert.ok(text.includes('Результатов: 2'));
  });
});
