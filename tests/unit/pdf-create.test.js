import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { createBlankPdf, createPdfFromImages } from '../../app/modules/pdf-create.js';

describe('createBlankPdf', () => {
  it('creates a single-page PDF by default', async () => {
    const blob = await createBlankPdf();
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
  });

  it('creates multiple pages', async () => {
    const blob = await createBlankPdf({ pages: 5 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 5);
  });

  it('uses A4 dimensions by default', async () => {
    const blob = await createBlankPdf();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    assert.ok(Math.abs(width - 595.28) < 1);
    assert.ok(Math.abs(height - 841.89) < 1);
  });

  it('uses custom dimensions', async () => {
    const blob = await createBlankPdf({ width: 400, height: 600 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    assert.equal(width, 400);
    assert.equal(height, 600);
  });

  it('creates lined paper', async () => {
    const blob = await createBlankPdf({ lined: true });
    assert.ok(blob instanceof Blob);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
  });

  it('creates grid paper', async () => {
    const blob = await createBlankPdf({ grid: true });
    assert.ok(blob instanceof Blob);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
  });

  it('creates lined and grid combined', async () => {
    const blob = await createBlankPdf({ lined: true, grid: true, pages: 2 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 2);
  });
});

describe('createPdfFromImages', () => {
  let pngBytes;

  // Create a minimal valid PNG
  beforeEach(async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([100, 100]);
    const savedBytes = await doc.save();
    // Use pdf-lib to create a tiny PNG-like image embedded in a PDF
    // For testing, we'll create a minimal 1x1 PNG
    pngBytes = createMinimalPng();
  });

  it('creates PDF from a single image', async () => {
    const blob = await createPdfFromImages([
      { data: pngBytes, type: 'image/png', name: 'test.png' },
    ]);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
  });

  it('creates one page per image', async () => {
    const blob = await createPdfFromImages([
      { data: pngBytes, type: 'image/png', name: '1.png' },
      { data: pngBytes, type: 'image/png', name: '2.png' },
      { data: pngBytes, type: 'image/png', name: '3.png' },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 3);
  });

  it('supports fit scaling mode', async () => {
    const blob = await createPdfFromImages(
      [{ data: pngBytes, type: 'image/png', name: 'test.png' }],
      { scaling: 'fit' },
    );
    assert.ok(blob instanceof Blob);
  });

  it('supports stretch scaling mode', async () => {
    const blob = await createPdfFromImages(
      [{ data: pngBytes, type: 'image/png', name: 'test.png' }],
      { scaling: 'stretch' },
    );
    assert.ok(blob instanceof Blob);
  });

  it('supports actual scaling mode', async () => {
    const blob = await createPdfFromImages(
      [{ data: pngBytes, type: 'image/png', name: 'test.png' }],
      { scaling: 'actual' },
    );
    assert.ok(blob instanceof Blob);
  });

  it('adds labels when requested', async () => {
    const blob = await createPdfFromImages(
      [{ data: pngBytes, type: 'image/png', name: 'test.png' }],
      { addLabels: true },
    );
    assert.ok(blob instanceof Blob);
  });
});

// Minimal valid 1x1 white PNG (67 bytes)
function createMinimalPng() {
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  // IHDR chunk
  const ihdr = [
    0x00, 0x00, 0x00, 0x0d, // length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width=1
    0x00, 0x00, 0x00, 0x01, // height=1
    0x08, 0x02,             // bit depth=8, color type=RGB
    0x00, 0x00, 0x00,       // compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC
  ];
  // IDAT chunk (zlib-compressed row filter byte + 3 bytes RGB)
  const idat = [
    0x00, 0x00, 0x00, 0x0c, // length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
    0x01, 0x01, 0x01, 0x00, // CRC
    0x18, 0xdd, 0x8d, 0xb4,
  ];
  // IEND chunk
  const iend = [
    0x00, 0x00, 0x00, 0x00, // length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82, // CRC
  ];
  return new Uint8Array([...header, ...ihdr, ...idat, ...iend]);
}
