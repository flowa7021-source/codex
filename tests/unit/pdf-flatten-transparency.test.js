import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  flattenTransparency,
  analyzeTransparency,
  hasTransparencyGroup,
  removeSoftMasks,
} from '../../app/modules/pdf-flatten-transparency.js';

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
});
