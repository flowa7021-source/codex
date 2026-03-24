import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initAdvanced } from '../../app/modules/init-advanced.js';
import { emit } from '../../app/modules/event-bus.js';

function makeDeps(overrides = {}) {
  return {
    state: { currentPage: 1, pageCount: 10, adapter: null, docName: '', settings: {} },
    els: {
      canvasWrap: document.createElement('div'),
      prevPage: document.createElement('button'),
      nextPage: document.createElement('button'),
      zoomIn: document.createElement('button'),
      zoomOut: document.createElement('button'),
    },
    safeOn: mock.fn(),
    debounce: (fn) => fn,
    renderCurrentPage: mock.fn(),
    goToPage: mock.fn(),
    nrPrompt: mock.fn(async () => null),
    pushDiagnosticEvent: mock.fn(),
    toastSuccess: mock.fn(),
    loadStrokes: mock.fn(() => []),
    saveStrokes: mock.fn(),
    initQuickActions: mock.fn(),
    initHotkeys: mock.fn(),
    registerHotkeyHandlers: mock.fn(),
    initAutoScroll: mock.fn(),
    startAutoScroll: mock.fn(),
    stopAutoScroll: mock.fn(),
    isAutoScrolling: mock.fn(() => false),
    initAutosave: mock.fn(),
    checkForRecovery: mock.fn(async () => null),
    applyRecoveredSnapshot: mock.fn(),
    startAutosaveTimer: mock.fn(),
    initMinimap: mock.fn(),
    updateMinimap: mock.fn(),
    initCommandPalette: mock.fn(),
    ...overrides,
  };
}

describe('initAdvanced', () => {
  it('exports a function', () => {
    assert.equal(typeof initAdvanced, 'function');
  });

  it('calls all sub-init functions', () => {
    const deps = makeDeps();
    initAdvanced(deps);
    assert.equal(deps.initQuickActions.mock.callCount(), 1);
    assert.equal(deps.initHotkeys.mock.callCount(), 1);
    assert.equal(deps.registerHotkeyHandlers.mock.callCount(), 1);
    assert.equal(deps.initAutoScroll.mock.callCount(), 1);
    assert.equal(deps.initAutosave.mock.callCount(), 1);
    assert.equal(deps.initMinimap.mock.callCount(), 1);
    assert.equal(deps.initCommandPalette.mock.callCount(), 1);
  });

  it('calls checkForRecovery', async () => {
    const deps = makeDeps();
    initAdvanced(deps);
    assert.equal(deps.checkForRecovery.mock.callCount(), 1);
  });

  it('applies recovered snapshot when available', async () => {
    const snapshot = { fileName: 'test.pdf', currentPage: 3, timestamp: Date.now() - 1000 };
    const deps = makeDeps({ checkForRecovery: mock.fn(async () => snapshot) });
    initAdvanced(deps);
    // Wait for the promise chain to resolve
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.applyRecoveredSnapshot.mock.callCount(), 1);
    assert.deepEqual(deps.applyRecoveredSnapshot.mock.calls[0].arguments[0], snapshot);
  });

  it('wires scroll listener via safeOn on canvasWrap', () => {
    const deps = makeDeps();
    initAdvanced(deps);
    const scrollCalls = deps.safeOn.mock.calls.filter(
      c => c.arguments[1] === 'scroll'
    );
    assert.ok(scrollCalls.length >= 1, 'should bind scroll on canvasWrap');
  });

  it('does not throw when checkForRecovery rejects', async () => {
    const deps = makeDeps({
      checkForRecovery: mock.fn(async () => { throw new Error('fail'); }),
    });
    assert.doesNotThrow(() => initAdvanced(deps));
    await new Promise(r => setTimeout(r, 10));
  });

  // ── Hotkey handler callbacks ─────────────────────────────────────────

  describe('registerHotkeyHandlers callbacks', () => {
    function getHotkeyHandlers(deps) {
      initAdvanced(deps);
      return deps.registerHotkeyHandlers.mock.calls[0].arguments[0];
    }

    it('firstPage sets currentPage to 1 and renders', () => {
      const deps = makeDeps();
      deps.state.currentPage = 5;
      const handlers = getHotkeyHandlers(deps);
      handlers.firstPage();
      assert.equal(deps.state.currentPage, 1);
      assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    });

    it('lastPage sets currentPage to pageCount and renders', () => {
      const deps = makeDeps();
      deps.state.pageCount = 20;
      const handlers = getHotkeyHandlers(deps);
      handlers.lastPage();
      assert.equal(deps.state.currentPage, 20);
      assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    });

    it('prevPage clicks the prevPage button', () => {
      const deps = makeDeps();
      const clicked = mock.fn();
      deps.els.prevPage.addEventListener('click', clicked);
      const handlers = getHotkeyHandlers(deps);
      handlers.prevPage();
      assert.equal(clicked.mock.callCount(), 1);
    });

    it('nextPage clicks the nextPage button', () => {
      const deps = makeDeps();
      const clicked = mock.fn();
      deps.els.nextPage.addEventListener('click', clicked);
      const handlers = getHotkeyHandlers(deps);
      handlers.nextPage();
      assert.equal(clicked.mock.callCount(), 1);
    });

    it('zoomIn clicks the zoomIn button', () => {
      const deps = makeDeps();
      const clicked = mock.fn();
      deps.els.zoomIn.addEventListener('click', clicked);
      const handlers = getHotkeyHandlers(deps);
      handlers.zoomIn();
      assert.equal(clicked.mock.callCount(), 1);
    });

    it('zoomOut clicks the zoomOut button', () => {
      const deps = makeDeps();
      const clicked = mock.fn();
      deps.els.zoomOut.addEventListener('click', clicked);
      const handlers = getHotkeyHandlers(deps);
      handlers.zoomOut();
      assert.equal(clicked.mock.callCount(), 1);
    });

    it('goToPage navigates when nrPrompt returns valid page', async () => {
      const deps = makeDeps({ nrPrompt: mock.fn(async () => '5') });
      const handlers = getHotkeyHandlers(deps);
      await handlers.goToPage();
      assert.equal(deps.state.currentPage, 5);
      assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    });

    it('goToPage does nothing when nrPrompt returns null', async () => {
      const deps = makeDeps({ nrPrompt: mock.fn(async () => null) });
      const handlers = getHotkeyHandlers(deps);
      await handlers.goToPage();
      assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
    });

    it('goToPage does nothing when page is out of range', async () => {
      const deps = makeDeps({ nrPrompt: mock.fn(async () => '99') });
      deps.state.pageCount = 10;
      const handlers = getHotkeyHandlers(deps);
      await handlers.goToPage();
      assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
    });

    it('goToPage does nothing when page is 0', async () => {
      const deps = makeDeps({ nrPrompt: mock.fn(async () => '0') });
      const handlers = getHotkeyHandlers(deps);
      await handlers.goToPage();
      assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
    });

    it('search clicks searchToggle element', () => {
      const searchToggle = document.createElement('button');
      searchToggle.id = 'searchToggle';
      const clicked = mock.fn();
      searchToggle.addEventListener('click', clicked);
      const origGetById = document.getElementById;
      document.getElementById = (id) => id === 'searchToggle' ? searchToggle : null;
      try {
        const deps = makeDeps();
        const handlers = getHotkeyHandlers(deps);
        handlers.search();
        assert.equal(clicked.mock.callCount(), 1);
      } finally {
        document.getElementById = origGetById;
      }
    });

    it('search does nothing if searchToggle not found', () => {
      const origGetById = document.getElementById;
      document.getElementById = () => null;
      try {
        const deps = makeDeps();
        const handlers = getHotkeyHandlers(deps);
        // Should not throw
        handlers.search();
      } finally {
        document.getElementById = origGetById;
      }
    });

    it('fullscreen calls requestFullscreen when not in fullscreen', () => {
      const origFullscreenElement = document.fullscreenElement;
      const origRequestFullscreen = document.documentElement.requestFullscreen;
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      const mockRequest = mock.fn();
      document.documentElement.requestFullscreen = mockRequest;
      try {
        const deps = makeDeps();
        const handlers = getHotkeyHandlers(deps);
        handlers.fullscreen();
        assert.equal(mockRequest.mock.callCount(), 1);
      } finally {
        Object.defineProperty(document, 'fullscreenElement', { value: origFullscreenElement, configurable: true });
        document.documentElement.requestFullscreen = origRequestFullscreen;
      }
    });

    it('print calls window.print', () => {
      const origPrint = window.print;
      window.print = mock.fn();
      try {
        const deps = makeDeps();
        const handlers = getHotkeyHandlers(deps);
        handlers.print();
        assert.equal(window.print.mock.callCount(), 1);
      } finally {
        window.print = origPrint;
      }
    });
  });

  // ── Quick Actions onAction callback ──────────────────────────────────

  describe('initQuickActions onAction callback', () => {
    function getOnAction(deps) {
      initAdvanced(deps);
      return deps.initQuickActions.mock.calls[0].arguments[0].onAction;
    }

    it('sets search input value and dispatches input event for search action', () => {
      const searchInput = document.createElement('input');
      searchInput.id = 'searchInput';
      const inputFired = mock.fn();
      searchInput.addEventListener('input', inputFired);
      const origGetById = document.getElementById;
      document.getElementById = (id) => id === 'searchInput' ? searchInput : null;
      try {
        const deps = makeDeps();
        const onAction = getOnAction(deps);
        onAction('search', 'hello');
        assert.equal(searchInput.value, 'hello');
        assert.equal(inputFired.mock.callCount(), 1);
      } finally {
        document.getElementById = origGetById;
      }
    });

    it('does nothing for search action without text', () => {
      const deps = makeDeps();
      const onAction = getOnAction(deps);
      // Should not throw
      onAction('search', '');
    });

    it('does nothing for non-search action', () => {
      const deps = makeDeps();
      const onAction = getOnAction(deps);
      // Should not throw
      onAction('other', 'text');
    });

    it('does nothing when searchInput element not found', () => {
      const origGetById = document.getElementById;
      document.getElementById = () => null;
      try {
        const deps = makeDeps();
        const onAction = getOnAction(deps);
        onAction('search', 'hello');
      } finally {
        document.getElementById = origGetById;
      }
    });
  });

  // ── Minimap onPageChange callback ────────────────────────────────────

  describe('initMinimap onPageChange callback', () => {
    it('calls renderCurrentPage when onPageChange is invoked', () => {
      const deps = makeDeps();
      initAdvanced(deps);
      const minimapConfig = deps.initMinimap.mock.calls[0].arguments[0];
      minimapConfig.onPageChange();
      assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    });
  });

  // ── Auto-scroll button wiring ────────────────────────────────────────

  describe('auto-scroll button', () => {
    it('calls startAutoScroll when not scrolling', () => {
      const autoScrollBtn = document.createElement('button');
      autoScrollBtn.id = 'autoScrollBtn';
      const origGetById = document.getElementById;
      document.getElementById = (id) => id === 'autoScrollBtn' ? autoScrollBtn : origGetById(id);
      try {
        const deps = makeDeps({ isAutoScrolling: mock.fn(() => false) });
        initAdvanced(deps);
        // Find the safeOn call for autoScrollBtn click
        const clickCall = deps.safeOn.mock.calls.find(
          c => c.arguments[0] === autoScrollBtn && c.arguments[1] === 'click'
        );
        assert.ok(clickCall, 'should bind click on autoScrollBtn');
        // Invoke the click handler
        const handler = clickCall.arguments[2];
        handler();
        assert.equal(deps.startAutoScroll.mock.callCount(), 1);
      } finally {
        document.getElementById = origGetById;
      }
    });

    it('calls stopAutoScroll when already scrolling', () => {
      const autoScrollBtn = document.createElement('button');
      autoScrollBtn.id = 'autoScrollBtn';
      const origGetById = document.getElementById;
      document.getElementById = (id) => id === 'autoScrollBtn' ? autoScrollBtn : origGetById(id);
      try {
        const deps = makeDeps({ isAutoScrolling: mock.fn(() => true) });
        initAdvanced(deps);
        const clickCall = deps.safeOn.mock.calls.find(
          c => c.arguments[0] === autoScrollBtn && c.arguments[1] === 'click'
        );
        const handler = clickCall.arguments[2];
        handler();
        assert.equal(deps.stopAutoScroll.mock.callCount(), 1);
      } finally {
        document.getElementById = origGetById;
      }
    });
  });

  // ── Autosave config callbacks ────────────────────────────────────────

  describe('initAutosave config callbacks', () => {
    function getAutosaveConfig(deps) {
      initAdvanced(deps);
      return deps.initAutosave.mock.calls[0].arguments[0];
    }

    it('getAnnotations calls loadStrokes', () => {
      const deps = makeDeps({ loadStrokes: mock.fn(() => ['stroke1']) });
      const config = getAutosaveConfig(deps);
      const result = config.getAnnotations();
      assert.deepEqual(result, ['stroke1']);
    });

    it('getAnnotations returns null when loadStrokes throws', () => {
      const deps = makeDeps({ loadStrokes: mock.fn(() => { throw new Error('fail'); }) });
      const config = getAutosaveConfig(deps);
      const result = config.getAnnotations();
      assert.equal(result, null);
    });

    it('setAnnotations calls saveStrokes', () => {
      const deps = makeDeps();
      const config = getAutosaveConfig(deps);
      config.setAnnotations([1, 2, 3]);
      assert.equal(deps.saveStrokes.mock.callCount(), 1);
      assert.deepEqual(deps.saveStrokes.mock.calls[0].arguments[0], [1, 2, 3]);
    });

    it('setAnnotations does not throw when saveStrokes throws', () => {
      const deps = makeDeps({ saveStrokes: mock.fn(() => { throw new Error('fail'); }) });
      const config = getAutosaveConfig(deps);
      assert.doesNotThrow(() => config.setAnnotations('data'));
    });

    it('showToast calls toastSuccess', () => {
      const deps = makeDeps();
      const config = getAutosaveConfig(deps);
      config.showToast('Saved!');
      assert.equal(deps.toastSuccess.mock.callCount(), 1);
      assert.equal(deps.toastSuccess.mock.calls[0].arguments[0], 'Saved!');
    });

    it('showToast does not throw when toastSuccess throws', () => {
      const deps = makeDeps({ toastSuccess: mock.fn(() => { throw new Error('fail'); }) });
      const config = getAutosaveConfig(deps);
      assert.doesNotThrow(() => config.showToast('msg'));
    });
  });

  // ── Command palette goToPage callback ────────────────────────────────

  describe('initCommandPalette goToPage callback', () => {
    function getCmdPaletteConfig(deps) {
      initAdvanced(deps);
      return deps.initCommandPalette.mock.calls[0].arguments[0];
    }

    it('navigates to valid page', () => {
      const deps = makeDeps();
      deps.state.pageCount = 10;
      const config = getCmdPaletteConfig(deps);
      config.goToPage(5);
      assert.equal(deps.state.currentPage, 5);
      assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    });

    it('does not navigate to page 0', () => {
      const deps = makeDeps();
      deps.state.pageCount = 10;
      const config = getCmdPaletteConfig(deps);
      config.goToPage(0);
      assert.equal(deps.state.currentPage, 1); // unchanged
      assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
    });

    it('does not navigate beyond pageCount', () => {
      const deps = makeDeps();
      deps.state.pageCount = 10;
      const config = getCmdPaletteConfig(deps);
      config.goToPage(11);
      assert.equal(deps.state.currentPage, 1); // unchanged
      assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
    });
  });

  // ── page-rendered event listeners ────────────────────────────────────

  describe('page-rendered event listeners', () => {
    it('calls updateMinimap on page-rendered event', () => {
      const deps = makeDeps();
      initAdvanced(deps);
      emit('page-rendered', {});
      assert.ok(deps.updateMinimap.mock.callCount() >= 1);
    });

    it('starts autosave timer on first page-rendered when adapter and docName set', () => {
      const deps = makeDeps();
      deps.state.adapter = {};
      deps.state.docName = 'test.pdf';
      initAdvanced(deps);
      emit('page-rendered', {});
      assert.equal(deps.startAutosaveTimer.mock.callCount(), 1);
    });

    it('does not start autosave timer when no adapter', () => {
      const deps = makeDeps();
      deps.state.adapter = null;
      deps.state.docName = 'test.pdf';
      initAdvanced(deps);
      emit('page-rendered', {});
      assert.equal(deps.startAutosaveTimer.mock.callCount(), 0);
    });

    it('does not start autosave timer when no docName', () => {
      const deps = makeDeps();
      deps.state.adapter = {};
      deps.state.docName = '';
      initAdvanced(deps);
      emit('page-rendered', {});
      assert.equal(deps.startAutosaveTimer.mock.callCount(), 0);
    });

    it('autosave timer listener fires only once', () => {
      const deps = makeDeps();
      deps.state.adapter = {};
      deps.state.docName = 'test.pdf';
      initAdvanced(deps);
      emit('page-rendered', {});
      emit('page-rendered', {});
      emit('page-rendered', {});
      // once: true means it should only fire once
      assert.equal(deps.startAutosaveTimer.mock.callCount(), 1);
    });
  });

  // ── Debounced minimap update via scroll ──────────────────────────────

  describe('scroll handler calls updateMinimap', () => {
    it('scroll handler invokes updateMinimap via debounce', () => {
      const deps = makeDeps();
      initAdvanced(deps);
      // debounce is identity, so the scroll handler is the raw fn
      const scrollCall = deps.safeOn.mock.calls.find(
        c => c.arguments[1] === 'scroll'
      );
      assert.ok(scrollCall);
      const scrollHandler = scrollCall.arguments[2];
      scrollHandler();
      assert.ok(deps.updateMinimap.mock.callCount() >= 1);
    });
  });

  // ── Recovery pushDiagnosticEvent ─────────────────────────────────────

  describe('recovery diagnostic event', () => {
    it('pushes diagnostic event with snapshot info on recovery', async () => {
      const ts = Date.now() - 5000;
      const snapshot = { fileName: 'doc.pdf', currentPage: 2, timestamp: ts };
      const deps = makeDeps({ checkForRecovery: mock.fn(async () => snapshot) });
      initAdvanced(deps);
      await new Promise(r => setTimeout(r, 10));
      assert.equal(deps.pushDiagnosticEvent.mock.callCount(), 1);
      const [eventName, data] = deps.pushDiagnosticEvent.mock.calls[0].arguments;
      assert.equal(eventName, 'autosave.recovery-applied');
      assert.equal(data.fileName, 'doc.pdf');
      assert.equal(data.page, 2);
      assert.ok(typeof data.age === 'number');
    });
  });
});
