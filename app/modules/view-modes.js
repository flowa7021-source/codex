// @ts-check
// ─── View Modes ─────────────────────────────────────────────────────────────
// Single page, two-up (spread), book mode, continuous scroll, presentation.

import { VirtualScroll } from './virtual-scroll.js';

export const VIEW_MODES = {
  SINGLE: 'single',
  TWO_UP: 'two-up',
  BOOK: 'book',
  CONTINUOUS: 'continuous',
  PRESENTATION: 'presentation',
};

let currentMode = VIEW_MODES.SINGLE;
let deps = null;

/**
 * Initialize view modes with dependencies from app.js.
 * @param {object} d
 * @param {Function} d.renderPage - (pageNum, canvas, opts) => Promise
 * @param {Function} d.getPageCount - () => number
 * @param {Function} d.getCurrentPage - () => number
 * @param {Function} d.setCurrentPage - (n) => void
 * @param {Function} [d.onScrollPage] - lightweight scroll tracker (no re-render); called with current page on scroll
 * @param {Function} d.getZoom - () => number
 * @param {HTMLElement} d.viewport - .document-viewport element
 * @param {HTMLCanvasElement} d.canvas - #viewerCanvas
 */
export function initViewModes(d) {
  deps = d;
}

export function getCurrentMode() { return currentMode; }

/**
 * Switch to a new view mode.
 */
export function setViewMode(mode) {
  if (!Object.values(VIEW_MODES).includes(mode)) return;
  const prev = currentMode;
  currentMode = mode;

  // Clean up previous mode
  cleanupMode(prev);

  // Apply new mode
  if (deps?.viewport) {
    deps.viewport.setAttribute('data-view-mode', mode);
  }

  switch (mode) {
    case VIEW_MODES.TWO_UP:
    case VIEW_MODES.BOOK:
      setupTwoUp(mode === VIEW_MODES.BOOK);
      break;
    case VIEW_MODES.CONTINUOUS:
      setupContinuousScroll();
      break;
    case VIEW_MODES.PRESENTATION:
      setupPresentation();
      break;
    case VIEW_MODES.SINGLE:
    default:
      // Default single page mode — no special setup needed
      break;
  }

  // Dispatched for external listeners (Tauri host, extensions); not consumed internally
  document.dispatchEvent(new CustomEvent('viewmodechange', { detail: { mode, prev } }));
}

function cleanupMode(mode) {
  if (!deps) return;
  const vp = deps.viewport;
  if (!vp) return;

  vp.classList.remove('vmode-two-up', 'vmode-book', 'vmode-continuous', 'vmode-presentation');

  // Destroy VirtualScroll instance BEFORE clearing DOM to prevent stale callbacks
  if (_virtualScroll) {
    _virtualScroll.destroy();
    _virtualScroll = null;
  }
  if (_scrollTrackWrap && _scrollTrackFn) {
    _scrollTrackWrap.removeEventListener('scroll', _scrollTrackFn);
    _scrollTrackWrap = null;
    _scrollTrackFn = null;
  }
  _scrollTrackTimer = null;

  // Remove the continuous scroll wrap (VirtualScroll already cleared its content)
  const scrollWrap = vp.querySelector('.continuous-scroll-wrap');
  if (scrollWrap) scrollWrap.remove();

  // Clean up presentation mode listeners
  if (mode === VIEW_MODES.PRESENTATION) {
    if (presentationKeyHandler) {
      document.removeEventListener('keydown', presentationKeyHandler);
      presentationKeyHandler = null;
    }
    document.removeEventListener('fullscreenchange', onFullscreenChange);

    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => { console.warn('[view-modes] error:', err?.message); });
    }
  }
}

// ─── Two-Up / Book Mode ─────────────────────────────────────────────────────

function setupTwoUp(isBook) {
  if (!deps) return;
  deps.viewport.classList.add(isBook ? 'vmode-book' : 'vmode-two-up');
}

/**
 * Get the page pair for two-up rendering.
 * In book mode, page 1 is displayed alone (cover).
 */
export function getTwoUpPages(currentPage, pageCount, isBook) {
  if (isBook) {
    if (currentPage === 1) return [1, null]; // Cover alone
    // After cover, pair evens with odds
    const left = currentPage % 2 === 0 ? currentPage : currentPage - 1;
    const right = left + 1 <= pageCount ? left + 1 : null;
    return [left, right];
  }
  // Standard two-up: odd on left, even on right
  const left = currentPage % 2 === 1 ? currentPage : currentPage - 1;
  const right = left + 1 <= pageCount ? left + 1 : null;
  return [left, right];
}

/**
 * Render two pages side by side into the viewport.
 * Returns a container with two canvas elements.
 */
export async function renderTwoUp(currentPage, pageCount, isBook) {
  if (!deps) return;
  const [leftPage, rightPage] = getTwoUpPages(currentPage, pageCount, isBook);

  const container = deps.viewport.querySelector('.two-up-container') || document.createElement('div');
  container.className = 'two-up-container';

  // Left page
  const leftCanvas = container.querySelector('.two-up-left') || document.createElement('canvas');
  leftCanvas.className = 'two-up-left';
  if (deps.renderPage) await deps.renderPage(leftPage, leftCanvas);

  // Right page
  if (rightPage) {
    const rightCanvas = container.querySelector('.two-up-right') || document.createElement('canvas');
    rightCanvas.className = 'two-up-right';
    await deps.renderPage(rightPage, rightCanvas);
    if (!container.contains(rightCanvas)) container.appendChild(rightCanvas);
  } else {
    const existing = container.querySelector('.two-up-right');
    if (existing) existing.remove();
  }

  if (!container.contains(leftCanvas)) container.insertBefore(leftCanvas, container.firstChild);
  if (!deps.viewport.contains(container)) deps.viewport.appendChild(container);
}

// ─── Continuous Scroll ──────────────────────────────────────────────────────

/** @type {VirtualScroll|null} */
let _virtualScroll = null;
/** @type {HTMLElement|null} */
let _scrollTrackWrap = null;
/** @type {EventListener|null} */
let _scrollTrackFn = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let _scrollTrackTimer = null;

function setupContinuousScroll() {
  if (!deps) return;
  deps.viewport.classList.add('vmode-continuous');

  const wrap = document.createElement('div');
  wrap.className = 'continuous-scroll-wrap';
  deps.viewport.appendChild(wrap);

  const pageCount = deps.getPageCount();

  _virtualScroll = new VirtualScroll({
    container: wrap,
    pageCount,
    getPageHeight: () => Math.round(792 * deps.getZoom()),
    renderPage: async (pageNum, element) => {
      if (!deps?.renderPage) return;
      const canvas = document.createElement('canvas');
      canvas.className = 'continuous-page-canvas';
      element.appendChild(canvas);
      await deps.renderPage(pageNum, canvas);
      // Sync element height to actual rendered canvas height to improve offset accuracy
      if (canvas.height > 0) {
        element.style.height = `${canvas.height}px`;
      }
    },
    destroyPage: (_pageNum, element) => {
      element.innerHTML = '';
    },
    overscan: 1,
    gap: 8,
  });

  // Scroll tracking: update the page indicator without triggering a full re-render
  _scrollTrackWrap = wrap;
  _scrollTrackFn = () => {
    if (_scrollTrackTimer !== null) return;
    _scrollTrackTimer = setTimeout(() => {
      _scrollTrackTimer = null;
      if (!_virtualScroll || !deps) return;
      const page = _virtualScroll.getCurrentPage();
      if (deps.onScrollPage) {
        deps.onScrollPage(page);
      }
    }, 120);
  };
  wrap.addEventListener('scroll', _scrollTrackFn, { passive: true });
}

/**
 * Scroll the continuous scroll view to a specific page.
 * No-op when not in continuous scroll mode.
 * @param {number} pageNum
 * @param {boolean} [smooth]
 */
export function continuousScrollToPage(pageNum, smooth = true) {
  _virtualScroll?.scrollToPage(pageNum, smooth);
}

// ─── Presentation Mode ──────────────────────────────────────────────────────

let presentationKeyHandler = null;

function setupPresentation() {
  if (!deps) return;
  deps.viewport.classList.add('vmode-presentation');

  // Enter fullscreen
  deps.viewport.requestFullscreen?.().catch((err) => { console.warn('[view-modes] error:', err?.message); });

  // Keyboard navigation
  presentationKeyHandler = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      const next = Math.min(deps.getCurrentPage() + 1, deps.getPageCount());
      deps.setCurrentPage(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(deps.getCurrentPage() - 1, 1);
      deps.setCurrentPage(prev);
    } else if (e.key === 'Escape') {
      setViewMode(VIEW_MODES.SINGLE);
    }
  };
  document.addEventListener('keydown', presentationKeyHandler);

  // Exit on fullscreen change
  document.addEventListener('fullscreenchange', onFullscreenChange);
}

function onFullscreenChange() {
  if (!document.fullscreenElement && currentMode === VIEW_MODES.PRESENTATION) {
    setViewMode(VIEW_MODES.SINGLE);
  }
}

// ─── Navigation Helpers ─────────────────────────────────────────────────────

/**
 * Navigate to previous/next in current mode.
 * In two-up mode, skip by 2 pages.
 */
export function navigateInMode(direction, currentPage, pageCount) {
  const step = (currentMode === VIEW_MODES.TWO_UP || currentMode === VIEW_MODES.BOOK) ? 2 : 1;
  if (direction === 'next') return Math.min(currentPage + step, pageCount);
  if (direction === 'prev') return Math.max(currentPage - step, 1);
  return currentPage;
}
