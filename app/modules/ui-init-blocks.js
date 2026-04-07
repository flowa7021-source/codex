// @ts-check
// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — UI Init Blocks (extracted from app.js)
// Continuous Scroll, Batch OCR UI, Drag & Drop + Hotkeys, Tab Bar,
// Print Dialog, Shortcuts Reference, Right Panel + Floating Search
// ═══════════════════════════════════════════════════════════════════════════════

import { safeTimeout } from './safe-timers.js';
import { indexOcrPage } from './search-controller.js';
import { saveOcrTextData, loadOcrTextData } from './workspace-controller.js';
import { preprocessForOcr } from './ocr-preprocess.js';

/** @type {any} */
const _win = window;

// ── Tracked document listeners for cleanup ──────────────────────────────────
/** @type {Array<{el: EventTarget, type: string, handler: EventListener}>} */
const _uiListeners = [];

/**
 * addEventListener with automatic tracking for later cleanup.
 * @param {EventTarget} el
 * @param {string} type
 * @param {any} handler
 * @param {AddEventListenerOptions} [opts]
 */
function _trackOn(el, type, handler, opts) {
  if (!el) return;
  el.addEventListener(type, handler, opts);
  _uiListeners.push({ el, type, handler });
}

/** Remove all tracked listeners registered via _trackOn. */
export function cleanupUiBlockListeners() {
  for (const { el, type, handler } of _uiListeners) {
    try { el.removeEventListener(type, handler); } catch (_e) { /* Ignore: element may already be detached from DOM */ }
  }
  _uiListeners.length = 0;
}

// ── Continuous Scroll Mode ──────────────────────────────────────────────────
function initContinuousScroll(deps) {
  const { state } = deps;
  const toggleBtn = document.getElementById('toggleContinuousScroll');
  const canvasWrap = document.getElementById('canvasWrap');
  const scrollWrap = document.getElementById('continuousScrollWrap');
  const scrollContainer = document.getElementById('continuousScrollContainer');
  let continuousMode = false;
  const renderedPages = new Set();
  let scrollObserver = null;

  if (!toggleBtn || !scrollWrap || !scrollContainer) return;

  toggleBtn.addEventListener('click', async () => {
    continuousMode = !continuousMode;
    toggleBtn.classList.toggle('active', continuousMode);

    if (continuousMode) {
      await enterContinuousMode();
    } else {
      exitContinuousMode();
    }
  });

  async function enterContinuousMode() {
    if (!state.adapter || !state.pageCount) return;
    canvasWrap.style.display = 'none';
    scrollWrap.style.display = '';
    scrollContainer.innerHTML = '';
    renderedPages.clear();

    // Create placeholder elements for each page
    for (let i = 1; i <= state.pageCount; i++) {
      const label = document.createElement('div');
      label.className = 'cs-page-label';
      label.textContent = `Страница ${i}`;
      scrollContainer.appendChild(label);

      const canvas = document.createElement('canvas');
      canvas.id = `cs-page-${i}`;
      canvas.dataset.pageNum = String(i);
      canvas.width = 800;
      canvas.height = 1100;
      canvas.style.width = '100%';
      canvas.style.maxWidth = '800px';
      canvas.style.background = '#e8e8e8';
      scrollContainer.appendChild(canvas);
    }

    // Use IntersectionObserver for lazy rendering
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
    try {
      let activeRenders = 0;
      const MAX_CONCURRENT_RENDERS = 3;
      scrollObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (activeRenders >= MAX_CONCURRENT_RENDERS) break;
            const pageNum = parseInt(/** @type {HTMLElement} */ (entry.target).dataset.pageNum, 10);
            if (!renderedPages.has(pageNum)) {
              renderedPages.add(pageNum);
              activeRenders++;
              renderScrollPage(pageNum, entry.target).finally(() => { activeRenders--; });
            }
          }
        }
      }, { rootMargin: '200px 0px' });

      scrollContainer.querySelectorAll('canvas[data-page-num]').forEach(c => scrollObserver.observe(c));
    } catch (obsErr) {
      console.warn('[ui-init-blocks] IntersectionObserver error:', obsErr?.message);
      if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
      return;
    }

    // Scroll to current page
    const target = document.getElementById(`cs-page-${state.currentPage || 1}`);
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  async function renderScrollPage(pageNum, canvas) {
    try {
      const zoom = state.zoom || 1;
      await state.adapter.renderPage(pageNum, canvas, { zoom, rotation: 0 });
      canvas.style.background = 'white';
    } catch (err) {
      console.warn('[ui-init-blocks] error:', err?.message);
      canvas.style.background = '#fdd';
    }
  }

  function exitContinuousMode() {
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
    // Zero canvas dimensions to release GPU memory before removing from DOM
    scrollContainer.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0; });
    scrollWrap.style.display = 'none';
    canvasWrap.style.display = '';
    scrollContainer.innerHTML = '';
    renderedPages.clear();
  }

  /** @type {any} */ (window)._novaContinuousScroll = { enterContinuousMode, exitContinuousMode };
}

// ── Batch OCR UI Integration ────────────────────────────────────────────────
function initBatchOcrUI(deps) {
  const { state, recognizeWithBoxes, batchOcr, createSearchablePdf, detectScannedDocument, autoDetectLanguage, pushDiagnosticEvent, reloadPdfFromBytes, renderCurrentPage } = deps;

  const batchOcrAllBtn = document.getElementById('batchOcrAll');
  const batchOcrCancelBtn = document.getElementById('batchOcrCancel');
  const createSearchablePdfBtn = document.getElementById('createSearchablePdf');
  const detectScannedBtn = document.getElementById('detectScanned');
  const progressBar = document.getElementById('batchOcrProgress');
  const statusEl = document.getElementById('batchOcrStatus');

  function setBatchStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  // Batch OCR all pages
  if (batchOcrAllBtn) {
    batchOcrAllBtn.addEventListener('click', async () => {
      if (!state.adapter || (state.adapter.type !== 'pdf' && state.adapter.type !== 'djvu')) {
        setBatchStatus('Откройте PDF или DJVU для пакетного OCR');
        return;
      }

// @ts-ignore
      if (progressBar) { progressBar.style.display = ''; progressBar.value = 0; }
      setBatchStatus('Запуск пакетного OCR...');

      try {
        const result = await batchOcr.processAll({
          renderPage: async (pageNum) => {
            const canvas = document.createElement('canvas');
            await state.adapter.renderPage(pageNum, canvas, { zoom: 2, rotation: 0 });
            return canvas;
          },
          recognizeFn: async (canvas, lang) => {
            // Apply deskew + denoise preprocessing before Tesseract recognition
            // so that skewed/noisy scans produce significantly better results (#14).
            const preprocessed = preprocessForOcr(canvas, {
              deskew: true, denoise: true, denoiseStrength: 1,
              sharpen: false, binarize: false, removeBorders: true,
            });
            const result = await recognizeWithBoxes(preprocessed, lang);
            return { text: result.text, words: result.words, confidence: result.confidence };
          },
          totalPages: state.pageCount,
          language: autoDetectLanguage(''),
          onProgress: (pageNum, total, status) => {
            setBatchStatus(status);
            if (progressBar && total > 0) {
// @ts-ignore
              progressBar.value = Math.round((pageNum / total) * 100);
            }
          },
        });

        if (progressBar) progressBar.style.display = 'none';
        setBatchStatus(result.cancelled
          ? `OCR отменён: обработано ${result.processed} из ${result.total} страниц`
          : `OCR завершён: ${result.processed} страниц`);
        pushDiagnosticEvent('batch-ocr.done', { processed: result.processed, total: result.total });

        // Index OCR results into the search engine so Ctrl+F can find them (#9).
        if (!result.cancelled && batchOcr.results.size > 0) {
          try {
            const existing = loadOcrTextData();
            const pagesText = Array.isArray(existing?.pagesText)
              ? [...existing.pagesText]
              : new Array(state.pageCount).fill('');
            // Ensure array is large enough
            while (pagesText.length < state.pageCount) pagesText.push('');
            for (const [pageNum, data] of batchOcr.results) {
              pagesText[pageNum - 1] = data.text || '';
              indexOcrPage(pageNum, data.text || '');
            }
            saveOcrTextData({ pagesText, updatedAt: new Date().toISOString() });
          } catch (idxErr) {
            console.warn('[batch-ocr] indexing error:', idxErr?.message);
          }
        }

        // Refresh current page to show text layer with OCR results
        renderCurrentPage();
      } catch (err) {
        if (progressBar) progressBar.style.display = 'none';
        setBatchStatus(`Ошибка OCR: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // Cancel batch OCR
  if (batchOcrCancelBtn) {
    batchOcrCancelBtn.addEventListener('click', () => {
      batchOcr.cancel();
      setBatchStatus('Отмена OCR...');
    });
  }

  // Create searchable PDF
  if (createSearchablePdfBtn) {
    createSearchablePdfBtn.addEventListener('click', async () => {
      if (!state.file || state.adapter?.type !== 'pdf') {
        setBatchStatus('Откройте PDF для создания searchable PDF');
        return;
      }

      if (batchOcr.results.size === 0) {
        setBatchStatus('Сначала запустите пакетное OCR');
        return;
      }

      try {
        setBatchStatus('Создание searchable PDF...');
        const arrayBuffer = await state.file.arrayBuffer();
        const result = await createSearchablePdf(arrayBuffer, batchOcr.results);
        // Reload the searchable PDF in-place instead of downloading a separate file
        const bytes = new Uint8Array(await result.blob.arrayBuffer());
        await reloadPdfFromBytes(bytes);
        await renderCurrentPage();
        setBatchStatus(`Searchable PDF применён: ${result.pagesProcessed} страниц`);
        pushDiagnosticEvent('searchable-pdf.created', { pages: result.pagesProcessed, inPlace: true });
      } catch (err) {
        setBatchStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // Save searchable PDF to disk (text layer embedded, user picks save path)
  const saveSearchablePdfBtn = document.getElementById('saveSearchablePdf');
  if (saveSearchablePdfBtn) {
    saveSearchablePdfBtn.addEventListener('click', async () => {
      if (!state.file || state.adapter?.type !== 'pdf') {
        setBatchStatus('Откройте PDF для сохранения с текстовым слоем');
        return;
      }
      if (batchOcr.results.size === 0) {
        setBatchStatus('Сначала запустите пакетное OCR всего документа');
        return;
      }
      try {
        setBatchStatus('Создание PDF с текстовым слоем...');
        const arrayBuffer = await state.file.arrayBuffer();
        const result = await createSearchablePdf(arrayBuffer, batchOcr.results);
        const baseName = (state.file?.name || 'document').replace(/\.pdf$/i, '');
        const fileName = `${baseName}_searchable.pdf`;
        const { saveOrDownload } = await import('./platform.js');
        await saveOrDownload(result.blob, fileName, [{ name: 'PDF', extensions: ['pdf'] }]);
        setBatchStatus(`Сохранено: ${fileName} (${result.pagesProcessed} стр.)`);
        pushDiagnosticEvent('searchable-pdf.saved', { pages: result.pagesProcessed });
      } catch (err) {
        setBatchStatus(`Ошибка сохранения: ${err?.message || 'неизвестная'}`);
      }
    });
  }

  // Detect scanned document
  if (detectScannedBtn) {
    detectScannedBtn.addEventListener('click', async () => {
      if (!state.adapter || (state.adapter.type !== 'pdf' && state.adapter.type !== 'djvu')) {
        setBatchStatus('Откройте PDF или DJVU для анализа');
        return;
      }

      try {
        setBatchStatus('Анализ документа...');
        const result = await detectScannedDocument(state.adapter.pdfDoc || state.adapter);
        let msg = result.isScanned
          ? `Сканированный документ (${result.scannedPages}/${result.totalChecked} стр.)`
          : `Текстовый документ (${result.totalChecked - result.scannedPages}/${result.totalChecked} с текстом)`;
        if (result.recommendation) msg += `\n${result.recommendation}`;
        setBatchStatus(msg);
        pushDiagnosticEvent('scan-detect', { isScanned: result.isScanned, confidence: result.confidence });
      } catch (err) {
        setBatchStatus(`Ошибка анализа: ${err?.message || 'неизвестная'}`);
      }
    });
  }
}

// ── Drag & Drop + Extended Hotkeys ──────────────────────────────────────────
function initDragDropAndHotkeys(/* deps not needed */) {
  const viewport = document.getElementById('documentViewport');

  // ── Drag & Drop ──
  if (viewport) {
    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewport.classList.add('drag-over');
    });

    viewport.addEventListener('dragleave', (e) => {
      e.preventDefault();
      viewport.classList.remove('drag-over');
    });

    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      viewport.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (files?.length > 0) {
        const file = files[0];
        // Trigger the existing file-open logic
        const openInput = document.getElementById('fileInput') || document.querySelector('input[type="file"][accept*="pdf"]');
        if (openInput) {
          const dt = new DataTransfer();
          dt.items.add(file);
          /** @type {any} */ (openInput).files = dt.files;
          openInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  // ── Extended Hotkeys ──
  _trackOn(document, 'keydown', (e) => {
    // Skip if user is typing in input/textarea
    if (/** @type {HTMLElement} */ (e.target).matches('input, textarea, select, [contenteditable]')) return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+Shift+O: PDF Optimize
    if (ctrl && e.shiftKey && e.key === 'O') {
      e.preventDefault();
      document.getElementById('pdfOptimize')?.click();
      return;
    }
    // Ctrl+Shift+A: Accessibility check
    if (ctrl && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      document.getElementById('pdfAccessibility')?.click();
      return;
    }
    // Ctrl+Shift+R: Redaction
    if (ctrl && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      document.getElementById('pdfRedact')?.click();
      return;
    }
    // Ctrl+Shift+C: Compare
    if (ctrl && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      document.getElementById('pdfCompare')?.click();
      return;
    }
    // Ctrl+Shift+B: Batch OCR
    if (ctrl && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      document.getElementById('batchOcrAll')?.click();
      return;
    }
  });
}

// ── Document Tab Bar ────────────────────────────────────────────────────────
function initTabBar(deps) {
  const { state } = deps;
  const tabBarTabs = document.getElementById('tabBarTabs');
  const tabBarNewBtn = document.getElementById('tabBarNewTab');
  if (!tabBarTabs) return;

  // Tab registry: each tab = { id, name, file, type, element }
  const tabs = [];
  let activeTabId = null;
  let nextTabId = 1;

  function createTab(name, file, type = 'pdf') {
    const id = nextTabId++;
    const tab = document.createElement('div');
    tab.className = 'doc-tab';
    tab.dataset.tabId = String(id);
    const tabIcon = document.createElement('span');
    tabIcon.className = 'tab-icon';
    tabIcon.textContent = type === 'pdf' ? '📄' : type === 'djvu' ? '📘' : type === 'epub' ? '📗' : '🖼';
    const tabLabel = document.createElement('span');
    tabLabel.className = 'tab-label';
    tabLabel.textContent = name;
    const tabClose = document.createElement('button');
    tabClose.className = 'tab-close';
    tabClose.title = 'Закрыть';
    tabClose.textContent = '✕';
    tab.appendChild(tabIcon);
    tab.appendChild(tabLabel);
    tab.appendChild(tabClose);

    tab.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.tab-close')) return;
      switchToTab(id);
    });

    tab.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });

    const entry = { id, name, file, type, element: tab };
    tabs.push(entry);
    tabBarTabs.appendChild(tab);
    switchToTab(id);
    return entry;
  }

  function switchToTab(id) {
    activeTabId = id;
    tabBarTabs.querySelectorAll('.doc-tab').forEach(t => {
      t.classList.toggle('active', parseInt(/** @type {HTMLElement} */ (t).dataset.tabId) === id);
    });
    // Future: restore document state for this tab
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx < 0) return;

    const entry = tabs[idx];
    entry.element.remove();
    tabs.splice(idx, 1);

    if (activeTabId === id && tabs.length > 0) {
      const nextIdx = Math.min(idx, tabs.length - 1);
      switchToTab(tabs[nextIdx].id);
    }
  }

  // Listen for file open events to create tabs
  const origFileInput = document.getElementById('fileInput');
  if (origFileInput) {
    origFileInput.addEventListener('change', () => {
      const file = /** @type {any} */ (origFileInput).files?.[0];
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const type = ext === 'djvu' ? 'djvu' : ext === 'epub' ? 'epub' : ext === 'pdf' ? 'pdf' : 'image';
      createTab(file.name, file, type);
    });
  }

  // New tab button opens file dialog
  if (tabBarNewBtn) {
    tabBarNewBtn.addEventListener('click', () => {
      origFileInput?.click();
    });
  }

  // Create initial tab if a file is already loaded
  if (state.docName) {
    createTab(state.docName, state.file, state.adapter?.type || 'pdf');
  }

  /** @type {any} */ (window)._novaTabs = { createTab, switchToTab, closeTab, tabs };
}

// ── Print Dialog ────────────────────────────────────────────────────────────
function initPrintDialog(deps) {
  const { state, parsePageRangeLib, setOcrStatus, pushDiagnosticEvent } = deps;

  const modal = document.getElementById('printModal');
  const closeBtn = document.getElementById('closePrintModal');
  const cancelBtn = document.getElementById('printCancel');
  const executeBtn = document.getElementById('printExecute');
  const previewCanvas = document.getElementById('printPreviewCanvas');
  const previewInfo = document.getElementById('printPreviewInfo');
  const customRange = document.getElementById('printCustomRange');
  const scaleSelect = document.getElementById('printScale');
  const customScale = document.getElementById('printCustomScale');

  if (!modal) return;

  function openPrintDialog() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    updatePreview();
  }

  function closePrintDialog() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Range radio buttons
  modal.querySelectorAll('input[name="printRange"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (customRange) /** @type {any} */ (customRange).disabled = /** @type {HTMLInputElement} */ (radio).value !== 'custom';
    });
  });

  // Scale select
  if (scaleSelect && customScale) {
    scaleSelect.addEventListener('change', () => {
      /** @type {any} */ (customScale).disabled = /** @type {any} */ (scaleSelect).value !== 'custom';
    });
  }

  // Preview
  async function updatePreview() {
    if (!previewCanvas || !state.adapter) return;
    try {
      const page = state.currentPage || 1;
      await state.adapter.renderPage(page, previewCanvas, { zoom: 0.3, rotation: 0 });
      if (previewInfo) {
        previewInfo.textContent = `Стр. ${page} из ${state.pageCount || '?'}`;
      }
    } catch (err) { console.warn('[app] non-critical error:', err?.message); }
  }

  // Execute print
  if (executeBtn) {
    executeBtn.addEventListener('click', async () => {
      if (!state.adapter) return;

      const rangeRadio = modal.querySelector('input[name="printRange"]:checked');
      const range = /** @type {any} */ (rangeRadio)?.value || 'all';
      const dpi = parseInt(/** @type {any} */ (document.getElementById('printDpi'))?.value || '300', 10);
      const _includeAnnotations = /** @type {any} */ (document.getElementById('printAnnotations'))?.checked ?? true;

      let pages = [];
      if (range === 'current') {
        pages = [state.currentPage || 1];
      } else if (range === 'custom' && /** @type {any} */ (customRange)?.value) {
        pages = parsePageRangeLib(/** @type {any} */ (customRange).value, state.pageCount);
      } else {
        pages = Array.from({ length: state.pageCount }, (_, i) => i + 1);
      }

      if (!pages.length) {
        if (previewInfo) previewInfo.textContent = 'Неверный диапазон страниц';
        return;
      }

      closePrintDialog();

      // Render pages to print
      setOcrStatus(`Подготовка к печати: ${pages.length} стр.`);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setOcrStatus('Браузер заблокировал всплывающее окно печати');
        return;
      }

      printWindow.document.write('<html><head><title>Печать</title><style>');
      printWindow.document.write('body{margin:0;} canvas{page-break-after:always;display:block;width:100%;} @media print{canvas{page-break-after:always;}}');
      printWindow.document.write('</style></head><body>');

      const scale = dpi / 72;
      try {
        for (const pageNum of pages) {
          const canvas = document.createElement('canvas');
          await state.adapter.renderPage(pageNum, canvas, { zoom: scale, rotation: 0 });
          printWindow.document.body.appendChild(canvas);
        }
      } catch (renderErr) {
        console.warn('[ui-init-blocks] print render error:', renderErr?.message);
        try { printWindow.close(); } catch (_e) { /* ignore */ }
        setOcrStatus(`Ошибка рендеринга при печати: ${renderErr?.message || 'неизвестная'}`);
        return;
      }

      printWindow.document.write('</body></html>');
      printWindow.document.close();

      safeTimeout(() => {
        printWindow.print();
        setOcrStatus(`Печать: ${pages.length} стр. отправлено`);
      }, 500);

      pushDiagnosticEvent('print', { pages: pages.length, dpi });
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closePrintDialog);
  if (cancelBtn) cancelBtn.addEventListener('click', closePrintDialog);

  // Ctrl+P opens print dialog
  _trackOn(document, 'keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      openPrintDialog();
    }
  });

  /** @type {any} */ (window)._novaPrint = { openPrintDialog, closePrintDialog };
}

// ── Shortcuts Quick Reference ───────────────────────────────────────────────
function initShortcutsRef(/* deps not needed */) {
  const modal = document.getElementById('shortcutsModal');
  const closeBtn = document.getElementById('closeShortcutsModal');
  if (!modal) return;

  function openShortcuts() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeShortcuts() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeShortcuts);

  // Press "?" to show shortcuts reference
  _trackOn(document, 'keydown', (e) => {
    if (/** @type {HTMLElement} */ (e.target).matches('input, textarea, select, [contenteditable]')) return;
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (modal.classList.contains('open')) closeShortcuts();
      else openShortcuts();
    }
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeShortcuts();
    }
  });

  // Close on backdrop click
  _trackOn(modal, 'click', (e) => {
    if (e.target === modal) closeShortcuts();
  });

  /** @type {any} */ (window)._novaShortcuts = { openShortcuts, closeShortcuts };
}

// ── Right Panel + Floating Search + Tool Switching ──────────────────────────
function initNovaReader3UI(/* deps not needed */) {
  const appShell = document.querySelector('.app-shell');
  const rightPanel = document.getElementById('rightPanel');
  const rpTitle = document.getElementById('rpTitle');
  const closeRightPanel = document.getElementById('closeRightPanel');
  const searchFloating = document.getElementById('searchFloating');
  const closeSearchBtn = document.getElementById('closeSearch');

  const TOOL_TITLES = {
    'search': 'Поиск',
    'annotations': 'Аннотации',
    'text-ocr': 'Текст / OCR',
    'forms': 'Формы PDF',
    'tools': 'Инструменты',
    'organize': 'Организация страниц',
  };

  let activeToolPanel = null;

  // ── Open a right panel by tool name ──
  function openRightPanel(toolName) {
    if (!appShell || !rightPanel) return;

    // Close all panels
    rightPanel.querySelectorAll('.rp-panel').forEach(p => p.classList.remove('active'));

    // Activate selected panel
    const panel = rightPanel.querySelector(`.rp-panel[data-rp-panel="${toolName}"]`);
    if (panel) {
      panel.classList.add('active');
      appShell.classList.add('right-panel-open');
      if (rpTitle) rpTitle.textContent = TOOL_TITLES[toolName] || 'Инструменты';
      activeToolPanel = toolName;
    }

    // Update toolbar button states
    document.querySelectorAll('.cb-tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', /** @type {HTMLElement} */ (btn).dataset.tool === toolName);
    });
  }

  function closeRightPanelFn() {
    if (!appShell) return;
    appShell.classList.remove('right-panel-open');
    rightPanel?.querySelectorAll('.rp-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.cb-tool-btn[data-tool]').forEach(btn => btn.classList.remove('active'));
    activeToolPanel = null;
  }

  // ── Tool buttons in command bar ──
  document.querySelectorAll('.cb-tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = /** @type {HTMLElement} */ (btn).dataset.tool;

      // Search tool opens floating search bar instead of right panel
      if (tool === 'search') {
        toggleFloatingSearch(true);
        return;
      }

      // Toggle: if same tool clicked, close panel
      if (activeToolPanel === tool) {
        closeRightPanelFn();
      } else {
        openRightPanel(tool);
      }
    });
  });

  // Close right panel button
  if (closeRightPanel) {
    closeRightPanel.addEventListener('click', closeRightPanelFn);
  }

  // ── Floating search ──
  function toggleFloatingSearch(show) {
    if (!searchFloating) return;
    if (show === undefined) show = !searchFloating.classList.contains('open');
    searchFloating.classList.toggle('open', show);
    if (show) {
      const input = searchFloating.querySelector('#searchInput');
      if (input) safeTimeout(() => /** @type {HTMLElement} */ (input).focus(), 50);
    }
  }

  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => toggleFloatingSearch(false));
  }

  // Ctrl+F opens floating search
  _trackOn(document, 'keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleFloatingSearch(true);
    }
    if (e.key === 'Escape' && searchFloating?.classList.contains('open')) {
      toggleFloatingSearch(false);
    }
  });

  // ── Sidebar toggle ──
  // Note: sidebar toggle is wired in init-event-bindings.js via toggleLayoutState('sidebarHidden')
  // which handles both localStorage persistence and DOM class updates via applyLayoutState().

  // ── Make sidebar tabs work with new left panel layout ──
  document.querySelectorAll('.lp-tabs button[data-sidebar-tab], .sidebar-tabs button[data-sidebar-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabNav = btn.closest('.lp-tabs, .sidebar-tabs');
      const sidebar = btn.closest('.left-panel, .sidebar');
      if (!tabNav || !sidebar) return;

      tabNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      sidebar.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      const panel = sidebar.querySelector(`.sidebar-panel[data-sidebar-panel="${/** @type {HTMLElement} */ (btn).dataset.sidebarTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Expose for other modules
  /** @type {any} */ (window)._novaUI = { openRightPanel, closeRightPanel: closeRightPanelFn, toggleFloatingSearch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single entry point
// ═══════════════════════════════════════════════════════════════════════════════

/** @param {any} deps @returns {any} */
export function initUiBlocks(deps) {
  initContinuousScroll(deps);
  initBatchOcrUI(deps);
  initDragDropAndHotkeys();
  initTabBar(deps);
  initPrintDialog(deps);
  initShortcutsRef();
  initNovaReader3UI();
}
