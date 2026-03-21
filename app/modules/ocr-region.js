// ─── OCR Region Sub-module ──────────────────────────────────────────────────
// Region-based OCR: runOcrOnRectNow, runOcrOnRect, runOcrForCurrentPage,
// extractTextForPage, background OCR scan, and batch management.
// Split from ocr-controller.js for maintainability.

import { state, els } from './state.js';
import { OCR_SLOW_TASK_WARN_MS, OCR_HANG_WARN_MS } from './constants.js';
import { yieldToMainThread } from './utils.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { recordPerfMetric } from './perf.js';
import { recordCrashEvent, recordSuccessfulOperation } from './crash-telemetry.js';
import { getOcrLang } from './settings-controller.js';
import { getPageQualitySummary } from './ocr-word-confidence.js';
import { initTesseract, isTesseractAvailable, getTesseractStatus, initTesseractPool, terminateTesseractPool, isTesseractPoolReady, getRecommendedPoolSize } from './tesseract-adapter.js';
import { indexOcrPage } from './search-controller.js';
import { loadOcrTextData, saveOcrTextData } from './workspace-controller.js';
import { savePageOcrText, getPageOcrText } from './ocr-storage.js';
import { toastSuccess } from './toast.js';
import { AsyncLock } from './async-lock.js';
import { safeTimeout, clearSafeTimeout } from './safe-timers.js';
import {
  buildOcrSourceCanvas, estimatePageSkewAngle, cropCanvasByRelativeRect,
} from './ocr-image-processing.js';
import {
  setOcrStatus, setOcrStatusThrottled,
  enqueueOcrTask, cancelBackgroundOcrScan, postCorrectOcrText,
  computeOcrConfidence, classifyOcrError,
} from './ocr-controller.js';
import { runOcrOnPreparedCanvas } from './ocr-pipeline-variants.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
const _deps = {
  renderTextLayer: async () => {},
};

export function initOcrRegionDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Async lock for background OCR ──────────────────────────────────────────
const ocrBackgroundLock = new AsyncLock();

// ─── OCR Execution ─────────────────────────────────────────────────────────

export async function runOcrOnRectNow(rect) {
  if (!state.adapter || !rect) return;
  const taskId = ++state.ocrTaskId;
  const taskStartedAt = performance.now();
  let hangWarnTimer = null;
  try {
    hangWarnTimer = safeTimeout(() => {
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
        savePageOcrText(state.docName, state.currentPage, corrected).catch((err) => { console.warn('[ocr] error:', err?.message); });
      }
      setOcrStatus(`OCR: распознано ${corrected.length} символов за ${totalMs}мс [${confidence.level} ${confidence.score}%] качество: ${qualitySummary.quality}`);
      recordPerfMetric('ocrTimes', totalMs);
      recordSuccessfulOperation();
      pushDiagnosticEvent('ocr.manual.finish', { taskId, textLength: corrected.length, totalMs, page: state.currentPage, confidence: confidence.score, confidenceLevel: confidence.level, wordQuality: qualitySummary.quality, avgWordScore: qualitySummary.avgScore, lowConfidenceWords: qualitySummary.lowCount });
      if (totalMs >= OCR_SLOW_TASK_WARN_MS) {
        pushDiagnosticEvent('ocr.manual.slow', { taskId, totalMs, page: state.currentPage }, 'warn');
      }
      // Refresh text layer with newly recognized word boxes
      _deps.renderTextLayer(state.currentPage, state.zoom, state.rotation).catch((err) => { console.warn('[ocr] error:', err?.message); });
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
    if (hangWarnTimer) clearSafeTimeout(hangWarnTimer);
  }
}

export async function runOcrOnRect(rect, reason = 'manual') {
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

export async function runOcrForCurrentPage() {
  if (!state.adapter) return;
  await runOcrOnRect({ x: 0, y: 0, w: els.canvas.width, h: els.canvas.height }, 'full-page');
}

export async function extractTextForPage(pageNumber) {
  if (!state.adapter) return '';
  let text = '';
  try {
    text = String(await state.adapter.getText(pageNumber) || '').trim();
  } catch (err) {
    console.warn('[ocr] error:', err?.message);
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
      } catch (err) { console.warn('[app] persist best-effort failed:', err?.message); }
    }
    return ocrResult;
  } catch (err) {
    console.warn('[ocr] error:', err?.message);
    return '';
  }
}

// ─── Background OCR Scan ───────────────────────────────────────────────────

export function scheduleBackgroundOcrScan(reason = 'default', delayMs = 600) {
  if (!state.settings?.backgroundOcr || !state.adapter) return;
  if (state.backgroundOcrTimer) {
    clearSafeTimeout(state.backgroundOcrTimer);
  }
  state.backgroundOcrTimer = safeTimeout(() => {
    state.backgroundOcrTimer = null;
    startBackgroundOcrScan(reason).catch(() => {
      setOcrStatus('OCR: ошибка фонового сканирования');
    });
  }, Math.max(50, Number(delayMs) || 600));
  pushDiagnosticEvent('ocr.background.schedule', { reason, delayMs: Math.max(50, Number(delayMs) || 600) });
}

export async function startBackgroundOcrScan(reason = 'auto') {
  if (!state.adapter || !state.pageCount) return;
  if (state.docName == null) return;
  if (state.backgroundOcrRunning) return;

  // Acquire lock to prevent concurrent background OCR mutations
  const releaseLock = await ocrBackgroundLock.acquire();

  // Pre-check: ensure Tesseract can initialize before scanning all pages
  const tessAvail = await isTesseractAvailable();
  if (!tessAvail) {
    pushDiagnosticEvent('ocr.background.skip', { reason: 'tesseract-unavailable' }, 'warn');
    return;
  }
  const lang = getOcrLang();
  const tessLang = lang === 'auto' ? 'auto' : lang;

  // Try to initialize a parallel worker pool for faster background scanning
  const poolSize = getRecommendedPoolSize();
  let usePool = false;
  try {
    usePool = await initTesseractPool(tessLang, poolSize);
    if (usePool) {
      pushDiagnosticEvent('ocr.background.pool', { poolSize, lang: tessLang });
    }
  } catch (err) {
    console.warn('[ocr] error:', err?.message);
    usePool = false;
  }

  // Fallback to single worker if pool failed
  if (!usePool) {
    const initOk = await initTesseract(tessLang);
    if (!initOk) {
      pushDiagnosticEvent('ocr.background.skip', { reason: 'tesseract-init-failed', lang }, 'warn');
      setOcrStatus('OCR: фоновое распознавание невозможно — ошибка инициализации');
      return;
    }
  }

  const concurrency = usePool ? poolSize : 1;
  const token = Date.now();
  state.backgroundOcrToken = token;
  state.backgroundOcrRunning = true;
  pushDiagnosticEvent('ocr.background.start', { reason, pageCount: state.pageCount, concurrency });

  const existing = loadOcrTextData();
  const pagesText = Array.isArray(existing?.pagesText) ? [...existing.pagesText] : new Array(state.pageCount).fill('');
  const maxPages = state.pageCount;
  let consecutiveEmpty = 0;
  let scannedCount = 0;

  try {
    // Build list of pages that need OCR
    const pagesToScan = [];
    for (let i = 1; i <= maxPages; i++) {
      if (!pagesText[i - 1]) pagesToScan.push(i);
    }

    // Process pages in parallel batches
    for (let batchStart = 0; batchStart < pagesToScan.length; batchStart += concurrency) {
      if (state.backgroundOcrToken !== token) return;
      if (state.docName === null || state.docName === undefined) return;

      const batch = pagesToScan.slice(batchStart, batchStart + concurrency);
      const batchPromises = batch.map(async (pageNum) => {
        if (state.backgroundOcrToken !== token) return { pageNum, text: '' };
        try {
          const txt = await extractTextForPage(pageNum);
          return { pageNum, text: txt || '' };
        } catch (err) {
          console.warn('[ocr] error:', err?.message);
          return { pageNum, text: '' };
        }
      });

      const results = await Promise.all(batchPromises);

      for (const { pageNum, text } of results) {
        if (state.backgroundOcrToken !== token) return;
        if (text) {
          consecutiveEmpty = 0;
          const corrected = postCorrectOcrText(text);
          pagesText[pageNum - 1] = corrected;
          indexOcrPage(pageNum, corrected);
          recordSuccessfulOperation();

          if (pageNum === state.currentPage && !els.pageText.value) {
            els.pageText.value = corrected;
          }
        } else {
          consecutiveEmpty++;
        }
        scannedCount++;
      }

      // Check if engine died
      if (consecutiveEmpty >= 5 && !getTesseractStatus().ready && !isTesseractPoolReady()) {
        pushDiagnosticEvent('ocr.background.abort', { reason: 'engine-dead', scannedCount, consecutiveEmpty }, 'error');
        setOcrStatus('OCR: фоновое распознавание прервано — движок недоступен');
        break;
      }

      // Periodic save and status update
      if (scannedCount % 5 === 0 || batchStart + concurrency >= pagesToScan.length) {
        saveOcrTextData({
          pagesText,
          source: 'auto-ocr',
          scannedPages: scannedCount,
          totalPages: state.pageCount,
          updatedAt: new Date().toISOString(),
        });
      }
      setOcrStatus(`OCR: фоновое распознавание ${scannedCount}/${pagesToScan.length} (×${concurrency})`);
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
    try { toastSuccess('OCR: фоновое распознавание завершено'); } catch (err) { console.warn('[ocr] toast failed:', err?.message); }
    pushDiagnosticEvent('ocr.background.finish', { scannedPages: scannedCount, concurrency });
  } finally {
    if (state.backgroundOcrToken === token) {
      state.backgroundOcrRunning = false;
    }
    // Tear down pool after background scan to free memory
    if (usePool) {
      terminateTesseractPool().catch((err) => { console.warn('[ocr] error:', err?.message); });
    }
    releaseLock();
  }
}
