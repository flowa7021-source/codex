import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { setCropBox, setTrimBox, setBleedBox, setArtBox } from '../../app/modules/smart-crop.js';

async function createTestPdf(pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

describe('setCropBox', () => {
  it('page CropBox in output matches given coordinates', async () => {
    const pdfBytes = await createTestPdf(2);
    const box = { x: 50, y: 50, width: 400, height: 600 };
    const blob = await setCropBox(pdfBytes, [1], box);
    assert.ok(blob instanceof Blob);

    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    const page = doc.getPage(0);
    const cropBox = page.getCropBox();
    assert.equal(cropBox.x, 50);
    assert.equal(cropBox.y, 50);
    assert.equal(cropBox.width, 400);
    assert.equal(cropBox.height, 600);
  });

  it('applies to multiple pages', async () => {
    const pdfBytes = await createTestPdf(3);
    const box = { x: 10, y: 20, width: 500, height: 700 };
    const blob = await setCropBox(pdfBytes, [1, 3], box);
    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);

    const crop1 = doc.getPage(0).getCropBox();
    assert.equal(crop1.x, 10);
    assert.equal(crop1.width, 500);

    const crop3 = doc.getPage(2).getCropBox();
    assert.equal(crop3.x, 10);
    assert.equal(crop3.width, 500);
  });

  it('skips invalid page numbers gracefully', async () => {
    const pdfBytes = await createTestPdf(1);
    const box = { x: 0, y: 0, width: 100, height: 100 };
    const blob = await setCropBox(pdfBytes, [1, 99], box);
    assert.ok(blob instanceof Blob);
  });
});

describe('setTrimBox', () => {
  it('sets TrimBox on specified page', async () => {
    const pdfBytes = await createTestPdf(1);
    const box = { x: 30, y: 30, width: 552, height: 732 };
    const blob = await setTrimBox(pdfBytes, [1], box);
    assert.ok(blob instanceof Blob);

    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    const page = doc.getPage(0);
    const trimBox = page.getTrimBox();
    assert.equal(trimBox.x, 30);
    assert.equal(trimBox.y, 30);
    assert.equal(trimBox.width, 552);
    assert.equal(trimBox.height, 732);
  });
});

describe('setBleedBox', () => {
  it('sets BleedBox on specified page', async () => {
    const pdfBytes = await createTestPdf(1);
    const box = { x: 5, y: 5, width: 602, height: 782 };
    const blob = await setBleedBox(pdfBytes, [1], box);
    assert.ok(blob instanceof Blob);

    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    const page = doc.getPage(0);
    const bleedBox = page.getBleedBox();
    assert.equal(bleedBox.x, 5);
    assert.equal(bleedBox.y, 5);
    assert.equal(bleedBox.width, 602);
    assert.equal(bleedBox.height, 782);
  });
});

describe('setArtBox', () => {
  it('sets ArtBox on specified page', async () => {
    const pdfBytes = await createTestPdf(1);
    const box = { x: 40, y: 40, width: 532, height: 712 };
    const blob = await setArtBox(pdfBytes, [1], box);
    assert.ok(blob instanceof Blob);

    const outBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(outBytes);
    const page = doc.getPage(0);
    const artBox = page.getArtBox();
    assert.equal(artBox.x, 40);
    assert.equal(artBox.y, 40);
    assert.equal(artBox.width, 532);
    assert.equal(artBox.height, 712);
  });
});
