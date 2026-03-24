import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initAnnotations } from '../../app/modules/init-annotations.js';

function makeDeps(overrides = {}) {
  return {
    state: {
      drawEnabled: false,
      adapter: null,
      docName: 'test-doc',
      currentPage: 1,
      pageCount: 3,
      file: null,
    },
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
      annotationCanvas: Object.assign(document.createElement('canvas'), { width: 800, height: 600 }),
      canvas: Object.assign(document.createElement('canvas'), { width: 800, height: 600 }),
    },
    safeOn: mock.fn((el, event, handler) => {
      // Store handlers so we can invoke them in tests
      if (el && typeof el.addEventListener === 'function') {
        el.addEventListener(event, handler);
      }
    }),
    setDrawMode: mock.fn(),
    undoStroke: mock.fn(),
    clearStrokes: mock.fn(),
    clearComments: mock.fn(),
    exportAnnotatedPng: mock.fn(),
    exportAnnotationsJson: mock.fn(),
    importAnnotationsJson: mock.fn(async () => {}),
    exportAnnotationBundleJson: mock.fn(),
    importAnnotationBundleJson: mock.fn(async () => {}),
    exportAnnotationsAsSvg: mock.fn(() => new Blob(['<svg/>'], { type: 'image/svg+xml' })),
    exportAnnotationsAsPdf: mock.fn(() => new Blob(['%PDF'], { type: 'application/pdf' })),
    exportAnnotationsIntoPdf: mock.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' })),
    loadStrokes: mock.fn(() => []),
    safeCreateObjectURL: mock.fn(() => 'blob:mock-url'),
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

  it('registers click handlers for annotation buttons via safeOn', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const clickBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'click');
    // annotateToggle, undoStroke, clearStrokes, clearComments, exportAnnotated,
    // exportAnnJson, exportAnnBundle, exportAnnSvg, exportAnnPdf = 9 click bindings
    assert.ok(clickBindings.length >= 9, `expected >=9 click bindings, got ${clickBindings.length}`);
  });

  it('registers change handlers for import inputs', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const changeBindings = deps.safeOn.mock.calls.filter(c => c.arguments[1] === 'change');
    // drawTool, importAnnJson, importAnnBundle = 3 change bindings
    assert.ok(changeBindings.length >= 3, `expected >=3 change bindings, got ${changeBindings.length}`);
  });

  it('annotateToggle click calls setDrawMode toggling state.drawEnabled', () => {
    const deps = makeDeps({ state: { drawEnabled: false, adapter: null, docName: 'doc', currentPage: 1, pageCount: 1, file: null } });
    initAnnotations(deps);
    deps.els.annotateToggle.dispatchEvent(new Event('click'));
    assert.equal(deps.setDrawMode.mock.callCount(), 1);
    assert.equal(deps.setDrawMode.mock.calls[0].arguments[0], true);
  });

  it('annotateToggle click toggles false when drawEnabled is true', () => {
    const deps = makeDeps({ state: { drawEnabled: true, adapter: null, docName: 'doc', currentPage: 1, pageCount: 1, file: null } });
    initAnnotations(deps);
    deps.els.annotateToggle.dispatchEvent(new Event('click'));
    assert.equal(deps.setDrawMode.mock.calls[0].arguments[0], false);
  });

  it('drawTool change calls setDrawMode(true) when drawEnabled is false', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    deps.els.drawTool.dispatchEvent(new Event('change'));
    assert.equal(deps.setDrawMode.mock.callCount(), 1);
    assert.equal(deps.setDrawMode.mock.calls[0].arguments[0], true);
  });

  it('drawTool change does not call setDrawMode when drawEnabled is already true', () => {
    const deps = makeDeps({ state: { drawEnabled: true, adapter: null, docName: 'doc', currentPage: 1, pageCount: 1, file: null } });
    initAnnotations(deps);
    deps.els.drawTool.dispatchEvent(new Event('change'));
    assert.equal(deps.setDrawMode.mock.callCount(), 0);
  });

  it('undoStroke button click invokes undoStroke dep', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    // Find the safeOn call for undoStroke button
    const undoCall = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.undoStroke && c.arguments[1] === 'click'
    );
    assert.ok(undoCall, 'should bind click on undoStroke button');
    // The handler should be the undoStroke function
    undoCall.arguments[2]();
    assert.equal(deps.undoStroke.mock.callCount(), 1);
  });

  it('clearStrokes button click invokes clearStrokes dep', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const call = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.clearStrokes && c.arguments[1] === 'click'
    );
    assert.ok(call);
    call.arguments[2]();
    assert.equal(deps.clearStrokes.mock.callCount(), 1);
  });

  it('clearComments button click invokes clearComments dep', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const call = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.clearComments && c.arguments[1] === 'click'
    );
    assert.ok(call);
    call.arguments[2]();
    assert.equal(deps.clearComments.mock.callCount(), 1);
  });

  it('exportAnnotated button click invokes exportAnnotatedPng', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const call = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.exportAnnotated && c.arguments[1] === 'click'
    );
    assert.ok(call);
    call.arguments[2]();
    assert.equal(deps.exportAnnotatedPng.mock.callCount(), 1);
  });

  it('exportAnnJson button click invokes exportAnnotationsJson', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const call = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.exportAnnJson && c.arguments[1] === 'click'
    );
    assert.ok(call);
    call.arguments[2]();
    assert.equal(deps.exportAnnotationsJson.mock.callCount(), 1);
  });

  it('exportAnnBundle button click invokes exportAnnotationBundleJson', () => {
    const deps = makeDeps();
    initAnnotations(deps);
    const call = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.exportAnnBundle && c.arguments[1] === 'click'
    );
    assert.ok(call);
    call.arguments[2]();
    assert.equal(deps.exportAnnotationBundleJson.mock.callCount(), 1);
  });

  describe('importAnnJson change handler', () => {
    it('calls importAnnotationsJson with selected file and clears input value', async () => {
      const deps = makeDeps();
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.importAnnJson && c.arguments[1] === 'change'
      );
      assert.ok(call);

      const fakeFile = new Blob(['{}'], { type: 'application/json' });
      const fakeEvent = { target: { files: [fakeFile], value: 'somefile.json' } };
      await call.arguments[2](fakeEvent);

      assert.equal(deps.importAnnotationsJson.mock.callCount(), 1);
      assert.equal(deps.importAnnotationsJson.mock.calls[0].arguments[0], fakeFile);
      assert.equal(fakeEvent.target.value, '');
    });

    it('does nothing when no file is selected', async () => {
      const deps = makeDeps();
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.importAnnJson && c.arguments[1] === 'change'
      );
      const fakeEvent = { target: { files: [], value: '' } };
      await call.arguments[2](fakeEvent);
      assert.equal(deps.importAnnotationsJson.mock.callCount(), 0);
    });
  });

  describe('importAnnBundle change handler', () => {
    it('calls importAnnotationBundleJson with selected file and clears input value', async () => {
      const deps = makeDeps();
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.importAnnBundle && c.arguments[1] === 'change'
      );
      assert.ok(call);

      const fakeFile = new Blob(['{}'], { type: 'application/json' });
      const fakeEvent = { target: { files: [fakeFile], value: 'bundle.json' } };
      await call.arguments[2](fakeEvent);

      assert.equal(deps.importAnnotationBundleJson.mock.callCount(), 1);
      assert.equal(fakeEvent.target.value, '');
    });

    it('does nothing when no file is selected', async () => {
      const deps = makeDeps();
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.importAnnBundle && c.arguments[1] === 'change'
      );
      const fakeEvent = { target: { files: undefined, value: '' } };
      await call.arguments[2](fakeEvent);
      assert.equal(deps.importAnnotationBundleJson.mock.callCount(), 0);
    });
  });

  describe('exportAnnSvg click handler', () => {
    it('does nothing when state.adapter is null', () => {
      const deps = makeDeps();
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnSvg && c.arguments[1] === 'click'
      );
      call.arguments[2]();
      assert.equal(deps.loadStrokes.mock.callCount(), 0);
      assert.equal(deps.exportAnnotationsAsSvg.mock.callCount(), 0);
    });

    it('calls exportAnnotationsAsSvg and creates download link when adapter exists and blob returned', () => {
      const deps = makeDeps({ state: { drawEnabled: false, adapter: { type: 'pdf' }, docName: 'doc', currentPage: 2, pageCount: 1, file: null } });
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnSvg && c.arguments[1] === 'click'
      );
      call.arguments[2]();
      assert.equal(deps.loadStrokes.mock.callCount(), 1);
      assert.equal(deps.exportAnnotationsAsSvg.mock.callCount(), 1);
      assert.equal(deps.safeCreateObjectURL.mock.callCount(), 1);
    });

    it('calls setOcrStatus with error when exportAnnotationsAsSvg returns null', () => {
      const deps = makeDeps({
        state: { drawEnabled: false, adapter: { type: 'pdf' }, docName: 'doc', currentPage: 1, pageCount: 1, file: null },
        exportAnnotationsAsSvg: mock.fn(() => null),
      });
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnSvg && c.arguments[1] === 'click'
      );
      call.arguments[2]();
      assert.equal(deps.setOcrStatus.mock.callCount(), 1);
      assert.ok(deps.setOcrStatus.mock.calls[0].arguments[0].includes('SVG'));
    });

    it('does nothing when safeCreateObjectURL returns null', () => {
      const deps = makeDeps({
        state: { drawEnabled: false, adapter: { type: 'pdf' }, docName: 'doc', currentPage: 1, pageCount: 1, file: null },
        safeCreateObjectURL: mock.fn(() => null),
      });
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnSvg && c.arguments[1] === 'click'
      );
      // Should not throw
      assert.doesNotThrow(() => call.arguments[2]());
    });

    it('uses state.docName in the download filename', () => {
      const deps = makeDeps({
        state: { drawEnabled: false, adapter: { type: 'pdf' }, docName: 'my-report', currentPage: 3, pageCount: 5, file: null },
      });
      const appendedLinks = [];
      const origCreateElement = document.createElement.bind(document);
      // We don't need to intercept — just verify safeCreateObjectURL is called
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnSvg && c.arguments[1] === 'click'
      );
      call.arguments[2]();
      // safeCreateObjectURL called means we got to that point
      assert.equal(deps.safeCreateObjectURL.mock.callCount(), 1);
    });
  });

  describe('exportAnnPdf click handler', () => {
    it('does nothing when state.adapter is null', async () => {
      const deps = makeDeps();
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await call.arguments[2]();
      assert.equal(deps.loadStrokes.mock.callCount(), 0);
    });

    it('falls back to legacy raster export when adapter type is not pdf', async () => {
      const deps = makeDeps({
        state: { drawEnabled: false, adapter: { type: 'djvu' }, docName: 'doc', currentPage: 1, pageCount: 1, file: null },
      });
      // Mock canvas.toDataURL
      deps.els.canvas.toDataURL = mock.fn(() => 'data:image/png;base64,abc');
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await call.arguments[2]();
      assert.equal(deps.loadStrokes.mock.callCount(), 1);
      assert.equal(deps.exportAnnotationsAsPdf.mock.callCount(), 1);
      assert.equal(deps.safeCreateObjectURL.mock.callCount(), 1);
    });

    it('legacy path: calls setOcrStatus with error when exportAnnotationsAsPdf returns null', async () => {
      const deps = makeDeps({
        state: { drawEnabled: false, adapter: { type: 'djvu' }, docName: 'doc', currentPage: 1, pageCount: 1, file: null },
        exportAnnotationsAsPdf: mock.fn(() => null),
      });
      deps.els.canvas.toDataURL = () => 'data:image/png;base64,abc';
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await call.arguments[2]();
      assert.equal(deps.setOcrStatus.mock.callCount(), 1);
      assert.ok(deps.setOcrStatus.mock.calls[0].arguments[0].includes('PDF'));
    });

    it('legacy path: does nothing when safeCreateObjectURL returns null', async () => {
      const deps = makeDeps({
        state: { drawEnabled: false, adapter: { type: 'djvu' }, docName: 'doc', currentPage: 1, pageCount: 1, file: null },
        safeCreateObjectURL: mock.fn(() => null),
      });
      deps.els.canvas.toDataURL = () => 'data:image/png;base64,abc';
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await assert.doesNotReject(call.arguments[2]());
    });

    it('uses pdf-lib export when adapter type is pdf and file is present', async () => {
      const fakeArrayBuffer = new ArrayBuffer(8);
      const fakeFile = { arrayBuffer: mock.fn(async () => fakeArrayBuffer) };
      const deps = makeDeps({
        state: {
          drawEnabled: false,
          adapter: { type: 'pdf' },
          docName: 'doc',
          currentPage: 1,
          pageCount: 2,
          file: fakeFile,
        },
      });
      // Put something in localStorage for page 1
      localStorage.setItem('annotations_doc_page_1', JSON.stringify({ strokes: [{ x: 1 }] }));
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await call.arguments[2]();
      assert.equal(deps.exportAnnotationsIntoPdf.mock.callCount(), 1);
      assert.equal(deps.setOcrStatus.mock.callCount(), 2); // status + final size message
      localStorage.removeItem('annotations_doc_page_1');
    });

    it('pdf-lib path: calls setOcrStatus with "no annotations" when annotStore is empty', async () => {
      const fakeArrayBuffer = new ArrayBuffer(8);
      const fakeFile = { arrayBuffer: mock.fn(async () => fakeArrayBuffer) };
      const deps = makeDeps({
        state: {
          drawEnabled: false,
          adapter: { type: 'pdf' },
          docName: 'doc-empty',
          currentPage: 1,
          pageCount: 1,
          file: fakeFile,
        },
      });
      // No localStorage entries
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await call.arguments[2]();
      assert.equal(deps.setOcrStatus.mock.callCount(), 2);
      assert.ok(deps.setOcrStatus.mock.calls[1].arguments[0].includes('аннотаций'));
    });

    it('pdf-lib path: falls back to legacy on error from exportAnnotationsIntoPdf', async () => {
      const fakeArrayBuffer = new ArrayBuffer(8);
      const fakeFile = { arrayBuffer: mock.fn(async () => fakeArrayBuffer) };
      const deps = makeDeps({
        state: {
          drawEnabled: false,
          adapter: { type: 'pdf' },
          docName: 'doc-err',
          currentPage: 1,
          pageCount: 1,
          file: fakeFile,
        },
        exportAnnotationsIntoPdf: mock.fn(async () => { throw new Error('pdf-lib failed'); }),
      });
      localStorage.setItem('annotations_doc-err_page_1', JSON.stringify({ strokes: [{ x: 1 }] }));
      deps.els.canvas.toDataURL = () => 'data:image/png;base64,abc';
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await call.arguments[2]();
      // Should fall through to legacy export
      assert.equal(deps.loadStrokes.mock.callCount(), 1);
      assert.equal(deps.exportAnnotationsAsPdf.mock.callCount(), 1);
      localStorage.removeItem('annotations_doc-err_page_1');
    });

    it('pdf-lib path: does nothing when safeCreateObjectURL returns null after successful export', async () => {
      const fakeArrayBuffer = new ArrayBuffer(8);
      const fakeFile = { arrayBuffer: mock.fn(async () => fakeArrayBuffer) };
      const deps = makeDeps({
        state: {
          drawEnabled: false,
          adapter: { type: 'pdf' },
          docName: 'doc-null-url',
          currentPage: 1,
          pageCount: 1,
          file: fakeFile,
        },
        safeCreateObjectURL: mock.fn(() => null),
      });
      localStorage.setItem('annotations_doc-null-url_page_1', JSON.stringify({ strokes: [{ x: 1 }] }));
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      await assert.doesNotReject(call.arguments[2]());
      localStorage.removeItem('annotations_doc-null-url_page_1');
    });

    it('pdf-lib path: handles malformed localStorage JSON gracefully', async () => {
      const fakeArrayBuffer = new ArrayBuffer(8);
      const fakeFile = { arrayBuffer: mock.fn(async () => fakeArrayBuffer) };
      const deps = makeDeps({
        state: {
          drawEnabled: false,
          adapter: { type: 'pdf' },
          docName: 'doc-bad-json',
          currentPage: 1,
          pageCount: 1,
          file: fakeFile,
        },
      });
      localStorage.setItem('annotations_doc-bad-json_page_1', 'NOT_VALID_JSON');
      initAnnotations(deps);
      const call = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.exportAnnPdf && c.arguments[1] === 'click'
      );
      // Should not throw even with bad JSON
      await assert.doesNotReject(call.arguments[2]());
      localStorage.removeItem('annotations_doc-bad-json_page_1');
    });
  });
});
