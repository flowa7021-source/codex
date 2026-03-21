// ─── Utility helpers ────────────────────────────────────────────────────────

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

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

export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    if (timer) clearSafeTimeout(timer);
    timer = safeTimeout(() => { timer = null; fn.apply(this, args); }, ms);
  };
}

export async function yieldToMainThread(timeoutMs = 20) {
  if (typeof window.requestIdleCallback === 'function') {
    await new Promise((resolve) => window.requestIdleCallback(() => resolve(), { timeout: timeoutMs }));
    return;
  }
  await new Promise((resolve) => safeTimeout(resolve, 0));
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
