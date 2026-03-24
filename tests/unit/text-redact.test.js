import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

import { REDACTION_PATTERNS, RedactionEditor } from '../../app/modules/text-redact.js';

// ---------------------------------------------------------------------------
// Helper: create a minimal PDF with given text on page 1
// ---------------------------------------------------------------------------
async function makePdf(text, opts = {}) {
  const doc = await PDFDocument.create();
  const pageCount = opts.pages || 1;
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(text, { x: 10, y: 100, size: 10 });
  }
  return doc.save();
}

// ---------------------------------------------------------------------------
// REDACTION_PATTERNS — comprehensive
// ---------------------------------------------------------------------------
describe('REDACTION_PATTERNS', () => {
  it('exports predefined patterns', () => {
    assert.ok(REDACTION_PATTERNS.ssn instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.email instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.phone instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.creditCard instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.date instanceof RegExp);
    assert.ok(REDACTION_PATTERNS.ipv4 instanceof RegExp);
  });

  it('ssn pattern matches valid SSNs', () => {
    const matches = '123-45-6789'.match(REDACTION_PATTERNS.ssn);
    assert.ok(matches, 'should match SSN with dashes');
    const matches2 = '123 45 6789'.match(new RegExp(REDACTION_PATTERNS.ssn.source));
    assert.ok(matches2, 'should match SSN with spaces');
  });

  it('ssn pattern matches SSN without separators', () => {
    const m = '123456789'.match(new RegExp(REDACTION_PATTERNS.ssn.source));
    assert.ok(m);
  });

  it('email pattern matches valid emails', () => {
    const matches = 'user@example.com'.match(REDACTION_PATTERNS.email);
    assert.ok(matches);
  });

  it('email pattern matches emails with special chars', () => {
    const m = 'user.name+tag@sub.domain.org'.match(REDACTION_PATTERNS.email);
    assert.ok(m);
  });

  it('phone pattern matches various phone formats', () => {
    const cases = ['(555) 123-4567', '555-123-4567', '+1 555 123 4567', '5551234567'];
    for (const c of cases) {
      const m = c.match(new RegExp(REDACTION_PATTERNS.phone.source));
      assert.ok(m, `should match phone: ${c}`);
    }
  });

  it('creditCard pattern matches card numbers', () => {
    const matches = '1234-5678-9012-3456'.match(REDACTION_PATTERNS.creditCard);
    assert.ok(matches);
  });

  it('creditCard pattern matches card numbers with spaces', () => {
    const m = '1234 5678 9012 3456'.match(new RegExp(REDACTION_PATTERNS.creditCard.source));
    assert.ok(m);
  });

  it('date pattern matches common date formats', () => {
    const cases = ['01/15/2024', '1-1-24', '12.31.2023'];
    for (const c of cases) {
      const m = c.match(new RegExp(REDACTION_PATTERNS.date.source));
      assert.ok(m, `should match date: ${c}`);
    }
  });

  it('ipv4 pattern matches IP addresses', () => {
    const matches = '192.168.1.100'.match(REDACTION_PATTERNS.ipv4);
    assert.ok(matches);
  });

  it('ipv4 pattern matches loopback', () => {
    const m = '127.0.0.1'.match(REDACTION_PATTERNS.ipv4);
    assert.ok(m);
  });
});

// ---------------------------------------------------------------------------
// RedactionEditor — constructor, open, close
// ---------------------------------------------------------------------------
describe('RedactionEditor', () => {
  /** @returns {{ container: *, deps: *, editor: RedactionEditor }} */
  function createEditor(overrides = {}) {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: overrides.getPdfBytes ?? (() => new Uint8Array(0)),
      onApply: overrides.onApply ?? mock.fn(),
      onCancel: overrides.onCancel ?? mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    return { container, deps, editor };
  }

  it('constructor creates instance with container and deps', () => {
    const { editor } = createEditor();
    assert.ok(editor);
  });

  it('open appends panel to container', () => {
    const { container, editor } = createEditor();
    editor.open();
    assert.equal(container.children.length, 1);
  });

  it('open is idempotent (does not add duplicate panels)', () => {
    const { container, editor } = createEditor();
    editor.open();
    editor.open();
    assert.equal(container.children.length, 1);
  });

  it('close removes the panel', () => {
    const { container, editor } = createEditor();
    editor.open();
    assert.equal(container.children.length, 1);
    editor.close();
    assert.equal(container.children.length, 0);
  });

  it('close is safe to call when not open', () => {
    const { editor } = createEditor();
    assert.doesNotThrow(() => editor.close());
  });

  it('close sets _panel to null', () => {
    const { editor } = createEditor();
    editor.open();
    editor.close();
    assert.equal(editor._panel, null);
  });

  it('can reopen after close', () => {
    const { container, editor } = createEditor();
    editor.open();
    editor.close();
    editor.open();
    assert.equal(container.children.length, 1);
  });
});

// ---------------------------------------------------------------------------
// RedactionEditor — panel structure and mode switching
// ---------------------------------------------------------------------------
describe('RedactionEditor – panel structure', () => {
  function openEditor(overrides = {}) {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: overrides.getPdfBytes ?? (() => new Uint8Array(0)),
      onApply: overrides.onApply ?? mock.fn(),
      onCancel: overrides.onCancel ?? mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();
    const panel = container.children[0];
    return { container, deps, editor, panel };
  }

  it('panel contains a title element', () => {
    const { panel } = openEditor();
    // The first child of the panel is the h3 title
    const title = panel.children[0];
    assert.ok(title);
    assert.equal(title.tagName, 'H3');
    assert.equal(title.textContent, 'Redact Content');
  });

  it('panel contains mode select with 3 options', () => {
    const { panel } = openEditor();
    const selects = panel.querySelectorAll('select');
    assert.ok(selects.length >= 1, 'should have at least one select');
    // First select is the mode selector with search/pattern/scan
    const modeSelect = selects[0];
    const options = modeSelect.children;
    assert.equal(options.length, 3);
    assert.equal(options[0].value, 'search');
    assert.equal(options[1].value, 'pattern');
    assert.equal(options[2].value, 'scan');
  });

  it('panel contains search input', () => {
    const { panel } = openEditor();
    const input = panel.querySelector('input');
    assert.ok(input);
    assert.equal(input.type, 'text');
  });

  it('panel contains pattern select with all REDACTION_PATTERNS keys', () => {
    const { panel } = openEditor();
    const selects = panel.querySelectorAll('select');
    // The second select is the pattern selector
    const patternSelect = selects[1];
    assert.ok(patternSelect);
    const patternKeys = Object.keys(REDACTION_PATTERNS);
    assert.equal(patternSelect.children.length, patternKeys.length);
    for (let i = 0; i < patternKeys.length; i++) {
      assert.equal(patternSelect.children[i].value, patternKeys[i]);
    }
  });

  it('panel contains Scan, Cancel, and Redact buttons', () => {
    const { panel } = openEditor();
    const buttons = panel.querySelectorAll('button');
    assert.equal(buttons.length, 3);
    assert.equal(buttons[0].textContent, 'Scan');
    assert.equal(buttons[1].textContent, 'Cancel');
    assert.equal(buttons[2].textContent, 'Redact');
  });

  it('mode change to "pattern" hides search row and shows pattern row', () => {
    const { panel } = openEditor();
    const selects = panel.querySelectorAll('select');
    const modeSelect = selects[0];

    // Find the rows — search row and pattern row
    // The rows are direct children of the panel; search row has the input
    // We look for display changes after mode change

    // Simulate change to 'pattern'
    modeSelect.value = 'pattern';
    modeSelect.dispatchEvent(new Event('change'));

    // After changing to 'pattern', the search row should be hidden
    // and pattern row should be shown
    const input = panel.querySelector('input');
    // The input's parent row should have display:none
    const searchRow = input.parentNode;
    assert.equal(searchRow.style.display, 'none');

    // Pattern row (second select's parent) should be flex
    const patternSelect = selects[1];
    const patternRow = patternSelect.parentNode;
    assert.equal(patternRow.style.display, 'flex');
  });

  it('mode change to "search" shows search row and hides pattern row', () => {
    const { panel } = openEditor();
    const selects = panel.querySelectorAll('select');
    const modeSelect = selects[0];

    // First switch to pattern, then back to search
    modeSelect.value = 'pattern';
    modeSelect.dispatchEvent(new Event('change'));

    modeSelect.value = 'search';
    modeSelect.dispatchEvent(new Event('change'));

    const input = panel.querySelector('input');
    const searchRow = input.parentNode;
    assert.equal(searchRow.style.display, 'flex');

    const patternSelect = selects[1];
    const patternRow = patternSelect.parentNode;
    assert.equal(patternRow.style.display, 'none');
  });

  it('mode change to "scan" hides both search and pattern rows', () => {
    const { panel } = openEditor();
    const selects = panel.querySelectorAll('select');
    const modeSelect = selects[0];

    modeSelect.value = 'scan';
    modeSelect.dispatchEvent(new Event('change'));

    const input = panel.querySelector('input');
    const searchRow = input.parentNode;
    assert.equal(searchRow.style.display, 'none');

    const patternSelect = selects[1];
    const patternRow = patternSelect.parentNode;
    assert.equal(patternRow.style.display, 'none');
  });
});

// ---------------------------------------------------------------------------
// RedactionEditor — cancel button
// ---------------------------------------------------------------------------
describe('RedactionEditor – cancel button', () => {
  it('cancel button calls close and onCancel', () => {
    const container = document.createElement('div');
    const onCancel = mock.fn();
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
      onCancel,
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    const panel = container.children[0];
    const buttons = panel.querySelectorAll('button');
    const cancelBtn = buttons[1]; // Cancel is the second button

    cancelBtn.click();

    assert.equal(onCancel.mock.calls.length, 1);
    assert.equal(editor._panel, null);
  });

  it('cancel works when onCancel is not provided', () => {
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => new Uint8Array(0),
      onApply: mock.fn(),
      // no onCancel
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    const panel = container.children[0];
    const buttons = panel.querySelectorAll('button');
    const cancelBtn = buttons[1];

    assert.doesNotThrow(() => cancelBtn.click());
    assert.equal(editor._panel, null);
  });
});

// ---------------------------------------------------------------------------
// RedactionEditor – scan button with real PDF
// ---------------------------------------------------------------------------
describe('RedactionEditor – scan button', () => {
  it('scan button shows "No sensitive data found." for empty PDF', async () => {
    const pdfBytes = await makePdf('Hello World');
    const container = document.createElement('div');
    const deps = {
      getPdfBytes: () => pdfBytes,
      onApply: mock.fn(),
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    const panel = container.children[0];
    const buttons = panel.querySelectorAll('button');
    const scanBtn = buttons[0];

    // Click scan and wait for async
    scanBtn.click();
    // Wait for the scan to complete
    await new Promise(r => setTimeout(r, 500));

    // Find status element (div with font-size:12px)
    const allDivs = panel.querySelectorAll('div');
    // The status element has text about results
    let statusText = '';
    for (const d of allDivs) {
      if (d.textContent === 'No sensitive data found.' || d.textContent.includes('match')) {
        statusText = d.textContent;
        break;
      }
    }
    assert.equal(statusText, 'No sensitive data found.');
  });
});

// ---------------------------------------------------------------------------
// RedactionEditor – apply button in search mode with real PDF
// ---------------------------------------------------------------------------
describe('RedactionEditor – apply button (search mode)', () => {
  it('redacts text and calls onApply with count', async () => {
    const pdfBytes = await makePdf('Hello World');
    const container = document.createElement('div');
    const onApply = mock.fn();
    const deps = {
      getPdfBytes: () => pdfBytes,
      onApply,
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    const panel = container.children[0];
    const input = panel.querySelector('input');
    input.value = 'Hello';

    const buttons = panel.querySelectorAll('button');
    const applyBtn = buttons[2]; // Redact button

    applyBtn.click();
    await new Promise(r => setTimeout(r, 500));

    assert.equal(onApply.mock.calls.length, 1);
    const result = onApply.mock.calls[0].arguments[0];
    assert.ok(result.blob);
    assert.ok(typeof result.count === 'number');
  });

  it('apply with no matches returns count 0', async () => {
    const pdfBytes = await makePdf('Hello World');
    const container = document.createElement('div');
    const onApply = mock.fn();
    const deps = {
      getPdfBytes: () => pdfBytes,
      onApply,
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    const input = panel_input(container);
    input.value = 'ZZZNOTFOUND';

    const applyBtn = panel_buttons(container)[2];
    applyBtn.click();
    await new Promise(r => setTimeout(r, 500));

    assert.equal(onApply.mock.calls.length, 1);
    const result = onApply.mock.calls[0].arguments[0];
    assert.equal(result.count, 0);
  });
});

function panel_input(container) {
  return container.children[0].querySelector('input');
}
function panel_buttons(container) {
  return container.children[0].querySelectorAll('button');
}
function panel_selects(container) {
  return container.children[0].querySelectorAll('select');
}

// ---------------------------------------------------------------------------
// RedactionEditor – apply button in pattern mode
// ---------------------------------------------------------------------------
describe('RedactionEditor – apply button (pattern mode)', () => {
  it('redacts by pattern and calls onApply', async () => {
    const pdfBytes = await makePdf('Hello World');
    const container = document.createElement('div');
    const onApply = mock.fn();
    const deps = {
      getPdfBytes: () => pdfBytes,
      onApply,
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    // Switch to pattern mode
    const modeSelect = panel_selects(container)[0];
    modeSelect.value = 'pattern';
    modeSelect.dispatchEvent(new Event('change'));

    const applyBtn = panel_buttons(container)[2];
    applyBtn.click();
    await new Promise(r => setTimeout(r, 500));

    assert.equal(onApply.mock.calls.length, 1);
    const result = onApply.mock.calls[0].arguments[0];
    assert.ok(typeof result.count === 'number');
  });
});

// ---------------------------------------------------------------------------
// RedactionEditor – apply button in scan-all mode
// ---------------------------------------------------------------------------
describe('RedactionEditor – apply button (scan-all mode)', () => {
  it('scans all patterns and calls onApply', async () => {
    const pdfBytes = await makePdf('Hello World');
    const container = document.createElement('div');
    const onApply = mock.fn();
    const deps = {
      getPdfBytes: () => pdfBytes,
      onApply,
    };
    const editor = new RedactionEditor(container, deps);
    editor.open();

    // Switch to scan mode
    const modeSelect = panel_selects(container)[0];
    modeSelect.value = 'scan';
    modeSelect.dispatchEvent(new Event('change'));

    const applyBtn = panel_buttons(container)[2];
    applyBtn.click();
    // Scan-all processes every pattern sequentially, allow more time
    await new Promise(r => setTimeout(r, 2000));

    assert.equal(onApply.mock.calls.length, 1);
    const result = onApply.mock.calls[0].arguments[0];
    assert.ok(typeof result.count === 'number');
  });
});
