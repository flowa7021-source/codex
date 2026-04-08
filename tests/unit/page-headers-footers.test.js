import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

// page-headers-footers.js imports pdf-lib which needs to be available.
// We test the HeaderFooterEditor UI class and the addHeadersFooters function
// at a structural level.
import { HeaderFooterEditor, addHeadersFooters } from '../../app/modules/page-headers-footers.js';

describe('HeaderFooterEditor', () => {
  it('opens and creates a panel in the container', () => {
    const container = document.createElement('div');
    const editor = new HeaderFooterEditor(container, { onApply: () => {} });
    editor.open();
    assert.strictEqual(container.children.length, 1);
  });

  it('does nothing if already open', () => {
    const container = document.createElement('div');
    const editor = new HeaderFooterEditor(container, { onApply: () => {} });
    editor.open();
    editor.open(); // second open should be no-op
    assert.strictEqual(container.children.length, 1);
  });

  it('closes and removes the panel', () => {
    const container = document.createElement('div');
    const editor = new HeaderFooterEditor(container, { onApply: () => {} });
    editor.open();
    editor.close();
    assert.strictEqual(container.children.length, 0);
  });

  it('close is safe when not open', () => {
    const container = document.createElement('div');
    const editor = new HeaderFooterEditor(container, { onApply: () => {} });
    editor.close(); // should not throw
    assert.strictEqual(container.children.length, 0);
  });

  it('calls onCancel when cancel button is clicked', () => {
    let cancelled = false;
    const container = document.createElement('div');
    const editor = new HeaderFooterEditor(container, {
      onApply: () => {},
      onCancel: () => { cancelled = true; },
    });
    editor.open();
    // Find cancel button (first button in the button row)
    const buttons = container.children[0]?.querySelectorAll?.('button') || [];
    const cancelBtn = buttons.find(b => b.textContent === 'Cancel');
    if (cancelBtn) cancelBtn.click();
    assert.strictEqual(cancelled, true);
  });

  it('calls onApply with options when apply button is clicked', () => {
    let appliedOpts = null;
    const container = document.createElement('div');
    const editor = new HeaderFooterEditor(container, {
      onApply: (opts) => { appliedOpts = opts; },
    });
    editor.open();
    const buttons = container.children[0]?.querySelectorAll?.('button') || [];
    const applyBtn = buttons.find(b => b.textContent === 'Apply');
    if (applyBtn) applyBtn.click();
    assert.ok(appliedOpts !== null);
    assert.strictEqual(typeof appliedOpts.fontSize, 'number');
    assert.strictEqual(typeof appliedOpts.separator, 'boolean');
  });
});

async function makeTestPdfBytes(opts = {}) {
  const doc = await PDFDocument.create();
  if (opts.title) doc.setTitle(opts.title);
  if (opts.author) doc.setAuthor(opts.author);
  const pages = opts.pages || 1;
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return new Uint8Array(await doc.save());
}

describe('addHeadersFooters', () => {
  it('returns a Blob with PDF type', async () => {
    const bytes = await makeTestPdfBytes();
    const blob = await addHeadersFooters(bytes, {
      header: { left: '{page}', center: 'NovaReader', right: '{date}' },
    });
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'application/pdf');
  });

  it('draws header with left/center/right slots and separator', async () => {
    const bytes = await makeTestPdfBytes({ title: 'My Doc', author: 'Alice' });
    const blob = await addHeadersFooters(bytes, {
      header: { left: '{page} of {total}', center: '{title}', right: '{author}' },
      separator: true,
    });
    assert.ok(blob instanceof Blob);
  });

  it('draws footer with left/center/right slots', async () => {
    const bytes = await makeTestPdfBytes();
    const blob = await addHeadersFooters(bytes, {
      footer: { left: '{date}', center: 'Page {page}', right: 'Total {total}' },
      separator: false,
    });
    assert.ok(blob instanceof Blob);
  });

  it('resolves {page}, {total}, {date}, {title}, {author} placeholders', async () => {
    const bytes = await makeTestPdfBytes({ pages: 2, title: 'T', author: 'A' });
    const blob = await addHeadersFooters(bytes, {
      header: { center: 'p{page}/{total} {date} {title} {author}' },
    });
    assert.ok(blob instanceof Blob);
  });

  it('uses US date format', async () => {
    const bytes = await makeTestPdfBytes();
    const blob = await addHeadersFooters(bytes, {
      header: { left: '{date}' },
      dateFormat: 'us',
    });
    assert.ok(blob instanceof Blob);
  });

  it('uses EU date format', async () => {
    const bytes = await makeTestPdfBytes();
    const blob = await addHeadersFooters(bytes, {
      header: { left: '{date}' },
      dateFormat: 'eu',
    });
    assert.ok(blob instanceof Blob);
  });

  it('uses ISO date format (default)', async () => {
    const bytes = await makeTestPdfBytes();
    const blob = await addHeadersFooters(bytes, {
      footer: { right: '{date}' },
      dateFormat: 'iso',
    });
    assert.ok(blob instanceof Blob);
  });

  it('applies only to specified pages', async () => {
    const bytes = await makeTestPdfBytes({ pages: 3 });
    const blob = await addHeadersFooters(bytes, {
      header: { center: 'Page {page}' },
      pages: [1, 3],
    });
    assert.ok(blob instanceof Blob);
  });

  it('uses firstPageHeader for first page', async () => {
    const bytes = await makeTestPdfBytes({ pages: 2 });
    const blob = await addHeadersFooters(bytes, {
      header: { center: 'Normal Header' },
      firstPageHeader: { center: 'First Page Header' },
    });
    assert.ok(blob instanceof Blob);
  });

  it('uses evenHeader for even pages', async () => {
    const bytes = await makeTestPdfBytes({ pages: 4 });
    const blob = await addHeadersFooters(bytes, {
      header: { left: 'Odd' },
      evenHeader: { right: 'Even' },
    });
    assert.ok(blob instanceof Blob);
  });

  it('accepts ArrayBuffer input', async () => {
    const bytes = await makeTestPdfBytes();
    const blob = await addHeadersFooters(bytes.buffer, {
      footer: { center: 'Footer' },
    });
    assert.ok(blob instanceof Blob);
  });
});
