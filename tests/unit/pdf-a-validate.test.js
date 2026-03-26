import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { validatePdfA, convertToPdfA } from '../../app/modules/pdf-a-converter.js';

async function createMinimalPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
}

describe('validatePdfA', () => {
  it('PDF with JS returns error about JavaScript', async () => {
    // Create a PDF and manually inject a JavaScript Names entry
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);

    // Add a Names dict with JavaScript key
    const jsDict = doc.context.obj({});
    const namesDict = doc.context.obj({ JavaScript: jsDict });
    doc.catalog.set(PDFName.of('Names'), namesDict);

    const bytes = await doc.save();
    const result = await validatePdfA(bytes);
    assert.equal(result.valid, false);
    const jsErrors = result.errors.filter(e => e.rule === 'no-javascript');
    assert.ok(jsErrors.length > 0, 'Should have a no-javascript error');
    assert.ok(jsErrors[0].message.includes('JavaScript'));
  });

  it('clean PDF/A (converted) is valid', async () => {
    const pdfBytes = await createMinimalPdf();
    // Convert to PDF/A first
    const { blob } = await convertToPdfA(pdfBytes, { title: 'Test' });
    const convertedBytes = new Uint8Array(await blob.arrayBuffer());

    const result = await validatePdfA(convertedBytes);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('missing XMP returns error', async () => {
    // A minimal PDF has no XMP metadata
    const pdfBytes = await createMinimalPdf();
    const result = await validatePdfA(pdfBytes);
    assert.equal(result.valid, false);
    const xmpErrors = result.errors.filter(e => e.rule === 'xmp-metadata');
    assert.ok(xmpErrors.length > 0, 'Should have an xmp-metadata error');
    assert.ok(xmpErrors[0].message.includes('XMP'));
  });
});
