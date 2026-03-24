// @ts-check
// ─── Advanced Features Bootstrap ────────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

import { on, once as onceBus } from './event-bus.js';

/**
 * Wire up quick actions, command palette, auto-scroll, autosave,
 * minimap and extended hotkeys.
 *
 * @param {object} deps  External references.
 */
export function initAdvanced(deps) {
  const {
    state,
    els,
    safeOn,
    debounce,
    renderCurrentPage,
    goToPage,
    nrPrompt,
    pushDiagnosticEvent,
    toastSuccess,
    loadStrokes,
    saveStrokes,
    // Quick actions
    initQuickActions,
    // Hotkeys
    initHotkeys,
    registerHotkeyHandlers,
    // Auto-scroll
    initAutoScroll,
    startAutoScroll,
    stopAutoScroll,
    isAutoScrolling,
    // Autosave
    initAutosave,
    checkForRecovery,
    applyRecoveredSnapshot,
    startAutosaveTimer,
    // Minimap
    initMinimap,
    updateMinimap,
    // Command palette
    initCommandPalette,
  } = deps;

  // ── Quick Actions ──────────────────────────────────────────────────────
  initQuickActions({
    container: document.querySelector('.document-viewport') || document.body,
    onAction: (id, text) => {
      if (id === 'search' && text) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) { /** @type {HTMLInputElement} */ (searchInput).value = text; searchInput.dispatchEvent(new Event('input')); }
      }
    },
  });

  // ── Extended Hotkeys ───────────────────────────────────────────────────
  initHotkeys();
  registerHotkeyHandlers({
    goToPage: async () => {
      const page = await nrPrompt('Перейти к странице:');
      if (page) { const n = parseInt(page, 10); if (n >= 1 && n <= state.pageCount) { state.currentPage = n; renderCurrentPage(); } }
    },
    firstPage: () => { state.currentPage = 1; renderCurrentPage(); },
    lastPage: () => { state.currentPage = state.pageCount; renderCurrentPage(); },
    prevPage: () => els.prevPage?.click(),
    nextPage: () => els.nextPage?.click(),
    zoomIn: () => els.zoomIn?.click(),
    zoomOut: () => els.zoomOut?.click(),
    search: () => { const toggle = document.getElementById('searchToggle'); if (toggle) toggle.click(); },
    fullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); },
    print: () => window.print(),
  });

  // ── Minimap ────────────────────────────────────────────────────────────
  initMinimap({
    state,
    els,
    onPageChange: () => renderCurrentPage(),
  });

  const _debouncedMinimapUpdate = debounce(() => updateMinimap(), 60);
  safeOn(els.canvasWrap, 'scroll', _debouncedMinimapUpdate, { passive: true });
  on('page-rendered', () => updateMinimap());

  // ── Auto-Scroll ────────────────────────────────────────────────────────
  initAutoScroll({ state, els, goToPage });
  safeOn(document.getElementById('autoScrollBtn'), 'click', () => {
    if (isAutoScrolling()) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  });

  // ── Autosave & Crash Recovery ──────────────────────────────────────────
  initAutosave({
    state,
    els,
    getAnnotations: () => {
      try { return loadStrokes(); } catch (_e) { return null; }
    },
    setAnnotations: (data) => {
      try { saveStrokes(data); } catch (_e) { /* ignore */ }
    },
    showToast: (msg) => {
      try { toastSuccess(msg); } catch (_e) { /* ignore */ }
    },
  });

  checkForRecovery().then((snapshot) => {
    if (snapshot) {
      applyRecoveredSnapshot(snapshot);
      pushDiagnosticEvent('autosave.recovery-applied', {
        fileName: snapshot.fileName,
        page: snapshot.currentPage,
        age: Date.now() - snapshot.timestamp,
      });
    }
  }).catch((err) => {
    console.warn('[autosave] recovery check failed:', err?.message);
  });

  // Hook into file opening to start autosave timer
  onceBus('page-rendered', () => {
    if (state.adapter && state.docName) {
      startAutosaveTimer();
    }
  });

  // ── Command Palette ────────────────────────────────────────────────────
  initCommandPalette({
    state,
    els,
    goToPage: (n) => {
      if (n >= 1 && n <= state.pageCount) {
        state.currentPage = n;
        renderCurrentPage();
      }
    },
  });
}
