// @ts-check
// ─── Settings Proxy Wrappers ────────────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.
// Delegates to SettingsController with contextual keys and dependencies.

/**
 * Create all Settings proxy wrapper functions that delegate to SettingsController.
 *
 * @param {object} deps  External references.
 * @returns {object} All wrapper functions needed by app.js.
 */
export function initSettings(deps) {
  const {
    SettingsController,
    noteKey,
    bookmarkKey,
    uiLayoutKey,
    state,
    els,
    saveDjvuData,
    renderOutline,
    renderPagePreviews,
    renderCurrentPage,
    renderDocStats,
    renderEtaStatus,
  } = deps;

  // ─── Basic settings ──────────────────────────────────────────────────────
  function defaultSettings() { return SettingsController.defaultSettings(); }
  function loadAppSettings() { SettingsController.loadAppSettings(); }
  function saveAppSettings() { SettingsController.saveAppSettings(); }
  function applyUiSizeSettings() { SettingsController.applyUiSizeSettings(uiLayoutKey); }
  function getOcrLang() { return SettingsController.getOcrLang(); }

  // ─── DjVu data import ────────────────────────────────────────────────────
  async function importDjvuDataJson(file) {
    if (!state.adapter || state.adapter.type !== 'djvu') {
      if (els.searchStatus) els.searchStatus.textContent = 'Импорт DjVu data доступен только для DjVu';
      return;
    }

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      state.adapter.setData(payload);
      saveDjvuData(state.adapter.exportData());
      state.pageCount = state.adapter.getPageCount();
      els.pageInput.max = String(state.pageCount);
      if (state.currentPage > state.pageCount) {
        state.currentPage = state.pageCount;
        els.pageInput.value = String(state.currentPage);
      }
      await renderOutline();
      await renderPagePreviews();
      await renderCurrentPage();
      if (els.searchStatus) els.searchStatus.textContent = 'DjVu data JSON импортирован';
    } catch (err) {
      console.warn('[app] error:', err?.message);
      if (els.searchStatus) els.searchStatus.textContent = 'Ошибка импорта DjVu data JSON';
    }
  }

  // ─── Theme ───────────────────────────────────────────────────────────────
  const THEME_CLASSES = ['light', 'sepia', 'high-contrast', 'theme-auto'];

  function applyTheme(theme) {
    THEME_CLASSES.forEach(c => document.body.classList.remove(c));
    if (theme === 'light') document.body.classList.add('light');
    else if (theme === 'sepia') document.body.classList.add('sepia');
    else if (theme === 'high-contrast') document.body.classList.add('high-contrast');
    else if (theme === 'auto') document.body.classList.add('theme-auto');
    // 'dark' is the default — no class needed

    // Set data-theme attribute on <html> for CSS custom property theming
    const effectiveTheme = (theme === 'light' || theme === 'sepia') ? 'light' : 'dark';
    document.documentElement.dataset.theme = effectiveTheme;

    localStorage.setItem('novareader-theme', theme);
  }

  function loadTheme() {
    const theme = localStorage.getItem('novareader-theme') || 'dark';
    applyTheme(theme);
  }

  function toggleTheme() { SettingsController.toggleTheme(applyTheme); }

  // ─── Notes ───────────────────────────────────────────────────────────────
  function getNotesModel() { return SettingsController.getNotesModel(); }
  function normalizeImportedNotes(payload) { return SettingsController.normalizeImportedNotes(payload); }
  function loadNotes() { SettingsController.loadNotes(noteKey); }
  function saveNotes(source = 'manual') { SettingsController.saveNotes(noteKey, source); }
  function _queueNotesAutosave() { SettingsController.queueNotesAutosave(noteKey); }
  function _exportNotes() { SettingsController.exportNotes(); }
  function _exportNotesMarkdown() { SettingsController.exportNotesMarkdown(); }
  function _exportNotesJson() { SettingsController.exportNotesJson(); }
  async function _importNotesJson(file) { await SettingsController.importNotesJson(file, noteKey); }
  function _insertTimestamp() { SettingsController.insertTimestamp(noteKey); }

  // ─── Hotkeys ─────────────────────────────────────────────────────────────
  function normalizeHotkey(value, fallback) { return SettingsController.normalizeHotkey(value, fallback); }
  function setHotkeysStatus(message, type = '') { SettingsController.setHotkeysStatus(message, type); }
  function setHotkeysInputErrors(fields = [], details = {}) { SettingsController.setHotkeysInputErrors(fields, details); }
  function validateHotkeys(nextHotkeys) { return SettingsController.validateHotkeys(nextHotkeys); }
  function renderHotkeyInputs() { SettingsController.renderHotkeyInputs(); }
  function saveHotkeys() { SettingsController.saveHotkeys(); }
  function loadHotkeys() { SettingsController.loadHotkeys(); }
  function resetHotkeys() { SettingsController.resetHotkeys(); }
  function stringifyHotkeyEvent(e) { return SettingsController.stringifyHotkeyEvent(e); }
  function bindHotkeyCapture() { SettingsController.bindHotkeyCapture(); }
  function autoFixHotkeys() { SettingsController.autoFixHotkeys(); }

  // ─── Bookmarks ───────────────────────────────────────────────────────────
  function setBookmarksStatus(message, type = '') { SettingsController.setBookmarksStatus(message, type); }
  function _exportBookmarksJson() { SettingsController.exportBookmarksJson(bookmarkKey, loadBookmarks); }
  async function _importBookmarksJson(file) { await SettingsController.importBookmarksJson(file, saveBookmarks, renderBookmarks); }
  function loadBookmarks() { return SettingsController.loadBookmarks(bookmarkKey); }
  function saveBookmarks(next) { SettingsController.saveBookmarks(next, bookmarkKey, renderDocStats, renderEtaStatus); }
  function renderBookmarks() { SettingsController.renderBookmarks(bookmarkKey, saveBookmarks, renderCurrentPage); }
  async function addBookmark() { await SettingsController.addBookmark(bookmarkKey, saveBookmarks, renderBookmarks); }
  function _clearBookmarks() { SettingsController.clearBookmarks(saveBookmarks, renderBookmarks); }

  return {
    // Basic settings
    defaultSettings,
    loadAppSettings,
    saveAppSettings,
    applyUiSizeSettings,
    getOcrLang,

    // DjVu data import
    importDjvuDataJson,

    // Theme
    THEME_CLASSES,
    applyTheme,
    loadTheme,
    toggleTheme,

    // Notes
    getNotesModel,
    normalizeImportedNotes,
    loadNotes,
    saveNotes,
    _queueNotesAutosave,
    _exportNotes,
    _exportNotesMarkdown,
    _exportNotesJson,
    _importNotesJson,
    _insertTimestamp,

    // Hotkeys
    normalizeHotkey,
    setHotkeysStatus,
    setHotkeysInputErrors,
    validateHotkeys,
    renderHotkeyInputs,
    saveHotkeys,
    loadHotkeys,
    resetHotkeys,
    stringifyHotkeyEvent,
    bindHotkeyCapture,
    autoFixHotkeys,

    // Bookmarks
    setBookmarksStatus,
    _exportBookmarksJson,
    _importBookmarksJson,
    loadBookmarks,
    saveBookmarks,
    renderBookmarks,
    addBookmark,
    _clearBookmarks,
  };
}
