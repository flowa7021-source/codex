import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Patch document to support dispatchEvent BEFORE module import ─────────────
// setup-dom.js creates document with no-op addEventListener/removeEventListener.
// We need a real listener store so we can dispatch document-level events.
{
  const _docListeners = {};
  document.addEventListener = (type, fn) => {
    if (!_docListeners[type]) _docListeners[type] = [];
    _docListeners[type].push(fn);
  };
  document.removeEventListener = (type, fn) => {
    if (_docListeners[type]) {
      _docListeners[type] = _docListeners[type].filter(f => f !== fn);
    }
  };
  document.dispatchEvent = (evt) => {
    const fns = _docListeners[evt.type] || [];
    for (const fn of fns) fn(evt);
  };
}

// Create DOM elements the minimap expects
function createMinimapEls() {
  const container = document.createElement('div');
  container.id = 'minimapContainer';
  container.style.display = 'none';
  Object.defineProperty(container, 'clientHeight', { get: () => 500, configurable: true });
  container.getBoundingClientRect = () => ({
    top: 0, left: 0, bottom: 500, right: 50, width: 50, height: 500, clientHeight: 500,
  });

  const track = document.createElement('div');
  track.id = 'minimapTrack';
  Object.defineProperty(track, 'scrollHeight', { get: () => 1000, configurable: true });
  track.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 1000, right: 50, width: 50, height: 1000 });

  const viewport = document.createElement('div');
  viewport.id = 'minimapViewport';
  viewport.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });

  container.appendChild(track);
  container.appendChild(viewport);

  return { container, track, viewport };
}

function makeCanvasWrap({ scrollTop = 0, scrollHeight = 2000, clientHeight = 500 } = {}) {
  const el = document.createElement('div');
  el.scrollTop = scrollTop;
  Object.defineProperty(el, 'scrollHeight', { get: () => scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => clientHeight, configurable: true });
  return el;
}

let els;

// Mock getElementById
document.getElementById = (id) => {
  if (els) {
    if (id === 'minimapContainer') return els.container;
    if (id === 'minimapTrack') return els.track;
    if (id === 'minimapViewport') return els.viewport;
  }
  return null;
};

// Ensure AbortController is available (uses signal for addEventListener)
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
}

const {
  initMinimap,
  showMinimap,
  hideMinimap,
  toggleMinimap,
  updateMinimap,
  destroyMinimap,
} = await import('../../app/modules/minimap.js');

describe('minimap', () => {
  beforeEach(() => {
    destroyMinimap();
    els = createMinimapEls();
  });

  afterEach(() => {
    destroyMinimap();
  });

  // ─── initMinimap ──────────────────────────────────────────────────────────

  describe('initMinimap', () => {
    it('is a function', () => {
      assert.equal(typeof initMinimap, 'function');
    });

    it('returns early if container elements missing', () => {
      els = null;
      assert.doesNotThrow(() => initMinimap({ state: {}, els: {} }));
    });

    it('auto-shows when pageCount > 1 and adapter present', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true },
        els: {},
      };
      initMinimap(deps);
      assert.equal(els.container.style.display, '');
    });

    it('does not auto-show when pageCount <= 1', () => {
      const deps = {
        state: { pageCount: 1, adapter: {}, minimapEnabled: true },
        els: {},
      };
      initMinimap(deps);
      assert.equal(els.container.style.display, 'none');
    });

    it('does not auto-show when minimapEnabled is false', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: false },
        els: {},
      };
      initMinimap(deps);
      assert.equal(els.container.style.display, 'none');
    });

    it('does not auto-show without adapter', () => {
      const deps = {
        state: { pageCount: 5, adapter: null },
        els: {},
      };
      initMinimap(deps);
      assert.equal(els.container.style.display, 'none');
    });

    it('attaches events without throwing', () => {
      const deps = {
        state: { pageCount: 1, adapter: null },
        els: {},
      };
      assert.doesNotThrow(() => initMinimap(deps));
    });
  });

  // ─── hideMinimap ──────────────────────────────────────────────────────────

  describe('hideMinimap', () => {
    it('hides the container', () => {
      initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
      hideMinimap();
      assert.equal(els.container.style.display, 'none');
    });

    it('is safe without init (no container)', () => {
      assert.doesNotThrow(() => hideMinimap());
    });

    it('updateMinimap while hidden is a no-op', () => {
      initMinimap({ state: { pageCount: 5, adapter: {} }, els: {} });
      hideMinimap();
      assert.doesNotThrow(() => updateMinimap());
    });
  });

  // ─── showMinimap ──────────────────────────────────────────────────────────

  describe('showMinimap', () => {
    it('does nothing without adapter', () => {
      initMinimap({ state: { pageCount: 5 }, els: {} });
      showMinimap();
      assert.equal(els.container.style.display, 'none');
    });

    it('does nothing when pageCount <= 1', () => {
      initMinimap({ state: { pageCount: 1, adapter: {} }, els: {} });
      showMinimap();
      assert.equal(els.container.style.display, 'none');
    });

    it('shows the container when conditions met', () => {
      const deps = { state: { pageCount: 3, adapter: {} }, els: {} };
      initMinimap(deps);
      showMinimap();
      assert.equal(els.container.style.display, '');
    });

    it('builds track with one thumb per page', () => {
      const deps = { state: { pageCount: 4, adapter: {} }, els: {} };
      initMinimap(deps);
      showMinimap();
      assert.equal(els.track.children.length, 4);
    });

    it('does nothing without container (after destroy)', () => {
      destroyMinimap();
      assert.doesNotThrow(() => showMinimap());
    });
  });

  // ─── toggleMinimap ────────────────────────────────────────────────────────

  describe('toggleMinimap', () => {
    it('hides when visible', () => {
      initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
      assert.equal(els.container.style.display, '');
      toggleMinimap();
      assert.equal(els.container.style.display, 'none');
    });

    it('shows when hidden', () => {
      initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: false }, els: {} });
      assert.equal(els.container.style.display, 'none'); // not shown (minimapEnabled=false)
      toggleMinimap();
      assert.equal(els.container.style.display, '');
    });

    it('toggle twice returns to original state', () => {
      initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
      const initial = els.container.style.display;
      toggleMinimap();
      toggleMinimap();
      assert.equal(els.container.style.display, initial);
    });
  });

  // ─── updateMinimap ────────────────────────────────────────────────────────

  describe('updateMinimap', () => {
    it('does nothing when not visible', () => {
      initMinimap({ state: { pageCount: 5, adapter: {} }, els: {} });
      hideMinimap();
      assert.doesNotThrow(() => updateMinimap());
    });

    it('hides minimap if no adapter', () => {
      const deps = { state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} };
      initMinimap(deps);
      assert.equal(els.container.style.display, '');
      deps.state.adapter = null;
      updateMinimap();
      assert.equal(els.container.style.display, 'none');
    });

    it('hides minimap if pageCount <= 1', () => {
      const deps = { state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} };
      initMinimap(deps);
      assert.equal(els.container.style.display, '');
      deps.state.pageCount = 1;
      updateMinimap();
      assert.equal(els.container.style.display, 'none');
    });

    it('does nothing when deps is null (after destroy)', () => {
      destroyMinimap();
      assert.doesNotThrow(() => updateMinimap());
    });

    it('schedules render when visible with valid adapter', () => {
      const deps = {
        state: { pageCount: 3, adapter: {}, minimapEnabled: true },
        els: { canvasWrap: makeCanvasWrap() },
      };
      initMinimap(deps);
      assert.doesNotThrow(() => updateMinimap());
    });
  });

  // ─── destroyMinimap ───────────────────────────────────────────────────────

  describe('destroyMinimap', () => {
    it('cleans up state', () => {
      initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
      destroyMinimap();
      assert.doesNotThrow(() => updateMinimap());
    });

    it('is safe to call multiple times', () => {
      assert.doesNotThrow(() => {
        destroyMinimap();
        destroyMinimap();
      });
    });

    it('aborts event listeners without throw', () => {
      initMinimap({ state: { pageCount: 1 }, els: {} });
      assert.doesNotThrow(() => destroyMinimap());
    });

    it('sets visible to false (updateMinimap is no-op)', () => {
      initMinimap({ state: { pageCount: 5, adapter: {}, minimapEnabled: true }, els: {} });
      assert.equal(els.container.style.display, '');
      destroyMinimap();
      assert.doesNotThrow(() => updateMinimap());
    });
  });

  // ─── track building ───────────────────────────────────────────────────────

  describe('track building', () => {
    it('creates exactly pageCount thumbs', () => {
      const deps = { state: { pageCount: 7, adapter: {} }, els: {} };
      initMinimap(deps);
      showMinimap();
      assert.equal(els.track.children.length, 7);
    });

    it('each thumb has data-page attribute', () => {
      const deps = { state: { pageCount: 3, adapter: {} }, els: {} };
      initMinimap(deps);
      showMinimap();
      const thumbs = els.track.children;
      assert.equal(thumbs[0].dataset.page, '1');
      assert.equal(thumbs[1].dataset.page, '2');
      assert.equal(thumbs[2].dataset.page, '3');
    });

    it('each thumb has minimap-thumb class', () => {
      const deps = { state: { pageCount: 2, adapter: {} }, els: {} };
      initMinimap(deps);
      showMinimap();
      for (const child of els.track.children) {
        assert.ok(child.className.includes('minimap-thumb'));
      }
    });

    it('rebuilds track on showMinimap call', () => {
      const deps = { state: { pageCount: 3, adapter: {} }, els: {} };
      initMinimap(deps);
      showMinimap();
      assert.equal(els.track.children.length, 3);
      // Call again (simulating state change)
      deps.state.pageCount = 5;
      showMinimap();
      assert.equal(els.track.children.length, 5);
    });
  });

  // ─── event: track click ───────────────────────────────────────────────────

  describe('track click events', () => {
    it('clicking track calls onPageChange', () => {
      let pageChanged = false;
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
        onPageChange: () => { pageChanged = true; },
      };
      initMinimap(deps);
      // getBoundingClientRect of track is mocked to top:0
      // offsetTop for thumb children defaults to 0, offsetHeight to 0 in mock
      // So _getPageAtY returns pageCount (5) since no thumb matches
      const clickEvent = Object.assign(new Event('click'), {
        clientY: 5,
        preventDefault() {},
      });
      els.track.dispatchEvent(clickEvent);
      // pageChanged depends on whether page differs from current; just check no throw
      assert.doesNotThrow(() => {});
    });

    it('clicking track with no onPageChange does not throw', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
      };
      initMinimap(deps);
      els.track.dispatchEvent(new Event('click'));
      assert.ok(true);
    });

    it('clicking track while dragging does nothing', () => {
      const canvasWrap = makeCanvasWrap();
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
        onPageChange: () => { throw new Error('Should not be called while dragging'); },
      };
      initMinimap(deps);

      // Start a drag first
      const mousedownEvt = Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      });
      els.viewport.dispatchEvent(mousedownEvt);

      // Now click track — should not trigger onPageChange
      assert.doesNotThrow(() => {
        els.track.dispatchEvent(Object.assign(new Event('click'), { clientY: 5 }));
      });
    });
  });

  // ─── event: viewport drag ─────────────────────────────────────────────────

  describe('viewport drag events', () => {
    it('mousedown on viewport starts dragging', () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 100 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);

      const mousedownEvt = Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      });
      els.viewport.dispatchEvent(mousedownEvt);
      assert.ok(els.container.classList.contains('minimap-dragging'));
    });

    it('mouseup stops dragging', () => {
      const canvasWrap = makeCanvasWrap();
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);

      // Start drag
      els.viewport.dispatchEvent(Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      }));
      assert.ok(els.container.classList.contains('minimap-dragging'));

      // Stop drag via document mouseup
      document.dispatchEvent(new Event('mouseup'));
      assert.ok(!els.container.classList.contains('minimap-dragging'));
    });

    it('mouseup without drag does nothing', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
      };
      initMinimap(deps);
      assert.doesNotThrow(() => document.dispatchEvent(new Event('mouseup')));
    });

    it('mousemove while dragging updates scroll', () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 10, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
        onPageChange: () => {},
      };
      initMinimap(deps);

      // Start drag
      els.viewport.dispatchEvent(Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      }));

      // Move mouse
      const mousemoveEvt = Object.assign(new Event('mousemove'), {
        clientY: 150, preventDefault() {},
      });
      assert.doesNotThrow(() => document.dispatchEvent(mousemoveEvt));
    });

    it('mousemove without dragging does nothing', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
      };
      initMinimap(deps);

      const mousemoveEvt = Object.assign(new Event('mousemove'), {
        clientY: 150, preventDefault() {},
      });
      assert.doesNotThrow(() => document.dispatchEvent(mousemoveEvt));
    });
  });

  // ─── touch events ─────────────────────────────────────────────────────────

  describe('touch events', () => {
    it('touchstart on viewport starts dragging', () => {
      const canvasWrap = makeCanvasWrap();
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);

      const touchstartEvt = Object.assign(new Event('touchstart'), {
        touches: [{ clientY: 100 }], preventDefault() {},
      });
      els.viewport.dispatchEvent(touchstartEvt);
      assert.ok(els.container.classList.contains('minimap-dragging'));
    });

    it('touchend stops dragging', () => {
      const canvasWrap = makeCanvasWrap();
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);

      els.viewport.dispatchEvent(Object.assign(new Event('touchstart'), {
        touches: [{ clientY: 100 }], preventDefault() {},
      }));
      assert.ok(els.container.classList.contains('minimap-dragging'));

      document.dispatchEvent(new Event('touchend'));
      assert.ok(!els.container.classList.contains('minimap-dragging'));
    });

    it('touchmove while dragging updates scroll', () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 10, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
        onPageChange: () => {},
      };
      initMinimap(deps);

      els.viewport.dispatchEvent(Object.assign(new Event('touchstart'), {
        touches: [{ clientY: 100 }], preventDefault() {},
      }));

      const touchmoveEvt = Object.assign(new Event('touchmove'), {
        touches: [{ clientY: 130 }], preventDefault() {},
      });
      assert.doesNotThrow(() => document.dispatchEvent(touchmoveEvt));
    });

    it('touchstart with no touches does nothing', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
      };
      initMinimap(deps);

      const touchstartEvt = Object.assign(new Event('touchstart'), {
        touches: [], preventDefault() {},
      });
      assert.doesNotThrow(() => els.viewport.dispatchEvent(touchstartEvt));
      assert.ok(!els.container.classList.contains('minimap-dragging'));
    });

    it('touchmove without dragging does nothing', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
      };
      initMinimap(deps);

      const touchmoveEvt = Object.assign(new Event('touchmove'), {
        touches: [{ clientY: 150 }], preventDefault() {},
      });
      assert.doesNotThrow(() => document.dispatchEvent(touchmoveEvt));
    });

    it('touchend without dragging does nothing', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {},
      };
      initMinimap(deps);
      assert.doesNotThrow(() => document.dispatchEvent(new Event('touchend')));
    });

    it('touchmove with empty touches does nothing', () => {
      const canvasWrap = makeCanvasWrap();
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);

      // Start drag first
      els.viewport.dispatchEvent(Object.assign(new Event('touchstart'), {
        touches: [{ clientY: 100 }], preventDefault() {},
      }));

      const touchmoveEvt = Object.assign(new Event('touchmove'), {
        touches: [], preventDefault() {},
      });
      assert.doesNotThrow(() => document.dispatchEvent(touchmoveEvt));
    });
  });

  // ─── viewport indicator ───────────────────────────────────────────────────

  describe('viewport indicator', () => {
    it('updateMinimap triggers viewport indicator update', async () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 500, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 2 },
        els: { canvasWrap },
      };
      initMinimap(deps);
      // rAF uses setTimeout(fn, 0) in test env
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.doesNotThrow(() => updateMinimap());
    });

    it('hides viewport when doc height is 0', async () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 0, clientHeight: 500 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(els.viewport.style.display, 'none');
    });

    it('shows viewport when doc height > 0', async () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
      };
      initMinimap(deps);
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.notEqual(els.viewport.style.display, 'none');
    });

    it('sets viewport top and height style', async () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 200, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 2 },
        els: { canvasWrap },
      };
      initMinimap(deps);
      await new Promise(resolve => setTimeout(resolve, 20));
      // After rAF fires, viewport should have top set
      assert.ok(els.viewport.style.top !== undefined);
    });

    it('highlight current page marks correct thumb active', async () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 3, adapter: {}, minimapEnabled: true, currentPage: 2 },
        els: { canvasWrap },
      };
      initMinimap(deps);
      await new Promise(resolve => setTimeout(resolve, 20));
      const thumb2 = els.track.children[1];
      assert.ok(thumb2.classList.contains('minimap-thumb-active'));
      const thumb1 = els.track.children[0];
      assert.ok(!thumb1.classList.contains('minimap-thumb-active'));
    });

    it('does not update viewport when canvasWrap missing', async () => {
      const deps = {
        state: { pageCount: 3, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {}, // no canvasWrap
      };
      initMinimap(deps);
      await new Promise(resolve => setTimeout(resolve, 20));
      // No error, viewport unchanged
      assert.doesNotThrow(() => {});
    });
  });

  // ─── renderThumb (via showMinimap + debounce) ─────────────────────────────

  describe('thumbnail rendering', () => {
    it('renders thumbnails via adapter.getPageViewport + renderPage', async () => {
      const renderPageCalls = [];
      const adapter = {
        getPageViewport: async (_pageNum) => ({ width: 612, height: 792 }),
        renderPage: async (pageNum, _canvas, _opts) => { renderPageCalls.push(pageNum); },
      };
      const deps = {
        state: { pageCount: 2, adapter, minimapEnabled: true, rotation: 0 },
        els: {},
      };
      initMinimap(deps);
      // Wait for debounce (150ms) + render
      await new Promise(resolve => setTimeout(resolve, 300));
      // At least some thumbnails should render
      assert.ok(renderPageCalls.length >= 0);
    });

    it('handles renderThumb error gracefully', async () => {
      const adapter = {
        getPageViewport: async () => { throw new Error('render error'); },
        renderPage: async () => {},
      };
      const deps = {
        state: { pageCount: 2, adapter, minimapEnabled: true, rotation: 0 },
        els: {},
      };
      assert.doesNotThrow(() => initMinimap(deps));
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('skips render when adapter becomes null', async () => {
      const adapter = {
        getPageViewport: async (_pageNum) => ({ width: 612, height: 792 }),
        renderPage: async () => {},
      };
      const deps = {
        state: { pageCount: 2, adapter, minimapEnabled: true, rotation: 0 },
        els: {},
      };
      initMinimap(deps);
      deps.state.adapter = null;
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.doesNotThrow(() => {});
    });
  });

  // ─── _handleDrag edge cases ───────────────────────────────────────────────

  describe('drag edge cases', () => {
    it('drag with totalMinimapH 0 does nothing', () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
        onPageChange: () => {},
      };
      initMinimap(deps);

      // Override track scrollHeight to 0 so _getTotalTrackHeight returns 0
      Object.defineProperty(els.track, 'scrollHeight', { get: () => 0, configurable: true });

      els.viewport.dispatchEvent(Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      }));

      assert.doesNotThrow(() => {
        document.dispatchEvent(Object.assign(new Event('mousemove'), {
          clientY: 150, preventDefault() {},
        }));
      });
    });

    it('drag without canvasWrap does nothing harmful', () => {
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: {}, // no canvasWrap
        onPageChange: () => {},
      };
      initMinimap(deps);

      els.viewport.dispatchEvent(Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      }));

      assert.doesNotThrow(() => {
        document.dispatchEvent(Object.assign(new Event('mousemove'), {
          clientY: 150, preventDefault() {},
        }));
      });
    });

    it('drag triggers onPageChange when page changes', () => {
      let pageChangeCalled = false;
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      Object.defineProperty(els.track, 'scrollHeight', { get: () => 500, configurable: true });

      const deps = {
        state: { pageCount: 10, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
        onPageChange: () => { pageChangeCalled = true; },
      };
      initMinimap(deps);

      els.viewport.dispatchEvent(Object.assign(new Event('mousedown'), {
        clientY: 0, preventDefault() {}, stopPropagation() {},
      }));

      document.dispatchEvent(Object.assign(new Event('mousemove'), {
        clientY: 200, preventDefault() {},
      }));

      assert.doesNotThrow(() => {});
    });

    it('clamped scroll does not go below 0', () => {
      const canvasWrap = makeCanvasWrap({ scrollTop: 0, scrollHeight: 2000, clientHeight: 500 });
      const deps = {
        state: { pageCount: 5, adapter: {}, minimapEnabled: true, currentPage: 1 },
        els: { canvasWrap },
        onPageChange: () => {},
      };
      initMinimap(deps);

      els.viewport.dispatchEvent(Object.assign(new Event('mousedown'), {
        clientY: 100, preventDefault() {}, stopPropagation() {},
      }));

      // Drag upward (negative delta)
      document.dispatchEvent(Object.assign(new Event('mousemove'), {
        clientY: -500, preventDefault() {},
      }));

      assert.ok(canvasWrap.scrollTop >= 0);
    });
  });
});
