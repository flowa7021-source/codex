// ─── Unit Tests: serializer ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  serialize,
  deserialize,
  deepClone,
  isSerializable,
  serializeToBase64,
  deserializeFromBase64,
  deepMerge,
} from '../../app/modules/serializer.js';

// ─── serialize – basic types ──────────────────────────────────────────────────

describe('serialize – basic types', () => {
  it('serializes a number', () => {
    assert.equal(serialize(42), '42');
  });

  it('serializes a string', () => {
    assert.equal(serialize('hello'), '"hello"');
  });

  it('serializes null', () => {
    assert.equal(serialize(null), 'null');
  });

  it('serializes a boolean', () => {
    assert.equal(serialize(true), 'true');
  });

  it('serializes a plain object', () => {
    assert.equal(serialize({ a: 1, b: 2 }), '{"a":1,"b":2}');
  });

  it('serializes an array', () => {
    assert.equal(serialize([1, 2, 3]), '[1,2,3]');
  });

  it('serializes undefined top-level as undefined (no output)', () => {
    assert.equal(serialize(undefined), undefined);
  });

  it('applies indent option', () => {
    const result = serialize({ a: 1 }, { indent: 2 });
    assert.equal(result, '{\n  "a": 1\n}');
  });
});

// ─── serialize – Date ─────────────────────────────────────────────────────────

describe('serialize – Date', () => {
  it('serializes Date as ISO string by default', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    const result = serialize({ date: d });
    assert.ok(result.includes('2024-01-15T12:00:00.000Z'));
  });

  it('serializes Date as ISO string when dateFormat is iso', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    const result = serialize({ date: d }, { dateFormat: 'iso' });
    assert.ok(result.includes('2024-01-15T12:00:00.000Z'));
  });

  it('serializes Date as timestamp number when dateFormat is timestamp', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    const result = serialize({ date: d }, { dateFormat: 'timestamp' });
    const parsed = JSON.parse(result);
    assert.equal(parsed.date, d.getTime());
  });
});

// ─── serialize – Map ──────────────────────────────────────────────────────────

describe('serialize – Map', () => {
  it('serializes a Map with __type marker', () => {
    const m = new Map([['key', 'value']]);
    const result = serialize(m);
    const parsed = JSON.parse(result);
    assert.equal(parsed.__type, 'Map');
    assert.deepEqual(parsed.entries, [['key', 'value']]);
  });

  it('serializes a nested Map inside an object', () => {
    const obj = { myMap: new Map([[1, 'one'], [2, 'two']]) };
    const result = serialize(obj);
    const parsed = JSON.parse(result);
    assert.equal(parsed.myMap.__type, 'Map');
    assert.equal(parsed.myMap.entries.length, 2);
  });
});

// ─── serialize – Set ──────────────────────────────────────────────────────────

describe('serialize – Set', () => {
  it('serializes a Set with __type marker', () => {
    const s = new Set([1, 2, 3]);
    const result = serialize(s);
    const parsed = JSON.parse(result);
    assert.equal(parsed.__type, 'Set');
    assert.deepEqual(parsed.values, [1, 2, 3]);
  });

  it('serializes a nested Set inside an object', () => {
    const obj = { mySet: new Set(['a', 'b']) };
    const result = serialize(obj);
    const parsed = JSON.parse(result);
    assert.equal(parsed.mySet.__type, 'Set');
    assert.deepEqual(parsed.mySet.values, ['a', 'b']);
  });
});

// ─── serialize – undefined handling ──────────────────────────────────────────

describe('serialize – includeUndefined', () => {
  it('omits undefined values by default', () => {
    const result = serialize({ a: 1, b: undefined });
    const parsed = JSON.parse(result);
    assert.equal('b' in parsed, false);
  });

  it('serializes undefined as null when includeUndefined is true', () => {
    const result = serialize({ a: 1, b: undefined }, { includeUndefined: true });
    const parsed = JSON.parse(result);
    assert.equal(parsed.b, null);
  });
});

// ─── serialize – circular reference ──────────────────────────────────────────

describe('serialize – circular reference', () => {
  it('throws on circular object reference', () => {
    const obj = { a: 1 };
    // @ts-ignore
    obj.self = obj;
    assert.throws(() => serialize(obj), /Circular reference detected/);
  });

  it('throws on circular Map reference', () => {
    const m = new Map();
    m.set('self', m);
    assert.throws(() => serialize(m), /Circular reference detected/);
  });

  it('throws on circular Set reference', () => {
    const s = new Set();
    s.add(s);
    assert.throws(() => serialize(s), /Circular reference detected/);
  });
});

// ─── deserialize ─────────────────────────────────────────────────────────────

describe('deserialize', () => {
  it('deserializes a plain JSON string', () => {
    assert.deepEqual(deserialize('{"a":1}'), { a: 1 });
  });

  it('restores a Map from __type marker', () => {
    const json = JSON.stringify({ __type: 'Map', entries: [['k', 'v']] });
    const result = deserialize(json);
    assert.ok(result instanceof Map);
    assert.equal((result).get('k'), 'v');
  });

  it('restores a Set from __type marker', () => {
    const json = JSON.stringify({ __type: 'Set', values: [1, 2, 3] });
    const result = deserialize(json);
    assert.ok(result instanceof Set);
    assert.ok((result).has(2));
  });

  it('restores nested Map inside object', () => {
    const original = { myMap: new Map([['x', 42]]) };
    const json = serialize(original);
    const result = deserialize(json);
    assert.ok(result.myMap instanceof Map);
    assert.equal(result.myMap.get('x'), 42);
  });

  it('restores nested Set inside object', () => {
    const original = { mySet: new Set([10, 20]) };
    const json = serialize(original);
    const result = deserialize(json);
    assert.ok(result.mySet instanceof Set);
    assert.ok(result.mySet.has(10));
  });

  it('does not restore Date — returns string', () => {
    const d = new Date('2024-01-15T00:00:00.000Z');
    const json = serialize({ d }, { dateFormat: 'iso' });
    const result = deserialize(json);
    assert.equal(typeof result.d, 'string');
  });

  it('throws on invalid JSON', () => {
    assert.throws(() => deserialize('not json'));
  });
});

// ─── deepClone ────────────────────────────────────────────────────────────────

describe('deepClone', () => {
  it('clones a plain object', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = deepClone(obj);
    assert.deepEqual(clone, obj);
    assert.notEqual(clone, obj);
    assert.notEqual(clone.b, obj.b);
  });

  it('clones an array', () => {
    const arr = [1, [2, 3]];
    const clone = deepClone(arr);
    assert.deepEqual(clone, arr);
    assert.notEqual(clone, arr);
  });

  it('clones a Map', () => {
    const m = new Map([['a', 1]]);
    const clone = deepClone(m);
    assert.ok(clone instanceof Map);
    assert.equal(clone.get('a'), 1);
    assert.notEqual(clone, m);
  });

  it('clones a Set', () => {
    const s = new Set([1, 2, 3]);
    const clone = deepClone(s);
    assert.ok(clone instanceof Set);
    assert.ok(clone.has(3));
    assert.notEqual(clone, s);
  });

  it('mutations to the clone do not affect the original', () => {
    const obj = { x: { y: 10 } };
    const clone = deepClone(obj);
    clone.x.y = 99;
    assert.equal(obj.x.y, 10);
  });
});

// ─── isSerializable ───────────────────────────────────────────────────────────

describe('isSerializable', () => {
  it('returns true for primitives', () => {
    assert.equal(isSerializable(42), true);
    assert.equal(isSerializable('hello'), true);
    assert.equal(isSerializable(true), true);
    assert.equal(isSerializable(null), true);
    assert.equal(isSerializable(undefined), true);
  });

  it('returns true for plain objects', () => {
    assert.equal(isSerializable({ a: 1 }), true);
  });

  it('returns true for arrays', () => {
    assert.equal(isSerializable([1, 2, 3]), true);
  });

  it('returns true for Date', () => {
    assert.equal(isSerializable(new Date()), true);
  });

  it('returns true for Map', () => {
    assert.equal(isSerializable(new Map([['k', 'v']])), true);
  });

  it('returns true for Set', () => {
    assert.equal(isSerializable(new Set([1, 2])), true);
  });

  it('returns false for functions', () => {
    assert.equal(isSerializable(() => {}), false);
  });

  it('returns false for symbols', () => {
    assert.equal(isSerializable(Symbol('x')), false);
  });

  it('returns false for BigInt', () => {
    assert.equal(isSerializable(BigInt(42)), false);
  });

  it('returns false for circular references', () => {
    const obj = {};
    // @ts-ignore
    obj.self = obj;
    assert.equal(isSerializable(obj), false);
  });

  it('returns false when nested value is a function', () => {
    assert.equal(isSerializable({ fn: () => {} }), false);
  });
});

// ─── base64 roundtrip ─────────────────────────────────────────────────────────

describe('serializeToBase64 / deserializeFromBase64', () => {
  it('roundtrips a plain object', () => {
    const obj = { a: 1, b: 'hello' };
    const b64 = serializeToBase64(obj);
    assert.equal(typeof b64, 'string');
    const result = deserializeFromBase64(b64);
    assert.deepEqual(result, obj);
  });

  it('roundtrips a Map', () => {
    const m = new Map([['key', 42]]);
    const b64 = serializeToBase64(m);
    const result = deserializeFromBase64(b64);
    assert.ok(result instanceof Map);
    assert.equal(result.get('key'), 42);
  });

  it('roundtrips a Set', () => {
    const s = new Set([10, 20, 30]);
    const b64 = serializeToBase64(s);
    const result = deserializeFromBase64(b64);
    assert.ok(result instanceof Set);
    assert.ok(result.has(20));
  });

  it('roundtrips nested structures', () => {
    const data = { arr: [1, 2], nested: { x: true } };
    const b64 = serializeToBase64(data);
    assert.deepEqual(deserializeFromBase64(b64), data);
  });

  it('produces a string that is valid base64 (no spaces)', () => {
    const b64 = serializeToBase64({ test: 'value' });
    assert.match(b64, /^[A-Za-z0-9+/]+=*$/);
  });
});

// ─── deepMerge ────────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    assert.deepEqual(result, { a: 1, b: 3, c: 4 });
  });

  it('deeply merges nested objects', () => {
    const target = { a: { x: 1, y: 2 }, b: 10 };
    const source = { a: { y: 99, z: 3 } };
    const result = deepMerge(target, source);
    assert.deepEqual(result, { a: { x: 1, y: 99, z: 3 }, b: 10 });
  });

  it('does not mutate target', () => {
    const target = { a: 1 };
    deepMerge(target, { b: 2 });
    assert.equal('b' in target, false);
  });

  it('source array replaces target array (no deep merge for arrays)', () => {
    const result = deepMerge({ arr: [1, 2, 3] }, { arr: [4, 5] });
    assert.deepEqual(result.arr, [4, 5]);
  });

  it('source property overrides target when source is primitive', () => {
    const result = deepMerge({ val: { nested: 1 } }, { val: 42 });
    assert.equal(result.val, 42);
  });

  it('handles empty source', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, {});
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('handles empty target', () => {
    const result = deepMerge({}, { a: 1 });
    assert.deepEqual(result, { a: 1 });
  });

  it('does not deep-merge Date objects', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2025-06-15');
    const result = deepMerge({ d: d1 }, { d: d2 });
    assert.equal(result.d.getTime(), d2.getTime());
  });
});
