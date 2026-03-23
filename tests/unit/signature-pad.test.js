import './setup-dom.js';

// Patch DOM mock with missing methods
const _origCreateElement = document.createElement;
document.createElement = function(tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  if (!el.select) el.select = () => {};
  if (!el.getBoundingClientRect) el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  return el;
};

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { SignaturePad } from '../../app/modules/signature-pad.js';

// Note: insertSignatureIntoPdf requires real pdf-lib with valid PDF bytes.
// We test the SignaturePad UI class here.

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  return document.createElement('div');
}

function makeDeps(overrides = {}) {
  return {
    onInsert: mock.fn(),
    onCancel: mock.fn(),
    defaultPosition: { x: 72, y: 72 },
    defaultWidth: 150,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SignaturePad', () => {
  let container, deps;

  beforeEach(() => {
    container = makeContainer();
    deps = makeDeps();
  });

  it('constructor initialises with correct defaults', () => {
    const pad = new SignaturePad(container, deps);
    assert.equal(pad._panel, null);
    assert.equal(pad._canvas, null);
    assert.equal(pad._drawing, false);
    assert.equal(pad._mode, 'draw');
    assert.equal(pad._imageData, null);
    assert.equal(pad._typedName, '');
  });

  it('open creates panel and appends to container', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();

    assert.ok(pad._panel);
    assert.ok(container.children.length > 0);
  });

  it('open is idempotent (does not double-open)', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    const firstPanel = pad._panel;
    pad.open();
    assert.equal(pad._panel, firstPanel);
  });

  it('close removes panel', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    pad.close();

    assert.equal(pad._panel, null);
  });

  it('close is safe when not open', () => {
    const pad = new SignaturePad(container, deps);
    assert.doesNotThrow(() => pad.close());
  });

  it('_switchMode changes mode and shows correct area', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();

    pad._switchMode('type');
    assert.equal(pad._mode, 'type');
    assert.equal(pad._drawArea.style.display, 'none');
    assert.equal(pad._typeArea.style.display, 'block');

    pad._switchMode('image');
    assert.equal(pad._mode, 'image');
    assert.equal(pad._typeArea.style.display, 'none');
    assert.equal(pad._imageArea.style.display, 'block');

    pad._switchMode('draw');
    assert.equal(pad._mode, 'draw');
    assert.equal(pad._drawArea.style.display, 'block');
  });

  it('_clear resets draw points', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    pad._points = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    pad._clear();
    assert.deepEqual(pad._points, []);
  });

  it('_clear resets typed name in type mode', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    pad._switchMode('type');
    pad._typedName = 'John Doe';
    pad._clear();
    assert.equal(pad._typedName, '');
  });

  it('_clear resets image data in image mode', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    pad._switchMode('image');
    pad._imageData = new Uint8Array([1, 2, 3]);
    pad._clear();
    assert.equal(pad._imageData, null);
  });

  it('_onMouseDown sets drawing state', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    pad._onMouseDown({ offsetX: 10, offsetY: 20 });

    assert.equal(pad._drawing, true);
    assert.deepEqual(pad._points, [{ x: 10, y: 20 }]);
  });

  it('_onMouseUp stops drawing', () => {
    const pad = new SignaturePad(container, deps);
    pad.open();
    pad._onMouseDown({ offsetX: 10, offsetY: 20 });
    pad._onMouseUp();

    assert.equal(pad._drawing, false);
  });
});
