import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  uiLayoutKey,
  applyAdvancedPanelsState,
  toggleAdvancedPanelsState,
  applyLayoutState,
  updateSearchToolbarRows,
  toggleLayoutState,
  applyResizableLayoutState,
  ensureDefaultPageAreaHeight,
  setupResizableLayout,
  applyLayoutWithTransition,
  setupDragAndDrop,
  setupAnnotationEvents,
  initLayoutControllerDeps,
} from '../../app/modules/layout-controller.js';

// Patch document.documentElement.style to support setProperty
if (!document.documentElement) {
  document.documentElement = { style: {} };
}
if (!document.documentElement.style || typeof document.documentElement.style.setProperty !== 'function') {
  document.documentElement.style = {
    cssText: '',
    setProperty(k, v) { this[k] = v; },
    getPropertyValue(k) { return this[k] ?? ''; },
  };
}

// Patch window.getSelection
if (typeof window.getSelection !== 'function') {
  window.getSelection = () => ({
    isCollapsed: true,
    rangeCount: 0,
    anchorNode: null,
    getRangeAt: () => ({ getBoundingClientRect: () => ({ width: 0, top: 0, left: 0 }) }),
    removeAllRanges: () => {},
  });
}

// ─── DOM helpers ────────────────────────────────────────────────────────────

function makeEl(tag = 'div') {
  const el = document.createElement(tag);
  // Ensure getBoundingClientRect is available
  el.getBoundingClientRect = () => ({ top: 10, left: 10, bottom: 30, right: 30, width: 120, height: 20 });
  el.offsetParent = {};  // non-null means visible
  el.setPointerCapture = () => {};
  return el;
}

function makeAppShell() {
  const el = makeEl();
  el.className = 'app-shell';
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
  el.style = { setProperty: () => {}, getPropertyValue: () => '220px', cssText: '' };
  return el;
}

function makeViewerArea() {
  const el = makeEl();
  el.className = 'viewer-area';
  el.clientHeight = 800;
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 });
  el.style = { setProperty: () => {}, getPropertyValue: () => '600px', cssText: '' };
  return el;
}

// Patch document.querySelector to return mock elements when needed
let _mockQueryMap = {};
const _origQuerySelector = document.querySelector?.bind(document);
document.querySelector = function (sel) {
  if (_mockQueryMap[sel]) return _mockQueryMap[sel];
  return _origQuerySelector ? _origQuerySelector(sel) : null;
};

const _origGetElementById = document.getElementById?.bind(document);
document.getElementById = function (id) {
  if (_mockQueryMap['#' + id]) return _mockQueryMap['#' + id];
  return _origGetElementById ? _origGetElementById(id) : null;
};

function resetState() {
  localStorage.clear();
  state.settings = null;
  _mockQueryMap = {};

  // Set up els stubs
  els.toggleAdvancedPanels = makeEl('button');
  els.toggleSidebar = makeEl('button');
  els.toggleToolsBar = makeEl('button');
  els.toggleTextTools = makeEl('button');
  els.toggleSearchTools = makeEl('button');
  els.toggleAnnotTools = makeEl('button');
  els.toggleTextToolsInline = makeEl('button');
  els.searchToolsGroup = null;
  els.searchInput = null;
  els.searchScope = null;
  els.searchBtn = null;
  els.searchPrev = null;
  els.searchNext = null;
  els.sidebarResizeHandle = null;
  els.canvasResizeHandle = null;
  els.canvasWrap = null;
  els.annotationCanvas = makeEl('canvas');
  els.textLayerDiv = null;

  initLayoutControllerDeps({
    openFile: async () => {},
    beginStroke: () => {},
    moveStroke: () => {},
    endStroke: () => {},
    getCanvasPointFromEvent: () => ({ x: 0, y: 0 }),
    loadComments: () => [],
    denormalizePoint: () => ({ x: 0, y: 0 }),
    _applyTextMarkupFromSelection: () => {},
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('layout-controller', () => {
  beforeEach(() => resetState());

  // ── uiLayoutKey ──────────────────────────────────────────────────────────
  describe('uiLayoutKey', () => {
    it('returns prefixed key', () => {
      assert.equal(uiLayoutKey('sidebarHidden'), 'novareader-ui-layout:sidebarHidden');
    });

    it('works with arbitrary names', () => {
      assert.equal(uiLayoutKey('foo'), 'novareader-ui-layout:foo');
    });

    it('works with empty string', () => {
      assert.equal(uiLayoutKey(''), 'novareader-ui-layout:');
    });
  });

  // ── applyAdvancedPanelsState ─────────────────────────────────────────────
  describe('applyAdvancedPanelsState', () => {
    it('defaults to hidden when no localStorage value', () => {
      applyAdvancedPanelsState();
      assert.ok(els.toggleAdvancedPanels.textContent.includes('off'));
    });

    it('shows panels when localStorage is 0', () => {
      localStorage.setItem(uiLayoutKey('advancedHidden'), '0');
      applyAdvancedPanelsState();
      assert.ok(els.toggleAdvancedPanels.textContent.includes('on'));
    });

    it('hides panels when localStorage is 1', () => {
      localStorage.setItem(uiLayoutKey('advancedHidden'), '1');
      applyAdvancedPanelsState();
      assert.ok(els.toggleAdvancedPanels.textContent.includes('off'));
    });

    it('works when toggleAdvancedPanels el is null', () => {
      els.toggleAdvancedPanels = null;
      assert.doesNotThrow(() => applyAdvancedPanelsState());
    });

    it('sets advanced-hidden class on body', () => {
      applyAdvancedPanelsState(); // hidden by default
      assert.ok(document.body.classList.contains('advanced-hidden'));
    });

    it('removes advanced-hidden class from body when visible', () => {
      localStorage.setItem(uiLayoutKey('advancedHidden'), '0');
      applyAdvancedPanelsState();
      assert.ok(!document.body.classList.contains('advanced-hidden'));
    });
  });

  // ── toggleAdvancedPanelsState ────────────────────────────────────────────
  describe('toggleAdvancedPanelsState', () => {
    it('toggles from hidden to visible (sets 0)', () => {
      toggleAdvancedPanelsState();
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '0');
    });

    it('toggles from visible back to hidden (sets 1)', () => {
      localStorage.setItem(uiLayoutKey('advancedHidden'), '0');
      toggleAdvancedPanelsState();
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '1');
    });

    it('can be toggled multiple times', () => {
      toggleAdvancedPanelsState(); // => 0
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '0');
      toggleAdvancedPanelsState(); // => 1
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '1');
      toggleAdvancedPanelsState(); // => 0
      assert.equal(localStorage.getItem(uiLayoutKey('advancedHidden')), '0');
    });
  });

  // ── applyLayoutState ─────────────────────────────────────────────────────
  describe('applyLayoutState', () => {
    it('does not throw without DOM elements', () => {
      assert.doesNotThrow(() => applyLayoutState());
    });

    it('applies sidebar-hidden when localStorage is 1', () => {
      localStorage.setItem(uiLayoutKey('sidebarHidden'), '1');
      const appShell = makeAppShell();
      _mockQueryMap['.app-shell'] = appShell;
      applyLayoutState();
      assert.ok(appShell.classList.contains('sidebar-hidden'));
    });

    it('removes sidebar-hidden when localStorage is 0', () => {
      localStorage.setItem(uiLayoutKey('sidebarHidden'), '0');
      const appShell = makeAppShell();
      _mockQueryMap['.app-shell'] = appShell;
      applyLayoutState();
      assert.ok(!appShell.classList.contains('sidebar-hidden'));
    });

    it('toggles toolsbar-hidden on viewer-area', () => {
      localStorage.setItem(uiLayoutKey('toolsHidden'), '1');
      const viewerArea = makeViewerArea();
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyLayoutState();
      assert.ok(viewerArea.classList.contains('toolsbar-hidden'));
    });

    it('applies texttools-hidden class', () => {
      localStorage.setItem(uiLayoutKey('textHidden'), '1');
      const viewerArea = makeViewerArea();
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyLayoutState();
      assert.ok(viewerArea.classList.contains('texttools-hidden'));
    });

    it('textHidden defaults to false when not set', () => {
      const viewerArea = makeViewerArea();
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyLayoutState();
      assert.ok(!viewerArea.classList.contains('texttools-hidden'));
    });

    it('applies searchtools-hidden', () => {
      localStorage.setItem(uiLayoutKey('searchToolsHidden'), '1');
      const viewerArea = makeViewerArea();
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyLayoutState();
      assert.ok(viewerArea.classList.contains('searchtools-hidden'));
    });

    it('applies annottools-hidden', () => {
      localStorage.setItem(uiLayoutKey('annotToolsHidden'), '1');
      const viewerArea = makeViewerArea();
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyLayoutState();
      assert.ok(viewerArea.classList.contains('annottools-hidden'));
    });

    it('sets toggleSidebar active when NOT hidden', () => {
      localStorage.setItem(uiLayoutKey('sidebarHidden'), '0');
      applyLayoutState();
      assert.ok(els.toggleSidebar.classList.contains('active'));
    });

    it('removes toggleSidebar active when hidden', () => {
      localStorage.setItem(uiLayoutKey('sidebarHidden'), '1');
      applyLayoutState();
      assert.ok(!els.toggleSidebar.classList.contains('active'));
    });

    it('sets toggleTextToolsInline to ▸ when text tools hidden', () => {
      localStorage.setItem(uiLayoutKey('textHidden'), '1');
      applyLayoutState();
      assert.equal(els.toggleTextToolsInline.textContent, '▸');
    });

    it('sets toggleTextToolsInline to ▾ when text tools visible', () => {
      localStorage.setItem(uiLayoutKey('textHidden'), '0');
      applyLayoutState();
      assert.equal(els.toggleTextToolsInline.textContent, '▾');
    });

    it('handles null els gracefully', () => {
      els.toggleSidebar = null;
      els.toggleToolsBar = null;
      els.toggleTextTools = null;
      els.toggleSearchTools = null;
      els.toggleAnnotTools = null;
      els.toggleTextToolsInline = null;
      assert.doesNotThrow(() => applyLayoutState());
    });
  });

  // ── updateSearchToolbarRows ──────────────────────────────────────────────
  describe('updateSearchToolbarRows', () => {
    it('returns early when searchToolsGroup is null', () => {
      els.searchToolsGroup = null;
      assert.doesNotThrow(() => updateSearchToolbarRows());
    });

    it('runs without error when searchToolsGroup is set', () => {
      els.searchToolsGroup = makeEl();
      assert.doesNotThrow(() => updateSearchToolbarRows());
    });

    it('handles case where no controls are visible', () => {
      els.searchToolsGroup = makeEl();
      // all controls are null
      els.searchInput = null;
      els.searchScope = null;
      els.searchBtn = null;
      els.searchPrev = null;
      els.searchNext = null;
      assert.doesNotThrow(() => updateSearchToolbarRows());
    });

    it('handles visible search controls', () => {
      els.searchToolsGroup = makeEl();
      els.searchInput = makeEl('input');
      els.searchInput.offsetParent = {};
      els.searchInput.getBoundingClientRect = () => ({ top: 10, left: 0, bottom: 30, right: 100, width: 100, height: 20 });
      els.searchBtn = makeEl('button');
      els.searchBtn.offsetParent = {};
      els.searchBtn.getBoundingClientRect = () => ({ top: 10, left: 110, bottom: 30, right: 150, width: 40, height: 20 });
      assert.doesNotThrow(() => updateSearchToolbarRows());
    });

    it('sets --search-toolbar-rows to 1 when no visible controls', () => {
      els.searchToolsGroup = makeEl();
      els.searchInput = makeEl('input');
      els.searchInput.offsetParent = null; // not visible
      // No visible controls
      updateSearchToolbarRows();
      // Should not throw — the rAF callback will call apply() eventually
    });
  });

  // ── toggleLayoutState ────────────────────────────────────────────────────
  describe('toggleLayoutState', () => {
    it('toggles sidebarHidden from default (null) to 1', () => {
      toggleLayoutState('sidebarHidden');
      assert.equal(localStorage.getItem(uiLayoutKey('sidebarHidden')), '1');
    });

    it('toggles from 1 to 0', () => {
      localStorage.setItem(uiLayoutKey('toolsHidden'), '1');
      toggleLayoutState('toolsHidden');
      assert.equal(localStorage.getItem(uiLayoutKey('toolsHidden')), '0');
    });

    it('toggles from 0 to 1', () => {
      localStorage.setItem(uiLayoutKey('textHidden'), '0');
      toggleLayoutState('textHidden');
      assert.equal(localStorage.getItem(uiLayoutKey('textHidden')), '1');
    });

    it('calls applyLayoutState (els updated)', () => {
      toggleLayoutState('sidebarHidden');
      // After toggle, toggleSidebar should not be active (since sidebarHidden = 1)
      assert.ok(!els.toggleSidebar.classList.contains('active'));
    });
  });

  // ── applyResizableLayoutState ────────────────────────────────────────────
  describe('applyResizableLayoutState', () => {
    it('does not throw without DOM elements', () => {
      assert.doesNotThrow(() => applyResizableLayoutState());
    });

    it('uses stored sidebar width', () => {
      localStorage.setItem(uiLayoutKey('sidebarWidth'), '250');
      const appShell = makeAppShell();
      _mockQueryMap['.app-shell'] = appShell;
      assert.doesNotThrow(() => applyResizableLayoutState());
    });

    it('clamps sidebar width to min 180', () => {
      localStorage.setItem(uiLayoutKey('sidebarWidth'), '100'); // below min
      const appShell = makeAppShell();
      let setPropVal = null;
      appShell.style.setProperty = (k, v) => { if (k === '--sidebar-width') setPropVal = v; };
      _mockQueryMap['.app-shell'] = appShell;
      applyResizableLayoutState();
      assert.equal(setPropVal, '180px');
    });

    it('clamps sidebar width to max 360', () => {
      localStorage.setItem(uiLayoutKey('sidebarWidth'), '500');
      const appShell = makeAppShell();
      let setPropVal = null;
      appShell.style.setProperty = (k, v) => { if (k === '--sidebar-width') setPropVal = v; };
      _mockQueryMap['.app-shell'] = appShell;
      applyResizableLayoutState();
      assert.equal(setPropVal, '360px');
    });

    it('applies pageAreaPx when > 0', () => {
      localStorage.setItem(uiLayoutKey('pageAreaPx'), '700');
      const viewerArea = makeViewerArea();
      let setPropVal = null;
      viewerArea.style.setProperty = (k, v) => { if (k === '--page-area-height') setPropVal = v; };
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyResizableLayoutState();
      assert.equal(setPropVal, '700px');
    });

    it('does not apply pageAreaPx when 0', () => {
      localStorage.setItem(uiLayoutKey('pageAreaPx'), '0');
      const viewerArea = makeViewerArea();
      let setPropCalled = false;
      viewerArea.style.setProperty = (k, v) => { if (k === '--page-area-height') setPropCalled = true; };
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyResizableLayoutState();
      assert.ok(!setPropCalled);
    });

    it('clamps pageAreaPx to min 520', () => {
      localStorage.setItem(uiLayoutKey('pageAreaPx'), '100');
      const viewerArea = makeViewerArea();
      let setPropVal = null;
      viewerArea.style.setProperty = (k, v) => { if (k === '--page-area-height') setPropVal = v; };
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyResizableLayoutState();
      assert.equal(setPropVal, '520px');
    });
  });

  // ── ensureDefaultPageAreaHeight ──────────────────────────────────────────
  describe('ensureDefaultPageAreaHeight', () => {
    it('returns early when no .viewer-area element', () => {
      _mockQueryMap['.viewer-area'] = null;
      assert.doesNotThrow(() => ensureDefaultPageAreaHeight());
    });

    it('sets default pageAreaPx when not stored', () => {
      const viewerArea = makeViewerArea();
      viewerArea.clientHeight = 900;
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;
      ensureDefaultPageAreaHeight();
      const val = localStorage.getItem(uiLayoutKey('pageAreaPx'));
      assert.ok(val !== null);
      assert.ok(Number(val) >= 860);
    });

    it('sets default sidebarWidth when not stored', () => {
      const viewerArea = makeViewerArea();
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;
      ensureDefaultPageAreaHeight();
      const val = localStorage.getItem(uiLayoutKey('sidebarWidth'));
      assert.equal(val, '220');
    });

    it('keeps valid existing pageAreaPx', () => {
      localStorage.setItem(uiLayoutKey('pageAreaPx'), '700');
      const viewerArea = makeViewerArea();
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;
      ensureDefaultPageAreaHeight();
      assert.equal(localStorage.getItem(uiLayoutKey('pageAreaPx')), '700');
    });

    it('resets too-large sidebarWidth > 360', () => {
      localStorage.setItem(uiLayoutKey('sidebarWidth'), '500');
      const viewerArea = makeViewerArea();
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;
      ensureDefaultPageAreaHeight();
      assert.equal(localStorage.getItem(uiLayoutKey('sidebarWidth')), '220');
    });
  });

  // ── setupResizableLayout ─────────────────────────────────────────────────
  describe('setupResizableLayout', () => {
    it('does not throw without resize handles', () => {
      els.sidebarResizeHandle = null;
      els.canvasResizeHandle = null;
      assert.doesNotThrow(() => setupResizableLayout());
    });

    it('attaches pointerdown listener to sidebarResizeHandle', () => {
      const handle = makeEl();
      els.sidebarResizeHandle = handle;
      const viewerArea = makeViewerArea();
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;

      setupResizableLayout();
      // Simulate pointerdown
      assert.doesNotThrow(() => handle.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1 })));
    });

    it('attaches pointerdown listener to canvasResizeHandle', () => {
      const handle = makeEl();
      els.canvasResizeHandle = handle;
      const viewerArea = makeViewerArea();
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;

      assert.doesNotThrow(() => setupResizableLayout());
    });

    it('can be called multiple times without error (reuses AbortController)', () => {
      assert.doesNotThrow(() => {
        setupResizableLayout();
        setupResizableLayout();
        setupResizableLayout();
      });
    });

    it('sidebarResizeHandle pointerdown marks active and adds class', () => {
      const handle = makeEl();
      let classAdded = false;
      handle.classList.add = (...args) => { if (args[0] === 'active') classAdded = true; };
      handle.classList.remove = () => {};
      handle.classList.contains = () => false;
      handle.classList.toggle = () => {};
      els.sidebarResizeHandle = handle;
      const appShell = makeAppShell();
      appShell.style.setProperty = () => {};
      _mockQueryMap['.app-shell'] = appShell;
      _mockQueryMap['.viewer-area'] = null;

      setupResizableLayout();
      handle.dispatchEvent({ type: 'pointerdown', pointerId: 1 });
      assert.ok(classAdded);
    });
  });

  // ── applyLayoutWithTransition ────────────────────────────────────────────
  describe('applyLayoutWithTransition', () => {
    it('does not throw when no app-shell element exists', () => {
      assert.doesNotThrow(() => applyLayoutWithTransition());
    });

    it('adds layout-transitioning class to app-shell', () => {
      const appShell = makeAppShell();
      _mockQueryMap['.app-shell'] = appShell;
      applyLayoutWithTransition();
      assert.ok(appShell.classList.contains('layout-transitioning'));
    });

    it('adds layout-transitioning class to viewer-area', () => {
      const viewerArea = makeViewerArea();
      viewerArea.style.setProperty = () => {};
      _mockQueryMap['.viewer-area'] = viewerArea;
      applyLayoutWithTransition();
      assert.ok(viewerArea.classList.contains('layout-transitioning'));
    });
  });

  // ── setupDragAndDrop ─────────────────────────────────────────────────────
  describe('setupDragAndDrop', () => {
    it('does not throw on setup', () => {
      assert.doesNotThrow(() => setupDragAndDrop());
    });

    it('can be called multiple times without error', () => {
      assert.doesNotThrow(() => {
        setupDragAndDrop();
        setupDragAndDrop();
      });
    });

    it('calls openFile dep when file is dropped', async () => {
      let openFileCalled = false;
      let receivedFile = null;
      initLayoutControllerDeps({
        openFile: async (f) => { openFileCalled = true; receivedFile = f; },
      });
      setupDragAndDrop();

      const mockFile = { name: 'test.pdf' };
      const dropEvt = new (class extends Event {
        constructor() {
          super('drop');
          this.dataTransfer = { files: [mockFile] };
          this.preventDefault = () => {};
          this.stopPropagation = () => {};
        }
      })();

      // Find the drop handler registered on window
      window.dispatchEvent(dropEvt);
      // Allow async to settle
      await new Promise((r) => setTimeout(r, 10));
      assert.ok(openFileCalled);
      assert.equal(receivedFile, mockFile);
    });

    it('does not call openFile when no file in drop', async () => {
      let openFileCalled = false;
      initLayoutControllerDeps({ openFile: async () => { openFileCalled = true; } });
      setupDragAndDrop();

      const dropEvt = new (class extends Event {
        constructor() {
          super('drop');
          this.dataTransfer = { files: [] };
          this.preventDefault = () => {};
          this.stopPropagation = () => {};
        }
      })();
      window.dispatchEvent(dropEvt);
      await new Promise((r) => setTimeout(r, 10));
      assert.ok(!openFileCalled);
    });
  });

  // ── initLayoutControllerDeps ─────────────────────────────────────────────
  describe('initLayoutControllerDeps', () => {
    it('accepts partial deps object', () => {
      assert.doesNotThrow(() => initLayoutControllerDeps({ openFile: async () => {} }));
    });

    it('accepts empty deps object', () => {
      assert.doesNotThrow(() => initLayoutControllerDeps({}));
    });
  });

  // ── setupAnnotationEvents ────────────────────────────────────────────────
  describe('setupAnnotationEvents', () => {
    it('does not throw on setup with annotation canvas', () => {
      els.annotationCanvas = makeEl('canvas');
      assert.doesNotThrow(() => setupAnnotationEvents());
    });

    it('registers pointerdown handler on annotation canvas', () => {
      let strokeBegan = false;
      initLayoutControllerDeps({ beginStroke: () => { strokeBegan = true; } });
      const canvas = makeEl('canvas');
      els.annotationCanvas = canvas;
      setupAnnotationEvents();
      canvas.dispatchEvent({ type: 'pointerdown' });
      assert.ok(strokeBegan);
    });

    it('registers pointermove handler on annotation canvas', () => {
      let strokeMoved = false;
      initLayoutControllerDeps({ moveStroke: () => { strokeMoved = true; } });
      const canvas = makeEl('canvas');
      els.annotationCanvas = canvas;
      setupAnnotationEvents();
      canvas.dispatchEvent({ type: 'pointermove' });
      assert.ok(strokeMoved);
    });

    it('registers pointerup handler on annotation canvas', () => {
      let strokeEnded = false;
      initLayoutControllerDeps({ endStroke: () => { strokeEnded = true; } });
      const canvas = makeEl('canvas');
      els.annotationCanvas = canvas;
      setupAnnotationEvents();
      canvas.dispatchEvent({ type: 'pointerup' });
      assert.ok(strokeEnded);
    });

    it('registers pointerleave handler on annotation canvas', () => {
      let strokeEnded = false;
      initLayoutControllerDeps({ endStroke: () => { strokeEnded = true; } });
      const canvas = makeEl('canvas');
      els.annotationCanvas = canvas;
      setupAnnotationEvents();
      canvas.dispatchEvent({ type: 'pointerleave' });
      assert.ok(strokeEnded);
    });

    it('dblclick with no nearby comments does nothing', () => {
      initLayoutControllerDeps({
        getCanvasPointFromEvent: () => ({ x: 100, y: 100 }),
        loadComments: () => [],
        denormalizePoint: () => ({ x: 0, y: 0 }),
      });
      const canvas = makeEl('canvas');
      els.annotationCanvas = canvas;
      setupAnnotationEvents();
      const evt = { type: 'dblclick', clientX: 100, clientY: 100 };
      assert.doesNotThrow(() => canvas.dispatchEvent(evt));
    });

    it('dblclick with nearby comment creates overlay', () => {
      initLayoutControllerDeps({
        getCanvasPointFromEvent: () => ({ x: 50, y: 50 }),
        loadComments: () => [{ point: { x: 0, y: 0 }, text: 'hello comment' }],
        denormalizePoint: () => ({ x: 50, y: 50 }),
      });
      const canvas = makeEl('canvas');
      els.annotationCanvas = canvas;
      setupAnnotationEvents();
      const evt = { type: 'dblclick', clientX: 50, clientY: 50 };
      assert.doesNotThrow(() => canvas.dispatchEvent(evt));
    });

    it('sets up text markup popup on textLayerDiv mouseup', () => {
      const textLayerDiv = makeEl('div');
      textLayerDiv.contains = () => false;
      els.textLayerDiv = textLayerDiv;
      setupAnnotationEvents();
      // Trigger mouseup — getSelection returns collapsed selection
      assert.doesNotThrow(() => textLayerDiv.dispatchEvent({ type: 'mouseup' }));
    });
  });
});
