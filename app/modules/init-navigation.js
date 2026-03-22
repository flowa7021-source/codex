// ─── Page Navigation & Zoom Controls ────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

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
    state.rotation = (state.rotation + 90) % 360;
    clearOcrRuntimeCaches('rotation-changed');
    if (state.adapter) {
      try {
        const vp = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
        const scrollbarW = els.canvasWrap.offsetWidth - els.canvasWrap.clientWidth;
        const available = Math.max(200, els.canvasWrap.clientWidth - Math.max(16, scrollbarW + 16));
        const autoZoom = available / vp.width;
        if (autoZoom > 0.3 && autoZoom < 4) {
          state.zoom = Math.round(autoZoom * 100) / 100;
        }
      } catch (_e) { /* keep current zoom */ }
    }
    await renderPagePreviews();
    await renderCurrentPage();
    if (state.settings?.backgroundOcr) scheduleBackgroundOcrScan('save-settings', 600);
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
