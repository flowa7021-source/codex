// ─── Platform Detection (must be first) ─────────────────────────────────────
import { initPlatform } from './modules/platform.js';
initPlatform().catch(() => {});   // non-blocking; fallback to browser mode

// ─── Module Imports ─────────────────────────────────────────────────────────
import { debounce } from './modules/utils.js';
import { state, defaultHotkeys, hotkeys, setHotkeys, els } from './modules/state.js';
import { ensurePdfJs, preloadPdfRuntime } from './modules/loaders.js';
import { getCachedPage, clearPageRenderCache, revokeAllTrackedUrls, pageRenderCache, objectUrlRegistry } from './modules/perf.js';
import { toolStateMachine, initToolModeDeps } from './modules/tool-modes.js';
import { pushDiagnosticEvent, clearDiagnostics, exportDiagnostics, runRuntimeSelfCheck, setupRuntimeDiagnostics, initDiagnosticsDeps, novaLog, exportLogsAsJson, clearActivityLog, getLogEntries } from './modules/diagnostics.js';
import { setLanguage, getLanguage, loadLanguage, applyI18nToDOM } from './modules/i18n.js';
import { blockEditor } from './modules/pdf-advanced-edit.js';
import { formManager } from './modules/pdf-forms.js';
import { exportAnnotationsAsSvg, exportAnnotationsAsPdf } from './modules/annotation-export.js';
import { applyPlugin } from './modules/conversion-plugins.js';
import { parseDocxAdvanced, formattedBlocksToHtml, mergeDocxIntoWorkspace } from './modules/docx-import-advanced.js';
import { getPageQualitySummary, markLowConfidenceWords } from './modules/ocr-word-confidence.js';
import { deleteOcrData, listOcrDocuments, getOcrStorageSize } from './modules/ocr-storage.js';
import { recognizeWithBoxes, terminateTesseract } from './modules/tesseract-adapter.js';
import { convertPdfToDocx } from './modules/docx-converter.js';
import { mergePdfDocuments, splitPdfDocument, fillPdfForm, addWatermarkToPdf, addStampToPdf, exportAnnotationsIntoPdf, rotatePdfPages, parsePageRange as parsePageRangeLib } from './modules/pdf-operations.js';
import { pdfCompare } from './modules/pdf-compare.js';
import { pdfOptimizer } from './modules/pdf-optimize.js';
import { addHeaderFooter, addBatesNumbering, flattenPdf, checkAccessibility, autoFixAccessibility } from './modules/pdf-pro-tools.js';
import { batchOcr, createSearchablePdf, detectScannedDocument, autoDetectLanguage } from './modules/ocr-batch.js';

// ─── Phase 2+ Module Imports ───────────────────────────────────────────────
import { toast, toastSuccess, toastError, toastWarning, toastInfo, toastProgress, dismissAllToasts } from './modules/toast.js';
import { initTooltips } from './modules/tooltip.js';
import { initContextMenu } from './modules/context-menu.js';
import { initA11y } from './modules/a11y.js';
import { bindUndoRedoKeys } from './modules/undo-redo.js';
import { VIEW_MODES, initViewModes, setViewMode, getCurrentMode } from './modules/view-modes.js';
import { convertToHtml, downloadHtml } from './modules/html-converter.js';
import { applyTextEdits, addTextBlock, findAndReplace, spellCheck, getAvailableFonts } from './modules/pdf-text-edit.js';
import { setPassword, cleanMetadata, getSecurityInfo, sanitizePdf } from './modules/pdf-security.js';
import { correctOcrText, buildDictionary, recoverParagraphs, computeQualityScore } from './modules/ocr-post-correct.js';
import { extractTextInReadingOrder, extractMultiPageText, downloadText } from './modules/text-extractor.js';
import { WorkerPool, initOcrPool, getOcrPool, runInWorker } from './modules/worker-pool.js';
import { showErrorFallback, showCriticalErrorScreen } from './modules/error-boundary-ui.js';
import { openDatabase, cachePageRender, getCachedPageRender, clearDocumentCache, getStorageUsage, clearAllCache } from './modules/indexed-storage.js';
import { reportError, saveStateSnapshot, restoreStateSnapshot, withRetry, getErrorLog } from './modules/error-handler.js';
import { convertToPdfA, checkPdfACompliance } from './modules/pdf-a-converter.js';
import { VirtualScroll } from './modules/virtual-scroll.js';
import { acquireCanvas, releaseCanvas, getMemoryStats, forceCleanup } from './modules/memory-manager.js';
import { buildTextLayer, highlightSearchMatches, clearSearchHighlights, getSelectedText } from './modules/text-layer-builder.js';
import { analyzeLayout, detectTable, sortByReadingOrder, tableToHtml } from './modules/layout-analysis.js';
import { BatchOcrEngine } from './modules/batch-ocr-enhanced.js';
import { initRibbonToolbar, switchTab, setContextualTab } from './modules/ribbon-toolbar.js';
import { TabManager } from './modules/tab-manager.js';
import { parsePageRange as parsePrintRange, getPagesToPrint, arrangeBooklet, arrangeNup, triggerPrint } from './modules/pdf-print.js';
import { createPdfFromImages, createBlankPdf, canvasesToPdf } from './modules/pdf-create.js';
import { initQuickActions, hideQuickActions } from './modules/quick-actions.js';
import { initHotkeys, onHotkey, registerHotkeyHandlers, isSpaceHeld, getBindings, getCheatsheet } from './modules/hotkeys.js';
import { CbzAdapter } from './modules/cbz-adapter.js';
import { initAutosave, triggerAutosave, markCleanExit, checkForRecovery, clearRecoveryData, startAutosaveTimer, stopAutosaveTimer, applyRecoveredSnapshot } from './modules/autosave.js';
import { initAutoScroll, startAutoScroll, stopAutoScroll, toggleAutoScroll, setAutoScrollSpeed, isAutoScrolling } from './modules/auto-scroll.js';

// ─── Wave 8: Decomposition Facade Modules ────────────────────────────────
import * as AppPersistence from './modules/app-persistence.js';
import { OcrSearchIndex } from './modules/ocr-search.js';
import { renderPage as pipelineRenderPage, schedulePreRender, invalidateCache, getCacheStats } from './modules/render-pipeline.js';
import { AnnotationController } from './modules/annotations-core.js';

// ─── Wave 10: Page Organizer, Floating Search, XPS Support ───────────────
import { getPageInfoList, reorderPages, deletePages, rotatePages, extractPages, insertPages, insertBlankPage, duplicatePages, reversePages, createOrganizerState, togglePageSelection, selectPageRange, computeReorderFromDrag } from './modules/page-organizer.js';
import { initFloatingSearch } from './modules/floating-search.js';
import { XpsAdapter } from './modules/xps-adapter.js';
import { registerProvider, getProviders, authenticate, listFiles, saveFile, getShareLink, signOut, getConnectionStatus, onStatusChange, createGoogleDriveProvider, createOneDriveProvider, createDropboxProvider } from './modules/cloud-integration.js';
import { summarizeText, extractTags, semanticSearch, generateToc } from './modules/ai-features.js';
import { nrPrompt, nrConfirm } from './modules/modal-prompt.js';
import * as SettingsController from './modules/settings-controller.js';
import { initAnnotationControllerDeps, invalidateAnnotationCaches, getCurrentAnnotationCtx, loadStrokes, saveStrokes, loadComments, saveComments, clearDocumentCommentStorage, renderCommentList, clearDocumentAnnotationStorage, updateOverlayInteractionState, setDrawMode, denormalizePoint, renderAnnotations, _applyTextMarkupFromSelection, getCanvasPointFromEvent, beginStroke, moveStroke, endStroke, undoStroke, clearStrokes, clearComments, exportAnnotatedPng, exportAnnotationsJson, importAnnotationsJson, showShortcutsHelp, exportAnnotationBundleJson, importAnnotationBundleJson } from './modules/annotation-controller.js';
import { initRenderControllerDeps, _ocrWordCache, renderCurrentPage, safeCreateObjectURL, renderTextLayer, handleImageInsertion, addWatermarkToPage, addStampToPage, openSignaturePad } from './modules/render-controller.js';
import { crashTelemetry, recordCrashEvent, recordSuccessfulOperation, getSessionHealth, initCrashTelemetry } from './modules/crash-telemetry.js';
import { pdfEditState, initExportControllerDeps, setPageEdits, undoPageEdit, redoPageEdit, getEditHistory, persistEdits, loadPersistedEdits, generateDocxBlob, generateDocxWithImages, importDocxEdits, exportSessionHealthReport, capturePageAsImageData } from './modules/export-controller.js';
import { ocrSearchIndex, searchOcrIndex, downloadOcrTextExport, canSearchCurrentDoc, loadSearchScope, saveSearchScope, copySearchResultsSummary, exportSearchResultsSummaryTxt, exportSearchResultsCsv, exportSearchResultsJson, importSearchResultsJson, importSearchResultsCsv, clearSearchResults, renderSearchResultsList, renderSearchHistory, exportSearchHistoryJson, exportSearchHistoryTxt, copySearchHistory, importSearchHistoryJson, clearSearchHistory, searchInPdf, jumpToSearchResult, initSearchControllerDeps } from './modules/search-controller.js';
import { initOcrControllerDeps, getBatchOcrProgress, clearOcrRuntimeCaches, estimatePageSkewAngle, setOcrStatus, setOcrRegionMode, drawOcrSelectionPreview, runOcrOnRect, runOcrForCurrentPage, extractTextForPage, cancelAllOcrWork, scheduleBackgroundOcrScan } from './modules/ocr-controller.js';
import { initWorkspaceDeps, setWorkspaceStatus, setStage4Status, initReleaseGuards, loadCloudSyncUrl, saveCloudSyncUrl, loadOcrTextData, saveOcrTextData, pushWorkspaceToCloud, pullWorkspaceFromCloud, broadcastWorkspaceSnapshot, toggleCollaborationChannel, importOcrJson, exportWorkspaceBundleJson, importWorkspaceBundleJson } from './modules/workspace-controller.js';
import { initReadingProgressDeps, noteKey, bookmarkKey, loadReadingGoal, saveReadingGoal, clearReadingGoal, renderReadingGoalStatus, renderEtaStatus, renderDocStats, renderVisitTrail, trackVisitedPage, clearVisitTrail, updateHistoryButtons, resetHistory, capturePageHistoryOnRender, navigateHistoryBack, navigateHistoryForward, loadReadingTime, updateReadingTimeStatus, stopReadingTimer, startReadingTimer, syncReadingTimerWithVisibility, resetReadingTime, _saveViewStateNow, saveViewState, renderReadingProgress, restoreViewStateIfPresent, resetReadingProgress, saveRecent, clearRecent, renderRecent } from './modules/reading-progress-controller.js';
import { initFileControllerDeps, revokeCurrentObjectUrl, saveDjvuData, openFile, reloadPdfFromBytes } from './modules/file-controller.js';
import { initPdfOpsDeps, mergePdfFiles, splitPdfPages } from './modules/pdf-ops-controller.js';
import { PDFAdapter, ImageAdapter, DjVuAdapter, DjVuNativeAdapter, UnsupportedAdapter } from './modules/adapters.js';
import { initSettingsUiDeps, applyAppLanguage, applySectionVisibilitySettings, openSettingsModal, closeSettingsModal, previewUiSizeFromModal, saveSettingsFromModal, resetUiSizeToDefaults } from './modules/settings-ui.js';
import { initOutlineControllerDeps, renderDocInfo, renderOutline, renderPagePreviews } from './modules/outline-controller.js';
import { initTextNavDeps, ensureTextToolsVisible, refreshPageText, copyPageText, exportPageText, setTextEditMode, saveCurrentPageTextEdits, exportCurrentDocToWord, goToPage, fitWidth, fitPage, downloadCurrentFile, printCanvasPage } from './modules/text-nav-controller.js';
import { initLayoutControllerDeps, uiLayoutKey, applyAdvancedPanelsState, toggleAdvancedPanelsState, applyLayoutState, updateSearchToolbarRows, toggleLayoutState, setupResizableLayout, applyLayoutWithTransition, setupDragAndDrop, setupAnnotationEvents } from './modules/layout-controller.js';
import { initPdfProHandlersDeps, initPdfProHandlers } from './modules/pdf-pro-handlers.js';
import { initBookmarkController, updateBookmarkButton } from './modules/bookmark-controller.js';
import { initNotesController } from './modules/notes-controller.js';
import { highlightCurrentPage as highlightThumbPage } from './modules/thumbnail-renderer.js';
import { convertCurrentToPdf } from './modules/convert-to-pdf.js';
import { initUiBlocks } from './modules/ui-init-blocks.js';
import { initPhase2Modules } from './modules/app-init-phase2.js';
import { bootstrapAdvancedTools } from './modules/integration-wiring.js';
import { initPageOrganizerUI } from './modules/page-organizer-ui.js';
import { initMinimap, updateMinimap, showMinimap, hideMinimap, toggleMinimap } from './modules/minimap.js';
import { initCommandPalette, showCommandPalette, hideCommandPalette, registerCommand } from './modules/command-palette.js';
import { initErrorHandling } from './modules/init-error-handling.js';
import { initNavigation } from './modules/init-navigation.js';
import { initOcr } from './modules/init-ocr.js';
import { initAnnotations } from './modules/init-annotations.js';
import { initPdfTools } from './modules/init-pdf-tools.js';
import { initKeyboard } from './modules/init-keyboard.js';
import { initTabs } from './modules/init-tabs.js';
import { initAdvanced } from './modules/init-advanced.js';

// ─── Phase 0: Error Handling (delegated to init-error-handling.js) ───────────
const { withErrorBoundary } = initErrorHandling({
  pushDiagnosticEvent, recordCrashEvent, initCrashTelemetry,
  showErrorFallback, showCriticalErrorScreen, toastError, els, state,
});

// Pre-warm PDF.js worker during idle time so first PDF open is faster
preloadPdfRuntime();

// ─── Settings proxy wrappers (delegate to SettingsController) ────────────────
function defaultSettings() { return SettingsController.defaultSettings(); }
function loadAppSettings() { SettingsController.loadAppSettings(); }
function saveAppSettings() { SettingsController.saveAppSettings(); }
function applyUiSizeSettings() { SettingsController.applyUiSizeSettings(uiLayoutKey); }
function getOcrLang() { return SettingsController.getOcrLang(); }

async function importDjvuDataJson(file) {
  if (!state.adapter || state.adapter.type !== 'djvu') {
    els.searchStatus.textContent = 'Импорт DjVu data доступен только для DjVu';
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
    els.searchStatus.textContent = 'DjVu data JSON импортирован';
  } catch (err) {
    console.warn('[app] error:', err?.message);
    els.searchStatus.textContent = 'Ошибка импорта DjVu data JSON';
  }
}

// ─── Theme ───────────────────────────────────────────────────────────────────
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


function setBookmarksStatus(message, type = '') { SettingsController.setBookmarksStatus(message, type); }
function _exportBookmarksJson() { SettingsController.exportBookmarksJson(bookmarkKey, loadBookmarks); }
async function _importBookmarksJson(file) { await SettingsController.importBookmarksJson(file, saveBookmarks, renderBookmarks); }
function loadBookmarks() { return SettingsController.loadBookmarks(bookmarkKey); }
function saveBookmarks(next) { SettingsController.saveBookmarks(next, bookmarkKey, renderDocStats, renderEtaStatus); }
function renderBookmarks() { SettingsController.renderBookmarks(bookmarkKey, saveBookmarks, renderCurrentPage); }
async function addBookmark() { await SettingsController.addBookmark(bookmarkKey, saveBookmarks, renderBookmarks); }
function _clearBookmarks() { SettingsController.clearBookmarks(saveBookmarks, renderBookmarks); }

// ─── Event Listener Cleanup Registry ─────────────────────────────────────────
/** @type {Array<{el: EventTarget, type: string, handler: Function}>} */
const _listenerRegistry = [];

/**
 * Safely attach an event listener with null-check and registry tracking.
 * @param {EventTarget|null|undefined} el
 * @param {string} type
 * @param {Function} handler
 * @param {AddEventListenerOptions} [opts]
 */
function safeOn(el, type, handler, opts) {
  if (!el) return;
  el.addEventListener(type, handler, opts);
  _listenerRegistry.push({ el, type, handler });
}

/** Remove all tracked event listeners (call on cleanup/destroy). */
function cleanupAllListeners() {
  for (const { el, type, handler } of _listenerRegistry) {
    try { el.removeEventListener(type, handler); } catch (err) { console.warn('[app] error:', err?.message); }
  }
  _listenerRegistry.length = 0;
}

// Expose for diagnostics
window._listenerRegistry = _listenerRegistry;
window._cleanupAllListeners = cleanupAllListeners;

// ─── Event Bindings ──────────────────────────────────────────────────────────
safeOn(els.clearRecent, 'click', clearRecent);
safeOn(els.toggleAdvancedPanels, 'click', toggleAdvancedPanelsState);
safeOn(els.openSettingsModal, 'click', openSettingsModal);
safeOn(els.closeSettingsModal, 'click', closeSettingsModal);
safeOn(els.saveSettingsModal, 'click', saveSettingsFromModal);
safeOn(els.resetUiSizeDefaults, 'click', resetUiSizeToDefaults);
safeOn(els.exportDiagnostics, 'click', exportDiagnostics);
safeOn(els.clearDiagnostics, 'click', clearDiagnostics);
safeOn(els.runRuntimeSelfCheck, 'click', () => { runRuntimeSelfCheck(); });
safeOn(els.cfgSidebarWidth, 'input', previewUiSizeFromModal);
safeOn(els.cfgToolbarScale, 'input', previewUiSizeFromModal);
safeOn(els.cfgTextMinHeight, 'input', previewUiSizeFromModal);
safeOn(els.cfgPageAreaHeight, 'input', previewUiSizeFromModal);
safeOn(els.cfgTopToolbarHeight, 'input', previewUiSizeFromModal);
safeOn(els.cfgBottomToolbarHeight, 'input', previewUiSizeFromModal);
safeOn(els.cfgTextPanelHeight, 'input', previewUiSizeFromModal);
safeOn(els.cfgAnnotationCanvasScale, 'input', previewUiSizeFromModal);
safeOn(els.settingsModal, 'click', (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });

// File input handler — will be overridden by tab manager integration below
const _fileInputChangeHandler = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await openFile(file);
  e.target.value = '';
};
if (els.fileInput) {
  els.fileInput._nrChangeHandler = _fileInputChangeHandler;
  safeOn(els.fileInput, 'change', _fileInputChangeHandler);
}

safeOn(els.historyBack, 'click', navigateHistoryBack);
safeOn(els.historyForward, 'click', navigateHistoryForward);

// ─── Navigation & Zoom (delegated to init-navigation.js) ─────────────────────
initNavigation({
  state, els, debounce, safeOn,
  renderCurrentPage, renderPagePreviews, goToPage, fitWidth, fitPage,
  clearOcrRuntimeCaches, scheduleBackgroundOcrScan,
});

// Notes event bindings moved to notes-controller.js (initNotesController)
safeOn(els.saveHotkeys, 'click', saveHotkeys);
safeOn(els.resetHotkeys, 'click', resetHotkeys);
safeOn(els.autoFixHotkeys, 'click', autoFixHotkeys);
safeOn(els.applyCommonHotkeys, 'click', () => {
  applyCommonHotkeys();
  setSettingsStatus('Применены стандартные hotkeys.');
});
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
safeOn(els.resetProgress, 'click', async () => {
  await resetReadingProgress();
});
safeOn(els.resetReadingTime, 'click', async () => {
  await resetReadingTime();
});
safeOn(els.clearVisitTrail, 'click', clearVisitTrail);
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
safeOn(els.saveReadingGoal, 'click', saveReadingGoal);
safeOn(els.clearReadingGoal, 'click', clearReadingGoal);
safeOn(els.themeToggle, 'click', toggleTheme);
// Bookmark event bindings moved to bookmark-controller.js (initBookmarkController)
safeOn(els.downloadFile, 'click', downloadCurrentFile);
safeOn(els.printPage, 'click', printCanvasPage);
safeOn(els.importDjvuDataQuick, 'click', () => els.importDjvuDataJson?.click());
safeOn(els.refreshText, 'click', refreshPageText);
safeOn(els.copyText, 'click', copyPageText);
safeOn(els.exportText, 'click', exportPageText);
safeOn(els.exportWord, 'click', exportCurrentDocToWord);
safeOn(els.importDocx, 'change', async (e) => {
  const file = e.target?.files?.[0];
  if (!file) { e.target.value = ''; return; }
  try {
    const data = await file.arrayBuffer();
    const parsed = parseDocxAdvanced(data);
    if (parsed && parsed.blocks && parsed.blocks.length > 0) {
      const html = formattedBlocksToHtml(parsed.blocks);
      const merged = mergeDocxIntoWorkspace(parsed, [], state.pageCount || 1);
      const plainText = merged.text || parsed.blocks.map(b => b.text || '').join('\n');
      if (els.pageText) {
        els.pageText.value = plainText;
      }
      // Store formatted HTML for potential rich display/export
      state.lastDocxImportHtml = html;
      state.lastDocxImportBlocks = parsed.blocks;
      setOcrStatus(`DOCX импортирован: ${parsed.blocks.length} блоков, ${parsed.styles?.length || 0} стилей`);
      pushDiagnosticEvent('docx.import.advanced', { blocks: parsed.blocks.length, file: file.name, hasHtml: !!html });
    } else {
      importDocxEdits(file);
    }
  } catch (err) {
    console.warn('[ocr] error:', err?.message);
    importDocxEdits(file);
  }
  e.target.value = '';
});
safeOn(els.exportOcrIndex, 'click', downloadOcrTextExport);
// ─── OCR & Text Processing (delegated to init-ocr.js) ────────────────────────
const { refreshOcrStorageInfo } = initOcr({
  state, els, safeOn, setOcrStatus, getOcrLang,
  runOcrForCurrentPage, setOcrRegionMode, cancelAllOcrWork,
  markLowConfidenceWords, getPageQualitySummary,
  listOcrDocuments, getOcrStorageSize, deleteOcrData,
  undoPageEdit, redoPageEdit, setTextEditMode, saveCurrentPageTextEdits,
  exportSessionHealthReport,
});

// ─── Annotations & Drawing (delegated to init-annotations.js) ────────────────
initAnnotations({
  state, els, safeOn, setDrawMode, undoStroke, clearStrokes, clearComments,
  exportAnnotatedPng, exportAnnotationsJson, importAnnotationsJson,
  exportAnnotationBundleJson, importAnnotationBundleJson,
  exportAnnotationsAsSvg, exportAnnotationsAsPdf, exportAnnotationsIntoPdf,
  loadStrokes, safeCreateObjectURL, setOcrStatus,
});

// ─── PDF Tools: Forms, Block Editor, Watermark, Stamps (delegated to init-pdf-tools.js)
initPdfTools({
  state, els, safeOn, setOcrStatus, formManager, blockEditor,
  fillPdfForm, addWatermarkToPdf, addStampToPdf, safeCreateObjectURL,
  handleImageInsertion, addWatermarkToPage, addStampToPage, openSignaturePad, nrPrompt,
});

// ─── Page Organizer UI (extracted to modules/page-organizer-ui.js) ───────────
initPageOrganizerUI({ openFile });

// ─── Merge / Split ──────────────────────────────────────────────────────────
safeOn(els.mergePages, 'click', () => mergePdfFiles());
safeOn(els.splitPages, 'click', () => splitPdfPages());

// ─── Conversion Plugins ─────────────────────────────────────────────────────
function exportPluginResult(pluginId, result) {
  if (!result) return;
  const payload = { app: 'NovaReader', plugin: pluginId, page: state.currentPage, docName: state.docName, result, timestamp: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-${pluginId}-page${state.currentPage}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('convertToPdfBtn')?.addEventListener('click', async () => {
  await convertCurrentToPdf(reloadPdfFromBytes, setOcrStatus);
});

safeOn(els.conversionInvoice, 'click', async () => {
  if (!state.adapter) return;
  const text = els.pageText?.value || '';
  const result = applyPlugin('invoice', text, state.currentPage);
  if (result) {
    setOcrStatus(`Плагин "Счёт": ${result.blocks?.length || 0} блоков извлечено`);
    pushDiagnosticEvent('plugin.invoice', { page: state.currentPage, blocks: result.blocks?.length || 0 });
    exportPluginResult('invoice', result);
  }
});

safeOn(els.conversionReport, 'click', async () => {
  if (!state.adapter) return;
  const text = els.pageText?.value || '';
  const result = applyPlugin('report', text, state.currentPage);
  if (result) {
    setOcrStatus(`Плагин "Отчёт": ${result.blocks?.length || 0} блоков извлечено`);
    pushDiagnosticEvent('plugin.report', { page: state.currentPage, blocks: result.blocks?.length || 0 });
    exportPluginResult('report', result);
  }
});

safeOn(els.conversionTable, 'click', async () => {
  if (!state.adapter) return;
  const text = els.pageText?.value || '';
  const result = applyPlugin('custom-table', text, state.currentPage);
  if (result) {
    setOcrStatus(`Плагин "Таблица": ${result.rows?.length || 0} строк извлечено`);
    pushDiagnosticEvent('plugin.table', { page: state.currentPage, rows: result.rows?.length || 0 });
    exportPluginResult('custom-table', result);
  }
});

safeOn(els.importDjvuDataJson, 'change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importDjvuDataJson(file);
  e.target.value = '';
});
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

safeOn(els.shortcutsHelp, 'click', showShortcutsHelp);
safeOn(els.toggleSidebar, 'click', () => toggleLayoutState('sidebarHidden'));
safeOn(els.toggleToolsBar, 'click', () => toggleLayoutState('toolsHidden'));
safeOn(els.toggleTextTools, 'click', () => toggleLayoutState('textHidden'));
safeOn(els.toggleSearchTools, 'click', () => toggleLayoutState('searchToolsHidden'));
safeOn(els.toggleAnnotTools, 'click', () => toggleLayoutState('annotToolsHidden'));
safeOn(els.toggleTextToolsInline, 'click', () => toggleLayoutState('textHidden'));

// Fullscreen & Ctrl+wheel zoom — handled by initNavigation() above


function setSettingsStatus(message) {
  if (!els.settingsStatus) return;
  els.settingsStatus.textContent = message;
}

function uiSidebarCompactKey() {
  return 'novareader-ui-compact-sidebar';
}

function setSidebarCompactMode(enabled) {
  document.body.classList.toggle('sidebar-compact', !!enabled);
  if (els.toggleSidebarCompact) {
    els.toggleSidebarCompact.textContent = `Компакт: ${enabled ? 'on' : 'off'}`;
  }
  localStorage.setItem(uiSidebarCompactKey(), enabled ? '1' : '0');
}

function loadSidebarCompactMode() {
  const enabled = localStorage.getItem(uiSidebarCompactKey()) === '1';
  setSidebarCompactMode(enabled);
}

function setSidebarSectionsCollapsed(collapsed) {
  document.querySelectorAll('.sidebar > section').forEach((section) => {
    section.classList.toggle('collapsed', collapsed);
  });
  localStorage.setItem(uiLayoutKey('sectionsCollapsed'), collapsed ? '1' : '0');
}

function restoreSidebarSectionsCollapsed() {
  const raw = localStorage.getItem(uiLayoutKey('sectionsCollapsed'));
  const collapsed = raw === null ? true : raw === '1';
  setSidebarSectionsCollapsed(collapsed);
}

function initSidebarSections() {
  document.querySelectorAll('.sidebar > section > h2').forEach((title) => {
    title.classList.add('section-toggle');
    title.title = 'Клик: свернуть/развернуть';
    title.addEventListener('click', () => {
      title.parentElement?.classList.toggle('collapsed');
    });
  });
}

function applyCommonHotkeys() {
  setHotkeys({ ...defaultHotkeys });
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Применены стандартные hotkeys.', 'success');
}

window.addEventListener('beforeunload', () => {
  revokeCurrentObjectUrl();
  _saveViewStateNow();
  markCleanExit();
});

// ─── Global Keyboard Handlers (delegated to init-keyboard.js) ────────────────
initKeyboard({
  state, els, hotkeys, stringifyHotkeyEvent,
  navigateHistoryBack, navigateHistoryForward, addBookmark,
  setDrawMode, setOcrRegionMode, setOcrStatus,
  undoStroke, undoPageEdit, redoPageEdit, showShortcutsHelp,
});

document.addEventListener('visibilitychange', syncReadingTimerWithVisibility);
window.addEventListener('beforeunload', () => {
  stopReadingTimer(true);
  if (pdfEditState.dirty) persistEdits();
  revokeAllTrackedUrls();
  clearPageRenderCache();
  terminateTesseract().catch((err) => { console.warn('[ocr] error:', err?.message); });
});

renderRecent();

// ─── Wire up module dependency injection ────────────────────────────────────
initDiagnosticsDeps({
  getEditHistory,
  getBatchOcrProgress,
  getSessionHealth,
  getOcrSearchIndexSize: () => ocrSearchIndex.pages.size,
  getToolMode: () => toolStateMachine.current,
});
initToolModeDeps({
  renderAnnotations,
  updateOverlayInteractionState,
  setOcrStatus,
});
initAnnotationControllerDeps({
  renderDocStats,
  renderReadingGoalStatus,
  renderEtaStatus,
  setOcrStatus,
  runOcrOnRect,
  drawOcrSelectionPreview,
  nrPrompt,
  toastError,
});
initRenderControllerDeps({
  renderAnnotations,
  capturePageHistoryOnRender,
  saveViewState,
  renderCommentList,
  trackVisitedPage,
  renderReadingProgress,
  setOcrStatus,
});
initOcrControllerDeps({
  renderAnnotations,
  updateOverlayInteractionState,
  getCurrentAnnotationCtx,
  denormalizePoint,
  renderTextLayer,
  applyAppLanguage,
  _ocrWordCache,
});
initExportControllerDeps({
  setOcrStatus,
  getCachedPage,
  getOcrLang,
  _ocrWordCache,
});
initSearchControllerDeps({
  setOcrStatus,
  renderCurrentPage,
});
initWorkspaceDeps({
  loadStrokes, saveStrokes, loadComments, saveComments,
  getNotesModel, normalizeImportedNotes, saveNotes,
  loadBookmarks, saveBookmarks, renderBookmarks, setBookmarksStatus,
  normalizeHotkey, validateHotkeys, renderHotkeyInputs, setHotkeysInputErrors, setHotkeysStatus,
  renderAnnotations, renderCommentList,
  clearDocumentAnnotationStorage, clearDocumentCommentStorage,
  renderPagePreviews, renderCurrentPage,
});
initReadingProgressDeps({
  renderCurrentPage,
  renderSearchResultsList,
  loadStrokes,
  loadComments,
  loadBookmarks,
});
initFileControllerDeps({
  withErrorBoundary,
  renderCurrentPage, renderOutline, renderPagePreviews,
  resetHistory, setWorkspaceStatus, setBookmarksStatus,
  ensureTextToolsVisible, invalidateAnnotationCaches, clearOcrRuntimeCaches,
  restoreViewStateIfPresent, stopReadingTimer, loadReadingTime, loadReadingGoal,
  loadCloudSyncUrl, toggleCollaborationChannel,
  saveRecent, renderRecent, loadNotes, renderBookmarks,
  renderDocInfo, renderVisitTrail, renderSearchHistory, renderSearchResultsList,
  renderDocStats, estimatePageSkewAngle, scheduleBackgroundOcrScan, setOcrStatus,
  loadPersistedEdits, renderCommentList, updateReadingTimeStatus, renderEtaStatus,
  startReadingTimer,
  PDFAdapter, DjVuAdapter, DjVuNativeAdapter, ImageAdapter, UnsupportedAdapter,
});
initPdfOpsDeps({
  setOcrStatus, safeCreateObjectURL, pushDiagnosticEvent,
  mergePdfDocuments, splitPdfDocument, parsePageRangeLib,
  nrPrompt,
});
initSettingsUiDeps({
  uiLayoutKey, refreshOcrStorageInfo, applyUiSizeSettings,
  defaultSettings, saveAppSettings, clearOcrRuntimeCaches, applyLayoutState,
  applyLayoutWithTransition,
});
initOutlineControllerDeps({
  canSearchCurrentDoc, renderCurrentPage,
});
initTextNavDeps({
  uiLayoutKey, applyLayoutState, canSearchCurrentDoc,
  loadOcrTextData, saveOcrTextData, setOcrStatus, pushDiagnosticEvent,
  renderCurrentPage, safeCreateObjectURL,
  setPageEdits, persistEdits, getEditHistory, pdfEditState,
  convertPdfToDocx, generateDocxBlob, generateDocxWithImages,
  capturePageAsImageData, _ocrWordCache,
  recordSuccessfulOperation, recordCrashEvent,
});
initLayoutControllerDeps({
  openFile, beginStroke, moveStroke, endStroke,
  getCanvasPointFromEvent, loadComments, denormalizePoint,
  _applyTextMarkupFromSelection,
});

setupRuntimeDiagnostics();
runRuntimeSelfCheck();
loadAppSettings();
applyUiSizeSettings();
loadTheme();

// ─── i18n initialization ────────────────────────────────────────────────────
loadLanguage();
applyI18nToDOM();
if (els.cfgAppLang) {
  els.cfgAppLang.value = getLanguage();
  els.cfgAppLang.addEventListener('change', () => {
    setLanguage(els.cfgAppLang.value);
    applyI18nToDOM();
  });
}
loadSearchScope();
renderReadingProgress();
updateHistoryButtons();
loadNotes();
loadHotkeys();
bindHotkeyCapture();
renderBookmarks();
renderOutline();
renderCommentList();
renderVisitTrail();
renderSearchHistory();
renderSearchResultsList();
renderDocStats();
initSidebarSections();
restoreSidebarSectionsCollapsed();
loadSidebarCompactMode();
initReleaseGuards();
renderEtaStatus();
renderReadingGoalStatus();
setupDragAndDrop();
setupAnnotationEvents();
setupResizableLayout();

initPdfProHandlersDeps({
  setOcrStatus, nrPrompt, nrConfirm, safeCreateObjectURL,
  pushDiagnosticEvent, ensurePdfJs, toastSuccess, toastInfo,
  pdfOptimizer, flattenPdf, checkAccessibility, autoFixAccessibility,
  pdfCompare, addHeaderFooter, addBatesNumbering,
  rotatePdfPages, splitPdfDocument, mergePdfDocuments, parsePageRangeLib,
  reloadPdfFromBytes,
});
initPdfProHandlers();

if (typeof ResizeObserver === 'function' && els.searchToolsGroup) {
  const searchResizeObserver = new ResizeObserver(() => updateSearchToolbarRows());
  searchResizeObserver.observe(els.searchToolsGroup);
}

applyLayoutState();
applySectionVisibilitySettings();
applyAdvancedPanelsState();
applyAppLanguage();
setDrawMode(false);
setOcrRegionMode(false);

// ─── Pro PDF Tool Handlers — extracted to modules/pdf-pro-handlers.js ────────

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — UI Init Blocks (extracted to modules/ui-init-blocks.js)
// ═══════════════════════════════════════════════════════════════════════════════
initUiBlocks({
  state, els, renderCurrentPage, openFile,
  recognizeWithBoxes, batchOcr, createSearchablePdf,
  detectScannedDocument, autoDetectLanguage, rotatePdfPages,
  safeCreateObjectURL, setOcrStatus, pushDiagnosticEvent,
  nrPrompt, nrConfirm, toastSuccess, toastInfo,
  parsePageRangeLib, setViewMode, VIEW_MODES,
  getCurrentMode, extractTextForPage, convertToHtml, downloadHtml,
  reloadPdfFromBytes,
});

// ─── Initialize Phase 2+ Modules (extracted to modules/app-init-phase2.js) ───
initTooltips();
initContextMenu();
initA11y();
bindUndoRedoKeys();

// Initialize view modes with app dependencies
initViewModes({
  renderPage: null, // Will be connected after full render pipeline is ready
  getPageCount: () => state.pageCount,
  getCurrentPage: () => state.currentPage,
  setCurrentPage: (n) => goToPage(n),
  getZoom: () => state.zoom,
  viewport: document.querySelector('.document-viewport'),
  canvas: els.canvas,
});

// Expose toast for use throughout the app
window._toast = { toast, toastSuccess, toastError, toastWarning, toastInfo, toastProgress, dismissAllToasts };

// Expose view modes
window._viewModes = { setViewMode, getCurrentMode, VIEW_MODES };

initPhase2Modules({ renderCurrentPage, goToPage });

// ─── Advanced Tools Bootstrap (Phase 0–8 + Pro modules) ─────────────────
window._advancedToolsHandle = null;
// Re-bootstraps when a new PDF is loaded (called from file-controller)
window._bootstrapAdvancedTools = () => {
  if (window._advancedToolsHandle) window._advancedToolsHandle.destroy();
  window._advancedToolsHandle = bootstrapAdvancedTools({
    container:     els.canvas?.parentElement ?? document.body,
    toolbar:       document.querySelector('.tool-bar, .ribbon-toolbar, #mainToolbar'),
    pdfLibDoc:     state.pdfLibDoc ?? null,
    pdfBytes:      state.pdfBytes ?? null,
    getPageCanvas: () => els.canvas,
    getPageNum:    () => state.currentPage ?? 1,
    reloadPage:    () => renderCurrentPage(),
    onPdfModified: (bytes) => {
      state.pdfBytes = bytes;
      reloadPdfFromBytes(bytes);
    },
    eventBus:      window._eventBus ?? null,
  });
};

// ─── Tab Manager (delegated to init-tabs.js) ─────────────────────────────────
initTabs({
  state, els, safeOn, openFile, renderCurrentPage, TabManager,
});

// ─── Bookmark & Notes Controllers ────────────────────────────────────────
initBookmarkController();
initNotesController();

// Listen for page navigation events from bookmark-controller
window.addEventListener('novareader-goto-page', async (e) => {
  const page = e.detail?.page;
  if (page && page >= 1 && page <= state.pageCount) {
    state.currentPage = page;
    await renderCurrentPage();
    highlightThumbPage();
    updateBookmarkButton();
  }
});

// Hook page navigation to update bookmark button and thumbnails
window.addEventListener('page-rendered', () => {
  updateBookmarkButton();
  highlightThumbPage();
});

// ─── Expose globals for E2E testing and diagnostics ──────────────────────────
window.crashTelemetry = crashTelemetry;
window.ocrSearchIndex = ocrSearchIndex;
window.searchOcrIndex = searchOcrIndex;
window.pageRenderCache = pageRenderCache;
window.objectUrlRegistry = objectUrlRegistry;
window._pdfSecurity = { setPassword, cleanMetadata, getSecurityInfo, sanitizePdf };
window._textEdit = { applyTextEdits, addTextBlock, findAndReplace, spellCheck, getAvailableFonts };
window._ocrCorrect = { correctOcrText, buildDictionary, recoverParagraphs, computeQualityScore };
window._textExtractor = { extractTextInReadingOrder, extractMultiPageText, downloadText };
window._workerPool = { WorkerPool, initOcrPool, getOcrPool, runInWorker };
window._indexedStorage = { openDatabase, cachePageRender, getCachedPageRender, clearDocumentCache, getStorageUsage, clearAllCache };
window._errorHandler = { reportError, getErrorLog, withRetry, saveStateSnapshot, restoreStateSnapshot };
window._pdfA = { convertToPdfA, checkPdfACompliance };
window._virtualScroll = VirtualScroll;
window._memoryManager = { getMemoryStats, forceCleanup, acquireCanvas, releaseCanvas };
window._textLayer = { buildTextLayer, highlightSearchMatches, clearSearchHighlights, getSelectedText };
window._layoutAnalysis = { analyzeLayout, detectTable, sortByReadingOrder, tableToHtml };
window._batchOcrEngine = BatchOcrEngine;
window._ribbon = { initRibbonToolbar, switchTab, setContextualTab };
window._tabManager = TabManager;
window._print = { parsePrintRange, getPagesToPrint, arrangeBooklet, arrangeNup, triggerPrint };
window._pdfCreate = { createPdfFromImages, createBlankPdf, canvasesToPdf };
window._quickActions = { initQuickActions, hideQuickActions };
window._hotkeys = { initHotkeys, onHotkey, registerHotkeyHandlers, isSpaceHeld, getBindings, getCheatsheet };
window._cbzAdapter = CbzAdapter;

// ─── Wave 8: Decomposition Module Globals ─────────────────────────────────
window._appPersistence = AppPersistence;
window._ocrSearchIndex = new OcrSearchIndex();
window._renderPipeline = { renderPage: pipelineRenderPage, schedulePreRender, invalidateCache, getCacheStats };
window._annotationController = new AnnotationController({
  loadStrokes: AppPersistence.loadStrokes,
  saveStrokes: AppPersistence.saveStrokes,
  loadComments: AppPersistence.loadComments,
  saveComments: AppPersistence.saveComments,
});

// ─── Wave 10: Page Organizer, Floating Search, XPS ────────────────────────
window._pageOrganizer = { getPageInfoList, reorderPages, deletePages, rotatePages, extractPages, insertPages, insertBlankPage, duplicatePages, reversePages, createOrganizerState, togglePageSelection, selectPageRange, computeReorderFromDrag };
window._floatingSearch = initFloatingSearch(
  document.querySelector('.document-viewport') || document.body,
  {
    onSearch: (query, options) => {
      if (typeof window._ocrSearchIndex !== 'undefined') {
        const results = window._ocrSearchIndex.search(query, options);
        return { total: results.length, matches: results };
      }
      return { total: 0, matches: [] };
    },
    onClose: () => {},
  }
);
window._xpsAdapter = XpsAdapter;
window._cloud = { registerProvider, getProviders, authenticate, listFiles, openFile, saveFile, getShareLink, signOut, getConnectionStatus, onStatusChange, createGoogleDriveProvider, createOneDriveProvider, createDropboxProvider };
window._ai = { summarizeText, extractTags, semanticSearch, generateToc };

// Register cloud provider stubs
registerProvider(createGoogleDriveProvider());
registerProvider(createOneDriveProvider());
registerProvider(createDropboxProvider());

// ─── Advanced Features (delegated to init-advanced.js) ───────────────────────
initAdvanced({
  state, els, safeOn, debounce, renderCurrentPage, goToPage, nrPrompt,
  pushDiagnosticEvent, toastSuccess, loadStrokes, saveStrokes,
  initQuickActions, initHotkeys, registerHotkeyHandlers,
  initAutoScroll, startAutoScroll, stopAutoScroll, isAutoScrolling,
  initAutosave, checkForRecovery, applyRecoveredSnapshot, startAutosaveTimer,
  initMinimap, updateMinimap, initCommandPalette,
});

// Global error handlers — registered by initErrorHandling() above

// ─── Expose debugging globals ────────────────────────────────────────────────
window._activityLog = { novaLog, exportLogsAsJson, clearActivityLog, getLogEntries };
window._minimap = { initMinimap, updateMinimap, showMinimap, hideMinimap, toggleMinimap };
window._autoScroll = { startAutoScroll, stopAutoScroll, toggleAutoScroll, setAutoScrollSpeed, isAutoScrolling };
window._autosave = { triggerAutosave, markCleanExit, checkForRecovery, clearRecoveryData, startAutosaveTimer, stopAutosaveTimer };
window._commandPalette = { showCommandPalette, hideCommandPalette, registerCommand };

// ─── Mark initialization complete ────────────────────────────────────────
state.initComplete = true;
pushDiagnosticEvent('app.init-complete', { listeners: _listenerRegistry.length, version: '4.0.0' });
