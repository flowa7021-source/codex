// @ts-check
// ═══════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Batch OCR & Searchable PDF Module
// Full-document OCR processing with progress tracking
// and embedding recognized text as invisible text layer into PDF
// ═══════════════════════════════════════════════════════════════════════

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─────────────────────────────────────────────────────────────────────
// Batch OCR Processor
// ─────────────────────────────────────────────────────────────────────

export class BatchOcrProcessor {
  constructor() {
    this.results = new Map();   // pageNum → { words: [], text: '' }
    this.cancelled = false;
    this._listeners = [];
  }

  /**
   * Run OCR on all pages (or a range) of a document.
   * @param {Object} params
   * @param {Function} params.renderPage - async (pageNum) => canvas
   * @param {Function} params.recognizeFn - async (canvas, lang) => { text, words }
   * @param {number} params.totalPages
   * @param {number[]} [params.pageRange] - specific pages to OCR (1-indexed)
   * @param {string} [params.language='rus']
   * @param {Function} [params.onProgress] - (pageNum, totalPages, status) => void
   */
  async processAll(params) {
    const {
      renderPage,
      recognizeFn,
      totalPages,
      pageRange = null,
      language = 'rus',
      onProgress = () => {},
    } = params;

    this.cancelled = false;
    this.results.clear();

    const pages = pageRange || Array.from({ length: totalPages }, (_, i) => i + 1);
    let processed = 0;

    for (const pageNum of pages) {
      if (this.cancelled) {
        this._emit('cancelled', { processed, total: pages.length });
        return { processed, total: pages.length, cancelled: true };
      }

      onProgress(pageNum, pages.length, `OCR страница ${pageNum}/${pages.length}...`);
      this._emit('page-start', { pageNum, processed, total: pages.length });

      try {
        const canvas = await renderPage(pageNum);
        const result = await recognizeFn(canvas, language);

        this.results.set(pageNum, {
          text: result.text || '',
          words: result.words || [],
          confidence: result.confidence || 0,
          imageWidth: canvas.width,
          imageHeight: canvas.height,
        });

        processed++;
        this._emit('page-done', { pageNum, processed, total: pages.length, text: result.text });
      } catch (err) {
        this._emit('page-error', { pageNum, error: err.message });
        // Continue with next page
        processed++;
      }
    }

    onProgress(0, pages.length, `OCR завершён: ${processed} страниц`);
    this._emit('done', { processed, total: pages.length });

    return {
      processed,
      total: pages.length,
      cancelled: false,
      results: this.results,
    };
  }

  /** Cancel ongoing OCR processing */
  cancel() {
    this.cancelled = true;
  }

  /** Get results for a specific page */
  getPageResult(pageNum) {
    return this.results.get(pageNum);
  }

  /** Get full text of all processed pages */
  getFullText(separator = '\n\n--- Страница {{page}} ---\n\n') {
    const pages = [...this.results.entries()]
      .sort(([a], [b]) => a - b)
      .map(([pageNum, data]) => {
        const header = separator.replace('{{page}}', String(pageNum));
        return header + data.text;
      });
    return pages.join('');
  }

  /** Subscribe to events */
  on(event, fn) {
    this._listeners.push({ event, fn });
    return () => { this._listeners = this._listeners.filter(l => l.fn !== fn); };
  }

  _emit(event, data) {
    for (const l of this._listeners) {
      if (l.event === event || l.event === '*') l.fn(event, data);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Searchable PDF Creator
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a searchable PDF by embedding invisible OCR text into an existing PDF.
 * The text is positioned to match the original scan, making it searchable and copyable.
 *
 * @param {ArrayBuffer|Uint8Array} pdfBytes - Original PDF bytes
 * @param {Map<number, Object>} ocrResults - Map of pageNum → { words, imageWidth, imageHeight, confidence }
 * @param {object} [options]
 * @param {number} [options.minConfidence=30] - Skip words below this Tesseract confidence (0–100)
 * @returns {Promise<{blob: Blob, pagesProcessed: number, stats: object}>}
 */
export async function createSearchablePdf(pdfBytes, ocrResults, options = {}) {
  const minConfidence = options.minConfidence ?? 30;

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Helvetica (WinAnsi) — covers Latin characters.
  // Cyrillic words: drawText throws on unencodable chars → caught and skipped.
  // The invisible text layer still benefits Latin OCR output; Cyrillic results
  // are embedded where pdf-lib successfully encodes them.
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let pagesProcessed = 0;
  let totalWords = 0;
  let acceptedWords = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const [pageNum, ocrData] of ocrResults) {
    const page = pdfDoc.getPage(pageNum - 1);
    if (!page) continue;

    const { width, height } = page.getSize();
    const imgW = ocrData.imageWidth || width;
    const imgH = ocrData.imageHeight || height;
    const scaleX = width / imgW;
    const scaleY = height / imgH;

    // Accumulate page-level confidence for QA
    if (typeof ocrData.confidence === 'number' && ocrData.confidence > 0) {
      confidenceSum += ocrData.confidence;
      confidenceCount++;
    }

    const words = ocrData.words || [];
    totalWords += words.length;

    for (const word of words) {
      if (!word.text || !word.text.trim()) continue;

      // Skip low-confidence words — they add noise to the text layer
      const conf = word.confidence ?? 100;
      if (conf < minConfidence) continue;

      // Tesseract bbox: { x0, y0, x1, y1 } in image pixels (y0=top)
      const bx = word.bbox?.x0 ?? word.x ?? 0;
      const by = word.bbox?.y0 ?? word.y ?? 0;
      const bh = (word.bbox ? (word.bbox.y1 - word.bbox.y0) : word.h) || 12;

      // PDF coordinate origin is bottom-left; Tesseract is top-left → flip Y
      const pdfX = bx * scaleX;
      const pdfY = height - (by + bh) * scaleY;
      const fontSize = Math.max(1, Math.min(72, bh * scaleY * 0.85));

      try {
        page.drawText(word.text, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,   // Invisible — for search and copy only
        });
        acceptedWords++;
      } catch (_err) {
        // Characters outside WinAnsi range (Cyrillic, CJK) → silently skip
      }
    }

    pagesProcessed++;
  }

  try {
    pdfDoc.setProducer('NovaReader OCR (Tesseract)');
  } catch (_err) { /* non-critical */ }

  const savedBytes = await pdfDoc.save();
  return {
    blob: new Blob([/** @type {any} */ (savedBytes)], { type: 'application/pdf' }),
    pagesProcessed,
    stats: {
      pagesProcessed,
      totalWords,
      acceptedWords,
      avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Scan Detection
// ─────────────────────────────────────────────────────────────────────

/**
 * Detect if a PDF page is a scanned image (no text layer).
 * Checks for the presence of extractable text content.
 *
 * @param {Object} pdfPage - PDF.js page object
 * @returns {Promise<boolean>} true if the page appears to be a scan
 */
export async function isScannedPage(pdfPage) {
  try {
    const textContent = await pdfPage.getTextContent();
    const text = textContent.items.map(item => item.str).join('').trim();

    // If very little text (< 10 chars), likely a scan
    return text.length < 10;
  } catch (err) {
    console.warn('[ocr-batch] error:', err?.message);
    return true; // If we can't extract text, treat as scan
  }
}

/**
 * Detect if a document is primarily scanned images.
 * Checks a sample of pages.
 *
 * @param {Object} pdfDocument - PDF.js document
 * @param {number} [sampleSize=5] - Number of pages to check
 * @returns {Promise<Object>} { isScanned, scannedPages, totalChecked, confidence }
 */
export async function detectScannedDocument(pdfDocument, sampleSize = 5) {
  const totalPages = pdfDocument.numPages;
  const pagesToCheck = Math.min(sampleSize, totalPages);

  // Check evenly distributed pages
  const indices = [];
  for (let i = 0; i < pagesToCheck; i++) {
    indices.push(Math.floor((i / pagesToCheck) * totalPages) + 1);
  }

  let scannedCount = 0;
  for (const pageNum of indices) {
    const page = await pdfDocument.getPage(pageNum);
    if (await isScannedPage(page)) scannedCount++;
  }

  const ratio = scannedCount / pagesToCheck;

  return {
    isScanned: ratio > 0.5,
    scannedPages: scannedCount,
    totalChecked: pagesToCheck,
    confidence: ratio,
    recommendation: ratio > 0.5
      ? `Документ содержит сканированные страницы (${scannedCount}/${pagesToCheck} проверенных). Рекомендуется запустить OCR.`
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Language Auto-Detection
// ─────────────────────────────────────────────────────────────────────

/**
 * Auto-detect the primary language of text using character frequency analysis.
 * @param {string} text - Sample text
 * @returns {string} Detected language code (e.g., 'rus', 'eng', 'deu')
 */
export function autoDetectLanguage(text) {
  if (!text || text.length < 20) return 'eng'; // Default

  const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  const cjkCount = (text.match(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const total = cyrillicCount + latinCount + cjkCount + arabicCount;

  if (total === 0) return 'eng';

  if (cyrillicCount / total > 0.3) return 'rus';
  if (cjkCount / total > 0.3) return 'chi_sim';
  if (arabicCount / total > 0.3) return 'ara';

  // For Latin scripts, try to distinguish by common words
  const lower = text.toLowerCase();
  const germanWords = (lower.match(/\b(und|der|die|das|ist|ein|von|mit|für|auf)\b/g) || []).length;
  const frenchWords = (lower.match(/\b(le|la|les|de|des|et|un|une|est|pas|que)\b/g) || []).length;
  const spanishWords = (lower.match(/\b(el|la|los|las|de|del|en|un|una|es|que)\b/g) || []).length;
  const englishWords = (lower.match(/\b(the|and|of|to|in|is|it|for|that|was)\b/g) || []).length;

  const scores = [
    { lang: 'eng', score: englishWords },
    { lang: 'deu', score: germanWords },
    { lang: 'fra', score: frenchWords },
    { lang: 'spa', score: spanishWords },
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].lang : 'eng';
}

export const batchOcr = new BatchOcrProcessor();
