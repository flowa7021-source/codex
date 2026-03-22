// ─── Event Bindings (extracted from app.js) ──────────────────────────────────
// Pure safeOn wiring with no complex inline logic.
// Complex handlers (importDocx, conversion plugins, fileInput) remain in app.js.

/**
 * @param {object} deps — all functions/objects needed by the bindings
 */
export function initEventBindings(deps) {
  const {
    els,
    safeOn,
    debounce,

    // Settings modal
    openSettingsModal,
    closeSettingsModal,
    saveSettingsFromModal,
    resetUiSizeToDefaults,
    previewUiSizeFromModal,

    // Diagnostics
    exportDiagnostics,
    clearDiagnostics,
    runRuntimeSelfCheck,

    // Navigation / history
    navigateHistoryBack,
    navigateHistoryForward,

    // Hotkeys
    saveHotkeys,
    resetHotkeys,
    autoFixHotkeys,
    applyCommonHotkeys,
    setSettingsStatus,

    // Sidebar
    setSidebarCompactMode,
    setSidebarSectionsCollapsed,

    // Layout toggles
    toggleAdvancedPanelsState,
    toggleLayoutState,
    updateSearchToolbarRows,

    // Workspace
    exportWorkspaceBundleJson,
    importWorkspaceBundleJson,
    importOcrJson,
    saveCloudSyncUrl,
    pushWorkspaceToCloud,
    pullWorkspaceFromCloud,
    setStage4Status,
    toggleCollaborationChannel,
    broadcastWorkspaceSnapshot,

    // Reading progress
    resetReadingProgress,
    resetReadingTime,
    clearVisitTrail,
    saveReadingGoal,
    clearReadingGoal,

    // Search history / results
    clearSearchHistory,
    exportSearchHistoryJson,
    exportSearchHistoryTxt,
    copySearchHistory,
    importSearchHistoryJson,
    clearSearchResults,
    exportSearchResultsJson,
    exportSearchResultsCsv,
    exportSearchResultsSummaryTxt,
    importSearchResultsJson,
    importSearchResultsCsv,
    copySearchResultsSummary,

    // Theme
    toggleTheme,

    // File / text actions
    downloadCurrentFile,
    printCanvasPage,
    refreshPageText,
    copyPageText,
    exportPageText,
    exportCurrentDocToWord,
    downloadOcrTextExport,

    // Search
    searchInPdf,
    jumpToSearchResult,
    saveSearchScope,
    state,

    // Merge / split
    mergePdfFiles,
    splitPdfPages,

    // DjVu
    importDjvuDataJson,

    // Annotations / misc
    showShortcutsHelp,
    clearRecent,
  } = deps;

  // ─── Settings Modal ───────────────────────────────────────────────────────
  safeOn(els.clearRecent, 'click', clearRecent);
  safeOn(els.toggleAdvancedPanels, 'click', toggleAdvancedPanelsState);
  safeOn(els.openSettingsModal, 'click', openSettingsModal);
  safeOn(els.closeSettingsModal, 'click', closeSettingsModal);
  safeOn(els.saveSettingsModal, 'click', saveSettingsFromModal);
  safeOn(els.resetUiSizeDefaults, 'click', resetUiSizeToDefaults);
  safeOn(els.exportDiagnostics, 'click', exportDiagnostics);
  safeOn(els.clearDiagnostics, 'click', clearDiagnostics);
  safeOn(els.runRuntimeSelfCheck, 'click', () => { runRuntimeSelfCheck(); });

  // ─── UI Size Sliders ──────────────────────────────────────────────────────
  safeOn(els.cfgSidebarWidth, 'input', previewUiSizeFromModal);
  safeOn(els.cfgToolbarScale, 'input', previewUiSizeFromModal);
  safeOn(els.cfgTextMinHeight, 'input', previewUiSizeFromModal);
  safeOn(els.cfgPageAreaHeight, 'input', previewUiSizeFromModal);
  safeOn(els.cfgTopToolbarHeight, 'input', previewUiSizeFromModal);
  safeOn(els.cfgBottomToolbarHeight, 'input', previewUiSizeFromModal);
  safeOn(els.cfgTextPanelHeight, 'input', previewUiSizeFromModal);
  safeOn(els.cfgAnnotationCanvasScale, 'input', previewUiSizeFromModal);
  safeOn(els.settingsModal, 'click', (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });

  // ─── History Navigation ───────────────────────────────────────────────────
  safeOn(els.historyBack, 'click', navigateHistoryBack);
  safeOn(els.historyForward, 'click', navigateHistoryForward);

  // ─── Hotkeys ──────────────────────────────────────────────────────────────
  safeOn(els.saveHotkeys, 'click', saveHotkeys);
  safeOn(els.resetHotkeys, 'click', resetHotkeys);
  safeOn(els.autoFixHotkeys, 'click', autoFixHotkeys);
  safeOn(els.applyCommonHotkeys, 'click', () => {
    applyCommonHotkeys();
    setSettingsStatus('Применены стандартные hotkeys.');
  });

  // ─── Sidebar Compact / Sections ───────────────────────────────────────────
  safeOn(els.toggleSidebarCompact, 'click', () => {
    const enabled = !document.body.classList.contains('sidebar-compact');
    setSidebarCompactMode(enabled);
    setSettingsStatus(enabled ? 'Включён компактный режим панели.' : 'Компактный режим отключён.');
  });
  safeOn(els.collapseSidebarSections, 'click', () => {
    setSidebarSectionsCollapsed(true);
    setSettingsStatus('Разделы панели свернуты.');
  });
  safeOn(els.expandSidebarSections, 'click', () => {
    setSidebarSectionsCollapsed(false);
    setSettingsStatus('Разделы панели развернуты.');
  });

  // ─── Workspace ────────────────────────────────────────────────────────────
  safeOn(els.exportWorkspace, 'click', exportWorkspaceBundleJson);
  safeOn(els.importWorkspace, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importWorkspaceBundleJson(file);
    e.target.value = '';
  });
  safeOn(els.importOcrJson, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importOcrJson(file);
    e.target.value = '';
  });
  safeOn(els.saveCloudSyncUrl, 'click', saveCloudSyncUrl);
  safeOn(els.pushCloudSync, 'click', async () => {
    try {
      await pushWorkspaceToCloud();
    } catch (err) {
      console.warn('[ocr] error:', err?.message);
      setStage4Status('Ошибка cloud push.', 'error');
    }
  });
  safeOn(els.pullCloudSync, 'click', async () => {
    try {
      await pullWorkspaceFromCloud();
    } catch (err) {
      console.warn('[app] error:', err?.message);
      setStage4Status('Ошибка cloud pull.', 'error');
    }
  });
  safeOn(els.toggleCollab, 'click', toggleCollaborationChannel);
  safeOn(els.broadcastCollab, 'click', () => broadcastWorkspaceSnapshot('manual'));

  // ─── Reading Progress ─────────────────────────────────────────────────────
  safeOn(els.resetProgress, 'click', async () => {
    await resetReadingProgress();
  });
  safeOn(els.resetReadingTime, 'click', async () => {
    await resetReadingTime();
  });
  safeOn(els.clearVisitTrail, 'click', clearVisitTrail);
  safeOn(els.saveReadingGoal, 'click', saveReadingGoal);
  safeOn(els.clearReadingGoal, 'click', clearReadingGoal);

  // ─── Search History & Results ─────────────────────────────────────────────
  safeOn(els.clearSearchHistory, 'click', clearSearchHistory);
  safeOn(els.exportSearchHistory, 'click', exportSearchHistoryJson);
  safeOn(els.exportSearchHistoryTxt, 'click', exportSearchHistoryTxt);
  safeOn(els.copySearchHistory, 'click', async () => {
    await copySearchHistory();
  });
  safeOn(els.importSearchHistoryJson, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importSearchHistoryJson(file);
    e.target.value = '';
  });
  safeOn(els.clearSearchResults, 'click', clearSearchResults);
  safeOn(els.exportSearchResults, 'click', exportSearchResultsJson);
  safeOn(els.exportSearchResultsCsv, 'click', exportSearchResultsCsv);
  safeOn(els.exportSearchSummaryTxt, 'click', exportSearchResultsSummaryTxt);
  safeOn(els.importSearchResultsJson, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importSearchResultsJson(file);
    e.target.value = '';
  });
  safeOn(els.importSearchResultsCsv, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importSearchResultsCsv(file);
    e.target.value = '';
  });
  safeOn(els.copySearchResults, 'click', async () => {
    await copySearchResultsSummary();
  });

  // ─── Theme ────────────────────────────────────────────────────────────────
  safeOn(els.themeToggle, 'click', toggleTheme);

  // ─── File / Text Actions ──────────────────────────────────────────────────
  safeOn(els.downloadFile, 'click', downloadCurrentFile);
  safeOn(els.printPage, 'click', printCanvasPage);
  safeOn(els.importDjvuDataQuick, 'click', () => els.importDjvuDataJson?.click());
  safeOn(els.refreshText, 'click', refreshPageText);
  safeOn(els.copyText, 'click', copyPageText);
  safeOn(els.exportText, 'click', exportPageText);
  safeOn(els.exportWord, 'click', exportCurrentDocToWord);
  safeOn(els.exportOcrIndex, 'click', downloadOcrTextExport);

  // ─── DjVu Data Import ────────────────────────────────────────────────────
  safeOn(els.importDjvuDataJson, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importDjvuDataJson(file);
    e.target.value = '';
  });

  // ─── Search ───────────────────────────────────────────────────────────────
  safeOn(els.searchBtn, 'click', async () => {
    await searchInPdf(els.searchInput?.value);
  });
  safeOn(els.searchInput, 'keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await searchInPdf(els.searchInput?.value);
    }
  });
  safeOn(els.searchScope, 'change', () => {
    saveSearchScope();
  });
  safeOn(els.searchPrev, 'click', async () => {
    await jumpToSearchResult(state.searchCursor - 1);
  });
  safeOn(els.searchNext, 'click', async () => {
    await jumpToSearchResult(state.searchCursor + 1);
  });
  const debouncedUpdateSearchToolbarRows = debounce(updateSearchToolbarRows, 150);
  window.addEventListener('resize', debouncedUpdateSearchToolbarRows);
  safeOn(els.searchInput, 'input', debouncedUpdateSearchToolbarRows);
  safeOn(els.searchScope, 'change', debouncedUpdateSearchToolbarRows);

  // ─── Shortcuts & Layout Toggles ───────────────────────────────────────────
  safeOn(els.shortcutsHelp, 'click', showShortcutsHelp);
  safeOn(els.toggleSidebar, 'click', () => toggleLayoutState('sidebarHidden'));
  safeOn(els.toggleToolsBar, 'click', () => toggleLayoutState('toolsHidden'));
  safeOn(els.toggleTextTools, 'click', () => toggleLayoutState('textHidden'));
  safeOn(els.toggleSearchTools, 'click', () => toggleLayoutState('searchToolsHidden'));
  safeOn(els.toggleAnnotTools, 'click', () => toggleLayoutState('annotToolsHidden'));
  safeOn(els.toggleTextToolsInline, 'click', () => toggleLayoutState('textHidden'));

  // ─── Merge / Split ────────────────────────────────────────────────────────
  safeOn(els.mergePages, 'click', () => mergePdfFiles());
  safeOn(els.splitPages, 'click', () => splitPdfPages());
}
