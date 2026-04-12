// ─── Unit Tests: csv-parser ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parse,
  parseRows,
  stringify,
  stringifyRows,
  detectDelimiter,
  countRows,
} from '../../app/modules/csv-parser.js';

// ─── parse() basic ────────────────────────────────────────────────────────────

describe('parse() - basic with headers', () => {
  it('parses a simple CSV with header row', () => {
    const result = parse('name,age,city\nAlice,30,NYC\nBob,25,LA');
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[0].age, '30');
    assert.equal(result[0].city, 'NYC');
    assert.equal(result[1].name, 'Bob');
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parse(''), []);
  });

  it('returns empty array when only header row present', () => {
    const result = parse('name,age');
    assert.deepEqual(result, []);
  });

  it('handles a single data column', () => {
    const result = parse('value\nhello\nworld');
    assert.equal(result.length, 2);
    assert.equal(result[0].value, 'hello');
    assert.equal(result[1].value, 'world');
  });

  it('handles missing trailing fields (fills with empty string)', () => {
    const result = parse('a,b,c\n1,2');
    assert.equal(result[0].c, '');
  });

  it('parses header: false — returns objects with numeric string keys', () => {
    const result = parse('1,2,3\n4,5,6', { header: false });
    assert.equal(result.length, 2);
    assert.equal(result[0]['0'], '1');
    assert.equal(result[0]['1'], '2');
    assert.equal(result[1]['2'], '6');
  });

  it('handles CRLF line endings', () => {
    const result = parse('a,b\r\n1,2\r\n3,4');
    assert.equal(result.length, 2);
    assert.equal(result[0].a, '1');
    assert.equal(result[1].b, '4');
  });

  it('skips empty rows by default', () => {
    const result = parse('name,age\n\nAlice,30\n\nBob,25');
    assert.equal(result.length, 2);
  });

  it('includes empty rows when skipEmpty is false', () => {
    const result = parse('name,age\n\nAlice,30', { skipEmpty: false });
    assert.equal(result.length, 2);
  });
});

// ─── parse() with quoted fields ──────────────────────────────────────────────

describe('parse() - quoted fields', () => {
  it('parses quoted field containing a comma', () => {
    const result = parse('name,address\n"Smith, John","123 Main St"');
    assert.equal(result[0].name, 'Smith, John');
    assert.equal(result[0].address, '123 Main St');
  });

  it('parses quoted field containing a newline', () => {
    const csv = 'id,text\n1,"line1\nline2"';
    const result = parse(csv);
    assert.equal(result[0].text, 'line1\nline2');
  });

  it('parses doubled quotes (escaped) inside a quoted field', () => {
    const result = parse('a,b\n"say ""hello""",plain');
    assert.equal(result[0].a, 'say "hello"');
    assert.equal(result[0].b, 'plain');
  });

  it('parses empty quoted field', () => {
    const result = parse('x,y\n"",hello');
    assert.equal(result[0].x, '');
    assert.equal(result[0].y, 'hello');
  });

  it('parses a quoted field with embedded CRLF', () => {
    const result = parse('a,b\n"multi\r\nline",end');
    assert.equal(result[0].a, 'multi\r\nline');
  });

  it('parses a field that starts with a quote midway through row', () => {
    const result = parse('a,b,c\n1,"two,2",3');
    assert.equal(result[0].b, 'two,2');
    assert.equal(result[0].c, '3');
  });
});

// ─── parse() options ─────────────────────────────────────────────────────────

describe('parse() - options', () => {
  it('uses custom delimiter (semicolon)', () => {
    const result = parse('name;age\nAlice;30', { delimiter: ';' });
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[0].age, '30');
  });

  it('uses custom delimiter (tab)', () => {
    const result = parse('x\ty\n1\t2', { delimiter: '\t' });
    assert.equal(result[0].x, '1');
    assert.equal(result[0].y, '2');
  });

  it('uses custom delimiter (pipe)', () => {
    const result = parse('a|b\n1|2', { delimiter: '|' });
    assert.equal(result[0].a, '1');
    assert.equal(result[0].b, '2');
  });

  it('trims whitespace from fields when trim:true', () => {
    const result = parse('name , age\n  Alice  ,  30  ', { trim: true });
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[0].age, '30');
  });

  it('does not trim whitespace by default', () => {
    const result = parse('name,age\n Alice ,30');
    assert.equal(result[0].name, ' Alice ');
  });

  it('uses custom quote character', () => {
    const result = parse("name,value\n'hello, world','test'", { quote: "'" });
    assert.equal(result[0].name, 'hello, world');
    assert.equal(result[0].value, 'test');
  });
});

// ─── parseRows() ─────────────────────────────────────────────────────────────

describe('parseRows()', () => {
  it('returns all rows including first as data (no header processing)', () => {
    const rows = parseRows('a,b\n1,2\n3,4');
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ['a', 'b']);
    assert.deepEqual(rows[1], ['1', '2']);
    assert.deepEqual(rows[2], ['3', '4']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseRows(''), []);
  });

  it('handles quoted fields with embedded commas', () => {
    const rows = parseRows('"a,b",c\n"d,e",f');
    assert.deepEqual(rows[0], ['a,b', 'c']);
    assert.deepEqual(rows[1], ['d,e', 'f']);
  });

  it('handles quoted fields with embedded newlines', () => {
    const rows = parseRows('"line1\nline2",end');
    assert.equal(rows[0][0], 'line1\nline2');
    assert.equal(rows[0][1], 'end');
  });

  it('respects custom delimiter', () => {
    const rows = parseRows('a;b;c\n1;2;3', { delimiter: ';' });
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
    assert.deepEqual(rows[1], ['1', '2', '3']);
  });

  it('skips empty rows by default', () => {
    const rows = parseRows('a,b\n\n1,2');
    assert.equal(rows.length, 2);
  });

  it('includes empty rows when skipEmpty:false', () => {
    const rows = parseRows('a,b\n\n1,2', { skipEmpty: false });
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[1], ['']);
  });

  it('trims fields when trim:true', () => {
    const rows = parseRows('  hello  ,  world  ', { trim: true });
    assert.deepEqual(rows[0], ['hello', 'world']);
  });
});

// ─── stringify() round-trip ───────────────────────────────────────────────────

describe('stringify() - round-trip', () => {
  it('produces CSV that round-trips through parse()', () => {
    const data = [
      { name: 'Alice', age: '30', city: 'NYC' },
      { name: 'Bob', age: '25', city: 'LA' },
    ];
    const csv = stringify(data);
    const back = parse(csv);
    assert.deepEqual(back, data);
  });

  it('returns empty string for empty array', () => {
    assert.equal(stringify([]), '');
  });

  it('includes a header row by default', () => {
    const csv = stringify([{ x: '1', y: '2' }]);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'x,y');
  });

  it('omits header row when header:false', () => {
    const csv = stringify([{ x: '1', y: '2' }], { header: false });
    const lines = csv.split('\n');
    assert.equal(lines.length, 1);
    assert.equal(lines[0], '1,2');
  });

  it('uses custom delimiter', () => {
    const csv = stringify([{ a: '1', b: '2' }], { delimiter: ';' });
    assert.ok(csv.includes('a;b'));
    assert.ok(csv.includes('1;2'));
  });

  it('preserves column order from first object keys', () => {
    const data = [{ z: '3', a: '1', m: '2' }];
    const csv = stringify(data);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'z,a,m');
    assert.equal(lines[1], '3,1,2');
  });

  it('converts null/undefined values to empty string', () => {
    const data = [{ a: null, b: undefined, c: 'ok' }];
    const csv = stringify(data);
    assert.ok(csv.includes(',,ok') || csv.includes(',ok'));
    const back = parse(csv);
    assert.equal(back[0].a, '');
    assert.equal(back[0].b, '');
  });
});

// ─── stringify() with special characters ─────────────────────────────────────

describe('stringify() - special characters get quoted', () => {
  it('quotes fields containing the delimiter', () => {
    const csv = stringify([{ name: 'Smith, John' }]);
    assert.ok(csv.includes('"Smith, John"'));
  });

  it('quotes fields containing a double-quote, escaping it by doubling', () => {
    const csv = stringify([{ val: 'say "hi"' }]);
    assert.ok(csv.includes('"say ""hi"""'));
  });

  it('quotes fields containing a newline', () => {
    const csv = stringify([{ text: 'line1\nline2' }]);
    assert.ok(csv.includes('"line1\nline2"'));
  });

  it('quotes fields containing a carriage-return', () => {
    const csv = stringify([{ text: 'a\rb' }]);
    assert.ok(csv.includes('"a\rb"'));
  });

  it('round-trips a field containing all special characters', () => {
    const data = [{ crazy: 'a,b\n"c"\rd' }];
    const csv = stringify(data);
    const back = parse(csv);
    assert.equal(back[0].crazy, 'a,b\n"c"\rd');
  });
});

// ─── stringifyRows() ─────────────────────────────────────────────────────────

describe('stringifyRows()', () => {
  it('serialises rows without headers when headers omitted', () => {
    const csv = stringifyRows([['1', '2'], ['3', '4']]);
    const lines = csv.split('\n');
    assert.equal(lines[0], '1,2');
    assert.equal(lines[1], '3,4');
  });

  it('prepends a header row when headers provided', () => {
    const csv = stringifyRows([['1', '2'], ['3', '4']], ['a', 'b']);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'a,b');
    assert.equal(lines[1], '1,2');
  });

  it('returns empty string for empty rows array with no headers', () => {
    assert.equal(stringifyRows([]), '');
  });

  it('returns just the header line for empty rows array with headers', () => {
    const csv = stringifyRows([], ['x', 'y']);
    assert.equal(csv, 'x,y');
  });

  it('uses custom delimiter', () => {
    const csv = stringifyRows([['a', 'b']], ['h1', 'h2'], { delimiter: ';' });
    assert.ok(csv.includes('h1;h2'));
    assert.ok(csv.includes('a;b'));
  });

  it('quotes cells that contain the delimiter', () => {
    const csv = stringifyRows([['val,ue', 'ok']]);
    assert.ok(csv.includes('"val,ue"'));
  });

  it('quotes cells that contain newlines', () => {
    const csv = stringifyRows([['line1\nline2']]);
    assert.ok(csv.includes('"line1\nline2"'));
  });

  it('converts null/undefined cells to empty string', () => {
    const csv = stringifyRows([[null, undefined, 'x']]);
    assert.ok(csv.startsWith(',,x') || csv.includes(',,x'));
  });

  it('round-trips through parseRows', () => {
    const original = [['Alice', '30', 'NYC'], ['Bob', '25', 'LA']];
    const headers = ['name', 'age', 'city'];
    const csv = stringifyRows(original, headers);
    const back = parseRows(csv);
    assert.deepEqual(back[0], headers);
    assert.deepEqual(back[1], original[0]);
    assert.deepEqual(back[2], original[1]);
  });
});

// ─── detectDelimiter ─────────────────────────────────────────────────────────

describe('detectDelimiter()', () => {
  it('detects comma delimiter', () => {
    assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  });

  it('detects semicolon delimiter', () => {
    assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  });

  it('detects tab delimiter', () => {
    assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  });

  it('detects pipe delimiter', () => {
    assert.equal(detectDelimiter('a|b|c\n1|2|3'), '|');
  });

  it('defaults to comma when no candidate found', () => {
    assert.equal(detectDelimiter('hello world'), ',');
  });

  it('ignores delimiters inside quoted fields', () => {
    // First line has commas only inside quotes, but 2 semicolons outside
    assert.equal(detectDelimiter('"a,b";c;d'), ';');
  });

  it('picks the most frequent candidate', () => {
    // 3 tabs vs 1 comma → tab wins
    assert.equal(detectDelimiter('a\tb\tc\td'), '\t');
  });
});

// ─── countRows() ─────────────────────────────────────────────────────────────

describe('countRows()', () => {
  it('counts data rows, excluding the header row by default', () => {
    assert.equal(countRows('name,age\nAlice,30\nBob,25'), 2);
  });

  it('returns 0 for empty string', () => {
    assert.equal(countRows(''), 0);
  });

  it('returns 0 when only a header row is present', () => {
    assert.equal(countRows('name,age'), 0);
  });

  it('counts all rows when header:false', () => {
    assert.equal(countRows('1,2\n3,4\n5,6', { header: false }), 3);
  });

  it('skips empty rows by default', () => {
    assert.equal(countRows('name,age\n\nAlice,30\n\nBob,25'), 2);
  });

  it('includes empty rows when skipEmpty:false', () => {
    assert.equal(countRows('name,age\n\nAlice,30', { skipEmpty: false }), 2);
  });

  it('counts correctly with quoted fields spanning multiple lines', () => {
    const csv = 'id,text\n1,"line1\nline2"\n2,plain';
    assert.equal(countRows(csv), 2);
  });

  it('counts correctly with CRLF line endings', () => {
    assert.equal(countRows('a,b\r\n1,2\r\n3,4'), 2);
  });
});
