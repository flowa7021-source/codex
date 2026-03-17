// ─── Performance Metrics, Worker Pool, Page Cache, Object URL Registry ──────

// ─── Phase 0: Performance Metrics Collector (p95) ──────────────────────────
export const perfMetrics = {
  renderTimes: [],
  ocrTimes: [],
  searchTimes: [],
  pageLoadTimes: [],
  maxSamples: 200,
};

export function recordPerfMetric(category, ms) {
  const arr = perfMetrics[category];
  if (!arr) return;
  arr.push(ms);
  if (arr.length > perfMetrics.maxSamples) arr.shift();
}

export function computePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[idx];
}

export function getPerfSummary() {
  const summary = {};
  for (const key of ['renderTimes', 'ocrTimes', 'searchTimes', 'pageLoadTimes']) {
    const arr = perfMetrics[key];
    if (!arr.length) { summary[key] = null; continue; }
    summary[key] = {
      count: arr.length,
      min: Math.round(Math.min(...arr)),
      max: Math.round(Math.max(...arr)),
      median: Math.round(computePercentile(arr, 0.5)),
      p95: Math.round(computePercentile(arr, 0.95)),
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    };
  }
  return summary;
}

// ─── Phase 1: Web Worker Pool ──────────────────────────────────────────────
export const workerPool = {
  workers: [],
  maxWorkers: Math.min(4, (navigator.hardwareConcurrency || 2)),
  taskQueue: [],
  activeCount: 0,
};

export function createOcrWorkerBlob() {
  const code = `
    self.onmessage = function(e) {
      const { type, payload, taskId } = e.data;
      if (type === 'preprocess') {
        const { imageData, width, height, thresholdBias, mode, invert } = payload;
        const d = imageData.data;
        const hist = new Uint32Array(256);
        let mean = 0;
        for (let i = 0; i < d.length; i += 4) {
          const gray = (d[i] * 0.299) + (d[i+1] * 0.587) + (d[i+2] * 0.114);
          const g = Math.max(0, Math.min(255, Math.round(gray)));
          d[i] = d[i+1] = d[i+2] = g;
          hist[g] += 1;
          mean += g;
        }
        mean /= Math.max(1, d.length / 4);

        const totalPx = d.length / 4;
        let p5 = 0, p95 = 255, acc = 0;
        for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= totalPx * 0.05) { p5 = i; break; } }
        acc = 0;
        for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= totalPx * 0.95) { p95 = i; break; } }
        const spread = Math.max(1, p95 - p5);
        let sqSum = 0;
        for (let i = 0; i < d.length; i += 4) { sqSum += d[i] * d[i]; }
        const stdDev = Math.sqrt(Math.max(0, sqSum / totalPx - mean * mean));

        for (let i = 0; i < d.length; i += 4) {
          const stretched = ((d[i] - p5) * 255) / spread;
          const contrastBoost = stdDev < 36 ? 1.18 : 1.0;
          const centered = (stretched - 127) * contrastBoost + 127;
          d[i] = d[i+1] = d[i+2] = Math.max(0, Math.min(255, Math.round(centered)));
        }

        // Otsu threshold
        let otsu = 128;
        { let total = 0, sumTotal = 0;
          for (let i = 0; i < 256; i++) { total += hist[i]; sumTotal += i * hist[i]; }
          let sumBack = 0, wBack = 0, maxVar = 0;
          for (let t = 0; t < 256; t++) {
            wBack += hist[t]; if (wBack === 0) continue;
            const wFore = total - wBack; if (wFore === 0) break;
            sumBack += t * hist[t];
            const mBack = sumBack / wBack;
            const mFore = (sumTotal - sumBack) / wFore;
            const between = wBack * wFore * (mBack - mFore) * (mBack - mFore);
            if (between > maxVar) { maxVar = between; otsu = t; }
          }
        }

        const thresholdBase = mode === 'otsu' ? otsu : mean;
        const threshold = Math.max(50, Math.min(220, thresholdBase + (thresholdBias || 0)));
        for (let i = 0; i < d.length; i += 4) {
          let v = d[i] > threshold ? 255 : 0;
          if (invert) v = 255 - v;
          d[i] = d[i+1] = d[i+2] = v;
          d[i+3] = 255;
        }

        self.postMessage({ type: 'preprocess-done', taskId, imageData, width, height }, [imageData.data.buffer]);
      }

      if (type === 'search-text') {
        const { pages, query } = payload;
        const results = [];
        const norm = (query || '').trim().toLowerCase();
        if (norm) {
          for (let i = 0; i < pages.length; i++) {
            const text = (pages[i] || '').toLowerCase();
            const count = text.split(norm).length - 1;
            if (count > 0) results.push({ page: i + 1, count, snippet: text.substring(text.indexOf(norm), text.indexOf(norm) + 80) });
          }
        }
        self.postMessage({ type: 'search-done', taskId, results });
      }
    };
  `;
  return new Blob([code], { type: 'application/javascript' });
}

export function getPoolWorker() {
  if (workerPool.workers.length < workerPool.maxWorkers) {
    try {
      const blob = createOcrWorkerBlob();
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      // Revoke blob URL immediately — worker already loaded the code
      URL.revokeObjectURL(url);
      workerPool.workers.push(worker);
      return worker;
    } catch {
      return null;
    }
  }
  const idx = workerPool.activeCount % workerPool.workers.length;
  return workerPool.workers[idx] || null;
}

export function runInWorker(type, payload) {
  return new Promise((resolve, reject) => {
    const worker = getPoolWorker();
    if (!worker) { reject(new Error('Worker unavailable')); return; }
    const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    workerPool.activeCount++;
    const handler = (e) => {
      if (e.data.taskId !== taskId) return;
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errHandler);
      workerPool.activeCount--;
      resolve(e.data);
    };
    const errHandler = (err) => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errHandler);
      workerPool.activeCount--;
      reject(err);
    };
    worker.addEventListener('message', handler);
    worker.addEventListener('error', errHandler);
    worker.postMessage({ type, payload, taskId });
  });
}

// ─── Phase 1: Enhanced Memory Management ───────────────────────────────────
export const pageRenderCache = {
  entries: new Map(),
  maxEntries: 16,             // increased from 8 for large docs with frequent navigation
  maxTotalPixels: 64_000_000, // increased from 32M — safe with 4GB heap limit
  totalPixels: 0,
};

export function cacheRenderedPage(pageNum, canvas) {
  if (pageRenderCache.entries.has(pageNum)) return;
  const pixels = canvas.width * canvas.height;
  while (pageRenderCache.entries.size >= pageRenderCache.maxEntries ||
         pageRenderCache.totalPixels + pixels > pageRenderCache.maxTotalPixels) {
    const oldest = pageRenderCache.entries.keys().next().value;
    if (oldest === undefined) break;
    evictPageFromCache(oldest);
  }
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  // alpha:false — cached pages are always opaque; avoids compositing overhead on restore
  copy.getContext('2d', { alpha: false }).drawImage(canvas, 0, 0);
  pageRenderCache.entries.set(pageNum, { canvas: copy, pixels, ts: Date.now() });
  pageRenderCache.totalPixels += pixels;
}

export function getCachedPage(pageNum) {
  const entry = pageRenderCache.entries.get(pageNum);
  if (!entry) return null;
  pageRenderCache.entries.delete(pageNum);
  pageRenderCache.entries.set(pageNum, entry);
  entry.ts = Date.now();
  return entry.canvas;
}

export function evictPageFromCache(pageNum) {
  const entry = pageRenderCache.entries.get(pageNum);
  if (!entry) return;
  pageRenderCache.totalPixels -= entry.pixels;
  if (entry.canvas) { entry.canvas.width = 0; entry.canvas.height = 0; }
  pageRenderCache.entries.delete(pageNum);
}

export function clearPageRenderCache() {
  const keys = [...pageRenderCache.entries.keys()];
  for (const key of keys) {
    evictPageFromCache(key);
  }
}

export const objectUrlRegistry = new Set();

export function trackObjectUrl(url) {
  objectUrlRegistry.add(url);
}

export function revokeTrackedUrl(url) {
  if (objectUrlRegistry.has(url)) {
    URL.revokeObjectURL(url);
    objectUrlRegistry.delete(url);
  }
}

export function revokeAllTrackedUrls() {
  for (const url of objectUrlRegistry) {
    URL.revokeObjectURL(url);
  }
  objectUrlRegistry.clear();
}
