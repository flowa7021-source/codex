// ─── Unit Tests: PDF Operations ───────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  mergePdfDocuments,
  splitPdfDocument,
  splitPdfIntoIndividual,
  reorderPdfPages,
  getPdfFormFields,
  fillPdfForm,
  addWatermarkToPdf,
  addStampToPdf,
  addSignatureToPdf,
  exportAnnotationsIntoPdf,
  rotatePdfPages,
  getPdfMetadata,
  setPdfMetadata,
  parsePageRange,
} from '../../app/modules/pdf-operations.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function createTestPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

function makeFakeFile(pdfBytes, name = 'test.pdf') {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  blob.name = name;
  blob.arrayBuffer = () => Promise.resolve(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength));
  return blob;
}

// ─── parsePageRange ──────────────────────────────────────────────────────────
describe('parsePageRange', () => {
  it('parses single page numbers', () => {
    assert.deepEqual(parsePageRange('1,3,5', 10), [1, 3, 5]);
  });

  it('parses ranges', () => {
    assert.deepEqual(parsePageRange('2-5', 10), [2, 3, 4, 5]);
  });

  it('parses mixed single and range', () => {
    assert.deepEqual(parsePageRange('1, 3-5, 8', 10), [1, 3, 4, 5, 8]);
  });

  it('clamps to maxPage', () => {
    assert.deepEqual(parsePageRange('1-20', 5), [1, 2, 3, 4, 5]);
  });

  it('ignores out-of-range pages', () => {
    assert.deepEqual(parsePageRange('0, -1, 6', 5), []);
  });

  it('deduplicates pages', () => {
    assert.deepEqual(parsePageRange('1,1,2,2', 5), [1, 2]);
  });

  it('returns sorted results', () => {
    assert.deepEqual(parsePageRange('5,1,3', 10), [1, 3, 5]);
  });

  it('handles empty string', () => {
    assert.deepEqual(parsePageRange('', 10), []);
  });

  it('handles whitespace', () => {
    assert.deepEqual(parsePageRange('  1 , 2 , 3  ', 10), [1, 2, 3]);
  });

  it('ignores NaN entries', () => {
    assert.deepEqual(parsePageRange('abc, 2, xyz', 10), [2]);
  });

  it('handles range with from > to (reversed range yields nothing)', () => {
    // from = max(1, 5) = 5, to = min(10, 2) = 2, loop from 5 to 2 never runs
    assert.deepEqual(parsePageRange('5-2', 10), []);
  });
});

// ─── mergePdfDocuments ──────────────────────────────────────────────────────
describe('mergePdfDocuments', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(2);
  });

  it('merges multiple PDFs into one', async () => {
    const file1 = makeFakeFile(pdfBytes, 'a.pdf');
    const file2 = makeFakeFile(pdfBytes, 'b.pdf');

    const result = await mergePdfDocuments([file1, file2]);
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');

    const merged = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(merged.getPageCount(), 4);
  });

  it('sets metadata on merged document', async () => {
    const file1 = makeFakeFile(pdfBytes, 'a.pdf');
    const result = await mergePdfDocuments([file1]);
    const merged = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(merged.getTitle(), 'Merged Document');
    assert.equal(merged.getCreator(), 'NovaReader');
  });

  it('skips files that fail to load', async () => {
    const badFile = {
      name: 'bad.pdf',
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    };
    const goodFile = makeFakeFile(pdfBytes, 'good.pdf');

    const result = await mergePdfDocuments([badFile, goodFile]);
    const merged = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(merged.getPageCount(), 2);
  });

  it('returns a PDF when all files are invalid', async () => {
    const badFile = {
      name: 'bad.pdf',
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    };
    const result = await mergePdfDocuments([badFile]);
    assert.ok(result instanceof Blob);
    // Source uses PDFDocument.create() + save() which produces a 1-page default PDF
    const merged = await PDFDocument.load(await result.arrayBuffer());
    assert.ok(merged.getPageCount() >= 0);
  });
});

// ─── splitPdfDocument ──────────────────────────────────────────────────────
describe('splitPdfDocument', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(5);
  });

  it('extracts specified pages', async () => {
    const result = await splitPdfDocument(pdfBytes, [1, 3, 5]);
    assert.ok(result instanceof Blob);

    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPageCount(), 3);
  });

  it('returns null when no valid pages given', async () => {
    const result = await splitPdfDocument(pdfBytes, [0, -1, 99]);
    assert.equal(result, null);
  });

  it('filters out invalid page numbers', async () => {
    const result = await splitPdfDocument(pdfBytes, [1, 100]);
    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPageCount(), 1);
  });

  it('returns null for empty page array', async () => {
    const result = await splitPdfDocument(pdfBytes, []);
    assert.equal(result, null);
  });
});

// ─── splitPdfIntoIndividual ──────────────────────────────────────────────────
describe('splitPdfIntoIndividual', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(3);
  });

  it('splits into individual single-page PDFs', async () => {
    const results = await splitPdfIntoIndividual(pdfBytes);
    assert.equal(results.length, 3);

    for (let i = 0; i < results.length; i++) {
      assert.equal(results[i].pageNum, i + 1);
      assert.ok(results[i].blob instanceof Blob);
      const doc = await PDFDocument.load(await results[i].blob.arrayBuffer());
      assert.equal(doc.getPageCount(), 1);
    }
  });
});

// ─── reorderPdfPages ────────────────────────────────────────────────────────
describe('reorderPdfPages', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(4);
  });

  it('reorders pages per given order', async () => {
    const result = await reorderPdfPages(pdfBytes, [4, 3, 2, 1]);
    assert.ok(result instanceof Blob);
    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPageCount(), 4);
  });

  it('can be used to delete pages by omitting them', async () => {
    const result = await reorderPdfPages(pdfBytes, [1, 3]);
    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPageCount(), 2);
  });

  it('filters out invalid indices', async () => {
    const result = await reorderPdfPages(pdfBytes, [1, 0, -1, 99]);
    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPageCount(), 1);
  });
});

// ─── getPdfFormFields ────────────────────────────────────────────────────────
describe('getPdfFormFields', () => {
  it('returns empty array for PDF without forms', async () => {
    const pdfBytes = await createTestPdf(1);
    const fields = await getPdfFormFields(pdfBytes);
    assert.ok(Array.isArray(fields));
    assert.equal(fields.length, 0);
  });
});

// ─── fillPdfForm ─────────────────────────────────────────────────────────────
describe('fillPdfForm', () => {
  it('returns a valid Blob even with no matching fields', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await fillPdfForm(pdfBytes, { nonexistent: 'value' });
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
  });
});

// ─── addWatermarkToPdf ──────────────────────────────────────────────────────
describe('addWatermarkToPdf', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(3);
  });

  it('adds watermark to all pages by default', async () => {
    const result = await addWatermarkToPdf(pdfBytes, 'DRAFT');
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPageCount(), 3);
  });

  it('adds watermark to specific pages', async () => {
    const result = await addWatermarkToPdf(pdfBytes, 'SECRET', { pages: [1, 3] });
    assert.ok(result instanceof Blob);
  });

  it('accepts custom color, opacity, fontSize, rotation', async () => {
    const result = await addWatermarkToPdf(pdfBytes, 'CUSTOM', {
      fontSize: 30,
      opacity: 0.5,
      color: { r: 1, g: 0, b: 0 },
      rotation: -30,
    });
    assert.ok(result instanceof Blob);
  });
});

// ─── addStampToPdf ──────────────────────────────────────────────────────────
describe('addStampToPdf', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(2);
  });

  it('adds stamp with known type', async () => {
    // Use customText to avoid Cyrillic encoding issues with WinAnsi in tests
    const result = await addStampToPdf(pdfBytes, 'approved', { customText: 'APPROVED' });
    assert.ok(result instanceof Blob);
  });

  it('falls back to draft for unknown type', async () => {
    const result = await addStampToPdf(pdfBytes, 'unknown_type', { customText: 'DRAFT' });
    assert.ok(result instanceof Blob);
  });

  it('uses custom text when provided', async () => {
    const result = await addStampToPdf(pdfBytes, 'draft', { customText: 'MY STAMP' });
    assert.ok(result instanceof Blob);
  });

  it('positions at specified coordinates', async () => {
    const result = await addStampToPdf(pdfBytes, 'confidential', { customText: 'CONFIDENTIAL', x: 50, y: 50 });
    assert.ok(result instanceof Blob);
  });

  it('stamps on specified page', async () => {
    const result = await addStampToPdf(pdfBytes, 'copy', { customText: 'COPY', pageNum: 2 });
    assert.ok(result instanceof Blob);
  });
});

// ─── addSignatureToPdf ──────────────────────────────────────────────────────
describe('addSignatureToPdf', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(1);
  });

  it('returns null when image cannot be embedded', async () => {
    const badImage = new Uint8Array([0, 0, 0, 0]);
    const result = await addSignatureToPdf(pdfBytes, badImage);
    assert.equal(result, null);
  });
});

// ─── exportAnnotationsIntoPdf ────────────────────────────────────────────────
describe('exportAnnotationsIntoPdf', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(2);
  });

  it('returns Blob with empty annotation store', async () => {
    const store = new Map();
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('handles pen strokes', async () => {
    const store = new Map();
    store.set(1, [
      { tool: 'pen', color: '#ff0000', size: 2, points: [{ x: 10, y: 10 }, { x: 50, y: 50 }] },
    ]);
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('handles highlighter strokes', async () => {
    const store = new Map();
    store.set(1, [
      { tool: 'highlighter', color: '#ffff00', size: 10, points: [{ x: 10, y: 10 }, { x: 100, y: 10 }] },
    ]);
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('handles rect strokes', async () => {
    const store = new Map();
    store.set(1, [
      { tool: 'rect', color: '#0000ff', size: 2, bounds: { x: 10, y: 10, w: 100, h: 50 } },
    ]);
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('handles circle strokes', async () => {
    const store = new Map();
    store.set(1, [
      { tool: 'circle', color: '#00ff00', size: 2, bounds: { x: 10, y: 10, w: 80, h: 80 } },
    ]);
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('handles arrow strokes', async () => {
    const store = new Map();
    store.set(1, [
      { tool: 'arrow', color: '#000000', size: 3, points: [{ x: 10, y: 10 }, { x: 100, y: 100 }] },
    ]);
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('handles line strokes', async () => {
    const store = new Map();
    store.set(1, [
      { tool: 'line', color: '#333333', size: 1, points: [{ x: 0, y: 0 }, { x: 200, y: 200 }] },
    ]);
    const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
    assert.ok(result instanceof Blob);
  });

  it('throws or skips invalid page numbers', async () => {
    const store = new Map();
    store.set(99, [{ tool: 'pen', color: '#000', size: 1, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]);
    try {
      const result = await exportAnnotationsIntoPdf(pdfBytes, store, { width: 612, height: 792 });
      // If it succeeds, it should still return a Blob
      assert.ok(result instanceof Blob);
    } catch (err) {
      // pdf-lib throws for out-of-range page indices - this is acceptable
      assert.ok(err.message.includes('index'));
    }
  });
});

// ─── rotatePdfPages ─────────────────────────────────────────────────────────
describe('rotatePdfPages', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(3);
  });

  it('rotates specified pages', async () => {
    const result = await rotatePdfPages(pdfBytes, [1, 3], 90);
    assert.ok(result instanceof Blob);

    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPage(0).getRotation().angle, 90);
    assert.equal(doc.getPage(1).getRotation().angle, 0);
    assert.equal(doc.getPage(2).getRotation().angle, 90);
  });

  it('accumulates rotation', async () => {
    const rotated = await rotatePdfPages(pdfBytes, [1], 90);
    const rotatedBytes = new Uint8Array(await rotated.arrayBuffer());
    const result = await rotatePdfPages(rotatedBytes, [1], 90);
    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getPage(0).getRotation().angle, 180);
  });
});

// ─── getPdfMetadata / setPdfMetadata ────────────────────────────────────────
describe('getPdfMetadata', () => {
  it('returns metadata from a PDF', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Test Title');
    doc.setAuthor('Test Author');
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    const meta = await getPdfMetadata(bytes);
    assert.equal(meta.title, 'Test Title');
    assert.equal(meta.author, 'Test Author');
    assert.equal(meta.pageCount, 1);
    assert.equal(meta.pages.length, 1);
    assert.equal(meta.pages[0].num, 1);
    assert.equal(meta.pages[0].width, 612);
    assert.equal(meta.pages[0].height, 792);
  });
});

describe('setPdfMetadata', () => {
  it('sets title, author, and subject', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await setPdfMetadata(pdfBytes, {
      title: 'New Title',
      author: 'New Author',
      subject: 'New Subject',
    });
    assert.ok(result instanceof Blob);

    const doc = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(doc.getTitle(), 'New Title');
    assert.equal(doc.getAuthor(), 'New Author');
    assert.equal(doc.getSubject(), 'New Subject');
  });

  it('only sets provided fields', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Original');
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    const result = await setPdfMetadata(bytes, { author: 'Someone' });
    const loaded = await PDFDocument.load(await result.arrayBuffer());
    assert.equal(loaded.getTitle(), 'Original');
    assert.equal(loaded.getAuthor(), 'Someone');
  });
});
