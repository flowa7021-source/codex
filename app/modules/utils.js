// @ts-check
// ─── Utility helpers ────────────────────────────────────────────────────────

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

/**
 * @param {Function} fn
 * @param {number} ms
 * @returns {(...args: any[]) => void}
 */
export function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = performance.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearSafeTimeout(timer); timer = null; }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = safeTimeout(() => {
        last = performance.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * @param {Function} fn
 * @param {number} ms
 * @returns {(...args: any[]) => void}
 */
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    if (timer) clearSafeTimeout(timer);
    timer = safeTimeout(() => { timer = null; fn.apply(this, args); }, ms);
  };
}

/**
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function yieldToMainThread(timeoutMs = 20) {
  if (typeof window.requestIdleCallback === 'function') {
    await new Promise((resolve) => window.requestIdleCallback(() => resolve(), { timeout: timeoutMs }));
    return;
  }
  await new Promise((resolve) => safeTimeout(resolve, 0));
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
export async function downloadBlob(blob, filename) {
  const { downloadBlob: platformDownload } = await import('./platform.js');
  return platformDownload(blob, filename);
}
