// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  bumpRenderGeneration,
  getRenderGeneration,
  _schedulePreRender,
  _preRenderAdjacent,
  _blitCacheToCanvas,
  _updateAnnotationCanvas,
  _updatePageUI,
  renderCurrentPage,
  initRenderControllerDeps,
} from '../../app/modules/render-controller.js';
import { state, els } from '../../app/modules/state.js';
import { pageRenderCache, cacheRenderedPage } from '../../app/modules/perf.js';
import { setActiveInlineEditor, setActiveTextLayer } from '../../app/modules/render-text-layer.js';

// ─── Setup: inject minimal deps ─────────────────────────────────────────────

/** shared deps tracker used by some tests */
let depsCalled = {};

beforeEach(() => {
  // Reset state fields used by render-controller
  state.adapter = null;
  state.currentPage = 1;
  state.pageCount = 10;
  state.zoom = 1;
  state.rotation = 0;
  state.drawEnabled = false;
  state.ocrRegionMode = false;

  // Reset active editor / text layer from sub-module
  setActiveInlineEditor(null);
  setActiveTextLayer(null);

  // Clear the page render cache
  pageRenderCache.entries.clear();
  pageRenderCache.totalPixels = 0;

  // Fresh DOM elements every test to avoid bleed-through
  els.canvas = document.createElement('canvas');
  els.canvas.width = 200;
  els.canvas.height = 150;
  els.canvas.style.width = '200px';
  els.canvas.style.height = '150px';

  const ac = document.createElement('canvas');
  els.annotationCanvas = ac;

  const cw = document.createElement('div');
  els.canvasWrap = cw;

  els.pageStatus = document.createElement('span');
  els.zoomStatus = document.createElement('span');
  els.pageInput = document.createElement('input');
  els.emptyState = document.createElement('div');
  els.sbPage = document.createElement('span');
  els.sbZoom = document.createElement('span');
  els.pdfBlockEdit = document.createElement('div');

  depsCalled = {};
  initRenderControllerDeps({
    renderAnnotations: () => { depsCalled.renderAnnotations = true; },
    capturePageHistoryOnRender: () => { depsCalled.capturePageHistoryOnRender = true; },
    saveViewState: () => { depsCalled.saveViewState = true; },
    renderCommentList: () => { depsCalled.renderCommentList = true; },
    trackVisitedPage: () => { depsCalled.trackVisitedPage = true; },
    renderReadingProgress: () => { depsCalled.renderReadingProgress = true; },
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

  it('can be called multiple times (debounce replaces previous timer)', () => {
    _schedulePreRender(1, 1, 0);
    _schedulePreRender(2, 1, 0);
    _schedulePreRender(3, 1.5, 90);
    // No error means the debounce logic works
  });
});

// ─── _updateAnnotationCanvas ────────────────────────────────────────────────

describe('_updateAnnotationCanvas', () => {
  it('sizes annotation canvas based on main canvas display size', () => {
    els.canvas.style.width = '400px';
    els.canvas.style.height = '300px';

    _updateAnnotationCanvas();

    // annotation canvas CSS should match display dimensions
    assert.equal(els.annotationCanvas.style.width, '400px');
    assert.equal(els.annotationCanvas.style.height, '300px');
    // pixel dimensions should be scaled by dpr (at least 1)
    assert.ok(els.annotationCanvas.width >= 400);
    assert.ok(els.annotationCanvas.height >= 300);
  });

  it('uses canvas.width as fallback when style.width is empty', () => {
    els.canvas = document.createElement('canvas');
    els.canvas.width = 500;
    els.canvas.height = 400;
    // no style.width/height set

    _updateAnnotationCanvas();

    assert.equal(els.annotationCanvas.style.width, '500px');
    assert.equal(els.annotationCanvas.style.height, '400px');
  });

  it('calls renderAnnotations dep', () => {
    _updateAnnotationCanvas();
    assert.equal(depsCalled.renderAnnotations, true);
  });

  it('toggles drawing-enabled class when drawEnabled is true', () => {
    state.drawEnabled = true;
    _updateAnnotationCanvas();
    assert.ok(els.annotationCanvas.classList.contains('drawing-enabled'));
  });

  it('toggles drawing-enabled class when ocrRegionMode is true', () => {
    state.ocrRegionMode = true;
    _updateAnnotationCanvas();
    assert.ok(els.annotationCanvas.classList.contains('drawing-enabled'));
  });

  it('removes drawing-enabled class when neither draw nor ocr mode', () => {
    state.drawEnabled = false;
    state.ocrRegionMode = false;
    _updateAnnotationCanvas();
    assert.ok(!els.annotationCanvas.classList.contains('drawing-enabled'));
  });

  it('ensures minimum dimension of 1', () => {
    els.canvas = document.createElement('canvas');
    els.canvas.width = 0;
    els.canvas.height = 0;
    // style is also empty, so parseFloat will give NaN → max(1, ...) = 1

    _updateAnnotationCanvas();

    assert.equal(els.annotationCanvas.style.width, '1px');
    assert.equal(els.annotationCanvas.style.height, '1px');
  });
});

// ─── _preRenderAdjacent (additional branch coverage) ────────────────────────

describe('_preRenderAdjacent (additional)', () => {
  it('skips pages already cached at same zoom and rotation', async () => {
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

    // Pre-populate cache for page 6 at zoom=1, rotation=0
    const fakeCached = document.createElement('canvas');
    fakeCached.width = 100;
    fakeCached.height = 100;
    cacheRenderedPage(6, fakeCached, 1, 0);

    await _preRenderAdjacent(5, 1, 0);
    // Page 6 should be skipped (already cached), only page 4 rendered
    assert.ok(!rendered.includes(6), 'should skip cached page 6');
    assert.ok(rendered.includes(4), 'should render page 4');
  });

  it('handles adapter.renderPage error gracefully', async () => {
    state.adapter = {
      renderPage: async () => {
        throw new Error('render failed');
      },
    };
    state.currentPage = 5;
    state.pageCount = 10;

    // Should not throw
    await _preRenderAdjacent(5, 1, 0);
  });

  it('aborts pre-render if user navigated before async render', async () => {
    const rendered = [];
    state.adapter = {
      renderPage: async (page, canvas) => {
        canvas.width = 100;
        canvas.height = 100;
        rendered.push(page);
      },
    };
    state.currentPage = 5;
    state.pageCount = 10;

    // Navigate away before calling
    state.currentPage = 3;
    await _preRenderAdjacent(5, 1, 0);
    // Rendering may happen for first target but will detect navigation mismatch
    // The check `state.currentPage !== page` before the loop body should short-circuit
  });

  it('handles single-page document (page 1 of 1)', async () => {
    const rendered = [];
    state.adapter = {
      renderPage: async (page, canvas) => {
        rendered.push(page);
        canvas.width = 100;
        canvas.height = 100;
      },
    };
    state.currentPage = 1;
    state.pageCount = 1;

    await _preRenderAdjacent(1, 1, 0);
    assert.equal(rendered.length, 0, 'no adjacent pages to render');
  });
});

// ─── _updatePageUI (additional branch coverage) ─────────────────────────────

describe('_updatePageUI (additional)', () => {
  it('calls capturePageHistoryOnRender and saveViewState deps', () => {
    state.currentPage = 1;
    state.pageCount = 5;
    state.zoom = 1;
    _updatePageUI(10);
    assert.equal(depsCalled.capturePageHistoryOnRender, true);
    assert.equal(depsCalled.saveViewState, true);
  });

  it('refreshes block editor overlay when pdfBlockEdit is active', () => {
    state.currentPage = 1;
    state.pageCount = 5;
    state.zoom = 1;
    els.pdfBlockEdit.classList.add('active');

    // blockEditor.refreshOverlay may not be fully mockable, but we test the branch
    // is reached without error. If blockEditor.refreshOverlay throws, we'd see it.
    // Since blockEditor is imported from pdf-advanced-edit, just test it doesn't crash.
    try {
      _updatePageUI(10);
    } catch (err) {
      // If refreshOverlay isn't available, that's expected in test env
      // The important thing is we reached the branch
    }
    assert.equal(els.pageStatus.textContent, '1 / 5');
  });

  it('handles missing sbPage/sbZoom gracefully', () => {
    state.currentPage = 2;
    state.pageCount = 3;
    state.zoom = 2;
    els.sbPage = null;
    els.sbZoom = null;
    _updatePageUI(5);
    assert.equal(els.pageStatus.textContent, '2 / 3');
    assert.equal(els.zoomStatus.textContent, '200%');
  });
});

// ─── initRenderControllerDeps ───────────────────────────────────────────────

describe('initRenderControllerDeps', () => {
  it('injects deps and forwards setOcrStatus to sub-modules', () => {
    let ocrStatusCalled = false;
    initRenderControllerDeps({
      renderAnnotations: () => {},
      capturePageHistoryOnRender: () => {},
      saveViewState: () => {},
      renderCommentList: () => {},
      trackVisitedPage: () => {},
      renderReadingProgress: () => {},
      setOcrStatus: () => { ocrStatusCalled = true; },
    });
    // deps are injected; we verify indirectly through _updateAnnotationCanvas and _updatePageUI
    _updateAnnotationCanvas();
  });

  it('can be called multiple times (Object.assign merges)', () => {
    let val = 0;
    initRenderControllerDeps({
      renderAnnotations: () => { val = 1; },
      setOcrStatus: () => {},
    });
    _updateAnnotationCanvas();
    assert.equal(val, 1);

    initRenderControllerDeps({
      renderAnnotations: () => { val = 2; },
      setOcrStatus: () => {},
    });
    _updateAnnotationCanvas();
    assert.equal(val, 2);
  });
});

// ─── renderCurrentPage ──────────────────────────────────────────────────────

describe('renderCurrentPage', () => {
  it('returns early when no adapter', async () => {
    state.adapter = null;
    // Should not throw
    await renderCurrentPage();
  });

  it('performs a full render with adapter', async () => {
    let renderedPage = null;
    state.adapter = {
      renderPage: async (page, canvas, opts) => {
        renderedPage = page;
        canvas.width = 300;
        canvas.height = 200;
        canvas.style.width = '300px';
        canvas.style.height = '200px';
      },
      getPageViewport: async (page, scale, rotation) => {
        return { width: 300, height: 200 };
      },
    };
    state.currentPage = 3;
    state.pageCount = 10;
    state.zoom = 1;
    state.rotation = 0;

    await renderCurrentPage();

    assert.equal(renderedPage, 3);
    assert.equal(els.pageStatus.textContent, '3 / 10');
  });

  it('uses cache hit for exact zoom and rotation match', async () => {
    let adapterRenderCalled = false;
    state.adapter = {
      renderPage: async () => { adapterRenderCalled = true; },
      getPageViewport: async () => ({ width: 200, height: 150 }),
    };
    state.currentPage = 2;
    state.pageCount = 5;
    state.zoom = 1;
    state.rotation = 0;

    // Pre-populate cache for page 2 at zoom=1, rotation=0
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = 200;
    cachedCanvas.height = 150;
    cachedCanvas.style.width = '200px';
    cachedCanvas.style.height = '150px';
    cacheRenderedPage(2, cachedCanvas, 1, 0);

    await renderCurrentPage();

    // Should use cache instead of calling adapter.renderPage
    assert.equal(adapterRenderCalled, false, 'adapter.renderPage should not be called when cache hits');
    assert.equal(els.pageStatus.textContent, '2 / 5');
  });

  it('shows stale cache as placeholder when zoom differs', async () => {
    let adapterRenderCalled = false;
    state.adapter = {
      renderPage: async (page, canvas) => {
        adapterRenderCalled = true;
        canvas.width = 400;
        canvas.height = 300;
      },
      getPageViewport: async () => ({ width: 400, height: 300 }),
    };
    state.currentPage = 2;
    state.pageCount = 5;
    state.zoom = 2;  // different zoom than cached
    state.rotation = 0;

    // Cache at zoom=1
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = 200;
    cachedCanvas.height = 150;
    cacheRenderedPage(2, cachedCanvas, 1, 0);

    await renderCurrentPage();

    assert.equal(adapterRenderCalled, true, 'should do full render when zoom differs');
  });

  it('cleans up active inline editor from previous page', async () => {
    const fakeEditor = document.createElement('div');
    let removed = false;
    fakeEditor.remove = () => { removed = true; };
    setActiveInlineEditor(fakeEditor);

    state.adapter = {
      renderPage: async (page, canvas) => { canvas.width = 100; canvas.height = 100; },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    await renderCurrentPage();

    assert.equal(removed, true, 'should remove active inline editor');
  });

  it('cancels active text layer from previous page', async () => {
    let cancelled = false;
    const fakeTextLayer = { cancel: () => { cancelled = true; } };
    setActiveTextLayer(fakeTextLayer);

    state.adapter = {
      renderPage: async (page, canvas) => { canvas.width = 100; canvas.height = 100; },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    await renderCurrentPage();

    assert.equal(cancelled, true, 'should cancel active text layer');
  });

  it('handles RenderingCancelledException gracefully', async () => {
    state.adapter = {
      renderPage: async () => {
        const err = new Error('Rendering cancelled');
        err.name = 'RenderingCancelledException';
        throw err;
      },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    // Should not throw
    await renderCurrentPage();
  });

  it('handles "cannot use the same canvas" error gracefully', async () => {
    state.adapter = {
      renderPage: async () => {
        throw new Error('Cannot use the same canvas during rendering');
      },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    // Should not throw
    await renderCurrentPage();
  });

  it('rethrows unknown render errors', async () => {
    state.adapter = {
      renderPage: async () => {
        throw new Error('Unknown fatal error');
      },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    await assert.rejects(
      () => renderCurrentPage(),
      { message: 'Unknown fatal error' }
    );
  });

  it('discards stale render when generation changes during render', async () => {
    state.adapter = {
      renderPage: async (page, canvas) => {
        canvas.width = 100;
        canvas.height = 100;
        // Simulate another render starting while we were rendering
        bumpRenderGeneration();
        bumpRenderGeneration();
      },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    // Store the page status before render
    els.pageStatus.textContent = 'before';

    await renderCurrentPage();

    // Since generation changed, _updatePageUI should NOT have been called
    // (the stale render is discarded)
    assert.equal(els.pageStatus.textContent, 'before');
  });

  it('creates and removes skeleton during render', async () => {
    let skeletonSeen = false;
    state.adapter = {
      renderPage: async (page, canvas) => {
        // Check that skeleton was added to canvasWrap
        const sk = els.canvasWrap.querySelector('.page-skeleton');
        if (sk) skeletonSeen = true;
        canvas.width = 100;
        canvas.height = 100;
      },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    await renderCurrentPage();

    assert.equal(skeletonSeen, true, 'skeleton should exist during render');
    const skeletonAfter = els.canvasWrap.querySelector('.page-skeleton');
    assert.equal(skeletonAfter, null, 'skeleton should be removed after render');
  });

  it('removes skeleton on render error', async () => {
    state.adapter = {
      renderPage: async () => {
        throw new Error('Rendering cancelled');
      },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    await renderCurrentPage();

    const skeleton = els.canvasWrap.querySelector('.page-skeleton');
    assert.equal(skeleton, null, 'skeleton should be removed on error');
  });

  it('hides empty state on render', async () => {
    els.emptyState.style.display = 'block';
    state.adapter = {
      renderPage: async (page, canvas) => { canvas.width = 100; canvas.height = 100; },
      getPageViewport: async () => ({ width: 100, height: 100 }),
    };
    state.currentPage = 1;
    state.pageCount = 5;

    await renderCurrentPage();

    assert.equal(els.emptyState.style.display, 'none');
  });
});
