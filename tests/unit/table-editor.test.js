import './setup-dom.js';

// Patch DOM mock with missing methods
const _origCreateElement = document.createElement;
document.createElement = function(tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  if (!el.select) el.select = () => {};
  return el;
};

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { TableEditor, detectTableRegions } from '../../app/modules/table-editor.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  return document.createElement('div');
}

function makeTableBlock(opts = {}) {
  return {
    rows: opts.rows ?? [
      { cells: [{ text: 'A1', runs: [] }, { text: 'B1', runs: [] }] },
      { cells: [{ text: 'A2', runs: [] }, { text: 'B2', runs: [] }] },
    ],
    bbox: opts.bbox ?? { x: 50, y: 100, width: 200, height: 80 },
    pageNumber: opts.pageNumber ?? 1,
  };
}

/**
 * Create a canvas mock with controllable pixel data.
 * @param {number} w
 * @param {number} h
 * @param {Uint8ClampedArray|null} pixelData  — RGBA flat array, length = w*h*4
 */
function makeCanvasWithPixels(w, h, pixelData) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const data = pixelData || new Uint8ClampedArray(w * h * 4).fill(255); // white
  canvas.getContext = () => ({
    getImageData: () => ({ data, width: w, height: h }),
    drawImage() {}, fillRect() {}, clearRect() {},
  });
  return canvas;
}

/**
 * Build RGBA pixel data for a canvas of size w x h.
 * Calls `paintFn(setPixel)` where `setPixel(x, y, r, g, b)` paints a pixel.
 */
function buildPixelData(w, h, paintFn) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255); // white background
  function setPixel(x, y, r, g, b) {
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  paintFn(setPixel);
  return data;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TableEditor', () => {
  let container, editor;

  beforeEach(() => {
    container = makeContainer();
    editor = new TableEditor(container, null, 595, 842, 1);
  });

  it('constructor initialises with correct defaults', () => {
    assert.equal(editor.zoom, 1);
    assert.equal(editor.pageW, 595);
    assert.equal(editor.pageH, 842);
    assert.equal(editor._overlay, null);
    assert.deepEqual(editor._rows, []);
  });

  it('open creates overlay and grid', () => {
    editor.open(makeTableBlock());
    assert.ok(editor._overlay);
    assert.ok(editor._grid);
  });

  it('open deep-copies rows', () => {
    const block = makeTableBlock();
    editor.open(block);
    // Mutating the editor rows should not affect original
    editor._rows[0].cells[0].text = 'CHANGED';
    assert.equal(block.rows[0].cells[0].text, 'A1');
  });

  it('close removes overlay and resets state', () => {
    editor.open(makeTableBlock());
    editor.close();
    assert.equal(editor._overlay, null);
    assert.equal(editor._grid, null);
    assert.equal(editor._tableBlock, null);
  });

  it('close is safe when not open', () => {
    assert.doesNotThrow(() => editor.close());
  });

  it('on registers event listeners', () => {
    const handler = mock.fn();
    const returned = editor.on('commit', handler);
    assert.equal(returned, editor); // chainable
  });

  it('commit fires commit event and closes', async () => {
    const handler = mock.fn();
    editor.on('commit', handler);
    editor.open(makeTableBlock());
    await editor.commit();

    assert.equal(handler.mock.calls.length, 1);
    assert.ok(handler.mock.calls[0].arguments[0].rows);
    assert.equal(editor._overlay, null);
  });

  it('addRow adds a new empty row', () => {
    editor.open(makeTableBlock());
    const rowsBefore = editor._rows.length;
    editor.addRow();
    assert.equal(editor._rows.length, rowsBefore + 1);
    assert.equal(editor._rows[editor._rows.length - 1].cells[0].text, '');
  });

  it('removeLastRow removes last row but keeps at least 1', () => {
    editor.open(makeTableBlock());
    editor.removeLastRow();
    assert.equal(editor._rows.length, 1);
    // Should not go below 1
    editor.removeLastRow();
    assert.equal(editor._rows.length, 1);
  });

  it('addColumn adds a column to every row', () => {
    editor.open(makeTableBlock());
    const colsBefore = editor._rows[0].cells.length;
    editor.addColumn();
    assert.equal(editor._rows[0].cells.length, colsBefore + 1);
    assert.equal(editor._rows[1].cells.length, colsBefore + 1);
  });

  it('removeLastColumn removes last column but keeps at least 1', () => {
    editor.open(makeTableBlock());
    editor.removeLastColumn();
    assert.equal(editor._rows[0].cells.length, 1);
    editor.removeLastColumn();
    assert.equal(editor._rows[0].cells.length, 1);
  });

  it('setZoom updates zoom and repositions overlay', () => {
    editor.open(makeTableBlock());
    editor.setZoom(2);
    assert.equal(editor.zoom, 2);
  });

  // ── Additional coverage tests ─────────────────────────────────────────

  it('open fires the open event', () => {
    const handler = mock.fn();
    editor.on('open', handler);
    const block = makeTableBlock();
    editor.open(block);
    assert.equal(handler.mock.calls.length, 1);
    assert.deepEqual(handler.mock.calls[0].arguments[0].tableBlock, block);
  });

  it('close fires the close event', () => {
    const handler = mock.fn();
    editor.on('close', handler);
    editor.open(makeTableBlock());
    editor.close();
    assert.equal(handler.mock.calls.length, 1);
  });

  it('open when already open closes first then reopens', () => {
    const closeHandler = mock.fn();
    editor.on('close', closeHandler);
    editor.open(makeTableBlock());
    const firstOverlay = editor._overlay;
    editor.open(makeTableBlock({ bbox: { x: 10, y: 20, width: 100, height: 50 } }));
    assert.equal(closeHandler.mock.calls.length, 1);
    assert.ok(editor._overlay);
    assert.notEqual(editor._overlay, firstOverlay);
  });

  it('_emit swallows handler errors without crashing', () => {
    const errorHandler = () => { throw new Error('boom'); };
    const goodHandler = mock.fn();
    editor.on('open', errorHandler);
    editor.on('open', goodHandler);
    assert.doesNotThrow(() => editor.open(makeTableBlock()));
    assert.equal(goodHandler.mock.calls.length, 1);
  });

  it('setZoom without overlay does not throw', () => {
    assert.doesNotThrow(() => editor.setZoom(3));
    assert.equal(editor.zoom, 3);
  });

  it('_positionOverlay with null bbox is safe', () => {
    editor.open(makeTableBlock());
    assert.doesNotThrow(() => editor._positionOverlay(null));
  });

  it('_positionOverlay computes correct style', () => {
    editor.open(makeTableBlock({ bbox: { x: 100, y: 200, width: 300, height: 100 } }));
    editor.setZoom(2);
    // left = 100 * 2 = 200, top = (842 - 200 - 100) * 2 = 1084
    assert.equal(editor._overlay.style.left, '200px');
    assert.equal(editor._overlay.style.top, '1084px');
  });

  it('commit includes tableBlock in event data', async () => {
    const handler = mock.fn();
    editor.on('commit', handler);
    const block = makeTableBlock();
    editor.open(block);
    await editor.commit();
    const arg = handler.mock.calls[0].arguments[0];
    assert.ok(arg.tableBlock);
    assert.equal(arg.tableBlock.pageNumber, 1);
  });

  it('_collectRows syncs input values back to row model', () => {
    editor.open(makeTableBlock());
    // Simulate editing an input value
    const inputs = editor._grid.querySelectorAll('input');
    if (inputs.length > 0) {
      inputs[0].value = 'EDITED';
    }
    const rows = editor._collectRows();
    assert.equal(rows[0].cells[0].text, 'EDITED');
  });

  it('_collectRows returns deep copy', () => {
    editor.open(makeTableBlock());
    const rows = editor._collectRows();
    rows[0].cells[0].text = 'MODIFIED';
    // Original editor rows should not be affected
    assert.equal(editor._rows[0].cells[0].text, 'A1');
  });

  it('addRow with 3-column table adds row with 3 empty cells', () => {
    const block = makeTableBlock({
      rows: [
        { cells: [{ text: 'A', runs: [] }, { text: 'B', runs: [] }, { text: 'C', runs: [] }] },
      ],
    });
    editor.open(block);
    editor.addRow();
    assert.equal(editor._rows.length, 2);
    assert.equal(editor._rows[1].cells.length, 3);
    assert.equal(editor._rows[1].cells[2].text, '');
  });

  it('deep copy preserves runs arrays independently', () => {
    const runs = [{ font: 'Arial', size: 12 }];
    const block = makeTableBlock({
      rows: [{ cells: [{ text: 'X', runs }] }],
    });
    editor.open(block);
    editor._rows[0].cells[0].runs.push({ font: 'Bold', size: 14 });
    // Original runs should be unchanged
    assert.equal(runs.length, 1);
  });

  it('grid builds correct number of inputs', () => {
    const block = makeTableBlock({
      rows: [
        { cells: [{ text: 'A', runs: [] }, { text: 'B', runs: [] }] },
        { cells: [{ text: 'C', runs: [] }, { text: 'D', runs: [] }] },
        { cells: [{ text: 'E', runs: [] }, { text: 'F', runs: [] }] },
      ],
    });
    editor.open(block);
    const inputs = editor._grid.querySelectorAll('input');
    assert.equal(inputs.length, 6);
  });

  it('input focus sets _activeCell', () => {
    editor.open(makeTableBlock());
    const inputs = editor._grid.querySelectorAll('input');
    // Simulate focus on second cell (row 0, col 1)
    inputs[1].dispatchEvent({ type: 'focus' });
    assert.deepEqual(editor._activeCell, { row: 0, col: 1 });
  });

  it('input blur syncs value back and clears outline', () => {
    editor.open(makeTableBlock());
    const inputs = editor._grid.querySelectorAll('input');
    inputs[0].value = 'NewVal';
    inputs[0].dispatchEvent({ type: 'blur' });
    assert.equal(editor._rows[0].cells[0].text, 'NewVal');
  });

  it('toolbar buttons are created in overlay', () => {
    editor.open(makeTableBlock());
    const buttons = editor._overlay.querySelectorAll('button');
    // 4 manipulation buttons + commit + cancel = 6
    assert.ok(buttons.length >= 6);
  });
});

describe('TableEditor keyboard navigation', () => {
  let container, editor, inputs;

  beforeEach(() => {
    container = makeContainer();
    editor = new TableEditor(container, null, 595, 842, 1);
    editor.open(makeTableBlock());
    inputs = editor._overlay.querySelectorAll('input');
  });

  function fireKey(key, opts = {}) {
    const e = {
      type: 'keydown',
      key,
      shiftKey: opts.shiftKey || false,
      preventDefault: mock.fn(),
    };
    editor._onKeyDown(e);
    return e;
  }

  it('_onKeyDown does nothing when overlay is null', () => {
    editor.close();
    assert.doesNotThrow(() => fireKey('Tab'));
  });

  it('_onKeyDown does nothing when active element not in inputs', () => {
    // document.activeElement is not an input in the overlay
    assert.doesNotThrow(() => fireKey('Tab'));
  });

  it('Tab moves focus forward', () => {
    // We need to simulate that document.activeElement is one of the inputs
    const focusCalls = [];
    inputs[1].focus = () => focusCalls.push(1);
    // Make document.activeElement return inputs[0]
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('Tab');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('Shift+Tab moves focus backward', () => {
    const focusCalls = [];
    inputs[0].focus = () => focusCalls.push(0);
    Object.defineProperty(document, 'activeElement', { value: inputs[1], configurable: true });
    const e = fireKey('Tab', { shiftKey: true });
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('Tab at end does not wrap', () => {
    const lastIdx = inputs.length - 1;
    Object.defineProperty(document, 'activeElement', { value: inputs[lastIdx], configurable: true });
    const e = fireKey('Tab');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    // No crash, just stays at last
  });

  it('Shift+Tab at start does not wrap', () => {
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('Tab', { shiftKey: true });
    assert.equal(e.preventDefault.mock.calls.length, 1);
  });

  it('Enter moves to cell below', () => {
    // 2x2 grid: input[0] is (0,0), input[2] is (1,0)
    const focusCalls = [];
    inputs[2].focus = () => focusCalls.push(2);
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('Enter');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('Enter on last row commits', async () => {
    const handler = mock.fn();
    editor.on('commit', handler);
    // Last row, any column
    Object.defineProperty(document, 'activeElement', { value: inputs[2], configurable: true });
    fireKey('Enter');
    // commit is async, give it a tick
    await new Promise(r => setTimeout(r, 10));
    assert.equal(handler.mock.calls.length, 1);
  });

  it('Escape closes the editor', () => {
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    fireKey('Escape');
    assert.equal(editor._overlay, null);
  });

  it('ArrowDown moves focus down by colCount', () => {
    const focusCalls = [];
    inputs[2].focus = () => focusCalls.push(2);
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('ArrowDown');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('ArrowDown at bottom row does nothing', () => {
    Object.defineProperty(document, 'activeElement', { value: inputs[2], configurable: true });
    const e = fireKey('ArrowDown');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    // No crash
  });

  it('ArrowUp moves focus up by colCount', () => {
    const focusCalls = [];
    inputs[0].focus = () => focusCalls.push(0);
    Object.defineProperty(document, 'activeElement', { value: inputs[2], configurable: true });
    const e = fireKey('ArrowUp');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('ArrowUp at top row does nothing', () => {
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('ArrowUp');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    // No crash
  });

  it('ArrowRight at end of text moves to next cell', () => {
    inputs[0].value = 'AB';
    inputs[0].selectionEnd = 2;
    const focusCalls = [];
    inputs[1].focus = () => focusCalls.push(1);
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('ArrowRight');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('ArrowRight mid-text does not move cell', () => {
    inputs[0].value = 'AB';
    inputs[0].selectionEnd = 1;
    Object.defineProperty(document, 'activeElement', { value: inputs[0], configurable: true });
    const e = fireKey('ArrowRight');
    assert.equal(e.preventDefault.mock.calls.length, 0);
  });

  it('ArrowLeft at start of text moves to previous cell', () => {
    inputs[1].value = 'AB';
    inputs[1].selectionStart = 0;
    const focusCalls = [];
    inputs[0].focus = () => focusCalls.push(0);
    Object.defineProperty(document, 'activeElement', { value: inputs[1], configurable: true });
    const e = fireKey('ArrowLeft');
    assert.equal(e.preventDefault.mock.calls.length, 1);
    assert.equal(focusCalls.length, 1);
  });

  it('ArrowLeft mid-text does not move cell', () => {
    inputs[1].value = 'AB';
    inputs[1].selectionStart = 1;
    Object.defineProperty(document, 'activeElement', { value: inputs[1], configurable: true });
    const e = fireKey('ArrowLeft');
    assert.equal(e.preventDefault.mock.calls.length, 0);
  });
});

describe('detectTableRegions — line detection', () => {
  it('returns empty when only horizontal lines present (no vertical)', () => {
    const W = 100, H = 100;
    const data = buildPixelData(W, H, (set) => {
      // Draw a single horizontal dark line at y=10, spanning x=0..59 (60px, >= minLen=40)
      for (let x = 0; x < 60; x++) set(x, 10, 0, 0, 0);
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.equal(result.length, 0); // no vertical lines → empty
  });

  it('returns empty when only vertical lines present (no horizontal)', () => {
    const W = 100, H = 100;
    const data = buildPixelData(W, H, (set) => {
      // Draw a single vertical dark line at x=10, spanning y=0..59
      for (let y = 0; y < 60; y++) set(10, y, 0, 0, 0);
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.equal(result.length, 0); // no horizontal lines → empty
  });

  it('detects a table region from intersecting h and v lines', () => {
    const W = 200, H = 200;
    const data = buildPixelData(W, H, (set) => {
      // Horizontal lines at y=20 and y=80
      for (let x = 10; x < 150; x++) { set(x, 20, 0, 0, 0); set(x, 80, 0, 0, 0); }
      // Vertical lines at x=10 and x=149
      for (let y = 20; y < 81; y++) { set(10, y, 0, 0, 0); set(149, y, 0, 0, 0); }
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.ok(result.length >= 1);
    // The detected region should roughly cover the box area
    assert.ok(result[0].width > 40);
    assert.ok(result[0].height > 40);
  });

  it('filters out regions smaller than minLineLength', () => {
    const W = 100, H = 100;
    const data = buildPixelData(W, H, (set) => {
      // Draw tiny crossing lines that produce a small bbox
      for (let x = 0; x < 50; x++) set(x, 5, 0, 0, 0);
      for (let y = 0; y < 50; y++) set(5, y, 0, 0, 0);
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    // Use a very large minLineLength so the result is filtered
    const result = detectTableRegions(canvas, { minLineLength: 200, threshold: 200 });
    assert.equal(result.length, 0);
  });

  it('returns empty when getContext returns null', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    canvas.getContext = () => null;
    const result = detectTableRegions(canvas);
    assert.deepEqual(result, []);
  });

  it('uses default options when none provided', () => {
    const W = 100, H = 100;
    const data = buildPixelData(W, H, (_set) => {
      // All white — no lines
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });
});

describe('detectTableRegions — clustering and merging', () => {
  it('clusters nearby horizontal lines with overlapping x ranges', () => {
    const W = 200, H = 200;
    const data = buildPixelData(W, H, (set) => {
      // Two close horizontal lines (within TOL*3 = 12 pixels of each other)
      for (let x = 10; x < 160; x++) {
        set(x, 30, 0, 0, 0);
        set(x, 38, 0, 0, 0); // 8px apart, within tolerance
        set(x, 90, 0, 0, 0);
      }
      // Vertical lines to make detection happen
      for (let y = 30; y < 91; y++) {
        set(10, y, 0, 0, 0);
        set(159, y, 0, 0, 0);
      }
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    // Lines should cluster into a single region
    assert.ok(result.length >= 1);
  });

  it('vertical lines expand cluster bounds', () => {
    const W = 200, H = 200;
    const data = buildPixelData(W, H, (set) => {
      // Horizontal lines
      for (let x = 20; x < 180; x++) {
        set(x, 40, 0, 0, 0);
        set(x, 60, 0, 0, 0);
      }
      // Vertical line that extends beyond horizontal lines
      for (let y = 20; y < 100; y++) {
        set(20, y, 0, 0, 0);
        set(179, y, 0, 0, 0);
      }
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.ok(result.length >= 1);
    // The vertical lines should expand the cluster's top/bottom
    const r = result[0];
    assert.ok(r.y <= 20, `top ${r.y} should be <= 20`);
    assert.ok(r.height >= 60, `height ${r.height} should be >= 60`);
  });

  it('merges overlapping clusters', () => {
    const W = 300, H = 200;
    const data = buildPixelData(W, H, (set) => {
      // First cluster: h-lines at y=20, x=10..100 and y=50, x=10..100
      for (let x = 10; x < 100; x++) {
        set(x, 20, 0, 0, 0);
        set(x, 50, 0, 0, 0);
      }
      // Second cluster: h-lines at y=80, x=50..200 (far from first y but overlapping x)
      // Then bring them closer by adding h-lines that overlap with both
      for (let x = 50; x < 200; x++) {
        set(x, 55, 0, 0, 0); // close to y=50 (within TOL*3=12) and overlapping x
        set(x, 80, 0, 0, 0);
      }
      // Vertical lines spanning both clusters
      for (let y = 20; y < 81; y++) {
        set(10, y, 0, 0, 0);
        set(199, y, 0, 0, 0);
      }
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.ok(result.length >= 1);
  });

  it('non-overlapping clusters remain separate', () => {
    const W = 400, H = 200;
    const data = buildPixelData(W, H, (set) => {
      // Cluster 1: x=10..80, y=10..70
      for (let x = 10; x < 80; x++) {
        set(x, 10, 0, 0, 0);
        set(x, 70, 0, 0, 0);
      }
      for (let y = 10; y < 71; y++) {
        set(10, y, 0, 0, 0);
        set(79, y, 0, 0, 0);
      }
      // Cluster 2: x=200..300, y=10..70 (far from cluster 1)
      for (let x = 200; x < 300; x++) {
        set(x, 10, 0, 0, 0);
        set(x, 70, 0, 0, 0);
      }
      for (let y = 10; y < 71; y++) {
        set(200, y, 0, 0, 0);
        set(299, y, 0, 0, 0);
      }
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.ok(result.length >= 2, `expected >= 2 regions, got ${result.length}`);
  });

  it('horizontal run detection handles dark pixel at end of row', () => {
    const W = 100, H = 50;
    const data = buildPixelData(W, H, (set) => {
      // Dark run that goes all the way to the right edge
      for (let x = 50; x < W; x++) set(x, 10, 0, 0, 0);
      // A vertical line to avoid early empty return
      for (let y = 10; y < 50; y++) set(50, y, 0, 0, 0);
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.ok(Array.isArray(result));
  });

  it('vertical run detection handles dark pixel at bottom edge', () => {
    const W = 100, H = 100;
    const data = buildPixelData(W, H, (set) => {
      // Vertical dark run that goes to the bottom edge
      for (let y = 40; y < H; y++) set(20, y, 0, 0, 0);
      // A horizontal line
      for (let x = 10; x < 80; x++) set(x, 40, 0, 0, 0);
    });
    const canvas = makeCanvasWithPixels(W, H, data);
    const result = detectTableRegions(canvas, { minLineLength: 40, threshold: 200 });
    assert.ok(Array.isArray(result));
  });
});
