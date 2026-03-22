// ─── Extended Unit Tests: Page Model Module ─────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  TextLayerModel,
  PageModel,
  DocumentModel,
} from '../../app/modules/page-model.js';

// ─── TextLayerModel ─────────────────────────────────────────────────────────

describe('TextLayerModel', () => {
  it('constructs with defaults', () => {
    const model = new TextLayerModel();
    assert.deepEqual(model.charBoxes, []);
    assert.equal(model.source, 'native');
  });

  it('constructs with charBoxes', () => {
    const boxes = [
      { char: 'H', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 1, wordText: 'Hello', lineBaseline: 10, fontSize: 12 },
      { char: 'i', bbox: { x0: 10, y0: 0, x1: 20, y1: 10 }, confidence: 1, wordText: 'Hi', lineBaseline: 10, fontSize: 12 },
    ];
    const model = new TextLayerModel(boxes, 'ocr');
    assert.equal(model.charBoxes.length, 2);
    assert.equal(model.source, 'ocr');
  });

  it('plainText joins char boxes', () => {
    const boxes = [
      { char: 'H', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 1, wordText: '', lineBaseline: 10, fontSize: 12 },
      { char: 'i', bbox: { x0: 10, y0: 0, x1: 20, y1: 10 }, confidence: 1, wordText: '', lineBaseline: 10, fontSize: 12 },
    ];
    const model = new TextLayerModel(boxes);
    assert.equal(model.plainText, 'Hi');
  });

  it('removeTextInRect removes chars inside rect', () => {
    const boxes = [
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 1, wordText: '', lineBaseline: 10, fontSize: 12 },
      { char: 'B', bbox: { x0: 50, y0: 50, x1: 60, y1: 60 }, confidence: 1, wordText: '', lineBaseline: 50, fontSize: 12 },
    ];
    const model = new TextLayerModel(boxes);
    model.removeTextInRect({ x: 0, y: 0, width: 20, height: 20 });
    assert.equal(model.charBoxes.length, 1);
    assert.equal(model.charBoxes[0].char, 'B');
  });

  it('getTextInRect returns text inside rect', () => {
    const boxes = [
      { char: 'A', bbox: { x0: 5, y0: 5, x1: 10, y1: 10 }, confidence: 1, wordText: '', lineBaseline: 10, fontSize: 12 },
      { char: 'B', bbox: { x0: 50, y0: 50, x1: 60, y1: 60 }, confidence: 1, wordText: '', lineBaseline: 50, fontSize: 12 },
    ];
    const model = new TextLayerModel(boxes);
    assert.equal(model.getTextInRect({ x: 0, y: 0, width: 20, height: 20 }), 'A');
  });
});

// ─── PageModel ──────────────────────────────────────────────────────────────

describe('PageModel', () => {
  let page;

  beforeEach(() => {
    page = new PageModel(1, 595, 842);
  });

  it('constructs with correct properties', () => {
    assert.equal(page.pageNumber, 1);
    assert.equal(page.width, 595);
    assert.equal(page.height, 842);
    assert.deepEqual(page.objects, []);
    assert.ok(page.textLayer instanceof TextLayerModel);
  });

  it('addNativeTextBlock creates a text block', () => {
    const bbox = { x: 10, y: 100, width: 200, height: 20 };
    const lines = [{ runs: [{ text: 'Hello' }], baseline: 100 }];
    const block = page.addNativeTextBlock(bbox, lines);

    assert.equal(block.type, 'text');
    assert.equal(block.source, 'native');
    assert.equal(block.confidence, 1.0);
    assert.ok(block.id.startsWith('tb-'));
    assert.equal(page.metadata.hasNativeText, true);
  });

  it('addOcrTextBlock creates an OCR text block', () => {
    const bbox = { x: 10, y: 100, width: 200, height: 20 };
    const lines = [{ runs: [{ text: 'World' }], baseline: 100 }];
    const block = page.addOcrTextBlock(bbox, lines, 0.85);

    assert.equal(block.type, 'text');
    assert.equal(block.source, 'ocr');
    assert.equal(block.confidence, 0.85);
    assert.equal(page.metadata.hasOcrText, true);
  });

  it('addImageBlock creates an image block', () => {
    const bbox = { x: 0, y: 0, width: 595, height: 842 };
    const block = page.addImageBlock(bbox, null, 'image/jpeg', true);

    assert.equal(block.type, 'image');
    assert.equal(block.isBackground, true);
    assert.equal(page.metadata.isScanned, true);
  });

  it('addImageBlock non-background does not set isScanned', () => {
    const bbox = { x: 10, y: 10, width: 100, height: 100 };
    page.addImageBlock(bbox, null, 'image/png', false);
    assert.equal(page.metadata.isScanned, false);
  });

  it('addPathBlock creates a path block', () => {
    const bbox = { x: 10, y: 10, width: 100, height: 100 };
    const ops = [{ op: 'moveTo', args: [10, 10] }, { op: 'lineTo', args: [110, 110] }];
    const block = page.addPathBlock(bbox, ops, { color: '#000', width: 1, dash: null });

    assert.equal(block.type, 'path');
    assert.ok(block.id.startsWith('pb-'));
  });

  it('objectsInRect returns intersecting objects', () => {
    page.addNativeTextBlock({ x: 10, y: 10, width: 50, height: 20 },
      [{ runs: [{ text: 'A' }], baseline: 10 }]);
    page.addNativeTextBlock({ x: 200, y: 200, width: 50, height: 20 },
      [{ runs: [{ text: 'B' }], baseline: 200 }]);

    const found = page.objectsInRect({ x: 0, y: 0, width: 100, height: 100 });
    assert.equal(found.length, 1);
  });

  it('objectAtPoint returns the top-most object', () => {
    page.addNativeTextBlock({ x: 0, y: 0, width: 100, height: 100 },
      [{ runs: [{ text: 'A' }], baseline: 50 }]);
    page.addNativeTextBlock({ x: 0, y: 0, width: 100, height: 100 },
      [{ runs: [{ text: 'B' }], baseline: 50 }]);

    const obj = page.objectAtPoint({ x: 50, y: 50 });
    assert.ok(obj);
    assert.equal(obj.lines[0].runs[0].text, 'B'); // last added = top-most
  });

  it('objectAtPoint returns null for no match', () => {
    assert.equal(page.objectAtPoint({ x: 999, y: 999 }), null);
  });

  it('backgroundImage returns background image or null', () => {
    assert.equal(page.backgroundImage, null);
    page.addImageBlock({ x: 0, y: 0, width: 595, height: 842 }, null, 'image/jpeg', true);
    assert.ok(page.backgroundImage);
    assert.equal(page.backgroundImage.isBackground, true);
  });

  it('textBlocks returns text blocks sorted by reading order', () => {
    page.addNativeTextBlock({ x: 10, y: 100, width: 50, height: 20 },
      [{ runs: [{ text: 'Lower' }], baseline: 100 }]);
    page.addNativeTextBlock({ x: 10, y: 500, width: 50, height: 20 },
      [{ runs: [{ text: 'Higher' }], baseline: 500 }]);

    const blocks = page.textBlocks;
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].lines[0].runs[0].text, 'Higher'); // Higher Y = top in PDF
  });

  it('plainText from text layer charBoxes', () => {
    page.textLayer = new TextLayerModel([
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 1, wordText: '', lineBaseline: 10, fontSize: 12 },
      { char: 'B', bbox: { x0: 10, y0: 0, x1: 20, y1: 10 }, confidence: 1, wordText: '', lineBaseline: 10, fontSize: 12 },
    ]);
    assert.equal(page.plainText, 'AB');
  });

  it('plainText from text blocks when no charBoxes', () => {
    page.addNativeTextBlock({ x: 10, y: 100, width: 50, height: 20 },
      [{ runs: [{ text: 'Hello' }, { text: 'World' }], baseline: 100 }]);
    assert.ok(page.plainText.includes('Hello'));
    assert.ok(page.plainText.includes('World'));
  });

  it('removeObject removes by id', () => {
    const block = page.addNativeTextBlock({ x: 10, y: 10, width: 50, height: 20 },
      [{ runs: [{ text: 'A' }], baseline: 10 }]);
    assert.equal(page.removeObject(block.id), true);
    assert.equal(page.objects.length, 0);
  });

  it('removeObject returns false for non-existent id', () => {
    assert.equal(page.removeObject('nonexistent'), false);
  });

  it('removeObjectsInRect removes fully contained objects', () => {
    page.addNativeTextBlock({ x: 10, y: 10, width: 20, height: 20 },
      [{ runs: [{ text: 'Inside' }], baseline: 10 }]);
    page.addNativeTextBlock({ x: 200, y: 200, width: 20, height: 20 },
      [{ runs: [{ text: 'Outside' }], baseline: 200 }]);

    const removed = page.removeObjectsInRect({ x: 0, y: 0, width: 50, height: 50 });
    assert.equal(removed.length, 1);
    assert.equal(page.objects.length, 1);
  });
});

// ─── DocumentModel ──────────────────────────────────────────────────────────

describe('DocumentModel', () => {
  it('constructs with default state', () => {
    const doc = new DocumentModel();
    assert.equal(doc.pages.size, 0);
    assert.equal(doc.documentType, 'unknown');
    assert.equal(doc.security.isEncrypted, false);
  });

  it('getPage creates new page if not exists', () => {
    const doc = new DocumentModel();
    const page = doc.getPage(1);
    assert.ok(page instanceof PageModel);
    assert.equal(page.pageNumber, 1);
    assert.equal(doc.pages.size, 1);
  });

  it('getPage returns existing page', () => {
    const doc = new DocumentModel();
    const page1 = doc.getPage(1);
    const page1Again = doc.getPage(1);
    assert.equal(page1, page1Again);
  });

  it('getPage with custom dimensions', () => {
    const doc = new DocumentModel();
    const page = doc.getPage(1, 800, 600);
    assert.equal(page.width, 800);
    assert.equal(page.height, 600);
  });

  it('fromExtractedPage creates page from extraction data', () => {
    const extracted = {
      pageNumber: 1,
      width: 595,
      height: 842,
      rotation: 90,
      textRuns: [
        { text: 'Hello', x: 10, y: 100, width: 40, height: 12, fontSize: 12, fontFamily: 'Arial' },
      ],
      images: [
        { x: 0, y: 0, width: 595, height: 842, data: null, mimeType: 'image/jpeg' },
      ],
      paths: [
        { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100, strokeColor: '#000', lineWidth: 1 },
        { type: 'rect', x1: 10, y1: 10, x2: 50, y2: 50, strokeColor: '#000', lineWidth: 1, fillColor: '#fff' },
      ],
    };

    const page = DocumentModel.fromExtractedPage(extracted);
    assert.ok(page instanceof PageModel);
    assert.equal(page.pageNumber, 1);
    assert.equal(page.metadata.rotation, 90);
    assert.ok(page.objects.length > 0);
  });

  it('fromExtractedPage handles empty extraction', () => {
    const extracted = {
      pageNumber: 1,
      width: 595,
      height: 842,
      textRuns: [],
      images: [],
      paths: [],
    };
    const page = DocumentModel.fromExtractedPage(extracted);
    assert.equal(page.objects.length, 0);
  });

  it('fromOcrResult creates page from OCR data', () => {
    const ocrResult = {
      words: [
        { text: 'Hello', confidence: 90, bbox: { x0: 10, y0: 20, x1: 60, y1: 35 } },
        { text: 'World', confidence: 85, bbox: { x0: 70, y0: 20, x1: 120, y1: 35 } },
      ],
      charBoxes: [
        { char: 'H', bbox: { x0: 10, y0: 20, x1: 20, y1: 35 }, confidence: 90, wordText: 'Hello', lineBaseline: 35, fontSize: 15 },
      ],
    };

    const page = DocumentModel.fromOcrResult(1, 595, 842, ocrResult, new Uint8Array([1, 2, 3]));
    assert.equal(page.pageNumber, 1);
    assert.equal(page.metadata.isScanned, true);
    assert.equal(page.metadata.hasOcrText, true);
    // Should have background image + 2 text blocks
    assert.ok(page.objects.length >= 3);
    assert.equal(page.textLayer.source, 'ocr');
  });

  it('fromOcrResult without background image', () => {
    const ocrResult = { words: [], charBoxes: [] };
    const page = DocumentModel.fromOcrResult(1, 595, 842, ocrResult);
    // No background image should be added
    assert.equal(page.backgroundImage, null);
  });
});
