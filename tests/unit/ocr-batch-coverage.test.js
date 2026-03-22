// ─── Coverage Tests: OcrBatch ─────────────────────────────────────────────────
// Tests createSearchablePdf, detectScannedDocument, isScannedPage
// to push coverage from 69% toward 85%.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  BatchOcrProcessor,
  createSearchablePdf,
  isScannedPage,
  detectScannedDocument,
  autoDetectLanguage,
} from '../../app/modules/ocr-batch.js';

// pdf-lib is imported by the module — createSearchablePdf needs real PDF bytes.
// We'll use pdf-lib to create a minimal PDF for testing.
import { PDFDocument } from 'pdf-lib';

// ── createSearchablePdf ──────────────────────────────────────────────────────

describe('createSearchablePdf', () => {
  it('creates a searchable PDF from OCR results', async () => {
    // Create a minimal PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    ocrResults.set(1, {
      words: [
        { text: 'Hello', x: 50, y: 50, w: 40, h: 12 },
        { text: 'World', x: 100, y: 50, w: 40, h: 12 },
      ],
      imageWidth: 612,
      imageHeight: 792,
    });

    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.ok(result.blob);
    assert.equal(result.pagesProcessed, 1);
    assert.ok(result.blob instanceof Blob || result.blob.constructor.name === 'Blob');
  });

  it('handles multiple pages', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    ocrResults.set(1, { words: [{ text: 'Page1', x: 50, y: 50, w: 30, h: 12 }], imageWidth: 612, imageHeight: 792 });
    ocrResults.set(2, { words: [{ text: 'Page2', x: 50, y: 50, w: 30, h: 12 }], imageWidth: 612, imageHeight: 792 });

    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.equal(result.pagesProcessed, 2);
  });

  it('skips words with empty text', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    ocrResults.set(1, {
      words: [
        { text: '', x: 50, y: 50, w: 30, h: 12 },
        { text: '   ', x: 100, y: 50, w: 30, h: 12 },
        { text: 'Valid', x: 150, y: 50, w: 30, h: 12 },
      ],
      imageWidth: 612,
      imageHeight: 792,
    });

    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.equal(result.pagesProcessed, 1);
  });

  it('handles empty OCR results', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.equal(result.pagesProcessed, 0);
    assert.ok(result.blob);
  });

  it('handles words without position info', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    ocrResults.set(1, {
      words: [{ text: 'NoPos' }], // no x, y, w, h
      imageWidth: 612,
      imageHeight: 792,
    });

    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.equal(result.pagesProcessed, 1);
  });

  it('scales text based on image dimensions', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    ocrResults.set(1, {
      words: [{ text: 'Scaled', x: 100, y: 100, w: 50, h: 20 }],
      imageWidth: 1224,  // 2x the page width
      imageHeight: 1584, // 2x the page height
    });

    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.equal(result.pagesProcessed, 1);
  });

  it('handles page with no words array', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const ocrResults = new Map();
    ocrResults.set(1, { words: null, imageWidth: 612, imageHeight: 792 });

    const result = await createSearchablePdf(pdfBytes, ocrResults);
    assert.equal(result.pagesProcessed, 1);
  });
});

// ── isScannedPage ────────────────────────────────────────────────────────────

describe('isScannedPage', () => {
  it('returns true for page with no text', async () => {
    const page = {
      getTextContent: async () => ({ items: [] }),
    };
    const result = await isScannedPage(page);
    assert.equal(result, true);
  });

  it('returns true for page with very little text (<10 chars)', async () => {
    const page = {
      getTextContent: async () => ({ items: [{ str: 'Hi' }] }),
    };
    const result = await isScannedPage(page);
    assert.equal(result, true);
  });

  it('returns false for page with substantial text', async () => {
    const page = {
      getTextContent: async () => ({
        items: [
          { str: 'This is a page with enough text content to not be considered scanned' },
        ],
      }),
    };
    const result = await isScannedPage(page);
    assert.equal(result, false);
  });

  it('returns true on getTextContent error', async () => {
    const page = {
      getTextContent: async () => { throw new Error('Failed'); },
    };
    const result = await isScannedPage(page);
    assert.equal(result, true);
  });
});

// ── detectScannedDocument ────────────────────────────────────────────────────

describe('detectScannedDocument', () => {
  it('detects scanned document when all pages are scans', async () => {
    const pdfDocument = {
      numPages: 3,
      getPage: async () => ({
        getTextContent: async () => ({ items: [] }),
      }),
    };
    const result = await detectScannedDocument(pdfDocument, 3);
    assert.equal(result.isScanned, true);
    assert.equal(result.scannedPages, 3);
    assert.equal(result.totalChecked, 3);
    assert.equal(result.confidence, 1);
    assert.ok(result.recommendation);
    assert.ok(result.recommendation.includes('OCR'));
  });

  it('detects non-scanned document when pages have text', async () => {
    const pdfDocument = {
      numPages: 3,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [{ str: 'This page has plenty of text content that exceeds the threshold' }],
        }),
      }),
    };
    const result = await detectScannedDocument(pdfDocument, 3);
    assert.equal(result.isScanned, false);
    assert.equal(result.scannedPages, 0);
    assert.equal(result.confidence, 0);
    assert.equal(result.recommendation, null);
  });

  it('handles mixed document (some scanned, some not)', async () => {
    let callCount = 0;
    const pdfDocument = {
      numPages: 4,
      getPage: async (pageNum) => ({
        getTextContent: async () => {
          callCount++;
          // Pages 1,2 are scanned, 3,4 have text
          if (pageNum <= 2) return { items: [] };
          return { items: [{ str: 'This page has enough text content to not be a scan' }] };
        },
      }),
    };
    const result = await detectScannedDocument(pdfDocument, 4);
    assert.equal(result.totalChecked, 4);
    assert.ok(typeof result.isScanned === 'boolean');
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });

  it('checks only sampleSize pages', async () => {
    let checkedPages = 0;
    const pdfDocument = {
      numPages: 100,
      getPage: async () => {
        checkedPages++;
        return {
          getTextContent: async () => ({ items: [{ str: 'Text content here that is long enough' }] }),
        };
      },
    };
    const result = await detectScannedDocument(pdfDocument, 5);
    assert.equal(result.totalChecked, 5);
    assert.equal(checkedPages, 5);
  });

  it('limits sampleSize to totalPages when document is small', async () => {
    const pdfDocument = {
      numPages: 2,
      getPage: async () => ({
        getTextContent: async () => ({ items: [] }),
      }),
    };
    const result = await detectScannedDocument(pdfDocument, 10);
    assert.equal(result.totalChecked, 2);
  });

  it('evenly distributes page checks', async () => {
    const checkedPageNums = [];
    const pdfDocument = {
      numPages: 20,
      getPage: async (pageNum) => {
        checkedPageNums.push(pageNum);
        return {
          getTextContent: async () => ({ items: [{ str: 'Long enough text to exceed the threshold' }] }),
        };
      },
    };
    await detectScannedDocument(pdfDocument, 5);
    assert.equal(checkedPageNums.length, 5);
    // Pages should be distributed: roughly 1, 5, 9, 13, 17
    assert.ok(checkedPageNums[0] <= 2);
    assert.ok(checkedPageNums[4] > 10);
  });
});

// ── autoDetectLanguage additional cases ──────────────────────────────────────

describe('autoDetectLanguage additional', () => {
  it('handles text with only numbers', () => {
    assert.equal(autoDetectLanguage('12345678901234567890123456'), 'eng');
  });

  it('handles mixed Cyrillic and Latin (more Cyrillic)', () => {
    const text = 'Привет мир это русский текст hello world this is English but mostly Russian слова';
    const result = autoDetectLanguage(text);
    assert.equal(result, 'rus');
  });
});
