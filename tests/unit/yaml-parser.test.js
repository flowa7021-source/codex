// ─── Unit Tests: yaml-parser ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseYAML,
  stringifyYAML,
  YAMLError,
} from '../../app/modules/yaml-parser.js';

// ─── parseYAML – scalars ──────────────────────────────────────────────────────

describe('parseYAML – scalars', () => {
  it('parses a plain string', () => {
    assert.equal(parseYAML('hello'), 'hello');
  });

  it('parses an integer', () => {
    assert.equal(parseYAML('42'), 42);
  });

  it('parses a float', () => {
    assert.equal(parseYAML('3.14'), 3.14);
  });

  it('parses boolean true variants', () => {
    assert.equal(parseYAML('true'), true);
    assert.equal(parseYAML('True'), true);
    assert.equal(parseYAML('TRUE'), true);
  });

  it('parses boolean false variants', () => {
    assert.equal(parseYAML('false'), false);
    assert.equal(parseYAML('False'), false);
  });

  it('parses null variants', () => {
    assert.equal(parseYAML('null'), null);
    assert.equal(parseYAML('~'), null);
  });

  it('parses a double-quoted string with escape sequences', () => {
    assert.equal(parseYAML('"hello\\nworld"'), 'hello\nworld');
  });

  it('parses a single-quoted string', () => {
    assert.equal(parseYAML("'it''s alive'"), "it's alive");
  });
});

// ─── parseYAML – mappings ─────────────────────────────────────────────────────

describe('parseYAML – mappings', () => {
  it('parses a simple key-value mapping', () => {
    const result = parseYAML('name: Alice\nage: 30');
    assert.deepEqual(result, { name: 'Alice', age: 30 });
  });

  it('parses nested mappings', () => {
    const yaml = 'person:\n  name: Bob\n  age: 25';
    assert.deepEqual(parseYAML(yaml), { person: { name: 'Bob', age: 25 } });
  });

  it('parses a mapping with boolean and null values', () => {
    const yaml = 'active: true\ndeleted: null';
    assert.deepEqual(parseYAML(yaml), { active: true, deleted: null });
  });

  it('parses a key with a quoted string value', () => {
    const yaml = 'message: "hello world"';
    assert.deepEqual(parseYAML(yaml), { message: 'hello world' });
  });
});

// ─── parseYAML – sequences ────────────────────────────────────────────────────

describe('parseYAML – sequences', () => {
  it('parses a simple list', () => {
    const yaml = '- apple\n- banana\n- cherry';
    assert.deepEqual(parseYAML(yaml), ['apple', 'banana', 'cherry']);
  });

  it('parses a list of numbers', () => {
    const yaml = '- 1\n- 2\n- 3';
    assert.deepEqual(parseYAML(yaml), [1, 2, 3]);
  });

  it('parses a mapping with a sequence value', () => {
    const yaml = 'colors:\n  - red\n  - green\n  - blue';
    assert.deepEqual(parseYAML(yaml), { colors: ['red', 'green', 'blue'] });
  });

  it('parses an inline flow sequence', () => {
    const yaml = 'items: [1, 2, 3]';
    assert.deepEqual(parseYAML(yaml), { items: [1, 2, 3] });
  });
});

// ─── parseYAML – comments ─────────────────────────────────────────────────────

describe('parseYAML – comments', () => {
  it('ignores full-line comments', () => {
    const yaml = '# this is a comment\nname: Alice';
    assert.deepEqual(parseYAML(yaml), { name: 'Alice' });
  });

  it('ignores inline comments', () => {
    const yaml = 'count: 42 # the answer';
    assert.deepEqual(parseYAML(yaml), { count: 42 });
  });
});

// ─── parseYAML – block scalars ────────────────────────────────────────────────

describe('parseYAML – block scalars', () => {
  it('parses a literal block scalar (|)', () => {
    const yaml = 'text: |\n  line one\n  line two';
    const result = parseYAML(yaml);
    assert.equal(result.text, 'line one\nline two\n');
  });

  it('parses a folded block scalar (>)', () => {
    const yaml = 'text: >\n  line one\n  line two';
    const result = parseYAML(yaml);
    // Folded: consecutive lines joined with space
    assert.ok(result.text.includes('line one'));
    assert.ok(result.text.includes('line two'));
  });
});

// ─── parseYAML – document markers ────────────────────────────────────────────

describe('parseYAML – document markers', () => {
  it('handles --- document start marker', () => {
    const yaml = '---\nname: Alice';
    assert.deepEqual(parseYAML(yaml), { name: 'Alice' });
  });
});

// ─── parseYAML – YAMLError ────────────────────────────────────────────────────

describe('parseYAML – YAMLError', () => {
  it('YAMLError has line and column properties', () => {
    try {
      parseYAML(null);
      assert.fail('Expected YAMLError');
    } catch (err) {
      assert.ok(err instanceof YAMLError);
      assert.ok(typeof err.line === 'number');
      assert.ok(typeof err.column === 'number');
    }
  });

  it('YAMLError extends Error', () => {
    const e = new YAMLError('bad syntax', 3, 7);
    assert.ok(e instanceof Error);
    assert.equal(e.line, 3);
    assert.equal(e.column, 7);
    assert.ok(e.message.includes('bad syntax'));
  });
});

// ─── stringifyYAML ────────────────────────────────────────────────────────────

describe('stringifyYAML', () => {
  it('stringifies null', () => {
    assert.equal(stringifyYAML(null).trim(), 'null');
  });

  it('stringifies a boolean', () => {
    assert.equal(stringifyYAML(true).trim(), 'true');
    assert.equal(stringifyYAML(false).trim(), 'false');
  });

  it('stringifies a number', () => {
    assert.equal(stringifyYAML(42).trim(), '42');
    assert.equal(stringifyYAML(3.14).trim(), '3.14');
  });

  it('stringifies a plain string', () => {
    assert.equal(stringifyYAML('hello').trim(), 'hello');
  });

  it('quotes strings that look like booleans', () => {
    const out = stringifyYAML('true').trim();
    assert.ok(out.startsWith('"') || out.startsWith("'"), `Expected quoted output, got: ${out}`);
  });

  it('quotes strings that look like numbers', () => {
    const out = stringifyYAML('42').trim();
    assert.ok(out.startsWith('"') || out.startsWith("'"), `Expected quoted output, got: ${out}`);
  });

  it('stringifies a simple object', () => {
    const out = stringifyYAML({ name: 'Alice', age: 30 });
    assert.ok(out.includes('name:'));
    assert.ok(out.includes('Alice'));
    assert.ok(out.includes('age:'));
    assert.ok(out.includes('30'));
  });

  it('stringifies an array', () => {
    const out = stringifyYAML(['a', 'b', 'c']);
    assert.ok(out.includes('- a'));
    assert.ok(out.includes('- b'));
    assert.ok(out.includes('- c'));
  });

  it('round-trips a simple mapping', () => {
    const original = { x: 1, y: 2 };
    const yaml = stringifyYAML(original);
    const parsed = parseYAML(yaml);
    assert.deepEqual(parsed, original);
  });

  it('round-trips an array of numbers', () => {
    const original = [10, 20, 30];
    const yaml = stringifyYAML(original);
    const parsed = parseYAML(yaml);
    assert.deepEqual(parsed, original);
  });

  it('stringifies NaN and Infinity', () => {
    assert.equal(stringifyYAML(NaN).trim(), '.nan');
    assert.equal(stringifyYAML(Infinity).trim(), '.inf');
    assert.equal(stringifyYAML(-Infinity).trim(), '-.inf');
  });
});
