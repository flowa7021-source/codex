// ─── Extended Unit Tests: Autosave Module ───────────────────────────────────
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  initAutosave,
  triggerAutosave,
  startAutosaveTimer,
  stopAutosaveTimer,
  applyRecoveredSnapshot,
  clearRecoveryData,
  markCleanExit,
} from '../../app/modules/autosave.js';

// ─── initAutosave ───────────────────────────────────────────────────────────

describe('initAutosave', () => {
  it('does not throw with valid deps', () => {
    assert.doesNotThrow(() => {
      initAutosave({
        state: { adapter: null, docName: '' },
        els: { canvasWrap: null },
        getAnnotations: () => [],
        setAnnotations: () => {},
        showToast: () => {},
      });
    });
  });

  it('accepts custom intervalMs', () => {
    assert.doesNotThrow(() => {
      initAutosave({
        state: { adapter: null, docName: '' },
        els: { canvasWrap: null },
        getAnnotations: () => [],
        setAnnotations: () => {},
        showToast: () => {},
        intervalMs: 5000,
      });
    });
  });
});

// ─── triggerAutosave ────────────────────────────────────────────────────────

describe('triggerAutosave', () => {
  beforeEach(() => {
    initAutosave({
      state: { adapter: null, docName: '' },
      els: { canvasWrap: null },
      getAnnotations: () => [],
      setAnnotations: () => {},
      showToast: () => {},
    });
  });

  it('does not throw when no document is open', async () => {
    await assert.doesNotReject(triggerAutosave());
  });
});

// ─── startAutosaveTimer / stopAutosaveTimer ─────────────────────────────────

describe('startAutosaveTimer / stopAutosaveTimer', () => {
  beforeEach(() => {
    initAutosave({
      state: { adapter: null, docName: '' },
      els: { canvasWrap: null },
      getAnnotations: () => [],
      setAnnotations: () => {},
      showToast: () => {},
    });
  });

  afterEach(() => {
    stopAutosaveTimer();
  });

  it('startAutosaveTimer does not throw', () => {
    assert.doesNotThrow(() => startAutosaveTimer());
  });

  it('stopAutosaveTimer does not throw even when not started', () => {
    assert.doesNotThrow(() => stopAutosaveTimer());
  });

  it('can start and stop multiple times', () => {
    assert.doesNotThrow(() => {
      startAutosaveTimer();
      stopAutosaveTimer();
      startAutosaveTimer();
      stopAutosaveTimer();
    });
  });
});

// ─── applyRecoveredSnapshot ─────────────────────────────────────────────────

describe('applyRecoveredSnapshot', () => {
  it('does nothing with null deps', () => {
    // Before init, deps is null
    assert.doesNotThrow(() => applyRecoveredSnapshot(null));
  });

  it('does nothing with null snapshot', () => {
    initAutosave({
      state: { adapter: null, docName: '' },
      els: { canvasWrap: null },
      getAnnotations: () => [],
      setAnnotations: () => {},
      showToast: () => {},
    });
    assert.doesNotThrow(() => applyRecoveredSnapshot(null));
  });

  it('applies valid snapshot to state', () => {
    const mockState = { adapter: true, docName: 'test', currentPage: 1, zoom: 1, rotation: 0 };
    const mockEls = { canvasWrap: { scrollTop: 0, scrollLeft: 0 } };
    let annotationsSet = false;
    let toastShown = false;

    initAutosave({
      state: mockState,
      els: mockEls,
      getAnnotations: () => [],
      setAnnotations: () => { annotationsSet = true; },
      showToast: () => { toastShown = true; },
    });

    applyRecoveredSnapshot({
      currentPage: 5,
      zoom: 2.0,
      rotation: 90,
      scrollPosition: { top: 100, left: 50 },
      annotations: [{ id: 1 }],
    });

    assert.equal(mockState.currentPage, 5);
    assert.equal(mockState.zoom, 2.0);
    assert.equal(mockState.rotation, 90);
    assert.ok(annotationsSet);
    assert.ok(toastShown);
  });

  it('skips invalid currentPage', () => {
    const mockState = { adapter: true, docName: 'test', currentPage: 3, zoom: 1, rotation: 0 };
    initAutosave({
      state: mockState,
      els: {},
      getAnnotations: () => [],
      setAnnotations: () => {},
      showToast: () => {},
    });

    applyRecoveredSnapshot({ currentPage: 0, zoom: -1 });
    assert.equal(mockState.currentPage, 3); // unchanged
    assert.equal(mockState.zoom, 1); // unchanged for invalid zoom
  });

  it('handles annotation restore failure gracefully', () => {
    const mockState = { adapter: true, docName: 'test', currentPage: 1, zoom: 1, rotation: 0 };
    initAutosave({
      state: mockState,
      els: {},
      getAnnotations: () => [],
      setAnnotations: () => { throw new Error('restore failed'); },
      showToast: () => {},
    });

    assert.doesNotThrow(() => {
      applyRecoveredSnapshot({ annotations: [{ id: 1 }] });
    });
  });
});

// ─── clearRecoveryData ──────────────────────────────────────────────────────

describe('clearRecoveryData', () => {
  it('does not throw', async () => {
    await assert.doesNotReject(clearRecoveryData());
  });

  it('clears localStorage fallback', async () => {
    localStorage.setItem('novareader-autosave-fallback', JSON.stringify([{ sessionId: 'test' }]));
    await clearRecoveryData();
    assert.equal(localStorage.getItem('novareader-autosave-fallback'), null);
  });
});

// ─── markCleanExit ──────────────────────────────────────────────────────────

describe('markCleanExit', () => {
  it('does not throw', async () => {
    initAutosave({
      state: { adapter: null, docName: '' },
      els: {},
      getAnnotations: () => [],
      setAnnotations: () => {},
      showToast: () => {},
    });
    await assert.doesNotReject(markCleanExit());
  });
});
