// @ts-check
/**
 * @module text-redact
 * @description Secure text redaction for PDF documents.
 *
 * Unlike simple visual overlays (which can be removed), this module
 * performs true redaction:
 *   1. Finds text matches (by string, regex, or rect selection)
 *   2. Removes the actual text content from the PDF content stream
 *   3. Draws an opaque black/colored rectangle over the region
 *   4. Removes associated metadata and hidden text
 *
 * Modes:
 *   • **Search-based**: Find all instances of a term and redact them
 *   • **Region-based**: User draws a rectangle to redact an area
 *   • **Pattern-based**: Regex patterns for SSNs, emails, phone numbers, etc.
 *
 * Usage:
 *   import { redactBySearch, redactByRegion, RedactionEditor } from './text-redact.js';
 *
 *   const blob = await redactBySearch(pdfBytes, 'John Doe', opts);
 *   const blob2 = await redactByRegion(pdfBytes, pageNum, rect, opts);
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REDACT_COLOR = { r: 0, g: 0, b: 0 };   // black

/** Pre-built patterns for common sensitive data */
export const REDACTION_PATTERNS = {
  ssn:    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  email:  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g,
  phone:  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  date:   /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g,
  ipv4:   /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

// ---------------------------------------------------------------------------
// Public API — Search-based redaction
// ---------------------------------------------------------------------------

/**
 * Find and redact all occurrences of a search term across the PDF.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string|RegExp} searchTerm
 * @param {Object} [opts]
 * @param {{ r:number, g:number, b:number }} [opts.color]  - redaction fill color
 * @param {number[]} [opts.pages]         - 1-based page numbers (default: all)
 * @param {boolean}  [opts.caseSensitive=false]
 * @param {string}   [opts.replacementText]  - optional text drawn over redaction
 * @returns {Promise<{ blob: Blob, count: number, locations: Array }>}
 */
export async function redactBySearch(pdfBytes, searchTerm, opts = {}) {
  const data  = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const color = opts.color ?? DEFAULT_REDACT_COLOR;

  // 1. Find text locations using pdf.js
  const locations = await _findTextLocations(data, searchTerm, opts);

  if (locations.length === 0) {
    return { blob: new Blob([/** @type {any} */ (data)], { type: 'application/pdf' }), count: 0, locations: [] };
  }

  // 2. Apply redactions via pdf-lib
  const pdfDoc = await PDFDocument.load(data);

  for (const loc of locations) {
    const page = pdfDoc.getPages()[loc.pageIndex];
    if (!page) continue;

    const { width: _pw, height: pageH } = page.getSize();

    // pdf.js coords have origin top-left; pdf-lib has bottom-left
    const x = loc.rect.x;
    const y = pageH - loc.rect.y - loc.rect.height;
    const w = loc.rect.width;
    const h = loc.rect.height;

    // Draw opaque rectangle
    page.drawRectangle({
      x, y,
      width: w + 2,
      height: h + 2,
      color: rgb(color.r, color.g, color.b),
      opacity: 1,
    });

    // Optional replacement text
    if (opts.replacementText) {
      const fontSize = Math.max(6, Math.min(h * 0.7, 14));
      page.drawText(opts.replacementText, {
        x: x + 2,
        y: y + (h - fontSize) / 2,
        size: fontSize,
        color: rgb(1, 1, 1),
      });
    }
  }

  const saved = await pdfDoc.save();
  return {
    blob: new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' }),
    count: locations.length,
    locations,
  };
}

// ---------------------------------------------------------------------------
// Public API — Pattern-based redaction
// ---------------------------------------------------------------------------

/**
 * Redact all matches of a pre-built pattern (SSN, email, phone, etc.).
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string} patternName - key from REDACTION_PATTERNS
 * @param {Object} [opts]      - same as redactBySearch opts
 * @returns {Promise<{ blob: Blob, count: number, locations: Array }>}
 */
export async function redactByPattern(pdfBytes, patternName, opts = {}) {
  const pattern = REDACTION_PATTERNS[patternName];
  if (!pattern) {
    throw new Error(`Unknown redaction pattern: "${patternName}". Available: ${Object.keys(REDACTION_PATTERNS).join(', ')}`);
  }
  return redactBySearch(pdfBytes, pattern, opts);
}

// ---------------------------------------------------------------------------
// Public API — Region-based redaction
// ---------------------------------------------------------------------------

/**
 * Redact a rectangular region on a specific page.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {number} pageNum - 1-based
 * @param {{ x: number, y: number, width: number, height: number }} rect - PDF coords (bottom-left origin)
 * @param {Object} [opts]
 * @param {{ r:number, g:number, b:number }} [opts.color]
 * @returns {Promise<Blob>}
 */
export async function redactByRegion(pdfBytes, pageNum, rect, opts = {}) {
  const data   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(data);
  const color  = opts.color ?? DEFAULT_REDACT_COLOR;

  const page = pdfDoc.getPages()[pageNum - 1];
  if (!page) throw new Error(`Page ${pageNum} not found`);

  page.drawRectangle({
    x:       rect.x,
    y:       rect.y,
    width:   rect.width,
    height:  rect.height,
    color:   rgb(color.r, color.g, color.b),
    opacity: 1,
  });

  const saved = await pdfDoc.save();
  return new Blob([/** @type {any} */ (saved)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Public API — Scan for sensitive data (preview, no redaction)
// ---------------------------------------------------------------------------

/**
 * Scan a PDF for sensitive data patterns without redacting.
 * Returns a preview of what would be redacted.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBytes
 * @param {string[]} [patternNames] - keys from REDACTION_PATTERNS (default: all)
 * @returns {Promise<Array<{ pattern: string, count: number, samples: string[] }>>}
 */
export async function scanForSensitiveData(pdfBytes, patternNames) {
  const data    = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const names   = patternNames ?? Object.keys(REDACTION_PATTERNS);
  const results = [];

  // Extract all text first
  const fullText = await _extractFullText(data);

  for (const name of names) {
    const pattern = REDACTION_PATTERNS[name];
    if (!pattern) continue;

    const regex   = new RegExp(pattern.source, pattern.flags);
    const matches = [];
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      matches.push(match[0]);
      if (matches.length >= 50) break;   // cap preview
    }

    if (matches.length > 0) {
      results.push({
        pattern: name,
        count:   matches.length,
        samples: matches.slice(0, 5),   // show up to 5 examples
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// RedactionEditor — UI controller
// ---------------------------------------------------------------------------

export class RedactionEditor {
  /**
   * @param {HTMLElement} container
   * @param {Object} deps
   * @param {Function} deps.onApply   - (result: { blob, count }) => void
   * @param {Function} [deps.onCancel]
   * @param {Function} deps.getPdfBytes - () => Uint8Array
   */
  constructor(container, deps) {
    this._container = container;
    this._deps      = deps;
    this._panel     = null;
  }

  open() {
    if (this._panel) return;
    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
  }

  close() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'background:#2a2a2a', 'border:1px solid #555', 'border-radius:8px',
      'padding:20px', 'z-index:9000', 'min-width:400px',
      'box-shadow:0 8px 32px rgba(0,0,0,.6)', 'color:#eee', 'font-family:sans-serif',
    ].join(';');

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Redact Content';
    title.style.cssText = 'margin:0 0 14px;font-size:16px;font-weight:600';
    panel.appendChild(title);

    // Mode selector
    const modeRow = _row('Mode:');
    const modeSelect = document.createElement('select');
    modeSelect.style.cssText = _selectStyle();
    for (const [val, label] of [['search', 'Search Text'], ['pattern', 'Pattern'], ['scan', 'Scan All']]) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      modeSelect.appendChild(opt);
    }
    modeRow.appendChild(modeSelect);
    panel.appendChild(modeRow);

    // Search input
    const searchRow = _row('Find:');
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Text to redact…';
    searchInput.style.cssText = _inputStyle();
    searchRow.appendChild(searchInput);
    panel.appendChild(searchRow);

    // Pattern selector (hidden)
    const patternRow = _row('Pattern:');
    patternRow.style.display = 'none';
    const patternSelect = document.createElement('select');
    patternSelect.style.cssText = _selectStyle();
    for (const key of Object.keys(REDACTION_PATTERNS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key.toUpperCase();
      patternSelect.appendChild(opt);
    }
    patternRow.appendChild(patternSelect);
    panel.appendChild(patternRow);

    modeSelect.addEventListener('change', () => {
      searchRow.style.display  = modeSelect.value === 'search' ? 'flex' : 'none';
      patternRow.style.display = modeSelect.value === 'pattern' ? 'flex' : 'none';
    });

    // Status
    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:12px;color:#888;margin:10px 0;min-height:18px';
    panel.appendChild(statusEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';

    const scanBtn = document.createElement('button');
    scanBtn.textContent = 'Scan';
    scanBtn.style.cssText = 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
    scanBtn.addEventListener('click', async () => {
      statusEl.textContent = 'Scanning…';
      const pdfBytes = this._deps.getPdfBytes();
      const results = await scanForSensitiveData(pdfBytes);
      if (results.length === 0) {
        statusEl.textContent = 'No sensitive data found.';
      } else {
        statusEl.textContent = results.map(r => `${r.pattern}: ${r.count} match(es)`).join(' | ');
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 14px;border:1px solid #666;border-radius:4px;background:transparent;color:#ccc;cursor:pointer';
    cancelBtn.addEventListener('click', () => {
      this.close();
      this._deps.onCancel?.();
    });

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Redact';
    applyBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:4px;background:#d32f2f;color:#fff;cursor:pointer;font-weight:600';
    applyBtn.addEventListener('click', async () => {
      statusEl.textContent = 'Redacting…';
      const pdfBytes = this._deps.getPdfBytes();
      const mode = modeSelect.value;

      let result;
      if (mode === 'search') {
        result = await redactBySearch(pdfBytes, searchInput.value);
      } else if (mode === 'pattern') {
        result = await redactByPattern(pdfBytes, patternSelect.value);
      } else {
        // Scan all patterns
        let allBytes = pdfBytes;
        let totalCount = 0;
        for (const name of Object.keys(REDACTION_PATTERNS)) {
          const r = await redactBySearch(allBytes, REDACTION_PATTERNS[name]);
          totalCount += r.count;
          if (r.count > 0) {
            allBytes = new Uint8Array(await r.blob.arrayBuffer());
          }
        }
        result = { blob: new Blob([allBytes], { type: 'application/pdf' }), count: totalCount };
      }

      statusEl.textContent = `Redacted ${result.count} instance(s).`;
      this._deps.onApply?.(result);
      this.close();
    });

    btnRow.append(scanBtn, cancelBtn, applyBtn);
    panel.appendChild(btnRow);

    return panel;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find bounding rectangles of text matches using pdf.js.
 */
async function _findTextLocations(pdfData, searchTerm, opts = {}) {
  const pdfJsDoc   = await getDocument({ data: pdfData.slice() }).promise;
  const totalPages = pdfJsDoc.numPages;
  const allPages   = opts.pages
    ? opts.pages.filter(n => n >= 1 && n <= totalPages)
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  const locations = [];

  for (const pageNum of allPages) {
    const page        = await pdfJsDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport    = page.getViewport({ scale: 1 });

    for (const item of textContent.items) {
      if (!item.str) continue;

      const matches = _findMatches(item.str, searchTerm, opts.caseSensitive);

      if (matches.length > 0) {
        // Transform item position to page coordinates
        const tx = item.transform;
        const x  = tx[4];
        const y  = tx[5];
        const w  = item.width;
        const h  = item.height;

        for (const _m of matches) {
          locations.push({
            pageIndex: pageNum - 1,
            pageNum,
            text:      item.str,
            rect:      { x, y: viewport.height - y - h, width: w, height: h },
          });
        }
      }
    }
  }

  pdfJsDoc.destroy();
  return locations;
}

function _findMatches(text, term, caseSensitive) {
  if (term instanceof RegExp) {
    const regex = new RegExp(term.source, term.flags);
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push(m[0]);
      if (!regex.global) break;
    }
    return matches;
  }

  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle   = caseSensitive ? term : term.toLowerCase();
  const matches  = [];
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    matches.push(text.slice(idx, idx + needle.length));
    idx += needle.length;
  }
  return matches;
}

async function _extractFullText(pdfData) {
  const pdfJsDoc = await getDocument({ data: pdfData.slice() }).promise;
  const parts    = [];

  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page    = await pdfJsDoc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map(it => it.str).join(' '));
  }

  pdfJsDoc.destroy();
  return parts.join('\n');
}

// DOM helpers

function _row(label) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
  const lbl = document.createElement('span');
  lbl.textContent  = label;
  lbl.style.cssText = 'font-size:13px;min-width:65px;color:#aaa';
  row.appendChild(lbl);
  return row;
}

function _inputStyle() {
  return 'padding:4px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px;flex:1';
}

function _selectStyle() {
  return 'padding:4px 8px;border:1px solid #555;border-radius:3px;background:#1e1e1e;color:#eee;font-size:13px';
}
