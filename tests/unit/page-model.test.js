// ─── Unit Tests: PageModel ───────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { PageModel, TextLayerModel, DocumentModel } from '../../app/modules/page-model.js';

// ── TextLayerModel ───────────────────────────────────────────────────────────

describe('TextLayerModel', () => {
  it('constructs with defaults', () => {
    const tl = new TextLayerModel();
    assert.deepEqual(tl.charBoxes, []);
    assert.equal(tl.source, 'native');
  });

  it('constructs with provided char boxes', () => {
    const boxes = [
      { char: 'H', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, confidence: 0.99, wordText: 'Hi', lineBaseline: 10, fontSize: 12 },
      { char: 'i', bbox: { x0: 10, y0: 0, x1: 20, y1: 10 }, confidence: 0.95, wordText: 'Hi', lineBaseline: 10, fontSize: 12 },
    ];
    const tl = new TextLayerModel(boxes, 'ocr');
    assert.equal(tl.charBoxes.length, 2);
    assert.equal(tl.source, 'ocr');
  });

  it('plainText returns joined chars', () => {
    const boxes = [
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 5, y1: 5 } },
      { char: 'B', bbox: { x0: 5, y0: 0, x1: 10, y1: 5 } },
      { char: 'C', bbox: { x0: 10, y0: 0, x1: 15, y1: 5 } },
    ];
    const tl = new TextLayerModel(boxes);
    assert.equal(tl.plainText, 'ABC');
  });

  it('getTextInRect returns chars inside rect', () => {
    const boxes = [
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      { char: 'B', bbox: { x0: 20, y0: 20, x1: 30, y1: 30 } },
      { char: 'C', bbox: { x0: 50, y0: 50, x1: 60, y1: 60 } },
    ];
    const tl = new TextLayerModel(boxes);
    // Rect that contains only A (center at 5,5)
    const text = tl.getTextInRect({ x: 0, y: 0, width: 15, height: 15 });
    assert.equal(text, 'A');
  });

  it('getTextInRect returns empty for no match', () => {
    const boxes = [
      { char: 'X', bbox: { x0: 100, y0: 100, x1: 110, y1: 110 } },
    ];
    const tl = new TextLayerModel(boxes);
    const text = tl.getTextInRect({ x: 0, y: 0, width: 10, height: 10 });
    assert.equal(text, '');
  });

  it('removeTextInRect removes matching chars', () => {
    const boxes = [
      { char: 'A', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      { char: 'B', bbox: { x0: 20, y0: 20, x1: 30, y1: 30 } },
    ];
    const tl = new TextLayerModel(boxes);
    tl.removeTextInRect({ x: 0, y: 0, width: 15, height: 15 });
    assert.equal(tl.charBoxes.length, 1);
    assert.equal(tl.charBoxes[0].char, 'B');
  });
});

// ── PageModel ────────────────────────────────────────────────────────────────

describe('PageModel', () => {
  let page;

  beforeEach(() => {
    page = new PageModel(1, 595, 842);
  });

  it('constructs with correct dimensions', () => {
    assert.equal(page.pageNumber, 1);
    assert.equal(page.width, 595);
    assert.equal(page.height, 842);
    assert.deepEqual(page.objects, []);
  });

  it('has default metadata', () => {
    assert.equal(page.metadata.isScanned, false);
    assert.equal(page.metadata.hasOcrText, false);
    assert.equal(page.metadata.isProtected, false);
    assert.equal(page.metadata.hasNativeText, false);
    assert.equal(page.metadata.rotation, 0);
  });

  describe('addNativeTextBlock', () => {
    it('adds a text block with source native', () => {
      const bbox = { x: 10, y: 20, width: 100, height: 20 };
      const lines = [{ runs: [{ text: 'Hello', font: 'Arial', fontSize: 12, color: '#000', x: 10, y: 20, width: 50, bold: false, italic: false, url: null }], baseline: 20 }];
      const block = page.addNativeTextBlock(bbox, lines);

      assert.equal(block.type, 'text');
      assert.equal(block.source, 'native');
      assert.ok(block.id.startsWith('tb-'));
      assert.equal(block.confidence, 1.0);
      assert.equal(block.editable, true);
      assert.equal(page.objects.length, 1);
      assert.equal(page.metadata.hasNativeText, true);
    });

    it('sets editable false when page is protected', () => {
      page.metadata.isProtected = true;
      const block = page.addNativeTextBlock(
        { x: 0, y: 0, width: 10, height: 10 },
        [{ runs: [], baseline: 0 }],
      );
      assert.equal(block.editable, false);
    });
  });

  describe('addOcrTextBlock', () => {
    it('adds an OCR text block', () => {
      const bbox = { x: 0, y: 0, width: 50, height: 15 };
      const lines = [{ runs: [{ text: 'OCR', font: 'Arial', fontSize: 12, color: '#000', x: 0, y: 0, width: 30, bold: false, italic: false, url: null }], baseline: 12 }];
      const block = page.addOcrTextBlock(bbox, lines, 0.85);

      assert.equal(block.type, 'text');
      assert.equal(block.source, 'ocr');
      assert.equal(block.confidence, 0.85);
      assert.equal(page.metadata.hasOcrText, true);
    });
  });

  describe('addImageBlock', () => {
    it('adds a regular image', () => {
      const bbox = { x: 0, y: 0, width: 200, height: 300 };
      const block = page.addImageBlock(bbox, null, 'image/png');

      assert.equal(block.type, 'image');
      assert.ok(block.id.startsWith('ib-'));
      assert.equal(block.isBackground, false);
      assert.equal(block.mimeType, 'image/png');
      assert.equal(page.metadata.isScanned, false);
    });

    it('marks page as scanned for background images', () => {
      const bbox = { x: 0, y: 0, width: 595, height: 842 };
      page.addImageBlock(bbox, null, 'image/jpeg', true);
      assert.equal(page.metadata.isScanned, true);
    });

    it('defaults mimeType to png', () => {
      const block = page.addImageBlock({ x: 0, y: 0, width: 10, height: 10 }, null, '');
      assert.equal(block.mimeType, 'image/png');
    });
  });

  describe('addPathBlock', () => {
    it('adds a path block', () => {
      const bbox = { x: 0, y: 0, width: 100, height: 100 };
      const ops = [{ op: 'moveTo', args: [0, 0] }, { op: 'lineTo', args: [100, 100] }];
      const stroke = { color: '#000', width: 1, dash: null };
      const block = page.addPathBlock(bbox, ops, stroke);

      assert.equal(block.type, 'path');
      assert.ok(block.id.startsWith('pb-'));
      assert.equal(block.operations.length, 2);
      assert.equal(block.fill, null);
    });

    it('supports fill', () => {
      const block = page.addPathBlock(
        { x: 0, y: 0, width: 50, height: 50 },
        [{ op: 'closePath', args: [] }],
        { color: '#000', width: 1, dash: null },
        { color: '#ff0000' },
      );
      assert.deepEqual(block.fill, { color: '#ff0000' });
    });
  });

  describe('objectsInRect', () => {
    it('returns objects intersecting the rect', () => {
      page.addNativeTextBlock({ x: 10, y: 10, width: 20, height: 20 }, []);
      page.addNativeTextBlock({ x: 100, y: 100, width: 20, height: 20 }, []);

      const found = page.objectsInRect({ x: 0, y: 0, width: 35, height: 35 });
      assert.equal(found.length, 1);
    });

    it('returns empty when no intersection', () => {
      page.addNativeTextBlock({ x: 10, y: 10, width: 20, height: 20 }, []);
      const found = page.objectsInRect({ x: 200, y: 200, width: 10, height: 10 });
      assert.equal(found.length, 0);
    });
  });

  describe('objectAtPoint', () => {
    it('returns the topmost object at point', () => {
      const b1 = page.addNativeTextBlock({ x: 0, y: 0, width: 100, height: 100 }, []);
      const b2 = page.addNativeTextBlock({ x: 50, y: 50, width: 100, height: 100 }, []);

      // Point at (75, 75) is in both blocks, topmost (last) is b2
      const found = page.objectAtPoint({ x: 75, y: 75 });
      assert.equal(found.id, b2.id);
    });

    it('returns null for point outside all objects', () => {
      page.addNativeTextBlock({ x: 0, y: 0, width: 10, height: 10 }, []);
      assert.equal(page.objectAtPoint({ x: 500, y: 500 }), null);
    });
  });

  describe('backgroundImage', () => {
    it('returns null when no background', () => {
      assert.equal(page.backgroundImage, null);
    });

    it('returns the background image', () => {
      page.addImageBlock({ x: 0, y: 0, width: 595, height: 842 }, null, 'image/jpeg', true);
      const bg = page.backgroundImage;
      assert.ok(bg);
      assert.equal(bg.isBackground, true);
    });
  });

  describe('textBlocks', () => {
    it('returns text blocks sorted in reading order', () => {
      // Higher y = higher on page in PDF coords
      page.addNativeTextBlock({ x: 10, y: 100, width: 50, height: 10 }, []);
      page.addNativeTextBlock({ x: 10, y: 200, width: 50, height: 10 }, []);
      page.addNativeTextBlock({ x: 10, y: 50, width: 50, height: 10 }, []);

      const blocks = page.textBlocks;
      assert.equal(blocks.length, 3);
      // PDF y: top = high value, so sorted descending by y
      assert.ok(blocks[0].boundingBox.y >= blocks[1].boundingBox.y);
    });

    it('excludes non-text objects', () => {
      page.addNativeTextBlock({ x: 0, y: 0, width: 10, height: 10 }, []);
      page.addImageBlock({ x: 20, y: 20, width: 30, height: 30 }, null, 'image/png');
      assert.equal(page.textBlocks.length, 1);
    });
  });

  describe('removeObject', () => {
    it('removes object by id', () => {
      const block = page.addNativeTextBlock({ x: 0, y: 0, width: 10, height: 10 }, []);
      assert.equal(page.objects.length, 1);
      const removed = page.removeObject(block.id);
      assert.equal(removed, true);
      assert.equal(page.objects.length, 0);
    });

    it('returns false for non-existent id', () => {
      assert.equal(page.removeObject('nonexistent'), false);
    });
  });

  describe('removeObjectsInRect', () => {
    it('removes objects fully contained in rect', () => {
      page.addNativeTextBlock({ x: 5, y: 5, width: 10, height: 10 }, []);
      page.addNativeTextBlock({ x: 50, y: 50, width: 10, height: 10 }, []);

      const removed = page.removeObjectsInRect({ x: 0, y: 0, width: 20, height: 20 });
      assert.equal(removed.length, 1);
      assert.equal(page.objects.length, 1);
    });

    it('keeps partially overlapping objects', () => {
      page.addNativeTextBlock({ x: 5, y: 5, width: 100, height: 100 }, []);
      const removed = page.removeObjectsInRect({ x: 0, y: 0, width: 20, height: 20 });
      assert.equal(removed.length, 0);
      assert.equal(page.objects.length, 1);
    });
  });

  describe('plainText', () => {
    it('uses textLayer when charBoxes present', () => {
      page.textLayer = new TextLayerModel([
        { char: 'H', bbox: { x0: 0, y0: 0, x1: 5, y1: 5 } },
        { char: 'i', bbox: { x0: 5, y0: 0, x1: 10, y1: 5 } },
      ]);
      assert.equal(page.plainText, 'Hi');
    });

    it('falls back to text blocks when no charBoxes', () => {
      const run = { text: 'World', font: 'Arial', fontSize: 12, color: '#000', x: 0, y: 0, width: 40, bold: false, italic: false, url: null };
      page.addNativeTextBlock({ x: 0, y: 0, width: 50, height: 15 }, [{ runs: [run], baseline: 12 }]);
      assert.ok(page.plainText.includes('World'));
    });
  });
});

// ── DocumentModel ────────────────────────────────────────────────────────────

describe('DocumentModel', () => {
  it('constructs with empty state', () => {
    const doc = new DocumentModel();
    assert.equal(doc.pages.size, 0);
    assert.equal(doc.security.isEncrypted, false);
    assert.equal(doc.documentType, 'unknown');
  });

  it('getPage creates new page if not exists', () => {
    const doc = new DocumentModel();
    const page = doc.getPage(1, 612, 792);
    assert.equal(page.pageNumber, 1);
    assert.equal(page.width, 612);
    assert.equal(page.height, 792);
    assert.equal(doc.pages.size, 1);
  });

  it('getPage returns existing page', () => {
    const doc = new DocumentModel();
    const p1 = doc.getPage(1);
    const p2 = doc.getPage(1);
    assert.equal(p1, p2);
  });

  it('getPage uses default dimensions', () => {
    const doc = new DocumentModel();
    const page = doc.getPage(1);
    assert.equal(page.width, 595);
    assert.equal(page.height, 842);
  });

  it('fromOcrResult creates page with OCR data', () => {
    const ocrResult = {
      words: [
        { text: 'Hello', bbox: { x0: 10, y0: 10, x1: 50, y1: 25 }, confidence: 95 },
        { text: 'World', bbox: { x0: 60, y0: 10, x1: 110, y1: 25 }, confidence: 90 },
      ],
      charBoxes: [
        { char: 'H', bbox: { x0: 10, y0: 10, x1: 20, y1: 25 } },
      ],
    };

    const page = DocumentModel.fromOcrResult(1, 595, 842, ocrResult);
    assert.equal(page.pageNumber, 1);
    assert.equal(page.metadata.isScanned, true);
    assert.equal(page.metadata.hasOcrText, true);
    assert.equal(page.objects.length, 2); // 2 word blocks
    assert.equal(page.textLayer.source, 'ocr');
    assert.equal(page.textLayer.charBoxes.length, 1);
  });

  it('fromOcrResult adds background image when provided', () => {
    const ocrResult = { words: [], charBoxes: [] };
    const bgData = new Uint8Array([1, 2, 3]);
    const page = DocumentModel.fromOcrResult(1, 595, 842, ocrResult, bgData);
    assert.ok(page.backgroundImage);
    assert.equal(page.backgroundImage.isBackground, true);
  });
});
