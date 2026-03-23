import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  addTextWatermark,
  removeWatermarkRegion,
  WatermarkEditor,
} from '../../app/modules/pdf-watermark.js';
import { PDFDocument } from 'pdf-lib';

async function createTestPdf(pageCount = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return doc.save();
}

describe('addTextWatermark', () => {
  it('returns a Blob with correct type', async () => {
    const bytes = await createTestPdf();
    const blob = await addTextWatermark(bytes, 'DRAFT');
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('preserves page count', async () => {
    const bytes = await createTestPdf(3);
    const blob = await addTextWatermark(bytes, 'CONFIDENTIAL');
    const resultBytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(resultBytes);
    assert.equal(doc.getPageCount(), 3);
  });

  it('applies only to specified pages', async () => {
    const bytes = await createTestPdf(3);
    const blob = await addTextWatermark(bytes, 'TEST', { pages: [1, 3] });
    assert.ok(blob instanceof Blob);
  });

  it('accepts custom font size and opacity', async () => {
    const bytes = await createTestPdf();
    const blob = await addTextWatermark(bytes, 'SAMPLE', {
      fontSize: 80,
      opacity: 0.5,
      rotation: 0,
    });
    assert.ok(blob instanceof Blob);
  });

  it('supports tiled watermarks', async () => {
    const bytes = await createTestPdf();
    const blob = await addTextWatermark(bytes, 'TILE', {
      repeatX: 2,
      repeatY: 3,
    });
    assert.ok(blob instanceof Blob);
  });
});

describe('removeWatermarkRegion', () => {
  it('returns a Blob', async () => {
    const bytes = await createTestPdf();
    const blob = await removeWatermarkRegion(bytes, {
      x: 100, y: 100, width: 200, height: 50,
    });
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('can target specific pages', async () => {
    const bytes = await createTestPdf(3);
    const blob = await removeWatermarkRegion(bytes, {
      x: 0, y: 0, width: 100, height: 100,
    }, [2]);
    assert.ok(blob instanceof Blob);
  });
});

describe('WatermarkEditor', () => {
  it('opens and appends a panel to the container', () => {
    const container = document.createElement('div');
    const editor = new WatermarkEditor(container, {
      onApply: () => {},
      onCancel: () => {},
    });
    editor.open();
    assert.ok(container.children.length > 0);
  });

  it('close removes the panel', () => {
    const container = document.createElement('div');
    const editor = new WatermarkEditor(container, {
      onApply: () => {},
      onCancel: () => {},
    });
    editor.open();
    editor.close();
    assert.equal(editor._panel, null);
  });

  it('open is idempotent', () => {
    const container = document.createElement('div');
    const editor = new WatermarkEditor(container, {
      onApply: () => {},
      onCancel: () => {},
    });
    editor.open();
    editor.open(); // second call should not add another panel
    assert.equal(container.children.length, 1);
  });
});
