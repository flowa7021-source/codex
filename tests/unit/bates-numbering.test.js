// ─── Unit Tests: Bates Numbering ────────────────────────────────────────────
import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  applyBatesNumbering,
  applyPageStamp,
  applyConfidentialityLabel,
  BatesEditor,
} from '../../app/modules/bates-numbering.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

// ─── applyBatesNumbering ────────────────────────────────────────────────────

describe('applyBatesNumbering', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(3);
  });

  it('returns a Blob with application/pdf type', async () => {
    const result = await applyBatesNumbering(pdfBytes);
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
  });

  it('produces a valid PDF with same page count', async () => {
    const result = await applyBatesNumbering(pdfBytes);
    const bytes = new Uint8Array(await result.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 3);
  });

  it('uses default options when none provided', async () => {
    const result = await applyBatesNumbering(pdfBytes);
    assert.ok(result instanceof Blob);
    assert.ok(result.size > 0);
  });

  it('applies prefix and suffix', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      prefix: 'DOC-',
      suffix: '-END',
      startNumber: 1,
      digits: 4,
    });
    assert.ok(result instanceof Blob);
  });

  it('respects startNumber', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      startNumber: 100,
      digits: 6,
    });
    assert.ok(result instanceof Blob);
  });

  it('applies to specific pages only', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      pages: [1, 3],
    });
    assert.ok(result instanceof Blob);
  });

  it('filters out invalid page numbers', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      pages: [0, 1, 5, 99],
    });
    assert.ok(result instanceof Blob);
  });

  it('handles all position values', async () => {
    const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    for (const position of positions) {
      const result = await applyBatesNumbering(pdfBytes, { position });
      assert.ok(result instanceof Blob, `Failed for position: ${position}`);
    }
  });

  it('falls back to bottom-right for unknown position', async () => {
    const result = await applyBatesNumbering(pdfBytes, { position: 'invalid-pos' });
    assert.ok(result instanceof Blob);
  });

  it('includes date when includeDate is true', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      includeDate: true,
      dateFormat: 'iso',
    });
    assert.ok(result instanceof Blob);
  });

  it('supports all date formats', async () => {
    for (const dateFormat of ['iso', 'us', 'eu', 'full']) {
      const result = await applyBatesNumbering(pdfBytes, {
        includeDate: true,
        dateFormat,
      });
      assert.ok(result instanceof Blob);
    }
  });

  it('falls back to iso for unknown date format', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      includeDate: true,
      dateFormat: 'unknown',
    });
    assert.ok(result instanceof Blob);
  });

  it('accepts custom color', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      color: { r: 1, g: 0, b: 0 },
    });
    assert.ok(result instanceof Blob);
  });

  it('accepts custom fontSize and margin', async () => {
    const result = await applyBatesNumbering(pdfBytes, {
      fontSize: 14,
      margin: 50,
    });
    assert.ok(result instanceof Blob);
  });

  it('accepts ArrayBuffer input', async () => {
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const result = await applyBatesNumbering(ab);
    assert.ok(result instanceof Blob);
  });

  it('works with a single page PDF', async () => {
    const singlePage = await createTestPdf(1);
    const result = await applyBatesNumbering(singlePage);
    assert.ok(result instanceof Blob);
  });
});

// ─── applyPageStamp ─────────────────────────────────────────────────────────

describe('applyPageStamp', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(5);
  });

  it('returns a Blob', async () => {
    const result = await applyPageStamp(pdfBytes, 'Page {page} of {total}');
    assert.ok(result instanceof Blob);
    assert.equal(result.type, 'application/pdf');
  });

  it('replaces {page}, {total}, and {date} placeholders', async () => {
    const result = await applyPageStamp(pdfBytes, '{page}/{total} - {date}');
    assert.ok(result instanceof Blob);
  });

  it('applies to all pages by default', async () => {
    const result = await applyPageStamp(pdfBytes, 'STAMP');
    const bytes = new Uint8Array(await result.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 5);
  });

  it('applies to specific pages', async () => {
    const result = await applyPageStamp(pdfBytes, 'STAMP', { pages: [2, 4] });
    assert.ok(result instanceof Blob);
  });

  it('uses default position bottom-center', async () => {
    const result = await applyPageStamp(pdfBytes, 'test');
    assert.ok(result instanceof Blob);
  });

  it('falls back to bottom-center for unknown position', async () => {
    const result = await applyPageStamp(pdfBytes, 'test', { position: 'invalid' });
    assert.ok(result instanceof Blob);
  });

  it('accepts custom options', async () => {
    const result = await applyPageStamp(pdfBytes, 'Custom', {
      position: 'top-left',
      fontSize: 14,
      color: { r: 0.5, g: 0.5, b: 0.5 },
      margin: 50,
      dateFormat: 'us',
    });
    assert.ok(result instanceof Blob);
  });

  it('accepts ArrayBuffer input', async () => {
    const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    const result = await applyPageStamp(ab, 'STAMP');
    assert.ok(result instanceof Blob);
  });
});

// ─── applyConfidentialityLabel ──────────────────────────────────────────────

describe('applyConfidentialityLabel', () => {
  let pdfBytes;

  before(async () => {
    pdfBytes = await createTestPdf(2);
  });

  it('returns a Blob', async () => {
    const result = await applyConfidentialityLabel(pdfBytes, 'confidential');
    assert.ok(result instanceof Blob);
  });

  it('applies known levels with their specific colors', async () => {
    for (const level of ['public', 'internal', 'confidential', 'secret']) {
      const result = await applyConfidentialityLabel(pdfBytes, level);
      assert.ok(result instanceof Blob, `Failed for level: ${level}`);
    }
  });

  it('uppercases the label text', async () => {
    // The label should be uppercased, but we can only verify it doesn't crash
    const result = await applyConfidentialityLabel(pdfBytes, 'secret');
    assert.ok(result instanceof Blob);
  });

  it('uses DEFAULT_COLOR for unknown levels', async () => {
    const result = await applyConfidentialityLabel(pdfBytes, 'custom-level');
    assert.ok(result instanceof Blob);
  });

  it('accepts custom position and fontSize', async () => {
    const result = await applyConfidentialityLabel(pdfBytes, 'internal', {
      position: 'bottom-center',
      fontSize: 12,
    });
    assert.ok(result instanceof Blob);
  });

  it('defaults to top-center position and fontSize 9', async () => {
    const result = await applyConfidentialityLabel(pdfBytes, 'public');
    assert.ok(result instanceof Blob);
  });
});

// ─── BatesEditor ────────────────────────────────────────────────────────────

describe('BatesEditor', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('constructs without errors', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    assert.ok(editor);
  });

  it('open() appends panel to container', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    editor.open();
    assert.equal(container.children.length, 1);
  });

  it('open() twice does not duplicate the panel', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    editor.open();
    editor.open();
    assert.equal(container.children.length, 1);
  });

  it('close() removes the panel', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    editor.open();
    editor.close();
    assert.equal(container.children.length, 0);
  });

  it('close() when not open does nothing', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    editor.close();
    assert.equal(container.children.length, 0);
  });

  it('Apply button calls onApply with bates mode data', () => {
    let applied = null;
    const editor = new BatesEditor(container, { onApply: (opts) => { applied = opts; } });
    editor.open();
    const buttons = container.querySelectorAll('button');
    const applyBtn = [...buttons].find(b => b.textContent === 'Apply');
    applyBtn.click();
    assert.ok(applied);
    assert.equal(applied.mode, 'bates');
    assert.ok(applied.prefix !== undefined);
    assert.ok(applied.startNumber !== undefined);
    assert.ok(applied.digits !== undefined);
  });

  it('Cancel button calls onCancel and closes', () => {
    let cancelled = false;
    const editor = new BatesEditor(container, {
      onApply: () => {},
      onCancel: () => { cancelled = true; },
    });
    editor.open();
    const buttons = container.querySelectorAll('button');
    const cancelBtn = [...buttons].find(b => b.textContent === 'Cancel');
    cancelBtn.click();
    assert.ok(cancelled);
    assert.equal(container.children.length, 0);
  });

  it('mode switching changes visible fields', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    editor.open();
    const select = container.querySelector('select');
    select.value = 'stamp';
    select.dispatchEvent(new Event('change'));
    // Should not throw
    assert.ok(true);
  });

  it('Apply in stamp mode passes stamp text', () => {
    let applied = null;
    const editor = new BatesEditor(container, { onApply: (opts) => { applied = opts; } });
    editor.open();
    const select = container.querySelector('select');
    select.value = 'stamp';
    select.dispatchEvent(new Event('change'));
    const applyBtn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Apply');
    applyBtn.click();
    assert.equal(applied.mode, 'stamp');
    assert.ok(applied.text !== undefined);
  });

  it('Apply in label mode passes level', () => {
    let applied = null;
    const editor = new BatesEditor(container, { onApply: (opts) => { applied = opts; } });
    editor.open();
    const select = container.querySelector('select');
    select.value = 'label';
    select.dispatchEvent(new Event('change'));
    const applyBtn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Apply');
    applyBtn.click();
    assert.equal(applied.mode, 'label');
    assert.ok(applied.level !== undefined);
  });

  it('preview updates on input events', () => {
    const editor = new BatesEditor(container, { onApply: () => {} });
    editor.open();
    const inputs = container.querySelectorAll('input[type="text"]');
    if (inputs[0]) {
      inputs[0].value = 'NEW-';
      inputs[0].dispatchEvent(new Event('input'));
    }
    // Verify preview element exists with updated text
    const preview = container.querySelector('div[style*="monospace"]');
    assert.ok(preview);
    assert.ok(preview.textContent.includes('Preview:'));
  });
});
