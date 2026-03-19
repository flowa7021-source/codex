// ═══════════════════════════════════════════════════════════════════════════════
// NovaReader 3.0 — UI Init Blocks (extracted from app.js)
// Continuous Scroll, Batch OCR UI, Drag & Drop + Hotkeys, Tab Bar,
// Print Dialog, Shortcuts Reference, Right Panel + Floating Search
// ═══════════════════════════════════════════════════════════════════════════════

// ── Continuous Scroll Mode ──────────────────────────────────────────────────
function initContinuousScroll(deps) {
  const { state } = deps;
  const toggleBtn = document.getElementById('toggleContinuousScroll');
  const canvasWrap = document.getElementById('canvasWrap');
  const scrollWrap = document.getElementById('continuousScrollWrap');
  const scrollContainer = document.getElementById('continuousScrollContainer');
  let continuousMode = false;
  let renderedPages = new Set();
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
      canvas.dataset.pageNum = i;
      canvas.width = 800;
      canvas.height = 1100;
      canvas.style.width = '100%';
      canvas.style.maxWidth = '800px';
      canvas.style.background = '#e8e8e8';
      scrollContainer.appendChild(canvas);
    }

    // Use IntersectionObserver for lazy rendering
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
    scrollObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.pageNum, 10);
          if (!renderedPages.has(pageNum)) {
            renderedPages.add(pageNum);
            renderScrollPage(pageNum, entry.target);
          }
        }
      }
    }, { rootMargin: '200px 0px' });

    scrollContainer.querySelectorAll('canvas[data-page-num]').forEach(c => scrollObserver.observe(c));

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
      canvas.style.background = '#fdd';
    }
  }

  function exitContinuousMode() {
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
    scrollWrap.style.display = 'none';
    canvasWrap.style.display = '';
    scrollContainer.innerHTML = '';
    renderedPages.clear();
  }

  window._novaContinuousScroll = { enterContinuousMode, exitContinuousMode };
}

// ── Batch OCR UI Integration ────────────────────────────────────────────────
function initBatchOcrUI(deps) {
  const { state, recognizeWithBoxes, batchOcr, createSearchablePdf, detectScannedDocument, autoDetectLanguage, safeCreateObjectURL, pushDiagnosticEvent, setOcrStatus } = deps;

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
            const result = await recognizeWithBoxes(canvas, lang);
            return { text: result.text, words: result.words, confidence: result.confidence };
          },
          totalPages: state.pageCount,
          language: autoDetectLanguage(''),
          onProgress: (pageNum, total, status) => {
            setBatchStatus(status);
            if (progressBar && total > 0) {
              progressBar.value = Math.round((pageNum / total) * 100);
            }
          },
        });

        if (progressBar) progressBar.style.display = 'none';
        setBatchStatus(result.cancelled
          ? `OCR отменён: обработано ${result.processed} из ${result.total} страниц`
          : `OCR завершён: ${result.processed} страниц`);
        pushDiagnosticEvent('batch-ocr.done', { processed: result.processed, total: result.total });
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
        const url = safeCreateObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.docName || 'document'}-searchable.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setBatchStatus(`Searchable PDF создан: ${result.pagesProcessed} страниц`);
        pushDiagnosticEvent('searchable-pdf.created', { pages: result.pagesProcessed });
      } catch (err) {
        setBatchStatus(`Ошибка: ${err?.message || 'неизвестная'}`);
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
          openInput.files = dt.files;
          openInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  }

  // ── Extended Hotkeys ──
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in input/textarea
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;

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
    tab.dataset.tabId = id;
    tab.innerHTML = `
      <span class="tab-icon">${type === 'pdf' ? '📄' : type === 'djvu' ? '📘' : type === 'epub' ? '📗' : '🖼'}</span>
      <span class="tab-label">${name}</span>
      <button class="tab-close" title="Закрыть">✕</button>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close')) return;
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
      t.classList.toggle('active', parseInt(t.dataset.tabId) === id);
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
      const file = origFileInput.files?.[0];
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

  window._novaTabs = { createTab, switchToTab, closeTab, tabs };
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
      if (customRange) customRange.disabled = radio.value !== 'custom';
    });
  });

  // Scale select
  if (scaleSelect && customScale) {
    scaleSelect.addEventListener('change', () => {
      customScale.disabled = scaleSelect.value !== 'custom';
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
      const range = rangeRadio?.value || 'all';
      const dpi = parseInt(document.getElementById('printDpi')?.value || '300', 10);
      const includeAnnotations = document.getElementById('printAnnotations')?.checked ?? true;

      let pages = [];
      if (range === 'current') {
        pages = [state.currentPage || 1];
      } else if (range === 'custom' && customRange?.value) {
        pages = parsePageRangeLib(customRange.value, state.pageCount);
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
      for (const pageNum of pages) {
        const canvas = document.createElement('canvas');
        await state.adapter.renderPage(pageNum, canvas, { zoom: scale, rotation: 0 });
        printWindow.document.body.appendChild(canvas);
      }

      printWindow.document.write('</body></html>');
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
        setOcrStatus(`Печать: ${pages.length} стр. отправлено`);
      }, 500);

      pushDiagnosticEvent('print', { pages: pages.length, dpi });
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closePrintDialog);
  if (cancelBtn) cancelBtn.addEventListener('click', closePrintDialog);

  // Ctrl+P opens print dialog
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      openPrintDialog();
    }
  });

  window._novaPrint = { openPrintDialog, closePrintDialog };
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
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;
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
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeShortcuts();
  });

  window._novaShortcuts = { openShortcuts, closeShortcuts };
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
      btn.classList.toggle('active', btn.dataset.tool === toolName);
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
      const tool = btn.dataset.tool;

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
      if (input) setTimeout(() => input.focus(), 50);
    }
  }

  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => toggleFloatingSearch(false));
  }

  // Ctrl+F opens floating search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleFloatingSearch(true);
    }
    if (e.key === 'Escape' && searchFloating?.classList.contains('open')) {
      toggleFloatingSearch(false);
    }
  });

  // ── Sidebar toggle (Acrobat Pro style) ──
  const toggleSidebarBtn = document.getElementById('toggleSidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      if (appShell) {
        appShell.classList.toggle('sidebar-hidden');
        toggleSidebarBtn.classList.toggle('active', !appShell.classList.contains('sidebar-hidden'));
      }
    });
  }

  // ── Make sidebar tabs work with new left panel layout ──
  document.querySelectorAll('.lp-tabs button[data-sidebar-tab], .sidebar-tabs button[data-sidebar-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabNav = btn.closest('.lp-tabs, .sidebar-tabs');
      const sidebar = btn.closest('.left-panel, .sidebar');
      if (!tabNav || !sidebar) return;

      tabNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      sidebar.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      const panel = sidebar.querySelector(`.sidebar-panel[data-sidebar-panel="${btn.dataset.sidebarTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Expose for other modules
  window._novaUI = { openRightPanel, closeRightPanel: closeRightPanelFn, toggleFloatingSearch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single entry point
// ═══════════════════════════════════════════════════════════════════════════════

export function initUiBlocks(deps) {
  initContinuousScroll(deps);
  initBatchOcrUI(deps);
  initDragDropAndHotkeys(deps);
  initTabBar(deps);
  initPrintDialog(deps);
  initShortcutsRef(deps);
  initNovaReader3UI(deps);
}
