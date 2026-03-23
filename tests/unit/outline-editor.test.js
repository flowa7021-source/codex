import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { OutlineEditor } from '../../app/modules/outline-editor.js';

// Note: readOutline, writeOutline, autoGenerateOutline require real pdf-lib/pdfjs.
// We test the OutlineEditor UI class here.

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
});
