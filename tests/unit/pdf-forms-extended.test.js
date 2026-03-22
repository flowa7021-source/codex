// ─── Extended Unit Tests: PdfFormManager ─────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PdfFormManager } from '../../app/modules/pdf-forms.js';

// ─── persistToLocalStorage / loadFromLocalStorage ───────────────────────────

describe('PdfFormManager persistence', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
    fm.fields.set(1, [
      { name: 'field1', type: 'text', value: 'hello', defaultValue: '', page: 1 },
      { name: 'field2', type: 'text', value: '', defaultValue: '', page: 1 },
    ]);
    localStorage.clear();
  });

  it('persists to localStorage', () => {
    fm.persistToLocalStorage('testdoc');
    const raw = localStorage.getItem('nr-forms-testdoc');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.ok(parsed.fields.field1);
  });

  it('does nothing when docName is empty', () => {
    fm.persistToLocalStorage('');
    fm.persistToLocalStorage(null);
    assert.ok(true); // no crash
  });

  it('loads from localStorage', () => {
    fm.persistToLocalStorage('testdoc');
    const fm2 = new PdfFormManager();
    fm2.fields.set(1, [
      { name: 'field1', type: 'text', value: '', defaultValue: '', page: 1 },
    ]);
    const count = fm2.loadFromLocalStorage('testdoc');
    assert.equal(count, 1);
    assert.equal(fm2.getFieldValue('field1'), 'hello');
  });

  it('loadFromLocalStorage returns 0 for empty docName', () => {
    assert.equal(fm.loadFromLocalStorage(''), 0);
    assert.equal(fm.loadFromLocalStorage(null), 0);
  });

  it('loadFromLocalStorage returns 0 when no data', () => {
    assert.equal(fm.loadFromLocalStorage('nonexistent'), 0);
  });

  it('loadFromLocalStorage returns 0 for corrupted data', () => {
    localStorage.setItem('nr-forms-corrupt', 'not valid json{{{');
    assert.equal(fm.loadFromLocalStorage('corrupt'), 0);
  });
});

// ─── renderFormOverlay ──────────────────────────────────────────────────────

describe('PdfFormManager renderFormOverlay', () => {
  let fm;
  let ctx;

  beforeEach(() => {
    fm = new PdfFormManager();
    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textBaseline: '',
      fillRect() {},
      strokeRect() {},
      fillText() {},
    };
  });

  it('does nothing for empty page fields', () => {
    assert.doesNotThrow(() => fm.renderFormOverlay(ctx, 1));
  });

  it('renders text field with value', () => {
    fm.fields.set(1, [
      { name: 'f1', type: 'text', value: 'hello', rect: [10, 10, 200, 40], readOnly: false, required: false, page: 1 },
    ]);
    let textDrawn = false;
    ctx.fillText = () => { textDrawn = true; };
    fm.renderFormOverlay(ctx, 1, 1);
    assert.ok(textDrawn);
  });

  it('renders required field with red border', () => {
    fm.fields.set(1, [
      { name: 'f1', type: 'text', value: '', rect: [10, 10, 200, 40], readOnly: false, required: true, page: 1 },
    ]);
    fm.renderFormOverlay(ctx, 1, 1);
    assert.equal(ctx.strokeStyle, '#ef4444');
  });

  it('renders non-required field with blue border', () => {
    fm.fields.set(1, [
      { name: 'f1', type: 'text', value: '', rect: [10, 10, 200, 40], readOnly: false, required: false, page: 1 },
    ]);
    fm.renderFormOverlay(ctx, 1, 1);
    assert.equal(ctx.strokeStyle, '#3b82f6');
  });

  it('skips readOnly fields', () => {
    fm.fields.set(1, [
      { name: 'f1', type: 'text', value: 'x', rect: [10, 10, 200, 40], readOnly: true, required: false, page: 1 },
    ]);
    let filled = false;
    ctx.fillRect = () => { filled = true; };
    fm.renderFormOverlay(ctx, 1, 1);
    assert.equal(filled, false);
  });

  it('renders checkbox with checkmark', () => {
    fm.fields.set(1, [
      { name: 'cb', type: 'checkbox', value: 'Yes', rect: [10, 10, 30, 30], readOnly: false, required: false, page: 1 },
    ]);
    let textDrawn = '';
    ctx.fillText = (text) => { textDrawn = text; };
    fm.renderFormOverlay(ctx, 1, 1);
    // The checkmark character
    assert.ok(textDrawn.includes('\u2713') || textDrawn === '\u2713');
  });

  it('handles viewport parameter', () => {
    fm.fields.set(1, [
      { name: 'f1', type: 'text', value: 'test', rect: [10, 10, 200, 40], readOnly: false, required: false, page: 1 },
    ]);
    assert.doesNotThrow(() => fm.renderFormOverlay(ctx, 1, 1, { height: 842 }));
  });
});

// ─── loadFromAdapter ────────────────────────────────────────────────────────

describe('PdfFormManager loadFromAdapter', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('returns 0 for null adapter', async () => {
    const count = await fm.loadFromAdapter(null);
    assert.equal(count, 0);
  });

  it('returns 0 for non-pdf adapter', async () => {
    const count = await fm.loadFromAdapter({ type: 'djvu' });
    assert.equal(count, 0);
  });
});

// ─── setFieldValue updates fields in map ────────────────────────────────────

describe('PdfFormManager setFieldValue across pages', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
    fm.fields.set(1, [
      { name: 'shared', type: 'text', value: '', page: 1 },
    ]);
    fm.fields.set(2, [
      { name: 'shared', type: 'text', value: '', page: 2 },
    ]);
  });

  it('updates all fields with matching name', () => {
    fm.setFieldValue('shared', 'updated');
    assert.equal(fm.fields.get(1)[0].value, 'updated');
    assert.equal(fm.fields.get(2)[0].value, 'updated');
  });
});

// ─── _validateFormat edge cases ─────────────────────────────────────────────

describe('_validateFormat edge cases', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('returns null for unknown format', () => {
    const field = { name: 'f', page: 1 };
    const result = fm._validateFormat('hello', 'unknown_format', field);
    assert.equal(result, null);
  });

  it('handles pattern as RegExp object', () => {
    const field = { name: 'f', value: '123', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { pattern: /^\d+$/ });
    assert.equal(errors.length, 0);
  });
});
