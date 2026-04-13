// @ts-check
// ─── Environment Utils ────────────────────────────────────────────────────────
// Runtime environment detection utilities. All functions are pure and
// side-effect-free. Safe to call in any environment (browser, Node, Worker).

// ─── Environment Detection ────────────────────────────────────────────────────

/** Detect if running in a browser environment. */
export function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    !isNode()
  );
}

/** Detect if running in Node.js. */
export function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

/** Detect if running in a Web Worker. */
export function isWebWorker(): boolean {
  const g = globalThis as Record<string, unknown>;
  const WorkerScope = g.WorkerGlobalScope as (new (...args: unknown[]) => object) | undefined;
  return (
    typeof WorkerScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    self instanceof WorkerScope
  );
}

/** Detect if running in a Service Worker. */
export function isServiceWorker(): boolean {
  const g = globalThis as Record<string, unknown>;
  const SWScope = g.ServiceWorkerGlobalScope as (new (...args: unknown[]) => object) | undefined;
  return (
    typeof SWScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    self instanceof SWScope
  );
}

/** Get the current platform string. */
export function getPlatform(): 'browser' | 'node' | 'webworker' | 'serviceworker' | 'unknown' {
  if (isServiceWorker()) return 'serviceworker';
  if (isWebWorker()) return 'webworker';
  if (isBrowser()) return 'browser';
  if (isNode()) return 'node';
  return 'unknown';
}

// ─── Device / UI Detection ────────────────────────────────────────────────────

/** Detect if touch is available. */
export function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 0;
}

/** Detect if the device prefers dark mode. */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Detect if running on a mobile user agent. */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

// ─── Performance / Memory ─────────────────────────────────────────────────────

/** Get memory info if available (Chrome), else null. */
export function getMemoryInfo(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  const mem = (performance as unknown as { memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } }).memory;
  if (!mem) return null;
  return {
    usedJSHeapSize: mem.usedJSHeapSize,
    totalJSHeapSize: mem.totalJSHeapSize,
    jsHeapSizeLimit: mem.jsHeapSizeLimit,
  };
}

// ─── API Support ──────────────────────────────────────────────────────────────

/** Check if a specific browser API is available. */
export function supports(api: string): boolean {
  return (globalThis as Record<string, unknown>)[api] !== undefined;
}
