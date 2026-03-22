// @ts-check
// ─── View Modes ─────────────────────────────────────────────────────────────
// Single page, two-up (spread), book mode, continuous scroll, presentation.

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

  // Dispatch event for external listeners
  document.dispatchEvent(new CustomEvent('viewmodechange', { detail: { mode, prev } }));
}

function cleanupMode(mode) {
  if (!deps) return;
  const vp = deps.viewport;
  if (!vp) return;

  vp.classList.remove('vmode-two-up', 'vmode-book', 'vmode-continuous', 'vmode-presentation');

  // Clean up continuous scroll canvases
  const scrollWrap = vp.querySelector('.continuous-scroll-wrap');
  if (scrollWrap) scrollWrap.innerHTML = '';

  // Exit fullscreen for presentation
  if (mode === VIEW_MODES.PRESENTATION && document.fullscreenElement) {
    document.exitFullscreen().catch((err) => { console.warn('[view-modes] error:', err?.message); });
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

let continuousObserver = null;

function setupContinuousScroll() {
  if (!deps) return;
  deps.viewport.classList.add('vmode-continuous');

  const wrap = deps.viewport.querySelector('.continuous-scroll-wrap') || document.createElement('div');
  wrap.className = 'continuous-scroll-wrap';
  if (!deps.viewport.contains(wrap)) deps.viewport.appendChild(wrap);

  const pageCount = deps.getPageCount();
  const zoom = deps.getZoom();

  // Create placeholder slots for all pages
  for (let i = 1; i <= pageCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'continuous-page-slot';
    slot.dataset.page = String(i);
    slot.style.minHeight = `${Math.round(792 * zoom)}px`; // A4 estimate
    slot.style.marginBottom = '8px';
    wrap.appendChild(slot);
  }

  // IntersectionObserver for lazy rendering
  continuousObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const page = parseInt(/** @type {HTMLElement} */ (entry.target).dataset.page, 10);
        renderContinuousPage(entry.target, page);
      }
    }
  }, {
    root: deps.viewport,
    rootMargin: '200px 0px',
  });

  wrap.querySelectorAll('.continuous-page-slot').forEach(slot => {
    continuousObserver.observe(slot);
  });
}

async function renderContinuousPage(slot, pageNum) {
  if (slot.dataset.rendered === 'true') return;
  slot.dataset.rendered = 'true';

  const canvas = document.createElement('canvas');
  canvas.className = 'continuous-page-canvas';
  slot.appendChild(canvas);

  if (deps.renderPage) {
    await deps.renderPage(pageNum, canvas);
    slot.style.minHeight = ''; // Remove placeholder height
  }
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
