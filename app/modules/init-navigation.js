// @ts-check
// ─── Page Navigation & Zoom Controls ────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

import { pushDiagnosticEvent } from './diagnostics.js';

/**
 * Wire up prev/next page handlers, go-to-page, zoom controls, fit buttons,
 * rotation, fullscreen toggle and Ctrl+wheel zoom.
 *
 * @param {object} deps  External references.
 */
export function initNavigation(deps) {
  const {
    state,
    els,
    debounce,
    safeOn,
    renderCurrentPage,
    renderPagePreviews,
    goToPage,
    fitWidth,
    fitPage,
    clearOcrRuntimeCaches,
    scheduleBackgroundOcrScan,
    evictPageFromCache,
  } = deps;

  safeOn(els.prevPage, 'click', async () => {
    if (!state.adapter || state.currentPage <= 1) return;
    state.currentPage -= 1;
    await renderCurrentPage();
  });

  safeOn(els.nextPage, 'click', async () => {
    if (!state.adapter || state.currentPage >= state.pageCount) return;
    state.currentPage += 1;
    await renderCurrentPage();
  });

  safeOn(els.goToPage, 'click', goToPage);
  safeOn(els.pageInput, 'keydown', async (e) => {
    if (e.key === 'Enter') await goToPage();
  });

  // Debounced render for rapid zoom clicks
  const debouncedZoomRender = debounce(async () => {
    await renderCurrentPage();
  }, 120);

  safeOn(els.zoomIn, 'click', () => {
    state.zoom = Math.min(4, +(state.zoom + 0.1).toFixed(2));
    if (els.zoomStatus) els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
    debouncedZoomRender();
  });

  safeOn(els.zoomOut, 'click', () => {
    state.zoom = Math.max(0.3, +(state.zoom - 0.1).toFixed(2));
    if (els.zoomStatus) els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
    debouncedZoomRender();
  });

  safeOn(els.fitWidth, 'click', fitWidth);
  safeOn(els.fitPage, 'click', fitPage);

  safeOn(els.rotate, 'click', async () => {
    const oldRotation = state.rotation;
    state.rotation = (state.rotation + 90) % 360;
    pushDiagnosticEvent('page.rotate', { from: oldRotation, to: state.rotation, page: state.currentPage });
    try {
      clearOcrRuntimeCaches('rotation-changed');
      evictPageFromCache(state.currentPage);
      try { const { invalidateTiles } = await import('./tile-renderer.js'); invalidateTiles(); } catch (_e) { /* non-critical */ }
      // Auto-fit zoom for rotated viewport
      if (state.adapter) {
        try {
          const vp = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
          const cw = els.canvasWrap?.clientWidth || 800;
          const sw = (els.canvasWrap?.offsetWidth || cw) - cw;
          const available = Math.max(200, cw - Math.max(16, sw + 16));
          const autoZoom = available / Math.max(1, vp.width);
          if (autoZoom > 0.3 && autoZoom < 4) {
            state.zoom = Math.round(autoZoom * 100) / 100;
          }
        } catch (err) {
          console.warn('[nav] rotation viewport failed:', err?.message);
        }
      }
      // Skip page transition animation for rotation
      if (els.canvas?.classList) els.canvas.classList.remove('page-transitioning');
      await renderCurrentPage();
      if (els.canvas?.classList) els.canvas.classList.remove('page-transitioning');
      console.info(`[nav] rotated ${oldRotation}° → ${state.rotation}°, zoom=${state.zoom}`);
      renderPagePreviews().catch((err) => { console.warn('[nav] preview error:', err?.message); });
      if (state.settings?.backgroundOcr) scheduleBackgroundOcrScan('save-settings', 600);
    } catch (err) {
      console.error('[nav] rotation failed:', err);
      pushDiagnosticEvent('page.rotate.error', { message: err?.message, from: oldRotation, to: state.rotation }, 'error');
      // Revert rotation on failure so state stays consistent
      state.rotation = oldRotation;
    }
  });

  safeOn(els.fullscreen, 'click', async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  });

  // Ctrl+wheel zoom
  let _wheelZoomPending = false;
  safeOn(els.canvasWrap, 'wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.08 : -0.08;
    state.zoom = Math.min(4, Math.max(0.3, state.zoom + step));
    if (els.zoomStatus) els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
    if (!_wheelZoomPending) {
      _wheelZoomPending = true;
      requestAnimationFrame(async () => {
        _wheelZoomPending = false;
        await renderCurrentPage();
      });
    }
  }, { passive: false });
}
