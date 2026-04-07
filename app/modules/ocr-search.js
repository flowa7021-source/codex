// @ts-check
// ─── OCR Search Index ───────────────────────────────────────────────────────
// Full-text search over OCR results with coordinate mapping.
// Uses MiniSearch (BM25 + fuzzy) for efficient ranked page discovery,
// then falls back to exact indexOf for precise context extraction.

import MiniSearch from 'minisearch';

/**
 * @typedef {object} SearchEntry
 * @property {number} page
 * @property {string} text
 * @property {string} [fullText]
 * @property {Array<{word: string, x: number, y: number, w: number, h: number}>} words
 */

export class OcrSearchIndex {
  constructor() {
    /** @type {Map<number, SearchEntry>} */
    this.pages = new Map();
    /** @type {string[]} */
    this.history = [];
    this.maxHistory = 100;
    /** @type {MiniSearch} */
    this._ms = new MiniSearch({
      fields: ['text'],
      storeFields: ['pageNum'],
      searchOptions: { fuzzy: 0.2, prefix: true },
    });
  }

  /**
   * Index a page's OCR text with word coordinates.
   * @param {number} pageNum
   * @param {string} text
   * @param {Array<{text: string, bbox: object}>} [words] - Word-level data from Tesseract
   */
  indexPage(pageNum, text, words = []) {
    const wordEntries = words.map(w => ({
      word: w.text || '',
      x: w.bbox?.x0 || 0,
      y: w.bbox?.y0 || 0,
      w: (w.bbox?.x1 || 0) - (w.bbox?.x0 || 0),
      h: (w.bbox?.y1 || 0) - (w.bbox?.y0 || 0),
    }));

    this.pages.set(pageNum, {
      page: pageNum,
      text: text.toLowerCase(),
      fullText: text,
      words: wordEntries,
    });

    // Keep MiniSearch in sync
    try { this._ms.remove({ id: pageNum }); } catch (_e) { /* not yet indexed */ }
    try { this._ms.add({ id: pageNum, pageNum, text }); } catch (_e) { /* ignore */ }
  }

  /**
   * Remove a page from the index.
   * @param {number} pageNum
   */
  removePage(pageNum) {
    this.pages.delete(pageNum);
    try { this._ms.remove({ id: pageNum }); } catch (_e) { /* ignore */ }
  }

  /**
   * Search across all indexed pages.
   * @param {string} query
   * @param {object} [options]
   * @param {boolean} [options.caseSensitive=false]
   * @param {boolean} [options.wholeWord=false]
   * @param {number} [options.maxResults=200]
   * @returns {Array<{page: number, text: string, index: number, context: string}>}
   */
  search(query, options = {}) {
    if (!query || query.length === 0) return [];

    const { caseSensitive = false, wholeWord = false, maxResults = 200 } = options;
    const results = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    // Add to history
    this._addToHistory(query);

    // Use MiniSearch to get BM25-ranked candidate pages (fuzzy + prefix)
    let rankedPageNums;
    try {
      const msResults = this._ms.search(searchQuery, { fuzzy: 0.2, prefix: true });
      rankedPageNums = msResults.length > 0
        ? msResults.map(r => r.pageNum)
        : [...this.pages.keys()];
    } catch (_e) {
      rankedPageNums = [...this.pages.keys()];
    }

    for (const pageNum of rankedPageNums) {
      const entry = this.pages.get(pageNum);
      if (!entry) continue;
      const text = caseSensitive ? entry.fullText : entry.text;
      let startPos = 0;

      while (startPos < text.length && results.length < maxResults) {
        const idx = text.indexOf(searchQuery, startPos);
        if (idx === -1) break;

        // Whole word check
        if (wholeWord) {
          const before = idx > 0 ? text[idx - 1] : ' ';
          const after = idx + searchQuery.length < text.length ? text[idx + searchQuery.length] : ' ';
          if (/\w/.test(before) || /\w/.test(after)) {
            startPos = idx + 1;
            continue;
          }
        }

        // Extract context (50 chars around match)
        const ctxStart = Math.max(0, idx - 30);
        const ctxEnd = Math.min(text.length, idx + searchQuery.length + 30);
        const context = (ctxStart > 0 ? '…' : '') +
          entry.fullText.slice(ctxStart, ctxEnd) +
          (ctxEnd < text.length ? '…' : '');

        results.push({
          page: pageNum,
          text: entry.fullText.slice(idx, idx + searchQuery.length),
          index: idx,
          context,
        });

        startPos = idx + 1;
      }
    }

    return results;
  }

  /**
   * Get word coordinates for a match on a page.
   * @param {number} pageNum
   * @param {string} query
   * @returns {Array<{x: number, y: number, w: number, h: number}>}
   */
  getMatchCoordinates(pageNum, query) {
    const entry = this.pages.get(pageNum);
    if (!entry) return [];

    const queryLower = query.toLowerCase();
    const coords = [];

    for (const word of entry.words) {
      if (word.word.toLowerCase().includes(queryLower)) {
        coords.push({ x: word.x, y: word.y, w: word.w, h: word.h });
      }
    }

    return coords;
  }

  /**
   * Get text for a specific page.
   * @param {number} pageNum
   * @returns {string}
   */
  getPageText(pageNum) {
    return this.pages.get(pageNum)?.fullText || '';
  }

  /**
   * Get all indexed pages.
   * @returns {number[]}
   */
  getIndexedPages() {
    return [...this.pages.keys()].sort((a, b) => a - b);
  }

  /**
   * Get total indexed word count.
   * @returns {number}
   */
  getWordCount() {
    let count = 0;
    for (const entry of this.pages.values()) {
      count += entry.words.length;
    }
    return count;
  }

  /**
   * Clear the entire index.
   */
  clear() {
    this.pages.clear();
    this._ms = new MiniSearch({
      fields: ['text'],
      storeFields: ['pageNum'],
      searchOptions: { fuzzy: 0.2, prefix: true },
    });
  }

  /**
   * Export index as JSON.
   * @returns {object}
   */
  export() {
    return {
      pages: Object.fromEntries(
        [...this.pages.entries()].map(([k, v]) => [k, {
          text: v.fullText,
          words: v.words,
        }])
      ),
      history: this.history,
    };
  }

  /**
   * Import index from JSON.
   * @param {object} data
   */
  import(data) {
    if (data.pages) {
      for (const [pageStr, entry] of Object.entries(data.pages)) {
        const pageNum = parseInt(pageStr);
        this.indexPage(pageNum, entry.text, entry.words?.map(w => ({
          text: w.word,
          bbox: { x0: w.x, y0: w.y, x1: w.x + w.w, y1: w.y + w.h },
        })));
      }
    }
    if (data.history) {
      this.history = data.history.slice(0, this.maxHistory);
    }
  }

  // ─── Search History ─────────────────────────────────────────────────────

  _addToHistory(query) {
    const trimmed = query.trim();
    if (!trimmed) return;
    this.history = this.history.filter(h => h !== trimmed);
    this.history.unshift(trimmed);
    if (this.history.length > this.maxHistory) this.history.length = this.maxHistory;
  }

  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }
}
