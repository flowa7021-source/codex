// ─── Unit Tests: PdfFormManager ──────────────────────────────────────────────
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PdfFormManager } from '../../app/modules/pdf-forms.js';

describe('PdfFormManager basics', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('starts with empty fields', () => {
    assert.deepEqual(fm.getAllFields(), []);
    assert.deepEqual(fm.getPageFields(1), []);
  });

  it('setFieldValue stores and retrieves value', () => {
    fm.setFieldValue('name', 'Alice');
    assert.equal(fm.getFieldValue('name'), 'Alice');
  });

  it('getFieldValue returns empty string for unknown field', () => {
    assert.equal(fm.getFieldValue('nonexistent'), '');
  });

  it('clearAll resets values to defaults', () => {
    // Manually set up fields to test clearAll
    fm.fields.set(1, [
      { name: 'f1', type: 'text', value: 'filled', defaultValue: 'def', page: 1 },
    ]);
    fm.values.set('f1', 'filled');
    fm.clearAll();
    assert.equal(fm.fields.get(1)[0].value, 'def');
    assert.equal(fm.values.size, 0);
  });

  it('fires events via onEvent', () => {
    const events = [];
    fm.onEvent((type, data) => events.push({ type, data }));
    fm.setFieldValue('x', '1');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'change');
    assert.deepEqual(events[0].data, { fieldName: 'x', value: '1' });
  });
});

describe('PdfFormManager export/import', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
    fm.fields.set(1, [
      { name: 'email', type: 'text', value: 'test@example.com', defaultValue: '', page: 1 },
      { name: 'empty', type: 'text', value: '', defaultValue: '', page: 1 },
    ]);
  });

  it('exports only changed fields', () => {
    const data = fm.exportFormData();
    assert.equal(data.app, 'NovaReader');
    assert.ok(data.fields.email);
    assert.ok(!data.fields.empty);
  });

  it('imports form data and updates fields', () => {
    const fm2 = new PdfFormManager();
    fm2.fields.set(1, [
      { name: 'email', type: 'text', value: '', defaultValue: '', page: 1 },
    ]);
    const count = fm2.importFormData(fm.exportFormData());
    assert.equal(count, 1);
    assert.equal(fm2.fields.get(1)[0].value, 'test@example.com');
  });

  it('importFormData returns 0 for null data', () => {
    assert.equal(fm.importFormData(null), 0);
    assert.equal(fm.importFormData({}), 0);
  });
});

describe('PdfFormManager hitTestField', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
    fm.fields.set(1, [
      { name: 'btn', type: 'text', value: '', rect: [10, 10, 110, 40], readOnly: false, page: 1 },
      { name: 'ro', type: 'text', value: '', rect: [200, 200, 300, 230], readOnly: true, page: 1 },
    ]);
  });

  it('finds field at coordinates', () => {
    const hit = fm.hitTestField(1, 50, 20, 1);
    assert.equal(hit.name, 'btn');
  });

  it('returns null for miss', () => {
    assert.equal(fm.hitTestField(1, 500, 500, 1), null);
  });

  it('skips readOnly fields', () => {
    assert.equal(fm.hitTestField(1, 250, 215, 1), null);
  });

  it('respects zoom', () => {
    // At zoom=2, field rect [10,10,110,40] becomes [20,20,200,60] in screen coords
    const hit = fm.hitTestField(1, 100, 50, 2);
    assert.equal(hit.name, 'btn');
  });
});

describe('PdfFormManager _mapFieldType', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('maps Tx to text', () => {
    assert.equal(fm._mapFieldType('Tx', false, false), 'text');
  });

  it('maps Btn checkbox', () => {
    assert.equal(fm._mapFieldType('Btn', true, false), 'checkbox');
  });

  it('maps Btn radio', () => {
    assert.equal(fm._mapFieldType('Btn', false, true), 'radio');
  });

  it('maps Ch to choice', () => {
    assert.equal(fm._mapFieldType('Ch', false, false), 'choice');
  });

  it('maps Sig to signature', () => {
    assert.equal(fm._mapFieldType('Sig', false, false), 'signature');
  });

  it('defaults unknown to text', () => {
    assert.equal(fm._mapFieldType('Unknown', false, false), 'text');
  });
});

// ─── Validation Tests ────────────────────────────────────────────────────────

describe('validateField — required', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('error when required field is empty', () => {
    const field = { name: 'f', value: '', required: true, page: 1, maxLen: 0 };
    const errors = fm.validateField(field);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Обязательное/);
  });

  it('error when required via rule override', () => {
    const field = { name: 'f', value: '  ', required: false, page: 1, maxLen: 0 };
    const errors = fm.validateField(field, { required: true });
    assert.equal(errors.length, 1);
  });

  it('no error when required field has value', () => {
    const field = { name: 'f', value: 'ok', required: true, page: 1, maxLen: 0 };
    const errors = fm.validateField(field);
    assert.equal(errors.length, 0);
  });

  it('no validation on optional empty field', () => {
    const field = { name: 'f', value: '', required: false, page: 1, maxLen: 0 };
    const errors = fm.validateField(field, { minLength: 5 });
    assert.equal(errors.length, 0);
  });
});

describe('validateField — length constraints', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('minLength error', () => {
    const field = { name: 'f', value: 'ab', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { minLength: 3 });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Минимум 3/);
  });

  it('maxLength from rule', () => {
    const field = { name: 'f', value: 'toolong', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { maxLength: 5 });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Максимум 5/);
  });

  it('maxLen from PDF annotation', () => {
    const field = { name: 'f', value: 'abcdef', page: 1, maxLen: 4, required: false };
    const errors = fm.validateField(field);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Максимум 4/);
  });
});

describe('validateField — pattern', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('passes regex pattern', () => {
    const field = { name: 'f', value: 'ABC123', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { pattern: '^[A-Z]+\\d+$' });
    assert.equal(errors.length, 0);
  });

  it('fails regex pattern', () => {
    const field = { name: 'f', value: 'abc', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { pattern: '^\\d+$' });
    assert.equal(errors.length, 1);
  });

  it('uses custom patternMessage', () => {
    const field = { name: 'f', value: 'bad', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { pattern: '^\\d+$', patternMessage: 'Only digits' });
    assert.equal(errors[0].message, 'Only digits');
  });
});

describe('validateField — numeric range', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  it('NaN value with min/max', () => {
    const field = { name: 'f', value: 'abc', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { min: 0, max: 100 });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /число/);
  });

  it('below min', () => {
    const field = { name: 'f', value: '-5', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { min: 0 });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Минимум 0/);
  });

  it('above max', () => {
    const field = { name: 'f', value: '200', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { max: 100 });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Максимум 100/);
  });

  it('within range is fine', () => {
    const field = { name: 'f', value: '50', page: 1, maxLen: 0, required: false };
    const errors = fm.validateField(field, { min: 0, max: 100 });
    assert.equal(errors.length, 0);
  });
});

describe('validateField — format validators', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
  });

  const mkField = (value) => ({ name: 'f', value, page: 1, maxLen: 0, required: false });

  it('valid email', () => {
    assert.equal(fm.validateField(mkField('a@b.c'), { format: 'email' }).length, 0);
  });

  it('invalid email', () => {
    assert.equal(fm.validateField(mkField('notanemail'), { format: 'email' }).length, 1);
  });

  it('valid phone', () => {
    assert.equal(fm.validateField(mkField('+7 (999) 123-4567'), { format: 'phone' }).length, 0);
  });

  it('invalid phone', () => {
    assert.equal(fm.validateField(mkField('abc'), { format: 'phone' }).length, 1);
  });

  it('valid date', () => {
    assert.equal(fm.validateField(mkField('2024-01-15'), { format: 'date' }).length, 0);
  });

  it('invalid date', () => {
    assert.equal(fm.validateField(mkField('not-a-date'), { format: 'date' }).length, 1);
  });

  it('valid url', () => {
    assert.equal(fm.validateField(mkField('https://example.com'), { format: 'url' }).length, 0);
  });

  it('invalid url', () => {
    assert.equal(fm.validateField(mkField('not a url'), { format: 'url' }).length, 1);
  });

  it('valid integer', () => {
    assert.equal(fm.validateField(mkField('42'), { format: 'integer' }).length, 0);
    assert.equal(fm.validateField(mkField('-7'), { format: 'integer' }).length, 0);
  });

  it('invalid integer', () => {
    assert.equal(fm.validateField(mkField('3.14'), { format: 'integer' }).length, 1);
  });

  it('valid decimal', () => {
    assert.equal(fm.validateField(mkField('3.14'), { format: 'decimal' }).length, 0);
    assert.equal(fm.validateField(mkField('3,14'), { format: 'decimal' }).length, 0);
  });

  it('invalid decimal', () => {
    assert.equal(fm.validateField(mkField('abc'), { format: 'decimal' }).length, 1);
  });
});

describe('validateAll', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
    fm.fields.set(1, [
      { name: 'name', type: 'text', value: 'Alice', required: true, page: 1, maxLen: 0 },
      { name: 'age', type: 'text', value: '', required: true, page: 1, maxLen: 0 },
    ]);
    fm.fields.set(2, [
      { name: 'email', type: 'text', value: 'bad', required: false, page: 2, maxLen: 0 },
    ]);
  });

  it('collects errors across pages', () => {
    const result = fm.validateAll({ email: { format: 'email' } });
    assert.equal(result.valid, false);
    // age is required+empty, email is invalid format
    assert.equal(result.errors.length, 2);
  });

  it('valid when all fields pass', () => {
    fm.fields.get(1)[1].value = '25';
    fm.fields.get(2)[0].value = 'a@b.c';
    const result = fm.validateAll({ email: { format: 'email' } });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
});

describe('getEmptyRequiredFields', () => {
  let fm;

  beforeEach(() => {
    fm = new PdfFormManager();
    fm.fields.set(1, [
      { name: 'f1', value: 'ok', required: true, page: 1 },
      { name: 'f2', value: '', required: true, page: 1 },
      { name: 'f3', value: '', required: false, page: 1 },
    ]);
  });

  it('returns only required empty fields', () => {
    const empty = fm.getEmptyRequiredFields();
    assert.equal(empty.length, 1);
    assert.equal(empty[0].name, 'f2');
  });
});
