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

// ─── Form Fill Handler ──────────────────────────────────────────────────────

describe('initPdfTools — form fill handler', () => {
  it('sets status when adapter is null', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    // Find the pdfFormFill click handler
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormFill && c.arguments[1] === 'click'
    );
    assert.ok(binding, 'should have click binding for pdfFormFill');
    const handler = binding.arguments[2];
    await handler();
    assert.ok(deps.setOcrStatus.mock.callCount() > 0);
    const msg = deps.setOcrStatus.mock.calls[0].arguments[0];
    assert.ok(msg.includes('PDF'), `expected PDF message, got: ${msg}`);
  });

  it('loads form when adapter is pdf', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormFill && c.arguments[1] === 'click'
    );
    const handler = binding.arguments[2];
    await handler();
    assert.equal(deps.formManager.loadFromAdapter.mock.callCount(), 1);
    assert.equal(deps.formManager.renderFormOverlay.mock.callCount(), 1);
    assert.equal(deps.formManager.getAllFields.mock.callCount(), 1);
  });

  it('reports field count in status', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.formManager.getAllFields = mock.fn(() => [{ name: 'a' }, { name: 'b' }]);
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormFill && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    const msg = deps.setOcrStatus.mock.calls[0].arguments[0];
    assert.ok(msg.includes('2'));
  });
});

// ─── Block Editor Toggle ────────────────────────────────────────────────────

describe('initPdfTools — block editor toggle', () => {
  it('sets status when adapter is null', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfBlockEdit && c.arguments[1] === 'click'
    );
    assert.ok(binding);
    binding.arguments[2]();
    const msg = deps.setOcrStatus.mock.calls[0].arguments[0];
    assert.ok(msg.includes('PDF'));
  });

  it('enables block editor when toggled on (pdf adapter)', () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    // classList.toggle returns true when class is added
    deps.els.pdfBlockEdit.classList.add('something'); // ensure toggle adds 'active'
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfBlockEdit && c.arguments[1] === 'click'
    );
    binding.arguments[2]();
    // After toggle, either enable or disable was called
    const enableCalled = deps.blockEditor.enable.mock.callCount();
    const disableCalled = deps.blockEditor.disable.mock.callCount();
    assert.ok(enableCalled > 0 || disableCalled > 0, 'should call enable or disable');
  });

  it('sets appropriate status on enable', () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfBlockEdit && c.arguments[1] === 'click'
    );
    binding.arguments[2]();
    assert.ok(deps.setOcrStatus.mock.callCount() > 0);
  });
});

// ─── Watermark Handler ──────────────────────────────────────────────────────

describe('initPdfTools — watermark handler', () => {
  it('returns early when adapter is null', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addWatermark && c.arguments[1] === 'click'
    );
    assert.ok(binding);
    await binding.arguments[2]();
    // nrPrompt should not be called since adapter is null
    assert.equal(deps.nrPrompt.mock.callCount(), 0);
  });

  it('returns early when nrPrompt returns null', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.nrPrompt = mock.fn(async () => null);
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addWatermark && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    assert.equal(deps.addWatermarkToPage.mock.callCount(), 0);
  });

  it('calls addWatermarkToPage when text is provided', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'image' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.nrPrompt = mock.fn(async () => 'DRAFT');
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addWatermark && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    assert.equal(deps.addWatermarkToPage.mock.callCount(), 1);
    assert.equal(deps.addWatermarkToPage.mock.calls[0].arguments[0], 'DRAFT');
  });

  it('sets status for non-PDF adapter with watermark', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'image' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.nrPrompt = mock.fn(async () => 'CONFIDENTIAL');
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addWatermark && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    assert.ok(deps.setOcrStatus.mock.callCount() > 0);
    const msg = deps.setOcrStatus.mock.calls[0].arguments[0];
    assert.ok(msg.includes('CONFIDENTIAL'));
  });
});

// ─── Stamp Handler ──────────────────────────────────────────────────────────

describe('initPdfTools — stamp handler', () => {
  it('returns early when adapter is null', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addStamp && c.arguments[1] === 'click'
    );
    assert.ok(binding);
    await binding.arguments[2]();
    assert.equal(deps.nrPrompt.mock.callCount(), 0);
  });

  it('adds stamp when valid choice is made', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'image' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.nrPrompt = mock.fn(async () => '1'); // 'approved'
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addStamp && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    assert.equal(deps.addStampToPage.mock.callCount(), 1);
    assert.equal(deps.addStampToPage.mock.calls[0].arguments[0], 'approved');
  });

  it('does not add stamp when choice is out of range', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.nrPrompt = mock.fn(async () => '9'); // out of range
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addStamp && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    assert.equal(deps.addStampToPage.mock.callCount(), 0);
  });

  it('does not add stamp when choice is null', async () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    deps.nrPrompt = mock.fn(async () => null);
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addStamp && c.arguments[1] === 'click'
    );
    await binding.arguments[2]();
    assert.equal(deps.addStampToPage.mock.callCount(), 0);
  });

  it('selects correct stamp type for each choice', async () => {
    const types = ['approved', 'rejected', 'draft', 'confidential', 'copy'];
    for (let i = 0; i < types.length; i++) {
      const deps = makeDeps({
        state: { adapter: { type: 'image' }, docName: 'test', currentPage: 1, file: null },
      });
      deps.nrPrompt = mock.fn(async () => String(i + 1));
      initPdfTools(deps);
      const binding = deps.safeOn.mock.calls.find(
        c => c.arguments[0] === deps.els.addStamp && c.arguments[1] === 'click'
      );
      await binding.arguments[2]();
      assert.equal(deps.addStampToPage.mock.calls[0].arguments[0], types[i]);
    }
  });
});

// ─── Signature Pad Handler ──────────────────────────────────────────────────

describe('initPdfTools — signature handler', () => {
  it('returns early when adapter is null', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addSignature && c.arguments[1] === 'click'
    );
    assert.ok(binding);
    binding.arguments[2]();
    assert.equal(deps.openSignaturePad.mock.callCount(), 0);
  });

  it('opens signature pad when adapter exists', () => {
    const deps = makeDeps({
      state: { adapter: { type: 'pdf' }, docName: 'test', currentPage: 1, file: null },
    });
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addSignature && c.arguments[1] === 'click'
    );
    binding.arguments[2]();
    assert.equal(deps.openSignaturePad.mock.callCount(), 1);
  });
});

// ─── Image Insertion Handler ────────────────────────────────────────────────

describe('initPdfTools — image insertion handler', () => {
  it('binds change handler on insertImageInput', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.insertImageInput && c.arguments[1] === 'change'
    );
    assert.ok(binding, 'should bind change on insertImageInput');
  });

  it('calls handleImageInsertion when file is selected', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.insertImageInput && c.arguments[1] === 'change'
    );
    const mockFile = { name: 'photo.jpg' };
    const evt = { target: { files: [mockFile], value: 'C:\\photo.jpg' } };
    binding.arguments[2](evt);
    assert.equal(deps.handleImageInsertion.mock.callCount(), 1);
    assert.equal(deps.handleImageInsertion.mock.calls[0].arguments[0], mockFile);
    assert.equal(evt.target.value, '');
  });

  it('does not call handleImageInsertion when no file selected', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.insertImageInput && c.arguments[1] === 'change'
    );
    const evt = { target: { files: [], value: '' } };
    binding.arguments[2](evt);
    assert.equal(deps.handleImageInsertion.mock.callCount(), 0);
  });
});

// ─── Form Clear Handler ─────────────────────────────────────────────────────

describe('initPdfTools — form clear handler', () => {
  it('calls formManager.clearAll on click', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormClear && c.arguments[1] === 'click'
    );
    assert.ok(binding);
    binding.arguments[2]();
    assert.equal(deps.formManager.clearAll.mock.callCount(), 1);
    assert.ok(deps.setOcrStatus.mock.callCount() > 0);
  });
});

// ─── All handlers with null adapter ─────────────────────────────────────────

describe('initPdfTools — null adapter safety for all handlers', () => {
  it('form fill does not crash with null adapter', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormFill && c.arguments[1] === 'click'
    );
    await assert.doesNotReject(async () => await binding.arguments[2]());
  });

  it('block editor does not crash with null adapter', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfBlockEdit && c.arguments[1] === 'click'
    );
    assert.doesNotThrow(() => binding.arguments[2]());
  });

  it('watermark does not crash with null adapter', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addWatermark && c.arguments[1] === 'click'
    );
    await assert.doesNotReject(async () => await binding.arguments[2]());
  });

  it('stamp does not crash with null adapter', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addStamp && c.arguments[1] === 'click'
    );
    await assert.doesNotReject(async () => await binding.arguments[2]());
  });

  it('signature does not crash with null adapter', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.addSignature && c.arguments[1] === 'click'
    );
    assert.doesNotThrow(() => binding.arguments[2]());
  });
});

// ─── Form Import Handler ────────────────────────────────────────────────────

describe('initPdfTools — form import handler', () => {
  it('binds change handler on pdfFormImport', () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormImport && c.arguments[1] === 'change'
    );
    assert.ok(binding);
  });

  it('does nothing when no file is selected', async () => {
    const deps = makeDeps();
    initPdfTools(deps);
    const binding = deps.safeOn.mock.calls.find(
      c => c.arguments[0] === deps.els.pdfFormImport && c.arguments[1] === 'change'
    );
    const evt = { target: { files: [], value: '' } };
    await binding.arguments[2](evt);
    assert.equal(deps.formManager.importFormData.mock.callCount(), 0);
  });
});
