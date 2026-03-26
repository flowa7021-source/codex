// ─── Unit Tests: Extended PDF Split & Merge Operations ───────────────────────
import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFString, PDFNumber } from 'pdf-lib';
import {
  splitByBookmarks,
  splitByFileSize,
  splitByBlankPages,
  splitByRange,
  mergePdfWithOutlines,
  splitPdfDocument,
} from '../../app/modules/pdf-operations.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTestPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

/**
 * Create a PDF with top-level bookmarks at specified pages.
 * @param {{ title: string, pageIndex: number }[]} bookmarks
 * @param {number} totalPages
 */
async function createPdfWithBookmarks(bookmarks, totalPages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < totalPages; i++) {
    doc.addPage([612, 792]);
  }

  const ctx = doc.context;
  const pageRefs = doc.getPages().map(p => p.ref);

  // Build outline tree
  const outlinesDict = ctx.obj({ Type: 'Outlines' });
  const outlinesRef = ctx.register(outlinesDict);

  const entryRefs = bookmarks.map(bm => {
    const pageIdx = Math.max(0, Math.min(bm.pageIndex, pageRefs.length - 1));
    const dest = ctx.obj([pageRefs[pageIdx], PDFName.of('Fit')]);

    const dict = ctx.obj({});
    dict.set(PDFName.of('Title'), PDFString.of(bm.title));
    dict.set(PDFName.of('Parent'), outlinesRef);
    dict.set(PDFName.of('Dest'), dest);
    return ctx.register(dict);
  });

  // Link siblings
  for (let i = 0; i < entryRefs.length; i++) {
    const dict = ctx.lookup(entryRefs[i]);
    if (i > 0) dict.set(PDFName.of('Prev'), entryRefs[i - 1]);
    if (i < entryRefs.length - 1) dict.set(PDFName.of('Next'), entryRefs[i + 1]);
  }

  outlinesDict.set(PDFName.of('First'), entryRefs[0]);
  outlinesDict.set(PDFName.of('Last'), entryRefs[entryRefs.length - 1]);
  outlinesDict.set(PDFName.of('Count'), PDFNumber.of(entryRefs.length));

  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
  return doc.save();
}

/**
 * Create a PDF where certain pages have text content and others are blank.
 * @param {boolean[]} hasText - true = page has text, false = blank
 */
async function createPdfWithBlankPages(hasText) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont('Helvetica');

  for (let i = 0; i < hasText.length; i++) {
    const page = doc.addPage([612, 792]);
    if (hasText[i]) {
      // Draw enough text to exceed blank threshold
      page.drawText('This page has substantial content. '.repeat(10), {
        x: 50,
        y: 700,
        size: 12,
        font,
      });
    }
    // Blank pages get no text drawn
  }

  return doc.save();
}

function makeFakeFile(pdfBytes, name = 'test.pdf') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  blob.name = name;
  blob.arrayBuffer = () =>
    Promise.resolve(
      pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength,
      ),
    );
  return blob;
}

// ─── splitByBookmarks ────────────────────────────────────────────────────────
describe('splitByBookmarks', () => {
  it('splits a PDF with 3 bookmarks into 3 files with correct titles', async () => {
    const pdfBytes = await createPdfWithBookmarks(
      [
        { title: 'Chapter 1', pageIndex: 0 },
        { title: 'Chapter 2', pageIndex: 3 },
        { title: 'Chapter 3', pageIndex: 6 },
      ],
      9,
    );

    const results = await splitByBookmarks(pdfBytes);
    assert.equal(results.length, 3);
    assert.equal(results[0].name, 'Chapter 1');
    assert.equal(results[1].name, 'Chapter 2');
    assert.equal(results[2].name, 'Chapter 3');

    // Verify each result has a valid blob
    for (const r of results) {
      assert.ok(r.blob instanceof Blob);
      assert.equal(r.blob.type, 'application/pdf');
    }

    // Verify page counts: Ch1 = pages 1-3, Ch2 = pages 4-6, Ch3 = pages 7-9
    const doc1 = await PDFDocument.load(await results[0].blob.arrayBuffer());
    assert.equal(doc1.getPageCount(), 3);

    const doc2 = await PDFDocument.load(await results[1].blob.arrayBuffer());
    assert.equal(doc2.getPageCount(), 3);

    const doc3 = await PDFDocument.load(await results[2].blob.arrayBuffer());
    assert.equal(doc3.getPageCount(), 3);
  });

  it('returns single file for PDF without bookmarks', async () => {
    const pdfBytes = await createTestPdf(5);

    const results = await splitByBookmarks(pdfBytes);
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Full Document');
    assert.ok(results[0].blob instanceof Blob);
  });
});

// ─── splitByFileSize ─────────────────────────────────────────────────────────
describe('splitByFileSize', () => {
  it('splits a 10-page PDF into multiple files when maxSize is very small', async () => {
    const pdfBytes = await createTestPdf(10);

    // Use a very small max size to force splitting into many files
    // A single blank page PDF is ~800-900 bytes, so use a limit that forces individual pages
    const results = await splitByFileSize(pdfBytes, 1);

    // With maxSize = 1 byte, every page should be its own chunk (since even 1 page > 1 byte)
    assert.ok(results.length > 1, `Expected multiple files, got ${results.length}`);

    // Each result should have a blob and pages array
    for (const r of results) {
      assert.ok(r.blob instanceof Blob);
      assert.ok(Array.isArray(r.pages));
      assert.ok(r.pages.length >= 1);
    }

    // Total pages across all results should equal 10
    const totalPages = results.reduce((sum, r) => sum + r.pages.length, 0);
    assert.equal(totalPages, 10);
  });

  it('keeps all pages in one file when maxSize is large enough', async () => {
    const pdfBytes = await createTestPdf(3);

    // Use a very large max size so everything fits in one file
    const results = await splitByFileSize(pdfBytes, 10 * 1024 * 1024);

    assert.equal(results.length, 1);
    assert.deepEqual(results[0].pages, [1, 2, 3]);
  });
});

// ─── splitByBlankPages ──────────────────────────────────────────────────────
describe('splitByBlankPages', () => {
  it('splits [text, blank, text, text, blank, text] into 3 sections', async () => {
    // Pattern: text, blank, text, text, blank, text
    const pdfBytes = await createPdfWithBlankPages([
      true,   // page 1 - text
      false,  // page 2 - blank (separator)
      true,   // page 3 - text
      true,   // page 4 - text
      false,  // page 5 - blank (separator)
      true,   // page 6 - text
    ]);

    const results = await splitByBlankPages(pdfBytes);

    assert.equal(results.length, 3, `Expected 3 sections, got ${results.length}`);

    // Section 1: page 1
    assert.deepEqual(results[0].pages, [1]);
    // Section 2: pages 3-4
    assert.deepEqual(results[1].pages, [3, 4]);
    // Section 3: page 6
    assert.deepEqual(results[2].pages, [6]);

    // Verify each blob is valid
    for (const r of results) {
      assert.ok(r.blob instanceof Blob);
    }
  });

  it('returns all pages as one section when no blanks exist', async () => {
    const pdfBytes = await createPdfWithBlankPages([true, true, true]);

    const results = await splitByBlankPages(pdfBytes);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].pages, [1, 2, 3]);
  });
});

// ─── splitByRange ───────────────────────────────────────────────────────────
describe('splitByRange', () => {
  it('splits by explicit ranges into correct number of files', async () => {
    const pdfBytes = await createTestPdf(10);

    const ranges = [
      { start: 1, end: 3, filename: 'part1.pdf' },
      { start: 5, end: 5, filename: 'part2.pdf' },
      { start: 7, end: 10, filename: 'part3.pdf' },
    ];

    const results = await splitByRange(pdfBytes, ranges);

    assert.equal(results.length, 3);

    // Verify filenames
    assert.equal(results[0].filename, 'part1.pdf');
    assert.equal(results[1].filename, 'part2.pdf');
    assert.equal(results[2].filename, 'part3.pdf');

    // Verify page counts
    const doc1 = await PDFDocument.load(await results[0].blob.arrayBuffer());
    assert.equal(doc1.getPageCount(), 3);

    const doc2 = await PDFDocument.load(await results[1].blob.arrayBuffer());
    assert.equal(doc2.getPageCount(), 1);

    const doc3 = await PDFDocument.load(await results[2].blob.arrayBuffer());
    assert.equal(doc3.getPageCount(), 4);
  });

  it('generates default filenames when not provided', async () => {
    const pdfBytes = await createTestPdf(5);

    const results = await splitByRange(pdfBytes, [{ start: 2, end: 4 }]);

    assert.equal(results.length, 1);
    assert.equal(results[0].filename, 'pages_2-4.pdf');
  });
});

// ─── mergePdfWithOutlines ───────────────────────────────────────────────────
describe('mergePdfWithOutlines', () => {
  it('merges 2 PDFs of 3 pages each into a 6-page document', async () => {
    const pdfBytes1 = await createTestPdf(3);
    const pdfBytes2 = await createTestPdf(3);

    const file1 = makeFakeFile(pdfBytes1, 'Document A.pdf');
    const file2 = makeFakeFile(pdfBytes2, 'Document B.pdf');

    const result = await mergePdfWithOutlines([file1, file2]);

    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');

    const merged = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(merged.getPageCount(), 6);
  });

  it('creates outline entries for each merged file', async () => {
    const pdfBytes1 = await createTestPdf(2);
    const pdfBytes2 = await createTestPdf(3);

    const file1 = makeFakeFile(pdfBytes1, 'First.pdf');
    const file2 = makeFakeFile(pdfBytes2, 'Second.pdf');

    const result = await mergePdfWithOutlines([file1, file2]);
    const merged = await PDFDocument.load(await result.arrayBuffer());

    // Verify outline exists
    const catalog = merged.catalog;
    const outlinesRef = catalog.get(PDFName.of('Outlines'));
    assert.ok(outlinesRef, 'Merged PDF should have an Outlines entry');
  });

  it('skips invalid files gracefully', async () => {
    const pdfBytes = await createTestPdf(2);
    const goodFile = makeFakeFile(pdfBytes, 'good.pdf');
    const badFile = {
      name: 'bad.pdf',
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    };

    const result = await mergePdfWithOutlines([badFile, goodFile]);
    const merged = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(merged.getPageCount(), 2);
  });
});
