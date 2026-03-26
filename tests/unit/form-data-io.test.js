// ─── Unit Tests: Form Data I/O ───────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportFormDataFdf, exportFormDataXfdf, exportFormDataCsv, exportFormDataXml,
  importFormDataFdf, importFormDataXfdf, importFormDataCsv,
} from '../../app/modules/form-data-io.js';

// ─── FDF Round-Trip ─────────────────────────────────────────────────────────

describe('FDF export → import round-trip', () => {
  it('preserves field names and values exactly', () => {
    const fields = [
      { name: 'firstName', value: 'Alice' },
      { name: 'lastName', value: 'Smith' },
      { name: 'age', value: '30' },
    ];

    const fdf = exportFormDataFdf(fields);
    assert.ok(fdf.startsWith('%FDF-1.2'));
    assert.ok(fdf.includes('%%EOF'));

    const parsed = importFormDataFdf(fdf);
    assert.equal(parsed.size, 3);
    assert.equal(parsed.get('firstName'), 'Alice');
    assert.equal(parsed.get('lastName'), 'Smith');
    assert.equal(parsed.get('age'), '30');
  });

  it('handles special characters in FDF values', () => {
    const fields = [
      { name: 'note', value: 'Hello (world) \\ end' },
    ];

    const fdf = exportFormDataFdf(fields);
    const parsed = importFormDataFdf(fdf);
    assert.equal(parsed.get('note'), 'Hello (world) \\ end');
  });

  it('handles empty field list', () => {
    const fdf = exportFormDataFdf([]);
    assert.ok(fdf.startsWith('%FDF-1.2'));
    const parsed = importFormDataFdf(fdf);
    assert.equal(parsed.size, 0);
  });
});

// ─── XFDF Round-Trip ────────────────────────────────────────────────────────

describe('XFDF export → import round-trip', () => {
  it('produces valid XML that parses back correctly', () => {
    const fields = [
      { name: 'email', value: 'user@example.com' },
      { name: 'comment', value: 'Great <product> & "service"' },
    ];

    const xfdf = exportFormDataXfdf(fields);
    assert.ok(xfdf.includes('<?xml version="1.0"'));
    assert.ok(xfdf.includes('<xfdf xmlns="http://ns.adobe.com/xfdf/">'));
    assert.ok(xfdf.includes('</xfdf>'));

    const parsed = importFormDataXfdf(xfdf);
    assert.equal(parsed.size, 2);
    assert.equal(parsed.get('email'), 'user@example.com');
    assert.equal(parsed.get('comment'), 'Great <product> & "service"');
  });

  it('handles empty fields', () => {
    const xfdf = exportFormDataXfdf([]);
    const parsed = importFormDataXfdf(xfdf);
    assert.equal(parsed.size, 0);
  });
});

// ─── CSV Export ─────────────────────────────────────────────────────────────

describe('CSV export', () => {
  it('exports 5 fields as header + 5 data rows', () => {
    const fields = [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
      { name: 'c', value: '3' },
      { name: 'd', value: '4' },
      { name: 'e', value: '5' },
    ];

    const csv = exportFormDataCsv(fields);
    const lines = csv.split('\n').filter(l => l.length > 0);
    assert.equal(lines.length, 6); // header + 5 data rows
    assert.equal(lines[0], 'name,value');
    assert.equal(lines[1], 'a,1');
    assert.equal(lines[5], 'e,5');
  });

  it('round-trips through CSV import', () => {
    const fields = [
      { name: 'x', value: 'hello, world' },
      { name: 'y', value: 'quote "test"' },
    ];

    const csv = exportFormDataCsv(fields);
    const parsed = importFormDataCsv(csv);
    assert.equal(parsed.size, 2);
    assert.equal(parsed.get('x'), 'hello, world');
    assert.equal(parsed.get('y'), 'quote "test"');
  });
});

// ─── XML Export ─────────────────────────────────────────────────────────────

describe('XML export', () => {
  it('produces well-formed XML with field entries', () => {
    const fields = [
      { name: 'title', value: 'My Doc' },
    ];

    const xml = exportFormDataXml(fields);
    assert.ok(xml.includes('<?xml version="1.0"'));
    assert.ok(xml.includes('<form-data>'));
    assert.ok(xml.includes('</form-data>'));
    assert.ok(xml.includes('name="title"'));
    assert.ok(xml.includes('My Doc'));
  });
});

// ─── Import Edge Cases ──────────────────────────────────────────────────────

describe('Import edge cases', () => {
  it('importFormDataFdf returns empty map for null input', () => {
    const result = importFormDataFdf(null);
    assert.equal(result.size, 0);
  });

  it('importFormDataXfdf returns empty map for empty string', () => {
    const result = importFormDataXfdf('');
    assert.equal(result.size, 0);
  });

  it('importFormDataCsv returns empty map for header-only CSV', () => {
    const result = importFormDataCsv('name,value\n');
    assert.equal(result.size, 0);
  });

  it('FDF import with non-existent field does not error', () => {
    // Create FDF with a field, then parse – the parsed Map simply contains whatever is in the FDF.
    // The caller (PdfFormManager.importData) is responsible for skipping non-existent fields.
    const fdf = exportFormDataFdf([{ name: 'ghost', value: 'boo' }]);
    const parsed = importFormDataFdf(fdf);
    assert.equal(parsed.get('ghost'), 'boo');
    // No error thrown – that is the test
  });
});
