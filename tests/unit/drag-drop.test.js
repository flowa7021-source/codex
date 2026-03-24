import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Provide MutationObserver mock that captures callbacks
let lastObserverCallback = null;
if (typeof globalThis.MutationObserver === 'undefined') {
  globalThis.MutationObserver = class MutationObserver {
    constructor(cb) { this._cb = cb; lastObserverCallback = cb; }
    observe() {}
    disconnect() {}
  };
} else {
  const OrigMO = globalThis.MutationObserver;
  globalThis.MutationObserver = class MutationObserver {
    constructor(cb) { this._cb = cb; lastObserverCallback = cb; }
    observe() {}
    disconnect() {}
  };
}

const { initDragDrop, destroyThumbnailReorder, initAnnotationDrop } = await import('../../app/modules/drag-drop.js');

function makeElement(tag = 'div') {
  const el = globalThis.document.createElement(tag);
  // Add closest() support for thumbnail cells
  el.closest = function (selector) {
    let current = this;
    while (current) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (current.classList && current.classList.contains(cls)) return current;
      }
      current = current.parentNode;
    }
    return null;
  };
  return el;
}

// Helper to create a thumbnail cell element with closest() and dataset.page
function makeThumbnailCell(page) {
  const cell = makeElement();
  cell.classList.add('thumbnail-cell');
  cell.dataset.page = String(page);
  cell.draggable = false;
  return cell;
}

// Helper to build a container with insertBefore and nextSibling support
function makeContainer() {
  const container = makeElement();
  const origAppendChild = container.appendChild.bind(container);

  // Patch insertBefore
  container.insertBefore = function (newNode, refNode) {
    const children = container.children;
    if (!refNode) {
      origAppendChild(newNode);
      return newNode;
    }
    const idx = children.indexOf(refNode);
    if (idx === -1) {
      origAppendChild(newNode);
    } else {
      // Remove if already present
      const existIdx = children.indexOf(newNode);
      if (existIdx !== -1) children.splice(existIdx, 1);
      const insertIdx = children.indexOf(refNode);
      children.splice(insertIdx, 0, newNode);
      newNode.parentNode = container;
    }
    return newNode;
  };

  return container;
}

describe('drag-drop', () => {
  // ── initDragDrop basics ──

  it('initDragDrop does not throw with valid deps', () => {
    const viewport = makeElement();
    const thumbnailGrid = makeContainer();
    assert.doesNotThrow(() => {
      initDragDrop({
        viewport,
        thumbnailGrid,
        openFile: () => {},
        mergePdf: () => {},
        reorderPages: () => {},
      });
    });
  });

  it('initDragDrop handles null viewport gracefully', () => {
    assert.doesNotThrow(() => {
      initDragDrop({
        viewport: null,
        thumbnailGrid: null,
        openFile: () => {},
        mergePdf: () => {},
        reorderPages: () => {},
      });
    });
  });

  // ── File Drop Zone ──

  it('viewport dragenter increments counter and shows overlay', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    // Overlay should be added as child
    assert.equal(viewport.children.length, 1);
    assert.ok(viewport.children[0].className === 'drop-zone-overlay');
  });

  it('second dragenter does not create duplicate overlay', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    // Still only one overlay
    assert.equal(viewport.children.length, 1);
  });

  it('dragleave decrements counter and hides overlay when counter reaches 0', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    // Enter once to create overlay
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.equal(viewport.children.length, 1);
    // Leave once to remove overlay
    viewport.dispatchEvent({ type: 'dragleave', preventDefault: () => {} });
    assert.equal(viewport.children.length, 0);
  });

  it('dragleave does not go below zero', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    // Leave without entering
    viewport.dispatchEvent({ type: 'dragleave', preventDefault: () => {} });
    // Should not throw; counter stays at 0
    assert.equal(viewport.children.length, 0);
  });

  it('nested dragenter/dragleave keeps overlay until fully left', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    // Enter twice (nested element)
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.equal(viewport.children.length, 1);
    // Leave once - overlay should stay
    viewport.dispatchEvent({ type: 'dragleave', preventDefault: () => {} });
    assert.equal(viewport.children.length, 1);
    // Leave again - overlay removed
    viewport.dispatchEvent({ type: 'dragleave', preventDefault: () => {} });
    assert.equal(viewport.children.length, 0);
  });

  it('dragover sets dropEffect to copy', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    let effect = null;
    viewport.dispatchEvent({
      type: 'dragover',
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) { effect = v; } },
    });
    assert.equal(effect, 'copy');
  });

  it('viewport drop calls openFile for a single file', () => {
    const viewport = makeElement();
    let openedFile = null;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: (f) => { openedFile = f; },
      mergePdf: () => {},
      reorderPages: () => {},
    });
    const mockFile = { name: 'test.pdf', type: 'application/pdf' };
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files: [mockFile] },
    });
    assert.equal(openedFile, mockFile);
  });

  it('viewport drop calls mergePdf for multiple PDF files', () => {
    const viewport = makeElement();
    let mergedFiles = null;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: (files) => { mergedFiles = files; },
      reorderPages: () => {},
    });
    const files = [
      { name: 'a.pdf', type: 'application/pdf' },
      { name: 'b.pdf', type: 'application/pdf' },
    ];
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files },
    });
    assert.deepEqual(mergedFiles, files);
  });

  it('viewport drop merges PDFs detected by .pdf extension', () => {
    const viewport = makeElement();
    let mergedFiles = null;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: (files) => { mergedFiles = files; },
      reorderPages: () => {},
    });
    // Use generic type but .pdf extension
    const files = [
      { name: 'a.pdf', type: 'application/octet-stream' },
      { name: 'b.pdf', type: 'application/octet-stream' },
    ];
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files },
    });
    assert.deepEqual(mergedFiles, files);
  });

  it('viewport drop with no files does nothing', () => {
    const viewport = makeElement();
    let called = false;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => { called = true; },
      mergePdf: () => { called = true; },
      reorderPages: () => {},
    });
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files: [] },
    });
    assert.equal(called, false);
  });

  it('viewport drop resets dragCounter and hides overlay', () => {
    const viewport = makeElement();
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });
    // Enter to show overlay
    viewport.dispatchEvent({ type: 'dragenter', preventDefault: () => {} });
    assert.equal(viewport.children.length, 1);
    // Drop resets overlay
    const mockFile = { name: 'test.txt', type: 'text/plain' };
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files: [mockFile] },
    });
    assert.equal(viewport.children.length, 0);
  });

  it('viewport drop with null dataTransfer does nothing', () => {
    const viewport = makeElement();
    let called = false;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: () => { called = true; },
      mergePdf: () => {},
      reorderPages: () => {},
    });
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: null,
    });
    assert.equal(called, false);
  });

  it('viewport drop opens single non-PDF file', () => {
    const viewport = makeElement();
    let openedFile = null;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: (f) => { openedFile = f; },
      mergePdf: () => {},
      reorderPages: () => {},
    });
    const imgFile = { name: 'photo.jpg', type: 'image/jpeg' };
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files: [imgFile] },
    });
    assert.equal(openedFile, imgFile);
  });

  it('viewport drop with one PDF and one non-PDF opens first file', () => {
    const viewport = makeElement();
    let openedFile = null;
    let mergedFiles = null;
    initDragDrop({
      viewport,
      thumbnailGrid: null,
      openFile: (f) => { openedFile = f; },
      mergePdf: (files) => { mergedFiles = files; },
      reorderPages: () => {},
    });
    const files = [
      { name: 'a.pdf', type: 'application/pdf' },
      { name: 'b.jpg', type: 'image/jpeg' },
    ];
    viewport.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      dataTransfer: { files },
    });
    // Only 1 PDF so merge is not called, openFile is called with first file
    assert.equal(mergedFiles, null);
    assert.equal(openedFile, files[0]);
  });

  // ── Thumbnail Reorder ──

  it('thumbnail dragstart sets up dragged state', () => {
    const container = makeContainer();
    const cell = makeThumbnailCell(3);
    container.appendChild(cell);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    let effectAllowed = null;
    let dataSet = null;
    container.dispatchEvent({
      type: 'dragstart',
      target: cell,
      dataTransfer: {
        set effectAllowed(v) { effectAllowed = v; },
        setData(type, val) { dataSet = { type, val }; },
      },
    });

    assert.ok(cell.classList.contains('dragging'));
    assert.equal(effectAllowed, 'move');
    assert.deepEqual(dataSet, { type: 'text/plain', val: '3' });
  });

  it('thumbnail dragstart with non-cell target does nothing', () => {
    const container = makeContainer();
    const nonCell = makeElement();
    container.appendChild(nonCell);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // target without .thumbnail-cell class - closest returns null
    container.dispatchEvent({
      type: 'dragstart',
      target: nonCell,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    assert.ok(!nonCell.classList.contains('dragging'));
  });

  it('thumbnail dragstart sets opacity after timeout', async () => {
    const container = makeContainer();
    const cell = makeThumbnailCell(1);
    container.appendChild(cell);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    container.dispatchEvent({
      type: 'dragstart',
      target: cell,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    // safeTimeout uses setTimeout(..., 0), wait for it
    await new Promise(r => setTimeout(r, 10));
    assert.equal(cell.style.opacity, '0.4');
  });

  it('thumbnail dragover sets dropEffect to move', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const cell2 = makeThumbnailCell(2);
    container.appendChild(cell1);
    container.appendChild(cell2);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    let effect = null;
    // Dragover on cell2
    cell2.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 100 });
    container.dispatchEvent({
      type: 'dragover',
      target: cell2,
      clientY: 10, // above midpoint
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) { effect = v; } },
    });

    assert.equal(effect, 'move');
  });

  it('thumbnail dragover inserts placeholder before target when above midpoint', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const cell2 = makeThumbnailCell(2);
    container.appendChild(cell1);
    container.appendChild(cell2);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    cell2.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 100 });
    container.dispatchEvent({
      type: 'dragover',
      target: cell2,
      clientY: 10, // above midpoint (50)
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });

    // Placeholder should have been inserted
    const placeholders = container.children.filter(c => c.className === 'thumbnail-placeholder');
    assert.equal(placeholders.length, 1);
  });

  it('thumbnail dragover inserts placeholder after target when below midpoint', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const cell2 = makeThumbnailCell(2);
    container.appendChild(cell1);
    container.appendChild(cell2);

    // Patch nextSibling on cell2
    Object.defineProperty(cell2, 'nextSibling', { get: () => null });

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    cell2.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 100 });
    container.dispatchEvent({
      type: 'dragover',
      target: cell2,
      clientY: 80, // below midpoint (50)
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });

    // Placeholder should have been inserted
    const placeholders = container.children.filter(c => c.className === 'thumbnail-placeholder');
    assert.equal(placeholders.length, 1);
  });

  it('thumbnail dragover does nothing when target is the dragged item', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    container.appendChild(cell1);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    cell1.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 100 });
    container.dispatchEvent({
      type: 'dragover',
      target: cell1,
      clientY: 10,
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });

    // No placeholder added - still just 1 child (cell1)
    assert.equal(container.children.length, 1);
  });

  it('thumbnail dragover does nothing when target is not a cell', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const nonCell = makeElement();
    container.appendChild(cell1);
    container.appendChild(nonCell);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    container.dispatchEvent({
      type: 'dragover',
      target: nonCell,
      clientY: 10,
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });

    // No placeholder
    const placeholders = container.children.filter(c => c.className === 'thumbnail-placeholder');
    assert.equal(placeholders.length, 0);
  });

  it('thumbnail dragend cleans up dragged item and placeholder', async () => {
    const container = makeContainer();
    const cell = makeThumbnailCell(1);
    container.appendChild(cell);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag
    container.dispatchEvent({
      type: 'dragstart',
      target: cell,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    await new Promise(r => setTimeout(r, 10));
    assert.equal(cell.style.opacity, '0.4');
    assert.ok(cell.classList.contains('dragging'));

    // dragend
    container.dispatchEvent({ type: 'dragend' });

    assert.ok(!cell.classList.contains('dragging'));
    assert.equal(cell.style.opacity, '');
  });

  it('thumbnail dragend is safe when no item was dragged', () => {
    const container = makeContainer();

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Dragend without dragstart should not throw
    assert.doesNotThrow(() => {
      container.dispatchEvent({ type: 'dragend' });
    });
  });

  it('thumbnail drop calls reorderPages with correct page numbers', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const cell2 = makeThumbnailCell(2);
    container.appendChild(cell1);
    container.appendChild(cell2);

    let reorderArgs = null;
    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: (from, to) => { reorderArgs = { from, to }; },
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    // Drop on cell2
    container.dispatchEvent({
      type: 'drop',
      target: cell2,
      preventDefault: () => {},
    });

    assert.deepEqual(reorderArgs, { from: 1, to: 2 });
    // Cleanup happens
    assert.ok(!cell1.classList.contains('dragging'));
    assert.equal(cell1.style.opacity, '');
  });

  it('thumbnail drop does nothing when target is not a cell', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const nonCell = makeElement();
    container.appendChild(cell1);
    container.appendChild(nonCell);

    let reorderCalled = false;
    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => { reorderCalled = true; },
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    // Drop on non-cell
    container.dispatchEvent({
      type: 'drop',
      target: nonCell,
      preventDefault: () => {},
    });

    assert.equal(reorderCalled, false);
  });

  it('thumbnail drop does not reorder when same page', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(5);
    container.appendChild(cell1);

    let reorderCalled = false;
    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => { reorderCalled = true; },
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    // Drop on same cell
    container.dispatchEvent({
      type: 'drop',
      target: cell1,
      preventDefault: () => {},
    });

    assert.equal(reorderCalled, false);
  });

  it('thumbnail drop removes placeholder if present', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const cell2 = makeThumbnailCell(2);
    container.appendChild(cell1);
    container.appendChild(cell2);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag on cell1
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    // Dragover to create placeholder
    cell2.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 100 });
    container.dispatchEvent({
      type: 'dragover',
      target: cell2,
      clientY: 10,
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });

    // Verify placeholder exists
    let placeholders = container.children.filter(c => c.className === 'thumbnail-placeholder');
    assert.equal(placeholders.length, 1);

    // Drop on cell2
    container.dispatchEvent({
      type: 'drop',
      target: cell2,
      preventDefault: () => {},
    });

    // Placeholder should be removed after drop
    placeholders = container.children.filter(c => c.className === 'thumbnail-placeholder');
    assert.equal(placeholders.length, 0);
  });

  it('thumbnail dragend removes placeholder if present', () => {
    const container = makeContainer();
    const cell1 = makeThumbnailCell(1);
    const cell2 = makeThumbnailCell(2);
    container.appendChild(cell1);
    container.appendChild(cell2);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Start drag
    container.dispatchEvent({
      type: 'dragstart',
      target: cell1,
      dataTransfer: {
        set effectAllowed(v) {},
        setData() {},
      },
    });

    // Dragover to create placeholder
    cell2.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 100 });
    container.dispatchEvent({
      type: 'dragover',
      target: cell2,
      clientY: 10,
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });

    // Cancel drag
    container.dispatchEvent({ type: 'dragend' });

    // Placeholder should be removed
    const placeholders = container.children.filter(c => c.className === 'thumbnail-placeholder');
    assert.equal(placeholders.length, 0);
  });

  it('MutationObserver sets draggable on new cells', () => {
    const container = makeContainer();
    const cell = makeThumbnailCell(1);
    cell.draggable = false;
    container.appendChild(cell);

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Existing cells should be set to draggable
    assert.equal(cell.draggable, true);
  });

  it('MutationObserver callback makes new cells draggable', () => {
    const container = makeContainer();

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    // Add a new cell after init
    const newCell = makeThumbnailCell(5);
    newCell.draggable = false;
    container.appendChild(newCell);

    // Trigger the mutation observer callback
    if (lastObserverCallback) {
      lastObserverCallback();
    }

    assert.equal(newCell.draggable, true);
  });

  it('thumbnail reorder observer is stored on container', () => {
    const container = makeContainer();

    initDragDrop({
      viewport: null,
      thumbnailGrid: container,
      openFile: () => {},
      mergePdf: () => {},
      reorderPages: () => {},
    });

    assert.ok(container._thumbnailReorderObserver != null);
  });

  // ── destroyThumbnailReorder ──

  it('destroyThumbnailReorder disconnects observer', () => {
    const container = makeElement();
    let disconnected = false;
    container._thumbnailReorderObserver = {
      disconnect() { disconnected = true; },
    };
    destroyThumbnailReorder(container);
    assert.equal(disconnected, true);
    assert.equal(container._thumbnailReorderObserver, null);
  });

  it('destroyThumbnailReorder is safe with null', () => {
    assert.doesNotThrow(() => destroyThumbnailReorder(null));
  });

  it('destroyThumbnailReorder is safe with no observer', () => {
    const container = makeElement();
    assert.doesNotThrow(() => destroyThumbnailReorder(container));
  });

  // ── Annotation Drop ──

  it('initAnnotationDrop sets up dragover/drop listeners on canvas', () => {
    const canvas = makeElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    let dropArgs = null;
    initAnnotationDrop(canvas, (x, y, dt) => { dropArgs = { x, y, dt }; });
    const dt = { type: 'text/plain' };
    canvas.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      clientX: 10,
      clientY: 20,
      dataTransfer: dt,
    });
    assert.deepEqual(dropArgs, { x: 10, y: 20, dt });
  });

  it('initAnnotationDrop dragover adds hover class and sets dropEffect', () => {
    const canvas = makeElement('canvas');
    initAnnotationDrop(canvas, () => {});

    let effect = null;
    canvas.dispatchEvent({
      type: 'dragover',
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) { effect = v; } },
    });

    assert.ok(canvas.classList.contains('annotation-drop-hover'));
    assert.equal(effect, 'copy');
  });

  it('initAnnotationDrop dragleave removes hover class', () => {
    const canvas = makeElement('canvas');
    initAnnotationDrop(canvas, () => {});

    // Add hover class first
    canvas.dispatchEvent({
      type: 'dragover',
      preventDefault: () => {},
      dataTransfer: { set dropEffect(v) {} },
    });
    assert.ok(canvas.classList.contains('annotation-drop-hover'));

    // Dragleave removes it
    canvas.dispatchEvent({ type: 'dragleave' });
    assert.ok(!canvas.classList.contains('annotation-drop-hover'));
  });

  it('initAnnotationDrop drop removes hover class', () => {
    const canvas = makeElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 5, top: 10, width: 100, height: 100 });
    initAnnotationDrop(canvas, () => {});

    // Add hover class
    canvas.classList.add('annotation-drop-hover');

    canvas.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      clientX: 25,
      clientY: 30,
      dataTransfer: {},
    });

    assert.ok(!canvas.classList.contains('annotation-drop-hover'));
  });

  it('initAnnotationDrop drop computes correct coordinates relative to canvas', () => {
    const canvas = makeElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 50, top: 100, width: 200, height: 200 });
    let coords = null;
    initAnnotationDrop(canvas, (x, y) => { coords = { x, y }; });

    canvas.dispatchEvent({
      type: 'drop',
      preventDefault: () => {},
      clientX: 75,
      clientY: 130,
      dataTransfer: {},
    });

    assert.deepEqual(coords, { x: 25, y: 30 });
  });

  it('initAnnotationDrop is safe with null canvas', () => {
    assert.doesNotThrow(() => initAnnotationDrop(null, () => {}));
  });

  it('initAnnotationDrop drop with no onDrop callback does not throw', () => {
    const canvas = makeElement('canvas');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    initAnnotationDrop(canvas, null);

    assert.doesNotThrow(() => {
      canvas.dispatchEvent({
        type: 'drop',
        preventDefault: () => {},
        clientX: 10,
        clientY: 10,
        dataTransfer: {},
      });
    });
  });
});
