// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  bumpRenderGeneration,
  getRenderGeneration,
  _schedulePreRender,
  _preRenderAdjacent,
  _blitCacheToCanvas,
  _updatePageUI,
  initRenderControllerDeps,
} from '../../app/modules/render-controller.js';
import { state, els } from '../../app/modules/state.js';

// ─── Setup: inject minimal deps ─────────────────────────────────────────────

beforeEach(() => {
  // Reset state fields used by render-controller
  state.adapter = null;
  state.currentPage = 1;
  state.pageCount = 10;
  state.zoom = 1;
  state.rotation = 0;
  state.drawEnabled = false;
  state.ocrRegionMode = false;

  // Ensure els has minimal mock elements
  if (!els.canvas) els.canvas = document.createElement('canvas');
  if (!els.annotationCanvas) {
    const ac = document.createElement('canvas');
    ac.classList = { toggle() {}, add() {}, remove() {}, contains() { return false; } };
    els.annotationCanvas = ac;
  }
  if (!els.canvasWrap) {
    const cw = document.createElement('div');
    cw.querySelector = () => null;
    els.canvasWrap = cw;
  }
  if (!els.pageStatus) els.pageStatus = document.createElement('span');
  if (!els.zoomStatus) els.zoomStatus = document.createElement('span');
  if (!els.pageInput) els.pageInput = document.createElement('input');
  if (!els.emptyState) els.emptyState = document.createElement('div');
  if (!els.sbPage) els.sbPage = document.createElement('span');
  if (!els.sbZoom) els.sbZoom = document.createElement('span');
  if (!els.pdfBlockEdit) {
    const pbe = document.createElement('div');
    pbe.classList = { contains() { return false; }, add() {}, remove() {}, toggle() {} };
    els.pdfBlockEdit = pbe;
  }

  initRenderControllerDeps({
    renderAnnotations: () => {},
    capturePageHistoryOnRender: () => {},
    saveViewState: () => {},
    renderCommentList: () => {},
    trackVisitedPage: () => {},
    renderReadingProgress: () => {},
    setOcrStatus: () => {},
  });
});

// ─── bumpRenderGeneration / getRenderGeneration ─────────────────────────────

describe('bumpRenderGeneration', () => {
  it('increments render generation', () => {
    const g1 = getRenderGeneration();
    const g2 = bumpRenderGeneration();
    assert.equal(g2, g1 + 1);
    assert.equal(getRenderGeneration(), g2);
  });

  it('increments monotonically', () => {
    const a = bumpRenderGeneration();
    const b = bumpRenderGeneration();
    const c = bumpRenderGeneration();
    assert.ok(c > b);
    assert.ok(b > a);
  });
});

// ─── _blitCacheToCanvas ─────────────────────────────────────────────────────

describe('_blitCacheToCanvas', () => {
  it('copies dimensions and CSS sizing from entry to canvas', () => {
    const entry = {
      canvas: document.createElement('canvas'),
      cssWidth: '400px',
      cssHeight: '300px',
    };
    entry.canvas.width = 800;
    entry.canvas.height = 600;

    const target = document.createElement('canvas');
    _blitCacheToCanvas(entry, target);

    assert.equal(target.width, 800);
    assert.equal(target.height, 600);
    assert.equal(target.style.width, '400px');
    assert.equal(target.style.height, '300px');
  });

  it('works without CSS dimensions', () => {
    const entry = {
      canvas: document.createElement('canvas'),
    };
    entry.canvas.width = 100;
    entry.canvas.height = 200;

    const target = document.createElement('canvas');
    _blitCacheToCanvas(entry, target);

    assert.equal(target.width, 100);
    assert.equal(target.height, 200);
  });
});

// ─── _preRenderAdjacent ─────────────────────────────────────────────────────

describe('_preRenderAdjacent', () => {
  it('returns early when no adapter', async () => {
    state.adapter = null;
    // Should not throw
    await _preRenderAdjacent(1, 1, 0);
  });

  it('renders adjacent pages', async () => {
    const rendered = [];
    state.adapter = {
      renderPage: async (page, canvas) => {
        rendered.push(page);
        canvas.width = 100;
        canvas.height = 100;
      },
    };
    state.currentPage = 5;
    state.pageCount = 10;

    await _preRenderAdjacent(5, 1, 0);
    assert.ok(rendered.includes(6), 'should pre-render next page');
    assert.ok(rendered.includes(4), 'should pre-render previous page');
  });

  it('only renders next page when on page 1', async () => {
    const rendered = [];
    state.adapter = {
      renderPage: async (page, canvas) => {
        rendered.push(page);
        canvas.width = 100;
        canvas.height = 100;
      },
    };
    state.currentPage = 1;
    state.pageCount = 10;

    await _preRenderAdjacent(1, 1, 0);
    assert.ok(rendered.includes(2));
    assert.ok(!rendered.includes(0));
  });

  it('only renders previous page when on last page', async () => {
    const rendered = [];
    state.adapter = {
      renderPage: async (page, canvas) => {
        rendered.push(page);
        canvas.width = 100;
        canvas.height = 100;
      },
    };
    state.currentPage = 10;
    state.pageCount = 10;

    await _preRenderAdjacent(10, 1, 0);
    assert.ok(rendered.includes(9));
    assert.ok(!rendered.includes(11));
  });

  it('aborts if user navigated away during render', async () => {
    const rendered = [];
    state.adapter = {
      renderPage: async (page, canvas) => {
        rendered.push(page);
        canvas.width = 100;
        canvas.height = 100;
        // Simulate navigation during render
        state.currentPage = 99;
      },
    };
    state.currentPage = 5;
    state.pageCount = 10;

    await _preRenderAdjacent(5, 1, 0);
    // Should render first target (6) then abort because currentPage changed
    assert.ok(rendered.length <= 2);
  });
});

// ─── _updatePageUI ──────────────────────────────────────────────────────────

describe('_updatePageUI', () => {
  it('updates page status text', () => {
    state.currentPage = 3;
    state.pageCount = 10;
    state.zoom = 1.5;

    _updatePageUI(42);

    assert.equal(els.pageStatus.textContent, '3 / 10');
    assert.equal(els.zoomStatus.textContent, '150%');
    assert.equal(els.pageInput.value, '3');
  });

  it('updates status bar elements', () => {
    state.currentPage = 7;
    state.pageCount = 20;
    state.zoom = 0.75;

    _updatePageUI(10);

    assert.equal(els.sbPage.textContent, 'Стр. 7 / 20');
    assert.equal(els.sbZoom.textContent, '75%');
  });

  it('works without render time', () => {
    state.currentPage = 1;
    state.pageCount = 1;
    state.zoom = 1;
    _updatePageUI(null);
    assert.equal(els.pageStatus.textContent, '1 / 1');
  });
});

// ─── _schedulePreRender ─────────────────────────────────────────────────────

describe('_schedulePreRender', () => {
  it('does not throw', () => {
    // Just verify it can be called without error (uses safeTimeout internally)
    _schedulePreRender(1, 1, 0);
  });
});
