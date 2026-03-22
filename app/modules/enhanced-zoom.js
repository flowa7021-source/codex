// @ts-check
// ─── Enhanced Zoom System ───────────────────────────────────────────────────
// Zoom presets, smooth zoom, pinch-to-zoom, marquee zoom, per-document memory.

export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const SMOOTH_ZOOM_DURATION = 200;

let deps = null;
let marqueeActive = false;
let marqueeStart = null;
let marqueeOverlay = null;

/**
 * Initialize with app dependencies.
 * @param {object} d
 * @param {Function} d.getZoom
 * @param {Function} d.setZoom - (newZoom) => void
 * @param {Function} d.render - () => Promise
 * @param {HTMLElement} d.canvasWrap
 * @param {HTMLCanvasElement} d.canvas
 */
export function initEnhancedZoom(d) {
  deps = d;
  setupWheelZoom();
  setupPinchZoom();
}

// ─── Zoom Presets ────────────────────────────────────────────────────────────

/** Snap to nearest preset above current zoom */
export function zoomToNextPreset() {
  if (!deps) return;
  const current = deps.getZoom();
  for (const p of ZOOM_PRESETS) {
    if (p > current + 0.01) {
      smoothZoomTo(p);
      return;
    }
  }
}

/** Snap to nearest preset below current zoom */
export function zoomToPrevPreset() {
  if (!deps) return;
  const current = deps.getZoom();
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (ZOOM_PRESETS[i] < current - 0.01) {
      smoothZoomTo(ZOOM_PRESETS[i]);
      return;
    }
  }
}

/** Set zoom to a specific preset value */
export function zoomToPreset(value) {
  smoothZoomTo(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value)));
}

// ─── Smooth Zoom ─────────────────────────────────────────────────────────────

let smoothZoomRaf = null;

export function smoothZoomTo(target) {
  if (!deps) return;
  const start = deps.getZoom();
  const diff = target - start;
  if (Math.abs(diff) < 0.001) return;

  const startTime = performance.now();
  cancelAnimationFrame(smoothZoomRaf);

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / SMOOTH_ZOOM_DURATION);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const current = start + diff * eased;
    deps.setZoom(Math.round(current * 100) / 100);

    if (t < 1) {
      smoothZoomRaf = requestAnimationFrame(step);
    } else {
      deps.setZoom(Math.round(target * 100) / 100);
      deps.render();
    }
  }

  smoothZoomRaf = requestAnimationFrame(step);
}

// ─── Ctrl+Wheel Zoom ─────────────────────────────────────────────────────────

function setupWheelZoom() {
  if (!deps?.canvasWrap) return;
  deps.canvasWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    const current = deps.getZoom();
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current * (1 + delta)));
    deps.setZoom(Math.round(newZoom * 100) / 100);
    deps.render();
  }, { passive: false });
}

// ─── Pinch-to-Zoom ──────────────────────────────────────────────────────────

let pinchStartDist = 0;
let pinchStartZoom = 1;

function setupPinchZoom() {
  if (!deps?.canvasWrap) return;
  const el = deps.canvasWrap;

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchStartDist = getTouchDistance(e.touches);
      pinchStartZoom = deps.getZoom();
    }
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const scale = dist / pinchStartDist;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom * scale));
      deps.setZoom(Math.round(newZoom * 100) / 100);
    }
  }, { passive: false });

  el.addEventListener('touchend', (e) => {
    if (e.touches.length < 2 && pinchStartDist > 0) {
      pinchStartDist = 0;
      deps.render();
    }
  }, { passive: true });
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Marquee Zoom (select rectangle to zoom into) ──────────────────────────

export function startMarqueeZoom() {
  if (!deps?.canvasWrap) return;
  marqueeActive = true;
  deps.canvasWrap.style.cursor = 'crosshair';

  if (!marqueeOverlay) {
    marqueeOverlay = document.createElement('div');
    marqueeOverlay.className = 'marquee-zoom-overlay';
    deps.canvasWrap.appendChild(marqueeOverlay);
  }

  deps.canvasWrap.addEventListener('mousedown', onMarqueeStart);
}

export function cancelMarqueeZoom() {
  marqueeActive = false;
  if (deps?.canvasWrap) deps.canvasWrap.style.cursor = '';
  if (marqueeOverlay) {
    marqueeOverlay.style.display = 'none';
  }
  deps?.canvasWrap?.removeEventListener('mousedown', onMarqueeStart);
  document.removeEventListener('mousemove', onMarqueeMove);
  document.removeEventListener('mouseup', onMarqueeEnd);
}

function onMarqueeStart(e) {
  if (!marqueeActive) return;
  marqueeStart = { x: e.offsetX, y: e.offsetY };
  marqueeOverlay.style.display = 'block';
  marqueeOverlay.style.left = `${e.offsetX}px`;
  marqueeOverlay.style.top = `${e.offsetY}px`;
  marqueeOverlay.style.width = '0';
  marqueeOverlay.style.height = '0';
  document.addEventListener('mousemove', onMarqueeMove);
  document.addEventListener('mouseup', onMarqueeEnd);
}

function onMarqueeMove(e) {
  if (!marqueeStart || !marqueeOverlay) return;
  const rect = deps.canvasWrap.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const left = Math.min(marqueeStart.x, x);
  const top = Math.min(marqueeStart.y, y);
  const width = Math.abs(x - marqueeStart.x);
  const height = Math.abs(y - marqueeStart.y);
  marqueeOverlay.style.left = `${left}px`;
  marqueeOverlay.style.top = `${top}px`;
  marqueeOverlay.style.width = `${width}px`;
  marqueeOverlay.style.height = `${height}px`;
}

function onMarqueeEnd(e) {
  if (!marqueeStart || !deps) return;
  const rect = deps.canvasWrap.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  const selWidth = Math.abs(endX - marqueeStart.x);
  const selHeight = Math.abs(endY - marqueeStart.y);

  // Only zoom if selection is meaningful
  if (selWidth > 20 && selHeight > 20) {
    const wrapWidth = deps.canvasWrap.clientWidth;
    const wrapHeight = deps.canvasWrap.clientHeight;
    const zoomX = wrapWidth / selWidth;
    const zoomY = wrapHeight / selHeight;
    const newZoom = deps.getZoom() * Math.min(zoomX, zoomY);
    smoothZoomTo(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom)));
  }

  cancelMarqueeZoom();
}

// ─── Per-Document Zoom Memory ───────────────────────────────────────────────

const ZOOM_MEMORY_KEY = 'novareader-zoom-memory';

export function saveDocumentZoom(docName, zoom) {
  try {
    const data = JSON.parse(localStorage.getItem(ZOOM_MEMORY_KEY) || '{}');
    data[docName] = zoom;
    // Keep only last 50 documents
    const keys = Object.keys(data);
    if (keys.length > 50) {
      delete data[keys[0]];
    }
    localStorage.setItem(ZOOM_MEMORY_KEY, JSON.stringify(data));
  } catch (err) { console.warn('[enhanced-zoom storage] error:', err?.message); }
}

export function loadDocumentZoom(docName) {
  try {
    const data = JSON.parse(localStorage.getItem(ZOOM_MEMORY_KEY) || '{}');
    return data[docName] || null;
  } catch (err) {
    console.warn('[enhanced-zoom storage] error:', err?.message);
    return null;
  }
}
