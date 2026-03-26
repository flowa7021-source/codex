// ─── Unit Tests: MRC Compression ──────────────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { applyMrcCompression } from '../../app/modules/mrc-compression.js';

async function createTestPdf(pageCount = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return doc.save();
}

describe('applyMrcCompression', () => {
  it('returns blob and size stats', async () => {
    const bytes = await createTestPdf();
    const result = await applyMrcCompression(bytes);
    assert.ok(result.blob instanceof Blob);
    assert.equal(typeof result.originalSize, 'number');
    assert.equal(typeof result.compressedSize, 'number');
    assert.ok(result.ratio.endsWith('%'));
  });

  it('accepts quality option normal', async () => {
    const bytes = await createTestPdf();
    const result = await applyMrcCompression(bytes, { quality: 'normal' });
    assert.ok(result.blob.size > 0);
  });

  it('accepts quality option high', async () => {
    const bytes = await createTestPdf();
    const result = await applyMrcCompression(bytes, { quality: 'high' });
    assert.ok(result.blob.size > 0);
  });

  it('accepts quality option max', async () => {
    const bytes = await createTestPdf();
    const result = await applyMrcCompression(bytes, { quality: 'max' });
    assert.ok(result.blob.size > 0);
  });

  it('processes PDF without images without error', async () => {
    const bytes = await createTestPdf(3);
    const result = await applyMrcCompression(bytes);
    assert.ok(result.compressedSize > 0);
  });

  it('originalSize matches input size', async () => {
    const bytes = await createTestPdf();
    const result = await applyMrcCompression(bytes);
    assert.equal(result.originalSize, bytes.byteLength);
  });
});
