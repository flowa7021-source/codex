// ─── OCR Controller ─────────────────────────────────────────────────────────
// OCR confidence scoring, text normalization, preprocessing pipeline,
// manual/background OCR scheduling, and batch OCR queue management.
// Extracted from app.js as part of module decomposition.

import { state, els } from './state.js';
import { OCR_MAX_SIDE_PX, OCR_MAX_PIXELS, OCR_SLOW_TASK_WARN_MS, OCR_HANG_WARN_MS, OCR_SOURCE_MAX_PIXELS, OCR_SOURCE_CACHE_MAX_PIXELS, OCR_SOURCE_CACHE_TTL_MS } from './constants.js';
import { yieldToMainThread } from './utils.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { recordPerfMetric } from './perf.js';
import { recordCrashEvent, recordSuccessfulOperation } from './crash-telemetry.js';
import { ToolMode, toolStateMachine } from './tool-modes.js';
import { postCorrectByLanguage, scoreTextByLanguage, detectLanguage } from './ocr-languages.js';
import { getOcrLang, getOcrScale } from './settings-controller.js';
import { preprocessForOcr } from './ocr-preprocess.js';
import { analyzeTextDensity, computeOcrZoom, hasSmallText } from './ocr-adaptive-dpi.js';
import { getPageQualitySummary } from './ocr-word-confidence.js';
import { initTesseract, recognizeTesseract, isTesseractAvailable, getTesseractStatus, initTesseractPool, recognizeWithPool, terminateTesseractPool, isTesseractPoolReady, getRecommendedPoolSize } from './tesseract-adapter.js';
import { indexOcrPage } from './search-controller.js';
import { loadOcrTextData, saveOcrTextData } from './workspace-controller.js';
import { savePageOcrText, getPageOcrText } from './ocr-storage.js';
import { toastSuccess } from './toast.js';
import { AsyncLock } from './async-lock.js';

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

// ─── Cyrillic/Latin Confusables ─────────────────────────────────────────────

export function getConfusableLatinToCyrillicMap() {
  return {
    A: 'А', a: 'а', B: 'В', E: 'Е', e: 'е', K: 'К', k: 'к', M: 'М', m: 'м',
    H: 'Н', h: 'н', O: 'О', o: 'о', P: 'Р', p: 'р', C: 'С', c: 'с', T: 'Т',
    t: 'т', X: 'Х', x: 'х', y: 'у', Y: 'У', r: 'г', n: 'п', N: 'П',
    i: 'і', I: 'І', l: 'ӏ', V: 'Ѵ', v: 'ѵ', S: 'Ѕ', s: 'ѕ',
  };
}

export function convertLatinLookalikesToCyrillic(input) {
  const map = getConfusableLatinToCyrillicMap();
  return String(input || '').replace(/[A-Za-z]/g, (ch) => map[ch] || ch);
}

export function hasMixedCyrillicLatinToken(text) {
  return /(?=.*[A-Za-z])(?=.*[А-Яа-яЁё])[A-Za-zА-Яа-яЁё]{2,}/.test(text || '');
}

// ─── Image Processing Helpers ───────────────────────────────────────────────

export function computeOtsuThreshold(data) {
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

export function countHistogramPercentile(hist, percentile, total) {
  const target = total * percentile;
  let acc = 0;
  for (let i = 0; i < hist.length; i += 1) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return hist.length - 1;
}

export function scoreCyrillicWordQuality(text) {
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

export function scoreRussianBigrams(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^а-яё\s]/g, ' ');
  const pairs = ['ст', 'но', 'ен', 'то', 'на', 'ов', 'ни', 'ра', 'ко', 'ал', 'пр', 'ро', 'во', 'по', 'ре', 'ос', 'от', 'та', 'го'];
  let score = 0;
  for (const pair of pairs) {
    const hits = normalized.split(pair).length - 1;
    score += Math.min(5, hits);
  }
  return score;
}

export function scoreEnglishBigrams(text) {
  const normalized = String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ');
  const pairs = ['th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it'];
  let score = 0;
  for (const pair of pairs) {
    const hits = normalized.split(pair).length - 1;
    score += Math.min(5, hits);
  }
  return score;
}

export function medianDenoiseMonochrome(imageData) {
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

export function morphologyCloseMonochrome(imageData) {
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

export function estimateSkewAngleFromBinary(imageData) {
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

  // Coarse pass: -15 to +15 in 1 increments
  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let deg = -15; deg <= 15; deg += 1) {
    const variance = projectionVariance(deg);
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = deg;
    }
  }

  // Fine pass: +/-1.5 around best in 0.25 increments
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

export function rotateCanvas(source, angleDeg) {
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

// ─── OCR Source Cache ───────────────────────────────────────────────────────

export function clearOcrRuntimeCaches(reason = 'manual') {
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

export function getOcrSourceCacheKey(pageNumber) {
  const mode = state.settings?.ocrQualityMode === 'accurate' ? 'accurate' : 'balanced';
  const rotation = Number(state.rotation || 0);
  const doc = state.docName || 'global';
  const adapterType = state.adapter?.type || 'unknown';
  return `${doc}|${adapterType}|${pageNumber}|${rotation}|${mode}`;
}

export function updateOcrSourceCache(key, canvas) {
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

export function constrainOcrSourceCanvasPixels(canvas, maxPixels = OCR_SOURCE_MAX_PIXELS) {
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

export function getFreshOcrSourceCacheEntry(cacheKey) {
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

export async function buildOcrSourceCanvas(pageNumber) {
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
  } catch (err) { console.warn('[app] adaptive zoom fallback:', err?.message); }
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

export async function estimatePageSkewAngle(pageNumber) {
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
    } catch (err) {
      state.pageSkewAngles[pageNumber] = 0;
      return 0;
    } finally {
      delete state.pageSkewPromises[pageNumber];
    }
  })();

  return state.pageSkewPromises[pageNumber];
}

export function cropCanvasByRelativeRect(sourceCanvas, relativeRect) {
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

// ─── OCR Preprocessing Pipeline ────────────────────────────────────────────

export function preprocessOcrCanvas(inputCanvas, thresholdBias = 0, mode = 'mean', invert = false, extraScale = 1) {
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
    } catch (err) { console.warn('[app] render pipeline fallback:', err?.message); }
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

export function pickVariantsByBudget(variants, maxCount) {
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
