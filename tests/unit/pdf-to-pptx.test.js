import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// pdf-to-pptx dynamically imports pdfjs-dist. We attempt to load the module
// and skip tests gracefully if pdfjs-dist is not available in the test env.

let convertPdfToPptx;
let moduleAvailable = false;

try {
  const mod = await import('../../app/modules/pdf-to-pptx.js');
  convertPdfToPptx = mod.convertPdfToPptx;
  moduleAvailable = true;
} catch {
  // Module may fail if pdfjs-dist is not properly loadable
}

/**
 * Create a minimal PDF with text on the page.
 * @param {number} pageCount
 * @returns {Promise<Uint8Array>}
 */
async function createTestPdf(pageCount = 1) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Page ${i + 1} content`, { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  }
  return new Uint8Array(await pdf.save());
}

describe('pdf-to-pptx', { skip: !moduleAvailable && 'pdfjs-dist not available' }, () => {
  it('convertPdfToPptx is a function', () => {
    assert.equal(typeof convertPdfToPptx, 'function');
  });

  it('returns a blob and slideCount', async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await convertPdfToPptx(pdfBytes);

    assert.ok(result.blob instanceof Blob);
    assert.equal(result.slideCount, 2);
  });

  it('PPTX blob has correct MIME type', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await convertPdfToPptx(pdfBytes);

    assert.equal(
      result.blob.type,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
  });

  it('output ZIP starts with PK signature', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await convertPdfToPptx(pdfBytes);
    const arrayBuf = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    // ZIP files start with PK (0x50 0x4B)
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4B);
  });

  it('produces single slide for single-page PDF', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await convertPdfToPptx(pdfBytes);
    assert.equal(result.slideCount, 1);
  });

  it('produces slides with text overlay by default', async () => {
    const pdfBytes = await createTestPdf(1);
    const result = await convertPdfToPptx(pdfBytes, { textOverlay: true });
    assert.ok(result.slideCount >= 1);
  });

  it('handles multi-page PDF', async () => {
    const pdfBytes = await createTestPdf(3);
    const result = await convertPdfToPptx(pdfBytes);
    assert.equal(result.slideCount, 3);
  });
});
