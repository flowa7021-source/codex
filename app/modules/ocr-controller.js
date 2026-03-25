// @ts-check
// ─── OCR Controller (Orchestrator) ──────────────────────────────────────────
// Thin orchestrator that re-exports from focused sub-modules:
//   - ocr-pipeline-variants.js: Variant generation, preprocessing, recognition loop
//   - ocr-region.js:            Region-based OCR, background scan, text extraction
//
// OCR confidence scoring, text normalization, queue management, and UI controls
// remain here as they are used across modules.
// Image processing, caching, and preprocessing are in ocr-image-processing.js.

import { state, els } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { ToolMode, toolStateMachine } from './tool-modes.js';
import { postCorrectByLanguage, scoreTextByLanguage } from './ocr-languages.js';
import { getOcrLang } from './settings-controller.js';
import { clearSafeTimeout } from './safe-timers.js';
import {
  convertLatinLookalikesToCyrillic,
} from './ocr-image-processing.js';
import { initOcrPipelineVariantsDeps } from './ocr-pipeline-variants.js';
import { initOcrRegionDeps } from './ocr-region.js';

// Re-export image processing functions for backwards compatibility
export {
  getConfusableLatinToCyrillicMap, convertLatinLookalikesToCyrillic, hasMixedCyrillicLatinToken,
  computeOtsuThreshold, countHistogramPercentile,
  scoreCyrillicWordQuality, scoreRussianBigrams, scoreEnglishBigrams,
  medianDenoiseMonochrome, morphologyCloseMonochrome,
  estimateSkewAngleFromBinary, rotateCanvas,
  clearOcrRuntimeCaches, getOcrSourceCacheKey, updateOcrSourceCache,
  constrainOcrSourceCanvasPixels, getFreshOcrSourceCacheEntry,
  buildOcrSourceCanvas, estimatePageSkewAngle, cropCanvasByRelativeRect,
  preprocessOcrCanvas, pickVariantsByBudget,
} from './ocr-image-processing.js';

// ─── Re-exports from ocr-pipeline-variants.js ──────────────────────────────
export { runOcrOnPreparedCanvas } from './ocr-pipeline-variants.js';

// ─── Re-exports from ocr-region.js ─────────────────────────────────────────
export {
  runOcrOnRectNow, runOcrOnRect, runOcrForCurrentPage,
  extractTextForPage,
  scheduleBackgroundOcrScan, startBackgroundOcrScan,
} from './ocr-region.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
const _deps = {
  renderAnnotations: () => {},
  updateOverlayInteractionState: () => {},
  getCurrentAnnotationCtx: () => null,
  denormalizePoint: (p) => p,
  renderTextLayer: async () => {},
  applyAppLanguage: () => {},
  _ocrWordCache: new Map(),
};

/**
 * Inject runtime dependencies that live in app.js.
 * Must be called once during startup before any OCR functions are used.
 * Forwards relevant deps to sub-modules.
 */
export function initOcrControllerDeps(deps) {
  Object.assign(_deps, deps);
  // Forward deps to sub-modules
  initOcrPipelineVariantsDeps({
    _ocrWordCache: deps._ocrWordCache,
    normalizeOcrTextByLang,
    scoreOcrTextByLang,
    postCorrectOcrText,
    setOcrStatus,
  });
  initOcrRegionDeps({
    renderTextLayer: deps.renderTextLayer,
  });
}

// ─── Phase 2: OCR Confidence Scoring ───────────────────────────────────────

export function computeOcrConfidence(text, variants) {
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

export function postCorrectOcrText(text, lang) {
  if (!text) return text;
  const effectiveLang = lang || getOcrLang();
  // Delegate to ocr-languages module for extended language support (DE, FR, ES, IT, PT)
  return postCorrectByLanguage(text, effectiveLang);
}

// ─── Phase 2: Batch OCR Queue with Progress/Cancel/Priority ────────────────
export const batchOcrState = {
  queue: [],
  running: false,
  progress: { completed: 0, total: 0, currentPage: 0 },
  cancelled: false,
  results: new Map(),
  confidenceStats: { high: 0, medium: 0, low: 0, veryLow: 0 },
};

export function enqueueBatchOcr(pages, priority = 'normal') {
  const newTasks = pages.map(p => ({ page: p, priority, status: 'pending' }));
  if (priority === 'high') {
    batchOcrState.queue.unshift(...newTasks);
  } else {
    batchOcrState.queue.push(...newTasks);
  }
  batchOcrState.progress.total = batchOcrState.queue.length + batchOcrState.progress.completed;
  pushDiagnosticEvent('ocr.batch.enqueue', { pages: pages.length, priority, totalQueue: batchOcrState.queue.length });
}

export function cancelBatchOcr() {
  batchOcrState.cancelled = true;
  batchOcrState.queue = [];
  batchOcrState.running = false;
  pushDiagnosticEvent('ocr.batch.cancel', { completed: batchOcrState.progress.completed });
}

export function getBatchOcrProgress() {
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


export function scoreOcrTextByLang(text, lang) {
  const s = String(text || '').trim();
  if (!s) return 0;
  // Delegate to ocr-languages module for extended language support (DE, FR, ES, IT, PT)
  const effectiveLang = lang || getOcrLang();
  return scoreTextByLanguage(s, effectiveLang);
}

// ─── Text Normalization ────────────────────────────────────────────────────

export function normalizeOcrTextByLang(text, langOverride) {
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
    // auto / unknown -- detect dominant script
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

// ─── OCR UI Controls ───────────────────────────────────────────────────────

export function setOcrControlsBusy(busy) {
  const disabled = !!busy;
  if (els.ocrCurrentPage) /** @type {any} */ (els.ocrCurrentPage).disabled = disabled;
  if (els.ocrRegionMode) /** @type {any} */ (els.ocrRegionMode).disabled = disabled;
  if (els.copyOcrText) /** @type {any} */ (els.copyOcrText).disabled = disabled;
}

export function cancelManualOcrTasks(reason = 'manual-stop') {
  state.ocrQueueEpoch += 1;
  state.ocrTaskId += 1;
  state.ocrLatestByReason = {};
  setOcrControlsBusy(false);
  pushDiagnosticEvent('ocr.queue.cancel', { reason, queueEpoch: state.ocrQueueEpoch }, 'warn');
}

export function enqueueOcrTask(reason, task, options = {}) {
  const queuedAt = performance.now();
  const queueEpoch = Number(options.queueEpoch ?? state.ocrQueueEpoch);
  const latestWins = !!options.latestWins;
  const latestReason = String(options.latestReason || reason || 'ocr');
  const latestToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (latestWins) {
    state.ocrLatestByReason[latestReason] = latestToken;
  }

  state.ocrQueue = state.ocrQueue
    .catch((err) => { console.warn('[ocr] error:', err?.message); })
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

export function setOcrStatus(text) {
  if (els.ocrStatus) els.ocrStatus.textContent = text;
  if (els.sbOcr) els.sbOcr.textContent = text ? `OCR: ${text}` : 'OCR: —';
}

export function setOcrStatusThrottled(text, minIntervalMs = 70) {
  const now = performance.now();
  const value = String(text || '');
  if (value === state.ocrLastProgressText) return;
  if (now - state.ocrLastProgressUiAt < Math.max(16, Number(minIntervalMs) || 70)) return;
  state.ocrLastProgressUiAt = now;
  state.ocrLastProgressText = value;
  setOcrStatus(value);
}

export function setOcrRegionMode(enabled) {
  state.ocrRegionMode = !!enabled;
  if (enabled) {
    toolStateMachine.transition(ToolMode.OCR_REGION);
  } else if (toolStateMachine.current === ToolMode.OCR_REGION) {
    toolStateMachine.transition(ToolMode.IDLE);
  }
  if (!state.ocrRegionMode) {
    state.isSelectingOcr = false;
    state.ocrSelection = null;
    _deps.renderAnnotations();
  }
  _deps.updateOverlayInteractionState();
  _deps.applyAppLanguage();
  setOcrStatus(state.ocrRegionMode ? 'OCR: выделите область на странице' : 'OCR: idle');
}

export function drawOcrSelectionPreview() {
  if (!state.ocrSelection) return;
  const ctx = _deps.getCurrentAnnotationCtx();
  const p1 = _deps.denormalizePoint(state.ocrSelection.start);
  const p2 = _deps.denormalizePoint(state.ocrSelection.end);
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

export function classifyOcrError(message) {
  const m = String(message || '').toLowerCase();
  if (!m) return 'unknown';
  if (m.includes('runtime') || m.includes('tesseract')) return 'runtime';
  if (m.includes('fetch') || m.includes('http') || m.includes('load')) return 'asset-load';
  if (m.includes('memory') || m.includes('out of memory')) return 'memory';
  if (m.includes('timeout')) return 'timeout';
  return 'processing';
}

// ─── Background OCR Controls ───────────────────────────────────────────────

export function cancelBackgroundOcrScan(reason = 'manual') {
  state.backgroundOcrToken = 0;
  state.backgroundOcrRunning = false;
  if (state.backgroundOcrTimer) {
    clearSafeTimeout(state.backgroundOcrTimer);
    state.backgroundOcrTimer = null;
  }
  setOcrStatus(`OCR: фоновое распознавание остановлено (${reason})`);
  pushDiagnosticEvent('ocr.background.cancel', { reason }, 'warn');
}

export function cancelAllOcrWork(reason = 'manual-stop') {
  cancelBackgroundOcrScan(reason);
  cancelManualOcrTasks(reason);
  setOcrStatus(`OCR: остановлено (${reason})`);
}
