import { describe, it, beforeEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Patch DOM mock ────────────────────────────────────────────────────────────
// Ensure elements have getBoundingClientRect and other helpers.
const _origCreateElement = document.createElement.bind(document);
document.createElement = function (tag) {
  const el = _origCreateElement(tag);
  if (!el.focus) el.focus = () => {};
  if (!el.select) el.select = () => {};
  if (!el.getBoundingClientRect) {
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  }
  // Canvas toBlob must return a Blob with arrayBuffer()
  if (tag === 'canvas') {
    el.toBlob = (cb) => cb({ arrayBuffer: async () => new ArrayBuffer(4) });
  }
  return el;
};

// Ensure Blob has arrayBuffer for pdf operations
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function () { return new ArrayBuffer(0); };
}

import { SignaturePad, insertSignatureIntoPdf } from '../../app/modules/signature-pad.js';
import { PDFDocument } from 'pdf-lib';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeMinimalPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc.save();
}

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

// ── insertSignatureIntoPdf ────────────────────────────────────────────────────

describe('insertSignatureIntoPdf', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await makeMinimalPdf();
  });

  it('is exported as a function', () => {
    assert.equal(typeof insertSignatureIntoPdf, 'function');
  });

  it('returns a Blob when given valid PDF and PNG bytes', async () => {
    // Minimal 1x1 white PNG
    const pngBytes = new Uint8Array([
      0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
      0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
      0x00,0x00,0x02,0x00,0x01,0xe2,0x21,0xbc,0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
      0x44,0xae,0x42,0x60,0x82,
    ]);
    const result = await insertSignatureIntoPdf(pdfBytes, 1, {
      pngBytes,
      position: { x: 10, y: 20 },
      width: 100,
    });
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
  });

  it('accepts ArrayBuffer instead of Uint8Array for pdfBytes', async () => {
    const pngBytes = new Uint8Array([
      0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
      0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
      0x00,0x00,0x02,0x00,0x01,0xe2,0x21,0xbc,0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
      0x44,0xae,0x42,0x60,0x82,
    ]);
    const abuf = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const result = await insertSignatureIntoPdf(abuf, 1, {
      pngBytes,
      position: { x: 0, y: 0 },
    });
    assert.ok(result instanceof Blob);
  });

  it('throws when page number exceeds document page count', async () => {
    const pngBytes = new Uint8Array([
      0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
      0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,0x54,0x08,0xd7,0x63,0xf8,0xcf,0xc0,0x00,
      0x00,0x00,0x02,0x00,0x01,0xe2,0x21,0xbc,0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
      0x44,0xae,0x42,0x60,0x82,
    ]);
    await assert.rejects(
      () => insertSignatureIntoPdf(pdfBytes, 99, { pngBytes, position: { x: 0, y: 0 } }),
      /Page 99 not found/,
    );
  });
});

// ── SignaturePad constructor ──────────────────────────────────────────────────

describe('SignaturePad constructor', () => {
  it('initialises with correct defaults', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    assert.equal(pad._panel, null);
    assert.equal(pad._canvas, null);
    assert.equal(pad._ctx, null);
    assert.equal(pad._drawing, false);
    assert.deepEqual(pad._points, []);
    assert.equal(pad._mode, 'draw');
    assert.equal(pad._imageData, null);
    assert.equal(pad._typedName, '');
  });

  it('stores container and deps references', () => {
    const container = makeContainer();
    const deps = makeDeps();
    const pad = new SignaturePad(container, deps);
    assert.equal(pad._container, container);
    assert.equal(pad._deps, deps);
  });

  it('binds event handler methods', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    assert.equal(typeof pad._onMouseDown, 'function');
    assert.equal(typeof pad._onMouseMove, 'function');
    assert.equal(typeof pad._onMouseUp, 'function');
  });
});

// ── SignaturePad.open ─────────────────────────────────────────────────────────

describe('SignaturePad.open', () => {
  let container, deps, pad;

  beforeEach(() => {
    container = makeContainer();
    deps = makeDeps();
    pad = new SignaturePad(container, deps);
  });

  it('creates a panel and appends to container', () => {
    pad.open();
    assert.ok(pad._panel);
    assert.ok(container.children.length > 0);
  });

  it('initialises canvas on open', () => {
    pad.open();
    assert.ok(pad._canvas);
    assert.equal(pad._canvas.tagName, 'CANVAS');
  });

  it('initialises canvas context', () => {
    pad.open();
    assert.ok(pad._ctx);
  });

  it('canvas dimensions are 460x180', () => {
    pad.open();
    assert.equal(pad._canvas.width, 460);
    assert.equal(pad._canvas.height, 180);
  });

  it('is idempotent — calling open twice does not create double panel', () => {
    pad.open();
    const firstPanel = pad._panel;
    pad.open();
    assert.equal(pad._panel, firstPanel);
    assert.equal(container.children.length, 1);
  });

  it('panel contains mode tab buttons for draw, type, image', () => {
    pad.open();
    assert.ok(pad._tabBtns['draw']);
    assert.ok(pad._tabBtns['type']);
    assert.ok(pad._tabBtns['image']);
  });

  it('creates typePreview canvas', () => {
    pad.open();
    assert.ok(pad._typePreview);
    assert.equal(pad._typePreview.tagName, 'CANVAS');
  });

  it('creates nameInput element', () => {
    pad.open();
    assert.ok(pad._nameInput);
  });

  it('creates imagePreview canvas', () => {
    pad.open();
    assert.ok(pad._imagePreview);
    assert.equal(pad._imagePreview.tagName, 'CANVAS');
  });

  it('draw area is visible by default', () => {
    pad.open();
    assert.notEqual(pad._drawArea.style.display, 'none');
  });

  it('type area is hidden by default', () => {
    pad.open();
    assert.equal(pad._typeArea.style.display, 'none');
  });

  it('image area is hidden by default', () => {
    pad.open();
    assert.equal(pad._imageArea.style.display, 'none');
  });
});

// ── SignaturePad.close ────────────────────────────────────────────────────────

describe('SignaturePad.close', () => {
  it('removes panel from container', () => {
    const container = makeContainer();
    const pad = new SignaturePad(container, makeDeps());
    pad.open();
    assert.equal(container.children.length, 1);
    pad.close();
    assert.equal(container.children.length, 0);
    assert.equal(pad._panel, null);
  });

  it('is safe to call when not open', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    assert.doesNotThrow(() => pad.close());
  });

  it('is safe to call multiple times', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad.close();
    assert.doesNotThrow(() => pad.close());
  });
});

// ── SignaturePad._switchMode ──────────────────────────────────────────────────

describe('SignaturePad._switchMode', () => {
  let pad;

  beforeEach(() => {
    pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
  });

  it('switches to type mode — shows typeArea, hides drawArea and imageArea', () => {
    pad._switchMode('type');
    assert.equal(pad._mode, 'type');
    assert.equal(pad._drawArea.style.display, 'none');
    assert.equal(pad._typeArea.style.display, 'block');
    assert.equal(pad._imageArea.style.display, 'none');
  });

  it('switches to image mode — shows imageArea, hides others', () => {
    pad._switchMode('image');
    assert.equal(pad._mode, 'image');
    assert.equal(pad._drawArea.style.display, 'none');
    assert.equal(pad._typeArea.style.display, 'none');
    assert.equal(pad._imageArea.style.display, 'block');
  });

  it('switches back to draw mode', () => {
    pad._switchMode('type');
    pad._switchMode('draw');
    assert.equal(pad._mode, 'draw');
    assert.equal(pad._drawArea.style.display, 'block');
    assert.equal(pad._typeArea.style.display, 'none');
  });

  it('renders typed preview if switching to type with existing name', () => {
    pad._typedName = 'Alice';
    assert.doesNotThrow(() => pad._switchMode('type'));
  });

  it('does not render typed preview if name is empty', () => {
    pad._typedName = '';
    assert.doesNotThrow(() => pad._switchMode('type'));
  });

  it('updates tab button styles — active tab gets highlight color', () => {
    pad._switchMode('type');
    assert.ok(pad._tabBtns['type'].style.cssText.includes('#0078d4'));
    assert.ok(!pad._tabBtns['draw'].style.cssText.includes('#0078d4'));
    assert.ok(!pad._tabBtns['image'].style.cssText.includes('#0078d4'));
  });
});

// ── SignaturePad._tabStyle ────────────────────────────────────────────────────

describe('SignaturePad._tabStyle', () => {
  it('returns string with active highlight color when active=true', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    const style = pad._tabStyle(true);
    assert.ok(typeof style === 'string');
    assert.ok(style.includes('#0078d4'));
    assert.ok(style.includes('#fff'));
  });

  it('returns string with transparent background when active=false', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    const style = pad._tabStyle(false);
    assert.ok(typeof style === 'string');
    assert.ok(style.includes('transparent'));
    assert.ok(style.includes('#aaa'));
  });
});

// ── SignaturePad draw events ──────────────────────────────────────────────────

describe('SignaturePad draw mode events', () => {
  let pad;

  beforeEach(() => {
    pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
  });

  it('_onMouseDown starts drawing and records first point', () => {
    pad._onMouseDown({ offsetX: 10, offsetY: 20 });
    assert.equal(pad._drawing, true);
    assert.deepEqual(pad._points, [{ x: 10, y: 20 }]);
  });

  it('_onMouseDown resets points', () => {
    pad._points = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    pad._onMouseDown({ offsetX: 5, offsetY: 6 });
    assert.deepEqual(pad._points, [{ x: 5, y: 6 }]);
  });

  it('_onMouseMove does nothing when not drawing', () => {
    pad._drawing = false;
    pad._points = [];
    pad._onMouseMove({ offsetX: 5, offsetY: 5 });
    assert.deepEqual(pad._points, []);
  });

  it('_onMouseMove appends point when drawing', () => {
    pad._onMouseDown({ offsetX: 0, offsetY: 0 });
    pad._onMouseMove({ offsetX: 10, offsetY: 15 });
    assert.equal(pad._points.length, 2);
    assert.deepEqual(pad._points[1], { x: 10, y: 15 });
  });

  it('_onMouseMove appends multiple points', () => {
    pad._onMouseDown({ offsetX: 0, offsetY: 0 });
    pad._onMouseMove({ offsetX: 5, offsetY: 5 });
    pad._onMouseMove({ offsetX: 10, offsetY: 10 });
    pad._onMouseMove({ offsetX: 15, offsetY: 15 });
    assert.equal(pad._points.length, 4);
  });

  it('_onMouseUp stops drawing', () => {
    pad._onMouseDown({ offsetX: 10, offsetY: 20 });
    assert.equal(pad._drawing, true);
    pad._onMouseUp();
    assert.equal(pad._drawing, false);
  });

  it('_onMouseUp is safe when not drawing', () => {
    pad._drawing = false;
    assert.doesNotThrow(() => pad._onMouseUp());
  });
});

// ── SignaturePad._clear ───────────────────────────────────────────────────────

describe('SignaturePad._clear', () => {
  it('clears draw points in draw mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._points = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    pad._clear();
    assert.deepEqual(pad._points, []);
  });

  it('clears typed name in type mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._switchMode('type');
    pad._typedName = 'John Doe';
    pad._nameInput.value = 'John Doe';
    pad._clear();
    assert.equal(pad._typedName, '');
    assert.equal(pad._nameInput.value, '');
  });

  it('clears image data in image mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._switchMode('image');
    pad._imageData = new Uint8Array([1, 2, 3]);
    pad._clear();
    assert.equal(pad._imageData, null);
  });

  it('does not throw in draw mode without canvas context', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad._mode = 'draw';
    pad._ctx = null;
    pad._points = [{ x: 1, y: 2 }];
    // Should not throw even without ctx
    assert.doesNotThrow(() => pad._clear());
  });

  it('no-ops for type mode nameInput when nameInput is missing', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._switchMode('type');
    pad._nameInput = null;
    pad._typedName = 'Test';
    assert.doesNotThrow(() => pad._clear());
    assert.equal(pad._typedName, '');
  });
});

// ── SignaturePad._renderTypedPreview ─────────────────────────────────────────

describe('SignaturePad._renderTypedPreview', () => {
  it('does not throw when typedName is empty', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._typedName = '';
    assert.doesNotThrow(() => pad._renderTypedPreview());
  });

  it('does not throw when typedName is set', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._typedName = 'Alice';
    assert.doesNotThrow(() => pad._renderTypedPreview());
  });

  it('does nothing when typePreview context is null', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    // Override getContext to return null
    pad._typePreview.getContext = () => null;
    pad._typedName = 'test';
    assert.doesNotThrow(() => pad._renderTypedPreview());
  });
});

// ── SignaturePad._renderImagePreview ─────────────────────────────────────────

describe('SignaturePad._renderImagePreview', () => {
  it('does nothing when imageData is null', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._imageData = null;
    assert.doesNotThrow(() => pad._renderImagePreview());
  });

  it('creates an image and sets src when imageData is provided', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._imageData = new Uint8Array([1, 2, 3, 4]);
    assert.doesNotThrow(() => pad._renderImagePreview());
  });

  it('does nothing when imagePreview context is null', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._imagePreview.getContext = () => null;
    pad._imageData = new Uint8Array([1, 2, 3]);
    assert.doesNotThrow(() => pad._renderImagePreview());
  });
});

// ── SignaturePad._handleInsert ────────────────────────────────────────────────

describe('SignaturePad._handleInsert', () => {
  it('calls onInsert in draw mode with pngBytes, position, and width', async () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    await pad._handleInsert();
    assert.equal(deps.onInsert.mock.calls.length, 1);
    const [signatureData] = deps.onInsert.mock.calls[0].arguments;
    assert.ok(signatureData.pngBytes instanceof Uint8Array);
    assert.deepEqual(signatureData.position, { x: 72, y: 72 });
    assert.equal(signatureData.width, 150);
  });

  it('calls onInsert in type mode', async () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    pad._switchMode('type');
    pad._typedName = 'Signature';
    await pad._handleInsert();
    assert.equal(deps.onInsert.mock.calls.length, 1);
  });

  it('calls onInsert in image mode', async () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    pad._switchMode('image');
    await pad._handleInsert();
    assert.equal(deps.onInsert.mock.calls.length, 1);
  });

  it('uses custom defaultPosition from deps', async () => {
    const deps = makeDeps({ defaultPosition: { x: 100, y: 200 } });
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    await pad._handleInsert();
    const [signatureData] = deps.onInsert.mock.calls[0].arguments;
    assert.deepEqual(signatureData.position, { x: 100, y: 200 });
  });

  it('uses default position {x:72,y:72} when deps.defaultPosition is undefined', async () => {
    const deps = { onInsert: mock.fn() };
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    await pad._handleInsert();
    const [signatureData] = deps.onInsert.mock.calls[0].arguments;
    assert.deepEqual(signatureData.position, { x: 72, y: 72 });
  });

  it('uses custom defaultWidth from deps', async () => {
    const deps = makeDeps({ defaultWidth: 300 });
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    await pad._handleInsert();
    const [signatureData] = deps.onInsert.mock.calls[0].arguments;
    assert.equal(signatureData.width, 300);
  });

  it('uses default width 150 when deps.defaultWidth is undefined', async () => {
    const deps = { onInsert: mock.fn() };
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    await pad._handleInsert();
    const [signatureData] = deps.onInsert.mock.calls[0].arguments;
    assert.equal(signatureData.width, 150);
  });

  it('closes panel after inserting', async () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    assert.ok(pad._panel);
    await pad._handleInsert();
    assert.equal(pad._panel, null);
  });

  it('does nothing if no sourceCanvas (should not happen but no crash)', async () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    // Force a mode that has no canvas
    pad._mode = 'unknown';
    // Should not throw, just return early
    await assert.doesNotReject(() => pad._handleInsert());
  });
});

// ── Cancel button ─────────────────────────────────────────────────────────────

describe('SignaturePad Cancel button', () => {
  it('calls onCancel when cancel button is clicked', () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    const buttons = pad._panel.querySelectorAll('button');
    const cancelBtn = buttons.find(b => b.textContent === 'Cancel');
    assert.ok(cancelBtn, 'Cancel button must exist');
    cancelBtn.click();
    assert.equal(deps.onCancel.mock.calls.length, 1);
  });

  it('closes panel when cancel is clicked', () => {
    const deps = makeDeps();
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    const buttons = pad._panel.querySelectorAll('button');
    const cancelBtn = buttons.find(b => b.textContent === 'Cancel');
    cancelBtn.click();
    assert.equal(pad._panel, null);
  });

  it('does not throw when onCancel is not provided', () => {
    const deps = { onInsert: mock.fn() };
    const pad = new SignaturePad(makeContainer(), deps);
    pad.open();
    const buttons = pad._panel.querySelectorAll('button');
    const cancelBtn = buttons.find(b => b.textContent === 'Cancel');
    assert.doesNotThrow(() => cancelBtn.click());
  });
});

// ── Clear button ──────────────────────────────────────────────────────────────

describe('SignaturePad Clear button', () => {
  it('clears draw points in draw mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._points = [{ x: 1, y: 1 }];
    const buttons = pad._panel.querySelectorAll('button');
    const clearBtn = buttons.find(b => b.textContent === 'Clear');
    assert.ok(clearBtn);
    clearBtn.click();
    assert.deepEqual(pad._points, []);
  });
});

// ── Tab click handlers ────────────────────────────────────────────────────────

describe('SignaturePad tab click handlers', () => {
  it('clicking type tab switches to type mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._tabBtns['type'].click();
    assert.equal(pad._mode, 'type');
  });

  it('clicking image tab switches to image mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._tabBtns['image'].click();
    assert.equal(pad._mode, 'image');
  });

  it('clicking draw tab returns to draw mode', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    pad._tabBtns['type'].click();
    pad._tabBtns['draw'].click();
    assert.equal(pad._mode, 'draw');
  });
});

// ── _destroyDrawListeners ─────────────────────────────────────────────────────

describe('SignaturePad._destroyDrawListeners', () => {
  it('is safe when canvas is null', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    assert.doesNotThrow(() => pad._destroyDrawListeners());
  });

  it('removes listeners without error when pad is open', () => {
    const pad = new SignaturePad(makeContainer(), makeDeps());
    pad.open();
    assert.doesNotThrow(() => pad._destroyDrawListeners());
  });
});
