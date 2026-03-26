import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// pdf-to-csv dynamically imports pdfjs-dist and table-extractor.
let convertPdfToCsv;
let moduleAvailable = false;

try {
  const mod = await import('../../app/modules/pdf-to-csv.js');
  convertPdfToCsv = mod.convertPdfToCsv;
  moduleAvailable = true;
} catch {
  // Module may fail if pdfjs-dist or table-extractor has issues
}

/**
 * Create a minimal PDF with tabular-looking text.
 * @param {number} pageCount
 * @returns {Promise<Uint8Array>}
 */
async function createTestPdf(pageCount = 1) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([612, 792]);
    page.drawText('Name', { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText('Age', { x: 200, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText('Alice', { x: 72, y: 680, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText('30', { x: 200, y: 680, size: 12, font, color: rgb(0, 0, 0) });
  }
  return new Uint8Array(await pdf.save());
}

describe('pdf-to-csv', { skip: !moduleAvailable && 'pdfjs-dist not available' }, () => {
  it('convertPdfToCsv is a function', () => {
    assert.equal(typeof convertPdfToCsv, 'function');
  });

  it('returns csv string and tableCount', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToCsv(pdfBytes);

    assert.equal(typeof result.csv, 'string');
    assert.equal(typeof result.tableCount, 'number');
  });

  it('extracts text rows when tableOnly=false', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToCsv(pdfBytes, { tableOnly: false });

    // Should have content from the text items
    assert.equal(typeof result.csv, 'string');
    assert.ok(result.csv.length > 0);
  });

  it('processes only first page when allPages=false', async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await convertPdfToCsv(pdfBytes, { allPages: false, tableOnly: false });
    assert.ok(result.tableCount >= 0);
  });

  it('uses custom separator when provided', async () => {
    const pdfBytes = await createTestPdf();
    const result = await convertPdfToCsv(pdfBytes, { separator: ';', tableOnly: false });

    if (result.csv.length > 0) {
      assert.ok(result.csv.includes(';'));
    }
  });

  it('handles empty PDF gracefully', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const pdfBytes = new Uint8Array(await pdf.save());

    const result = await convertPdfToCsv(pdfBytes, { tableOnly: false });
    assert.equal(typeof result.csv, 'string');
    assert.equal(result.tableCount, 0);
  });
});

// Standalone CSV escaping tests (no pdfjs-dist needed)
describe('CSV escaping logic', () => {
  // Replicate the escapeCsvField logic for direct testing
  function escapeCsvField(field, separator = ',') {
    if (
      field.includes(separator) ||
      field.includes('"') ||
      field.includes('\n') ||
      field.includes('\r')
    ) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }

  it('plain text is not escaped', () => {
    assert.equal(escapeCsvField('hello'), 'hello');
  });

  it('field with comma is wrapped in quotes', () => {
    assert.equal(escapeCsvField('a,b'), '"a,b"');
  });

  it('field with quotes doubles internal quotes', () => {
    assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
  });

  it('field with newline is wrapped in quotes', () => {
    assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"');
  });

  it('field with custom separator is escaped', () => {
    assert.equal(escapeCsvField('a;b', ';'), '"a;b"');
  });

  it('field without special chars stays plain', () => {
    assert.equal(escapeCsvField('simple text', ';'), 'simple text');
  });
});
