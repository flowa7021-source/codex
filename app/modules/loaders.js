// ─── Library Loaders ────────────────────────────────────────────────────────

import { safeTimeout } from './safe-timers.js';

let pdfjsLib = null;
let djvuLib = null;
let pdfLoadPromise = null;
let djvuLoadPromise = null;

/**
 * Lazily load PDF.js and its worker. The worker is only fetched when the
 * first PDF is actually opened (i.e. when this function is first called).
 * Subsequent calls return the cached module immediately.
 * @returns {Promise<object>} The loaded pdfjsLib module
 */
export async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (pdfLoadPromise) return pdfLoadPromise;

  const localPdfUrl = new URL('../vendor/pdf.min.mjs', import.meta.url).href;
  const localWorkerUrl = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

  pdfLoadPromise = (async () => {
    const t0 = performance.now();
    try {
      pdfjsLib = await import(localPdfUrl);
      if (pdfjsLib?.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = localWorkerUrl;
      }
      const elapsed = Math.round(performance.now() - t0);
      console.info(`[loaders] PDF.js worker init took ${elapsed}ms`);
      try {
        // Push timing to diagnostics if available (non-critical)
        const { pushDiagnosticEvent } = await import('./diagnostics.js');
        pushDiagnosticEvent('pdfjs.worker.init', { durationMs: elapsed });
      } catch (_) { /* diagnostics not available */ }
      return pdfjsLib;
    } catch (err) {
      console.warn('[loaders] error:', err?.message);
      pdfLoadPromise = null;
      throw new Error('PDF.js недоступен в локальном runtime пакете');
    }
  })();

  return pdfLoadPromise;
}

/** Get the loaded pdfjsLib reference (null if not yet loaded) */
export function getPdfjsLib() {
  return pdfjsLib;
}

/**
 * Preload the PDF.js runtime during browser idle time.
 * Call this during application startup to warm up the PDF worker
 * so it is ready when the user opens their first PDF.
 * Uses `requestIdleCallback` with a fallback to `setTimeout`.
 */
export function preloadPdfRuntime() {
  const scheduleIdle = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb) => safeTimeout(cb, 200);

  scheduleIdle(() => {
    ensurePdfJs().catch((err) => {
      console.warn('[loaders] PDF.js preload failed:', err?.message);
    });
  });
}

export async function ensureDjVuJs() {
  if (djvuLib) return djvuLib;
  if (djvuLoadPromise) return djvuLoadPromise;

  const url = new URL('../vendor/djvu.js', import.meta.url).href;
  djvuLoadPromise = (async () => {
    try {
      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-djvu-runtime="1"]');
        if (existing) {
          if (window.DjVu) {
            resolve();
          } else {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('DjVu runtime load error')), { once: true });
          }
          return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.dataset.djvuRuntime = '1';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('DjVu runtime load error'));
        document.head.appendChild(script);
      });

      if (!window.DjVu) {
        throw new Error('DjVu runtime не инициализирован');
      }

      djvuLib = window.DjVu;
      return djvuLib;
    } catch (err) {
      console.warn('[loaders] DjVu load error:', err?.message);
      djvuLoadPromise = null;
      throw err;
    }
  })();

  return djvuLoadPromise;
}
