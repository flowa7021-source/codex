import './setup-dom.js';

// Patch DOM mock with missing methods needed by InlineTextEditor
const _origCreateElement = document.createElement;
document.createElement = function(tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  if (!el.select) el.select = () => {};
  if (!el.getBoundingClientRect) el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  if (!el.replaceWith) el.replaceWith = function(other) { if (el.parentNode) { el.parentNode.appendChild(other); } };
  return el;
};
if (!window.getSelection) {
  window.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
}
if (!document.createRange) {
  document.createRange = () => ({ selectNodeContents() {} });
}

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

  it('commitEdit cleans up the editor element', async () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    await editor.commitEdit();

    assert.equal(editor._editorEl, null);
    assert.equal(editor._block, null);
  });

  it('commitEdit handles no editorEl gracefully', async () => {
    const editor = new InlineTextEditor(container, page, deps);
    // No activate — _editorEl is null
    await editor.commitEdit();
    assert.equal(deps.onCommit.mock.calls.length, 0);
  });

  it('cancel on non-activated editor does not throw', () => {
    const editor = new InlineTextEditor(container, page, deps);
    assert.doesNotThrow(() => editor.cancel());
  });

  it('cancel does not call onCancel if deps.onCancel is missing', () => {
    const noCancelDeps = makeDeps({ onCancel: undefined });
    const editor = new InlineTextEditor(container, page, noCancelDeps);
    editor.activate(makeBlock(), makeCanvasRect());
    assert.doesNotThrow(() => editor.cancel());
  });

  it('Escape key cancels the editor', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    const event = new Event('keydown');
    event.key = 'Escape';
    event.preventDefault = () => {};
    editor._onKeyDown(event);

    assert.equal(editor._editorEl, null);
    assert.equal(deps.onCancel.mock.calls.length, 1);
  });

  it('Ctrl+Enter commits the editor', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    const event = new Event('keydown');
    event.key = 'Enter';
    event.ctrlKey = true;
    event.shiftKey = false;
    event.preventDefault = () => {};
    editor._onKeyDown(event);

    // After commit, editor should be cleaned up
    assert.equal(editor._editorEl, null);
  });

  it('Shift+Enter commits the editor', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    const event = new Event('keydown');
    event.key = 'Enter';
    event.ctrlKey = false;
    event.shiftKey = true;
    event.preventDefault = () => {};
    editor._onKeyDown(event);

    assert.equal(editor._editorEl, null);
  });

  it('regular key does not cancel or commit', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());

    const event = new Event('keydown');
    event.key = 'a';
    event.ctrlKey = false;
    event.shiftKey = false;
    event.preventDefault = () => {};
    editor._onKeyDown(event);

    assert.ok(editor._editorEl !== null);
  });

  it('setZoom repositions the editor when active', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({ boundingBox: { x: 10, y: 20, width: 100, height: 14 } });
    editor.activate(block, makeCanvasRect());

    editor.setZoom(2);
    assert.equal(deps.zoom, 2);
    // The editor position should have been recalculated
    assert.ok(editor._editorEl.style.left);
  });

  it('setZoom does nothing when no editor is active', () => {
    const editor = new InlineTextEditor(container, page, deps);
    assert.doesNotThrow(() => editor.setZoom(3));
    assert.equal(deps.zoom, 3);
  });

  it('activate applies bold font weight', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({
      lines: [{ runs: [{ text: 'Bold', fontSize: 14, color: '#000', bold: true, font: 'Arial' }] }],
    });
    editor.activate(block, makeCanvasRect());

    assert.ok(editor._editorEl.style.cssText.includes('bold'));
  });

  it('activate applies italic font style', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({
      lines: [{ runs: [{ text: 'Italic', fontSize: 14, color: '#000', italic: true, font: 'Arial' }] }],
    });
    editor.activate(block, makeCanvasRect());

    assert.ok(editor._editorEl.style.cssText.includes('italic'));
  });

  it('activate uses default font when no run font', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({
      lines: [{ runs: [{ text: 'Test', fontSize: 12, color: '#000' }] }],
    });
    editor.activate(block, makeCanvasRect());

    assert.ok(editor._editorEl.style.cssText.includes('Arial'));
  });

  it('activate uses synthesizedFont for OCR blocks', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({ source: 'ocr' });
    block.synthesizedFont = 'Georgia';
    editor.activate(block, makeCanvasRect());

    assert.ok(editor._editorEl.style.cssText.includes('Georgia'));
  });

  it('activate uses default font size when no run', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({ lines: [{ runs: [] }] });
    editor.activate(block, makeCanvasRect());

    // Default 12px * zoom 1 = 12px
    assert.ok(editor._editorEl.style.cssText.includes('12px'));
  });

  it('activate applies color from run', () => {
    const editor = new InlineTextEditor(container, page, deps);
    const block = makeBlock({
      lines: [{ runs: [{ text: 'Red', fontSize: 12, color: '#ff0000', font: 'Arial' }] }],
    });
    editor.activate(block, makeCanvasRect());

    assert.ok(editor._editorEl.style.cssText.includes('#ff0000'));
  });

  it('_writeNativeText returns early without pdfLibDoc', async () => {
    const editor = new InlineTextEditor(container, page, deps);
    // deps.pdfLibDoc is null
    await assert.doesNotReject(async () => {
      await editor._writeNativeText(makeBlock(), 'new text');
    });
  });

  it('_writeOcrText returns early without getBackgroundCanvas', async () => {
    const editor = new InlineTextEditor(container, page, deps);
    await assert.doesNotReject(async () => {
      await editor._writeOcrText(makeBlock({ source: 'ocr' }), 'new text');
    });
  });

  it('_writeNativeText draws text on pdf page', async () => {
    const drawRectCalls = [];
    const drawTextCalls = [];
    const mockPage = {
      drawRectangle: (opts) => drawRectCalls.push(opts),
      drawText: (text, opts) => drawTextCalls.push({ text, ...opts }),
    };
    const pdfDeps = makeDeps({
      pdfLibDoc: {
        getPage: () => mockPage,
      },
    });
    const editor = new InlineTextEditor(container, page, pdfDeps);
    const block = makeBlock();
    await editor._writeNativeText(block, 'Updated');

    assert.equal(drawRectCalls.length, 1);
    assert.equal(drawTextCalls.length, 1);
    assert.equal(drawTextCalls[0].text, 'Updated');
  });

  it('cleanup removes keydown listener and editor element', () => {
    const editor = new InlineTextEditor(container, page, deps);
    editor.activate(makeBlock(), makeCanvasRect());
    const el = editor._editorEl;
    assert.ok(el);

    editor._cleanup();

    assert.equal(editor._editorEl, null);
    assert.equal(editor._block, null);
    assert.equal(editor._origText, '');
  });
});
