// @ts-check
// ─── PDF Ops Controller ─────────────────────────────────────────────────────
// PDF merge, split, page-range operations.
// Extracted from app.js as part of module decomposition.

import { state } from './state.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
// These are injected from app.js to avoid circular imports.
/** @type {any} */
const _deps = {
  setOcrStatus: () => {},
  safeCreateObjectURL: (blob) => URL.createObjectURL(blob),
  pushDiagnosticEvent: () => {},
  mergePdfDocuments: async () => new Blob(),
  splitPdfDocument: async () => null,
  parsePageRangeLib: () => [],
  nrPrompt: async () => null,
};

/**
 * Inject runtime dependencies that live in other modules.
 * Must be called once during startup before any pdf-ops functions are used.
 */
export function initPdfOpsDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── PDF Merge (via pdf-lib - preserves text, fonts, links, forms) ─────────
export async function mergePdfFiles() {
  // If a PDF is currently open, let the user pick ONE file to append.
  // Otherwise, pick 2+ files from scratch.
  const currentFile = state.file && state.adapter?.type === 'pdf' ? state.file : null;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.multiple = !currentFile; // single file if we already have one open
  input.addEventListener('change', async () => {
    const picked = Array.from(input.files || []);
    if (!picked.length) return;

    const filesToMerge = currentFile ? [currentFile, ...picked] : picked;
    if (filesToMerge.length < 2) {
      _deps.setOcrStatus('Выберите PDF файл для объединения с текущим документом');
      return;
    }

    try {
      _deps.setOcrStatus(`Объединение ${filesToMerge.length} файлов (без потери данных)...`);
      const mergedBlob = await _deps.mergePdfDocuments(filesToMerge);

      const { saveOrDownload } = await import('./platform.js');
      const baseName = (state.docName || 'merged').replace(/\.[^.]+$/, '');
      await saveOrDownload(mergedBlob, `${baseName}-merged.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
      _deps.setOcrStatus(`Объединено: ${filesToMerge.length} файлов (${Math.round(mergedBlob.size / 1024)} КБ)`);
      _deps.pushDiagnosticEvent('pdf.merge', { files: filesToMerge.length, sizeKb: Math.round(mergedBlob.size / 1024) });
    } catch (err) {
      _deps.setOcrStatus(`Ошибка объединения: ${err?.message || 'неизвестная'}`);
      _deps.pushDiagnosticEvent('pdf.merge.error', { message: err?.message }, 'error');
    }
  });
  input.click();
}

/**
 * @deprecated Use mergePdfDocuments() from pdf-operations.js instead.
 * This function previously rendered pages to canvas images, destroying the
 * text layer, fonts, annotations, and other PDF structure. It now delegates
 * to the pdf-lib-based merge which preserves all content via copyPages().
 *
 * @param {Array<{file: File}>} pages - Array of objects with a `file` property
 * @returns {Promise<Blob>}
 */
export async function buildMergedPdfFromCanvases(pages) {
  // Extract File objects and delegate to the proper pdf-lib merge
  const files = pages.map(p => p.file).filter(Boolean);
  if (!files.length) {
    throw new Error('No valid PDF files provided');
  }
  return _deps.mergePdfDocuments(files);
}

// ─── PDF Split (via pdf-lib - preserves all content) ────────────────────────
export async function splitPdfPages() {
  if (!state.adapter || state.adapter.type !== 'pdf') {
    _deps.setOcrStatus('Разделение доступно только для PDF');
    return;
  }
  const rangeStr = await _deps.nrPrompt(`Введите диапазон страниц (напр. "1-3" или "1,3,5-7").\nВсего страниц: ${state.pageCount}`);
  if (!rangeStr) return;

  const pageNums = _deps.parsePageRangeLib(rangeStr, state.pageCount);
  if (!pageNums.length) {
    _deps.setOcrStatus('Неверный диапазон страниц');
    return;
  }

  try {
    _deps.setOcrStatus(`Извлечение ${pageNums.length} страниц (без потери данных)...`);
    const arrayBuffer = await state.file.arrayBuffer();
    const blob = await _deps.splitPdfDocument(arrayBuffer, pageNums);

    if (!blob) {
      _deps.setOcrStatus('Ошибка: не удалось извлечь страницы');
      return;
    }

    const { saveOrDownload } = await import('./platform.js');
    await saveOrDownload(blob, `${state.docName || 'document'}-pages-${rangeStr}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
    _deps.setOcrStatus(`Извлечено ${pageNums.length} страниц (${Math.round(blob.size / 1024)} КБ)`);
    _deps.pushDiagnosticEvent('pdf.split', { pages: pageNums.length, sizeKb: Math.round(blob.size / 1024) });
  } catch (err) {
    _deps.setOcrStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
    _deps.pushDiagnosticEvent('pdf.split.error', { message: err?.message }, 'error');
  }
}

export function parsePageRange(str, maxPage) {
  const parts = str.split(',').map(s => s.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    const rangeParts = part.split('-').map(s => parseInt(s.trim(), 10));
    if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
      const p = rangeParts[0];
      if (p >= 1 && p <= maxPage) result.push(p);
    } else if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
      const from = Math.max(1, rangeParts[0]);
      const to = Math.min(maxPage, rangeParts[1]);
      for (let i = from; i <= to; i++) result.push(i);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}
