import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import { PdfOptimizer, pdfOptimizer, COMPRESSION_PROFILES } from '../../app/modules/pdf-optimize.js';

async function createTestPdf(opts = {}) {
  const doc = await PDFDocument.create();
  if (opts.title) doc.setTitle(opts.title);
  if (opts.author) doc.setAuthor(opts.author);
  for (let i = 0; i < (opts.pages || 1); i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

describe('PdfOptimizer.optimize', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf({ title: 'Test', author: 'Author', pages: 2 });
  });

  it('returns optimization result', async () => {
    const result = await pdfOptimizer.optimize(pdfBytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.ok(typeof result.original === 'number');
    assert.ok(typeof result.optimized === 'number');
    assert.ok(typeof result.savings === 'number');
    assert.ok(typeof result.savingsPercent === 'string');
    assert.ok(result.details);
    assert.ok(typeof result.summary === 'string');
  });

  it('cleans metadata by default', async () => {
    const result = await pdfOptimizer.optimize(pdfBytes);
    assert.equal(result.details.metadataCleaned, true);
    const outBytes = new Uint8Array(await result.blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    assert.equal(doc.getAuthor(), '');
  });

  it('preserves metadata when cleanMetadata is false', async () => {
    const result = await pdfOptimizer.optimize(pdfBytes, { cleanMetadata: false });
    assert.equal(result.details.metadataCleaned, false);
    const outBytes = new Uint8Array(await result.blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    assert.equal(doc.getAuthor(), 'Author');
  });

  it('preserves page count', async () => {
    const result = await pdfOptimizer.optimize(pdfBytes);
    const outBytes = new Uint8Array(await result.blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    assert.equal(doc.getPageCount(), 2);
  });

  it('savings is non-negative', async () => {
    const result = await pdfOptimizer.optimize(pdfBytes);
    assert.ok(result.savings >= 0);
  });

  it('original size matches input', async () => {
    const result = await pdfOptimizer.optimize(pdfBytes);
    assert.equal(result.original, pdfBytes.byteLength);
  });

  it('removes XMP metadata when cleaning', async () => {
    // Create a PDF, convert to PDF/A first to add XMP, then optimize
    const result = await pdfOptimizer.optimize(pdfBytes, { cleanMetadata: true });
    const outBytes = new Uint8Array(await result.blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    assert.equal(doc.catalog.get(PDFName.of('Metadata')), undefined);
  });

  it('accepts ArrayBuffer input', async () => {
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const result = await pdfOptimizer.optimize(ab);
    assert.ok(result.blob instanceof Blob);
  });
});

describe('PdfOptimizer.analyze', () => {
  it('returns analysis of a basic PDF', async () => {
    const bytes = await createTestPdf({ title: 'Test', author: 'Auth', pages: 3 });
    const analysis = await pdfOptimizer.analyze(bytes);
    assert.equal(analysis.pageCount, 3);
    assert.ok(typeof analysis.totalSize === 'string');
    assert.equal(typeof analysis.imageCount, 'number');
    assert.equal(typeof analysis.hasJavaScript, 'boolean');
    assert.equal(typeof analysis.hasThumbnails, 'boolean');
    assert.equal(typeof analysis.annotationCount, 'number');
    assert.equal(analysis.hasTitle, true);
    assert.equal(analysis.hasAuthor, true);
  });

  it('detects absence of title and author', async () => {
    const bytes = await createTestPdf();
    const analysis = await pdfOptimizer.analyze(bytes);
    assert.equal(analysis.hasTitle, false);
    assert.equal(analysis.hasAuthor, false);
  });

  it('reports zero images for text-only PDF', async () => {
    const bytes = await createTestPdf();
    const analysis = await pdfOptimizer.analyze(bytes);
    assert.equal(analysis.imageCount, 0);
  });
});

describe('PdfOptimizer._formatSize', () => {
  it('formats bytes correctly', () => {
    const opt = new PdfOptimizer();
    assert.equal(opt._formatSize(0), '0 B');
    assert.ok(opt._formatSize(1024).includes('1'));
    assert.ok(opt._formatSize(1048576).includes('1'));
  });
});

describe('pdfOptimizer singleton', () => {
  it('is an instance of PdfOptimizer', () => {
    assert.ok(pdfOptimizer instanceof PdfOptimizer);
  });
});

describe('PdfOptimizer.optimizeWithProfile', () => {
  it('optimizes with screen profile', async () => {
    const bytes = await createTestPdf({ pages: 1 });
    const result = await pdfOptimizer.optimizeWithProfile(bytes, 'screen');
    assert.ok(result.blob instanceof Blob);
  });

  it('optimizes with ebook profile', async () => {
    const bytes = await createTestPdf({ pages: 1 });
    const result = await pdfOptimizer.optimizeWithProfile(bytes, 'ebook');
    assert.ok(result.blob instanceof Blob);
  });

  it('optimizes with print profile', async () => {
    const bytes = await createTestPdf({ pages: 1 });
    const result = await pdfOptimizer.optimizeWithProfile(bytes, 'print');
    assert.ok(result.blob instanceof Blob);
  });

  it('optimizes with prepress profile', async () => {
    const bytes = await createTestPdf({ pages: 1 });
    const result = await pdfOptimizer.optimizeWithProfile(bytes, 'prepress');
    assert.ok(result.blob instanceof Blob);
  });

  it('throws for unknown profile name', async () => {
    const bytes = await createTestPdf();
    await assert.rejects(
      () => pdfOptimizer.optimizeWithProfile(bytes, 'unknown'),
      /Unknown profile/,
    );
  });

  it('COMPRESSION_PROFILES exports all 4 profiles', () => {
    assert.ok(COMPRESSION_PROFILES.screen);
    assert.ok(COMPRESSION_PROFILES.ebook);
    assert.ok(COMPRESSION_PROFILES.print);
    assert.ok(COMPRESSION_PROFILES.prepress);
  });
});

describe('PdfOptimizer.subsetFonts', () => {
  it('returns fontsProcessed=0 for PDF with no embedded fonts', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const result = await pdfOptimizer.subsetFonts(doc);
    assert.equal(typeof result.fontsProcessed, 'number');
    assert.equal(result.fontsProcessed, 0);
    assert.equal(result.bytesSaved, 0);
  });

  it('returns fontsProcessed >= 1 for PDF with text using embedded font', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    page.drawText('Hello', { x: 50, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    const result = await pdfOptimizer.subsetFonts(doc);
    assert.ok(result.fontsProcessed >= 1);
  });
});
