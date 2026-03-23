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
});

describe('detectTableRegions', () => {
  it('returns empty array for canvas with no lines', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const result = detectTableRegions(canvas);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('returns empty array when context is unavailable', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    const result = detectTableRegions(canvas);
    assert.ok(Array.isArray(result));
  });
});
