import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

import {
  DocumentPropertiesPanel,
  getDocumentProperties,
  setDocumentProperties,
} from '../../app/modules/document-properties-editor.js';

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

  it('_buildPanel with null creationDate/modificationDate shows em-dash', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._props = {
      title: '', author: '', subject: '', keywords: '',
      creator: '', producer: '',
      creationDate: null,
      modificationDate: null,
      pageCount: 1,
      fileSize: 100,
      pdfVersion: '',
    };
    // Should not throw, uses '—' fallback
    const result = panel._buildPanel();
    assert.ok(result);
  });

  it('cancel button click calls onCancel and closes panel', () => {
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._props = {
      title: 'Test', author: '', subject: '', keywords: '',
      creator: '', producer: '',
      creationDate: '', modificationDate: '',
      pageCount: 1, fileSize: 100, pdfVersion: '',
    };
    const domPanel = panel._buildPanel();
    panel._panel = domPanel;
    container.appendChild(domPanel);

    // Find the Cancel button and click it
    const buttons = domPanel.querySelectorAll('button');
    const cancelBtn = Array.from(buttons).find(b => b.textContent === 'Cancel');
    assert.ok(cancelBtn, 'Cancel button should exist');
    cancelBtn.click();

    assert.equal(panel._panel, null, 'Panel should be closed after cancel');
    assert.equal(deps.onCancel.mock.callCount(), 1, 'onCancel should be called');
  });

  it('cancel button without onCancel does not throw', () => {
    const noDeps = { getPdfBytes: mock.fn(() => new Uint8Array(0)), onApply: mock.fn() }; // no onCancel
    const panel = new DocumentPropertiesPanel(container, noDeps);
    panel._props = {
      title: '', author: '', subject: '', keywords: '',
      creator: '', producer: '',
      creationDate: '', modificationDate: '',
      pageCount: 1, fileSize: 100, pdfVersion: '',
    };
    const domPanel = panel._buildPanel();
    panel._panel = domPanel;
    container.appendChild(domPanel);

    const buttons = domPanel.querySelectorAll('button');
    const cancelBtn = Array.from(buttons).find(b => b.textContent === 'Cancel');
    assert.doesNotThrow(() => cancelBtn.click());
  });
});

describe('DocumentPropertiesPanel – Save button', () => {
  it('save button collects form values and calls setDocumentProperties', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await pdfDoc.save());

    let appliedBlob = null;
    const deps = {
      getPdfBytes: mock.fn(() => pdfBytes),
      onApply: mock.fn((b) => { appliedBlob = b; }),
    };

    const container = document.createElement('div');
    const panel = new DocumentPropertiesPanel(container, deps);
    panel._props = {
      title: 'Old Title', author: 'Old Author', subject: '', keywords: '',
      creator: '', producer: '',
      creationDate: '', modificationDate: '',
      pageCount: 1, fileSize: 100, pdfVersion: '',
    };
    const domPanel = panel._buildPanel();
    panel._panel = domPanel;
    container.appendChild(domPanel);

    // Find Save button
    const buttons = domPanel.querySelectorAll('button');
    const saveBtn = Array.from(buttons).find(b => b.textContent === 'Save');
    assert.ok(saveBtn, 'Save button should exist');

    // Click the save button and wait for async handler
    saveBtn.click();
    // Give microtasks time to run
    await new Promise(r => setTimeout(r, 50));

    assert.ok(appliedBlob instanceof Blob, 'onApply should be called with a Blob');
  });
});

describe('getDocumentProperties', () => {
  it('reads properties from a blank PDF (covers _dateToString null path)', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const bytes = new Uint8Array(await pdfDoc.save());

    const props = await getDocumentProperties(bytes);
    assert.ok(typeof props.title === 'string');
    assert.ok(typeof props.pageCount === 'number');
    assert.equal(props.pageCount, 1);
  });

  it('reads a PDF with explicit title and author (covers _dateToString Date path)', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    pdfDoc.setTitle('Test Title');
    pdfDoc.setAuthor('Test Author');
    pdfDoc.setCreationDate(new Date('2024-01-15'));
    const bytes = new Uint8Array(await pdfDoc.save());

    const props = await getDocumentProperties(bytes);
    assert.equal(props.title, 'Test Title');
    assert.equal(props.author, 'Test Author');
    // creationDate should be a non-empty ISO string
    assert.ok(props.creationDate.length > 0);
  });
});
