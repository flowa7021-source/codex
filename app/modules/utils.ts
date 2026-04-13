// ─── Utility helpers ────────────────────────────────────────────────────────

import { safeTimeout, clearSafeTimeout } from './safe-timers.js';

export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: number | null = null;
  return function (this: unknown, ...args: unknown[]) {
    const now = performance.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer !== null) { clearSafeTimeout(timer); timer = null; }
      last = now;
      fn.apply(this, args);
    } else if (timer === null) {
      timer = safeTimeout(() => {
        last = performance.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  } as T;
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: number | null = null;
  return function (this: unknown, ...args: unknown[]) {
    if (timer !== null) clearSafeTimeout(timer);
    timer = safeTimeout(() => { timer = null; fn.apply(this, args); }, ms);
  } as T;
}

export async function yieldToMainThread(timeoutMs = 20): Promise<void> {
  if (typeof window.requestIdleCallback === 'function') {
    await new Promise<void>((resolve) => window.requestIdleCallback(() => resolve(), { timeout: timeoutMs }));
    return;
  }
  await new Promise<void>((resolve) => safeTimeout(resolve, 0));
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const { downloadBlob: platformDownload } = await import('./platform.js');
  return platformDownload(blob, filename);
}
