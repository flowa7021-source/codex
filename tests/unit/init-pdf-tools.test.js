import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initPdfTools } from '../../app/modules/init-pdf-tools.js';

function makeDeps(overrides = {}) {
  return {
    state: { adapter: null, docName: 'test', currentPage: 1, file: null },
    els: {
      pdfFormFill: document.createElement('button'),
      pdfFormExport: document.createElement('button'),
      pdfFormImport: document.createElement('input'),
      pdfFormClear: document.createElement('button'),
      pdfBlockEdit: document.createElement('button'),
      insertImageInput: document.createElement('input'),
      addWatermark: document.createElement('button'),
      addStamp: document.createElement('button'),
      addSignature: document.createElement('button'),
      annotationCanvas: document.createElement('canvas'),
      canvas: document.createElement('canvas'),
      canvasWrap: document.createElement('div'),
    },
    safeOn: mock.fn(),
    setOcrStatus: mock.fn(),
    formManager: {
      loadFromAdapter: mock.fn(async () => {}),
      renderFormOverlay: mock.fn(),
      getAllFields: mock.fn(() => []),
      exportFormData: mock.fn(() => ({})),
      importFormData: mock.fn(),
      clearAll: mock.fn(),
    },
    blockEditor: {
      enable: mock.fn(),
      disable: mock.fn(),
      clearGuides: mock.fn(),
      active: false,
      selectedBlock: null,
      exportAllBlocks: mock.fn(() => ({})),
      exportBlocksToPdf: mock.fn(async () => new Blob()),
      updateBlockStyle: mock.fn(),
      refreshOverlay: mock.fn(),
    },
    fillPdfForm: mock.fn(async () => new Blob()),
    addWatermarkToPdf: mock.fn(async () => new Blob()),
    addStampToPdf: mock.fn(async () => new Blob()),
    safeCreateObjectURL: mock.fn(() => 'blob:mock'),
    handleImageInsertion: mock.fn(),
    addWatermarkToPage: mock.fn(),
    addStampToPage: mock.fn(),
    openSignaturePad: mock.fn(),
    nrPrompt: mock.fn(async () => null),
    ...overrides,
  };
}

describe('initPdfTools', () => {
  it('exports a function', () => {
    assert.equal(typeof initPdfTools, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initPdfTools(makeDeps()));
  });

  it('binds click handlers for PDF tool buttons', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const clickBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'click');
    // pdfFormFill, pdfFormExport, pdfFormClear, pdfBlockEdit, addWatermark, addStamp, addSignature
    assert.ok(clickBindings.length >= 6, `expected >=6 click bindings, got ${clickBindings.length}`);
  });

  it('binds change handler for form import and image insertion', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const changeBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'change');
    assert.ok(changeBindings.length >= 2, `expected >=2 change bindings, got ${changeBindings.length}`);
  });

  it('binds dblclick on pdfBlockEdit', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const dblclickBinding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfBlockEdit && c.arguments[1] === 'dblclick'
    );
    assert.ok(dblclickBinding, 'should bind dblclick on pdfBlockEdit');
  });
});
