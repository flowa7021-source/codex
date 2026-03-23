import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initEventBindings } from '../../app/modules/init-event-bindings.js';

function makeDeps(overrides = {}) {
  const noop = mock.fn();
  const els = {};
  // Create mock elements for all known els properties
  const elNames = [
    'clearRecent', 'toggleAdvancedPanels', 'openSettingsModal', 'closeSettingsModal',
    'saveSettingsModal', 'resetUiSizeDefaults', 'exportDiagnostics', 'clearDiagnostics',
    'runRuntimeSelfCheck', 'cfgSidebarWidth', 'cfgToolbarScale', 'cfgTextMinHeight',
    'cfgPageAreaHeight', 'cfgTopToolbarHeight', 'cfgBottomToolbarHeight', 'cfgTextPanelHeight',
    'cfgAnnotationCanvasScale', 'settingsModal', 'historyBack', 'historyForward',
    'saveHotkeys', 'resetHotkeys', 'autoFixHotkeys', 'applyCommonHotkeys',
    'toggleSidebarCompact', 'collapseSidebarSections', 'expandSidebarSections',
    'exportWorkspace', 'importWorkspace', 'importOcrJson', 'saveCloudSyncUrl',
    'pushCloudSync', 'pullCloudSync', 'toggleCollab', 'broadcastCollab',
    'resetProgress', 'resetReadingTime', 'clearVisitTrail', 'saveReadingGoal',
    'clearReadingGoal', 'clearSearchHistory', 'exportSearchHistory',
    'exportSearchHistoryTxt', 'copySearchHistory', 'importSearchHistoryJson',
    'clearSearchResults', 'exportSearchResults', 'exportSearchResultsCsv',
    'exportSearchSummaryTxt', 'importSearchResultsJson', 'importSearchResultsCsv',
    'copySearchResults', 'themeToggle', 'downloadFile', 'printPage',
    'importDjvuDataQuick', 'importDjvuDataJson', 'refreshText', 'copyText',
    'exportText', 'exportWord', 'exportOcrIndex', 'searchBtn', 'searchInput',
    'searchScope', 'searchPrev', 'searchNext', 'shortcutsHelp',
    'toggleSidebar', 'toggleToolsBar', 'toggleTextTools', 'toggleSearchTools',
    'toggleAnnotTools', 'toggleTextToolsInline', 'mergePages', 'splitPages',
  ];
  for (const name of elNames) {
    els[name] = document.createElement('div');
  }
  return {
    els,
    safeOn: mock.fn(),
    debounce: (fn) => fn,
    openSettingsModal: noop, closeSettingsModal: noop, saveSettingsFromModal: noop,
    resetUiSizeToDefaults: noop, previewUiSizeFromModal: noop,
    exportDiagnostics: noop, clearDiagnostics: noop, runRuntimeSelfCheck: noop,
    navigateHistoryBack: noop, navigateHistoryForward: noop,
    saveHotkeys: noop, resetHotkeys: noop, autoFixHotkeys: noop,
    applyCommonHotkeys: noop, setSettingsStatus: noop,
    setSidebarCompactMode: noop, setSidebarSectionsCollapsed: noop,
    toggleAdvancedPanelsState: noop, toggleLayoutState: noop, updateSearchToolbarRows: noop,
    exportWorkspaceBundleJson: noop, importWorkspaceBundleJson: noop,
    importOcrJson: noop, saveCloudSyncUrl: noop,
    pushWorkspaceToCloud: noop, pullWorkspaceFromCloud: noop,
    setStage4Status: noop, toggleCollaborationChannel: noop, broadcastWorkspaceSnapshot: noop,
    resetReadingProgress: noop, resetReadingTime: noop,
    clearVisitTrail: noop, saveReadingGoal: noop, clearReadingGoal: noop,
    clearSearchHistory: noop, exportSearchHistoryJson: noop,
    exportSearchHistoryTxt: noop, copySearchHistory: noop,
    importSearchHistoryJson: noop, clearSearchResults: noop,
    exportSearchResultsJson: noop, exportSearchResultsCsv: noop,
    exportSearchResultsSummaryTxt: noop, importSearchResultsJson: noop,
    importSearchResultsCsv: noop, copySearchResultsSummary: noop,
    toggleTheme: noop, downloadCurrentFile: noop, printCanvasPage: noop,
    refreshPageText: noop, copyPageText: noop, exportPageText: noop,
    exportCurrentDocToWord: noop, downloadOcrTextExport: noop,
    searchInPdf: noop, jumpToSearchResult: noop, saveSearchScope: noop,
    state: { searchCursor: 0 },
    mergePdfFiles: noop, splitPdfPages: noop,
    importDjvuDataJson: noop, showShortcutsHelp: noop, clearRecent: noop,
    ...overrides,
  };
}

describe('initEventBindings', () => {
  it('exports a function', () => {
    assert.equal(typeof initEventBindings, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initEventBindings(makeDeps()));
  });

  it('registers many safeOn bindings', () => {
    const deps = makeDeps();
    initEventBindings(deps);
    // There are dozens of safeOn calls in this module
    assert.ok(deps.safeOn.mock.callCount() >= 40, `expected >=40 bindings, got ${deps.safeOn.mock.callCount()}`);
  });

  it('binds theme toggle click', () => {
    const deps = makeDeps();
    initEventBindings(deps);
    const themeBind = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.themeToggle && c.arguments[1] === 'click'
    );
    assert.ok(themeBind, 'should bind click on themeToggle');
  });

  it('binds search input keydown', () => {
    const deps = makeDeps();
    initEventBindings(deps);
    const keydownBind = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.searchInput && c.arguments[1] === 'keydown'
    );
    assert.ok(keydownBind, 'should bind keydown on searchInput');
  });
});
