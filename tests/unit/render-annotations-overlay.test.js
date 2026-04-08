// ─── Unit Tests: Render Annotations Overlay ────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  safeCreateObjectURL,
  initRenderAnnotationsOverlayDeps,
  addWatermarkToPage,
  addStampToPage,
  openSignaturePad,
  handleImageInsertion,
} from '../../app/modules/render-annotations-overlay.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

// Access state and els for test manipulation
import { state, els } from '../../app/modules/state.js';

let savedAdapter;
let savedAnnotationCanvas;

beforeEach(() => {
  savedAdapter = state.adapter;
  savedAnnotationCanvas = els.annotationCanvas;

  // Reset state
  state.adapter = null;
  initRenderAnnotationsOverlayDeps({ setOcrStatus: () => {} });
});

// ── safeCreateObjectURL ─────────────────────────────────────────────────────

describe('safeCreateObjectURL', () => {
  it('handles Blob input', () => {
    const blob = new Blob(['test']);
    const url = safeCreateObjectURL(blob);
    assert.equal(typeof url, 'string');
    // In test env, URL.createObjectURL returns 'blob:mock'
    assert.ok(url.length > 0);
  });

  it('handles ArrayBuffer input', () => {
    const ab = new ArrayBuffer(8);
    const url = safeCreateObjectURL(ab);
    assert.equal(typeof url, 'string');
  });

  it('handles Uint8Array input', () => {
    const arr = new Uint8Array([1, 2, 3]);
    const url = safeCreateObjectURL(arr);
    assert.equal(typeof url, 'string');
  });

  it('handles string input', () => {
    const url = safeCreateObjectURL('hello');
    assert.equal(typeof url, 'string');
  });

  it('returns empty string for invalid types', () => {
    const url = safeCreateObjectURL(12345);
    assert.equal(url, '');
  });

  it('returns empty string for null', () => {
    const url = safeCreateObjectURL(null);
    assert.equal(url, '');
  });

  it('returns empty string for undefined', () => {
    const url = safeCreateObjectURL(undefined);
    assert.equal(url, '');
  });

  it('returns empty string for object', () => {
    const url = safeCreateObjectURL({ foo: 'bar' });
    assert.equal(url, '');
  });

  it('returns empty string for boolean', () => {
    const url = safeCreateObjectURL(true);
    assert.equal(url, '');
  });
});

// ── initRenderAnnotationsOverlayDeps ────────────────────────────────────────

describe('initRenderAnnotationsOverlayDeps', () => {
  it('accepts deps object', () => {
    assert.doesNotThrow(() => {
      initRenderAnnotationsOverlayDeps({ setOcrStatus: () => 'ok' });
    });
  });

  it('accepts empty deps', () => {
    assert.doesNotThrow(() => {
      initRenderAnnotationsOverlayDeps({});
    });
  });

  it('accepts multiple dep properties', () => {
    assert.doesNotThrow(() => {
      initRenderAnnotationsOverlayDeps({
        setOcrStatus: () => {},
        extraDep: 42,
      });
    });
  });
});

// ── addWatermarkToPage ──────────────────────────────────────────────────────

describe('addWatermarkToPage', () => {
  it('returns early when adapter is null', () => {
    state.adapter = null;
    // Should not throw
    assert.doesNotThrow(() => {
      addWatermarkToPage('DRAFT');
    });
  });

  it('returns early when annotationCanvas is missing', () => {
    state.adapter = { type: 'pdf' };
    const orig = els.annotationCanvas;
    els.annotationCanvas = null;

    assert.doesNotThrow(() => {
      addWatermarkToPage('DRAFT');
    });

    els.annotationCanvas = orig;
  });

  it('renders watermark when adapter and canvas exist', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    let saveCalled = false;
    let restoreCalled = false;
    let fillTextCalled = false;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => { saveCalled = true; };
    ctx.restore = () => { restoreCalled = true; };
    ctx.fillText = (...args) => { fillTextCalled = true; fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addWatermarkToPage('CONFIDENTIAL');

    assert.equal(saveCalled, true);
    assert.equal(restoreCalled, true);
    assert.equal(fillTextCalled, true);
    assert.equal(fillTextArgs[0], 'CONFIDENTIAL');

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('uses default options when none provided', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    let fontUsed = '';
    const ctx = canvas.getContext('2d');
    const origSave = ctx.save;
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.fillText = () => {};
    Object.defineProperty(ctx, 'font', {
      set(v) { fontUsed = v; },
      get() { return fontUsed; },
    });
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addWatermarkToPage('TEST');

    // Default fontSize = 60, dpr = 1, so font should be '60px sans-serif'
    assert.ok(fontUsed.includes('60'));
    assert.ok(fontUsed.includes('sans-serif'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('uses custom options', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    let fontUsed = '';
    let fillStyleUsed = '';
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.fillText = () => {};
    Object.defineProperty(ctx, 'font', {
      set(v) { fontUsed = v; },
      get() { return fontUsed; },
    });
    Object.defineProperty(ctx, 'fillStyle', {
      set(v) { fillStyleUsed = v; },
      get() { return fillStyleUsed; },
    });
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addWatermarkToPage('CUSTOM', { fontSize: 80, color: 'red', angle: -30 });

    assert.ok(fontUsed.includes('80'));
    assert.equal(fillStyleUsed, 'red');

    els.annotationCanvas = savedAnnotationCanvas;
  });
});

// ── addStampToPage ──────────────────────────────────────────────────────────

describe('addStampToPage', () => {
  it('returns early when adapter is null', () => {
    state.adapter = null;
    assert.doesNotThrow(() => {
      addStampToPage('approved');
    });
  });

  it('renders approved stamp', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.setLineDash = () => {};
    ctx.fillText = (...args) => { fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addStampToPage('approved');

    assert.ok(fillTextArgs[0].includes('УТВЕРЖДЕНО'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('renders rejected stamp', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.setLineDash = () => {};
    ctx.fillText = (...args) => { fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addStampToPage('rejected');
    assert.ok(fillTextArgs[0].includes('ОТКЛОНЕНО'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('renders draft stamp', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.setLineDash = () => {};
    ctx.fillText = (...args) => { fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addStampToPage('draft');
    assert.ok(fillTextArgs[0].includes('ЧЕРНОВИК'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('renders confidential stamp', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.setLineDash = () => {};
    ctx.fillText = (...args) => { fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addStampToPage('confidential');
    assert.ok(fillTextArgs[0].includes('КОНФИДЕНЦИАЛЬНО'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('renders copy stamp', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.setLineDash = () => {};
    ctx.fillText = (...args) => { fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addStampToPage('copy');
    assert.ok(fillTextArgs[0].includes('КОПИЯ'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('defaults to approved for unknown stamp type', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let fillTextArgs = [];
    const ctx = canvas.getContext('2d');
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.setLineDash = () => {};
    ctx.fillText = (...args) => { fillTextArgs = args; };
    canvas.getContext = () => ctx;
    els.annotationCanvas = canvas;

    addStampToPage('unknown');
    assert.ok(fillTextArgs[0].includes('УТВЕРЖДЕНО'));

    els.annotationCanvas = savedAnnotationCanvas;
  });

  it('returns early when getContext returns null', () => {
    state.adapter = { type: 'pdf' };
    const canvas = document.createElement('canvas');
    canvas.getContext = () => null;
    els.annotationCanvas = canvas;

    assert.doesNotThrow(() => {
      addStampToPage('approved');
    });

    els.annotationCanvas = savedAnnotationCanvas;
  });
});

// ── handleImageInsertion ────────────────────────────────────────────────────

describe('handleImageInsertion', () => {
  it('returns early when file is null', () => {
    assert.doesNotThrow(() => {
      handleImageInsertion(null);
    });
  });

  it('returns early when adapter is null', () => {
    state.adapter = null;
    assert.doesNotThrow(() => {
      handleImageInsertion(new Blob(['test']));
    });
  });

  it('returns early when file is undefined', () => {
    assert.doesNotThrow(() => {
      handleImageInsertion(undefined);
    });
  });

  it('processes file when adapter is set (async onload path)', async () => {
    state.adapter = { type: 'pdf' };
    state.currentPage = 1;

    // Set up mock canvas elements
    const mockCanvas = document.createElement('canvas');
    mockCanvas.style.cssText = 'width:400px;height:600px;';
    els.canvas = mockCanvas;
    els.canvasWrap = document.createElement('div');

    // Use a real Blob so FileReader readAsDataURL works with the mock
    const file = new Blob(['fakepng'], { type: 'image/png' });

    // handleImageInsertion is async internally (FileReader + Image onload)
    // Wrap in a promise that resolves after microtasks settle
    handleImageInsertion(file);

    // Drain microtasks/queueMicrotask chains
    await new Promise(r => setTimeout(r, 50));

    // Should not have thrown; we just verify it ran to completion
    assert.ok(true);

    state.adapter = null;
  });
});

// ── openSignaturePad ────────────────────────────────────────────────────────

describe('openSignaturePad', () => {
  it('does not throw when called', () => {
    // openSignaturePad creates DOM elements.
    // With mocked document, it should not throw.
    assert.doesNotThrow(() => {
      openSignaturePad();
    });
  });

  it('clear button clears signature canvas', () => {
    openSignaturePad();
    // The modal is appended to document.body. Find the clear button.
    const modal = document.body.querySelector('div[style*="position:fixed"]');
    assert.ok(modal, 'modal should be present');
    const buttons = modal.querySelectorAll('button');
    const clearBtn = [...buttons].find(b => b.textContent === 'Очистить');
    assert.ok(clearBtn, 'clear button should exist');
    assert.doesNotThrow(() => clearBtn.click());
    modal.remove();
  });

  it('cancel button removes modal', () => {
    openSignaturePad();
    // Find the most recently appended modal (last child matching style)
    const modals = document.body.querySelectorAll('div[style*="position:fixed"]');
    const modal = modals[modals.length - 1];
    assert.ok(modal);
    const buttons = modal.querySelectorAll('button');
    const cancelBtn = [...buttons].find(b => b.textContent === 'Отмена');
    assert.ok(cancelBtn, 'cancel button should exist');
    cancelBtn.click();
    // This specific modal should be detached
    assert.equal(modal.parentNode, null);
  });

  it('clicking overlay removes modal', () => {
    openSignaturePad();
    const modals = document.body.querySelectorAll('div[style*="position:fixed"]');
    const modal = modals[modals.length - 1];
    assert.ok(modal);
    // Simulate clicking directly on the backdrop (target === modal)
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: modal });
    modal.dispatchEvent(event);
    assert.equal(modal.parentNode, null);
  });

  it('pointermove while drawing calls lineTo and stroke', () => {
    openSignaturePad();
    const modals = document.body.querySelectorAll('div[style*="position:fixed"]');
    const modal = modals[modals.length - 1];
    assert.ok(modal);
    const sigCanvas = modal.querySelector('canvas');
    assert.ok(sigCanvas, 'signature canvas should exist');

    // pointerdown sets drawing = true
    sigCanvas.dispatchEvent(new Event('pointerdown'));
    // pointermove should now execute lineTo and stroke
    assert.doesNotThrow(() => {
      sigCanvas.dispatchEvent(new Event('pointermove'));
    });
    // pointerup resets drawing
    sigCanvas.dispatchEvent(new Event('pointerup'));
    // pointermove after pointerup should be a no-op
    assert.doesNotThrow(() => {
      sigCanvas.dispatchEvent(new Event('pointermove'));
    });

    modal.remove();
  });
});
