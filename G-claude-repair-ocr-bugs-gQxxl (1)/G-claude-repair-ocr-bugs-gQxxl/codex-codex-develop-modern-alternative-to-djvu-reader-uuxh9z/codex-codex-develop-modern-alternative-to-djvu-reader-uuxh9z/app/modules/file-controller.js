// ─── File Controller ─────────────────────────────────────────────────────────
// File-opening logic, DjVu data persistence, and object URL management.
// Extracted from app.js as part of module decomposition.

import { state, els } from './state.js';
import { loadImage } from './utils.js';
import { ensurePdfJs, ensureDjVuJs } from './loaders.js';
import { clearPageRenderCache, revokeAllTrackedUrls, recordPerfMetric } from './perf.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { parseEpub, EpubAdapter } from './epub-adapter.js';
import { progressiveLoader } from './progressive-loader.js';
import { formManager } from './pdf-forms.js';
import { clearAllTimers } from './safe-timers.js';
import { toastInfo } from './toast.js';
import { announce } from './a11y.js';
import { resetTesseractAvailability } from './tesseract-adapter.js';
import { bumpRenderGeneration } from './render-controller.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  withErrorBoundary: (fn, _ctx) => fn,
  renderCurrentPage: async () => {},
  renderOutline: async () => {},
  renderPagePreviews: async () => {},
  resetHistory: () => {},
  setWorkspaceStatus: () => {},
  setBookmarksStatus: () => {},
  ensureTextToolsVisible: () => {},
  invalidateAnnotationCaches: () => {},
  clearOcrRuntimeCaches: () => {},
  restoreViewStateIfPresent: () => false,
  stopReadingTimer: () => {},
  loadReadingTime: () => 0,
  loadReadingGoal: () => null,
  loadCloudSyncUrl: () => '',
  toggleCollaborationChannel: () => {},
  saveRecent: () => {},
  renderRecent: () => {},
  loadNotes: () => {},
  renderBookmarks: () => {},
  renderDocInfo: () => {},
  renderVisitTrail: () => {},
  renderSearchHistory: () => {},
  renderSearchResultsList: () => {},
  renderDocStats: () => {},
  estimatePageSkewAngle: () => {},
  scheduleBackgroundOcrScan: () => {},
  setOcrStatus: () => {},
  loadPersistedEdits: () => {},
  renderCommentList: () => {},
  updateReadingTimeStatus: () => {},
  renderEtaStatus: () => {},
  startReadingTimer: () => {},
  recordCrashEvent: () => {},
  PDFAdapter: null,
  DjVuAdapter: null,
  DjVuNativeAdapter: null,
  ImageAdapter: null,
  UnsupportedAdapter: null,
};

/**
 * Inject runtime dependencies that live in app.js or other modules.
 * Must be called once during startup before any file-controller functions are used.
 */
export function initFileControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Object URL Management ──────────────────────────────────────────────────

export function revokeCurrentObjectUrl() {
  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
    state.currentObjectUrl = null;
  }
}

// ─── DjVu Data Persistence ─────────────────────────────────────────────────

export function djvuTextKey() {
  return `novareader-djvu-data:${state.docName || 'global'}`;
}

export function loadDjvuData() {
  try {
    const raw = localStorage.getItem(djvuTextKey());
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[file-controller storage] error:', err?.message);
    return null;
  }
}

export function saveDjvuData(payload) {
  localStorage.setItem(djvuTextKey(), JSON.stringify(payload));
}

// ─── DjVu File Detection ───────────────────────────────────────────────────

export async function isLikelyDjvuFile(file) {
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const text = new TextDecoder('ascii', { fatal: false }).decode(header);
    return text.includes('AT&TFORM') || text.startsWith('AT&T');
  } catch (err) {
    console.warn('[file-controller storage] error:', err?.message);
    return false;
  }
}

export async function extractDjvuFallbackText(file) {
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
    console.warn('[file-controller] error:', err?.message);
    return '';
  }
}

// ─── Reload PDF In-Place ────────────────────────────────────────────────────

/**
 * Reload the current PDF from raw bytes without creating a new file.
 * Preserves current page (clamped to new page count) and zoom.
 * Used by PDF pro operations to apply changes in-place.
 * @param {Uint8Array} bytes - New PDF bytes
 */
export async function reloadPdfFromBytes(bytes) {
  if (!bytes || !(bytes instanceof Uint8Array)) {
    throw new Error('reloadPdfFromBytes: expected Uint8Array');
  }

  const pdf = await ensurePdfJs();
  const pdfDoc = await pdf.getDocument({ data: bytes.slice() }).promise;

  // Update state
  state.pdfBytes = bytes;
  state.adapter = new _deps.PDFAdapter(pdfDoc);
  state.pageCount = state.adapter.getPageCount();

  // Clamp current page
  if (state.currentPage > state.pageCount) {
    state.currentPage = Math.max(1, state.pageCount);
  }

  // Update file object for consistency (so arrayBuffer() returns new data)
  state.file = new File([bytes], state.docName || 'document.pdf', { type: 'application/pdf' });

  // Clear render caches and re-render
  clearPageRenderCache();
  await _deps.renderCurrentPage();
  await _deps.renderPagePreviews();
  await _deps.renderOutline();
}

/**
 * Download the current pdfBytes as a file ("Save As" functionality).
 */
export function saveCurrentPdfAs() {
  const bytes = state.pdfBytes;
  if (!bytes) {
    console.warn('saveCurrentPdfAs: no pdfBytes available');
    return;
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.docName || 'document.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Open File ──────────────────────────────────────────────────────────────

const _openFileImpl = async function openFileImpl(file) {
  const openStartedAt = performance.now();
  pushDiagnosticEvent('file.open.start', { name: file?.name || 'unknown', size: Number(file?.size) || 0 });
  // Cancel any in-flight render on the main canvas to prevent
  // "Cannot use the same canvas during multiple render() operations" cascade
  if (state.adapter?.cancelMainRender) state.adapter.cancelMainRender();
  bumpRenderGeneration();
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
  _deps.resetHistory();
  els.searchStatus.textContent = '';
  _deps.setWorkspaceStatus('');
  _deps.setBookmarksStatus('');
  els.pageText.value = '';
  _deps.ensureTextToolsVisible();
  state.djvuBinaryDetected = false;
  _deps.invalidateAnnotationCaches();
  _deps.clearOcrRuntimeCaches('file-open');
  resetTesseractAvailability(); // allow Tesseract retry on each new file

  const lower = file.name.toLowerCase();

  if (lower.endsWith('.pdf')) {
    try {
      const pdf = await ensurePdfJs();
      const data = await progressiveLoader.loadFileProgressive(file);
      // Store raw bytes for in-place PDF operations
      state.pdfBytes = new Uint8Array(data);
      // For large files (>100MB), disable eager page fetching to reduce memory
      const pdfOptions = { data };
      if (file.size > 100 * 1024 * 1024) {
        pdfOptions.disableAutoFetch = true;
        pdfOptions.disableStream = true;
      }
      const pdfDoc = await pdf.getDocument(pdfOptions).promise;
      state.adapter = new _deps.PDFAdapter(pdfDoc);
    } catch (err) {
      console.warn('[file-controller] error:', err?.message);
      state.adapter = new _deps.UnsupportedAdapter(file.name);
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
      state.adapter = new _deps.DjVuNativeAdapter(doc, file.name);
      openedByNative = true;
      els.searchStatus.textContent = 'DjVu файл открыт встроенным runtime.';
    } catch (err) {
      console.warn('[file-controller] error:', err?.message);
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

      state.adapter = new _deps.DjVuAdapter(file.name, effectiveDjvuData);

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
      state.adapter = new _deps.UnsupportedAdapter(file.name);
      els.searchStatus.textContent = `ePub ошибка: ${err?.message || 'неизвестная ошибка'}`;
    }
  } else if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
    const url = URL.createObjectURL(file);
    state.currentObjectUrl = url;
    const imageMeta = await loadImage(url);
    state.adapter = new _deps.ImageAdapter(url, { width: imageMeta.width, height: imageMeta.height });
  } else {
    state.adapter = new _deps.UnsupportedAdapter(file.name);
  }

  state.pageCount = state.adapter.getPageCount();

  // Auto-load PDF forms if adapter is PDF
  if (state.adapter?.type === 'pdf') {
    formManager.loadFromAdapter(state.adapter).catch((err) => { console.warn('[file-controller] error:', err?.message); });
  }

  const hadSavedState = _deps.restoreViewStateIfPresent();
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
  _deps.stopReadingTimer(false);
  state.readingTotalMs = _deps.loadReadingTime();
  state.readingStartedAt = null;
  state.readingGoalPage = _deps.loadReadingGoal();
  els.pageInput.max = String(state.pageCount);
  els.pageInput.value = String(state.currentPage);
  if (els.cloudSyncUrl) {
    els.cloudSyncUrl.value = _deps.loadCloudSyncUrl();
  }
  if (state.collabEnabled) {
    _deps.toggleCollaborationChannel();
  }

  _deps.saveRecent(file.name);
  _deps.renderRecent();
  _deps.loadNotes();
  _deps.renderBookmarks();
  _deps.renderDocInfo();
  _deps.renderVisitTrail();
  _deps.renderSearchHistory();
  _deps.renderSearchResultsList();
  _deps.renderDocStats();
  await _deps.renderOutline();
  await _deps.renderPagePreviews();
  await _deps.renderCurrentPage();
  pushDiagnosticEvent('file.open.finish', { name: state.docName, ms: Math.round(performance.now() - openStartedAt), pages: state.pageCount });
  _deps.estimatePageSkewAngle(state.currentPage);
  if (state.settings?.backgroundOcr) {
    _deps.scheduleBackgroundOcrScan('open-file', 900);
  } else {
    _deps.setOcrStatus('OCR: фоновое распознавание выключено в настройках');
  }
  _deps.loadPersistedEdits();
  _deps.renderCommentList();
  _deps.updateReadingTimeStatus();
  _deps.renderEtaStatus();
  _deps.startReadingTimer();
  recordPerfMetric('pageLoadTimes', Math.round(performance.now() - openStartedAt));
  try { toastInfo(`${state.docName || 'Документ'} — ${state.pageCount} стр.`); } catch (err) { console.warn('[file] toast failed:', err?.message); }
  try { announce(`Документ ${state.docName} открыт, ${state.pageCount} страниц`); } catch (err) { console.warn('[a11y] announce failed:', err?.message); }
};

export const openFile = (() => {
  // withErrorBoundary is late-bound; build the wrapper lazily on first call
  let _wrapped = null;
  return async function openFileWrapped(...args) {
    if (!_wrapped) {
      _wrapped = _deps.withErrorBoundary(_openFileImpl, 'file-open');
    }
    return _wrapped(...args);
  };
})();
