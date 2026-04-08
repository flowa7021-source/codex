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

describe('FormDesigner – distributeFields horizontal', () => {
  it('evenly distributes 3 fields along x axis', () => {
    const designer = new FormDesigner(new Uint8Array());
    // Fields at x=0, x=200, x=100 (out of order)
    designer
      .addTextField(1, [0, 700, 50, 720], { name: 'f1' })
      .addTextField(1, [100, 700, 150, 720], { name: 'f2' })
      .addTextField(1, [200, 700, 250, 720], { name: 'f3' });

    designer.distributeFields(['f1', 'f2', 'f3'], 'horizontal');

    const rects = designer._fields.map(f => f.rect);
    // After distribution, f2 (middle) should be at x=100 (equidistant from 0 and 200)
    const xValues = rects.map(r => r[0]).sort((a, b) => a - b);
    assert.equal(xValues[0], 0);
    assert.equal(xValues[1], 100);
    assert.equal(xValues[2], 200);
  });

  it('returns this when fewer than 3 matching fields', () => {
    const designer = new FormDesigner(new Uint8Array());
    designer.addTextField(1, [0, 700, 50, 720], { name: 'only' });
    const result = designer.distributeFields(['only'], 'horizontal');
    assert.equal(result, designer);
  });
});

describe('FormDesigner – distributeFields vertical', () => {
  it('evenly distributes 3 fields along y axis', () => {
    const designer = new FormDesigner(new Uint8Array());
    designer
      .addTextField(1, [50, 0, 100, 20], { name: 'a' })
      .addTextField(1, [50, 100, 100, 120], { name: 'b' })
      .addTextField(1, [50, 200, 100, 220], { name: 'c' });

    designer.distributeFields(['a', 'b', 'c'], 'vertical');

    const yValues = designer._fields.map(f => f.rect[1]).sort((a, b) => a - b);
    assert.equal(yValues[0], 0);
    assert.equal(yValues[1], 100);
    assert.equal(yValues[2], 200);
  });
});

describe('FormDesigner – validation rules applied in build()', () => {
  it('applies range validation rule to a text field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'age' })
      .setValidation('age', { type: 'range', min: 0, max: 120 });

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it('applies email validation rule to a text field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'email' })
      .setValidation('email', { type: 'email' });

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });

  it('applies required validation rule to a text field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'required_field' })
      .setValidation('required_field', { type: 'required' });

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });

  it('silently skips validation for non-existent field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    // setValidation on a field not added — should not throw
    designer.setValidation('ghost', { type: 'email' });
    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });
});

describe('FormDesigner – calculation expressions', () => {
  it('applies calculation expression to a text field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'total' })
      .setCalculation('total', 'field1 + field2');

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });

  it('silently skips calculation for non-existent field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer.setCalculation('nonexistent', '1 + 1');
    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });

  it('appends calculation when field already has AA dictionary', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addTextField(1, [50, 700, 250, 720], { name: 'val' })
      .setValidation('val', { type: 'email' })    // sets AA dict
      .setCalculation('val', 'otherField * 2');    // should append C to existing AA

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
  });
});

describe('FormDesigner – text field optional properties', () => {
  it('applies maxLen, multiLine, readOnly, required, and fontSize on text field', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer.addTextField(1, [50, 700, 250, 720], {
      name: 'bio',
      defaultValue: 'Default text',
      maxLen: 100,
      multiLine: true,
      readOnly: true,
      required: true,
      fontSize: 14,
    });

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
    const doc = await PDFDocument.load(result);
    const fields = doc.getForm().getFields();
    assert.equal(fields.length, 1);
    assert.equal(fields[0].getName(), 'bio');
  });
});

describe('FormDesigner – radio group built via build()', () => {
  it('builds a PDF with radio group fields', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer.addRadioGroup('choice', [
      { pageNum: 1, rect: [50, 700, 70, 720], value: 'yes' },
      { pageNum: 1, rect: [80, 700, 100, 720], value: 'no' },
    ]);

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
    const doc = await PDFDocument.load(result);
    const fields = doc.getForm().getFields();
    assert.ok(fields.length >= 1);
  });
});

describe('FormDesigner – listbox and button and signature field types', () => {
  it('adds listbox, button, and signature fields', async () => {
    const bytes = await makePdfBytes();
    const designer = new FormDesigner(bytes);
    designer
      .addListBox(1, [50, 600, 250, 680], { name: 'items', options: ['A', 'B', 'C'] })
      .addPushButton(1, [50, 550, 150, 580], { name: 'submit', label: 'Submit' })
      .addSignatureField(1, [50, 480, 250, 530], { name: 'sig1' });

    const result = await designer.build();
    assert.ok(result instanceof Uint8Array);
    const doc = await PDFDocument.load(result);
    const fields = doc.getForm().getFields();
    // listbox + button + signature (sig is a text field with FT=Sig)
    assert.ok(fields.length >= 3);
  });
});
