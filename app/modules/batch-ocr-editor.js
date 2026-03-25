// @ts-check
/**
 * @module batch-ocr-editor
 * @description Phase 7 — Batch OCR + Edit pipeline.
 *
 * Orchestrates OCR, text correction, and inline editing across a range of
 * pages in a single pass.  Designed for scanned document workflows where
 * the user wants to:
 *   1. Run OCR on all (or selected) pages
 *   2. Auto-correct common OCR errors (ligatures, quotes, hyphens)
 *   3. Optionally apply find-and-replace across all OCR results
 *   4. Bake the corrected text layer back into the PDF
 *
 * Integration:
 *   import { BatchOcrEditor } from './batch-ocr-editor.js';
 *
 *   const batch = new BatchOcrEditor(pdfBytes, {
 *     pages:       [1, 2, 3, 5],   // 1-based; omit = all pages
 *     language:    'eng',
 *     autoCorrect: true,
 *     replacements: [{ find: /teh/gi, replace: 'the' }],
 *     onProgress:  (p) => console.log(`${p.page}/${p.total}  ${p.phase}`),
 *   });
 *
 *   const result = await batch.run();
 *   // result.pdfBytes   - Uint8Array with embedded text layer
 *   // result.pages      - per-page OcrPageResult[]
 *   // result.stats      - { totalChars, correctedChars, avgConfidence }
 */

import { getDocument } from 'pdfjs-dist/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import { getTesseractWorkerOpts } from './tesseract-adapter.js';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} BatchOcrOptions
 * @property {number[]}        [pages]         - 1-based page numbers to process (default: all)
 * @property {string}          [language='eng'] - Tesseract language code
 * @property {boolean}         [autoCorrect=true]
 * @property {Array<{find: string|RegExp, replace: string}>} [replacements=[]]
 * @property {number}          [dpi=300]        - target DPI for OCR render
 * @property {boolean}         [embedTextLayer=true] - bake invisible text into PDF
 * @property {Function}        [onProgress]     - (ProgressEvent) => void
 * @property {number}          [concurrency=2]  - parallel OCR workers
 */

/**
 * @typedef {Object} OcrPageResult
 * @property {number}  page          - 1-based
 * @property {string}  rawText       - before corrections
 * @property {string}  correctedText - after corrections
 * @property {number}  confidence    - 0-100
 * @property {number}  corrections   - number of chars changed
 * @property {Object[]} charBoxes    - character-level bounding boxes
 */

/**
 * @typedef {Object} BatchOcrResult
 * @property {Uint8Array}      pdfBytes
 * @property {OcrPageResult[]} pages
 * @property {Object}          stats
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DPI         = 300;
const DEFAULT_LANGUAGE    = 'eng';
const DEFAULT_CONCURRENCY = 2;

// Ligature restoration map
const LIGATURE_MAP = [
  [/ﬁ/g,  'fi'],
  [/ﬂ/g,  'fl'],
  [/ﬀ/g,  'ff'],
  [/ﬃ/g,  'ffi'],
  [/ﬄ/g,  'ffl'],
  [/ﬅ/g,  'st'],
];

// Smart quote normalization
const QUOTE_FIX = [
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  [/\u2026/g, '...'],
  [/[\u2013\u2014]/g, '-'],
];

// Hyphen-break repair: "word-\n  continuation" → "wordcontinuation"
const HYPHEN_BREAK = /(\w)-\s*\n\s*(\w)/g;

// ---------------------------------------------------------------------------
// BatchOcrEditor
// ---------------------------------------------------------------------------

export class BatchOcrEditor {
  /**
   * @param {Uint8Array|ArrayBuffer} pdfBytes
   * @param {BatchOcrOptions} [opts]
   */
  constructor(pdfBytes, opts = {}) {
    this._pdfBytes   = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    this._pages      = opts.pages        ?? null;   // null = all
    this._language   = opts.language     ?? DEFAULT_LANGUAGE;
    this._autoCorrect = opts.autoCorrect !== false;
    this._replacements = opts.replacements ?? [];
    this._dpi        = opts.dpi          ?? DEFAULT_DPI;
    this._embedText  = opts.embedTextLayer !== false;
    this._onProgress = opts.onProgress   ?? null;
    this._concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

    this._cancelled  = false;
  }

  /** Cancel the batch run. Already-processed pages are kept. */
  cancel() {
    this._cancelled = true;
  }

  /**
   * Execute the batch pipeline.
   * @returns {Promise<BatchOcrResult>}
   */
  async run() {
    // 1. Determine page list
    const pdfJsDoc   = await getDocument({ data: this._pdfBytes.slice() }).promise;
    const totalPages = pdfJsDoc.numPages;
    const pageNums   = this._pages
      ? this._pages.filter(n => n >= 1 && n <= totalPages)
      : Array.from({ length: totalPages }, (_, i) => i + 1);

    this._progress({ phase: 'init', page: 0, total: pageNums.length });

    // 2. Load Tesseract worker pool
    const workers = await this._createWorkers();

    // 3. Process pages with controlled concurrency
    const results = [];
    let nextIdx   = 0;

    const processOne = async (worker) => {
      while (nextIdx < pageNums.length && !this._cancelled) {
        const idx     = nextIdx++;
        const pageNum = pageNums[idx];

        this._progress({ phase: 'render', page: idx + 1, total: pageNums.length, pageNum });

        // Render page to canvas
        const canvas = await this._renderPage(pdfJsDoc, pageNum);

        this._progress({ phase: 'ocr', page: idx + 1, total: pageNums.length, pageNum });

        // Run OCR
        const ocrResult = await this._ocrPage(worker, canvas);

        // Post-process text
        const rawText       = ocrResult.text;
        const correctedText = this._postProcess(rawText);
        const corrections   = _countDifferences(rawText, correctedText);

        results.push({
          page:          pageNum,
          rawText,
          correctedText,
          confidence:    ocrResult.confidence,
          corrections,
          charBoxes:     ocrResult.charBoxes,
        });

        this._progress({ phase: 'done', page: idx + 1, total: pageNums.length, pageNum });
      }
    };

    // Launch workers in parallel
    await Promise.all(workers.map(w => processOne(w)));

    // 4. Terminate workers
    for (const w of workers) {
      await w.terminate();
    }
    pdfJsDoc.destroy();

    // Sort results by page number
    results.sort((a, b) => a.page - b.page);

    // 5. Embed text layer into PDF if requested
    let finalPdfBytes = this._pdfBytes;
    if (this._embedText && results.length > 0) {
      this._progress({ phase: 'embed', page: 0, total: results.length });
      finalPdfBytes = await this._embedTextLayer(results);
    }

    // 6. Compute stats
    const stats = this._computeStats(results);

    return { pdfBytes: finalPdfBytes, pages: results, stats };
  }

  // ── Internal: Rendering ────────────────────────────────────────────────────

  async _renderPage(pdfJsDoc, pageNum) {
    const page     = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this._dpi / 72 });

    const canvas  = document.createElement('canvas');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // ── Internal: OCR ──────────────────────────────────────────────────────────

  async _createWorkers() {
    const { createWorker } = await import('tesseract.js');
    const count = Math.min(this._concurrency, 4);
    const workerOpts = getTesseractWorkerOpts();
    const workers = [];

    for (let i = 0; i < count; i++) {
      const worker = await createWorker(this._language, 1, workerOpts);
      workers.push(worker);
    }

    return workers;
  }

  async _ocrPage(worker, canvas) {
    const { data } = await worker.recognize(canvas);

    // Extract character-level bounding boxes
    const charBoxes = [];
    if (data.words) {
      for (const word of data.words) {
        if (word.symbols) {
          for (const sym of word.symbols) {
            charBoxes.push({
              char:       sym.text,
              bbox:       sym.bbox,
              confidence: sym.confidence,
            });
          }
        }
      }
    }

    return {
      text:       data.text,
      confidence: data.confidence,
      charBoxes,
    };
  }

  // ── Internal: Text post-processing ─────────────────────────────────────────

  _postProcess(text) {
    let result = text;

    if (this._autoCorrect) {
      // Ligature restoration
      for (const [pattern, replacement] of LIGATURE_MAP) {
        result = result.replace(pattern, replacement);
      }

      // Quote normalization
      for (const [pattern, replacement] of QUOTE_FIX) {
        result = result.replace(pattern, replacement);
      }

      // Hyphen-break repair
      result = result.replace(HYPHEN_BREAK, '$1$2');

      // Common OCR error patterns
      result = result
        .replace(/\bl\b(?=[a-z])/g, 'I')         // standalone 'l' before lowercase → 'I'
        .replace(/\b0(?=[a-zA-Z])/g, 'O')         // '0' before letters → 'O'
        .replace(/(?<=[a-zA-Z])0\b/g, 'O')        // '0' after letters → 'O'
        .replace(/\brn\b/g, (m, off, str) => {     // 'rn' could be 'm' — context check
          const before = str[off - 1] ?? ' ';
          return /[a-z]/.test(before) ? m : m;     // conservative: keep as-is
        });
    }

    // User-supplied find-and-replace
    for (const { find, replace } of this._replacements) {
      const pattern = typeof find === 'string' ? new RegExp(_escapeRegex(find), 'g') : find;
      result = result.replace(pattern, replace);
    }

    return result;
  }

  // ── Internal: Embed text layer ─────────────────────────────────────────────

  async _embedTextLayer(results) {
    const pdfDoc = await PDFDocument.load(this._pdfBytes);

    for (const pageResult of results) {
      const page       = pdfDoc.getPages()[pageResult.page - 1];
      if (!page) continue;

      const { width, height } = page.getSize();

      // Write invisible text at approximate positions from charBoxes
      // This creates a searchable/selectable text layer
      if (pageResult.charBoxes.length > 0) {
        this._embedCharBoxes(page, pageResult, width, height);
      } else {
        // Fallback: single text block at top of page
        this._embedPlainText(page, pageResult.correctedText, width, height);
      }
    }

    const bytes = await pdfDoc.save();
    return new Uint8Array(bytes);
  }

  _embedCharBoxes(page, pageResult, pageWidthPt, pageHeightPt) {
    const charBoxes = pageResult.charBoxes;
    if (charBoxes.length === 0) return;

    // Determine render dimensions from bbox ranges
    const maxX = Math.max(...charBoxes.map(c => c.bbox.x1));
    const maxY = Math.max(...charBoxes.map(c => c.bbox.y1));
    const scaleX = pageWidthPt  / Math.max(maxX, 1);
    const scaleY = pageHeightPt / Math.max(maxY, 1);

    // Group charBoxes into lines by similar y-position
    const lines = _groupIntoLines(charBoxes);

    for (const line of lines) {
      const text    = line.map(c => c.char).join('');
      const firstBb = line[0].bbox;
      const lastBb  = line[line.length - 1].bbox;

      // Estimate font size from char height
      const charH    = (firstBb.y1 - firstBb.y0) * scaleY;
      const fontSize = Math.max(4, Math.min(72, charH * 0.85));

      const x = firstBb.x0 * scaleX;
      const y = pageHeightPt - firstBb.y1 * scaleY;  // flip Y

      // Calculate width for spacing
      const lineWidthPt = (lastBb.x1 - firstBb.x0) * scaleX;

      page.drawText(text, {
        x, y,
        size: fontSize,
        opacity: 0,   // invisible text layer
        maxWidth: lineWidthPt > 0 ? lineWidthPt : undefined,
      });
    }
  }

  _embedPlainText(page, text, _pageWidthPt, pageHeightPt) {
    const lines    = text.split('\n').filter(l => l.trim());
    const fontSize = 10;
    const leading  = 14;
    let y          = pageHeightPt - 36;  // start 0.5" from top

    for (const line of lines) {
      if (y < 36) break;   // stop near bottom margin
      page.drawText(line.slice(0, 200), {
        x: 36,
        y,
        size: fontSize,
        opacity: 0,
      });
      y -= leading;
    }
  }

  // ── Internal: Stats ────────────────────────────────────────────────────────

  _computeStats(results) {
    let totalChars     = 0;
    let correctedChars = 0;
    let confidenceSum  = 0;

    for (const r of results) {
      totalChars     += r.correctedText.length;
      correctedChars += r.corrections;
      confidenceSum  += r.confidence;
    }

    return {
      pagesProcessed: results.length,
      totalChars,
      correctedChars,
      avgConfidence: results.length > 0 ? Math.round(confidenceSum / results.length * 100) / 100 : 0,
    };
  }

  // ── Internal: Progress ─────────────────────────────────────────────────────

  _progress(event) {
    if (this._onProgress) this._onProgress(event);
  }
}

// ---------------------------------------------------------------------------
// Batch find-and-replace (standalone)
// ---------------------------------------------------------------------------

/**
 * Apply a set of find-and-replace rules across OCR text for multiple pages.
 *
 * @param {OcrPageResult[]} pageResults
 * @param {Array<{find: string|RegExp, replace: string}>} replacements
 * @returns {OcrPageResult[]} - new array with updated correctedText
 */
export function batchFindReplace(pageResults, replacements) {
  return pageResults.map(r => {
    let text = r.correctedText;
    for (const { find, replace } of replacements) {
      const pattern = typeof find === 'string' ? new RegExp(_escapeRegex(find), 'g') : find;
      text = text.replace(pattern, replace);
    }
    return { ...r, correctedText: text, corrections: _countDifferences(r.rawText, text) };
  });
}

/**
 * Generate a summary report of the batch OCR results.
 *
 * @param {BatchOcrResult} result
 * @returns {string}
 */
export function generateBatchReport(result) {
  const { stats, pages } = result;
  const lines = [
    `=== Batch OCR Report ===`,
    `Pages processed: ${stats.pagesProcessed}`,
    `Total characters: ${stats.totalChars.toLocaleString()}`,
    `Characters corrected: ${stats.correctedChars.toLocaleString()}`,
    `Average confidence: ${stats.avgConfidence}%`,
    '',
    '--- Per-Page Summary ---',
  ];

  for (const p of pages) {
    lines.push(
      `  Page ${p.page}: ${p.correctedText.length} chars, ` +
      `${p.confidence.toFixed(1)}% confidence, ` +
      `${p.corrections} corrections`,
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _countDifferences(a, b) {
  let count = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) count++;
  }
  return count;
}

function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Group character boxes into lines based on y-position proximity.
 */
function _groupIntoLines(charBoxes) {
  if (charBoxes.length === 0) return [];

  // Sort by y0 then x0
  const sorted = [...charBoxes].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  const lines   = [];
  let currentLine = [sorted[0]];
  let currentY    = sorted[0].bbox.y0;
  const tolerance = (sorted[0].bbox.y1 - sorted[0].bbox.y0) * 0.5;

  for (let i = 1; i < sorted.length; i++) {
    const cb = sorted[i];
    if (Math.abs(cb.bbox.y0 - currentY) <= tolerance) {
      currentLine.push(cb);
    } else {
      // Sort current line by x position
      currentLine.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      lines.push(currentLine);
      currentLine = [cb];
      currentY    = cb.bbox.y0;
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    lines.push(currentLine);
  }

  return lines;
}
