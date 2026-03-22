// @ts-check
/**
 * @module word-level-diff
 * @description Word-level and character-level text diff for PDF comparison.
 *
 * Provides finer granularity than the existing line-level diff in pdf-compare.js.
 * Uses the Myers diff algorithm (O(ND)) for optimal edit sequences.
 *
 * Features:
 *   • Word-level diff with inline highlighting
 *   • Character-level diff within changed words
 *   • Side-by-side and unified diff views
 *   • Change statistics (additions, deletions, modifications)
 *   • HTML rendering for diff visualization
 *   • PDF text extraction integration via pdf.js
 *
 * Usage:
 *   import { diffWords, diffChars, diffPdfPages, DiffViewer } from './word-level-diff.js';
 *
 *   const result = diffWords(textA, textB);
 *   const html   = renderDiffHtml(result);
 */

import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {'equal'|'insert'|'delete'|'replace'} DiffOp
 */

/**
 * @typedef {Object} DiffChunk
 * @property {DiffOp} op
 * @property {string} textA    - original text (empty for inserts)
 * @property {string} textB    - new text (empty for deletes)
 * @property {number} indexA   - position in source A
 * @property {number} indexB   - position in source B
 */

/**
 * @typedef {Object} DiffResult
 * @property {DiffChunk[]} chunks
 * @property {Object}      stats  - { equal, inserted, deleted, replaced, totalA, totalB }
 */

// ---------------------------------------------------------------------------
// Public API — Core diff
// ---------------------------------------------------------------------------

/**
 * Word-level diff between two strings.
 *
 * @param {string} textA - original
 * @param {string} textB - modified
 * @returns {DiffResult}
 */
export function diffWords(textA, textB) {
  const wordsA = _tokenizeWords(textA);
  const wordsB = _tokenizeWords(textB);
  const ops    = _myersDiff(wordsA, wordsB);
  return /** @type {any} */ (_buildResult(ops, wordsA, wordsB));
}

/**
 * Character-level diff between two strings.
 *
 * @param {string} textA
 * @param {string} textB
 * @returns {DiffResult}
 */
export function diffChars(textA, textB) {
  const charsA = [...textA];
  const charsB = [...textB];
  const ops    = _myersDiff(charsA, charsB);
  return /** @type {any} */ (_buildResult(ops, charsA, charsB));
}

/**
 * Line-level diff (for larger documents).
 *
 * @param {string} textA
 * @param {string} textB
 * @returns {DiffResult}
 */
export function diffLines(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const ops    = _myersDiff(linesA, linesB);
  return /** @type {any} */ (_buildResult(ops, linesA, linesB));
}

// ---------------------------------------------------------------------------
// Public API — PDF integration
// ---------------------------------------------------------------------------

/**
 * Extract text from two PDFs and produce a word-level diff.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytesA
 * @param {Uint8Array|ArrayBuffer} pdfBytesB
 * @param {Object} [opts]
 * @param {number}  [opts.pageA=1]  - page to compare from A (1-based)
 * @param {number}  [opts.pageB=1]
 * @param {string}  [opts.granularity='word']  - 'word' | 'char' | 'line'
 * @returns {Promise<DiffResult>}
 */
export async function diffPdfPages(pdfBytesA, pdfBytesB, opts = {}) {
  const pageA = opts.pageA ?? 1;
  const pageB = opts.pageB ?? 1;
  const gran  = opts.granularity ?? 'word';

  const [textA, textB] = await Promise.all([
    _extractPageText(pdfBytesA, pageA),
    _extractPageText(pdfBytesB, pageB),
  ]);

  if (gran === 'char') return diffChars(textA, textB);
  if (gran === 'line') return diffLines(textA, textB);
  return diffWords(textA, textB);
}

/**
 * Diff all pages of two PDFs (full document comparison).
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytesA
 * @param {Uint8Array|ArrayBuffer} pdfBytesB
 * @param {Object} [opts]
 * @param {string} [opts.granularity='word']
 * @returns {Promise<{ pages: Array<{ pageNum: number, diff: DiffResult }>, stats: Object }>}
 */
export async function diffPdfDocuments(pdfBytesA, pdfBytesB, opts = {}) {
  const gran = opts.granularity ?? 'word';
  const dataA = pdfBytesA instanceof Uint8Array ? pdfBytesA : new Uint8Array(pdfBytesA);
  const dataB = pdfBytesB instanceof Uint8Array ? pdfBytesB : new Uint8Array(pdfBytesB);

  const docA = await getDocument({ data: dataA.slice() }).promise;
  const docB = await getDocument({ data: dataB.slice() }).promise;

  const maxPages = Math.max(docA.numPages, docB.numPages);
  const pages    = [];

  let totalEqual = 0, totalInserted = 0, totalDeleted = 0, totalReplaced = 0;

  for (let i = 1; i <= maxPages; i++) {
    const textA = i <= docA.numPages ? await _extractPageTextFromDoc(docA, i) : '';
    const textB = i <= docB.numPages ? await _extractPageTextFromDoc(docB, i) : '';

    const fn = gran === 'char' ? diffChars : gran === 'line' ? diffLines : diffWords;
    const diff = fn(textA, textB);

    pages.push({ pageNum: i, diff });
    totalEqual    += diff.stats.equal;
    totalInserted += diff.stats.inserted;
    totalDeleted  += diff.stats.deleted;
    totalReplaced += diff.stats.replaced;
  }

  docA.destroy();
  docB.destroy();

  return {
    pages,
    stats: {
      totalPages: maxPages,
      equal:    totalEqual,
      inserted: totalInserted,
      deleted:  totalDeleted,
      replaced: totalReplaced,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API — HTML rendering
// ---------------------------------------------------------------------------

/**
 * Render a DiffResult as inline HTML with colour highlighting.
 *
 * @param {DiffResult} result
 * @param {Object} [opts]
 * @param {string} [opts.mode='inline'] - 'inline' | 'side-by-side'
 * @returns {string} - HTML string
 */
export function renderDiffHtml(result, opts = {}) {
  const mode = opts.mode ?? 'inline';

  if (mode === 'side-by-side') {
    return _renderSideBySide(result);
  }

  return _renderInline(result);
}

// ---------------------------------------------------------------------------
// DiffViewer — UI controller
// ---------------------------------------------------------------------------

export class DiffViewer {
  /**
   * @param {HTMLElement} container
   * @param {Object} [opts]
   * @param {string} [opts.mode='inline']
   */
  constructor(container, opts = {}) {
    this._container = container;
    this._mode      = opts.mode ?? 'inline';
    this._result    = null;
    this._panel     = null;
  }

  /**
   * Show the diff result.
   * @param {DiffResult} result
   */
  show(result) {
    this._result = result;
    this._render();
  }

  /** Set display mode. */
  setMode(mode) {
    this._mode = mode;
    if (this._result) this._render();
  }

  close() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  _render() {
    if (this._panel) this._panel.remove();

    this._panel = document.createElement('div');
    this._panel.style.cssText = [
      'background:#1e1e1e', 'color:#d4d4d4', 'font-family:monospace',
      'font-size:13px', 'padding:16px', 'border-radius:6px',
      'overflow:auto', 'max-height:80vh', 'line-height:1.6',
    ].join(';');

    // Stats bar
    const stats = this._result.stats;
    const bar = document.createElement('div');
    bar.style.cssText = 'margin-bottom:12px;padding:8px;background:#2d2d2d;border-radius:4px;font-size:12px;display:flex;gap:16px';
    bar.innerHTML = [
      `<span style="color:#4caf50">+${stats.inserted} inserted</span>`,
      `<span style="color:#f44336">-${stats.deleted} deleted</span>`,
      `<span style="color:#ff9800">${stats.replaced} replaced</span>`,
      `<span style="color:#888">${stats.equal} unchanged</span>`,
    ].join('');
    this._panel.appendChild(bar);

    // Mode toggle
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'margin-bottom:8px;display:flex;gap:8px';

    for (const m of ['inline', 'side-by-side']) {
      const btn = document.createElement('button');
      btn.textContent = m === 'inline' ? 'Inline' : 'Side-by-Side';
      btn.style.cssText = [
        'padding:3px 10px', 'border:1px solid #555', 'border-radius:3px',
        'font-size:12px', 'cursor:pointer',
        m === this._mode ? 'background:#0078d4;color:#fff;border-color:#0078d4' : 'background:#2d2d2d;color:#ddd',
      ].join(';');
      btn.addEventListener('click', () => this.setMode(m));
      toggleRow.appendChild(btn);
    }
    this._panel.appendChild(toggleRow);

    // Diff content
    const content = document.createElement('div');
    content.innerHTML = renderDiffHtml(this._result, { mode: this._mode });
    this._panel.appendChild(content);

    this._container.appendChild(this._panel);
  }
}

// ---------------------------------------------------------------------------
// Myers diff algorithm
// ---------------------------------------------------------------------------

/**
 * Myers O(ND) diff algorithm.
 * Returns an array of operations: 'E' (equal), 'I' (insert), 'D' (delete).
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Array<{ op: 'E'|'I'|'D', idxA: number, idxB: number }>}
 */
function _myersDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;

  if (max === 0) return [];

  // Shortcut for identical sequences
  if (n === m && a.every((v, i) => v === b[i])) {
    return a.map((_, i) => ({ op: 'E', idxA: i, idxB: i }));
  }

  // For very long sequences, fall back to a simpler LCS-based approach
  if (max > 10000) {
// @ts-ignore
    return _simpleDiff(a, b);
  }

  const v = new Map();
  v.set(0, 0);
  const trace = [];

  outer:
  for (let d = 0; d <= max; d++) {
    const vCopy = new Map(v);
    trace.push(vCopy);

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) {
        x = v.get(k + 1) ?? 0;
      } else {
        x = (v.get(k - 1) ?? 0) + 1;
      }

      let y = x - k;

      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }

      v.set(k, x);

      if (x >= n && y >= m) break outer;
    }
  }

  // Backtrack to find the edit path
// @ts-ignore
  return _backtrack(trace, a, b);
}

function _backtrack(trace, a, b) {
  const ops = [];
  let x = a.length;
  let y = b.length;

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;

    let prevK;
    if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = d > 0 ? (trace[d - 1].get(prevK) ?? 0) : 0;
    const prevY = prevX - prevK;

    // Diagonal moves (equal)
    while (x > prevX && y > prevY) {
      x--; y--;
      ops.unshift({ op: 'E', idxA: x, idxB: y });
    }

    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        ops.unshift({ op: 'I', idxA: x, idxB: y });
      } else {
        // Delete
        x--;
        ops.unshift({ op: 'D', idxA: x, idxB: y });
      }
    }
  }

  return ops;
}

/**
 * Simple fallback diff for very long sequences.
 */
function _simpleDiff(a, b) {
  const ops = [];
  let ia = 0, ib = 0;

  while (ia < a.length && ib < b.length) {
    if (a[ia] === b[ib]) {
      ops.push({ op: 'E', idxA: ia, idxB: ib });
      ia++; ib++;
    } else {
      // Look ahead for a match
      const matchInB = b.indexOf(a[ia], ib);
      const matchInA = a.indexOf(b[ib], ia);

      if (matchInB !== -1 && (matchInA === -1 || matchInB - ib <= matchInA - ia)) {
        // Insert items from B until we reach the match
        while (ib < matchInB) {
          ops.push({ op: 'I', idxA: ia, idxB: ib });
          ib++;
        }
      } else if (matchInA !== -1) {
        // Delete items from A until we reach the match
        while (ia < matchInA) {
          ops.push({ op: 'D', idxA: ia, idxB: ib });
          ia++;
        }
      } else {
        ops.push({ op: 'D', idxA: ia, idxB: ib });
        ia++;
        ops.push({ op: 'I', idxA: ia, idxB: ib });
        ib++;
      }
    }
  }

  while (ia < a.length) {
    ops.push({ op: 'D', idxA: ia, idxB: ib });
    ia++;
  }
  while (ib < b.length) {
    ops.push({ op: 'I', idxA: ia, idxB: ib });
    ib++;
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Result building
// ---------------------------------------------------------------------------

function _buildResult(ops, tokensA, tokensB) {
  const chunks = [];
  let equal = 0, inserted = 0, deleted = 0, replaced = 0;

  let i = 0;
  while (i < ops.length) {
    const op = ops[i];

    if (op.op === 'E') {
      chunks.push({
        op: 'equal',
        textA: tokensA[op.idxA],
        textB: tokensB[op.idxB],
        indexA: op.idxA,
        indexB: op.idxB,
      });
      equal++;
      i++;
    } else if (op.op === 'D' && i + 1 < ops.length && ops[i + 1].op === 'I') {
      // Delete+Insert = Replace
      chunks.push({
        op: 'replace',
        textA: tokensA[op.idxA],
        textB: tokensB[ops[i + 1].idxB],
        indexA: op.idxA,
        indexB: ops[i + 1].idxB,
      });
      replaced++;
      i += 2;
    } else if (op.op === 'D') {
      chunks.push({
        op: 'delete',
        textA: tokensA[op.idxA],
        textB: '',
        indexA: op.idxA,
        indexB: op.idxB,
      });
      deleted++;
      i++;
    } else if (op.op === 'I') {
      chunks.push({
        op: 'insert',
        textA: '',
        textB: tokensB[op.idxB],
        indexA: op.idxA,
        indexB: op.idxB,
      });
      inserted++;
      i++;
    } else {
      i++;
    }
  }

  return {
    chunks,
    stats: {
      equal, inserted, deleted, replaced,
      totalA: tokensA.length,
      totalB: tokensB.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

function _tokenizeWords(text) {
  // Split on whitespace, keeping whitespace as separate tokens for accurate positioning
  return text.split(/(\s+)/).filter(t => t.length > 0);
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function _renderInline(result) {
  const parts = [];

  for (const chunk of result.chunks) {
    switch (chunk.op) {
      case 'equal':
        parts.push(_esc(chunk.textA));
        break;
      case 'insert':
        parts.push(`<span style="background:#1b5e20;color:#a5d6a7;text-decoration:none">${_esc(chunk.textB)}</span>`);
        break;
      case 'delete':
        parts.push(`<span style="background:#b71c1c;color:#ef9a9a;text-decoration:line-through">${_esc(chunk.textA)}</span>`);
        break;
      case 'replace':
        parts.push(`<span style="background:#b71c1c;color:#ef9a9a;text-decoration:line-through">${_esc(chunk.textA)}</span>`);
        parts.push(`<span style="background:#1b5e20;color:#a5d6a7">${_esc(chunk.textB)}</span>`);
        break;
    }
  }

  return `<div style="white-space:pre-wrap;word-wrap:break-word">${parts.join('')}</div>`;
}

function _renderSideBySide(result) {
  const leftParts  = [];
  const rightParts = [];

  for (const chunk of result.chunks) {
    switch (chunk.op) {
      case 'equal':
        leftParts.push(_esc(chunk.textA));
        rightParts.push(_esc(chunk.textB));
        break;
      case 'insert':
        leftParts.push(`<span style="opacity:0.3">${'·'.repeat(chunk.textB.length)}</span>`);
        rightParts.push(`<span style="background:#1b5e20;color:#a5d6a7">${_esc(chunk.textB)}</span>`);
        break;
      case 'delete':
        leftParts.push(`<span style="background:#b71c1c;color:#ef9a9a">${_esc(chunk.textA)}</span>`);
        rightParts.push(`<span style="opacity:0.3">${'·'.repeat(chunk.textA.length)}</span>`);
        break;
      case 'replace':
        leftParts.push(`<span style="background:#b71c1c;color:#ef9a9a">${_esc(chunk.textA)}</span>`);
        rightParts.push(`<span style="background:#1b5e20;color:#a5d6a7">${_esc(chunk.textB)}</span>`);
        break;
    }
  }

  return [
    '<div style="display:flex;gap:12px">',
    `<div style="flex:1;white-space:pre-wrap;word-wrap:break-word;padding:8px;background:#1e1e1e;border-radius:4px">${leftParts.join('')}</div>`,
    `<div style="flex:1;white-space:pre-wrap;word-wrap:break-word;padding:8px;background:#1e1e1e;border-radius:4px">${rightParts.join('')}</div>`,
    '</div>',
  ].join('');
}

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function _extractPageText(pdfBytes, pageNum) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const doc  = await getDocument({ data: data.slice() }).promise;
  const text = await _extractPageTextFromDoc(doc, pageNum);
  doc.destroy();
  return text;
}

async function _extractPageTextFromDoc(doc, pageNum) {
  if (pageNum > doc.numPages) return '';
  const page    = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items.map(item => item.str ?? '').join(' ');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
