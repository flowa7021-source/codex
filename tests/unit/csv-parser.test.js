// ─── Unit Tests: csv-parser ────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseRaw,
  parse,
  parseWithHeaders,
  serializeRaw,
  serialize,
  parseLines,
} from '../../app/modules/csv-parser.js';

// ─── parseRaw: basic ──────────────────────────────────────────────────────────

describe('parseRaw - basic', () => {
  it('parses a simple two-row CSV into arrays', () => {
    const rows = parseRaw('a,b,c\n1,2,3');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
    assert.deepEqual(rows[1], ['1', '2', '3']);
  });

  it('returns an empty array for an empty string', () => {
    assert.deepEqual(parseRaw(''), []);
  });

  it('handles a single row with no newline', () => {
    assert.deepEqual(parseRaw('x,y,z'), [['x', 'y', 'z']]);
  });

  it('handles CRLF line endings', () => {
    const rows = parseRaw('a,b\r\n1,2\r\n3,4');
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[2], ['3', '4']);
  });

  it('skips empty lines by default', () => {
    const rows = parseRaw('a,b\n\n1,2\n\n3,4');
    assert.equal(rows.length, 3);
  });

  it('includes empty lines when skipEmptyLines is false', () => {
    const rows = parseRaw('a,b\n\n1,2', { skipEmptyLines: false });
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[1], ['']);
  });

  it('handles a single-column CSV', () => {
    const rows = parseRaw('hello\nworld');
    assert.deepEqual(rows, [['hello'], ['world']]);
  });

  it('handles many rows', () => {
    const input = Array.from({ length: 10 }, (_, i) => `${i},${i * 2}`).join('\n');
    const rows = parseRaw(input);
    assert.equal(rows.length, 10);
    assert.deepEqual(rows[9], ['9', '18']);
  });
});

// ─── parseRaw: quoted fields ──────────────────────────────────────────────────

describe('parseRaw - quoted fields', () => {
  it('parses a quoted field as a single field', () => {
    const rows = parseRaw('"hello","world"');
    assert.deepEqual(rows[0], ['hello', 'world']);
  });

  it('handles an empty quoted field', () => {
    const rows = parseRaw('"",hello');
    assert.deepEqual(rows[0], ['', 'hello']);
  });

  it('handles a quoted field that contains only spaces', () => {
    const rows = parseRaw('"   ",b');
    assert.deepEqual(rows[0], ['   ', 'b']);
  });
});

// ─── parseRaw: embedded commas ────────────────────────────────────────────────

describe('parseRaw - embedded commas', () => {
  it('parses a quoted field with an embedded comma', () => {
    const rows = parseRaw('"hello, world",plain');
    assert.deepEqual(rows[0], ['hello, world', 'plain']);
  });

  it('parses multiple quoted fields with embedded commas on same row', () => {
    const rows = parseRaw('"a,b","c,d"');
    assert.deepEqual(rows[0], ['a,b', 'c,d']);
  });

  it('does not split on commas inside quotes mid-row', () => {
    const rows = parseRaw('first,"one,two,three",last');
    assert.equal(rows[0][1], 'one,two,three');
    assert.equal(rows[0].length, 3);
  });
});

// ─── parseRaw: embedded newlines in quotes ────────────────────────────────────

describe('parseRaw - embedded newlines in quotes', () => {
  it('parses a quoted field with an embedded LF', () => {
    const rows = parseRaw('id,text\n1,"line1\nline2"');
    assert.equal(rows.length, 2);
    assert.equal(rows[1][1], 'line1\nline2');
  });

  it('parses a quoted field with an embedded CRLF', () => {
    const rows = parseRaw('a,b\n"multi\r\nline",end');
    assert.equal(rows[1][0], 'multi\r\nline');
    assert.equal(rows[1][1], 'end');
  });

  it('row count is based on logical rows not raw newlines', () => {
    // The CSV has 3 raw newlines but only 2 logical rows
    const rows = parseRaw('a,b\n1,"two\nlines"');
    assert.equal(rows.length, 2);
  });
});

// ─── parseRaw: escaped quotes ─────────────────────────────────────────────────

describe('parseRaw - escaped quotes', () => {
  it('unescapes doubled quotes inside a quoted field', () => {
    const rows = parseRaw('"say ""hello"""');
    assert.equal(rows[0][0], 'say "hello"');
  });

  it('handles multiple doubled-quote escapes in one field', () => {
    const rows = parseRaw('"a""b""c"');
    assert.equal(rows[0][0], 'a"b"c');
  });

  it('unescapes quotes when mixed with other content', () => {
    const rows = parseRaw('a,"He said ""hi""",c');
    assert.equal(rows[0][1], 'He said "hi"');
  });
});

// ─── parseRaw: empty fields ───────────────────────────────────────────────────

describe('parseRaw - empty fields', () => {
  it('handles a row of all empty fields', () => {
    const rows = parseRaw(',,', { skipEmptyLines: false });
    assert.deepEqual(rows[0], ['', '', '']);
  });

  it('handles leading empty field', () => {
    const rows = parseRaw(',b,c');
    assert.deepEqual(rows[0], ['', 'b', 'c']);
  });

  it('handles trailing comma (trailing empty field)', () => {
    const rows = parseRaw('a,b,');
    assert.deepEqual(rows[0], ['a', 'b', '']);
  });

  it('handles field in the middle that is empty', () => {
    const rows = parseRaw('a,,c');
    assert.deepEqual(rows[0], ['a', '', 'c']);
  });
});

// ─── parseRaw: custom delimiter ───────────────────────────────────────────────

describe('parseRaw - custom delimiter', () => {
  it('parses tab-separated values', () => {
    const rows = parseRaw('a\tb\tc\n1\t2\t3', { delimiter: '\t' });
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
    assert.deepEqual(rows[1], ['1', '2', '3']);
  });

  it('parses pipe-separated values', () => {
    const rows = parseRaw('a|b|c\n1|2|3', { delimiter: '|' });
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
  });

  it('parses semicolon-separated values', () => {
    const rows = parseRaw('x;y\nhello;world', { delimiter: ';' });
    assert.deepEqual(rows[1], ['hello', 'world']);
  });

  it('treats comma as a literal character when delimiter is semicolon', () => {
    const rows = parseRaw('a,b;c,d', { delimiter: ';' });
    assert.deepEqual(rows[0], ['a,b', 'c,d']);
  });
});

// ─── parseRaw: trimValues ─────────────────────────────────────────────────────

describe('parseRaw - trimValues', () => {
  it('trims whitespace from unquoted fields when trimValues is true', () => {
    const rows = parseRaw('  hello  ,  world  ', { trimValues: true });
    assert.deepEqual(rows[0], ['hello', 'world']);
  });

  it('does not trim whitespace by default', () => {
    const rows = parseRaw(' hello , world ');
    assert.deepEqual(rows[0], [' hello ', ' world ']);
  });

  it('does not trim quoted fields even when trimValues is true', () => {
    // Quoted fields preserve all inner whitespace
    const rows = parseRaw('"  hello  ",world', { trimValues: true });
    assert.equal(rows[0][0], '  hello  ');
    assert.equal(rows[0][1], 'world');
  });
});

// ─── parse: with headers ──────────────────────────────────────────────────────

describe('parse - with headers', () => {
  it('uses the first row as object keys', () => {
    const result = parse('name,age\nAlice,30\nBob,25');
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Alice');
    assert.equal(result[0].age, '30');
    assert.equal(result[1].name, 'Bob');
    assert.equal(result[1].age, '25');
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parse(''), []);
  });

  it('returns empty array when only header row is present', () => {
    assert.deepEqual(parse('name,age'), []);
  });

  it('fills missing fields with empty string', () => {
    const result = parse('a,b,c\n1,2');
    assert.equal(result[0].c, '');
  });

  it('handles CRLF line endings', () => {
    const result = parse('a,b\r\n1,2\r\n3,4');
    assert.equal(result.length, 2);
    assert.equal(result[1].a, '3');
  });

  it('skips empty lines by default', () => {
    const result = parse('name,age\n\nAlice,30\n\nBob,25');
    assert.equal(result.length, 2);
  });
});

// ─── parse: object keys from header row ──────────────────────────────────────

describe('parse - object keys from header row', () => {
  it('preserves exact header casing as object keys', () => {
    const result = parse('Name,Age,CityName\nAlice,30,NYC');
    assert.ok('Name' in result[0]);
    assert.ok('Age' in result[0]);
    assert.ok('CityName' in result[0]);
  });

  it('handles header with spaces (not trimmed by default)', () => {
    const result = parse(' name ,age\nAlice,30');
    assert.ok(' name ' in result[0]);
  });

  it('uses custom delimiter with headers', () => {
    const result = parse('x\ty\n1\t2', { delimiter: '\t' });
    assert.equal(result[0].x, '1');
    assert.equal(result[0].y, '2');
  });

  it('handles quoted header values', () => {
    const result = parse('"first name","last name"\nJohn,Doe');
    assert.equal(result[0]['first name'], 'John');
    assert.equal(result[0]['last name'], 'Doe');
  });
});

// ─── parseWithHeaders ─────────────────────────────────────────────────────────

describe('parseWithHeaders', () => {
  it('returns headers and rows separately', () => {
    const { headers, rows } = parseWithHeaders('a,b,c\n1,2,3\n4,5,6');
    assert.deepEqual(headers, ['a', 'b', 'c']);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['1', '2', '3']);
    assert.deepEqual(rows[1], ['4', '5', '6']);
  });

  it('returns empty headers and rows for empty string', () => {
    const result = parseWithHeaders('');
    assert.deepEqual(result.headers, []);
    assert.deepEqual(result.rows, []);
  });

  it('returns headers and empty rows when only header row is present', () => {
    const { headers, rows } = parseWithHeaders('x,y,z');
    assert.deepEqual(headers, ['x', 'y', 'z']);
    assert.deepEqual(rows, []);
  });

  it('works with custom delimiter', () => {
    const { headers, rows } = parseWithHeaders('a;b\n1;2', { delimiter: ';' });
    assert.deepEqual(headers, ['a', 'b']);
    assert.deepEqual(rows[0], ['1', '2']);
  });

  it('works with quoted fields in headers', () => {
    const { headers } = parseWithHeaders('"col one","col two"\n1,2');
    assert.deepEqual(headers, ['col one', 'col two']);
  });

  it('works with embedded newlines in data', () => {
    const { rows } = parseWithHeaders('a,b\n1,"multi\nline"');
    assert.equal(rows[0][1], 'multi\nline');
  });
});

// ─── serializeRaw: basic ──────────────────────────────────────────────────────

describe('serializeRaw - basic', () => {
  it('serializes a 2D array to CSV', () => {
    const csv = serializeRaw([['a', 'b', 'c'], ['1', '2', '3']]);
    assert.equal(csv, 'a,b,c\n1,2,3');
  });

  it('returns empty string for empty array', () => {
    assert.equal(serializeRaw([]), '');
  });

  it('handles a single row', () => {
    assert.equal(serializeRaw([['x', 'y']]), 'x,y');
  });

  it('handles empty string fields', () => {
    const csv = serializeRaw([['', 'b', '']]);
    assert.equal(csv, ',b,');
  });
});

// ─── serializeRaw: values needing quoting ─────────────────────────────────────

describe('serializeRaw - values needing quoting', () => {
  it('quotes fields that contain the delimiter', () => {
    const csv = serializeRaw([['hello, world', 'plain']]);
    assert.ok(csv.startsWith('"hello, world"'));
  });

  it('quotes fields that contain a double-quote, doubling it', () => {
    const csv = serializeRaw([['say "hi"']]);
    assert.ok(csv.includes('"say ""hi"""'));
  });

  it('quotes fields that contain a newline', () => {
    const csv = serializeRaw([['line1\nline2']]);
    assert.ok(csv.includes('"line1\nline2"'));
  });

  it('quotes fields that contain a carriage return', () => {
    const csv = serializeRaw([['a\rb']]);
    assert.ok(csv.includes('"a\rb"'));
  });

  it('does not quote plain fields unnecessarily', () => {
    const csv = serializeRaw([['hello', 'world']]);
    assert.equal(csv, 'hello,world');
  });
});

// ─── serializeRaw: custom delimiter ───────────────────────────────────────────

describe('serializeRaw - custom delimiter', () => {
  it('uses a custom tab delimiter', () => {
    const csv = serializeRaw([['a', 'b', 'c']], { delimiter: '\t' });
    assert.equal(csv, 'a\tb\tc');
  });

  it('uses a pipe delimiter', () => {
    const csv = serializeRaw([['x', 'y']], { delimiter: '|' });
    assert.equal(csv, 'x|y');
  });

  it('quotes fields containing the custom delimiter', () => {
    const csv = serializeRaw([['a|b', 'c']], { delimiter: '|' });
    assert.ok(csv.startsWith('"a|b"'));
  });
});

// ─── serialize: from objects ──────────────────────────────────────────────────

describe('serialize - from objects', () => {
  it('serializes an array of objects with auto-detected headers', () => {
    const data = [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }];
    const csv = serialize(data);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'name,age');
    assert.equal(lines[1], 'Alice,30');
    assert.equal(lines[2], 'Bob,25');
  });

  it('returns empty string for empty array', () => {
    assert.equal(serialize([]), '');
  });

  it('converts non-string values to strings', () => {
    const csv = serialize([{ n: 42, flag: true }]);
    assert.ok(csv.includes('42'));
    assert.ok(csv.includes('true'));
  });

  it('converts null/undefined values to empty string', () => {
    const csv = serialize([{ a: null, b: undefined, c: 'ok' }]);
    const rows = parseRaw(csv);
    // Second row: data values
    assert.equal(rows[1][0], '');
    assert.equal(rows[1][1], '');
    assert.equal(rows[1][2], 'ok');
  });

  it('uses custom delimiter', () => {
    const csv = serialize([{ a: '1', b: '2' }], { delimiter: ';' });
    assert.ok(csv.includes('a;b'));
    assert.ok(csv.includes('1;2'));
  });

  it('quotes values that contain the delimiter', () => {
    const csv = serialize([{ name: 'Smith, John' }]);
    assert.ok(csv.includes('"Smith, John"'));
  });
});

// ─── serialize: custom headers ────────────────────────────────────────────────

describe('serialize - custom headers', () => {
  it('uses provided headers instead of object keys', () => {
    const data = [{ a: '1', b: '2', c: '3' }];
    const csv = serialize(data, { headers: ['c', 'a'] });
    const lines = csv.split('\n');
    assert.equal(lines[0], 'c,a');
    assert.equal(lines[1], '3,1');
  });

  it('only includes columns listed in custom headers', () => {
    const data = [{ x: 'X', y: 'Y', z: 'Z' }];
    const csv = serialize(data, { headers: ['x', 'z'] });
    assert.ok(!csv.includes('y') && !csv.includes('Y'));
  });

  it('fills missing columns with empty string when header key absent', () => {
    const data = [{ a: '1' }];
    const csv = serialize(data, { headers: ['a', 'b'] });
    const rows = parseRaw(csv);
    assert.equal(rows[1][1], '');
  });
});

// ─── parseLines ───────────────────────────────────────────────────────────────

describe('parseLines', () => {
  it('parses an array of pre-split lines', () => {
    const rows = parseLines(['a,b,c', '1,2,3', '4,5,6']);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
    assert.deepEqual(rows[2], ['4', '5', '6']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(parseLines([]), []);
  });

  it('skips empty lines by default', () => {
    const rows = parseLines(['a,b', '', '1,2', '']);
    assert.equal(rows.length, 2);
  });

  it('includes blank lines when skipEmptyLines is false', () => {
    const rows = parseLines(['a,b', '', '1,2'], { skipEmptyLines: false });
    assert.equal(rows.length, 3);
  });

  it('parses quoted fields within lines', () => {
    const rows = parseLines(['"hello, world",plain']);
    assert.deepEqual(rows[0], ['hello, world', 'plain']);
  });

  it('respects custom delimiter', () => {
    const rows = parseLines(['a\tb\tc', '1\t2\t3'], { delimiter: '\t' });
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
    assert.deepEqual(rows[1], ['1', '2', '3']);
  });

  it('trims values when trimValues is true', () => {
    const rows = parseLines(['  a  ,  b  '], { trimValues: true });
    assert.deepEqual(rows[0], ['a', 'b']);
  });

  it('handles escaped quotes within lines', () => {
    const rows = parseLines(['"say ""hello"""']);
    assert.equal(rows[0][0], 'say "hello"');
  });
});

// ─── Round-trip: parse then serialize produces equivalent output ──────────────

describe('Round-trip', () => {
  it('parseRaw → serializeRaw → parseRaw produces equivalent data', () => {
    const original = [
      ['name', 'age', 'city'],
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'Los Angeles'],
    ];
    const csv = serializeRaw(original);
    const back = parseRaw(csv);
    assert.deepEqual(back, original);
  });

  it('parse → serialize → parse produces equivalent objects', () => {
    const data = [
      { name: 'Alice', age: '30', city: 'NYC' },
      { name: 'Bob', age: '25', city: 'LA' },
    ];
    const csv = serialize(data);
    const back = parse(csv);
    assert.deepEqual(back, data);
  });

  it('round-trips data containing embedded commas', () => {
    const data = [{ address: '123 Main St, Apt 4', name: 'Alice' }];
    const csv = serialize(data);
    const back = parse(csv);
    assert.equal(back[0].address, '123 Main St, Apt 4');
  });

  it('round-trips data containing embedded newlines', () => {
    const data = [{ text: 'line1\nline2', id: '1' }];
    const csv = serialize(data);
    const back = parse(csv);
    assert.equal(back[0].text, 'line1\nline2');
  });

  it('round-trips data containing embedded double-quotes', () => {
    const data = [{ quote: 'He said "hello"', id: '2' }];
    const csv = serialize(data);
    const back = parse(csv);
    assert.equal(back[0].quote, 'He said "hello"');
  });

  it('round-trips data with all special characters combined', () => {
    const data = [{ crazy: 'a,b\n"c"\rd', normal: 'plain' }];
    const csv = serialize(data);
    const back = parse(csv);
    assert.equal(back[0].crazy, 'a,b\n"c"\rd');
    assert.equal(back[0].normal, 'plain');
  });

  it('round-trips with tab delimiter', () => {
    const original = [['h1', 'h2'], ['v1', 'v2']];
    const csv = serializeRaw(original, { delimiter: '\t' });
    const back = parseRaw(csv, { delimiter: '\t' });
    assert.deepEqual(back, original);
  });

  it('parseWithHeaders round-trips via serializeRaw', () => {
    const csv = 'col1,col2\nfoo,bar\nbaz,qux';
    const { headers, rows } = parseWithHeaders(csv);
    const rebuilt = serializeRaw([headers, ...rows]);
    const { headers: h2, rows: r2 } = parseWithHeaders(rebuilt);
    assert.deepEqual(h2, headers);
    assert.deepEqual(r2, rows);
  });
});
