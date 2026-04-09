// ─── Unit Tests: json-utils ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  jsonParse,
  jsonStringify,
  jsonClone,
  isValidJSON,
  jsonMerge,
  jsonGet,
  jsonSet,
  jsonFlatten,
  jsonUnflatten,
  jsonMinify,
  jsonPretty,
} from '../../app/modules/json-utils.js';

// ─── jsonParse ────────────────────────────────────────────────────────────────

describe('jsonParse', () => {
  it('parses valid JSON string', () => {
    assert.deepEqual(jsonParse('{"a":1}'), { a: 1 });
  });

  it('parses JSON array', () => {
    assert.deepEqual(jsonParse('[1,2,3]'), [1, 2, 3]);
  });

  it('parses JSON number', () => {
    assert.equal(jsonParse('42'), 42);
  });

  it('returns null for invalid JSON', () => {
    assert.equal(jsonParse('not json'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(jsonParse(''), null);
  });

  it('returns null for malformed JSON', () => {
    assert.equal(jsonParse('{a: 1}'), null);
  });
});

// ─── jsonStringify ────────────────────────────────────────────────────────────

describe('jsonStringify', () => {
  it('stringifies an object', () => {
    assert.equal(jsonStringify({ a: 1 }), '{"a":1}');
  });

  it('stringifies with indentation', () => {
    const result = jsonStringify({ a: 1 }, 2);
    assert.ok(result !== null);
    assert.ok(result.includes('\n'));
  });

  it('returns null for circular references', () => {
    /** @type {Record<string, unknown>} */
    const obj = {};
    obj['self'] = obj;
    assert.equal(jsonStringify(obj), null);
  });

  it('stringifies arrays', () => {
    assert.equal(jsonStringify([1, 2, 3]), '[1,2,3]');
  });

  it('stringifies null', () => {
    assert.equal(jsonStringify(null), 'null');
  });
});

// ─── jsonClone ────────────────────────────────────────────────────────────────

describe('jsonClone', () => {
  it('deep clones an object', () => {
    const original = { a: { b: { c: 42 } } };
    const clone = jsonClone(original);
    assert.deepEqual(clone, original);
  });

  it('mutations do not affect the original', () => {
    const original = { a: [1, 2, 3] };
    const clone = jsonClone(original);
    assert.ok(clone !== null);
    clone.a.push(4);
    assert.deepEqual(original.a, [1, 2, 3]);
  });

  it('returns null for circular references', () => {
    /** @type {Record<string, unknown>} */
    const obj = {};
    obj['self'] = obj;
    assert.equal(jsonClone(obj), null);
  });

  it('clones arrays', () => {
    const original = [{ x: 1 }, { x: 2 }];
    const clone = jsonClone(original);
    assert.deepEqual(clone, original);
    assert.notEqual(clone, original);
  });
});

// ─── isValidJSON ──────────────────────────────────────────────────────────────

describe('isValidJSON', () => {
  it('returns true for valid JSON object', () => {
    assert.equal(isValidJSON('{"key":"value"}'), true);
  });

  it('returns true for valid JSON array', () => {
    assert.equal(isValidJSON('[1,2,3]'), true);
  });

  it('returns true for JSON string literal', () => {
    assert.equal(isValidJSON('"hello"'), true);
  });

  it('returns true for JSON number', () => {
    assert.equal(isValidJSON('42'), true);
  });

  it('returns false for invalid JSON', () => {
    assert.equal(isValidJSON('{invalid}'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isValidJSON(''), false);
  });

  it('returns false for plain text', () => {
    assert.equal(isValidJSON('hello world'), false);
  });
});

// ─── jsonMerge ────────────────────────────────────────────────────────────────

describe('jsonMerge', () => {
  it('merges two flat objects', () => {
    const result = jsonMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    assert.deepEqual(result, { a: 1, b: 3, c: 4 });
  });

  it('deep merges nested objects', () => {
    const base = { a: { x: 1, y: 2 }, b: 'hello' };
    const override = { a: { y: 99, z: 3 } };
    const result = jsonMerge(base, override);
    assert.deepEqual(result, { a: { x: 1, y: 99, z: 3 }, b: 'hello' });
  });

  it('override wins on conflict', () => {
    const result = jsonMerge({ a: 'base' }, { a: 'override' });
    assert.equal(result.a, 'override');
  });

  it('does not mutate base object', () => {
    const base = { a: 1, b: 2 };
    jsonMerge(base, { b: 99 });
    assert.equal(base.b, 2);
  });

  it('arrays are replaced, not merged', () => {
    const result = jsonMerge({ arr: [1, 2, 3] }, { arr: [4, 5] });
    assert.deepEqual(result.arr, [4, 5]);
  });
});

// ─── jsonGet ──────────────────────────────────────────────────────────────────

describe('jsonGet', () => {
  it('gets a top-level value', () => {
    assert.equal(jsonGet({ a: 42 }, 'a'), 42);
  });

  it('gets a nested value via dot notation', () => {
    assert.equal(jsonGet({ a: { b: { c: 'deep' } } }, 'a.b.c'), 'deep');
  });

  it('returns undefined for missing path', () => {
    assert.equal(jsonGet({ a: 1 }, 'b'), undefined);
  });

  it('returns undefined for partial path that does not exist', () => {
    assert.equal(jsonGet({ a: 1 }, 'a.b.c'), undefined);
  });

  it('returns the whole object for empty path', () => {
    const obj = { a: 1 };
    assert.equal(jsonGet(obj, ''), obj);
  });

  it('returns undefined when traversing through null', () => {
    assert.equal(jsonGet({ a: null }, 'a.b'), undefined);
  });
});

// ─── jsonSet ──────────────────────────────────────────────────────────────────

describe('jsonSet', () => {
  it('sets a top-level property', () => {
    const result = jsonSet({ a: 1 }, 'a', 99);
    assert.deepEqual(result, { a: 99 });
  });

  it('sets a nested property via dot notation', () => {
    const result = jsonSet({ a: { b: 1 } }, 'a.b', 42);
    assert.deepEqual(result, { a: { b: 42 } });
  });

  it('creates intermediate objects as needed', () => {
    const result = jsonSet({}, 'a.b.c', 'hello');
    assert.deepEqual(result, { a: { b: { c: 'hello' } } });
  });

  it('does not mutate the original object', () => {
    const original = { a: { b: 1 } };
    jsonSet(original, 'a.b', 99);
    assert.equal(original.a.b, 1);
  });

  it('adds new property to existing object', () => {
    const result = jsonSet({ a: 1 }, 'b', 2);
    assert.deepEqual(result, { a: 1, b: 2 });
  });
});

// ─── jsonFlatten / jsonUnflatten ──────────────────────────────────────────────

describe('jsonFlatten', () => {
  it('flattens a nested object to dot-notation keys', () => {
    const result = jsonFlatten({ a: { b: { c: 1 }, d: 2 } });
    assert.deepEqual(result, { 'a.b.c': 1, 'a.d': 2 });
  });

  it('handles already-flat object', () => {
    const result = jsonFlatten({ x: 1, y: 2 });
    assert.deepEqual(result, { x: 1, y: 2 });
  });

  it('uses a custom separator', () => {
    const result = jsonFlatten({ a: { b: 1 } }, '/');
    assert.deepEqual(result, { 'a/b': 1 });
  });

  it('handles arrays as leaf values', () => {
    const result = jsonFlatten({ a: [1, 2, 3] });
    assert.deepEqual(result, { a: [1, 2, 3] });
  });
});

describe('jsonUnflatten', () => {
  it('unflattens dot-notation keys to nested object', () => {
    const result = jsonUnflatten({ 'a.b.c': 1, 'a.d': 2 });
    assert.deepEqual(result, { a: { b: { c: 1 }, d: 2 } });
  });

  it('handles already-flat keys', () => {
    const result = jsonUnflatten({ x: 1, y: 2 });
    assert.deepEqual(result, { x: 1, y: 2 });
  });

  it('uses a custom separator', () => {
    const result = jsonUnflatten({ 'a/b': 1 }, '/');
    assert.deepEqual(result, { a: { b: 1 } });
  });
});

describe('jsonFlatten/jsonUnflatten roundtrip', () => {
  it('roundtrips correctly', () => {
    const original = { a: { b: { c: 42 }, d: 'hello' }, e: [1, 2] };
    const flat = jsonFlatten(original);
    const restored = jsonUnflatten(flat);
    assert.deepEqual(restored, original);
  });
});

// ─── jsonMinify ───────────────────────────────────────────────────────────────

describe('jsonMinify', () => {
  it('removes whitespace from pretty-printed JSON', () => {
    const pretty = JSON.stringify({ a: 1, b: [1, 2] }, null, 2);
    const result = jsonMinify(pretty);
    assert.equal(result, '{"a":1,"b":[1,2]}');
  });

  it('returns same string for already minified JSON', () => {
    assert.equal(jsonMinify('{"a":1}'), '{"a":1}');
  });

  it('returns null for invalid JSON', () => {
    assert.equal(jsonMinify('{invalid}'), null);
  });
});

// ─── jsonPretty ───────────────────────────────────────────────────────────────

describe('jsonPretty', () => {
  it('pretty-prints an object with default indent of 2', () => {
    const result = jsonPretty({ a: 1 });
    assert.ok(result !== null);
    assert.ok(result.includes('  '));
    assert.ok(result.includes('\n'));
  });

  it('uses custom indent', () => {
    const result = jsonPretty({ a: 1 }, 4);
    assert.ok(result !== null);
    assert.ok(result.includes('    '));
  });

  it('returns null for circular references', () => {
    /** @type {Record<string, unknown>} */
    const obj = {};
    obj['self'] = obj;
    assert.equal(jsonPretty(obj), null);
  });

  it('pretty-prints arrays', () => {
    const result = jsonPretty([1, 2, 3], 2);
    assert.ok(result !== null);
    assert.ok(result.includes('\n'));
  });
});
