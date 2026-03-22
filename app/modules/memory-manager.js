// @ts-check
// ─── Memory Manager ─────────────────────────────────────────────────────────
// ObjectURL lifecycle, canvas pooling, memory pressure monitoring.

import { safeInterval, safeTimeout, clearSafeInterval, clearSafeTimeout } from './safe-timers.js';

const CANVAS_POOL_MAX = 10;
const URL_CLEANUP_INTERVAL = 30000;
const MEMORY_WARNING_MB = 500;

/** @type {Set<string>} Tracked object URLs */
const trackedUrls = new Set();
/** @type {HTMLCanvasElement[]} Reusable canvas pool */
const canvasPool = [];
/** @type {Map<string, {url: string, createdAt: number, context: string}>} */
const urlRegistry = new Map();

let cleanupTimer = null;
let memoryWarningShown = false;
let monitorTimer = null;

/**
 * Initialize memory management: URL tracking, canvas pooling, memory monitoring.
 */
export function initMemoryManager() {
  // Periodic cleanup of stale URLs
  if (cleanupTimer) clearSafeInterval(cleanupTimer);
  cleanupTimer = safeInterval(cleanupStaleUrls, URL_CLEANUP_INTERVAL, { scope: 'app' });

  // Memory pressure monitoring (if available)
  if (typeof performance !== 'undefined' && /** @type {any} */ (performance).measureUserAgentSpecificMemory) {
    monitorMemory();
  }
}

/**
 * Create a tracked Object URL. Will be cleaned up automatically.
 * @param {Blob|MediaSource} source
 * @param {string} [context='unknown'] - Description for debugging
 * @returns {string} Object URL
 */
export function createTrackedUrl(source, context = 'unknown') {
  const url = URL.createObjectURL(source);
  trackedUrls.add(url);
  urlRegistry.set(url, {
    url,
    createdAt: Date.now(),
    context,
  });
  return url;
}

/**
 * Revoke a tracked Object URL.
 * @param {string} url
 */
export function revokeTrackedUrl(url) {
  if (trackedUrls.has(url)) {
    URL.revokeObjectURL(url);
    trackedUrls.delete(url);
    urlRegistry.delete(url);
  }
}

/**
 * Revoke all tracked Object URLs.
 */
export function revokeAllUrls() {
  for (const url of trackedUrls) {
    URL.revokeObjectURL(url);
  }
  trackedUrls.clear();
  urlRegistry.clear();
}

/**
 * Clean up URLs older than a threshold.
 * @param {number} [maxAgeMs=300000] - 5 minutes default
 */
export function cleanupStaleUrls(maxAgeMs = 300000) {
  const now = Date.now();
  for (const [url, info] of urlRegistry) {
    if (now - info.createdAt > maxAgeMs) {
      URL.revokeObjectURL(url);
      trackedUrls.delete(url);
      urlRegistry.delete(url);
    }
  }
}

/**
 * Get a canvas from the pool or create a new one.
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function acquireCanvas(width, height) {
  let canvas = canvasPool.pop();
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Return a canvas to the pool for reuse.
 * @param {HTMLCanvasElement} canvas
 */
export function releaseCanvas(canvas) {
  if (!canvas) return;

  // Clear the canvas
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reset to 1x1 to free GPU memory
  canvas.width = 1;
  canvas.height = 1;

  if (canvasPool.length < CANVAS_POOL_MAX) {
    canvasPool.push(canvas);
  }
}

/**
 * Get memory usage statistics.
 * @returns {object}
 */
export function getMemoryStats() {
  const stats = {
    trackedUrls: trackedUrls.size,
    canvasPoolSize: canvasPool.length,
    urlDetails: [...urlRegistry.values()].map(u => ({
      context: u.context,
      age: Math.round((Date.now() - u.createdAt) / 1000),
    })),
  };

  // JS heap info (Chrome only)
  if (/** @type {any} */ (performance).memory) {
    stats.jsHeapUsed = Math.round(/** @type {any} */ (performance).memory.usedJSHeapSize / 1048576);
    stats.jsHeapTotal = Math.round(/** @type {any} */ (performance).memory.totalJSHeapSize / 1048576);
    stats.jsHeapLimit = Math.round(/** @type {any} */ (performance).memory.jsHeapSizeLimit / 1048576);
  }

  return stats;
}

/**
 * Force garbage collection by clearing all caches and pools.
 */
export function forceCleanup() {
  revokeAllUrls();
  canvasPool.length = 0;
  memoryWarningShown = false;
}

/**
 * Monitor memory usage and warn if approaching limits.
 */
async function monitorMemory() {
  try {
    if (/** @type {any} */ (performance).memory) {
      const usedMB = /** @type {any} */ (performance).memory.usedJSHeapSize / 1048576;
      if (usedMB > MEMORY_WARNING_MB && !memoryWarningShown) {
        memoryWarningShown = true;
        window.dispatchEvent(new CustomEvent('memory-warning', {
          detail: { usedMB: Math.round(usedMB) },
        }));
      }
    }
  } catch (err) {
    console.warn('[memory-manager] monitorMemory error:', err?.message);
  }

  // Check periodically — tracked so destroyMemoryManager() can stop it
  monitorTimer = safeTimeout(monitorMemory, 10000, { scope: 'app' });
}

/**
 * Destroy the memory manager (cleanup timers).
 */
export function destroyMemoryManager() {
  if (cleanupTimer) {
    clearSafeInterval(cleanupTimer);
    cleanupTimer = null;
  }
  if (monitorTimer) {
    clearSafeTimeout(monitorTimer);
    monitorTimer = null;
  }
  revokeAllUrls();
  canvasPool.length = 0;
}
