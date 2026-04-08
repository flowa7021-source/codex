import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import {
  flattenTransparency,
  analyzeTransparency,
  hasTransparencyGroup,
  removeSoftMasks,
  flattenPageTransparency,
} from '../../app/modules/pdf-flatten-transparency.js';

/** Create a PDF page that has a /Group /Transparency dict set */
async function createTransparentPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const groupDict = doc.context.obj({ S: PDFName.of('Transparency') });
  page.node.set(PDFName.of('Group'), groupDict);
  return { doc, page, bytes: new Uint8Array(await doc.save()) };
}

/** Add a Resources/ExtGState entry with /SMask to a page */
function addSMaskToPage(doc, page) {
  let resources = page.node.get(PDFName.of('Resources'));
  if (!(resources instanceof PDFDict)) {
    resources = doc.context.obj({});
    page.node.set(PDFName.of('Resources'), resources);
  }
  const smaskEntry = doc.context.obj({ SMask: PDFName.of('None') });
  const extGState = doc.context.obj({ gs0: smaskEntry });
  resources.set(PDFName.of('ExtGState'), extGState);
}

async function createPdfBytes(pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return new Uint8Array(await doc.save());
}

// ---------------------------------------------------------------------------
// flattenTransparency
// ---------------------------------------------------------------------------

describe('flattenTransparency', () => {
  it('returns blob and pagesFlattened count for PDF without transparency', async () => {
    const bytes = await createPdfBytes(2);
    const result = await flattenTransparency(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.equal(result.pagesFlattened, 0);
    assert.equal(typeof result.softMasksRemoved, 'number');
  });

  it('accepts ArrayBuffer input', async () => {
    const bytes = await createPdfBytes(1);
    const result = await flattenTransparency(bytes.buffer);
    assert.ok(result.blob instanceof Blob);
  });

  it('accepts pages option to target specific pages', async () => {
    const bytes = await createPdfBytes(3);
    const result = await flattenTransparency(bytes, { pages: [1, 2] });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pagesFlattened, 0); // no transparency in test PDF
  });

  it('ignores out-of-range page numbers in pages option', async () => {
    const bytes = await createPdfBytes(1);
    const result = await flattenTransparency(bytes, { pages: [99, -1] });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pagesFlattened, 0);
  });

  it('flattens transparent page and increments pagesFlattened', async () => {
    const { bytes } = await createTransparentPdf();
    const result = await flattenTransparency(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pagesFlattened, 1);
  });

  it('counts softMasksRemoved when page has SMask', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    addSMaskToPage(doc, page);
    const bytes = new Uint8Array(await doc.save());
    const result = await flattenTransparency(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.softMasksRemoved, 1);
  });
});

// ---------------------------------------------------------------------------
// analyzeTransparency
// ---------------------------------------------------------------------------

describe('analyzeTransparency', () => {
  it('reports no transparency in plain PDF', async () => {
    const bytes = await createPdfBytes(2);
    const result = await analyzeTransparency(bytes);
    assert.equal(result.totalPages, 2);
    assert.equal(result.transparentPages.length, 0);
    assert.equal(result.hasTransparency, false);
  });

  it('returns correct totalPages', async () => {
    const bytes = await createPdfBytes(5);
    const result = await analyzeTransparency(bytes);
    assert.equal(result.totalPages, 5);
  });

  it('detects transparent pages', async () => {
    const { bytes } = await createTransparentPdf();
    const result = await analyzeTransparency(bytes);
    assert.equal(result.hasTransparency, true);
    assert.ok(result.transparentPages.includes(1));
  });
});

// ---------------------------------------------------------------------------
// hasTransparencyGroup
// ---------------------------------------------------------------------------

describe('hasTransparencyGroup', () => {
  it('returns false for a plain page', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const page = doc.getPage(0);
    assert.equal(hasTransparencyGroup(page), false);
  });

  it('returns true for a page with transparency group', async () => {
    const { page } = await createTransparentPdf();
    assert.equal(hasTransparencyGroup(page), true);
  });
});

// ---------------------------------------------------------------------------
// removeSoftMasks
// ---------------------------------------------------------------------------

describe('removeSoftMasks', () => {
  it('returns 0 for page without ExtGState', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const page = doc.getPage(0);
    const removed = removeSoftMasks(page);
    assert.equal(removed, 0);
  });

  it('removes SMask entries and returns count', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    addSMaskToPage(doc, page);
    const removed = removeSoftMasks(page);
    assert.equal(removed, 1);
  });
});

// ---------------------------------------------------------------------------
// flattenPageTransparency
// ---------------------------------------------------------------------------

describe('flattenPageTransparency', () => {
  it('returns false for a page without transparency', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    assert.equal(flattenPageTransparency(page), false);
  });

  it('returns true and removes Group from page with transparency group', async () => {
    const { page } = await createTransparentPdf();
    const result = flattenPageTransparency(page);
    assert.equal(result, true);
    assert.equal(hasTransparencyGroup(page), false);
  });

  it('returns true when page has SMask (via removeSoftMasks)', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    addSMaskToPage(doc, page);
    const result = flattenPageTransparency(page);
    assert.equal(result, true);
  });
});
