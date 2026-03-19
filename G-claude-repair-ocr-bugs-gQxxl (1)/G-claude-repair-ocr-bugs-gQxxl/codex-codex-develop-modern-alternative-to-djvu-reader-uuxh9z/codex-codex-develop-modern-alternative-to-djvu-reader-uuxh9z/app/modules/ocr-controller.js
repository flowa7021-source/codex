// ─── OCR Controller ─────────────────────────────────────────────────────────
// OCR confidence scoring, text normalization, recognition pipeline,
// manual/background OCR scheduling, and batch OCR queue management.
// Image processing, caching, and preprocessing moved to ocr-image-processing.js.

import { state, els } from './state.js';
import { OCR_SLOW_TASK_WARN_MS, OCR_HANG_WARN_MS } from './constants.js';
import { yieldToMainThread } from './utils.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { recordPerfMetric } from './perf.js';
import { recordCrashEvent, recordSuccessfulOperation } from './crash-telemetry.js';
import { ToolMode, toolStateMachine } from './tool-modes.js';
import { postCorrectByLanguage, scoreTextByLanguage, detectLanguage } from './ocr-languages.js';
import { getOcrLang } from './settings-controller.js';
import { getPageQualitySummary } from './ocr-word-confidence.js';
import { initTesseract, recognizeTesseract, isTesseractAvailable, getTesseractStatus, initTesseractPool, recognizeWithPool, terminateTesseractPool, isTesseractPoolReady, getRecommendedPoolSize } from './tesseract-adapter.js';
import { indexOcrPage } from './search-controller.js';
import { loadOcrTextData, saveOcrTextData } from './workspace-controller.js';
import { savePageOcrText, getPageOcrText } from './ocr-storage.js';
import { toastSuccess } from './toast.js';
import { AsyncLock } from './async-lock.js';

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

import {
  convertLatinLookalikesToCyrillic,
  estimateSkewAngleFromBinary, rotateCanvas,
  buildOcrSourceCanvas, estimatePageSkewAngle, cropCanvasByRelativeRect,
  preprocessOcrCanvas, pickVariantsByBudget,
} from './ocr-image-processing.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
let _deps = {
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
 */
export function initOcrControllerDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── Async lock for background OCR ──────────────────────────────────────────
const ocrBackgroundLock = new AsyncLock();

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

// ─── OCR Recognition Pipeline ──────────────────────────────────────────────

export async function runOcrOnPreparedCanvas(canvas, options = {}) {
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
  // Helper to free all variant canvases -- called in finally to prevent leaks on early exit
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
        // Use pool if available (background scan), else single worker
        const recognizeFn = isTesseractPoolReady() ? recognizeWithPool : recognizeTesseract;
        const tessResult = await recognizeFn(variant, { lang });
        if (tessResult && tessResult.text) {
          rawText = tessResult.text;
          words = tessResult.words || [];
        }
        if (!rawText && !getTesseractStatus().ready && !isTesseractPoolReady()) {
          pushDiagnosticEvent('ocr.engine.missing', { variant: i });
          break;
        }
      } catch (ocrErr) {
        pushDiagnosticEvent('ocr.engine.error', { variant: i, error: ocrErr?.message || String(ocrErr) });
        if (!getTesseractStatus().ready && !isTesseractPoolReady()) {
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
    _deps._ocrWordCache.set(options.pageNum, bestWords);
    // Also persist to OCR storage
    try {
      const cache = loadOcrTextData();
      if (cache) {
        if (!cache.pagesWords) cache.pagesWords = [];
        cache.pagesWords[options.pageNum - 1] = bestWords;
        saveOcrTextData(cache);
      }
    } catch (err) { console.warn('[app] non-critical:', err?.message); }
  }

  return best;
}

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
  if (els.ocrCurrentPage) els.ocrCurrentPage.disabled = disabled;
  if (els.ocrRegionMode) els.ocrRegionMode.disabled = disabled;
  if (els.copyOcrText) els.copyOcrText.disabled = disabled;
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

// ─── OCR Execution ─────────────────────────────────────────────────────────

export async function runOcrOnRectNow(rect) {
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
      _deps.renderTextLayer(state.currentPage, state.zoom, state.rotation).catch(() => {});
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
    return '';
  }
}

// ─── Background OCR Scan ───────────────────────────────────────────────────

export function cancelBackgroundOcrScan(reason = 'manual') {
  state.backgroundOcrToken = 0;
  state.backgroundOcrRunning = false;
  if (state.backgroundOcrTimer) {
    clearTimeout(state.backgroundOcrTimer);
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

export function scheduleBackgroundOcrScan(reason = 'default', delayMs = 600) {
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
      terminateTesseractPool().catch(() => {});
    }
    releaseLock();
  }
}
