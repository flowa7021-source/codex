// @ts-check
// ─── Search Controller ──────────────────────────────────────────────────────
// Search index, search execution, search results/history management,
// and text-layer highlighting.
// Extracted from app.js as part of module decomposition.

import { state, els as _els } from './state.js';

/** @type {Record<string, any>} */
const els = _els;
import { yieldToMainThread } from './utils.js';
import { recordPerfMetric } from './perf.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { loadOcrTextData } from './workspace-controller.js';
import MiniSearch from 'minisearch';
import FlexSearch from 'flexsearch';

// ─── Dependencies injected from app.js ─────────────────────────────────────
// Some functions live in app.js and are not yet modularised. We accept them
// via initSearchControllerDeps() so the module stays self-contained.

/** @type {Record<string, any>} */
const _deps = {
  setOcrStatus: () => {},
  renderCurrentPage: async () => {},
};

/**
 * Inject app-level dependencies that are not yet in their own modules.
 * Must be called once during app initialisation.
 * @param {Record<string, any>} deps
 * @returns {void}
 */
export function initSearchControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── OCR Search Index with Coordinates ──────────────────────────────────────

export const ocrSearchIndex = {
  pages: new Map(),
  version: 0,
};

// ─── MiniSearch BM25 index ───────────────────────────────────────────────────
// Provides fuzzy matching and BM25-ranked page relevance on top of the
// coordinate-based ocrSearchIndex. Each page is a separate document.

/** @type {MiniSearch} */
let _miniSearch = _createMiniSearch();

function _createMiniSearch() {
  return new MiniSearch({
    fields: ['text'],
    storeFields: ['pageNum'],
    searchOptions: {
      boost: { text: 1 },
      fuzzy: 0.2,        // up to 20% edit distance
      prefix: true,      // prefix matching for partial words
    },
  });
}

/** Reset the MiniSearch index (call when a new document is opened). */
export function resetMiniSearchIndex() {
  _miniSearch = _createMiniSearch();
  _resetFlexIndex();
}

// ─── FlexSearch native-text index ────────────────────────────────────────────
// Indexes extracted PDF/DjVu text per page for sub-millisecond keyword lookup.
// Complements the OCR MiniSearch index: FlexSearch is faster on large corpora
// and uses tokenised inverted index, while MiniSearch provides fuzzy/BM25.

/** @type {any} */
let _flexIndex = _makeFlexIndex();
/** @type {Map<number, boolean>} Pages already indexed in FlexSearch */
const _flexIndexed = new Map();

function _makeFlexIndex() {
  return new FlexSearch.Index({
    tokenize: 'forward',   // prefix matching (finds 'foo' when searching 'fo')
    resolution: 9,          // max scoring resolution
    cache: true,            // keep recently searched terms in memory
  });
}

function _resetFlexIndex() {
  _flexIndex = _makeFlexIndex();
  _flexIndexed.clear();
}

/**
 * Index a page's native text in FlexSearch.
 * Call this whenever a page's text has been extracted (after getText()).
 * @param {number} pageNum
 * @param {string} text
 */
export function flexIndexPage(pageNum, text) {
  if (!text || _flexIndexed.get(pageNum)) return;
  try {
    _flexIndex.add(pageNum, text);
    _flexIndexed.set(pageNum, true);
  } catch (_e) { /* non-critical */ }
}

/**
 * Search the FlexSearch native-text index.
 * Returns page numbers that contain the query, ordered by relevance.
 * @param {string} query
 * @returns {number[]}
 */
export function flexSearch(query) {
  if (!query) return [];
  try {
    return /** @type {number[]} */ (_flexIndex.search(query, { limit: 500 }));
  } catch (_e) {
    return [];
  }
}

/** Number of pages currently indexed in FlexSearch. */
export function flexIndexSize() {
  return _flexIndexed.size;
}

/** @type {number|null} Handle for the active background indexing loop */
let _bgIndexHandle = null;

/**
 * Schedule background FlexSearch indexing of all pages using requestIdleCallback.
 * Indexes ~5 pages per idle slot so the UI is never blocked.
 * Automatically stops when all pages are indexed or a new document is opened.
 *
 * @param {any} adapter   - Document adapter with getText(pageNum) → Promise<string>
 * @param {number} pageCount
 */
export function scheduleBackgroundFlexIndex(adapter, pageCount) {
  if (_bgIndexHandle !== null) cancelIdleCallback(_bgIndexHandle);
  _bgIndexHandle = null;

  let nextPage = 1;

  const tick = (deadline) => {
    // Stop if a new document reset the index
    if (_flexIndexed.size === 0 && nextPage > 1) return;

    const PAGES_PER_SLOT = 5;
    let pagesThisTick = 0;

    while (nextPage <= pageCount && pagesThisTick < PAGES_PER_SLOT && deadline.timeRemaining() > 2) {
      const p = nextPage++;
      if (_flexIndexed.get(p)) continue;
      // Fire-and-forget: index the page text without blocking
      adapter.getText(p).then((text) => {
        if (text) flexIndexPage(p, text);
      }).catch(() => {});
      pagesThisTick++;
    }

    if (nextPage <= pageCount) {
      _bgIndexHandle = requestIdleCallback(tick, { timeout: 2000 });
    }
  };

  // Start after a short delay so document open doesn't compete for resources
  if (typeof requestIdleCallback !== 'undefined') {
    _bgIndexHandle = requestIdleCallback(tick, { timeout: 3000 });
  }
}

/** @param {any} pageNum @param {any} text @returns {any} */
export function buildOcrSearchEntry(pageNum, text) {
  if (!text) return null;
  const words = [];
  const lines = text.split('\n');
  let charOffset = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineWords = lines[lineIdx].split(/\s+/).filter(Boolean);
    for (const word of lineWords) {
      words.push({
        word: word.toLowerCase(),
        original: word,
        page: pageNum,
        line: lineIdx + 1,
        offset: charOffset,
        length: word.length,
      });
      charOffset += word.length + 1;
    }
    charOffset++;
  }
  return { pageNum, text, words, indexedAt: Date.now() };
}

/** @param {any} pageNum @param {any} text @returns {any} */
export function indexOcrPage(pageNum, text) {
  const entry = buildOcrSearchEntry(pageNum, text);
  if (entry) {
    ocrSearchIndex.pages.set(pageNum, entry);
    ocrSearchIndex.version++;
    // Keep MiniSearch in sync — remove old entry first to allow re-indexing
    try { _miniSearch.remove({ id: pageNum }); } catch (_e) { /* not yet indexed */ }
    try { _miniSearch.add({ id: pageNum, pageNum, text }); } catch (_e) { /* ignore */ }
  }
}

/** @param {any} query @returns {any} */
export function searchOcrIndex(query) {
  const norm = (query || '').trim().toLowerCase();
  if (!norm) return [];

  // Use MiniSearch for BM25 ranking + fuzzy matching across all indexed pages
  let miniResults;
  try {
    miniResults = _miniSearch.search(norm);
  } catch (_e) {
    miniResults = [];
  }

  // Build a relevance score map from MiniSearch (page → score)
  /** @type {Map<number, number>} */
  const scoreMap = new Map(miniResults.map(r => [r.pageNum, r.score]));

  // Collect per-page word matches from the coordinate index
  const results = [];
  const pagesToSearch = miniResults.length > 0
    ? miniResults.map(r => r.pageNum)
    : [...ocrSearchIndex.pages.keys()];

  for (const pageNum of pagesToSearch) {
    const entry = ocrSearchIndex.pages.get(pageNum);
    if (!entry) continue;
    const matches = [];
    for (const w of entry.words) {
      if (w.word.includes(norm) || w.word.startsWith(norm)) {
        matches.push({ word: w.original, line: w.line, offset: w.offset });
      }
    }
    if (matches.length > 0) {
      results.push({ page: pageNum, matchCount: matches.length, matches, score: scoreMap.get(pageNum) || 0 });
    }
  }

  // Sort by BM25 score descending (pages with more/better matches first),
  // with page number as tiebreaker for stable output.
  return results.sort((a, b) => (b.score - a.score) || (a.page - b.page));
}

/** @returns {any} */
export function exportOcrTextWithCoordinates() {
  const output = { app: 'NovaReader', version: '2.0', exportedAt: new Date().toISOString(), pages: [] };
  for (const [pageNum, entry] of ocrSearchIndex.pages) {
    output.pages.push({
      page: pageNum,
      text: entry.text,
      wordCount: entry.words.length,
      words: entry.words.map(w => ({
        word: w.original,
        line: w.line,
        offset: w.offset,
        length: w.length,
      })),
    });
  }
  return output;
}

/** @returns {any} */
export function downloadOcrTextExport() {
  const data = exportOcrTextWithCoordinates();
  if (!data.pages.length) {
    _deps.setOcrStatus('OCR: нет данных для экспорта индекса');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-ocr-index.json`;
  a.click();
  URL.revokeObjectURL(url);
  _deps.setOcrStatus(`OCR индекс: экспортировано ${data.pages.length} страниц`);
  pushDiagnosticEvent('ocr.index.export', { pages: data.pages.length });
}

// ─── Search Scope / History Keys ────────────────────────────────────────────

/** @returns {any} */
export function canSearchCurrentDoc() {
  return !!(state.adapter && (state.adapter.type === 'pdf' || state.adapter.type === 'djvu'));
}

/** @returns {any} */
export function searchScopeKey() {
  return 'novareader-search-scope';
}

/** @returns {any} */
export function loadSearchScope() {
  const scope = localStorage.getItem(searchScopeKey());
  if (scope === 'current' || scope === 'all') {
    els.searchScope.value = scope;
  } else {
    els.searchScope.value = 'all';
  }
}

/** @returns {any} */
export function saveSearchScope() {
  const scope = els.searchScope.value === 'current' ? 'current' : 'all';
  localStorage.setItem(searchScopeKey(), scope);
}

/** @returns {any} */
export function searchHistoryKey() {
  return `novareader-search-history:${state.docName || 'global'}`;
}

// ─── Search Results Management ──────────────────────────────────────────────

/** @returns {any} */
export function buildSearchResultsSummaryText() {
  const rows = state.searchResults.map((page, idx) => {
    const count = state.searchResultCounts[page] || 0;
    return `${idx + 1}. Страница ${page}${count ? ` — ${count} совп.` : ''}`;
  });
  const scopeLabel = (state.lastSearchScope === 'page' || state.lastSearchScope === 'current') ? 'текущая страница' : 'весь документ';
  const header = [
    `Документ: ${state.docName || 'document'}`,
    `Запрос: ${state.lastSearchQuery || '—'}`,
    `Область: ${scopeLabel}`,
    `Результатов: ${state.searchResults.length}`,
  ];
  return `${header.join('\n')}\n\n${rows.join('\n')}`;
}

/** @returns {Promise<any>} */
export async function copySearchResultsSummary() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Копирование доступно для PDF/DjVu';
    return;
  }
  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для копирования';
    return;
  }

  const text = buildSearchResultsSummaryText();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    els.searchStatus.textContent = `Скопировано результатов: ${state.searchResults.length}`;
  } catch (err) {
    console.warn('[search-controller] error:', err?.message);
    els.searchStatus.textContent = 'Не удалось скопировать список';
  }
}

/** @returns {any} */
export function exportSearchResultsSummaryTxt() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }
  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const text = buildSearchResultsSummaryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results-summary.txt`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `Summary экспортирован: ${state.searchResults.length}`;
}

/** @returns {any} */
export function exportSearchResultsCsv() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const header = ['index', 'page', 'matches', 'query', 'scope'];
  const rows = state.searchResults.map((page, idx) => {
    const matches = state.searchResultCounts[page] || 0;
    return [
      idx + 1,
      page,
      matches,
      state.lastSearchQuery || '',
      state.lastSearchScope,
    ];
  });

  const csv = [
    header.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results.csv`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `CSV экспортирован: ${rows.length}`;
}

/** @returns {any} */
export function exportSearchResultsJson() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const rows = state.searchResults.map((page, idx) => ({
    index: idx + 1,
    page,
    matches: state.searchResultCounts[page] || 0,
  }));

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    query: state.lastSearchQuery,
    scope: state.lastSearchScope,
    totalResults: rows.length,
    rows,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results.json`;
  a.click();
  URL.revokeObjectURL(url);
  els.searchStatus.textContent = `Экспортировано результатов: ${rows.length}`;
}

/** @param {any} file @returns {Promise<any>} */
export async function importSearchResultsJson(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const pages = rows
      .map((row) => Number(row?.page))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount);

    if (!pages.length) {
      els.searchStatus.textContent = 'Нет валидных результатов в JSON';
      return;
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    state.searchResults = uniquePages;
    state.searchCursor = 0;
    state.searchResultCounts = {};

    rows.forEach((row) => {
      const page = Number(row?.page);
      const matches = Number(row?.matches);
      if (Number.isInteger(page) && page >= 1 && page <= state.pageCount && Number.isFinite(matches) && matches >= 0) {
        state.searchResultCounts[page] = Math.floor(matches);
      }
    });

    state.lastSearchQuery = typeof payload?.query === 'string' ? payload.query : '';
    state.lastSearchScope = (payload?.scope === 'page' || payload?.scope === 'current') ? 'current' : 'all';

    els.searchInput.value = state.lastSearchQuery;
    els.searchScope.value = state.lastSearchScope;
    saveSearchScope();

    renderSearchResultsList();
    els.searchStatus.textContent = `Импортировано результатов: ${state.searchResults.length}`;
  } catch (err) {
    console.warn('[search-controller] error:', err?.message);
    els.searchStatus.textContent = 'Ошибка импорта результатов поиска';
  }
}

/** @param {any} line @returns {any} */
export function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current);
  return cells.map((x) => x.trim());
}

/** @param {any} file @returns {Promise<any>} */
export async function importSearchResultsCsv(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const lines = raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      els.searchStatus.textContent = 'CSV не содержит данных';
      return;
    }

    const header = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const pageIdx = header.indexOf('page');
    const matchesIdx = header.indexOf('matches');
    const queryIdx = header.indexOf('query');
    const scopeIdx = header.indexOf('scope');

    if (pageIdx === -1) {
      els.searchStatus.textContent = 'CSV должен содержать колонку page';
      return;
    }

    const parsedRows = lines.slice(1).map((line) => parseCsvLine(line));
    const pages = parsedRows
      .map((row) => Number(row[pageIdx]))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount);

    if (!pages.length) {
      els.searchStatus.textContent = 'Нет валидных страниц в CSV';
      return;
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    state.searchResults = uniquePages;
    state.searchCursor = 0;
    state.searchResultCounts = {};

    if (matchesIdx !== -1) {
      parsedRows.forEach((row) => {
        const page = Number(row[pageIdx]);
        const matches = Number(row[matchesIdx]);
        if (Number.isInteger(page) && page >= 1 && page <= state.pageCount && Number.isFinite(matches) && matches >= 0) {
          state.searchResultCounts[page] = Math.floor(matches);
        }
      });
    }

    if (queryIdx !== -1) {
      state.lastSearchQuery = parsedRows[0]?.[queryIdx] || '';
    }
    if (scopeIdx !== -1) {
      state.lastSearchScope = (parsedRows[0]?.[scopeIdx] === 'page' || parsedRows[0]?.[scopeIdx] === 'current') ? 'current' : 'all';
    }

    els.searchInput.value = state.lastSearchQuery || '';
    els.searchScope.value = state.lastSearchScope || 'all';
    saveSearchScope();

    renderSearchResultsList();
    els.searchStatus.textContent = `Импортировано из CSV: ${state.searchResults.length}`;
  } catch (err) {
    console.warn('[search-controller] error:', err?.message);
    els.searchStatus.textContent = 'Ошибка импорта CSV';
  }
}

/** @returns {any} */
export function clearSearchResults() {
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};
  state.lastSearchQuery = '';
  state.lastSearchScope = 'all';
  els.searchStatus.textContent = '';
  renderSearchResultsList();
}

/** @returns {any} */
export function renderSearchResultsList() {
  els.searchResultsList.innerHTML = '';

  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Результаты поиска доступны для PDF/DjVu';
    els.searchResultsList.appendChild(li);
    return;
  }

  if (!state.searchResults.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Нет активных результатов';
    els.searchResultsList.appendChild(li);
    return;
  }

  state.searchResults.forEach((page, idx) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    const count = state.searchResultCounts[page] || 0;
    btn.textContent = `#${idx + 1} · Стр. ${page}${count ? ` · ${count} совп.` : ''}`;
    if (idx === state.searchCursor) {
      btn.textContent += ' (текущее)';
    }
    btn.addEventListener('click', async () => {
      await jumpToSearchResult(idx);
    });
    li.appendChild(btn);
    els.searchResultsList.appendChild(li);
  });
}

// ─── Search History ─────────────────────────────────────────────────────────

/** @returns {any} */
export function loadSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(searchHistoryKey()) || '[]');
  } catch (err) {
    console.warn('[search-controller storage] error:', err?.message);
    return [];
  }
}

/** @param {any} history @returns {any} */
export function saveSearchHistory(history) {
  localStorage.setItem(searchHistoryKey(), JSON.stringify(history));
}

/** @returns {any} */
export function renderSearchHistory() {
  els.searchHistoryList.innerHTML = '';
  const history = loadSearchHistory();
  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'История поиска доступна для PDF/DjVu';
    els.searchHistoryList.appendChild(li);
    return;
  }

  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Запросов пока нет';
    els.searchHistoryList.appendChild(li);
    return;
  }

  history.forEach((query) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    btn.textContent = query;
    btn.addEventListener('click', async () => {
      els.searchInput.value = query;
      await searchInPdf(query);
    });
    li.appendChild(btn);
    els.searchHistoryList.appendChild(li);
  });
}

/** @param {any} query @returns {any} */
export function rememberSearchQuery(query) {
  if (!canSearchCurrentDoc()) return;
  const normalized = (query || '').trim();
  if (!normalized) return;
  const history = loadSearchHistory();
  const next = [normalized, ...history.filter((x) => x !== normalized)].slice(0, 10);
  saveSearchHistory(next);
  renderSearchHistory();
}

/** @returns {any} */
export function buildSearchHistoryText() {
  const history = loadSearchHistory();
  const lines = history.map((query, idx) => `${idx + 1}. ${query}`);
  return `Документ: ${state.docName || 'document'}
Запросов: ${history.length}

${lines.join('\n')}`;
}

/** @returns {any} */
export function exportSearchHistoryJson() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    history,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-history.json`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `Экспортировано запросов: ${history.length}`;
}

/** @returns {any} */
export function exportSearchHistoryTxt() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }
  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const text = buildSearchHistoryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-history.txt`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `TXT экспортирован: ${history.length}`;
}

/** @returns {Promise<any>} */
export async function copySearchHistory() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Копирование доступно для PDF/DjVu';
    return;
  }
  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const text = buildSearchHistoryText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    els.searchStatus.textContent = `Скопировано запросов: ${history.length}`;
  } catch (err) {
    console.warn('[search-controller] error:', err?.message);
    els.searchStatus.textContent = 'Не удалось скопировать историю';
  }
}

/** @param {any} file @returns {Promise<any>} */
export async function importSearchHistoryJson(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const incoming = Array.isArray(payload?.history) ? payload.history : [];
    const normalized = incoming
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);

    if (!normalized.length) {
      els.searchStatus.textContent = 'Нет валидных запросов в JSON';
      return;
    }

    const unique = [...new Set(normalized)].slice(0, 10);
    saveSearchHistory(unique);
    renderSearchHistory();
    els.searchStatus.textContent = `Импортировано запросов: ${unique.length}`;
  } catch (err) {
    console.warn('[search-controller] error:', err?.message);
    els.searchStatus.textContent = 'Ошибка импорта истории поиска';
  }
}

/** @returns {any} */
export function clearSearchHistory() {
  saveSearchHistory([]);
  renderSearchHistory();
}

// ─── Search Highlight in Text Layer ─────────────────────────────────────────

/** @param {any} query @returns {any} */
export function highlightSearchInTextLayer(query) {
  const container = els.textLayerDiv;
  if (!container || !query) return 0;

  // Remove old highlights
  container.querySelectorAll('.search-highlight').forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });

  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;

  let count = 0;
  const spans = container.querySelectorAll('span');
  for (const span of spans) {
    const text = span.textContent;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(normalized);
    if (idx === -1) continue;

    // Split the span text around matches
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let pos = lower.indexOf(normalized, 0);
    while (pos !== -1) {
      if (pos > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(pos, pos + normalized.length);
      mark.dataset.matchIndex = String(count);
      frag.appendChild(mark);
      count++;
      lastIdx = pos + normalized.length;
      pos = lower.indexOf(normalized, lastIdx);
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    span.textContent = '';
    span.appendChild(frag);
  }
  return count;
}

/** @param {any} index @returns {any} */
export function scrollToSearchHighlight(index) {
  const marks = els.textLayerDiv?.querySelectorAll('.search-highlight');
  if (!marks?.length) return;
  // Remove active class from all
  marks.forEach(m => m.classList.remove('active'));
  const target = marks[index % marks.length];
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ─── Main Search Function ───────────────────────────────────────────────────

/** @param {any} query @returns {Promise<any>} */
export async function searchInPdf(query) {
  try { performance.mark('search-start'); } catch (_e) { /* Performance API unavailable */ }
  const searchStartedAt = performance.now();
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};

  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Поиск доступен для PDF/DjVu';
    renderSearchResultsList();
    return;
  }

  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) {
    els.searchStatus.textContent = 'Введите запрос';
    renderSearchResultsList();
    return;
  }

  const scope = els.searchScope.value === 'current' ? 'current' : 'all';
  state.lastSearchQuery = query.trim();
  state.lastSearchScope = scope;
  rememberSearchQuery(query);

  const ocrData = loadOcrTextData();
  const ocrPages = ocrData?.pagesText || [];

  /**
   * Get full search text for a page (native + OCR).
   * As a side effect, adds native text to the FlexSearch index if not yet done.
   * @param {number} pageNum
   * @returns {Promise<string>}
   */
  const _getSearchText = async (pageNum) => {
    let native = '';
    try {
      native = await state.adapter.getText(pageNum);
      // Index native text lazily in FlexSearch for future instant searches
      flexIndexPage(pageNum, native);
      native = native.toLowerCase();
    } catch (_e) { /* text extraction failed */ }
    const ocr = String(ocrPages[pageNum - 1] || '').toLowerCase();
    if (!native) return ocr;
    if (!ocr) return native;
    if (native.includes(normalized) || ocr.length < native.length * 0.3) return native;
    return native + '\n' + ocr;
  };

  if (scope === 'current') {
    const txt = await _getSearchText(state.currentPage);
    const count = txt.split(normalized).length - 1;
    if (count > 0) {
      state.searchResults = [state.currentPage];
      state.searchResultCounts[state.currentPage] = count;
    }
  } else {
    const maxPage = state.pageCount;

    // Phase 1: instant pre-screening via FlexSearch (already-indexed pages)
    // and MiniSearch OCR index — both return results in <1ms.
    const flexHitPages = new Set(flexSearch(query));
    const ocrHits = searchOcrIndex(query);
    const ocrHitPages = new Set(ocrHits.map(h => h.page));

    // Phase 2: build the list of pages to scan.
    // Pre-screened hits go first (already fast), then unindexed pages sequentially.
    const preScreened = new Set([...flexHitPages, ...ocrHitPages]);
    const unindexed = [];
    for (let i = 1; i <= maxPage; i++) {
      if (!preScreened.has(i) && !_flexIndexed.get(i)) unindexed.push(i);
    }

    // Process pre-screened pages first (no getText call needed for FlexSearch hits)
    for (const i of preScreened) {
      if (!state.adapter || i < 1 || i > maxPage) continue;
      const txt = await _getSearchText(i);
      let count = txt.split(normalized).length - 1;
      if (count === 0 && ocrHitPages.has(i)) {
        count = ocrHits.find(h => h.page === i)?.matchCount || 0;
      }
      if (count > 0) {
        state.searchResults.push(i);
        state.searchResultCounts[i] = count;
      }
    }

    // Process unindexed pages sequentially, yielding every 10 pages
    let processed = 0;
    for (const i of unindexed) {
      if (!state.adapter) break;
      const txt = await _getSearchText(i);  // also adds to FlexSearch index
      const count = txt.split(normalized).length - 1;
      if (count > 0) {
        state.searchResults.push(i);
        state.searchResultCounts[i] = count;
      }
      if (++processed % 10 === 0) {
        const scanned = preScreened.size + processed;
        els.searchStatus.textContent = `${scanned}/${maxPage}…`;
        await yieldToMainThread();
      }
    }

    // Sort results by page number for consistent navigation
    state.searchResults.sort((a, b) => a - b);
  }

  const searchMs = Math.round(performance.now() - searchStartedAt);
  recordPerfMetric('searchTimes', searchMs);

  if (state.searchResults.length) {
    state.searchCursor = 0;
    await jumpToSearchResult(0);
    // Highlight matches in text layer
    const hlCount = highlightSearchInTextLayer(query);
    if (hlCount > 0) scrollToSearchHighlight(0);
    const suffix = scope === 'current' ? ' (текущая страница)' : '';
    els.searchStatus.textContent = `Совпадение 1/${state.searchResults.length}${suffix} (${searchMs}мс)`;
  } else {
    els.searchStatus.textContent = scope === 'current' ? 'На текущей странице не найдено' : 'Ничего не найдено';
    renderSearchResultsList();
  }

  try {
    performance.mark('search-end');
    performance.measure('search', 'search-start', 'search-end');
  } catch (_e) { /* Performance API unavailable */ }
}

/** @param {any} index @returns {Promise<any>} */
export async function jumpToSearchResult(index) {
  if (!state.searchResults.length) return;
  state.searchCursor = (index + state.searchResults.length) % state.searchResults.length;
  state.currentPage = state.searchResults[state.searchCursor];
  els.searchStatus.textContent = `Совпадение ${state.searchCursor + 1}/${state.searchResults.length}`;
  await _deps.renderCurrentPage();
  // Highlight matches on the rendered page
  const hlCount = highlightSearchInTextLayer(state.lastSearchQuery);
  if (hlCount > 0) scrollToSearchHighlight(0);
}
