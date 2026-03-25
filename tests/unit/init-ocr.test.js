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

  it('refreshOcrStorageInfo creates list items with delete buttons', async () => {
    const deps = makeDeps({
      listOcrDocuments: mock.fn(async () => ['alpha.pdf', 'beta.pdf']),
      getOcrStorageSize: mock.fn(async () => 1024),
    });
    const { refreshOcrStorageInfo } = initOcr(deps);
    await refreshOcrStorageInfo();

    assert.equal(deps.els.ocrDocumentsList.children.length, 2);
  });

  it('refreshOcrStorageInfo shows error on failure', async () => {
    const deps = makeDeps({
      listOcrDocuments: mock.fn(async () => { throw new Error('storage fail'); }),
      getOcrStorageSize: mock.fn(async () => 0),
    });
    const { refreshOcrStorageInfo } = initOcr(deps);
    await refreshOcrStorageInfo();

    assert.ok(deps.els.ocrStorageInfo.textContent.includes('Ошибка'));
  });

  it('OCR run button handler calls runOcrForCurrentPage', () => {
    const deps = makeDeps();
    initOcr(deps);

    // Find the safeOn call for ocrCurrentPage
    const ocrCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.ocrCurrentPage && c.arguments[1] === 'click'
    );
    assert.ok(ocrCall, 'safeOn should bind click on ocrCurrentPage');

    // Invoke the handler
    const handler = ocrCall.arguments[2];
    handler();
    assert.equal(deps.runOcrForCurrentPage.mock.calls.length, 1);
  });

  it('region mode toggle calls setOcrRegionMode with flipped value', () => {
    const deps = makeDeps();
    deps.state.ocrRegionMode = false;
    initOcr(deps);

    const regionCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.ocrRegionMode && c.arguments[1] === 'click'
    );
    assert.ok(regionCall);

    regionCall.arguments[2]();
    assert.equal(deps.setOcrRegionMode.mock.calls.length, 1);
    assert.equal(deps.setOcrRegionMode.mock.calls[0].arguments[0], true);
  });

  it('cancel button calls cancelAllOcrWork', () => {
    const deps = makeDeps();
    initOcr(deps);

    const cancelCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.cancelBackgroundOcr && c.arguments[1] === 'click'
    );
    assert.ok(cancelCall);

    cancelCall.arguments[2]();
    assert.equal(deps.cancelAllOcrWork.mock.calls.length, 1);
    assert.equal(deps.cancelAllOcrWork.mock.calls[0].arguments[0], 'manual-button');
  });

  it('clear current OCR data deletes and refreshes', async () => {
    const deps = makeDeps({
      listOcrDocuments: mock.fn(async () => []),
      getOcrStorageSize: mock.fn(async () => 0),
    });
    deps.state.docName = 'test.pdf';
    initOcr(deps);

    const clearCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.clearCurrentOcrData && c.arguments[1] === 'click'
    );
    assert.ok(clearCall);

    await clearCall.arguments[2]();
    assert.equal(deps.deleteOcrData.mock.calls.length, 1);
    assert.equal(deps.deleteOcrData.mock.calls[0].arguments[0], 'test.pdf');
    assert.equal(deps.setOcrStatus.mock.calls.length, 1);
  });

  it('clear current OCR data does nothing without docName', async () => {
    const deps = makeDeps();
    deps.state.docName = '';
    initOcr(deps);

    const clearCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.clearCurrentOcrData && c.arguments[1] === 'click'
    );
    assert.ok(clearCall);

    await clearCall.arguments[2]();
    assert.equal(deps.deleteOcrData.mock.calls.length, 0);
  });

  it('clear all OCR data deletes all documents', async () => {
    const deps = makeDeps({
      listOcrDocuments: mock.fn(async () => ['a.pdf', 'b.pdf']),
      getOcrStorageSize: mock.fn(async () => 0),
    });
    initOcr(deps);

    const clearAllCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.clearAllOcrData && c.arguments[1] === 'click'
    );
    assert.ok(clearAllCall);

    await clearAllCall.arguments[2]();
    assert.equal(deps.deleteOcrData.mock.calls.length, 2);
  });

  it('undo button calls undoPageEdit and updates text', () => {
    const deps = makeDeps({
      undoPageEdit: mock.fn(() => ({ text: 'undone text', page: 3 })),
    });
    initOcr(deps);

    const undoCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.undoTextEdit && c.arguments[1] === 'click'
    );
    assert.ok(undoCall);

    undoCall.arguments[2]();
    assert.equal(deps.undoPageEdit.mock.calls.length, 1);
    assert.equal(deps.els.pageText.value, 'undone text');
    assert.ok(deps.setOcrStatus.mock.calls[0].arguments[0].includes('3'));
  });

  it('undo button does nothing when undoPageEdit returns null', () => {
    const deps = makeDeps({
      undoPageEdit: mock.fn(() => null),
    });
    initOcr(deps);

    const undoCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.undoTextEdit && c.arguments[1] === 'click'
    );
    undoCall.arguments[2]();
    assert.equal(deps.setOcrStatus.mock.calls.length, 0);
  });

  it('redo button calls redoPageEdit and updates text', () => {
    const deps = makeDeps({
      redoPageEdit: mock.fn(() => ({ text: 'redone text', page: 5 })),
    });
    initOcr(deps);

    const redoCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.redoTextEdit && c.arguments[1] === 'click'
    );
    assert.ok(redoCall);

    redoCall.arguments[2]();
    assert.equal(deps.redoPageEdit.mock.calls.length, 1);
    assert.equal(deps.els.pageText.value, 'redone text');
    assert.ok(deps.setOcrStatus.mock.calls[0].arguments[0].includes('5'));
  });

  it('redo button does nothing when redoPageEdit returns null', () => {
    const deps = makeDeps({
      redoPageEdit: mock.fn(() => null),
    });
    initOcr(deps);

    const redoCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.redoTextEdit && c.arguments[1] === 'click'
    );
    redoCall.arguments[2]();
    assert.equal(deps.setOcrStatus.mock.calls.length, 0);
  });

  it('text edit mode toggle calls setTextEditMode', () => {
    const deps = makeDeps();
    deps.state.textEditMode = false;
    initOcr(deps);

    const toggleCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.toggleTextEdit && c.arguments[1] === 'click'
    );
    assert.ok(toggleCall);

    toggleCall.arguments[2]();
    assert.equal(deps.setTextEditMode.mock.calls.length, 1);
    assert.equal(deps.setTextEditMode.mock.calls[0].arguments[0], true);
  });

  it('save text edits button calls saveCurrentPageTextEdits', () => {
    const deps = makeDeps();
    initOcr(deps);

    const saveCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.saveTextEdits && c.arguments[1] === 'click'
    );
    assert.ok(saveCall);

    saveCall.arguments[2]();
    assert.equal(deps.saveCurrentPageTextEdits.mock.calls.length, 1);
  });

  it('export health report button calls exportSessionHealthReport', () => {
    const deps = makeDeps();
    initOcr(deps);

    const exportCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.exportHealthReport && c.arguments[1] === 'click'
    );
    assert.ok(exportCall);

    exportCall.arguments[2]();
    assert.equal(deps.exportSessionHealthReport.mock.calls.length, 1);
  });

  it('OCR confidence toggle enables and marks words', () => {
    const deps = makeDeps();
    deps.state.ocrConfidenceMode = false;
    deps.els.pageText.value = 'some text';
    initOcr(deps);

    const toggleCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.toggleOcrConfidence && c.arguments[1] === 'click'
    );
    assert.ok(toggleCall);

    toggleCall.arguments[2]();
    assert.equal(deps.state.ocrConfidenceMode, true);
    assert.equal(deps.markLowConfidenceWords.mock.calls.length, 1);
    assert.equal(deps.getPageQualitySummary.mock.calls.length, 1);
  });

  it('OCR confidence toggle disables and cleans markers', () => {
    const deps = makeDeps();
    deps.state.ocrConfidenceMode = true;
    deps.els.pageText.value = '[?marked?] text';
    initOcr(deps);

    const toggleCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.toggleOcrConfidence && c.arguments[1] === 'click'
    );
    assert.ok(toggleCall);

    toggleCall.arguments[2]();
    assert.equal(deps.state.ocrConfidenceMode, false);
    assert.ok(!deps.els.pageText.value.includes('[?'));
  });

  it('OCR confidence toggle does nothing when no text', () => {
    const deps = makeDeps();
    deps.state.ocrConfidenceMode = false;
    deps.els.pageText.value = '';
    initOcr(deps);

    const toggleCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.toggleOcrConfidence && c.arguments[1] === 'click'
    );
    toggleCall.arguments[2]();

    assert.equal(deps.markLowConfidenceWords.mock.calls.length, 0);
  });

  it('refreshOcrStorage button triggers refreshOcrStorageInfo', () => {
    const deps = makeDeps();
    initOcr(deps);

    const refreshCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.refreshOcrStorage && c.arguments[1] === 'click'
    );
    assert.ok(refreshCall);
    assert.equal(typeof refreshCall.arguments[2], 'function');
  });
});
