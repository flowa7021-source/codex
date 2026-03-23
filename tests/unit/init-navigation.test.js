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
    ...overrides,
  };
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
});
