// ─── Tab Manager Integration ────────────────────────────────────────────────
// Extracted from app.js — pure refactor, no behavior changes.

/**
 * Wire up tab bar creation, activation/deactivation, session storage
 * persistence and recovery.
 *
 * @param {object} deps  External references.
 * @returns {{ tabManager: TabManager, openFileWithTabs: Function }}
 */
export function initTabs(deps) {
  const {
    state,
    els,
    safeOn,
    openFile,
    renderCurrentPage,
    TabManager,
  } = deps;

  const tabBarEl = document.getElementById('tabBarTabs');
  const tabManager = new TabManager({
    tabBar: tabBarEl,
    onActivate: async (tab) => {
      if (!tab.bytes) return;
      const type = tab.type || 'pdf';
      const file = new File([tab.bytes], tab.name, {
        type: type === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      });
      await openFile(file);
      if (tab.state?.currentPage) {
        state.currentPage = Math.min(tab.state.currentPage, state.pageCount);
      }
      if (tab.state?.zoom) state.zoom = tab.state.zoom;
      if (tab.state?.rotation != null) state.rotation = tab.state.rotation;
      await renderCurrentPage();
      if (tab.state?.scrollY && els.canvasWrap) {
        els.canvasWrap.scrollTop = tab.state.scrollY;
      }
    },
    onClose: (tab) => {
      if (tab.modified) {
        return confirm(`Файл "${tab.name}" изменён. Закрыть без сохранения?`);
      }
      return true;
    },
    maxTabs: 10,
  });

  // Save state when deactivating a tab
  tabManager.onDeactivate = (tab) => {
    tab.state = {
      currentPage: state.currentPage,
      zoom: state.zoom,
      rotation: state.rotation,
      scrollY: els.canvasWrap?.scrollTop || 0,
    };
    if (state.pdfBytes && tab.type === 'pdf') {
      tab.bytes = state.pdfBytes;
    }
  };

  // Hook into file opening to register tabs
  const openFileWithTabs = async (file) => {
    const data = await file.arrayBuffer();
    const bytes = new Uint8Array(data);
    const lower = file.name.toLowerCase();
    const type = lower.endsWith('.pdf') ? 'pdf'
      : (lower.endsWith('.djvu') || lower.endsWith('.djv')) ? 'djvu'
      : lower.endsWith('.epub') ? 'epub'
      : /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower) ? 'image'
      : 'unknown';
    tabManager.open(file.name, type, bytes);
  };

  // Override fileInput handler: remove original, add tab-aware one
  if (els.fileInput._nrChangeHandler) {
    els.fileInput.removeEventListener('change', els.fileInput._nrChangeHandler);
  }
  els.fileInput._nrChangeHandler = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await openFileWithTabs(file);
    e.target.value = '';
  };
  safeOn(els.fileInput, 'change', els.fileInput._nrChangeHandler);

  // Tab bar new tab button
  document.getElementById('tabBarNewTab')?.addEventListener('click', () => {
    els.fileInput?.click();
  });

  // Persist tab metadata to sessionStorage for session recovery
  function saveTabsToSession() {
    try {
      const tabs = tabManager.getAllTabs().map(t => ({
        name: t.name, type: t.type, activeTabId: tabManager.activeTabId === t.id,
        state: t.state, modified: t.modified,
        bytes: t.bytes && t.bytes.length < 5 * 1024 * 1024 ? Array.from(t.bytes) : null,
      }));
      window.sessionStorage.setItem('novareader-tabs', JSON.stringify(tabs));
    } catch (e) { /* quota exceeded or unavailable */ void e; }
  }

  // Auto-save tabs on visibility change / before unload
  window.addEventListener('visibilitychange', () => { if (document.hidden) saveTabsToSession(); });
  window.addEventListener('beforeunload', saveTabsToSession);

  // Restore tabs from session on startup
  try {
    const savedTabs = JSON.parse(window.sessionStorage.getItem('novareader-tabs') || '[]');
    for (const t of savedTabs) {
      if (t.bytes && t.name) {
        const bytes = new Uint8Array(t.bytes);
        tabManager.open(t.name, t.type || 'pdf', bytes, t.state || {});
      }
    }
  } catch (e) { /* invalid or no session data */ void e; }

  window._tabManagerInstance = tabManager;

  return { tabManager, openFileWithTabs };
}
