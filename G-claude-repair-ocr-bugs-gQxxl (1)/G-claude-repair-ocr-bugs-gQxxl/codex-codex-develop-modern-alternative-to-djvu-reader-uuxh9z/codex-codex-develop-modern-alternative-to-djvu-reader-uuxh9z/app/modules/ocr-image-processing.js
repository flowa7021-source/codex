// ─── OCR Image Processing & Caching ─── Extracted from ocr-controller.js

import { state } from './state.js';
import { OCR_MAX_SIDE_PX, OCR_MAX_PIXELS, OCR_SOURCE_MAX_PIXELS, OCR_SOURCE_CACHE_MAX_PIXELS, OCR_SOURCE_CACHE_TTL_MS } from './constants.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { getOcrScale } from './settings-controller.js';
import { preprocessForOcr } from './ocr-preprocess.js';
import { analyzeTextDensity, computeOcrZoom, hasSmallText } from './ocr-adaptive-dpi.js';

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
      console.warn('[ocr] error:', err?.message);
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
