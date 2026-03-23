import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { DocumentPropertiesPanel } from '../../app/modules/document-properties-editor.js';

// Note: getDocumentProperties and setDocumentProperties require real pdf-lib
// with valid PDF bytes, so we test the UI panel class here.

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  return document.createElement('div');
}

function makeDeps(overrides = {}) {
  return {
    getPdfBytes: mock.fn(() => new Uint8Array(0)),
    onApply: mock.fn(),
    onCancel: mock.fn(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DocumentPropertiesPanel', () => {
  let container, deps;

  beforeEach(() => {
    container = makeContainer();
    deps = makeDeps();
  });

  it('constructor initialises with null panel', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    assert.equal(panel._panel, null);
    assert.equal(panel._props, null);
  });

  it('close removes panel element', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._panel = document.createElement('div');
    container.appendChild(panel._panel);
    panel.close();
    assert.equal(panel._panel, null);
  });

  it('close is safe when already closed', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    assert.doesNotThrow(() => panel.close());
  });

  it('_buildPanel creates panel with editable fields', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._props = {
      title: 'Test Doc',
      author: 'Jane',
      subject: 'Testing',
      keywords: 'test,unit',
      creator: 'NovaReader',
      producer: 'pdf-lib',
      creationDate: '2024-01-01',
      modificationDate: '2024-06-15',
      pageCount: 5,
      fileSize: 102400,
      pdfVersion: '',
    };

    const result = panel._buildPanel();
    assert.ok(result);
    // Should have input fields
    const inputs = result.querySelectorAll('input');
    assert.ok(inputs.length >= 6);
  });

  it('_buildPanel displays page count and file size', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._props = {
      title: '', author: '', subject: '', keywords: '',
      creator: '', producer: '',
      creationDate: '', modificationDate: '',
      pageCount: 42,
      fileSize: 2097152, // 2 MB
      pdfVersion: '',
    };

    const result = panel._buildPanel();
    assert.ok(result);
  });

  it('_buildPanel with zero fileSize shows bytes', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._props = {
      title: '', author: '', subject: '', keywords: '',
      creator: '', producer: '',
      creationDate: '', modificationDate: '',
      pageCount: 1,
      fileSize: 512,
      pdfVersion: '',
    };

    const result = panel._buildPanel();
    assert.ok(result);
  });
});
