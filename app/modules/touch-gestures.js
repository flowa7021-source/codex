// ─── Touch & Mobile Gestures ────────────────────────────────────────────────
// Swipe navigation, touch-friendly targets, haptic feedback.

let deps = null;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isSwiping = false;

const SWIPE_THRESHOLD = 80;
const SWIPE_MAX_VERTICAL = 60;
const SWIPE_MAX_TIME = 400;

/**
 * @param {object} d
 * @param {Function} d.nextPage
 * @param {Function} d.prevPage
 * @param {HTMLElement} d.viewport
 */
export function initTouchGestures(d) {
  deps = d;
  if (!deps?.viewport) return;

  setupSwipeNavigation();
  setupDoubleTapZoom();
  applyTouchFriendlyTargets();
}

// ─── Swipe to Navigate Pages ────────────────────────────────────────────────

function setupSwipeNavigation() {
  const el = deps.viewport;

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isSwiping = true;
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    // Cancel if scrolling vertically
    if (dy > SWIPE_MAX_VERTICAL) isSwiping = false;
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const elapsed = Date.now() - touchStartTime;
    if (elapsed > SWIPE_MAX_TIME) return;

    const endX = e.changedTouches[0].clientX;
    const dx = endX - touchStartX;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    if (dx < 0) {
      // Swipe left → next page
      hapticFeedback();
      deps.nextPage();
    } else {
      // Swipe right → prev page
      hapticFeedback();
      deps.prevPage();
    }
  }, { passive: true });
}

// ─── Double-Tap to Zoom ─────────────────────────────────────────────────────

let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;

function setupDoubleTapZoom() {
  const el = deps.viewport;

  el.addEventListener('touchend', (e) => {
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - lastTapX);
    const dy = Math.abs(touch.clientY - lastTapY);

    if (now - lastTapTime < 300 && dx < 30 && dy < 30) {
      // Double tap detected
      e.preventDefault();
      hapticFeedback();
      document.dispatchEvent(new CustomEvent('doubletapzoom', {
        detail: { x: touch.clientX, y: touch.clientY }
      }));
      lastTapTime = 0;
    } else {
      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
    }
  }, { passive: false });
}

// ─── Touch-Friendly Target Sizes ────────────────────────────────────────────

function applyTouchFriendlyTargets() {
  if (!isTouchDevice()) return;
  document.body.classList.add('touch-device');
}

/** Detect if the device supports touch */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ─── Haptic Feedback ────────────────────────────────────────────────────────

export function hapticFeedback(duration = 10) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  } catch (err) { console.warn('[touch-gestures] error:', err?.message); }
}

// ─── Virtual Keyboard Adaptation ────────────────────────────────────────────

let originalViewportHeight = 0;

export function setupVirtualKeyboardAdaptation() {
  if (!window.visualViewport) return;
  originalViewportHeight = window.visualViewport.height;

  window.visualViewport.addEventListener('resize', () => {
    const current = window.visualViewport.height;
    const isKeyboardOpen = current < originalViewportHeight * 0.75;
    document.body.classList.toggle('virtual-keyboard-open', isKeyboardOpen);

    // Scroll active input into view
    if (isKeyboardOpen) {
      const active = document.activeElement;
      if (active?.matches('input, textarea, [contenteditable]')) {
        requestAnimationFrame(() => active.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      }
    }
  });
}
