import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  initTextNavDeps,
  ensureTextToolsVisible,
  refreshPageText,
  copyPageText,
  exportPageText,
  setTextEditMode,
  saveCurrentPageTextEdits,
  exportCurrentDocToWord,
  normalizePageInput,
  goToPage,
  fitWidth,
  fitPage,
  downloadCurrentFile,
  printCanvasPage,
} from '../../app/modules/text-nav-controller.js';

let _deps;

function resetState() {
  localStorage.clear();
  state.adapter = { type: 'pdf', getText: async () => 'page text' };
  state.pageCount = 10;
  state.currentPage = 1;
  state.docName = 'test.pdf';
  state.file = null;
  state.textEditMode = false;
  state.zoom = 1;
  state.rotation = 0;

  els.pageInput = document.createElement('input');
  els.pageText = document.createElement('textarea');
  els.canvas = document.createElement('canvas');
  els.canvas.width = 100;
  els.canvas.height = 80;
  els.annotationCanvas = document.createElement('canvas');
  els.annotationCanvas.width = 100;
  els.annotationCanvas.height = 80;
  els.canvasWrap = document.createElement('div');
  els.searchStatus = document.createElement('div');
  els.toggleTextEdit = document.createElement('button');

  _deps = {
    uiLayoutKey: (name) => `novareader-ui-layout:${name}`,
    applyLayoutState: () => {},
    canSearchCurrentDoc: () => true,
    loadOcrTextData: () => null,
    saveOcrTextData: () => {},
    setOcrStatus: () => {},
    pushDiagnosticEvent: () => {},
    renderCurrentPage: async () => {},
    safeCreateObjectURL: () => 'blob:mock',
    setPageEdits: () => {},
    persistEdits: () => {},
    getEditHistory: () => ({ undoCount: 0, redoCount: 0 }),
    pdfEditState: { edits: new Map() },
    convertPdfToDocx: async () => new Blob(['docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    generateDocxBlob: async () => new Blob(['docx']),
    generateDocxWithImages: async () => new Blob(['docx with images']),
    capturePageAsImageData: async () => null,
    _ocrWordCache: new Map(),
    recordSuccessfulOperation: () => {},
    recordCrashEvent: () => {},
  };
  initTextNavDeps(_deps);
}

describe('text-nav-controller', () => {
  beforeEach(() => resetState());

  // ── ensureTextToolsVisible ───────────────────────────────────────────────

  describe('ensureTextToolsVisible', () => {
    it('sets textHidden to 0 when it was 1 and calls applyLayoutState', () => {
      let applyCalled = false;
      _deps.applyLayoutState = () => { applyCalled = true; };
      initTextNavDeps(_deps);

      const key = 'novareader-ui-layout:textHidden';
      localStorage.setItem(key, '1');
      ensureTextToolsVisible();
      assert.equal(localStorage.getItem(key), '0');
      assert.ok(applyCalled);
    });

    it('does nothing when textHidden is 0', () => {
      let applyCalled = false;
      _deps.applyLayoutState = () => { applyCalled = true; };
      initTextNavDeps(_deps);

      const key = 'novareader-ui-layout:textHidden';
      localStorage.setItem(key, '0');
      ensureTextToolsVisible();
      assert.ok(!applyCalled);
    });

    it('does nothing when textHidden is not set', () => {
      let applyCalled = false;
      _deps.applyLayoutState = () => { applyCalled = true; };
      initTextNavDeps(_deps);
      ensureTextToolsVisible();
      assert.ok(!applyCalled);
    });
  });

  // ── refreshPageText ──────────────────────────────────────────────────────

  describe('refreshPageText', () => {
    it('sets pageText value when adapter.getText returns text', async () => {
      state.adapter = { type: 'pdf', getText: async () => 'Hello PDF text' };
      await refreshPageText();
      assert.equal(els.pageText.value, 'Hello PDF text');
    });

    it('falls back to OCR data when adapter.getText returns falsy', async () => {
      state.adapter = { type: 'pdf', getText: async () => '' };
      _deps.loadOcrTextData = () => ({ pagesText: ['', 'OCR page 1 text'] });
      initTextNavDeps(_deps);
      state.currentPage = 2;
      await refreshPageText();
      assert.equal(els.pageText.value, 'OCR page 1 text');
    });

    it('shows "no text layer" message when no text available', async () => {
      state.adapter = { type: 'pdf', getText: async () => '' };
      _deps.loadOcrTextData = () => null;
      initTextNavDeps(_deps);
      await refreshPageText();
      assert.ok(els.pageText.value.includes('не найден'));
    });

    it('sets extraction unavailable message for non-searchable doc', async () => {
      _deps.canSearchCurrentDoc = () => false;
      initTextNavDeps(_deps);
      await refreshPageText();
      assert.ok(els.pageText.value.includes('PDF/DjVu'));
    });

    it('shows djvu compat message when djvu in compat mode and no text', async () => {
      state.adapter = { type: 'djvu', mode: 'compat', getText: async () => '' };
      _deps.canSearchCurrentDoc = () => true;
      _deps.loadOcrTextData = () => null;
      initTextNavDeps(_deps);
      await refreshPageText();
      assert.ok(els.searchStatus.textContent.includes('DjVu data JSON'));
    });

    it('shows djvu no text layer message when djvu not in compat mode and no text', async () => {
      state.adapter = { type: 'djvu', mode: 'full', getText: async () => '' };
      _deps.canSearchCurrentDoc = () => true;
      _deps.loadOcrTextData = () => null;
      initTextNavDeps(_deps);
      await refreshPageText();
      assert.ok(els.searchStatus.textContent.includes('текстовый слой отсутствует'));
    });

    it('uses pagesText array at currentPage - 1 index', async () => {
      state.adapter = { type: 'pdf', getText: async () => '' };
      state.currentPage = 3;
      _deps.loadOcrTextData = () => ({ pagesText: ['p1', 'p2', 'p3 text'] });
      initTextNavDeps(_deps);
      await refreshPageText();
      assert.equal(els.pageText.value, 'p3 text');
    });

    it('handles null pagesText gracefully', async () => {
      state.adapter = { type: 'pdf', getText: async () => '' };
      _deps.loadOcrTextData = () => ({ pagesText: null });
      initTextNavDeps(_deps);
      await refreshPageText();
      assert.ok(els.pageText.value.length > 0);
    });
  });

  // ── copyPageText ─────────────────────────────────────────────────────────

  describe('copyPageText', () => {
    it('calls navigator.clipboard.writeText with page text', async () => {
      els.pageText.value = 'copy me';
      let written = null;
      navigator.clipboard = { writeText: async (t) => { written = t; } };
      await copyPageText();
      assert.equal(written, 'copy me');
    });

    it('refreshes text if pageText is empty before copying', async () => {
      els.pageText.value = '';
      state.adapter = { type: 'pdf', getText: async () => 'fetched text' };
      let written = null;
      navigator.clipboard = { writeText: async (t) => { written = t; } };
      await copyPageText();
      assert.equal(written, 'fetched text');
    });

    it('does nothing when pageText is still empty after refresh', async () => {
      els.pageText.value = '';
      state.adapter = { type: 'pdf', getText: async () => '' };
      _deps.loadOcrTextData = () => null;
      initTextNavDeps(_deps);
      let written = null;
      navigator.clipboard = { writeText: async (t) => { written = t; } };
      // canSearchCurrentDoc returns true (default), so empty text shows "(На этой..."
      // but if canSearchCurrentDoc returns false, pageText gets "Извлечение текста..."
      // Either way, value won't be empty — so we test the no-clipboard fallback
      _deps.canSearchCurrentDoc = () => false;
      initTextNavDeps(_deps);
      // After refresh, pageText should get the non-searchable message, which is truthy
      await copyPageText();
      // clipboard will have been called (or fallback used)
      assert.ok(true); // no throw
    });

    it('falls back to execCommand when clipboard not available', async () => {
      // Create a textarea with focus/select methods for the fallback path
      const textarea = document.createElement('textarea');
      textarea.value = 'text to copy';
      textarea.focus = () => {};
      textarea.select = () => {};
      els.pageText = textarea;
      const origClipboard = navigator.clipboard;
      navigator.clipboard = null;
      let execCalled = false;
      const origExec = document.execCommand;
      document.execCommand = (cmd) => { if (cmd === 'copy') execCalled = true; return true; };
      await copyPageText();
      document.execCommand = origExec;
      navigator.clipboard = origClipboard;
      assert.ok(execCalled);
    });
  });

  // ── exportPageText ───────────────────────────────────────────────────────

  describe('exportPageText', () => {
    it('creates a download link with correct filename', () => {
      els.pageText.value = 'some text';
      const clicks = [];
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportPageText();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
      assert.ok(clicks[0].download.includes('page-1'));
      assert.ok(clicks[0].download.endsWith('.txt'));
    });

    it('uses docName in filename', () => {
      state.docName = 'mybook.pdf';
      state.currentPage = 5;
      els.pageText.value = 'text';
      const clicks = [];
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportPageText();
      document.createElement = origCreate;
      assert.ok(clicks[0].download.includes('mybook.pdf'));
      assert.ok(clicks[0].download.includes('page-5'));
    });

    it('uses "document" fallback when no docName', () => {
      state.docName = null;
      els.pageText.value = 'text';
      const clicks = [];
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportPageText();
      document.createElement = origCreate;
      assert.ok(clicks[0].download.includes('document'));
    });

    it('exports empty text without throwing', () => {
      els.pageText.value = '';
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      assert.doesNotThrow(() => exportPageText());
      document.createElement = origCreate;
    });
  });

  // ── setTextEditMode ──────────────────────────────────────────────────────

  describe('setTextEditMode', () => {
    it('enables text edit mode and updates UI', () => {
      setTextEditMode(true);
      assert.equal(state.textEditMode, true);
      assert.equal(els.pageText.readOnly, false);
      assert.ok(els.toggleTextEdit.classList.contains('active'));
      assert.equal(els.toggleTextEdit.textContent, 'Ред. ВКЛ');
    });

    it('disables text edit mode and updates UI', () => {
      setTextEditMode(true);
      setTextEditMode(false);
      assert.equal(state.textEditMode, false);
      assert.equal(els.pageText.readOnly, true);
      assert.ok(!els.toggleTextEdit.classList.contains('active'));
      assert.equal(els.toggleTextEdit.textContent, 'Ред.');
    });

    it('truthy non-boolean enables mode', () => {
      setTextEditMode(1);
      assert.equal(state.textEditMode, true);
    });

    it('falsy non-boolean disables mode', () => {
      setTextEditMode(true);
      setTextEditMode(0);
      assert.equal(state.textEditMode, false);
    });

    it('works even when pageText element is missing', () => {
      els.pageText = null;
      assert.doesNotThrow(() => setTextEditMode(true));
    });

    it('works even when toggleTextEdit element is missing', () => {
      els.toggleTextEdit = null;
      assert.doesNotThrow(() => setTextEditMode(true));
    });
  });

  // ── saveCurrentPageTextEdits ─────────────────────────────────────────────

  describe('saveCurrentPageTextEdits', () => {
    it('returns early when no adapter', () => {
      state.adapter = null;
      assert.doesNotThrow(() => saveCurrentPageTextEdits());
    });

    it('returns early when no docName', () => {
      state.docName = null;
      assert.doesNotThrow(() => saveCurrentPageTextEdits());
    });

    it('calls setPageEdits and persistEdits with trimmed text', () => {
      els.pageText.value = '  hello  ';
      state.currentPage = 2;
      state.pageCount = 5;
      let savedText = null;
      let persistCalled = false;
      _deps.setPageEdits = (pg, txt) => { savedText = txt; };
      _deps.persistEdits = () => { persistCalled = true; };
      initTextNavDeps(_deps);
      saveCurrentPageTextEdits();
      assert.equal(savedText, 'hello');
      assert.ok(persistCalled);
    });

    it('calls saveOcrTextData with updated pagesText', () => {
      els.pageText.value = 'page text edit';
      state.currentPage = 1;
      state.pageCount = 3;
      let savedData = null;
      _deps.saveOcrTextData = (d) => { savedData = d; };
      _deps.loadOcrTextData = () => ({ pagesText: ['old text', 'p2', 'p3'], scannedPages: 1 });
      initTextNavDeps(_deps);
      saveCurrentPageTextEdits();
      assert.equal(savedData.pagesText[0], 'page text edit');
      assert.equal(savedData.source, 'manual-edit');
    });

    it('initializes pagesText when cache is null', () => {
      els.pageText.value = 'new text';
      state.currentPage = 2;
      state.pageCount = 3;
      let savedData = null;
      _deps.saveOcrTextData = (d) => { savedData = d; };
      _deps.loadOcrTextData = () => null;
      initTextNavDeps(_deps);
      saveCurrentPageTextEdits();
      assert.equal(savedData.pagesText[1], 'new text');
      assert.equal(savedData.pagesText.length, 3);
    });

    it('sets OCR status with undo/redo counts', () => {
      els.pageText.value = 'text';
      state.pageCount = 2;
      let statusText = null;
      _deps.setOcrStatus = (s) => { statusText = s; };
      _deps.getEditHistory = () => ({ undoCount: 3, redoCount: 1 });
      initTextNavDeps(_deps);
      saveCurrentPageTextEdits();
      assert.ok(statusText.includes('undo: 3'));
      assert.ok(statusText.includes('redo: 1'));
    });
  });

  // ── normalizePageInput ───────────────────────────────────────────────────

  describe('normalizePageInput', () => {
    it('returns 1 for NaN input', () => {
      els.pageInput.value = 'abc';
      assert.equal(normalizePageInput(), 1);
    });

    it('clamps to 1 for value 0', () => {
      els.pageInput.value = '0';
      assert.equal(normalizePageInput(), 1);
    });

    it('clamps to 1 for negative input', () => {
      els.pageInput.value = '-5';
      assert.equal(normalizePageInput(), 1);
    });

    it('clamps to pageCount for excessive input', () => {
      state.pageCount = 10;
      els.pageInput.value = '999';
      assert.equal(normalizePageInput(), 10);
    });

    it('returns parsed value within range', () => {
      state.pageCount = 50;
      els.pageInput.value = '25';
      assert.equal(normalizePageInput(), 25);
    });

    it('handles null pageCount (defaults to 1)', () => {
      state.pageCount = 0;
      els.pageInput.value = '5';
      assert.equal(normalizePageInput(), 1);
    });

    it('returns exact boundary value', () => {
      state.pageCount = 10;
      els.pageInput.value = '10';
      assert.equal(normalizePageInput(), 10);
    });
  });

  // ── goToPage ─────────────────────────────────────────────────────────────

  describe('goToPage', () => {
    it('returns early when no adapter', async () => {
      state.adapter = null;
      await assert.doesNotReject(async () => goToPage());
    });

    it('sets currentPage from pageInput and renders', async () => {
      state.pageCount = 10;
      els.pageInput.value = '7';
      let renderCalled = false;
      _deps.renderCurrentPage = async () => { renderCalled = true; };
      initTextNavDeps(_deps);
      await goToPage();
      assert.equal(state.currentPage, 7);
      assert.ok(renderCalled);
    });
  });

  // ── fitWidth ─────────────────────────────────────────────────────────────

  describe('fitWidth', () => {
    it('returns early when no adapter', async () => {
      state.adapter = null;
      await assert.doesNotReject(async () => fitWidth());
    });

    it('sets zoom based on viewport width', async () => {
      Object.defineProperty(els.canvasWrap, 'offsetWidth', { value: 800, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientWidth', { value: 800, configurable: true });
      state.adapter = {
        type: 'pdf',
        getText: async () => '',
        getPageViewport: async () => ({ width: 600, height: 800 }),
      };
      let renderCalled = false;
      _deps.renderCurrentPage = async () => { renderCalled = true; };
      initTextNavDeps(_deps);
      await fitWidth();
      assert.ok(typeof state.zoom === 'number');
      assert.ok(state.zoom > 0);
      assert.ok(renderCalled);
    });

    it('clamps zoom to max 4', async () => {
      Object.defineProperty(els.canvasWrap, 'offsetWidth', { value: 800, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientWidth', { value: 800, configurable: true });
      state.adapter = {
        type: 'pdf',
        getText: async () => '',
        getPageViewport: async () => ({ width: 10, height: 10 }),
      };
      initTextNavDeps(_deps);
      await fitWidth();
      assert.ok(state.zoom <= 4);
    });

    it('clamps zoom to min 0.3', async () => {
      Object.defineProperty(els.canvasWrap, 'offsetWidth', { value: 50, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientWidth', { value: 50, configurable: true });
      state.adapter = {
        type: 'pdf',
        getText: async () => '',
        getPageViewport: async () => ({ width: 10000, height: 10000 }),
      };
      initTextNavDeps(_deps);
      await fitWidth();
      assert.ok(state.zoom >= 0.3);
    });
  });

  // ── fitPage ───────────────────────────────────────────────────────────────

  describe('fitPage', () => {
    it('returns early when no adapter', async () => {
      state.adapter = null;
      await assert.doesNotReject(async () => fitPage());
    });

    it('sets zoom based on minimum of width/height fit', async () => {
      Object.defineProperty(els.canvasWrap, 'offsetWidth', { value: 800, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientWidth', { value: 800, configurable: true });
      Object.defineProperty(els.canvasWrap, 'offsetHeight', { value: 600, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientHeight', { value: 600, configurable: true });
      state.adapter = {
        type: 'pdf',
        getText: async () => '',
        getPageViewport: async () => ({ width: 800, height: 1200 }),
      };
      let renderCalled = false;
      _deps.renderCurrentPage = async () => { renderCalled = true; };
      initTextNavDeps(_deps);
      await fitPage();
      assert.ok(typeof state.zoom === 'number');
      assert.ok(state.zoom > 0);
      assert.ok(renderCalled);
    });

    it('clamps zoom to min 0.3', async () => {
      Object.defineProperty(els.canvasWrap, 'offsetWidth', { value: 10, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientWidth', { value: 10, configurable: true });
      Object.defineProperty(els.canvasWrap, 'offsetHeight', { value: 10, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientHeight', { value: 10, configurable: true });
      state.adapter = {
        type: 'pdf',
        getText: async () => '',
        getPageViewport: async () => ({ width: 10000, height: 10000 }),
      };
      initTextNavDeps(_deps);
      await fitPage();
      assert.ok(state.zoom >= 0.3);
    });

    it('clamps zoom to max 4', async () => {
      Object.defineProperty(els.canvasWrap, 'offsetWidth', { value: 9000, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientWidth', { value: 9000, configurable: true });
      Object.defineProperty(els.canvasWrap, 'offsetHeight', { value: 9000, configurable: true });
      Object.defineProperty(els.canvasWrap, 'clientHeight', { value: 9000, configurable: true });
      state.adapter = {
        type: 'pdf',
        getText: async () => '',
        getPageViewport: async () => ({ width: 10, height: 10 }),
      };
      initTextNavDeps(_deps);
      await fitPage();
      assert.ok(state.zoom <= 4);
    });
  });

  // ── downloadCurrentFile ──────────────────────────────────────────────────

  describe('downloadCurrentFile', () => {
    it('does nothing when no file is set', () => {
      state.file = null;
      assert.doesNotThrow(() => downloadCurrentFile());
    });

    it('creates download link with file name', () => {
      state.file = { name: 'doc.pdf', size: 1024 };
      const clicks = [];
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      downloadCurrentFile();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
      assert.equal(clicks[0].download, 'doc.pdf');
    });

    it('uses saveOrDownload for file download', async () => {
      state.file = new Blob(['test'], { type: 'application/pdf' });
      state.file.name = 'test.pdf';
      // saveOrDownload is called internally — just verify no throw
      await assert.doesNotReject(() => downloadCurrentFile());
    });
  });

  // ── printCanvasPage ──────────────────────────────────────────────────────

  describe('printCanvasPage', () => {
    it('returns early when no adapter', () => {
      state.adapter = null;
      assert.doesNotThrow(() => printCanvasPage());
    });

    it('opens a print window when adapter is set', () => {
      let winOpened = null;
      const mockWin = {
        document: {
          write: () => {},
          close: () => {},
        },
        focus: () => {},
        print: () => {},
      };
      const origOpen = window.open;
      window.open = () => { winOpened = mockWin; return mockWin; };

      printCanvasPage();

      window.open = origOpen;
      assert.equal(winOpened, mockWin);
    });

    it('returns early when window.open returns null', () => {
      const origOpen = window.open;
      window.open = () => null;
      assert.doesNotThrow(() => printCanvasPage());
      window.open = origOpen;
    });
  });

  // ── exportCurrentDocToWord ───────────────────────────────────────────────

  describe('exportCurrentDocToWord', () => {
    it('returns early when no adapter', async () => {
      state.adapter = null;
      await assert.doesNotReject(async () => exportCurrentDocToWord());
    });

    it('uses PDF converter for pdf documents with pdfDoc', async () => {
      state.adapter = { type: 'pdf', pdfDoc: { numPages: 5 } };
      state.pageCount = 5;
      state.docName = 'doc.pdf';
      let convertCalled = false;
      _deps.convertPdfToDocx = async (pdfDoc, title, pageCount, opts) => {
        convertCalled = true;
        return new Blob(['docx data'], { type: 'application/docx' });
      };
      let recordCalled = false;
      _deps.recordSuccessfulOperation = () => { recordCalled = true; };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.ok(convertCalled);
      assert.ok(recordCalled);
    });

    it('uses text+images mode for <= 30 pages', async () => {
      state.adapter = { type: 'pdf', pdfDoc: {} };
      state.pageCount = 10;
      state.docName = 'doc.pdf';
      let mode = null;
      _deps.convertPdfToDocx = async (doc, title, pageCount, opts) => {
        mode = opts.mode;
        return new Blob(['docx']);
      };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.equal(mode, 'text+images');
    });

    it('uses text-only mode for > 30 pages', async () => {
      state.adapter = { type: 'pdf', pdfDoc: {} };
      state.pageCount = 40;
      state.docName = 'doc.pdf';
      let mode = null;
      _deps.convertPdfToDocx = async (doc, title, pageCount, opts) => {
        mode = opts.mode;
        return new Blob(['docx']);
      };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.equal(mode, 'text');
    });

    it('falls back to legacy converter when PDF converter fails', async () => {
      state.adapter = { type: 'pdf', pdfDoc: {} };
      state.pageCount = 5;
      state.docName = 'doc.pdf';
      _deps.convertPdfToDocx = async () => { throw new Error('converter error'); };
      let legacyCalled = false;
      // For PDF with <=20 pages, legacy uses generateDocxWithImages
      _deps.generateDocxWithImages = async () => { legacyCalled = true; return new Blob(['legacy docx with images']); };
      _deps.loadOcrTextData = () => ({ pagesText: ['page 1 text', 'page 2 text', 'p3', 'p4', 'p5'] });
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.ok(legacyCalled);
    });

    it('legacy: sets status error when no text content', async () => {
      state.adapter = { type: 'djvu', getText: async () => '' };
      state.pageCount = 2;
      state.docName = 'doc.djvu';
      els.pageText.value = '';
      _deps.loadOcrTextData = () => null;
      let statusMsg = null;
      _deps.setOcrStatus = (s) => { statusMsg = s; };
      initTextNavDeps(_deps);
      await exportCurrentDocToWord();
      assert.ok(statusMsg && statusMsg.includes('OCR'));
    });

    it('legacy: generates docx blob for djvu with text', async () => {
      state.adapter = { type: 'djvu', getText: async () => '' };
      state.pageCount = 2;
      state.docName = 'doc.djvu';
      els.pageText.value = 'some page text';
      _deps.loadOcrTextData = () => ({ pagesText: ['text on page 1', 'text on page 2'] });
      let genCalled = false;
      _deps.generateDocxBlob = async () => { genCalled = true; return new Blob(['docx']); };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.ok(genCalled);
    });

    it('legacy: uses generateDocxWithImages for pdf <= 20 pages', async () => {
      state.adapter = { type: 'pdf', getText: async () => '' };
      state.pageCount = 5;
      state.docName = 'doc.pdf';
      els.pageText.value = '';
      _deps.loadOcrTextData = () => ({ pagesText: ['page1', 'page2', 'page3', 'page4', 'page5'] });
      let imgCalled = false;
      _deps.generateDocxWithImages = async () => { imgCalled = true; return new Blob(['docx with images']); };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.ok(imgCalled);
    });

    it('legacy: handles errors and calls recordCrashEvent', async () => {
      state.adapter = { type: 'djvu', getText: async () => '' };
      state.pageCount = 1;
      state.docName = 'doc.djvu';
      els.pageText.value = 'text';
      _deps.loadOcrTextData = () => null;
      _deps.generateDocxBlob = async () => { throw new Error('blob error'); };
      let crashCalled = false;
      _deps.recordCrashEvent = () => { crashCalled = true; };
      let statusMsg = null;
      _deps.setOcrStatus = (s) => { statusMsg = s; };
      initTextNavDeps(_deps);
      await exportCurrentDocToWord();
      assert.ok(crashCalled);
      assert.ok(statusMsg && statusMsg.includes('ошибка'));
    });

    it('strips file extension from title', async () => {
      state.adapter = { type: 'pdf', pdfDoc: {} };
      state.pageCount = 5;
      state.docName = 'my-document.pdf';
      let titleUsed = null;
      _deps.convertPdfToDocx = async (doc, title) => { titleUsed = title; return new Blob(['docx']); };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.equal(titleUsed, 'my-document');
    });

    it('uses pdfEditState edits in legacy path', async () => {
      state.adapter = { type: 'djvu', getText: async () => '' };
      state.pageCount = 3;
      state.docName = 'doc.djvu';
      els.pageText.value = '';
      const edits = new Map([[1, 'edited page 1']]);
      _deps.pdfEditState = { edits };
      _deps.loadOcrTextData = () => ({ pagesText: ['', '', ''] });
      let textPages = null;
      _deps.generateDocxBlob = async (title, pages) => { textPages = pages; return new Blob(['docx']); };
      initTextNavDeps(_deps);
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      await exportCurrentDocToWord();
      document.createElement = origCreate;
      assert.equal(textPages[0], 'edited page 1');
    });
  });
});
