import './setup-dom.js';

// Patch DOM mock with missing methods
const _origCreateElement = document.createElement;
document.createElement = function(tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  if (!el.select) el.select = () => {};
  if (!el.replaceWith) el.replaceWith = function(other) { if (el.parentNode) { el.parentNode.appendChild(other); } };
  return el;
};

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { OutlineEditor, readOutline, writeOutline, autoGenerateOutline } from '../../app/modules/outline-editor.js';
import { PDFDocument } from 'pdf-lib';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  return document.createElement('div');
}

function makeDeps(overrides = {}) {
  return {
    getPdfBytes: mock.fn(() => new Uint8Array(0)),
    onApply: mock.fn(),
    onNavigate: mock.fn(),
    onCancel: mock.fn(),
    ...overrides,
  };
}

/** Create a minimal valid PDF with the given number of pages. */
async function createMinimalPdf(pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  return await doc.save();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('OutlineEditor', () => {
  let container, deps;

  beforeEach(() => {
    container = makeContainer();
    deps = makeDeps();
  });

  it('constructor initialises with null panel and empty tree', () => {
    const editor = new OutlineEditor(container, deps);
    assert.equal(editor._panel, null);
    assert.deepEqual(editor._tree, []);
  });

  it('close removes panel', () => {
    const editor = new OutlineEditor(container, deps);
    editor._panel = document.createElement('div');
    container.appendChild(editor._panel);
    editor.close();
    assert.equal(editor._panel, null);
  });

  it('close is safe when no panel', () => {
    const editor = new OutlineEditor(container, deps);
    assert.doesNotThrow(() => editor.close());
  });

  it('_addItem adds a new bookmark to tree', () => {
    const editor = new OutlineEditor(container, deps);
    editor._tree = [];
    // Simulate having a treeContainer
    editor._treeContainer = document.createElement('div');
    editor._addItem();

    assert.equal(editor._tree.length, 1);
    assert.equal(editor._tree[0].title, 'New Bookmark');
    assert.equal(editor._tree[0].pageNum, 1);
    assert.deepEqual(editor._tree[0].children, []);
  });

  it('_removeItem removes item at index', () => {
    const editor = new OutlineEditor(container, deps);
    editor._tree = [
      { title: 'A', pageNum: 1, children: [] },
      { title: 'B', pageNum: 2, children: [] },
      { title: 'C', pageNum: 3, children: [] },
    ];
    editor._treeContainer = document.createElement('div');

    editor._removeItem(editor._tree, 1);
    assert.equal(editor._tree.length, 2);
    assert.equal(editor._tree[0].title, 'A');
    assert.equal(editor._tree[1].title, 'C');
  });

  it('_renderTree shows empty message when tree is empty', () => {
    const editor = new OutlineEditor(container, deps);
    editor._tree = [];
    editor._treeContainer = document.createElement('div');
    editor._renderTree();

    assert.ok(editor._treeContainer.children.length > 0);
  });

  it('_renderTree builds list for non-empty tree', () => {
    const editor = new OutlineEditor(container, deps);
    editor._tree = [
      { title: 'Chapter 1', pageNum: 1, children: [], open: true },
      { title: 'Chapter 2', pageNum: 5, children: [], open: true },
    ];
    editor._treeContainer = document.createElement('div');
    editor._renderTree();

    const items = editor._treeContainer.querySelectorAll('li');
    assert.equal(items.length, 2);
  });

  it('_buildTreeList handles nested children', () => {
    const editor = new OutlineEditor(container, deps);
    editor._tree = [];
    editor._treeContainer = document.createElement('div');

    const items = [
      {
        title: 'Parent',
        pageNum: 1,
        children: [
          { title: 'Child', pageNum: 2, children: [], open: true },
        ],
        open: true,
      },
    ];

    const ul = editor._buildTreeList(items, 0);
    assert.ok(ul);
    const nestedUl = ul.querySelector('ul');
    assert.ok(nestedUl);
  });

  it('_buildPanel creates panel with toolbar and tree container', () => {
    const editor = new OutlineEditor(container, deps);
    editor._tree = [];
    const panel = editor._buildPanel();

    assert.ok(panel);
    // Should have buttons
    const buttons = panel.querySelectorAll('button');
    assert.ok(buttons.length >= 3); // Add, Auto, Save, Close
  });

  it('_inlineRename replaces element with input and commits on blur', () => {
    const editor = new OutlineEditor(container, deps);
    editor._treeContainer = document.createElement('div');
    editor._tree = [{ title: 'Original', pageNum: 1, children: [] }];

    const titleEl = document.createElement('span');
    titleEl.textContent = 'Original';
    const parent = document.createElement('div');
    parent.appendChild(titleEl);

    editor._inlineRename(titleEl, editor._tree[0]);

    // After inline rename, parent should contain an input
    const input = parent.querySelector('input');
    assert.ok(input, 'input element should be created');
    assert.equal(input.value, 'Original');

    // Simulate changing value and blurring
    input.value = 'Renamed';
    input.dispatchEvent(new Event('blur'));

    assert.equal(editor._tree[0].title, 'Renamed');
  });

  it('_inlineRename commits on Enter key', () => {
    const editor = new OutlineEditor(container, deps);
    editor._treeContainer = document.createElement('div');
    editor._tree = [{ title: 'Before', pageNum: 1, children: [] }];

    const titleEl = document.createElement('span');
    titleEl.textContent = 'Before';
    const parent = document.createElement('div');
    parent.appendChild(titleEl);

    editor._inlineRename(titleEl, editor._tree[0]);

    const input = parent.querySelector('input');
    input.value = 'After Enter';
    input.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter' }));

    assert.equal(editor._tree[0].title, 'After Enter');
  });

  it('_inlineRename cancels on Escape key (keeps original title)', () => {
    const editor = new OutlineEditor(container, deps);
    editor._treeContainer = document.createElement('div');
    editor._tree = [{ title: 'Keep Me', pageNum: 1, children: [] }];

    const titleEl = document.createElement('span');
    titleEl.textContent = 'Keep Me';
    const parent = document.createElement('div');
    parent.appendChild(titleEl);

    editor._inlineRename(titleEl, editor._tree[0]);

    const input = parent.querySelector('input');
    input.value = 'Something Else';
    input.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));

    // Escape re-renders the tree without committing the new value
    assert.equal(editor._tree[0].title, 'Keep Me');
  });

  it('_inlineRename keeps original title when input is empty', () => {
    const editor = new OutlineEditor(container, deps);
    editor._treeContainer = document.createElement('div');
    editor._tree = [{ title: 'Original', pageNum: 1, children: [] }];

    const titleEl = document.createElement('span');
    titleEl.textContent = 'Original';
    const parent = document.createElement('div');
    parent.appendChild(titleEl);

    editor._inlineRename(titleEl, editor._tree[0]);

    const input = parent.querySelector('input');
    input.value = '   ';
    input.dispatchEvent(new Event('blur'));

    assert.equal(editor._tree[0].title, 'Original');
  });

  it('_buildTreeList collapse toggle hides children when open is false', () => {
    const editor = new OutlineEditor(container, deps);
    editor._treeContainer = document.createElement('div');
    editor._tree = [];

    const items = [
      {
        title: 'Parent',
        pageNum: 1,
        children: [
          { title: 'Child', pageNum: 2, children: [], open: true },
        ],
        open: false, // collapsed
      },
    ];

    const ul = editor._buildTreeList(items, 0);
    // With open: false, nested ul should NOT be rendered
    const nestedUl = ul.querySelector('ul');
    assert.equal(nestedUl, null, 'children should not be rendered when open is false');
  });

  it('_buildTreeList items without children get spacer instead of toggle', () => {
    const editor = new OutlineEditor(container, deps);
    editor._treeContainer = document.createElement('div');
    editor._tree = [];

    const items = [
      { title: 'Leaf', pageNum: 1, children: [] },
    ];

    const ul = editor._buildTreeList(items, 0);
    const li = ul.querySelector('li');
    assert.ok(li);
    // First child of row div should be a spacer span (not a toggle)
    const row = li.children[0];
    const firstSpan = row.children[0];
    assert.equal(firstSpan.tagName, 'SPAN');
    assert.equal(firstSpan.textContent, ''); // spacer has no text
  });

  it('open() reads outline and appends panel to container', async () => {
    const pdfBytes = await createMinimalPdf(2);
    const editorDeps = makeDeps({
      getPdfBytes: mock.fn(() => pdfBytes),
    });
    const editor = new OutlineEditor(container, editorDeps);
    await editor.open();

    assert.ok(editor._panel, 'panel should be created');
    assert.ok(container.children.length > 0, 'panel should be appended to container');
    assert.ok(Array.isArray(editor._tree), 'tree should be an array');
  });
});

// ── readOutline / writeOutline / autoGenerateOutline ──────────────────────

describe('readOutline', () => {
  it('returns empty array for a PDF with no bookmarks', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const tree = await readOutline(pdfBytes);
    assert.ok(Array.isArray(tree));
    assert.equal(tree.length, 0);
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const arrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    );
    const tree = await readOutline(arrayBuffer);
    assert.ok(Array.isArray(tree));
    assert.equal(tree.length, 0);
  });
});

describe('writeOutline', () => {
  it('writes an empty outline and returns a Blob', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const blob = await writeOutline(pdfBytes, []);
    assert.ok(blob instanceof Blob);
  });

  it('writes a flat outline with items', async () => {
    const pdfBytes = await createMinimalPdf(3);
    const tree = [
      { title: 'Chapter 1', pageNum: 1, children: [] },
      { title: 'Chapter 2', pageNum: 2, children: [] },
      { title: 'Chapter 3', pageNum: 3, children: [] },
    ];
    const blob = await writeOutline(pdfBytes, tree);
    assert.ok(blob instanceof Blob);
  });

  it('writes nested outlines with children', async () => {
    const pdfBytes = await createMinimalPdf(3);
    const tree = [
      {
        title: 'Part 1',
        pageNum: 1,
        children: [
          { title: 'Section 1.1', pageNum: 1, children: [] },
          { title: 'Section 1.2', pageNum: 2, children: [] },
        ],
      },
      { title: 'Part 2', pageNum: 3, children: [] },
    ];
    const blob = await writeOutline(pdfBytes, tree);
    assert.ok(blob instanceof Blob);
  });

  it('clamps page numbers to valid range', async () => {
    const pdfBytes = await createMinimalPdf(2);
    const tree = [
      { title: 'Beyond last', pageNum: 999, children: [] },
      { title: 'Before first', pageNum: -5, children: [] },
    ];
    const blob = await writeOutline(pdfBytes, tree);
    assert.ok(blob instanceof Blob);
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const arrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    );
    const blob = await writeOutline(arrayBuffer, []);
    assert.ok(blob instanceof Blob);
  });

  it('roundtrips: written outline can be read back', async () => {
    const pdfBytes = await createMinimalPdf(2);
    const tree = [
      { title: 'Bookmark A', pageNum: 1, children: [] },
      { title: 'Bookmark B', pageNum: 2, children: [] },
    ];
    const blob = await writeOutline(pdfBytes, tree);
    // Convert blob back to Uint8Array
    const arrayBuffer = await blob.arrayBuffer();
    const newBytes = new Uint8Array(arrayBuffer);
    const readBack = await readOutline(newBytes);
    assert.ok(Array.isArray(readBack));
    assert.equal(readBack.length, 2);
    assert.equal(readBack[0].title, 'Bookmark A');
    assert.equal(readBack[1].title, 'Bookmark B');
  });
});

describe('autoGenerateOutline', () => {
  it('returns empty array for a PDF with no text content', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const tree = await autoGenerateOutline(pdfBytes);
    assert.ok(Array.isArray(tree));
    assert.equal(tree.length, 0);
  });

  it('accepts ArrayBuffer input', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const arrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    );
    const tree = await autoGenerateOutline(arrayBuffer);
    assert.ok(Array.isArray(tree));
  });

  it('respects custom options', async () => {
    const pdfBytes = await createMinimalPdf(1);
    const tree = await autoGenerateOutline(pdfBytes, { minFontSize: 20, maxDepth: 2 });
    assert.ok(Array.isArray(tree));
    assert.equal(tree.length, 0);
  });
});
