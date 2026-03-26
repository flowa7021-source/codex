import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { combineFilesToPdf } from '../../app/modules/combine-to-pdf.js';

async function createMinimalPdfBytes() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return new Uint8Array(await doc.save());
}

describe('combineFilesToPdf', () => {
  it('merges a single PDF input and returns correct structure', async () => {
    const pdfBytes = await createMinimalPdfBytes();
    const result = await combineFilesToPdf([
      { name: 'doc1.pdf', bytes: pdfBytes, type: 'pdf' },
    ]);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.equal(result.pageCount, 1);
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].name, 'doc1.pdf');
  });

  it('merges two PDFs and sums page counts', async () => {
    const pdf1 = await createMinimalPdfBytes();
    const doc2 = await PDFDocument.create();
    doc2.addPage([612, 792]);
    doc2.addPage([612, 792]);
    const pdf2 = new Uint8Array(await doc2.save());

    const result = await combineFilesToPdf([
      { name: 'a.pdf', bytes: pdf1, type: 'pdf' },
      { name: 'b.pdf', bytes: pdf2, type: 'pdf' },
    ]);
    assert.equal(result.pageCount, 3);
    assert.equal(result.sources.length, 2);
    assert.equal(result.sources[1].startPage, 2);
  });

  it('handles txt input type', async () => {
    const txtBytes = new TextEncoder().encode('Hello world\nLine two');
    const result = await combineFilesToPdf([
      { name: 'notes.txt', bytes: txtBytes, type: 'txt' },
    ]);
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.pageCount >= 1);
  });

  it('handles html input type', async () => {
    const htmlBytes = new TextEncoder().encode('<html><body><p>Hi</p></body></html>');
    const result = await combineFilesToPdf([
      { name: 'page.html', bytes: htmlBytes, type: 'html' },
    ]);
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.pageCount >= 1);
  });

  it('addBookmarks option creates outline entries without error', async () => {
    const pdfBytes = await createMinimalPdfBytes();
    const result = await combineFilesToPdf(
      [
        { name: 'first.pdf', bytes: pdfBytes, type: 'pdf' },
        { name: 'second.pdf', bytes: pdfBytes, type: 'pdf' },
      ],
      { addBookmarks: true, title: 'Combined' },
    );
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.pageCount, 2);
  });

  it('tracks source info with correct startPage values', async () => {
    const pdfBytes = await createMinimalPdfBytes();
    const result = await combineFilesToPdf([
      { name: 'a.pdf', bytes: pdfBytes, type: 'pdf' },
      { name: 'b.pdf', bytes: pdfBytes, type: 'pdf' },
      { name: 'c.pdf', bytes: pdfBytes, type: 'pdf' },
    ]);
    assert.equal(result.sources[0].startPage, 1);
    assert.equal(result.sources[1].startPage, 2);
    assert.equal(result.sources[2].startPage, 3);
  });
});
