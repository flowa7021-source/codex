// ─── Module Imports ─────────────────────────────────────────────────────────
import { debounce } from './modules/utils.js';
import { state, defaultHotkeys, hotkeys, setHotkeys, els } from './modules/state.js';
import { ensurePdfJs } from './modules/loaders.js';
import { getCachedPage, clearPageRenderCache, revokeAllTrackedUrls, pageRenderCache, objectUrlRegistry } from './modules/perf.js';
import { toolStateMachine, initToolModeDeps } from './modules/tool-modes.js';
import { pushDiagnosticEvent, clearDiagnostics, exportDiagnostics, runRuntimeSelfCheck, setupRuntimeDiagnostics, initDiagnosticsDeps } from './modules/diagnostics.js';
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
import { initFileControllerDeps, revokeCurrentObjectUrl, saveDjvuData, openFile } from './modules/file-controller.js';
import { initPdfOpsDeps, mergePdfFiles, splitPdfPages } from './modules/pdf-ops-controller.js';
import { PDFAdapter, ImageAdapter, DjVuAdapter, DjVuNativeAdapter, UnsupportedAdapter } from './modules/adapters.js';
import { initSettingsUiDeps, applyAppLanguage, applySectionVisibilitySettings, openSettingsModal, closeSettingsModal, previewUiSizeFromModal, saveSettingsFromModal } from './modules/settings-ui.js';
import { initOutlineControllerDeps, renderDocInfo, renderOutline, renderPagePreviews } from './modules/outline-controller.js';
import { initTextNavDeps, ensureTextToolsVisible, refreshPageText, copyPageText, exportPageText, setTextEditMode, saveCurrentPageTextEdits, exportCurrentDocToWord, goToPage, fitWidth, fitPage, downloadCurrentFile, printCanvasPage } from './modules/text-nav-controller.js';
import { initLayoutControllerDeps, uiLayoutKey, applyAdvancedPanelsState, toggleAdvancedPanelsState, applyLayoutState, updateSearchToolbarRows, toggleLayoutState, setupResizableLayout, setupDragAndDrop, setupAnnotationEvents } from './modules/layout-controller.js';
import { initPdfProHandlersDeps, initPdfProHandlers } from './modules/pdf-pro-handlers.js';
import { initUiBlocks } from './modules/ui-init-blocks.js';
import { initPhase2Modules } from './modules/app-init-phase2.js';
import { initPageOrganizerUI } from './modules/page-organizer-ui.js';

// ─── Phase 0: Unified Error Boundary ───────────────────────────────────────
function withErrorBoundary(fn, context, options = {}) {
  const { silent = false, fallback = null, rethrow = false } = options;
  return async function boundaryWrapped(...args) {
    const startedAt = performance.now();
    try {
      return await fn.apply(this, args);
    } catch (error) {
      const ms = Math.round(performance.now() - startedAt);
      const message = String(error?.message || 'unknown error');
      const errorType = classifyAppError(message);
      pushDiagnosticEvent(`error-boundary.${context}`, { message, errorType, ms, context }, 'error');
      if (typeof recordCrashEvent === 'function') recordCrashEvent(errorType, message, context);
      if (!silent) {
        showUserError(context, errorType, message);
      }
      if (rethrow) throw error;
      return typeof fallback === 'function' ? fallback(error) : fallback;
    }
  };
}

function classifyAppError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('runtime') || m.includes('module')) return 'runtime';
  if (m.includes('fetch') || m.includes('http') || m.includes('load') || m.includes('network')) return 'asset-load';
  if (m.includes('memory') || m.includes('out of memory') || m.includes('allocation')) return 'memory';
  if (m.includes('timeout') || m.includes('timed out')) return 'timeout';
  if (m.includes('parse') || m.includes('json') || m.includes('syntax')) return 'parse';
  if (m.includes('permission') || m.includes('security') || m.includes('cors')) return 'security';
  if (m.includes('storage') || m.includes('quota')) return 'storage';
  return 'processing';
}

function showUserError(context, errorType, message) {
  const contextLabels = {
    'file-open': 'Открытие файла',
    'page-render': 'Рендер страницы',
    'export-word': 'Экспорт в Word',
    'export-png': 'Экспорт PNG',
    'export-annotations': 'Экспорт аннотаций',
    'import-annotations': 'Импорт аннотаций',
    'search': 'Поиск',
    'ocr': 'Распознавание',
    'workspace-export': 'Экспорт рабочей области',
    'workspace-import': 'Импорт рабочей области',
  };
  const label = contextLabels[context] || context;
  const statusEl = els.searchStatus || els.ocrStatus || els.workspaceStatus;
  if (statusEl) {
    statusEl.textContent = `Ошибка [${label}]: ${errorType} — ${message}`;
  }
  // Also show a toast notification for visibility
  try { toastError(`${label}: ${message}`); } catch (err) { console.warn('[app] toast in error boundary failed:', err?.message); }
}

initCrashTelemetry();

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
function queueNotesAutosave() { SettingsController.queueNotesAutosave(noteKey); }
function exportNotes() { SettingsController.exportNotes(); }
function exportNotesMarkdown() { SettingsController.exportNotesMarkdown(); }
function exportNotesJson() { SettingsController.exportNotesJson(); }
async function importNotesJson(file) { await SettingsController.importNotesJson(file, noteKey); }
function insertTimestamp() { SettingsController.insertTimestamp(noteKey); }
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
function exportBookmarksJson() { SettingsController.exportBookmarksJson(bookmarkKey, loadBookmarks); }
async function importBookmarksJson(file) { await SettingsController.importBookmarksJson(file, saveBookmarks, renderBookmarks); }
function loadBookmarks() { return SettingsController.loadBookmarks(bookmarkKey); }
function saveBookmarks(next) { SettingsController.saveBookmarks(next, bookmarkKey, renderDocStats, renderEtaStatus); }
function renderBookmarks() { SettingsController.renderBookmarks(bookmarkKey, saveBookmarks, renderCurrentPage); }
async function addBookmark() { await SettingsController.addBookmark(bookmarkKey, saveBookmarks, renderBookmarks); }
function clearBookmarks() { SettingsController.clearBookmarks(saveBookmarks, renderBookmarks); }

// ─── Event Bindings ──────────────────────────────────────────────────────────
els.clearRecent.addEventListener('click', clearRecent);
els.toggleAdvancedPanels?.addEventListener('click', toggleAdvancedPanelsState);
els.openSettingsModal?.addEventListener('click', openSettingsModal);
els.closeSettingsModal?.addEventListener('click', closeSettingsModal);
els.saveSettingsModal?.addEventListener('click', saveSettingsFromModal);
els.exportDiagnostics?.addEventListener('click', exportDiagnostics);
els.clearDiagnostics?.addEventListener('click', clearDiagnostics);
els.runRuntimeSelfCheck?.addEventListener('click', () => { runRuntimeSelfCheck(); });
els.cfgSidebarWidth?.addEventListener('input', previewUiSizeFromModal);
els.cfgToolbarScale?.addEventListener('input', previewUiSizeFromModal);
els.cfgTextMinHeight?.addEventListener('input', previewUiSizeFromModal);
els.cfgPageAreaHeight?.addEventListener('input', previewUiSizeFromModal);
els.cfgTopToolbarHeight?.addEventListener('input', previewUiSizeFromModal);
els.cfgBottomToolbarHeight?.addEventListener('input', previewUiSizeFromModal);
els.cfgTextPanelHeight?.addEventListener('input', previewUiSizeFromModal);
els.cfgAnnotationCanvasScale?.addEventListener('input', previewUiSizeFromModal);
els.settingsModal?.addEventListener('click', (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });

els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await openFile(file);
  e.target.value = '';
});

els.historyBack.addEventListener('click', navigateHistoryBack);
els.historyForward.addEventListener('click', navigateHistoryForward);

els.prevPage.addEventListener('click', async () => {
  if (!state.adapter || state.currentPage <= 1) return;
  state.currentPage -= 1;
  await renderCurrentPage();
});

els.nextPage.addEventListener('click', async () => {
  if (!state.adapter || state.currentPage >= state.pageCount) return;
  state.currentPage += 1;
  await renderCurrentPage();
});

els.goToPage.addEventListener('click', goToPage);
els.pageInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') await goToPage();
});

// Debounced render for rapid zoom clicks — avoids queueing 10+ renders in a row
const debouncedZoomRender = debounce(async () => {
  await renderCurrentPage();
}, 120);

els.zoomIn.addEventListener('click', () => {
  state.zoom = Math.min(4, +(state.zoom + 0.1).toFixed(2));
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  debouncedZoomRender();
});

els.zoomOut.addEventListener('click', () => {
  state.zoom = Math.max(0.3, +(state.zoom - 0.1).toFixed(2));
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  debouncedZoomRender();
});

els.fitWidth.addEventListener('click', fitWidth);
els.fitPage.addEventListener('click', fitPage);

els.rotate.addEventListener('click', async () => {
  state.rotation = (state.rotation + 90) % 360;
  clearOcrRuntimeCaches('rotation-changed');
  await renderPagePreviews();
  await renderCurrentPage();
  if (state.settings?.backgroundOcr) scheduleBackgroundOcrScan('save-settings', 600);
});

els.saveNotes.addEventListener('click', () => saveNotes('manual'));
[els.notesTitle, els.notesTags, els.notes].filter(Boolean).forEach((el) => {
  el.addEventListener('input', queueNotesAutosave);
});
els.exportNotes.addEventListener('click', exportNotes);
els.exportNotesMd.addEventListener('click', exportNotesMarkdown);
els.exportNotesJson.addEventListener('click', exportNotesJson);
els.importNotesJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importNotesJson(file);
  e.target.value = '';
});
els.insertTimestamp.addEventListener('click', insertTimestamp);
els.saveHotkeys.addEventListener('click', saveHotkeys);
els.resetHotkeys.addEventListener('click', resetHotkeys);
els.autoFixHotkeys.addEventListener('click', autoFixHotkeys);
els.applyCommonHotkeys?.addEventListener('click', () => {
  applyCommonHotkeys();
  setSettingsStatus('Применены стандартные hotkeys.');
});
els.toggleSidebarCompact?.addEventListener('click', () => {
  const enabled = !document.body.classList.contains('sidebar-compact');
  setSidebarCompactMode(enabled);
  setSettingsStatus(enabled ? 'Включён компактный режим панели.' : 'Компактный режим отключён.');
});
els.collapseSidebarSections?.addEventListener('click', () => {
  setSidebarSectionsCollapsed(true);
  setSettingsStatus('Разделы панели свернуты.');
});
els.expandSidebarSections?.addEventListener('click', () => {
  setSidebarSectionsCollapsed(false);
  setSettingsStatus('Разделы панели развернуты.');
});
els.exportWorkspace.addEventListener('click', exportWorkspaceBundleJson);
els.importWorkspace.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importWorkspaceBundleJson(file);
  e.target.value = '';
});
els.importOcrJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importOcrJson(file);
  e.target.value = '';
});
els.saveCloudSyncUrl.addEventListener('click', saveCloudSyncUrl);
els.pushCloudSync.addEventListener('click', async () => {
  try {
    await pushWorkspaceToCloud();
  } catch (err) {
    setStage4Status('Ошибка cloud push.', 'error');
  }
});
els.pullCloudSync.addEventListener('click', async () => {
  try {
    await pullWorkspaceFromCloud();
  } catch (err) {
    setStage4Status('Ошибка cloud pull.', 'error');
  }
});
els.toggleCollab.addEventListener('click', toggleCollaborationChannel);
els.broadcastCollab.addEventListener('click', () => broadcastWorkspaceSnapshot('manual'));
els.resetProgress.addEventListener('click', async () => {
  await resetReadingProgress();
});
els.resetReadingTime.addEventListener('click', async () => {
  await resetReadingTime();
});
els.clearVisitTrail.addEventListener('click', clearVisitTrail);
els.clearSearchHistory.addEventListener('click', clearSearchHistory);
els.exportSearchHistory.addEventListener('click', exportSearchHistoryJson);
els.exportSearchHistoryTxt.addEventListener('click', exportSearchHistoryTxt);
els.copySearchHistory.addEventListener('click', async () => {
  await copySearchHistory();
});
els.importSearchHistoryJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importSearchHistoryJson(file);
  e.target.value = '';
});
els.clearSearchResults.addEventListener('click', clearSearchResults);
els.exportSearchResults.addEventListener('click', exportSearchResultsJson);
els.exportSearchResultsCsv.addEventListener('click', exportSearchResultsCsv);
els.exportSearchSummaryTxt.addEventListener('click', exportSearchResultsSummaryTxt);
els.importSearchResultsJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importSearchResultsJson(file);
  e.target.value = '';
});
els.importSearchResultsCsv.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importSearchResultsCsv(file);
  e.target.value = '';
});
els.copySearchResults.addEventListener('click', async () => {
  await copySearchResultsSummary();
});
els.saveReadingGoal.addEventListener('click', saveReadingGoal);
els.clearReadingGoal.addEventListener('click', clearReadingGoal);
els.themeToggle?.addEventListener('click', toggleTheme);
els.addBookmark.addEventListener('click', addBookmark);
els.addBookmarkToolbar?.addEventListener('click', addBookmark);
els.clearBookmarks.addEventListener('click', clearBookmarks);
els.exportBookmarks.addEventListener('click', exportBookmarksJson);
els.importBookmarks.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importBookmarksJson(file);
  e.target.value = '';
});
els.bookmarkFilter.addEventListener('input', renderBookmarks);
els.clearBookmarkFilter.addEventListener('click', () => {
  els.bookmarkFilter.value = '';
  renderBookmarks();
});
els.downloadFile.addEventListener('click', downloadCurrentFile);
els.printPage.addEventListener('click', printCanvasPage);
els.importDjvuDataQuick?.addEventListener('click', () => els.importDjvuDataJson?.click());
els.refreshText.addEventListener('click', refreshPageText);
els.copyText.addEventListener('click', copyPageText);
els.exportText.addEventListener('click', exportPageText);
els.exportWord?.addEventListener('click', exportCurrentDocToWord);
els.importDocx?.addEventListener('change', async (e) => {
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
    importDocxEdits(file);
  }
  e.target.value = '';
});
els.exportOcrIndex?.addEventListener('click', downloadOcrTextExport);
els.undoTextEdit?.addEventListener('click', () => {
  const action = undoPageEdit();
  if (action && els.pageText) {
    els.pageText.value = action.text;
    setOcrStatus(`Отмена: страница ${action.page}`);
  }
});
els.redoTextEdit?.addEventListener('click', () => {
  const action = redoPageEdit();
  if (action && els.pageText) {
    els.pageText.value = action.text;
    setOcrStatus(`Повтор: страница ${action.page}`);
  }
});
els.exportHealthReport?.addEventListener('click', exportSessionHealthReport);
els.toggleTextEdit?.addEventListener('click', () => setTextEditMode(!state.textEditMode));
els.saveTextEdits?.addEventListener('click', saveCurrentPageTextEdits);
els.ocrCurrentPage?.addEventListener('click', async () => {
  await runOcrForCurrentPage();
});
els.ocrRegionMode?.addEventListener('click', () => {
  setOcrRegionMode(!state.ocrRegionMode);
});
els.copyOcrText?.addEventListener('click', async () => {
  if (!els.pageText?.value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(els.pageText.value);
      setOcrStatus('OCR: текст скопирован');
    }
  } catch (err) {
    setOcrStatus('OCR: не удалось скопировать текст');
  }
});
els.cancelBackgroundOcr?.addEventListener('click', () => {
  cancelAllOcrWork('manual-button');
});

// ─── OCR Confidence Overlay Toggle ──────────────────────────────────────────
els.toggleOcrConfidence?.addEventListener('click', () => {
  state.ocrConfidenceMode = !state.ocrConfidenceMode;
  if (els.toggleOcrConfidence) {
    els.toggleOcrConfidence.classList.toggle('active', state.ocrConfidenceMode);
    els.toggleOcrConfidence.textContent = state.ocrConfidenceMode ? 'Качество: on' : 'Качество';
  }
  // Re-render text with or without confidence markers
  const currentText = els.pageText?.value || '';
  if (state.ocrConfidenceMode && currentText) {
    const lang = getOcrLang();
    const marked = markLowConfidenceWords(currentText, lang);
    els.pageText.value = marked;
    const summary = getPageQualitySummary(currentText, lang);
    setOcrStatus(`Качество: ${summary.quality} | avg ${summary.avgScore}% | low: ${summary.lowCount} | medium: ${summary.mediumCount}`);
  } else if (!state.ocrConfidenceMode && currentText) {
    // Remove [?...?] markers
    els.pageText.value = currentText.replace(/\[\?/g, '').replace(/\?\]/g, '');
    setOcrStatus('OCR: idle');
  }
});

// ─── OCR Storage Management ─────────────────────────────────────────────────
async function refreshOcrStorageInfo() {
  try {
    const docs = await listOcrDocuments();
    const sizeBytes = await getOcrStorageSize();
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    if (els.ocrStorageInfo) {
      els.ocrStorageInfo.textContent = `${docs.length} документ(ов) | ~${sizeMb} MB`;
    }
    if (els.ocrDocumentsList) {
      els.ocrDocumentsList.innerHTML = '';
      for (const docName of docs) {
        const li = document.createElement('li');
        li.textContent = docName;
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-ghost btn-xs';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', async () => {
          await deleteOcrData(docName);
          await refreshOcrStorageInfo();
        });
        li.appendChild(delBtn);
        els.ocrDocumentsList.appendChild(li);
      }
    }
  } catch (err) {
    if (els.ocrStorageInfo) els.ocrStorageInfo.textContent = 'Ошибка чтения хранилища';
  }
}

els.refreshOcrStorage?.addEventListener('click', refreshOcrStorageInfo);

els.clearCurrentOcrData?.addEventListener('click', async () => {
  if (!state.docName) return;
  await deleteOcrData(state.docName);
  await refreshOcrStorageInfo();
  setOcrStatus('OCR: данные текущего документа очищены');
});

els.clearAllOcrData?.addEventListener('click', async () => {
  const docs = await listOcrDocuments();
  for (const doc of docs) {
    await deleteOcrData(doc);
  }
  await refreshOcrStorageInfo();
  setOcrStatus('OCR: все данные OCR очищены');
});

els.annotateToggle.addEventListener('click', () => setDrawMode(!state.drawEnabled));
els.undoStroke.addEventListener('click', undoStroke);
els.clearStrokes.addEventListener('click', clearStrokes);
els.clearComments.addEventListener('click', clearComments);
els.exportAnnotated.addEventListener('click', exportAnnotatedPng);
els.exportAnnJson.addEventListener('click', exportAnnotationsJson);
els.importAnnJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importAnnotationsJson(file);
  e.target.value = '';
});
els.exportAnnBundle.addEventListener('click', exportAnnotationBundleJson);
els.importAnnBundle.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importAnnotationBundleJson(file);
  e.target.value = '';
});

// ─── Annotation SVG/PDF export ──────────────────────────────────────────────
els.exportAnnSvg?.addEventListener('click', () => {
  if (!state.adapter) return;
  const strokes = loadStrokes();
  const blob = exportAnnotationsAsSvg(strokes, els.annotationCanvas.width, els.annotationCanvas.height);
  if (!blob) { setOcrStatus('Ошибка экспорта SVG'); return; }
  const url = safeCreateObjectURL(blob);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.svg`;
  a.click();
  URL.revokeObjectURL(url);
});

els.exportAnnPdf?.addEventListener('click', async () => {
  if (!state.adapter) return;

  // If we have the original PDF file, use pdf-lib to embed annotations directly
  if (state.adapter?.type === 'pdf' && state.file) {
    try {
      setOcrStatus('Экспорт PDF с аннотациями (pdf-lib)...');
      const arrayBuffer = await state.file.arrayBuffer();
      // Build annotation store from all pages
      const annotStore = new Map();
      for (let p = 1; p <= state.pageCount; p++) {
        const key = `annotations_${state.docName}_page_${p}`;
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored);
            if (data?.strokes?.length) annotStore.set(p, data.strokes);
          }
        } catch (err) { console.warn('[app] skipped:', err?.message); }
      }
      if (annotStore.size === 0) {
        setOcrStatus('Нет аннотаций для экспорта');
        return;
      }
      const canvasSize = { width: els.canvas.width, height: els.canvas.height };
      const blob = await exportAnnotationsIntoPdf(arrayBuffer, annotStore, canvasSize);
      const url = safeCreateObjectURL(blob);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-annotated.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`PDF с аннотациями: ${annotStore.size} страниц, ${Math.round(blob.size / 1024)} КБ`);
      return;
    } catch (err) {
      console.warn('pdf-lib annotation export failed, falling back:', err);
    }
  }

  // Legacy fallback: single page raster export
  const strokes = loadStrokes();
  const pageImageDataUrl = els.canvas.toDataURL('image/png');
  const blob = exportAnnotationsAsPdf(strokes, els.annotationCanvas.width, els.annotationCanvas.height, pageImageDataUrl);
  if (!blob) { setOcrStatus('Ошибка экспорта PDF'); return; }
  const url = safeCreateObjectURL(blob);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.pdf`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── PDF Forms (pdf-lib: fills and saves actual PDF) ────────────────────────
els.pdfFormFill?.addEventListener('click', async () => {
  if (!state.adapter || state.adapter.type !== 'pdf') {
    setOcrStatus('Формы доступны только для PDF');
    return;
  }
  await formManager.loadFromAdapter(state.adapter);
  const fctx = els.annotationCanvas.getContext('2d');
  formManager.renderFormOverlay(fctx, state.currentPage, state.zoom);
  const totalFields = formManager.getAllFields().length;
  setOcrStatus(`Формы: ${totalFields} полей найдено`);
});

els.pdfFormExport?.addEventListener('click', async () => {
  // Export as JSON (data only)
  const data = formManager.exportFormData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-form-data.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Also save filled form as PDF via pdf-lib
  if (state.adapter?.type === 'pdf' && state.file) {
    try {
      const formData = {};
      for (const field of formManager.getAllFields()) {
        if (field.value !== '' && field.value !== field.defaultValue) {
          formData[field.name] = field.value;
        }
      }
      if (Object.keys(formData).length === 0) {
        setOcrStatus('Форма экспортирована (JSON). Нет заполненных полей для PDF.');
        return;
      }
      setOcrStatus('Сохранение заполненной формы в PDF...');
      const arrayBuffer = await state.file.arrayBuffer();
      const pdfBlob = await fillPdfForm(arrayBuffer, formData, false);
      const pdfUrl = safeCreateObjectURL(pdfBlob);
      const a2 = document.createElement('a');
      a2.href = pdfUrl;
      a2.download = `${state.docName || 'document'}-filled.pdf`;
      a2.click();
      URL.revokeObjectURL(pdfUrl);
      setOcrStatus('Форма сохранена: JSON + заполненный PDF');
    } catch (err) {
      setOcrStatus(`JSON экспортирован (PDF ошибка: ${err?.message || 'неизвестная'})`);
    }
  }
});

els.pdfFormImport?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    formManager.importFormData(data);
    const fctx = els.annotationCanvas.getContext('2d');
    formManager.renderFormOverlay(fctx, state.currentPage, state.zoom);
    setOcrStatus('Данные формы импортированы');
  } catch (err) {
    setOcrStatus(`Ошибка импорта формы: ${err?.message || 'неизвестная'}`);
  }
  e.target.value = '';
});

els.pdfFormClear?.addEventListener('click', () => {
  formManager.clearAll();
  setOcrStatus('Формы очищены');
});

// ─── PDF Block Editor (with snap guides & pdf-lib export) ───────────────────
els.pdfBlockEdit?.addEventListener('click', () => {
  if (!state.adapter || state.adapter.type !== 'pdf') {
    setOcrStatus('Редактор блоков доступен только для PDF');
    return;
  }
  const isActive = els.pdfBlockEdit.classList.toggle('active');
  if (isActive) {
    blockEditor.enable(els.canvasWrap, els.canvas);
    setOcrStatus('Редактор блоков: ВКЛ (привязка к сетке активна)');
  } else {
    blockEditor.clearGuides();
    blockEditor.disable();
    setOcrStatus('Редактор блоков: ВЫКЛ');
  }
});

// Export block edits into PDF via pdf-lib (double-click pdfBlockEdit or Ctrl+Shift+E when editor active)
async function exportBlockEditsToPdf() {
  if (!state.adapter || state.adapter.type !== 'pdf' || !state.file) {
    setOcrStatus('Экспорт блоков: нужен открытый PDF');
    return;
  }
  const allBlocks = blockEditor.exportAllBlocks();
  if (!Object.keys(allBlocks).length) {
    setOcrStatus('Нет блоков для экспорта');
    return;
  }
  try {
    setOcrStatus('Экспорт блоков в PDF...');
    const arrayBuffer = await state.file.arrayBuffer();
    const canvasW = parseFloat(els.canvas.style.width) || els.canvas.width;
    const canvasH = parseFloat(els.canvas.style.height) || els.canvas.height;
    const pdfBlob = await blockEditor.exportBlocksToPdf(arrayBuffer, { width: canvasW, height: canvasH });
    const url = safeCreateObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.docName || 'document'}-edited.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setOcrStatus('Блоки экспортированы в PDF');
  } catch (err) {
    setOcrStatus(`Ошибка экспорта блоков: ${err?.message || 'неизвестная'}`);
  }
}

els.pdfBlockEdit?.addEventListener('dblclick', exportBlockEditsToPdf);
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'E' && blockEditor.active) {
    e.preventDefault();
    exportBlockEditsToPdf();
  }
});

// ─── Image Insertion ─────────────────────────────────────────────────────────
els.insertImageInput?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleImageInsertion(file);
  e.target.value = '';
});

// ─── Watermark (pdf-lib: saves into actual PDF) ────────────────────────────
els.addWatermark?.addEventListener('click', async () => {
  if (!state.adapter) return;
  const text = await nrPrompt('Текст водяного знака:', 'КОНФИДЕНЦИАЛЬНО');
  if (!text) return;

  // Visual preview on canvas
  addWatermarkToPage(text);

  // If PDF, also save into PDF file via pdf-lib
  if (state.adapter?.type === 'pdf' && state.file) {
    try {
      setOcrStatus('Добавление водяного знака в PDF...');
      const arrayBuffer = await state.file.arrayBuffer();
      const blob = await addWatermarkToPdf(arrayBuffer, text, {
        fontSize: 60,
        opacity: 0.25,
        rotation: -45,
      });
      const url = safeCreateObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-watermark.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`Водяной знак "${text}" — PDF сохранён`);
    } catch (err) {
      setOcrStatus(`Водяной знак "${text}" добавлен на canvas (PDF ошибка: ${err.message})`);
    }
  } else {
    setOcrStatus(`Водяной знак "${text}" добавлен`);
  }
});

// ─── Stamps (pdf-lib: saves into actual PDF) ────────────────────────────────
els.addStamp?.addEventListener('click', async () => {
  if (!state.adapter) return;
  const types = ['approved', 'rejected', 'draft', 'confidential', 'copy'];
  const labels = ['УТВЕРЖДЕНО', 'ОТКЛОНЕНО', 'ЧЕРНОВИК', 'КОНФИДЕНЦИАЛЬНО', 'КОПИЯ'];
  const choice = await nrPrompt(`Выберите штамп (1-5):\n${labels.map((l, i) => `${i + 1}. ${l}`).join('\n')}`, '1');
  const idx = parseInt(choice, 10) - 1;
  if (idx >= 0 && idx < types.length) {
    // Visual preview on canvas
    addStampToPage(types[idx]);

    // If PDF, save into PDF via pdf-lib
    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        const arrayBuffer = await state.file.arrayBuffer();
        const blob = await addStampToPdf(arrayBuffer, types[idx], { pageNum: state.currentPage });
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-stamp.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus(`Штамп "${labels[idx]}" — PDF сохранён`);
      } catch (err) {
        setOcrStatus(`Штамп "${labels[idx]}" добавлен на canvas`);
      }
    } else {
      setOcrStatus(`Штамп "${labels[idx]}" добавлен`);
    }
  }
});

// ─── Signature ──────────────────────────────────────────────────────────────
els.addSignature?.addEventListener('click', () => {
  if (!state.adapter) return;
  openSignaturePad();
});

// ─── Page Organizer UI (extracted to modules/page-organizer-ui.js) ───────────
initPageOrganizerUI({ openFile });

// ─── Merge / Split ──────────────────────────────────────────────────────────
els.mergePages?.addEventListener('click', () => mergePdfFiles());
els.splitPages?.addEventListener('click', () => splitPdfPages());

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

els.conversionInvoice?.addEventListener('click', async () => {
  if (!state.adapter) return;
  const text = els.pageText?.value || '';
  const result = applyPlugin('invoice', text, state.currentPage);
  if (result) {
    setOcrStatus(`Плагин "Счёт": ${result.blocks?.length || 0} блоков извлечено`);
    pushDiagnosticEvent('plugin.invoice', { page: state.currentPage, blocks: result.blocks?.length || 0 });
    exportPluginResult('invoice', result);
  }
});

els.conversionReport?.addEventListener('click', async () => {
  if (!state.adapter) return;
  const text = els.pageText?.value || '';
  const result = applyPlugin('report', text, state.currentPage);
  if (result) {
    setOcrStatus(`Плагин "Отчёт": ${result.blocks?.length || 0} блоков извлечено`);
    pushDiagnosticEvent('plugin.report', { page: state.currentPage, blocks: result.blocks?.length || 0 });
    exportPluginResult('report', result);
  }
});

els.conversionTable?.addEventListener('click', async () => {
  if (!state.adapter) return;
  const text = els.pageText?.value || '';
  const result = applyPlugin('custom-table', text, state.currentPage);
  if (result) {
    setOcrStatus(`Плагин "Таблица": ${result.rows?.length || 0} строк извлечено`);
    pushDiagnosticEvent('plugin.table', { page: state.currentPage, rows: result.rows?.length || 0 });
    exportPluginResult('custom-table', result);
  }
});

els.importDjvuDataJson.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importDjvuDataJson(file);
  e.target.value = '';
});
els.searchBtn.addEventListener('click', async () => {
  await searchInPdf(els.searchInput.value);
});
els.searchInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await searchInPdf(els.searchInput.value);
  }
});
els.searchScope.addEventListener('change', () => {
  saveSearchScope();
});

els.searchPrev.addEventListener('click', async () => {
  await jumpToSearchResult(state.searchCursor - 1);
});

els.searchNext.addEventListener('click', async () => {
  await jumpToSearchResult(state.searchCursor + 1);
});

const debouncedUpdateSearchToolbarRows = debounce(updateSearchToolbarRows, 150);
window.addEventListener('resize', debouncedUpdateSearchToolbarRows);
els.searchInput?.addEventListener('input', debouncedUpdateSearchToolbarRows);
els.searchScope?.addEventListener('change', debouncedUpdateSearchToolbarRows);

els.shortcutsHelp?.addEventListener('click', showShortcutsHelp);
els.toggleSidebar?.addEventListener('click', () => toggleLayoutState('sidebarHidden'));
els.toggleToolsBar?.addEventListener('click', () => toggleLayoutState('toolsHidden'));
els.toggleTextTools?.addEventListener('click', () => toggleLayoutState('textHidden'));
els.toggleSearchTools?.addEventListener('click', () => toggleLayoutState('searchToolsHidden'));
els.toggleAnnotTools?.addEventListener('click', () => toggleLayoutState('annotToolsHidden'));
els.toggleTextToolsInline?.addEventListener('click', () => toggleLayoutState('textHidden'));

els.fullscreen.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

let _wheelZoomPending = false;
els.canvasWrap.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const step = e.deltaY < 0 ? 0.08 : -0.08;
  state.zoom = Math.min(4, Math.max(0.3, state.zoom + step));
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  if (!_wheelZoomPending) {
    _wheelZoomPending = true;
    requestAnimationFrame(async () => {
      _wheelZoomPending = false;
      await renderCurrentPage();
    });
  }
}, { passive: false });


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
});

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
    }
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
  if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    showShortcutsHelp();
  }
});

document.addEventListener('visibilitychange', syncReadingTimerWithVisibility);
window.addEventListener('beforeunload', () => {
  stopReadingTimer(true);
  if (pdfEditState.dirty) persistEdits();
  revokeAllTrackedUrls();
  clearPageRenderCache();
  terminateTesseract().catch(() => {});
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

// ─── Initialize Quick Actions ─────────────────────────────────────────────
initQuickActions({
  container: document.querySelector('.document-viewport') || document.body,
  onAction: (id, text) => {
    if (id === 'search' && text) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) { searchInput.value = text; searchInput.dispatchEvent(new Event('input')); }
    }
  },
});

// ─── Initialize Extended Hotkeys ──────────────────────────────────────────
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
