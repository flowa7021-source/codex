// ─── Render Controller ──────────────────────────────────────────────────────
// Page rendering, text-layer management, inline text editing, and PDF overlays.
// Extracted from app.js as part of module decomposition.
//
// NOTE: render-pipeline.js provides a lower-level unified render pipeline with
// its own cache (renderPage, schedulePreRender, invalidateCache, getCacheStats).
// This module contains the higher-level orchestration that wires the pipeline
// into the app UI: pre-render bookkeeping, annotation-canvas sync, page-UI
// updates, OCR text layers, inline editing, watermarks, stamps, and signatures.

import { state, els } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { getPdfjsLib } from './loaders.js';
import { recordPerfMetric, cacheRenderedPage, getCachedPage, pageRenderCache } from './perf.js';
import { recordSuccessfulOperation } from './crash-telemetry.js';
import { loadOcrTextData } from './workspace-controller.js';
import { setPageEdits, persistEdits } from './export-controller.js';
import { blockEditor } from './pdf-advanced-edit.js';
import { addSignatureToPdf } from './pdf-operations.js';
import { renderConfidenceOverlay } from './ocr-confidence-map.js';
import { shouldUseTileRendering, renderTiles, invalidateTiles } from './tile-renderer.js';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

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
 */
export function initRenderControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Module-local state ─────────────────────────────────────────────────────

/** OCR word-level data per page, reused by DOCX export & search */
export const _ocrWordCache = new Map();

/** Track active TextLayer instance for cleanup */
let _activeTextLayer = null;

/** Active inline text editor element */
let _activeInlineEditor = null;

/** Pre-render timer handle */
let _preRenderTimer = 0;

/** Render generation counter — incremented on each renderCurrentPage call.
 *  Used to discard stale renders when a newer render has started. */
let _renderGeneration = 0;

/** Increment and return the render generation (also used by file-controller). */
export function bumpRenderGeneration() { return ++_renderGeneration; }

/** Return the current render generation (used by tile-renderer to detect stale renders). */
export function getRenderGeneration() { return _renderGeneration; }

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
  if (page + 1 <= state.pageCount) targets.push(page + 1);
  if (page - 1 >= 1) targets.push(page - 1);
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
  const displayWidth = Math.max(1, Math.round(parseFloat(els.canvas.style.width || String(els.canvas.width))));
  const displayHeight = Math.max(1, Math.round(parseFloat(els.canvas.style.height || String(els.canvas.height))));
  const annotDpr = Math.max(1, window.devicePixelRatio || 1);
  els.annotationCanvas.width = Math.ceil(displayWidth * annotDpr);
  els.annotationCanvas.height = Math.ceil(displayHeight * annotDpr);
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
  els.pageInput.value = String(state.currentPage);
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
    _deps.trackVisitedPage?.(renderedPage);
    _deps.renderReadingProgress?.();
    pushDiagnosticEvent('page.render', {
      page: renderedPage,
      zoom: Number(state.zoom.toFixed(2)),
      ms: renderMs ?? 0,
    });
    // Notify app of page render for bookmark/thumbnail updates
    try { window.dispatchEvent(new CustomEvent('page-rendered', { detail: { page: renderedPage } })); } catch (err) { console.warn('[render-controller] error:', err?.message); }
  });
}

export async function renderCurrentPage() {
  if (!state.adapter) return;

  // Clean up inline editor from previous page
  if (_activeInlineEditor) {
    _activeInlineEditor.remove();
    _activeInlineEditor = null;
  }

  // Cancel any in-progress text layer render
  if (_activeTextLayer) {
    try { _activeTextLayer.cancel(); } catch (_e) { /* already cancelled */ }
    _activeTextLayer = null;
  }

  const generation = ++_renderGeneration;
  const renderStartedAt = performance.now();
  const page = state.currentPage;
  const zoom = state.zoom;
  const rotation = state.rotation;

  els.emptyState.style.display = 'none';

  // ── Trigger page transition animation ──
  els.canvas.classList.remove('page-transitioning');
  // Force reflow so re-adding the class restarts the animation
  void els.canvas.offsetWidth;
  els.canvas.classList.add('page-transitioning');
  els.canvas.addEventListener('animationend', () => {
    els.canvas.classList.remove('page-transitioning');
  }, { once: true });

  // ── Fast path: exact cache hit (same zoom & rotation) → instant display ──
  const cached = getCachedPage(page);
  if (cached && cached.zoom === zoom && cached.rotation === rotation && cached.canvas.width > 0) {
    _blitCacheToCanvas(cached, els.canvas);
    _updateAnnotationCanvas();
    _updatePageUI(Math.round(performance.now() - renderStartedAt));
    _schedulePreRender(page, zoom, rotation);
    return;
  }

  // ── Show stale cache as placeholder while rendering ──
  if (cached && cached.canvas.width > 0) {
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
      await renderTiles(state.adapter, page, els.canvas, { zoom, rotation }, els.canvasWrap);
    } else {
      await state.adapter.renderPage(page, els.canvas, { zoom, rotation });
    }
  } catch (err) {
    if (skeleton) skeleton.remove();
    if (err?.name === 'RenderingCancelledException' || err?.message?.includes('Rendering cancelled')) return;
    const msg = String(err?.message || err || '');
    if (/cannot use the same canvas/i.test(msg)) return;
    throw err;
  }

  // ── Remove skeleton after render ──
  if (skeleton) skeleton.remove();

  // Discard stale render if a newer renderCurrentPage call has started
  if (generation !== _renderGeneration) return;

  _updateAnnotationCanvas();
  _updatePageUI(Math.round(performance.now() - renderStartedAt));

  cacheRenderedPage(page, els.canvas, zoom, rotation);
  _schedulePreRender(page, zoom, rotation);

  // Render text layer after page render (non-blocking)
  renderTextLayer(page, zoom, rotation).catch((err) => { console.warn('[render-controller] error:', err?.message); });
}

// ─── Safe createObjectURL wrapper ──────────────────────────────────────────

export function safeCreateObjectURL(data) {
  if (data instanceof Blob || data instanceof File) {
    return URL.createObjectURL(data);
  }
  // Wrap raw data in a Blob as fallback
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    return URL.createObjectURL(new Blob([data]));
  }
  if (typeof data === 'string') {
    return URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
  }
  console.warn('safeCreateObjectURL: invalid argument type', typeof data);
  return '';
}

// ─── Text Layer Rendering ──────────────────────────────────────────────────

/**
 * Render PDF.js AnnotationLayer (links, form widgets, etc.)
 */
export async function _renderPdfAnnotationLayer(page, viewport) {
  const container = els.pdfAnnotationLayer;
  if (!container) return;
  container.innerHTML = '';
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;

  const pdfjsLib = getPdfjsLib();
  if (!pdfjsLib?.AnnotationLayer) return;

  try {
    const annotations = await page.getAnnotations({ intent: 'display' });
    if (!annotations?.length) return;

    const parameters = {
      viewport: viewport.clone({ dontFlip: true }),
      div: container,
      annotations,
      page,
      linkService: {
        getDestinationHash: (_dest) => `#`,
        getAnchorUrl: (hash) => hash,
        addLinkAttributes: (link, url) => {
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        },
        isPageVisible: () => true,
        isPageCached: () => true,
      },
      renderForms: false,
    };

    const annotationLayer = new pdfjsLib.AnnotationLayer(parameters);
    await annotationLayer.render(parameters);
  } catch (err) {
    console.warn('AnnotationLayer render failed:', err);
  }
}

/**
 * Fallback: manual text layer rendering for older pdf.js without TextLayer class
 */
export function _renderManualTextLayer(container, textContent, viewport, zoom) {
  const fragment = document.createDocumentFragment();
  const transform = viewport.transform;

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;

    const span = document.createElement('span');
    span.textContent = item.str;

    // Apply viewport transform to get display coordinates
    const tx = item.transform;
    // PDF transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const x = transform[0] * tx[4] + transform[2] * tx[5] + transform[4];
    const y = transform[1] * tx[4] + transform[3] * tx[5] + transform[5];
    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const scaledFontSize = fontSize * zoom;

    span.style.left = `${x}px`;
    span.style.top = `${y - scaledFontSize}px`;
    span.style.fontSize = `${scaledFontSize}px`;
    span.style.fontFamily = item.fontName || 'sans-serif';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'nowrap';
    span.style.color = 'transparent';
    span.style.lineHeight = '1';

    if (item.width) {
      span.style.width = `${item.width * zoom}px`;
      span.style.letterSpacing = '0px';
      span.style.overflow = 'hidden';
    }

    fragment.appendChild(span);
  }

  container.appendChild(fragment);
}

export async function renderTextLayer(pageNum, zoom, rotation) {
  const container = els.textLayerDiv;
  if (!container) return;

  // Clean up previous TextLayer instance
  if (_activeTextLayer) {
    try { _activeTextLayer.cancel(); } catch (err) { console.warn('[render-controller] error:', err?.message); }
    _activeTextLayer = null;
  }
  container.innerHTML = '';
  if (els.pdfAnnotationLayer) els.pdfAnnotationLayer.innerHTML = '';
  container.style.width = els.canvas.style.width;
  container.style.height = els.canvas.style.height;

  if (!state.adapter) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // ── Path 1: PDF.js official TextLayer API ──
  if (state.adapter.type === 'pdf') {
    const pdfjsLib = getPdfjsLib();
    const page = await state.adapter.pdfDoc.getPage(pageNum);
    const displayViewport = page.getViewport({ scale: zoom, rotation });

    try {
      const textContent = await page.getTextContent({ normalizeWhitespace: true });

      if (!textContent?.items?.length) {
        container.classList.add('ocr-text-layer');
        await _renderOcrTextLayer(pageNum, zoom, dpr);
        return;
      }
      container.classList.remove('ocr-text-layer');

      // Size container to match display dimensions
      const displayW = parseFloat(els.canvas.style.width) || displayViewport.width;
      const displayH = parseFloat(els.canvas.style.height) || displayViewport.height;
      container.style.width = `${displayW}px`;
      container.style.height = `${displayH}px`;

      // Use official PDF.js TextLayer if available
      if (pdfjsLib?.TextLayer) {
        // Set --scale-factor CSS variable required by PDF.js TextLayer
        container.style.setProperty('--scale-factor', String(zoom));

        const textLayer = new pdfjsLib.TextLayer({
          container,
          textContentSource: textContent,
          viewport: displayViewport,
        });
        _activeTextLayer = textLayer;
        await textLayer.render();

        // Also render AnnotationLayer for interactive elements (links, widgets)
        _renderPdfAnnotationLayer(page, displayViewport).catch((err) => { console.warn('[render-controller] error:', err?.message); });
      } else {
        // Fallback: manual text layer (for older pdf.js without TextLayer class)
        _renderManualTextLayer(container, textContent, displayViewport, zoom);
      }
    } catch (err) {
      console.warn('Text layer render failed:', err);
    }
    return;
  }

  // ── Path 2: OCR-based text layer ──
  await _renderOcrTextLayer(pageNum, zoom, dpr);
}

export async function _renderOcrTextLayer(pageNum, zoom, dpr) {
  const container = els.textLayerDiv;
  if (!container) return;

  // Check OCR word cache
  let words = _ocrWordCache.get(pageNum);
  if (!words) {
    const ocr = loadOcrTextData();
    if (ocr?.pagesWords?.[pageNum - 1]) {
      words = ocr.pagesWords[pageNum - 1];
    }
  }
  if (!words || !words.length) return;

  // Word bboxes are in [0,1] normalized coordinates (relative to OCR source canvas).
  // We map them to CSS display dimensions for correct on-screen positioning.
  const displayW = parseFloat(els.canvas.style.width) || (els.canvas.width / dpr);
  const displayH = parseFloat(els.canvas.style.height) || (els.canvas.height / dpr);

  container.style.width = `${displayW}px`;
  container.style.height = `${displayH}px`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return;

  // Sort words into reading order
  const sortedWords = [...words].filter(w => w.text && w.bbox).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    const avgH = ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) / 2;
    // avgH is now in [0,1] range; compare proportionally
    return Math.abs(dy) < avgH * 0.4 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  const fragment = document.createDocumentFragment();

  for (const word of sortedWords) {
    const span = document.createElement('span');
    span.textContent = word.text;
    if (word.confidence != null) {
      span.dataset.confidence = String(word.confidence);
    }

    // Map normalized [0,1] coords → display pixels
    const x = word.bbox.x0 * displayW;
    const y = word.bbox.y0 * displayH;
    const w = (word.bbox.x1 - word.bbox.x0) * displayW;
    const h = (word.bbox.y1 - word.bbox.y0) * displayH;

    // Improved font-size fitting: use measureText to find optimal size
    let fontSize = Math.max(6, h * 0.78);
    if (word.text.length > 0 && h > 6) {
      // Try to match text height more accurately
      measureCtx.font = `${fontSize}px sans-serif`;
      const metrics = measureCtx.measureText(word.text);
      const actualH = (metrics.actualBoundingBoxAscent || fontSize * 0.8) + (metrics.actualBoundingBoxDescent || fontSize * 0.2);
      if (actualH > 0) {
        fontSize = Math.max(6, fontSize * (h / actualH) * 0.92);
      }
    }

    // Baseline alignment correction: shift down slightly for better overlap
    const baselineShift = h * 0.05;

    span.style.left = `${x}px`;
    span.style.top = `${y + baselineShift}px`;
    span.style.fontSize = `${fontSize}px`;
    span.style.width = `${w}px`;
    span.style.height = `${h}px`;
    span.style.lineHeight = `${h}px`;

    if (word.text.length > 1) {
      measureCtx.font = `${fontSize}px sans-serif`;
      const measuredWidth = measureCtx.measureText(word.text).width;
      if (measuredWidth > 0 && Math.abs(w - measuredWidth) > 1) {
        // Use scaleX transform if width difference is large
        const ratio = w / measuredWidth;
        if (ratio > 0.5 && ratio < 2.0) {
          span.style.transform = `scaleX(${ratio.toFixed(3)})`;
          span.style.transformOrigin = 'left top';
        } else {
          const spacing = (w - measuredWidth) / (word.text.length - 1);
          const clampedSpacing = Math.max(-fontSize * 0.3, Math.min(fontSize * 0.5, spacing));
          span.style.letterSpacing = `${clampedSpacing}px`;
        }
      }
    } else if (word.text.length === 1) {
      span.style.textAlign = 'center';
    }

    // Skew correction: apply rotation if word has baseline angle data
    if (word.baseline?.angle && Math.abs(word.baseline.angle) > 0.5) {
      span.style.transform = (span.style.transform || '') + ` rotate(${(-word.baseline.angle).toFixed(1)}deg)`;
      span.style.transformOrigin = span.style.transformOrigin || 'left bottom';
    }

    fragment.appendChild(span);
  }

  container.appendChild(fragment);

  // ── Render confidence overlay if enabled ──
  if (state.ocrConfidenceMode && sortedWords.length) {
    const annotCanvas = els.annotationCanvas;
    if (annotCanvas) {
      renderConfidenceOverlay(sortedWords, annotCanvas, displayW, displayH);
    }
  }
}

// ─── Inline Text Editor (Acrobat-style) ────────────────────────────────────

export function enableInlineTextEditing() {
  const container = els.textLayerDiv;
  if (!container) return;
  container.classList.add('editing');

  // Single click activates inline editing for better UX (Acrobat-style)
  container.addEventListener('click', _handleTextLayerClick);
  // Keep dblclick as fallback for paragraph-level editing
  container.addEventListener('dblclick', _handleTextLayerDblClick);
}

export function disableInlineTextEditing() {
  const container = els.textLayerDiv;
  if (!container) return;
  container.classList.remove('editing');
  container.removeEventListener('click', _handleTextLayerClick);
  container.removeEventListener('dblclick', _handleTextLayerDblClick);
  if (_activeInlineEditor) {
    _activeInlineEditor.remove();
    _activeInlineEditor = null;
  }
}

/**
 * Single-click handler: open an inline editor on the clicked span directly.
 * This gives an Acrobat-style "click to edit" experience.
 */
export function _handleTextLayerClick(e) {
  // Ignore clicks on an already-active inline editor
  if (e.target.closest('.inline-editor')) return;

  const span = e.target.closest('span');
  if (!span) {
    // Click on empty area -> create a new text block
    const rect = els.textLayerDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    _createInlineEditor(x, y, '', null, []);
    return;
  }

  // Open single-span editor immediately on click
  const rect = span.getBoundingClientRect();
  const containerRect = els.textLayerDiv.getBoundingClientRect();
  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  _createInlineEditor(x, y, span.textContent, span, []);
}

export function _handleTextLayerDblClick(e) {
  const span = e.target.closest('span');
  if (!span) {
    // Click on empty area → create new text block
    const rect = els.textLayerDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    _createInlineEditor(x, y, '', null, []);
    return;
  }

  // Group spans into a paragraph by Y-proximity for reflow editing
  const paragraphSpans = _findParagraphSpans(span);
  if (paragraphSpans.length > 1) {
    _createParagraphEditor(paragraphSpans);
  } else {
    // Single span edit (fallback)
    const rect = span.getBoundingClientRect();
    const containerRect = els.textLayerDiv.getBoundingClientRect();
    const x = rect.left - containerRect.left;
    const y = rect.top - containerRect.top;
    _createInlineEditor(x, y, span.textContent, span, []);
  }
}

/**
 * Find all spans that belong to the same paragraph as the target span.
 * Groups by Y-proximity: spans on the same or adjacent lines with similar X range.
 */
export function _findParagraphSpans(targetSpan) {
  const container = els.textLayerDiv;
  if (!container) return [targetSpan];

  const allSpans = Array.from(container.querySelectorAll('span:not(.inline-editor)'));
  if (allSpans.length <= 1) return [targetSpan];

  const targetRect = targetSpan.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const lineH = targetRect.height || 14;

  // Collect all spans with bounding info
  const spansWithRect = allSpans.map(s => ({
    span: s,
    rect: s.getBoundingClientRect(),
  }));

  // Find all spans on lines near the target span
  // A "paragraph" is a group of consecutive lines with spans that overlap in X
  const _targetRelY = targetRect.top - containerRect.top;
  const targetLeft = targetRect.left - containerRect.left;
  const _targetRight = targetLeft + targetRect.width;

  // Get all lines (groups of spans with similar Y)
  const lines = [];
  const sorted = [...spansWithRect].sort((a, b) => a.rect.top - b.rect.top);
  let currentLine = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = currentLine[currentLine.length - 1];
    if (Math.abs(sorted[i].rect.top - prev.rect.top) < lineH * 0.6) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine);
      currentLine = [sorted[i]];
    }
  }
  if (currentLine.length) lines.push(currentLine);

  // Find which line the target is on
  let targetLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].some(s => s.span === targetSpan)) {
      targetLineIdx = i;
      break;
    }
  }
  if (targetLineIdx === -1) return [targetSpan];

  // Expand up and down to find paragraph boundaries
  // A paragraph break occurs when there's a large vertical gap or significant X indent change
  let startLine = targetLineIdx;
  let endLine = targetLineIdx;

  // Expand upward
  for (let i = targetLineIdx - 1; i >= 0; i--) {
    const prevLine = lines[i + 1];
    const thisLine = lines[i];
    const gap = prevLine[0].rect.top - (thisLine[0].rect.top + thisLine[0].rect.height);
    if (gap > lineH * 0.8) break; // Large gap = paragraph break
    startLine = i;
  }

  // Expand downward
  for (let i = targetLineIdx + 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const thisLine = lines[i];
    const gap = thisLine[0].rect.top - (prevLine[0].rect.top + prevLine[0].rect.height);
    if (gap > lineH * 0.8) break;
    endLine = i;
  }

  // Collect all spans in the paragraph
  const result = [];
  for (let i = startLine; i <= endLine; i++) {
    for (const s of lines[i]) {
      result.push(s.span);
    }
  }

  return result.length ? result : [targetSpan];
}

/**
 * Create a paragraph-level contenteditable editor covering all paragraph spans.
 * Supports text reflow: edited text re-wraps within the paragraph bounds.
 */
export function _createParagraphEditor(spans) {
  if (_activeInlineEditor) _activeInlineEditor.remove();

  const containerRect = els.textLayerDiv.getBoundingClientRect();

  // Calculate bounding box of all spans in the paragraph
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of spans) {
    const r = s.getBoundingClientRect();
    const relX = r.left - containerRect.left;
    const relY = r.top - containerRect.top;
    minX = Math.min(minX, relX);
    minY = Math.min(minY, relY);
    maxX = Math.max(maxX, relX + r.width);
    maxY = Math.max(maxY, relY + r.height);
  }

  // Determine dominant font size from spans
  const fontSizes = spans.map(s => parseFloat(s.style.fontSize) || 14);
  const dominantFontSize = fontSizes.sort((a, b) => b - a)[0] || 14;

  // Collect text from spans (join with spaces, preserving line breaks)
  const text = spans.map(s => s.textContent).join(' ').replace(/\s+/g, ' ').trim();

  // Hide original spans
  for (const s of spans) s.style.visibility = 'hidden';

  const editor = document.createElement('div');
  editor.className = 'inline-editor paragraph-editor';
  editor.contentEditable = 'true';
  editor.textContent = text;
  editor.style.left = `${minX}px`;
  editor.style.top = `${minY}px`;
  editor.style.width = `${maxX - minX}px`;
  editor.style.minHeight = `${maxY - minY}px`;
  editor.style.fontSize = `${dominantFontSize}px`;
  editor.style.lineHeight = '1.3';
  editor.style.wordWrap = 'break-word';
  editor.style.overflowWrap = 'break-word';
  editor.style.whiteSpace = 'pre-wrap';

  editor.addEventListener('blur', () => {
    const newText = editor.textContent.trim();

    // Restore original spans visibility
    for (const s of spans) s.style.visibility = '';

    if (newText) {
      // Reflow: update the text content of spans to match edited text
      _reflowTextToSpans(spans, newText, dominantFontSize, maxX - minX);
    }

    editor.remove();
    _activeInlineEditor = null;
    _syncTextLayerToStorage();
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      for (const s of spans) s.style.visibility = '';
      editor.remove();
      _activeInlineEditor = null;
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
  });

  els.textLayerDiv.appendChild(editor);
  _activeInlineEditor = editor;
  editor.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Reflow edited text back into the original spans.
 * Distributes words across spans maintaining original positions.
 */
export function _reflowTextToSpans(spans, newText, _fontSize, _maxWidth) {
  const words = newText.split(/\s+/).filter(Boolean);
  if (!words.length || !spans.length) return;

  // Simple distribution: evenly distribute words across existing spans
  const wordsPerSpan = Math.max(1, Math.ceil(words.length / spans.length));

  for (let i = 0; i < spans.length; i++) {
    const start = i * wordsPerSpan;
    const end = Math.min(start + wordsPerSpan, words.length);
    const spanWords = words.slice(start, end);
    if (spanWords.length) {
      spans[i].textContent = spanWords.join(' ');
      spans[i].style.visibility = '';
    } else {
      // Extra spans: clear their text
      spans[i].textContent = '';
    }
  }

  // If there are remaining words that didn't fit, append to the last span
  const usedWords = spans.length * wordsPerSpan;
  if (usedWords < words.length) {
    const lastSpan = spans[spans.length - 1];
    const remaining = words.slice(usedWords).join(' ');
    lastSpan.textContent += ' ' + remaining;
  }
}

export function _createInlineEditor(x, y, initialText, targetSpan, _paragraphSpans) {
  if (_activeInlineEditor) _activeInlineEditor.remove();

  const editor = document.createElement('div');
  editor.className = 'inline-editor';
  editor.contentEditable = 'true';
  editor.textContent = initialText;
  editor.style.left = `${x}px`;
  editor.style.top = `${y}px`;
  if (targetSpan) {
    editor.style.minWidth = `${targetSpan.offsetWidth + 20}px`;
    editor.style.fontSize = targetSpan.style.fontSize;
  }

  editor.addEventListener('blur', () => {
    const newText = editor.textContent.trim();
    if (targetSpan && newText) {
      targetSpan.textContent = newText;
    } else if (!targetSpan && newText) {
      // Create new text block through block editor
      const displayW = parseFloat(els.canvas.style.width) || 1;
      const displayH = parseFloat(els.canvas.style.height) || 1;
      const canvasW = els.canvas.width || 1;
      const canvasH = els.canvas.height || 1;
      blockEditor.addTextBlock(state.currentPage,
        (x / displayW) * canvasW,
        (y / displayH) * canvasH,
        newText,
        { fontSize: parseInt(editor.style.fontSize) || 14 }
      );
      if (blockEditor.active) {
        blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
      }
    }
    editor.remove();
    _activeInlineEditor = null;
    // Save the edited text back to OCR/edit storage
    _syncTextLayerToStorage();
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { editor.remove(); _activeInlineEditor = null; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
  });

  els.textLayerDiv.appendChild(editor);
  _activeInlineEditor = editor;
  editor.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export function _syncTextLayerToStorage() {
  const container = els.textLayerDiv;
  if (!container || !state.adapter) return;

  // Collect all text from spans
  const spans = container.querySelectorAll('span');
  const text = Array.from(spans).map(s => s.textContent).join(' ');
  if (text.trim()) {
    setPageEdits(state.currentPage, text.trim());
    persistEdits();
  }
}

// ─── Image Insertion ───────────────────────────────────────────────────────

export function handleImageInsertion(file) {
  if (!file || !state.adapter) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      // Insert at center of visible area
      const canvasW = parseFloat(els.canvas.style.width) || 400;
      const canvasH = parseFloat(els.canvas.style.height) || 600;
      const maxW = canvasW * 0.5;
      const maxH = canvasH * 0.5;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h *= maxW / w; w = maxW; }
      if (h > maxH) { w *= maxH / h; h = maxH; }

      const x = (canvasW - w) / 2;
      const y = (canvasH - h) / 2;

      // Enable block editor if not active
      if (!blockEditor.active) {
        els.pdfBlockEdit?.classList.add('active');
        blockEditor.enable(els.canvasWrap, els.canvas);
      }

      blockEditor.addImageBlock(state.currentPage, x, y, dataUrl, w, h);
      blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
      _deps.setOcrStatus?.('Изображение вставлено. Перемещайте и масштабируйте в режиме "Блоки".');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ─── Watermark ─────────────────────────────────────────────────────────────

export function addWatermarkToPage(text, options = {}) {
  if (!state.adapter) return;
  const {
    fontSize = 60,
    color = 'rgba(200, 200, 200, 0.3)',
    angle = -45,
  } = options;

  const ctx = els.annotationCanvas.getContext('2d');
  if (!ctx) return;
  const w = els.annotationCanvas.width;
  const h = els.annotationCanvas.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.font = `${fontSize * dpr}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ─── Stamp ─────────────────────────────────────────────────────────────────

export function addStampToPage(stampType) {
  if (!state.adapter) return;
  const stamps = {
    approved: { text: 'УТВЕРЖДЕНО', color: 'rgba(0, 150, 0, 0.5)', border: '#00aa00' },
    rejected: { text: 'ОТКЛОНЕНО', color: 'rgba(200, 0, 0, 0.5)', border: '#cc0000' },
    draft: { text: 'ЧЕРНОВИК', color: 'rgba(150, 150, 0, 0.5)', border: '#aaaa00' },
    confidential: { text: 'КОНФИДЕНЦИАЛЬНО', color: 'rgba(200, 0, 0, 0.5)', border: '#cc0000' },
    copy: { text: 'КОПИЯ', color: 'rgba(0, 0, 200, 0.5)', border: '#0000cc' },
  };

  const stamp = stamps[stampType] || stamps.approved;
  const ctx = els.annotationCanvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = els.annotationCanvas.width;

  const boxW = 300 * dpr;
  const boxH = 80 * dpr;
  const x = w - boxW - 40 * dpr;
  const y = 40 * dpr;

  ctx.save();
  ctx.strokeStyle = stamp.border;
  ctx.lineWidth = 3 * dpr;
  ctx.setLineDash([6 * dpr, 3 * dpr]);
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.setLineDash([]);

  ctx.fillStyle = stamp.color;
  ctx.font = `bold ${24 * dpr}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stamp.text, x + boxW / 2, y + boxH / 2);
  ctx.restore();
}

// ─── Signature Pad ─────────────────────────────────────────────────────────

export function openSignaturePad() {
  // Create modal with canvas for drawing signature
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:8px;padding:16px;min-width:400px;';
  card.innerHTML = '<h3 style="margin:0 0 8px">Нарисуйте подпись</h3>';

  const sigCanvas = document.createElement('canvas');
  sigCanvas.width = 400;
  sigCanvas.height = 200;
  sigCanvas.style.cssText = 'border:1px solid #ccc;border-radius:4px;cursor:crosshair;display:block;background:white;';

  const sigCtx = sigCanvas.getContext('2d');
  if (!sigCtx) return;
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  sigCtx.strokeStyle = '#000';

  let drawing = false;
  sigCanvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    sigCtx.beginPath();
    sigCtx.moveTo(e.offsetX, e.offsetY);
  });
  sigCanvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    sigCtx.lineTo(e.offsetX, e.offsetY);
    sigCtx.stroke();
  });
  sigCanvas.addEventListener('pointerup', () => { drawing = false; });

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Очистить';
  clearBtn.className = 'btn-xs';
  clearBtn.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, 400, 200);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Отмена';
  cancelBtn.className = 'btn-xs';
  cancelBtn.addEventListener('click', () => modal.remove());

  const insertBtn = document.createElement('button');
  insertBtn.textContent = 'Вставить';
  insertBtn.className = 'btn-xs';
  insertBtn.style.background = '#3b82f6';
  insertBtn.style.color = 'white';
  insertBtn.addEventListener('click', async () => {
    const dataUrl = sigCanvas.toDataURL('image/png');
    // Visual preview via block editor
    if (!blockEditor.active) {
      els.pdfBlockEdit?.classList.add('active');
      blockEditor.enable(els.canvasWrap, els.canvas);
    }
    const canvasW = parseFloat(els.canvas.style.width) || 400;
    const canvasH = parseFloat(els.canvas.style.height) || 600;
    blockEditor.addImageBlock(state.currentPage, canvasW * 0.5, canvasH * 0.75, dataUrl, 200, 100);
    blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
    _deps.setOcrStatus?.('Подпись вставлена на canvas');

    // Also embed into actual PDF via pdf-lib
    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        _deps.setOcrStatus?.('Встраивание подписи в PDF...');
        const pngBlob = await (await fetch(dataUrl)).blob();
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        const arrayBuffer = await state.file.arrayBuffer();
        const pdfBlob = await addSignatureToPdf(arrayBuffer, pngBytes, {
          pageNum: state.currentPage,
          x: 350,
          y: 50,
          width: 200,
          height: 100,
        });
        const url = safeCreateObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-signed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        _deps.setOcrStatus?.('Подпись встроена в PDF и сохранена');
      } catch (err) {
        _deps.setOcrStatus?.(`Подпись на canvas (PDF ошибка: ${err?.message || 'неизвестная'})`);
      }
    }
    modal.remove();
  });

  btnRow.append(clearBtn, cancelBtn, insertBtn);
  card.append(sigCanvas, btnRow);
  modal.appendChild(card);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}
