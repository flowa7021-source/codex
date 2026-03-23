import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { InlineTextEditor } from '../../app/modules/inline-text-editor.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeBlock(opts = {}) {
  return {
    id: opts.id ?? 'block-1',
    source: opts.source ?? 'native',
    boundingBox: opts.boundingBox ?? { x: 10, y: 20, width: 100, height: 14 },
    lines: opts.lines ?? [{ runs: [{ text: 'Hello World', fontSize: 12, color: '#000000', font: 'Arial' }] }],
  };
}

function makeContainer() {
  return document.createElement('div');
}

function makePageModel() {
  return { pageNumber: 1, height: 842, width: 595 };
}

function makeDeps(overrides = {}) {
  return {
    pdfLibDoc: null,
    pageWidthPt: 595,
    pageHeightPt: 842,
    zoom: 1,
    hideTextBlock: mock.fn(),
    showTextBlock: mock.fn(),
    onCommit: mock.fn(async () => {}),
    onCancel: mock.fn(),
    ...overrides,
  };
}

function makeCanvasRect() {
  return { x: 10, y: 800, width: 100, height: 14 };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('InlineTextEditor', () => {
  let container, page, deps;

  beforeEach(() => {
    container = makeContainer();
    page = makePageModel();
    deps = makeDeps();
  });

  it('constructor sets initial state', () => {
    const editor = new InlineTextEditor(container, page, deps);
    assert.equal(editor.container, container);
    assert.equal(editor.page, page);
    assert.equal(editor._editorEl, null);
    assert.equal(editor._block, null);
  });

  it('activate creates a contenteditable element', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    assert.ok(editor._editorEl);
    assert.equal(editor._editorEl.contentEditable, 'true');
    assert.equal(editor._editorEl.textContent, 'Hello World');
  });

  it('activate hides the original text block', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock({ id: 'blk-42' }), makeCanvasRect());

    assert.equal(deps.hideTextBlock.mock.calls.length, 1);
    assert.equal(deps.hideTextBlock.mock.calls[0].arguments[0], 'blk-42');
  });

  it('activate appends editor to container', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    assert.ok(container.children.length > 0);
  });

  it('cancel removes the editor and calls onCancel', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());
    editor.cancel();

    assert.equal(editor._editorEl, null);
    assert.equal(deps.onCancel.mock.calls.length, 1);
  });

  it('cancel shows the text block again', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock({ id: 'blk-7' }), makeCanvasRect());
    editor.cancel();

    assert.equal(deps.showTextBlock.mock.calls.length, 1);
    assert.equal(deps.showTextBlock.mock.calls[0].arguments[0], 'blk-7');
  });

  it('setZoom updates deps.zoom', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.setZoom(2.5);
    assert.equal(deps.zoom, 2.5);
  });

  it('activate positions the editor element', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const rect = { x: 50, y: 100, width: 200, height: 20 };
    editor.activate(makeBlock(), rect);

    assert.equal(editor._editorEl.style.left, '50px');
    assert.equal(editor._editorEl.style.top, '100px');
  });

  it('activate handles block with no lines gracefully', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({ lines: [] });
    editor.activate(block, makeCanvasRect());

    assert.equal(editor._editorEl.textContent, '');
  });

  it('second activate cancels the first editor', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock({ id: 'a' }), makeCanvasRect());
    const firstEl = editor._editorEl;

    editor.activate(makeBlock({ id: 'b' }), makeCanvasRect());
    assert.notEqual(editor._editorEl, firstEl);
  });

  it('activate applies OCR font when source is ocr', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({ source: 'ocr' });
    block.matchedSystemFont = 'Times New Roman';
    editor.activate(block, makeCanvasRect());

    assert.ok(editor._editorEl.style.cssText.includes('Times New Roman'));
  });
});
