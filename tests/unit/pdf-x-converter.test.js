// ─── Unit Tests: PDF/X Converter ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { convertToPdfX, validatePdfX } from '../../app/modules/pdf-x-converter.js';

async function createTestPdf(pageCount = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return doc.save();
}

describe('convertToPdfX', () => {
  it('converts to PDF/X-4 without error', async () => {
    const bytes = await createTestPdf();
    const result = await convertToPdfX(bytes, 'PDF/X-4');
    assert.ok(result.blob instanceof Blob);
    assert.ok(Array.isArray(result.warnings));
  });

  it('supports PDF/X-1a standard', async () => {
    const bytes = await createTestPdf();
    const result = await convertToPdfX(bytes, 'PDF/X-1a');
    assert.ok(result.blob.size > 0);
  });

  it('supports PDF/X-3 standard', async () => {
    const bytes = await createTestPdf();
    const result = await convertToPdfX(bytes, 'PDF/X-3');
    assert.ok(result.blob.size > 0);
  });

  it('throws on unknown standard', async () => {
    const bytes = await createTestPdf();
    await assert.rejects(() => convertToPdfX(bytes, 'PDF/X-99'), /Unknown standard/);
  });

  it('adds OutputIntents to catalog', async () => {
    const bytes = await createTestPdf();
    const result = await convertToPdfX(bytes, 'PDF/X-4');
    const buf = await result.blob.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const { PDFName } = await import('pdf-lib');
    assert.ok(doc.catalog.get(PDFName.of('OutputIntents')));
  });

  it('ensures TrimBox on every page', async () => {
    const bytes = await createTestPdf(3);
    const result = await convertToPdfX(bytes, 'PDF/X-4');
    const buf = await result.blob.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const { PDFName } = await import('pdf-lib');
    for (const page of doc.getPages()) {
      assert.ok(page.node.get(PDFName.of('TrimBox')));
    }
  });
});

describe('validatePdfX', () => {
  it('validates converted PDF as valid', async () => {
    const bytes = await createTestPdf();
    const { blob } = await convertToPdfX(bytes, 'PDF/X-4');
    const buf = await blob.arrayBuffer();
    const result = await validatePdfX(new Uint8Array(buf), 'PDF/X-4');
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('reports missing OutputIntents on raw PDF', async () => {
    const bytes = await createTestPdf();
    const result = await validatePdfX(bytes, 'PDF/X-4');
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.rule === 'output-intent'));
  });
});
