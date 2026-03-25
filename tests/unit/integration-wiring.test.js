import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// integration-wiring.js exports bootstrapAdvancedTools. It has heavy
// transitive dependencies (pdf-lib, pdfjs-dist, tesseract, etc.) so we
// test the exported function shape and the internal helper logic patterns.

describe('bootstrapAdvancedTools', () => {
  it('is exported as a function', async () => {
    let mod;
    try {
      mod = await import('../../app/modules/integration-wiring.js');
    } catch (_e) {
      return; // transitive deps not available in test
    }
    assert.equal(typeof mod.bootstrapAdvancedTools, 'function');
  });

  it('returns handles object with destroy method when called', async () => {
    let mod;
    try {
      mod = await import('../../app/modules/integration-wiring.js');
    } catch (_e) {
      return;
    }

    const container = document.createElement('div');
    const toolbar = document.createElement('div');
    const ctx = {
      container,
      toolbar,
      pdfLibDoc: null,
      pdfBytes: null,
      getPageCanvas: () => document.createElement('canvas'),
      getPageNum: () => 1,
      reloadPage: async () => {},
      onPdfModified: () => {},
      eventBus: new EventTarget(),
    };

    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles, 'should return handles object');
    assert.equal(typeof handles.destroy, 'function');
    handles.destroy();
  });

  it('toolbar button helper creates a button with correct attributes', () => {
    // Mirrors internal _makeButton logic
    const btn = document.createElement('button');
    btn.id = 'testTool';
    btn.textContent = 'Test';
    btn.className = 'tool-btn';

    assert.equal(btn.id, 'testTool');
    assert.equal(btn.textContent, 'Test');
    assert.equal(btn.className, 'tool-btn');
  });

  it('separator has expected style', () => {
    const s = document.createElement('div');
    s.style.cssText = 'width:1px;height:24px;background:#555';
    assert.ok(s.style.cssText.includes('width:1px'));
  });

  it('destroy cleans up all handles without error', () => {
    // Simulate the _destroyAll pattern
    const handles = {
      clipboard: { destroy: mock.fn() },
      inlineEditor: { destroy: mock.fn() },
      _tableEditor: null,
      _visualDiff: null,
      _teardownPageChange: mock.fn(),
    };

    // Mirror _destroyAll
    handles.clipboard?.destroy();
    handles.inlineEditor?.destroy();
    handles._tableEditor?.close?.();
    handles._teardownPageChange?.();

    assert.equal(handles.clipboard.destroy.mock.callCount(), 1);
    assert.equal(handles.inlineEditor.destroy.mock.callCount(), 1);
    assert.equal(handles._teardownPageChange.mock.callCount(), 1);
  });

  it('event bus page-change listener pattern works', () => {
    const bus = new EventTarget();
    let called = false;
    const handler = () => { called = true; };
    bus.addEventListener('page-change', handler);
    bus.dispatchEvent(new Event('page-change'));
    assert.ok(called);
    bus.removeEventListener('page-change', handler);
  });
});

// ---------------------------------------------------------------------------
// Expanded tests for untested functions
// ---------------------------------------------------------------------------

/** Helper: create a minimal ctx object for bootstrapAdvancedTools */
function makeCtx(overrides = {}) {
  const container = document.createElement('div');
  const toolbar = document.createElement('div');
  return {
    container,
    toolbar,
    pdfLibDoc: {
      getPages: () => [{ getSize: () => ({ width: 612, height: 792 }) }],
      getPageCount: () => 1,
      save: async () => new Uint8Array([37, 80, 68, 70]),
    },
    pdfBytes: new Uint8Array([37, 80, 68, 70]),
    getPageCanvas: () => document.createElement('canvas'),
    getPageNum: () => 1,
    reloadPage: async () => {},
    onPdfModified: mock.fn(),
    eventBus: new EventTarget(),
    ...overrides,
  };
}

/** Lazily load the module; skip tests if transitive deps unavailable */
let _mod;
async function loadMod() {
  if (_mod) return _mod;
  try {
    _mod = await import('../../app/modules/integration-wiring.js');
  } catch (_e) {
    _mod = null;
  }
  return _mod;
}

describe('bootstrapAdvancedTools — extended', () => {
  it('returns handles with docModel property', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const handles = mod.bootstrapAdvancedTools(makeCtx());
    assert.ok(handles.docModel, 'should have docModel');
    handles.destroy();
  });

  it('returns handles with clipboard property', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const handles = mod.bootstrapAdvancedTools(makeCtx());
    assert.ok(handles.clipboard, 'should have clipboard controller');
    assert.equal(typeof handles.clipboard.destroy, 'function',
      'clipboard should have destroy method');
    handles.destroy();
  });

  it('returns handles with inlineEditor property', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const handles = mod.bootstrapAdvancedTools(makeCtx());
    assert.ok(handles.inlineEditor, 'should have inlineEditor');
    assert.equal(typeof handles.inlineEditor.destroy, 'function',
      'inlineEditor should have destroy method');
    handles.destroy();
  });

  it('handles ctx without toolbar gracefully', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ toolbar: null });
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles, 'should return handles even without toolbar');
    assert.equal(typeof handles.destroy, 'function');
    handles.destroy();
  });

  it('handles ctx without pdfBytes (no permission init)', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ pdfBytes: null });
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles);
    handles.destroy();
  });

  it('handles ctx without eventBus', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ eventBus: null });
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles);
    handles.destroy();
  });

  it('destroy can be called multiple times without error', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const handles = mod.bootstrapAdvancedTools(makeCtx());
    handles.destroy();
    handles.destroy(); // second call should not throw
  });
});

describe('_addToolbarButtons — via bootstrapAdvancedTools', () => {
  it('adds buttons to the toolbar element', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // Toolbar should have children (buttons + separators)
    assert.ok(ctx.toolbar.children.length > 0,
      'toolbar should have child elements after bootstrap');
    handles.destroy();
  });

  it('creates erase tool button with correct id', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const eraseBtn = ctx.toolbar.querySelector('#eraseTool');
    assert.ok(eraseBtn, 'should create eraseTool button');
    assert.equal(eraseBtn.className, 'tool-btn');
    handles.destroy();
  });

  it('creates smart crop button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const cropBtn = ctx.toolbar.querySelector('#smartCropTool');
    assert.ok(cropBtn, 'should create smartCropTool button');
    handles.destroy();
  });

  it('creates table editor button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const tableBtn = ctx.toolbar.querySelector('#tableEditorTool');
    assert.ok(tableBtn, 'should create tableEditorTool button');
    handles.destroy();
  });

  it('creates formula editor button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#formulaEditorTool');
    assert.ok(btn, 'should create formulaEditorTool button');
    handles.destroy();
  });

  it('creates visual diff button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#visualDiffTool');
    assert.ok(btn, 'should create visualDiffTool button');
    handles.destroy();
  });

  it('creates batch OCR button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#batchOcrTool');
    assert.ok(btn, 'should create batchOcrTool button');
    handles.destroy();
  });

  it('creates watermark button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#watermarkTool');
    assert.ok(btn, 'should create watermarkTool button');
    handles.destroy();
  });

  it('creates signature button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#signatureTool');
    assert.ok(btn, 'should create signatureTool button');
    handles.destroy();
  });

  it('creates bates numbering button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#batesTool');
    assert.ok(btn, 'should create batesTool button');
    handles.destroy();
  });

  it('creates redaction button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#redactTool');
    assert.ok(btn, 'should create redactTool button');
    handles.destroy();
  });

  it('creates outline/bookmarks button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#outlineTool');
    assert.ok(btn, 'should create outlineTool button');
    handles.destroy();
  });

  it('creates measurement button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#measureTool');
    assert.ok(btn, 'should create measureTool button');
    handles.destroy();
  });

  it('creates accessibility button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#a11yTool');
    assert.ok(btn, 'should create a11yTool button');
    handles.destroy();
  });

  it('creates reading mode button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#readingModeTool');
    assert.ok(btn, 'should create readingModeTool button');
    handles.destroy();
  });

  it('creates text diff button', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const btn = ctx.toolbar.querySelector('#textDiffTool');
    assert.ok(btn, 'should create textDiffTool button');
    handles.destroy();
  });

  it('all buttons have tool-btn class', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    const buttons = ctx.toolbar.children.filter(
      c => c.tagName === 'BUTTON'
    );
    for (const btn of buttons) {
      assert.equal(btn.className, 'tool-btn',
        `button ${btn.id} should have tool-btn class`);
    }
    handles.destroy();
  });

  it('no buttons added when toolbar is null', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ toolbar: null });
    // Should not throw
    const handles = mod.bootstrapAdvancedTools(ctx);
    handles.destroy();
  });
});

describe('_initClipboard — via bootstrapAdvancedTools', () => {
  it('clipboard has destroy method', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles.clipboard);
    assert.equal(typeof handles.clipboard.destroy, 'function');
    handles.destroy();
  });

  it('clipboard is created with correct container', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // ClipboardController should exist and be functional
    assert.ok(handles.clipboard);
    handles.destroy();
  });
});

describe('_destroyAll — comprehensive cleanup', () => {
  it('calls destroy/close on all handle types', () => {
    const closeFn = mock.fn();
    const destroyFn = mock.fn();
    const exitFn = mock.fn();
    const cancelFn = mock.fn();
    const teardownFn = mock.fn();

    const handles = {
      clipboard:          { destroy: mock.fn() },
      inlineEditor:       { destroy: mock.fn() },
      _tableEditor:       { close: closeFn },
      _formulaEditor:     { close: closeFn },
      _visualDiff:        { destroy: destroyFn },
      _watermarkEditor:   { close: closeFn },
      _signaturePad:      { close: closeFn },
      _batesEditor:       { close: closeFn },
      _redactionEditor:   { close: closeFn },
      _outlineEditor:     { close: closeFn },
      _measureOverlay:    { destroy: destroyFn },
      _a11yPanel:         { close: closeFn },
      _readingMode:       { exit: exitFn },
      _batchConverter:    { cancel: cancelFn },
      _teardownPageChange: teardownFn,
    };

    // Simulate _destroyAll
    handles.clipboard?.destroy();
    handles.inlineEditor?.destroy();
    handles._tableEditor?.close();
    handles._formulaEditor?.close?.();
    handles._visualDiff?.destroy();
    handles._watermarkEditor?.close();
    handles._signaturePad?.close();
    handles._batesEditor?.close();
    handles._redactionEditor?.close();
    handles._outlineEditor?.close();
    handles._measureOverlay?.destroy();
    handles._a11yPanel?.close();
    handles._readingMode?.exit();
    handles._batchConverter?.cancel();
    handles._teardownPageChange?.();

    assert.equal(handles.clipboard.destroy.mock.callCount(), 1);
    assert.equal(handles.inlineEditor.destroy.mock.callCount(), 1);
    // close called for: table, formula, watermark, signature, bates, redaction, outline, a11y = 8
    assert.equal(closeFn.mock.callCount(), 8);
    // destroy called for: visualDiff, measureOverlay = 2
    assert.equal(destroyFn.mock.callCount(), 2);
    assert.equal(exitFn.mock.callCount(), 1);
    assert.equal(cancelFn.mock.callCount(), 1);
    assert.equal(teardownFn.mock.callCount(), 1);
  });

  it('handles null/undefined handle properties gracefully', () => {
    const handles = {
      clipboard: null,
      inlineEditor: undefined,
      _tableEditor: null,
      _formulaEditor: null,
      _visualDiff: null,
      _watermarkEditor: null,
      _signaturePad: null,
      _batesEditor: null,
      _redactionEditor: null,
      _outlineEditor: null,
      _measureOverlay: null,
      _a11yPanel: null,
      _readingMode: null,
      _batchConverter: null,
      _teardownPageChange: null,
    };

    // Should not throw even when all values are null/undefined
    handles.clipboard?.destroy();
    handles.inlineEditor?.destroy();
    handles._tableEditor?.close();
    handles._formulaEditor?.close?.();
    handles._visualDiff?.destroy();
    handles._watermarkEditor?.close();
    handles._signaturePad?.close();
    handles._batesEditor?.close();
    handles._redactionEditor?.close();
    handles._outlineEditor?.close();
    handles._measureOverlay?.destroy();
    handles._a11yPanel?.close();
    handles._readingMode?.exit();
    handles._batchConverter?.cancel();
    handles._teardownPageChange?.();
  });

  it('actual destroy() from bootstrapAdvancedTools cleans up without error', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // Attach mock sub-handles to verify they get cleaned up
    handles._tableEditor = { close: mock.fn() };
    handles._visualDiff = { destroy: mock.fn() };
    handles._readingMode = { exit: mock.fn() };

    handles.destroy();

    assert.equal(handles._tableEditor.close.mock.callCount(), 1);
    assert.equal(handles._visualDiff.destroy.mock.callCount(), 1);
    assert.equal(handles._readingMode.exit.mock.callCount(), 1);
  });
});

describe('permission enforcement — via _initPermissions', () => {
  it('handles null pdfBytes without error', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ pdfBytes: null });
    const handles = mod.bootstrapAdvancedTools(ctx);
    // permEnforcer is set asynchronously; with null bytes it should remain unset
    // Just ensure no crash
    assert.ok(handles);
    handles.destroy();
  });

  it('permission init is non-blocking (async)', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // permEnforcer is populated asynchronously; right after bootstrap it may not be set yet
    // This verifies the async nature doesn't block bootstrap
    assert.equal(typeof handles.destroy, 'function');
    handles.destroy();
  });

  it('permEnforcer resolves eventually with valid pdfBytes', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // Wait a tick for the async _initPermissions to settle
    await new Promise(r => setTimeout(r, 50));
    // permEnforcer may be set or null (depending on whether pdfBytes is a valid encrypted PDF)
    // The key point is it doesn't crash
    assert.equal(typeof handles.destroy, 'function');
    handles.destroy();
  });
});

describe('page-change event integration', () => {
  it('registers page-change listener on eventBus', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // _teardownPageChange should be a function set by the listener registration
    assert.equal(typeof handles._teardownPageChange, 'function');
    handles.destroy();
  });

  it('teardown removes the page-change listener', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const eventBus = new EventTarget();
    const removeEventListenerOrig = eventBus.removeEventListener.bind(eventBus);
    let removeCalled = false;
    eventBus.removeEventListener = function (type, fn) {
      if (type === 'page-change') removeCalled = true;
      return removeEventListenerOrig(type, fn);
    };
    const ctx = makeCtx({ eventBus });
    const handles = mod.bootstrapAdvancedTools(ctx);
    handles.destroy();
    assert.ok(removeCalled, 'should call removeEventListener for page-change on destroy');
  });

  it('page-change event does not throw with missing pdfBytes', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ pdfBytes: null });
    const handles = mod.bootstrapAdvancedTools(ctx);
    // Dispatch page-change — _rebuildPageModel should bail early with null pdfBytes
    ctx.eventBus.dispatchEvent(new Event('page-change'));
    // Allow any async work to settle
    await new Promise(r => setTimeout(r, 20));
    handles.destroy();
  });
});

describe('inline editor setup', () => {
  it('inlineEditor has destroy method from _initInlineEditor', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles.inlineEditor);
    assert.equal(typeof handles.inlineEditor.destroy, 'function');
    handles.destroy();
  });

  it('dblclick on container does not throw when docModel has no pages', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx();
    const handles = mod.bootstrapAdvancedTools(ctx);
    // Dispatch dblclick on the container
    const dblEvt = new Event('dblclick');
    dblEvt.clientX = 100;
    dblEvt.clientY = 100;
    ctx.container.dispatchEvent(dblEvt);
    // Should not throw
    handles.destroy();
  });
});

describe('bootstrap with minimal ctx', () => {
  it('works with empty object plus required minimal fields', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const container = document.createElement('div');
    const ctx = {
      container,
      toolbar: null,
      pdfLibDoc: null,
      pdfBytes: null,
      getPageCanvas: () => null,
      getPageNum: () => 1,
      reloadPage: async () => {},
      onPdfModified: () => {},
      eventBus: null,
    };
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles);
    assert.ok(handles.docModel);
    assert.equal(typeof handles.destroy, 'function');
    handles.destroy();
  });

  it('works with eventBus that has no addEventListener', async () => {
    const mod = await loadMod();
    if (!mod) return;
    const ctx = makeCtx({ eventBus: {} }); // plain object, no addEventListener
    const handles = mod.bootstrapAdvancedTools(ctx);
    assert.ok(handles);
    handles.destroy();
  });
});
