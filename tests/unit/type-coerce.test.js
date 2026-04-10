// ─── Unit Tests: type-coerce ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  coerceToString,
  coerceToNumber,
  coerceToBoolean,
  coerceToArray,
  coerceToDate,
  coerceObject,
  sanitize,
} from '../../app/modules/type-coerce.js';

// ─── coerceToString ───────────────────────────────────────────────────────────

describe('coerceToString', () => {
  it('returns the string unchanged', () => {
    assert.equal(coerceToString('hello'), 'hello');
  });

  it('converts null to empty string', () => {
    assert.equal(coerceToString(null), '');
  });

  it('converts undefined to empty string', () => {
    assert.equal(coerceToString(undefined), '');
  });

  it('converts a number to string', () => {
    assert.equal(coerceToString(42), '42');
  });

  it('converts true to "true"', () => {
    assert.equal(coerceToString(true), 'true');
  });

  it('converts false to "false"', () => {
    assert.equal(coerceToString(false), 'false');
  });

  it('JSON-stringifies an array', () => {
    assert.equal(coerceToString([1, 2, 3]), '[1,2,3]');
  });

  it('JSON-stringifies an object', () => {
    assert.equal(coerceToString({ a: 1 }), '{"a":1}');
  });
});

// ─── coerceToNumber ───────────────────────────────────────────────────────────

describe('coerceToNumber', () => {
  it('returns a finite number unchanged', () => {
    assert.equal(coerceToNumber(42), 42);
  });

  it('parses a numeric string', () => {
    assert.equal(coerceToNumber('3.14'), 3.14);
  });

  it('parses a negative numeric string', () => {
    assert.equal(coerceToNumber('-7'), -7);
  });

  it('converts true to 1', () => {
    assert.equal(coerceToNumber(true), 1);
  });

  it('converts false to 0', () => {
    assert.equal(coerceToNumber(false), 0);
  });

  it('returns null for null', () => {
    assert.equal(coerceToNumber(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(coerceToNumber(undefined), null);
  });

  it('returns null for a non-numeric string', () => {
    assert.equal(coerceToNumber('abc'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(coerceToNumber(''), null);
  });

  it('returns null for Infinity', () => {
    assert.equal(coerceToNumber(Infinity), null);
  });

  it('returns null for NaN', () => {
    assert.equal(coerceToNumber(NaN), null);
  });

  it('returns null for an object', () => {
    assert.equal(coerceToNumber({}), null);
  });
});

// ─── coerceToBoolean ──────────────────────────────────────────────────────────

describe('coerceToBoolean', () => {
  it('passes true through', () => {
    assert.equal(coerceToBoolean(true), true);
  });

  it('passes false through', () => {
    assert.equal(coerceToBoolean(false), false);
  });

  it('returns false for null', () => {
    assert.equal(coerceToBoolean(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(coerceToBoolean(undefined), false);
  });

  it('returns false for string "false"', () => {
    assert.equal(coerceToBoolean('false'), false);
  });

  it('returns false for string "0"', () => {
    assert.equal(coerceToBoolean('0'), false);
  });

  it('returns false for string "no"', () => {
    assert.equal(coerceToBoolean('no'), false);
  });

  it('returns false for string "off"', () => {
    assert.equal(coerceToBoolean('off'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(coerceToBoolean(''), false);
  });

  it('returns true for string "true"', () => {
    assert.equal(coerceToBoolean('true'), true);
  });

  it('returns true for string "yes"', () => {
    assert.equal(coerceToBoolean('yes'), true);
  });

  it('returns false for 0', () => {
    assert.equal(coerceToBoolean(0), false);
  });

  it('returns false for NaN', () => {
    assert.equal(coerceToBoolean(NaN), false);
  });

  it('returns true for positive number', () => {
    assert.equal(coerceToBoolean(1), true);
  });

  it('returns true for non-empty object', () => {
    assert.equal(coerceToBoolean({ a: 1 }), true);
  });
});

// ─── coerceToArray ────────────────────────────────────────────────────────────

describe('coerceToArray', () => {
  it('returns an array unchanged', () => {
    const arr = [1, 2, 3];
    assert.deepEqual(coerceToArray(arr), [1, 2, 3]);
  });

  it('wraps a string in an array', () => {
    assert.deepEqual(coerceToArray('hello'), ['hello']);
  });

  it('wraps a number in an array', () => {
    assert.deepEqual(coerceToArray(42), [42]);
  });

  it('returns empty array for null', () => {
    assert.deepEqual(coerceToArray(null), []);
  });

  it('returns empty array for undefined', () => {
    assert.deepEqual(coerceToArray(undefined), []);
  });

  it('wraps an object in an array', () => {
    assert.deepEqual(coerceToArray({ a: 1 }), [{ a: 1 }]);
  });

  it('handles an empty array', () => {
    assert.deepEqual(coerceToArray([]), []);
  });
});

// ─── coerceToDate ─────────────────────────────────────────────────────────────

describe('coerceToDate', () => {
  it('returns null for null', () => {
    assert.equal(coerceToDate(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(coerceToDate(undefined), null);
  });

  it('returns a valid Date from a timestamp number', () => {
    const d = coerceToDate(0);
    assert.ok(d instanceof Date);
    assert.equal(d.getTime(), 0);
  });

  it('parses an ISO date string', () => {
    const d = coerceToDate('2024-01-15');
    assert.ok(d instanceof Date);
    assert.ok(!isNaN(d.getTime()));
  });

  it('returns a valid Date instance unchanged', () => {
    const original = new Date('2024-06-01');
    const result = coerceToDate(original);
    assert.ok(result instanceof Date);
    assert.equal(result.getTime(), original.getTime());
  });

  it('returns null for an invalid date string', () => {
    assert.equal(coerceToDate('not-a-date'), null);
  });

  it('returns null for an empty string', () => {
    assert.equal(coerceToDate(''), null);
  });

  it('returns null for an object', () => {
    assert.equal(coerceToDate({}), null);
  });

  it('returns null for Infinity', () => {
    assert.equal(coerceToDate(Infinity), null);
  });
});

// ─── coerceObject ─────────────────────────────────────────────────────────────

describe('coerceObject', () => {
  it('coerces string fields', () => {
    const result = coerceObject({ name: 42 }, { name: 'string' });
    assert.equal(result.name, '42');
  });

  it('coerces number fields', () => {
    const result = coerceObject({ age: '30' }, { age: 'number' });
    assert.equal(result.age, 30);
  });

  it('coerces boolean fields', () => {
    const result = coerceObject({ active: 'true' }, { active: 'boolean' });
    assert.equal(result.active, true);
  });

  it('coerces date fields', () => {
    const result = coerceObject({ created: '2024-01-01' }, { created: 'date' });
    assert.ok(result.created instanceof Date);
  });

  it('coerces multiple fields', () => {
    const result = coerceObject(
      { name: 123, count: '5', flag: 0 },
      { name: 'string', count: 'number', flag: 'boolean' },
    );
    assert.equal(result.name, '123');
    assert.equal(result.count, 5);
    assert.equal(result.flag, false);
  });

  it('handles missing fields by coercing undefined', () => {
    const result = coerceObject({}, { name: 'string', count: 'number' });
    assert.equal(result.name, '');
    assert.equal(result.count, null);
  });

  it('returns empty object for non-object input', () => {
    const result = coerceObject('not an object', { x: 'string' });
    assert.equal(result.x, '');
  });
});

// ─── sanitize ─────────────────────────────────────────────────────────────────

describe('sanitize', () => {
  it('passes through primitives', () => {
    assert.equal(sanitize(42), 42);
    assert.equal(sanitize('hello'), 'hello');
    assert.equal(sanitize(true), true);
    assert.equal(sanitize(null), null);
  });

  it('removes function values from objects', () => {
    const result = sanitize({ a: 1, fn: () => {} });
    assert.equal(result.a, 1);
    assert.ok(!('fn' in result));
  });

  it('removes undefined values from objects', () => {
    const result = sanitize({ a: 1, b: undefined });
    assert.equal(result.a, 1);
    assert.ok(!('b' in result));
  });

  it('removes functions from arrays', () => {
    const result = sanitize([1, () => {}, 3]);
    assert.deepEqual(result, [1, 3]);
  });

  it('handles circular references', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const result = sanitize(obj);
    assert.equal(result.a, 1);
    assert.equal(result.self, '[Circular]');
  });

  it('respects maxDepth and truncates deep objects', () => {
    const deep = { level1: { level2: { level3: { value: 42 } } } };
    const result = sanitize(deep, 2);
    assert.ok(result.level1 !== null);
    // At depth 2 the deeply nested value is truncated to null
    assert.equal(result.level1.level2, null);
  });

  it('preserves nested objects within depth', () => {
    const obj = { a: { b: 1 } };
    const result = sanitize(obj, 5);
    assert.equal(result.a.b, 1);
  });

  it('handles empty objects and arrays', () => {
    assert.deepEqual(sanitize({}), {});
    assert.deepEqual(sanitize([]), []);
  });
});
