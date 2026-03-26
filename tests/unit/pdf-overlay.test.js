import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  overlayPdf,
  getTargetPages,
  computeDimensions,
} from '../../app/modules/pdf-overlay.js';

async function createPdfBytes(pageCount = 1) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont('Helvetica');
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 700, font, size: 12 });
  }
  return new Uint8Array(await doc.save());
}

// ---------------------------------------------------------------------------
// computeDimensions
// ---------------------------------------------------------------------------

describe('computeDimensions', () => {
  it('fit mode scales proportionally', () => {
    const dims = computeDimensions(200, 400, 100, 200, 'fit');
    assert.equal(dims.width, 100);
    assert.equal(dims.height, 200);
  });

  it('fill mode stretches to target', () => {
    const dims = computeDimensions(200, 400, 300, 600, 'fill');
    assert.equal(dims.width, 300);
    assert.equal(dims.height, 600);
  });

  it('none mode preserves source dimensions', () => {
    const dims = computeDimensions(123, 456, 300, 600, 'none');
    assert.equal(dims.width, 123);
    assert.equal(dims.height, 456);
  });

  it('numeric scale multiplies source dimensions', () => {
    const dims = computeDimensions(100, 200, 0, 0, 0.5);
    assert.equal(dims.width, 50);
    assert.equal(dims.height, 100);
  });
});

// ---------------------------------------------------------------------------
// getTargetPages
// ---------------------------------------------------------------------------

describe('getTargetPages', () => {
  it('all returns every page', async () => {
    const bytes = await createPdfBytes(4);
    const doc = await PDFDocument.load(bytes);
    const pages = getTargetPages(doc, 'all');
    assert.equal(pages.length, 4);
  });

  it('first returns only the first page', async () => {
    const bytes = await createPdfBytes(3);
    const doc = await PDFDocument.load(bytes);
    const pages = getTargetPages(doc, 'first');
    assert.equal(pages.length, 1);
  });

  it('last returns only the last page', async () => {
    const bytes = await createPdfBytes(3);
    const doc = await PDFDocument.load(bytes);
    const pages = getTargetPages(doc, 'last');
    assert.equal(pages.length, 1);
  });

  it('odd returns pages at even indices (1st, 3rd)', async () => {
    const bytes = await createPdfBytes(4);
    const doc = await PDFDocument.load(bytes);
    const pages = getTargetPages(doc, 'odd');
    assert.equal(pages.length, 2);
  });

  it('array of page numbers selects specific pages', async () => {
    const bytes = await createPdfBytes(5);
    const doc = await PDFDocument.load(bytes);
    const pages = getTargetPages(doc, [1, 3]);
    assert.equal(pages.length, 2);
  });
});

// ---------------------------------------------------------------------------
// overlayPdf
// ---------------------------------------------------------------------------

describe('overlayPdf', () => {
  it('foreground overlay on all pages returns valid blob', async () => {
    const base = await createPdfBytes(2);
    const overlay = await createPdfBytes(1);
    const result = await overlayPdf(base, overlay, { position: 'foreground', pages: 'all' });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.equal(result.pagesAffected, 2);
  });

  it('background overlay produces valid output', async () => {
    const base = await createPdfBytes(1);
    const overlay = await createPdfBytes(1);
    const result = await overlayPdf(base, overlay, { position: 'background' });
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pagesAffected, 1);
  });

  it('pages first only affects one page', async () => {
    const base = await createPdfBytes(3);
    const overlay = await createPdfBytes(1);
    const result = await overlayPdf(base, overlay, { pages: 'first' });
    assert.equal(result.pagesAffected, 1);
  });

  it('accepts opacity option without error', async () => {
    const base = await createPdfBytes(1);
    const overlay = await createPdfBytes(1);
    const result = await overlayPdf(base, overlay, { opacity: 0.5 });
    assert.ok(result.blob instanceof Blob);
  });

  it('accepts ArrayBuffer inputs', async () => {
    const base = await createPdfBytes(1);
    const overlay = await createPdfBytes(1);
    const result = await overlayPdf(base.buffer, overlay.buffer);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pagesAffected, 1);
  });
});
