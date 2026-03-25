// @ts-check
// ─── Minimap Navigation ─────────────────────────────────────────────────────
// A VS Code-style minimap showing tiny page thumbnails in a vertical strip
// on the right side of the document viewport.

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

const THUMB_WIDTH = 40;
const _RENDER_SCALE = 0.06;
const BUFFER_PAGES = 5;
const THUMB_GAP = 3;
const DEBOUNCE_RENDER_MS = 150;

/** @type {{ state: any, els: any, renderPage?: Function, onPageChange?: Function } | null} */
let _deps = null;

/** @type {HTMLElement | null} */
let _container = null;
/** @type {HTMLElement | null} */
let _track = null;
/** @type {HTMLElement | null} */
let _viewport = null;

/** Map of pageNumber -> { canvas, wrapper } for rendered thumbnails */
const _thumbCache = new Map();

/** Whether the minimap is currently visible */
let _visible = false;

/** Whether the user is dragging the viewport indicator */
let _dragging = false;
let _dragStartY = 0;
let _dragStartScroll = 0;

/** Debounce timer for thumbnail rendering */
let _renderTimer = null;

/** AbortController for document-level event listeners */
let _abortController = null;

/** Cached page dimensions: Map<pageNumber, { width, height }> */
const _pageDims = new Map();

/** rAF id for scroll-linked updates */
let _rafId = 0;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the minimap with dependencies.
 * @param {{ state: any, els: any, renderPage?: Function, onPageChange?: Function }} deps
 */
export function initMinimap(deps) {
  _deps = deps;
  _container = document.getElementById('minimapContainer');
  _track = document.getElementById('minimapTrack');
  _viewport = document.getElementById('minimapViewport');

  if (!_container || !_track || !_viewport) {
    return;
  }

  _attachEvents();

  // Auto-show if document is loaded with more than 1 page
  if (_deps.state.pageCount > 1 && _deps.state.minimapEnabled !== false) {
    showMinimap();
  }
}

/** Refresh the minimap thumbnails and viewport indicator position. */
export function updateMinimap() {
  if (!_visible || !_deps || !_container) return;

  const { state } = _deps;
  if (!state.adapter || state.pageCount <= 1) {
    hideMinimap();
    return;
  }

  _scheduleRenderThumbs();
  _updateViewportIndicator();
}

/** Show the minimap panel. */
export function showMinimap() {
  if (!_container || !_deps) return;
  const { state } = _deps;
  if (!state.adapter || state.pageCount <= 1) return;

  _container.style.display = '';
  _visible = true;
  _buildTrack();
  _scheduleRenderThumbs();
  _updateViewportIndicator();
}

/** Hide the minimap panel. */
export function hideMinimap() {
  if (!_container) return;
  _container.style.display = 'none';
  _visible = false;
}

/** Toggle minimap visibility. */
export function toggleMinimap() {
  if (_visible) {
    hideMinimap();
  } else {
    showMinimap();
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

function _attachEvents() {
  if (!_container || !_viewport) return;

  _abortController = new AbortController();
  const signal = _abortController.signal;

  // Click on track to jump to page
  _track.addEventListener('click', _onTrackClick, { signal });

  // Drag viewport indicator
  _viewport.addEventListener('mousedown', _onViewportMouseDown, { signal });
  document.addEventListener('mousemove', _onMouseMove, { signal });
  document.addEventListener('mouseup', _onMouseUp, { signal });

  // Touch support for viewport drag
  _viewport.addEventListener('touchstart', _onViewportTouchStart, { passive: false, signal });
  document.addEventListener('touchmove', _onTouchMove, { passive: false, signal });
  document.addEventListener('touchend', _onTouchEnd, { signal });
}

/** Remove all minimap event listeners. */
export function destroyMinimap() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  if (_renderTimer) {
    clearSafeTimeout(_renderTimer);
    _renderTimer = null;
  }
  if (_rafId) {
    cancelAnimationFrame(_rafId);
    _rafId = 0;
  }
  _thumbCache.clear();
  _pageDims.clear();
  _visible = false;
  _deps = null;
}

function _onTrackClick(e) {
  if (!_deps || _dragging) return;
  // Determine which page was clicked
  const trackRect = _track.getBoundingClientRect();
  const clickY = e.clientY - trackRect.top;
  const page = _getPageAtY(clickY);
  if (page >= 1 && page <= _deps.state.pageCount) {
    _deps.state.currentPage = page;
    if (typeof _deps.onPageChange === 'function') {
      _deps.onPageChange();
    }
  }
}

function _onViewportMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();
  _dragging = true;
  _dragStartY = e.clientY;
  _dragStartScroll = _deps?.els?.canvasWrap?.scrollTop || 0;
  _container.classList.add('minimap-dragging');
}

function _onMouseMove(e) {
  if (!_dragging || !_deps) return;
  e.preventDefault();
  const deltaY = e.clientY - _dragStartY;
  _handleDrag(deltaY);
}

function _onMouseUp() {
  if (!_dragging) return;
  _dragging = false;
  _container?.classList.remove('minimap-dragging');
}

function _onViewportTouchStart(e) {
  if (!e.touches.length) return;
  e.preventDefault();
  _dragging = true;
  _dragStartY = e.touches[0].clientY;
  _dragStartScroll = _deps?.els?.canvasWrap?.scrollTop || 0;
  _container.classList.add('minimap-dragging');
}

function _onTouchMove(e) {
  if (!_dragging || !_deps || !e.touches.length) return;
  e.preventDefault();
  const deltaY = e.touches[0].clientY - _dragStartY;
  _handleDrag(deltaY);
}

function _onTouchEnd() {
  if (!_dragging) return;
  _dragging = false;
  _container?.classList.remove('minimap-dragging');
}

function _handleDrag(deltaY) {
  if (!_deps) return;
  const { state } = _deps;
  const totalMinimapH = _getTotalTrackHeight();
  const containerH = _container.clientHeight;

  if (totalMinimapH <= 0) return;

  // Map minimap delta to document scroll delta
  const canvasWrap = _deps.els?.canvasWrap;
  if (!canvasWrap) return;

  const scrollRange = canvasWrap.scrollHeight - canvasWrap.clientHeight;
  const minimapRange = Math.max(1, totalMinimapH - containerH);
  const ratio = scrollRange / minimapRange;

  const newScroll = Math.max(0, Math.min(scrollRange, _dragStartScroll + deltaY * ratio));
  canvasWrap.scrollTop = newScroll;

  // Update page from scroll position
  const page = _getPageFromScroll(newScroll, canvasWrap);
  if (page >= 1 && page <= state.pageCount && page !== state.currentPage) {
    state.currentPage = page;
    if (typeof _deps.onPageChange === 'function') {
      _deps.onPageChange();
    }
  }

  _updateViewportIndicator();
}

function _getPageFromScroll(scrollTop, canvasWrap) {
  if (!_deps) return 1;
  const { state } = _deps;
  const totalH = canvasWrap.scrollHeight;
  if (totalH <= 0) return 1;
  const fraction = scrollTop / totalH;
  return Math.min(state.pageCount, Math.max(1, Math.ceil(fraction * state.pageCount)));
}

/**
 * Build the track with placeholder slots for all pages.
 */
function _buildTrack() {
  if (!_track || !_deps) return;
  const { state } = _deps;

  // Clear existing
  _track.innerHTML = '';
  _thumbCache.clear();
  _pageDims.clear();

  for (let p = 1; p <= state.pageCount; p++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'minimap-thumb';
    wrapper.dataset.page = String(p);
    wrapper.style.width = `${THUMB_WIDTH}px`;
    // Default aspect ratio until we know the real one
    wrapper.style.height = `${Math.round(THUMB_WIDTH * 1.4)}px`;
    wrapper.style.marginBottom = `${THUMB_GAP}px`;

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = Math.round(THUMB_WIDTH * 1.4);
    wrapper.appendChild(canvas);

    _track.appendChild(wrapper);
    _thumbCache.set(p, { canvas, wrapper, rendered: false });
  }
}

/**
 * Schedule (debounced) rendering of visible thumbnails.
 */
function _scheduleRenderThumbs() {
  if (_renderTimer) clearSafeTimeout(_renderTimer);
  _renderTimer = safeTimeout(() => {
    _renderVisibleThumbs();
  }, DEBOUNCE_RENDER_MS);
}

/**
 * Render only the visible thumbnails plus a buffer.
 */
async function _renderVisibleThumbs() {
  if (!_deps || !_container || !_track) return;
  const { state } = _deps;
  if (!state.adapter) return;

  const containerRect = _container.getBoundingClientRect();
  const trackRect = _track.getBoundingClientRect();
  const visibleTop = containerRect.top - trackRect.top;
  const visibleBottom = visibleTop + /** @type {any} */ (containerRect).clientHeight;

  // Determine visible page range
  let firstVisible = -1;
  let lastVisible = -1;

  for (let p = 1; p <= state.pageCount; p++) {
    const entry = _thumbCache.get(p);
    if (!entry) continue;
    const top = entry.wrapper.offsetTop;
    const bottom = top + entry.wrapper.offsetHeight;

    if (bottom >= visibleTop && top <= visibleBottom) {
      if (firstVisible === -1) firstVisible = p;
      lastVisible = p;
    }
  }

  if (firstVisible === -1) {
    firstVisible = 1;
    lastVisible = Math.min(state.pageCount, 10);
  }

  const rangeStart = Math.max(1, firstVisible - BUFFER_PAGES);
  const rangeEnd = Math.min(state.pageCount, lastVisible + BUFFER_PAGES);

  for (let p = rangeStart; p <= rangeEnd; p++) {
    const entry = _thumbCache.get(p);
    if (!entry || entry.rendered) continue;
    await _renderThumb(p, entry);
  }
}

/**
 * Render a single page thumbnail.
 */
async function _renderThumb(pageNum, entry) {
  if (!_deps) return;
  const { state } = _deps;
  if (!state.adapter) return;

  try {
    // Get page viewport to calculate proper aspect ratio
    const vp = await state.adapter.getPageViewport(pageNum, 1, 0);
    const aspect = vp.height / vp.width;
    const thumbH = Math.round(THUMB_WIDTH * aspect);

    _pageDims.set(pageNum, { width: THUMB_WIDTH, height: thumbH });

    // Update wrapper and canvas dimensions
    entry.wrapper.style.height = `${thumbH}px`;
    entry.canvas.width = THUMB_WIDTH * 2; // 2x for sharpness
    entry.canvas.height = thumbH * 2;
    entry.canvas.style.width = `${THUMB_WIDTH}px`;
    entry.canvas.style.height = `${thumbH}px`;

    // Render at low resolution
    const scale = THUMB_WIDTH / vp.width;
    await state.adapter.renderPage(pageNum, entry.canvas, {
      zoom: scale,
      rotation: state.rotation || 0,
    });

    entry.rendered = true;
  } catch (_err) {
    // Silently skip rendering failures for individual thumbnails
    entry.rendered = true;
  }
}

/**
 * Update the viewport indicator rectangle.
 */
function _updateViewportIndicator() {
  if (!_viewport || !_deps || !_track) return;

  if (_rafId) cancelAnimationFrame(_rafId);
  _rafId = requestAnimationFrame(() => {
    _doUpdateViewport();
  });
}

function _doUpdateViewport() {
  if (!_viewport || !_deps || !_track) return;
  const { els } = _deps;
  if (!els.canvasWrap) return;
  const canvasWrap = els.canvasWrap;
  if (!canvasWrap) return;

  const totalTrackH = _track.scrollHeight;
  const totalDocH = canvasWrap.scrollHeight;

  if (totalDocH <= 0 || totalTrackH <= 0) {
    _viewport.style.display = 'none';
    return;
  }

  _viewport.style.display = '';

  // Map scroll position to minimap position
  const scrollFraction = canvasWrap.scrollTop / totalDocH;
  const viewFraction = canvasWrap.clientHeight / totalDocH;

  const vpTop = Math.round(scrollFraction * totalTrackH);
  const vpHeight = Math.max(8, Math.round(viewFraction * totalTrackH));

  _viewport.style.top = `${vpTop}px`;
  _viewport.style.height = `${vpHeight}px`;

  // Highlight current page thumb
  _highlightCurrentPage();
}

function _highlightCurrentPage() {
  if (!_deps || !_thumbCache) return;
  const { state } = _deps;

  for (const [page, entry] of _thumbCache) {
    entry.wrapper.classList.toggle('minimap-thumb-active', page === state.currentPage);
  }
}

function _getTotalTrackHeight() {
  if (!_track) return 0;
  return _track.scrollHeight;
}

function _getPageAtY(y) {
  if (!_deps || !_track) return 1;
  const { state } = _deps;

  for (let p = 1; p <= state.pageCount; p++) {
    const entry = _thumbCache.get(p);
    if (!entry) continue;
    const top = entry.wrapper.offsetTop;
    const bottom = top + entry.wrapper.offsetHeight;
    if (y >= top && y <= bottom) return p;
  }

  // If click is beyond last thumb, return last page
  return state.pageCount;
}
