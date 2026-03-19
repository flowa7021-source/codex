/**
 * text-nav-controller.js
 * ----------------------
 * Text display / editing helpers, page navigation, zoom fitting,
 * file download, canvas print, and DOCX export.
 * Extracted from app.js to keep the main file manageable.
 */

import { state, els } from './state.js';
import { ToolMode, toolStateMachine } from './tool-modes.js';
import { enableInlineTextEditing, disableInlineTextEditing } from './render-controller.js';

/* ------------------------------------------------------------------ */
/*  Late-bound cross-module dependencies (set via initTextNavDeps)     */
/* ------------------------------------------------------------------ */
const _deps = {
  uiLayoutKey: null,
  applyLayoutState: null,
  canSearchCurrentDoc: null,
  loadOcrTextData: null,
  saveOcrTextData: null,
  setOcrStatus: null,
  pushDiagnosticEvent: null,
  renderCurrentPage: null,
  safeCreateObjectURL: null,
  setPageEdits: null,
  persistEdits: null,
  getEditHistory: null,
  pdfEditState: null,
  convertPdfToDocx: null,
  generateDocxBlob: null,
  generateDocxWithImages: null,
  capturePageAsImageData: null,
  _ocrWordCache: null,
  recordSuccessfulOperation: null,
  recordCrashEvent: null,
};

export function initTextNavDeps(deps) {
  Object.assign(_deps, deps);
}

/* ------------------------------------------------------------------ */
/*  Text tools visibility                                              */
/* ------------------------------------------------------------------ */

export function ensureTextToolsVisible() {
  const key = _deps.uiLayoutKey('textHidden');
  if (localStorage.getItem(key) === '1') {
    localStorage.setItem(key, '0');
    _deps.applyLayoutState();
  }
}

/* ------------------------------------------------------------------ */
/*  Page text refresh / copy / export                                  */
/* ------------------------------------------------------------------ */

export async function refreshPageText() {
  ensureTextToolsVisible();

  if (!_deps.canSearchCurrentDoc()) {
    els.pageText.value = 'Извлечение текста доступно для PDF/DjVu';
    return;
  }

  let text = await state.adapter.getText(state.currentPage);
  if (!text) {
    const ocr = _deps.loadOcrTextData();
    text = String(ocr?.pagesText?.[state.currentPage - 1] || '');
  }
  els.pageText.value = text || '(На этой странице не найден текстовый слой)';
  if (!text && state.adapter?.type === 'djvu') {
    if (state.adapter?.mode === 'compat') {
      els.searchStatus.textContent = 'Для расширенного текста DjVu можно импортировать DjVu data JSON или OCR JSON.';
    } else {
      els.searchStatus.textContent = 'В этом DjVu-документе текстовый слой отсутствует.';
    }
  }
}

export async function copyPageText() {
  if (!els.pageText.value) {
    await refreshPageText();
  }

  if (!els.pageText.value) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(els.pageText.value);
    return;
  }

  els.pageText.focus();
  els.pageText.select();
  document.execCommand('copy');
}

export function exportPageText() {
  const text = els.pageText.value || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.docName || 'document'}-page-${state.currentPage}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Inline text editing                                                */
/* ------------------------------------------------------------------ */

export function setTextEditMode(enabled) {
  state.textEditMode = !!enabled;
  if (enabled) {
    toolStateMachine.transition(ToolMode.TEXT_EDIT);
    enableInlineTextEditing();
  } else {
    if (toolStateMachine.current === ToolMode.TEXT_EDIT) {
      toolStateMachine.transition(ToolMode.IDLE);
    }
    disableInlineTextEditing();
  }
  if (els.pageText) {
    els.pageText.readOnly = !state.textEditMode;
  }
  if (els.toggleTextEdit) {
    els.toggleTextEdit.textContent = state.textEditMode ? 'Ред. ВКЛ' : 'Ред.';
    els.toggleTextEdit.classList.toggle('active', state.textEditMode);
  }
}

export function saveCurrentPageTextEdits() {
  if (!state.adapter || !state.docName) return;
  const txt = String(els.pageText?.value || '').trim();

  // Record in PDF edit layer for undo/redo
  _deps.setPageEdits(state.currentPage, txt);
  _deps.persistEdits();

  const cache = _deps.loadOcrTextData();
  const pagesText = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : new Array(state.pageCount).fill('');
  pagesText[state.currentPage - 1] = txt;
  _deps.saveOcrTextData({
    pagesText,
    source: 'manual-edit',
    scannedPages: Math.max(cache?.scannedPages || 0, state.currentPage),
    totalPages: state.pageCount,
    updatedAt: new Date().toISOString(),
  });
  const history = _deps.getEditHistory();
  _deps.setOcrStatus(`Правки сохранены (undo: ${history.undoCount}, redo: ${history.redoCount})`);
}

/* ------------------------------------------------------------------ */
/*  DOCX export                                                        */
/* ------------------------------------------------------------------ */

export async function exportCurrentDocToWord() {
  if (!state.adapter) return;
  const title = String(state.docName || 'document').replace(/\.[^.]+$/, '');

  // Use the new docx library converter for PDF files with native text
  if (state.adapter?.type === 'pdf' && state.adapter.pdfDoc) {
    try {
      _deps.setOcrStatus('Экспорт DOCX: извлечение структуры...');
      const pageCount = state.pageCount || 1;

      // Capture page image function for text+images mode
      const captureImage = async (pageNum) => {
        const imgData = await _deps.capturePageAsImageData(pageNum);
        if (!imgData) return null;
        return Uint8Array.from(atob(imgData), c => c.charCodeAt(0));
      };

      const includeImages = pageCount <= 30;
      const blob = await _deps.convertPdfToDocx(state.adapter.pdfDoc, title, pageCount, {
        mode: includeImages ? 'text+images' : 'text',
        capturePageImage: includeImages ? captureImage : null,
        ocrWordCache: _deps._ocrWordCache,
        includeFooter: true,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      _deps.recordSuccessfulOperation();
      _deps.setOcrStatus(`Экспорт DOCX: готово (${Math.round(blob.size / 1024)} КБ, ${pageCount} стр.)`);
      _deps.pushDiagnosticEvent('export.docx', { pages: pageCount, sizeKb: Math.round(blob.size / 1024), engine: 'docx-lib' });
      return;
    } catch (err) {
      console.warn('New DOCX converter failed, falling back to legacy:', err);
      _deps.pushDiagnosticEvent('export.docx.fallback', { error: err.message });
      // Fall through to legacy converter
    }
  }

  // Legacy fallback for non-PDF files or if new converter fails
  const cache = _deps.loadOcrTextData();
  const pages = Array.isArray(cache?.pagesText) ? [...cache.pagesText] : [];
  const currentText = String(els.pageText?.value || '').trim();
  if (!pages[state.currentPage - 1] && currentText) {
    pages[state.currentPage - 1] = currentText;
  }

  for (const [pageNum, editText] of _deps.pdfEditState.edits) {
    if (editText && (!pages[pageNum - 1] || pages[pageNum - 1].length < editText.length)) {
      pages[pageNum - 1] = editText;
    }
  }

  const maxPages = Math.max(state.pageCount || 1, pages.length || 0);
  const textPages = [];
  for (let i = 0; i < maxPages; i++) {
    textPages.push(String(pages[i] || '').trim());
  }

  const hasContent = textPages.some(t => t.length > 0);
  if (!hasContent) {
    _deps.setOcrStatus('OCR: нет текста для экспорта в DOCX, выполните OCR/извлечение');
    return;
  }

  const includeImages = state.adapter?.type === 'pdf' && maxPages <= 20;

  try {
    _deps.setOcrStatus(includeImages ? 'Экспорт DOCX: генерация с изображениями...' : 'Экспорт DOCX: генерация...');
    const blob = includeImages
      ? await _deps.generateDocxWithImages(title, textPages, true)
      : await _deps.generateDocxBlob(title, textPages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    _deps.recordSuccessfulOperation();
    _deps.setOcrStatus(`Экспорт DOCX: готово (${Math.round(blob.size / 1024)} КБ${includeImages ? ', с изображениями' : ''})`);
    _deps.pushDiagnosticEvent('export.docx', { pages: maxPages, sizeKb: Math.round(blob.size / 1024), withImages: includeImages });
  } catch (error) {
    _deps.recordCrashEvent('export-error', error.message, 'docx');
    _deps.setOcrStatus(`Экспорт DOCX: ошибка — ${error.message}`);
    _deps.pushDiagnosticEvent('export.docx.error', { message: error.message }, 'error');
  }
}

/* ------------------------------------------------------------------ */
/*  Page navigation                                                    */
/* ------------------------------------------------------------------ */

export function normalizePageInput() {
  const raw = Number.parseInt(els.pageInput.value, 10);
  if (Number.isNaN(raw)) return 1;
  return Math.max(1, Math.min(state.pageCount || 1, raw));
}

export async function goToPage() {
  if (!state.adapter) return;
  state.currentPage = normalizePageInput();
  await _deps.renderCurrentPage();
}

/* ------------------------------------------------------------------ */
/*  Zoom fitting                                                       */
/* ------------------------------------------------------------------ */

export async function fitWidth() {
  if (!state.adapter) return;
  const viewport = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
  // Use minimal padding (scrollbar width + canvas padding) for maximum use of space
  const scrollbarWidth = els.canvasWrap.offsetWidth - els.canvasWrap.clientWidth;
  const padding = Math.max(16, scrollbarWidth + 16);
  const available = Math.max(200, els.canvasWrap.clientWidth - padding);
  state.zoom = Math.max(0.3, Math.min(4, available / viewport.width));
  await _deps.renderCurrentPage();
}

export async function fitPage() {
  if (!state.adapter) return;
  const viewport = await state.adapter.getPageViewport(state.currentPage, 1, state.rotation);
  const scrollbarW = els.canvasWrap.offsetWidth - els.canvasWrap.clientWidth;
  const scrollbarH = els.canvasWrap.offsetHeight - els.canvasWrap.clientHeight;
  const paddingW = Math.max(16, scrollbarW + 16);
  const paddingH = Math.max(16, scrollbarH + 16);
  const availableWidth = Math.max(200, els.canvasWrap.clientWidth - paddingW);
  const availableHeight = Math.max(200, els.canvasWrap.clientHeight - paddingH);
  state.zoom = Math.max(0.3, Math.min(4, Math.min(availableWidth / viewport.width, availableHeight / viewport.height)));
  await _deps.renderCurrentPage();
}

/* ------------------------------------------------------------------ */
/*  File download / print                                              */
/* ------------------------------------------------------------------ */

export function downloadCurrentFile() {
  if (!state.file) return;
  const url = _deps.safeCreateObjectURL(state.file);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.file.name;
  a.click();
  URL.revokeObjectURL(url);
}

export function printCanvasPage() {
  if (!state.adapter) return;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = els.canvas.width;
  exportCanvas.height = els.canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.drawImage(els.canvas, 0, 0);
  ctx.drawImage(els.annotationCanvas, 0, 0, els.annotationCanvas.width, els.annotationCanvas.height, 0, 0, els.canvas.width, els.canvas.height);

  const dataUrl = exportCanvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><title>Print</title><img src="${dataUrl}" style="width:100%;"/>`);
  win.document.close();
  win.focus();
  win.print();
}
