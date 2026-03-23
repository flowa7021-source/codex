// ─── Coverage Tests: AnnotationController ─────────────────────────────────────
// Tests initAnnotationControllerDeps, setDrawMode, showShortcutsHelp,
// renderCommentList, renderAnnotations, drawStroke for various tools,
// undoStroke, clearStrokes, clearComments, exportAnnotationsJson,
// exportAnnotationBundleJson, importAnnotationsJson, importAnnotationBundleJson
// to push coverage from 75% toward 85%.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Ensure crypto.randomUUID is available
if (!globalThis.crypto) {
  globalThis.crypto = { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` };
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Patch createElement for click/remove/querySelector
const _origCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = _origCreateElement(tag);
  if (!el.click) el.click = () => {};
  if (!el.remove) el.remove = () => {};
  if (!el.querySelector) el.querySelector = () => ({ addEventListener() {} });
  return el;
};
if (!document.body.appendChild) document.body.appendChild = () => {};

import {
  annotationKey,
  commentKey,
  invalidateAnnotationCaches,
  loadStrokes,
  saveStrokes,
  loadComments,
  saveComments,
  setDrawMode,
  showShortcutsHelp,
  renderCommentList,
  renderAnnotations,
  drawStroke,
  undoStroke,
  clearStrokes,
  clearComments,
  exportAnnotationsJson,
  exportAnnotationBundleJson,
  importAnnotationsJson,
  importAnnotationBundleJson,
  initAnnotationControllerDeps,
  updateOverlayInteractionState,
  getCurrentAnnotationCtx,
  getAnnotationDpr,
  denormalizePoint,
} from '../../app/modules/annotation-controller.js';
import { state, els, hotkeys } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockCtx() {
  return {
    save() {}, restore() {}, clearRect() {}, fillRect() {}, strokeRect() {},
    fillText() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    stroke() {}, fill() {}, arc() {}, scale() {}, drawImage() {},
    ellipse() {},
    globalCompositeOperation: '', globalAlpha: 1,
    strokeStyle: '', fillStyle: '', lineWidth: 0, lineJoin: '', lineCap: '',
    font: '', textAlign: '', textBaseline: '',
    setLineDash() {},
  };
}

function resetState() {
  state.docName = 'test.pdf';
  state.currentPage = 1;
  state.pageCount = 5;
  state.adapter = { type: 'pdf' };
  state.drawEnabled = false;
  state.ocrRegionMode = false;
  state.isDrawing = false;
  state.currentStroke = null;
  state.ocrSelection = null;
  localStorage.clear();
  invalidateAnnotationCaches();

  const mockCtx = makeMockCtx();
  els.annotationCanvas = {
    width: 1000, height: 500,
    getContext() { return mockCtx; },
    classList: { toggle() {}, add() {}, remove() {} },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; },
  };
  els.canvas = { width: 1000, height: 500 };
  els.commentList = {
    innerHTML: '',
    appendChild() {},
  };
  els.annStats = { textContent: '' };
  els.annotateToggle = { textContent: '', classList: { toggle() {}, add() {}, remove() {} } };
  els.drawTool = { value: 'pen' };
  els.drawColor = { value: '#ff0000' };
  els.drawSize = { value: '3' };
  els.textLayerDiv = {
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0 }; },
    contains() { return false; },
  };

  initAnnotationControllerDeps({
    renderDocStats: () => {},
    renderReadingGoalStatus: () => {},
    renderEtaStatus: () => {},
    setOcrStatus: () => {},
    runOcrOnRect: async () => {},
    drawOcrSelectionPreview: () => {},
    nrPrompt: async () => null,
    toastError: () => {},
  });
}

// ── initAnnotationControllerDeps ─────────────────────────────────────────────

describe('initAnnotationControllerDeps', () => {
  it('accepts and stores deps', () => {
    let called = false;
    initAnnotationControllerDeps({
      renderDocStats: () => { called = true; },
    });
    // Verify by triggering saveStrokes which calls renderDocStats
    resetState();
    initAnnotationControllerDeps({ renderDocStats: () => { called = true; }, renderReadingGoalStatus: () => {}, renderEtaStatus: () => {} });
    saveStrokes([], 1);
    assert.ok(called, 'renderDocStats should be called via saveStrokes');
  });
});

// ── setDrawMode ──────────────────────────────────────────────────────────────

describe('setDrawMode', () => {
  beforeEach(resetState);

  it('enables draw mode', () => {
    setDrawMode(true);
    assert.equal(state.drawEnabled, true);
  });

  it('disables draw mode', () => {
    setDrawMode(true);
    setDrawMode(false);
    assert.equal(state.drawEnabled, false);
  });

  it('updates annotateToggle text to on', () => {
    setDrawMode(true);
    assert.ok(els.annotateToggle.textContent.includes('on'));
  });

  it('updates annotateToggle text to off', () => {
    setDrawMode(true);
    setDrawMode(false);
    assert.ok(els.annotateToggle.textContent.includes('off'));
  });
});

// ── updateOverlayInteractionState ────────────────────────────────────────────

describe('updateOverlayInteractionState', () => {
  beforeEach(resetState);

  it('enables canvas interaction when drawing', () => {
    let toggledClass = null;
    let toggledValue = null;
    els.annotationCanvas.classList = {
      toggle(cls, val) { toggledClass = cls; toggledValue = val; },
    };
    state.drawEnabled = true;
    updateOverlayInteractionState();
    assert.equal(toggledClass, 'drawing-enabled');
    assert.equal(toggledValue, true);
  });

  it('disables canvas interaction when not drawing', () => {
    let toggledValue = null;
    els.annotationCanvas.classList = {
      toggle(cls, val) { toggledValue = val; },
    };
    state.drawEnabled = false;
    state.ocrRegionMode = false;
    updateOverlayInteractionState();
    assert.equal(toggledValue, false);
  });

  it('enables when ocrRegionMode is active', () => {
    let toggledValue = null;
    els.annotationCanvas.classList = {
      toggle(cls, val) { toggledValue = val; },
    };
    state.drawEnabled = false;
    state.ocrRegionMode = true;
    updateOverlayInteractionState();
    assert.equal(toggledValue, true);
  });
});

// ── showShortcutsHelp ────────────────────────────────────────────────────────

describe('showShortcutsHelp', () => {
  beforeEach(resetState);

  it('creates overlay element with hotkey info', () => {
    let appendedChild = null;
    document.body.appendChild = (child) => { appendedChild = child; };

    // Mock querySelector on created elements to return a mock button
    const origCreateElement = document.createElement;
    document.createElement = (tag) => {
      const el = origCreateElement(tag);
      const origQS = el.querySelector.bind(el);
      el.querySelector = (sel) => {
        const found = origQS(sel);
        if (found) return found;
        // Return a mock element for #closeShortcutsHelp
        if (sel === '#closeShortcutsHelp') return origCreateElement('button');
        return null;
      };
      return el;
    };

    // Ensure _novaShortcuts is not set
    /** @type {any} */ (window)._novaShortcuts = undefined;

    showShortcutsHelp();
    document.createElement = origCreateElement;

    assert.ok(appendedChild, 'Should append overlay to body');
  });

  it('calls _novaShortcuts.openShortcuts when available', () => {
    let opened = false;
    /** @type {any} */ (window)._novaShortcuts = {
      openShortcuts: () => { opened = true; },
    };

    showShortcutsHelp();
    assert.ok(opened, 'Should call openShortcuts');

    // Cleanup
    /** @type {any} */ (window)._novaShortcuts = undefined;
  });
});

// ── renderCommentList ────────────────────────────────────────────────────────

describe('renderCommentList', () => {
  beforeEach(resetState);

  it('shows no comments message when empty', () => {
    const appended = [];
    els.commentList = { innerHTML: '', appendChild(c) { appended.push(c); } };
    renderCommentList();
    assert.ok(appended.length >= 1);
  });

  it('renders comments with delete buttons', () => {
    saveComments([
      { point: { x: 0.1, y: 0.2 }, text: 'Comment A' },
      { point: { x: 0.3, y: 0.4 }, text: 'Comment B' },
    ], 1);
    invalidateAnnotationCaches();

    const appended = [];
    els.commentList = { innerHTML: '', appendChild(c) { appended.push(c); } };
    renderCommentList();
    assert.equal(appended.length, 2);
  });
});

// ── drawStroke for various tools ─────────────────────────────────────────────

describe('drawStroke', () => {
  beforeEach(resetState);

  it('draws pen stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'pen', color: '#ff0000', size: 2,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws highlighter stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'highlighter', color: '#ffff00', size: 5,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.6 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws rect stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'rect', color: '#0000ff', size: 2,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.6 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws arrow stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'arrow', color: '#ff0000', size: 2,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.8 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws line stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'line', color: '#000000', size: 1,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws circle stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'circle', color: '#00ff00', size: 2,
      points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws text-highlight stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'text-highlight', color: '#ffd84d', size: 1,
      points: [{ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.4 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws text-underline stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'text-underline', color: '#ff0000', size: 1,
      points: [{ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.4 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws text-strikethrough stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'text-strikethrough', color: '#ff0000', size: 1,
      points: [{ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.4 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws text-squiggly stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'text-squiggly', color: '#ff0000', size: 1,
      points: [{ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.4 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws text-box stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'text-box', color: '#3b82f6', size: 1,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.3 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('draws eraser stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'eraser', color: '#000', size: 4,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('handles single-point pen stroke', () => {
    const ctx = makeMockCtx();
    const stroke = {
      tool: 'pen', color: '#ff0000', size: 2,
      points: [{ x: 0.5, y: 0.5 }],
    };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('handles empty points array', () => {
    const ctx = makeMockCtx();
    const stroke = { tool: 'pen', color: '#ff0000', size: 2, points: [] };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });

  it('handles null points', () => {
    const ctx = makeMockCtx();
    const stroke = { tool: 'pen', color: '#ff0000', size: 2, points: null };
    assert.doesNotThrow(() => drawStroke(ctx, stroke));
  });
});

// ── undoStroke ────────────────────────────────────────────────────────────────

describe('undoStroke', () => {
  beforeEach(resetState);

  it('removes last stroke', () => {
    saveStrokes([
      { tool: 'pen', color: '#f00', size: 1, points: [] },
      { tool: 'pen', color: '#0f0', size: 1, points: [] },
    ], 1);
    invalidateAnnotationCaches();
    undoStroke();
    invalidateAnnotationCaches();
    const strokes = loadStrokes(1);
    assert.equal(strokes.length, 1);
  });

  it('does nothing when no strokes', () => {
    assert.doesNotThrow(() => undoStroke());
  });
});

// ── clearStrokes / clearComments ─────────────────────────────────────────────

describe('clearStrokes', () => {
  beforeEach(resetState);

  it('removes all strokes for current page', () => {
    saveStrokes([{ tool: 'pen', color: '#f00', size: 1, points: [] }], 1);
    invalidateAnnotationCaches();
    clearStrokes();
    invalidateAnnotationCaches();
    assert.deepEqual(loadStrokes(1), []);
  });
});

describe('clearComments', () => {
  beforeEach(resetState);

  it('removes all comments for current page', () => {
    saveComments([{ point: { x: 0.5, y: 0.5 }, text: 'test' }], 1);
    invalidateAnnotationCaches();
    clearComments();
    invalidateAnnotationCaches();
    assert.deepEqual(loadComments(1), []);
  });
});

// ── exportAnnotationsJson ────────────────────────────────────────────────────

describe('exportAnnotationsJson', () => {
  beforeEach(resetState);

  it('does nothing when no adapter', () => {
    state.adapter = null;
    assert.doesNotThrow(() => exportAnnotationsJson());
  });

  it('exports annotations as JSON blob', () => {
    saveStrokes([{ tool: 'pen', color: '#f00', size: 1, points: [] }], 1);
    invalidateAnnotationCaches();
    assert.doesNotThrow(() => exportAnnotationsJson());
  });
});

// ── exportAnnotationBundleJson ───────────────────────────────────────────────

describe('exportAnnotationBundleJson', () => {
  beforeEach(resetState);

  it('does nothing when no adapter', () => {
    state.adapter = null;
    assert.doesNotThrow(() => exportAnnotationBundleJson());
  });

  it('exports bundle with multiple pages', () => {
    saveStrokes([{ tool: 'pen', color: '#f00', size: 1, points: [] }], 1);
    saveStrokes([{ tool: 'pen', color: '#0f0', size: 2, points: [] }], 3);
    invalidateAnnotationCaches();
    assert.doesNotThrow(() => exportAnnotationBundleJson());
  });
});

// ── importAnnotationsJson ────────────────────────────────────────────────────

describe('importAnnotationsJson', () => {
  beforeEach(resetState);

  it('does nothing when no adapter', async () => {
    state.adapter = null;
    await importAnnotationsJson({ text: async () => '{}' });
    // Should not throw
  });

  it('imports valid annotations JSON', async () => {
    const payload = {
      strokes: [{ tool: 'pen', size: 2, points: [{ x: 0.1, y: 0.2 }] }],
      comments: [{ point: { x: 0.5, y: 0.5 }, text: 'imported' }],
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importAnnotationsJson(file);
    invalidateAnnotationCaches();
    const strokes = loadStrokes(1);
    assert.equal(strokes.length, 1);
    const comments = loadComments(1);
    assert.equal(comments.length, 1);
  });

  it('filters invalid strokes', async () => {
    const payload = {
      strokes: [
        { tool: 'pen', size: 2, points: [] },
        { tool: 'invalid-tool', size: 2, points: [] },
      ],
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importAnnotationsJson(file);
    invalidateAnnotationCaches();
    const strokes = loadStrokes(1);
    assert.equal(strokes.length, 1);
  });

  it('handles invalid JSON gracefully', async () => {
    let errorMsg = '';
    initAnnotationControllerDeps({
      toastError: (msg) => { errorMsg = msg; },
      renderDocStats: () => {},
      renderReadingGoalStatus: () => {},
      renderEtaStatus: () => {},
    });
    const file = { text: async () => 'not json' };
    await importAnnotationsJson(file);
    assert.ok(errorMsg.includes('Не удалось'));
  });
});

// ── importAnnotationBundleJson ───────────────────────────────────────────────

describe('importAnnotationBundleJson', () => {
  beforeEach(resetState);

  it('does nothing when no adapter', async () => {
    state.adapter = null;
    await importAnnotationBundleJson({ text: async () => '{}' });
  });

  it('imports valid bundle', async () => {
    const payload = {
      pages: {
        '1': {
          strokes: [{ tool: 'pen', size: 2, points: [{ x: 0, y: 0 }] }],
          comments: [{ point: { x: 0.5, y: 0.5 }, text: 'bundled' }],
        },
        '3': {
          strokes: [{ tool: 'highlighter', size: 4, points: [] }],
          comments: [],
        },
      },
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importAnnotationBundleJson(file);
    invalidateAnnotationCaches();
    assert.equal(loadStrokes(1).length, 1);
    assert.equal(loadComments(1).length, 1);
    assert.equal(loadStrokes(3).length, 1);
  });

  it('handles invalid bundle gracefully', async () => {
    let errorMsg = '';
    initAnnotationControllerDeps({
      toastError: (msg) => { errorMsg = msg; },
      renderDocStats: () => {},
      renderReadingGoalStatus: () => {},
      renderEtaStatus: () => {},
    });
    const file = { text: async () => JSON.stringify({ wrong: true }) };
    await importAnnotationBundleJson(file);
    assert.ok(errorMsg.includes('bundle'));
  });

  it('filters out-of-range pages', async () => {
    state.pageCount = 2;
    const payload = {
      pages: {
        '1': { strokes: [{ tool: 'pen', size: 2, points: [] }], comments: [] },
        '999': { strokes: [{ tool: 'pen', size: 2, points: [] }], comments: [] },
      },
    };
    const file = { text: async () => JSON.stringify(payload) };
    await importAnnotationBundleJson(file);
    invalidateAnnotationCaches();
    assert.equal(loadStrokes(1).length, 1);
    // Page 999 should be skipped
  });
});

// ── renderAnnotations ────────────────────────────────────────────────────────

describe('renderAnnotations', () => {
  beforeEach(resetState);

  it('does not throw', () => {
    assert.doesNotThrow(() => renderAnnotations());
  });

  it('updates annStats text', () => {
    saveStrokes([{ tool: 'pen', color: '#f00', size: 1, points: [] }], 1);
    invalidateAnnotationCaches();
    renderAnnotations();
    assert.ok(els.annStats.textContent.includes('1'));
  });
});
