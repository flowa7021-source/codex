// ─── Extended Unit Tests: Performance Module ────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  perfMetrics,
  recordPerfMetric,
  computePercentile,
  getPerfSummary,
  workerPool,
  createOcrWorkerBlob,
  getPoolWorker,
  pageRenderCache,
  getCachedPage,
  cacheRenderedPage,
  evictPageFromCache,
  clearPageRenderCache,
  objectUrlRegistry,
  trackObjectUrl,
  revokeTrackedUrl,
  revokeAllTrackedUrls,
} from '../../app/modules/perf.js';

// ─── workerPool ──────────────────────────────────────────────────────────────

describe('workerPool defaults', () => {
  it('has a maxWorkers property', () => {
    assert.ok(typeof workerPool.maxWorkers === 'number');
    assert.ok(workerPool.maxWorkers >= 1);
  });

  it('starts with empty workers and taskQueue', () => {
    assert.ok(Array.isArray(workerPool.workers));
    assert.ok(Array.isArray(workerPool.taskQueue));
    assert.equal(workerPool.activeCount, 0);
  });
});

// ─── createOcrWorkerBlob ────────────────────────────────────────────────────

describe('createOcrWorkerBlob', () => {
  it('returns a Blob', () => {
    const blob = createOcrWorkerBlob();
    assert.ok(blob instanceof Blob);
  });
});

// ─── getPoolWorker ──────────────────────────────────────────────────────────

describe('getPoolWorker', () => {
  it('returns null when Worker is not available', () => {
    // In the test env, Worker class is unavailable so getPoolWorker catches the error
    const origWorker = globalThis.Worker;
    delete globalThis.Worker;
    // Reset pool so it tries to create a new worker
    const origWorkers = workerPool.workers;
    workerPool.workers = [];
    try {
      const w = getPoolWorker();
      assert.equal(w, null);
    } finally {
      workerPool.workers = origWorkers;
      if (origWorker) globalThis.Worker = origWorker;
    }
  });

  it('returns an existing worker via round-robin when pool is full', () => {
    const fakeWorker = { postMessage() {}, addEventListener() {}, removeEventListener() {} };
    const origWorkers = workerPool.workers;
    const origMax = workerPool.maxWorkers;
    workerPool.workers = [fakeWorker];
    workerPool.maxWorkers = 1;
    try {
      const w = getPoolWorker();
      assert.equal(w, fakeWorker);
    } finally {
      workerPool.workers = origWorkers;
      workerPool.maxWorkers = origMax;
    }
  });
});

// ─── cacheRenderedPage with pixel eviction ──────────────────────────────────

describe('cacheRenderedPage pixel eviction', () => {
  beforeEach(() => {
    clearPageRenderCache();
  });

  it('evicts pages when totalPixels exceeds maxTotalPixels', () => {
    const origMaxPixels = pageRenderCache.maxTotalPixels;
    const origMaxEntries = pageRenderCache.maxEntries;
    pageRenderCache.maxTotalPixels = 200;
    pageRenderCache.maxEntries = 100;
    try {
      const c1 = document.createElement('canvas');
      c1.width = 10; c1.height = 10; c1.style = { width: '10px', height: '10px' };
      cacheRenderedPage(1, c1, 1, 0);
      assert.equal(pageRenderCache.totalPixels, 100);

      const c2 = document.createElement('canvas');
      c2.width = 10; c2.height = 10; c2.style = { width: '10px', height: '10px' };
      cacheRenderedPage(2, c2, 1, 0);
      assert.equal(pageRenderCache.totalPixels, 200);

      // Adding a 3rd canvas of 100 pixels should evict page 1
      const c3 = document.createElement('canvas');
      c3.width = 10; c3.height = 10; c3.style = { width: '10px', height: '10px' };
      cacheRenderedPage(3, c3, 1, 0);
      assert.equal(getCachedPage(1), null);
      assert.ok(getCachedPage(3));
    } finally {
      pageRenderCache.maxTotalPixels = origMaxPixels;
      pageRenderCache.maxEntries = origMaxEntries;
      clearPageRenderCache();
    }
  });

  it('replaces existing entry when caching same page again', () => {
    const c1 = document.createElement('canvas');
    c1.width = 10; c1.height = 10; c1.style = { width: '10px', height: '10px' };
    cacheRenderedPage(1, c1, 1.0, 0);
    assert.equal(pageRenderCache.totalPixels, 100);

    // Cache same page with different zoom
    const c2 = document.createElement('canvas');
    c2.width = 20; c2.height = 20; c2.style = { width: '20px', height: '20px' };
    cacheRenderedPage(1, c2, 2.0, 0);

    const entry = getCachedPage(1);
    assert.ok(entry);
    assert.equal(entry.zoom, 2.0);
    assert.equal(pageRenderCache.totalPixels, 400);
  });
});

// ─── evictPageFromCache edge case ───────────────────────────────────────────

describe('evictPageFromCache edge cases', () => {
  beforeEach(() => clearPageRenderCache());

  it('does nothing for non-existent page', () => {
    assert.doesNotThrow(() => evictPageFromCache(999));
    assert.equal(pageRenderCache.entries.size, 0);
  });
});

// ─── getPerfSummary edge case ───────────────────────────────────────────────

describe('getPerfSummary edge cases', () => {
  beforeEach(() => {
    perfMetrics.renderTimes.length = 0;
    perfMetrics.ocrTimes.length = 0;
    perfMetrics.searchTimes.length = 0;
    perfMetrics.pageLoadTimes.length = 0;
  });

  it('computes correct avg with single entry', () => {
    recordPerfMetric('renderTimes', 42);
    const summary = getPerfSummary();
    assert.equal(summary.renderTimes.avg, 42);
    assert.equal(summary.renderTimes.min, 42);
    assert.equal(summary.renderTimes.max, 42);
    assert.equal(summary.renderTimes.count, 1);
  });
});
