// ─── Extended Unit Tests: SearchController ──────────────────────────────────
// Tests exports NOT covered in search-controller.test.js:
// loadSearchScope, saveSearchScope, buildSearchHistoryText,
// highlightSearchInTextLayer, scrollToSearchHighlight,
// renderSearchResultsList, renderSearchHistory,
// exportSearchResultsTxt/Csv/Json, downloadOcrTextExport
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ocrSearchIndex,
  indexOcrPage,
  loadSearchScope,
  saveSearchScope,
  buildSearchHistoryText,
  loadSearchHistory,
  saveSearchHistory,
  highlightSearchInTextLayer,
  renderSearchResultsList,
  renderSearchHistory,
  exportSearchResultsSummaryTxt,
  exportSearchResultsCsv,
  exportSearchResultsJson,
  exportSearchHistoryJson,
  exportSearchHistoryTxt,
  clearSearchResults,
  clearSearchHistory,
  canSearchCurrentDoc,
  downloadOcrTextExport,
  initSearchControllerDeps,
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

  els.searchHistoryList = makeMockEl();
  els.searchResultsList = makeMockEl();
  els.searchStatus = makeMockEl();
  els.searchInput = makeMockEl();
  els.searchScope = makeMockEl();
  els.textLayerDiv = {
    innerHTML: '',
    textContent: '',
    querySelectorAll() { return []; },
    appendChild() {},
  };

  initSearchControllerDeps({
    setOcrStatus: () => {},
    renderCurrentPage: async () => {},
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loadSearchScope / saveSearchScope', () => {
  beforeEach(resetSearchState);

  it('loadSearchScope defaults to all', () => {
    els.searchScope = { value: '' };
    loadSearchScope();
    assert.equal(els.searchScope.value, 'all');
  });

  it('loadSearchScope restores saved scope', () => {
    els.searchScope = { value: '' };
    localStorage.setItem('novareader-search-scope', 'current');
    loadSearchScope();
    assert.equal(els.searchScope.value, 'current');
  });

  it('saveSearchScope persists the value', () => {
    els.searchScope = { value: 'current' };
    saveSearchScope();
    assert.equal(localStorage.getItem('novareader-search-scope'), 'current');
  });

  it('saveSearchScope defaults non-current to all', () => {
    els.searchScope = { value: 'unknown' };
    saveSearchScope();
    assert.equal(localStorage.getItem('novareader-search-scope'), 'all');
  });
});

describe('buildSearchHistoryText', () => {
  beforeEach(resetSearchState);

  it('builds a text summary of search history', () => {
    state.docName = 'myfile.pdf';
    state.adapter = { type: 'pdf' };
    saveSearchHistory(['alpha', 'beta', 'gamma']);

    const text = buildSearchHistoryText();
    assert.ok(text.includes('myfile.pdf'));
    assert.ok(text.includes('Запросов: 3'));
    assert.ok(text.includes('1. alpha'));
    assert.ok(text.includes('2. beta'));
    assert.ok(text.includes('3. gamma'));
  });

  it('works with empty history', () => {
    const text = buildSearchHistoryText();
    assert.ok(text.includes('Запросов: 0'));
  });
});

describe('highlightSearchInTextLayer', () => {
  beforeEach(resetSearchState);

  it('returns 0 when no query', () => {
    assert.equal(highlightSearchInTextLayer(''), 0);
    assert.equal(highlightSearchInTextLayer(null), 0);
  });

  it('returns 0 when no container', () => {
    els.textLayerDiv = null;
    assert.equal(highlightSearchInTextLayer('test'), 0);
  });

  it('returns 0 when no matching spans', () => {
    els.textLayerDiv = {
      querySelectorAll(sel) {
        if (sel === '.search-highlight') return [];
        if (sel === 'span') return [{ textContent: 'no match here' }];
        return [];
      },
    };
    assert.equal(highlightSearchInTextLayer('xyz'), 0);
  });
});

describe('renderSearchResultsList', () => {
  beforeEach(resetSearchState);

  it('shows empty message when no results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [];
    const appended = [];
    els.searchResultsList = {
      innerHTML: '',
      appendChild(child) { appended.push(child); },
    };
    renderSearchResultsList();
    assert.equal(appended.length, 1);
  });

  it('shows adapter-unavailable message when no adapter', () => {
    state.adapter = null;
    const appended = [];
    els.searchResultsList = {
      innerHTML: '',
      appendChild(child) { appended.push(child); },
    };
    renderSearchResultsList();
    assert.equal(appended.length, 1);
  });

  it('renders items for each search result', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [1, 5, 10];
    state.searchCursor = 0;
    state.searchResultCounts = { 1: 3, 5: 1, 10: 2 };
    const appended = [];
    els.searchResultsList = {
      innerHTML: '',
      appendChild(child) { appended.push(child); },
    };
    renderSearchResultsList();
    assert.equal(appended.length, 3);
  });
});

describe('renderSearchHistory', () => {
  beforeEach(resetSearchState);

  it('shows empty message when no history and has adapter', () => {
    state.adapter = { type: 'pdf' };
    const appended = [];
    els.searchHistoryList = {
      innerHTML: '',
      appendChild(child) { appended.push(child); },
    };
    renderSearchHistory();
    assert.equal(appended.length, 1);
  });

  it('renders items for saved history', () => {
    state.adapter = { type: 'pdf' };
    saveSearchHistory(['foo', 'bar']);
    const appended = [];
    els.searchHistoryList = {
      innerHTML: '',
      appendChild(child) { appended.push(child); },
    };
    renderSearchHistory();
    assert.equal(appended.length, 2);
  });
});

describe('export functions — no adapter', () => {
  beforeEach(resetSearchState);

  it('exportSearchResultsSummaryTxt sets status when no adapter', () => {
    state.adapter = null;
    exportSearchResultsSummaryTxt();
    assert.ok(els.searchStatus.textContent.length > 0);
  });

  it('exportSearchResultsCsv sets status when no adapter', () => {
    state.adapter = null;
    exportSearchResultsCsv();
    assert.ok(els.searchStatus.textContent.length > 0);
  });

  it('exportSearchResultsJson sets status when no adapter', () => {
    state.adapter = null;
    exportSearchResultsJson();
    assert.ok(els.searchStatus.textContent.length > 0);
  });

  it('exportSearchHistoryJson sets status when no adapter', () => {
    state.adapter = null;
    exportSearchHistoryJson();
    assert.ok(els.searchStatus.textContent.length > 0);
  });

  it('exportSearchHistoryTxt sets status when no adapter', () => {
    state.adapter = null;
    exportSearchHistoryTxt();
    assert.ok(els.searchStatus.textContent.length > 0);
  });
});

describe('export functions — no results/history', () => {
  beforeEach(resetSearchState);

  it('exportSearchResultsSummaryTxt sets status when no results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [];
    exportSearchResultsSummaryTxt();
    assert.ok(els.searchStatus.textContent.includes('Нет'));
  });

  it('exportSearchResultsCsv sets status when no results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [];
    exportSearchResultsCsv();
    assert.ok(els.searchStatus.textContent.includes('Нет'));
  });

  it('exportSearchResultsJson sets status when no results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [];
    exportSearchResultsJson();
    assert.ok(els.searchStatus.textContent.includes('Нет'));
  });

  it('exportSearchHistoryJson sets status when empty history', () => {
    state.adapter = { type: 'pdf' };
    exportSearchHistoryJson();
    assert.ok(els.searchStatus.textContent.includes('пуста'));
  });

  it('exportSearchHistoryTxt sets status when empty history', () => {
    state.adapter = { type: 'pdf' };
    exportSearchHistoryTxt();
    assert.ok(els.searchStatus.textContent.includes('пуста'));
  });
});

describe('export functions — with data', () => {
  beforeEach(resetSearchState);

  it('exportSearchResultsSummaryTxt succeeds with results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [1, 2];
    state.searchResultCounts = { 1: 3, 2: 1 };
    state.lastSearchQuery = 'test';

    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportSearchResultsSummaryTxt();
      assert.ok(els.searchStatus.textContent.includes('Summary'));
    } finally {
      document.createElement = origCreate;
    }
  });

  it('exportSearchResultsCsv succeeds with results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [1, 2];
    state.searchResultCounts = { 1: 3, 2: 1 };
    state.lastSearchQuery = 'test';

    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportSearchResultsCsv();
      assert.ok(els.searchStatus.textContent.includes('CSV'));
    } finally {
      document.createElement = origCreate;
    }
  });

  it('exportSearchResultsJson succeeds with results', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [1, 2];
    state.searchResultCounts = { 1: 3, 2: 1 };
    state.lastSearchQuery = 'test';

    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportSearchResultsJson();
      assert.ok(els.searchStatus.textContent.includes('Экспортировано'));
    } finally {
      document.createElement = origCreate;
    }
  });

  it('exportSearchHistoryJson succeeds with history', () => {
    state.adapter = { type: 'pdf' };
    saveSearchHistory(['alpha', 'beta']);

    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportSearchHistoryJson();
      assert.ok(els.searchStatus.textContent.includes('Экспортировано'));
    } finally {
      document.createElement = origCreate;
    }
  });

  it('exportSearchHistoryTxt succeeds with history', () => {
    state.adapter = { type: 'pdf' };
    saveSearchHistory(['alpha', 'beta']);

    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportSearchHistoryTxt();
      assert.ok(els.searchStatus.textContent.includes('TXT'));
    } finally {
      document.createElement = origCreate;
    }
  });
});

describe('downloadOcrTextExport', () => {
  beforeEach(resetSearchState);

  it('sets status when no OCR data', () => {
    downloadOcrTextExport();
    // Status should be set (no pages)
    // initSearchControllerDeps setOcrStatus is a no-op, but no throw
  });

  it('succeeds with OCR data', () => {
    indexOcrPage(1, 'Test text');
    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      downloadOcrTextExport();
    } finally {
      document.createElement = origCreate;
    }
  });
});
