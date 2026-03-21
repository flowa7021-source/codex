// ─── Render Pipeline ────────────────────────────────────────────────────────
// Unified page rendering with caching, pre-rendering, and overlay management.

/**
 * @typedef {object} RenderContext
 * @property {HTMLCanvasElement} canvas
 * @property {HTMLCanvasElement} annotationCanvas
 * @property {HTMLElement} textLayerDiv
 * @property {HTMLElement} canvasWrap
 */

/**
 * @typedef {object} RenderOptions
 * @property {number} page - 1-indexed page number
 * @property {number} zoom
 * @property {number} rotation - 0, 90, 180, 270
 * @property {object} adapter - Document adapter
 * @property {boolean} [useCache=true]
 * @property {boolean} [renderTextLayer=true]
 * @property {boolean} [renderAnnotations=true]
 */

const PRE_RENDER_DELAY = 300;
const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

/** @type {Map<string, ImageBitmap|ImageData>} */
const pageCache = new Map();
const MAX_CACHE_SIZE = 20;
let preRenderTimer = null;

/**
 * Render a page with full pipeline: cache check → render → text layer → annotations.
 *
 * @param {RenderOptions} options
 * @param {RenderContext} ctx
 * @param {object} [callbacks]
 * @param {Function} [callbacks.onTextLayer] - (page, textLayerDiv) => void
 * @param {Function} [callbacks.onAnnotations] - (page, annotationCanvas) => void
 * @param {Function} [callbacks.onComplete] - (page, timing) => void
 * @returns {Promise<{width: number, height: number, fromCache: boolean, renderMs: number}>}
 */
export async function renderPage(options, ctx, callbacks = {}) {
  const { page, zoom, rotation, adapter, useCache = true, renderTextLayer = true, renderAnnotations = true } = options;
  const start = performance.now();
  let fromCache = false;

  if (!adapter || page < 1) {
    throw new Error('Invalid render options');
  }

  const cacheKey = `${page}_${zoom}_${rotation}`;

  // Check cache
  if (useCache && pageCache.has(cacheKey)) {
    const cached = pageCache.get(cacheKey);
    blitToCanvas(ctx.canvas, cached);
    fromCache = true;
  } else {
    // Render fresh
    await adapter.renderPage(page, ctx.canvas, zoom, rotation);

    // Cache the result
    if (useCache) {
      cachePageResult(cacheKey, ctx.canvas);
    }
  }

  const dims = { width: ctx.canvas.width, height: ctx.canvas.height };

  // Update annotation canvas sizing
  if (ctx.annotationCanvas) {
    updateAnnotationCanvasSize(ctx.annotationCanvas, ctx.canvas);
  }

  // Render text layer
  if (renderTextLayer && ctx.textLayerDiv && callbacks.onTextLayer) {
    callbacks.onTextLayer(page, ctx.textLayerDiv);
  }

  // Render annotations
  if (renderAnnotations && ctx.annotationCanvas && callbacks.onAnnotations) {
    callbacks.onAnnotations(page, ctx.annotationCanvas);
  }

  const renderMs = Math.round(performance.now() - start);

  if (callbacks.onComplete) {
    callbacks.onComplete(page, { renderMs, fromCache, ...dims });
  }

  return { ...dims, fromCache, renderMs };
}

/**
 * Pre-render adjacent pages for smooth navigation.
 * @param {number} currentPage
 * @param {number} pageCount
 * @param {number} zoom
 * @param {number} rotation
 * @param {object} adapter
 */
export function schedulePreRender(currentPage, pageCount, zoom, rotation, adapter) {
  clearTimeout(preRenderTimer);
  preRenderTimer = setTimeout(async () => {
    const adjacentPages = [currentPage - 1, currentPage + 1]
      .filter(p => p >= 1 && p <= pageCount);

    for (const page of adjacentPages) {
      const cacheKey = `${page}_${zoom}_${rotation}`;
      if (pageCache.has(cacheKey)) continue;

      try {
        const offscreen = document.createElement('canvas');
        await adapter.renderPage(page, offscreen, zoom, rotation);
        cachePageResult(cacheKey, offscreen);
      } catch (err) { console.warn('[render-pipeline] error:', err?.message); }
    }
  }, PRE_RENDER_DELAY);
}

/**
 * Invalidate cache for specific pages or all.
 * @param {number[]} [pages] - If omitted, clears all
 */
export function invalidateCache(pages) {
  if (!pages) {
    pageCache.clear();
    return;
  }
  for (const [key] of pageCache) {
    const pageNum = parseInt(key.split('_')[0]);
    if (pages.includes(pageNum)) {
      pageCache.delete(key);
    }
  }
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  return {
    entries: pageCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function cachePageResult(key, canvas) {
  // Evict oldest if at capacity
  if (pageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = pageCache.keys().next().value;
    pageCache.delete(firstKey);
  }

  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pageCache.set(key, { imageData, width: canvas.width, height: canvas.height });
  } catch (err) { console.warn('[render-pipeline] error:', err?.message); }
}

function blitToCanvas(canvas, cached) {
  canvas.width = cached.width;
  canvas.height = cached.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(cached.imageData, 0, 0);
}

function updateAnnotationCanvasSize(annotationCanvas, mainCanvas) {
  const rect = mainCanvas.getBoundingClientRect();
  annotationCanvas.width = Math.round(rect.width * DPR);
  annotationCanvas.height = Math.round(rect.height * DPR);
  annotationCanvas.style.width = `${rect.width}px`;
  annotationCanvas.style.height = `${rect.height}px`;

  const ctx = annotationCanvas.getContext('2d');
  ctx.scale(DPR, DPR);
}
