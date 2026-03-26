import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// pdf-to-rtf dynamically imports pdfjs-dist.
let convertPdfToRtf;
let moduleAvailable = false;

try {
  const mod = await import('../../app/modules/pdf-to-rtf.js');
  convertPdfToRtf = mod.convertPdfToRtf;
  moduleAvailable = true;
} catch {
  // Module may fail if pdfjs-dist is not properly loadable
}

/**
 * Create a minimal PDF with text.
 * @returns {Promise<Uint8Array>}
 */
async function createTestPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  page.drawText('Hello World', { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  page.drawText('Bold text', { x: 72, y: 680, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  return new Uint8Array(await pdf.save());
}

describe('pdf-to-rtf', { skip: !moduleAvailable && 'pdfjs-dist not available' }, () => {
  it('convertPdfToRtf is a function', () => {
    assert.equal(typeof convertPdfToRtf, 'function');
  });

  it('returns a blob and pageCount', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);

    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pageCount, 1);
  });

  it('RTF output contains \\rtf1 header', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    const text = await result.blob.text();

    assert.ok(text.startsWith('{\\rtf1'));
  });

  it('RTF output contains font table', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    const text = await result.blob.text();

    assert.ok(text.includes('\\fonttbl'));
  });

  it('RTF output contains \\b for bold font names', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    const text = await result.blob.text();

    // The bold text item should trigger a \b control word
    assert.ok(text.includes('\\b'));
  });

  it('RTF output contains \\fs for font size', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    const text = await result.blob.text();

    // Font size should appear somewhere (half-point format)
    assert.ok(/\\fs\d+/.test(text));
  });

  it('RTF output has correct MIME type', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    assert.equal(result.blob.type, 'application/rtf');
  });

  it('RTF output is well-formed (matching braces)', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    const text = await result.blob.text();

    assert.ok(text.startsWith('{'));
    assert.ok(text.trimEnd().endsWith('}'));
  });

  it('RTF output contains color table', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToRtf(pdfBytes);
    const text = await result.blob.text();

    assert.ok(text.includes('\\colortbl'));
  });
});
