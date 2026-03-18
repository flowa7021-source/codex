// ─── Module Imports ─────────────────────────────────────────────────────────
import { APP_VERSION, NOVAREADER_PLAN_PROGRESS_PERCENT, SIDEBAR_SECTION_CONFIG, TOOLBAR_SECTION_CONFIG, OCR_MIN_DPI, CSS_BASE_DPI, OCR_MAX_SIDE_PX, OCR_MAX_PIXELS, OCR_SLOW_TASK_WARN_MS, OCR_HANG_WARN_MS, OCR_SOURCE_MAX_PIXELS, OCR_SOURCE_CACHE_MAX_PIXELS, OCR_SOURCE_CACHE_TTL_MS } from './modules/constants.js';
import { throttle, debounce, yieldToMainThread, loadImage, downloadBlob } from './modules/utils.js';
import { state, defaultHotkeys, hotkeys, setHotkeys, els } from './modules/state.js';
import { ensurePdfJs, ensureDjVuJs, getPdfjsLib } from './modules/loaders.js';
import { perfMetrics, recordPerfMetric, getPerfSummary, cacheRenderedPage, getCachedPage, clearPageRenderCache, revokeAllTrackedUrls, pageRenderCache, objectUrlRegistry } from './modules/perf.js';
import { ToolMode, toolStateMachine, activateAnnotateMode, deactivateAnnotateMode, activateOcrRegionMode, deactivateOcrRegionMode, activateTextEditMode, deactivateTextEditMode, activateSearchMode, deactivateSearchMode, initToolModeDeps } from './modules/tool-modes.js';
import { pushDiagnosticEvent, clearDiagnostics, exportDiagnostics, runRuntimeSelfCheck, setupRuntimeDiagnostics, initDiagnosticsDeps } from './modules/diagnostics.js';
import { setLanguage, getLanguage, loadLanguage, t, applyI18nToDOM, getAvailableLanguages } from './modules/i18n.js';
import { parseEpub, EpubAdapter } from './modules/epub-adapter.js';
import { postCorrectByLanguage, scoreTextByLanguage, detectLanguage, getSupportedLanguages, getLanguageName } from './modules/ocr-languages.js';
import { blockEditor } from './modules/pdf-advanced-edit.js';
import { formManager } from './modules/pdf-forms.js';
import { progressiveLoader } from './modules/progressive-loader.js';
import { exportAnnotationsAsSvg, exportAnnotationsAsPdf } from './modules/annotation-export.js';
import { applyPlugin, pluginToDocxXml, detectApplicablePlugins } from './modules/conversion-plugins.js';
import { parseDocxAdvanced, formattedBlocksToHtml, mergeDocxIntoWorkspace } from './modules/docx-import-advanced.js';
import { analyzeTextDensity, computeOcrZoom, hasSmallText } from './modules/ocr-adaptive-dpi.js';
import { getPageQualitySummary, markLowConfidenceWords } from './modules/ocr-word-confidence.js';
import { saveOcrData, loadOcrData, savePageOcrText, getPageOcrText, deleteOcrData, listOcrDocuments, getOcrStorageSize } from './modules/ocr-storage.js';
import { initTesseract, recognizeTesseract, recognizeWithBoxes, isTesseractAvailable, getTesseractStatus, terminateTesseract, resetTesseractAvailability, initTesseractPool, recognizeWithPool, terminateTesseractPool, isTesseractPoolReady, getRecommendedPoolSize } from './modules/tesseract-adapter.js';
import { convertPdfToDocx, extractStructuredContent } from './modules/docx-converter.js';
import { mergePdfDocuments, splitPdfDocument, splitPdfIntoIndividual, fillPdfForm, getPdfFormFields, addWatermarkToPdf, addStampToPdf, addSignatureToPdf, exportAnnotationsIntoPdf, rotatePdfPages, getPdfMetadata, parsePageRange as parsePageRangeLib } from './modules/pdf-operations.js';
import { PdfRedactor, REDACTION_PATTERNS } from './modules/pdf-redact.js';
import { pdfCompare } from './modules/pdf-compare.js';
import { pdfOptimizer } from './modules/pdf-optimize.js';
import { addHeaderFooter, addBatesNumbering, flattenPdf, checkAccessibility, autoFixAccessibility, addPageNumbers } from './modules/pdf-pro-tools.js';
import { annotationManager, HIGHLIGHT_COLORS, ANNOTATION_TYPES } from './modules/pdf-annotations-pro.js';
import { batchOcr, createSearchablePdf, detectScannedDocument, autoDetectLanguage } from './modules/ocr-batch.js';

// ─── Phase 2+ Module Imports ───────────────────────────────────────────────
import { toast, toastSuccess, toastError, toastWarning, toastInfo, toastProgress, dismissAllToasts } from './modules/toast.js';
import { initTooltips } from './modules/tooltip.js';
import { initContextMenu } from './modules/context-menu.js';
import { initA11y, announce, prefersReducedMotion } from './modules/a11y.js';
import { undoRedoManager, bindUndoRedoKeys } from './modules/undo-redo.js';
import { VIEW_MODES, initViewModes, setViewMode, getCurrentMode, navigateInMode, getTwoUpPages, renderTwoUp } from './modules/view-modes.js';
import { preprocessForOcr } from './modules/ocr-preprocess.js';
import { convertToHtml, downloadHtml } from './modules/html-converter.js';
import { initEnhancedZoom, ZOOM_PRESETS, zoomToNextPreset, zoomToPrevPreset, zoomToPreset, smoothZoomTo, startMarqueeZoom, saveDocumentZoom, loadDocumentZoom } from './modules/enhanced-zoom.js';
import { initTouchGestures, isTouchDevice, setupVirtualKeyboardAdaptation } from './modules/touch-gestures.js';
import { saveReadingPosition, loadReadingPosition, initMinimap, updateMinimap, setupLinkFollowing, renderThumbnailGrid } from './modules/navigation.js';
import { batchConverter } from './modules/batch-convert.js';
import { applyTextEdits, addTextBlock, findAndReplace, spellCheck, getAvailableFonts } from './modules/pdf-text-edit.js';
import { setPassword, cleanMetadata, getSecurityInfo, sanitizePdf } from './modules/pdf-security.js';
import { correctOcrText, buildDictionary, computeBigramFreqs, recoverParagraphs, computeQualityScore } from './modules/ocr-post-correct.js';
import { extractTextInReadingOrder, extractMultiPageText, downloadText } from './modules/text-extractor.js';
import { WorkerPool, initOcrPool, getOcrPool, runInWorker } from './modules/worker-pool.js';
import { openDatabase, cachePageRender, getCachedPageRender, cacheOcrResult, getCachedOcrResult, saveAnnotations, loadAnnotations, clearDocumentCache, getStorageUsage, clearAllCache } from './modules/indexed-storage.js';
import { initErrorHandler, reportError, classifyError, registerRecovery, onError, saveStateSnapshot, restoreStateSnapshot, withRetry, getErrorLog, ERROR_CODES } from './modules/error-handler.js';
import { convertToPdfA, checkPdfACompliance } from './modules/pdf-a-converter.js';
import { initDragDrop, initAnnotationDrop } from './modules/drag-drop.js';
import { VirtualScroll } from './modules/virtual-scroll.js';
import { initMemoryManager, createTrackedUrl, revokeTrackedUrl, revokeAllUrls, acquireCanvas, releaseCanvas, getMemoryStats, forceCleanup } from './modules/memory-manager.js';
import { buildTextLayer, highlightSearchMatches, clearSearchHighlights, getSelectedText } from './modules/text-layer-builder.js';
import { analyzeLayout, detectTable, sortByReadingOrder, tableToHtml } from './modules/layout-analysis.js';
import { BatchOcrEngine } from './modules/batch-ocr-enhanced.js';
import { initRibbonToolbar, switchTab, setContextualTab } from './modules/ribbon-toolbar.js';
import { TabManager } from './modules/tab-manager.js';
import { parsePageRange as parsePrintRange, getPagesToPrint, arrangeBooklet, arrangeNup, triggerPrint } from './modules/pdf-print.js';
import { createPdfFromImages, createBlankPdf, canvasesToPdf } from './modules/pdf-create.js';
import { initQuickActions, hideQuickActions } from './modules/quick-actions.js';
import { initHotkeys, onHotkey, registerHotkeyHandlers, isSpaceHeld, getBindings, getCheatsheet } from './modules/hotkeys.js';
import { CbzAdapter, parseCbz } from './modules/cbz-adapter.js';

// ─── Wave 8: Decomposition Facade Modules ────────────────────────────────
import * as AppPersistence from './modules/app-persistence.js';
import { OcrSearchIndex } from './modules/ocr-search.js';
import { renderPage as pipelineRenderPage, schedulePreRender, invalidateCache, getCacheStats } from './modules/render-pipeline.js';
import { AnnotationController } from './modules/annotations-core.js';

// ─── Wave 10: Page Organizer, Floating Search, XPS Support ───────────────
import { getPageInfoList, reorderPages, deletePages, rotatePages, extractPages, insertPages, insertBlankPage, duplicatePages, reversePages, createOrganizerState, togglePageSelection, selectPageRange, computeReorderFromDrag } from './modules/page-organizer.js';
import { initFloatingSearch } from './modules/floating-search.js';
import { XpsAdapter, parseXps } from './modules/xps-adapter.js';
import { registerProvider, getProviders, authenticate, listFiles, openFile as cloudOpenFile, saveFile, getShareLink, signOut, getConnectionStatus, onStatusChange, createGoogleDriveProvider, createOneDriveProvider, createDropboxProvider, MODULE_STATUS as CLOUD_STATUS } from './modules/cloud-integration.js';
import { MODULE_STATUS as AI_STATUS } from './modules/ai-features.js';
import { summarizeText, extractTags, semanticSearch, generateToc } from './modules/ai-features.js';
import { nrPrompt, nrConfirm } from './modules/modal-prompt.js';
import * as SettingsController from './modules/settings-controller.js';
import { initAnnotationControllerDeps, annotationKey, commentKey, invalidateAnnotationCaches, getCurrentAnnotationCtx, getAnnotationDpr, loadStrokes, saveStrokes, loadComments, saveComments, clearDocumentCommentStorage, renderCommentList, clearDocumentAnnotationStorage, updateOverlayInteractionState, setDrawMode, normalizePoint, denormalizePoint, applyStrokeStyle, drawStroke, renderAnnotations, _applyTextMarkupFromSelection, getCanvasPointFromEvent, beginStroke, moveStroke, endStroke, undoStroke, clearStrokes, clearComments, exportAnnotatedPng, exportAnnotationsJson, importAnnotationsJson, showShortcutsHelp, exportAnnotationBundleJson, importAnnotationBundleJson } from './modules/annotation-controller.js';
import { AsyncLock } from './modules/async-lock.js';
import { initRenderControllerDeps, _ocrWordCache, _schedulePreRender, _preRenderAdjacent, _blitCacheToCanvas, _updateAnnotationCanvas, _updatePageUI, renderCurrentPage, safeCreateObjectURL, _renderPdfAnnotationLayer, _renderManualTextLayer, renderTextLayer, _renderOcrTextLayer, enableInlineTextEditing, disableInlineTextEditing, _handleTextLayerDblClick, _findParagraphSpans, _createParagraphEditor, _reflowTextToSpans, _createInlineEditor, _syncTextLayerToStorage, handleImageInsertion, addWatermarkToPage, addStampToPage, openSignaturePad } from './modules/render-controller.js';
import { clearAllTimers, safeTimeout, safeInterval, getTimerStats } from './modules/safe-timers.js';
import { createLogger } from './modules/logger.js';
import { emit as busEmit, on as busOn } from './modules/event-bus.js';
import { crashTelemetry, recordCrashEvent, recordSuccessfulOperation, recordRecovery, getCrashFreeRate, getSessionHealth, getRecentErrors, initCrashTelemetry } from './modules/crash-telemetry.js';
import { pdfEditState, initExportControllerDeps, getPageEdits, setPageEdits, undoPageEdit, redoPageEdit, getEditHistory, clearEditHistory, persistEdits, loadPersistedEdits, buildDocxXml, buildDocxTable, buildDocxStyles, buildContentTypes, buildRels, buildWordRels, crc32, generateDocxBlob, buildDocxImageParagraph, generateDocxWithImages, _groupWordsIntoLines, buildDocxXmlWithImages, buildContentTypesWithImages, buildWordRelsWithImages, createZipBlob, importDocxEdits, extractDocumentXmlFromZip, parseDocxTextByPages, exportSessionHealthReport, capturePageAsImageData } from './modules/export-controller.js';
import { ocrSearchIndex, buildOcrSearchEntry, indexOcrPage, searchOcrIndex, exportOcrTextWithCoordinates, downloadOcrTextExport, canSearchCurrentDoc, searchScopeKey, loadSearchScope, saveSearchScope, searchHistoryKey, buildSearchResultsSummaryText, copySearchResultsSummary, exportSearchResultsSummaryTxt, exportSearchResultsCsv, exportSearchResultsJson, importSearchResultsJson, parseCsvLine, importSearchResultsCsv, clearSearchResults, renderSearchResultsList, loadSearchHistory, saveSearchHistory, renderSearchHistory, rememberSearchQuery, buildSearchHistoryText, exportSearchHistoryJson, exportSearchHistoryTxt, copySearchHistory, importSearchHistoryJson, clearSearchHistory, highlightSearchInTextLayer, scrollToSearchHighlight, searchInPdf, jumpToSearchResult, initSearchControllerDeps } from './modules/search-controller.js';
import { initOcrControllerDeps, computeOcrConfidence, postCorrectOcrText, batchOcrState, enqueueBatchOcr, cancelBatchOcr, getBatchOcrProgress, getConfusableLatinToCyrillicMap, convertLatinLookalikesToCyrillic, hasMixedCyrillicLatinToken, computeOtsuThreshold, countHistogramPercentile, scoreCyrillicWordQuality, scoreRussianBigrams, scoreEnglishBigrams, medianDenoiseMonochrome, morphologyCloseMonochrome, estimateSkewAngleFromBinary, rotateCanvas, clearOcrRuntimeCaches, getOcrSourceCacheKey, updateOcrSourceCache, constrainOcrSourceCanvasPixels, getFreshOcrSourceCacheEntry, buildOcrSourceCanvas, estimatePageSkewAngle, cropCanvasByRelativeRect, preprocessOcrCanvas, pickVariantsByBudget, scoreOcrTextByLang, runOcrOnPreparedCanvas, normalizeOcrTextByLang, setOcrControlsBusy, cancelManualOcrTasks, enqueueOcrTask, setOcrStatus, setOcrStatusThrottled, setOcrRegionMode, drawOcrSelectionPreview, classifyOcrError, runOcrOnRectNow, runOcrOnRect, runOcrForCurrentPage, extractTextForPage, cancelBackgroundOcrScan, cancelAllOcrWork, scheduleBackgroundOcrScan, startBackgroundOcrScan } from './modules/ocr-controller.js';
import { initWorkspaceDeps, setWorkspaceStatus, setStage4Status, initReleaseGuards, cloudSyncUrlKey, loadCloudSyncUrl, saveCloudSyncUrl, ocrTextKey, loadOcrTextData, saveOcrTextData, loadOcrTextDataAsync, buildWorkspacePayload, applyWorkspacePayload, pushWorkspaceToCloud, pullWorkspaceFromCloud, collabChannelName, broadcastWorkspaceSnapshot, toggleCollaborationChannel, importOcrJson, exportWorkspaceBundleJson, importWorkspaceBundleJson } from './modules/workspace-controller.js';

// ─── Module-level loggers ───────────────────────────────────────────────────
const logOcr = createLogger('ocr');
const logRender = createLogger('render');
const logFile = createLogger('file');

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

// ─── Phase 2: OCR — now in modules/ocr-controller.js ─
// ─── Phase 3: PDF Text Editing + DOCX Export — now in modules/export-controller.js ─
// ─── Phase 2: OCR Search Index — now in modules/export-controller.js ─
// ─── Phase 5: Crash Telemetry — now in modules/crash-telemetry.js ──────────
initCrashTelemetry();


class PDFAdapter {
  static TEXT_CACHE_MAX = 30;
  constructor(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.type = 'pdf';
    this.pageTextCache = new Map();
    this.pageTextPromises = new Map();
    this._currentRenderTask = null;
  }

  _evictTextCache() {
    while (this.pageTextCache.size > PDFAdapter.TEXT_CACHE_MAX) {
      const oldest = this.pageTextCache.keys().next().value;
      this.pageTextCache.delete(oldest);
      this.pageTextPromises.delete(oldest);
    }
  }

  getPageCount() {
    return this.pdfDoc.numPages;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const page = await this.pdfDoc.getPage(pageNumber);
    return page.getViewport({ scale, rotation });
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const page = await this.pdfDoc.getPage(pageNumber);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // Render at higher resolution for sharper text: use ceil to avoid
    // sub-pixel truncation that causes blurry edges on text glyphs.
    const renderScale = zoom * dpr;
    const viewport = page.getViewport({ scale: renderScale, rotation });

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    // High quality image scaling for embedded images in the PDF
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Fill white background before PDF.js renders (prevents flash of black)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const isMainCanvas = canvas === els?.canvas;
    if (isMainCanvas && this._currentRenderTask) {
      try { this._currentRenderTask.cancel(); } catch (_) { /* already finished */ }
      this._currentRenderTask = null;
    }

    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
      background: 'rgba(255,255,255,1)',
      // Enable high-quality anti-aliasing for text and vector graphics
      intent: 'display',
    });
    if (isMainCanvas) this._currentRenderTask = renderTask;
    try {
      await renderTask.promise;
    } finally {
      if (isMainCanvas && this._currentRenderTask === renderTask) {
        this._currentRenderTask = null;
      }
    }
  }

  buildTextFromItems(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const lines = [];
    let current = [];
    let currentY = null;
    let prevX = null;

    for (const item of items) {
      const str = String(item?.str || '');
      if (!str) continue;
      const tr = Array.isArray(item?.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);
      const h = Math.max(1, Math.abs(Number(item?.height || 0)));
      const lineThreshold = Math.max(2, h * 0.6);

      if (currentY == null || Math.abs(y - currentY) > lineThreshold) {
        if (current.length) lines.push(current.join(''));
        current = [str];
        currentY = y;
        prevX = x + Number(item?.width || str.length * h * 0.42);
        continue;
      }

      const estimatedGap = x - (prevX ?? x);
      const shouldAddSpace = estimatedGap > Math.max(2, h * 0.22);
      current.push((shouldAddSpace ? ' ' : '') + str);
      prevX = x + Number(item?.width || str.length * h * 0.42);
    }

    if (current.length) lines.push(current.join(''));
    return lines
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async getText(pageNumber) {
    if (this.pageTextCache.has(pageNumber)) return this.pageTextCache.get(pageNumber);
    if (this.pageTextPromises.has(pageNumber)) return this.pageTextPromises.get(pageNumber);

    const textPromise = (async () => {
      const page = await this.pdfDoc.getPage(pageNumber);
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const text = this.buildTextFromItems(content?.items || []);
      this.pageTextCache.set(pageNumber, text);
      this._evictTextCache();
      return text;
    })().finally(() => {
      this.pageTextPromises.delete(pageNumber);
    });

    this.pageTextPromises.set(pageNumber, textPromise);
    return textPromise;
  }

  async getOutline() {
    return this.pdfDoc.getOutline();
  }

  async resolveDestToPage(dest) {
    let targetDest = dest;
    if (typeof targetDest === 'string') {
      targetDest = await this.pdfDoc.getDestination(targetDest);
    }

    if (!targetDest || !Array.isArray(targetDest) || targetDest.length === 0) {
      return null;
    }

    const pageRef = targetDest[0];
    const pageIndex = await this.pdfDoc.getPageIndex(pageRef);
    return pageIndex + 1;
  }
}

class ImageAdapter {
  constructor(imageUrl, imageMeta) {
    this.imageUrl = imageUrl;
    this.imageMeta = imageMeta;
    this.type = 'image';
  }

  getPageCount() {
    return 1;
  }

  async getPageViewport(_pageNumber, scale, rotation) {
    const w = this.imageMeta.width * scale;
    const h = this.imageMeta.height * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(_pageNumber, canvas, { zoom, rotation }) {
    const img = await loadImage(this.imageUrl);
    const rad = (rotation * Math.PI) / 180;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const w = img.width * zoom;
    const h = img.height * zoom;
    const rw = Math.ceil(w * dpr);
    const rh = Math.ceil(h * dpr);

    if (rotation % 180 === 0) {
      canvas.width = rw;
      canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = rh;
      canvas.height = rw;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    if (rotation % 180 === 0) {
      ctx.translate(w / 2, h / 2);
    } else {
      ctx.translate(h / 2, w / 2);
    }
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  async getText() {
    return '';
  }
}

class DjVuAdapter {
  constructor(fileName, data = null) {
    this.fileName = fileName;
    this.type = 'djvu';
    this.mode = 'compat';
    this.setData(data);
  }

  setData(data) {
    const pagesText = Array.isArray(data?.pagesText)
      ? data.pagesText.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    const pagesImages = Array.isArray(data?.pagesImages)
      ? data.pagesImages.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    const pageSizes = Array.isArray(data?.pageSizes)
      ? data.pageSizes.map((x) => ({
        width: Number(x?.width) > 0 ? Number(x.width) : null,
        height: Number(x?.height) > 0 ? Number(x.height) : null,
      }))
      : [];

    this.pagesText = pagesText;
    this.pagesImages = pagesImages;
    this.pageSizes = pageSizes;
    const inferredCount = Math.max(pagesText.length, pagesImages.length, pageSizes.length, 1);
    this.pageCount = Number.isInteger(data?.pageCount) && data.pageCount > 0
      ? Math.max(data.pageCount, inferredCount)
      : inferredCount;
    this.outline = Array.isArray(data?.outline) ? data.outline : [];
  }

  exportData() {
    return {
      pageCount: this.pageCount,
      pagesText: this.pagesText,
      pagesImages: this.pagesImages,
      pageSizes: this.pageSizes,
      outline: this.outline,
    };
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const size = this.pageSizes[pageNumber - 1] || {};
    const baseW = Number(size.width) > 0 ? Number(size.width) : 1200;
    const baseH = Number(size.height) > 0 ? Number(size.height) : 1600;
    const w = baseW * scale;
    const h = baseH * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const imageUrl = this.pagesImages[pageNumber - 1];
    if (imageUrl) {
      const img = await loadImage(imageUrl);
      const rad = (rotation * Math.PI) / 180;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = img.width * zoom;
      const h = img.height * zoom;
      const rw = Math.ceil(w * dpr);
      const rh = Math.ceil(h * dpr);

      if (rotation % 180 === 0) {
        canvas.width = rw;
        canvas.height = rh;
        canvas.style.width = `${Math.round(w)}px`;
        canvas.style.height = `${Math.round(h)}px`;
      } else {
        canvas.width = rh;
        canvas.height = rw;
        canvas.style.width = `${Math.round(h)}px`;
        canvas.style.height = `${Math.round(w)}px`;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      if (rotation % 180 === 0) {
        ctx.translate(w / 2, h / 2);
      } else {
        ctx.translate(h / 2, w / 2);
      }
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewport = await this.getPageViewport(pageNumber, zoom * dpr, rotation);
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '24px sans-serif';
    ctx.fillText('DjVu документ', 40, 70);
    ctx.fillStyle = '#9aa6b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Файл: ${this.fileName}`, 40, 105);
    ctx.fillText(`Страница: ${pageNumber}/${this.pageCount}`, 40, 132);
    const txt = (this.pagesText[pageNumber - 1] || '').trim();
    ctx.fillText(txt ? 'Текстовый слой: загружен' : 'Текстовый слой: не загружен', 40, 159);
    ctx.fillText('Импортируйте DjVu data JSON для рендера страниц/поиска.', 40, 186);
  }

  async getText(pageNumber) {
    return this.pagesText[pageNumber - 1] || '';
  }

  async getOutline() {
    return this.outline;
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (!Number.isInteger(n) || n < 1 || n > this.pageCount) return null;
    return n;
  }
}


class DjVuNativeAdapter {
  constructor(doc, fileName) {
    this.doc = doc;
    this.fileName = fileName;
    this.type = 'djvu';
    this.mode = 'native';
    this.pageSizes = Array.isArray(doc?.getPagesSizes?.()) ? doc.getPagesSizes() : [];
    this.pageCount = Number(doc?.getPagesQuantity?.() || this.pageSizes.length || 1);
  }

  getPageCount() {
    return this.pageCount;
  }

  async getPageViewport(pageNumber, scale, rotation) {
    const size = this.pageSizes[pageNumber - 1] || {};
    const baseW = Number(size.width) > 0 ? Number(size.width) : 1200;
    const baseH = Number(size.height) > 0 ? Number(size.height) : 1600;
    const w = baseW * scale;
    const h = baseH * scale;
    if (rotation % 180 === 0) return { width: w, height: h };
    return { width: h, height: w };
  }

  async renderPage(pageNumber, canvas, { zoom, rotation }) {
    const page = await this.doc.getPage(pageNumber);
    const imageData = page.getImageData(true);
    page.reset?.();

    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d', { alpha: false }).putImageData(imageData, 0, 0);

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rad = (rotation * Math.PI) / 180;
    const w = tmp.width * zoom;
    const h = tmp.height * zoom;
    const rw = Math.ceil(w * dpr);
    const rh = Math.ceil(h * dpr);

    if (rotation % 180 === 0) {
      canvas.width = rw;
      canvas.height = rh;
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    } else {
      canvas.width = rh;
      canvas.height = rw;
      canvas.style.width = `${Math.round(h)}px`;
      canvas.style.height = `${Math.round(w)}px`;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // For significant upscaling (zoom > 2x), use two-pass rendering
    // for sharper results: first scale to 2x, then to final size.
    const effectiveScale = zoom * dpr;
    let source = tmp;
    if (effectiveScale > 2.5 && tmp.width > 0 && tmp.height > 0) {
      const mid = document.createElement('canvas');
      const midScale = Math.sqrt(effectiveScale);
      mid.width = Math.ceil(tmp.width * midScale);
      mid.height = Math.ceil(tmp.height * midScale);
      const midCtx = mid.getContext('2d', { alpha: false });
      midCtx.imageSmoothingEnabled = true;
      midCtx.imageSmoothingQuality = 'high';
      midCtx.drawImage(tmp, 0, 0, mid.width, mid.height);
      // Release tmp early
      tmp.width = 0; tmp.height = 0;
      source = mid;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    if (rotation % 180 === 0) {
      ctx.translate(w / 2, h / 2);
    } else {
      ctx.translate(h / 2, w / 2);
    }
    ctx.rotate(rad);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Release intermediate canvas
    if (source !== tmp) { source.width = 0; source.height = 0; }
    if (tmp.width > 0) { tmp.width = 0; tmp.height = 0; }
  }

  async getText(pageNumber) {
    const page = await this.doc.getPage(pageNumber);
    const text = page.getText() || '';
    page.reset?.();
    return text;
  }

  async getOutline() {
    const raw = this.doc.getContents?.() || [];
    const mapItems = (items) => (Array.isArray(items) ? items.map((item) => {
      const page = item?.url ? this.doc.getPageNumberByUrl(item.url) : null;
      return {
        title: item?.description || '(без названия)',
        dest: Number.isInteger(page) ? page : null,
        items: mapItems(item?.children || []),
      };
    }) : []);
    return mapItems(raw);
  }

  async resolveDestToPage(dest) {
    const n = Number(dest);
    if (!Number.isInteger(n) || n < 1 || n > this.pageCount) return null;
    return n;
  }
}

class UnsupportedAdapter {
  constructor(fileName) {
    this.fileName = fileName;
    this.type = 'unsupported';
  }

  getPageCount() {
    return 1;
  }

  async getPageViewport() {
    return { width: 1200, height: 700 };
  }

  async renderPage(_pageNumber, canvas) {
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '26px sans-serif';
    ctx.fillText('Формат пока не поддержан в MVP', 80, 130);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#9aa6b8';
    ctx.fillText(`Файл: ${this.fileName}`, 80, 180);
    ctx.fillText('Откройте поддерживаемый формат: PDF, DjVu или изображение.', 80, 220);
  }

  async getText() {
    return '';
  }
}


function revokeCurrentObjectUrl() {
  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
    state.currentObjectUrl = null;
  }
}

function djvuTextKey() {
  return `novareader-djvu-data:${state.docName || 'global'}`;
}

function loadDjvuData() {
  try {
    const raw = localStorage.getItem(djvuTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function saveDjvuData(payload) {
  localStorage.setItem(djvuTextKey(), JSON.stringify(payload));
}

function noteKey() {
  return `novareader-notes:${state.docName || 'global'}`;
}

function bookmarkKey() {
  return `novareader-bookmarks:${state.docName || 'global'}`;
}


function viewStateKey() {
  return `novareader-view:${state.docName || 'global'}`;
}

function readingTimeKey() {
  return `novareader-reading-time:${state.docName || 'global'}`;
}

function readingGoalKey() {
  return `novareader-reading-goal:${state.docName || 'global'}`;
}

// annotationKey, commentKey, invalidateAnnotationCaches, getCurrentAnnotationCtx,
// getAnnotationDpr, loadStrokes, saveStrokes, loadComments, saveComments,
// clearDocumentCommentStorage, renderCommentList, clearDocumentAnnotationStorage,
// updateOverlayInteractionState, setDrawMode — moved to annotation-controller.js

function appSettingsKey() { return SettingsController.appSettingsKey(); }
function defaultSettings() { return SettingsController.defaultSettings(); }
function loadAppSettings() { SettingsController.loadAppSettings(); }
function saveAppSettings() { SettingsController.saveAppSettings(); }
function applyUiSizeSettings() { SettingsController.applyUiSizeSettings(uiLayoutKey); }
function getOcrLang() { return SettingsController.getOcrLang(); }
function getOcrScale() { return SettingsController.getOcrScale(); }

// ─── OCR functions (getConfusableLatinToCyrillicMap through normalizeOcrTextByLang) ─
// now in modules/ocr-controller.js

function applyAppLanguage() {
  const lang = state.settings?.appLang || 'ru';
  const t = {
    ru: {
      openSettings: 'Настройки',
      ocrPage: 'OCR',
      copyOcr: '📋 OCR',
      searchBtn: 'Найти',
      pageTextPlaceholder: 'Текст страницы',
      settingsTitle: 'Настройки',
      saveSettings: 'Сохранить',
    },
    en: {
      openSettings: 'Settings',
      ocrPage: 'OCR',
      copyOcr: '📋 OCR',
      searchBtn: 'Search',
      pageTextPlaceholder: 'Page text',
      settingsTitle: 'Settings',
      saveSettings: 'Save',
    },
  }[lang] || {};

  if (els.openSettingsModal) {
    els.openSettingsModal.textContent = '⚙';
    els.openSettingsModal.title = t.openSettings || 'Settings';
    els.openSettingsModal.setAttribute('aria-label', t.openSettings || 'Settings');
  }
  if (els.ocrCurrentPage) els.ocrCurrentPage.textContent = t.ocrPage;
  if (els.copyOcrText) els.copyOcrText.textContent = t.copyOcr;
  if (els.searchBtn) els.searchBtn.textContent = t.searchBtn;
  // Icon buttons (↑↓↔⊡⬇🖨) — not overridden by language
  if (els.pageText) els.pageText.placeholder = t.pageTextPlaceholder;
  if (els.saveSettingsModal) els.saveSettingsModal.textContent = t.saveSettings;
  const modalTitle = document.querySelector('#settingsModal .modal-head h3');
  if (modalTitle) modalTitle.textContent = t.settingsTitle;

  if (els.ocrRegionMode) {
    els.ocrRegionMode.classList.toggle('active', state.ocrRegionMode);
  }
}

function renderSectionVisibilityControls() {
  if (els.cfgSidebarSections) {
    els.cfgSidebarSections.innerHTML = '<h5>Сайдбар</h5>';
    SIDEBAR_SECTION_CONFIG.forEach((cfg) => {
      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.sectionType = 'sidebar';
      input.dataset.sectionKey = cfg.key;
      input.checked = (state.settings?.sidebarSections?.[cfg.key] ?? true);
      label.appendChild(input);
      label.append(` ${cfg.label}`);
      els.cfgSidebarSections.appendChild(label);
    });
  }

  if (els.cfgToolbarSections) {
    els.cfgToolbarSections.innerHTML = '<h5>Тулбар</h5>';
    TOOLBAR_SECTION_CONFIG.forEach((cfg) => {
      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.sectionType = 'toolbar';
      input.dataset.sectionKey = cfg.key;
      input.checked = (state.settings?.toolbarSections?.[cfg.key] ?? true);
      label.appendChild(input);
      label.append(` ${cfg.label}`);
      els.cfgToolbarSections.appendChild(label);
    });
  }
}

function applySectionVisibilitySettings() {
  const sidebar = state.settings?.sidebarSections || {};
  const toolbar = state.settings?.toolbarSections || {};

  document.querySelectorAll('[data-sidebar-section]').forEach((node) => {
    const key = node.dataset.sidebarSection;
    const visible = sidebar[key] ?? true;
    node.classList.toggle('section-hidden', !visible);
  });

  document.querySelectorAll('[data-toolbar-section]').forEach((node) => {
    const key = node.dataset.toolbarSection;
    const visible = toolbar[key] ?? true;
    node.classList.toggle('section-hidden', !visible);
  });
}


function openSettingsModal() {
  if (!els.settingsModal) return;
  const sidebarHidden = localStorage.getItem(uiLayoutKey('sidebarHidden')) === '1';
  const searchHidden = localStorage.getItem(uiLayoutKey('searchToolsHidden')) === '1';
  const annotHidden = localStorage.getItem(uiLayoutKey('annotToolsHidden')) === '1';
  const textHidden = localStorage.getItem(uiLayoutKey('textHidden')) === '1';

  if (els.cfgShowSidebar) els.cfgShowSidebar.checked = !sidebarHidden;
  if (els.cfgShowSearch) els.cfgShowSearch.checked = !searchHidden;
  if (els.cfgShowAnnot) els.cfgShowAnnot.checked = !annotHidden;
  if (els.cfgShowText) els.cfgShowText.checked = !textHidden;
  if (els.cfgTheme) els.cfgTheme.value = document.body.classList.contains('light') ? 'light' : 'dark';
  if (els.cfgAppLang) els.cfgAppLang.value = state.settings?.appLang || 'ru';
  if (els.cfgOcrLang) els.cfgOcrLang.value = state.settings?.ocrLang || 'auto';
  if (els.cfgOcrCyrillicOnly) els.cfgOcrCyrillicOnly.checked = state.settings?.ocrCyrillicOnly !== false;
  if (els.cfgOcrQualityMode) els.cfgOcrQualityMode.value = state.settings?.ocrQualityMode || 'balanced';
  if (els.cfgOcrMinW) els.cfgOcrMinW.value = String(state.settings?.ocrMinW || 24);
  if (els.cfgOcrMinH) els.cfgOcrMinH.value = String(state.settings?.ocrMinH || 24);
  if (els.cfgBackgroundOcr) els.cfgBackgroundOcr.checked = !!state.settings?.backgroundOcr;
  if (els.cfgSidebarWidth) els.cfgSidebarWidth.value = String(state.settings?.uiSidebarWidth || 220);
  if (els.cfgToolbarScale) els.cfgToolbarScale.value = String(Math.round((state.settings?.uiToolbarScale || 1) * 100));
  if (els.cfgTextMinHeight) els.cfgTextMinHeight.value = String(state.settings?.uiTextMinHeight || 40);
  if (els.cfgPageAreaHeight) els.cfgPageAreaHeight.value = String(state.settings?.uiPageAreaPx || 860);
  if (els.cfgTopToolbarHeight) els.cfgTopToolbarHeight.value = String(state.settings?.uiToolbarTopPx || 34);
  if (els.cfgBottomToolbarHeight) els.cfgBottomToolbarHeight.value = String(state.settings?.uiToolbarBottomPx || 86);
  if (els.cfgTextPanelHeight) els.cfgTextPanelHeight.value = String(state.settings?.uiTextPanelPx || 120);
  if (els.cfgAnnotationCanvasScale) els.cfgAnnotationCanvasScale.value = String(state.settings?.uiAnnotationCanvasScale || 90);
  renderSectionVisibilityControls();
  previewUiSizeFromModal();

  els.settingsModal.classList.add('open');
  els.settingsModal.setAttribute('aria-hidden', 'false');
  // Populate OCR storage info when modal opens
  if (typeof refreshOcrStorageInfo === 'function') refreshOcrStorageInfo();
}

function closeSettingsModal() {
  if (!els.settingsModal) return;
  els.settingsModal.classList.remove('open');
  els.settingsModal.setAttribute('aria-hidden', 'true');
  applyUiSizeSettings();
}

function readUiSizeSettingsFromModal() {
  return {
    sidebar: Math.max(160, Math.min(360, Number(els.cfgSidebarWidth?.value) || 220)),
    toolbarScale: Math.max(0.1, Math.min(1, (Number(els.cfgToolbarScale?.value) || 100) / 100)),
    textMin: Math.max(24, Math.min(180, Number(els.cfgTextMinHeight?.value) || 40)),
    pageArea: Math.max(520, Math.min(2600, Number(els.cfgPageAreaHeight?.value) || 860)),
    topToolbar: Math.max(28, Math.min(72, Number(els.cfgTopToolbarHeight?.value) || 34)),
    bottomToolbar: Math.max(48, Math.min(220, Number(els.cfgBottomToolbarHeight?.value) || 86)),
    textPanel: Math.max(72, Math.min(360, Number(els.cfgTextPanelHeight?.value) || 120)),
    annotationScale: Math.max(50, Math.min(100, Number(els.cfgAnnotationCanvasScale?.value) || 90)),
  };
}

function previewUiSizeFromModal() {
  if (!els.settingsModal?.classList.contains('open')) return;
  const values = readUiSizeSettingsFromModal();
  document.documentElement.style.setProperty('--ui-toolbar-scale', String(values.toolbarScale));
  document.documentElement.style.setProperty('--ui-text-min-height', `${Math.round(values.textMin)}px`);
  document.querySelector('.app-shell')?.style.setProperty('--sidebar-width', `${Math.round(values.sidebar)}px`);
  document.querySelector('.viewer-area')?.style.setProperty('--page-area-height', `${Math.round(values.pageArea)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-top-height', `${Math.round(values.topToolbar)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-bottom-height', `${Math.round(values.bottomToolbar)}px`);
  document.documentElement.style.setProperty('--ui-text-panel-height', `${Math.round(values.textPanel)}px`);
  document.documentElement.style.setProperty('--ui-annotation-canvas-scale', (values.annotationScale / 100).toFixed(2));
}

function saveSettingsFromModal() {
  const setHidden = (k, show) => localStorage.setItem(uiLayoutKey(k), show ? '0' : '1');
  if (els.cfgShowSidebar) setHidden('sidebarHidden', els.cfgShowSidebar.checked);
  if (els.cfgShowSearch) setHidden('searchToolsHidden', els.cfgShowSearch.checked);
  if (els.cfgShowAnnot) setHidden('annotToolsHidden', els.cfgShowAnnot.checked);
  if (els.cfgShowText) setHidden('textHidden', els.cfgShowText.checked);

  if (els.cfgTheme) {
    document.body.classList.toggle('light', els.cfgTheme.value === 'light');
    localStorage.setItem('novareader-theme', els.cfgTheme.value === 'light' ? 'light' : 'dark');
  }

  state.settings = state.settings || defaultSettings();
  const prevOcrQualityMode = state.settings.ocrQualityMode || 'balanced';
  if (els.cfgAppLang) state.settings.appLang = els.cfgAppLang.value || 'ru';
  if (els.cfgOcrLang) state.settings.ocrLang = els.cfgOcrLang.value || 'auto';
  if (els.cfgOcrCyrillicOnly) state.settings.ocrCyrillicOnly = !!els.cfgOcrCyrillicOnly.checked;
  if (els.cfgOcrQualityMode) state.settings.ocrQualityMode = els.cfgOcrQualityMode.value === 'accurate' ? 'accurate' : 'balanced';
  if ((state.settings.ocrQualityMode || 'balanced') !== prevOcrQualityMode) clearOcrRuntimeCaches('ocr-quality-mode-changed');
  if (els.cfgOcrMinW) state.settings.ocrMinW = Math.max(8, Number(els.cfgOcrMinW.value) || 24);
  if (els.cfgOcrMinH) state.settings.ocrMinH = Math.max(8, Number(els.cfgOcrMinH.value) || 24);
  if (els.cfgBackgroundOcr) state.settings.backgroundOcr = !!els.cfgBackgroundOcr.checked;
  if (els.cfgSidebarWidth) state.settings.uiSidebarWidth = Math.max(160, Math.min(360, Number(els.cfgSidebarWidth.value) || 220));
  if (els.cfgToolbarScale) state.settings.uiToolbarScale = Math.max(0.1, Math.min(1, (Number(els.cfgToolbarScale.value) || 100) / 100));
  if (els.cfgTextMinHeight) state.settings.uiTextMinHeight = Math.max(24, Math.min(180, Number(els.cfgTextMinHeight.value) || 40));
  if (els.cfgPageAreaHeight) state.settings.uiPageAreaPx = Math.max(520, Math.min(2600, Number(els.cfgPageAreaHeight.value) || 860));
  if (els.cfgTopToolbarHeight) state.settings.uiToolbarTopPx = Math.max(28, Math.min(72, Number(els.cfgTopToolbarHeight.value) || 34));
  if (els.cfgBottomToolbarHeight) state.settings.uiToolbarBottomPx = Math.max(48, Math.min(220, Number(els.cfgBottomToolbarHeight.value) || 86));
  if (els.cfgTextPanelHeight) state.settings.uiTextPanelPx = Math.max(72, Math.min(360, Number(els.cfgTextPanelHeight.value) || 120));
  if (els.cfgAnnotationCanvasScale) state.settings.uiAnnotationCanvasScale = Math.max(50, Math.min(100, Number(els.cfgAnnotationCanvasScale.value) || 90));

  if (!state.settings.sidebarSections) state.settings.sidebarSections = {};
  if (!state.settings.toolbarSections) state.settings.toolbarSections = {};
  document.querySelectorAll('#cfgSidebarSections input[data-section-key]').forEach((input) => {
    state.settings.sidebarSections[input.dataset.sectionKey] = !!input.checked;
  });
  document.querySelectorAll('#cfgToolbarSections input[data-section-key]').forEach((input) => {
    state.settings.toolbarSections[input.dataset.sectionKey] = !!input.checked;
  });

  saveAppSettings();
  applyUiSizeSettings();
  applyAppLanguage();
  applyLayoutState();
  applySectionVisibilitySettings();
  closeSettingsModal();
}

// ─── OCR functions (setOcrControlsBusy through startBackgroundOcrScan) ─
// now in modules/ocr-controller.js

// ─── Annotation functions (moved to annotation-controller.js) ────────────────
// normalizePoint, denormalizePoint, applyStrokeStyle, drawStroke,
// renderAnnotations, _applyTextMarkupFromSelection, getCanvasPointFromEvent,
// beginStroke, moveStroke, endStroke, undoStroke, clearStrokes, clearComments,
// exportAnnotatedPng, exportAnnotationsJson, importAnnotationsJson,
// showShortcutsHelp, exportAnnotationBundleJson, importAnnotationBundleJson
// — now imported from ./modules/annotation-controller.js

// ─── Workspace functions: delegated to workspace-controller.js ──────────────

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

function loadReadingGoal() {
  try {
    const raw = localStorage.getItem(readingGoalKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isInteger(parsed?.page)) return null;
    return parsed.page;
  } catch (err) {
    return null;
  }
}

function saveReadingGoal() {
  if (!state.adapter || !state.pageCount) {
    els.readingGoalStatus.textContent = 'Сначала откройте документ';
    return;
  }
  const raw = Number.parseInt(els.readingGoalPage.value, 10);
  if (Number.isNaN(raw)) {
    els.readingGoalStatus.textContent = 'Введите корректный номер страницы';
    return;
  }
  const goal = Math.max(1, Math.min(state.pageCount, raw));
  state.readingGoalPage = goal;
  localStorage.setItem(readingGoalKey(), JSON.stringify({ page: goal }));
  renderReadingGoalStatus();
}

function clearReadingGoal() {
  state.readingGoalPage = null;
  localStorage.removeItem(readingGoalKey());
  els.readingGoalPage.value = '';
  renderReadingGoalStatus();
}

function renderReadingGoalStatus() {
  if (!state.adapter || !state.pageCount) {
    els.readingGoalStatus.textContent = '';
    return;
  }

  const goal = state.readingGoalPage;
  if (!goal) {
    els.readingGoalStatus.textContent = '';
    return;
  }

  els.readingGoalPage.value = String(goal);
  const remaining = goal - state.currentPage;
  if (remaining <= 0) {
    els.readingGoalStatus.textContent = `Цель достигнута (стр. ${goal})`; 
    return;
  }

  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalMs = state.readingTotalMs + activeMs;
  const pagesDone = Math.max(1, state.currentPage);
  const msPerPage = totalMs / pagesDone;
  const goalEta = Number.isFinite(msPerPage) && msPerPage > 0 ? formatEta(msPerPage * remaining) : '—';
  els.readingGoalStatus.textContent = `До цели стр. ${goal}: осталось ${remaining} стр., ETA ${goalEta}`;
}

function formatEta(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const d = new Date(Date.now() + ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderEtaStatus() {
  if (!state.adapter || !state.pageCount) {
    els.etaStatus.textContent = 'ETA завершения: —';
    renderReadingGoalStatus();
    return;
  }

  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalMs = state.readingTotalMs + activeMs;
  const pagesDone = Math.max(1, state.currentPage);
  const msPerPage = totalMs / pagesDone;
  const remainingPages = Math.max(0, state.pageCount - state.currentPage);

  if (!Number.isFinite(msPerPage) || msPerPage <= 0 || remainingPages === 0) {
    els.etaStatus.textContent = remainingPages === 0 ? 'ETA завершения: документ пройден' : 'ETA завершения: —';
    renderReadingGoalStatus();
    return;
  }

  const etaMs = msPerPage * remainingPages;
  els.etaStatus.textContent = `ETA завершения: ${formatEta(etaMs)}`;
  renderReadingGoalStatus();
}

function renderDocStats() {
  if (!state.adapter || !state.pageCount) {
    els.docStats.textContent = '';
    return;
  }

  let totalStrokes = 0;
  let totalComments = 0;
  for (let page = 1; page <= state.pageCount; page += 1) {
    totalStrokes += loadStrokes(page).length;
    totalComments += loadComments(page).length;
  }

  const bookmarks = loadBookmarks().length;
  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  const totalHours = (state.readingTotalMs + activeMs) / 3600000;
  const pace = totalHours > 0.01 ? `${(state.currentPage / totalHours).toFixed(1)} стр/ч` : '—';

  els.docStats.textContent = `${totalStrokes} аннот. · ${totalComments} комм. · ${bookmarks} закл. · ${pace}`;
}

function renderVisitTrail() {
  els.visitTrailList.innerHTML = '';

  if (!state.adapter || !state.visitTrail.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'История переходов пуста';
    els.visitTrailList.appendChild(li);
    return;
  }

  state.visitTrail.forEach((page) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const btn = document.createElement('button');
    btn.textContent = `Стр. ${page}`;
    btn.addEventListener('click', async () => {
      if (!state.adapter) return;
      state.currentPage = page;
      await renderCurrentPage();
    });

    li.appendChild(btn);
    els.visitTrailList.appendChild(li);
  });
}

function trackVisitedPage(page) {
  if (!state.adapter || !Number.isInteger(page)) return;
  state.visitTrail = [page, ...state.visitTrail.filter((x) => x !== page)].slice(0, 12);
  renderVisitTrail();
}

function clearVisitTrail() {
  state.visitTrail = [];
  renderVisitTrail();
}

function updateHistoryButtons() {
  if (!els.historyBack || !els.historyForward) return;
  els.historyBack.disabled = state.historyBack.length === 0;
  els.historyForward.disabled = state.historyForward.length === 0;
}

function resetHistory() {
  state.historyBack = [];
  state.historyForward = [];
  state.lastRenderedPage = null;
  updateHistoryButtons();
}

function capturePageHistoryOnRender() {
  if (!state.adapter) return;
  const prev = state.lastRenderedPage;
  const curr = state.currentPage;
  if (typeof prev === 'number' && prev !== curr && !state.isHistoryNavigation) {
    const top = state.historyBack[state.historyBack.length - 1];
    if (top !== prev) {
      state.historyBack.push(prev);
      if (state.historyBack.length > 100) {
        state.historyBack.shift();
      }
    }
    state.historyForward = [];
  }
  state.lastRenderedPage = curr;
  updateHistoryButtons();
}

async function navigateHistoryBack() {
  if (!state.adapter || !state.historyBack.length) return;
  const target = state.historyBack.pop();
  if (!Number.isInteger(target)) return;
  state.historyForward.push(state.currentPage);
  state.isHistoryNavigation = true;
  state.currentPage = target;
  await renderCurrentPage();
  state.isHistoryNavigation = false;
  updateHistoryButtons();
}

async function navigateHistoryForward() {
  if (!state.adapter || !state.historyForward.length) return;
  const target = state.historyForward.pop();
  if (!Number.isInteger(target)) return;
  state.historyBack.push(state.currentPage);
  state.isHistoryNavigation = true;
  state.currentPage = target;
  await renderCurrentPage();
  state.isHistoryNavigation = false;
  updateHistoryButtons();
}


let readingTimerId = null;

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function saveReadingTime() {
  if (!state.docName) return;
  localStorage.setItem(readingTimeKey(), JSON.stringify({ totalMs: Math.max(0, Math.floor(state.readingTotalMs)) }));
}

function loadReadingTime() {
  try {
    const raw = localStorage.getItem(readingTimeKey());
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.totalMs) ? Math.max(0, parsed.totalMs) : 0;
  } catch (err) {
    return 0;
  }
}

function updateReadingTimeStatus() {
  if (!state.adapter || !state.docName) {
    els.readingTimeStatus.textContent = 'Время чтения: 00:00:00';
    return;
  }
  const activeMs = state.readingStartedAt ? Date.now() - state.readingStartedAt : 0;
  els.readingTimeStatus.textContent = formatDuration(state.readingTotalMs + activeMs);
  renderDocStats();
  renderEtaStatus();
}

function stopReadingTimer(commit = true) {
  if (readingTimerId) {
    clearInterval(readingTimerId);
    readingTimerId = null;
  }
  if (state.readingStartedAt) {
    state.readingTotalMs += Date.now() - state.readingStartedAt;
    state.readingStartedAt = null;
    if (commit) saveReadingTime();
  }
  updateReadingTimeStatus();
}

function startReadingTimer() {
  if (!state.adapter || !state.docName) return;
  if (document.hidden) return;
  if (state.readingStartedAt) return;

  state.readingStartedAt = Date.now();
  if (!readingTimerId) {
    readingTimerId = setInterval(updateReadingTimeStatus, 1000);
  }
  updateReadingTimeStatus();
}

function syncReadingTimerWithVisibility() {
  if (!state.adapter) return;
  if (document.hidden) {
    stopReadingTimer(true);
  } else {
    startReadingTimer();
  }
}

async function resetReadingTime() {
  if (!state.adapter) {
    els.readingTimeStatus.textContent = 'Сначала откройте документ';
    return;
  }
  stopReadingTimer(false);
  state.readingTotalMs = 0;
  saveReadingTime();
  updateReadingTimeStatus();
  renderEtaStatus();
  startReadingTimer();
}

async function isLikelyDjvuFile(file) {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const text = new TextDecoder('ascii', { fatal: false }).decode(header);
    return text.includes('AT&TFORM') || text.startsWith('AT&T');
  } catch (err) {
    return false;
  }
}

async function extractDjvuFallbackText(file) {
  try {
    const sampleSize = Math.min(file.size, 2 * 1024 * 1024);
    const bytes = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const chunks = utf8.match(/[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 ,.:;!?()\-]{20,}/g) || [];
    let text = chunks
      .map((x) => x.replace(/\s+/g, ' ').trim())
      .filter((x) => x.length >= 20)
      .slice(0, 40)
      .join('\n');

    if (!text) {
      const normalized = utf8
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      text = normalized.length >= 20 ? normalized : '';
    }

    return text.slice(0, 5000);
  } catch (err) {
    return '';
  }
}


const _openFileImpl = async function openFileImpl(file) {
  const openStartedAt = performance.now();
  pushDiagnosticEvent('file.open.start', { name: file?.name || 'unknown', size: Number(file?.size) || 0 });
  revokeCurrentObjectUrl();
  clearPageRenderCache();
  revokeAllTrackedUrls();
  clearAllTimers(); // Q0.3: prevent timer leaks from previous document
  state.file = file;
  state.docName = file.name;
  state.currentPage = 1;
  state.zoom = 1;
  state.rotation = 0;
  state.searchResults = [];
  state.searchCursor = -1;
  state.outline = [];
  state.visitTrail = [];
  resetHistory();
  els.searchStatus.textContent = '';
  setWorkspaceStatus('');
  setBookmarksStatus('');
  els.pageText.value = '';
  ensureTextToolsVisible();
  state.djvuBinaryDetected = false;
  invalidateAnnotationCaches();
  clearOcrRuntimeCaches('file-open');
  resetTesseractAvailability(); // allow Tesseract retry on each new file

  const lower = file.name.toLowerCase();

  if (lower.endsWith('.pdf')) {
    try {
      const pdf = await ensurePdfJs();
      const data = await progressiveLoader.loadFileProgressive(file);
      // For large files (>100MB), disable eager page fetching to reduce memory
      const pdfOptions = { data };
      if (file.size > 100 * 1024 * 1024) {
        pdfOptions.disableAutoFetch = true;
        pdfOptions.disableStream = true;
      }
      const pdfDoc = await pdf.getDocument(pdfOptions).promise;
      state.adapter = new PDFAdapter(pdfDoc);
    } catch (err) {
      state.adapter = new UnsupportedAdapter(file.name);
      els.searchStatus.textContent = 'Не удалось загрузить локальный PDF runtime. Проверьте целостность приложения.';
    }
  } else if (lower.endsWith('.djvu') || lower.endsWith('.djv')) {
    const djvuData = loadDjvuData();
    state.djvuBinaryDetected = await isLikelyDjvuFile(file);

    let openedByNative = false;
    try {
      const DjVu = await ensureDjVuJs();
      const data = await progressiveLoader.loadFileProgressive(file);
      const doc = new DjVu.Document(data);
      state.adapter = new DjVuNativeAdapter(doc, file.name);
      openedByNative = true;
      els.searchStatus.textContent = 'DjVu файл открыт встроенным runtime.';
    } catch (err) {
      const hasPageData = Array.isArray(djvuData?.pagesImages) && djvuData.pagesImages.length > 0;
      let effectiveDjvuData = djvuData;

      if (!hasPageData) {
        const fallbackText = await extractDjvuFallbackText(file);
        if (fallbackText) {
          effectiveDjvuData = {
            ...(djvuData || {}),
            pageCount: Math.max(1, Number(djvuData?.pageCount) || 1),
            pagesText: [fallbackText],
          };
        }
      }

      state.adapter = new DjVuAdapter(file.name, effectiveDjvuData);

      if (!hasPageData) {
        els.searchStatus.textContent = effectiveDjvuData?.pagesText?.[0]
          ? 'DjVu открыт в режиме совместимости. Для полного рендера нужен встроенный runtime файл app/vendor/djvu.js.'
          : 'DjVu-данные не найдены. Проверьте наличие app/vendor/djvu.js в поставке.';
      }
    }

    if (openedByNative) {
      saveDjvuData({});
    }
  } else if (lower.endsWith('.epub')) {
    try {
      const data = await progressiveLoader.loadFileProgressive(file);
      const epubData = await parseEpub(data);
      state.adapter = new EpubAdapter(epubData);
    } catch (err) {
      state.adapter = new UnsupportedAdapter(file.name);
      els.searchStatus.textContent = `ePub ошибка: ${err?.message || 'неизвестная ошибка'}`;
    }
  } else if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
    const url = URL.createObjectURL(file);
    state.currentObjectUrl = url;
    const imageMeta = await loadImage(url);
    state.adapter = new ImageAdapter(url, { width: imageMeta.width, height: imageMeta.height });
  } else {
    state.adapter = new UnsupportedAdapter(file.name);
  }

  state.pageCount = state.adapter.getPageCount();

  // Auto-load PDF forms if adapter is PDF
  if (state.adapter?.type === 'pdf') {
    formManager.loadFromAdapter(state.adapter).catch(() => {});
  }

  const hadSavedState = restoreViewStateIfPresent();
  // If no saved zoom, auto-fit page width for optimal initial display quality
  if (!hadSavedState && state.adapter) {
    try {
      const vp = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
      const scrollbarW = els.canvasWrap.offsetWidth - els.canvasWrap.clientWidth;
      const available = Math.max(200, els.canvasWrap.clientWidth - Math.max(16, scrollbarW + 16));
      const autoZoom = available / vp.width;
      if (autoZoom > 0.3 && autoZoom < 4) {
        state.zoom = Math.round(autoZoom * 100) / 100;
      }
    } catch (err) { console.warn('[app] zoom restore fallback:', err?.message); }
  }
  stopReadingTimer(false);
  state.readingTotalMs = loadReadingTime();
  state.readingStartedAt = null;
  state.readingGoalPage = loadReadingGoal();
  els.pageInput.max = String(state.pageCount);
  els.pageInput.value = String(state.currentPage);
  if (els.cloudSyncUrl) {
    els.cloudSyncUrl.value = loadCloudSyncUrl();
  }
  if (state.collabEnabled) {
    toggleCollaborationChannel();
  }

  saveRecent(file.name);
  renderRecent();
  loadNotes();
  renderBookmarks();
  renderDocInfo();
  renderVisitTrail();
  renderSearchHistory();
  renderSearchResultsList();
  renderDocStats();
  await renderOutline();
  await renderPagePreviews();
  await renderCurrentPage();
  pushDiagnosticEvent('file.open.finish', { name: state.docName, ms: Math.round(performance.now() - openStartedAt), pages: state.pageCount });
  estimatePageSkewAngle(state.currentPage);
  if (state.settings?.backgroundOcr) {
    scheduleBackgroundOcrScan('open-file', 900);
  } else {
    setOcrStatus('OCR: фоновое распознавание выключено в настройках');
  }
  loadPersistedEdits();
  renderCommentList();
  updateReadingTimeStatus();
  renderEtaStatus();
  startReadingTimer();
  recordPerfMetric('pageLoadTimes', Math.round(performance.now() - openStartedAt));
  try { toastInfo(`${state.docName || 'Документ'} — ${state.pageCount} стр.`); } catch (err) { console.warn('[file] toast failed:', err?.message); }
  try { announce(`Документ ${state.docName} открыт, ${state.pageCount} страниц`); } catch (err) { console.warn('[a11y] announce failed:', err?.message); }
};
const openFile = withErrorBoundary(_openFileImpl, 'file-open');

// ─── Rendering & Text Layer (extracted to render-controller.js) ──────────────
// Functions: _schedulePreRender, _preRenderAdjacent, _blitCacheToCanvas,
// _updateAnnotationCanvas, _updatePageUI, renderCurrentPage, safeCreateObjectURL,
// _renderPdfAnnotationLayer, _renderManualTextLayer, renderTextLayer,
// _renderOcrTextLayer, enableInlineTextEditing, disableInlineTextEditing,
// _handleTextLayerDblClick, _findParagraphSpans, _createParagraphEditor,
// _reflowTextToSpans, _createInlineEditor, _syncTextLayerToStorage,
// handleImageInsertion, addWatermarkToPage, addStampToPage, openSignaturePad
// — now imported from ./modules/render-controller.js

// ─── PDF Merge (via pdf-lib — preserves text, fonts, links, forms) ─────────
async function mergePdfFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    if (files.length < 2) {
      setOcrStatus('Выберите 2+ PDF файла для объединения');
      return;
    }
    try {
      setOcrStatus(`Объединение ${files.length} файлов (без потери данных)...`);
      const mergedBlob = await mergePdfDocuments(files);

      const url = safeCreateObjectURL(mergedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`Объединено: ${files.length} файлов (${Math.round(mergedBlob.size / 1024)} КБ)`);
      pushDiagnosticEvent('pdf.merge', { files: files.length, sizeKb: Math.round(mergedBlob.size / 1024) });
    } catch (err) {
      setOcrStatus(`Ошибка объединения: ${err?.message || 'неизвестная'}`);
      pushDiagnosticEvent('pdf.merge.error', { message: err?.message }, 'error');
    }
  });
  input.click();
}

function buildMergedPdfFromCanvases(pages) {
  // Simple PDF builder with images
  const encoder = new TextEncoder();
  let objects = [];
  let xrefOffsets = [];
  let body = '';
  let offset = 0;

  const header = '%PDF-1.4\n';
  body += header;
  offset = header.length;

  // Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  // Pages
  const pageRefs = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>\nendobj\n`);

  let objNum = 3;
  const imageObjects = [];

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const imgData = p.canvas.toDataURL('image/jpeg', 0.85);
    const base64 = imgData.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const pageObjNum = objNum++;
    const contentsObjNum = objNum++;
    const imgObjNum = objNum++;

    const stream = `q ${p.width} 0 0 ${p.height} 0 0 cm /Img${i} Do Q`;

    objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Contents ${contentsObjNum} 0 R /Resources << /XObject << /Img${i} ${imgObjNum} 0 R >> >> >>\nendobj\n`);
    objects.push(`${contentsObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

    imageObjects.push({ objNum: imgObjNum, data: imgBytes, width: p.width, height: p.height });
  }

  // Build the final PDF
  let pdfParts = [header];
  for (const obj of objects) {
    xrefOffsets.push(offset);
    pdfParts.push(obj);
    offset += obj.length;
  }

  // Image stream objects
  for (const img of imageObjects) {
    const imgHeader = `${img.objNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`;
    const imgFooter = `\nendstream\nendobj\n`;
    xrefOffsets.push(offset);
    pdfParts.push(imgHeader);
    offset += imgHeader.length;
    pdfParts.push(img.data);
    offset += img.data.length;
    pdfParts.push(imgFooter);
    offset += imgFooter.length;
  }

  const xrefStart = offset;
  const totalObjs = objects.length + imageObjects.length + 1;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const xo of xrefOffsets) {
    xref += `${String(xo).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  pdfParts.push(xref);

  // Combine text and binary parts
  const textParts = pdfParts.filter(p => typeof p === 'string');
  const allParts = pdfParts.map(p => typeof p === 'string' ? encoder.encode(p) : p);
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }

  return new Blob([result], { type: 'application/pdf' });
}

// ─── PDF Split (via pdf-lib — preserves all content) ────────────────────────
async function splitPdfPages() {
  if (!state.adapter || state.adapter.type !== 'pdf') {
    setOcrStatus('Разделение доступно только для PDF');
    return;
  }
  const rangeStr = await nrPrompt(`Введите диапазон страниц (напр. "1-3" или "1,3,5-7").\nВсего страниц: ${state.pageCount}`);
  if (!rangeStr) return;

  const pageNums = parsePageRangeLib(rangeStr, state.pageCount);
  if (!pageNums.length) {
    setOcrStatus('Неверный диапазон страниц');
    return;
  }

  try {
    setOcrStatus(`Извлечение ${pageNums.length} страниц (без потери данных)...`);
    const arrayBuffer = await state.file.arrayBuffer();
    const blob = await splitPdfDocument(arrayBuffer, pageNums);

    if (!blob) {
      setOcrStatus('Ошибка: не удалось извлечь страницы');
      return;
    }

    const url = safeCreateObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.docName || 'document'}-pages-${rangeStr}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setOcrStatus(`Извлечено ${pageNums.length} страниц (${Math.round(blob.size / 1024)} КБ)`);
    pushDiagnosticEvent('pdf.split', { pages: pageNums.length, sizeKb: Math.round(blob.size / 1024) });
  } catch (err) {
    setOcrStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
    pushDiagnosticEvent('pdf.split.error', { message: err?.message }, 'error');
  }
}

function parsePageRange(str, maxPage) {
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    const rangeParts = part.split('-').map(s => parseInt(s.trim(), 10));
    if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
      const p = rangeParts[0];
      if (p >= 1 && p <= maxPage) result.push(p);
    } else if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
      const from = Math.max(1, rangeParts[0]);
      const to = Math.min(maxPage, rangeParts[1]);
      for (let i = from; i <= to; i++) result.push(i);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}


function _saveViewStateNow() {
  if (!state.adapter || !state.docName) return;
  const payload = {
    page: state.currentPage,
    zoom: Number(state.zoom.toFixed(3)),
    rotation: state.rotation,
    pageCount: state.pageCount,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(viewStateKey(), JSON.stringify(payload));
}
const saveViewState = debounce(_saveViewStateNow, 2000);

function loadViewState() {
  try {
    const raw = localStorage.getItem(viewStateKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function clearViewState() {
  localStorage.removeItem(viewStateKey());
}

function renderReadingProgress() {
  if (!state.adapter || !state.pageCount) {
    els.progressStatus.textContent = '';
    return;
  }

  const percent = Math.round((state.currentPage / state.pageCount) * 100);
  els.progressStatus.textContent = `Страница ${state.currentPage} из ${state.pageCount} (${percent}%)`;
  renderEtaStatus();
}

function restoreViewStateIfPresent() {
  const saved = loadViewState();
  if (!saved) return false;

  if (Number.isInteger(saved.page) && saved.page >= 1 && saved.page <= state.pageCount) {
    state.currentPage = saved.page;
  }
  if (typeof saved.zoom === 'number' && Number.isFinite(saved.zoom)) {
    state.zoom = Math.min(4, Math.max(0.3, saved.zoom));
  }
  if (typeof saved.rotation === 'number' && Number.isFinite(saved.rotation)) {
    state.rotation = ((saved.rotation % 360) + 360) % 360;
  }
  return true;
}

async function resetReadingProgress() {
  if (!state.adapter) {
    els.progressStatus.textContent = 'Сначала откройте документ';
    return;
  }
  state.currentPage = 1;
  state.zoom = 1;
  state.rotation = 0;
  clearViewState();
  await renderCurrentPage();
  renderSearchResultsList();
}

function saveRecent(fileName) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = [fileName, ...recent.filter((x) => x !== fileName)].slice(0, 12);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
}

function removeRecent(name) {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  const next = recent.filter((x) => x !== name);
  localStorage.setItem('novareader-recent', JSON.stringify(next));
  renderRecent();
}

function clearRecent() {
  localStorage.removeItem('novareader-recent');
  renderRecent();
}

function renderRecent() {
  const recent = JSON.parse(localStorage.getItem('novareader-recent') || '[]');
  els.recentList.innerHTML = '';

  if (!recent.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Список пуст';
    els.recentList.appendChild(li);
    return;
  }

  recent.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const nameEl = document.createElement('div');
    nameEl.textContent = name;

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', () => removeRecent(name));

    actions.appendChild(removeBtn);
    li.appendChild(nameEl);
    li.appendChild(actions);
    els.recentList.appendChild(li);
  });
}

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
function mergeNotesByMode(current, incoming, mode) { return SettingsController.mergeNotesByMode(current, incoming, mode); }
function loadNotes() { SettingsController.loadNotes(noteKey); }
function setNotesStatus(message) { SettingsController.setNotesStatus(message); }
function saveNotes(source = 'manual') { SettingsController.saveNotes(noteKey, source); }
function queueNotesAutosave() { SettingsController.queueNotesAutosave(noteKey); }
function exportNotes() { SettingsController.exportNotes(); }
function exportNotesMarkdown() { SettingsController.exportNotesMarkdown(); }
function exportNotesJson() { SettingsController.exportNotesJson(); }
async function importNotesJson(file) { await SettingsController.importNotesJson(file, noteKey); }
function insertTimestamp() { SettingsController.insertTimestamp(noteKey); }
function normalizeHotkey(value, fallback) { return SettingsController.normalizeHotkey(value, fallback); }
function setHotkeysStatus(message, type = '') { SettingsController.setHotkeysStatus(message, type); }
const hotkeyFieldMeta = SettingsController.hotkeyFieldMeta;
function hotkeyKeys() { return SettingsController.hotkeyKeys(); }
function normalizeHotkeyForDisplay(value) { return SettingsController.normalizeHotkeyForDisplay(value); }
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

function renderDocInfo() {
  if (!state.file) {
    els.docInfo.textContent = '';
    return;
  }

  const sizeMb = (state.file.size / (1024 * 1024)).toFixed(2);
  const ext = state.file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const isDjvu = state.adapter?.type === 'djvu';
  if (els.importDjvuDataQuick) {
    els.importDjvuDataQuick.classList.toggle('is-hidden', !isDjvu);
  }
  const suffix = isDjvu && state.djvuBinaryDetected ? ' • DjVu binary detected' : '';
  els.docInfo.textContent = `${ext} • ${sizeMb} MB • ${state.pageCount} стр.${suffix}`;
}

async function buildOutlineItems(items = [], level = 0) {
  if (!canSearchCurrentDoc()) return [];
  const result = [];

  for (const item of items) {
    let page = null;
    if (item.dest) {
      try {
        page = await state.adapter.resolveDestToPage(item.dest);
      } catch (err) {
        page = null;
      }
    }

    result.push({ title: item.title || '(без названия)', page, level });

    if (item.items?.length) {
      const children = await buildOutlineItems(item.items, level + 1);
      result.push(...children);
    }
  }

  return result;
}

async function renderOutline() {
  els.outlineList.innerHTML = '';
  state.outline = [];

  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление доступно для PDF/DjVu';
    els.outlineList.appendChild(li);
    return;
  }

  const raw = await state.adapter.getOutline();
  if (!raw?.length) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.textContent = 'Оглавление отсутствует';
    els.outlineList.appendChild(li);
    return;
  }

  state.outline = await buildOutlineItems(raw, 0);

  state.outline.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.style.paddingLeft = `${8 + entry.level * 10}px`;
    const btn = document.createElement('button');
    btn.textContent = entry.page ? `${entry.title} (стр. ${entry.page})` : `${entry.title} (без ссылки)`;
    btn.disabled = !entry.page;
    btn.addEventListener('click', async () => {
      if (!entry.page) return;
      state.currentPage = entry.page;
      await renderCurrentPage();
    });
    li.appendChild(btn);
    els.outlineList.appendChild(li);
  });
}

function updatePreviewSelection() {
  const buttons = els.pagePreviewList.querySelectorAll('button[data-page]');
  buttons.forEach((btn) => {
    const page = Number(btn.dataset.page);
    btn.classList.toggle('active', page === state.currentPage);
  });
}

function _drawPreviewPlaceholder(canvas, pageNum) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10141b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Стр. ${pageNum}`, 12, 20);
}

async function _renderDeferredPreviews(from, to) {
  if (!state.adapter) return;
  const buttons = els.pagePreviewList.querySelectorAll('button[data-page]');
  for (const btn of buttons) {
    const page = Number(btn.dataset.page);
    if (page < from || page > to) continue;
    const canvas = btn.querySelector('canvas');
    if (!canvas || canvas.dataset.needsRender !== '1') continue;
    try {
      const viewport = await state.adapter.getPageViewport(page, 1, state.rotation);
      const scale = Math.min(120 / Math.max(1, viewport.width), 160 / Math.max(1, viewport.height));
      await state.adapter.renderPage(page, canvas, { zoom: scale, rotation: state.rotation });
      delete canvas.dataset.needsRender;
    } catch (err) { console.warn('[app] thumbnail placeholder fallback:', err?.message); }
    // Yield between previews to not block the main thread
    await yieldToMainThread();
  }
}

async function renderPagePreviews() {
  els.pagePreviewList.innerHTML = '';

  if (!state.adapter) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Откройте документ для превью';
    els.pagePreviewList.appendChild(li);
    return;
  }

  const maxPages = state.adapter.type === 'pdf' ? Math.min(state.pageCount, 24) : Math.min(state.pageCount, 4);
  // Render first batch immediately (fast initial paint), defer rest
  const immediateBatch = Math.min(maxPages, 6);

  for (let i = 1; i <= maxPages; i += 1) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    btn.className = 'preview-btn';
    btn.dataset.page = String(i);

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 160;

    // Only render first batch synchronously; the rest are placeholders
    // that will be rendered after the main page is displayed
    if (i <= immediateBatch) {
      try {
        const viewport = await state.adapter.getPageViewport(i, 1, state.rotation);
        const scale = Math.min(120 / Math.max(1, viewport.width), 160 / Math.max(1, viewport.height));
        await state.adapter.renderPage(i, canvas, { zoom: scale, rotation: state.rotation });
      } catch (err) {
        _drawPreviewPlaceholder(canvas, i);
      }
    } else {
      _drawPreviewPlaceholder(canvas, i);
      canvas.dataset.needsRender = '1';
    }

    const label = document.createElement('span');
    label.className = 'preview-label';
    label.textContent = `Страница ${i}`;

    btn.appendChild(canvas);
    btn.appendChild(label);
    btn.addEventListener('click', async () => {
      state.currentPage = i;
      await renderCurrentPage();
    });

    li.appendChild(btn);
    els.pagePreviewList.appendChild(li);
  }

  // Render deferred thumbnails in the background after file open completes
  if (maxPages > immediateBatch) {
    requestAnimationFrame(() => _renderDeferredPreviews(immediateBatch + 1, maxPages));
  }

  if (state.pageCount > maxPages) {
    const li = document.createElement('li');
    li.className = 'recent-item tiny muted';
    li.textContent = `Показаны первые ${maxPages} из ${state.pageCount} страниц`;
    els.pagePreviewList.appendChild(li);
  }

  updatePreviewSelection();
}

function ensureTextToolsVisible() {
  const key = uiLayoutKey('textHidden');
  if (localStorage.getItem(key) === '1') {
    localStorage.setItem(key, '0');
    applyLayoutState();
  }
}

async function refreshPageText() {
  ensureTextToolsVisible();

  if (!canSearchCurrentDoc()) {
    els.pageText.value = 'Извлечение текста доступно для PDF/DjVu';
    return;
  }

  let text = await state.adapter.getText(state.currentPage);
  if (!text) {
    const ocr = loadOcrTextData();
    text = String(ocr?.pagesText?.[state.currentPage - 1] || '');
  }
  els.pageText.value = text || '(На этой странице не найден текстовый слой)';
  if (!text && state.adapter?.type === 'djvu') {
    if (state.adapter?.mode === 'compat') {
      els.searchStatus.textContent = 'Для расширенного текста DjVu можно импортировать DjVu data JSON или OCR JSON.';
    } else {
      els.searchStatus.textContent = 'В этом DjVu-документе текстовый слой отсутствует.';
    }
  }
}

async function copyPageText() {
  if (!els.pageText.value) {
    await refreshPageText();
  }

  if (!els.pageText.value) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(els.pageText.value);
    return;
  }

  els.pageText.focus();
  els.pageText.select();
  document.execCommand('copy');
}

function exportPageText() {
  const text = els.pageText.value || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function setTextEditMode(enabled) {
  state.textEditMode = !!enabled;
  if (enabled) {
    toolStateMachine.transition(ToolMode.TEXT_EDIT);
    enableInlineTextEditing();
  } else {
    if (toolStateMachine.current === ToolMode.TEXT_EDIT) {
      toolStateMachine.transition(ToolMode.IDLE);
    }
    disableInlineTextEditing();
  }
  if (els.pageText) {
    els.pageText.readOnly = !state.textEditMode;
  }
  if (els.toggleTextEdit) {
    els.toggleTextEdit.textContent = state.textEditMode ? 'Ред. ВКЛ' : 'Ред.';
    els.toggleTextEdit.classList.toggle('active', state.textEditMode);
  }
}

function saveCurrentPageTextEdits() {
  if (!state.adapter || !state.docName) return;
  const txt = String(els.pageText?.value || '').trim();

  // Record in PDF edit layer for undo/redo
  setPageEdits(state.currentPage, txt);
  persistEdits();

  const cache = loadOcrTextData();
  const pagesText = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : new Array(state.pageCount).fill('');
  pagesText[state.currentPage - 1] = txt;
  saveOcrTextData({
    pagesText,
    source: 'manual-edit',
    scannedPages: Math.max(cache?.scannedPages || 0, state.currentPage),
    totalPages: state.pageCount,
    updatedAt: new Date().toISOString(),
  });
  const history = getEditHistory();
  setOcrStatus(`Правки сохранены (undo: ${history.undoCount}, redo: ${history.redoCount})`);
}

async function exportCurrentDocToWord() {
  if (!state.adapter) return;
  const title = String(state.docName || 'document').replace(/\.[^.]+$/, '');

  // Use the new docx library converter for PDF files with native text
  if (state.adapter?.type === 'pdf' && state.adapter.pdfDoc) {
    try {
      setOcrStatus('Экспорт DOCX: извлечение структуры...');
      const pageCount = state.pageCount || 1;

      // Capture page image function for text+images mode
      const captureImage = async (pageNum) => {
        const imgData = await capturePageAsImageData(pageNum);
        if (!imgData) return null;
        return Uint8Array.from(atob(imgData), c => c.charCodeAt(0));
      };

      const includeImages = pageCount <= 30;
      const blob = await convertPdfToDocx(state.adapter.pdfDoc, title, pageCount, {
        mode: includeImages ? 'text+images' : 'text',
        capturePageImage: includeImages ? captureImage : null,
        ocrWordCache: _ocrWordCache,
        includeFooter: true,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      recordSuccessfulOperation();
      setOcrStatus(`Экспорт DOCX: готово (${Math.round(blob.size / 1024)} КБ, ${pageCount} стр.)`);
      pushDiagnosticEvent('export.docx', { pages: pageCount, sizeKb: Math.round(blob.size / 1024), engine: 'docx-lib' });
      return;
    } catch (err) {
      console.warn('New DOCX converter failed, falling back to legacy:', err);
      pushDiagnosticEvent('export.docx.fallback', { error: err.message });
      // Fall through to legacy converter
    }
  }

  // Legacy fallback for non-PDF files or if new converter fails
  const cache = loadOcrTextData();
  const pages = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : [];
  const currentText = String(els.pageText?.value || '').trim();
  if (!pages[state.currentPage - 1] && currentText) {
    pages[state.currentPage - 1] = currentText;
  }

  for (const [pageNum, editText] of pdfEditState.edits) {
    if (editText && (!pages[pageNum - 1] || pages[pageNum - 1].length < editText.length)) {
      pages[pageNum - 1] = editText;
    }
  }

  const maxPages = Math.max(state.pageCount || 1, pages.length || 0);
  const textPages = [];
  for (let i = 0; i < maxPages; i++) {
    textPages.push(String(pages[i] || '').trim());
  }

  const hasContent = textPages.some(t => t.length > 0);
  if (!hasContent) {
    setOcrStatus('OCR: нет текста для экспорта в DOCX, выполните OCR/извлечение');
    return;
  }

  const includeImages = state.adapter?.type === 'pdf' && maxPages <= 20;

  try {
    setOcrStatus(includeImages ? 'Экспорт DOCX: генерация с изображениями...' : 'Экспорт DOCX: генерация...');
    const blob = includeImages
      ? await generateDocxWithImages(title, textPages, true)
      : await generateDocxBlob(title, textPages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    recordSuccessfulOperation();
    setOcrStatus(`Экспорт DOCX: готово (${Math.round(blob.size / 1024)} КБ${includeImages ? ', с изображениями' : ''})`);
    pushDiagnosticEvent('export.docx', { pages: maxPages, sizeKb: Math.round(blob.size / 1024), withImages: includeImages });
  } catch (error) {
    recordCrashEvent('export-error', error.message, 'docx');
    setOcrStatus(`Экспорт DOCX: ошибка — ${error.message}`);
    pushDiagnosticEvent('export.docx.error', { message: error.message }, 'error');
  }
}

function normalizePageInput() {
  const raw = Number.parseInt(els.pageInput.value, 10);
  if (Number.isNaN(raw)) return 1;
  return Math.max(1, Math.min(state.pageCount || 1, raw));
}

async function goToPage() {
  if (!state.adapter) return;
  state.currentPage = normalizePageInput();
  await renderCurrentPage();
}

async function fitWidth() {
  if (!state.adapter) return;
  const viewport = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
  // Use minimal padding (scrollbar width + canvas padding) for maximum use of space
  const scrollbarWidth = els.canvasWrap.offsetWidth - els.canvasWrap.clientWidth;
  const padding = Math.max(16, scrollbarWidth + 16);
  const available = Math.max(200, els.canvasWrap.clientWidth - padding);
  state.zoom = Math.max(0.3, Math.min(4, available / viewport.width));
  await renderCurrentPage();
}

async function fitPage() {
  if (!state.adapter) return;
  const viewport = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
  const scrollbarW = els.canvasWrap.offsetWidth - els.canvasWrap.clientWidth;
  const scrollbarH = els.canvasWrap.offsetHeight - els.canvasWrap.clientHeight;
  const paddingW = Math.max(16, scrollbarW + 16);
  const paddingH = Math.max(16, scrollbarH + 16);
  const availableWidth = Math.max(200, els.canvasWrap.clientWidth - paddingW);
  const availableHeight = Math.max(200, els.canvasWrap.clientHeight - paddingH);
  state.zoom = Math.max(0.3, Math.min(4, Math.min(availableWidth / viewport.width, availableHeight / viewport.height)));
  await renderCurrentPage();
}

function downloadCurrentFile() {
  if (!state.file) return;
  const url = safeCreateObjectURL(state.file);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function printCanvasPage() {
  if (!state.adapter) return;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = els.canvas.width;
  exportCanvas.height = els.canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.drawImage(els.canvas, 0, 0);
  ctx.drawImage(els.annotationCanvas, 0, 0, els.annotationCanvas.width, els.annotationCanvas.height, 0, 0, els.canvas.width, els.canvas.height);

  const dataUrl = exportCanvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><title>Print</title><img src="${dataUrl}" style="width:100%;"/>`);
  win.document.close();
  win.focus();
  win.print();
}


function uiLayoutKey(name) {
  return `novareader-ui-layout:${name}`;
}

function applyAdvancedPanelsState() {
  const hidden = localStorage.getItem(uiLayoutKey('advancedHidden')) !== '0';
  document.body.classList.toggle('advanced-hidden', hidden);
  if (els.toggleAdvancedPanels) {
    els.toggleAdvancedPanels.textContent = `Расширенные: ${hidden ? 'off' : 'on'}`;
  }
}

function toggleAdvancedPanelsState() {
  const key = uiLayoutKey('advancedHidden');
  const hidden = localStorage.getItem(key) !== '0';
  localStorage.setItem(key, hidden ? '0' : '1');
  applyAdvancedPanelsState();
}

function applyLayoutState() {
  const sidebarRaw = localStorage.getItem(uiLayoutKey('sidebarHidden'));
  const toolsRaw = localStorage.getItem(uiLayoutKey('toolsHidden'));
  const textRaw = localStorage.getItem(uiLayoutKey('textHidden'));
  const searchToolsRaw = localStorage.getItem(uiLayoutKey('searchToolsHidden'));
  const annotToolsRaw = localStorage.getItem(uiLayoutKey('annotToolsHidden'));

  const sidebarHidden = sidebarRaw === '1';
  const toolsHidden = toolsRaw === '1';
  const textHidden = textRaw === null ? false : textRaw === '1';
  const searchToolsHidden = searchToolsRaw === null ? false : searchToolsRaw === '1';
  const annotToolsHidden = annotToolsRaw === null ? false : annotToolsRaw === '1';

  document.querySelector('.app-shell')?.classList.toggle('sidebar-hidden', sidebarHidden);
  document.querySelector('.viewer-area')?.classList.toggle('toolsbar-hidden', toolsHidden);
  document.querySelector('.viewer-area')?.classList.toggle('texttools-hidden', textHidden);
  document.querySelector('.viewer-area')?.classList.toggle('searchtools-hidden', searchToolsHidden);
  document.querySelector('.viewer-area')?.classList.toggle('annottools-hidden', annotToolsHidden);

  if (els.toggleSidebar) els.toggleSidebar.classList.toggle('active', !sidebarHidden);
  if (els.toggleToolsBar) els.toggleToolsBar.classList.toggle('active', !toolsHidden);
  if (els.toggleTextTools) els.toggleTextTools.classList.toggle('active', !textHidden);
  if (els.toggleSearchTools) els.toggleSearchTools.classList.toggle('active', !searchToolsHidden);
  if (els.toggleAnnotTools) els.toggleAnnotTools.classList.toggle('active', !annotToolsHidden);
  if (els.toggleTextToolsInline) els.toggleTextToolsInline.textContent = textHidden ? '▸' : '▾';
  updateSearchToolbarRows();
}

function updateSearchToolbarRows() {
  if (!els.searchToolsGroup) return;
  const apply = () => {
    const controls = [els.searchInput, els.searchScope, els.searchBtn, els.searchPrev, els.searchNext]
      .filter(Boolean)
      .filter((el) => el.offsetParent !== null);
    if (!controls.length) {
      document.documentElement.style.setProperty('--search-toolbar-rows', '1');
      return;
    }

    const tops = new Set();
    controls.forEach((el) => tops.add(Math.round(el.getBoundingClientRect().top)));
    const rows = Math.max(1, tops.size);
    document.documentElement.style.setProperty('--search-toolbar-rows', String(rows));

    const sample = controls[0];
    const rowHeight = Math.max(18, Math.round(sample.getBoundingClientRect().height) + 4);
    document.documentElement.style.setProperty('--search-toolbar-row-height', `${rowHeight}px`);
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      apply();
      setTimeout(apply, 80);
      setTimeout(apply, 220);
    });
    return;
  }

  apply();
}

function toggleLayoutState(name) {
  const key = uiLayoutKey(name);
  const next = localStorage.getItem(key) === '1' ? '0' : '1';
  localStorage.setItem(key, next);
  applyLayoutState();
}

function applyResizableLayoutState() {
  const sidebarWidth = Number(localStorage.getItem(uiLayoutKey('sidebarWidth')) || 220);
  const pageAreaPx = Number(localStorage.getItem(uiLayoutKey('pageAreaPx')) || 0);
  const safeSidebar = Math.max(180, Math.min(360, sidebarWidth));
  const safePage = Math.max(520, Math.min(3200, pageAreaPx || 0));
  document.querySelector('.app-shell')?.style.setProperty('--sidebar-width', `${safeSidebar}px`);
  if (pageAreaPx > 0) {
    document.querySelector('.viewer-area')?.style.setProperty('--page-area-height', `${safePage}px`);
  }
}

function ensureDefaultPageAreaHeight() {
  const raw = Number(localStorage.getItem(uiLayoutKey('pageAreaPx')) || 0);
  const viewerArea = document.querySelector('.viewer-area');
  if (!viewerArea) return;

  const preferred = Math.max(860, Math.floor(viewerArea.clientHeight * 0.92));
  if (raw <= 0 || raw < 520) {
    localStorage.setItem(uiLayoutKey('pageAreaPx'), String(preferred));
  }

  const rawSidebar = Number(localStorage.getItem(uiLayoutKey('sidebarWidth')) || 0);
  if (rawSidebar <= 0 || rawSidebar > 360) {
    localStorage.setItem(uiLayoutKey('sidebarWidth'), '220');
  }

  applyResizableLayoutState();
}

function setupResizableLayout() {
  applyResizableLayoutState();
  ensureDefaultPageAreaHeight();

  const debouncedSaveSidebar = debounce((val) => localStorage.setItem(uiLayoutKey('sidebarWidth'), val), 300);
  const debouncedSavePage = debounce((val) => localStorage.setItem(uiLayoutKey('pageAreaPx'), val), 300);

  if (els.sidebarResizeHandle) {
    let active = false;
    const appShell = document.querySelector('.app-shell');
    const onMove = throttle((e) => {
      if (!active || !appShell) return;
      const shellRect = appShell.getBoundingClientRect();
      const raw = e.clientX - shellRect.left;
      const safe = Math.max(180, Math.min(360, raw));
      const val = String(Math.round(safe));
      debouncedSaveSidebar(val);
      appShell.style.setProperty('--sidebar-width', `${Math.round(safe)}px`);
    }, 32);
    els.sidebarResizeHandle.addEventListener('pointerdown', (e) => {
      active = true;
      els.sidebarResizeHandle.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', () => { active = false; });
  }

  if (els.canvasResizeHandle) {
    let active = false;
    const viewerArea = document.querySelector('.viewer-area');
    const textTools = document.getElementById('textToolsSection');
    const onMove = throttle((e) => {
      if (!active || !viewerArea || !els.canvasWrap) return;
      const viewerRect = viewerArea.getBoundingClientRect();
      const canvasRect = els.canvasWrap.getBoundingClientRect();
      const textHidden = viewerArea.classList.contains('texttools-hidden');
      const minTextHeight = textTools && !textHidden ? Math.max(24, Number(state.settings?.uiTextMinHeight) || 40) : 0;
      const maxPageHeight = Math.max(420, viewerRect.height - minTextHeight - 14);
      const rawPageHeight = e.clientY - canvasRect.top;
      const safePageHeight = Math.max(420, Math.min(maxPageHeight, rawPageHeight));
      const val = String(Math.round(safePageHeight));
      debouncedSavePage(val);
      viewerArea.style.setProperty('--page-area-height', `${Math.round(safePageHeight)}px`);
    }, 32);
    els.canvasResizeHandle.addEventListener('pointerdown', (e) => {
      active = true;
      els.canvasResizeHandle.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', () => { active = false; });
  }
}

function setupDragAndDrop() {
  ['dragenter', 'dragover'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) await openFile(file);
  });
}

function setupAnnotationEvents() {
  const target = els.annotationCanvas;
  target.addEventListener('pointerdown', beginStroke);
  target.addEventListener('pointermove', moveStroke);
  target.addEventListener('pointerup', endStroke);
  target.addEventListener('pointerleave', endStroke);
  target.addEventListener('dblclick', (e) => {
    const p = getCanvasPointFromEvent(e);
    const comments = loadComments();
    for (let i = 0; i < comments.length; i += 1) {
      const c = denormalizePoint(comments[i].point);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d <= 14) {
        const overlay = document.createElement('div');
        overlay.className = 'modal open';
        overlay.innerHTML = `<div class="modal-card" style="width:min(400px,80vw)">
          <div class="modal-head"><h3>Комментарий</h3><button id="closeCommentPopup">✕</button></div>
          <div class="modal-body"><p style="margin:0;white-space:pre-wrap">${comments[i].text.replace(/</g, '&lt;')}</p></div>
        </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('#closeCommentPopup').addEventListener('click', close);
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
        break;
      }
    }
  });

  // Text layer context menu for quick markup on text selection
  if (els.textLayerDiv) {
    els.textLayerDiv.addEventListener('mouseup', () => {
      // Remove existing popup
      document.querySelector('.text-markup-popup')?.remove();

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      if (!els.textLayerDiv.contains(sel.anchorNode)) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width < 3) return;

      const popup = document.createElement('div');
      popup.className = 'text-markup-popup';
      popup.style.cssText = `
        position: fixed; left: ${rect.left}px; top: ${rect.top - 36}px;
        z-index: 10000; display: flex; gap: 2px; background: var(--bg-card, #1e1e2e);
        border: 1px solid var(--border, #444); border-radius: 6px; padding: 3px 5px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      `;
      const tools = [
        { tool: 'text-highlight', icon: '🖍', title: 'Выделить' },
        { tool: 'text-underline', icon: '⎁', title: 'Подчеркнуть' },
        { tool: 'text-strikethrough', icon: '⊟', title: 'Зачеркнуть' },
        { tool: 'text-squiggly', icon: '〰', title: 'Волнистая' },
      ];
      for (const t of tools) {
        const btn = document.createElement('button');
        btn.textContent = t.icon;
        btn.title = t.title;
        btn.style.cssText = 'border:none; background:transparent; cursor:pointer; font-size:16px; padding:3px 6px; border-radius:4px; color: var(--text,#eee);';
        btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--hover, #333)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
        btn.addEventListener('click', () => {
          _applyTextMarkupFromSelection(window.getSelection(), t.tool);
          window.getSelection()?.removeAllRanges();
          popup.remove();
        });
        popup.appendChild(btn);
      }
      document.body.appendChild(popup);

      // Auto-remove on click outside
      const removePopup = (ev) => {
        if (!popup.contains(ev.target)) {
          popup.remove();
          document.removeEventListener('mousedown', removePopup);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', removePopup), 50);
    });
  }
}

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

// ─── Page Organizer UI ──────────────────────────────────────────────────────
{
  const orgModal = document.getElementById('pageOrganizerModal');
  const orgGrid = document.getElementById('pageOrgGrid');
  const orgStatus = document.getElementById('pageOrgStatus');
  let orgState = null;
  let orgPdfBytes = null;
  let orgNewOrder = null;

  async function openPageOrganizer() {
    if (!state.adapter || state.adapter.type !== 'pdf') {
      toastError('Организатор страниц доступен только для PDF');
      return;
    }
    orgModal.style.display = '';
    orgModal.classList.add('open');
    orgStatus.textContent = 'Загрузка страниц...';

    try {
      orgPdfBytes = await state.adapter.getRawBytes();
      const pages = await getPageInfoList(orgPdfBytes);
      orgState = createOrganizerState(pages);
      orgNewOrder = pages.map((_, i) => i);
      await renderOrgGrid();
      orgStatus.textContent = `${pages.length} страниц`;
    } catch (err) {
      orgStatus.textContent = `Ошибка: ${err.message}`;
    }
  }

  async function renderOrgGrid() {
    if (!orgState || !orgGrid) return;
    orgGrid.innerHTML = '';

    for (let i = 0; i < orgNewOrder.length; i++) {
      const pageIdx = orgNewOrder[i];
      const pageNum = pageIdx + 1;

      const thumb = document.createElement('div');
      thumb.className = 'page-org-thumb';
      thumb.dataset.idx = String(i);
      thumb.draggable = true;
      if (orgState.selected.has(i)) thumb.classList.add('selected');

      // Render thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = 140;
      canvas.height = 200;
      thumb.appendChild(canvas);

      // Label
      const label = document.createElement('div');
      label.className = 'page-org-label';
      label.innerHTML = `<span class="page-num">${pageNum}</span>`;
      thumb.appendChild(label);

      // Click to select
      thumb.addEventListener('click', (e) => {
        const idx = parseInt(thumb.dataset.idx);
        if (e.shiftKey && orgState.selected.size > 0) {
          const lastSelected = [...orgState.selected].pop();
          orgState = selectPageRange(orgState, lastSelected, idx);
        } else {
          orgState = togglePageSelection(orgState, idx, e.ctrlKey || e.metaKey);
        }
        updateOrgSelectionUI();
      });

      // Drag events
      thumb.addEventListener('dragstart', (e) => {
        if (!orgState.selected.has(i)) {
          orgState = togglePageSelection(orgState, i, false);
          updateOrgSelectionUI();
        }
        orgState.dragSource = i;
        thumb.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      thumb.addEventListener('dragend', () => {
        thumb.classList.remove('dragging');
        orgGrid.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
      });

      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        thumb.classList.add('drop-target');
      });

      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drop-target');
      });

      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drop-target');
        const dropIdx = parseInt(thumb.dataset.idx);
        if (orgState.selected.size > 0) {
          const newOrd = computeReorderFromDrag(orgState, dropIdx);
          orgNewOrder = newOrd.map(ni => orgNewOrder[ni] ?? ni);
          orgState.selected.clear();
          renderOrgGrid();
        }
      });

      orgGrid.appendChild(thumb);

      // Render page thumbnail asynchronously
      renderThumbnailAsync(canvas, pageNum).catch(() => {});
    }
  }

  async function renderThumbnailAsync(canvas, pageNum) {
    try {
      const page = await state.adapter.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) { console.warn('[app] render error (non-critical):', err?.message); }
  }

  function updateOrgSelectionUI() {
    const thumbs = orgGrid.querySelectorAll('.page-org-thumb');
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('selected', orgState.selected.has(i));
    });
    const selCount = orgState.selected.size;
    orgStatus.textContent = selCount > 0
      ? `Выбрано: ${selCount} из ${orgNewOrder.length}`
      : `${orgNewOrder.length} страниц`;
  }

  document.getElementById('openPageOrganizer')?.addEventListener('click', openPageOrganizer);

  document.getElementById('pageOrgClose')?.addEventListener('click', () => {
    orgModal.style.display = 'none';
    orgModal.classList.remove('open');
  });

  document.getElementById('pageOrgCancel')?.addEventListener('click', () => {
    orgModal.style.display = 'none';
    orgModal.classList.remove('open');
  });

  document.getElementById('pageOrgApply')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgNewOrder) return;
    orgStatus.textContent = 'Применение изменений...';
    try {
      const newPdf = await reorderPages(orgPdfBytes, orgNewOrder);
      // Reload the document with new PDF bytes
      const blob = new Blob([newPdf], { type: 'application/pdf' });
      const file = new File([blob], state.docName || 'reorganized.pdf', { type: 'application/pdf' });
      orgModal.style.display = 'none';
      orgModal.classList.remove('open');
      // Re-open the file
      if (typeof handleFileOpen === 'function') {
        await handleFileOpen(file);
      }
      toastSuccess('Страницы реорганизованы');
    } catch (err) {
      orgStatus.textContent = `Ошибка: ${err.message}`;
    }
  });

  document.getElementById('pageOrgRotateCW')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgState?.selected.size) return;
    const indices = [...orgState.selected].map(i => orgNewOrder[i]);
    orgPdfBytes = await rotatePages(orgPdfBytes, indices, 90);
    await renderOrgGrid();
  });

  document.getElementById('pageOrgDelete')?.addEventListener('click', async () => {
    if (!orgState?.selected.size) return;
    const toDelete = new Set([...orgState.selected]);
    orgNewOrder = orgNewOrder.filter((_, i) => !toDelete.has(i));
    orgState.selected.clear();
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });

  document.getElementById('pageOrgDuplicate')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgState?.selected.size) return;
    const indices = [...orgState.selected].sort((a, b) => b - a);
    for (const i of indices) {
      orgNewOrder.splice(i + 1, 0, orgNewOrder[i]);
    }
    orgState.selected.clear();
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });

  document.getElementById('pageOrgInsertBlank')?.addEventListener('click', async () => {
    if (!orgPdfBytes) return;
    orgPdfBytes = await insertBlankPage(orgPdfBytes, orgNewOrder.length);
    const newIdx = (await getPageInfoList(orgPdfBytes)).length - 1;
    orgNewOrder.push(newIdx);
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });

  document.getElementById('pageOrgExtract')?.addEventListener('click', async () => {
    if (!orgPdfBytes || !orgState?.selected.size) return;
    const indices = [...orgState.selected].map(i => orgNewOrder[i]);
    const extracted = await extractPages(orgPdfBytes, indices);
    const blob = new Blob([extracted], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_pages.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('pageOrgReverse')?.addEventListener('click', async () => {
    orgNewOrder.reverse();
    orgState.selected.clear();
    orgState = createOrganizerState(orgNewOrder.map((_, i) => ({ index: i })));
    await renderOrgGrid();
  });
}

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

// ─── UI Tab Switching (sidebar, bottom toolbar, settings modal) ──────────────
(function initTabSwitching() {
  // Sidebar tabs
  document.querySelectorAll('.sidebar-tabs button[data-sidebar-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`.sidebar-panel[data-sidebar-panel="${btn.dataset.sidebarTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Bottom toolbar tabs
  document.querySelectorAll('.bottom-tab-bar button[data-bottom-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bottom-tab-bar button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.bottom-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`.bottom-tab-panel[data-bottom-panel="${btn.dataset.bottomTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Settings modal tabs
  document.querySelectorAll('.modal-tabs button[data-modal-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`.modal-tab-panel[data-modal-panel="${btn.dataset.modalTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Dropdown menus — toggle on click, close on outside click
  document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = trigger.closest('.dropdown');
      const wasOpen = dd.classList.contains('open');
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  });
  // Close dropdown when a menu item is clicked
  document.querySelectorAll('.dropdown-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.dropdown')?.classList.remove('open');
    });
  });
})();

// ─── Status Bar Updates ─────────────────────────────────────────────────────
function updateStatusBar() {
  if (els.sbPage) els.sbPage.textContent = `Стр. ${state.currentPage} / ${state.pageCount || '—'}`;
  if (els.sbZoom) els.sbZoom.textContent = `${Math.round(state.zoom * 100)}%`;
  if (els.sbReadingTime) {
    const mins = Math.round((state.readingTotalMs || 0) / 60000);
    els.sbReadingTime.textContent = `Чтение: ${mins} мин`;
  }
  if (els.sbFileSize && state.file) {
    const bytes = state.file.size || 0;
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    els.sbFileSize.textContent = bytes > 0 ? `${mb} МБ` : '—';
  }
}
// Hook status bar into page changes
const _origUpdatePageUI = typeof _updatePageUI === 'function' ? _updatePageUI : null;
// Call updateStatusBar after page renders
setInterval(updateStatusBar, 2000);
updateStatusBar();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Pro PDF Tool Handlers
// ═══════════════════════════════════════════════════════════════════════════════

const pdfRedactor = new PdfRedactor();

// Helper: require a loaded PDF file
function requirePdfFile() {
  if (!state.file || state.adapter?.type !== 'pdf') {
    setOcrStatus('Откройте PDF-файл для использования этого инструмента');
    return null;
  }
  return state.file;
}

// ── PDF Redaction ──
if (document.getElementById('pdfRedact')) {
  document.getElementById('pdfRedact').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;

    const patternName = await nrPrompt(
      'Выберите тип данных для редактирования:\n' +
      Object.keys(REDACTION_PATTERNS).join(', ') +
      '\n\nИли введите произвольный regex:');
    if (!patternName) return;

    try {
      setOcrStatus('Поиск конфиденциальных данных...');
      const arrayBuffer = await file.arrayBuffer();

      // Use predefined pattern or custom regex
      if (REDACTION_PATTERNS[patternName]) {
        // Get text from all pages and mark patterns
        for (let p = 1; p <= state.pageCount; p++) {
          const page = await state.adapter.pdfDoc.getPage(p);
          const content = await page.getTextContent();
          const text = content.items.map(item => item.str).join(' ');
          pdfRedactor.markPattern(p, text, patternName);
        }
      } else {
        // Custom regex
        for (let p = 1; p <= state.pageCount; p++) {
          const page = await state.adapter.pdfDoc.getPage(p);
          const content = await page.getTextContent();
          const text = content.items.map(item => item.str).join(' ');
          pdfRedactor.markRegex(p, text, new RegExp(patternName, 'gi'));
        }
      }

      const marks = pdfRedactor.getMarks();
      const totalMarks = marks.reduce((sum, m) => sum + m.areas.length, 0);

      if (totalMarks === 0) {
        setOcrStatus('Совпадений не найдено');
        return;
      }

      const apply = await nrConfirm(`Найдено ${totalMarks} совпадений. Применить редактирование? Это действие необратимо.`);
      if (!apply) {
        pdfRedactor.clearAll();
        return;
      }

      setOcrStatus('Применение редактирования...');
      const result = await pdfRedactor.applyRedactions(arrayBuffer);
      const url = safeCreateObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-redacted.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`Редактирование завершено: ${result.redactedCount} областей в ${result.pagesProcessed} стр.`);
      pushDiagnosticEvent('pdf.redact', { areas: result.redactedCount, pages: result.pagesProcessed });
    } catch (err) {
      setOcrStatus(`Ошибка редактирования: ${err?.message || 'неизвестная'}`);
    }
  });
}

// ── PDF Optimize ──
if (document.getElementById('pdfOptimize')) {
  document.getElementById('pdfOptimize').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;

    try {
      setOcrStatus('Оптимизация PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const result = await pdfOptimizer.optimize(arrayBuffer);
      const url = safeCreateObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-optimized.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`Оптимизация: ${result.summary}`);
      pushDiagnosticEvent('pdf.optimize', { original: result.original, optimized: result.optimized, savingsPercent: result.savingsPercent });
    } catch (err) {
      setOcrStatus(`Ошибка оптимизации: ${err?.message || 'неизвестная'}`);
    }
  });
}

// ── PDF Flatten ──
if (document.getElementById('pdfFlatten')) {
  document.getElementById('pdfFlatten').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;

    try {
      setOcrStatus('Выравнивание PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const result = await flattenPdf(arrayBuffer, { flattenForms: true, flattenAnnotations: true });
      const url = safeCreateObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-flattened.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`Выровнено: ${result.formsFlattened} форм, ${result.annotationsFlattened} аннотаций`);
      pushDiagnosticEvent('pdf.flatten', { forms: result.formsFlattened, annotations: result.annotationsFlattened });
    } catch (err) {
      setOcrStatus(`Ошибка выравнивания: ${err?.message || 'неизвестная'}`);
    }
  });
}

// ── Accessibility Check ──
if (document.getElementById('pdfAccessibility')) {
  document.getElementById('pdfAccessibility').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;

    try {
      setOcrStatus('Проверка доступности...');
      const arrayBuffer = await file.arrayBuffer();
      const result = await checkAccessibility(arrayBuffer);

      let msg = `Доступность: ${result.score}/100 (${result.level})\n`;
      msg += `Ошибок: ${result.summary.errors}, Предупреждений: ${result.summary.warnings}\n\n`;
      for (const issue of result.issues) {
        msg += `[${issue.severity.toUpperCase()}] ${issue.rule}: ${issue.message}\n`;
        msg += `  Рекомендация: ${issue.fix}\n\n`;
      }

      if (result.issues.some(i => i.autoFixable)) {
        const fix = await nrConfirm(msg + '\nИсправить автоматически исправляемые проблемы?');
        if (fix) {
          const fixed = await autoFixAccessibility(arrayBuffer, {
            title: state.docName || 'Document',
            language: 'ru',
          });
          const url = safeCreateObjectURL(fixed.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${state.docName || 'document'}-accessible.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          setOcrStatus(`Исправлено ${fixed.fixCount} проблем доступности`);
          return;
        }
      }

      setOcrStatus(`Доступность: ${result.score}/100 — ${result.summary.errors} ошибок, ${result.summary.warnings} предупреждений`);
      toastInfo(msg);
      pushDiagnosticEvent('pdf.accessibility', { score: result.score, level: result.level, errors: result.summary.errors });
    } catch (err) {
      setOcrStatus(`Ошибка проверки доступности: ${err?.message || 'неизвестная'}`);
    }
  });
}

// ── PDF Compare ──
if (document.getElementById('pdfCompare')) {
  document.getElementById('pdfCompare').addEventListener('click', async () => {
    if (!state.adapter || state.adapter.type !== 'pdf') {
      setOcrStatus('Откройте PDF-файл для сравнения');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file2 = e.target.files?.[0];
      if (!file2) return;

      try {
        setOcrStatus('Сравнение документов...');
        const pdf = await ensurePdfJs();
        const ab2 = await file2.arrayBuffer();
        const pdfDoc2 = await pdf.getDocument({ data: ab2 }).promise;

        const result = await pdfCompare.compareText(state.adapter.pdfDoc, pdfDoc2);
        const html = pdfCompare.generateDiffHtml(result.diff);

        // Show results in a new window
        const win = window.open('', '_blank', 'width=800,height=600');
        if (win) {
          win.document.write(`
            <html><head><title>Сравнение документов</title>
            <style>
              body { font-family: monospace; font-size: 13px; padding: 16px; background: #1b1b1f; color: #d4d4d8; }
              .diff-add { background: #1a3a1a; color: #4ade80; }
              .diff-remove { background: #3a1a1a; color: #f87171; }
              .diff-equal { color: #71717a; }
              .diff-prefix { display: inline-block; width: 20px; }
              h2 { color: #e4e4e7; }
            </style></head><body>
            <h2>Сравнение: ${state.docName} vs ${file2.name}</h2>
            <p>Изменено строк: ${result.summary.changePercent}% (${result.summary.addedLines} добавлено, ${result.summary.removedLines} удалено)</p>
            ${html}
            </body></html>`);
          win.document.close();
        }

        setOcrStatus(`Сравнение: ${result.summary.changePercent}% различий (${result.summary.addedLines}+, ${result.summary.removedLines}-)`);
        pushDiagnosticEvent('pdf.compare', { changePercent: result.summary.changePercent });
      } catch (err) {
        setOcrStatus(`Ошибка сравнения: ${err?.message || 'неизвестная'}`);
      }
    };
    input.click();
  });
}

// ── Header/Footer ──
if (document.getElementById('pdfHeaderFooter')) {
  document.getElementById('pdfHeaderFooter').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;

    const format = await nrPrompt(
      'Шаблон колонтитула (переменные: {{page}}, {{total}}, {{date}}, {{title}}):\n' +
      'Пример: "{{page}} / {{total}}"',
      '{{page}} / {{total}}');
    if (!format) return;

    const position = await nrPrompt('Позиция: top (верх) или bottom (низ)?', 'bottom');
    if (!position) return;

    try {
      setOcrStatus('Добавление колонтитулов...');
      const arrayBuffer = await file.arrayBuffer();
      const blob = await addHeaderFooter(arrayBuffer, {
        [position === 'top' ? 'headerCenter' : 'footerCenter']: format,
      });
      const url = safeCreateObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-with-headers.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus('Колонтитулы добавлены');
      pushDiagnosticEvent('pdf.headerFooter');
    } catch (err) {
      setOcrStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
    }
  });
}

// ── Bates Numbering ──
if (document.getElementById('pdfBatesNumber')) {
  document.getElementById('pdfBatesNumber').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;

    const prefix = await nrPrompt('Префикс Бейтса (напр. "DOC-"):', 'DOC-');
    if (prefix === null) return;
    const startStr = await nrPrompt('Начальный номер:', '1');
    if (!startStr) return;

    try {
      setOcrStatus('Добавление нумерации Бейтса...');
      const arrayBuffer = await file.arrayBuffer();
      const result = await addBatesNumbering(arrayBuffer, {
        prefix,
        startNum: parseInt(startStr, 10) || 1,
        digits: 6,
        position: 'bottom-right',
      });
      const url = safeCreateObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.docName || 'document'}-bates.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOcrStatus(`Нумерация Бейтса: ${result.startNum}–${result.endNum} (${result.totalPages} стр.)`);
      pushDiagnosticEvent('pdf.bates', { startNum: result.startNum, endNum: result.endNum });
    } catch (err) {
      setOcrStatus(`Ошибка нумерации: ${err?.message || 'неизвестная'}`);
    }
  });
}

// ── Page Organizer Buttons ──
if (document.getElementById('orgRotateCW')) {
  document.getElementById('orgRotateCW').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;
    try {
      setOcrStatus('Поворот страницы по часовой стрелке...');
      const arrayBuffer = await file.arrayBuffer();
      const blob = await rotatePdfPages(arrayBuffer, [state.pageNum], 90);
      if (blob) {
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-rotated.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus('Страница повёрнута на 90°');
      }
    } catch (err) {
      setOcrStatus(`Ошибка поворота: ${err?.message || 'неизвестная'}`);
    }
  });
}

if (document.getElementById('orgRotateCCW')) {
  document.getElementById('orgRotateCCW').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;
    try {
      setOcrStatus('Поворот страницы против часовой стрелки...');
      const arrayBuffer = await file.arrayBuffer();
      const blob = await rotatePdfPages(arrayBuffer, [state.pageNum], -90);
      if (blob) {
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-rotated.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus('Страница повёрнута на -90°');
      }
    } catch (err) {
      setOcrStatus(`Ошибка поворота: ${err?.message || 'неизвестная'}`);
    }
  });
}

if (document.getElementById('orgDelete')) {
  document.getElementById('orgDelete').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;
    if (state.pageCount <= 1) {
      setOcrStatus('Невозможно удалить единственную страницу');
      return;
    }
    const confirmed = await nrConfirm(`Удалить страницу ${state.currentPage} из документа?`);
    if (!confirmed) return;

    try {
      setOcrStatus('Удаление страницы...');
      const arrayBuffer = await file.arrayBuffer();
      // Extract all pages except current
      const pages = [];
      for (let i = 1; i <= state.pageCount; i++) {
        if (i !== state.pageNum) pages.push(i);
      }
      const blob = await splitPdfDocument(arrayBuffer, pages);
      if (blob) {
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-page-removed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus(`Страница ${state.pageNum} удалена, сохранено ${pages.length} стр.`);
      }
    } catch (err) {
      setOcrStatus(`Ошибка удаления: ${err?.message || 'неизвестная'}`);
    }
  });
}

if (document.getElementById('orgExtract')) {
  document.getElementById('orgExtract').addEventListener('click', async () => {
    const file = requirePdfFile();
    if (!file) return;
    const rangeStr = await nrPrompt(`Извлечь страницы (напр. "1-3" или "2,5,7").\nТекущая: ${state.currentPage}, Всего: ${state.pageCount}`, String(state.currentPage));
    if (!rangeStr) return;

    const pageNums = parsePageRangeLib(rangeStr, state.pageCount);
    if (!pageNums.length) {
      setOcrStatus('Неверный диапазон страниц');
      return;
    }

    try {
      setOcrStatus(`Извлечение ${pageNums.length} страниц...`);
      const arrayBuffer = await file.arrayBuffer();
      const blob = await splitPdfDocument(arrayBuffer, pageNums);
      if (blob) {
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-extracted.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus(`Извлечено ${pageNums.length} страниц`);
      }
    } catch (err) {
      setOcrStatus(`Ошибка извлечения: ${err?.message || 'неизвестная'}`);
    }
  });
}

if (document.getElementById('orgInsertPages')) {
  document.getElementById('orgInsertPages').addEventListener('change', async (e) => {
    const file = requirePdfFile();
    if (!file) return;
    const insertFile = e.target.files?.[0];
    if (!insertFile) return;

    try {
      setOcrStatus('Объединение PDF...');
      const blob = await mergePdfDocuments([file, insertFile]);
      if (blob) {
        const url = safeCreateObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-merged.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus('PDF-файлы объединены');
      }
    } catch (err) {
      setOcrStatus(`Ошибка объединения: ${err?.message || 'неизвестная'}`);
    }
    e.target.value = '';
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Continuous Scroll Mode
// ═══════════════════════════════════════════════════════════════════════════════

(function initContinuousScroll() {
  const toggleBtn = document.getElementById('toggleContinuousScroll');
  const canvasWrap = document.getElementById('canvasWrap');
  const scrollWrap = document.getElementById('continuousScrollWrap');
  const scrollContainer = document.getElementById('continuousScrollContainer');
  let continuousMode = false;
  let renderedPages = new Set();

  if (!toggleBtn || !scrollWrap || !scrollContainer) return;

  toggleBtn.addEventListener('click', async () => {
    continuousMode = !continuousMode;
    toggleBtn.classList.toggle('active', continuousMode);

    if (continuousMode) {
      await enterContinuousMode();
    } else {
      exitContinuousMode();
    }
  });

  async function enterContinuousMode() {
    if (!state.adapter || !state.pageCount) return;
    canvasWrap.style.display = 'none';
    scrollWrap.style.display = '';
    scrollContainer.innerHTML = '';
    renderedPages.clear();

    // Create placeholder elements for each page
    for (let i = 1; i <= state.pageCount; i++) {
      const label = document.createElement('div');
      label.className = 'cs-page-label';
      label.textContent = `Страница ${i}`;
      scrollContainer.appendChild(label);

      const canvas = document.createElement('canvas');
      canvas.id = `cs-page-${i}`;
      canvas.dataset.pageNum = i;
      canvas.width = 800;
      canvas.height = 1100;
      canvas.style.width = '100%';
      canvas.style.maxWidth = '800px';
      canvas.style.background = '#e8e8e8';
      scrollContainer.appendChild(canvas);
    }

    // Use IntersectionObserver for lazy rendering
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.pageNum, 10);
          if (!renderedPages.has(pageNum)) {
            renderedPages.add(pageNum);
            renderScrollPage(pageNum, entry.target);
          }
        }
      }
    }, { rootMargin: '200px 0px' });

    scrollContainer.querySelectorAll('canvas[data-page-num]').forEach(c => observer.observe(c));

    // Scroll to current page
    const target = document.getElementById(`cs-page-${state.pageNum || 1}`);
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  async function renderScrollPage(pageNum, canvas) {
    try {
      const zoom = state.zoom || 1;
      await state.adapter.renderPage(pageNum, canvas, { zoom, rotation: 0 });
      canvas.style.background = 'white';
    } catch (err) {
      canvas.style.background = '#fdd';
    }
  }

  function exitContinuousMode() {
    scrollWrap.style.display = 'none';
    canvasWrap.style.display = '';
    scrollContainer.innerHTML = '';
    renderedPages.clear();
  }

  window._novaContinuousScroll = { enterContinuousMode, exitContinuousMode };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Batch OCR UI Integration
// ═══════════════════════════════════════════════════════════════════════════════

(function initBatchOcrUI() {
  const batchOcrAllBtn = document.getElementById('batchOcrAll');
  const batchOcrCancelBtn = document.getElementById('batchOcrCancel');
  const createSearchablePdfBtn = document.getElementById('createSearchablePdf');
  const detectScannedBtn = document.getElementById('detectScanned');
  const progressBar = document.getElementById('batchOcrProgress');
  const statusEl = document.getElementById('batchOcrStatus');

  function setBatchStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  // Batch OCR all pages
  if (batchOcrAllBtn) {
    batchOcrAllBtn.addEventListener('click', async () => {
      if (!state.adapter || state.adapter.type !== 'pdf') {
        setBatchStatus('Откройте PDF для пакетного OCR');
        return;
      }

      if (progressBar) { progressBar.style.display = ''; progressBar.value = 0; }
      setBatchStatus('Запуск пакетного OCR...');

      try {
        const result = await batchOcr.processAll({
          renderPage: async (pageNum) => {
            const canvas = document.createElement('canvas');
            await state.adapter.renderPage(pageNum, canvas, { zoom: 2, rotation: 0 });
            return canvas;
          },
          recognizeFn: async (canvas, lang) => {
            const result = await recognizeWithBoxes(canvas, lang);
            return { text: result.text, words: result.words, confidence: result.confidence };
          },
          totalPages: state.pageCount,
          language: autoDetectLanguage(''),
          onProgress: (pageNum, total, status) => {
            setBatchStatus(status);
            if (progressBar && total > 0) {
              progressBar.value = Math.round((pageNum / total) * 100);
            }
          },
        });

        if (progressBar) progressBar.style.display = 'none';
        setBatchStatus(result.cancelled
          ? `OCR отменён: обработано ${result.processed} из ${result.total} страниц`
          : `OCR завершён: ${result.processed} страниц`);
        pushDiagnosticEvent('batch-ocr.done', { processed: result.processed, total: result.total });
      } catch (err) {
        if (progressBar) progressBar.style.display = 'none';
        setBatchStatus(`Ошибка OCR: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // Cancel batch OCR
  if (batchOcrCancelBtn) {
    batchOcrCancelBtn.addEventListener('click', () => {
      batchOcr.cancel();
      setBatchStatus('Отмена OCR...');
    });
  }

  // Create searchable PDF
  if (createSearchablePdfBtn) {
    createSearchablePdfBtn.addEventListener('click', async () => {
      if (!state.file || state.adapter?.type !== 'pdf') {
        setBatchStatus('Откройте PDF для создания searchable PDF');
        return;
      }

      if (batchOcr.results.size === 0) {
        setBatchStatus('Сначала запустите пакетное OCR');
        return;
      }

      try {
        setBatchStatus('Создание searchable PDF...');
        const arrayBuffer = await state.file.arrayBuffer();
        const result = await createSearchablePdf(arrayBuffer, batchOcr.results);
        const url = safeCreateObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-searchable.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setBatchStatus(`Searchable PDF создан: ${result.pagesProcessed} страниц`);
        pushDiagnosticEvent('searchable-pdf.created', { pages: result.pagesProcessed });
      } catch (err) {
        setBatchStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // Detect scanned document
  if (detectScannedBtn) {
    detectScannedBtn.addEventListener('click', async () => {
      if (!state.adapter || state.adapter.type !== 'pdf') {
        setBatchStatus('Откройте PDF для анализа');
        return;
      }

      try {
        setBatchStatus('Анализ документа...');
        const result = await detectScannedDocument(state.adapter.pdfDoc);
        let msg = result.isScanned
          ? `Сканированный документ (${result.scannedPages}/${result.totalChecked} стр.)`
          : `Текстовый документ (${result.totalChecked - result.scannedPages}/${result.totalChecked} с текстом)`;
        if (result.recommendation) msg += `\n${result.recommendation}`;
        setBatchStatus(msg);
        pushDiagnosticEvent('scan-detect', { isScanned: result.isScanned, confidence: result.confidence });
      } catch (err) {
        setBatchStatus(`Ошибка анализа: ${err?.message || 'неизвестная'}`);
      }
    });
  }
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Drag & Drop + Extended Hotkeys
// ═══════════════════════════════════════════════════════════════════════════════

(function initDragDropAndHotkeys() {
  const viewport = document.getElementById('documentViewport');

  // ── Drag & Drop ──
  if (viewport) {
    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewport.classList.add('drag-over');
    });

    viewport.addEventListener('dragleave', (e) => {
      e.preventDefault();
      viewport.classList.remove('drag-over');
    });

    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewport.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (files?.length > 0) {
        const file = files[0];
        // Trigger the existing file-open logic
        const openInput = document.getElementById('fileInput') || document.querySelector('input[type="file"][accept*="pdf"]');
        if (openInput) {
          const dt = new DataTransfer();
          dt.items.add(file);
          openInput.files = dt.files;
          openInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  // ── Extended Hotkeys ──
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in input/textarea
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+Shift+O: PDF Optimize
    if (ctrl && e.shiftKey && e.key === 'O') {
      e.preventDefault();
      document.getElementById('pdfOptimize')?.click();
      return;
    }
    // Ctrl+Shift+A: Accessibility check
    if (ctrl && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      document.getElementById('pdfAccessibility')?.click();
      return;
    }
    // Ctrl+Shift+R: Redaction
    if (ctrl && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      document.getElementById('pdfRedact')?.click();
      return;
    }
    // Ctrl+Shift+C: Compare
    if (ctrl && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      document.getElementById('pdfCompare')?.click();
      return;
    }
    // Ctrl+Shift+B: Batch OCR
    if (ctrl && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      document.getElementById('batchOcrAll')?.click();
      return;
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Document Tab Bar
// ═══════════════════════════════════════════════════════════════════════════════

(function initTabBar() {
  const tabBarTabs = document.getElementById('tabBarTabs');
  const tabBarNewBtn = document.getElementById('tabBarNewTab');
  if (!tabBarTabs) return;

  // Tab registry: each tab = { id, name, file, type, element }
  const tabs = [];
  let activeTabId = null;
  let nextTabId = 1;

  function createTab(name, file, type = 'pdf') {
    const id = nextTabId++;
    const tab = document.createElement('div');
    tab.className = 'doc-tab';
    tab.dataset.tabId = id;
    tab.innerHTML = `
      <span class="tab-icon">${type === 'pdf' ? '📄' : type === 'djvu' ? '📘' : type === 'epub' ? '📗' : '🖼'}</span>
      <span class="tab-label">${name}</span>
      <button class="tab-close" title="Закрыть">✕</button>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close')) return;
      switchToTab(id);
    });

    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });

    const entry = { id, name, file, type, element: tab };
    tabs.push(entry);
    tabBarTabs.appendChild(tab);
    switchToTab(id);
    return entry;
  }

  function switchToTab(id) {
    activeTabId = id;
    tabBarTabs.querySelectorAll('.doc-tab').forEach(t => {
      t.classList.toggle('active', parseInt(t.dataset.tabId) === id);
    });
    // Future: restore document state for this tab
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx < 0) return;

    const entry = tabs[idx];
    entry.element.remove();
    tabs.splice(idx, 1);

    if (activeTabId === id && tabs.length > 0) {
      const nextIdx = Math.min(idx, tabs.length - 1);
      switchToTab(tabs[nextIdx].id);
    }
  }

  // Listen for file open events to create tabs
  const origFileInput = document.getElementById('fileInput');
  if (origFileInput) {
    origFileInput.addEventListener('change', () => {
      const file = origFileInput.files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const type = ext === 'djvu' ? 'djvu' : ext === 'epub' ? 'epub' : ext === 'pdf' ? 'pdf' : 'image';
      createTab(file.name, file, type);
    });
  }

  // New tab button opens file dialog
  if (tabBarNewBtn) {
    tabBarNewBtn.addEventListener('click', () => {
      origFileInput?.click();
    });
  }

  // Create initial tab if a file is already loaded
  if (state.docName) {
    createTab(state.docName, state.file, state.adapter?.type || 'pdf');
  }

  window._novaTabs = { createTab, switchToTab, closeTab, tabs };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Print Dialog
// ═══════════════════════════════════════════════════════════════════════════════

(function initPrintDialog() {
  const modal = document.getElementById('printModal');
  const closeBtn = document.getElementById('closePrintModal');
  const cancelBtn = document.getElementById('printCancel');
  const executeBtn = document.getElementById('printExecute');
  const previewCanvas = document.getElementById('printPreviewCanvas');
  const previewInfo = document.getElementById('printPreviewInfo');
  const customRange = document.getElementById('printCustomRange');
  const scaleSelect = document.getElementById('printScale');
  const customScale = document.getElementById('printCustomScale');

  if (!modal) return;

  function openPrintDialog() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    updatePreview();
  }

  function closePrintDialog() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Range radio buttons
  modal.querySelectorAll('input[name="printRange"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (customRange) customRange.disabled = radio.value !== 'custom';
    });
  });

  // Scale select
  if (scaleSelect && customScale) {
    scaleSelect.addEventListener('change', () => {
      customScale.disabled = scaleSelect.value !== 'custom';
    });
  }

  // Preview
  async function updatePreview() {
    if (!previewCanvas || !state.adapter) return;
    try {
      const page = state.pageNum || 1;
      await state.adapter.renderPage(page, previewCanvas, { zoom: 0.3, rotation: 0 });
      if (previewInfo) {
        previewInfo.textContent = `Стр. ${page} из ${state.pageCount || '?'}`;
      }
    } catch (err) { console.warn('[app] non-critical error:', err?.message); }
  }

  // Execute print
  if (executeBtn) {
    executeBtn.addEventListener('click', async () => {
      if (!state.adapter) return;

      const rangeRadio = modal.querySelector('input[name="printRange"]:checked');
      const range = rangeRadio?.value || 'all';
      const dpi = parseInt(document.getElementById('printDpi')?.value || '300', 10);
      const includeAnnotations = document.getElementById('printAnnotations')?.checked ?? true;

      let pages = [];
      if (range === 'current') {
        pages = [state.pageNum || 1];
      } else if (range === 'custom' && customRange?.value) {
        pages = parsePageRangeLib(customRange.value, state.pageCount);
      } else {
        pages = Array.from({ length: state.pageCount }, (_, i) => i + 1);
      }

      if (!pages.length) {
        if (previewInfo) previewInfo.textContent = 'Неверный диапазон страниц';
        return;
      }

      closePrintDialog();

      // Render pages to print
      setOcrStatus(`Подготовка к печати: ${pages.length} стр.`);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setOcrStatus('Браузер заблокировал всплывающее окно печати');
        return;
      }

      printWindow.document.write('<html><head><title>Печать</title><style>');
      printWindow.document.write('body{margin:0;} canvas{page-break-after:always;display:block;width:100%;} @media print{canvas{page-break-after:always;}}');
      printWindow.document.write('</style></head><body>');

      const scale = dpi / 72;
      for (const pageNum of pages) {
        const canvas = document.createElement('canvas');
        await state.adapter.renderPage(pageNum, canvas, { zoom: scale, rotation: 0 });
        printWindow.document.body.appendChild(canvas);
      }

      printWindow.document.write('</body></html>');
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
        setOcrStatus(`Печать: ${pages.length} стр. отправлено`);
      }, 500);

      pushDiagnosticEvent('print', { pages: pages.length, dpi });
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closePrintDialog);
  if (cancelBtn) cancelBtn.addEventListener('click', closePrintDialog);

  // Ctrl+P opens print dialog
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      openPrintDialog();
    }
  });

  window._novaPrint = { openPrintDialog, closePrintDialog };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Shortcuts Quick Reference
// ═══════════════════════════════════════════════════════════════════════════════

(function initShortcutsRef() {
  const modal = document.getElementById('shortcutsModal');
  const closeBtn = document.getElementById('closeShortcutsModal');
  if (!modal) return;

  function openShortcuts() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeShortcuts() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeShortcuts);

  // Press "?" to show shortcuts reference
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (modal.classList.contains('open')) closeShortcuts();
      else openShortcuts();
    }
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeShortcuts();
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeShortcuts();
  });

  window._novaShortcuts = { openShortcuts, closeShortcuts };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — Right Panel + Floating Search + Tool Switching
// ═══════════════════════════════════════════════════════════════════════════════

(function initNovaReader3UI() {
  const appShell = document.querySelector('.app-shell');
  const rightPanel = document.getElementById('rightPanel');
  const rpTitle = document.getElementById('rpTitle');
  const closeRightPanel = document.getElementById('closeRightPanel');
  const searchFloating = document.getElementById('searchFloating');
  const closeSearchBtn = document.getElementById('closeSearch');

  const TOOL_TITLES = {
    'search': 'Поиск',
    'annotations': 'Аннотации',
    'text-ocr': 'Текст / OCR',
    'forms': 'Формы PDF',
    'tools': 'Инструменты',
    'organize': 'Организация страниц',
  };

  let activeToolPanel = null;

  // ── Open a right panel by tool name ──
  function openRightPanel(toolName) {
    if (!appShell || !rightPanel) return;

    // Close all panels
    rightPanel.querySelectorAll('.rp-panel').forEach(p => p.classList.remove('active'));

    // Activate selected panel
    const panel = rightPanel.querySelector(`.rp-panel[data-rp-panel="${toolName}"]`);
    if (panel) {
      panel.classList.add('active');
      appShell.classList.add('right-panel-open');
      if (rpTitle) rpTitle.textContent = TOOL_TITLES[toolName] || 'Инструменты';
      activeToolPanel = toolName;
    }

    // Update toolbar button states
    document.querySelectorAll('.cb-tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
  }

  function closeRightPanelFn() {
    if (!appShell) return;
    appShell.classList.remove('right-panel-open');
    rightPanel?.querySelectorAll('.rp-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.cb-tool-btn[data-tool]').forEach(btn => btn.classList.remove('active'));
    activeToolPanel = null;
  }

  // ── Tool buttons in command bar ──
  document.querySelectorAll('.cb-tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;

      // Search tool opens floating search bar instead of right panel
      if (tool === 'search') {
        toggleFloatingSearch(true);
        return;
      }

      // Toggle: if same tool clicked, close panel
      if (activeToolPanel === tool) {
        closeRightPanelFn();
      } else {
        openRightPanel(tool);
      }
    });
  });

  // Close right panel button
  if (closeRightPanel) {
    closeRightPanel.addEventListener('click', closeRightPanelFn);
  }

  // ── Floating search ──
  function toggleFloatingSearch(show) {
    if (!searchFloating) return;
    if (show === undefined) show = !searchFloating.classList.contains('open');
    searchFloating.classList.toggle('open', show);
    if (show) {
      const input = searchFloating.querySelector('#searchInput');
      if (input) setTimeout(() => input.focus(), 50);
    }
  }

  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => toggleFloatingSearch(false));
  }

  // Ctrl+F opens floating search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleFloatingSearch(true);
    }
    if (e.key === 'Escape' && searchFloating?.classList.contains('open')) {
      toggleFloatingSearch(false);
    }
  });

  // ── Sidebar toggle (Acrobat Pro style) ──
  const toggleSidebarBtn = document.getElementById('toggleSidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      if (appShell) {
        appShell.classList.toggle('sidebar-hidden');
        toggleSidebarBtn.classList.toggle('active', !appShell.classList.contains('sidebar-hidden'));
      }
    });
  }

  // ── Make sidebar tabs work with new left panel layout ──
  document.querySelectorAll('.lp-tabs button[data-sidebar-tab], .sidebar-tabs button[data-sidebar-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabNav = btn.closest('.lp-tabs, .sidebar-tabs');
      const sidebar = btn.closest('.left-panel, .sidebar');
      if (!tabNav || !sidebar) return;

      tabNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      sidebar.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      const panel = sidebar.querySelector(`.sidebar-panel[data-sidebar-panel="${btn.dataset.sidebarTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Expose for other modules
  window._novaUI = { openRightPanel, closeRightPanel: closeRightPanelFn, toggleFloatingSearch };
})();

// ─── Initialize Phase 2+ Modules ─────────────────────────────────────────────
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

// ─── View Mode Dropdown Handler ──────────────────────────────────────────────
(function initViewModeDropdown() {
  const dd = document.getElementById('viewModeDropdown');
  if (!dd) return;
  const trigger = dd.querySelector('.dropdown-trigger');
  const menu = dd.querySelector('.dropdown-menu');

  trigger?.addEventListener('click', () => {
    dd.classList.toggle('open');
    trigger.setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
  });

  menu?.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewMode;
      setViewMode(mode);
      menu.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dd.classList.remove('open');
      trigger?.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target)) {
      dd.classList.remove('open');
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });
})();

// ─── HTML Export Button Handler ──────────────────────────────────────────────
(function initHtmlExport() {
  const btn = document.getElementById('exportHtml');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!state.adapter || state.pageCount === 0) return;
    const pages = [];
    for (let i = 1; i <= state.pageCount; i++) {
      const text = await extractTextForPage(i);
      pages.push({ text: text || '', items: [] });
    }
    const html = convertToHtml(pages, { title: state.docName || 'Document' });
    downloadHtml(html, (state.docName || 'document').replace(/\.[^.]+$/, '') + '.html');
    toastSuccess('Экспорт HTML завершён');
  });
})();

// ─── Initialize Enhanced Zoom ────────────────────────────────────────────────
initEnhancedZoom({
  getZoom: () => state.zoom,
  setZoom: (z) => { state.zoom = z; els.zoomStatus.textContent = `${Math.round(z * 100)}%`; },
  render: () => renderCurrentPage(),
  canvasWrap: els.canvasWrap,
  canvas: els.canvas,
});

// ─── Initialize Touch Gestures ───────────────────────────────────────────────
initTouchGestures({
  nextPage: () => els.nextPage?.click(),
  prevPage: () => els.prevPage?.click(),
  viewport: document.querySelector('.document-viewport'),
});
setupVirtualKeyboardAdaptation();

// ─── Initialize Minimap ──────────────────────────────────────────────────────
initMinimap(
  document.querySelector('.document-viewport'),
  els.canvas,
  els.canvasWrap
);

// ─── Save/Restore Reading Position ───────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (state.docName && state.currentPage) {
    saveReadingPosition(state.docName, { page: state.currentPage, zoom: state.zoom });
  }
});

// Expose enhanced zoom & batch converter
window._enhancedZoom = { ZOOM_PRESETS, zoomToPreset, startMarqueeZoom, smoothZoomTo };
window._batchConverter = batchConverter;

// ─── Initialize Error Handler ─────────────────────────────────────────────
initErrorHandler();
registerRecovery(ERROR_CODES.MEMORY, () => {
  clearPageRenderCache();
  revokeAllTrackedUrls();
  toastWarning('Нехватка памяти — кэш очищен');
});
registerRecovery(ERROR_CODES.RENDER, () => {
  toastInfo('Ошибка рендеринга — повторная попытка...');
  try { renderCurrentPage(); } catch (err) { console.error('[render] recovery render failed:', err); }
});
onError((err) => {
  if (err.severity === 'fatal') {
    toastError(`Критическая ошибка: ${err.message}`);
  }
});

// ─── Initialize IndexedDB ─────────────────────────────────────────────────
openDatabase().catch(() => { /* IndexedDB not available */ });

// ─── PDF Text Edit Button Handler ─────────────────────────────────────────
(function initTextEditUI() {
  const findReplaceBtn = document.getElementById('pdfFindReplace');
  if (!findReplaceBtn) return;
  findReplaceBtn.addEventListener('click', async () => {
    if (!state.pdfBytes || state.pageCount === 0) {
      toastWarning('Откройте PDF документ');
      return;
    }
    const search = await nrPrompt('Найти текст:');
    if (!search) return;
    const replace = await nrPrompt('Заменить на:');
    if (replace === null) return;
    try {
      const result = await findAndReplace(state.pdfBytes, search, replace);
      if (result.replacements > 0) {
        state.pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
        renderCurrentPage();
        toastSuccess(`Заменено: ${result.replacements}`);
      } else {
        toastInfo('Совпадений не найдено');
      }
    } catch (err) {
      toastError('Ошибка поиска/замены: ' + err.message);
    }
  });
})();

// ─── PDF Security Button Handler ──────────────────────────────────────────
(function initSecurityUI() {
  const cleanMetaBtn = document.getElementById('cleanMetadata');
  if (!cleanMetaBtn) return;
  cleanMetaBtn.addEventListener('click', async () => {
    if (!state.pdfBytes) { toastWarning('Откройте PDF документ'); return; }
    try {
      const result = await cleanMetadata(state.pdfBytes);
      state.pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
      toastSuccess(`Метаданные удалены: ${result.removed.join(', ')}`);
    } catch (err) {
      toastError('Ошибка: ' + err.message);
    }
  });

  const sanitizeBtn = document.getElementById('sanitizePdf');
  if (!sanitizeBtn) return;
  sanitizeBtn.addEventListener('click', async () => {
    if (!state.pdfBytes) { toastWarning('Откройте PDF документ'); return; }
    try {
      const result = await sanitizePdf(state.pdfBytes);
      state.pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
      toastSuccess(`Санитизировано: ${result.sanitized.join(', ') || 'ничего не найдено'}`);
    } catch (err) {
      toastError('Ошибка: ' + err.message);
    }
  });
})();

// ─── Plain Text Export Handler ────────────────────────────────────────────
(function initTextExport() {
  const btn = document.getElementById('exportPlainText');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!state.adapter || state.pageCount === 0) return;
    const progress = toastProgress('Извлечение текста...', 0);
    try {
      let allText = '';
      for (let i = 1; i <= state.pageCount; i++) {
        const text = await extractTextForPage(i);
        allText += `--- Страница ${i} ---\n${text || ''}\n\n`;
        progress.update(Math.round((i / state.pageCount) * 100));
      }
      const filename = (state.docName || 'document').replace(/\.[^.]+$/, '') + '.txt';
      downloadText(allText, filename);
      progress.update(100);
      setTimeout(() => progress.dismiss(), 500);
      toastSuccess('Текст экспортирован');
    } catch (err) {
      progress.dismiss();
      toastError('Ошибка экспорта: ' + err.message);
    }
  });
})();

// ─── Initialize Memory Manager ────────────────────────────────────────────
initMemoryManager();
window.addEventListener('memory-warning', (e) => {
  toastWarning(`Высокое потребление памяти: ${e.detail.usedMB} МБ`);
  forceCleanup();
});

// ─── Q2.3: Graceful degradation for stub/partial modules ─────────────────
{
  // Cloud integration is a stub — disable cloud UI elements
  if (CLOUD_STATUS === 'stub') {
    const cloudBtns = [els.pushCloudSync, els.pullCloudSync, els.saveCloudSyncUrl];
    for (const btn of cloudBtns) {
      if (btn) {
        btn.disabled = true;
        btn.title = 'Облачная интеграция: требуется настройка OAuth2';
      }
    }
    const cloudInput = document.getElementById('cloudSyncUrl');
    if (cloudInput) {
      cloudInput.disabled = true;
      cloudInput.placeholder = 'Cloud: требуется настройка (stub)';
    }
  }
  // AI features are partial (heuristic-only) — show notice
  if (AI_STATUS === 'partial') {
    const aiBtn = document.getElementById('aiSummarize');
    if (aiBtn) aiBtn.title = 'AI: локальная эвристика (без внешнего API)';
  }
}

// ─── Initialize Drag & Drop ──────────────────────────────────────────────
initDragDrop({
  viewport: document.querySelector('.document-viewport'),
  thumbnailGrid: document.querySelector('.thumbnail-grid'),
  openFile: (file) => {
    const input = els.fileInput;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  },
  mergePdf: async (files) => {
    try {
      const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
      const uints = buffers.map(b => new Uint8Array(b));
      const merged = await mergePdfDocuments(uints);
      state.pdfBytes = new Uint8Array(await merged.arrayBuffer());
      toastSuccess(`Объединено ${files.length} PDF файлов`);
    } catch (err) {
      toastError('Ошибка объединения: ' + err.message);
    }
  },
  reorderPages: (from, to) => {
    toastInfo(`Страница ${from} → ${to}`);
  },
});

// ─── PDF/A Export Handler ─────────────────────────────────────────────────
(function initPdfAExport() {
  const btn = document.getElementById('exportPdfA');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!state.pdfBytes) { toastWarning('Откройте PDF документ'); return; }
    try {
      const result = await convertToPdfA(state.pdfBytes, { title: state.docName });
      const filename = (state.docName || 'document').replace(/\.[^.]+$/, '') + '-pdfa.pdf';
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('PDF/A экспортирован');
      if (result.report.issues.length > 0) {
        toastWarning(`Предупреждения: ${result.report.issues.join('; ')}`);
      }
    } catch (err) {
      toastError('Ошибка PDF/A: ' + err.message);
    }
  });
})();

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
