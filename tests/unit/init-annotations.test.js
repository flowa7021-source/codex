import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initAnnotations } from '../../app/modules/init-annotations.js';

function makeDeps(overrides = {}) {
  return {
    state: { drawEnabled: false, adapter: null, docName: 'test', currentPage: 1 },
    els: {
      annotateToggle: document.createElement('button'),
      drawTool: document.createElement('select'),
      undoStroke: document.createElement('button'),
      clearStrokes: document.createElement('button'),
      clearComments: document.createElement('button'),
      exportAnnotated: document.createElement('button'),
      exportAnnJson: document.createElement('button'),
      importAnnJson: document.createElement('input'),
      exportAnnBundle: document.createElement('button'),
      importAnnBundle: document.createElement('input'),
      exportAnnSvg: document.createElement('button'),
      exportAnnPdf: document.createElement('button'),
      annotationCanvas: document.createElement('canvas'),
      canvas: document.createElement('canvas'),
    },
    safeOn: mock.fn(),
    setDrawMode: mock.fn(),
    undoStroke: mock.fn(),
    clearStrokes: mock.fn(),
    clearComments: mock.fn(),
    exportAnnotatedPng: mock.fn(),
    exportAnnotationsJson: mock.fn(),
    importAnnotationsJson: mock.fn(),
    exportAnnotationBundleJson: mock.fn(),
    importAnnotationBundleJson: mock.fn(),
    exportAnnotationsAsSvg: mock.fn(),
    exportAnnotationsAsPdf: mock.fn(),
    exportAnnotationsIntoPdf: mock.fn(),
    loadStrokes: mock.fn(() => []),
    safeCreateObjectURL: mock.fn(() => 'blob:mock'),
    setOcrStatus: mock.fn(),
    ...overrides,
  };
}

describe('initAnnotations', () => {
  it('exports a function', () => {
    assert.equal(typeof initAnnotations, 'function');
  });

  it('does not throw with mock deps', () => {
    assert.doesNotThrow(() => initAnnotations(makeDeps()));
  });

  it('binds click handlers via safeOn for annotation buttons', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const clickBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'click');
    // annotateToggle, undoStroke, clearStrokes, clearComments, exportAnnotated,
    // exportAnnJson, exportAnnBundle, exportAnnSvg, exportAnnPdf
    assert.ok(clickBindings.length >= 8, `expected >=8 click bindings, got ${clickBindings.length}`);
  });

  it('binds change handlers for import inputs', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const changeBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'change');
    assert.ok(changeBindings.length >= 2, 'should bind change on importAnnJson and importAnnBundle');
  });

  it('binds drawTool change handler', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const drawToolChange = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.drawTool && c.arguments[1] === 'change'
    );
    assert.ok(drawToolChange, 'should bind change on drawTool');
  });
});
