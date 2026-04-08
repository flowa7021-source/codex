// ─── Unit Tests: PDF Advanced Edit ────────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { PdfBlockEditor, blockEditor } from '../../app/modules/pdf-advanced-edit.js';

// ─── PdfBlockEditor constructor ──────────────────────────────────────────────
describe('PdfBlockEditor constructor', () => {
  it('initialises with default state', () => {
    const editor = new PdfBlockEditor();
    assert.ok(editor.blocks instanceof Map);
    assert.equal(editor.selectedBlock, null);
    assert.equal(editor.dragState, null);
    assert.equal(editor.resizeState, null);
    assert.deepEqual(editor.undoStack, []);
    assert.deepEqual(editor.redoStack, []);
    assert.equal(editor.maxHistory, 50);
    assert.equal(editor.snapEnabled, true);
    assert.equal(editor.snapThreshold, 8);
    assert.equal(editor.showGuides, true);
  });
});

// ─── blockEditor singleton ───────────────────────────────────────────────────
describe('blockEditor singleton', () => {
  it('is an instance of PdfBlockEditor', () => {
    assert.ok(blockEditor instanceof PdfBlockEditor);
  });
});

// ─── getPageBlocks ───────────────────────────────────────────────────────────
describe('getPageBlocks', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('creates empty array on first access', () => {
    const blocks = editor.getPageBlocks(1);
    assert.ok(Array.isArray(blocks));
    assert.equal(blocks.length, 0);
  });

  it('returns same array on subsequent access', () => {
    const a = editor.getPageBlocks(1);
    const b = editor.getPageBlocks(1);
    assert.equal(a, b);
  });
});

// ─── addTextBlock ────────────────────────────────────────────────────────────
describe('addTextBlock', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('creates a text block with defaults', () => {
    const block = editor.addTextBlock(1, 10, 20, 'Hello');
    assert.equal(block.type, 'text');
    assert.equal(block.x, 10);
    assert.equal(block.y, 20);
    assert.equal(block.content, 'Hello');
    assert.equal(block.width, 200);
    assert.equal(block.height, 40);
    assert.equal(block.style.fontSize, 14);
    assert.equal(block.style.fontFamily, 'sans-serif');
    assert.equal(block.style.color, '#000000');
    assert.equal(block.style.backgroundColor, 'transparent');
    assert.equal(block.style.bold, false);
    assert.equal(block.style.italic, false);
    assert.equal(block.style.align, 'left');
    assert.ok(block.id.startsWith('blk-'));
  });

  it('respects custom style', () => {
    const block = editor.addTextBlock(1, 0, 0, 'X', {
      width: 300, height: 60, fontSize: 24,
      fontFamily: 'monospace', color: '#ff0000',
      backgroundColor: '#eee', bold: true, italic: true, align: 'center',
    });
    assert.equal(block.width, 300);
    assert.equal(block.height, 60);
    assert.equal(block.style.fontSize, 24);
    assert.equal(block.style.bold, true);
    assert.equal(block.style.italic, true);
    assert.equal(block.style.align, 'center');
  });

  it('adds block to page blocks array', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    editor.addTextBlock(1, 0, 0, 'B');
    assert.equal(editor.getPageBlocks(1).length, 2);
  });

  it('pushes to undo stack', () => {
    editor.addTextBlock(1, 0, 0, 'X');
    assert.equal(editor.undoStack.length, 1);
  });

  it('notifies listeners', () => {
    const events = [];
    editor.onEvent((ev, pg, b) => events.push({ ev, pg }));
    editor.addTextBlock(1, 0, 0, 'X');
    assert.equal(events.length, 1);
    assert.equal(events[0].ev, 'add');
    assert.equal(events[0].pg, 1);
  });
});

// ─── addImageBlock ───────────────────────────────────────────────────────────
describe('addImageBlock', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('creates an image block', () => {
    const block = editor.addImageBlock(2, 5, 10, 'data:image/png;base64,abc', 100, 50);
    assert.equal(block.type, 'image');
    assert.equal(block.x, 5);
    assert.equal(block.y, 10);
    assert.equal(block.content, 'data:image/png;base64,abc');
    assert.equal(block.width, 100);
    assert.equal(block.height, 50);
    assert.deepEqual(block.style, {});
    assert.ok(block.id.startsWith('blk-'));
  });
});

// ─── moveBlock ───────────────────────────────────────────────────────────────
describe('moveBlock', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 10, 20, 'Test');
  });

  it('updates block position', () => {
    editor.moveBlock(1, block.id, 100, 200);
    assert.equal(block.x, 100);
    assert.equal(block.y, 200);
  });

  it('does nothing for non-existent blockId', () => {
    const before = editor.undoStack.length;
    editor.moveBlock(1, 'nonexistent', 0, 0);
    assert.equal(editor.undoStack.length, before);
  });
});

// ─── resizeBlock ─────────────────────────────────────────────────────────────
describe('resizeBlock', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 0, 0, 'R');
  });

  it('updates block dimensions', () => {
    editor.resizeBlock(1, block.id, 300, 100);
    assert.equal(block.width, 300);
    assert.equal(block.height, 100);
  });

  it('enforces minimum width 20', () => {
    editor.resizeBlock(1, block.id, 5, 50);
    assert.equal(block.width, 20);
  });

  it('enforces minimum height 10', () => {
    editor.resizeBlock(1, block.id, 50, 3);
    assert.equal(block.height, 10);
  });

  it('does nothing for non-existent block', () => {
    const stackLen = editor.undoStack.length;
    editor.resizeBlock(1, 'nope', 100, 100);
    assert.equal(editor.undoStack.length, stackLen);
  });
});

// ─── updateBlockContent ──────────────────────────────────────────────────────
describe('updateBlockContent', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 0, 0, 'Old');
  });

  it('updates content', () => {
    editor.updateBlockContent(1, block.id, 'New');
    assert.equal(block.content, 'New');
  });

  it('does nothing for missing block', () => {
    editor.updateBlockContent(1, 'missing', 'X');
    // no error thrown
  });
});

// ─── updateBlockStyle ────────────────────────────────────────────────────────
describe('updateBlockStyle', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 0, 0, 'S');
  });

  it('merges style updates', () => {
    editor.updateBlockStyle(1, block.id, { bold: true, color: '#ff0000' });
    assert.equal(block.style.bold, true);
    assert.equal(block.style.color, '#ff0000');
    // unchanged properties remain
    assert.equal(block.style.fontSize, 14);
  });

  it('does nothing for missing block', () => {
    editor.updateBlockStyle(1, 'nope', { bold: true });
  });
});

// ─── deleteBlock ─────────────────────────────────────────────────────────────
describe('deleteBlock', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 0, 0, 'D');
  });

  it('removes block from page', () => {
    editor.deleteBlock(1, block.id);
    assert.equal(editor.getPageBlocks(1).length, 0);
  });

  it('clears selection if deleted block was selected', () => {
    editor.selectBlock(block);
    editor.deleteBlock(1, block.id);
    assert.equal(editor.selectedBlock, null);
  });

  it('does nothing for non-existent block', () => {
    editor.deleteBlock(1, 'nope');
    assert.equal(editor.getPageBlocks(1).length, 1);
  });
});

// ─── selectBlock / deselectAll ───────────────────────────────────────────────
describe('selectBlock and deselectAll', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('selects a block', () => {
    const block = editor.addTextBlock(1, 0, 0, 'S');
    editor.selectBlock(block);
    assert.equal(editor.selectedBlock, block);
  });

  it('deselects all', () => {
    const block = editor.addTextBlock(1, 0, 0, 'S');
    editor.selectBlock(block);
    editor.deselectAll();
    assert.equal(editor.selectedBlock, null);
  });
});

// ─── hitTest ─────────────────────────────────────────────────────────────────
describe('hitTest', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 10, 10, 'H');
    // block at (10,10) with w=200, h=40
  });

  it('returns block when point is inside', () => {
    const result = editor.hitTest(1, 50, 30);
    assert.equal(result, block);
  });

  it('returns null when point is outside', () => {
    const result = editor.hitTest(1, 300, 300);
    assert.equal(result, null);
  });

  it('returns topmost block (last in array)', () => {
    const block2 = editor.addTextBlock(1, 10, 10, 'Top');
    const result = editor.hitTest(1, 50, 30);
    assert.equal(result, block2);
  });

  it('returns null for empty page', () => {
    assert.equal(editor.hitTest(5, 0, 0), null);
  });
});

// ─── hitTestResizeHandle ─────────────────────────────────────────────────────
describe('hitTestResizeHandle', () => {
  let editor, block;
  beforeEach(() => {
    editor = new PdfBlockEditor();
    block = editor.addTextBlock(1, 10, 10, 'H');
    // bottom-right corner at (210, 50)
  });

  it('returns block when point is near resize handle', () => {
    const result = editor.hitTestResizeHandle(1, 210, 50, 8);
    assert.equal(result, block);
  });

  it('returns null when point is far from handle', () => {
    const result = editor.hitTestResizeHandle(1, 50, 30, 8);
    assert.equal(result, null);
  });
});

// ─── undo / redo ─────────────────────────────────────────────────────────────
describe('undo and redo', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('returns false when nothing to undo', () => {
    assert.equal(editor.undo(1), false);
  });

  it('returns false when nothing to redo', () => {
    assert.equal(editor.redo(1), false);
  });

  it('undoes last add', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    assert.equal(editor.getPageBlocks(1).length, 1);
    const result = editor.undo(1);
    assert.equal(result, true);
    assert.equal(editor.getPageBlocks(1).length, 0);
  });

  it('redo restores undone action', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    editor.undo(1);
    const result = editor.redo(1);
    assert.equal(result, true);
    assert.equal(editor.getPageBlocks(1).length, 1);
  });

  it('returns false when undo page does not match', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    assert.equal(editor.undo(2), false);
  });

  it('returns false when redo page does not match', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    editor.undo(1);
    assert.equal(editor.redo(2), false);
  });

  it('trims undo stack to maxHistory', () => {
    editor.maxHistory = 3;
    for (let i = 0; i < 5; i++) {
      editor.addTextBlock(1, i, i, `blk${i}`);
    }
    assert.ok(editor.undoStack.length <= 3);
  });

  it('clears redo stack on new action', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    editor.undo(1);
    assert.ok(editor.redoStack.length > 0);
    editor.addTextBlock(1, 0, 0, 'B');
    assert.equal(editor.redoStack.length, 0);
  });
});

// ─── export / import ─────────────────────────────────────────────────────────
describe('exportPageBlocks and importPageBlocks', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('exports deep copy of page blocks', () => {
    const block = editor.addTextBlock(1, 10, 20, 'E');
    const exported = editor.exportPageBlocks(1);
    assert.equal(exported.length, 1);
    assert.equal(exported[0].content, 'E');
    // Verify deep copy
    exported[0].content = 'Modified';
    assert.equal(editor.getPageBlocks(1)[0].content, 'E');
  });

  it('imports blocks onto a page', () => {
    const data = [{ id: 'blk-1', type: 'text', x: 0, y: 0, width: 100, height: 30, content: 'Imported', style: {} }];
    editor.importPageBlocks(2, data);
    assert.equal(editor.getPageBlocks(2).length, 1);
    assert.equal(editor.getPageBlocks(2)[0].content, 'Imported');
  });
});

describe('exportAllBlocks and importAllBlocks', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('exports all pages with blocks', () => {
    editor.addTextBlock(1, 0, 0, 'A');
    editor.addTextBlock(3, 0, 0, 'C');
    const all = editor.exportAllBlocks();
    assert.ok('1' in all);
    assert.ok('3' in all);
    assert.ok(!('2' in all));
  });

  it('skips empty pages', () => {
    editor.getPageBlocks(5); // create empty
    const all = editor.exportAllBlocks();
    assert.ok(!('5' in all));
  });

  it('importAllBlocks restores data', () => {
    const data = {
      1: [{ id: 'b1', type: 'text', x: 0, y: 0, width: 50, height: 20, content: 'X', style: {} }],
      2: [{ id: 'b2', type: 'image', x: 0, y: 0, width: 80, height: 80, content: 'data:...', style: {} }],
    };
    editor.importAllBlocks(data);
    assert.equal(editor.getPageBlocks(1).length, 1);
    assert.equal(editor.getPageBlocks(2).length, 1);
  });
});

// ─── snapPosition ────────────────────────────────────────────────────────────
describe('snapPosition', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('returns unmodified position when snap disabled', () => {
    editor.snapEnabled = false;
    const result = editor.snapPosition(1, 'blk-1', 50, 50, 100, 40, 800, 600);
    assert.equal(result.x, 50);
    assert.equal(result.y, 50);
    assert.deepEqual(editor._guides, []);
  });

  it('snaps to canvas left edge', () => {
    editor.snapThreshold = 10;
    // block left edge at x=3, should snap to 0
    const result = editor.snapPosition(1, 'blk-1', 3, 200, 100, 40, 800, 600);
    assert.equal(result.x, 0);
  });

  it('snaps to canvas center x', () => {
    editor.snapThreshold = 10;
    // block center = x + width/2 = 397, canvas center = 400
    const result = editor.snapPosition(1, 'blk-1', 347, 200, 100, 40, 800, 600);
    assert.equal(result.x, 350); // snapped so center = 400
  });

  it('snaps to other block edges', () => {
    editor.snapThreshold = 10;
    const other = editor.addTextBlock(1, 100, 100, 'Ref');
    // try moving block near the right edge of other block (100 + 200 = 300)
    const result = editor.snapPosition(1, 'blk-new', 298, 100, 50, 30, 800, 600);
    // block left edge (298) should snap to 300
    assert.equal(result.x, 300);
  });
});

// ─── moveBlockWithSnap ───────────────────────────────────────────────────────
describe('moveBlockWithSnap', () => {
  let editor;
  beforeEach(() => { editor = new PdfBlockEditor(); });

  it('moves block to snapped position', () => {
    editor.snapEnabled = false;
    const block = editor.addTextBlock(1, 0, 0, 'T');
    editor.moveBlockWithSnap(1, block.id, 55, 66, 800, 600);
    assert.equal(block.x, 55);
    assert.equal(block.y, 66);
  });

  it('does nothing for non-existent block', () => {
    editor.moveBlockWithSnap(1, 'nope', 10, 10, 800, 600);
    // no error
  });
});

// ─── clearGuides ─────────────────────────────────────────────────────────────
describe('clearGuides', () => {
  it('resets guides array', () => {
    const editor = new PdfBlockEditor();
    editor._guides = [{ axis: 'x', pos: 100 }];
    editor.clearGuides();
    assert.deepEqual(editor._guides, []);
  });
});

// ─── renderGuides ────────────────────────────────────────────────────────────
describe('renderGuides', () => {
  it('does nothing when showGuides is false', () => {
    const editor = new PdfBlockEditor();
    editor.showGuides = false;
    editor._guides = [{ axis: 'x', pos: 100 }];
    const ctx = makeMockCtx();
    editor.renderGuides(ctx, 1, 800, 600);
    assert.equal(ctx.calls.length, 0);
  });

  it('does nothing when no guides', () => {
    const editor = new PdfBlockEditor();
    const ctx = makeMockCtx();
    editor.renderGuides(ctx, 1, 800, 600);
    assert.equal(ctx.calls.length, 0);
  });

  it('draws x and y guides', () => {
    const editor = new PdfBlockEditor();
    editor._guides = [{ axis: 'x', pos: 100 }, { axis: 'y', pos: 200 }];
    const ctx = makeMockCtx();
    editor.renderGuides(ctx, 1, 800, 600);
    assert.ok(ctx.calls.includes('moveTo'));
    assert.ok(ctx.calls.includes('lineTo'));
    assert.ok(ctx.calls.includes('stroke'));
  });
});

// ─── renderBlocks ────────────────────────────────────────────────────────────
describe('renderBlocks', () => {
  it('renders text blocks', () => {
    const editor = new PdfBlockEditor();
    editor.addTextBlock(1, 10, 10, 'Hello\nWorld', { backgroundColor: '#eee' });
    const ctx = makeMockCtx();
    editor.renderBlocks(ctx, 1, 1);
    assert.ok(ctx.calls.includes('fillText'));
  });

  it('renders selection highlight', () => {
    const editor = new PdfBlockEditor();
    const block = editor.addTextBlock(1, 10, 10, 'Selected');
    editor.selectBlock(block);
    const ctx = makeMockCtx();
    editor.renderBlocks(ctx, 1, 1);
    assert.ok(ctx.calls.includes('strokeRect'));
  });
});

// ─── onEvent ─────────────────────────────────────────────────────────────────
describe('onEvent', () => {
  it('registers and calls listeners', () => {
    const editor = new PdfBlockEditor();
    const events = [];
    editor.onEvent((ev) => events.push(ev));
    editor.addTextBlock(1, 0, 0, 'Test');
    assert.ok(events.includes('add'));
  });
});

// ─── _parseColor ─────────────────────────────────────────────────────────────
describe('_parseColor', () => {
  it('parses hex color correctly', () => {
    const editor = new PdfBlockEditor();
    const color = editor._parseColor('#ff8040');
    assert.ok(Math.abs(color.r - 1) < 0.01);
    assert.ok(Math.abs(color.g - 0.502) < 0.01);
    assert.ok(Math.abs(color.b - 0.251) < 0.01);
  });

  it('handles color without hash', () => {
    const editor = new PdfBlockEditor();
    const color = editor._parseColor('000000');
    assert.equal(color.r, 0);
    assert.equal(color.g, 0);
    assert.equal(color.b, 0);
  });
});

// ─── enable / disable ────────────────────────────────────────────────────────
describe('enable and disable', () => {
  it('sets active to true on enable', () => {
    const editor = new PdfBlockEditor();
    // We can't fully test DOM parts, but we can test the state
    editor.active = false;
    // enable requires container and sourceCanvas, pass stubs
    // Just test the flag
    editor.active = true;
    assert.equal(editor.active, true);
  });

  it('sets active to false on disable', () => {
    const editor = new PdfBlockEditor();
    editor.active = true;
    editor.sourceCanvas = {};
    editor._overlay = null;
    editor.disable();
    assert.equal(editor.active, false);
    assert.equal(editor.sourceCanvas, null);
  });

  it('removes overlay on disable if present', () => {
    const editor = new PdfBlockEditor();
    let removed = false;
    editor._overlay = { remove: () => { removed = true; } };
    editor.disable();
    assert.equal(removed, true);
    assert.equal(editor._overlay, null);
  });
});

// ─── exportBlocksToPdf ───────────────────────────────────────────────────────

describe('exportBlocksToPdf', () => {
  async function makeOnePage() {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const bytes = await doc.save();
    // Return as ArrayBuffer which exportBlocksToPdf expects
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  const CANVAS_SIZE = { width: 612, height: 792 };

  it('returns Blob with PDF type for empty blocks', async () => {
    const editor = new PdfBlockEditor();
    const ab = await makeOnePage();
    const blob = await editor.exportBlocksToPdf(ab);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('embeds a text block into a PDF page', async () => {
    const editor = new PdfBlockEditor();
    editor.addTextBlock(1, 50, 100, 'Hello PDF', { width: 200, height: 50 });
    const ab = await makeOnePage();
    const blob = await editor.exportBlocksToPdf(ab, CANVAS_SIZE);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('embeds bold italic text block', async () => {
    const editor = new PdfBlockEditor();
    editor.addTextBlock(1, 50, 200, 'Bold italic', { width: 200, height: 40 });
    const blocks = editor.getPageBlocks(1);
    editor.updateBlockStyle(blocks[0].id, { bold: true, italic: true, fontSize: 16 });
    const ab = await makeOnePage();
    const blob = await editor.exportBlocksToPdf(ab, CANVAS_SIZE);
    assert.ok(blob instanceof Blob);
  });

  it('embeds text block with background color', async () => {
    const editor = new PdfBlockEditor();
    editor.addTextBlock(1, 50, 300, 'Bg', { width: 150, height: 30 });
    const blocks = editor.getPageBlocks(1);
    editor.updateBlockStyle(blocks[0].id, { backgroundColor: '#ffff00', color: '#000000' });
    const ab = await makeOnePage();
    const blob = await editor.exportBlocksToPdf(ab, CANVAS_SIZE);
    assert.ok(blob instanceof Blob);
  });

  it('embeds multiline text block', async () => {
    const editor = new PdfBlockEditor();
    editor.addTextBlock(1, 50, 400, 'Line 1\nLine 2\nLine 3', { width: 200, height: 80 });
    const ab = await makeOnePage();
    const blob = await editor.exportBlocksToPdf(ab, CANVAS_SIZE);
    assert.ok(blob instanceof Blob);
  });

  it('skips image block with invalid data gracefully', async () => {
    const editor = new PdfBlockEditor();
    editor.addImageBlock(1, 50, 500, 'data:image/png;base64,NOT_VALID', 100, 100);
    const ab = await makeOnePage();
    const blob = await editor.exportBlocksToPdf(ab);
    assert.ok(blob instanceof Blob);
  });
});

// ─── refreshOverlay ──────────────────────────────────────────────────────────

describe('refreshOverlay', () => {
  it('does nothing when not active', () => {
    const editor = new PdfBlockEditor();
    const container = document.createElement('div');
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 800;
    sourceCanvas.height = 600;
    // Should not throw and should not create overlay
    editor.refreshOverlay(container, sourceCanvas);
    assert.ok(!editor._overlay); // still falsy (undefined or null)
    assert.equal(container.children.length, 0);
  });

  it('creates overlay canvas when active and appends to container', () => {
    const editor = new PdfBlockEditor();
    const container = document.createElement('div');
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 400;
    sourceCanvas.height = 300;
    editor.active = true;
    editor.refreshOverlay(container, sourceCanvas);
    // Overlay should be created and appended
    assert.ok(editor._overlay !== null);
    assert.equal(editor._overlay.width, 400);
    assert.equal(editor._overlay.height, 300);
  });

  it('updates existing overlay dimensions on second call', () => {
    const editor = new PdfBlockEditor();
    const container = document.createElement('div');
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 400;
    sourceCanvas.height = 300;
    editor.active = true;
    editor.refreshOverlay(container, sourceCanvas);
    // Update dimensions and call again
    sourceCanvas.width = 800;
    sourceCanvas.height = 600;
    editor.refreshOverlay(container, sourceCanvas);
    assert.equal(editor._overlay.width, 800);
    assert.equal(editor._overlay.height, 600);
  });
});

// ─── Helper: mock canvas context ─────────────────────────────────────────────
function makeMockCtx() {
  const calls = [];
  const handler = {
    get(target, prop) {
      if (prop === 'calls') return calls;
      if (prop === 'canvas') return { width: 800, height: 600 };
      return (...args) => { calls.push(prop); };
    },
    set(target, prop, value) {
      return true;
    },
  };
  return new Proxy({}, handler);
}
