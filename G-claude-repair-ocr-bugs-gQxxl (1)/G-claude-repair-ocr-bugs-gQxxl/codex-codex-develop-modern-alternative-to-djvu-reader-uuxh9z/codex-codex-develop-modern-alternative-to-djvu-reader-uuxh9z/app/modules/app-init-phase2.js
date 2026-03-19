// app-init-phase2.js — Phase 2+ module initialization, extracted from app.js
import { state, els } from './state.js';
import { setViewMode, VIEW_MODES } from './view-modes.js';
import { extractTextForPage } from './ocr-controller.js';
import { convertToHtml, downloadHtml } from './html-converter.js';
import { initEnhancedZoom, ZOOM_PRESETS, zoomToPreset, startMarqueeZoom, smoothZoomTo } from './enhanced-zoom.js';
import { initTouchGestures, setupVirtualKeyboardAdaptation } from './touch-gestures.js';
import { initMinimap, saveReadingPosition } from './navigation.js';
import { initErrorHandler, registerRecovery, onError, ERROR_CODES } from './error-handler.js';
import { openDatabase } from './indexed-storage.js';
import { findAndReplace } from './pdf-text-edit.js';
import { cleanMetadata, sanitizePdf } from './pdf-security.js';
import { extractMultiPageText, downloadText } from './text-extractor.js';
import { initMemoryManager, forceCleanup } from './memory-manager.js';
import { MODULE_STATUS as CLOUD_STATUS } from './cloud-integration.js';
import { MODULE_STATUS as AI_STATUS } from './ai-features.js';
import { initDragDrop } from './drag-drop.js';
import { convertToPdfA } from './pdf-a-converter.js';
import { nrPrompt } from './modal-prompt.js';
import { toastSuccess, toastError, toastWarning, toastInfo, toastProgress } from './toast.js';
import { mergePdfDocuments } from './pdf-operations.js';
import { clearPageRenderCache, revokeAllTrackedUrls } from './perf.js';
import { _updatePageUI } from './render-controller.js';

export function initPhase2Modules(deps) {
  const { renderCurrentPage, goToPage } = deps;

  // ─── UI Tab Switching (sidebar, bottom toolbar, settings modal) ──────────────
  // Sidebar tabs
  document.querySelectorAll('.sidebar-tabs button[data-sidebar-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`.sidebar-panel[data-sidebar-panel="${btn.dataset.sidebarTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Bottom toolbar tabs
  document.querySelectorAll('.bottom-tab-bar button[data-bottom-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bottom-tab-bar button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.bottom-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`.bottom-tab-panel[data-bottom-panel="${btn.dataset.bottomTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Settings modal tabs
  document.querySelectorAll('.modal-tabs button[data-modal-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.querySelector(`.modal-tab-panel[data-modal-panel="${btn.dataset.modalTab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  // Dropdown menus — toggle on click, close on outside click
  document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = trigger.closest('.dropdown');
      const wasOpen = dd.classList.contains('open');
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  });
  // Close dropdown when a menu item is clicked
  document.querySelectorAll('.dropdown-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.dropdown')?.classList.remove('open');
    });
  });

  // ─── Status Bar Updates ─────────────────────────────────────────────────────
  function updateStatusBar() {
    if (els.sbPage) els.sbPage.textContent = `\u0421\u0442\u0440. ${state.currentPage} / ${state.pageCount || '\u2014'}`;
    if (els.sbZoom) els.sbZoom.textContent = `${Math.round(state.zoom * 100)}%`;
    if (els.sbReadingTime) {
      const mins = Math.round((state.readingTotalMs || 0) / 60000);
      els.sbReadingTime.textContent = `\u0427\u0442\u0435\u043d\u0438\u0435: ${mins} \u043c\u0438\u043d`;
    }
    if (els.sbFileSize && state.file) {
      const bytes = state.file.size || 0;
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      els.sbFileSize.textContent = bytes > 0 ? `${mb} \u041c\u0411` : '\u2014';
    }
  }
  // Hook status bar into page changes
  const _origUpdatePageUI = typeof _updatePageUI === 'function' ? _updatePageUI : null;
  // Call updateStatusBar after page renders
  setInterval(updateStatusBar, 2000);
  updateStatusBar();

  // ─── View Mode Dropdown Handler ──────────────────────────────────────────────
  {
    const dd = document.getElementById('viewModeDropdown');
    if (dd) {
      const trigger = dd.querySelector('.dropdown-trigger');
      const menu = dd.querySelector('.dropdown-menu');

      trigger?.addEventListener('click', () => {
        dd.classList.toggle('open');
        trigger.setAttribute('aria-expanded', dd.classList.contains('open') ? 'true' : 'false');
      });

      menu?.querySelectorAll('[data-view-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.viewMode;
          setViewMode(mode);
          menu.querySelectorAll('.dropdown-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          dd.classList.remove('open');
          trigger?.setAttribute('aria-expanded', 'false');
        });
      });

      document.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          trigger?.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  // ─── HTML Export Button Handler ──────────────────────────────────────────────
  {
    const btn = document.getElementById('exportHtml');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!state.adapter || state.pageCount === 0) return;
        const pages = [];
        for (let i = 1; i <= state.pageCount; i++) {
          const text = await extractTextForPage(i);
          pages.push({ text: text || '', items: [] });
        }
        const html = convertToHtml(pages, { title: state.docName || 'Document' });
        downloadHtml(html, (state.docName || 'document').replace(/\.[^.]+$/, '') + '.html');
        toastSuccess('\u042d\u043a\u0441\u043f\u043e\u0440\u0442 HTML \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d');
      });
    }
  }

  // ─── Initialize Enhanced Zoom ────────────────────────────────────────────────
  initEnhancedZoom({
    getZoom: () => state.zoom,
    setZoom: (z) => { state.zoom = z; els.zoomStatus.textContent = `${Math.round(z * 100)}%`; },
    render: () => renderCurrentPage(),
    canvasWrap: els.canvasWrap,
    canvas: els.canvas,
  });

  // ─── Initialize Touch Gestures ───────────────────────────────────────────────
  initTouchGestures({
    nextPage: () => els.nextPage?.click(),
    prevPage: () => els.prevPage?.click(),
    viewport: document.querySelector('.document-viewport'),
  });
  setupVirtualKeyboardAdaptation();

  // ─── Initialize Minimap ──────────────────────────────────────────────────────
  initMinimap(
    document.querySelector('.document-viewport'),
    els.canvas,
    els.canvasWrap
  );

  // ─── Save/Restore Reading Position ───────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    if (state.docName && state.currentPage) {
      saveReadingPosition(state.docName, { page: state.currentPage, zoom: state.zoom });
    }
  });

  // ─── Initialize Error Handler ─────────────────────────────────────────────
  initErrorHandler();
  registerRecovery(ERROR_CODES.MEMORY, () => {
    clearPageRenderCache();
    revokeAllTrackedUrls();
    toastWarning('\u041d\u0435\u0445\u0432\u0430\u0442\u043a\u0430 \u043f\u0430\u043c\u044f\u0442\u0438 \u2014 \u043a\u044d\u0448 \u043e\u0447\u0438\u0449\u0435\u043d');
  });
  registerRecovery(ERROR_CODES.RENDER, () => {
    toastInfo('\u041e\u0448\u0438\u0431\u043a\u0430 \u0440\u0435\u043d\u0434\u0435\u0440\u0438\u043d\u0433\u0430 \u2014 \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u0430\u044f \u043f\u043e\u043f\u044b\u0442\u043a\u0430...');
    try { renderCurrentPage(); } catch (err) { console.error('[render] recovery render failed:', err); }
  });
  onError((err) => {
    if (err.severity === 'fatal') {
      toastError(`\u041a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430: ${err.message}`);
    }
  });

  // ─── Initialize IndexedDB ─────────────────────────────────────────────────
  openDatabase().catch(() => { /* IndexedDB not available */ });

  // ─── PDF Text Edit Button Handler ─────────────────────────────────────────
  {
    const findReplaceBtn = document.getElementById('pdfFindReplace');
    if (findReplaceBtn) {
      findReplaceBtn.addEventListener('click', async () => {
        if (!state.pdfBytes || state.pageCount === 0) {
          toastWarning('\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 PDF \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442');
          return;
        }
        const search = await nrPrompt('\u041d\u0430\u0439\u0442\u0438 \u0442\u0435\u043a\u0441\u0442:');
        if (!search) return;
        const replace = await nrPrompt('\u0417\u0430\u043c\u0435\u043d\u0438\u0442\u044c \u043d\u0430:');
        if (replace === null) return;
        try {
          const result = await findAndReplace(state.pdfBytes, search, replace);
          if (result.replacements > 0) {
            state.pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
            renderCurrentPage();
            toastSuccess(`\u0417\u0430\u043c\u0435\u043d\u0435\u043d\u043e: ${result.replacements}`);
          } else {
            toastInfo('\u0421\u043e\u0432\u043f\u0430\u0434\u0435\u043d\u0438\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e');
          }
        } catch (err) {
          toastError('\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u0438\u0441\u043a\u0430/\u0437\u0430\u043c\u0435\u043d\u044b: ' + err.message);
        }
      });
    }
  }

  // ─── PDF Security Button Handler ──────────────────────────────────────────
  {
    const cleanMetaBtn = document.getElementById('cleanMetadata');
    if (cleanMetaBtn) {
      cleanMetaBtn.addEventListener('click', async () => {
        if (!state.pdfBytes) { toastWarning('\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 PDF \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442'); return; }
        try {
          const result = await cleanMetadata(state.pdfBytes);
          state.pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
          toastSuccess(`\u041c\u0435\u0442\u0430\u0434\u0430\u043d\u043d\u044b\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u044b: ${result.removed.join(', ')}`);
        } catch (err) {
          toastError('\u041e\u0448\u0438\u0431\u043a\u0430: ' + err.message);
        }
      });
    }

    const sanitizeBtn = document.getElementById('sanitizePdf');
    if (sanitizeBtn) {
      sanitizeBtn.addEventListener('click', async () => {
        if (!state.pdfBytes) { toastWarning('\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 PDF \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442'); return; }
        try {
          const result = await sanitizePdf(state.pdfBytes);
          state.pdfBytes = new Uint8Array(await result.blob.arrayBuffer());
          toastSuccess(`\u0421\u0430\u043d\u0438\u0442\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043e: ${result.sanitized.join(', ') || '\u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e'}`);
        } catch (err) {
          toastError('\u041e\u0448\u0438\u0431\u043a\u0430: ' + err.message);
        }
      });
    }
  }

  // ─── Plain Text Export Handler ────────────────────────────────────────────
  {
    const btn = document.getElementById('exportPlainText');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!state.adapter || state.pageCount === 0) return;
        const progress = toastProgress('\u0418\u0437\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u0435 \u0442\u0435\u043a\u0441\u0442\u0430...', 0);
        try {
          let allText = '';
          for (let i = 1; i <= state.pageCount; i++) {
            const text = await extractTextForPage(i);
            allText += `--- \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 ${i} ---\n${text || ''}\n\n`;
            progress.update(Math.round((i / state.pageCount) * 100));
          }
          const filename = (state.docName || 'document').replace(/\.[^.]+$/, '') + '.txt';
          downloadText(allText, filename);
          progress.update(100);
          setTimeout(() => progress.dismiss(), 500);
          toastSuccess('\u0422\u0435\u043a\u0441\u0442 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d');
        } catch (err) {
          progress.dismiss();
          toastError('\u041e\u0448\u0438\u0431\u043a\u0430 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430: ' + err.message);
        }
      });
    }
  }

  // ─── Initialize Memory Manager ────────────────────────────────────────────
  initMemoryManager();
  window.addEventListener('memory-warning', (e) => {
    toastWarning(`\u0412\u044b\u0441\u043e\u043a\u043e\u0435 \u043f\u043e\u0442\u0440\u0435\u0431\u043b\u0435\u043d\u0438\u0435 \u043f\u0430\u043c\u044f\u0442\u0438: ${e.detail.usedMB} \u041c\u0411`);
    forceCleanup();
  });

  // ─── Q2.3: Graceful degradation for stub/partial modules ─────────────────
  {
    // Cloud integration is a stub — disable cloud UI elements
    if (CLOUD_STATUS === 'stub') {
      const cloudBtns = [els.pushCloudSync, els.pullCloudSync, els.saveCloudSyncUrl];
      for (const btn of cloudBtns) {
        if (btn) {
          btn.disabled = true;
          btn.title = '\u041e\u0431\u043b\u0430\u0447\u043d\u0430\u044f \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044f: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 OAuth2';
        }
      }
      const cloudInput = document.getElementById('cloudSyncUrl');
      if (cloudInput) {
        cloudInput.disabled = true;
        cloudInput.placeholder = 'Cloud: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 (stub)';
      }
    }
    // AI features are partial (heuristic-only) — show notice
    if (AI_STATUS === 'partial') {
      const aiBtn = document.getElementById('aiSummarize');
      if (aiBtn) aiBtn.title = 'AI: \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u044d\u0432\u0440\u0438\u0441\u0442\u0438\u043a\u0430 (\u0431\u0435\u0437 \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e API)';
    }
  }

  // ─── Initialize Drag & Drop ──────────────────────────────────────────────
  initDragDrop({
    viewport: document.querySelector('.document-viewport'),
    thumbnailGrid: document.querySelector('.thumbnail-grid'),
    openFile: (file) => {
      const input = els.fileInput;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
    },
    mergePdf: async (files) => {
      try {
        const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
        const uints = buffers.map(b => new Uint8Array(b));
        const merged = await mergePdfDocuments(uints);
        state.pdfBytes = new Uint8Array(await merged.arrayBuffer());
        toastSuccess(`\u041e\u0431\u044a\u0435\u0434\u0438\u043d\u0435\u043d\u043e ${files.length} PDF \u0444\u0430\u0439\u043b\u043e\u0432`);
      } catch (err) {
        toastError('\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u044a\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f: ' + err.message);
      }
    },
    reorderPages: (from, to) => {
      toastInfo(`\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 ${from} \u2192 ${to}`);
    },
  });

  // ─── PDF/A Export Handler ─────────────────────────────────────────────────
  {
    const btn = document.getElementById('exportPdfA');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!state.pdfBytes) { toastWarning('\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 PDF \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442'); return; }
        try {
          const result = await convertToPdfA(state.pdfBytes, { title: state.docName });
          const filename = (state.docName || 'document').replace(/\.[^.]+$/, '') + '-pdfa.pdf';
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          toastSuccess('PDF/A \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d');
          if (result.report.issues.length > 0) {
            toastWarning(`\u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f: ${result.report.issues.join('; ')}`);
          }
        } catch (err) {
          toastError('\u041e\u0448\u0438\u0431\u043a\u0430 PDF/A: ' + err.message);
        }
      });
    }
  }
}
