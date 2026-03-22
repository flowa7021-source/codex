// @ts-check
// thumbnail-renderer.js — Single-column page thumbnail previews in sidebar
import { state, els } from './state.js';

const THUMB_WIDTH = 150;
const THUMB_ZOOM = 0.2;
const PRELOAD_MARGIN = 5; // render ±5 pages around viewport

/** @type {Map<number, HTMLCanvasElement>} */
const thumbCache = new Map();
let observer = null;
let currentDocName = null;

export function invalidateThumbnailCache() {
  for (const canvas of thumbCache.values()) {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  thumbCache.clear();
  currentDocName = null;
}

export async function renderPagePreviews() {
  const container = els.pagePreviewList;
  if (!container || !state.adapter) return;

  // If doc changed, clear cache
  if (currentDocName !== state.docName) {
    thumbCache.clear();
    currentDocName = state.docName;
  }

  // Disconnect previous observer
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  container.innerHTML = '';
  container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 4px;overflow-y:auto;';

  const pageCount = state.pageCount;
  if (pageCount <= 0) return;

  // Create placeholder elements for each page
  const placeholders = [];
  for (let i = 1; i <= pageCount; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumb-wrapper';
    wrapper.dataset.page = String(i);
    wrapper.style.cssText = `
      cursor:pointer;border:2px solid transparent;border-radius:4px;
      padding:2px;text-align:center;min-height:${Math.round(THUMB_WIDTH * 1.4)}px;
      width:${THUMB_WIDTH + 8}px;position:relative;
    `;
    if (i === state.currentPage) {
      wrapper.style.borderColor = 'var(--accent, #3b82f6)';
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.cssText = `width:${THUMB_WIDTH}px;height:auto;display:block;margin:0 auto;background:#2a2a3a;border-radius:2px;`;
    wrapper.appendChild(canvas);

    const label = document.createElement('div');
    label.textContent = String(i);
    label.style.cssText = 'font-size:11px;color:var(--text-muted,#888);margin-top:2px;';
    wrapper.appendChild(label);

    wrapper.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('novareader-goto-page', { detail: { page: i } }));
    });

    container.appendChild(wrapper);
    placeholders.push({ wrapper, canvas, page: i });
  }

  // Use IntersectionObserver for lazy rendering
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const page = Number(/** @type {HTMLElement} */ (entry.target).dataset.page);
        if (page > 0) {
          const el = entry.target.querySelector('canvas');
          if (el) renderThumb(page, el);
          // Pre-render adjacent pages
          for (let delta = 1; delta <= PRELOAD_MARGIN; delta++) {
            const prev = page - delta;
            const next = page + delta;
            if (prev >= 1) {
              const el = container.querySelector(`[data-page="${prev}"] canvas`);
              if (el) renderThumb(prev, el);
            }
            if (next <= pageCount) {
              const el = container.querySelector(`[data-page="${next}"] canvas`);
              if (el) renderThumb(next, el);
            }
          }
        }
      }
    }
  }, { root: container, rootMargin: '200px 0px' });

  for (const { wrapper } of placeholders) {
    observer.observe(wrapper);
  }
}

async function renderThumb(pageNum, canvas) {
  if (!canvas || !state.adapter) return;
  // Skip if already rendered
  if (thumbCache.has(pageNum) && canvas.width > 1) return;

  try {
    const offscreen = document.createElement('canvas');
    await state.adapter.renderPage(pageNum, offscreen, { zoom: THUMB_ZOOM, rotation: state.rotation });

    // Scale to thumbnail width
    const scale = THUMB_WIDTH / (parseFloat(offscreen.style.width) || offscreen.width);
    const thumbH = Math.round((parseFloat(offscreen.style.height) || offscreen.height) * scale);

    canvas.width = THUMB_WIDTH;
    canvas.height = thumbH;
    canvas.style.width = `${THUMB_WIDTH}px`;
    canvas.style.height = `${thumbH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(offscreen, 0, 0, THUMB_WIDTH, thumbH);

    thumbCache.set(pageNum, canvas);

    // Release offscreen
    offscreen.width = 0;
    offscreen.height = 0;
  } catch (err) {
    console.warn('[thumbnail-renderer] error:', err?.message);
    // Non-critical, silently ignore
  }
}

export function highlightCurrentPage() {
  const container = els.pagePreviewList;
  if (!container) return;

  const wrappers = container.querySelectorAll('.thumb-wrapper');
  for (const w of wrappers) {
    const page = Number(/** @type {HTMLElement} */ (w).dataset.page);
    /** @type {any} */ (w).style.borderColor = page === state.currentPage ? 'var(--accent, #3b82f6)' : 'transparent';
  }

  // Scroll current page into view
  const current = container.querySelector(`[data-page="${state.currentPage}"]`);
  if (current) {
    current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

export function cleanupThumbnails() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  thumbCache.clear();
}
