import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { runPreflight, PreflightPanel } from '../../app/modules/preflight-checker.js';

async function createTestPdf(opts = {}) {
  const doc = await PDFDocument.create();
  const pageCount = opts.pages || 1;
  for (let i = 0; i < pageCount; i++) {
    doc.addPage(opts.size || [612, 792]);
  }
  if (opts.title) doc.setTitle(opts.title);
  if (opts.author) doc.setAuthor(opts.author);
  return doc.save();
}

describe('runPreflight', () => {
  it('returns a report with checks array', async () => {
    const bytes = await createTestPdf({ title: 'Test', author: 'Author' });
    const report = await runPreflight(bytes);
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length > 0);
  });

  it('report has summary with pass/fail/warn/info counts', async () => {
    const bytes = await createTestPdf();
    const report = await runPreflight(bytes);
    assert.equal(typeof report.summary.pass, 'number');
    assert.equal(typeof report.summary.fail, 'number');
    assert.equal(typeof report.summary.warn, 'number');
    assert.equal(typeof report.summary.info, 'number');
  });

  it('report has printReady boolean', async () => {
    const bytes = await createTestPdf();
    const report = await runPreflight(bytes);
    assert.equal(typeof report.printReady, 'boolean');
  });

  it('report has timestamp', async () => {
    const bytes = await createTestPdf();
    const report = await runPreflight(bytes);
    assert.ok(report.timestamp);
    // Valid ISO string
    assert.ok(!isNaN(Date.parse(report.timestamp)));
  });

  it('printReady is true when no failures', async () => {
    const bytes = await createTestPdf({ title: 'Doc', author: 'Auth' });
    const report = await runPreflight(bytes);
    // A minimal PDF should have no failures
    assert.equal(report.summary.fail, 0);
    assert.equal(report.printReady, true);
  });

  it('detects consistent page sizes', async () => {
    const bytes = await createTestPdf({ pages: 3 });
    const report = await runPreflight(bytes);
    const pageCheck = report.checks.find(c => c.id === 'page-consistency');
    assert.ok(pageCheck);
    assert.equal(pageCheck.status, 'pass');
  });

  it('passes file size check for small PDF', async () => {
    const bytes = await createTestPdf();
    const report = await runPreflight(bytes);
    const sizeCheck = report.checks.find(c => c.id === 'file-size');
    assert.ok(sizeCheck);
    assert.equal(sizeCheck.status, 'pass');
  });

  it('warns about incomplete metadata', async () => {
    const bytes = await createTestPdf(); // no title/author
    const report = await runPreflight(bytes);
    const metaCheck = report.checks.find(c => c.id === 'metadata');
    assert.ok(metaCheck);
    assert.equal(metaCheck.status, 'warn');
  });

  it('accepts custom targetDpi option', async () => {
    const bytes = await createTestPdf();
    const report = await runPreflight(bytes, { targetDpi: 150 });
    assert.ok(report.checks.length > 0);
  });

  it('each check has required fields', async () => {
    const bytes = await createTestPdf();
    const report = await runPreflight(bytes);
    for (const check of report.checks) {
      assert.ok(check.id, 'check must have id');
      assert.ok(check.name, 'check must have name');
      assert.ok(check.category, 'check must have category');
      assert.ok(['pass', 'fail', 'warn', 'info'].includes(check.status));
      assert.ok(check.message, 'check must have message');
    }
  });
});

describe('PreflightPanel', () => {
  it('constructs with container and deps', () => {
    const container = document.createElement('div');
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => new Uint8Array(0),
      onClose: () => {},
    });
    assert.ok(panel);
    assert.equal(panel._panel, null);
    assert.equal(panel._report, null);
  });

  it('close is safe to call when not open', () => {
    const container = document.createElement('div');
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => new Uint8Array(0),
    });
    assert.doesNotThrow(() => panel.close());
  });

  it('close sets _panel to null', () => {
    const container = document.createElement('div');
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => new Uint8Array(0),
    });
    panel.close();
    assert.equal(panel._panel, null);
  });
});
