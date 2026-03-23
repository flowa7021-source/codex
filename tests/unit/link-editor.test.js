import './setup-dom.js';

// Patch DOM mock: add setLineDash to canvas context
const _origCreateElement = document.createElement;
document.createElement = function(tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  const _origGetContext = el.getContext;
  el.getContext = function(...args) {
    const ctx = _origGetContext.call(el, ...args);
    if (ctx && !ctx.setLineDash) ctx.setLineDash = () => {};
    return ctx;
  };
  return el;
};

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { LinkEditor } from '../../app/modules/link-editor.js';

// Note: addLink, removeLink, removeAllLinks, getPageLinks require real pdf-lib/pdfjs
// and are integration-level. We test the LinkEditor UI class here.

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  return document.createElement('div');
}

function makeDeps(overrides = {}) {
  return {
    getPdfBytes: mock.fn(() => new Uint8Array(0)),
    getPageNum: mock.fn(() => 1),
    onApply: mock.fn(),
    pageWidthPt: 595,
    pageHeightPt: 842,
    zoom: 1,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LinkEditor', () => {
  let container, deps;

  beforeEach(() => {
    container = makeContainer();
    deps = makeDeps();
  });

  it('constructor sets initial state', () => {
    const editor = new LinkEditor(container, deps);
    assert.equal(editor._panel, null);
    assert.deepEqual(editor._links, []);
    assert.equal(editor._overlay, null);
  });

  it('close removes panel when present', () => {
    const editor = new LinkEditor(container, deps);
    // Simulate an open panel
    editor._panel = document.createElement('div');
    container.appendChild(editor._panel);
    editor.close();
    assert.equal(editor._panel, null);
  });

  it('close removes overlay when present', () => {
    const editor = new LinkEditor(container, deps);
    editor._overlay = document.createElement('canvas');
    container.appendChild(editor._overlay);
    editor.close();
    assert.equal(editor._overlay, null);
  });

  it('close is safe to call when already closed', () => {
    const editor = new LinkEditor(container, deps);
    assert.doesNotThrow(() => editor.close());
  });

  it('_buildOverlay skips when no links exist', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [];
    editor._buildOverlay();
    assert.equal(editor._overlay, null);
  });

  it('_buildOverlay creates canvas with correct dimensions', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [{ rect: { x: 10, y: 20, width: 100, height: 14 }, url: 'https://example.com', index: 0 }];
    editor._buildOverlay();

    assert.ok(editor._overlay);
    assert.equal(editor._overlay.width, 595);
    assert.equal(editor._overlay.height, 842);
  });

  it('_buildOverlay respects zoom', () => {
    deps.zoom = 2;
    const editor = new LinkEditor(container, deps);
    editor._links = [{ rect: { x: 10, y: 20, width: 100, height: 14 }, url: 'https://test.com', index: 0 }];
    editor._buildOverlay();

    assert.equal(editor._overlay.width, 1190);
    assert.equal(editor._overlay.height, 1684);
  });

  it('_buildPanel creates panel with links', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [
      { rect: { x: 0, y: 0, width: 50, height: 10 }, url: 'https://a.com', index: 0 },
      { rect: { x: 0, y: 0, width: 50, height: 10 }, destPage: 3, index: 1 },
    ];
    editor._buildPanel();

    assert.ok(editor._panel);
    // Panel should be appended to container
    assert.ok(container.children.length > 0);
  });

  it('_buildPanel shows empty message when no links', () => {
    const editor = new LinkEditor(container, deps);
    editor._links = [];
    editor._buildPanel();

    assert.ok(editor._panel);
  });
});
