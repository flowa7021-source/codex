// ─── Text Export Sub-module ──────────────────────────────────────────────────
// DOCX import, session health report, and text-based export utilities.
// Split from export-controller.js for maintainability.

import { state, els } from './state.js';
import { pushDiagnosticEvent } from './diagnostics.js';
import { getSessionHealth, getRecentErrors } from './crash-telemetry.js';
import { getPerfSummary } from './perf.js';
import { getTesseractStatus } from './tesseract-adapter.js';
import { getSupportedLanguages, getLanguageName } from './ocr-languages.js';
import { APP_VERSION } from './constants.js';
import { loadOcrTextData, saveOcrTextData } from './workspace-controller.js';
import { extractDocumentXmlFromZip, parseDocxTextByPages } from './export-docx.js';
import { setPageEdits, persistEdits } from './export-controller.js';

// ─── Late-bound dependencies ────────────────────────────────────────────────
const _deps = {
  setOcrStatus: () => {},
  getOcrLang: () => 'rus',
};

/**
 * Inject runtime dependencies.
 * Called from export-controller's initExportControllerDeps.
 */
export function initExportTextDeps(deps) {
  Object.assign(_deps, deps);
}

// ─── DOCX Import ────────────────────────────────────────────────────────────

export async function importDocxEdits(file) {
  if (!file || !state.adapter) {
    _deps.setOcrStatus('Импорт DOCX: нужен открытый документ');
    return;
  }

  try {
    _deps.setOcrStatus('Импорт DOCX: чтение файла...');
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const xmlContent = extractDocumentXmlFromZip(bytes);
    if (!xmlContent) {
      _deps.setOcrStatus('Импорт DOCX: не удалось найти word/document.xml');
      return;
    }

    const pages = parseDocxTextByPages(xmlContent);
    if (!pages.length) {
      _deps.setOcrStatus('Импорт DOCX: текст не найден в документе');
      return;
    }

    const cache = loadOcrTextData();
    const pagesText = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : new Array(state.pageCount).fill('');

    let merged = 0;
    for (let i = 0; i < pages.length && i < state.pageCount; i++) {
      const imported = pages[i].trim();
      if (imported && imported !== pagesText[i]) {
        pagesText[i] = imported;
        setPageEdits(i + 1, imported);
        merged++;
      }
    }

    saveOcrTextData({
      pagesText,
      source: 'docx-import',
      scannedPages: pages.length,
      totalPages: state.pageCount,
      updatedAt: new Date().toISOString(),
    });
    persistEdits();

    if (state.currentPage <= pages.length && pages[state.currentPage - 1]) {
      els.pageText.value = pages[state.currentPage - 1];
    }

    _deps.setOcrStatus(`Импорт DOCX: объединено ${merged} страниц из ${pages.length}`);
    pushDiagnosticEvent('docx.import', { pages: pages.length, merged });
  } catch (error) {
    _deps.setOcrStatus(`Импорт DOCX: ошибка — ${error.message}`);
    pushDiagnosticEvent('docx.import.error', { message: error.message }, 'error');
  }
}

// ─── Session Health Report ──────────────────────────────────────────────────

export function exportSessionHealthReport() {
  const health = getSessionHealth();
  const perfSummary = getPerfSummary();
  const tessStatus = getTesseractStatus();
  const report = {
    app: 'NovaReader',
    version: APP_VERSION,
    ...health,
    perfMetrics: perfSummary,
    recentErrors: getRecentErrors(20),
    ocr: {
      engine: tessStatus,
      supportedLanguages: getSupportedLanguages().map((l) => ({ code: l, name: getLanguageName(l) })),
      currentLang: _deps.getOcrLang(),
    },
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novareader-health-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  pushDiagnosticEvent('health.export', health);
}
