// @ts-check
// ─── Global Keyboard Handlers ───────────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

/**
 * Wire up all hotkey combinations: Ctrl+Z/Y, Alt+Arrow, Escape,
 * Help shortcut ('?'), configurable hotkeys from settings.
 *
 * @param {object} deps  External references.
 */
export function initKeyboard(deps) {
  const {
    state,
    els,
    hotkeys,
    stringifyHotkeyEvent,
    navigateHistoryBack,
    navigateHistoryForward,
    addBookmark,
    setDrawMode,
    setOcrRegionMode,
    setOcrStatus,
    undoStroke,
    undoPageEdit,
    redoPageEdit,
    showShortcutsHelp,
    blockEditor,
    renderCurrentPage,
  } = deps;

  document.addEventListener('keydown', async (e) => {
    const key = e.key.toLowerCase();
    const combo = stringifyHotkeyEvent(e);

    if (combo && Object.values(hotkeys).includes(combo) && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
    }
    if (e.altKey && key === 'arrowleft') {
      e.preventDefault();
      await navigateHistoryBack();
      return;
    }
    if (e.altKey && key === 'arrowright') {
      e.preventDefault();
      await navigateHistoryForward();
      return;
    }

    if (combo && combo === hotkeys.next) els.nextPage?.click();
    if (combo && combo === hotkeys.prev) els.prevPage?.click();
    if (combo && combo === hotkeys.zoomIn) els.zoomIn?.click();
    if (combo && combo === hotkeys.zoomOut) els.zoomOut?.click();
    if (combo && combo === hotkeys.fitWidth) els.fitWidth?.click();
    if (combo && combo === hotkeys.fitPage) els.fitPage?.click();
    if (combo && combo === hotkeys.ocrPage) {
      e.preventDefault();
      els.ocrCurrentPage?.click();
    }
    if (combo && combo === hotkeys.searchFocus) {
      e.preventDefault();
      els.searchInput?.focus();
    }
    if (key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addBookmark();
    }
    if ((e.ctrlKey || e.metaKey) && key === 'f' && hotkeys.searchFocus === 'ctrl+f') {
      e.preventDefault();
      els.searchInput?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      if (state.drawEnabled) {
        e.preventDefault();
        undoStroke();
      } else if (state.textEditMode && !e.shiftKey) {
        e.preventDefault();
        const action = undoPageEdit();
        if (action && els.pageText) {
          els.pageText.value = action.text;
          setOcrStatus(`Отмена: страница ${action.page}`);
        }
      } else if (blockEditor?.active) {
        e.preventDefault();
        if (blockEditor.undo(state.currentPage)) {
          renderCurrentPage();
        }
      }
    }
    if ((e.ctrlKey || e.metaKey) && key === 'y') {
      if (state.textEditMode) {
        e.preventDefault();
        const action = redoPageEdit();
        if (action && els.pageText) {
          els.pageText.value = action.text;
          setOcrStatus(`Повтор: страница ${action.page}`);
        }
      } else if (blockEditor?.active) {
        e.preventDefault();
        if (blockEditor.redo(state.currentPage)) {
          renderCurrentPage();
        }
      }
    }
    // Ctrl+S — save current document with modifications
    if ((e.ctrlKey || e.metaKey) && key === 's' && !e.shiftKey) {
      e.preventDefault();
      deps.saveCurrentFile?.();
    }
    // Ctrl+Shift+S — save as (choose new path)
    if ((e.ctrlKey || e.metaKey) && key === 's' && e.shiftKey) {
      e.preventDefault();
      deps.saveCurrentFileAs?.();
    }

    if (combo && combo === hotkeys.annotate) {
      e.preventDefault();
      setDrawMode(!state.drawEnabled);
    }
    if (e.key === 'Escape' && state.drawEnabled) {
      setDrawMode(false);
    }
    if (e.key === 'Escape' && state.ocrRegionMode) {
      setOcrRegionMode(false);
    }
    if (e.key === 'Escape' && els.settingsModal?.classList.contains('open')) {
      deps.closeSettingsModal();
    }
    if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      showShortcutsHelp();
    }
  });
}
