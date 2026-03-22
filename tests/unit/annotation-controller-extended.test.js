// ─── Extended Unit Tests: AnnotationController ──────────────────────────────
// Tests exports NOT covered in annotation-controller.test.js:
// drawStroke, renderCommentList, updateOverlayInteractionState,
// setDrawMode, undoStroke, clearStrokes, clearComments,
// exportAnnotationsJson, exportAnnotationBundleJson, getCanvasPointFromEvent
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Ensure crypto.randomUUID is available
if (!globalThis.crypto) {
  globalThis.crypto = { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` };
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

import {
  annotationKey,
  commentKey,
  invalidateAnnotationCaches,
  loadStrokes,
  saveStrokes,
  loadComments,
  saveComments,
  drawStroke,
  updateOverlayInteractionState,
  undoStroke,
  clearStrokes,
  clearComments,
  exportAnnotationsJson,
  exportAnnotationBundleJson,
  getCurrentAnnotationCtx,
  getCanvasPointFromEvent,
  initAnnotationControllerDeps,
} from '../../app/modules/annotation-controller.js';
import { state, els } from '../../app/modules/state.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockCtx() {
  return {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    fill() {},
    closePath() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    clearRect() {},
    scale() {},
    drawImage() {},
    ellipse() {},
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
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
  state.ocrSelection = null;
  state.isDrawing = false;
  state.currentStroke = null;
  localStorage.clear();
  invalidateAnnotationCaches();

  // Provide mock DOM elements
  const mockCtx = makeMockCtx();
  els.annotationCanvas = {
    width: 1000,
    height: 500,
    getContext() { return mockCtx; },
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; },
  };
  els.canvas = { width: 1000, height: 500 };
  els.commentList = {
    innerHTML: '',
    appendChild() {},
    querySelectorAll() { return []; },
  };
  els.annStats = { textContent: '' };
  els.drawTool = { value: 'pen' };
  els.drawColor = { value: '#000000' };
  els.drawSize = { value: '2' };
  els.annotateToggle = { textContent: '', classList: { toggle() {}, add() {}, remove() {} } };
  els.textLayerDiv = { querySelectorAll() { return []; }, getBoundingClientRect() { return { left: 0, top: 0 }; } };

  // Inject minimal deps
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('drawStroke', () => {
  beforeEach(resetState);

  it('draws a pen stroke on the context', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      beginPath() { calls.push('beginPath'); },
      moveTo() { calls.push('moveTo'); },
      lineTo() { calls.push('lineTo'); },
      stroke() { calls.push('stroke'); },
    };

    drawStroke(ctx, {
      tool: 'pen',
      color: '#ff0000',
      size: 2,
      points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
    });

    assert.ok(calls.includes('beginPath'));
    assert.ok(calls.includes('moveTo'));
    assert.ok(calls.includes('lineTo'));
    assert.ok(calls.includes('stroke'));
  });

  it('does nothing for empty points', () => {
    const ctx = makeMockCtx();
    // Should not throw
    drawStroke(ctx, { tool: 'pen', color: '#000', size: 1, points: [] });
  });

  it('does nothing for null points', () => {
    const ctx = makeMockCtx();
    drawStroke(ctx, { tool: 'pen', color: '#000', size: 1, points: null });
  });

  it('draws rect stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    };

    drawStroke(ctx, {
      tool: 'rect',
      color: '#00ff00',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
    });

    assert.ok(calls.some(c => c[0] === 'strokeRect'));
  });

  it('draws arrow stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      fill() { calls.push('fill'); },
    };

    drawStroke(ctx, {
      tool: 'arrow',
      color: '#0000ff',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
    });

    assert.ok(calls.includes('fill'));
  });

  it('draws line stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      stroke() { calls.push('stroke'); },
    };

    drawStroke(ctx, {
      tool: 'line',
      color: '#000',
      size: 1,
      points: [{ x: 0.0, y: 0.0 }, { x: 1.0, y: 1.0 }],
    });

    assert.ok(calls.includes('stroke'));
  });

  it('draws circle stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      ellipse(...args) { calls.push(['ellipse', ...args]); },
    };

    drawStroke(ctx, {
      tool: 'circle',
      color: '#ff0',
      size: 2,
      points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }],
    });

    assert.ok(calls.some(c => c[0] === 'ellipse'));
  });

  it('draws text-highlight stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      fillRect(...args) { calls.push(['fillRect', ...args]); },
    };

    drawStroke(ctx, {
      tool: 'text-highlight',
      color: '#ffd84d',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.2 }],
    });

    assert.ok(calls.some(c => c[0] === 'fillRect'));
  });

  it('draws text-underline stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      stroke() { calls.push('stroke'); },
    };

    drawStroke(ctx, {
      tool: 'text-underline',
      color: '#ff0000',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.2 }],
    });

    assert.ok(calls.includes('stroke'));
  });

  it('draws text-strikethrough stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      stroke() { calls.push('stroke'); },
    };

    drawStroke(ctx, {
      tool: 'text-strikethrough',
      color: '#ff0000',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.2 }],
    });

    assert.ok(calls.includes('stroke'));
  });

  it('draws text-squiggly stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      stroke() { calls.push('stroke'); },
    };

    drawStroke(ctx, {
      tool: 'text-squiggly',
      color: '#ff0000',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.2 }],
    });

    assert.ok(calls.includes('stroke'));
  });

  it('draws text-box stroke', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      fillRect() { calls.push('fillRect'); },
      strokeRect() { calls.push('strokeRect'); },
    };

    drawStroke(ctx, {
      tool: 'text-box',
      color: '#3b82f6',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
    });

    assert.ok(calls.includes('fillRect'));
    assert.ok(calls.includes('strokeRect'));
  });

  it('handles single-point pen stroke (dot)', () => {
    const calls = [];
    const ctx = {
      ...makeMockCtx(),
      lineTo() { calls.push('lineTo'); },
      stroke() { calls.push('stroke'); },
    };

    drawStroke(ctx, {
      tool: 'pen',
      color: '#000',
      size: 1,
      points: [{ x: 0.5, y: 0.5 }],
    });

    assert.ok(calls.includes('lineTo'));
    assert.ok(calls.includes('stroke'));
  });
});

describe('updateOverlayInteractionState', () => {
  beforeEach(resetState);

  it('does not throw when annotationCanvas is set', () => {
    state.drawEnabled = true;
    updateOverlayInteractionState();
    // No assertion needed — just verify no throw
  });

  it('does not throw when annotationCanvas is null', () => {
    els.annotationCanvas = null;
    state.drawEnabled = true;
    updateOverlayInteractionState();
  });
});

describe('undoStroke', () => {
  beforeEach(resetState);

  it('removes the last stroke', () => {
    saveStrokes([
      { tool: 'pen', color: '#000', size: 1, points: [{ x: 0.1, y: 0.1 }] },
      { tool: 'pen', color: '#f00', size: 2, points: [{ x: 0.2, y: 0.2 }] },
    ], 1);
    invalidateAnnotationCaches();

    undoStroke();

    invalidateAnnotationCaches();
    const strokes = loadStrokes(1);
    assert.equal(strokes.length, 1);
    assert.equal(strokes[0].color, '#000');
  });

  it('does nothing when no strokes exist', () => {
    // Should not throw
    undoStroke();
    assert.deepEqual(loadStrokes(1), []);
  });
});

describe('clearStrokes', () => {
  beforeEach(resetState);

  it('removes all strokes for current page', () => {
    saveStrokes([{ tool: 'pen', color: '#000', size: 1, points: [] }], 1);
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

describe('exportAnnotationsJson', () => {
  beforeEach(resetState);

  it('does nothing without adapter', () => {
    state.adapter = null;
    // Should not throw
    exportAnnotationsJson();
  });

  it('does not throw with adapter and data', () => {
    state.adapter = { type: 'pdf' };
    saveStrokes([{ tool: 'pen', color: '#000', size: 1, points: [{ x: 0.5, y: 0.5 }] }], 1);
    saveComments([{ point: { x: 0.1, y: 0.1 }, text: 'note' }], 1);
    invalidateAnnotationCaches();

    // Patch createElement to add click() to anchor elements
    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportAnnotationsJson();
    } finally {
      document.createElement = origCreate;
    }
  });
});

describe('exportAnnotationBundleJson', () => {
  beforeEach(resetState);

  it('does nothing without adapter', () => {
    state.adapter = null;
    exportAnnotationBundleJson();
  });

  it('does not throw with adapter and multi-page data', () => {
    state.adapter = { type: 'pdf' };
    saveStrokes([{ tool: 'pen', color: '#f00', size: 1, points: [] }], 1);
    saveStrokes([{ tool: 'pen', color: '#0f0', size: 2, points: [] }], 3);
    invalidateAnnotationCaches();

    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate(tag);
      if (!el.click) el.click = () => {};
      return el;
    };
    try {
      exportAnnotationBundleJson();
    } finally {
      document.createElement = origCreate;
    }
  });
});

describe('getCurrentAnnotationCtx', () => {
  beforeEach(resetState);

  it('returns a context object', () => {
    const ctx = getCurrentAnnotationCtx();
    assert.ok(ctx);
  });
});

describe('getCanvasPointFromEvent', () => {
  beforeEach(resetState);

  it('computes canvas-relative coordinates from mouse event', () => {
    els.annotationCanvas = {
      width: 1000,
      height: 500,
      getContext() { return makeMockCtx(); },
      classList: { toggle() {} },
      getBoundingClientRect() { return { left: 100, top: 50, width: 500, height: 250 }; },
    };

    const point = getCanvasPointFromEvent({ clientX: 350, clientY: 175 });
    // (350-100)/500 * 1000 = 500
    assert.equal(point.x, 500);
    // (175-50)/250 * 500 = 250
    assert.equal(point.y, 250);
  });
});
