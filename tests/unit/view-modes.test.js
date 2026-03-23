import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
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
      // Page 9 in standard two-up: left=9, right=10; page 11 of 11: left=11, right=null
      const result = getTwoUpPages(11, 11, false);
      assert.equal(result[0], 11);
      assert.equal(result[1], null);
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

    it('clamps to pageCount', () => {
      setViewMode(VIEW_MODES.SINGLE);
      assert.equal(navigateInMode('next', 10, 10), 10);
    });

    it('clamps to 1 going backwards', () => {
      setViewMode(VIEW_MODES.SINGLE);
      assert.equal(navigateInMode('prev', 1, 10), 1);
    });

    it('returns currentPage for unknown direction', () => {
      assert.equal(navigateInMode('sideways', 5, 10), 5);
    });
  });
});
