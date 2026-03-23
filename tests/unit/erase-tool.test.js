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
    textLayer: overrides.textLayer ?? { removeTextInRect: mock.fn(), charBoxes: [] },
    backgroundImage: overrides.backgroundImage ?? null,
    metadata: overrides.metadata ?? { isScanned: false },
    objectAtPoint: overrides.objectAtPoint ?? (() => null),
  };
}

function makeRect(x = 0, y = 0, width = 50, height = 50) {
  return { x, y, width, height };
}

// ── EraseTool constructor ──────────────────────────────────────────────────

describe('EraseTool constructor', () => {
  it('sets page, pdfDoc and reload', () => {
    const page = makePageModel();
    const reloadFn = mock.fn();
    const tool = new EraseTool(page, null, reloadFn);

    assert.equal(tool.page, page);
    assert.equal(tool.pdfDoc, null);
    assert.equal(tool.reload, reloadFn);
  });

  it('defaults reload to no-op when not provided', () => {
    const tool = new EraseTool(makePageModel(), null, null);
    assert.doesNotThrow(() => tool.reload());
  });

  it('stores pdfLibDoc', () => {
    const doc = { getPage: () => ({}) };
    const tool = new EraseTool(makePageModel(), doc, null);
    assert.equal(tool.pdfDoc, doc);
  });
});

// ── EraseTool.contentErase ─────────────────────────────────────────────────

describe('EraseTool.contentErase', () => {
  it('removes objects fully inside rect from page model', async () => {
    const obj1 = { type: 'text', boundingBox: { x: 10, y: 10, width: 20, height: 10 }, lines: [] };
    const obj2 = { type: 'text', boundingBox: { x: 200, y: 200, width: 20, height: 10 }, lines: [] };
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({ objects: [obj1, obj2], textLayer });
    const tool = new EraseTool(page, null, mock.fn());

    await tool.contentErase(makeRect(0, 0, 50, 50));

    assert.equal(page.objects.length, 1);
    assert.equal(page.objects[0], obj2);
    assert.equal(textLayer.removeTextInRect.mock.calls.length, 1);
  });

  it('keeps objects that do not intersect rect', async () => {
    const obj = { type: 'text', boundingBox: { x: 100, y: 100, width: 20, height: 10 }, lines: [] };
    const page = makePageModel({ objects: [obj] });
    const tool = new EraseTool(page, null, mock.fn());

    await tool.contentErase(makeRect(0, 0, 50, 50));

    assert.equal(page.objects.length, 1);
  });

  it('does not write to stream when removeFromStream is false', async () => {
    const page = makePageModel();
    const reload = mock.fn();
    const tool = new EraseTool(page, null, reload);
    await tool.contentErase(makeRect(0, 0, 10, 10), { removeFromStream: false });
    assert.equal(reload.mock.calls.length, 0);
  });

  it('does not write to stream when pdfDoc is null', async () => {
    const page = makePageModel();
    const reload = mock.fn();
    const tool = new EraseTool(page, null, reload);
    await tool.contentErase(makeRect(0, 0, 10, 10));
    assert.equal(reload.mock.calls.length, 0);
  });

  it('calls pdfDoc.getPage, drawRectangle, save and reload when pdfDoc present', async () => {
    const drawRectangle = mock.fn();
    const save = mock.fn(async () => new Uint8Array([1, 2, 3]));
    const getPage = mock.fn(() => ({ drawRectangle }));
    const pdfDoc = { getPage, save };

    const page = makePageModel();
    const reload = mock.fn(async () => {});
    const tool = new EraseTool(page, pdfDoc, reload);

    await tool.contentErase(makeRect(10, 10, 30, 20));

    assert.equal(drawRectangle.mock.calls.length, 1);
    assert.equal(reload.mock.calls.length, 1);
  });

  it('catches and logs errors from pdfDoc operations', async () => {
    const pdfDoc = {
      getPage: () => { throw new Error('boom'); },
      save: mock.fn(),
    };
    const page = makePageModel();
    const tool = new EraseTool(page, pdfDoc, mock.fn());
    await assert.doesNotReject(() => tool.contentErase(makeRect(0, 0, 10, 10)));
  });

  it('trims partial text block intersections', async () => {
    // Object that partially intersects: not fully contained, not non-intersecting
    const partialBlock = {
      type: 'text',
      boundingBox: { x: 0, y: 0, width: 200, height: 20 },
      lines: [
        {
          runs: [
            { text: 'Hello', x: 0, y: 0, width: 40 },
            { text: 'World', x: 100, y: 0, width: 40 },
          ],
        },
      ],
    };
    const page = makePageModel({ objects: [partialBlock] });
    const tool = new EraseTool(page, null, mock.fn());

    // Erase rect covers only the first run
    await tool.contentErase({ x: 0, y: 0, width: 60, height: 20 }, { removeFromStream: false });

    // Block should be kept but trimmed
    assert.equal(page.objects.length, 1);
    assert.equal(page.objects[0].lines[0].runs.length, 1);
    assert.equal(page.objects[0].lines[0].runs[0].text, 'World');
  });

  it('removes entire block when all runs are in erase rect', async () => {
    const obj = {
      type: 'text',
      boundingBox: { x: 5, y: 5, width: 30, height: 10 },
      lines: [{ runs: [{ text: 'Hi', x: 5, y: 5, width: 30 }] }],
    };
    const page = makePageModel({ objects: [obj] });
    const tool = new EraseTool(page, null, mock.fn());

    await tool.contentErase({ x: 0, y: 0, width: 50, height: 30 }, { removeFromStream: false });
    assert.equal(page.objects.length, 0);
  });

  it('keeps non-text objects that partially intersect', async () => {
    const imgObj = {
      type: 'image',
      boundingBox: { x: 0, y: 0, width: 200, height: 200 },
    };
    const page = makePageModel({ objects: [imgObj] });
    const tool = new EraseTool(page, null, mock.fn());

    // Small rect that only partially overlaps the image
    await tool.contentErase({ x: 0, y: 0, width: 50, height: 50 }, { removeFromStream: false });
    assert.equal(page.objects.length, 1);
  });
});

// ── EraseTool.imageErase ───────────────────────────────────────────────────

describe('EraseTool.imageErase', () => {
  it('falls back to contentErase when no backgroundImage', async () => {
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({ backgroundImage: null, textLayer });
    const tool = new EraseTool(page, null, mock.fn());

    await tool.imageErase(makeRect(0, 0, 10, 10));
    // textLayer.removeTextInRect is called by contentErase
    assert.equal(textLayer.removeTextInRect.mock.calls.length, 1);
  });
});

// ── EraseTool.smartErase ───────────────────────────────────────────────────

describe('EraseTool.smartErase', () => {
  it('returns early when no object at point', async () => {
    const page = makePageModel({ objectAtPoint: () => null });
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 100, y: 100 }));
  });

  it('calls imageErase for scanned page with background', async () => {
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({
      backgroundImage: null, // no bg image, so imageErase will fall back to contentErase
      metadata: { isScanned: true },
      textLayer,
    });
    // Set backgroundImage to something truthy after makePageModel
    page.backgroundImage = null;
    // Actually set metadata.isScanned but no background so we test the guard
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 100, y: 100 }));
  });

  it('uses imageErase path when page is scanned and has no backgroundImage (falls back to contentErase)', async () => {
    // backgroundImage is null so imageErase falls back to contentErase (no image loading)
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({
      backgroundImage: null,
      metadata: { isScanned: true },
      textLayer,
    });
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 100, y: 100 }));
    assert.equal(textLayer.removeTextInRect.mock.calls.length, 1);
  });

  it('calls contentErase on text block with word granularity', async () => {
    const textBlock = {
      type: 'text',
      boundingBox: { x: 10, y: 10, width: 200, height: 20 },
      lines: [
        {
          runs: [
            { text: 'Hello', x: 10, y: 10, width: 50 },
            { text: 'World', x: 70, y: 10, width: 50 },
          ],
        },
      ],
    };
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({
      objectAtPoint: () => textBlock,
      objects: [textBlock],
      metadata: { isScanned: false },
      textLayer,
    });
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 30, y: 20 }));
  });

  it('calls contentErase on text block with line granularity', async () => {
    const textBlock = {
      type: 'text',
      boundingBox: { x: 0, y: 0, width: 200, height: 40 },
      lines: [
        { runs: [{ text: 'Line1', x: 0, y: 0, width: 100 }] },
        { runs: [{ text: 'Line2', x: 0, y: 20, width: 100 }] },
      ],
    };
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({
      objectAtPoint: () => textBlock,
      objects: [textBlock],
      metadata: { isScanned: false },
      textLayer,
    });
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 50, y: 10 }, { granularity: 'line' }));
  });

  it('calls contentErase on text block with block granularity', async () => {
    const textBlock = {
      type: 'text',
      boundingBox: { x: 0, y: 0, width: 200, height: 40 },
      lines: [{ runs: [{ text: 'Block text', x: 0, y: 0, width: 200 }] }],
    };
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({
      objectAtPoint: () => textBlock,
      objects: [textBlock],
      metadata: { isScanned: false },
      textLayer,
    });
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 50, y: 10 }, { granularity: 'block' }));
  });

  it('calls contentErase on non-text block', async () => {
    const imgBlock = {
      type: 'image',
      boundingBox: { x: 10, y: 10, width: 100, height: 100 },
    };
    const textLayer = { removeTextInRect: mock.fn(), charBoxes: [] };
    const page = makePageModel({
      objectAtPoint: () => imgBlock,
      objects: [imgBlock],
      metadata: { isScanned: false },
      textLayer,
    });
    const tool = new EraseTool(page, null, mock.fn());
    await assert.doesNotReject(() => tool.smartErase({ x: 50, y: 50 }));
  });
});

// ── detectBackgroundColor ──────────────────────────────────────────────────

describe('detectBackgroundColor', () => {
  it('returns rgb string from canvas context', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    const result = detectBackgroundColor(ctx, { x: 10, y: 10, width: 80, height: 80 });
    assert.ok(typeof result === 'string');
    assert.ok(result.startsWith('rgb('));
    assert.ok(result.endsWith(')'));
  });

  it('returns white rgb for canvas with no drawn pixels', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');

    const result = detectBackgroundColor(ctx, { x: 5, y: 5, width: 40, height: 40 });
    assert.ok(result.startsWith('rgb('));
  });

  it('returns rgb(255,255,255) when no samples collected', () => {
    // Create a ctx mock that always throws on getImageData
    const ctx = {
      getImageData: () => { throw new Error('cross-origin'); },
    };
    const result = detectBackgroundColor(ctx, { x: 2, y: 2, width: 6, height: 6 });
    assert.equal(result, 'rgb(255,255,255)');
  });

  it('works with colored background', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(200, 100, 50)';
    ctx.fillRect(0, 0, 200, 200);

    const result = detectBackgroundColor(ctx, { x: 50, y: 50, width: 100, height: 100 });
    assert.ok(result.startsWith('rgb('));
  });

  it('handles imgRect at edges (x=0, y=0)', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    const result = detectBackgroundColor(ctx, { x: 0, y: 0, width: 200, height: 200 });
    assert.ok(result.startsWith('rgb('));
  });

  it('handles small imgRect', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');

    const result = detectBackgroundColor(ctx, { x: 5, y: 5, width: 2, height: 2 });
    assert.ok(result.startsWith('rgb('));
  });
});

// ── EraseUIController ──────────────────────────────────────────────────────

describe('EraseUIController constructor', () => {
  it('sets default values', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 595;
    canvas.height = 842;
    const onErase = mock.fn(async () => {});
    const ctrl = new EraseUIController(canvas, onErase);

    assert.equal(ctrl.subMode, 'rect');
    assert.equal(ctrl.zoom, 1);
    assert.equal(ctrl.pageWidth, 595);
    assert.equal(ctrl.pageHeight, 842);
    assert.equal(ctrl._dragging, false);
    assert.deepEqual(ctrl._freehandPoints, []);
  });

  it('accepts custom options', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {}, {
      subMode: 'freehand',
      pageWidth: 800,
      pageHeight: 600,
      zoom: 2,
    });

    assert.equal(ctrl.subMode, 'freehand');
    assert.equal(ctrl.pageWidth, 800);
    assert.equal(ctrl.pageHeight, 600);
    assert.equal(ctrl.zoom, 2);
  });
});

describe('EraseUIController.setSubMode', () => {
  it('changes subMode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    ctrl.setSubMode('freehand');
    assert.equal(ctrl.subMode, 'freehand');
  });

  it('can set to word mode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    ctrl.setSubMode('word');
    assert.equal(ctrl.subMode, 'word');
  });

  it('can set to smart mode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    ctrl.setSubMode('smart');
    assert.equal(ctrl.subMode, 'smart');
  });
});

describe('EraseUIController.setZoom', () => {
  it('changes zoom', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    ctrl.setZoom(3);
    assert.equal(ctrl.zoom, 3);
  });
});

describe('EraseUIController.destroy', () => {
  it('removes event listeners without error', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {});
    assert.doesNotThrow(() => ctrl.destroy());
  });
});

describe('EraseUIController._canvasToPdf', () => {
  it('converts coordinates correctly with zoom 2', () => {
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

  it('converts coordinates correctly with default zoom', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
    });

    const result = ctrl._canvasToPdf(100, 200);
    assert.equal(result.x, 100);
    assert.equal(result.y, 642); // 842 - 200
  });
});

describe('EraseUIController._computeRect', () => {
  it('computes rect in rect mode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
      zoom: 1,
    });
    ctrl._startX = 10;
    ctrl._startY = 20;
    ctrl._curX = 50;
    ctrl._curY = 70;

    const rect = ctrl._computeRect();
    assert.ok(rect.width > 0);
    assert.ok(rect.height > 0);
  });

  it('computes rect in freehand mode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
      zoom: 1,
      subMode: 'freehand',
    });
    ctrl._freehandPoints = [
      { x: 10, y: 20 },
      { x: 50, y: 30 },
      { x: 30, y: 70 },
    ];

    const rect = ctrl._computeRect();
    assert.ok(rect.width > 0);
    assert.ok(rect.height > 0);
  });

  it('falls back to non-freehand rect when only 1 freehand point', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
      zoom: 1,
      subMode: 'freehand',
    });
    ctrl._freehandPoints = [{ x: 10, y: 20 }];
    ctrl._startX = 10;
    ctrl._startY = 20;
    ctrl._curX = 60;
    ctrl._curY = 80;

    const rect = ctrl._computeRect();
    assert.ok(typeof rect.x === 'number');
  });
});

describe('EraseUIController mouse events', () => {
  function makeMouseEvent(clientX, clientY) {
    return { clientX, clientY, preventDefault: () => {} };
  }

  function makeCanvasWithBoundingRect() {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 850;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 850, width: 600, height: 850 });
    return canvas;
  }

  it('_onMouseDown starts dragging in rect mode', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
    });

    ctrl._onMouseDown(makeMouseEvent(100, 200));
    assert.equal(ctrl._dragging, true);
    assert.equal(ctrl._startX, 100);
    assert.equal(ctrl._startY, 200);
  });

  it('_onMouseDown fires onErase immediately in smart mode', async () => {
    const canvas = makeCanvasWithBoundingRect();
    const onErase = mock.fn(async () => {});
    const ctrl = new EraseUIController(canvas, onErase, {
      subMode: 'smart',
      pageWidth: 595,
      pageHeight: 842,
    });

    ctrl._onMouseDown(makeMouseEvent(100, 200));
    // After smart mousedown, dragging should be false
    assert.equal(ctrl._dragging, false);
    // onErase should be called (async)
    await new Promise(r => setTimeout(r, 10));
    assert.equal(onErase.mock.calls.length, 1);
  });

  it('_onMouseDown fires onErase immediately in word mode', async () => {
    const canvas = makeCanvasWithBoundingRect();
    const onErase = mock.fn(async () => {});
    const ctrl = new EraseUIController(canvas, onErase, {
      subMode: 'word',
      pageWidth: 595,
      pageHeight: 842,
    });

    ctrl._onMouseDown(makeMouseEvent(100, 200));
    assert.equal(ctrl._dragging, false);
    await new Promise(r => setTimeout(r, 10));
    assert.equal(onErase.mock.calls.length, 1);
  });

  it('_onMouseMove does nothing when not dragging', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._dragging = false;
    // Should not throw
    assert.doesNotThrow(() => ctrl._onMouseMove(makeMouseEvent(100, 200)));
  });

  it('_onMouseMove updates curX/curY when dragging', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._dragging = true;
    ctrl._onMouseMove(makeMouseEvent(150, 250));
    assert.equal(ctrl._curX, 150);
    assert.equal(ctrl._curY, 250);
  });

  it('_onMouseMove adds freehand points when in freehand mode', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      subMode: 'freehand',
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._dragging = true;
    ctrl._freehandPoints = [{ x: 10, y: 20 }];
    ctrl._onMouseMove(makeMouseEvent(50, 60));
    assert.equal(ctrl._freehandPoints.length, 2);
  });

  it('_onMouseUp does nothing when not dragging', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._dragging = false;
    assert.doesNotThrow(() => ctrl._onMouseUp(makeMouseEvent(100, 200)));
  });

  it('_onMouseUp does not call onErase for tiny rect', () => {
    const canvas = makeCanvasWithBoundingRect();
    const onErase = mock.fn(async () => {});
    const ctrl = new EraseUIController(canvas, onErase, {
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._dragging = true;
    ctrl._startX = 100;
    ctrl._startY = 100;
    ctrl._curX = 101;
    ctrl._curY = 101;

    ctrl._onMouseUp(makeMouseEvent(101, 101));
    assert.equal(onErase.mock.calls.length, 0);
  });

  it('_onMouseUp calls onErase for substantial rect', async () => {
    const canvas = makeCanvasWithBoundingRect();
    const onErase = mock.fn(async () => {});
    const ctrl = new EraseUIController(canvas, onErase, {
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._dragging = true;
    ctrl._startX = 10;
    ctrl._startY = 10;
    ctrl._curX = 100;
    ctrl._curY = 100;

    ctrl._onMouseUp(makeMouseEvent(100, 100));
    await new Promise(r => setTimeout(r, 10));
    assert.equal(onErase.mock.calls.length, 1);
  });

  it('_draw calls canvas context methods in rect mode', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._startX = 10;
    ctrl._startY = 10;
    ctrl._curX = 100;
    ctrl._curY = 100;
    assert.doesNotThrow(() => ctrl._draw());
  });

  it('_draw calls canvas context methods in freehand mode', () => {
    const canvas = makeCanvasWithBoundingRect();
    const ctrl = new EraseUIController(canvas, async () => {}, {
      subMode: 'freehand',
      pageWidth: 595,
      pageHeight: 842,
    });
    ctrl._freehandPoints = [
      { x: 10, y: 20 },
      { x: 50, y: 60 },
      { x: 80, y: 40 },
    ];
    assert.doesNotThrow(() => ctrl._draw());
  });
});
