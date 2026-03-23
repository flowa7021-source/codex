import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initOcr } from '../../app/modules/init-ocr.js';

function makeDeps(overrides = {}) {
  return {
    state: { ocrConfidenceMode: false, ocrRegionMode: false, textEditMode: false, docName: 'test', adapter: null },
    els: {
      toggleOcrConfidence: document.createElement('button'),
      pageText: document.createElement('textarea'),
      ocrStorageInfo: document.createElement('div'),
      ocrDocumentsList: document.createElement('ul'),
      refreshOcrStorage: document.createElement('button'),
      clearCurrentOcrData: document.createElement('button'),
      clearAllOcrData: document.createElement('button'),
      ocrCurrentPage: document.createElement('button'),
      ocrRegionMode: document.createElement('button'),
      copyOcrText: document.createElement('button'),
      cancelBackgroundOcr: document.createElement('button'),
      undoTextEdit: document.createElement('button'),
      redoTextEdit: document.createElement('button'),
      exportHealthReport: document.createElement('button'),
      toggleTextEdit: document.createElement('button'),
      saveTextEdits: document.createElement('button'),
    },
    safeOn: mock.fn(),
    setOcrStatus: mock.fn(),
    getOcrLang: mock.fn(() => 'eng'),
    runOcrForCurrentPage: mock.fn(async () => {}),
    setOcrRegionMode: mock.fn(),
    cancelAllOcrWork: mock.fn(),
    markLowConfidenceWords: mock.fn((text) => text),
    getPageQualitySummary: mock.fn(() => ({ quality: 'good', avgScore: 95, lowCount: 0, mediumCount: 1 })),
    listOcrDocuments: mock.fn(async () => []),
    getOcrStorageSize: mock.fn(async () => 0),
    deleteOcrData: mock.fn(async () => {}),
    undoPageEdit: mock.fn(() => null),
    redoPageEdit: mock.fn(() => null),
    setTextEditMode: mock.fn(),
    saveCurrentPageTextEdits: mock.fn(),
    exportSessionHealthReport: mock.fn(),
    ...overrides,
  };
}

describe('initOcr', () => {
  it('exports a function', () => {
    assert.equal(typeof initOcr, 'function');
  });

  it('returns object with refreshOcrStorageInfo', () => {
    const result = initOcr(makeDeps());
    assert.equal(typeof result.refreshOcrStorageInfo, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initOcr(makeDeps()));
  });

  it('binds click handlers for OCR controls', () => {
    const deps = makeDeps();
    initOcr(deps);
    const clickBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'click');
    // toggleOcrConfidence, refreshOcrStorage, clearCurrentOcrData, clearAllOcrData,
    // ocrCurrentPage, ocrRegionMode, copyOcrText, cancelBackgroundOcr,
    // undoTextEdit, redoTextEdit, exportHealthReport, toggleTextEdit, saveTextEdits
    assert.ok(clickBindings.length >= 12, `expected >=12 click bindings, got ${clickBindings.length}`);
  });

  it('refreshOcrStorageInfo updates storage info element', async () => {
    const deps = makeDeps({
      listOcrDocuments: mock.fn(async () => ['doc1.pdf', 'doc2.pdf']),
      getOcrStorageSize: mock.fn(async () => 2048000),
    });
    const { refreshOcrStorageInfo } = initOcr(deps);
    await refreshOcrStorageInfo();
    assert.ok(deps.els.ocrStorageInfo.textContent.includes('2'));
  });
});
