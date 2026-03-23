import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initAdvanced } from '../../app/modules/init-advanced.js';

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
});
