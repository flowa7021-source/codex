import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// page-headers-footers.js imports pdf-lib which needs to be available.
// We test the HeaderFooterEditor UI class and the addHeadersFooters function
// at a structural level.
import { HeaderFooterEditor } from '../../app/modules/page-headers-footers.js';

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
