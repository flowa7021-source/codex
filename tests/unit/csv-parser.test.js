// ─── Unit Tests: csv-parser ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCSV,
  generateCSV,
  parseCSVLine,
  needsQuoting,
} from '../../app/modules/csv-parser.js';

// ─── parseCSV: basic ─────────────────────────────────────────────────────────

describe('parseCSV - basic', () => {
  it('parses a simple CSV with headers', () => {
    const result = parseCSV('name,age,city\nAlice,30,NYC\nBob,25,LA');
    assert.deepEqual(result.headers, ['name', 'age', 'city']);
    assert.deepEqual(result.rows, [['Alice', '30', 'NYC'], ['Bob', '25', 'LA']]);
    assert.equal(result.records.length, 2);
    assert.equal(result.records[0].name, 'Alice');
    assert.equal(result.records[0].age, '30');
    assert.equal(result.records[1].name, 'Bob');
  });

  it('returns correct headers array', () => {
    const result = parseCSV('x,y,z\n1,2,3');
    assert.deepEqual(result.headers, ['x', 'y', 'z']);
  });

  it('returns empty result for empty string', () => {
    const result = parseCSV('');
    assert.deepEqual(result.headers, []);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.records, []);
  });

  it('handles single header row with no data rows', () => {
    const result = parseCSV('a,b,c');
    assert.deepEqual(result.headers, ['a', 'b', 'c']);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.records, []);
  });
});

// ─── parseCSV: quoted fields ──────────────────────────────────────────────────

describe('parseCSV - quoted fields', () => {
  it('parses quoted fields that contain commas', () => {
    const result = parseCSV('name,address\n"Smith, John","123 Main St, Apt 4"');
    assert.deepEqual(result.headers, ['name', 'address']);
    assert.equal(result.records[0].name, 'Smith, John');
    assert.equal(result.records[0].address, '123 Main St, Apt 4');
  });

  it('parses quoted fields that contain newlines', () => {
    const csv = 'id,text\n1,"line1\nline2"';
    const result = parseCSV(csv);
    assert.equal(result.records[0].text, 'line1\nline2');
  });

  it('handles escaped quotes (doubled) inside quoted fields', () => {
    const result = parseCSV('a,b\n"say ""hello""",plain');
    assert.equal(result.records[0].a, 'say "hello"');
    assert.equal(result.records[0].b, 'plain');
  });
});

// ─── parseCSV: custom delimiter ──────────────────────────────────────────────

describe('parseCSV - custom delimiter', () => {
  it('parses semicolon-delimited CSV', () => {
    const result = parseCSV('name;age\nAlice;30\nBob;25', { delimiter: ';' });
    assert.deepEqual(result.headers, ['name', 'age']);
    assert.equal(result.records[0].name, 'Alice');
    assert.equal(result.records[1].age, '25');
  });

  it('parses tab-delimited CSV', () => {
    const result = parseCSV('x\ty\n1\t2', { delimiter: '\t' });
    assert.deepEqual(result.headers, ['x', 'y']);
    assert.equal(result.records[0].x, '1');
    assert.equal(result.records[0].y, '2');
  });
});

// ─── parseCSV: skipEmptyLines ─────────────────────────────────────────────────

describe('parseCSV - skipEmptyLines', () => {
  it('skips empty lines by default', () => {
    const result = parseCSV('name,age\n\nAlice,30\n\nBob,25');
    assert.equal(result.rows.length, 2);
  });

  it('includes empty lines when skipEmptyLines is false', () => {
    const result = parseCSV('name,age\n\nAlice,30', { skipEmptyLines: false });
    // One empty line becomes a data row with empty fields
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], ['']);
  });
});

// ─── parseCSV: hasHeader false ────────────────────────────────────────────────

describe('parseCSV - hasHeader false', () => {
  it('treats all rows as data when hasHeader is false', () => {
    const result = parseCSV('1,2\n3,4', { hasHeader: false });
    assert.deepEqual(result.headers, []);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows[0], ['1', '2']);
    assert.deepEqual(result.rows[1], ['3', '4']);
    assert.deepEqual(result.records, [{}, {}]);
  });
});

// ─── generateCSV ─────────────────────────────────────────────────────────────

describe('generateCSV', () => {
  it('produces valid CSV from records', () => {
    const records = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const csv = generateCSV(records);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'name,age');
    assert.equal(lines[1], 'Alice,30');
    assert.equal(lines[2], 'Bob,25');
  });

  it('quotes fields that contain commas', () => {
    const records = [{ name: 'Smith, John', city: 'NYC' }];
    const csv = generateCSV(records);
    assert.ok(csv.includes('"Smith, John"'));
  });

  it('quotes fields that contain double quotes, escaping them', () => {
    const records = [{ value: 'say "hello"' }];
    const csv = generateCSV(records);
    assert.ok(csv.includes('"say ""hello"""'));
  });

  it('quotes fields that contain newlines', () => {
    const records = [{ text: 'line1\nline2' }];
    const csv = generateCSV(records);
    assert.ok(csv.includes('"line1\nline2"'));
  });

  it('returns empty string for empty records array', () => {
    assert.equal(generateCSV([]), '');
  });

  it('round-trips through parseCSV', () => {
    const records = [
      { name: 'Alice', age: '30', city: 'NYC' },
      { name: 'Bob', age: '25', city: 'LA' },
    ];
    const csv = generateCSV(records);
    const parsed = parseCSV(csv);
    assert.deepEqual(parsed.records, records);
  });
});

// ─── parseCSVLine ─────────────────────────────────────────────────────────────

describe('parseCSVLine', () => {
  it('splits a plain CSV line', () => {
    assert.deepEqual(parseCSVLine('a,b,c'), ['a', 'b', 'c']);
  });

  it('handles quoted values', () => {
    assert.deepEqual(parseCSVLine('"hello world",foo'), ['hello world', 'foo']);
  });

  it('handles quoted values with embedded delimiter', () => {
    assert.deepEqual(parseCSVLine('"a,b",c'), ['a,b', 'c']);
  });

  it('handles doubled quotes inside quoted field', () => {
    assert.deepEqual(parseCSVLine('"say ""hi"""'), ['say "hi"']);
  });

  it('handles empty fields', () => {
    assert.deepEqual(parseCSVLine('a,,c'), ['a', '', 'c']);
  });

  it('handles single field', () => {
    assert.deepEqual(parseCSVLine('hello'), ['hello']);
  });

  it('uses custom delimiter', () => {
    assert.deepEqual(parseCSVLine('a;b;c', ';'), ['a', 'b', 'c']);
  });
});

// ─── needsQuoting ─────────────────────────────────────────────────────────────

describe('needsQuoting', () => {
  it('returns true when value contains the delimiter', () => {
    assert.equal(needsQuoting('hello,world'), true);
  });

  it('returns true when value contains a double quote', () => {
    assert.equal(needsQuoting('say "hi"'), true);
  });

  it('returns true when value contains a newline', () => {
    assert.equal(needsQuoting('line1\nline2'), true);
  });

  it('returns true when value contains carriage return', () => {
    assert.equal(needsQuoting('line1\rline2'), true);
  });

  it('returns false for plain values', () => {
    assert.equal(needsQuoting('hello'), false);
    assert.equal(needsQuoting('123'), false);
    assert.equal(needsQuoting(''), false);
  });

  it('uses custom delimiter when provided', () => {
    assert.equal(needsQuoting('hello;world', ';'), true);
    assert.equal(needsQuoting('hello,world', ';'), false);
  });
});
