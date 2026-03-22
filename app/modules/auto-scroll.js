// @ts-check
// ─── Auto-Scroll Reading Mode (Teleprompter) ────────────────────────────────
// Smooth continuous scrolling at configurable speed for hands-free reading.

const STORAGE_KEY = 'novareader-autoscroll-speed';
const MIN_SPEED = 1;
const MAX_SPEED = 10;

/** @type {{ state: object, els: object, goToPage: Function } | null} */
let deps = null;

let scrollSpeed = 5;
let isScrolling = false;
let animFrameId = null;
let lastTimestamp = 0;

/** @type {HTMLElement | null} */
let widgetEl = null;
/** @type {HTMLElement | null} */
let speedFillEl = null;
/** @type {HTMLElement | null} */
let speedLabelEl = null;
/** @type {HTMLElement | null} */
let toggleBtnEl = null;

// ─── Dragging state ──────────────────────────────────────────────────────────
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// ─── Manual scroll detection ─────────────────────────────────────────────────
let _ignoreNextScroll = false;

/**
 * Pixel-per-second rate for a given speed (1-10).
 * speed 1 = 10 px/s, speed 10 = 200 px/s, linear interpolation.
 */
function pxPerSecond(speed) {
  return 10 + (speed - 1) * (190 / 9);
}

function loadSpeed() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const n = Number(stored);
      if (n >= MIN_SPEED && n <= MAX_SPEED) {
        scrollSpeed = n;
      }
    }
  } catch (_e) { /* localStorage unavailable */ }
}

function saveSpeed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(scrollSpeed));
  } catch (_e) { /* quota or unavailable */ }
}

// ─── Widget UI updates ──────────────────────────────────────────────────────

function updateWidgetUI() {
  if (!widgetEl) return;
  const pct = ((scrollSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
  if (speedFillEl) speedFillEl.style.width = `${pct}%`;
  if (speedLabelEl) speedLabelEl.textContent = `${scrollSpeed}x`;
  if (toggleBtnEl) toggleBtnEl.textContent = isScrolling ? '\u23F8' : '\u25B6';
}

function showWidget() {
  if (widgetEl) {
    widgetEl.style.display = 'flex';
    updateWidgetUI();
  }
}

function hideWidget() {
  if (widgetEl) widgetEl.style.display = 'none';
}

// ─── Scroll tick (requestAnimationFrame loop) ────────────────────────────────

function scrollTick(timestamp) {
  if (!isScrolling) return;

  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    animFrameId = requestAnimationFrame(scrollTick);
    return;
  }

  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  // Guard against huge deltas (e.g. tab was backgrounded)
  const clampedDelta = Math.min(delta, 200);
  const pixelsPerFrame = (pxPerSecond(scrollSpeed) / 1000) * clampedDelta;

  const container = getScrollContainer();
  if (!container) {
    stopAutoScroll();
    return;
  }

  _ignoreNextScroll = true;
  container.scrollTop += pixelsPerFrame;

  // Check if reached bottom of scroll area
  const atBottom = container.scrollTop >= container.scrollHeight - container.clientHeight - 1;

  if (atBottom && deps) {
    const { state: appState, goToPage } = deps;
    if (appState.currentPage < appState.pageCount) {
      // Advance to next page in single-page mode
      const nextPage = appState.currentPage + 1;
      appState.currentPage = nextPage;
      if (typeof goToPage === 'function') {
        goToPage(nextPage);
      }
      container.scrollTop = 0;
    } else {
      // End of document
      stopAutoScroll();
      return;
    }
  }

  animFrameId = requestAnimationFrame(scrollTick);
}

function getScrollContainer() {
  if (!deps) return null;
  // Prefer continuous scroll container if visible, otherwise single-page canvasWrap
  const contWrap = document.getElementById('continuousScrollWrap');
  if (contWrap && contWrap.style.display !== 'none') {
    return contWrap;
  }
  return deps.els.canvasWrap || null;
}

// ─── Manual scroll / click cancellation ──────────────────────────────────────

function onManualWheel(e) {
  // If user scrolls manually while auto-scrolling, stop
  if (!isScrolling) return;
  // Only cancel if not ctrl-zoom
  if (e.ctrlKey) return;
  stopAutoScroll();
}

function onDocumentClick(e) {
  if (!isScrolling) return;
  // Don't cancel if clicking inside the widget
  if (widgetEl && widgetEl.contains(e.target)) return;
  stopAutoScroll();
}

function onKeyDown(e) {
  // Spacebar toggles pause/resume (only when not in input/textarea)
  if (e.key === ' ' && isScrolling && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    toggleAutoScroll();
    return;
  }
  // Alt+S starts/stops auto-scroll
  if (e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (isScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll(scrollSpeed);
    }
  }
}

// ─── Draggable widget ────────────────────────────────────────────────────────

function onDragStart(e) {
  // Only drag from the widget background, not from buttons
  if (e.target.closest('.auto-scroll-btn')) return;
  isDragging = true;
  const rect = widgetEl.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  e.preventDefault();
}

function onDragMove(e) {
  if (!isDragging || !widgetEl) return;
  const x = e.clientX - dragOffsetX;
  const y = e.clientY - dragOffsetY;
  widgetEl.style.right = 'auto';
  widgetEl.style.bottom = 'auto';
  widgetEl.style.left = `${Math.max(0, Math.min(x, window.innerWidth - widgetEl.offsetWidth))}px`;
  widgetEl.style.top = `${Math.max(0, Math.min(y, window.innerHeight - widgetEl.offsetHeight))}px`;
}

function onDragEnd() {
  isDragging = false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize auto-scroll with application dependencies.
 * @param {{ state: object, els: object, goToPage: Function }} dependencies
 */
export function initAutoScroll(dependencies) {
  deps = dependencies;
  loadSpeed();

  // Resolve widget DOM elements
  widgetEl = document.getElementById('autoScrollWidget');
  speedFillEl = document.getElementById('autoScrollSpeedFill');
  speedLabelEl = document.getElementById('autoScrollSpeedLabel');
  toggleBtnEl = document.getElementById('autoScrollToggle');

  const slowerBtn = document.getElementById('autoScrollSlower');
  const fasterBtn = document.getElementById('autoScrollFaster');
  const closeBtn = document.getElementById('autoScrollClose');

  // Widget button handlers
  if (toggleBtnEl) {
    toggleBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAutoScroll();
    });
  }
  if (slowerBtn) {
    slowerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setAutoScrollSpeed(scrollSpeed - 1);
    });
  }
  if (fasterBtn) {
    fasterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setAutoScrollSpeed(scrollSpeed + 1);
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopAutoScroll();
    });
  }

  // Draggable widget
  if (widgetEl) {
    widgetEl.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  // Global keyboard handler
  document.addEventListener('keydown', onKeyDown);

  // Cancel on manual scroll
  const container = deps.els.canvasWrap;
  if (container) {
    container.addEventListener('wheel', onManualWheel, { passive: true });
  }

  // Cancel on click in document area
  const viewport = document.getElementById('documentViewport');
  if (viewport) {
    viewport.addEventListener('click', onDocumentClick);
  }
}

/**
 * Start auto-scrolling at the given speed (1-10).
 * @param {number} [speed]
 */
export function startAutoScroll(speed) {
  if (speed !== undefined) {
    scrollSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(speed)));
    saveSpeed();
  }
  isScrolling = true;
  lastTimestamp = 0;
  showWidget();
  updateWidgetUI();
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(scrollTick);
}

/**
 * Stop auto-scrolling and hide the widget.
 */
export function stopAutoScroll() {
  isScrolling = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  lastTimestamp = 0;
  hideWidget();
}

/**
 * Toggle between scrolling and paused. If not started, starts at current speed.
 */
export function toggleAutoScroll() {
  if (isScrolling) {
    // Pause (but keep widget visible)
    isScrolling = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    lastTimestamp = 0;
    updateWidgetUI();
  } else {
    startAutoScroll(scrollSpeed);
  }
}

/**
 * Set the scroll speed (1-10). Persists to localStorage.
 * @param {number} speed
 */
export function setAutoScrollSpeed(speed) {
  scrollSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(speed)));
  saveSpeed();
  updateWidgetUI();
}

/**
 * Returns true if auto-scroll is currently active (scrolling).
 * @returns {boolean}
 */
export function isAutoScrolling() {
  return isScrolling;
}
