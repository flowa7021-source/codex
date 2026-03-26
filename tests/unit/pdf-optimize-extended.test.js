import './setup-dom.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
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

describe('COMPRESSION_PROFILES', () => {
  it('has exactly 4 profiles', () => {
    assert.equal(Object.keys(COMPRESSION_PROFILES).length, 4);
  });

  it('contains screen, ebook, print, prepress', () => {
    assert.ok(COMPRESSION_PROFILES.screen);
    assert.ok(COMPRESSION_PROFILES.ebook);
    assert.ok(COMPRESSION_PROFILES.print);
    assert.ok(COMPRESSION_PROFILES.prepress);
  });

  it('all profiles have required keys', () => {
    const requiredKeys = ['maxImageDpi', 'jpegQuality', 'cleanMetadata', 'removeThumbnails', 'removeJavaScript'];
    for (const [name, profile] of Object.entries(COMPRESSION_PROFILES)) {
      for (const key of requiredKeys) {
        assert.ok(key in profile, `Profile "${name}" missing key "${key}"`);
      }
    }
  });

  it('screen profile has lowest DPI and quality', () => {
    assert.equal(COMPRESSION_PROFILES.screen.maxImageDpi, 72);
    assert.equal(COMPRESSION_PROFILES.screen.jpegQuality, 30);
    assert.equal(COMPRESSION_PROFILES.screen.cleanMetadata, true);
  });

  it('prepress profile has highest quality', () => {
    assert.equal(COMPRESSION_PROFILES.prepress.maxImageDpi, 300);
    assert.equal(COMPRESSION_PROFILES.prepress.jpegQuality, 95);
    assert.equal(COMPRESSION_PROFILES.prepress.cleanMetadata, false);
  });
});

describe('PdfOptimizer.optimizeWithProfile', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf({ title: 'Test', author: 'Author', pages: 2 });
  });

  it('screen profile optimizes without error', async () => {
    const result = await pdfOptimizer.optimizeWithProfile(pdfBytes, 'screen');
    assert.ok(result.blob instanceof Blob);
    assert.ok(typeof result.original === 'number');
    assert.ok(typeof result.optimized === 'number');
    assert.ok(result.savings >= 0);
  });

  it('ebook profile optimizes without error', async () => {
    const result = await pdfOptimizer.optimizeWithProfile(pdfBytes, 'ebook');
    assert.ok(result.blob instanceof Blob);
  });

  it('print profile optimizes without error', async () => {
    const result = await pdfOptimizer.optimizeWithProfile(pdfBytes, 'print');
    assert.ok(result.blob instanceof Blob);
  });

  it('prepress profile works without error', async () => {
    const result = await pdfOptimizer.optimizeWithProfile(pdfBytes, 'prepress');
    assert.ok(result.blob instanceof Blob);
    assert.ok(typeof result.original === 'number');
  });

  it('throws on unknown profile', async () => {
    await assert.rejects(
      () => pdfOptimizer.optimizeWithProfile(pdfBytes, 'nonexistent'),
      { message: 'Unknown profile: nonexistent' }
    );
  });

  it('screen profile cleans metadata', async () => {
    const result = await pdfOptimizer.optimizeWithProfile(pdfBytes, 'screen');
    assert.equal(result.details.metadataCleaned, true);
  });

  it('prepress profile preserves metadata', async () => {
    const result = await pdfOptimizer.optimizeWithProfile(pdfBytes, 'prepress');
    assert.equal(result.details.metadataCleaned, false);
  });
});

describe('PdfOptimizer._processImages', () => {
  it('method exists on the class', () => {
    const opt = new PdfOptimizer();
    assert.equal(typeof opt._processImages, 'function');
  });

  it('returns stats for a PDF with no images', async () => {
    const pdfBytes = await createTestPdf({ pages: 1 });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const opt = new PdfOptimizer();
    const result = await opt._processImages(pdfDoc, 150, 75);
    assert.equal(typeof result.imagesProcessed, 'number');
    assert.equal(typeof result.bytesSaved, 'number');
    assert.equal(result.imagesProcessed, 0);
    assert.equal(result.bytesSaved, 0);
  });

  it('details include image stats when _downscaleImages is true', async () => {
    const pdfBytes = await createTestPdf({ pages: 1 });
    const result = await pdfOptimizer.optimize(pdfBytes, { _downscaleImages: true, _maxImageDpi: 72 });
    assert.equal(typeof result.details.imagesProcessed, 'number');
    assert.equal(typeof result.details.imageBytesSaved, 'number');
  });
});

describe('PdfOptimizer.subsetFonts', () => {
  it('method exists on the class', () => {
    const opt = new PdfOptimizer();
    assert.equal(typeof opt.subsetFonts, 'function');
  });

  it('returns { fontsProcessed, bytesSaved } for empty PDF', async () => {
    const pdfBytes = await createTestPdf({ pages: 1 });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const opt = new PdfOptimizer();
    const result = await opt.subsetFonts(pdfDoc);
    assert.equal(typeof result.fontsProcessed, 'number');
    assert.equal(typeof result.bytesSaved, 'number');
    assert.equal(result.bytesSaved, 0);
  });

  it('fontsProcessed is non-negative', async () => {
    const pdfBytes = await createTestPdf({ pages: 2 });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const opt = new PdfOptimizer();
    const result = await opt.subsetFonts(pdfDoc);
    assert.ok(result.fontsProcessed >= 0);
  });
});
