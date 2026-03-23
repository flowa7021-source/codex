import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';

// Mock pdfjs-dist before importing the module
const mockGetDocument = mock.fn();
mock.module('pdfjs-dist/build/pdf.mjs', {
  namedExports: { getDocument: mockGetDocument },
});

const { checkAccessibility, AccessibilityPanel } = await import(
  '../../app/modules/pdf-accessibility-checker.js'
);

function makeMockPdfJsDoc(opts = {}) {
  const numPages = opts.numPages || 1;
  const textItems = opts.textItems || [
    { str: 'Hello world', fontName: 'g_d0_f1', transform: [12, 0, 0, 12, 72, 700] },
    { str: 'Second line', fontName: 'g_d0_f1', transform: [12, 0, 0, 12, 72, 680] },
    { str: 'Third line', fontName: 'g_d0_f1', transform: [12, 0, 0, 12, 72, 660] },
  ];
  return {
    numPages,
    getPage: mock.fn(async () => ({
      getTextContent: async () => ({
        items: textItems,
        styles: {},
      }),
    })),
    getOutline: mock.fn(async () => opts.outline || null),
    destroy: mock.fn(),
  };
}

describe('checkAccessibility', () => {
  beforeEach(() => {
    mockGetDocument.mock.resetCalls();
  });

  it('returns a report with score and checks', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Test Doc');
    doc.setAuthor('Author');
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    assert.ok(typeof report.score === 'number');
    assert.ok(report.score >= 0 && report.score <= 100);
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length > 0);
    assert.ok(report.timestamp);
  });

  it('assigns compliance level based on score', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    assert.ok(['A', 'AA', 'AAA', 'Non-compliant'].includes(report.level));
  });

  it('summary counts match checks', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('Test');
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    const { summary } = report;
    assert.equal(summary.total, report.checks.length);
    const summed = summary.pass + summary.fail + summary.warn + (summary.info || 0);
    assert.equal(summed, summary.total);
  });

  it('fails doc-title check when no title set', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    const titleCheck = report.checks.find(c => c.id === 'doc-title');
    assert.ok(titleCheck);
    assert.equal(titleCheck.status, 'fail');
  });

  it('passes doc-title check when title is set', async () => {
    const doc = await PDFDocument.create();
    doc.setTitle('My Document');
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    const titleCheck = report.checks.find(c => c.id === 'doc-title');
    assert.equal(titleCheck.status, 'pass');
  });

  it('fails structure-tree check for untagged PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    const structCheck = report.checks.find(c => c.id === 'structure-tree');
    assert.equal(structCheck.status, 'fail');
  });

  it('detects text presence', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    const pdfJsDoc = makeMockPdfJsDoc({
      textItems: [{ str: 'A'.repeat(100), fontName: 'f1', transform: [12, 0, 0, 12, 72, 700] }],
    });
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(bytes);
    const textCheck = report.checks.find(c => c.id === 'text-presence');
    assert.equal(textCheck.status, 'pass');
  });

  it('accepts ArrayBuffer input', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const pdfJsDoc = makeMockPdfJsDoc();
    mockGetDocument.mock.mockImplementation(() => ({ promise: Promise.resolve(pdfJsDoc) }));

    const report = await checkAccessibility(ab);
    assert.ok(typeof report.score === 'number');
  });
});

describe('AccessibilityPanel', () => {
  it('can be instantiated', () => {
    const container = document.createElement('div');
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => new Uint8Array(),
    });
    assert.ok(panel);
  });

  it('close removes panel from DOM', () => {
    const container = document.createElement('div');
    const panel = new AccessibilityPanel(container, {
      getPdfBytes: () => new Uint8Array(),
    });
    // Simulate building panel
    panel._panel = document.createElement('div');
    container.appendChild(panel._panel);
    panel.close();
    assert.equal(panel._panel, null);
  });
});
