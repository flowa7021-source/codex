import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initNavigation } from '../../app/modules/init-navigation.js';

function makeDeps(overrides = {}) {
  return {
    state: { adapter: null, currentPage: 1, pageCount: 10, zoom: 1.0, rotation: 0, settings: {} },
    els: {
      prevPage: document.createElement('button'),
      nextPage: document.createElement('button'),
      goToPage: document.createElement('button'),
      pageInput: document.createElement('input'),
      zoomIn: document.createElement('button'),
      zoomOut: document.createElement('button'),
      zoomStatus: document.createElement('span'),
      fitWidth: document.createElement('button'),
      fitPage: document.createElement('button'),
      rotate: document.createElement('button'),
      fullscreen: document.createElement('button'),
      canvasWrap: document.createElement('div'),
    },
    debounce: (fn) => fn,
    safeOn: mock.fn(),
    renderCurrentPage: mock.fn(async () => {}),
    renderPagePreviews: mock.fn(async () => {}),
    goToPage: mock.fn(),
    fitWidth: mock.fn(),
    fitPage: mock.fn(),
    clearOcrRuntimeCaches: mock.fn(),
    scheduleBackgroundOcrScan: mock.fn(),
    evictPageFromCache: mock.fn(),
    ...overrides,
  };
}

/** Create deps where safeOn actually registers event listeners so callbacks fire. */
function makeLiveDeps(overrides = {}) {
  const safeOnFn = (el, event, handler, opts) => {
    if (el && el.addEventListener) {
      el.addEventListener(event, handler, opts);
    }
  };
  return makeDeps({ safeOn: safeOnFn, ...overrides });
}

describe('initNavigation', () => {
  it('exports a function', () => {
    assert.equal(typeof initNavigation, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initNavigation(makeDeps()));
  });

  it('binds click handlers for navigation buttons', () => {
    const deps = makeDeps();
    initNavigation(deps);
    const clickBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'click');
    // prevPage, nextPage, goToPage, zoomIn, zoomOut, fitWidth, fitPage, rotate, fullscreen
    assert.ok(clickBindings.length >= 9, `expected >=9 click bindings, got ${clickBindings.length}`);
  });

  it('binds wheel handler on canvasWrap', () => {
    const deps = makeDeps();
    initNavigation(deps);
    const wheelBinding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.canvasWrap && c.arguments[1] === 'wheel'
    );
    assert.ok(wheelBinding, 'should bind wheel on canvasWrap');
  });

  it('binds keydown on pageInput', () => {
    const deps = makeDeps();
    initNavigation(deps);
    const keydownBinding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pageInput && c.arguments[1] === 'keydown'
    );
    assert.ok(keydownBinding, 'should bind keydown on pageInput');
  });

  // ──── prevPage click ────────────────────────────────────────────────────────

  it('prevPage click does nothing when adapter is null', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = null;
    initNavigation(deps);
    deps.els.prevPage.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
  });

  it('prevPage click does nothing when currentPage <= 1', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = {};
    deps.state.currentPage = 1;
    initNavigation(deps);
    deps.els.prevPage.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
  });

  it('prevPage click decrements page and renders', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = {};
    deps.state.currentPage = 5;
    initNavigation(deps);
    deps.els.prevPage.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.currentPage, 4);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
  });

  // ──── nextPage click ────────────────────────────────────────────────────────

  it('nextPage click does nothing when adapter is null', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = null;
    initNavigation(deps);
    deps.els.nextPage.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
  });

  it('nextPage click does nothing when at last page', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = {};
    deps.state.currentPage = 10;
    deps.state.pageCount = 10;
    initNavigation(deps);
    deps.els.nextPage.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.renderCurrentPage.mock.callCount(), 0);
  });

  it('nextPage click increments page and renders', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = {};
    deps.state.currentPage = 3;
    deps.state.pageCount = 10;
    initNavigation(deps);
    deps.els.nextPage.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.currentPage, 4);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
  });

  // ──── goToPage click ────────────────────────────────────────────────────────

  it('goToPage button click calls goToPage', () => {
    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.goToPage.click();
    assert.equal(deps.goToPage.mock.callCount(), 1);
  });

  // ──── pageInput keydown ─────────────────────────────────────────────────────

  it('pageInput Enter key calls goToPage', async () => {
    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.pageInput.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter' }));
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.goToPage.mock.callCount(), 1);
  });

  it('pageInput non-Enter key does not call goToPage', () => {
    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.pageInput.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
    assert.equal(deps.goToPage.mock.callCount(), 0);
  });

  // ──── zoomIn click ──────────────────────────────────────────────────────────

  it('zoomIn click increases zoom and updates status', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 1.0;
    initNavigation(deps);
    deps.els.zoomIn.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.zoom, 1.1);
    assert.equal(deps.els.zoomStatus.textContent, '110%');
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
  });

  it('zoomIn click caps at 4', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 3.99;
    initNavigation(deps);
    deps.els.zoomIn.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.zoom, 4);
  });

  // ──── zoomOut click ─────────────────────────────────────────────────────────

  it('zoomOut click decreases zoom and updates status', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 1.0;
    initNavigation(deps);
    deps.els.zoomOut.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.zoom, 0.9);
    assert.equal(deps.els.zoomStatus.textContent, '90%');
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
  });

  it('zoomOut click floors at 0.3', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 0.31;
    initNavigation(deps);
    deps.els.zoomOut.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.zoom, 0.3);
  });

  // ──── fitWidth / fitPage ────────────────────────────────────────────────────

  it('fitWidth button click calls fitWidth', () => {
    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.fitWidth.click();
    assert.equal(deps.fitWidth.mock.callCount(), 1);
  });

  it('fitPage button click calls fitPage', () => {
    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.fitPage.click();
    assert.equal(deps.fitPage.mock.callCount(), 1);
  });

  // ──── rotate click ──────────────────────────────────────────────────────────

  it('rotate click increments rotation and clears OCR caches', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = null;
    deps.state.rotation = 0;
    initNavigation(deps);
    deps.els.rotate.click();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(deps.state.rotation, 90);
    assert.equal(deps.clearOcrRuntimeCaches.mock.callCount(), 1);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
    assert.equal(deps.renderPagePreviews.mock.callCount(), 1);
  });

  it('rotate click wraps rotation at 360', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = null;
    deps.state.rotation = 270;
    initNavigation(deps);
    deps.els.rotate.click();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(deps.state.rotation, 0);
  });

  it('rotate click auto-adjusts zoom when adapter is present', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = {
      getPageViewport: mock.fn(async () => ({ width: 500, height: 700 })),
    };
    deps.state.currentPage = 1;
    deps.state.rotation = 0;
    // Set canvasWrap dimensions
    deps.els.canvasWrap.offsetWidth = 800;
    deps.els.canvasWrap.clientWidth = 780;
    initNavigation(deps);
    deps.els.rotate.click();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(deps.state.rotation, 90);
    assert.equal(deps.state.adapter.getPageViewport.mock.callCount(), 1);
    // autoZoom = (780 - max(16, 20+16)) / 500 = (780 - 36) / 500 = 1.488
    assert.ok(deps.state.zoom > 0.3 && deps.state.zoom < 4, 'zoom should be auto-adjusted');
  });

  it('rotate click handles adapter.getPageViewport throwing', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = {
      getPageViewport: mock.fn(async () => { throw new Error('fail'); }),
    };
    deps.state.rotation = 0;
    initNavigation(deps);
    deps.els.rotate.click();
    await new Promise(r => setTimeout(r, 50));
    // Should not crash; rotation still set
    assert.equal(deps.state.rotation, 90);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
  });

  it('rotate click schedules background OCR when enabled', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = null;
    deps.state.settings = { backgroundOcr: true };
    initNavigation(deps);
    deps.els.rotate.click();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(deps.scheduleBackgroundOcrScan.mock.callCount(), 1);
  });

  it('rotate click does not schedule background OCR when disabled', async () => {
    const deps = makeLiveDeps();
    deps.state.adapter = null;
    deps.state.settings = { backgroundOcr: false };
    initNavigation(deps);
    deps.els.rotate.click();
    await new Promise(r => setTimeout(r, 50));
    assert.equal(deps.scheduleBackgroundOcrScan.mock.callCount(), 0);
  });

  // ──── fullscreen click ──────────────────────────────────────────────────────

  it('fullscreen click requests fullscreen when not in fullscreen', async () => {
    const origRequestFullscreen = document.documentElement.requestFullscreen;
    const origExitFullscreen = document.exitFullscreen;
    const origFullscreenElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true, writable: true });
    document.documentElement.requestFullscreen = mock.fn(async () => {});
    document.exitFullscreen = mock.fn(async () => {});

    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.fullscreen.click();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(document.documentElement.requestFullscreen.mock.callCount(), 1);
    assert.equal(document.exitFullscreen.mock.callCount(), 0);

    // Restore
    document.documentElement.requestFullscreen = origRequestFullscreen;
    document.exitFullscreen = origExitFullscreen;
    if (origFullscreenElement) {
      Object.defineProperty(document, 'fullscreenElement', origFullscreenElement);
    } else {
      delete document.fullscreenElement;
    }
  });

  it('fullscreen click exits fullscreen when already in fullscreen', async () => {
    const origRequestFullscreen = document.documentElement.requestFullscreen;
    const origExitFullscreen = document.exitFullscreen;

    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true, writable: true });
    document.documentElement.requestFullscreen = mock.fn(async () => {});
    document.exitFullscreen = mock.fn(async () => {});

    const deps = makeLiveDeps();
    initNavigation(deps);
    deps.els.fullscreen.click();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(document.documentElement.requestFullscreen.mock.callCount(), 0);
    assert.equal(document.exitFullscreen.mock.callCount(), 1);

    // Restore
    document.documentElement.requestFullscreen = origRequestFullscreen;
    document.exitFullscreen = origExitFullscreen;
    delete document.fullscreenElement;
  });

  // ──── Ctrl+wheel zoom ──────────────────────────────────────────────────────

  it('ctrl+wheel zoom in increases zoom', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 1.0;
    initNavigation(deps);

    const wheelEvent = Object.assign(new Event('wheel'), {
      ctrlKey: true,
      deltaY: -100, // scroll up = zoom in
      preventDefault: mock.fn(),
    });
    deps.els.canvasWrap.dispatchEvent(wheelEvent);
    await new Promise(r => setTimeout(r, 50));

    assert.equal(wheelEvent.preventDefault.mock.callCount(), 1);
    assert.ok(deps.state.zoom > 1.0, `zoom should increase, got ${deps.state.zoom}`);
    assert.equal(deps.els.zoomStatus.textContent, `${Math.round(deps.state.zoom * 100)}%`);
    assert.equal(deps.renderCurrentPage.mock.callCount(), 1);
  });

  it('ctrl+wheel zoom out decreases zoom', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 1.0;
    initNavigation(deps);

    const wheelEvent = Object.assign(new Event('wheel'), {
      ctrlKey: true,
      deltaY: 100, // scroll down = zoom out
      preventDefault: mock.fn(),
    });
    deps.els.canvasWrap.dispatchEvent(wheelEvent);
    await new Promise(r => setTimeout(r, 50));

    assert.ok(deps.state.zoom < 1.0, `zoom should decrease, got ${deps.state.zoom}`);
  });

  it('wheel without ctrlKey does not zoom', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 1.0;
    initNavigation(deps);

    const wheelEvent = Object.assign(new Event('wheel'), {
      ctrlKey: false,
      deltaY: -100,
      preventDefault: mock.fn(),
    });
    deps.els.canvasWrap.dispatchEvent(wheelEvent);
    await new Promise(r => setTimeout(r, 50));

    assert.equal(deps.state.zoom, 1.0);
    assert.equal(wheelEvent.preventDefault.mock.callCount(), 0);
  });

  it('ctrl+wheel zoom clamps to max 4', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 3.98;
    initNavigation(deps);

    const wheelEvent = Object.assign(new Event('wheel'), {
      ctrlKey: true,
      deltaY: -100,
      preventDefault: mock.fn(),
    });
    deps.els.canvasWrap.dispatchEvent(wheelEvent);
    await new Promise(r => setTimeout(r, 50));

    assert.ok(deps.state.zoom <= 4, `zoom should not exceed 4, got ${deps.state.zoom}`);
  });

  it('ctrl+wheel zoom clamps to min 0.3', async () => {
    const deps = makeLiveDeps();
    deps.state.zoom = 0.32;
    initNavigation(deps);

    const wheelEvent = Object.assign(new Event('wheel'), {
      ctrlKey: true,
      deltaY: 100,
      preventDefault: mock.fn(),
    });
    deps.els.canvasWrap.dispatchEvent(wheelEvent);
    await new Promise(r => setTimeout(r, 50));

    assert.ok(deps.state.zoom >= 0.3, `zoom should not go below 0.3, got ${deps.state.zoom}`);
  });

  // ──── zoomStatus null safety ────────────────────────────────────────────────

  it('zoomIn works when zoomStatus is null', async () => {
    const deps = makeLiveDeps();
    deps.els.zoomStatus = null;
    deps.state.zoom = 1.0;
    initNavigation(deps);
    deps.els.zoomIn.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.zoom, 1.1);
  });

  it('zoomOut works when zoomStatus is null', async () => {
    const deps = makeLiveDeps();
    deps.els.zoomStatus = null;
    deps.state.zoom = 1.0;
    initNavigation(deps);
    deps.els.zoomOut.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(deps.state.zoom, 0.9);
  });

  it('ctrl+wheel works when zoomStatus is null', async () => {
    const deps = makeLiveDeps();
    deps.els.zoomStatus = null;
    deps.state.zoom = 1.0;
    initNavigation(deps);

    const wheelEvent = Object.assign(new Event('wheel'), {
      ctrlKey: true,
      deltaY: -100,
      preventDefault: mock.fn(),
    });
    deps.els.canvasWrap.dispatchEvent(wheelEvent);
    await new Promise(r => setTimeout(r, 50));

    assert.ok(deps.state.zoom > 1.0);
  });
});
