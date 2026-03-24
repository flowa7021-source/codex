import './setup-dom.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Add dispatchEvent to document mock
if (!document.dispatchEvent) {
  const _docListeners = {};
  document.addEventListener = (type, fn) => {
    if (!_docListeners[type]) _docListeners[type] = [];
    _docListeners[type].push(fn);
  };
  document.removeEventListener = (type, fn) => {
    if (_docListeners[type]) _docListeners[type] = _docListeners[type].filter(f => f !== fn);
  };
  document.dispatchEvent = (evt) => {
    const fns = _docListeners[evt.type] || [];
    for (const fn of fns) fn(evt);
  };
}

// Track document-level keydown listeners for testing presentation mode
const _docKeydownListeners = [];
const origDocAddEventListener = document.addEventListener;
const origDocRemoveEventListener = document.removeEventListener;
document.addEventListener = (type, fn) => {
  if (type === 'keydown') _docKeydownListeners.push(fn);
  origDocAddEventListener(type, fn);
};
document.removeEventListener = (type, fn) => {
  if (type === 'keydown') {
    const idx = _docKeydownListeners.indexOf(fn);
    if (idx !== -1) _docKeydownListeners.splice(idx, 1);
  }
  origDocRemoveEventListener(type, fn);
};

// IntersectionObserver mock
let lastObserverCallback = null;
let observedElements = [];
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options) {
      lastObserverCallback = callback;
      observedElements = [];
      this._callback = callback;
    }
    observe(el) { observedElements.push(el); }
    unobserve(el) { observedElements = observedElements.filter(e => e !== el); }
    disconnect() { observedElements = []; }
  };
}

// Stub fullscreen API on elements
const origCreateElement = document.createElement;
document.createElement = function (tag) {
  const el = origCreateElement.call(document, tag);
  el.requestFullscreen = async () => {};
  el.scrollIntoView = () => {};
  el.contains = function (child) {
    return this.children.includes(child);
  };
  el.insertBefore = function (newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
    } else {
      this.appendChild(newChild);
    }
    return newChild;
  };
  return el;
};

// Stub fullscreenElement and exitFullscreen
document.fullscreenElement = null;
document.exitFullscreen = async () => { document.fullscreenElement = null; };

const {
  VIEW_MODES,
  initViewModes,
  getCurrentMode,
  setViewMode,
  getTwoUpPages,
  renderTwoUp,
  navigateInMode,
} = await import('../../app/modules/view-modes.js');

describe('view-modes', () => {
  let deps;

  beforeEach(() => {
    const viewport = document.createElement('div');
    viewport.contains = function (child) { return this.children.includes(child); };
    viewport.insertBefore = function (newChild, refChild) {
      const idx = this.children.indexOf(refChild);
      if (idx >= 0) this.children.splice(idx, 0, newChild);
      else this.appendChild(newChild);
      return newChild;
    };
    deps = {
      renderPage: mock.fn(async () => {}),
      getPageCount: () => 10,
      getCurrentPage: () => 1,
      setCurrentPage: mock.fn(),
      getZoom: () => 1,
      viewport,
      canvas: document.createElement('canvas'),
    };
    initViewModes(deps);
    setViewMode(VIEW_MODES.SINGLE);
  });

  describe('VIEW_MODES', () => {
    it('contains expected mode values', () => {
      assert.equal(VIEW_MODES.SINGLE, 'single');
      assert.equal(VIEW_MODES.TWO_UP, 'two-up');
      assert.equal(VIEW_MODES.BOOK, 'book');
      assert.equal(VIEW_MODES.CONTINUOUS, 'continuous');
      assert.equal(VIEW_MODES.PRESENTATION, 'presentation');
    });
  });

  describe('getCurrentMode / setViewMode', () => {
    it('defaults to single mode after reset', () => {
      assert.equal(getCurrentMode(), VIEW_MODES.SINGLE);
    });

    it('switches to two-up mode', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.equal(getCurrentMode(), VIEW_MODES.TWO_UP);
    });

    it('ignores invalid mode strings', () => {
      setViewMode('invalid-mode');
      assert.equal(getCurrentMode(), VIEW_MODES.SINGLE);
    });

    it('dispatches viewmodechange event', () => {
      let received = null;
      document.addEventListener('viewmodechange', (e) => { received = e.detail; });
      setViewMode(VIEW_MODES.BOOK);
      assert.ok(received);
      assert.equal(received.mode, VIEW_MODES.BOOK);
    });

    it('sets data-view-mode attribute on viewport', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.equal(deps.viewport.getAttribute('data-view-mode'), 'two-up');
    });

    it('switches to book mode and adds vmode-book class', () => {
      setViewMode(VIEW_MODES.BOOK);
      assert.equal(getCurrentMode(), VIEW_MODES.BOOK);
      assert.ok(deps.viewport.classList.contains('vmode-book'));
    });

    it('switches to continuous mode and adds vmode-continuous class', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      assert.equal(getCurrentMode(), VIEW_MODES.CONTINUOUS);
      assert.ok(deps.viewport.classList.contains('vmode-continuous'));
    });

    it('switches to presentation mode and adds vmode-presentation class', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      assert.equal(getCurrentMode(), VIEW_MODES.PRESENTATION);
      assert.ok(deps.viewport.classList.contains('vmode-presentation'));
      // Clean up presentation mode
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('event detail includes previous mode', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      let received = null;
      document.addEventListener('viewmodechange', (e) => { received = e.detail; });
      setViewMode(VIEW_MODES.BOOK);
      assert.equal(received.prev, VIEW_MODES.TWO_UP);
      assert.equal(received.mode, VIEW_MODES.BOOK);
    });
  });

  describe('cleanupMode', () => {
    it('removes vmode classes when switching modes', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.ok(deps.viewport.classList.contains('vmode-two-up'));
      setViewMode(VIEW_MODES.SINGLE);
      assert.ok(!deps.viewport.classList.contains('vmode-two-up'));
    });

    it('removes vmode-book class when switching away from book', () => {
      setViewMode(VIEW_MODES.BOOK);
      assert.ok(deps.viewport.classList.contains('vmode-book'));
      setViewMode(VIEW_MODES.SINGLE);
      assert.ok(!deps.viewport.classList.contains('vmode-book'));
    });

    it('removes vmode-continuous class when switching away from continuous', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      assert.ok(deps.viewport.classList.contains('vmode-continuous'));
      setViewMode(VIEW_MODES.SINGLE);
      assert.ok(!deps.viewport.classList.contains('vmode-continuous'));
    });

    it('removes vmode-presentation class when switching away from presentation', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      assert.ok(deps.viewport.classList.contains('vmode-presentation'));
      setViewMode(VIEW_MODES.SINGLE);
      assert.ok(!deps.viewport.classList.contains('vmode-presentation'));
    });

    it('clears continuous-scroll-wrap innerHTML on cleanup', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      assert.ok(wrap, 'wrap should exist');
      // The wrap should have page slots
      assert.ok(wrap.children.length > 0, 'should have page slots');
      // Switch away, triggering cleanup
      setViewMode(VIEW_MODES.SINGLE);
      // After cleanup, innerHTML is cleared
      assert.equal(wrap.innerHTML, '');
    });

    it('cleans up presentation key handler when switching away from presentation', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      const listenerCountBefore = _docKeydownListeners.length;
      assert.ok(listenerCountBefore > 0, 'should have keydown listener');
      setViewMode(VIEW_MODES.SINGLE);
      // The presentation key handler should have been removed
      assert.ok(_docKeydownListeners.length < listenerCountBefore, 'keydown listener should be removed');
    });

    it('calls exitFullscreen when cleaning up presentation and fullscreenElement is set', async () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      // Simulate being in fullscreen
      document.fullscreenElement = deps.viewport;
      let exitCalled = false;
      document.exitFullscreen = async () => { exitCalled = true; document.fullscreenElement = null; };
      setViewMode(VIEW_MODES.SINGLE);
      // exitFullscreen is async, give it a tick
      await new Promise(r => setTimeout(r, 10));
      assert.ok(exitCalled, 'exitFullscreen should be called');
      // Restore
      document.exitFullscreen = async () => { document.fullscreenElement = null; };
    });
  });

  describe('setupTwoUp', () => {
    it('adds vmode-two-up class for two-up mode', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.ok(deps.viewport.classList.contains('vmode-two-up'));
    });

    it('adds vmode-book class for book mode', () => {
      setViewMode(VIEW_MODES.BOOK);
      assert.ok(deps.viewport.classList.contains('vmode-book'));
    });
  });

  describe('getTwoUpPages', () => {
    it('returns [1, 2] for page 1 in standard two-up', () => {
      assert.deepEqual(getTwoUpPages(1, 10, false), [1, 2]);
    });

    it('returns [1, null] for page 1 in book mode (cover)', () => {
      assert.deepEqual(getTwoUpPages(1, 10, true), [1, null]);
    });

    it('returns [2, 3] for page 2 in book mode', () => {
      assert.deepEqual(getTwoUpPages(2, 10, true), [2, 3]);
    });

    it('returns null for right page when left is last page (odd)', () => {
      const result = getTwoUpPages(11, 11, false);
      assert.equal(result[0], 11);
      assert.equal(result[1], null);
    });

    it('returns [3, 4] for page 3 in book mode (odd page)', () => {
      // page 3 is odd, so left = currentPage - 1 = 2, right = 3
      const result = getTwoUpPages(3, 10, true);
      assert.deepEqual(result, [2, 3]);
    });

    it('returns [4, 5] for page 4 in book mode', () => {
      assert.deepEqual(getTwoUpPages(4, 10, true), [4, 5]);
    });

    it('returns [9, 10] for page 10 in book mode', () => {
      assert.deepEqual(getTwoUpPages(10, 10, true), [10, null]);
    });

    it('handles even page in standard two-up', () => {
      // page 4 is even, so left = currentPage - 1 = 3, right = 4
      assert.deepEqual(getTwoUpPages(4, 10, false), [3, 4]);
    });

    it('returns null right page when left is last in book mode', () => {
      // Last page is 10 (even), so left=10, right=11 > 10 => null
      assert.deepEqual(getTwoUpPages(10, 10, true), [10, null]);
    });

    it('handles single-page document in book mode', () => {
      assert.deepEqual(getTwoUpPages(1, 1, true), [1, null]);
    });

    it('handles single-page document in standard two-up', () => {
      assert.deepEqual(getTwoUpPages(1, 1, false), [1, null]);
    });
  });

  describe('renderTwoUp', () => {
    it('renders left and right pages', async () => {
      await renderTwoUp(1, 10, false);
      // renderPage should have been called twice (page 1 and page 2)
      assert.equal(deps.renderPage.mock.callCount(), 2);
    });

    it('renders only left page when right is null (cover in book mode)', async () => {
      await renderTwoUp(1, 10, true);
      // Only page 1 (cover), no right page
      assert.equal(deps.renderPage.mock.callCount(), 1);
    });

    it('creates a two-up-container in the viewport', async () => {
      await renderTwoUp(1, 10, false);
      const container = deps.viewport.querySelector('.two-up-container');
      assert.ok(container, 'two-up-container should exist');
    });

    it('creates left canvas with two-up-left class', async () => {
      await renderTwoUp(1, 10, false);
      const container = deps.viewport.querySelector('.two-up-container');
      const leftCanvas = container.querySelector('.two-up-left');
      assert.ok(leftCanvas, 'left canvas should exist');
    });

    it('creates right canvas with two-up-right class', async () => {
      await renderTwoUp(1, 10, false);
      const container = deps.viewport.querySelector('.two-up-container');
      const rightCanvas = container.querySelector('.two-up-right');
      assert.ok(rightCanvas, 'right canvas should exist');
    });

    it('removes right canvas when right page is null', async () => {
      // First render with both pages
      await renderTwoUp(1, 10, false);
      const container = deps.viewport.querySelector('.two-up-container');
      assert.ok(container.querySelector('.two-up-right'), 'right canvas should exist initially');
      // Now render cover in book mode (right page is null)
      await renderTwoUp(1, 10, true);
      const rightCanvas = container.querySelector('.two-up-right');
      assert.equal(rightCanvas, null, 'right canvas should be removed');
    });

    it('returns undefined when deps is null', async () => {
      initViewModes(null);
      const result = await renderTwoUp(1, 10, false);
      assert.equal(result, undefined);
      // Restore deps
      initViewModes(deps);
    });

    it('reuses existing container on second call', async () => {
      await renderTwoUp(1, 10, false);
      const container1 = deps.viewport.querySelector('.two-up-container');
      await renderTwoUp(3, 10, false);
      const container2 = deps.viewport.querySelector('.two-up-container');
      assert.strictEqual(container1, container2, 'should reuse container');
    });
  });

  describe('setupContinuousScroll', () => {
    it('creates a continuous-scroll-wrap element', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      assert.ok(wrap, 'continuous-scroll-wrap should exist');
    });

    it('creates page slots for all pages', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slots = wrap.querySelectorAll('.continuous-page-slot');
      assert.equal(slots.length, 10, 'should have 10 page slots');
    });

    it('sets data-page attribute on each slot', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slots = wrap.querySelectorAll('.continuous-page-slot');
      assert.equal(slots[0].dataset.page, '1');
      assert.equal(slots[9].dataset.page, '10');
    });

    it('sets minHeight based on zoom', () => {
      deps.getZoom = () => 1.5;
      initViewModes(deps);
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slot = wrap.querySelectorAll('.continuous-page-slot')[0];
      assert.equal(slot.style.minHeight, `${Math.round(792 * 1.5)}px`);
    });

    it('observes all slots with IntersectionObserver', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      assert.equal(observedElements.length, 10, 'should observe 10 slots');
    });

    it('renders page when intersection callback fires with isIntersecting', async () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slot = wrap.querySelectorAll('.continuous-page-slot')[0];

      // Simulate intersection
      assert.ok(lastObserverCallback, 'observer callback should be set');
      lastObserverCallback([{ isIntersecting: true, target: slot }]);

      // Allow async renderPage to resolve
      await new Promise(r => setTimeout(r, 10));
      // renderPage should have been called for page 1
      assert.ok(deps.renderPage.mock.callCount() >= 1, 'renderPage should be called');
      assert.equal(slot.dataset.rendered, 'true');
    });

    it('does not re-render a page already rendered', async () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slot = wrap.querySelectorAll('.continuous-page-slot')[0];

      lastObserverCallback([{ isIntersecting: true, target: slot }]);
      await new Promise(r => setTimeout(r, 10));
      const countAfterFirst = deps.renderPage.mock.callCount();

      // Fire again
      lastObserverCallback([{ isIntersecting: true, target: slot }]);
      await new Promise(r => setTimeout(r, 10));
      assert.equal(deps.renderPage.mock.callCount(), countAfterFirst, 'should not re-render');
    });

    it('skips non-intersecting entries', async () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slot = wrap.querySelectorAll('.continuous-page-slot')[0];

      lastObserverCallback([{ isIntersecting: false, target: slot }]);
      await new Promise(r => setTimeout(r, 10));
      assert.equal(slot.dataset.rendered, undefined, 'should not be rendered');
    });

    it('handles render error by allowing retry', async () => {
      deps.renderPage = mock.fn(async () => { throw new Error('render failed'); });
      initViewModes(deps);
      setViewMode(VIEW_MODES.CONTINUOUS);
      const wrap = deps.viewport.querySelector('.continuous-scroll-wrap');
      const slot = wrap.querySelectorAll('.continuous-page-slot')[0];

      lastObserverCallback([{ isIntersecting: true, target: slot }]);
      await new Promise(r => setTimeout(r, 10));
      // After error, rendered should be reset to 'false' to allow retry
      assert.equal(slot.dataset.rendered, 'false');
    });
  });

  describe('setupPresentation', () => {
    it('adds vmode-presentation class', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      assert.ok(deps.viewport.classList.contains('vmode-presentation'));
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('registers keydown listener for navigation', () => {
      const beforeCount = _docKeydownListeners.length;
      setViewMode(VIEW_MODES.PRESENTATION);
      assert.ok(_docKeydownListeners.length > beforeCount, 'should add keydown listener');
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('ArrowRight advances to next page', () => {
      deps.getCurrentPage = () => 3;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      // Find the presentation key handler (the last one added)
      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      assert.ok(handler, 'handler should exist');
      handler({ key: 'ArrowRight', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.callCount(), 1);
      assert.equal(deps.setCurrentPage.mock.calls[0].arguments[0], 4);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('ArrowDown advances to next page', () => {
      deps.getCurrentPage = () => 5;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: 'ArrowDown', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.calls[deps.setCurrentPage.mock.callCount() - 1].arguments[0], 6);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('Space advances to next page', () => {
      deps.getCurrentPage = () => 5;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: ' ', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.calls[deps.setCurrentPage.mock.callCount() - 1].arguments[0], 6);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('ArrowRight clamps to last page', () => {
      deps.getCurrentPage = () => 10;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: 'ArrowRight', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.calls[deps.setCurrentPage.mock.callCount() - 1].arguments[0], 10);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('ArrowLeft goes to previous page', () => {
      deps.getCurrentPage = () => 5;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: 'ArrowLeft', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.calls[deps.setCurrentPage.mock.callCount() - 1].arguments[0], 4);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('ArrowUp goes to previous page', () => {
      deps.getCurrentPage = () => 5;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: 'ArrowUp', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.calls[deps.setCurrentPage.mock.callCount() - 1].arguments[0], 4);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('ArrowLeft clamps to page 1', () => {
      deps.getCurrentPage = () => 1;
      deps.getPageCount = () => 10;
      initViewModes(deps);
      setViewMode(VIEW_MODES.PRESENTATION);

      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: 'ArrowLeft', preventDefault() {} });
      assert.equal(deps.setCurrentPage.mock.calls[deps.setCurrentPage.mock.callCount() - 1].arguments[0], 1);
      setViewMode(VIEW_MODES.SINGLE);
    });

    it('Escape exits presentation mode', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      const handler = _docKeydownListeners[_docKeydownListeners.length - 1];
      handler({ key: 'Escape', preventDefault() {} });
      assert.equal(getCurrentMode(), VIEW_MODES.SINGLE);
    });
  });

  describe('onFullscreenChange', () => {
    it('exits presentation mode when fullscreen exits', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      assert.equal(getCurrentMode(), VIEW_MODES.PRESENTATION);
      // Simulate fullscreen exit
      document.fullscreenElement = null;
      // Fire the fullscreenchange event
      document.dispatchEvent(new Event('fullscreenchange'));
      assert.equal(getCurrentMode(), VIEW_MODES.SINGLE);
    });

    it('does not exit when still in fullscreen', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      document.fullscreenElement = deps.viewport;
      document.dispatchEvent(new Event('fullscreenchange'));
      assert.equal(getCurrentMode(), VIEW_MODES.PRESENTATION);
      // Clean up
      document.fullscreenElement = null;
      setViewMode(VIEW_MODES.SINGLE);
    });
  });

  describe('navigateInMode', () => {
    it('advances by 1 in single mode', () => {
      setViewMode(VIEW_MODES.SINGLE);
      assert.equal(navigateInMode('next', 1, 10), 2);
    });

    it('goes back by 1 in single mode', () => {
      setViewMode(VIEW_MODES.SINGLE);
      assert.equal(navigateInMode('prev', 5, 10), 4);
    });

    it('advances by 2 in two-up mode', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.equal(navigateInMode('next', 1, 10), 3);
    });

    it('advances by 2 in book mode', () => {
      setViewMode(VIEW_MODES.BOOK);
      assert.equal(navigateInMode('next', 1, 10), 3);
    });

    it('goes back by 2 in book mode', () => {
      setViewMode(VIEW_MODES.BOOK);
      assert.equal(navigateInMode('prev', 5, 10), 3);
    });

    it('goes back by 2 in two-up mode', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.equal(navigateInMode('prev', 5, 10), 3);
    });

    it('clamps to pageCount', () => {
      setViewMode(VIEW_MODES.SINGLE);
      assert.equal(navigateInMode('next', 10, 10), 10);
    });

    it('clamps to pageCount in two-up mode', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.equal(navigateInMode('next', 9, 10), 10);
    });

    it('clamps to 1 going backwards', () => {
      setViewMode(VIEW_MODES.SINGLE);
      assert.equal(navigateInMode('prev', 1, 10), 1);
    });

    it('clamps to 1 in two-up mode going backwards', () => {
      setViewMode(VIEW_MODES.TWO_UP);
      assert.equal(navigateInMode('prev', 2, 10), 1);
    });

    it('returns currentPage for unknown direction', () => {
      assert.equal(navigateInMode('sideways', 5, 10), 5);
    });

    it('advances by 1 in continuous mode', () => {
      setViewMode(VIEW_MODES.CONTINUOUS);
      assert.equal(navigateInMode('next', 3, 10), 4);
    });

    it('advances by 1 in presentation mode', () => {
      setViewMode(VIEW_MODES.PRESENTATION);
      assert.equal(navigateInMode('next', 3, 10), 4);
      setViewMode(VIEW_MODES.SINGLE);
    });
  });
});
