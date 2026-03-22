// ─── Unit Tests: Performance Module ─────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  perfMetrics,
  recordPerfMetric,
  computePercentile,
  getPerfSummary,
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

// ─── computePercentile ──────────────────────────────────────────────────────

describe('computePercentile', () => {
  it('returns 0 for empty array', () => {
    assert.equal(computePercentile([], 0.5), 0);
  });

  it('returns the single value for array of length 1', () => {
    assert.equal(computePercentile([42], 0.5), 42);
    assert.equal(computePercentile([42], 0.95), 42);
  });

  it('computes median (p50) of even-length array', () => {
    const result = computePercentile([10, 20, 30, 40], 0.5);
    assert.equal(result, 20);
  });

  it('computes p95 of a larger array', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1); // [1..100]
    const result = computePercentile(arr, 0.95);
    assert.equal(result, 95);
  });

  it('does not mutate input array', () => {
    const arr = [30, 10, 20];
    computePercentile(arr, 0.5);
    assert.deepEqual(arr, [30, 10, 20]);
  });

  it('handles p=0 (returns minimum)', () => {
    const arr = [5, 1, 3];
    const result = computePercentile(arr, 0);
    assert.equal(result, 1);
  });

  it('handles p=1 (returns maximum)', () => {
    const arr = [5, 1, 3];
    const result = computePercentile(arr, 1);
    assert.equal(result, 5);
  });
});

// ─── recordPerfMetric ───────────────────────────────────────────────────────

describe('recordPerfMetric', () => {
  beforeEach(() => {
    perfMetrics.renderTimes.length = 0;
    perfMetrics.ocrTimes.length = 0;
    perfMetrics.searchTimes.length = 0;
    perfMetrics.pageLoadTimes.length = 0;
  });

  it('records a metric into the correct category', () => {
    recordPerfMetric('renderTimes', 100);
    assert.equal(perfMetrics.renderTimes.length, 1);
    assert.equal(perfMetrics.renderTimes[0], 100);
  });

  it('records multiple metrics', () => {
    recordPerfMetric('ocrTimes', 50);
    recordPerfMetric('ocrTimes', 75);
    recordPerfMetric('ocrTimes', 100);
    assert.equal(perfMetrics.ocrTimes.length, 3);
  });

  it('trims to maxSamples when exceeded', () => {
    const max = perfMetrics.maxSamples;
    for (let i = 0; i < max + 10; i++) {
      recordPerfMetric('searchTimes', i);
    }
    assert.equal(perfMetrics.searchTimes.length, max);
    // oldest entries should have been shifted off
    assert.equal(perfMetrics.searchTimes[0], 10);
  });

  it('ignores unknown categories', () => {
    assert.doesNotThrow(() => recordPerfMetric('nonExistent', 100));
  });
});

// ─── getPerfSummary ─────────────────────────────────────────────────────────

describe('getPerfSummary', () => {
  beforeEach(() => {
    perfMetrics.renderTimes.length = 0;
    perfMetrics.ocrTimes.length = 0;
    perfMetrics.searchTimes.length = 0;
    perfMetrics.pageLoadTimes.length = 0;
  });

  it('returns null for empty categories', () => {
    const summary = getPerfSummary();
    assert.equal(summary.renderTimes, null);
    assert.equal(summary.ocrTimes, null);
  });

  it('returns summary with count, min, max, median, p95, avg', () => {
    recordPerfMetric('renderTimes', 10);
    recordPerfMetric('renderTimes', 20);
    recordPerfMetric('renderTimes', 30);
    const summary = getPerfSummary();
    const rt = summary.renderTimes;
    assert.ok(rt);
    assert.equal(rt.count, 3);
    assert.equal(rt.min, 10);
    assert.equal(rt.max, 30);
    assert.equal(rt.avg, 20);
    assert.equal(typeof rt.median, 'number');
    assert.equal(typeof rt.p95, 'number');
  });
});

// ─── pageRenderCache ────────────────────────────────────────────────────────

describe('getCachedPage / cacheRenderedPage / clearPageRenderCache', () => {
  beforeEach(() => {
    clearPageRenderCache();
  });

  it('returns null for uncached page', () => {
    assert.equal(getCachedPage(999), null);
  });

  it('caches and retrieves a page', () => {
    const fakeCanvas = document.createElement('canvas');
    fakeCanvas.width = 100;
    fakeCanvas.height = 100;
    fakeCanvas.style = { width: '100px', height: '100px' };
    cacheRenderedPage(1, fakeCanvas, 1.0, 0);
    const entry = getCachedPage(1);
    assert.ok(entry, 'cached entry should exist');
    assert.equal(entry.zoom, 1.0);
    assert.equal(entry.rotation, 0);
  });

  it('evictPageFromCache removes a specific page', () => {
    const fakeCanvas = document.createElement('canvas');
    fakeCanvas.width = 50;
    fakeCanvas.height = 50;
    fakeCanvas.style = { width: '50px', height: '50px' };
    cacheRenderedPage(5, fakeCanvas, 1.5, 90);
    assert.ok(getCachedPage(5));
    evictPageFromCache(5);
    assert.equal(getCachedPage(5), null);
  });

  it('clearPageRenderCache removes all entries', () => {
    const fakeCanvas = document.createElement('canvas');
    fakeCanvas.width = 10;
    fakeCanvas.height = 10;
    fakeCanvas.style = { width: '10px', height: '10px' };
    cacheRenderedPage(1, fakeCanvas, 1, 0);
    cacheRenderedPage(2, fakeCanvas, 1, 0);
    clearPageRenderCache();
    assert.equal(pageRenderCache.entries.size, 0);
    assert.equal(pageRenderCache.totalPixels, 0);
  });

  it('LRU eviction: removes oldest when maxEntries exceeded', () => {
    const origMax = pageRenderCache.maxEntries;
    pageRenderCache.maxEntries = 3;
    try {
      for (let i = 1; i <= 4; i++) {
        const c = document.createElement('canvas');
        c.width = 10;
        c.height = 10;
        c.style = { width: '10px', height: '10px' };
        cacheRenderedPage(i, c, 1, 0);
      }
      // Page 1 should have been evicted
      assert.equal(getCachedPage(1), null);
      assert.ok(getCachedPage(2));
    } finally {
      pageRenderCache.maxEntries = origMax;
      clearPageRenderCache();
    }
  });

  it('getCachedPage updates LRU position', () => {
    const origMax = pageRenderCache.maxEntries;
    pageRenderCache.maxEntries = 3;
    try {
      for (let i = 1; i <= 3; i++) {
        const c = document.createElement('canvas');
        c.width = 10;
        c.height = 10;
        c.style = { width: '10px', height: '10px' };
        cacheRenderedPage(i, c, 1, 0);
      }
      // Access page 1 to move it to end (most recently used)
      getCachedPage(1);
      // Now add page 4 — should evict page 2 (oldest after 1 was refreshed)
      const c4 = document.createElement('canvas');
      c4.width = 10;
      c4.height = 10;
      c4.style = { width: '10px', height: '10px' };
      cacheRenderedPage(4, c4, 1, 0);
      assert.equal(getCachedPage(2), null, 'page 2 should be evicted');
      assert.ok(getCachedPage(1), 'page 1 should still be cached');
    } finally {
      pageRenderCache.maxEntries = origMax;
      clearPageRenderCache();
    }
  });
});

// ─── objectUrlRegistry ──────────────────────────────────────────────────────

describe('objectUrlRegistry', () => {
  beforeEach(() => {
    objectUrlRegistry.clear();
  });

  it('trackObjectUrl adds URL to registry', () => {
    trackObjectUrl('blob:mock-1');
    assert.equal(objectUrlRegistry.size, 1);
    assert.ok(objectUrlRegistry.has('blob:mock-1'));
  });

  it('revokeTrackedUrl removes a tracked URL', () => {
    trackObjectUrl('blob:mock-2');
    revokeTrackedUrl('blob:mock-2');
    assert.equal(objectUrlRegistry.size, 0);
  });

  it('revokeTrackedUrl is safe for untracked URL', () => {
    assert.doesNotThrow(() => revokeTrackedUrl('blob:not-tracked'));
    assert.equal(objectUrlRegistry.size, 0);
  });

  it('revokeAllTrackedUrls clears all tracked URLs', () => {
    trackObjectUrl('blob:a');
    trackObjectUrl('blob:b');
    trackObjectUrl('blob:c');
    assert.equal(objectUrlRegistry.size, 3);
    revokeAllTrackedUrls();
    assert.equal(objectUrlRegistry.size, 0);
  });
});
