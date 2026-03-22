// ─── Unit Tests: AnnotationController — render, stroke, text-markup ──────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  renderAnnotations,
  beginStroke,
  moveStroke,
  endStroke,
  drawStroke,
  normalizePoint,
  denormalizePoint,
  invalidateAnnotationCaches,
  loadStrokes,
  saveStrokes,
  loadComments,
  saveComments,
  getCurrentAnnotationCtx,
  getAnnotationDpr,
  initAnnotationControllerDeps,
  _applyTextMarkupFromSelection,
} from '../../app/modules/annotation-controller.js';

// ── Mock Canvas Setup ────────────────────────────────────────────────────────

function makeCanvasCtx() {
  const calls = [];
  const ctx = {
    _calls: calls,
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    scale(...args) { calls.push(['scale', ...args]); },
    beginPath() { calls.push(['beginPath']); },
    closePath() { calls.push(['closePath']); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    arc(...args) { calls.push(['arc', ...args]); },
    ellipse(...args) { calls.push(['ellipse', ...args]); },
    fill() { calls.push(['fill']); },
    stroke() { calls.push(['stroke']); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    fillText(...args) { calls.push(['fillText', ...args]); },
    drawImage() { calls.push(['drawImage']); },
    getImageData: () => ({ data: new Uint8Array(0), width: 0, height: 0 }),
    putImageData() {},
    createImageData: () => ({ data: new Uint8Array(0) }),
    measureText: () => ({ width: 0 }),
    strokeText() {},
    setTransform() {},
    resetTransform() {},
    translate() {},
    rotate() {},
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  return ctx;
}

function resetState() {
  state.docName = 'test.pdf';
  state.currentPage = 1;
  state.pageCount = 5;
  state.adapter = { type: 'pdf' };
  state.drawEnabled = false;
  state.isDrawing = false;
  state.currentStroke = null;
  state.ocrRegionMode = false;
  state.ocrSelection = null;
  state.isSelectingOcr = false;
  localStorage.clear();
  invalidateAnnotationCaches();

  // Set up mock canvas elements
  const ctx = makeCanvasCtx();
  els.annotationCanvas = {
    width: 800,
    height: 600,
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    _ctx: ctx,
  };
  els.canvas = { width: 800, height: 600 };
  els.annStats = { textContent: '' };
  els.commentList = {
    innerHTML: '',
    appendChild() {},
  };
  els.drawTool = { value: 'pen' };
  els.drawColor = { value: '#ff0000' };
  els.drawSize = { value: '3' };
  els.textLayerDiv = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    contains: () => false,
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('renderAnnotations', () => {
  beforeEach(resetState);

  it('clears the canvas and calls scale for DPR', () => {
    renderAnnotations();
    const ctx = els.annotationCanvas._ctx;
    const clearCalls = ctx._calls.filter(c => c[0] === 'clearRect');
    assert.ok(clearCalls.length >= 1, 'should call clearRect');
    const scaleCalls = ctx._calls.filter(c => c[0] === 'scale');
    assert.ok(scaleCalls.length >= 1, 'should call scale for DPR');
  });

  it('draws saved strokes on the canvas', () => {
    saveStrokes([
      { tool: 'pen', color: '#ff0000', size: 3, points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] },
    ]);
    renderAnnotations();
    const ctx = els.annotationCanvas._ctx;
    const strokeCalls = ctx._calls.filter(c => c[0] === 'stroke');
    assert.ok(strokeCalls.length >= 1, 'should call stroke for pen strokes');
  });

  it('draws comments as circles with numbers', () => {
    saveComments([{ point: { x: 0.5, y: 0.5 }, text: 'Test comment' }]);
    renderAnnotations();
    const ctx = els.annotationCanvas._ctx;
    const arcCalls = ctx._calls.filter(c => c[0] === 'arc');
    assert.ok(arcCalls.length >= 1, 'should draw arc for comment marker');
    const fillTextCalls = ctx._calls.filter(c => c[0] === 'fillText');
    assert.ok(fillTextCalls.length >= 1, 'should draw comment number');
    assert.equal(fillTextCalls[0][1], '1');
  });

  it('updates annStats text content', () => {
    saveStrokes([
      { tool: 'pen', color: '#000', size: 2, points: [{ x: 0.1, y: 0.1 }] },
    ]);
    saveComments([{ point: { x: 0.5, y: 0.5 }, text: 'Hi' }]);
    renderAnnotations();
    assert.ok(els.annStats.textContent.length > 0, 'should set annStats text');
  });

  it('handles empty strokes and comments gracefully', () => {
    renderAnnotations();
    // Should not throw
    assert.ok(true);
  });
});

describe('drawStroke — shape tools', () => {
  beforeEach(resetState);

  it('draws a rectangle stroke', () => {
    const ctx = makeCanvasCtx();
    const stroke = {
      tool: 'rect',
      color: '#0000ff',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
    };
    drawStroke(ctx, stroke);
    const rectCalls = ctx._calls.filter(c => c[0] === 'strokeRect');
    assert.ok(rectCalls.length >= 1, 'should call strokeRect');
  });

  it('draws an arrow stroke', () => {
    const ctx = makeCanvasCtx();
    const stroke = {
      tool: 'arrow',
      color: '#00ff00',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }],
    };
    drawStroke(ctx, stroke);
    const fillCalls = ctx._calls.filter(c => c[0] === 'fill');
    assert.ok(fillCalls.length >= 1, 'should call fill for arrowhead');
  });

  it('draws a line stroke', () => {
    const ctx = makeCanvasCtx();
    const stroke = {
      tool: 'line',
      color: '#000',
      size: 1,
      points: [{ x: 0.0, y: 0.0 }, { x: 1.0, y: 1.0 }],
    };
    drawStroke(ctx, stroke);
    const lineCalls = ctx._calls.filter(c => c[0] === 'lineTo');
    assert.ok(lineCalls.length >= 1);
  });

  it('draws a circle stroke', () => {
    const ctx = makeCanvasCtx();
    const stroke = {
      tool: 'circle',
      color: '#f00',
      size: 2,
      points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }],
    };
    drawStroke(ctx, stroke);
    const ellipseCalls = ctx._calls.filter(c => c[0] === 'ellipse');
    assert.ok(ellipseCalls.length >= 1, 'should call ellipse for circle');
  });

  it('draws a text-highlight stroke', () => {
    const ctx = makeCanvasCtx();
    const stroke = {
      tool: 'text-highlight',
      color: '#ffd84d',
      size: 2,
      points: [{ x: 0.1, y: 0.3 }, { x: 0.9, y: 0.35 }],
    };
    drawStroke(ctx, stroke);
    const fillRectCalls = ctx._calls.filter(c => c[0] === 'fillRect');
    assert.ok(fillRectCalls.length >= 1, 'should fillRect for highlight');
  });

  it('handles empty points gracefully', () => {
    const ctx = makeCanvasCtx();
    const stroke = { tool: 'pen', color: '#000', size: 2, points: [] };
    drawStroke(ctx, stroke);
    // Should not throw; no stroke calls expected
    const strokeCalls = ctx._calls.filter(c => c[0] === 'stroke');
    assert.equal(strokeCalls.length, 0);
  });

  it('draws a single-point pen stroke', () => {
    const ctx = makeCanvasCtx();
    const stroke = {
      tool: 'pen',
      color: '#000',
      size: 2,
      points: [{ x: 0.5, y: 0.5 }],
    };
    drawStroke(ctx, stroke);
    const strokeCalls = ctx._calls.filter(c => c[0] === 'stroke');
    assert.ok(strokeCalls.length >= 1);
  });
});

describe('beginStroke / moveStroke / endStroke', () => {
  beforeEach(resetState);

  it('beginStroke does nothing when adapter is null', async () => {
    state.adapter = null;
    const e = { clientX: 100, clientY: 100 };
    await beginStroke(e);
    assert.equal(state.isDrawing, false);
  });

  it('beginStroke does nothing when drawing is disabled', async () => {
    state.drawEnabled = false;
    state.ocrRegionMode = false;
    const e = { clientX: 100, clientY: 100 };
    await beginStroke(e);
    assert.equal(state.isDrawing, false);
  });

  it('beginStroke starts OCR region selection when in ocrRegionMode', async () => {
    state.ocrRegionMode = true;
    const e = { clientX: 100, clientY: 100 };
    await beginStroke(e);
    assert.equal(state.isSelectingOcr, true);
    assert.ok(state.ocrSelection);
  });

  it('beginStroke starts a pen stroke when drawing is enabled', async () => {
    state.drawEnabled = true;
    els.drawTool.value = 'pen';
    const e = { clientX: 100, clientY: 100 };
    await beginStroke(e);
    assert.equal(state.isDrawing, true);
    assert.ok(state.currentStroke);
    assert.equal(state.currentStroke.tool, 'pen');
  });

  it('moveStroke adds points to freehand stroke', () => {
    state.drawEnabled = true;
    state.isDrawing = true;
    state.currentStroke = {
      tool: 'pen',
      color: '#000',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }],
    };
    const e = { clientX: 200, clientY: 200 };
    moveStroke(e);
    assert.ok(state.currentStroke.points.length >= 2, 'should add a point');
  });

  it('moveStroke updates endpoint for shape tools', () => {
    state.drawEnabled = true;
    state.isDrawing = true;
    state.currentStroke = {
      tool: 'rect',
      color: '#000',
      size: 2,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.1, y: 0.1 }],
    };
    const e = { clientX: 400, clientY: 300 };
    moveStroke(e);
    assert.equal(state.currentStroke.points.length, 2, 'shape tools keep only 2 points');
  });

  it('moveStroke does nothing when not drawing', () => {
    state.isDrawing = false;
    state.currentStroke = null;
    const e = { clientX: 200, clientY: 200 };
    moveStroke(e);
    // Should not throw
    assert.equal(state.currentStroke, null);
  });

  it('endStroke saves freehand stroke and resets state', async () => {
    state.drawEnabled = true;
    state.isDrawing = true;
    state.currentStroke = {
      tool: 'pen',
      color: '#ff0000',
      size: 3,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
    };
    await endStroke();
    assert.equal(state.isDrawing, false);
  });

  it('endStroke does nothing when not drawing', async () => {
    state.isDrawing = false;
    state.currentStroke = null;
    await endStroke();
    assert.equal(state.isDrawing, false);
  });

  it('endStroke handles OCR region completion', async () => {
    state.ocrRegionMode = true;
    state.isSelectingOcr = true;
    state.ocrSelection = {
      start: { x: 0.1, y: 0.1 },
      end: { x: 0.9, y: 0.9 },
    };
    let ocrCalled = false;
    initAnnotationControllerDeps({
      runOcrOnRect: async () => { ocrCalled = true; },
      setOcrStatus: () => {},
      drawOcrSelectionPreview: () => {},
    });
    await endStroke();
    assert.equal(state.isSelectingOcr, false);
    assert.equal(state.ocrSelection, null);
    assert.ok(ocrCalled, 'should have called runOcrOnRect');
  });
});

describe('_applyTextMarkupFromSelection', () => {
  beforeEach(resetState);

  it('returns without error for unknown tool value', () => {
    const mockSelection = {
      getRangeAt: () => ({
        getClientRects: () => [],
      }),
    };
    // Should not throw for unknown tool
    _applyTextMarkupFromSelection(mockSelection, 'unknown-tool');
  });

  it('does not add annotations when rects are empty', () => {
    const mockSelection = {
      getRangeAt: () => ({
        getClientRects: () => [],
      }),
    };
    _applyTextMarkupFromSelection(mockSelection, 'text-highlight');
    // Should not throw
    assert.ok(true);
  });

  it('adds highlight annotations for valid rects', () => {
    const mockSelection = {
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 10, top: 20, width: 100, height: 15 },
        ],
      }),
    };
    // This exercises the code path; the annotationManager.add call
    // goes through to the pro annotations module
    _applyTextMarkupFromSelection(mockSelection, 'text-highlight');
  });

  it('skips tiny rects (width < 2 or height < 2)', () => {
    const mockSelection = {
      getRangeAt: () => ({
        getClientRects: () => [
          { left: 10, top: 20, width: 1, height: 15 },  // too narrow
          { left: 10, top: 20, width: 100, height: 1 },  // too short
        ],
      }),
    };
    _applyTextMarkupFromSelection(mockSelection, 'text-underline');
  });
});
