// @ts-check
// ─── Render Controller (Orchestrator) ────────────────────────────────────────
// Page rendering, pre-render bookkeeping, annotation-canvas sync, page-UI updates.
// Text layer, inline editing, and annotation overlay logic split into sub-modules:
//   - render-text-layer.js:  Text layer creation, OCR text layer, inline editing
//   - render-annotations-overlay.js: Watermarks, stamps, signatures, image insertion
//
// NOTE: render-pipeline.js provides a lower-level unified render pipeline with
// its own cache (renderPage, schedulePreRender, invalidateCache, getCacheStats).
// This module contains the higher-level orchestration that wires the pipeline
// into the app UI.

import { state, els } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';

// Safe a11y announce — imported lazily to avoid test environment issues
let _announce = /** @type {(msg: string, priority?: string) => void} */ (() => {});
import('./a11y.js').then(m => { _announce = m.announce; }).catch(() => {});
import { recordPerfMetric, cacheRenderedPage, getCachedPage, pageRenderCache } from './perf.js';
import { recordSuccessfulOperation } from './crash-telemetry.js';
import { blockEditor } from './pdf-advanced-edit.js';
import { shouldUseTileRendering, renderTiles, invalidateTiles, setRenderGenerationGetter } from './tile-renderer.js';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';
import { emit } from './event-bus.js';
// ─── Imports from sub-modules (for local use + re-export) ───────────────────
import {
  initRenderTextLayerDeps,
  _ocrWordCache,
  renderTextLayer,
  _renderPdfAnnotationLayer,
  _renderManualTextLayer,
  _renderOcrTextLayer,
  enableInlineTextEditing,
  disableInlineTextEditing,
  _handleTextLayerClick,
  _handleTextLayerDblClick,
  _findParagraphSpans,
  _createParagraphEditor,
  _reflowTextToSpans,
  _createInlineEditor,
  _syncTextLayerToStorage,
  getActiveTextLayer,
  setActiveTextLayer,
  getActiveInlineEditor,
  setActiveInlineEditor,
} from './render-text-layer.js';

import {
  initRenderAnnotationsOverlayDeps,
  safeCreateObjectURL,
  handleImageInsertion,
  addWatermarkToPage,
  addStampToPage,
  openSignaturePad,
} from './render-annotations-overlay.js';

// Re-export for backwards compatibility
export {
  _ocrWordCache, renderTextLayer, _renderPdfAnnotationLayer, _renderManualTextLayer,
  _renderOcrTextLayer, enableInlineTextEditing, disableInlineTextEditing,
  _handleTextLayerClick, _handleTextLayerDblClick, _findParagraphSpans,
  _createParagraphEditor, _reflowTextToSpans, _createInlineEditor,
  _syncTextLayerToStorage, getActiveTextLayer, setActiveTextLayer,
  getActiveInlineEditor, setActiveInlineEditor,
  safeCreateObjectURL, handleImageInsertion, addWatermarkToPage,
  addStampToPage, openSignaturePad,
};

// ─── Late-bound dependencies ────────────────────────────────────────────────
// Injected from app.js to avoid circular imports.
const _deps = {
  renderAnnotations: () => {},
  capturePageHistoryOnRender: () => {},
  saveViewState: () => {},
  renderCommentList: () => {},
  trackVisitedPage: () => {},
  renderReadingProgress: () => {},
  setOcrStatus: () => {},
};

/**
 * Inject runtime dependencies that live in app.js.
 * Must be called once during startup before any render functions are used.
 * Forwards relevant deps to sub-modules.
 */
export function initRenderControllerDeps(deps) {
  Object.assign(_deps, deps);
  // Forward deps to sub-modules
  initRenderTextLayerDeps({ setOcrStatus: deps.setOcrStatus });
  initRenderAnnotationsOverlayDeps({ setOcrStatus: deps.setOcrStatus });
}

// ─── Module-local state ─────────────────────────────────────────────────────

/** Pre-render timer handle */
let _preRenderTimer = 0;

/** Render generation counter -- incremented on each renderCurrentPage call.
 *  Used to discard stale renders when a newer render has started. */
let _renderGeneration = 0;

/** Last rendered page number — used to skip transition animation on same-page re-renders */
let _lastRenderedPage = -1;

/** Increment and return the render generation (also used by file-controller). */
export function bumpRenderGeneration() { return ++_renderGeneration; }

/** Return the current render generation (used by tile-renderer to detect stale renders). */
export function getRenderGeneration() { return _renderGeneration; }

// Wire generation getter to tile-renderer (avoids circular import)
setRenderGenerationGetter(getRenderGeneration);

// ─── Pre-render bookkeeping ─────────────────────────────────────────────────

export function _schedulePreRender(currentPage, zoom, rotation) {
  clearSafeTimeout(_preRenderTimer);
  _preRenderTimer = safeTimeout(() => {
    _preRenderAdjacent(currentPage, zoom, rotation);
  }, 150); // slight delay so the current page settles first
}

export async function _preRenderAdjacent(page, zoom, rotation) {
  if (!state.adapter) return;
  const targets = [];
  // Pre-render ±3 adjacent pages (was ±1) for smoother sequential navigation (#3)
  for (let offset = 1; offset <= 3; offset++) {
    if (page + offset <= state.pageCount) targets.push(page + offset);
    if (page - offset >= 1)              targets.push(page - offset);
  }
  for (const p of targets) {
    // Skip if already cached at this zoom/rotation
    const existing = pageRenderCache.entries.get(p);
    if (existing && existing.zoom === zoom && existing.rotation === rotation) continue;
    // Don't pre-render if user has already navigated away
    if (state.currentPage !== page) return;
    try {
      const offscreen = document.createElement('canvas');
      await state.adapter.renderPage(p, offscreen, { zoom, rotation });
      // Verify user didn't navigate away during async render
      if (state.currentPage !== page) { offscreen.width = 0; offscreen.height = 0; return; }
      cacheRenderedPage(p, offscreen, zoom, rotation);
      offscreen.width = 0;
      offscreen.height = 0;
    } catch (err) {
      console.warn('[render-controller] error:', err?.message);
      // Pre-render failures are non-critical; silently ignore
    }
  }
}

// ─── Helper: blit a cached entry onto the main canvas ───────────────────────

export function _blitCacheToCanvas(entry, canvas) {
  canvas.width = entry.canvas.width;
  canvas.height = entry.canvas.height;
  if (entry.cssWidth) canvas.style.width = entry.cssWidth;
  if (entry.cssHeight) canvas.style.height = entry.cssHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(entry.canvas, 0, 0);
}

export function _updateAnnotationCanvas() {
  const displayWidth = Math.max(1, Math.round(parseFloat(/** @type {any} */ (els.canvas).style.width || String(/** @type {any} */ (els.canvas).width))));
  const displayHeight = Math.max(1, Math.round(parseFloat(/** @type {any} */ (els.canvas).style.height || String(/** @type {any} */ (els.canvas).height))));
  const annotDpr = Math.max(1, window.devicePixelRatio || 1);
  /** @type {any} */ (els.annotationCanvas).width = Math.ceil(displayWidth * annotDpr);
  /** @type {any} */ (els.annotationCanvas).height = Math.ceil(displayHeight * annotDpr);
  els.annotationCanvas.style.width = `${displayWidth}px`;
  els.annotationCanvas.style.height = `${displayHeight}px`;
  // Re-apply drawing-enabled class after canvas resize to preserve pointer events
  const drawingActive = !!(state.drawEnabled || state.ocrRegionMode);
  els.annotationCanvas.classList.toggle('drawing-enabled', drawingActive);
  _deps.renderAnnotations?.();
}

export function _updatePageUI(renderMs) {
  els.pageStatus.textContent = `${state.currentPage} / ${state.pageCount}`;
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  /** @type {any} */ (els.pageInput).value = String(state.currentPage);

  // Accessibility: update ARIA labels and announce page change
  try {
    if (els.canvas?.setAttribute) els.canvas.setAttribute('aria-label', `${state.docName || 'Документ'}, страница ${state.currentPage} из ${state.pageCount}`);
    _announce(`Страница ${state.currentPage} из ${state.pageCount}`);
  } catch (_e) { /* test environment */ }
  _deps.capturePageHistoryOnRender?.();
  _deps.saveViewState?.();
  // Update status bar
  if (els.sbPage) els.sbPage.textContent = `Стр. ${state.currentPage} / ${state.pageCount}`;
  if (els.sbZoom) els.sbZoom.textContent = `${Math.round(state.zoom * 100)}%`;
  if (els.pdfBlockEdit?.classList.contains('active')) {
    blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
  }
  const renderedPage = state.currentPage;
  if (renderMs != null) {
    recordPerfMetric('renderTimes', renderMs);
    recordSuccessfulOperation();
  }
  requestAnimationFrame(() => {
    _deps.renderCommentList?.();
    /** @type {any} */ (_deps).trackVisitedPage?.(renderedPage);
    _deps.renderReadingProgress?.();
    pushDiagnosticEvent('page.render', {
      page: renderedPage,
      zoom: Number(state.zoom.toFixed(2)),
      rotation: state.rotation,
      ms: renderMs ?? 0,
    });
    // Notify app of page render for bookmark/thumbnail updates
    try { emit('page-rendered', { page: renderedPage }); } catch (err) { console.warn('[render-controller] error:', err?.message); }
  });
}

export async function renderCurrentPage() {
  if (!state.adapter) return;

  try { performance.mark('render-page-start'); } catch (_e) { /* Performance API unavailable */ }

  // Clean up inline editor from previous page
  const activeEditor = getActiveInlineEditor();
  if (activeEditor) {
    activeEditor.remove();
    setActiveInlineEditor(null);
  }

  // Cancel any in-progress text layer render
  const activeTextLayer = getActiveTextLayer();
  if (activeTextLayer) {
    try { activeTextLayer.cancel(); } catch (_e) { /* already cancelled */ }
    setActiveTextLayer(null);
  }

  const generation = ++_renderGeneration;
  const renderStartedAt = performance.now();
  const page = state.currentPage;
  const zoom = state.zoom;
  const rotation = state.rotation;

  els.emptyState.style.display = 'none';

  // ── Trigger page transition animation only for page navigation ──
  // Skip for same-page re-renders (zoom, rotation) to avoid a confusing
  // opacity:0 flash while the render completes.
  els.canvas.classList.remove('page-transitioning');
  const isPageChange = page !== _lastRenderedPage;
  _lastRenderedPage = page;
  if (isPageChange) {
    requestAnimationFrame(() => {
      if (_renderGeneration === generation) {
        els.canvas.classList.add('page-transitioning');
        els.canvas.addEventListener('animationend', () => {
          els.canvas.classList.remove('page-transitioning');
        }, { once: true });
      }
    });
  }

  // ── Fast path: exact cache hit (same zoom & rotation) -> instant display ──
  const cached = getCachedPage(page);
  if (cached && cached.zoom === zoom && cached.rotation === rotation && cached.canvas.width > 0) {
    _blitCacheToCanvas(cached, els.canvas);
    // Defer expensive annotation canvas resize/repaint to next frame so it
    // doesn't inflate the render-page performance measurement (#2).
    requestAnimationFrame(() => _updateAnnotationCanvas());
    _updatePageUI(Math.round(performance.now() - renderStartedAt));
    _schedulePreRender(page, zoom, rotation);
    // Always rebuild text layer on page change — without this the previous
    // page's OCR/PDF text layer would persist on the new page.
    renderTextLayer(page, zoom, rotation).catch((err) => { console.warn('[render-controller] error:', err?.message); });
    try {
      performance.mark('render-page-end');
      performance.measure('render-page', 'render-page-start', 'render-page-end');
    } catch (_e) { /* Performance API unavailable */ }
    return;
  }

  // ── Show stale cache as placeholder while rendering ──
  // Only blit if the cached entry matches the target zoom & rotation to avoid
  // showing a briefly wrong zoom level or rotation angle.
  if (cached && cached.canvas.width > 0 && generation === _renderGeneration
      && cached.zoom === zoom && cached.rotation === rotation) {
    _blitCacheToCanvas(cached, els.canvas);
  }

  // ── Show skeleton loading placeholder while rendering ──
  let skeleton = null;
  const canvasWrap = els.canvasWrap;
  if (canvasWrap) {
    // Remove any leftover skeleton from a previous render
    canvasWrap.querySelector('.page-skeleton')?.remove();
    skeleton = document.createElement('div');
    skeleton.className = 'page-skeleton';
    skeleton.style.position = 'absolute';
    skeleton.style.inset = '0';
    skeleton.style.zIndex = '1';
    skeleton.style.pointerEvents = 'none';
    canvasWrap.appendChild(skeleton);
  }

  // ── Full render (with tile-based fallback for very large pages) ──
  try {
    // Check if tile rendering is needed for this page at the current zoom/dpr
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const previewViewport = await state.adapter.getPageViewport(page, zoom * dpr, rotation);
    if (shouldUseTileRendering(previewViewport)) {
      invalidateTiles();
      await renderTiles(state.adapter, page, /** @type {any} */ (els.canvas), { zoom, rotation }, els.canvasWrap);
    } else {
      await state.adapter.renderPage(page, els.canvas, { zoom, rotation });
    }
  } catch (err) {
    if (skeleton) skeleton.remove();
    if (err?.name === 'RenderingCancelledException' || err?.message?.includes('Rendering cancelled')) return;
    const msg = String(err?.message || err || '');
    if (/cannot use the same canvas/i.test(msg)) {
      console.warn('[render] canvas conflict, will retry on next render:', msg);
      return;
    }
    throw err;
  }

  // ── Remove skeleton after render ──
  if (skeleton) skeleton.remove();

  // Discard stale render if a newer renderCurrentPage call has started
  if (generation !== _renderGeneration) return;

  // Record render time BEFORE expensive annotation canvas operations (#2).
  _updatePageUI(Math.round(performance.now() - renderStartedAt));
  // Defer annotation canvas resize/repaint to next animation frame to keep
  // the perf.measure within budget and avoid a longtask warning.
  requestAnimationFrame(() => _updateAnnotationCanvas());

  cacheRenderedPage(page, els.canvas, zoom, rotation);
  _schedulePreRender(page, zoom, rotation);

  // Render text layer after page render (non-blocking)
  renderTextLayer(page, zoom, rotation).catch((err) => { console.warn('[render-controller] error:', err?.message); });

  try {
    performance.mark('render-page-end');
    performance.measure('render-page', 'render-page-start', 'render-page-end');
  } catch (_e) { /* Performance API unavailable */ }
}
