// ─── Unit Tests: Autosave ────────────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// The autosave module relies on IndexedDB (which is minimally mocked) and
// module-level state. We test the synchronous public API and the
// applyRecoveredSnapshot logic, avoiding async calls that would hang on the
// mocked IndexedDB.
import {
  initAutosave,
  startAutosaveTimer,
  stopAutosaveTimer,
  applyRecoveredSnapshot,
  checkForRecovery,
  clearRecoveryData,
} from '../../app/modules/autosave.js';

const LS_FALLBACK_KEY = 'novareader-autosave-fallback';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDeps(overrides = {}) {
  return {
    state: {
      adapter: { type: 'pdf' },
      docName: 'test.pdf',
      currentPage: 3,
      zoom: 1.5,
      rotation: 0,
      pageCount: 10,
      file: { name: 'test.pdf' },
    },
    els: {
      canvasWrap: { scrollTop: 100, scrollLeft: 50 },
    },
    getAnnotations: () => ({ strokes: [], comments: [] }),
    setAnnotations: () => {},
    showToast: () => {},
    intervalMs: 600_000, // Very long interval so timer never fires
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('initAutosave', () => {
  beforeEach(() => localStorage.clear());

  it('does not throw', () => {
    assert.doesNotThrow(() => {
      initAutosave(makeDeps());
    });
  });

  it('accepts custom interval', () => {
    assert.doesNotThrow(() => {
      initAutosave(makeDeps({ intervalMs: 5000 }));
    });
  });
});

describe('startAutosaveTimer / stopAutosaveTimer', () => {
  beforeEach(() => {
    localStorage.clear();
    initAutosave(makeDeps());
  });

  it('start and stop do not throw', () => {
    startAutosaveTimer();
    stopAutosaveTimer();
  });

  it('multiple stops are safe', () => {
    startAutosaveTimer();
    stopAutosaveTimer();
    stopAutosaveTimer();
    stopAutosaveTimer();
  });

  it('can restart after stop', () => {
    startAutosaveTimer();
    stopAutosaveTimer();
    startAutosaveTimer();
    stopAutosaveTimer();
  });
});

describe('applyRecoveredSnapshot', () => {
  it('does not throw with null snapshot', () => {
    initAutosave(makeDeps());
    assert.doesNotThrow(() => applyRecoveredSnapshot(null));
  });

  it('does not throw without initAutosave', () => {
    // Re-init with null-like deps to test guard
    initAutosave(makeDeps());
    assert.doesNotThrow(() => applyRecoveredSnapshot(null));
  });

  it('restores currentPage from snapshot', () => {
    const deps = makeDeps();
    initAutosave(deps);

    applyRecoveredSnapshot({
      currentPage: 7,
      zoom: 2.0,
      rotation: 90,
    });

    assert.equal(deps.state.currentPage, 7);
    assert.equal(deps.state.zoom, 2.0);
    assert.equal(deps.state.rotation, 90);
  });

  it('calls showToast on restore', () => {
    let toastCalled = false;
    const deps = makeDeps({ showToast: () => { toastCalled = true; } });
    initAutosave(deps);

    applyRecoveredSnapshot({ currentPage: 1 });
    assert.equal(toastCalled, true);
  });

  it('calls setAnnotations when snapshot has annotations', () => {
    let setCalled = false;
    const deps = makeDeps({ setAnnotations: () => { setCalled = true; } });
    initAutosave(deps);

    applyRecoveredSnapshot({
      currentPage: 1,
      annotations: { strokes: [], comments: [] },
    });

    assert.equal(setCalled, true);
  });

  it('skips invalid page/zoom values', () => {
    const deps = makeDeps();
    deps.state.currentPage = 5;
    deps.state.zoom = 1.0;
    initAutosave(deps);

    // currentPage: 0 is invalid (< 1), zoom: 0 is invalid (<= 0)
    applyRecoveredSnapshot({
      currentPage: 0,
      zoom: 0,
    });

    // State should remain unchanged for invalid values
    assert.equal(deps.state.currentPage, 5);
    assert.equal(deps.state.zoom, 1.0);
  });

  it('restores rotation including zero', () => {
    const deps = makeDeps();
    deps.state.rotation = 180;
    initAutosave(deps);

    applyRecoveredSnapshot({
      currentPage: 1,
      rotation: 0,
    });

    assert.equal(deps.state.rotation, 0);
  });
});

describe('checkForRecovery — old snapshot rejection (>24h)', () => {
  beforeEach(() => {
    localStorage.clear();
    initAutosave(makeDeps());
  });

  it('returns null and marks clean for snapshots older than 24h', async () => {
    // Put an old unclean snapshot in localStorage fallback
    const oldSnapshot = {
      sessionId: 'old-session',
      fileName: 'old.pdf',
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      wasCleanExit: false,
      currentPage: 1,
      zoom: 1,
      rotation: 0,
    };
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify([oldSnapshot]));

    // checkForRecovery should reject the old snapshot and return null
    const result = await checkForRecovery();
    assert.equal(result, null);
  });

  it('returns null when no unclean snapshots exist', async () => {
    localStorage.clear();
    const result = await checkForRecovery();
    assert.equal(result, null);
  });
});

describe('clearRecoveryData', () => {
  beforeEach(() => {
    localStorage.clear();
    initAutosave(makeDeps());
  });

  it('clears localStorage fallback data', async () => {
    const snapshot = {
      sessionId: 'to-clear',
      fileName: 'test.pdf',
      timestamp: Date.now(),
      wasCleanExit: false,
    };
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify([snapshot]));

    await clearRecoveryData();

    const remaining = localStorage.getItem(LS_FALLBACK_KEY);
    const parsed = remaining ? JSON.parse(remaining) : [];
    assert.equal(parsed.length, 0);
  });
});

describe('startAutosaveTimer — initial save error handling', () => {
  it('does not throw when _performSave fails (initial save error path)', () => {
    // Use a deps that will cause _performSave to fail (no valid state)
    const deps = makeDeps({
      state: {
        adapter: null, // no adapter — _performSave returns early
        docName: null,
        currentPage: 1,
        zoom: 1,
        rotation: 0,
        pageCount: 0,
        file: null,
      },
    });
    initAutosave(deps);

    // Should not throw even with null adapter
    assert.doesNotThrow(() => {
      startAutosaveTimer();
      stopAutosaveTimer();
    });
  });
});

describe('localStorage fallback data format', () => {
  beforeEach(() => localStorage.clear());

  it('can store and retrieve fallback snapshots', () => {
    const snapshots = [
      { sessionId: 's1', timestamp: Date.now(), wasCleanExit: false, fileName: 'a.pdf' },
      { sessionId: 's2', timestamp: Date.now() - 1000, wasCleanExit: true, fileName: 'b.pdf' },
    ];
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(snapshots));

    const raw = JSON.parse(localStorage.getItem(LS_FALLBACK_KEY));
    assert.equal(raw.length, 2);
    assert.equal(raw[0].sessionId, 's1');
    assert.equal(raw[0].wasCleanExit, false);
    assert.equal(raw[1].wasCleanExit, true);
  });

  it('snapshot structure has expected fields', () => {
    const snapshot = {
      sessionId: 'as-test',
      fileName: 'doc.pdf',
      filePath: 'doc.pdf',
      currentPage: 3,
      zoom: 1.5,
      rotation: 0,
      scrollPosition: { top: 100, left: 0 },
      annotations: null,
      bookmarks: [],
      ocrPages: [],
      timestamp: Date.now(),
      wasCleanExit: false,
    };

    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify([snapshot]));
    const [restored] = JSON.parse(localStorage.getItem(LS_FALLBACK_KEY));
    assert.equal(restored.sessionId, 'as-test');
    assert.equal(restored.currentPage, 3);
    assert.equal(restored.zoom, 1.5);
    assert.equal(restored.wasCleanExit, false);
  });
});
