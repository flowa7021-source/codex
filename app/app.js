// ─── Platform Detection (must be first) ─────────────────────────────────────
// initPlatform() starts async Tauri API detection. All platform functions
// call ensurePlatformReady() internally, so they're safe even if this
// hasn't resolved yet when event handlers fire.
import { initPlatform } from './modules/platform.js';
initPlatform().catch(err => console.warn('[platform] init:', err?.message));

// ─── Module Imports ─────────────────────────────────────────────────────────
import { emit, on, once, removeAllListeners as removeAllBusListeners } from './modules/event-bus.js';
import { debounce } from './modules/utils.js';
import { state, defaultHotkeys, hotkeys, setHotkeys, els } from './modules/state.js';
import { ensurePdfJs, preloadPdfRuntime } from './modules/loaders.js';
import { getCachedPage, clearPageRenderCache, evictPageFromCache, revokeAllTrackedUrls, pageRenderCache, objectUrlRegistry } from './modules/perf.js';
import { toolStateMachine, initToolModeDeps } from './modules/tool-modes.js';
import { pushDiagnosticEvent, clearDiagnostics, exportDiagnostics, runRuntimeSelfCheck, setupRuntimeDiagnostics, initDiagnosticsDeps, novaLog, exportLogsAsJson, copyLogsToClipboard, clearActivityLog, getLogEntries } from './modules/diagnostics.js';
import { setLanguage, getLanguage, loadLanguage, applyI18nToDOM } from './modules/i18n.js';
import { blockEditor } from './modules/pdf-advanced-edit.js';
import { formManager } from './modules/pdf-forms.js';
import { exportAnnotationsAsSvg, exportAnnotationsAsPdf } from './modules/annotation-export.js';
import { applyPlugin } from './modules/conversion-plugins.js';
import { parseDocxAdvanced, formattedBlocksToHtml, mergeDocxIntoWorkspace } from './modules/docx-import-advanced.js';
import { getPageQualitySummary, markLowConfidenceWords } from './modules/ocr-word-confidence.js';
import { deleteOcrData, listOcrDocuments, getOcrStorageSize } from './modules/ocr-storage.js';
import { recognizeWithBoxes, terminateTesseract } from './modules/tesseract-adapter.js';
import { convertPdfToDocxCompat as convertPdfToDocx } from './modules/conversion-pipeline.js';
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
import { bindUndoRedoKeys, undoRedoManager } from './modules/undo-redo.js';
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
import { EraseUIController, EraseTool } from './modules/erase-tool.js';
import { initAutosave, triggerAutosave, markCleanExit, checkForRecovery, clearRecoveryData, startAutosaveTimer, stopAutosaveTimer, applyRecoveredSnapshot } from './modules/autosave.js';
import { initAutoScroll, startAutoScroll, stopAutoScroll, toggleAutoScroll, setAutoScrollSpeed, isAutoScrolling } from './modules/auto-scroll.js';
import { initInlineEditorDeps, openInlineEditPanel } from './modules/pdf-inline-editor.js';
import { thumbnailStore } from './modules/thumbnail-store.js';

// ─── Wave 8: Decomposition Facade Modules ────────────────────────────────
import * as AppPersistence from './modules/app-persistence.js';
import { OcrSearchIndex } from './modules/ocr-search.js';
import { renderPage as pipelineRenderPage, schedulePreRender, invalidateCache, getCacheStats } from './modules/render-pipeline.js';
import { AnnotationController } from './modules/annotations-core.js';

// ─── Wave 10: Page Organizer, Floating Search, XPS Support ───────────────
import { getPageInfoList, reorderPages, deletePages, rotatePages, extractPages, insertPages, insertBlankPage, duplicatePages, reversePages, createOrganizerState, togglePageSelection, selectPageRange, computeReorderFromDrag } from './modules/page-organizer.js';
import { initFloatingSearch } from './modules/floating-search.js';
import { XpsAdapter } from './modules/xps-adapter.js';
import { registerProvider, getProviders, authenticate, listFiles, openFile as cloudOpenFile, saveFile, getShareLink, signOut, getConnectionStatus, onStatusChange, createGoogleDriveProvider, createOneDriveProvider, createDropboxProvider } from './modules/cloud-integration.js';
import { summarizeText, extractTags, semanticSearch, generateToc } from './modules/ai-features.js';
import { nrPrompt, nrConfirm } from './modules/modal-prompt.js';
import * as SettingsController from './modules/settings-controller.js';
import { initAnnotationControllerDeps, invalidateAnnotationCaches, getCurrentAnnotationCtx, loadStrokes, saveStrokes, loadComments, saveComments, clearDocumentCommentStorage, renderCommentList, clearDocumentAnnotationStorage, updateOverlayInteractionState, setDrawMode, denormalizePoint, renderAnnotations, _applyTextMarkupFromSelection, getCanvasPointFromEvent, beginStroke, moveStroke, endStroke, undoStroke, clearStrokes, clearComments, exportAnnotatedPng, exportAnnotationsJson, importAnnotationsJson, showShortcutsHelp, exportAnnotationBundleJson, importAnnotationBundleJson } from './modules/annotation-controller.js';
import { initRenderControllerDeps, _ocrWordCache, renderCurrentPage, safeCreateObjectURL, renderTextLayer, handleImageInsertion, addWatermarkToPage, addStampToPage, openSignaturePad } from './modules/render-controller.js';
import { crashTelemetry, recordCrashEvent, recordSuccessfulOperation, getSessionHealth, initCrashTelemetry } from './modules/crash-telemetry.js';
import { pdfEditState, initExportControllerDeps, setPageEdits, undoPageEdit, redoPageEdit, getEditHistory, persistEdits, loadPersistedEdits, generateDocxBlob, generateDocxWithImages, importDocxEdits, exportSessionHealthReport, capturePageAsImageData } from './modules/export-controller.js';
import { ocrSearchIndex, searchOcrIndex, downloadOcrTextExport, canSearchCurrentDoc, loadSearchScope, saveSearchScope, copySearchResultsSummary, exportSearchResultsSummaryTxt, exportSearchResultsCsv, exportSearchResultsJson, importSearchResultsJson, importSearchResultsCsv, clearSearchResults, renderSearchResultsList, renderSearchHistory, exportSearchHistoryJson, exportSearchHistoryTxt, copySearchHistory, importSearchHistoryJson, clearSearchHistory, searchInPdf, jumpToSearchResult, initSearchControllerDeps } from './modules/search-controller.js';
import { initOcrControllerDeps, getBatchOcrProgress, clearOcrRuntimeCaches, estimatePageSkewAngle, setOcrStatus, setOcrRegionMode, drawOcrSelectionPreview, runOcrOnRect, runOcrForCurrentPage, extractTextForPage, cancelAllOcrWork, scheduleBackgroundOcrScan, resetTesseractAvailability } from './modules/ocr-controller.js';
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
import { highlightCurrentPage as highlightThumbPage, selectAllPages, clearPageSelection } from './modules/thumbnail-renderer.js';
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
import { initSettings } from './modules/init-settings.js';
import { initEventBindings } from './modules/init-event-bindings.js';

// ─── Phase 0: Error Handling (delegated to init-error-handling.js) ───────────
const { withErrorBoundary } = initErrorHandling({
  pushDiagnosticEvent, recordCrashEvent, initCrashTelemetry,
  showErrorFallback, showCriticalErrorScreen, toastError, els, state,
});

// Pre-warm PDF.js worker during idle time so first PDF open is faster
preloadPdfRuntime();

// ─── Settings proxy wrappers (delegated to init-settings.js) ─────────────────
const {
  defaultSettings,
  loadAppSettings,
  saveAppSettings,
  applyUiSizeSettings,
  getOcrLang,
  importDjvuDataJson,
  loadTheme,
  toggleTheme,
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
  setBookmarksStatus,
  _exportBookmarksJson,
  _importBookmarksJson,
  loadBookmarks,
  saveBookmarks,
  renderBookmarks,
  addBookmark,
  _clearBookmarks,
} = initSettings({
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
});

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

// ─── Event Bindings (delegated to init-event-bindings.js) ────────────────────
initEventBindings({
  els, safeOn, debounce, state,
  openSettingsModal, closeSettingsModal, saveSettingsFromModal, resetUiSizeToDefaults, previewUiSizeFromModal,
  exportDiagnostics, clearDiagnostics, runRuntimeSelfCheck,
  navigateHistoryBack, navigateHistoryForward,
  saveHotkeys, resetHotkeys, autoFixHotkeys, applyCommonHotkeys, setSettingsStatus,
  setSidebarCompactMode, setSidebarSectionsCollapsed,
  toggleAdvancedPanelsState, toggleLayoutState, updateSearchToolbarRows,
  exportWorkspaceBundleJson, importWorkspaceBundleJson, importOcrJson,
  saveCloudSyncUrl, pushWorkspaceToCloud, pullWorkspaceFromCloud, setStage4Status,
  toggleCollaborationChannel, broadcastWorkspaceSnapshot,
  resetReadingProgress, resetReadingTime, clearVisitTrail, saveReadingGoal, clearReadingGoal,
  clearSearchHistory, exportSearchHistoryJson, exportSearchHistoryTxt, copySearchHistory, importSearchHistoryJson,
  clearSearchResults, exportSearchResultsJson, exportSearchResultsCsv, exportSearchResultsSummaryTxt,
  importSearchResultsJson, importSearchResultsCsv, copySearchResultsSummary,
  toggleTheme,
  downloadCurrentFile, printCanvasPage, refreshPageText, copyPageText, exportPageText,
  exportCurrentDocToWord, downloadOcrTextExport,
  searchInPdf, jumpToSearchResult, saveSearchScope,
  mergePdfFiles, splitPdfPages,
  importDjvuDataJson, showShortcutsHelp, clearRecent,
});

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

// ─── Navigation & Zoom (delegated to init-navigation.js) ─────────────────────
initNavigation({
  state, els, debounce, safeOn,
  renderCurrentPage, renderPagePreviews, goToPage, fitWidth, fitPage,
  clearOcrRuntimeCaches, scheduleBackgroundOcrScan, evictPageFromCache,
});

// ─── Complex handlers kept in app.js ─────────────────────────────────────────
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
// ─── OCR & Text Processing (delegated to init-ocr.js) ────────────────────────
const { refreshOcrStorageInfo } = initOcr({
  state, els, safeOn, setOcrStatus, getOcrLang,
  runOcrForCurrentPage, setOcrRegionMode, cancelAllOcrWork, resetTesseractAvailability,
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

safeOn(document.getElementById('convertToPdfBtn'), 'click', async () => {
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
    if (title._sidebarToggleInit) return;
    title._sidebarToggleInit = true;
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
  stopReadingTimer(true);
  if (pdfEditState.dirty) persistEdits();
  revokeAllTrackedUrls();
  clearPageRenderCache();
  terminateTesseract().catch((err) => { console.warn('[ocr] error:', err?.message); });
});

// ─── Global Keyboard Handlers (delegated to init-keyboard.js) ────────────────
initKeyboard({
  state, els, hotkeys, stringifyHotkeyEvent,
  navigateHistoryBack, navigateHistoryForward, addBookmark,
  setDrawMode, setOcrRegionMode, setOcrStatus,
  undoStroke, undoPageEdit, redoPageEdit, showShortcutsHelp,
  closeSettingsModal, blockEditor, renderCurrentPage, undoRedoManager,
  saveCurrentFile: async () => {
    if (!state.pdfBytes) return;
    const { saveOrDownload } = await import('./modules/platform.js');
    const blob = new Blob([state.pdfBytes], { type: 'application/pdf' });
    await saveOrDownload(blob, state.docName || 'document.pdf', [{ name: 'PDF', extensions: ['pdf'] }]);
    state.isDirty = false;
  },
  saveCurrentFileAs: async () => {
    if (!state.pdfBytes) return;
    const { saveOrDownload } = await import('./modules/platform.js');
    const blob = new Blob([state.pdfBytes], { type: 'application/pdf' });
    const baseName = (state.docName || 'document').replace(/\.[^.]+$/, '');
    await saveOrDownload(blob, `${baseName}-copy.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
    state.isDirty = false;
  },
});

// Warn on close if unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (state.isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

safeOn(document, 'visibilitychange', syncReadingTimerWithVisibility);

renderRecent();

// ─── Wire up module dependency injection ────────────────────────────────────
initDiagnosticsDeps({
  getEditHistory,
  getBatchOcrProgress,
  getSessionHealth,
  getOcrSearchIndexSize: () => ocrSearchIndex.pages.size,
  getToolMode: () => toolStateMachine.current,
});
/** @type {EraseUIController|null} */
let _eraseUIController = null;

function activateEraseOverlay() {
  if (_eraseUIController) _eraseUIController.destroy();
  const canvas = els.annotationCanvas;
  if (!canvas) return;
  canvas.style.pointerEvents = 'auto';
  canvas.style.zIndex = '20';
  _eraseUIController = new EraseUIController(
    /** @type {HTMLCanvasElement} */ (canvas),
    async (rect, subMode) => {
      const pm = window._advancedToolsHandle?.docModel?.pages?.get(state.currentPage);
      if (!pm) return;
      const eraser = new EraseTool(pm, state.pdfLibDoc ?? null, async (bytes) => {
        state.pdfBytes = bytes;
        reloadPdfFromBytes(bytes);
      });
      if (subMode === 'smart' || subMode === 'word') {
        await eraser.smartErase({ x: rect.x, y: rect.y }, { granularity: subMode === 'word' ? 'word' : undefined });
      } else {
        await eraser.contentErase(rect);
      }
    },
    {
      pageWidth: state.adapter?.pageWidth ?? 595,
      pageHeight: state.adapter?.pageHeight ?? 842,
      zoom: state.zoom ?? 1,
    },
  );
}

function deactivateEraseOverlay() {
  if (_eraseUIController) {
    _eraseUIController.destroy();
    _eraseUIController = null;
  }
  const canvas = els.annotationCanvas;
  if (!canvas) return;
  if (!state.drawEnabled) {
    canvas.style.pointerEvents = '';
    canvas.style.zIndex = '';
  }
}

initToolModeDeps({
  renderAnnotations,
  updateOverlayInteractionState,
  setOcrStatus,
  activateEraseOverlay,
  deactivateEraseOverlay,
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
  onAfterOpen: (adapter, pageCount, docName) => {
    thumbnailStore.init(adapter, pageCount, docName);
    // Urgently generate thumbnail for the first page, then background the rest
    thumbnailStore.generateUrgent([1, 2, 3]).catch(() => {});
    // After urgent pages, schedule background generation for all pages
    setTimeout(() => thumbnailStore.scheduleBackground(state.currentPage || 1), 500);
  },
});
// When a thumbnail becomes ready, re-render the current page if it has no
// full-res cache yet — the thumbnail will appear immediately as a fallback.
thumbnailStore.onThumbnailReady = (pageNum) => {
  if (state.currentPage !== pageNum) return;
  try {
    const cached = getCachedPage(pageNum);
    if (!cached) renderCurrentPage().catch(() => {});
  } catch (_) {}
};
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
  safeOn(els.cfgAppLang, 'change', () => {
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
  renderPage: async (pageNum, canvas) => {
    if (!state.adapter) return;
    await state.adapter.renderPage(pageNum, canvas, { zoom: state.zoom, rotation: state.rotation });
  },
  getPageCount: () => state.pageCount,
  getCurrentPage: () => state.currentPage,
  setCurrentPage: async (n) => { const p = Math.max(1, Math.min(n, state.pageCount)); state.currentPage = p; els.pageInput.value = String(p); await renderCurrentPage(); },
  getZoom: () => state.zoom,
  viewport: document.querySelector('.document-viewport'),
  canvas: els.canvas,
});

// Expose event-bus for inter-module communication
window._eventBus = { emit, on, once, removeAllBusListeners };

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
  state, els, safeOn, openFile, renderCurrentPage, clearPageRenderCache, TabManager,
});

// ─── Inline PDF Text Editor (Python sidecar) ───────────────────────────────
initInlineEditorDeps({
  reloadPdfFromBytes,
  renderCurrentPage,
  setOcrStatus,
  toastSuccess,
  toastError,
  pushDiagnosticEvent,
});
document.getElementById('openInlineTextEdit')?.addEventListener('click', openInlineEditPanel);

// ─── Bookmark & Notes Controllers ────────────────────────────────────────
initBookmarkController();
initNotesController();

// ─── Toolbox (PDF24-style batch processing) ──────────────────────────────
import('./modules/toolbox-controller.js').then(m => m.initToolbox()).catch(() => {});
// ─── Full Toolbox Overlay (PDF24-style grid) ──────────────────────────────
import('./modules/toolbox-grid.js').then(m => m.initToolboxOverlay()).catch(() => {});

// ─── Windows Shell Context Menu Handler ──────────────────────────────────
// Listens for 'cli-action' events emitted by Tauri when launched from Explorer.
import('./modules/context-menu-handler.js').then(m => m.initContextMenuHandler()).catch(() => {});

// Listen for page navigation events from bookmark-controller
on('novareader-goto-page', async (detail) => {
  const page = detail?.page;
  if (page && page >= 1 && page <= state.pageCount) {
    state.currentPage = page;
    await renderCurrentPage();
    highlightThumbPage();
    updateBookmarkButton();
  }
});

// Page multi-select buttons
document.getElementById('selectAllPages')?.addEventListener('click', selectAllPages);
document.getElementById('clearPageSelection')?.addEventListener('click', clearPageSelection);

// Re-open file after page operations (rotate, delete from context menu)
document.addEventListener('novareader-reopen-file', async (e) => {
  const file = /** @type {any} */ (e).detail?.file;
  if (file) await openFile(file);
});

// Hook page navigation to update bookmark button and thumbnails
on('page-rendered', () => {
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
    onReplace: async (replaceText, matchIndex) => {
      // Replace single match in the current page's text
      if (!state.adapter || !replaceText) return;
      const pageText = String(els.pageText?.value || '');
      const query = window._floatingSearch?.getQuery?.() || '';
      if (!query || !pageText) return;
      // Find the Nth occurrence and replace it
      let count = 0;
      const updated = pageText.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => {
        return count++ === matchIndex ? replaceText : m;
      });
      if (updated !== pageText) {
        /** @type {any} */ (els.pageText).value = updated;
        setPageEdits(state.currentPage, updated);
        persistEdits();
        state.isDirty = true;
        setOcrStatus(`Заменено: "${query}" → "${replaceText}"`);
      }
    },
    onReplaceAll: async (replaceText) => {
      if (!state.adapter || !replaceText) return;
      const query = window._floatingSearch?.getQuery?.() || '';
      if (!query) return;
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let totalReplaced = 0;
      // Replace across all pages
      for (let p = 1; p <= state.pageCount; p++) {
        let text = '';
        try { text = await state.adapter.getText(p) || ''; } catch (_e) { continue; }
        const ocrCache = _ocrWordCache.get(p);
        if (!text && ocrCache) {
          text = ocrCache.map(w => w.text).join(' ');
        }
        if (!text) continue;
        const updated = text.replace(regex, () => { totalReplaced++; return replaceText; });
        if (updated !== text) {
          setPageEdits(p, updated);
        }
      }
      if (totalReplaced > 0) {
        persistEdits();
        state.isDirty = true;
        // Update current page display
        const currentEdits = /** @type {any} */ (window).__pdfEditState?.edits?.get(state.currentPage);
        if (currentEdits && els.pageText) /** @type {any} */ (els.pageText).value = currentEdits;
        setOcrStatus(`Заменено ${totalReplaced} вхождений "${query}" → "${replaceText}"`);
      } else {
        setOcrStatus(`"${query}" не найдено`);
      }
    },
    onClose: () => {},
  }
);
window._xpsAdapter = XpsAdapter;
window._cloud = { registerProvider, getProviders, authenticate, listFiles, openFile: cloudOpenFile, saveFile, getShareLink, signOut, getConnectionStatus, onStatusChange, createGoogleDriveProvider, createOneDriveProvider, createDropboxProvider };
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
window._activityLog = { novaLog, exportLogsAsJson, copyLogsToClipboard, clearActivityLog, getLogEntries };
window._minimap = { initMinimap, updateMinimap, showMinimap, hideMinimap, toggleMinimap };
window._autoScroll = { startAutoScroll, stopAutoScroll, toggleAutoScroll, setAutoScrollSpeed, isAutoScrolling };
window._autosave = { triggerAutosave, markCleanExit, checkForRecovery, clearRecoveryData, startAutosaveTimer, stopAutosaveTimer };
window._commandPalette = { showCommandPalette, hideCommandPalette, registerCommand };

// ─── Mark initialization complete ────────────────────────────────────────
state.initComplete = true;
pushDiagnosticEvent('app.init-complete', { listeners: _listenerRegistry.length, version: '4.0.0' });
