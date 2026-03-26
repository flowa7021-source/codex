// ─── Unit Tests: FormDesigner ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { FormDesigner } from '../../app/modules/form-designer.js';

/**
 * Helper: create a minimal 1-page PDF and return its bytes.
 * @returns {Promise<Uint8Array>}
 */
async function makePdfBytes(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

describe('FormDesigner – addTextField → build', () => {
  it('builds a PDF containing one AcroForm text field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer.addTextField(1, [50, 700, 250, 720], { name: 'firstName', defaultValue: 'Jane' });

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);

    const doc = await PDFDocument.load(result);
    const form = doc.getForm();
    const fields = form.getFields();
    assert.equal(fields.length, 1);
    assert.equal(fields[0].getName(), 'firstName');
  });
});

describe('FormDesigner – multiple field types', () => {
  it('adds checkbox and dropdown as distinct field types', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addCheckbox(1, [50, 600, 70, 620], { name: 'agree', checked: true })
      .addDropdown(1, [50, 500, 200, 520], {
        name: 'color',
        options: [{ value: 'r', label: 'Red' }, { value: 'g', label: 'Green' }],
        defaultValue: 'Red',
      });

    const result = await designer.build();
    const doc = await PDFDocument.load(result);
    const form = doc.getForm();
    const fields = form.getFields();
    assert.equal(fields.length, 2);

    const names = fields.map(f => f.getName()).sort();
    assert.deepEqual(names, ['agree', 'color']);
  });
});

describe('FormDesigner – setTabOrder', () => {
  it('records tab order for a page', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'a' })
      .addTextField(1, [50, 650, 250, 670], { name: 'b' })
      .setTabOrder(1, ['b', 'a']);

    // Verify internal state
    assert.deepEqual(designer._tabOrders.get(1), ['b', 'a']);

    // Build should succeed without error
    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });
});

describe('FormDesigner – setValidation', () => {
  it('stores a regex validation rule', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'zipCode' })
      .setValidation('zipCode', { type: 'regex', pattern: '^\\d{5}$' });

    assert.deepEqual(designer._validations.get('zipCode'), { type: 'regex', pattern: '^\\d{5}$' });

    // Build should embed validation without error
    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });
});

describe('FormDesigner – alignFields left', () => {
  it('aligns all fields to the same left x coordinate', () => {
    // Synchronous test – no build needed
    const designer = new FormDesigner(new Uint8Array());
    designer
      .addTextField(1, [100, 700, 250, 720], { name: 'f1' })
      .addTextField(1, [50, 650, 200, 670], { name: 'f2' })
      .addTextField(1, [75, 600, 225, 620], { name: 'f3' });

    designer.alignFields(['f1', 'f2', 'f3'], 'left');

    // All should have x=50 (the minimum)
    for (const f of designer._fields) {
      assert.equal(f.rect[0], 50, `Field ${f.props.name} x should be 50`);
    }
  });
});

describe('FormDesigner – removeField', () => {
  it('removes a field so it is absent from build output', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'keep' })
      .addTextField(1, [50, 650, 250, 670], { name: 'remove' });

    designer.removeField('remove');

    const result = await designer.build();
    const doc = await PDFDocument.load(result);
    const fields = doc.getForm().getFields();
    assert.equal(fields.length, 1);
    assert.equal(fields[0].getName(), 'keep');
  });
});

describe('FormDesigner – getFields', () => {
  it('returns correct field list with names and types', () => {
    const designer = new FormDesigner(new Uint8Array());
    designer
      .addTextField(1, [0, 0, 100, 20], { name: 'txt' })
      .addCheckbox(1, [0, 30, 20, 50], { name: 'chk' })
      .addRadioGroup('rg', [
        { pageNum: 1, rect: [0, 60, 20, 80], value: 'a' },
        { pageNum: 1, rect: [30, 60, 50, 80], value: 'b' },
      ]);

    const list = designer.getFields();
    assert.equal(list.length, 3);
    assert.equal(list[0].name, 'txt');
    assert.equal(list[0].type, 'text');
    assert.equal(list[1].name, 'chk');
    assert.equal(list[1].type, 'checkbox');
    assert.equal(list[2].name, 'rg');
    assert.equal(list[2].type, 'radio');
  });
});
