import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { convertToPdfA, checkPdfACompliance } from '../../app/modules/pdf-a-converter.js';

async function createTestPdf(opts = {}) {
  const doc = await PDFDocument.create();
  if (opts.title) doc.setTitle(opts.title);
  if (opts.author) doc.setAuthor(opts.author);
  doc.addPage([612, 792]);
  return doc.save();
}

describe('convertToPdfA', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf();
  });

  it('returns a blob and report', async () => {
    const { blob, report } = await convertToPdfA(pdfBytes);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
    assert.ok(report);
  });

  it('sets metadata from options', async () => {
    const { blob } = await convertToPdfA(pdfBytes, {
      title: 'My Title',
      author: 'Author',
      subject: 'Subject',
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getTitle(), 'My Title');
    assert.equal(doc.getAuthor(), 'Author');
    assert.equal(doc.getSubject(), 'Subject');
  });

  it('adds MarkInfo dictionary', async () => {
    const { blob, report } = await convertToPdfA(pdfBytes);
    assert.equal(report.markInfoAdded, true);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.catalog.get(PDFName.of('MarkInfo')));
  });

  it('adds StructTreeRoot', async () => {
    const { blob, report } = await convertToPdfA(pdfBytes);
    assert.equal(report.structTreeAdded, true);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.catalog.get(PDFName.of('StructTreeRoot')));
  });

  it('adds XMP metadata stream', async () => {
    const { blob } = await convertToPdfA(pdfBytes);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.catalog.get(PDFName.of('Metadata')));
  });

  it('sets ViewerPreferences', async () => {
    const { blob } = await convertToPdfA(pdfBytes);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.catalog.get(PDFName.of('ViewerPreferences')));
  });

  it('removes JavaScript entries', async () => {
    const { blob } = await convertToPdfA(pdfBytes);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.catalog.get(PDFName.of('JavaScript')), undefined);
    assert.equal(doc.catalog.get(PDFName.of('JS')), undefined);
  });

  it('report.metadataAdded is true', async () => {
    const { report } = await convertToPdfA(pdfBytes);
    assert.equal(report.metadataAdded, true);
  });

  it('uses existing title when none provided', async () => {
    const bytes = await createTestPdf({ title: 'Existing Title' });
    const { blob } = await convertToPdfA(bytes);
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    assert.equal(doc.getTitle(), 'Existing Title');
  });

  it('accepts ArrayBuffer input', async () => {
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const { blob } = await convertToPdfA(ab);
    assert.ok(blob instanceof Blob);
  });
});

describe('checkPdfACompliance', () => {
  it('reports issues for a plain PDF', async () => {
    const bytes = await createTestPdf();
    const result = await checkPdfACompliance(bytes);
    assert.equal(result.compliant, false);
    assert.ok(result.issues.length > 0);
  });

  it('reports fewer issues after conversion', async () => {
    const bytes = await createTestPdf();
    const beforeCheck = await checkPdfACompliance(bytes);
    const { blob } = await convertToPdfA(bytes, { title: 'Test' });
    const converted = new Uint8Array(await blob.arrayBuffer());
    const afterCheck = await checkPdfACompliance(converted);
    assert.ok(afterCheck.issues.length < beforeCheck.issues.length);
  });

  it('detects missing title', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const result = await checkPdfACompliance(bytes);
    assert.ok(result.issues.some(i => i.includes('title')));
  });

  it('detects missing MarkInfo', async () => {
    const bytes = await createTestPdf();
    const result = await checkPdfACompliance(bytes);
    assert.ok(result.issues.some(i => i.includes('MarkInfo')));
  });

  it('detects missing XMP metadata', async () => {
    const bytes = await createTestPdf();
    const result = await checkPdfACompliance(bytes);
    assert.ok(result.issues.some(i => i.includes('XMP')));
  });
});
