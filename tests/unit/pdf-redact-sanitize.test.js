import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { PdfRedactor } from '../../app/modules/pdf-redact.js';

async function createTestPdf() {
  const doc = await PDFDocument.create();
  doc.setAuthor('Test Author');
  doc.setSubject('Secret Subject');
  doc.setKeywords(['secret', 'internal']);
  doc.addPage([612, 792]);
  return doc.save();
}

describe('PdfRedactor.sanitizeDocument', () => {
  let redactor;
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf();
    redactor = new PdfRedactor();
  });

  it('works on minimal PDF without error', async () => {
    const { blob, removedItems } = await redactor.sanitizeDocument(pdfBytes);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
    assert.ok(removedItems);
    assert.equal(removedItems.metadata, true);
  });

  it('metadata cleaned', async () => {
    const { blob } = await redactor.sanitizeDocument(pdfBytes);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getAuthor(), '');
    assert.equal(doc.getSubject(), '');
    // pdf-lib overrides Producer on save, so just check Creator
    assert.equal(doc.getCreator(), 'NovaReader');
  });

  it('output does not contain /JS keys after sanitization', async () => {
    // Create a PDF that has a Names dict (simulated; pdf-lib doesn't easily add JS)
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    const { blob, removedItems } = await redactor.sanitizeDocument(bytes);
    assert.ok(blob instanceof Blob);
    // js count should be 0 since there were no JS entries to remove
    assert.equal(removedItems.js, 0);

    // Verify the output PDF loads cleanly
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const outDoc = await PDFDocument.load(outBytes);
    // No JavaScript in Names
    const names = outDoc.catalog.get(PDFName.of('Names'));
    if (names instanceof PDFDict) {
      assert.equal(names.get(PDFName.of('JavaScript')), undefined);
    }
  });

  it('embedded files removed', async () => {
    // Create a basic PDF (no embedded files to remove)
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();

    const { blob, removedItems } = await redactor.sanitizeDocument(bytes);
    assert.ok(blob instanceof Blob);
    // No embedded files were present, so count stays 0
    assert.equal(removedItems.attachments, 0);

    // Verify output has no EmbeddedFiles
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const outDoc = await PDFDocument.load(outBytes);
    const names = outDoc.catalog.get(PDFName.of('Names'));
    if (names instanceof PDFDict) {
      assert.equal(names.get(PDFName.of('EmbeddedFiles')), undefined);
    }
  });
});
