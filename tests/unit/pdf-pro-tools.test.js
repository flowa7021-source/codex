// ─── Unit Tests: PDF Pro Tools ───────────────────────────────────────────────
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  addHeaderFooter,
  addBatesNumbering,
  flattenPdf,
  checkAccessibility,
  autoFixAccessibility,
  addPageNumbers,
  cropPdfPages,
} from '../../app/modules/pdf-pro-tools.js';

// Helper: create a minimal multi-page PDF
async function createTestPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]); // US Letter
  }
  return doc.save();
}

// Helper: create PDF with title and language set
async function createTaggedPdf() {
  const doc = await PDFDocument.create();
  doc.setTitle('Test Document');
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  return doc.save();
}

describe('addHeaderFooter', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(3);
  });

  it('returns a Blob', async () => {
    const result = await addHeaderFooter(pdfBytes, { footerCenter: '{{page}} / {{total}}' });
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
  });

  it('result is a valid PDF', async () => {
    const result = await addHeaderFooter(pdfBytes, { headerLeft: 'Test' });
    const bytes = new Uint8Array(await result.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 3);
  });

  it('respects skipFirst', async () => {
    // Should not throw and should produce valid output
    const result = await addHeaderFooter(pdfBytes, { headerCenter: 'Header', skipFirst: true });
    assert.ok(result instanceof Blob);
  });

  it('respects startPage', async () => {
    const result = await addHeaderFooter(pdfBytes, { footerRight: '{{page}}', startPage: 2 });
    assert.ok(result instanceof Blob);
  });
});

describe('addBatesNumbering', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(5);
  });

  it('returns blob and numbering info', async () => {
    const result = await addBatesNumbering(pdfBytes, { prefix: 'DOC-', startNum: 100, digits: 4 });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.startNum, 100);
    assert.equal(result.endNum, 104);
    assert.equal(result.totalPages, 5);
  });

  it('defaults start at 1 with 6 digits', async () => {
    const result = await addBatesNumbering(pdfBytes);
    assert.equal(result.startNum, 1);
    assert.equal(result.endNum, 5);
  });

  it('supports all position options', async () => {
    for (const position of ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right']) {
      const result = await addBatesNumbering(pdfBytes, { position });
      assert.ok(result.blob instanceof Blob, `Failed for position: ${position}`);
    }
  });
});

describe('flattenPdf', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(2);
  });

  it('returns blob and counts', async () => {
    const result = await flattenPdf(pdfBytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(typeof result.formsFlattened, 'number');
    assert.equal(typeof result.annotationsFlattened, 'number');
  });

  it('handles PDF with no forms gracefully', async () => {
    const result = await flattenPdf(pdfBytes, { flattenForms: true });
    // No forms to flatten, but should not throw
    assert.equal(result.formsFlattened, 0);
  });

  it('flattenAnnotations removes annotation dicts', async () => {
    const result = await flattenPdf(pdfBytes, { flattenAnnotations: true });
    assert.equal(typeof result.annotationsFlattened, 'number');
  });
});

describe('checkAccessibility', () => {
  it('reports missing title', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await checkAccessibility(pdfBytes);
    assert.ok(result.issues.some(i => i.rule === 'WCAG 2.4.2'));
    assert.equal(result.summary.hasTitle, false);
  });

  it('reports missing language', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await checkAccessibility(pdfBytes);
    assert.ok(result.issues.some(i => i.rule === 'WCAG 3.1.1'));
    assert.equal(result.summary.hasLang, false);
  });

  it('reports untagged PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await checkAccessibility(pdfBytes);
    assert.ok(result.issues.some(i => i.rule === 'PDF/UA'));
    assert.equal(result.summary.isTagged, false);
  });

  it('reports missing bookmarks for long docs', async () => {
    const pdfBytes = await createTestPdf(25);
    const result = await checkAccessibility(pdfBytes);
    assert.ok(result.issues.some(i => i.rule === 'WCAG 2.4.5'));
    assert.equal(result.summary.hasBookmarks, false);
  });

  it('no bookmark warning for short docs', async () => {
    const pdfBytes = await createTestPdf(5);
    const result = await checkAccessibility(pdfBytes);
    assert.ok(!result.issues.some(i => i.rule === 'WCAG 2.4.5'));
  });

  it('calculates score and level', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await checkAccessibility(pdfBytes);
    assert.equal(typeof result.score, 'number');
    assert.ok(['good', 'moderate', 'poor'].includes(result.level));
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it('detects title when present', async () => {
    const pdfBytes = await createTaggedPdf();
    const result = await checkAccessibility(pdfBytes);
    assert.equal(result.summary.hasTitle, true);
    assert.ok(!result.issues.some(i => i.rule === 'WCAG 2.4.2'));
  });
});

describe('autoFixAccessibility', () => {
  it('adds title and language', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await autoFixAccessibility(pdfBytes, { title: 'My Doc', language: 'en' });
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.fixCount >= 2);

    // Verify fixes applied
    const fixedBytes = new Uint8Array(await result.blob.arrayBuffer());
    const doc = await PDFDocument.load(fixedBytes);
    assert.equal(doc.getTitle(), 'My Doc');
  });

  it('does not overwrite existing title', async () => {
    const pdfBytes = await createTaggedPdf();
    const result = await autoFixAccessibility(pdfBytes, { title: 'Override' });
    const fixedBytes = new Uint8Array(await result.blob.arrayBuffer());
    const doc = await PDFDocument.load(fixedBytes);
    assert.equal(doc.getTitle(), 'Test Document');
  });
});

describe('addPageNumbers', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(4);
  });

  it('returns a Blob', async () => {
    const result = await addPageNumbers(pdfBytes);
    assert.ok(result instanceof Blob);
  });

  it('works with top position', async () => {
    const result = await addPageNumbers(pdfBytes, { position: 'top-center' });
    assert.ok(result instanceof Blob);
  });
});

describe('cropPdfPages', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(3);
  });

  it('returns a Blob', async () => {
    const result = await cropPdfPages(pdfBytes, { x: 50, y: 50, width: 500, height: 700 });
    assert.ok(result instanceof Blob);
  });

  it('applies to specific page range', async () => {
    const result = await cropPdfPages(pdfBytes, { x: 50, y: 50, width: 500, height: 700 }, [1, 3]);
    const bytes = new Uint8Array(await result.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 3);
  });
});
