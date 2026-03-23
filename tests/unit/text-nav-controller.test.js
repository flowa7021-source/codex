import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  initTextNavDeps,
  ensureTextToolsVisible,
  normalizePageInput,
  exportPageText,
  downloadCurrentFile,
  setTextEditMode,
} from '../../app/modules/text-nav-controller.js';

function resetState() {
  localStorage.clear();
  state.adapter = { type: 'pdf' };
  state.pageCount = 10;
  state.currentPage = 1;
  state.docName = 'test.pdf';
  state.file = null;
  state.textEditMode = false;
  state.zoom = 1;

  els.pageInput = document.createElement('input');
  els.pageText = document.createElement('textarea');
  els.canvas = document.createElement('canvas');
  els.annotationCanvas = document.createElement('canvas');
  els.canvasWrap = document.createElement('div');
  els.searchStatus = document.createElement('div');
  els.toggleTextEdit = document.createElement('button');

  const uiLayoutKeyFn = (name) => `novareader-ui-layout:${name}`;
  initTextNavDeps({
    uiLayoutKey: uiLayoutKeyFn,
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
    convertPdfToDocx: async () => new Blob(),
    generateDocxBlob: async () => new Blob(),
    generateDocxWithImages: async () => new Blob(),
    capturePageAsImageData: async () => null,
    _ocrWordCache: new Map(),
    recordSuccessfulOperation: () => {},
    recordCrashEvent: () => {},
  });
}

describe('text-nav-controller', () => {
  beforeEach(() => resetState());

  describe('ensureTextToolsVisible', () => {
    it('sets textHidden to 0 when it was 1', () => {
      const key = 'novareader-ui-layout:textHidden';
      localStorage.setItem(key, '1');
      ensureTextToolsVisible();
      assert.equal(localStorage.getItem(key), '0');
    });

    it('does nothing when textHidden is not 1', () => {
      const key = 'novareader-ui-layout:textHidden';
      localStorage.setItem(key, '0');
      ensureTextToolsVisible();
      assert.equal(localStorage.getItem(key), '0');
    });
  });

  describe('normalizePageInput', () => {
    it('returns 1 for NaN input', () => {
      els.pageInput.value = 'abc';
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
  });

  describe('exportPageText', () => {
    it('creates a download with page text', () => {
      els.pageText.value = 'some text';
      const clicks = [];
      const origCreate = document.createElement;
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
  });

  describe('downloadCurrentFile', () => {
    it('does nothing when no file is set', () => {
      state.file = null;
      assert.doesNotThrow(() => downloadCurrentFile());
    });

    it('creates download link when file exists', () => {
      state.file = { name: 'doc.pdf', size: 1024 };
      const clicks = [];
      const origCreate = document.createElement;
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
  });

  describe('setTextEditMode', () => {
    it('enables text edit mode', () => {
      setTextEditMode(true);
      assert.equal(state.textEditMode, true);
      assert.equal(els.pageText.readOnly, false);
      assert.ok(els.toggleTextEdit.classList.contains('active'));
    });

    it('disables text edit mode', () => {
      setTextEditMode(true);
      setTextEditMode(false);
      assert.equal(state.textEditMode, false);
      assert.equal(els.pageText.readOnly, true);
      assert.ok(!els.toggleTextEdit.classList.contains('active'));
    });
  });
});
