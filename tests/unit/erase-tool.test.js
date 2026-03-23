import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { EraseTool, detectBackgroundColor, EraseUIController } from '../../app/modules/erase-tool.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePageModel(overrides = {}) {
  return {
    pageNumber: 1,
    width: 595,
    height: 842,
    objects: overrides.objects ?? [],
    textLayer: overrides.textLayer ?? { removeTextInRect() {}, charBoxes: [] },
    backgroundImage: overrides.backgroundImage ?? null,
    metadata: overrides.metadata ?? { isScanned: false },
    objectAtPoint: overrides.objectAtPoint ?? (() => null),
  };
}

// ── Tests: EraseTool ───────────────────────────────────────────────────────

describe('EraseTool', () => {
  it('constructor sets page, pdfDoc and reload', () => {
    const page = makePageModel();
    const reloadFn = mock.fn();
    const tool = new EraseTool(page, null, reloadFn);

    assert.equal(tool.page, page);
    assert.equal(tool.pdfDoc, null);
    assert.equal(tool.reload, reloadFn);
  });

  it('constructor defaults reload to no-op when not provided', () => {
    const tool = new EraseTool(makePageModel(), null, null);
    assert.doesNotThrow(() => tool.reload());
  });

  it('contentErase removes objects inside rect from page model', async () => {
    const obj1 = { type: 'text', boundingBox: { x: 10, y: 10, width: 20, height: 10 }, lines: [] };
    const obj2 = { type: 'text', boundingBox: { x: 200, y: 200, width: 20, height: 10 }, lines: [] };
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({ objects: [obj1, obj2], textLayer });
    const tool = new EraseTool(page, null, mock.fn());

    // Erase rect fully contains obj1 but not obj2
    await tool.contentErase({ x: 0, y: 0, width: 50, height: 50 });

    assert.equal(page.objects.length, 1);
    assert.equal(page.objects[0], obj2);
    assert.equal(textLayer.removeTextInRect.mock.calls.length, 1);
  });

  it('contentErase does not write to stream when removeFromStream is false', async () => {
    const page = makePageModel();
    const tool = new EraseTool(page, null, mock.fn());
    await tool.contentErase({ x: 0, y: 0, width: 10, height: 10 }, { removeFromStream: false });
    // Should complete without errors; no pdfDoc interaction
  });

  it('smartErase returns early when no object at point', async () => {
    const page = makePageModel({ objectAtPoint: () => null });
    const tool = new EraseTool(page, null, mock.fn());
    // Should not throw
    await tool.smartErase({ x: 100, y: 100 });
  });
});

// ── Tests: detectBackgroundColor ───────────────────────────────────────────

describe('detectBackgroundColor', () => {
  it('returns rgb string even with mock context', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');

    const result = detectBackgroundColor(ctx, { x: 2, y: 2, width: 6, height: 6 });
    // Result should be a string starting with 'rgb('
    assert.ok(typeof result === 'string');
    assert.ok(result.startsWith('rgb('));
  });

  it('returns a valid rgb string format', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    const result = detectBackgroundColor(ctx, { x: 10, y: 10, width: 80, height: 80 });
    assert.ok(result.startsWith('rgb('));
    assert.ok(result.endsWith(')'));
  });
});

// ── Tests: EraseUIController ───────────────────────────────────────────────

describe('EraseUIController', () => {
  it('constructor sets default values', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 595;
    canvas.height = 842;
    const onErase = mock.fn(async () => {});
    const ctrl = new EraseUIController(canvas, onErase);

    assert.equal(ctrl.subMode, 'rect');
    assert.equal(ctrl.zoom, 1);
    assert.equal(ctrl._dragging, false);
  });

  it('setSubMode changes sub mode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    ctrl.setSubMode('freehand');
    assert.equal(ctrl.subMode, 'freehand');
  });

  it('setZoom changes zoom', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    ctrl.setZoom(3);
    assert.equal(ctrl.zoom, 3);
  });

  it('destroy removes event listeners without error', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    assert.doesNotThrow(() => ctrl.destroy());
  });

  it('_canvasToPdf converts coordinates correctly', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
      zoom: 2,
    });

    const result = ctrl._canvasToPdf(100, 200);
    assert.equal(result.x, 50);    // 100 / 2
    assert.equal(result.y, 742);   // 842 - 200/2
  });
});
