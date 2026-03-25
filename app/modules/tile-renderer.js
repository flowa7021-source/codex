// @ts-check
// ─── Tile-Based Renderer ────────────────────────────────────────────────────
// Splits very large pages into tiles and only renders tiles visible in the
// current viewport.  This avoids allocating a single enormous canvas that
// exceeds GPU texture limits and reduces memory pressure on high-zoom /
// high-DPI configurations.
//
// Integration point: render-controller.js checks `shouldUseTileRendering()`
// before calling adapter.renderPage() and delegates to `renderTiles()` when
// tile rendering is appropriate.

import { pushDiagnosticEvent } from './diagnostics.js';

// Render generation is injected to avoid circular dependency with render-controller
let _getRenderGeneration = () => 0;
export function setRenderGenerationGetter(fn) { _getRenderGeneration = fn; }

// ─── Configuration ──────────────────────────────────────────────────────────

/** Threshold (in CSS pixels * devicePixelRatio) above which tile rendering kicks in. */
const LARGE_PAGE_THRESHOLD_PX = 4000;

/** Default tile size in pixels (each tile is a square of this dimension). */
const DEFAULT_TILE_SIZE = 2048;

// ─── Tile cache ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} TileCacheEntry
 * @property {HTMLCanvasElement|OffscreenCanvas} canvas - The rendered tile
 * @property {number} col  - Column index
 * @property {number} row  - Row index
 * @property {number} zoom - Zoom level at which the tile was rendered
 * @property {number} rotation - Rotation at render time
 * @property {number} page - Page number
 */

/** @type {Map<string, TileCacheEntry>} */
const _tileCache = new Map();

/** Maximum number of cached tiles to prevent unbounded memory growth. */
const MAX_TILE_CACHE_ENTRIES = 32;

/** Maximum total pixels across all cached tiles (~128 MB at 4 bytes/pixel). */
const MAX_TILE_CACHE_PIXELS = 32_000_000;

/**
 * Build a unique cache key for a tile.
 * @param {number} page
 * @param {number} col
 * @param {number} row
 * @param {number} zoom
 * @param {number} rotation
 * @returns {string}
 */
function tileCacheKey(page, col, row, zoom, rotation) {
  return `${page}|${col}|${row}|${zoom}|${rotation}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Determine whether tile-based rendering should be used for the given
 * viewport dimensions.
 *
 * Tile rendering is activated when either the width or height of the
 * fully-rendered page (at current zoom * devicePixelRatio) exceeds
 * {@link LARGE_PAGE_THRESHOLD_PX}.
 *
 * @param {{ width: number, height: number }} viewport - The page viewport
 *   at the target render scale (already multiplied by zoom * dpr).
 * @returns {boolean}
 */
export function shouldUseTileRendering(viewport) {
  if (!viewport) return false;
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height);
  return w > LARGE_PAGE_THRESHOLD_PX || h > LARGE_PAGE_THRESHOLD_PX;
}

/**
 * Render only the visible tiles of a large page onto the destination canvas.
 *
 * The full page area is divided into a grid of tiles (each up to
 * {@link DEFAULT_TILE_SIZE} pixels).  Only tiles that intersect the visible
 * portion of the scroll container are rendered (or served from cache).
 *
 * @param {object} adapter - Document adapter (PDFAdapter, DjVuNativeAdapter, etc.)
 * @param {number} page    - 1-based page number
 * @param {HTMLCanvasElement} canvas - The main display canvas
 * @param {{ zoom: number, rotation: number }} opts - Render options
 * @param {HTMLElement} scrollContainer - The scrollable wrapper around the canvas
 * @returns {Promise<void>}
 */
export async function renderTiles(adapter, page, canvas, { zoom, rotation }, scrollContainer) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const renderScale = zoom * dpr;

  // Obtain the full-page viewport to know the total pixel dimensions.
  const viewport = await adapter.getPageViewport(page, renderScale, rotation);
  const fullW = Math.ceil(viewport.width);
  const fullH = Math.ceil(viewport.height);

  // Size the destination canvas to the full page dimensions so scroll
  // geometry remains correct.
  canvas.width = fullW;
  canvas.height = fullH;
  canvas.style.width = `${Math.round(fullW / dpr)}px`;
  canvas.style.height = `${Math.round(fullH / dpr)}px`;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, fullW, fullH);

  // Determine visible rect relative to the canvas.
  const visibleRect = _getVisibleRect(canvas, scrollContainer);

  // Tile grid
  const tileSize = DEFAULT_TILE_SIZE;
  const cols = Math.ceil(fullW / tileSize);
  const rows = Math.ceil(fullH / tileSize);

  let tilesRendered = 0;
  let tilesCached = 0;

  // Collect tiles that need rendering (not in cache)
  const tilesToRender = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = col * tileSize;
      const ty = row * tileSize;
      const tw = Math.min(tileSize, fullW - tx);
      const th = Math.min(tileSize, fullH - ty);

      // Skip tiles entirely outside the visible area
      if (!_rectsOverlap(tx, ty, tw, th, visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h)) {
        continue;
      }

      const key = tileCacheKey(page, col, row, zoom, rotation);
      const cached = _tileCache.get(key);

      if (cached && cached.canvas.width > 0) {
        // Blit cached tile
        ctx.drawImage(cached.canvas, tx, ty);
        tilesCached++;
        continue;
      }

      tilesToRender.push({ col, row, tx, ty, tw, th, key });
    }
  }

  // Render the full page ONCE and extract all uncached tiles from it
  if (tilesToRender.length > 0) {
    const genBefore = _getRenderGeneration();
    const tmpCanvas = document.createElement('canvas');
    try {
      await adapter.renderPage(page, tmpCanvas, { zoom, rotation });
      // If a newer render started while we were waiting, discard
      if (_getRenderGeneration() !== genBefore) return;

      for (const tile of tilesToRender) {
        const tileCanvas = (typeof OffscreenCanvas !== 'undefined')
          ? new OffscreenCanvas(tile.tw, tile.th)
          : document.createElement('canvas');
        if (!(tileCanvas instanceof OffscreenCanvas)) {
          tileCanvas.width = tile.tw;
          tileCanvas.height = tile.th;
        }
        const tileCtx = tileCanvas.getContext('2d');
        if (!tileCtx) continue;
        tileCtx.drawImage(tmpCanvas, tile.tx, tile.ty, tile.tw, tile.th, 0, 0, tile.tw, tile.th);
        ctx.drawImage(tileCanvas, tile.tx, tile.ty);
        _evictTileCacheIfNeeded();
        _tileCache.set(tile.key, { canvas: tileCanvas, col: tile.col, row: tile.row, zoom, rotation, page });
        tilesRendered++;
      }
    } catch (err) {
      console.warn('[tile-renderer] tile render error:', err?.message);
    } finally {
      tmpCanvas.width = 0;
      tmpCanvas.height = 0;
    }
  }

  pushDiagnosticEvent('tile-renderer.render', {
    page,
    fullW,
    fullH,
    cols,
    rows,
    tilesRendered,
    tilesCached,
    cacheSize: _tileCache.size,
  });
}

/**
 * Evict oldest entries when tile cache exceeds size or pixel limits.
 */
function _evictTileCacheIfNeeded() {
  // Check entry count
  while (_tileCache.size >= MAX_TILE_CACHE_ENTRIES) {
    const oldest = _tileCache.keys().next().value;
    const entry = _tileCache.get(oldest);
    if (entry?.canvas) { entry.canvas.width = 0; entry.canvas.height = 0; }
    _tileCache.delete(oldest);
  }
  // Check total pixels
  let totalPx = 0;
  for (const entry of _tileCache.values()) {
    totalPx += (entry.canvas?.width || 0) * (entry.canvas?.height || 0);
  }
  while (totalPx > MAX_TILE_CACHE_PIXELS && _tileCache.size > 0) {
    const oldest = _tileCache.keys().next().value;
    const entry = _tileCache.get(oldest);
    if (entry?.canvas) {
      totalPx -= entry.canvas.width * entry.canvas.height;
      entry.canvas.width = 0; entry.canvas.height = 0;
    }
    _tileCache.delete(oldest);
  }
}

/**
 * Clear the entire tile cache.  Should be called on page change, zoom
 * change, or document switch so stale tiles are not reused.
 */
export function invalidateTiles() {
  for (const entry of _tileCache.values()) {
    if (entry?.canvas) {
      // Free GPU memory
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    }
  }
  _tileCache.clear();
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Compute the visible rectangle of the canvas within its scroll container,
 * expressed in the canvas's own pixel coordinate system (accounting for dpr).
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} scrollContainer
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function _getVisibleRect(canvas, scrollContainer) {
  if (!scrollContainer) {
    // No scroll container — assume the entire canvas is visible
    return { x: 0, y: 0, w: canvas.width, h: canvas.height };
  }

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();

  // Intersection in screen pixels
  const left = Math.max(canvasRect.left, containerRect.left);
  const top = Math.max(canvasRect.top, containerRect.top);
  const right = Math.min(canvasRect.right, containerRect.right);
  const bottom = Math.min(canvasRect.bottom, containerRect.bottom);

  if (right <= left || bottom <= top) {
    // Canvas not visible at all — return empty rect
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  // Convert screen-space intersection to canvas pixel coordinates
  const offsetX = (left - canvasRect.left) * dpr;
  const offsetY = (top - canvasRect.top) * dpr;
  const visW = (right - left) * dpr;
  const visH = (bottom - top) * dpr;

  // Add generous padding (one tile size) so tiles at the edge are pre-rendered
  const pad = DEFAULT_TILE_SIZE;
  return {
    x: Math.max(0, Math.floor(offsetX - pad)),
    y: Math.max(0, Math.floor(offsetY - pad)),
    w: Math.min(canvas.width, Math.ceil(visW + pad * 2)),
    h: Math.min(canvas.height, Math.ceil(visH + pad * 2)),
  };
}

/**
 * Check whether two axis-aligned rectangles overlap.
 * @param {number} ax @param {number} ay @param {number} aw @param {number} ah
 * @param {number} bx @param {number} by @param {number} bw @param {number} bh
 * @returns {boolean}
 */
function _rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

