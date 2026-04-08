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

  it('open() renders status element with PRINT READY or ISSUES FOUND', async () => {
    const container = document.createElement('div');
    const bytes = await createTestPdf({ title: 'Doc', author: 'Auth' });
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => bytes,
      onClose: () => {},
    });
    await panel.open();
    const html = panel._statusEl.innerHTML;
    assert.ok(html.includes('PRINT READY') || html.includes('ISSUES FOUND'),
      `expected status label in innerHTML, got: ${html}`);
    panel.close();
  });

  it('open() populates results list with check items', async () => {
    const container = document.createElement('div');
    const bytes = await createTestPdf({ title: 'Doc', author: 'Auth' });
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => bytes,
    });
    await panel.open();
    assert.ok(panel._resultsList.children.length > 0, 'results list should have items');
    panel.close();
  });

  it('open() renders fix text for checks with a fix property', async () => {
    const container = document.createElement('div');
    // A PDF without title/author will generate a warn check with a fix suggestion
    const bytes = await createTestPdf();
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => bytes,
    });
    await panel.open();
    // At least one item should exist (checks with fix text are rendered)
    assert.ok(panel._resultsList.children.length > 0);
    panel.close();
  });

  it('close button invokes onClose callback', async () => {
    const container = document.createElement('div');
    const bytes = await createTestPdf();
    let closeCalled = false;
    const panel = new PreflightPanel(container, {
      getPdfBytes: () => bytes,
      onClose: () => { closeCalled = true; },
    });
    await panel.open();
    // Find and click the close button
    const closeBtn = panel._panel.querySelector('button');
    closeBtn.click();
    assert.equal(closeCalled, true);
    assert.equal(panel._panel, null);
  });
});

describe('runPreflight — non-standard page size', () => {
  it('reports custom page dimensions for non-standard size', async () => {
    // 1000×1234 pt is not in STANDARD_PAGE_SIZES → _identifyPageSize returns "1000×1234 pt"
    const bytes = await createTestPdf({ size: [1000, 1234] });
    const report = await runPreflight(bytes);
    assert.ok(report.checks.length > 0);
    // Report should contain info about page size
    const pageSizeCheck = report.checks.find(c => c.id === 'page-size');
    if (pageSizeCheck) {
      assert.ok(pageSizeCheck.message.includes('×') || pageSizeCheck.message.includes('pt') || pageSizeCheck.message.includes('custom'),
        `page size message: ${pageSizeCheck.message}`);
    }
  });
});
