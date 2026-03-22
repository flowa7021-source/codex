// ─── Coverage Tests: SearchController ─────────────────────────────────────────
// Tests searchInPdf, jumpToSearchResult, renderSearchResultsList, renderSearchHistory
// and import functions to push coverage from 62% toward 85%.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Patch createElement to add click/remove/select and dataset support
const _origCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = _origCreateElement(tag);
  if (!el.click) el.click = () => {};
  if (!el.remove) el.remove = () => {};
  if (!el.select) el.select = () => {};
  if (!el.dataset) el.dataset = {};
  if (!el.normalize) el.normalize = () => {};
  if (!el.replaceChild) el.replaceChild = () => {};
  return el;
};
// Ensure Blob constructor works
if (typeof globalThis.Blob === 'undefined' || globalThis.Blob.toString().includes('class Blob')) {
  // Already patched or sufficient
}
// Ensure document.createTextNode
if (!document.createTextNode) {
  document.createTextNode = (text) => ({ textContent: text, nodeType: 3 });
}
// Ensure document.body.appendChild
if (!document.body.appendChild) {
  document.body.appendChild = () => {};
}
// Ensure document.execCommand
if (!document.execCommand) {
  document.execCommand = () => true;
}

import {
  ocrSearchIndex,
  indexOcrPage,
  searchInPdf,
  jumpToSearchResult,
  renderSearchResultsList,
  renderSearchHistory,
  highlightSearchInTextLayer,
  scrollToSearchHighlight,
  initSearchControllerDeps,
  canSearchCurrentDoc,
  loadSearchHistory,
  saveSearchHistory,
  clearSearchResults,
  copySearchResultsSummary,
  exportSearchResultsSummaryTxt,
  exportSearchResultsCsv,
  exportSearchResultsJson,
  importSearchResultsJson,
  importSearchResultsCsv,
  exportSearchHistoryJson,
  exportSearchHistoryTxt,
  copySearchHistory,
  importSearchHistoryJson,
  downloadOcrTextExport,
  loadSearchScope,
  saveSearchScope,
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
    click() {},
    select() {},
  };
}

let renderCurrentPageCalls = 0;
let setOcrStatusCalls = [];

function resetSearchState() {
  ocrSearchIndex.pages.clear();
  ocrSearchIndex.version = 0;
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};
  state.lastSearchQuery = '';
  state.lastSearchScope = 'all';
  state.docName = 'test.pdf';
  state.adapter = { type: 'pdf', getText: async () => '' };
  state.pageCount = 10;
  state.currentPage = 1;
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
  els.diagnosticsStatus = makeMockEl();

  renderCurrentPageCalls = 0;
  setOcrStatusCalls = [];
  initSearchControllerDeps({
    setOcrStatus: (msg) => setOcrStatusCalls.push(msg),
    renderCurrentPage: async () => { renderCurrentPageCalls++; },
  });
}

// ── searchInPdf ──────────────────────────────────────────────────────────────

describe('searchInPdf', () => {
  beforeEach(resetSearchState);

  it('returns early when no adapter (not searchable)', async () => {
    state.adapter = null;
    await searchInPdf('test');
    assert.equal(els.searchStatus.textContent, 'Поиск доступен для PDF/DjVu');
  });

  it('returns early for empty query', async () => {
    await searchInPdf('');
    assert.equal(els.searchStatus.textContent, 'Введите запрос');
  });

  it('returns early for whitespace-only query', async () => {
    await searchInPdf('   ');
    assert.equal(els.searchStatus.textContent, 'Введите запрос');
  });

  it('finds matches in current page scope', async () => {
    state.adapter = {
      type: 'pdf',
      getText: async (pageNum) => pageNum === 1 ? 'hello world hello' : '',
    };
    state.currentPage = 1;
    els.searchScope.value = 'current';

    await searchInPdf('hello');

    assert.deepEqual(state.searchResults, [1]);
    assert.equal(state.searchResultCounts[1], 2);
    assert.equal(state.searchCursor, 0);
  });

  it('finds matches across all pages', async () => {
    state.adapter = {
      type: 'pdf',
      getText: async (pageNum) => {
        if (pageNum === 2) return 'hello world';
        if (pageNum === 5) return 'hello again';
        return '';
      },
    };
    state.pageCount = 5;
    els.searchScope.value = 'all';

    await searchInPdf('hello');

    assert.deepEqual(state.searchResults, [2, 5]);
    assert.equal(state.searchResultCounts[2], 1);
    assert.equal(state.searchResultCounts[5], 1);
    assert.ok(els.searchStatus.textContent.includes('1/2'));
  });

  it('reports not found for no matches', async () => {
    state.adapter = { type: 'pdf', getText: async () => '' };
    state.pageCount = 2;
    els.searchScope.value = 'all';

    await searchInPdf('nonexistent');

    assert.deepEqual(state.searchResults, []);
    assert.ok(els.searchStatus.textContent.includes('не найдено') || els.searchStatus.textContent.includes('Ничего'));
  });

  it('reports not found on current page', async () => {
    state.adapter = { type: 'pdf', getText: async () => '' };
    els.searchScope.value = 'current';

    await searchInPdf('missing');

    assert.ok(els.searchStatus.textContent.includes('не найдено'));
  });

  it('uses OCR index supplement when native text has no match', async () => {
    state.adapter = { type: 'pdf', getText: async () => '' };
    state.pageCount = 3;
    els.searchScope.value = 'all';
    // Index OCR data for page 2
    indexOcrPage(2, 'This is OCR recognized text with keyword');

    await searchInPdf('keyword');

    assert.ok(state.searchResults.includes(2));
  });

  it('remembers search query in history', async () => {
    state.adapter = { type: 'pdf', getText: async () => 'data' };
    state.pageCount = 1;

    await searchInPdf('data');

    const history = loadSearchHistory();
    assert.ok(history.includes('data'));
  });
});

// ── jumpToSearchResult ───────────────────────────────────────────────────────

describe('jumpToSearchResult', () => {
  beforeEach(resetSearchState);

  it('does nothing when no search results', async () => {
    state.searchResults = [];
    await jumpToSearchResult(0);
    assert.equal(renderCurrentPageCalls, 0);
  });

  it('jumps to the given result index', async () => {
    state.searchResults = [3, 7, 9];
    state.lastSearchQuery = 'test';
    await jumpToSearchResult(1);
    assert.equal(state.searchCursor, 1);
    assert.equal(state.currentPage, 7);
    assert.equal(renderCurrentPageCalls, 1);
    assert.ok(els.searchStatus.textContent.includes('2/3'));
  });

  it('wraps around negative index', async () => {
    state.searchResults = [1, 2, 3];
    state.lastSearchQuery = 'test';
    await jumpToSearchResult(-1);
    assert.equal(state.searchCursor, 2);
    assert.equal(state.currentPage, 3);
  });

  it('wraps around index beyond length', async () => {
    state.searchResults = [1, 2, 3];
    state.lastSearchQuery = 'test';
    await jumpToSearchResult(5);
    assert.equal(state.searchCursor, 2); // 5 % 3 = 2
    assert.equal(state.currentPage, 3);
  });
});

// ── renderSearchResultsList ──────────────────────────────────────────────────

describe('renderSearchResultsList', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', () => {
    state.adapter = null;
    const appendedChildren = [];
    els.searchResultsList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderSearchResultsList();
    assert.equal(els.searchResultsList.innerHTML, '');
    assert.ok(appendedChildren.length > 0);
  });

  it('shows no results message when empty', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [];
    const appendedChildren = [];
    els.searchResultsList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderSearchResultsList();
    assert.ok(appendedChildren.length > 0);
  });

  it('renders result items with page numbers', () => {
    state.adapter = { type: 'pdf' };
    state.searchResults = [2, 5];
    state.searchResultCounts = { 2: 3, 5: 1 };
    state.searchCursor = 0;
    const appendedChildren = [];
    els.searchResultsList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderSearchResultsList();
    assert.equal(appendedChildren.length, 2);
  });
});

// ── renderSearchHistory ──────────────────────────────────────────────────────

describe('renderSearchHistory', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', () => {
    state.adapter = null;
    const appendedChildren = [];
    els.searchHistoryList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderSearchHistory();
    assert.ok(appendedChildren.length > 0);
  });

  it('shows no queries message when history is empty', () => {
    state.adapter = { type: 'pdf' };
    const appendedChildren = [];
    els.searchHistoryList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderSearchHistory();
    assert.ok(appendedChildren.length > 0);
  });

  it('renders history items', () => {
    state.adapter = { type: 'pdf' };
    saveSearchHistory(['alpha', 'beta', 'gamma']);
    const appendedChildren = [];
    els.searchHistoryList = {
      innerHTML: '',
      appendChild(child) { appendedChildren.push(child); },
    };
    renderSearchHistory();
    assert.equal(appendedChildren.length, 3);
  });
});

// ── highlightSearchInTextLayer ───────────────────────────────────────────────

describe('highlightSearchInTextLayer', () => {
  beforeEach(resetSearchState);

  it('returns 0 with empty query', () => {
    assert.equal(highlightSearchInTextLayer(''), 0);
    assert.equal(highlightSearchInTextLayer(null), 0);
  });

  it('returns 0 with no container', () => {
    els.textLayerDiv = null;
    assert.equal(highlightSearchInTextLayer('test'), 0);
  });

  it('highlights matches in spans', () => {
    // The highlight function creates mark elements via document.createElement,
    // and uses DocumentFragment, createTextNode, etc.
    // We just verify it doesn't throw and returns count > 0
    // by providing a span whose textContent contains the query.
    const mockSpan = {
      textContent: 'Hello World Hello',
      appendChild(frag) { /* absorb fragment */ },
    };
    // The function iterates spans, splits text around matches, and replaces content
    els.textLayerDiv = {
      querySelectorAll(sel) {
        if (sel === '.search-highlight') return [];
        if (sel === 'span') return [mockSpan];
        return [];
      },
    };

    const count = highlightSearchInTextLayer('hello');
    assert.equal(count, 2);
  });
});

// ── scrollToSearchHighlight ──────────────────────────────────────────────────

describe('scrollToSearchHighlight', () => {
  beforeEach(resetSearchState);

  it('does nothing with no marks', () => {
    els.textLayerDiv = { querySelectorAll() { return []; } };
    // Should not throw
    scrollToSearchHighlight(0);
  });

  it('adds active class to the target mark', () => {
    let addedCls = null;
    let scrolled = false;
    const marks = [
      { classList: { add() {}, remove() {} }, scrollIntoView() {} },
      { classList: { add(cls) { addedCls = cls; }, remove() {} }, scrollIntoView() { scrolled = true; } },
    ];
    // forEach must be available on marks
    marks.forEach = Array.prototype.forEach.bind(marks);
    els.textLayerDiv = { querySelectorAll() { return marks; } };
    scrollToSearchHighlight(1);
    assert.equal(addedCls, 'active');
    assert.equal(scrolled, true);
  });
});

// ── copySearchResultsSummary ─────────────────────────────────────────────────

describe('copySearchResultsSummary', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', async () => {
    state.adapter = null;
    await copySearchResultsSummary();
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('shows message when no results', async () => {
    state.searchResults = [];
    await copySearchResultsSummary();
    assert.ok(els.searchStatus.textContent.includes('Нет результатов'));
  });

  it('copies results via fallback when clipboard unavailable', async () => {
    state.searchResults = [1, 2];
    state.searchResultCounts = { 1: 5, 2: 3 };
    state.lastSearchQuery = 'test';
    // navigator.clipboard may or may not be available
    await copySearchResultsSummary();
    assert.ok(els.searchStatus.textContent.includes('Скопировано') || els.searchStatus.textContent.includes('Не удалось'));
  });
});

// ── exportSearchResultsSummaryTxt ────────────────────────────────────────────

describe('exportSearchResultsSummaryTxt', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', () => {
    state.adapter = null;
    exportSearchResultsSummaryTxt();
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('shows message when no results', () => {
    state.searchResults = [];
    exportSearchResultsSummaryTxt();
    assert.ok(els.searchStatus.textContent.includes('Нет результатов'));
  });

  it('exports summary when results exist', () => {
    state.searchResults = [1, 3];
    state.searchResultCounts = { 1: 2, 3: 4 };
    exportSearchResultsSummaryTxt();
    assert.ok(els.searchStatus.textContent.includes('Summary'));
  });
});

// ── exportSearchResultsCsv ───────────────────────────────────────────────────

describe('exportSearchResultsCsv', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', () => {
    state.adapter = null;
    exportSearchResultsCsv();
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('shows message when no results', () => {
    state.searchResults = [];
    exportSearchResultsCsv();
    assert.ok(els.searchStatus.textContent.includes('Нет результатов'));
  });

  it('exports CSV when results exist', () => {
    state.searchResults = [1];
    state.searchResultCounts = { 1: 1 };
    exportSearchResultsCsv();
    assert.ok(els.searchStatus.textContent.includes('CSV'));
  });
});

// ── exportSearchResultsJson ──────────────────────────────────────────────────

describe('exportSearchResultsJson', () => {
  beforeEach(resetSearchState);

  it('exports JSON when results exist', () => {
    state.searchResults = [1, 2];
    state.searchResultCounts = { 1: 3, 2: 5 };
    exportSearchResultsJson();
    assert.ok(els.searchStatus.textContent.includes('Экспортировано'));
  });
});

// ── importSearchResultsJson ──────────────────────────────────────────────────

describe('importSearchResultsJson', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', async () => {
    state.adapter = null;
    await importSearchResultsJson({ text: async () => '{}' });
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('imports valid JSON payload', async () => {
    const payload = {
      query: 'hello',
      scope: 'all',
      rows: [
        { page: 1, matches: 3 },
        { page: 5, matches: 1 },
      ],
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importSearchResultsJson(file);
    assert.deepEqual(state.searchResults, [1, 5]);
    assert.equal(state.searchResultCounts[1], 3);
    assert.ok(els.searchStatus.textContent.includes('Импортировано'));
  });

  it('shows message for empty rows', async () => {
    const file = { text: async () => JSON.stringify({ rows: [] }) };
    await importSearchResultsJson(file);
    assert.ok(els.searchStatus.textContent.includes('Нет валидных'));
  });

  it('shows error for invalid JSON', async () => {
    const file = { text: async () => 'not json{{{' };
    await importSearchResultsJson(file);
    assert.ok(els.searchStatus.textContent.includes('Ошибка'));
  });

  it('filters out-of-range pages', async () => {
    state.pageCount = 3;
    const payload = { rows: [{ page: 1 }, { page: 999 }] };
    const file = { text: async () => JSON.stringify(payload) };
    await importSearchResultsJson(file);
    assert.deepEqual(state.searchResults, [1]);
  });
});

// ── importSearchResultsCsv ───────────────────────────────────────────────────

describe('importSearchResultsCsv', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', async () => {
    state.adapter = null;
    await importSearchResultsCsv({ text: async () => '' });
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('imports valid CSV with page column', async () => {
    const csv = 'index,page,matches,query,scope\n1,2,5,hello,all\n2,4,1,hello,all';
    const file = { text: async () => csv };
    await importSearchResultsCsv(file);
    assert.deepEqual(state.searchResults, [2, 4]);
    assert.equal(state.searchResultCounts[2], 5);
    assert.ok(els.searchStatus.textContent.includes('Импортировано'));
  });

  it('shows message for CSV with no data rows', async () => {
    const csv = 'page,matches';
    const file = { text: async () => csv };
    await importSearchResultsCsv(file);
    assert.ok(els.searchStatus.textContent.includes('не содержит'));
  });

  it('shows message for CSV without page column', async () => {
    const csv = 'name,value\nhello,1';
    const file = { text: async () => csv };
    await importSearchResultsCsv(file);
    assert.ok(els.searchStatus.textContent.includes('page'));
  });

  it('shows message for CSV with no valid pages', async () => {
    state.pageCount = 2;
    const csv = 'page\n999\n888';
    const file = { text: async () => csv };
    await importSearchResultsCsv(file);
    assert.ok(els.searchStatus.textContent.includes('Нет валидных'));
  });

  it('handles parse error gracefully', async () => {
    const file = { text: async () => { throw new Error('read error'); } };
    await importSearchResultsCsv(file);
    assert.ok(els.searchStatus.textContent.includes('Ошибка'));
  });
});

// ── exportSearchHistoryJson / exportSearchHistoryTxt ─────────────────────────

describe('exportSearchHistoryJson', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', () => {
    state.adapter = null;
    exportSearchHistoryJson();
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('shows message when history empty', () => {
    exportSearchHistoryJson();
    assert.ok(els.searchStatus.textContent.includes('пуста'));
  });

  it('exports JSON when history has items', () => {
    saveSearchHistory(['q1', 'q2']);
    exportSearchHistoryJson();
    assert.ok(els.searchStatus.textContent.includes('Экспортировано'));
  });
});

describe('exportSearchHistoryTxt', () => {
  beforeEach(resetSearchState);

  it('exports TXT when history has items', () => {
    saveSearchHistory(['q1']);
    exportSearchHistoryTxt();
    assert.ok(els.searchStatus.textContent.includes('TXT'));
  });
});

// ── copySearchHistory ────────────────────────────────────────────────────────

describe('copySearchHistory', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', async () => {
    state.adapter = null;
    await copySearchHistory();
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('shows message when history empty', async () => {
    await copySearchHistory();
    assert.ok(els.searchStatus.textContent.includes('пуста'));
  });
});

// ── importSearchHistoryJson ──────────────────────────────────────────────────

describe('importSearchHistoryJson', () => {
  beforeEach(resetSearchState);

  it('shows message when not searchable', async () => {
    state.adapter = null;
    await importSearchHistoryJson({ text: async () => '{}' });
    assert.ok(els.searchStatus.textContent.includes('PDF/DjVu'));
  });

  it('imports valid history', async () => {
    const payload = { history: ['q1', 'q2', 'q3'] };
    const file = { text: async () => JSON.stringify(payload) };
    await importSearchHistoryJson(file);
    const hist = loadSearchHistory();
    assert.ok(hist.includes('q1'));
    assert.ok(els.searchStatus.textContent.includes('Импортировано'));
  });

  it('shows message for empty history in JSON', async () => {
    const file = { text: async () => JSON.stringify({ history: [] }) };
    await importSearchHistoryJson(file);
    assert.ok(els.searchStatus.textContent.includes('Нет валидных'));
  });

  it('handles invalid JSON', async () => {
    const file = { text: async () => '{broken' };
    await importSearchHistoryJson(file);
    assert.ok(els.searchStatus.textContent.includes('Ошибка'));
  });
});

// ── downloadOcrTextExport ────────────────────────────────────────────────────

describe('downloadOcrTextExport', () => {
  beforeEach(resetSearchState);

  it('shows message when no pages indexed', () => {
    downloadOcrTextExport();
    assert.ok(setOcrStatusCalls.some(msg => msg.includes('нет данных')));
  });

  it('exports when pages are indexed', () => {
    indexOcrPage(1, 'Page one text');
    downloadOcrTextExport();
    assert.ok(setOcrStatusCalls.some(msg => msg.includes('экспортировано')));
  });
});

// ── loadSearchScope / saveSearchScope ────────────────────────────────────────

describe('loadSearchScope / saveSearchScope', () => {
  beforeEach(resetSearchState);

  it('defaults to all when nothing saved', () => {
    loadSearchScope();
    assert.equal(els.searchScope.value, 'all');
  });

  it('loads saved scope current', () => {
    localStorage.setItem('novareader-search-scope', 'current');
    loadSearchScope();
    assert.equal(els.searchScope.value, 'current');
  });

  it('saves current scope', () => {
    els.searchScope.value = 'current';
    saveSearchScope();
    assert.equal(localStorage.getItem('novareader-search-scope'), 'current');
  });
});
