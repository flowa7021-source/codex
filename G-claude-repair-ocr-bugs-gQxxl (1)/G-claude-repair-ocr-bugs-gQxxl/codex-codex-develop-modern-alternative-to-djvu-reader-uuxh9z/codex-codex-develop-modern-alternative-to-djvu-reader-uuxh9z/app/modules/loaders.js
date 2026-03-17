// ─── Library Loaders ────────────────────────────────────────────────────────

let pdfjsLib = null;
let djvuLib = null;
let ocradReady = false;
let pdfLoadPromise = null;
let djvuLoadPromise = null;
let ocradLoadPromise = null;

export async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (pdfLoadPromise) return pdfLoadPromise;

  const localPdfUrl = new URL('../vendor/pdf.min.mjs', import.meta.url).href;
  const localWorkerUrl = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

  pdfLoadPromise = (async () => {
    try {
      pdfjsLib = await import(localPdfUrl);
      if (pdfjsLib?.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = localWorkerUrl;
      }
      return pdfjsLib;
    } catch {
      pdfLoadPromise = null;
      throw new Error('PDF.js недоступен в локальном runtime пакете');
    }
  })();

  return pdfLoadPromise;
}

export async function ensureDjVuJs() {
  if (djvuLib) return djvuLib;
  if (djvuLoadPromise) return djvuLoadPromise;

  const url = new URL('../vendor/djvu.js', import.meta.url).href;
  djvuLoadPromise = (async () => {
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
  })();

  try {
    return await djvuLoadPromise;
  } finally {
    djvuLoadPromise = null;
  }
}

export async function ensureOcrad() {
  if (ocradReady && typeof (globalThis.OCRAD || window.OCRAD) === 'function') {
    if (!window.OCRAD && typeof globalThis.OCRAD === 'function') {
      window.OCRAD = globalThis.OCRAD;
    }
    return;
  }
  if (ocradLoadPromise) return ocradLoadPromise;

  const url = new URL('../vendor/ocrad.js', import.meta.url).href;

  const prepareOcradModuleConfig = (memoryBytes = 128 * 1024 * 1024) => {
    const safeMemory = Math.max(16 * 1024 * 1024, Number(memoryBytes) || (128 * 1024 * 1024));
    const existingModule = (typeof globalThis.Module === 'object' && globalThis.Module) ? globalThis.Module : {};
    const merged = {
      ...existingModule,
      TOTAL_MEMORY: safeMemory,
      ALLOW_MEMORY_GROWTH: 1,
      printErr: existingModule.printErr || (() => {}),
    };
    globalThis.Module = merged;
    if (typeof window !== 'undefined') {
      window.Module = merged;
    }
    return merged;
  };

  prepareOcradModuleConfig();

  const waitForOcrad = async (timeoutMs = 1600) => {
    const started = performance.now();
    while ((performance.now() - started) < timeoutMs) {
      if (typeof window.OCRAD === 'function') return true;
      if (!window.OCRAD && typeof globalThis.OCRAD === 'function') {
        window.OCRAD = globalThis.OCRAD;
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return typeof window.OCRAD === 'function';
  };

  const loadViaScriptTag = (src, forceReload = false) => new Promise((resolve, reject) => {
    let existing = document.querySelector('script[data-ocrad-runtime="1"]');
    if (existing && forceReload) {
      existing.remove();
      existing = null;
    }

    if (existing) {
      if (typeof window.OCRAD === 'function') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('OCR runtime load error')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.ocradRuntime = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OCR runtime load error'));
    document.head.appendChild(script);
  });

  ocradLoadPromise = (async () => {
    let ready = false;

    try {
      await loadViaScriptTag(url);
      ready = await waitForOcrad();
    } catch {
      ready = false;
    }

    if (!ready) {
      try {
        const code = await fetch(url, { cache: 'force-cache' }).then((r) => {
          if (!r.ok) throw new Error('fetch failed');
          return r.text();
        });
        // eslint-disable-next-line no-new-func
        (new Function(code))();
        ready = await waitForOcrad(1000);
      } catch {
        ready = false;
      }
    }

    if (!ready) {
      try {
        prepareOcradModuleConfig(192 * 1024 * 1024);
        await loadViaScriptTag(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`, true);
        ready = await waitForOcrad();
      } catch {
        ready = false;
      }
    }

    if (!ready) {
      throw new Error('OCR runtime не инициализирован');
    }

    ocradReady = true;
  })();

  try {
    return await ocradLoadPromise;
  } finally {
    ocradLoadPromise = null;
  }
}
