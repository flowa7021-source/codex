import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  detectFormFields,
  autoCreateForm,
  detectFieldsFromText,
  mergeOverlapping,
  LABEL_PATTERNS,
} from '../../app/modules/form-field-detector.js';

// ---------------------------------------------------------------------------
// Exported function existence
// ---------------------------------------------------------------------------

describe('form-field-detector exports', () => {
  it('detectFormFields is a function', () => {
    assert.equal(typeof detectFormFields, 'function');
  });

  it('autoCreateForm is a function', () => {
    assert.equal(typeof autoCreateForm, 'function');
  });

  it('detectFieldsFromText is a function', () => {
    assert.equal(typeof detectFieldsFromText, 'function');
  });

  it('mergeOverlapping is a function', () => {
    assert.equal(typeof mergeOverlapping, 'function');
  });

  it('LABEL_PATTERNS has expected field types', () => {
    assert.ok(LABEL_PATTERNS.text instanceof RegExp);
    assert.ok(LABEL_PATTERNS.date instanceof RegExp);
    assert.ok(LABEL_PATTERNS.checkbox instanceof RegExp);
    assert.ok(LABEL_PATTERNS.signature instanceof RegExp);
    assert.ok(LABEL_PATTERNS.dropdown instanceof RegExp);
  });
});

// ---------------------------------------------------------------------------
// LABEL_PATTERNS matching
// ---------------------------------------------------------------------------

describe('LABEL_PATTERNS', () => {
  it('text pattern matches common form labels', () => {
    assert.ok(LABEL_PATTERNS.text.test('Name'));
    assert.ok(LABEL_PATTERNS.text.test('Email Address'));
    assert.ok(LABEL_PATTERNS.text.test('Phone'));
    assert.ok(LABEL_PATTERNS.text.test('Company'));
  });

  it('date pattern matches date-related labels', () => {
    assert.ok(LABEL_PATTERNS.date.test('Date of Birth'));
    assert.ok(LABEL_PATTERNS.date.test('Expiration Date'));
    assert.ok(LABEL_PATTERNS.date.test('Issued'));
  });

  it('signature pattern matches signature labels', () => {
    assert.ok(LABEL_PATTERNS.signature.test('Signature'));
    assert.ok(LABEL_PATTERNS.signature.test('Sign Here'));
    assert.ok(LABEL_PATTERNS.signature.test('Authorized'));
  });
});

// ---------------------------------------------------------------------------
// detectFieldsFromText
// ---------------------------------------------------------------------------

describe('detectFieldsFromText', () => {
  it('returns empty array for items with no label patterns', () => {
    const items = [
      { str: 'Some random text', transform: [12, 0, 0, 12, 50, 700], width: 100, height: 12 },
    ];
    const fields = detectFieldsFromText(items, 1, 792);
    assert.ok(Array.isArray(fields));
    assert.equal(fields.length, 0);
  });

  it('detects text field from label like "Name:"', () => {
    const items = [
      { str: 'Name:', transform: [12, 0, 0, 12, 50, 700], width: 40, height: 12 },
    ];
    const fields = detectFieldsFromText(items, 1, 792);
    assert.ok(fields.length >= 1);
    assert.equal(fields[0].type, 'text');
    assert.ok(fields[0].label.includes('Name'));
    assert.equal(fields[0].pageNum, 1);
  });

  it('detects signature field from "Sign Here"', () => {
    const items = [
      { str: 'Sign Here', transform: [12, 0, 0, 12, 50, 300], width: 60, height: 12 },
    ];
    const fields = detectFieldsFromText(items, 1, 792);
    assert.ok(fields.length >= 1);
    assert.equal(fields[0].type, 'signature');
  });

  it('detects date field from "Date of Birth"', () => {
    const items = [
      { str: 'Date of Birth', transform: [12, 0, 0, 12, 50, 500], width: 80, height: 12 },
    ];
    const fields = detectFieldsFromText(items, 1, 792);
    assert.ok(fields.length >= 1);
    assert.equal(fields[0].type, 'date');
  });

  it('detects dropdown field from "Select one"', () => {
    const items = [
      { str: 'Select one', transform: [12, 0, 0, 12, 50, 400], width: 60, height: 12 },
    ];
    const fields = detectFieldsFromText(items, 1, 792);
    assert.ok(fields.length >= 1);
    assert.equal(fields[0].type, 'dropdown');
    assert.ok(Array.isArray(fields[0].options));
  });

  it('returns field objects with expected shape', () => {
    const items = [
      { str: 'Email:', transform: [12, 0, 0, 12, 50, 600], width: 40, height: 12 },
    ];
    const fields = detectFieldsFromText(items, 2, 792);
    assert.ok(fields.length >= 1);
    const f = fields[0];
    assert.equal(typeof f.type, 'string');
    assert.equal(typeof f.label, 'string');
    assert.equal(typeof f.name, 'string');
    assert.equal(typeof f.pageNum, 'number');
    assert.equal(typeof f.bounds.x, 'number');
    assert.equal(typeof f.bounds.y, 'number');
    assert.equal(typeof f.bounds.width, 'number');
    assert.equal(typeof f.bounds.height, 'number');
    assert.equal(typeof f.confidence, 'number');
  });
});

// ---------------------------------------------------------------------------
// mergeOverlapping
// ---------------------------------------------------------------------------

describe('mergeOverlapping', () => {
  it('returns same array when no overlaps', () => {
    const fields = [
      { type: 'text', label: 'A', name: 'a', pageNum: 1, bounds: { x: 0, y: 0, width: 100, height: 20 }, confidence: 0.7 },
      { type: 'text', label: 'B', name: 'b', pageNum: 1, bounds: { x: 0, y: 100, width: 100, height: 20 }, confidence: 0.7 },
    ];
    const merged = mergeOverlapping(fields);
    assert.equal(merged.length, 2);
  });

  it('merges overlapping fields keeping higher confidence', () => {
    const fields = [
      { type: 'text', label: 'A', name: 'a', pageNum: 1, bounds: { x: 50, y: 100, width: 200, height: 20 }, confidence: 0.5 },
      { type: 'date', label: 'B', name: 'b', pageNum: 1, bounds: { x: 60, y: 105, width: 200, height: 20 }, confidence: 0.8 },
    ];
    const merged = mergeOverlapping(fields);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].confidence, 0.8);
  });

  it('returns empty or single-element arrays unchanged', () => {
    assert.deepEqual(mergeOverlapping([]), []);
    const single = [{ type: 'text', label: 'X', name: 'x', pageNum: 1, bounds: { x: 0, y: 0, width: 100, height: 20 }, confidence: 0.7 }];
    assert.equal(mergeOverlapping(single).length, 1);
  });
});

// ---------------------------------------------------------------------------
// autoCreateForm
// ---------------------------------------------------------------------------

describe('autoCreateForm', () => {
  it('creates form fields from detected field definitions', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const detectedFields = [
      { type: 'text', label: 'Name', name: 'name_1', pageNum: 1, bounds: { x: 100, y: 700, width: 200, height: 20 }, confidence: 0.8 },
      { type: 'checkbox', label: 'Agree', name: 'agree_1', pageNum: 1, bounds: { x: 100, y: 650, width: 14, height: 14 }, confidence: 0.7 },
    ];

    const result = await autoCreateForm(pdfBytes, detectedFields);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'application/pdf');
    assert.equal(result.fieldCount, 2);
  });

  it('returns fieldCount 0 for empty detectedFields', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const result = await autoCreateForm(pdfBytes, []);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.fieldCount, 0);
  });

  it('handles dropdown field type with options', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const pdfBytes = new Uint8Array(await doc.save());

    const detectedFields = [
      {
        type: 'dropdown', label: 'Country', name: 'country_1', pageNum: 1,
        bounds: { x: 100, y: 500, width: 200, height: 20 }, confidence: 0.7,
        options: ['USA', 'Canada', 'UK'],
      },
    ];

    const result = await autoCreateForm(pdfBytes, detectedFields);
    assert.equal(result.fieldCount, 1);
  });
});
