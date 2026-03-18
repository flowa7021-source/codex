// ─── Module Imports ─────────────────────────────────────────────────────────
import { APP_VERSION, NOVAREADER_PLAN_PROGRESS_PERCENT, SIDEBAR_SECTION_CONFIG, TOOLBAR_SECTION_CONFIG, OCR_MIN_DPI, CSS_BASE_DPI, OCR_MAX_SIDE_PX, OCR_MAX_PIXELS, OCR_SLOW_TASK_WARN_MS, OCR_HANG_WARN_MS, OCR_SOURCE_MAX_PIXELS, OCR_SOURCE_CACHE_MAX_PIXELS, OCR_SOURCE_CACHE_TTL_MS } from './modules/constants.js';
import { throttle, debounce, yieldToMainThread, loadImage, downloadBlob } from './modules/utils.js';
import { state, defaultHotkeys, hotkeys, setHotkeys, els } from './modules/state.js';
import { ensurePdfJs, ensureDjVuJs } from './modules/loaders.js';
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
import { initTesseract, recognizeTesseract, recognizeWithBoxes, isTesseractAvailable, getTesseractStatus, terminateTesseract, resetTesseractAvailability } from './modules/tesseract-adapter.js';
import { convertPdfToDocx, extractStructuredContent } from './modules/docx-converter.js';
import { mergePdfDocuments, splitPdfDocument, splitPdfIntoIndividual, fillPdfForm, getPdfFormFields, addWatermarkToPdf, addStampToPdf, addSignatureToPdf, exportAnnotationsIntoPdf, rotatePdfPages, getPdfMetadata, parsePageRange as parsePageRangeLib } from './modules/pdf-operations.js';
import { PdfRedactor, REDACTION_PATTERNS } from './modules/pdf-redact.js';
import { pdfCompare } from './modules/pdf-compare.js';
import { pdfOptimizer } from './modules/pdf-optimize.js';
import { addHeaderFooter, addBatesNumbering, flattenPdf, checkAccessibility, autoFixAccessibility, addPageNumbers } from './modules/pdf-pro-tools.js';
import { annotationManager, HIGHLIGHT_COLORS } from './modules/pdf-annotations-pro.js';
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
import { registerProvider, getProviders, authenticate, listFiles, openFile, saveFile, getShareLink, signOut, getConnectionStatus, onStatusChange, createGoogleDriveProvider, createOneDriveProvider, createDropboxProvider } from './modules/cloud-integration.js';
import { summarizeText, extractTags, semanticSearch, generateToc } from './modules/ai-features.js';
import { nrPrompt, nrConfirm } from './modules/modal-prompt.js';

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
  try { toastError(`${label}: ${message}`); } catch {}
}

// ─── Phase 2: OCR Confidence Scoring ───────────────────────────────────────
function computeOcrConfidence(text, variants) {
  if (!text || !variants || !variants.length) return { score: 0, level: 'none', details: {} };

  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lang = getOcrLang();

  const langScore = scoreOcrTextByLang(text, lang);
  const normalizedLangScore = Math.min(100, Math.max(0, (langScore / Math.max(1, charCount)) * 15 + 50));

  const alphaRatio = (text.match(/[A-Za-zА-Яа-яЁё]/g) || []).length / Math.max(1, charCount);
  const digitRatio = (text.match(/\d/g) || []).length / Math.max(1, charCount);
  const garbageRatio = (text.match(/[^A-Za-zА-Яа-яЁё0-9\s.,;:!?()\-«»"']/g) || []).length / Math.max(1, charCount);

  const readabilityScore = Math.min(100, Math.max(0,
    (alphaRatio * 70) + (digitRatio * 20) - (garbageRatio * 150) + (wordCount > 3 ? 20 : 0)
  ));

  const avgWordLen = charCount / Math.max(1, wordCount);
  const wordLenScore = (avgWordLen >= 2 && avgWordLen <= 15) ? 100 : Math.max(0, 100 - Math.abs(avgWordLen - 8) * 10);

  const score = Math.round(
    normalizedLangScore * 0.4 + readabilityScore * 0.4 + wordLenScore * 0.2
  );

  const level = score >= 80 ? 'high' : score >= 50 ? 'medium' : score >= 20 ? 'low' : 'very-low';

  return {
    score,
    level,
    details: {
      langScore: Math.round(normalizedLangScore),
      readability: Math.round(readabilityScore),
      wordLength: Math.round(wordLenScore),
      charCount,
      wordCount,
      alphaRatio: Number(alphaRatio.toFixed(2)),
      garbageRatio: Number(garbageRatio.toFixed(2)),
    },
  };
}

function postCorrectOcrText(text, lang) {
  if (!text) return text;
  const effectiveLang = lang || getOcrLang();
  // Delegate to ocr-languages module for extended language support (DE, FR, ES, IT, PT)
  return postCorrectByLanguage(text, effectiveLang);
}

// ─── Phase 2: Batch OCR Queue with Progress/Cancel/Priority ────────────────
const batchOcrState = {
  queue: [],
  running: false,
  progress: { completed: 0, total: 0, currentPage: 0 },
  cancelled: false,
  results: new Map(),
  confidenceStats: { high: 0, medium: 0, low: 0, veryLow: 0 },
};

function enqueueBatchOcr(pages, priority = 'normal') {
  const newTasks = pages.map(p => ({ page: p, priority, status: 'pending' }));
  if (priority === 'high') {
    batchOcrState.queue.unshift(...newTasks);
  } else {
    batchOcrState.queue.push(...newTasks);
  }
  batchOcrState.progress.total = batchOcrState.queue.length + batchOcrState.progress.completed;
  pushDiagnosticEvent('ocr.batch.enqueue', { pages: pages.length, priority, totalQueue: batchOcrState.queue.length });
}

function cancelBatchOcr() {
  batchOcrState.cancelled = true;
  batchOcrState.queue = [];
  batchOcrState.running = false;
  pushDiagnosticEvent('ocr.batch.cancel', { completed: batchOcrState.progress.completed });
}

function getBatchOcrProgress() {
  return {
    ...batchOcrState.progress,
    percent: batchOcrState.progress.total > 0
      ? Math.round((batchOcrState.progress.completed / batchOcrState.progress.total) * 100)
      : 0,
    running: batchOcrState.running,
    queueLength: batchOcrState.queue.length,
    confidenceStats: { ...batchOcrState.confidenceStats },
  };
}

// ─── Phase 3: PDF Text Editing Layer with Undo/Redo ────────────────────────
const pdfEditState = {
  edits: new Map(),
  undoStack: [],
  redoStack: [],
  maxHistory: 100,
  dirty: false,
};

function getPageEdits(pageNum) {
  return pdfEditState.edits.get(pageNum) || '';
}

function setPageEdits(pageNum, text) {
  const oldText = pdfEditState.edits.get(pageNum) || '';
  if (oldText === text) return;

  pdfEditState.undoStack.push({ page: pageNum, text: oldText, ts: Date.now() });
  if (pdfEditState.undoStack.length > pdfEditState.maxHistory) {
    pdfEditState.undoStack.shift();
  }
  pdfEditState.redoStack = [];

  pdfEditState.edits.set(pageNum, text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.change', { page: pageNum, length: text.length });
}

function undoPageEdit() {
  if (!pdfEditState.undoStack.length) return null;
  const action = pdfEditState.undoStack.pop();
  const currentText = pdfEditState.edits.get(action.page) || '';
  pdfEditState.redoStack.push({ page: action.page, text: currentText, ts: Date.now() });
  pdfEditState.edits.set(action.page, action.text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.undo', { page: action.page });
  return action;
}

function redoPageEdit() {
  if (!pdfEditState.redoStack.length) return null;
  const action = pdfEditState.redoStack.pop();
  const currentText = pdfEditState.edits.get(action.page) || '';
  pdfEditState.undoStack.push({ page: action.page, text: currentText, ts: Date.now() });
  pdfEditState.edits.set(action.page, action.text);
  pdfEditState.dirty = true;
  pushDiagnosticEvent('pdf-edit.redo', { page: action.page });
  return action;
}

function getEditHistory() {
  return {
    undoCount: pdfEditState.undoStack.length,
    redoCount: pdfEditState.redoStack.length,
    editedPages: [...pdfEditState.edits.keys()],
    dirty: pdfEditState.dirty,
  };
}

function clearEditHistory() {
  pdfEditState.undoStack = [];
  pdfEditState.redoStack = [];
  pdfEditState.dirty = false;
}

function persistEdits() {
  if (!state.docName) return;
  const key = `nr-edits-${state.docName}`;
  const payload = {
    edits: Object.fromEntries(pdfEditState.edits),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    pdfEditState.dirty = false;
  } catch { /* storage quota */ }
}

function loadPersistedEdits() {
  if (!state.docName) return;
  const key = `nr-edits-${state.docName}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.edits && typeof parsed.edits === 'object') {
      for (const [page, text] of Object.entries(parsed.edits)) {
        pdfEditState.edits.set(Number(page), text);
      }
    }
  } catch { /* ignore */ }
}

// ─── Phase 3: True PDF→DOCX Converter ─────────────────────────────────────
function buildDocxXml(title, pages) {
  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const docTitle = escapeXml(title);

  const paragraphs = [];
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${docTitle}</w:t></w:r></w:p>`);

  for (let i = 0; i < pages.length; i++) {
    const text = String(pages[i] || '').trim();
    if (!text) continue;

    paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Страница ${i + 1}</w:t></w:r></w:p>`);

    const lines = text.split('\n');
    let inTable = false;
    let tableRows = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inTable && tableRows.length) {
          paragraphs.push(buildDocxTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        continue;
      }

      const cells = trimmed.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2 && cells.length <= 20) {
        inTable = true;
        tableRows.push(cells);
        continue;
      }

      if (inTable && tableRows.length) {
        paragraphs.push(buildDocxTable(tableRows));
        tableRows = [];
        inTable = false;
      }

      const escapedLine = escapeXml(trimmed);
      paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapedLine}</w:t></w:r></w:p>`);
    }

    if (inTable && tableRows.length) {
      paragraphs.push(buildDocxTable(tableRows));
    }

    if (i < pages.length - 1) {
      paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
  }

  const body = paragraphs.join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;
}

function buildDocxTable(rows) {
  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const maxCols = Math.max(...rows.map(r => r.length));
  const colWidth = Math.floor(9000 / maxCols);

  let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>';
  xml += '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>';
  xml += '</w:tblBorders></w:tblPr>';

  xml += '<w:tblGrid>';
  for (let c = 0; c < maxCols; c++) xml += `<w:gridCol w:w="${colWidth}"/>`;
  xml += '</w:tblGrid>';

  for (const row of rows) {
    xml += '<w:tr>';
    for (let c = 0; c < maxCols; c++) {
      const cellText = escapeXml(row[c] || '');
      xml += `<w:tc><w:p><w:r><w:t xml:space="preserve">${cellText}</w:t></w:r></w:p></w:tc>`;
    }
    xml += '</w:tr>';
  }
  xml += '</w:tbl>';
  return xml;
}

function buildDocxStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="48"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders></w:tblPr>
  </w:style>
</w:styles>`;
}

function buildContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildWordRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

async function generateDocxBlob(title, pages) {
  const docXml = buildDocxXml(title, pages);
  const stylesXml = buildDocxStyles();
  const contentTypesXml = buildContentTypes();
  const relsXml = buildRels();
  const wordRelsXml = buildWordRels();

  // Build ZIP manually (minimal PKZIP implementation)
  const encoder = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(relsXml) },
    { name: 'word/document.xml', data: encoder.encode(docXml) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(wordRelsXml) },
  ];

  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    // Local file header
    const header = new Uint8Array(30 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true);  // signature
    hv.setUint16(4, 20, true);           // version needed
    hv.setUint16(6, 0, true);            // flags
    hv.setUint16(8, 0, true);            // compression (stored)
    hv.setUint16(10, 0, true);           // mod time
    hv.setUint16(12, 0, true);           // mod date
    const crc = crc32(file.data);
    hv.setUint32(14, crc, true);         // crc-32
    hv.setUint32(18, file.data.length, true);  // compressed size
    hv.setUint32(22, file.data.length, true);  // uncompressed size
    hv.setUint16(26, nameBytes.length, true);  // name length
    hv.setUint16(28, 0, true);           // extra field length
    header.set(nameBytes, 30);

    parts.push(header, file.data);

    // Central directory entry
    const cde = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cde.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    cde.set(nameBytes, 46);
    centralDir.push(cde);

    offset += header.length + file.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cde of centralDir) cdSize += cde.length;

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  ev.setUint16(20, 0, true);

  const allParts = [...parts, ...centralDir, eocd];
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }

  return new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Phase 2: OCR Search Index with Coordinates ────────────────────────────
const ocrSearchIndex = {
  pages: new Map(),
  version: 0,
};

function buildOcrSearchEntry(pageNum, text) {
  if (!text) return null;
  const words = [];
  const lines = text.split('\n');
  let charOffset = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineWords = lines[lineIdx].split(/\s+/).filter(Boolean);
    for (const word of lineWords) {
      words.push({
        word: word.toLowerCase(),
        original: word,
        page: pageNum,
        line: lineIdx + 1,
        offset: charOffset,
        length: word.length,
      });
      charOffset += word.length + 1;
    }
    charOffset++;
  }
  return { pageNum, text, words, indexedAt: Date.now() };
}

function indexOcrPage(pageNum, text) {
  const entry = buildOcrSearchEntry(pageNum, text);
  if (entry) {
    ocrSearchIndex.pages.set(pageNum, entry);
    ocrSearchIndex.version++;
  }
}

function searchOcrIndex(query) {
  const norm = (query || '').trim().toLowerCase();
  if (!norm) return [];
  const results = [];
  for (const [pageNum, entry] of ocrSearchIndex.pages) {
    const matches = [];
    for (const w of entry.words) {
      if (w.word.includes(norm)) {
        matches.push({ word: w.original, line: w.line, offset: w.offset });
      }
    }
    if (matches.length > 0) {
      results.push({ page: pageNum, matchCount: matches.length, matches });
    }
  }
  return results.sort((a, b) => a.page - b.page);
}

function exportOcrTextWithCoordinates() {
  const output = { app: 'NovaReader', version: '2.0', exportedAt: new Date().toISOString(), pages: [] };
  for (const [pageNum, entry] of ocrSearchIndex.pages) {
    output.pages.push({
      page: pageNum,
      text: entry.text,
      wordCount: entry.words.length,
      words: entry.words.map(w => ({
        word: w.original,
        line: w.line,
        offset: w.offset,
        length: w.length,
      })),
    });
  }
  return output;
}

function downloadOcrTextExport() {
  const data = exportOcrTextWithCoordinates();
  if (!data.pages.length) {
    setOcrStatus('OCR: нет данных для экспорта индекса');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-ocr-index.json`;
  a.click();
  URL.revokeObjectURL(url);
  setOcrStatus(`OCR индекс: экспортировано ${data.pages.length} страниц`);
  pushDiagnosticEvent('ocr.index.export', { pages: data.pages.length });
}

// ─── Phase 3: DOCX Image Embedding ────────────────────────────────────────
async function capturePageAsImageData(pageNum) {
  const cachedEntry = getCachedPage(pageNum);
  if (cachedEntry && cachedEntry.canvas && cachedEntry.canvas.width > 0) {
    return cachedEntry.canvas.toDataURL('image/png').split(',')[1];
  }
  if (!state.adapter) return null;
  const tempCanvas = document.createElement('canvas');
  try {
    await state.adapter.renderPage(pageNum, tempCanvas, { zoom: 1, rotation: 0 });
    const base64 = tempCanvas.toDataURL('image/png').split(',')[1];
    return base64;
  } catch {
    return null;
  } finally {
    tempCanvas.width = 0;
    tempCanvas.height = 0;
  }
}

function buildDocxImageParagraph(rId, widthEmu, heightEmu) {
  return `<w:p><w:r>
<w:drawing>
  <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
    <wp:docPr id="1" name="Page Image"/>
    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:nvPicPr><pic:cNvPr id="0" name="image.png"/><pic:cNvPicPr/></pic:nvPicPr>
          <pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
          <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>
</w:r></w:p>`;
}

async function generateDocxWithImages(title, pages, includeImages) {
  if (!includeImages) return generateDocxBlob(title, pages);

  const encoder = new TextEncoder();
  const imageFiles = [];
  const imageRels = [];

  for (let i = 0; i < pages.length; i++) {
    if (!pages[i] && !includeImages) continue;
    const imgData = await capturePageAsImageData(i + 1);
    if (imgData) {
      const imgBytes = Uint8Array.from(atob(imgData), c => c.charCodeAt(0));
      const rId = `rId${10 + i}`;
      imageFiles.push({ name: `word/media/page${i + 1}.png`, data: imgBytes });
      imageRels.push({ rId, target: `media/page${i + 1}.png` });
    }
  }

  const docXml = buildDocxXmlWithImages(title, pages, imageRels);
  const stylesXml = buildDocxStyles();
  const contentTypesXml = buildContentTypesWithImages(imageFiles.length > 0);
  const relsXml = buildRels();
  const wordRelsXml = buildWordRelsWithImages(imageRels);

  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(relsXml) },
    { name: 'word/document.xml', data: encoder.encode(docXml) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(wordRelsXml) },
    ...imageFiles,
  ];

  return createZipBlob(files);
}

function _groupWordsIntoLines(words) {
  if (!words || !words.length) return [];
  const sorted = [...words].filter(w => w.bbox).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    const avgH = ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) / 2;
    return Math.abs(dy) < avgH * 0.5 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].bbox.y0;
  const threshold = Math.abs(sorted[0].bbox.y1 - sorted[0].bbox.y0) * 0.5;

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    if (Math.abs(word.bbox.y0 - currentY) <= threshold) {
      currentLine.push(word);
    } else {
      lines.push(currentLine);
      currentLine = [word];
      currentY = word.bbox.y0;
    }
  }
  if (currentLine.length) lines.push(currentLine);
  return lines;
}

function buildDocxXmlWithImages(title, pages, imageRels) {
  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const paragraphs = [];
  paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>`);

  for (let i = 0; i < pages.length; i++) {
    const text = String(pages[i] || '').trim();
    const imgRel = imageRels.find(r => r.target === `media/page${i + 1}.png`);

    // Use word-level data for structured paragraphs if available
    const words = _ocrWordCache.get(i + 1);
    const useWordLayout = words && words.length > 0 && text.length > 0;

    if (useWordLayout) {
      // Group words into lines based on Y-coordinate proximity
      const lineGroups = _groupWordsIntoLines(words);
      const fontSizes = words.map(w => w.bbox ? Math.abs(w.bbox.y1 - w.bbox.y0) : 12);
      const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / Math.max(1, fontSizes.length);

      // Detect paragraphs by line spacing
      let prevLineBottom = 0;
      for (const lineWords of lineGroups) {
        if (!lineWords.length) continue;
        const lineTop = Math.min(...lineWords.map(w => w.bbox?.y0 || 0));
        const lineBottom = Math.max(...lineWords.map(w => w.bbox?.y1 || 0));
        const lineHeight = lineBottom - lineTop;
        const gap = lineTop - prevLineBottom;

        // Detect heading: larger font or significant gap before line
        const lineAvgHeight = lineHeight;
        const isHeading = lineAvgHeight > avgFontSize * 1.3 && gap > avgFontSize * 0.5;
        const isParagraphBreak = gap > lineHeight * 1.5;

        const lineText = lineWords.map(w => w.text).join(' ').trim();
        if (!lineText) continue;

        // Check if this line looks like a table row
        const cells = lineText.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2 && cells.length <= 20) {
          // Will be handled in next pass
          paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
        } else if (isHeading) {
          const sz = Math.round(Math.min(36, Math.max(14, lineAvgHeight * 0.75)) * 2);
          paragraphs.push(`<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
        } else {
          const sz = Math.round(Math.min(28, Math.max(10, lineAvgHeight * 0.55)) * 2);
          if (isParagraphBreak && prevLineBottom > 0) {
            paragraphs.push(`<w:p><w:pPr><w:spacing w:before="120"/></w:pPr><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
          } else {
            paragraphs.push(`<w:p><w:r><w:rPr><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`);
          }
        }
        prevLineBottom = lineBottom;
      }
    } else if (text) {
      // Fallback: text-only layout with table detection
      const lines = text.split('\n');
      let inTable = false;
      let tableRows = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (inTable && tableRows.length) {
            paragraphs.push(buildDocxTable(tableRows));
            tableRows = [];
            inTable = false;
          }
          paragraphs.push('<w:p/>'); // Empty paragraph for spacing
          continue;
        }
        const cells = trimmed.split(/\t|  {2,}|\|/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2 && cells.length <= 20) {
          inTable = true;
          tableRows.push(cells);
          continue;
        }
        if (inTable && tableRows.length) {
          paragraphs.push(buildDocxTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        paragraphs.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(trimmed)}</w:t></w:r></w:p>`);
      }
      if (inTable && tableRows.length) paragraphs.push(buildDocxTable(tableRows));
    }

    // Add page image AFTER text (as supplementary, not primary content)
    if (imgRel && !useWordLayout) {
      const widthEmu = 5800000;
      const heightEmu = 7500000;
      paragraphs.push(buildDocxImageParagraph(imgRel.rId, widthEmu, heightEmu));
    }

    if (i < pages.length - 1) {
      paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  mc:Ignorable="w14 wp14">
<w:body>
${paragraphs.join('\n')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`;
}

function buildContentTypesWithImages(hasImages) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>`;
  if (hasImages) xml += '\n  <Default Extension="png" ContentType="image/png"/>';
  xml += `
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
  return xml;
}

function buildWordRelsWithImages(imageRels) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  for (const rel of imageRels) {
    xml += `\n  <Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${rel.target}"/>`;
  }
  xml += '\n</Relationships>';
  return xml;
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const header = new Uint8Array(30 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true);
    hv.setUint16(4, 20, true);
    hv.setUint16(8, 0, true);
    const crc = crc32(file.data);
    hv.setUint32(14, crc, true);
    hv.setUint32(18, file.data.length, true);
    hv.setUint32(22, file.data.length, true);
    hv.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    parts.push(header, file.data);

    const cde = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cde.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    cde.set(nameBytes, 46);
    centralDir.push(cde);
    offset += header.length + file.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cde of centralDir) cdSize += cde.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);

  const allParts = [...parts, ...centralDir, eocd];
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) { result.set(part, pos); pos += part.length; }
  return new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ─── Phase 3: DOCX Import (Merge Edits into Workspace) ────────────────────
async function importDocxEdits(file) {
  if (!file || !state.adapter) {
    setOcrStatus('Импорт DOCX: нужен открытый документ');
    return;
  }

  try {
    setOcrStatus('Импорт DOCX: чтение файла...');
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const xmlContent = extractDocumentXmlFromZip(bytes);
    if (!xmlContent) {
      setOcrStatus('Импорт DOCX: не удалось найти word/document.xml');
      return;
    }

    const pages = parseDocxTextByPages(xmlContent);
    if (!pages.length) {
      setOcrStatus('Импорт DOCX: текст не найден в документе');
      return;
    }

    const cache = loadOcrTextData();
    const pagesText = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : new Array(state.pageCount).fill('');

    let merged = 0;
    for (let i = 0; i < pages.length && i < state.pageCount; i++) {
      const imported = pages[i].trim();
      if (imported && imported !== pagesText[i]) {
        pagesText[i] = imported;
        setPageEdits(i + 1, imported);
        merged++;
      }
    }

    saveOcrTextData({
      pagesText,
      source: 'docx-import',
      scannedPages: pages.length,
      totalPages: state.pageCount,
      updatedAt: new Date().toISOString(),
    });
    persistEdits();

    if (state.currentPage <= pages.length && pages[state.currentPage - 1]) {
      els.pageText.value = pages[state.currentPage - 1];
    }

    setOcrStatus(`Импорт DOCX: объединено ${merged} страниц из ${pages.length}`);
    pushDiagnosticEvent('docx.import', { pages: pages.length, merged });
  } catch (error) {
    setOcrStatus(`Импорт DOCX: ошибка — ${error.message}`);
    pushDiagnosticEvent('docx.import.error', { message: error.message }, 'error');
  }
}

function extractDocumentXmlFromZip(bytes) {
  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0x50 && bytes[pos+1] === 0x4B && bytes[pos+2] === 0x03 && bytes[pos+3] === 0x04) {
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const name = decoder.decode(bytes.slice(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      if (name === 'word/document.xml') {
        return decoder.decode(bytes.slice(dataStart, dataStart + compSize));
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

function parseDocxTextByPages(xml) {
  const pages = [];
  let currentPage = [];

  const paragraphs = xml.split(/<w:p[\s>]/);
  for (const para of paragraphs) {
    if (para.includes('w:type="page"')) {
      pages.push(currentPage.join('\n').trim());
      currentPage = [];
      continue;
    }

    const textMatches = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      const line = textMatches.map(m => {
        const match = m.match(/>([^<]*)</);
        return match ? match[1] : '';
      }).join('');
      if (line.trim()) currentPage.push(line);
    }
  }

  if (currentPage.length) pages.push(currentPage.join('\n').trim());
  return pages.filter(p => p.length > 0);
}

// ─── Phase 5: Crash Telemetry Framework ────────────────────────────────────
const crashTelemetry = {
  sessionId: `nr-${Date.now().toString(36)}`,
  startedAt: Date.now(),
  crashes: [],
  errors: [],
  totalErrors: 0,
  recoveries: 0,
  longestStreak: 0,
  currentStreak: 0,
  lastErrorAt: 0,
};

function recordCrashEvent(type, message, context) {
  const event = {
    ts: new Date().toISOString(),
    type,
    message: String(message || '').slice(0, 500),
    context: String(context || ''),
    uptimeMs: Math.round(performance.now()),
    page: state.currentPage,
    docName: state.docName,
  };

  crashTelemetry.errors.push(event);
  crashTelemetry.totalErrors++;
  crashTelemetry.lastErrorAt = Date.now();
  crashTelemetry.currentStreak = 0;

  if (crashTelemetry.errors.length > 200) {
    crashTelemetry.errors.splice(0, crashTelemetry.errors.length - 200);
  }

  if (type === 'crash' || type === 'fatal') {
    crashTelemetry.crashes.push(event);
  }
}

function recordSuccessfulOperation() {
  crashTelemetry.currentStreak++;
  crashTelemetry.longestStreak = Math.max(crashTelemetry.longestStreak, crashTelemetry.currentStreak);
}

function recordRecovery() {
  crashTelemetry.recoveries++;
}

function getCrashFreeRate() {
  const totalOps = crashTelemetry.longestStreak + crashTelemetry.totalErrors;
  if (totalOps === 0) return 100;
  return Math.round(((totalOps - crashTelemetry.totalErrors) / totalOps) * 10000) / 100;
}

function getSessionHealth() {
  const uptimeMs = Date.now() - crashTelemetry.startedAt;
  return {
    sessionId: crashTelemetry.sessionId,
    uptimeMs,
    uptimeMin: Math.round(uptimeMs / 60000),
    totalErrors: crashTelemetry.totalErrors,
    crashes: crashTelemetry.crashes.length,
    recoveries: crashTelemetry.recoveries,
    crashFreeRate: getCrashFreeRate(),
    longestStreak: crashTelemetry.longestStreak,
    currentStreak: crashTelemetry.currentStreak,
    lastErrorAt: crashTelemetry.lastErrorAt ? new Date(crashTelemetry.lastErrorAt).toISOString() : null,
    errorsLast5min: crashTelemetry.errors.filter(e => Date.now() - new Date(e.ts).getTime() < 300000).length,
  };
}

function exportSessionHealthReport() {
  const health = getSessionHealth();
  const perfSummary = getPerfSummary();
  const tessStatus = getTesseractStatus();
  const report = {
    app: 'NovaReader',
    version: APP_VERSION,
    ...health,
    perfMetrics: perfSummary,
    recentErrors: crashTelemetry.errors.slice(-20),
    ocr: {
      engine: tessStatus,
      supportedLanguages: getSupportedLanguages().map((l) => ({ code: l, name: getLanguageName(l) })),
      currentLang: getOcrLang(),
    },
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novareader-health-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  pushDiagnosticEvent('health.export', health);
}

// Wire global error handler into crash telemetry
window.addEventListener('error', (event) => {
  recordCrashEvent('uncaught', event.message, event.filename + ':' + event.lineno);
  pushDiagnosticEvent('crash.uncaught', { message: event.message, file: event.filename, line: event.lineno }, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason?.message || event.reason || 'unknown');
  recordCrashEvent('unhandled-rejection', message, 'promise');
  pushDiagnosticEvent('crash.unhandled-rejection', { message }, 'error');
});

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
      try { this._currentRenderTask.cancel(); } catch { /* already finished */ }
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

function canSearchCurrentDoc() {
  return !!(state.adapter && (state.adapter.type === 'pdf' || state.adapter.type === 'djvu'));
}

function djvuTextKey() {
  return `novareader-djvu-data:${state.docName || 'global'}`;
}

function loadDjvuData() {
  try {
    const raw = localStorage.getItem(djvuTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDjvuData(payload) {
  localStorage.setItem(djvuTextKey(), JSON.stringify(payload));
}

function searchScopeKey() {
  return 'novareader-search-scope';
}

function loadSearchScope() {
  const scope = localStorage.getItem(searchScopeKey());
  if (scope === 'current' || scope === 'all') {
    els.searchScope.value = scope;
  } else {
    els.searchScope.value = 'all';
  }
}

function saveSearchScope() {
  const scope = els.searchScope.value === 'current' ? 'current' : 'all';
  localStorage.setItem(searchScopeKey(), scope);
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

function searchHistoryKey() {
  return `novareader-search-history:${state.docName || 'global'}`;
}

function readingGoalKey() {
  return `novareader-reading-goal:${state.docName || 'global'}`;
}

function annotationKey(page) {
  return `novareader-annotations:${state.docName || 'global'}:${page}`;
}

function commentKey(page) {
  return `novareader-comments:${state.docName || 'global'}:${page}`;
}

const _strokesCache = new Map();
const _commentsCache = new Map();

function invalidateAnnotationCaches() {
  _strokesCache.clear();
  _commentsCache.clear();
}

function getCurrentAnnotationCtx() {
  const ctx = els.annotationCanvas.getContext('2d');
  return ctx;
}

/**
 * Returns the DPR scale factor used for the annotation canvas.
 * Annotation canvas is sized at displayWidth*dpr × displayHeight*dpr
 * while CSS size is displayWidth × displayHeight.
 */
function getAnnotationDpr() {
  return Math.max(1, window.devicePixelRatio || 1);
}

function loadStrokes(page = state.currentPage) {
  if (_strokesCache.has(page)) return _strokesCache.get(page);
  const data = JSON.parse(localStorage.getItem(annotationKey(page)) || '[]');
  _strokesCache.set(page, data);
  return data;
}

function saveStrokes(strokes, page = state.currentPage) {
  _strokesCache.set(page, strokes);
  localStorage.setItem(annotationKey(page), JSON.stringify(strokes));
  renderDocStats();
  renderReadingGoalStatus();
  renderEtaStatus();
}

function loadComments(page = state.currentPage) {
  if (_commentsCache.has(page)) return _commentsCache.get(page);
  const data = JSON.parse(localStorage.getItem(commentKey(page)) || '[]');
  _commentsCache.set(page, data);
  return data;
}

function saveComments(comments, page = state.currentPage) {
  _commentsCache.set(page, comments);
  localStorage.setItem(commentKey(page), JSON.stringify(comments));
  renderDocStats();
  renderEtaStatus();
}

function clearDocumentCommentStorage() {
  if (!state.pageCount) return;
  for (let page = 1; page <= state.pageCount; page += 1) {
    localStorage.removeItem(commentKey(page));
  }
}

function renderCommentList() {
  const comments = loadComments();
  els.commentList.innerHTML = '';

  if (!comments.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Нет комментариев';
    els.commentList.appendChild(li);
    return;
  }

  comments.forEach((comment, idx) => {
    const li = document.createElement('li');
    li.className = 'recent-item';

    const text = document.createElement('div');
    text.textContent = `${idx + 1}. ${comment.text}`;
    li.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.addEventListener('click', () => {
      const next = loadComments().filter((_, i) => i !== idx);
      saveComments(next);
      renderAnnotations();
      renderCommentList();
    });

    actions.appendChild(del);
    li.appendChild(actions);
    els.commentList.appendChild(li);
  });
}


function clearDocumentAnnotationStorage() {
  if (!state.pageCount) return;
  for (let page = 1; page <= state.pageCount; page += 1) {
    localStorage.removeItem(annotationKey(page));
  }
}

function updateOverlayInteractionState() {
  const enabled = !!(state.drawEnabled || state.ocrRegionMode);
  if (els.annotationCanvas) els.annotationCanvas.classList.toggle('drawing-enabled', enabled);
}

function setDrawMode(enabled) {
  if (enabled) {
    toolStateMachine.transition(ToolMode.ANNOTATE);
  } else if (toolStateMachine.current === ToolMode.ANNOTATE) {
    toolStateMachine.transition(ToolMode.IDLE);
  }
  state.drawEnabled = enabled;
  updateOverlayInteractionState();
  if (els.annotateToggle) {
    els.annotateToggle.textContent = `✎ ${enabled ? 'on' : 'off'}`;
    els.annotateToggle.classList.toggle('active', enabled);
  }
}

function appSettingsKey() {
  return 'novareader-settings';
}

function defaultSettings() {
  return {
    appLang: 'ru',
    ocrLang: 'auto',
    ocrMinW: 24,
    ocrMinH: 24,
    backgroundOcr: false,
    ocrCyrillicOnly: true,
    ocrQualityMode: 'balanced',
    uiSidebarWidth: 220,
    uiToolbarScale: 1,
    uiTextMinHeight: 40,
    uiPageAreaPx: 860,
    uiToolbarTopPx: 38,
    uiToolbarBottomPx: 86,
    uiTextPanelPx: 120,
    uiAnnotationCanvasScale: 90,
    sidebarSections: Object.fromEntries(SIDEBAR_SECTION_CONFIG.map((x) => [x.key, true])),
    toolbarSections: Object.fromEntries(TOOLBAR_SECTION_CONFIG.map((x) => [x.key, true])),
  };
}

function loadAppSettings() {
  try {
    const raw = localStorage.getItem(appSettingsKey());
    const parsed = raw ? JSON.parse(raw) : {};
    state.settings = { ...defaultSettings(), ...(parsed || {}) };
    state.settings.sidebarSections = { ...defaultSettings().sidebarSections, ...(state.settings.sidebarSections || {}) };
    state.settings.toolbarSections = { ...defaultSettings().toolbarSections, ...(state.settings.toolbarSections || {}) };
  } catch {
    state.settings = defaultSettings();
  }
}

function saveAppSettings() {
  localStorage.setItem(appSettingsKey(), JSON.stringify(state.settings || defaultSettings()));
}

function applyUiSizeSettings() {
  const settings = state.settings || defaultSettings();
  const sidebar = Math.max(160, Math.min(360, Number(settings.uiSidebarWidth) || 220));
  const toolbarScale = Math.max(0.1, Math.min(1, Number(settings.uiToolbarScale) || 1));
  const textMin = Math.max(24, Math.min(180, Number(settings.uiTextMinHeight) || 40));
  const pageArea = Math.max(520, Math.min(2600, Number(settings.uiPageAreaPx) || 860));
  const topToolbar = Math.max(28, Math.min(72, Number(settings.uiToolbarTopPx) || 34));
  const bottomToolbar = Math.max(48, Math.min(220, Number(settings.uiToolbarBottomPx) || 86));
  const textPanel = Math.max(72, Math.min(360, Number(settings.uiTextPanelPx) || 120));
  const annotationScale = Math.max(0.5, Math.min(1, (Number(settings.uiAnnotationCanvasScale) || 90) / 100));

  localStorage.setItem(uiLayoutKey('sidebarWidth'), String(Math.round(sidebar)));
  localStorage.setItem(uiLayoutKey('pageAreaPx'), String(Math.round(pageArea)));
  document.documentElement.style.setProperty('--ui-toolbar-scale', String(toolbarScale));
  document.documentElement.style.setProperty('--ui-text-min-height', `${Math.round(textMin)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-top-height', `${Math.round(topToolbar)}px`);
  document.documentElement.style.setProperty('--ui-toolbar-bottom-height', `${Math.round(bottomToolbar)}px`);
  document.documentElement.style.setProperty('--ui-text-panel-height', `${Math.round(textPanel)}px`);
  document.documentElement.style.setProperty('--ui-annotation-canvas-scale', annotationScale.toFixed(2));

  document.querySelector('.app-shell')?.style.setProperty('--sidebar-width', `${Math.round(sidebar)}px`);
  document.querySelector('.viewer-area')?.style.setProperty('--page-area-height', `${Math.round(pageArea)}px`);
}


function getOcrLang() {
  return state.settings?.ocrLang || 'auto';
}

function getOcrScale() {
  const lang = getOcrLang();
  const qualityScale = state.settings?.ocrQualityMode === 'accurate' ? 1.35 : 1;
  const langScale = (lang === 'rus' ? 3 : 2) * qualityScale;
  const dpiScale = OCR_MIN_DPI / CSS_BASE_DPI;
  return Math.max(langScale, dpiScale);
}

function getConfusableLatinToCyrillicMap() {
  return {
    A: 'А', a: 'а', B: 'В', E: 'Е', e: 'е', K: 'К', k: 'к', M: 'М', m: 'м',
    H: 'Н', h: 'н', O: 'О', o: 'о', P: 'Р', p: 'р', C: 'С', c: 'с', T: 'Т',
    t: 'т', X: 'Х', x: 'х', y: 'у', Y: 'У', r: 'г', n: 'п', N: 'П',
    i: 'і', I: 'І', l: 'ӏ', V: 'Ѵ', v: 'ѵ', S: 'Ѕ', s: 'ѕ',
  };
}

function convertLatinLookalikesToCyrillic(input) {
  const map = getConfusableLatinToCyrillicMap();
  return String(input || '').replace(/[A-Za-z]/g, (ch) => map[ch] || ch);
}

function hasMixedCyrillicLatinToken(text) {
  return /(?=.*[A-Za-z])(?=.*[А-Яа-яЁё])[A-Za-zА-Яа-яЁё]{2,}/.test(text || '');
}

function computeOtsuThreshold(data) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]] += 1;
  }

  const total = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let best = 127;
  let maxVar = 0;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      best = t;
    }
  }
  return best;
}

function countHistogramPercentile(hist, percentile, total) {
  const target = total * percentile;
  let acc = 0;
  for (let i = 0; i < hist.length; i += 1) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return hist.length - 1;
}

function scoreCyrillicWordQuality(text) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of words) {
    if (!/[а-яё]/.test(word)) continue;
    if (/([а-яё])\1{3,}/.test(word)) score -= 4;
    if (!/[аеёиоуыэюя]/.test(word) && word.length >= 4) score -= 3;
    if (/[бвгджзйклмнпрстфхцчшщ]{5,}/.test(word)) score -= 2;
    if (word.length >= 3 && /^[а-яё]+$/.test(word)) score += 1;
  }
  return score;
}

function scoreRussianBigrams(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^а-яё\s]/g, ' ');
  const pairs = ['ст', 'но', 'ен', 'то', 'на', 'ов', 'ни', 'ра', 'ко', 'ал', 'пр', 'ро', 'во', 'по', 'ре', 'ос', 'от', 'та', 'го'];
  let score = 0;
  for (const pair of pairs) {
    const hits = normalized.split(pair).length - 1;
    score += Math.min(5, hits);
  }
  return score;
}

function scoreEnglishBigrams(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ');
  const pairs = ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it'];
  let score = 0;
  for (const pair of pairs) {
    const hits = normalized.split(pair).length - 1;
    score += Math.min(5, hits);
  }
  return score;
}

function medianDenoiseMonochrome(imageData) {
  const { width, height, data } = imageData;
  if (width < 3 || height < 3) return;
  const copy = new Uint8ClampedArray(data);
  const v = new Int32Array(9);
  for (let y = 1; y < height - 1; y += 1) {
    const rowOff = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      v[0] = copy[((rowOff - width) + x - 1) * 4];
      v[1] = copy[((rowOff - width) + x) * 4];
      v[2] = copy[((rowOff - width) + x + 1) * 4];
      v[3] = copy[(rowOff + x - 1) * 4];
      v[4] = copy[(rowOff + x) * 4];
      v[5] = copy[(rowOff + x + 1) * 4];
      v[6] = copy[((rowOff + width) + x - 1) * 4];
      v[7] = copy[((rowOff + width) + x) * 4];
      v[8] = copy[((rowOff + width) + x + 1) * 4];
      // Partial sorting network to find median of 9 (position 4)
      let t;
      if (v[1] < v[0]) { t = v[0]; v[0] = v[1]; v[1] = t; }
      if (v[4] < v[3]) { t = v[3]; v[3] = v[4]; v[4] = t; }
      if (v[7] < v[6]) { t = v[6]; v[6] = v[7]; v[7] = t; }
      if (v[1] < v[0]) { t = v[0]; v[0] = v[1]; v[1] = t; }
      if (v[2] < v[0]) { t = v[0]; v[0] = v[2]; v[2] = t; }
      if (v[5] < v[3]) { t = v[3]; v[3] = v[5]; v[5] = t; }
      if (v[8] < v[6]) { t = v[6]; v[6] = v[8]; v[8] = t; }
      // Get max of minimums
      if (v[3] < v[0]) { t = v[0]; v[0] = v[3]; v[3] = t; }
      if (v[6] < v[0]) { v[0] = v[6]; }
      if (v[6] < v[3]) { t = v[3]; v[3] = v[6]; v[6] = t; }
      // Get min of maximums
      if (v[4] > v[7]) { t = v[4]; v[4] = v[7]; v[7] = t; }
      if (v[1] > v[4]) { t = v[1]; v[1] = v[4]; v[4] = t; }
      if (v[2] > v[5]) { t = v[2]; v[2] = v[5]; v[5] = t; }
      if (v[5] > v[8]) { v[5] = v[8]; }
      if (v[2] > v[5]) { v[2] = v[5]; }
      // Median is max(min(v[1],v[4]), min(v[2],v[5]), v[3])
      const a = v[1] < v[4] ? v[1] : v[4];
      const b = v[2] < v[5] ? v[2] : v[5];
      const c = v[3];
      let med = a > b ? a : b;
      if (c > med) med = c;
      const outIdx = (rowOff + x) * 4;
      data[outIdx] = data[outIdx + 1] = data[outIdx + 2] = med;
    }
  }
}

function morphologyCloseMonochrome(imageData) {
  const { width, height, data } = imageData;
  if (width < 3 || height < 3) return;
  // Work on single-channel buffer for speed (avoid 4x index math)
  const len = width * height;
  const src = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) src[i] = data[i * 4];
  const dilated = new Uint8Array(src);
  // Dilation (max)
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const i = row + x;
      let m = src[i - width - 1]; const b = src[i - width]; if (b > m) m = b;
      const c = src[i - width + 1]; if (c > m) m = c;
      const d = src[i - 1]; if (d > m) m = d;
      const e = src[i]; if (e > m) m = e;
      const f = src[i + 1]; if (f > m) m = f;
      const g = src[i + width - 1]; if (g > m) m = g;
      const h = src[i + width]; if (h > m) m = h;
      const j = src[i + width + 1]; if (j > m) m = j;
      dilated[i] = m;
    }
  }
  // Erosion (min) on dilated
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const i = row + x;
      let m = dilated[i - width - 1]; const b = dilated[i - width]; if (b < m) m = b;
      const c = dilated[i - width + 1]; if (c < m) m = c;
      const d = dilated[i - 1]; if (d < m) m = d;
      const e = dilated[i]; if (e < m) m = e;
      const f = dilated[i + 1]; if (f < m) m = f;
      const g = dilated[i + width - 1]; if (g < m) m = g;
      const h = dilated[i + width]; if (h < m) m = h;
      const j = dilated[i + width + 1]; if (j < m) m = j;
      const o = i * 4;
      data[o] = data[o + 1] = data[o + 2] = m;
    }
  }
}

function estimateSkewAngleFromBinary(imageData) {
  const { width, height, data } = imageData;
  const darkPoints = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 900));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      if (data[idx] < 128) darkPoints.push([x, y]);
    }
  }
  if (darkPoints.length < 200) return 0;

  // Helper: compute projection variance for a given angle
  function projectionVariance(deg) {
    const rad = (deg * Math.PI) / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const bins = new Map();
    for (const [x, y] of darkPoints) {
      const yy = Math.round((x * s) + (y * c));
      bins.set(yy, (bins.get(yy) || 0) + 1);
    }
    let mean = 0;
    for (const v of bins.values()) mean += v;
    mean /= Math.max(1, bins.size);
    let variance = 0;
    for (const v of bins.values()) variance += (v - mean) * (v - mean);
    variance /= Math.max(1, bins.size);
    return variance;
  }

  // Coarse pass: -15° to +15° in 1° increments
  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let deg = -15; deg <= 15; deg += 1) {
    const variance = projectionVariance(deg);
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = deg;
    }
  }

  // Fine pass: ±1.5° around best in 0.25° increments
  const fineStart = bestAngle - 1.5;
  const fineEnd = bestAngle + 1.5;
  for (let deg = fineStart; deg <= fineEnd; deg += 0.25) {
    const variance = projectionVariance(deg);
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = deg;
    }
  }

  return bestAngle;
}

function rotateCanvas(source, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round((w * cos) + (h * sin)));
  out.height = Math.max(1, Math.round((w * sin) + (h * cos)));
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -w / 2, -h / 2);
  return out;
}

function clearOcrRuntimeCaches(reason = 'manual') {
  const cacheSizeBefore = state.ocrSourceCache.size;
  for (const entry of state.ocrSourceCache.values()) {
    if (entry?.canvas) { entry.canvas.width = 0; entry.canvas.height = 0; }
  }
  state.ocrSourceCache.clear();
  state.ocrCacheHitCount = 0;
  state.ocrCacheExpireCount = 0;
  state.ocrCacheLastHitDiagAt = 0;
  state.ocrCacheLastExpireDiagAt = 0;
  state.ocrCacheMissCount = 0;
  state.ocrCacheLastMissDiagAt = 0;
  state.ocrCacheOpsCount = 0;
  state.ocrCacheLastDiagAt = 0;
  state.pageSkewAngles = {};
  state.pageSkewPromises = {};
  pushDiagnosticEvent('ocr.cache.clear', { reason, cacheSizeBefore });
}

function getOcrSourceCacheKey(pageNumber) {
  const mode = state.settings?.ocrQualityMode === 'accurate' ? 'accurate' : 'balanced';
  const rotation = Number(state.rotation || 0);
  const doc = state.docName || 'global';
  const adapterType = state.adapter?.type || 'unknown';
  return `${doc}|${adapterType}|${pageNumber}|${rotation}|${mode}`;
}

function updateOcrSourceCache(key, canvas) {
  if (!key || !canvas) return;
  const now = Date.now();
  state.ocrSourceCache.set(key, { canvas, at: now, pixels: Math.max(1, canvas.width * canvas.height) });

  const ttlMs = Math.max(1_000, Number(OCR_SOURCE_CACHE_TTL_MS) || 120_000);
  const freeEvicted = (entry) => { if (entry?.canvas) { entry.canvas.width = 0; entry.canvas.height = 0; } };
  let evictedByTtl = 0;
  for (const [entryKey, entry] of state.ocrSourceCache.entries()) {
    if ((now - Number(entry?.at || 0)) > ttlMs) {
      freeEvicted(entry);
      state.ocrSourceCache.delete(entryKey);
      evictedByTtl += 1;
    }
  }

  const maxEntries = 4;
  let evictedByCount = 0;
  while (state.ocrSourceCache.size > maxEntries) {
    const oldestKey = state.ocrSourceCache.keys().next().value;
    if (!oldestKey) break;
    freeEvicted(state.ocrSourceCache.get(oldestKey));
    state.ocrSourceCache.delete(oldestKey);
    evictedByCount += 1;
  }

  const maxPixels = Math.max(1, Number(OCR_SOURCE_CACHE_MAX_PIXELS) || 12_000_000);
  let totalPixels = 0;
  for (const entry of state.ocrSourceCache.values()) {
    totalPixels += Math.max(1, Number(entry?.pixels) || 1);
  }
  let evictedByPixels = 0;
  while (totalPixels > maxPixels && state.ocrSourceCache.size > 1) {
    const oldestKey = state.ocrSourceCache.keys().next().value;
    if (!oldestKey) break;
    const removed = state.ocrSourceCache.get(oldestKey);
    freeEvicted(removed);
    state.ocrSourceCache.delete(oldestKey);
    totalPixels -= Math.max(1, Number(removed?.pixels) || 1);
    evictedByPixels += 1;
  }

  const nowForDiag = Date.now();
  const shouldReport = (nowForDiag - Number(state.ocrCacheLastDiagAt || 0)) >= 3000
    || evictedByTtl > 0
    || evictedByCount > 0
    || evictedByPixels > 0;
  if (shouldReport) {
    state.ocrCacheLastDiagAt = nowForDiag;
    pushDiagnosticEvent('ocr.source.cache.update', {
      entries: state.ocrSourceCache.size,
      totalPixels,
      maxPixels,
      evictedByTtl,
      evictedByCount,
      evictedByPixels,
    });
  }
}

function constrainOcrSourceCanvasPixels(canvas, maxPixels = OCR_SOURCE_MAX_PIXELS) {
  const totalPx = Math.max(1, canvas.width * canvas.height);
  const limitPx = Math.max(1, Number(maxPixels) || OCR_SOURCE_MAX_PIXELS);
  if (totalPx <= limitPx) {
    return { canvas, scaled: false, scale: 1, sourcePixels: totalPx, outputPixels: totalPx };
  }
  const scale = Math.sqrt(limitPx / totalPx);
  const width = Math.max(1, Math.floor(canvas.width * scale));
  const height = Math.max(1, Math.floor(canvas.height * scale));
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, width, height);
  return { canvas: out, scaled: true, scale, sourcePixels: totalPx, outputPixels: width * height };
}

function getFreshOcrSourceCacheEntry(cacheKey) {
  if (!cacheKey) return null;
  const entry = state.ocrSourceCache.get(cacheKey);
  if (!entry?.canvas) return null;
  const ttlMs = Math.max(1_000, Number(OCR_SOURCE_CACHE_TTL_MS) || 120_000);
  if ((Date.now() - Number(entry.at || 0)) > ttlMs) {
    state.ocrSourceCache.delete(cacheKey);
    state.ocrCacheExpireCount += 1;
    const now = Date.now();
    if ((now - Number(state.ocrCacheLastExpireDiagAt || 0)) >= 2000) {
      state.ocrCacheLastExpireDiagAt = now;
      pushDiagnosticEvent('ocr.source.cache.expired', { expireCount: state.ocrCacheExpireCount }, 'warn');
    }
    return null;
  }
  return entry;
}

async function buildOcrSourceCanvas(pageNumber) {
  const cacheKey = getOcrSourceCacheKey(pageNumber);
  const cached = getFreshOcrSourceCacheEntry(cacheKey);
  if (cached?.canvas) {
    const now = Date.now();
    state.ocrSourceCache.delete(cacheKey);
    state.ocrSourceCache.set(cacheKey, { canvas: cached.canvas, at: now, pixels: Math.max(1, cached.canvas.width * cached.canvas.height) });
    state.ocrCacheHitCount += 1;
    state.ocrCacheOpsCount += 1;
    if ((now - Number(state.ocrCacheLastHitDiagAt || 0)) >= 2000) {
      state.ocrCacheLastHitDiagAt = now;
      pushDiagnosticEvent('ocr.source.cache.hit', { page: pageNumber, hitCount: state.ocrCacheHitCount });
    }
    if (state.ocrCacheOpsCount > 0 && state.ocrCacheOpsCount % 12 === 0) {
      const ratio = Number((state.ocrCacheHitCount / Math.max(1, state.ocrCacheOpsCount)).toFixed(3));
      pushDiagnosticEvent('ocr.source.cache.effectiveness', {
        ops: state.ocrCacheOpsCount,
        hits: state.ocrCacheHitCount,
        misses: state.ocrCacheMissCount,
        hitRatio: ratio,
      });
    }
    return cached.canvas;
  }

  const missNow = Date.now();
  state.ocrCacheMissCount += 1;
  state.ocrCacheOpsCount += 1;
  if ((missNow - Number(state.ocrCacheLastMissDiagAt || 0)) >= 2000) {
    state.ocrCacheLastMissDiagAt = missNow;
    pushDiagnosticEvent('ocr.source.cache.miss', { page: pageNumber, missCount: state.ocrCacheMissCount });
  }
  if (state.ocrCacheOpsCount > 0 && state.ocrCacheOpsCount % 12 === 0) {
    const ratio = Number((state.ocrCacheHitCount / Math.max(1, state.ocrCacheOpsCount)).toFixed(3));
    pushDiagnosticEvent('ocr.source.cache.effectiveness', {
      ops: state.ocrCacheOpsCount,
      hits: state.ocrCacheHitCount,
      misses: state.ocrCacheMissCount,
      hitRatio: ratio,
    });
  }

  const canvas = document.createElement('canvas');
  // Use adaptive DPI: render a small probe first, analyze text density, then render at optimal zoom
  let adaptiveZoom = state.settings?.ocrQualityMode === 'accurate' ? 1.7 : 1.35;
  try {
    const probeCanvas = document.createElement('canvas');
    await state.adapter.renderPage(pageNumber, probeCanvas, { zoom: 1.0, rotation: state.rotation || 0 });
    const analysis = analyzeTextDensity(probeCanvas);
    adaptiveZoom = computeOcrZoom(probeCanvas.width, probeCanvas.height, analysis, OCR_SOURCE_MAX_PIXELS);
    // Boost zoom for pages with very small text
    const smallText = hasSmallText(probeCanvas);
    if (smallText && adaptiveZoom < 3.0) adaptiveZoom = Math.min(3.0, adaptiveZoom * 1.4);
    probeCanvas.width = 0; probeCanvas.height = 0; // free memory
    pushDiagnosticEvent('ocr.adaptive-dpi', { page: pageNumber, suggestedScale: analysis.suggestedScale, zoom: adaptiveZoom, density: analysis.density, strokeWidth: analysis.avgStrokeWidth, smallText });
  } catch { /* fall through to default zoom */ }
  await state.adapter.renderPage(pageNumber, canvas, { zoom: adaptiveZoom, rotation: state.rotation || 0 });
  const normalized = constrainOcrSourceCanvasPixels(canvas, OCR_SOURCE_MAX_PIXELS);
  if (normalized.scaled) {
    pushDiagnosticEvent('ocr.source.downscale', {
      page: pageNumber,
      sourcePixels: normalized.sourcePixels,
      outputPixels: normalized.outputPixels,
      scale: Number(normalized.scale.toFixed(3)),
    }, 'warn');
  }
  updateOcrSourceCache(cacheKey, normalized.canvas);
  return normalized.canvas;
}

async function estimatePageSkewAngle(pageNumber) {
  if (!state.adapter) return 0;
  if (typeof state.pageSkewAngles[pageNumber] === 'number') return state.pageSkewAngles[pageNumber];
  if (state.pageSkewPromises[pageNumber]) return state.pageSkewPromises[pageNumber];

  state.pageSkewPromises[pageNumber] = (async () => {
    try {
    const src = await buildOcrSourceCanvas(pageNumber);
    const probe = preprocessOcrCanvas(src, 0, 'otsu', false, 0.85);
    const img = probe.getContext('2d').getImageData(0, 0, probe.width, probe.height);
    const skew = estimateSkewAngleFromBinary(img);
    state.pageSkewAngles[pageNumber] = skew;
    return skew;
    } catch {
      state.pageSkewAngles[pageNumber] = 0;
      return 0;
    } finally {
      delete state.pageSkewPromises[pageNumber];
    }
  })();

  return state.pageSkewPromises[pageNumber];
}

function cropCanvasByRelativeRect(sourceCanvas, relativeRect) {
  const sx = Math.max(0, Math.floor(sourceCanvas.width * relativeRect.x));
  const sy = Math.max(0, Math.floor(sourceCanvas.height * relativeRect.y));
  const sw = Math.max(1, Math.floor(sourceCanvas.width * relativeRect.w));
  const sh = Math.max(1, Math.floor(sourceCanvas.height * relativeRect.h));
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function preprocessOcrCanvas(inputCanvas, thresholdBias = 0, mode = 'mean', invert = false, extraScale = 1) {
  const canvas = document.createElement('canvas');
  const baseScale = getOcrScale() * Math.max(0.8, Math.min(1.8, extraScale));
  let targetWidth = Math.max(1, Math.floor(inputCanvas.width * baseScale));
  let targetHeight = Math.max(1, Math.floor(inputCanvas.height * baseScale));

  const sideScale = Math.min(1, OCR_MAX_SIDE_PX / Math.max(targetWidth, targetHeight));
  const pxScale = Math.min(1, Math.sqrt(OCR_MAX_PIXELS / Math.max(1, targetWidth * targetHeight)));
  const safeScale = Math.max(0.35, Math.min(sideScale, pxScale));

  if (safeScale < 1) {
    targetWidth = Math.max(1, Math.floor(targetWidth * safeScale));
    targetHeight = Math.max(1, Math.floor(targetHeight * safeScale));
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(inputCanvas, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  let mean = 0;
  let sqMean = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 0.299) + (d[i + 1] * 0.587) + (d[i + 2] * 0.114);
    const g = Math.max(0, Math.min(255, Math.round(gray)));
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g] += 1;
    mean += g;
    sqMean += g * g;
  }
  mean /= Math.max(1, d.length / 4);
  sqMean /= Math.max(1, d.length / 4);
  const stdDev = Math.sqrt(Math.max(0, sqMean - (mean * mean)));

  const totalPx = d.length / 4;
  const p5 = countHistogramPercentile(hist, 0.05, totalPx);
  const p95 = Math.max(p5 + 1, countHistogramPercentile(hist, 0.95, totalPx));
  const spread = Math.max(1, p95 - p5);
  for (let i = 0; i < d.length; i += 4) {
    const stretched = ((d[i] - p5) * 255) / spread;
    const contrastBoost = stdDev < 36 ? 1.18 : 1.0;
    const centered = (stretched - 127) * contrastBoost + 127;
    const g = Math.max(0, Math.min(255, Math.round(centered)));
    d[i] = d[i + 1] = d[i + 2] = g;
  }

  if (state.settings?.ocrQualityMode === 'accurate') {
    medianDenoiseMonochrome(img);
    morphologyCloseMonochrome(img);
    // Enhanced preprocessing: use advanced Sauvola binarization + deskew
    try {
      ctx.putImageData(img, 0, 0);
      const enhanced = preprocessForOcr(canvas, { deskew: true, denoise: false, binarize: false, removeBorders: true });
      if (enhanced !== canvas && enhanced.width > 0) {
        canvas.width = enhanced.width;
        canvas.height = enhanced.height;
        ctx.drawImage(enhanced, 0, 0);
        return canvas;
      }
    } catch { /* fallback to standard pipeline */ }
  }

  const thresholdShift = state.settings?.ocrQualityMode === 'accurate' ? 8 : 0;
  const otsu = computeOtsuThreshold(d);
  const thresholdBase = mode === 'otsu' ? otsu : mean;
  const threshold = Math.max(50, Math.min(220, thresholdBase + thresholdBias + thresholdShift));

  for (let i = 0; i < d.length; i += 4) {
    let v = d[i] > threshold ? 255 : 0;
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function pickVariantsByBudget(variants, maxCount) {
  const list = Array.isArray(variants) ? variants : [];
  const budget = Math.max(1, Number(maxCount) || list.length || 1);
  if (list.length <= budget) return list;
  const selected = [];
  for (let i = 0; i < budget; i += 1) {
    const idx = Math.min(list.length - 1, Math.round((i * (list.length - 1)) / Math.max(1, budget - 1)));
    selected.push(list[idx]);
  }
  return selected;
}

function scoreOcrTextByLang(text, lang) {
  const s = String(text || '').trim();
  if (!s) return 0;
  // Delegate to ocr-languages module for extended language support (DE, FR, ES, IT, PT)
  const effectiveLang = lang || getOcrLang();
  return scoreTextByLanguage(s, effectiveLang);
}

async function runOcrOnPreparedCanvas(canvas, options = {}) {
  const startedAt = performance.now();
  const fast = !!options.fast;
  const preferredSkew = Number(options.preferredSkew || 0);
  const taskId = Number(options.taskId || 0);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  // Snapshot settings at pipeline start to prevent race conditions if user
  // changes language or quality mode mid-pipeline
  const pipelineLang = getOcrLang();
  const pipelineQualityMode = state.settings?.ocrQualityMode || 'balanced';
  const pipelineCyrillicOnly = !!state.settings?.ocrCyrillicOnly;

  // Early exit: check Tesseract availability BEFORE spending time on preprocessing
  const lang = pipelineLang;
  const tesseractAvail = await isTesseractAvailable();
  if (tesseractAvail) {
    const initOk = await initTesseract(lang === 'auto' ? 'auto' : lang);
    const tessStatus = getTesseractStatus();
    pushDiagnosticEvent('ocr.tesseract.init', { available: true, initialized: initOk, lang, failCount: tessStatus.initFailCount, lastError: tessStatus.lastError || undefined });
    if (!initOk) {
      pushDiagnosticEvent('ocr.pipeline.skip', { reason: 'tesseract-init-failed', lang, ms: Math.round(performance.now() - startedAt), lastError: tessStatus.lastError || undefined });
      setOcrStatus(`OCR: ошибка инициализации движка (попытка ${tessStatus.initFailCount}/3)`);
      return '';
    }
  } else {
    pushDiagnosticEvent('ocr.tesseract.init', { available: false, initialized: false, lang }, 'error');
    pushDiagnosticEvent('ocr.pipeline.skip', { reason: 'tesseract-unavailable', lang, ms: Math.round(performance.now() - startedAt) });
    setOcrStatus('OCR: движок Tesseract недоступен');
    return '';
  }

  const preprocessStart = performance.now();
  const isAccurate = pipelineQualityMode === 'accurate';
  const recipeList = isAccurate
    ? [
      [-32, 'mean', false, 1],
      [-16, 'mean', false, 1],
      [0, 'mean', false, 1],
      [0, 'otsu', false, 1],
      [16, 'otsu', false, 1],
      [28, 'otsu', false, 1],
      [10, 'otsu', true, 1],
      [-10, 'otsu', false, 1],
    ]
    : [
      [0, 'otsu', false, 1],
      [0, 'mean', false, 1],
      [16, 'otsu', false, 1],
      [-16, 'mean', false, 1],
    ];

  let preprocessDone = 0;
  const reportPreprocess = (total) => {
    if (!onProgress) return;
    onProgress({ phase: 'preprocess', current: preprocessDone, total: Math.max(1, total) });
  };

  const baseVariants = [];
  reportPreprocess(recipeList.length);
  for (let i = 0; i < recipeList.length; i += 1) {
    if (taskId && taskId !== state.ocrTaskId) return '';
    const [contrast, thresholdMode, invert, sharpen] = recipeList[i];
    baseVariants.push(preprocessOcrCanvas(canvas, contrast, thresholdMode, invert, sharpen));
    preprocessDone += 1;
    reportPreprocess(recipeList.length);
    if (i % 2 === 1) {
      await yieldToMainThread();
    }
  }

  let variants = baseVariants;
  let skewProbeDeg = 0;
  let skewRotateCount = 0;
  let skewToApply = 0;
  if (Math.abs(preferredSkew) >= 0.35) {
    skewToApply = preferredSkew;
  } else if (!fast) {
    const probe = variants[Math.min(2, variants.length - 1)];
    const probeImg = probe.getContext('2d').getImageData(0, 0, probe.width, probe.height);
    const skew = estimateSkewAngleFromBinary(probeImg);
    skewProbeDeg = Number(skew.toFixed(2));
    if (Math.abs(skew) >= 0.35) {
      skewToApply = skew;
    }
  }
  if (Math.abs(skewToApply) >= 0.35) {
    const expanded = [];
    const totalSteps = recipeList.length + variants.length;
    for (let i = 0; i < variants.length; i += 1) {
      if (taskId && taskId !== state.ocrTaskId) return '';
      const v = variants[i];
      expanded.push(v);
      expanded.push(rotateCanvas(v, -skewToApply));
      skewRotateCount += 1;
      preprocessDone += 1;
      reportPreprocess(totalSteps);
      if (i % 2 === 1) {
        await yieldToMainThread();
      }
    }
    variants = expanded;
  }

  const sourceMegaPixels = Number(((canvas.width * canvas.height) / 1_000_000).toFixed(2));
  const variantBudget = isAccurate
    ? (sourceMegaPixels >= 6 ? 6 : sourceMegaPixels >= 3.5 ? 8 : 12)
    : (sourceMegaPixels >= 6 ? 3 : sourceMegaPixels >= 3.5 ? 4 : 6);
  if (variants.length > variantBudget) {
    variants = pickVariantsByBudget(variants, variantBudget);
  }
  const preprocessMs = Math.round(performance.now() - preprocessStart);

  const recognizeStart = performance.now();
  // Helper to free all variant canvases — called in finally to prevent leaks on early exit
  function freeAllVariants() {
    for (let i = 0; i < variants.length; i += 1) {
      const c = variants[i];
      if (c && c.width) { c.width = 0; c.height = 0; }
      variants[i] = null;
    }
    for (let i = 0; i < baseVariants.length; i += 1) {
      const c = baseVariants[i];
      if (c && c.width) { c.width = 0; c.height = 0; }
      baseVariants[i] = null;
    }
  }

  // lang already resolved at top of function; Tesseract already confirmed initialized
  let best = '';
  let bestScore = -Infinity;
  let bestWords = [];
  let bestVariantW = 0;
  let bestVariantH = 0;
  let detectedLang = lang;
  let taskCancelled = false;
  try {
    for (let i = 0; i < variants.length; i += 1) {
      if (taskId && taskId !== state.ocrTaskId) { taskCancelled = true; break; }
      if (onProgress) onProgress({ phase: 'recognize', current: i + 1, total: variants.length });
      const variant = variants[i];
      let rawText = '';
      let words = [];
      try {
        const tessResult = await recognizeTesseract(variant, { lang });
        if (tessResult && tessResult.text) {
          rawText = tessResult.text;
          words = tessResult.words || [];
        }
        if (!rawText && !getTesseractStatus().ready) {
          pushDiagnosticEvent('ocr.engine.missing', { variant: i });
          break;
        }
      } catch (ocrErr) {
        pushDiagnosticEvent('ocr.engine.error', { variant: i, error: ocrErr?.message || String(ocrErr) });
        if (!getTesseractStatus().ready) {
          pushDiagnosticEvent('ocr.engine.dead', { variant: i, error: ocrErr?.message || String(ocrErr) }, 'error');
          break;
        }
        continue;
      }
      const effectiveLang = (lang === 'auto' && rawText && rawText.length >= 20) ? detectLanguage(rawText) : lang;
      const candidate = normalizeOcrTextByLang(rawText, effectiveLang);
      const score = scoreOcrTextByLang(candidate, effectiveLang);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
        bestWords = words;
        bestVariantW = variant?.width || 0;
        bestVariantH = variant?.height || 0;
        detectedLang = effectiveLang;
      }
      if (i === 0 && best.length >= 20 && bestScore > 50) {
        break;
      }
      await yieldToMainThread();
    }
  } finally {
    freeAllVariants();
  }

  // Normalize word bboxes to [0,1] relative coordinates so they are
  // independent of the OCR source canvas resolution. The text layer
  // renderer multiplies these by display dimensions for correct placement.
  if (bestWords.length > 0 && bestVariantW > 0 && bestVariantH > 0) {
    for (const w of bestWords) {
      if (w.bbox) {
        w.bbox = {
          x0: w.bbox.x0 / bestVariantW,
          y0: w.bbox.y0 / bestVariantH,
          x1: w.bbox.x1 / bestVariantW,
          y1: w.bbox.y1 / bestVariantH,
        };
      }
    }
  }
  const recognizeMs = Math.round(performance.now() - recognizeStart);
  if (taskCancelled) return best;
  pushDiagnosticEvent('ocr.pipeline.profile', {
    fast,
    lang,
    detectedLang,
    variantCount: variants.length,
    variantBudget,
    sourceMegaPixels,
    preprocessMs,
    recognizeMs,
    totalMs: Math.round(performance.now() - startedAt),
    skewProbeDeg,
    skewRotateCount,
    bestLength: best.length,
    bestScore: Number.isFinite(bestScore) ? Math.round(bestScore) : null,
  });
  // Apply post-correction using detected language
  best = postCorrectOcrText(best, detectedLang);

  // Cache word-level data for text layer and DOCX export
  if (bestWords.length > 0 && options.pageNum) {
    _ocrWordCache.set(options.pageNum, bestWords);
    // Also persist to OCR storage
    try {
      const cache = loadOcrTextData();
      if (cache) {
        if (!cache.pagesWords) cache.pagesWords = [];
        cache.pagesWords[options.pageNum - 1] = bestWords;
        saveOcrTextData(cache);
      }
    } catch { /* non-critical */ }
  }

  return best;
}

function normalizeOcrTextByLang(text, langOverride) {
  const lang = langOverride || getOcrLang();
  let out = String(text || '').replace(/[\t\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!out) return '';

  // Remove common OCR garbage while preserving punctuation and letters.
  out = out
    .replace(/[|]{2,}/g, '|')
    .replace(/[~`^]{2,}/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/([!?.,;:])\1{2,}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (lang === 'eng') {
    out = out.replace(/[^A-Za-z0-9 .,;:!?()'\-\n]/g, '');
  } else if (lang === 'rus') {
    out = convertLatinLookalikesToCyrillic(out);
    if (state.settings?.ocrCyrillicOnly !== false) {
      out = out.replace(/[A-Za-z]/g, '');
    }
    out = out.replace(/[^А-Яа-яЁё0-9 .,;:!?()«»"'\-\n]/g, ' ');
  } else if (lang === 'deu') {
    out = out.replace(/[^A-Za-zÄäÖöÜüß0-9 .,;:!?()'\-\n]/g, ' ');
  } else if (lang === 'fra') {
    out = out.replace(/[^A-Za-zÀ-ÿŒœÆæ0-9 .,;:!?()«»"'\-\n]/g, ' ');
  } else if (lang === 'spa') {
    out = out.replace(/[^A-Za-záéíóúñüÁÉÍÓÚÑÜ¿¡0-9 .,;:!?()'\-\n]/g, ' ');
  } else if (lang === 'ita') {
    out = out.replace(/[^A-Za-zÀ-ÿ0-9 .,;:!?()«»"'\-\n]/g, ' ');
  } else if (lang === 'por') {
    out = out.replace(/[^A-Za-záàâãéèêíóòôõúçÁÀÂÃÉÈÊÍÓÒÔÕÚÇ0-9 .,;:!?()«»"'\-\n]/g, ' ');
  } else {
    // auto / unknown — detect dominant script
    const cyr = (out.match(/[А-Яа-яЁё]/g) || []).length;
    const lat = (out.match(/[A-Za-z]/g) || []).length;
    if (cyr > 0 && lat > 0 && cyr >= lat * 0.3) {
      out = convertLatinLookalikesToCyrillic(out);
      if (state.settings?.ocrCyrillicOnly !== false) {
        out = out.replace(/[A-Za-z]/g, '');
      }
    }
  }

  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}


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

function setOcrControlsBusy(busy) {
  const disabled = !!busy;
  if (els.ocrCurrentPage) els.ocrCurrentPage.disabled = disabled;
  if (els.ocrRegionMode) els.ocrRegionMode.disabled = disabled;
  if (els.copyOcrText) els.copyOcrText.disabled = disabled;
}

function cancelManualOcrTasks(reason = 'manual-stop') {
  state.ocrQueueEpoch += 1;
  state.ocrTaskId += 1;
  state.ocrLatestByReason = {};
  setOcrControlsBusy(false);
  pushDiagnosticEvent('ocr.queue.cancel', { reason, queueEpoch: state.ocrQueueEpoch }, 'warn');
}

function enqueueOcrTask(reason, task, options = {}) {
  const queuedAt = performance.now();
  const queueEpoch = Number(options.queueEpoch ?? state.ocrQueueEpoch);
  const latestWins = !!options.latestWins;
  const latestReason = String(options.latestReason || reason || 'ocr');
  const latestToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (latestWins) {
    state.ocrLatestByReason[latestReason] = latestToken;
  }

  state.ocrQueue = state.ocrQueue
    .catch(() => {})
    .then(async () => {
      if (queueEpoch !== state.ocrQueueEpoch) {
        pushDiagnosticEvent('ocr.queue.skip', { reason, skipReason: 'queue-cancelled', queueEpoch }, 'warn');
        return;
      }
      if (latestWins && state.ocrLatestByReason[latestReason] !== latestToken) {
        pushDiagnosticEvent('ocr.queue.skip', { reason, skipReason: 'stale-latest', latestReason }, 'warn');
        return;
      }

      state.ocrJobRunning = true;
      setOcrControlsBusy(true);
      pushDiagnosticEvent('ocr.queue.start', { reason, waitedMs: Math.round(performance.now() - queuedAt) });
      try {
        await task();
      } finally {
        state.ocrJobRunning = false;
        setOcrControlsBusy(false);
        pushDiagnosticEvent('ocr.queue.finish', { reason });
      }
    });
  return state.ocrQueue;
}

function setOcrStatus(text) {
  if (els.ocrStatus) els.ocrStatus.textContent = text;
  if (els.sbOcr) els.sbOcr.textContent = text ? `OCR: ${text}` : 'OCR: —';
}

function setOcrStatusThrottled(text, minIntervalMs = 70) {
  const now = performance.now();
  const value = String(text || '');
  if (value === state.ocrLastProgressText) return;
  if (now - state.ocrLastProgressUiAt < Math.max(16, Number(minIntervalMs) || 70)) return;
  state.ocrLastProgressUiAt = now;
  state.ocrLastProgressText = value;
  setOcrStatus(value);
}

function setOcrRegionMode(enabled) {
  state.ocrRegionMode = !!enabled;
  if (enabled) {
    toolStateMachine.transition(ToolMode.OCR_REGION);
  } else if (toolStateMachine.current === ToolMode.OCR_REGION) {
    toolStateMachine.transition(ToolMode.IDLE);
  }
  if (!state.ocrRegionMode) {
    state.isSelectingOcr = false;
    state.ocrSelection = null;
    renderAnnotations();
  }
  updateOverlayInteractionState();
  applyAppLanguage();
  setOcrStatus(state.ocrRegionMode ? 'OCR: выделите область на странице' : 'OCR: idle');
}

function drawOcrSelectionPreview() {
  if (!state.ocrSelection) return;
  const ctx = getCurrentAnnotationCtx();
  const p1 = denormalizePoint(state.ocrSelection.start);
  const p2 = denormalizePoint(state.ocrSelection.end);
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const w = Math.abs(p2.x - p1.x);
  const h = Math.abs(p2.y - p1.y);
  if (w < 2 || h < 2) return;
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.fillStyle = 'rgba(59,130,246,0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function classifyOcrError(message) {
  const m = String(message || '').toLowerCase();
  if (!m) return 'unknown';
  if (m.includes('runtime') || m.includes('tesseract')) return 'runtime';
  if (m.includes('fetch') || m.includes('http') || m.includes('load')) return 'asset-load';
  if (m.includes('memory') || m.includes('out of memory')) return 'memory';
  if (m.includes('timeout')) return 'timeout';
  return 'processing';
}

async function runOcrOnRectNow(rect) {
  if (!state.adapter || !rect) return;
  const taskId = ++state.ocrTaskId;
  const taskStartedAt = performance.now();
  let hangWarnTimer = null;
  try {
    hangWarnTimer = setTimeout(() => {
      if (taskId !== state.ocrTaskId) return;
      setOcrStatus('OCR: длительная обработка, ожидайте...');
      pushDiagnosticEvent('ocr.manual.hang-warning', { taskId, thresholdMs: OCR_HANG_WARN_MS, page: state.currentPage }, 'warn');
    }, OCR_HANG_WARN_MS);
    const rel = {
      x: rect.x / Math.max(1, els.canvas.width),
      y: rect.y / Math.max(1, els.canvas.height),
      w: rect.w / Math.max(1, els.canvas.width),
      h: rect.h / Math.max(1, els.canvas.height),
    };

    const ocrPageCanvas = await buildOcrSourceCanvas(state.currentPage);
    const src = cropCanvasByRelativeRect(ocrPageCanvas, rel);
    const preferredSkew = await estimatePageSkewAngle(state.currentPage);
    const text = await runOcrOnPreparedCanvas(src, {
      preferredSkew,
      taskId,
      pageNum: state.currentPage,
      onProgress: ({ phase, current, total }) => {
        if (taskId !== state.ocrTaskId) return;
        if (phase === 'preprocess') {
          const percent = Math.max(1, Math.min(25, Math.round((current / Math.max(1, total)) * 25)));
          setOcrStatusThrottled(`OCR: подготовка... ${percent}%`);
          return;
        }
        if (phase === 'recognize') {
          const percent = Math.max(26, Math.min(100, 25 + Math.round((current / Math.max(1, total)) * 75)));
          setOcrStatusThrottled(`OCR: обработка... ${percent}%`);
        }
      },
    });
    if (taskId !== state.ocrTaskId) return;
    const totalMs = Math.round(performance.now() - taskStartedAt);
    if (text) {
      const corrected = postCorrectOcrText(text);
      const confidence = computeOcrConfidence(corrected, []);
      // Word-level confidence scoring
      const qualitySummary = getPageQualitySummary(corrected, getOcrLang());
      els.pageText.value = corrected;
      indexOcrPage(state.currentPage, corrected);
      // Persist to IndexedDB
      if (state.docName) {
        savePageOcrText(state.docName, state.currentPage, corrected).catch(() => {});
      }
      setOcrStatus(`OCR: распознано ${corrected.length} символов за ${totalMs}мс [${confidence.level} ${confidence.score}%] качество: ${qualitySummary.quality}`);
      recordPerfMetric('ocrTimes', totalMs);
      recordSuccessfulOperation();
      pushDiagnosticEvent('ocr.manual.finish', { taskId, textLength: corrected.length, totalMs, page: state.currentPage, confidence: confidence.score, confidenceLevel: confidence.level, wordQuality: qualitySummary.quality, avgWordScore: qualitySummary.avgScore, lowConfidenceWords: qualitySummary.lowCount });
      if (totalMs >= OCR_SLOW_TASK_WARN_MS) {
        pushDiagnosticEvent('ocr.manual.slow', { taskId, totalMs, page: state.currentPage }, 'warn');
      }
      // Refresh text layer with newly recognized word boxes
      renderTextLayer(state.currentPage, state.zoom, state.rotation).catch(() => {});
    } else {
      recordPerfMetric('ocrTimes', totalMs);
      setOcrStatus(`OCR: текст не найден (${totalMs}мс)`);
      pushDiagnosticEvent('ocr.manual.empty', { taskId, totalMs, page: state.currentPage }, 'warn');
    }
  } catch (error) {
    const totalMs = Math.round(performance.now() - taskStartedAt);
    const message = String(error?.message || 'unknown error');
    const errorType = classifyOcrError(message);
    setOcrStatus(`OCR: ошибка [${errorType}] (${message})`);
    recordCrashEvent(errorType, message, 'ocr-manual');
    pushDiagnosticEvent('ocr.manual.error', { taskId, totalMs, page: state.currentPage, message, errorType }, 'error');
  } finally {
    if (hangWarnTimer) clearTimeout(hangWarnTimer);
  }
}

async function runOcrOnRect(rect, reason = 'manual') {
  if (!state.adapter || !rect) return;
  if (state.backgroundOcrRunning) {
    cancelBackgroundOcrScan('manual-priority');
  }
  return enqueueOcrTask(reason, async () => {
    state.ocrLastProgressUiAt = 0;
    state.ocrLastProgressText = '';
    setOcrStatus('OCR: обработка...');
    await runOcrOnRectNow(rect);
  }, { latestWins: true, latestReason: 'manual-ocr' });
}

async function runOcrForCurrentPage() {
  if (!state.adapter) return;
  await runOcrOnRect({ x: 0, y: 0, w: els.canvas.width, h: els.canvas.height }, 'full-page');
}

async function extractTextForPage(pageNumber) {
  if (!state.adapter) return '';
  let text = '';
  try {
    text = String(await state.adapter.getText(pageNumber) || '').trim();
  } catch {
    text = '';
  }
  if (text) return text;

  // Check IndexedDB first, then localStorage
  const idbText = await getPageOcrText(state.docName || 'global', pageNumber);
  if (idbText) return idbText;
  const cache = loadOcrTextData();
  if (Array.isArray(cache?.pagesText) && cache.pagesText[pageNumber - 1]) {
    return cache.pagesText[pageNumber - 1];
  }

  try {
    const canvas = await buildOcrSourceCanvas(pageNumber);
    const preferredSkew = await estimatePageSkewAngle(pageNumber);
    const ocrResult = await runOcrOnPreparedCanvas(canvas, { fast: true, preferredSkew, pageNum: pageNumber });
    // Persist OCR result to cache so we don't re-OCR on next access
    if (ocrResult) {
      try {
        const existing = loadOcrTextData();
        const pagesText = Array.isArray(existing?.pagesText) ? [...existing.pagesText] : [];
        while (pagesText.length < pageNumber) pagesText.push('');
        pagesText[pageNumber - 1] = ocrResult;
        saveOcrTextData({ ...existing, pagesText, updatedAt: new Date().toISOString() });
      } catch { /* persist best-effort */ }
    }
    return ocrResult;
  } catch {
    return '';
  }
}

function cancelBackgroundOcrScan(reason = 'manual') {
  state.backgroundOcrToken = 0;
  state.backgroundOcrRunning = false;
  if (state.backgroundOcrTimer) {
    clearTimeout(state.backgroundOcrTimer);
    state.backgroundOcrTimer = null;
  }
  setOcrStatus(`OCR: фоновое распознавание остановлено (${reason})`);
  pushDiagnosticEvent('ocr.background.cancel', { reason }, 'warn');
}

function cancelAllOcrWork(reason = 'manual-stop') {
  cancelBackgroundOcrScan(reason);
  cancelManualOcrTasks(reason);
  setOcrStatus(`OCR: остановлено (${reason})`);
}

function scheduleBackgroundOcrScan(reason = 'default', delayMs = 600) {
  if (!state.settings?.backgroundOcr || !state.adapter) return;
  if (state.backgroundOcrTimer) {
    clearTimeout(state.backgroundOcrTimer);
  }
  state.backgroundOcrTimer = setTimeout(() => {
    state.backgroundOcrTimer = null;
    startBackgroundOcrScan(reason).catch(() => {
      setOcrStatus('OCR: ошибка фонового сканирования');
    });
  }, Math.max(50, Number(delayMs) || 600));
  pushDiagnosticEvent('ocr.background.schedule', { reason, delayMs: Math.max(50, Number(delayMs) || 600) });
}

async function startBackgroundOcrScan(reason = 'auto') {
  if (!state.adapter || !state.pageCount) return;
  if (state.docName == null) return;
  if (state.backgroundOcrRunning) return;

  // Pre-check: ensure Tesseract can initialize before scanning all pages
  const tessAvail = await isTesseractAvailable();
  if (!tessAvail) {
    pushDiagnosticEvent('ocr.background.skip', { reason: 'tesseract-unavailable' }, 'warn');
    return;
  }
  const lang = getOcrLang();
  const initOk = await initTesseract(lang === 'auto' ? 'auto' : lang);
  if (!initOk) {
    pushDiagnosticEvent('ocr.background.skip', { reason: 'tesseract-init-failed', lang }, 'warn');
    setOcrStatus('OCR: фоновое распознавание невозможно — ошибка инициализации');
    return;
  }

  const token = Date.now();
  state.backgroundOcrToken = token;
  state.backgroundOcrRunning = true;
  pushDiagnosticEvent('ocr.background.start', { reason, pageCount: state.pageCount });

  const existing = loadOcrTextData();
  const pagesText = Array.isArray(existing?.pagesText) ? [...existing.pagesText] : new Array(state.pageCount).fill('');
  const maxPages = state.pageCount;
  let consecutiveEmpty = 0;

  try {
    for (let i = 1; i <= maxPages; i += 1) {
      if (state.backgroundOcrToken !== token) {
        return;
      }
      if (state.docName === null || state.docName === undefined) return;
      if (pagesText[i - 1]) { consecutiveEmpty = 0; continue; }

      const txt = await extractTextForPage(i);
      if (txt) {
        consecutiveEmpty = 0;
        const corrected = postCorrectOcrText(txt);
        pagesText[i - 1] = corrected;
        indexOcrPage(i, corrected);
        recordSuccessfulOperation();
        if (i % 5 === 0 || i === maxPages) {
          saveOcrTextData({
            pagesText,
            source: 'auto-ocr',
            scannedPages: i,
            totalPages: state.pageCount,
            updatedAt: new Date().toISOString(),
          });
        }

        if (i === state.currentPage && !els.pageText.value) {
          els.pageText.value = corrected;
        }
      } else {
        consecutiveEmpty++;
        // If Tesseract worker died, stop wasting CPU on remaining pages
        if (consecutiveEmpty >= 5 && !getTesseractStatus().ready) {
          pushDiagnosticEvent('ocr.background.abort', { reason: 'engine-dead', page: i, consecutiveEmpty }, 'error');
          setOcrStatus('OCR: фоновое распознавание прервано — движок недоступен');
          break;
        }
      }

      if (i % 3 === 0) {
        setOcrStatus(`OCR: фоновое распознавание ${i}/${maxPages}`);
      }
      await yieldToMainThread();
    }

    saveOcrTextData({
      pagesText,
      source: 'auto-ocr',
      scannedPages: maxPages,
      totalPages: state.pageCount,
      updatedAt: new Date().toISOString(),
    });
    setOcrStatus('OCR: фоновое распознавание завершено');
    try { toastSuccess('OCR: фоновое распознавание завершено'); } catch {}
    pushDiagnosticEvent('ocr.background.finish', { scannedPages: maxPages });
  } finally {
    if (state.backgroundOcrToken === token) {
      state.backgroundOcrRunning = false;
    }
  }
}

function normalizePoint(x, y) {
  return {
    x: x / Math.max(1, els.annotationCanvas.width),
    y: y / Math.max(1, els.annotationCanvas.height),
  };
}

function denormalizePoint(point) {
  return {
    x: point.x * els.annotationCanvas.width,
    y: point.y * els.annotationCanvas.height,
  };
}

function applyStrokeStyle(ctx, stroke) {
  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * 2;
  } else if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.size * 2;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawStroke(ctx, stroke) {
  if (!stroke.points?.length) return;
  ctx.save();
  applyStrokeStyle(ctx, stroke);

  const start = denormalizePoint(stroke.points[0]);

  if (stroke.tool === 'rect') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'arrow') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const headLen = Math.max(10, stroke.size * 2);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(end.x, end.y);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'line') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'circle') {
    const end = denormalizePoint(stroke.points[stroke.points.length - 1]);
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      const r = Math.max(rx, ry);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const p = denormalizePoint(stroke.points[i]);
    ctx.lineTo(p.x, p.y);
  }

  if (stroke.points.length === 1) {
    ctx.lineTo(start.x + 0.1, start.y + 0.1);
  }

  ctx.stroke();
  ctx.restore();
}

function renderAnnotations() {
  const ctx = getCurrentAnnotationCtx();
  const adpr = getAnnotationDpr();
  ctx.clearRect(0, 0, els.annotationCanvas.width, els.annotationCanvas.height);

  // Scale context to match HiDPI annotation canvas
  ctx.save();
  ctx.scale(adpr, adpr);

  const strokes = loadStrokes();
  const comments = loadComments();

  strokes.forEach((stroke) => drawStroke(ctx, stroke));

  comments.forEach((comment, idx) => {
    const p = denormalizePoint(comment.point);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d6fe9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), p.x, p.y);
    ctx.restore();
  });

  if (state.ocrSelection) drawOcrSelectionPreview();

  ctx.restore(); // undo DPR scale

  els.annStats.textContent = `Штрихов: ${strokes.length} • Комментариев: ${comments.length}`;
}

function getCanvasPointFromEvent(e) {
  const rect = els.annotationCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * els.annotationCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * els.annotationCanvas.height;
  return { x, y };
}

async function beginStroke(e) {
  if (!state.adapter) return;

  if (state.ocrRegionMode) {
    const p = getCanvasPointFromEvent(e);
    const point = normalizePoint(p.x, p.y);
    state.isSelectingOcr = true;
    state.ocrSelection = { start: point, end: point };
    renderAnnotations();
    return;
  }

  if (!state.drawEnabled) return;
  const p = getCanvasPointFromEvent(e);
  const point = normalizePoint(p.x, p.y);

  if (els.drawTool.value === 'comment') {
    const text = await nrPrompt('Текст комментария:');
    if (!text) return;
    const comments = loadComments();
    comments.push({ point, text: text.trim() });
    saveComments(comments);
    renderAnnotations();
    renderCommentList();
    return;
  }

  if (!els.drawTool || !els.drawColor || !els.drawSize) return;
  state.isDrawing = true;
  const toolValue = els.drawTool.value;
  const shapeTool = ['rect', 'arrow', 'line', 'circle'].includes(toolValue);
  state.currentStroke = {
    tool: toolValue,
    color: els.drawColor.value,
    size: Number(els.drawSize.value),
    points: shapeTool ? [point, point] : [point],
  };
  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

function moveStroke(e) {
  if (state.ocrRegionMode && state.isSelectingOcr && state.ocrSelection) {
    const p = getCanvasPointFromEvent(e);
    state.ocrSelection.end = normalizePoint(p.x, p.y);
    renderAnnotations();
    return;
  }

  if (!state.isDrawing || !state.currentStroke) return;
  const p = getCanvasPointFromEvent(e);
  const point = normalizePoint(p.x, p.y);

  if (['rect', 'arrow', 'line', 'circle'].includes(state.currentStroke.tool)) {
    state.currentStroke.points[1] = point;
  } else {
    state.currentStroke.points.push(point);
  }

  renderAnnotations();
  const ctx = getCurrentAnnotationCtx();
  drawStroke(ctx, state.currentStroke);
}

async function endStroke() {
  if (state.ocrRegionMode && state.isSelectingOcr && state.ocrSelection) {
    state.isSelectingOcr = false;
    const s = state.ocrSelection.start;
    const e2 = state.ocrSelection.end;
    const rect = {
      x: Math.min(s.x, e2.x) * els.canvas.width,
      y: Math.min(s.y, e2.y) * els.canvas.height,
      w: Math.abs(e2.x - s.x) * els.canvas.width,
      h: Math.abs(e2.y - s.y) * els.canvas.height,
    };
    const minW = Math.max(8, Number(state.settings?.ocrMinW) || 24);
    const minH = Math.max(8, Number(state.settings?.ocrMinH) || 24);
    if (rect.w > minW && rect.h > minH) {
      await runOcrOnRect(rect, 'region');
    } else {
      setOcrStatus(`OCR: область меньше порога ${minW}x${minH}`);
    }
    state.ocrSelection = null;
    renderAnnotations();
    return;
  }

  if (!state.isDrawing || !state.currentStroke) return;
  const strokes = loadStrokes();
  strokes.push(state.currentStroke);
  saveStrokes(strokes);
  state.isDrawing = false;
  state.currentStroke = null;
  renderAnnotations();
}

function undoStroke() {
  const strokes = loadStrokes();
  if (!strokes.length) return;
  strokes.pop();
  saveStrokes(strokes);
  renderAnnotations();
}

function clearStrokes() {
  saveStrokes([]);
  renderAnnotations();
}

function clearComments() {
  saveComments([]);
  renderAnnotations();
  renderCommentList();
}

function exportAnnotatedPng() {
  if (!state.adapter) return;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = els.canvas.width;
  exportCanvas.height = els.canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.drawImage(els.canvas, 0, 0);
  ctx.drawImage(els.annotationCanvas, 0, 0, els.annotationCanvas.width, els.annotationCanvas.height, 0, 0, els.canvas.width, els.canvas.height);
  const url = exportCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotated.png`;
  a.click();
}


function exportAnnotationsJson() {
  if (!state.adapter) return;
  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    page: state.currentPage,
    strokes: loadStrokes(),
    comments: loadComments(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}-annotations.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAnnotationsJson(file) {
  if (!state.adapter || !file) return;

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.strokes)) {
      throw new Error('bad payload');
    }

    const normalized = payload.strokes.filter((stroke) => (
      stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
      && typeof stroke.size === 'number'
      && Array.isArray(stroke.points)
    ));

    const comments = Array.isArray(payload.comments) ? payload.comments.filter((x) => x && x.point && typeof x.text === 'string') : [];
    saveStrokes(normalized);
    saveComments(comments);
    renderAnnotations();
    renderCommentList();
  } catch {
    toastError('Не удалось импортировать JSON аннотаций. Проверьте формат файла.');
  }
}

function showShortcutsHelp() {
  // Use the new shortcuts modal if available, else fallback
  if (window._novaShortcuts?.openShortcuts) {
    window._novaShortcuts.openShortcuts();
    return;
  }
  // Fallback: create inline modal
  const lines = [
    `След. страница — ${hotkeys.next}`,
    `Пред. страница — ${hotkeys.prev}`,
    `Zoom + — ${hotkeys.zoomIn}`,
    `Zoom − — ${hotkeys.zoomOut}`,
    `По ширине — ${hotkeys.fitWidth}`,
    `По странице — ${hotkeys.fitPage}`,
    `Фокус поиска — ${hotkeys.searchFocus}`,
    `OCR страницы — ${hotkeys.ocrPage}`,
    'Ctrl+P — печать',
    'Ctrl+Shift+O — оптимизация PDF',
    'Ctrl+Shift+A — доступность',
    'Ctrl+Shift+R — редактирование ПД',
    'Ctrl+Shift+C — сравнение документов',
    'Ctrl+Shift+B — пакетное OCR',
    '? — это окно',
  ];
  const overlay = document.createElement('div');
  overlay.className = 'modal open';
  overlay.innerHTML = `<div class="modal-card">
    <div class="modal-head"><h3>Горячие клавиши</h3><button id="closeShortcutsHelp">✕</button></div>
    <div class="modal-body"><pre style="margin:0;font-size:0.82rem;white-space:pre-wrap;color:var(--text)">${lines.join('\n')}</pre></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); };
  overlay.querySelector('#closeShortcutsHelp').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}


function exportAnnotationBundleJson() {
  if (!state.adapter) return;
  const pages = {};
  for (let page = 1; page <= state.pageCount; page += 1) {
    const strokes = loadStrokes(page);
    const comments = loadComments(page);
    if (strokes.length || comments.length) {
      pages[String(page)] = { strokes, comments };
    }
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    pageCount: state.pageCount,
    pages,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-annotations-bundle.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAnnotationBundleJson(file) {
  if (!state.adapter || !file) return;
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    if (!payload || typeof payload.pages !== 'object') {
      throw new Error('bad bundle');
    }

    clearDocumentAnnotationStorage();
    clearDocumentCommentStorage();

    Object.entries(payload.pages).forEach(([pageRaw, entry]) => {
      const page = Number.parseInt(pageRaw, 10);
      const strokes = Array.isArray(entry) ? entry : entry?.strokes;
      const comments = Array.isArray(entry?.comments) ? entry.comments : [];
      if (!Number.isInteger(page) || page < 1 || page > state.pageCount || !Array.isArray(strokes)) {
        return;
      }
      const normalized = strokes.filter((stroke) => (
        stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
        && typeof stroke.size === 'number'
        && Array.isArray(stroke.points)
      ));
      const normalizedComments = comments.filter((x) => x && x.point && typeof x.text === 'string');
      saveStrokes(normalized, page);
      saveComments(normalizedComments, page);
    });

    renderAnnotations();
    renderCommentList();
  } catch {
    toastError('Не удалось импортировать bundle JSON аннотаций. Проверьте формат файла.');
  }
}


function setWorkspaceStatus(message, type = '') {
  els.workspaceStatus.textContent = message;
  els.workspaceStatus.classList.remove('error', 'success');
  if (type) {
    els.workspaceStatus.classList.add(type);
  }
}

function setStage4Status(message, type = '') {
  if (!els.stage4Status) return;
  els.stage4Status.textContent = message;
  els.stage4Status.classList.remove('error', 'success');
  if (type) {
    els.stage4Status.classList.add(type);
  }
}

function initReleaseGuards() {
  if (els.appVersion) {
    els.appVersion.textContent = APP_VERSION;
  }

  if (typeof fetch !== 'function') {
    els.pushCloudSync.disabled = true;
    els.pullCloudSync.disabled = true;
    setStage4Status('Cloud sync недоступен: fetch API отсутствует.', 'error');
  }

  if (typeof BroadcastChannel !== 'function') {
    els.toggleCollab.disabled = true;
    els.broadcastCollab.disabled = true;
    setStage4Status('Collaboration недоступна: BroadcastChannel отсутствует.', 'error');
  }
}

function cloudSyncUrlKey() {
  return 'novareader-cloud-sync-url';
}

function loadCloudSyncUrl() {
  const saved = localStorage.getItem(cloudSyncUrlKey());
  if (saved) return saved;
  if (typeof location !== 'undefined') {
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (isHttp && location.origin) {
      return `${location.origin}/api/workspace`;
    }
  }
  return '';
}

function saveCloudSyncUrl() {
  const value = (els.cloudSyncUrl.value || '').trim();
  localStorage.setItem(cloudSyncUrlKey(), value);
  setStage4Status(value ? 'Cloud URL сохранён.' : 'Cloud URL очищен.', 'success');
}

function ocrTextKey() {
  return `novareader-ocr-text:${state.docName || 'global'}`;
}

function loadOcrTextData() {
  try {
    const raw = localStorage.getItem(ocrTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveOcrTextData(payload) {
  localStorage.setItem(ocrTextKey(), JSON.stringify(payload));
  // Also persist to IndexedDB for larger datasets
  const docName = state.docName || 'global';
  saveOcrData(docName, payload).catch(() => {});
}

async function loadOcrTextDataAsync() {
  // Try IndexedDB first (supports larger datasets), fall back to localStorage
  const docName = state.docName || 'global';
  try {
    const idbData = await loadOcrData(docName);
    if (idbData) return idbData;
  } catch { /* fall through */ }
  return loadOcrTextData();
}


function buildWorkspacePayload() {
  const pages = {};
  for (let page = 1; page <= state.pageCount; page += 1) {
    const strokes = loadStrokes(page);
    const comments = loadComments(page);
    if (strokes.length || comments.length) {
      pages[String(page)] = { strokes, comments };
    }
  }

  return {
    app: 'NovaReader',
    type: 'workspace-backup',
    version: 1,
    docName: state.docName,
    pageCount: state.pageCount,
    exportedAt: new Date().toISOString(),
    notes: getNotesModel(),
    bookmarks: loadBookmarks(),
    hotkeys,
    theme: localStorage.getItem('novareader-theme') || 'dark',
    pages,
    ocrText: loadOcrTextData(),
  };
}

async function applyWorkspacePayload(payload, { skipConfirm = false } = {}) {
  if (!payload || typeof payload !== 'object' || payload.type !== 'workspace-backup') {
    throw new Error('bad workspace payload');
  }

  const sourceDoc = payload.docName || 'unknown';
  if (!skipConfirm && payload.docName && payload.docName !== state.docName) {
    const proceed = await nrConfirm(`Backup создан для «${sourceDoc}». Импортировать в «${state.docName}»?`);
    if (!proceed) {
      setWorkspaceStatus('Импорт отменён пользователем.');
      return false;
    }
  }

  const normalizedNotes = normalizeImportedNotes(payload.notes);
  els.notesTitle.value = normalizedNotes.title;
  els.notesTags.value = normalizedNotes.tags;
  els.notes.value = normalizedNotes.body;
  saveNotes('manual');

  const bookmarks = Array.isArray(payload.bookmarks)
    ? payload.bookmarks.filter((x) => Number.isInteger(x?.page) && x.page >= 1 && x.page <= state.pageCount)
    : [];
  saveBookmarks(bookmarks);
  renderBookmarks();
  setBookmarksStatus('');

  if (payload.hotkeys && typeof payload.hotkeys === 'object') {
    const candidate = {
      next: normalizeHotkey(payload.hotkeys.next, defaultHotkeys.next),
      prev: normalizeHotkey(payload.hotkeys.prev, defaultHotkeys.prev),
      zoomIn: normalizeHotkey(payload.hotkeys.zoomIn, defaultHotkeys.zoomIn),
      zoomOut: normalizeHotkey(payload.hotkeys.zoomOut, defaultHotkeys.zoomOut),
      annotate: normalizeHotkey(payload.hotkeys.annotate, defaultHotkeys.annotate),
      searchFocus: normalizeHotkey(payload.hotkeys.searchFocus, defaultHotkeys.searchFocus),
      ocrPage: normalizeHotkey(payload.hotkeys.ocrPage, defaultHotkeys.ocrPage),
      fitWidth: normalizeHotkey(payload.hotkeys.fitWidth, defaultHotkeys.fitWidth),
      fitPage: normalizeHotkey(payload.hotkeys.fitPage, defaultHotkeys.fitPage),
    };
    const validation = validateHotkeys(candidate);
    if (validation.ok) {
      setHotkeys(candidate);
      localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
      renderHotkeyInputs();
      setHotkeysInputErrors([]);
      setHotkeysStatus('Hotkeys импортированы из backup.', 'success');
    }
  }

  if (payload.theme === 'light' || payload.theme === 'dark') {
    localStorage.setItem('novareader-theme', payload.theme);
    document.body.classList.toggle('light', payload.theme === 'light');
  }

  if (payload.ocrText && typeof payload.ocrText === 'object') {
    saveOcrTextData(payload.ocrText);
  }

  clearDocumentAnnotationStorage();
  clearDocumentCommentStorage();
  const pages = payload.pages && typeof payload.pages === 'object' ? payload.pages : {};
  Object.entries(pages).forEach(([pageRaw, entry]) => {
    const page = Number.parseInt(pageRaw, 10);
    const strokes = Array.isArray(entry?.strokes) ? entry.strokes : [];
    const comments = Array.isArray(entry?.comments) ? entry.comments : [];
    if (!Number.isInteger(page) || page < 1 || page > state.pageCount) return;
    const normalizedStrokes = strokes.filter((stroke) => (
      stroke && ['pen', 'highlighter', 'eraser', 'rect', 'arrow', 'line', 'circle'].includes(stroke.tool)
      && typeof stroke.size === 'number'
      && Array.isArray(stroke.points)
    ));
    const normalizedComments = comments.filter((x) => x && x.point && typeof x.text === 'string');
    saveStrokes(normalizedStrokes, page);
    saveComments(normalizedComments, page);
  });

  renderAnnotations();
  renderCommentList();
  return true;
}

async function pushWorkspaceToCloud() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  const endpoint = (els.cloudSyncUrl?.value || '').trim();
  if (!endpoint) {
    setStage4Status('Укажите Cloud endpoint URL.', 'error');
    return;
  }

  const payload = buildWorkspacePayload();
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`push failed: ${response.status}`);
  }
  setStage4Status('Workspace отправлен в cloud.', 'success');
}

async function pullWorkspaceFromCloud() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  const endpoint = (els.cloudSyncUrl?.value || '').trim();
  if (!endpoint) {
    setStage4Status('Укажите Cloud endpoint URL.', 'error');
    return;
  }

  const response = await fetch(endpoint, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`pull failed: ${response.status}`);
  }
  const payload = await response.json();
  const ok = await applyWorkspacePayload(payload, { skipConfirm: true });
  if (ok) {
    setWorkspaceStatus('Workspace подтянут из cloud.', 'success');
    setStage4Status('Cloud pull завершён.', 'success');
  }
}

function collabChannelName() {
  return `novareader-collab:${state.docName || 'global'}`;
}

function broadcastWorkspaceSnapshot(reason = 'manual') {
  if (!state.collabEnabled || !state.collabChannel) return;
  state.collabChannel.postMessage({
    type: 'workspace-sync',
    reason,
    payload: buildWorkspacePayload(),
    at: Date.now(),
  });
  setStage4Status(`Snapshot отправлен (${reason}).`, 'success');
}

function toggleCollaborationChannel() {
  if (!state.adapter) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }

  if (state.collabEnabled) {
    state.collabEnabled = false;
    if (state.collabChannel) {
      state.collabChannel.close();
      state.collabChannel = null;
    }
    if (els.toggleCollab) els.toggleCollab.textContent = 'Collab: off';
    setStage4Status('Collab выключен.');
    return;
  }

  state.collabChannel = new BroadcastChannel(collabChannelName());
  state.collabChannel.onmessage = async (e) => {
    const msg = e.data;
    if (!msg || msg.type !== 'workspace-sync' || !msg.payload) return;
    try {
      const ok = await applyWorkspacePayload(msg.payload, { skipConfirm: true });
      if (ok) {
        setWorkspaceStatus('Workspace получен из collab-канала.', 'success');
        setStage4Status('Collab snapshot применён.', 'success');
      }
    } catch {
      setStage4Status('Ошибка применения collab snapshot.', 'error');
    }
  };
  state.collabEnabled = true;
  els.toggleCollab.textContent = 'Collab: on';
  setStage4Status('Collab включен.', 'success');
}

async function importOcrJson(file) {
  if (!state.adapter || !file) {
    setStage4Status('Сначала откройте документ.', 'error');
    return;
  }
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const pagesText = Array.isArray(payload?.pagesText)
      ? payload.pagesText.map((x) => (typeof x === 'string' ? x : ''))
      : [];
    if (!pagesText.length) {
      setStage4Status('OCR JSON: нет pagesText.', 'error');
      return;
    }
    const normalized = {
      pageCount: Math.max(state.pageCount, pagesText.length),
      pagesText,
      importedAt: new Date().toISOString(),
      source: payload?.source || 'ocr-import',
    };
    saveOcrTextData(normalized);
    if (state.adapter.type === 'djvu' && typeof state.adapter.setData === 'function' && typeof state.adapter.exportData === 'function') {
      state.adapter.setData({ ...state.adapter.exportData(), pagesText: normalized.pagesText, pageCount: normalized.pageCount });
      state.pageCount = state.adapter.getPageCount();
      els.pageInput.max = String(state.pageCount);
      await renderPagePreviews();
      await renderCurrentPage();
    }
    setStage4Status('OCR JSON импортирован.', 'success');
  } catch {
    setStage4Status('Ошибка импорта OCR JSON.', 'error');
  }
}

function exportWorkspaceBundleJson() {
  if (!state.adapter) {
    setWorkspaceStatus('Сначала откройте документ.', 'error');
    return;
  }

  const payload = buildWorkspacePayload();

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-workspace-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
  setWorkspaceStatus('Workspace экспортирован.', 'success');
}

async function importWorkspaceBundleJson(file) {
  if (!state.adapter || !file) {
    setWorkspaceStatus('Сначала откройте документ.', 'error');
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const ok = await applyWorkspacePayload(payload);
    if (ok) {
      setWorkspaceStatus('Workspace импортирован.', 'success');
    }
  } catch {
    setWorkspaceStatus('Ошибка импорта workspace backup.', 'error');
  }
}








function buildSearchResultsSummaryText() {
  const rows = state.searchResults.map((page, idx) => {
    const count = state.searchResultCounts[page] || 0;
    return `${idx + 1}. Страница ${page}${count ? ` — ${count} совп.` : ''}`;
  });
  const scopeLabel = (state.lastSearchScope === 'page' || state.lastSearchScope === 'current') ? 'текущая страница' : 'весь документ';
  const header = [
    `Документ: ${state.docName || 'document'}`,
    `Запрос: ${state.lastSearchQuery || '—'}`,
    `Область: ${scopeLabel}`,
    `Результатов: ${state.searchResults.length}`,
  ];
  return `${header.join('\n')}\n\n${rows.join('\n')}`;
}

async function copySearchResultsSummary() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Копирование доступно для PDF/DjVu';
    return;
  }
  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для копирования';
    return;
  }

  const text = buildSearchResultsSummaryText();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    els.searchStatus.textContent = `Скопировано результатов: ${state.searchResults.length}`;
  } catch {
    els.searchStatus.textContent = 'Не удалось скопировать список';
  }
}

function exportSearchResultsSummaryTxt() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }
  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const text = buildSearchResultsSummaryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results-summary.txt`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `Summary экспортирован: ${state.searchResults.length}`;
}

function exportSearchResultsCsv() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const header = ['index', 'page', 'matches', 'query', 'scope'];
  const rows = state.searchResults.map((page, idx) => {
    const matches = state.searchResultCounts[page] || 0;
    return [
      idx + 1,
      page,
      matches,
      state.lastSearchQuery || '',
      state.lastSearchScope,
    ];
  });

  const csv = [
    header.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results.csv`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `CSV экспортирован: ${rows.length}`;
}

function exportSearchResultsJson() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  if (!state.searchResults.length) {
    els.searchStatus.textContent = 'Нет результатов для экспорта';
    return;
  }

  const rows = state.searchResults.map((page, idx) => ({
    index: idx + 1,
    page,
    matches: state.searchResultCounts[page] || 0,
  }));

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    query: state.lastSearchQuery,
    scope: state.lastSearchScope,
    totalResults: rows.length,
    rows,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-results.json`;
  a.click();
  URL.revokeObjectURL(url);
  els.searchStatus.textContent = `Экспортировано результатов: ${rows.length}`;
}

async function importSearchResultsJson(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const pages = rows
      .map((row) => Number(row?.page))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount);

    if (!pages.length) {
      els.searchStatus.textContent = 'Нет валидных результатов в JSON';
      return;
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    state.searchResults = uniquePages;
    state.searchCursor = 0;
    state.searchResultCounts = {};

    rows.forEach((row) => {
      const page = Number(row?.page);
      const matches = Number(row?.matches);
      if (Number.isInteger(page) && page >= 1 && page <= state.pageCount && Number.isFinite(matches) && matches >= 0) {
        state.searchResultCounts[page] = Math.floor(matches);
      }
    });

    state.lastSearchQuery = typeof payload?.query === 'string' ? payload.query : '';
    state.lastSearchScope = (payload?.scope === 'page' || payload?.scope === 'current') ? 'current' : 'all';

    els.searchInput.value = state.lastSearchQuery;
    els.searchScope.value = state.lastSearchScope;
    saveSearchScope();

    renderSearchResultsList();
    els.searchStatus.textContent = `Импортировано результатов: ${state.searchResults.length}`;
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта результатов поиска';
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  cells.push(current);
  return cells.map((x) => x.trim());
}

async function importSearchResultsCsv(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const lines = raw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      els.searchStatus.textContent = 'CSV не содержит данных';
      return;
    }

    const header = parseCsvLine(lines[0]).map((x) => x.toLowerCase());
    const pageIdx = header.indexOf('page');
    const matchesIdx = header.indexOf('matches');
    const queryIdx = header.indexOf('query');
    const scopeIdx = header.indexOf('scope');

    if (pageIdx === -1) {
      els.searchStatus.textContent = 'CSV должен содержать колонку page';
      return;
    }

    const parsedRows = lines.slice(1).map((line) => parseCsvLine(line));
    const pages = parsedRows
      .map((row) => Number(row[pageIdx]))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount);

    if (!pages.length) {
      els.searchStatus.textContent = 'Нет валидных страниц в CSV';
      return;
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    state.searchResults = uniquePages;
    state.searchCursor = 0;
    state.searchResultCounts = {};

    if (matchesIdx !== -1) {
      parsedRows.forEach((row) => {
        const page = Number(row[pageIdx]);
        const matches = Number(row[matchesIdx]);
        if (Number.isInteger(page) && page >= 1 && page <= state.pageCount && Number.isFinite(matches) && matches >= 0) {
          state.searchResultCounts[page] = Math.floor(matches);
        }
      });
    }

    if (queryIdx !== -1) {
      state.lastSearchQuery = parsedRows[0]?.[queryIdx] || '';
    }
    if (scopeIdx !== -1) {
      state.lastSearchScope = (parsedRows[0]?.[scopeIdx] === 'page' || parsedRows[0]?.[scopeIdx] === 'current') ? 'current' : 'all';
    }

    els.searchInput.value = state.lastSearchQuery || '';
    els.searchScope.value = state.lastSearchScope || 'all';
    saveSearchScope();

    renderSearchResultsList();
    els.searchStatus.textContent = `Импортировано из CSV: ${state.searchResults.length}`;
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта CSV';
  }
}

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
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта DjVu data JSON';
  }
}

function clearSearchResults() {
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};
  state.lastSearchQuery = '';
  state.lastSearchScope = 'all';
  els.searchStatus.textContent = '';
  renderSearchResultsList();
}

function renderSearchResultsList() {
  els.searchResultsList.innerHTML = '';

  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Результаты поиска доступны для PDF/DjVu';
    els.searchResultsList.appendChild(li);
    return;
  }

  if (!state.searchResults.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Нет активных результатов';
    els.searchResultsList.appendChild(li);
    return;
  }

  state.searchResults.forEach((page, idx) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    const count = state.searchResultCounts[page] || 0;
    btn.textContent = `#${idx + 1} · Стр. ${page}${count ? ` · ${count} совп.` : ''}`;
    if (idx === state.searchCursor) {
      btn.textContent += ' (текущее)';
    }
    btn.addEventListener('click', async () => {
      await jumpToSearchResult(idx);
    });
    li.appendChild(btn);
    els.searchResultsList.appendChild(li);
  });
}

function loadSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(searchHistoryKey()) || '[]');
  } catch {
    return [];
  }
}

function saveSearchHistory(history) {
  localStorage.setItem(searchHistoryKey(), JSON.stringify(history));
}

function renderSearchHistory() {
  els.searchHistoryList.innerHTML = '';
  const history = loadSearchHistory();
  if (!canSearchCurrentDoc()) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'История поиска доступна для PDF/DjVu';
    els.searchHistoryList.appendChild(li);
    return;
  }

  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    li.textContent = 'Запросов пока нет';
    els.searchHistoryList.appendChild(li);
    return;
  }

  history.forEach((query) => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const btn = document.createElement('button');
    btn.textContent = query;
    btn.addEventListener('click', async () => {
      els.searchInput.value = query;
      await searchInPdf(query);
    });
    li.appendChild(btn);
    els.searchHistoryList.appendChild(li);
  });
}

function rememberSearchQuery(query) {
  if (!canSearchCurrentDoc()) return;
  const normalized = (query || '').trim();
  if (!normalized) return;
  const history = loadSearchHistory();
  const next = [normalized, ...history.filter((x) => x !== normalized)].slice(0, 10);
  saveSearchHistory(next);
  renderSearchHistory();
}

function buildSearchHistoryText() {
  const history = loadSearchHistory();
  const lines = history.map((query, idx) => `${idx + 1}. ${query}`);
  return `Документ: ${state.docName || 'document'}
Запросов: ${history.length}

${lines.join('\n')}`;
}

function exportSearchHistoryJson() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }

  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    history,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-history.json`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `Экспортировано запросов: ${history.length}`;
}

function exportSearchHistoryTxt() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Экспорт доступен для PDF/DjVu';
    return;
  }
  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const text = buildSearchHistoryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-search-history.txt`;
  a.click();
  URL.revokeObjectURL(url);

  els.searchStatus.textContent = `TXT экспортирован: ${history.length}`;
}

async function copySearchHistory() {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Копирование доступно для PDF/DjVu';
    return;
  }
  const history = loadSearchHistory();
  if (!history.length) {
    els.searchStatus.textContent = 'История поиска пуста';
    return;
  }

  const text = buildSearchHistoryText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    els.searchStatus.textContent = `Скопировано запросов: ${history.length}`;
  } catch {
    els.searchStatus.textContent = 'Не удалось скопировать историю';
  }
}

async function importSearchHistoryJson(file) {
  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Импорт доступен для PDF/DjVu';
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const incoming = Array.isArray(payload?.history) ? payload.history : [];
    const normalized = incoming
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);

    if (!normalized.length) {
      els.searchStatus.textContent = 'Нет валидных запросов в JSON';
      return;
    }

    const unique = [...new Set(normalized)].slice(0, 10);
    saveSearchHistory(unique);
    renderSearchHistory();
    els.searchStatus.textContent = `Импортировано запросов: ${unique.length}`;
  } catch {
    els.searchStatus.textContent = 'Ошибка импорта истории поиска';
  }
}

function clearSearchHistory() {
  saveSearchHistory([]);
  renderSearchHistory();
}



function loadReadingGoal() {
  try {
    const raw = localStorage.getItem(readingGoalKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isInteger(parsed?.page)) return null;
    return parsed.page;
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
    return '';
  }
}


const _openFileImpl = async function openFileImpl(file) {
  const openStartedAt = performance.now();
  pushDiagnosticEvent('file.open.start', { name: file?.name || 'unknown', size: Number(file?.size) || 0 });
  revokeCurrentObjectUrl();
  clearPageRenderCache();
  revokeAllTrackedUrls();
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
    } catch {
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
    } catch {
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
    } catch { /* keep default zoom=1 */ }
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
  try { toastInfo(`${state.docName || 'Документ'} — ${state.pageCount} стр.`); } catch {}
  try { announce(`Документ ${state.docName} открыт, ${state.pageCount} страниц`); } catch {}
};
const openFile = withErrorBoundary(_openFileImpl, 'file-open');

// ─── Pre-render bookkeeping ─────────────────────────────────────────────────
let _preRenderTimer = 0;

function _schedulePreRender(currentPage, zoom, rotation) {
  clearTimeout(_preRenderTimer);
  _preRenderTimer = setTimeout(() => {
    _preRenderAdjacent(currentPage, zoom, rotation);
  }, 150); // slight delay so the current page settles first
}

async function _preRenderAdjacent(page, zoom, rotation) {
  if (!state.adapter) return;
  const targets = [];
  if (page + 1 <= state.pageCount) targets.push(page + 1);
  if (page - 1 >= 1) targets.push(page - 1);
  for (const p of targets) {
    // Skip if already cached at this zoom/rotation
    const existing = pageRenderCache.entries.get(p);
    if (existing && existing.zoom === zoom && existing.rotation === rotation) continue;
    // Don't pre-render if user has already navigated away
    if (state.currentPage !== page) return;
    try {
      const offscreen = document.createElement('canvas');
      await state.adapter.renderPage(p, offscreen, { zoom, rotation });
      // Verify user didn't navigate away during async render
      if (state.currentPage !== page) { offscreen.width = 0; offscreen.height = 0; return; }
      cacheRenderedPage(p, offscreen, zoom, rotation);
      offscreen.width = 0;
      offscreen.height = 0;
    } catch {
      // Pre-render failures are non-critical; silently ignore
    }
  }
}

// ─── Helper: blit a cached entry onto the main canvas ───────────────────────
function _blitCacheToCanvas(entry, canvas) {
  canvas.width = entry.canvas.width;
  canvas.height = entry.canvas.height;
  if (entry.cssWidth) canvas.style.width = entry.cssWidth;
  if (entry.cssHeight) canvas.style.height = entry.cssHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(entry.canvas, 0, 0);
}

function _updateAnnotationCanvas() {
  const displayWidth = Math.max(1, Math.round(parseFloat(els.canvas.style.width || String(els.canvas.width))));
  const displayHeight = Math.max(1, Math.round(parseFloat(els.canvas.style.height || String(els.canvas.height))));
  const annotDpr = Math.max(1, window.devicePixelRatio || 1);
  els.annotationCanvas.width = Math.ceil(displayWidth * annotDpr);
  els.annotationCanvas.height = Math.ceil(displayHeight * annotDpr);
  els.annotationCanvas.style.width = `${displayWidth}px`;
  els.annotationCanvas.style.height = `${displayHeight}px`;
  renderAnnotations();
}

function _updatePageUI(renderMs) {
  els.pageStatus.textContent = `${state.currentPage} / ${state.pageCount}`;
  els.zoomStatus.textContent = `${Math.round(state.zoom * 100)}%`;
  els.pageInput.value = String(state.currentPage);
  capturePageHistoryOnRender();
  saveViewState();
  // Update status bar
  if (els.sbPage) els.sbPage.textContent = `Стр. ${state.currentPage} / ${state.pageCount}`;
  if (els.sbZoom) els.sbZoom.textContent = `${Math.round(state.zoom * 100)}%`;
  if (els.pdfBlockEdit?.classList.contains('active')) {
    blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
  }
  const renderedPage = state.currentPage;
  if (renderMs != null) {
    recordPerfMetric('renderTimes', renderMs);
    recordSuccessfulOperation();
  }
  requestAnimationFrame(() => {
    renderCommentList();
    trackVisitedPage(renderedPage);
    renderReadingProgress();
    pushDiagnosticEvent('page.render', {
      page: renderedPage,
      zoom: Number(state.zoom.toFixed(2)),
      ms: renderMs ?? 0,
    });
  });
}

async function renderCurrentPage() {
  if (!state.adapter) return;
  const renderStartedAt = performance.now();
  const page = state.currentPage;
  const zoom = state.zoom;
  const rotation = state.rotation;

  els.emptyState.style.display = 'none';

  // ── Fast path: exact cache hit (same zoom & rotation) → instant display ──
  const cached = getCachedPage(page);
  if (cached && cached.zoom === zoom && cached.rotation === rotation && cached.canvas.width > 0) {
    _blitCacheToCanvas(cached, els.canvas);
    _updateAnnotationCanvas();
    _updatePageUI(Math.round(performance.now() - renderStartedAt));
    _schedulePreRender(page, zoom, rotation);
    return;
  }

  // ── Show stale cache as placeholder while rendering ──
  if (cached && cached.canvas.width > 0) {
    _blitCacheToCanvas(cached, els.canvas);
  }

  // ── Full render ──
  try {
    await state.adapter.renderPage(page, els.canvas, { zoom, rotation });
  } catch (err) {
    if (err?.name === 'RenderingCancelledException' || err?.message?.includes('Rendering cancelled')) return;
    throw err;
  }

  _updateAnnotationCanvas();
  _updatePageUI(Math.round(performance.now() - renderStartedAt));

  cacheRenderedPage(page, els.canvas, zoom, rotation);
  _schedulePreRender(page, zoom, rotation);

  // Render text layer after page render (non-blocking)
  renderTextLayer(page, zoom, rotation).catch(() => {});
}

// ─── Safe createObjectURL wrapper ──────────────────────────────────────────
function safeCreateObjectURL(data) {
  if (data instanceof Blob || data instanceof File) {
    return URL.createObjectURL(data);
  }
  // Wrap raw data in a Blob as fallback
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    return URL.createObjectURL(new Blob([data]));
  }
  if (typeof data === 'string') {
    return URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
  }
  console.warn('safeCreateObjectURL: invalid argument type', typeof data);
  return '';
}

// ─── Text Layer Rendering ──────────────────────────────────────────────────
// Stores OCR word-level data per page for reuse by DOCX export & search
const _ocrWordCache = new Map();

async function renderTextLayer(pageNum, zoom, rotation) {
  const container = els.textLayerDiv;
  if (!container) return;
  container.innerHTML = '';
  container.style.width = els.canvas.style.width;
  container.style.height = els.canvas.style.height;

  if (!state.adapter) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // ── Path 1: PDF.js native text content ──
  if (state.adapter.type === 'pdf') {
    try {
      const page = await state.adapter.pdfDoc.getPage(pageNum);
      // Use display-scale viewport (zoom only, no dpr) for text positioning.
      // The text layer is sized to CSS pixels, not canvas pixels.
      const displayViewport = page.getViewport({ scale: zoom, rotation });
      const textContent = await page.getTextContent({ normalizeWhitespace: true });

      if (!textContent?.items?.length) {
        await _renderOcrTextLayer(pageNum, zoom, dpr);
        return;
      }

      const displayW = parseFloat(els.canvas.style.width) || displayViewport.width;
      const displayH = parseFloat(els.canvas.style.height) || displayViewport.height;
      container.style.width = `${displayW}px`;
      container.style.height = `${displayH}px`;

      const fragment = document.createDocumentFragment();
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      // Viewport transform: converts PDF coords → display (CSS) coords
      const vtx = displayViewport.transform;

      for (const item of textContent.items) {
        const str = item.str;
        if (!str) continue;
        const tx = item.transform;
        if (!tx) continue;

        const span = document.createElement('span');
        span.textContent = str;

        // Font size in PDF units, then scale to display
        const fontHeight = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
        const displayFontSize = fontHeight * zoom;

        // Apply viewport transform to the PDF text origin (tx[4], tx[5])
        // vtx = [a, b, c, d, e, f] where: x' = a*x + c*y + e, y' = b*x + d*y + f
        const x = vtx[0] * tx[4] + vtx[2] * tx[5] + vtx[4];
        const y = vtx[1] * tx[4] + vtx[3] * tx[5] + vtx[5];

        span.style.left = `${x}px`;
        span.style.top = `${y - displayFontSize}px`;
        span.style.fontSize = `${displayFontSize}px`;
        span.style.fontFamily = item.fontName || 'sans-serif';
        span.style.lineHeight = '1';

        // Rotation from text transform
        const angle = Math.atan2(tx[1], tx[0]);
        if (Math.abs(angle) > 0.01) {
          span.style.transform = `rotate(${-angle}rad)`;
        }

        // Letter-spacing to match PDF text width
        if (item.width > 0 && str.length > 0) {
          const scaledWidth = item.width * zoom;
          if (str.length > 1) {
            measureCtx.font = `${displayFontSize}px ${item.fontName || 'sans-serif'}`;
            const measuredWidth = measureCtx.measureText(str).width;
            if (measuredWidth > 0 && Math.abs(scaledWidth - measuredWidth) > 0.5) {
              const spacing = (scaledWidth - measuredWidth) / (str.length - 1);
              span.style.letterSpacing = `${spacing}px`;
            }
          } else {
            span.style.width = `${scaledWidth}px`;
            span.style.textAlign = 'center';
          }
        }

        fragment.appendChild(span);
      }
      container.appendChild(fragment);
    } catch (err) {
      console.warn('Text layer render failed:', err);
    }
    return;
  }

  // ── Path 2: OCR-based text layer ──
  await _renderOcrTextLayer(pageNum, zoom, dpr);
}

async function _renderOcrTextLayer(pageNum, zoom, dpr) {
  const container = els.textLayerDiv;
  if (!container) return;

  // Check OCR word cache
  let words = _ocrWordCache.get(pageNum);
  if (!words) {
    const ocr = loadOcrTextData();
    if (ocr?.pagesWords?.[pageNum - 1]) {
      words = ocr.pagesWords[pageNum - 1];
    }
  }
  if (!words || !words.length) return;

  // Word bboxes are in [0,1] normalized coordinates (relative to OCR source canvas).
  // We map them to CSS display dimensions for correct on-screen positioning.
  const displayW = parseFloat(els.canvas.style.width) || (els.canvas.width / dpr);
  const displayH = parseFloat(els.canvas.style.height) || (els.canvas.height / dpr);

  container.style.width = `${displayW}px`;
  container.style.height = `${displayH}px`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');

  // Sort words into reading order
  const sortedWords = [...words].filter(w => w.text && w.bbox).sort((a, b) => {
    const dy = a.bbox.y0 - b.bbox.y0;
    const avgH = ((a.bbox.y1 - a.bbox.y0) + (b.bbox.y1 - b.bbox.y0)) / 2;
    // avgH is now in [0,1] range; compare proportionally
    return Math.abs(dy) < avgH * 0.4 ? a.bbox.x0 - b.bbox.x0 : dy;
  });

  const fragment = document.createDocumentFragment();

  for (const word of sortedWords) {
    const span = document.createElement('span');
    span.textContent = word.text;
    if (word.confidence != null) {
      span.dataset.confidence = String(word.confidence);
    }

    // Map normalized [0,1] coords → display pixels
    const x = word.bbox.x0 * displayW;
    const y = word.bbox.y0 * displayH;
    const w = (word.bbox.x1 - word.bbox.x0) * displayW;
    const h = (word.bbox.y1 - word.bbox.y0) * displayH;

    const fontSize = Math.max(6, h * 0.78);

    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    span.style.fontSize = `${fontSize}px`;
    span.style.width = `${w}px`;
    span.style.height = `${h}px`;
    span.style.lineHeight = `${h}px`;

    if (word.text.length > 1) {
      measureCtx.font = `${fontSize}px sans-serif`;
      const measuredWidth = measureCtx.measureText(word.text).width;
      if (measuredWidth > 0 && Math.abs(w - measuredWidth) > 1) {
        const spacing = (w - measuredWidth) / (word.text.length - 1);
        const clampedSpacing = Math.max(-fontSize * 0.3, Math.min(fontSize * 0.5, spacing));
        span.style.letterSpacing = `${clampedSpacing}px`;
      }
    } else if (word.text.length === 1) {
      span.style.textAlign = 'center';
    }

    fragment.appendChild(span);
  }

  container.appendChild(fragment);
}

// ─── Search Highlight in Text Layer ─────────────────────────────────────────
function highlightSearchInTextLayer(query) {
  const container = els.textLayerDiv;
  if (!container || !query) return 0;

  // Remove old highlights
  container.querySelectorAll('.search-highlight').forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });

  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;

  let count = 0;
  const spans = container.querySelectorAll('span');
  for (const span of spans) {
    const text = span.textContent;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(normalized);
    if (idx === -1) continue;

    // Split the span text around matches
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let pos = lower.indexOf(normalized, 0);
    while (pos !== -1) {
      if (pos > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, pos)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(pos, pos + normalized.length);
      mark.dataset.matchIndex = String(count);
      frag.appendChild(mark);
      count++;
      lastIdx = pos + normalized.length;
      pos = lower.indexOf(normalized, lastIdx);
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    span.textContent = '';
    span.appendChild(frag);
  }
  return count;
}

function scrollToSearchHighlight(index) {
  const marks = els.textLayerDiv?.querySelectorAll('.search-highlight');
  if (!marks?.length) return;
  // Remove active class from all
  marks.forEach(m => m.classList.remove('active'));
  const target = marks[index % marks.length];
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ─── Inline Text Editor (Acrobat-style) ────────────────────────────────────
let _activeInlineEditor = null;

function enableInlineTextEditing() {
  const container = els.textLayerDiv;
  if (!container) return;
  container.classList.add('editing');

  container.addEventListener('dblclick', _handleTextLayerDblClick);
}

function disableInlineTextEditing() {
  const container = els.textLayerDiv;
  if (!container) return;
  container.classList.remove('editing');
  container.removeEventListener('dblclick', _handleTextLayerDblClick);
  if (_activeInlineEditor) {
    _activeInlineEditor.remove();
    _activeInlineEditor = null;
  }
}

function _handleTextLayerDblClick(e) {
  const span = e.target.closest('span');
  if (!span) {
    // Click on empty area → create new text block
    const rect = els.textLayerDiv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    _createInlineEditor(x, y, '', null);
    return;
  }

  // Edit existing text
  const rect = span.getBoundingClientRect();
  const containerRect = els.textLayerDiv.getBoundingClientRect();
  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  _createInlineEditor(x, y, span.textContent, span);
}

function _createInlineEditor(x, y, initialText, targetSpan) {
  if (_activeInlineEditor) _activeInlineEditor.remove();

  const editor = document.createElement('div');
  editor.className = 'inline-editor';
  editor.contentEditable = 'true';
  editor.textContent = initialText;
  editor.style.left = `${x}px`;
  editor.style.top = `${y}px`;
  if (targetSpan) {
    editor.style.minWidth = `${targetSpan.offsetWidth + 20}px`;
    editor.style.fontSize = targetSpan.style.fontSize;
  }

  editor.addEventListener('blur', () => {
    const newText = editor.textContent.trim();
    if (targetSpan && newText) {
      targetSpan.textContent = newText;
    } else if (!targetSpan && newText) {
      // Create new text block through block editor
      const displayW = parseFloat(els.canvas.style.width) || 1;
      const displayH = parseFloat(els.canvas.style.height) || 1;
      const canvasW = els.canvas.width || 1;
      const canvasH = els.canvas.height || 1;
      blockEditor.addTextBlock(state.currentPage,
        (x / displayW) * canvasW,
        (y / displayH) * canvasH,
        newText,
        { fontSize: parseInt(editor.style.fontSize) || 14 }
      );
      if (blockEditor.active) {
        blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
      }
    }
    editor.remove();
    _activeInlineEditor = null;
    // Save the edited text back to OCR/edit storage
    _syncTextLayerToStorage();
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { editor.remove(); _activeInlineEditor = null; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
  });

  els.textLayerDiv.appendChild(editor);
  _activeInlineEditor = editor;
  editor.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function _syncTextLayerToStorage() {
  const container = els.textLayerDiv;
  if (!container || !state.adapter) return;

  // Collect all text from spans
  const spans = container.querySelectorAll('span');
  const text = Array.from(spans).map(s => s.textContent).join(' ');
  if (text.trim()) {
    setPageEdits(state.currentPage, text.trim());
    persistEdits();
  }
}

// ─── Image Insertion ───────────────────────────────────────────────────────
function handleImageInsertion(file) {
  if (!file || !state.adapter) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      // Insert at center of visible area
      const canvasW = parseFloat(els.canvas.style.width) || 400;
      const canvasH = parseFloat(els.canvas.style.height) || 600;
      const maxW = canvasW * 0.5;
      const maxH = canvasH * 0.5;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h *= maxW / w; w = maxW; }
      if (h > maxH) { w *= maxH / h; h = maxH; }

      const x = (canvasW - w) / 2;
      const y = (canvasH - h) / 2;

      // Enable block editor if not active
      if (!blockEditor.active) {
        els.pdfBlockEdit?.classList.add('active');
        blockEditor.enable(els.canvasWrap, els.canvas);
      }

      blockEditor.addImageBlock(state.currentPage, x, y, dataUrl, w, h);
      blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
      setOcrStatus('Изображение вставлено. Перемещайте и масштабируйте в режиме "Блоки".');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ─── Watermark ─────────────────────────────────────────────────────────────
function addWatermarkToPage(text, options = {}) {
  if (!state.adapter) return;
  const {
    fontSize = 60,
    color = 'rgba(200, 200, 200, 0.3)',
    angle = -45,
  } = options;

  const ctx = els.annotationCanvas.getContext('2d');
  const w = els.annotationCanvas.width;
  const h = els.annotationCanvas.height;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.font = `${fontSize * dpr}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ─── Stamp ─────────────────────────────────────────────────────────────────
function addStampToPage(stampType) {
  if (!state.adapter) return;
  const stamps = {
    approved: { text: 'УТВЕРЖДЕНО', color: 'rgba(0, 150, 0, 0.5)', border: '#00aa00' },
    rejected: { text: 'ОТКЛОНЕНО', color: 'rgba(200, 0, 0, 0.5)', border: '#cc0000' },
    draft: { text: 'ЧЕРНОВИК', color: 'rgba(150, 150, 0, 0.5)', border: '#aaaa00' },
    confidential: { text: 'КОНФИДЕНЦИАЛЬНО', color: 'rgba(200, 0, 0, 0.5)', border: '#cc0000' },
    copy: { text: 'КОПИЯ', color: 'rgba(0, 0, 200, 0.5)', border: '#0000cc' },
  };

  const stamp = stamps[stampType] || stamps.approved;
  const ctx = els.annotationCanvas.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = els.annotationCanvas.width;

  const boxW = 300 * dpr;
  const boxH = 80 * dpr;
  const x = w - boxW - 40 * dpr;
  const y = 40 * dpr;

  ctx.save();
  ctx.strokeStyle = stamp.border;
  ctx.lineWidth = 3 * dpr;
  ctx.setLineDash([6 * dpr, 3 * dpr]);
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.setLineDash([]);

  ctx.fillStyle = stamp.color;
  ctx.font = `bold ${24 * dpr}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stamp.text, x + boxW / 2, y + boxH / 2);
  ctx.restore();
}

// ─── Signature Pad ─────────────────────────────────────────────────────────
function openSignaturePad() {
  // Create modal with canvas for drawing signature
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:8px;padding:16px;min-width:400px;';
  card.innerHTML = '<h3 style="margin:0 0 8px">Нарисуйте подпись</h3>';

  const sigCanvas = document.createElement('canvas');
  sigCanvas.width = 400;
  sigCanvas.height = 200;
  sigCanvas.style.cssText = 'border:1px solid #ccc;border-radius:4px;cursor:crosshair;display:block;background:white;';

  const sigCtx = sigCanvas.getContext('2d');
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  sigCtx.strokeStyle = '#000';

  let drawing = false;
  sigCanvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    sigCtx.beginPath();
    sigCtx.moveTo(e.offsetX, e.offsetY);
  });
  sigCanvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    sigCtx.lineTo(e.offsetX, e.offsetY);
    sigCtx.stroke();
  });
  sigCanvas.addEventListener('pointerup', () => { drawing = false; });

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Очистить';
  clearBtn.className = 'btn-xs';
  clearBtn.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, 400, 200);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Отмена';
  cancelBtn.className = 'btn-xs';
  cancelBtn.addEventListener('click', () => modal.remove());

  const insertBtn = document.createElement('button');
  insertBtn.textContent = 'Вставить';
  insertBtn.className = 'btn-xs';
  insertBtn.style.background = '#3b82f6';
  insertBtn.style.color = 'white';
  insertBtn.addEventListener('click', async () => {
    const dataUrl = sigCanvas.toDataURL('image/png');
    // Visual preview via block editor
    if (!blockEditor.active) {
      els.pdfBlockEdit?.classList.add('active');
      blockEditor.enable(els.canvasWrap, els.canvas);
    }
    const canvasW = parseFloat(els.canvas.style.width) || 400;
    const canvasH = parseFloat(els.canvas.style.height) || 600;
    blockEditor.addImageBlock(state.currentPage, canvasW * 0.5, canvasH * 0.75, dataUrl, 200, 100);
    blockEditor.refreshOverlay(els.canvasWrap, els.canvas);
    setOcrStatus('Подпись вставлена на canvas');

    // Also embed into actual PDF via pdf-lib
    if (state.adapter?.type === 'pdf' && state.file) {
      try {
        setOcrStatus('Встраивание подписи в PDF...');
        const pngBlob = await (await fetch(dataUrl)).blob();
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        const arrayBuffer = await state.file.arrayBuffer();
        const pdfBlob = await addSignatureToPdf(arrayBuffer, pngBytes, {
          pageNum: state.currentPage,
          x: 350,
          y: 50,
          width: 200,
          height: 100,
        });
        const url = safeCreateObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-signed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setOcrStatus('Подпись встроена в PDF и сохранена');
      } catch (err) {
        setOcrStatus(`Подпись на canvas (PDF ошибка: ${err?.message || 'неизвестная'})`);
      }
    }
    modal.remove();
  });

  btnRow.append(clearBtn, cancelBtn, insertBtn);
  card.append(sigCanvas, btnRow);
  modal.appendChild(card);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

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
  } catch {
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

function toggleTheme() {
  const themes = ['dark', 'light', 'sepia', 'high-contrast', 'auto'];
  const current = localStorage.getItem('novareader-theme') || 'dark';
  const nextIdx = (themes.indexOf(current) + 1) % themes.length;
  applyTheme(themes[nextIdx]);
}

function getNotesModel() {
  return {
    title: (els.notesTitle.value || '').trim(),
    tags: (els.notesTags.value || '').trim(),
    body: els.notes.value || '',
    updatedAt: new Date().toISOString(),
  };
}


function normalizeImportedNotes(payload) {
  if (payload && payload.notes && typeof payload.notes === 'object') {
    return {
      title: payload.notes.title || state.docName || '',
      tags: payload.notes.tags || '',
      body: payload.notes.body || '',
    };
  }

  if (payload && typeof payload.notes === 'string') {
    return {
      title: state.docName || '',
      tags: '',
      body: payload.notes,
    };
  }

  return {
    title: state.docName || '',
    tags: '',
    body: '',
  };
}

function mergeNotesByMode(current, incoming, mode) {
  if (mode === 'append') {
    const joinedBody = [current.body, incoming.body].filter(Boolean).join('\n\n');
    const mergedTags = [current.tags, incoming.tags]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const dedupTags = [...new Set(mergedTags)].join(', ');

    return {
      title: current.title || incoming.title || state.docName || '',
      tags: dedupTags,
      body: joinedBody,
    };
  }

  return {
    title: incoming.title || state.docName || '',
    tags: incoming.tags || '',
    body: incoming.body || '',
  };
}
function loadNotes() {
  const raw = localStorage.getItem(noteKey());
  if (!raw) {
    els.notesTitle.value = state.docName || '';
    els.notesTags.value = '';
    els.notes.value = '';
    setNotesStatus('Заметки загружены');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && ('body' in parsed || 'title' in parsed || 'tags' in parsed)) {
      els.notesTitle.value = parsed.title || state.docName || '';
      els.notesTags.value = parsed.tags || '';
      els.notes.value = parsed.body || '';
      setNotesStatus('Заметки загружены');
      return;
    }
  } catch {
    // Backward compatibility with old plain-string format.
  }

  els.notesTitle.value = state.docName || '';
  els.notesTags.value = '';
  els.notes.value = raw;
  setNotesStatus('Заметки загружены');
}


let notesAutosaveTimer = null;

function setNotesStatus(message) {
  els.notesStatus.textContent = message;
}

function saveNotes(source = 'manual') {
  localStorage.setItem(noteKey(), JSON.stringify(getNotesModel()));
  if (source === 'manual') {
    setNotesStatus(`Сохранено вручную: ${new Date().toLocaleTimeString()}`);
  } else {
    setNotesStatus(`Автосохранение: ${new Date().toLocaleTimeString()}`);
  }
}

function queueNotesAutosave() {
  setNotesStatus('Есть несохранённые изменения...');
  if (notesAutosaveTimer) {
    clearTimeout(notesAutosaveTimer);
  }
  notesAutosaveTimer = setTimeout(() => {
    saveNotes('auto');
    notesAutosaveTimer = null;
  }, 600);
}


function exportNotes() {
  const m = getNotesModel();
  const plain = `Заголовок: ${m.title}
Теги: ${m.tags}
Обновлено: ${m.updatedAt}

${m.body}`;
  const blob = new Blob([plain], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportNotesMarkdown() {
  const m = getNotesModel();
  const title = m.title || state.docName || 'Документ';
  const tags = m.tags ? `**Теги:** ${m.tags}

` : '';
  const markdown = `# Заметки: ${title}

${tags}${m.body}

_Обновлено: ${m.updatedAt}_
`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportNotesJson() {
  const payload = {
    app: 'NovaReader',
    version: 2,
    docName: state.docName || null,
    notes: getNotesModel(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'notes'}.notes.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importNotesJson(file) {
  if (!file) return;
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const incoming = normalizeImportedNotes(payload);
    if (!incoming) {
      throw new Error('bad notes payload');
    }

    const current = {
      title: els.notesTitle.value || state.docName || '',
      tags: els.notesTags.value || '',
      body: els.notes.value || '',
    };

    const mode = els.notesImportMode?.value || 'replace';
    const merged = mergeNotesByMode(current, incoming, mode);

    els.notesTitle.value = merged.title;
    els.notesTags.value = merged.tags;
    els.notes.value = merged.body;
    saveNotes('manual');
  } catch {
    toastError('Не удалось импортировать заметки JSON. Проверьте формат файла.');
  }
}


function insertTimestamp() {
  const stamp = new Date().toLocaleString();
  const prefix = els.notes.value ? '\n' : '';
  els.notes.value += `${prefix}[${stamp}] `;
  els.notes.focus();
  saveNotes('manual');
}


function normalizeHotkey(value, fallback) {
  const v = (value || '').trim().toLowerCase();
  return v || fallback;
}

function setHotkeysStatus(message, type = '') {
  els.hotkeysStatus.textContent = message;
  els.hotkeysStatus.classList.remove('error', 'success');
  if (type) {
    els.hotkeysStatus.classList.add(type);
  }
}

const hotkeyFieldMeta = {
  next: { input: () => els.hkNext, hint: () => els.hkNextHint, label: 'След. стр.' },
  prev: { input: () => els.hkPrev, hint: () => els.hkPrevHint, label: 'Пред. стр.' },
  zoomIn: { input: () => els.hkZoomIn, hint: () => els.hkZoomInHint, label: 'Zoom +' },
  zoomOut: { input: () => els.hkZoomOut, hint: () => els.hkZoomOutHint, label: 'Zoom -' },
  annotate: { input: () => els.hkAnnotate, hint: () => els.hkAnnotateHint, label: 'Аннотации' },
  searchFocus: { input: () => els.hkSearchFocus, hint: () => els.hkSearchFocusHint, label: 'Фокус поиска' },
  ocrPage: { input: () => els.hkOcrPage, hint: () => els.hkOcrPageHint, label: 'OCR страницы' },
  fitWidth: { input: () => els.hkFitWidth, hint: () => els.hkFitWidthHint, label: 'По ширине' },
  fitPage: { input: () => els.hkFitPage, hint: () => els.hkFitPageHint, label: 'По странице' },
};

function hotkeyKeys() {
  return Object.keys(hotkeyFieldMeta);
}

function normalizeHotkeyForDisplay(value) {
  const v = (value || '').toLowerCase();
  if (v === 'arrowright') return '>';
  if (v === 'arrowleft') return '<';
  return value;
}

function setHotkeysInputErrors(fields = [], details = {}) {
  Object.values(hotkeyFieldMeta).forEach((meta) => {
    const input = meta.input();
    const hint = meta.hint();
    input.classList.remove('hotkey-invalid');
    hint.textContent = '';
  });

  fields.forEach((field) => {
    const meta = hotkeyFieldMeta[field];
    if (!meta) return;
    const input = meta.input();
    const hint = meta.hint();
    input.classList.add('hotkey-invalid');
    hint.textContent = details[field] || 'Проверьте значение поля.';
  });
}

function validateHotkeys(nextHotkeys) {
  const entries = Object.entries(nextHotkeys);
  const emptyFields = entries.filter(([, value]) => !value || value.length < 1).map(([field]) => field);
  if (emptyFields.length) {
    const fieldMessages = Object.fromEntries(emptyFields.map((field) => [field, 'Пустое значение.']));
    return { ok: false, message: 'Ошибка: есть пустые хоткеи.', fields: emptyFields, fieldMessages };
  }

  const byValue = new Map();
  entries.forEach(([field, value]) => {
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(field);
  });

  const duplicateValues = [...byValue.entries()].filter(([, arr]) => arr.length > 1);
  if (duplicateValues.length) {
    const duplicateFields = duplicateValues.flatMap(([, arr]) => arr);
    const fieldMessages = {};
    duplicateValues.forEach(([value, fields]) => {
      const labels = fields.map((field) => hotkeyFieldMeta[field]?.label || field).join(', ');
      fields.forEach((field) => {
        fieldMessages[field] = `Конфликт: «${normalizeHotkeyForDisplay(value)}» уже используется в ${labels}.`;
      });
    });
    const duplicates = duplicateValues.map(([v]) => normalizeHotkeyForDisplay(v));
    return {
      ok: false,
      message: `Ошибка: дублирующиеся хоткеи (${duplicates.join(', ')})`,
      fields: duplicateFields,
      fieldMessages,
    };
  }

  return { ok: true, message: 'Hotkeys сохранены.', fields: [], fieldMessages: {} };
}

function renderHotkeyInputs() {
  els.hkNext.value = normalizeHotkeyForDisplay(hotkeys.next);
  els.hkPrev.value = normalizeHotkeyForDisplay(hotkeys.prev);
  els.hkZoomIn.value = hotkeys.zoomIn;
  els.hkZoomOut.value = hotkeys.zoomOut;
  els.hkAnnotate.value = hotkeys.annotate;
  if (els.hkSearchFocus) els.hkSearchFocus.value = hotkeys.searchFocus;
  if (els.hkOcrPage) els.hkOcrPage.value = hotkeys.ocrPage;
  if (els.hkFitWidth) els.hkFitWidth.value = hotkeys.fitWidth;
  if (els.hkFitPage) els.hkFitPage.value = hotkeys.fitPage;
}

function saveHotkeys() {
  const candidate = {
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, defaultHotkeys.next),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, defaultHotkeys.prev),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, defaultHotkeys.zoomIn),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, defaultHotkeys.zoomOut),
    annotate: normalizeHotkey(els.hkAnnotate.value, defaultHotkeys.annotate),
    searchFocus: normalizeHotkey(els.hkSearchFocus?.value, defaultHotkeys.searchFocus),
    ocrPage: normalizeHotkey(els.hkOcrPage?.value, defaultHotkeys.ocrPage),
    fitWidth: normalizeHotkey(els.hkFitWidth?.value, defaultHotkeys.fitWidth),
    fitPage: normalizeHotkey(els.hkFitPage?.value, defaultHotkeys.fitPage),
  };

  const validation = validateHotkeys(candidate);
  if (!validation.ok) {
    setHotkeysInputErrors(validation.fields, validation.fieldMessages);
    setHotkeysStatus(validation.message, 'error');
    return;
  }

  setHotkeysInputErrors([]);
  setHotkeys(candidate);
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysStatus(validation.message, 'success');
}

function loadHotkeys() {
  const raw = localStorage.getItem('novareader-hotkeys');
  if (!raw) {
    setHotkeys({ ...defaultHotkeys });
    renderHotkeyInputs();
    setHotkeysInputErrors([]);
    setHotkeysStatus('Используются значения по умолчанию.');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    setHotkeys({
      next: normalizeHotkey(parsed.next, defaultHotkeys.next),
      prev: normalizeHotkey(parsed.prev, defaultHotkeys.prev),
      zoomIn: normalizeHotkey(parsed.zoomIn, defaultHotkeys.zoomIn),
      zoomOut: normalizeHotkey(parsed.zoomOut, defaultHotkeys.zoomOut),
      annotate: normalizeHotkey(parsed.annotate, defaultHotkeys.annotate),
      searchFocus: normalizeHotkey(parsed.searchFocus, defaultHotkeys.searchFocus),
      ocrPage: normalizeHotkey(parsed.ocrPage, defaultHotkeys.ocrPage),
      fitWidth: normalizeHotkey(parsed.fitWidth, defaultHotkeys.fitWidth),
      fitPage: normalizeHotkey(parsed.fitPage, defaultHotkeys.fitPage),
    });
  } catch {
    setHotkeys({ ...defaultHotkeys });
  }
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys загружены.');
}

function resetHotkeys() {
  setHotkeys({ ...defaultHotkeys });
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys сброшены к умолчанию.', 'success');
}

function stringifyHotkeyEvent(e) {
  const base = e.key.toLowerCase();
  const specialMap = {
    ' ': 'space',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    escape: 'escape',
  };
  const normalizedBase = specialMap[base] || base;
  if (['control', 'shift', 'alt', 'meta'].includes(normalizedBase)) return '';

  const combo = [];
  if (e.ctrlKey) combo.push('ctrl');
  if (e.altKey) combo.push('alt');
  if (e.shiftKey) combo.push('shift');
  if (e.metaKey) combo.push('meta');
  combo.push(normalizedBase);
  return combo.join('+');
}

function bindHotkeyCapture() {
  const fields = hotkeyKeys();
  fields.forEach((field) => {
    const input = hotkeyFieldMeta[field].input();
    input.addEventListener('keydown', (e) => {
      e.preventDefault();
      if (e.key === 'Backspace' || e.key === 'Delete') {
        input.value = '';
        setHotkeysStatus('Поле очищено. Сохраните или примените авто-фикс.');
        setHotkeysInputErrors([]);
        return;
      }

      const value = stringifyHotkeyEvent(e);
      if (!value) return;
      input.value = normalizeHotkeyForDisplay(value);
      setHotkeysStatus(`Назначено: ${hotkeyFieldMeta[field].label} = ${input.value}`);
      setHotkeysInputErrors([]);
    });
  });
}

function autoFixHotkeys() {
  const fields = hotkeyKeys();
  const candidate = {
    next: normalizeHotkey(els.hkNext.value === '>' ? 'arrowright' : els.hkNext.value, ''),
    prev: normalizeHotkey(els.hkPrev.value === '<' ? 'arrowleft' : els.hkPrev.value, ''),
    zoomIn: normalizeHotkey(els.hkZoomIn.value, ''),
    zoomOut: normalizeHotkey(els.hkZoomOut.value, ''),
    annotate: normalizeHotkey(els.hkAnnotate.value, ''),
    searchFocus: normalizeHotkey(els.hkSearchFocus?.value, ''),
    ocrPage: normalizeHotkey(els.hkOcrPage?.value, ''),
    fitWidth: normalizeHotkey(els.hkFitWidth?.value, ''),
    fitPage: normalizeHotkey(els.hkFitPage?.value, ''),
  };

  const used = new Set();
  for (const key of fields) {
    const value = candidate[key];
    if (!value || used.has(value)) {
      candidate[key] = '';
      continue;
    }
    used.add(value);
  }

  for (const key of fields) {
    if (candidate[key]) continue;
    const preferred = defaultHotkeys[key];
    if (!used.has(preferred)) {
      candidate[key] = preferred;
      used.add(preferred);
      continue;
    }

    const fallbackPool = ['j', 'k', 'i', 'o', 'u', 'p', 'n', 'm', 'f2', 'f3', 'f4'];
    const fallback = fallbackPool.find((x) => !used.has(x)) || preferred;
    candidate[key] = fallback;
    used.add(fallback);
  }

  setHotkeys(candidate);
  localStorage.setItem('novareader-hotkeys', JSON.stringify(hotkeys));
  renderHotkeyInputs();
  setHotkeysInputErrors([]);
  setHotkeysStatus('Hotkeys авто-исправлены и сохранены.', 'success');
}


function setBookmarksStatus(message, type = '') {
  els.bookmarksStatus.textContent = message;
  els.bookmarksStatus.classList.remove('error', 'success');
  if (type) {
    els.bookmarksStatus.classList.add(type);
  }
}

function exportBookmarksJson() {
  if (!state.adapter) {
    setBookmarksStatus('Сначала откройте документ', 'error');
    return;
  }

  const payload = {
    app: 'NovaReader',
    version: 1,
    docName: state.docName,
    exportedAt: new Date().toISOString(),
    bookmarks: loadBookmarks(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-bookmarks.json`;
  a.click();
  URL.revokeObjectURL(url);
  setBookmarksStatus('Закладки экспортированы', 'success');
}

async function importBookmarksJson(file) {
  if (!state.adapter || !file) {
    setBookmarksStatus('Сначала откройте документ', 'error');
    return;
  }

  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const list = Array.isArray(payload?.bookmarks) ? payload.bookmarks : (Array.isArray(payload) ? payload : null);
    if (!list) throw new Error('bad payload');

    const normalized = list
      .filter((x) => Number.isInteger(x?.page) && x.page >= 1 && x.page <= state.pageCount)
      .map((x) => ({
        page: x.page,
        label: (x.label || `Метка ${x.page}`).toString().slice(0, 120),
      }));

    const unique = [];
    const seen = new Set();
    normalized.forEach((x) => {
      const key = `${x.page}:${x.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(x);
      }
    });

    unique.sort((a, b) => a.page - b.page);
    saveBookmarks(unique);
    renderBookmarks();
    setBookmarksStatus(`Импортировано закладок: ${unique.length}`, 'success');
  } catch {
    setBookmarksStatus('Ошибка импорта закладок', 'error');
  }
}

function loadBookmarks() {
  return JSON.parse(localStorage.getItem(bookmarkKey()) || '[]');
}

function saveBookmarks(next) {
  localStorage.setItem(bookmarkKey(), JSON.stringify(next));
  renderDocStats();
  renderEtaStatus();
}

function renderBookmarks() {
  const bookmarks = loadBookmarks();
  const filter = (els.bookmarkFilter?.value || '').trim().toLowerCase();
  const filtered = filter
    ? bookmarks.filter((entry) => (`${entry.label} ${entry.page}`).toLowerCase().includes(filter))
    : bookmarks;

  els.bookmarkList.innerHTML = '';

  if (!filtered.length) {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.textContent = filter ? 'Нет закладок по фильтру' : 'Закладок пока нет';
    els.bookmarkList.appendChild(li);
    return;
  }

  filtered.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';

    const btn = document.createElement('button');
    btn.textContent = `Стр. ${entry.page} — ${entry.label}`;
    btn.addEventListener('click', async () => {
      state.currentPage = entry.page;
      await renderCurrentPage();
    });

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Переим.';
    renameBtn.addEventListener('click', async () => {
      const next = await nrPrompt('Новое название закладки:', entry.label);
      if (!next) return;
      const all = loadBookmarks();
      const idx = all.findIndex((x) => x.page === entry.page && x.label === entry.label);
      if (idx >= 0) {
        all[idx].label = next.trim();
        saveBookmarks(all);
        renderBookmarks();
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => {
      const all = loadBookmarks().filter((x) => !(x.page === entry.page && x.label === entry.label));
      saveBookmarks(all);
      renderBookmarks();
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(btn);
    li.appendChild(actions);
    els.bookmarkList.appendChild(li);
  });
}

async function addBookmark() {
  if (!state.adapter) return;
  const label = (await nrPrompt('Название закладки:', `Метка ${state.currentPage}`)) || `Метка ${state.currentPage}`;
  const bookmarks = loadBookmarks();
  if (!bookmarks.some((x) => x.page === state.currentPage && x.label === label)) {
    bookmarks.push({ page: state.currentPage, label });
    bookmarks.sort((a, b) => a.page - b.page);
    saveBookmarks(bookmarks);
    renderBookmarks();
  }
}

function clearBookmarks() {
  saveBookmarks([]);
  renderBookmarks();
  setBookmarksStatus('Закладки очищены', 'success');
}

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
      } catch {
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
    } catch { /* keep placeholder */ }
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
      } catch {
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

async function searchInPdf(query) {
  const searchStartedAt = performance.now();
  state.searchResults = [];
  state.searchCursor = -1;
  state.searchResultCounts = {};

  if (!canSearchCurrentDoc()) {
    els.searchStatus.textContent = 'Поиск доступен для PDF/DjVu';
    renderSearchResultsList();
    return;
  }

  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) {
    els.searchStatus.textContent = 'Введите запрос';
    renderSearchResultsList();
    return;
  }

  const scope = els.searchScope.value === 'current' ? 'current' : 'all';
  state.lastSearchQuery = query.trim();
  state.lastSearchScope = scope;
  rememberSearchQuery(query);

  const ocrData = loadOcrTextData();
  const ocrPages = ocrData?.pagesText || [];

  if (scope === 'current') {
    let txt = (await state.adapter.getText(state.currentPage)).toLowerCase();
    if (!txt) {
      txt = String(ocrPages[state.currentPage - 1] || '').toLowerCase();
    }
    const count = txt.split(normalized).length - 1;
    if (count > 0) {
      state.searchResults = [state.currentPage];
      state.searchResultCounts[state.currentPage] = count;
    }
  } else {
    for (let i = 1; i <= state.pageCount; i += 1) {
      let txt = (await state.adapter.getText(i)).toLowerCase();
      if (!txt) {
        txt = String(ocrPages[i - 1] || '').toLowerCase();
      }
      const count = txt.split(normalized).length - 1;
      if (count > 0) {
        state.searchResults.push(i);
        state.searchResultCounts[i] = count;
      }
      if (i % 10 === 0) {
        els.searchStatus.textContent = `${i}/${state.pageCount}…`;
        await yieldToMainThread();
      }
    }
  }

  const searchMs = Math.round(performance.now() - searchStartedAt);
  recordPerfMetric('searchTimes', searchMs);

  if (state.searchResults.length) {
    state.searchCursor = 0;
    await jumpToSearchResult(0);
    // Highlight matches in text layer
    const hlCount = highlightSearchInTextLayer(query);
    if (hlCount > 0) scrollToSearchHighlight(0);
    const suffix = scope === 'current' ? ' (текущая страница)' : '';
    els.searchStatus.textContent = `Совпадение 1/${state.searchResults.length}${suffix} (${searchMs}мс)`;
  } else {
    els.searchStatus.textContent = scope === 'current' ? 'На текущей странице не найдено' : 'Ничего не найдено';
    renderSearchResultsList();
  }
}

async function jumpToSearchResult(index) {
  if (!state.searchResults.length) return;
  state.searchCursor = (index + state.searchResults.length) % state.searchResults.length;
  state.currentPage = state.searchResults[state.searchCursor];
  els.searchStatus.textContent = `Совпадение ${state.searchCursor + 1}/${state.searchResults.length}`;
  await renderCurrentPage();
  // Highlight matches on the rendered page
  const hlCount = highlightSearchInTextLayer(state.lastSearchQuery);
  if (hlCount > 0) scrollToSearchHighlight(0);
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
  } catch {
    setStage4Status('Ошибка cloud push.', 'error');
  }
});
els.pullCloudSync.addEventListener('click', async () => {
  try {
    await pullWorkspaceFromCloud();
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
        } catch { /* skip */ }
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
    } catch { /* ignore */ }
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
  try { renderCurrentPage(); } catch {}
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
