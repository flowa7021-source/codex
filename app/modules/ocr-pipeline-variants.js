// @ts-check
// ─── OCR Pipeline Variants Sub-module ────────────────────────────────────────
// Variant generation, preprocessing pipeline, recognition loop, and
// the main runOcrOnPreparedCanvas function.
// Split from ocr-controller.js for maintainability.

import { state } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { yieldToMainThread } from './utils.js';
import { getOcrLang } from './settings-controller.js';
import { detectLanguage } from './ocr-languages.js';
import { initTesseract, recognizeTesseract, isTesseractAvailable, getTesseractStatus, recognizeWithPool, isTesseractPoolReady } from './tesseract-adapter.js';
import { loadOcrTextData, saveOcrTextData } from './workspace-controller.js';
import {
  estimateSkewAngleFromBinary, rotateCanvas,
  preprocessOcrCanvas, pickVariantsByBudget,
} from './ocr-image-processing.js';
import { ocrWithCharBoxes } from './ocr-char-layer.js';
// ─── Late-bound dependencies ────────────────────────────────────────────────
// normalizeOcrTextByLang, scoreOcrTextByLang, postCorrectOcrText, setOcrStatus
// are injected from app.js via initOcrPipelineVariantsDeps to avoid circular
// import with ocr-controller.js.
const _deps = {
  _ocrWordCache: new Map(),
  normalizeOcrTextByLang: /** @type {(text: string, lang: string) => string} */ (t) => t,
  scoreOcrTextByLang: /** @type {(text: string, lang: string) => number} */ () => 0,
  postCorrectOcrText: /** @type {(text: string, lang: string) => string} */ (t) => t,
  setOcrStatus: /** @type {(text: string) => void} */ () => {},
};

export function initOcrPipelineVariantsDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── OCR Recognition Pipeline ──────────────────────────────────────────────

export async function runOcrOnPreparedCanvas(canvas, options = {}) {
  // Guard: canvas must have valid dimensions for OCR pipeline
  if (!canvas || !canvas.width || !canvas.height) {
    return '';
  }
  try { performance.mark('ocr-start'); } catch (_e) { /* Performance API unavailable */ }
  const startedAt = performance.now();
  const fast = !!options.fast;
  const preferredSkew = Number(options.preferredSkew || 0);
  const taskId = Number(options.taskId || 0);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  // Snapshot settings at pipeline start to prevent race conditions if user
  // changes language or quality mode mid-pipeline
  const pipelineLang = getOcrLang();
  const pipelineQualityMode = state.settings?.ocrQualityMode || 'balanced';
  const _pipelineCyrillicOnly = !!state.settings?.ocrCyrillicOnly;

  // Early exit: check Tesseract availability BEFORE spending time on preprocessing
  const lang = pipelineLang;
  const tesseractAvail = await isTesseractAvailable();
  if (tesseractAvail) {
    const initOk = await initTesseract(lang === 'auto' ? 'auto' : lang);
    const tessStatus = getTesseractStatus();
    pushDiagnosticEvent('ocr.tesseract.init', { available: true, initialized: initOk, lang, failCount: /** @type {any} */ (tessStatus).initFailCount, lastError: /** @type {any} */ (tessStatus).lastError || undefined });
    if (!initOk) {
      pushDiagnosticEvent('ocr.pipeline.skip', { reason: 'tesseract-init-failed', lang, ms: Math.round(performance.now() - startedAt), lastError: /** @type {any} */ (tessStatus).lastError || undefined });
      _deps.setOcrStatus(`OCR: ошибка инициализации движка (попытка ${/** @type {any} */ (tessStatus).initFailCount}/3)`);
      return '';
    }
  } else {
    pushDiagnosticEvent('ocr.tesseract.init', { available: false, initialized: false, lang }, 'error');
    pushDiagnosticEvent('ocr.pipeline.skip', { reason: 'tesseract-unavailable', lang, ms: Math.round(performance.now() - startedAt) });
    _deps.setOcrStatus('OCR: движок Tesseract недоступен');
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
    const probeCtx = probe.getContext('2d');
    if (probeCtx) {
      const probeImg = probeCtx.getImageData(0, 0, probe.width, probe.height);
      const skew = estimateSkewAngleFromBinary(probeImg);
      skewProbeDeg = Number(skew.toFixed(2));
      if (Math.abs(skew) >= 0.35) {
        skewToApply = skew;
      }
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
  try {
    performance.mark('ocr-preprocess-done');
    performance.measure('ocr-preprocess', 'ocr-start', 'ocr-preprocess-done');
  } catch (_e) { /* Performance API unavailable */ }

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
      const candidate = _deps.normalizeOcrTextByLang(rawText, effectiveLang);
      const score = _deps.scoreOcrTextByLang(candidate, effectiveLang);
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
  if (bestVariantW <= 0 || bestVariantH <= 0) {
    bestWords = [];
  }
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
  try {
    performance.mark('ocr-recognize-done');
    performance.measure('ocr-recognize', 'ocr-preprocess-done', 'ocr-recognize-done');
  } catch (_e) { /* Performance API unavailable */ }
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
  best = _deps.postCorrectOcrText(best, detectedLang);

  // Optionally enrich with character-level bounding boxes
  if (options.charBoxes && best.length > 0 && canvas.width > 0) {
    try {
      const charResult = await ocrWithCharBoxes(canvas, {
        lang: detectedLang || lang,
        deskew: false,  // already deskewed in pipeline
        denoise: false, // already preprocessed
        upscale: false,
      });
      if (charResult?.charBoxes?.length) {
        // Store char boxes alongside word data
        if (options.pageNum && _deps._ocrWordCache) {
          _deps._ocrWordCache.set(`charboxes_${options.pageNum}`, charResult.charBoxes);
        }
      }
    } catch (_err) {
      // Non-critical enrichment; word-level data is already available
      console.debug('[ocr-pipeline] char-box enrichment skipped:', _err?.message);
    }
  }

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

  try {
    performance.mark('ocr-end');
    performance.measure('ocr-total', 'ocr-start', 'ocr-end');
  } catch (_e) { /* Performance API unavailable */ }

  return best;
}
