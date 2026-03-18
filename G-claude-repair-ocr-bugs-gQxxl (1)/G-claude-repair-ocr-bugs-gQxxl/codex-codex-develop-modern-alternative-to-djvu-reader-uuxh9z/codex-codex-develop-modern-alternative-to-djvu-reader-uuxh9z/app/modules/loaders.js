// ─── Library Loaders ────────────────────────────────────────────────────────

let pdfjsLib = null;
let djvuLib = null;
let pdfLoadPromise = null;
let djvuLoadPromise = null;

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

/** Get the loaded pdfjsLib reference (null if not yet loaded) */
export function getPdfjsLib() {
  return pdfjsLib;
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
