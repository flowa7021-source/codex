// ─── Memory Pressure API ─────────────────────────────────────────────────────
// Monitors available memory and adapts cache sizes accordingly.
// Uses navigator.deviceMemory, performance.memory (Chrome), and the
// Memory Pressure API (Chrome 126+) with polling fallback.

// @ts-check

// ─── Type declarations for non-standard APIs ────────────────────────────────

declare global {
  interface Navigator {
    deviceMemory?: number;
    onmemorywarning?: ((event: Event) => void) | null;
  }
  // Chrome 126+ Memory Pressure Observer
  const MemoryPressureObserver: {
    new(callback: (entries: Array<{ pressure: string }>) => void): {
      observe(options?: { type?: string }): void;
      unobserve(): void;
      disconnect(): void;
    };
  } | undefined;
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MemoryInfo {
  deviceMemoryGb: number;        // navigator.deviceMemory or estimated
  usedJsHeapMb: number | null;   // performance.memory?.usedJSHeapSize / 1MB
  totalJsHeapMb: number | null;
  pressure: 'nominal' | 'fair' | 'serious' | 'critical';
}

export interface CacheLimits {
  maxRenderCachePages: number;    // how many rendered pages to cache
  maxThumbnailCachePages: number; // how many thumbnails to cache
  maxCanvasPoolSize: number;      // max canvas pool entries
  maxMemoryMb: number;            // overall memory budget MB
}

// ─── Internal state ──────────────────────────────────────────────────────────

let _currentPressure: MemoryInfo['pressure'] = 'nominal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read device memory in GB from navigator.deviceMemory (rounded to nearest
 * power of two by browsers: 0.25, 0.5, 1, 2, 4, 8).
 * Returns 4 as a safe default when the API is not available.
 */
function _getDeviceMemoryGb(): number {
  const dm = (typeof navigator !== 'undefined') ? navigator.deviceMemory : undefined;
  if (typeof dm === 'number' && dm > 0) return dm;
  return 4; // safe default
}

/**
 * Derive a pressure level from heap usage ratio.
 * Only used when no native pressure API is available.
 */
function _pressureFromHeap(): MemoryInfo['pressure'] {
  if (typeof performance === 'undefined' || !(performance as any).memory) {
    return 'nominal';
  }
  const mem = (performance as any).memory as { usedJSHeapSize: number; jsHeapSizeLimit: number };
  if (!mem.jsHeapSizeLimit || mem.jsHeapSizeLimit === 0) return 'nominal';
  const ratio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
  if (ratio >= 0.9) return 'critical';
  if (ratio >= 0.75) return 'serious';
  if (ratio >= 0.5) return 'fair';
  return 'nominal';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Synchronously reads available memory information.
 */
export function getMemoryInfo(): MemoryInfo {
  const deviceMemoryGb = _getDeviceMemoryGb();

  let usedJsHeapMb: number | null = null;
  let totalJsHeapMb: number | null = null;

  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory as {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
    };
    usedJsHeapMb = mem.usedJSHeapSize / (1024 * 1024);
    totalJsHeapMb = mem.totalJSHeapSize / (1024 * 1024);
  }

  const pressure: MemoryInfo['pressure'] = _currentPressure !== 'nominal'
    ? _currentPressure
    : _pressureFromHeap();

  return { deviceMemoryGb, usedJsHeapMb, totalJsHeapMb, pressure };
}

/**
 * Returns adaptive cache limits based on current memory state.
 *
 * Base limits by device memory tier:
 *   >= 8 GB → max  (50 render, 100 thumbnails, 20 canvas, 512 MB)
 *   >= 4 GB → med  (30 render,  60 thumbnails, 12 canvas, 256 MB)
 *   >= 2 GB → low  (20 render,  40 thumbnails,  8 canvas, 128 MB)
 *   < 2 GB  → min  (10 render,  20 thumbnails,  4 canvas,  64 MB)
 *
 * If pressure is 'serious' or 'critical', all limits are halved.
 */
export function getCacheLimits(): CacheLimits {
  const { deviceMemoryGb, pressure } = getMemoryInfo();

  let maxRenderCachePages: number;
  let maxThumbnailCachePages: number;
  let maxCanvasPoolSize: number;
  let maxMemoryMb: number;

  if (deviceMemoryGb >= 8) {
    maxRenderCachePages = 50;
    maxThumbnailCachePages = 100;
    maxCanvasPoolSize = 20;
    maxMemoryMb = 512;
  } else if (deviceMemoryGb >= 4) {
    maxRenderCachePages = 30;
    maxThumbnailCachePages = 60;
    maxCanvasPoolSize = 12;
    maxMemoryMb = 256;
  } else if (deviceMemoryGb >= 2) {
    maxRenderCachePages = 20;
    maxThumbnailCachePages = 40;
    maxCanvasPoolSize = 8;
    maxMemoryMb = 128;
  } else {
    maxRenderCachePages = 10;
    maxThumbnailCachePages = 20;
    maxCanvasPoolSize = 4;
    maxMemoryMb = 64;
  }

  // Halve limits under pressure
  if (pressure === 'serious' || pressure === 'critical') {
    maxRenderCachePages = Math.max(1, Math.floor(maxRenderCachePages / 2));
    maxThumbnailCachePages = Math.max(1, Math.floor(maxThumbnailCachePages / 2));
    maxCanvasPoolSize = Math.max(1, Math.floor(maxCanvasPoolSize / 2));
    maxMemoryMb = Math.max(16, Math.floor(maxMemoryMb / 2));
  }

  return { maxRenderCachePages, maxThumbnailCachePages, maxCanvasPoolSize, maxMemoryMb };
}

/**
 * Registers a callback for memory pressure changes.
 * Uses MemoryPressureObserver (Chrome 126+) when available,
 * falls back to polling performance.memory every 30 s.
 *
 * @returns An unsubscribe function.
 */
export function onMemoryPressure(
  callback: (pressure: MemoryInfo['pressure']) => void,
): () => void {
  // Chrome 126+ MemoryPressureObserver
  if (typeof (globalThis as any).MemoryPressureObserver !== 'undefined') {
    const observer = new (globalThis as any).MemoryPressureObserver((entries: any[]) => {
      for (const entry of entries) {
        const level = entry.pressure as MemoryInfo['pressure'];
        _currentPressure = level;
        callback(level);
      }
    });
    observer.observe({ type: 'memory' });
    return () => observer.disconnect();
  }

  // navigator.onmemorywarning (older Chrome / Android WebView)
  if (typeof navigator !== 'undefined' && 'onmemorywarning' in navigator) {
    const handler = () => {
      _currentPressure = 'serious';
      callback('serious');
    };
    navigator.onmemorywarning = handler;
    return () => { navigator.onmemorywarning = null; };
  }

  // Polling fallback using performance.memory
  const POLL_INTERVAL_MS = 30_000;
  let lastPressure: MemoryInfo['pressure'] = _pressureFromHeap();

  const timerId = setInterval(() => {
    const p = _pressureFromHeap();
    if (p !== lastPressure) {
      lastPressure = p;
      _currentPressure = p;
      callback(p);
    }
  }, POLL_INTERVAL_MS);

  return () => clearInterval(timerId);
}

/**
 * Starts memory monitoring using all available signals.
 * Returns a stop function that cleans up all resources.
 */
export function startMemoryMonitor(): () => void {
  const stopCallbacks: Array<() => void> = [];

  // Subscribe to pressure events internally to keep _currentPressure fresh
  const unsubscribe = onMemoryPressure((pressure) => {
    _currentPressure = pressure;
  });
  stopCallbacks.push(unsubscribe);

  return () => {
    for (const stop of stopCallbacks) {
      try { stop(); } catch { /* ignore cleanup errors */ }
    }
  };
}

/**
 * Rough estimate of object size in bytes using JSON serialization.
 * Handles circular references gracefully (returns 0 on failure).
 *
 * @param obj - Any value to estimate
 * @returns Estimated size in bytes (≥ 0)
 */
export function estimateObjectSize(obj: unknown): number {
  try {
    const seen = new Set<unknown>();
    const json = JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value as unknown;
    });
    // JSON uses UTF-16 internally but characters outside BMP are rare;
    // multiply by 2 as a conservative byte estimate.
    return json.length * 2;
  } catch {
    return 0;
  }
}
