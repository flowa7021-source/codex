// ─── Unit Tests: object-utils ─────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deepClone,
  deepMerge,
  getByPath,
  setByPath,
  deleteByPath,
  flattenObject,
  unflattenObject,
  pick,
  omit,
  deepEqual,
  deepKeys,
  getPath,
  setPath,
  deletePath,
  hasPath,
  merge,
  deepFreeze,
  deepCopy,
  mapValues,
  filterValues,
  fromEntries,
  invert,
  flatten,
  unflatten,
  isPlainObject,
  typeOf,
} from '../../app/modules/object-utils.js';

// ─── deepClone ────────────────────────────────────────────────────────────────

describe('deepClone', () => {
  it('clones a shallow object and mutations do not affect the original', () => {
    const original = { a: 1, b: 2 };
    const clone = deepClone(original);
    clone.a = 99;
    assert.equal(original.a, 1);
  });

  it('clones a nested object deeply', () => {
    const original = { a: { b: { c: 42 } } };
    const clone = deepClone(original);
    clone.a.b.c = 0;
    assert.equal(original.a.b.c, 42);
  });

  it('clones arrays inside objects', () => {
    const original = { list: [1, 2, 3] };
    const clone = deepClone(original);
    clone.list.push(4);
    assert.equal(original.list.length, 3);
  });

  it('returns primitive values unchanged', () => {
    assert.equal(deepClone(42), 42);
    assert.equal(deepClone('hello'), 'hello');
    assert.equal(deepClone(true), true);
    assert.equal(deepClone(null), null);
  });

  it('produces a value equal to the original', () => {
    const original = { x: 1, y: { z: [1, 2, 3] } };
    assert.deepEqual(deepClone(original), original);
  });
});

// ─── deepMerge ────────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  it('merges two flat objects, second overwrites first', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99, c: 3 });
    assert.deepEqual(result, { a: 1, b: 99, c: 3 });
  });

  it('recursively merges nested objects', () => {
    const target = { a: { x: 1, y: 2 }, b: 5 };
    const source = { a: { y: 99, z: 3 } };
    const result = deepMerge(target, source);
    assert.deepEqual(result, { a: { x: 1, y: 99, z: 3 }, b: 5 });
  });

  it('does not mutate the original target', () => {
    const target = { a: 1 };
    deepMerge(target, { b: 2 });
    assert.deepEqual(target, { a: 1 });
  });

  it('overwrites non-object target values with object source values', () => {
    const result = deepMerge({ a: 1 }, { a: { nested: true } });
    assert.deepEqual(result, { a: { nested: true } });
  });

  it('handles empty source', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, {});
    assert.deepEqual(result, { a: 1, b: 2 });
  });
});

// ─── getByPath ────────────────────────────────────────────────────────────────

describe('getByPath', () => {
  it('gets a deeply nested value by dot-notation path', () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(getByPath(obj, 'a.b.c'), 42);
  });

  it('returns undefined for a missing path', () => {
    const obj = { a: { b: 1 } };
    assert.equal(getByPath(obj, 'a.x.y'), undefined);
  });

  it('returns a nested object when path points to one', () => {
    const obj = { a: { b: { c: 1 } } };
    assert.deepEqual(getByPath(obj, 'a.b'), { c: 1 });
  });

  it('returns undefined when traversing through a non-object', () => {
    const obj = { a: 42 };
    assert.equal(getByPath(obj, 'a.b'), undefined);
  });

  it('gets a top-level key', () => {
    const obj = { foo: 'bar' };
    assert.equal(getByPath(obj, 'foo'), 'bar');
  });
});

// ─── setByPath ────────────────────────────────────────────────────────────────

describe('setByPath', () => {
  it('sets a nested property, creating intermediate objects', () => {
    const obj = {};
    setByPath(obj, 'a.b.c', 99);
    assert.deepEqual(obj, { a: { b: { c: 99 } } });
  });

  it('overwrites an existing nested value', () => {
    const obj = { a: { b: 1 } };
    setByPath(obj, 'a.b', 42);
    assert.equal((obj).a.b, 42);
  });

  it('sets a top-level property', () => {
    const obj = { x: 1 };
    setByPath(obj, 'y', 2);
    assert.deepEqual(obj, { x: 1, y: 2 });
  });

  it('mutates the original object and returns it', () => {
    const obj = {};
    const returned = setByPath(obj, 'a', 1);
    assert.strictEqual(returned, obj);
  });

  it('replaces non-object intermediate with object', () => {
    const obj = { a: 42 };
    setByPath(obj, 'a.b', 'hello');
    assert.deepEqual((obj).a, { b: 'hello' });
  });
});

// ─── deleteByPath ─────────────────────────────────────────────────────────────

describe('deleteByPath', () => {
  it('deletes a nested property and returns true', () => {
    const obj = { a: { b: { c: 1 } } };
    const result = deleteByPath(obj, 'a.b.c');
    assert.equal(result, true);
    assert.equal((obj).a.b.c, undefined);
  });

  it('returns false for a non-existent path', () => {
    const obj = { a: 1 };
    const result = deleteByPath(obj, 'a.b.c');
    assert.equal(result, false);
  });

  it('deletes a top-level key and returns true', () => {
    const obj = { x: 10, y: 20 };
    const result = deleteByPath(obj, 'x');
    assert.equal(result, true);
    assert.equal(Object.prototype.hasOwnProperty.call(obj, 'x'), false);
  });

  it('returns false when the path traverses a non-object', () => {
    const obj = { a: 42 };
    assert.equal(deleteByPath(obj, 'a.b'), false);
  });

  it('returns false when a key does not exist at the final segment', () => {
    const obj = { a: {} };
    assert.equal(deleteByPath(obj, 'a.missing'), false);
  });
});

// ─── flattenObject ────────────────────────────────────────────────────────────

describe('flattenObject', () => {
  it('flattens a nested object to dot-separated keys', () => {
    const obj = { a: { b: { c: 1 } } };
    assert.deepEqual(flattenObject(obj), { 'a.b.c': 1 });
  });

  it('handles a flat object (no nesting)', () => {
    const obj = { x: 1, y: 2 };
    assert.deepEqual(flattenObject(obj), { x: 1, y: 2 });
  });

  it('uses a custom separator when provided', () => {
    const obj = { a: { b: 1 } };
    assert.deepEqual(flattenObject(obj, '_'), { a_b: 1 });
  });

  it('handles multiple sibling keys at nested levels', () => {
    const obj = { a: { x: 1, y: 2 }, b: 3 };
    assert.deepEqual(flattenObject(obj), { 'a.x': 1, 'a.y': 2, b: 3 });
  });

  it('handles an empty object', () => {
    assert.deepEqual(flattenObject({}), {});
  });
});

// ─── unflattenObject ──────────────────────────────────────────────────────────

describe('unflattenObject', () => {
  it('unflattens dot-separated keys to a nested object', () => {
    const flat = { 'a.b.c': 1 };
    assert.deepEqual(unflattenObject(flat), { a: { b: { c: 1 } } });
  });

  it('handles flat keys (no separator in key)', () => {
    assert.deepEqual(unflattenObject({ x: 1, y: 2 }), { x: 1, y: 2 });
  });

  it('round-trips with flattenObject', () => {
    const original = { a: { b: { c: 42 }, d: 7 }, e: 'hello' };
    const roundTripped = unflattenObject(flattenObject(original));
    assert.deepEqual(roundTripped, original);
  });

  it('uses a custom separator when provided', () => {
    const flat = { a_b: 1 };
    assert.deepEqual(unflattenObject(flat, '_'), { a: { b: 1 } });
  });

  it('handles an empty object', () => {
    assert.deepEqual(unflattenObject({}), {});
  });
});

// ─── pick ─────────────────────────────────────────────────────────────────────

describe('pick', () => {
  it('returns an object with only the specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(pick(obj, ['a', 'c']), { a: 1, c: 3 });
  });

  it('ignores keys that do not exist on the object', () => {
    const obj = { a: 1 };
    const result = pick(obj, ['a', 'b']);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'b'), false);
  });

  it('returns empty object when keys array is empty', () => {
    assert.deepEqual(pick({ a: 1, b: 2 }, []), {});
  });

  it('does not mutate the original object', () => {
    const obj = { a: 1, b: 2 };
    pick(obj, ['a']);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });
});

// ─── omit ─────────────────────────────────────────────────────────────────────

describe('omit', () => {
  it('returns object without the specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(omit(obj, ['b']), { a: 1, c: 3 });
  });

  it('returns the full object when keys array is empty', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(omit(obj, []), { a: 1, b: 2 });
  });

  it('handles omitting all keys', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(omit(obj, ['a', 'b']), {});
  });

  it('does not mutate the original object', () => {
    const obj = { a: 1, b: 2 };
    omit(obj, ['a']);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });
});

// ─── deepEqual ────────────────────────────────────────────────────────────────

describe('deepEqual', () => {
  it('returns true for identical primitive values', () => {
    assert.equal(deepEqual(1, 1), true);
    assert.equal(deepEqual('hello', 'hello'), true);
    assert.equal(deepEqual(true, true), true);
    assert.equal(deepEqual(null, null), true);
  });

  it('returns false for different primitive values', () => {
    assert.equal(deepEqual(1, 2), false);
    assert.equal(deepEqual('a', 'b'), false);
  });

  it('returns true for deeply equal objects', () => {
    assert.equal(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }), true);
  });

  it('returns false for objects with different values', () => {
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  });

  it('returns false for objects with different keys', () => {
    assert.equal(deepEqual({ a: 1 }, { b: 1 }), false);
  });

  it('returns true for deeply equal arrays', () => {
    assert.equal(deepEqual([1, [2, 3]], [1, [2, 3]]), true);
  });

  it('returns false for arrays of different lengths', () => {
    assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
  });

  it('returns false when comparing array to object', () => {
    assert.equal(deepEqual([1, 2], { 0: 1, 1: 2 }), false);
  });

  it('returns false when comparing null to an object', () => {
    assert.equal(deepEqual(null, {}), false);
  });
});

// ─── deepKeys ─────────────────────────────────────────────────────────────────

describe('deepKeys', () => {
  it('returns all dot-notation paths for a nested object', () => {
    const obj = { a: { b: { c: 1 } } };
    const keys = deepKeys(obj);
    assert.ok(keys.includes('a'));
    assert.ok(keys.includes('a.b'));
    assert.ok(keys.includes('a.b.c'));
  });

  it('returns top-level keys for a flat object', () => {
    const keys = deepKeys({ x: 1, y: 2 });
    assert.deepEqual(keys.sort(), ['x', 'y']);
  });

  it('includes both intermediate and leaf paths', () => {
    const obj = { a: { b: 1 }, c: 2 };
    const keys = deepKeys(obj);
    assert.ok(keys.includes('a'));
    assert.ok(keys.includes('a.b'));
    assert.ok(keys.includes('c'));
  });

  it('returns empty array for an empty object', () => {
    assert.deepEqual(deepKeys({}), []);
  });

  it('does not recurse into arrays', () => {
    const obj = { a: [1, 2, 3] };
    const keys = deepKeys(obj);
    assert.deepEqual(keys, ['a']);
  });
});

// ─── getPath ──────────────────────────────────────────────────────────────────

describe('getPath', () => {
  it('returns a top-level value', () => {
    const obj = { a: 1 };
    assert.equal(getPath(obj, 'a'), 1);
  });

  it('returns a deeply nested value', () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(getPath(obj, 'a.b.c'), 42);
  });

  it('returns undefined for a missing path', () => {
    const obj = { a: 1 };
    assert.equal(getPath(obj, 'x.y.z'), undefined);
  });

  it('returns undefined when traversing through a non-object', () => {
    const obj = { a: 42 };
    assert.equal(getPath(obj, 'a.b'), undefined);
  });

  it('returns undefined for null input', () => {
    assert.equal(getPath(null, 'a'), undefined);
  });
});

// ─── setPath ──────────────────────────────────────────────────────────────────

describe('setPath', () => {
  it('sets a top-level value', () => {
    const obj = { a: 1 };
    setPath(obj, 'a', 99);
    assert.equal(obj.a, 99);
  });

  it('sets a deeply nested value', () => {
    const obj = { a: { b: { c: 1 } } };
    setPath(obj, 'a.b.c', 42);
    assert.equal(obj.a.b.c, 42);
  });

  it('creates intermediate objects when they do not exist', () => {
    const obj = {};
    setPath(obj, 'x.y.z', 'new');
    assert.equal(obj.x.y.z, 'new');
  });

  it('mutates the original object', () => {
    const obj = { a: 1 };
    setPath(obj, 'b', 2);
    assert.equal(obj.b, 2);
  });
});

// ─── deletePath ───────────────────────────────────────────────────────────────

describe('deletePath', () => {
  it('deletes a top-level key', () => {
    const obj = { a: 1, b: 2 };
    deletePath(obj, 'a');
    assert.equal(Object.prototype.hasOwnProperty.call(obj, 'a'), false);
    assert.equal(obj.b, 2);
  });

  it('deletes a nested key', () => {
    const obj = { a: { b: 1, c: 2 } };
    deletePath(obj, 'a.b');
    assert.equal(Object.prototype.hasOwnProperty.call(obj.a, 'b'), false);
    assert.equal(obj.a.c, 2);
  });

  it('does nothing when the path does not exist', () => {
    const obj = { a: 1 };
    assert.doesNotThrow(() => deletePath(obj, 'x.y.z'));
    assert.deepEqual(obj, { a: 1 });
  });

  it('returns true when a key is deleted', () => {
    const obj = { a: 1, b: 2 };
    assert.equal(deletePath(obj, 'a'), true);
  });

  it('returns false when the path does not exist', () => {
    const obj = { a: 1 };
    assert.equal(deletePath(obj, 'x.y'), false);
  });
});

// ─── hasPath ─────────────────────────────────────────────────────────────────

describe('hasPath', () => {
  it('returns true for an existing top-level key', () => {
    assert.equal(hasPath({ a: 1 }, 'a'), true);
  });

  it('returns true for an existing nested key', () => {
    assert.equal(hasPath({ a: { b: { c: 42 } } }, 'a.b.c'), true);
  });

  it('returns false for a missing key', () => {
    assert.equal(hasPath({ a: 1 }, 'b'), false);
  });

  it('returns false for a missing nested key', () => {
    assert.equal(hasPath({ a: { b: 1 } }, 'a.c'), false);
  });

  it('returns false for null input', () => {
    assert.equal(hasPath(null, 'a'), false);
  });

  it('returns false when traversing through a non-object', () => {
    assert.equal(hasPath({ a: 42 }, 'a.b'), false);
  });

  it('returns true for a key with undefined value', () => {
    assert.equal(hasPath({ a: undefined }, 'a'), true);
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('merges source properties into target', () => {
    const target = { a: 1 };
    const result = merge(target, { b: 2 });
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('overwrites existing keys', () => {
    const target = { a: 1, b: 2 };
    merge(target, { b: 99, c: 3 });
    assert.deepEqual(target, { a: 1, b: 99, c: 3 });
  });

  it('mutates and returns the target', () => {
    const target = { a: 1 };
    const result = merge(target, { b: 2 });
    assert.strictEqual(result, target);
  });

  it('merges multiple sources left to right', () => {
    const target = { a: 1 };
    merge(target, { b: 2 }, { c: 3 }, { b: 99 });
    assert.deepEqual(target, { a: 1, b: 99, c: 3 });
  });

  it('returns target unchanged when no sources given', () => {
    const target = { a: 1 };
    merge(target);
    assert.deepEqual(target, { a: 1 });
  });
});

// ─── deepFreeze ───────────────────────────────────────────────────────────────

describe('deepFreeze', () => {
  it('freezes the top-level object', () => {
    const obj = deepFreeze({ a: 1 });
    assert.equal(Object.isFrozen(obj), true);
  });

  it('freezes nested objects', () => {
    const obj = deepFreeze({ a: { b: { c: 1 } } });
    assert.equal(Object.isFrozen(obj.a), true);
    assert.equal(Object.isFrozen(obj.a.b), true);
  });

  it('returns the same object reference', () => {
    const obj = { a: 1 };
    const result = deepFreeze(obj);
    assert.strictEqual(result, obj);
  });

  it('prevents mutation of nested property (in strict mode the assignment throws)', () => {
    const obj = deepFreeze({ a: { b: 42 } });
    assert.throws(() => {
      'use strict';
      (obj.a).b = 99;
    });
  });
});

// ─── deepCopy ─────────────────────────────────────────────────────────────────

describe('deepCopy', () => {
  it('returns a deeply equal but distinct object', () => {
    const original = { a: { b: 1 } };
    const copy = deepCopy(original);
    assert.deepEqual(copy, original);
    assert.notStrictEqual(copy, original);
  });

  it('mutations on the copy do not affect the original', () => {
    const original = { a: { b: 1 } };
    const copy = deepCopy(original);
    copy.a.b = 99;
    assert.equal(original.a.b, 1);
  });

  it('copies arrays correctly', () => {
    const original = [1, [2, 3], { a: 4 }];
    const copy = deepCopy(original);
    assert.deepEqual(copy, original);
    copy[1][0] = 99;
    assert.equal(original[1][0], 2);
  });

  it('copies primitive values', () => {
    assert.equal(deepCopy(42), 42);
    assert.equal(deepCopy('hello'), 'hello');
    assert.equal(deepCopy(true), true);
  });
});

// ─── mapValues ────────────────────────────────────────────────────────────────

describe('mapValues', () => {
  it('maps values with a transform function', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = mapValues(obj, (v) => v * 2);
    assert.deepEqual(result, { a: 2, b: 4, c: 6 });
  });

  it('passes both value and key to the function', () => {
    const obj = { x: 1, y: 2 };
    const result = mapValues(obj, (v, k) => `${k}:${v}`);
    assert.deepEqual(result, { x: 'x:1', y: 'y:2' });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(mapValues({}, (v) => v), {});
  });

  it('does not mutate the original object', () => {
    const obj = { a: 1 };
    mapValues(obj, (v) => v + 10);
    assert.deepEqual(obj, { a: 1 });
  });
});

// ─── filterValues ─────────────────────────────────────────────────────────────

describe('filterValues', () => {
  it('keeps only values passing the predicate', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = filterValues(obj, (v) => v % 2 === 0);
    assert.deepEqual(result, { b: 2, d: 4 });
  });

  it('passes both value and key to predicate', () => {
    const obj = { keep: 1, skip: 2, keep2: 3 };
    const result = filterValues(obj, (_v, k) => k.startsWith('keep'));
    assert.deepEqual(result, { keep: 1, keep2: 3 });
  });

  it('returns empty object when no values match', () => {
    const obj = { a: 1, b: 2 };
    const result = filterValues(obj, (v) => v > 100);
    assert.deepEqual(result, {});
  });

  it('returns full object when all values match', () => {
    const obj = { a: 1, b: 2 };
    const result = filterValues(obj, () => true);
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('does not mutate the original', () => {
    const obj = { a: 1, b: 2 };
    filterValues(obj, (v) => v > 1);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });
});

// ─── fromEntries ──────────────────────────────────────────────────────────────

describe('fromEntries', () => {
  it('creates an object from [key, value] pairs', () => {
    const result = fromEntries([['a', 1], ['b', 2]]);
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('returns empty object for empty array', () => {
    assert.deepEqual(fromEntries([]), {});
  });

  it('last duplicate key wins', () => {
    const result = fromEntries([['a', 1], ['a', 99]]);
    assert.deepEqual(result, { a: 99 });
  });

  it('round-trips with Object.entries', () => {
    const original = { x: 'hello', y: 'world' };
    const result = fromEntries(Object.entries(original));
    assert.deepEqual(result, original);
  });
});

// ─── invert ───────────────────────────────────────────────────────────────────

describe('invert', () => {
  it('swaps keys and values', () => {
    const obj = { a: 'x', b: 'y', c: 'z' };
    assert.deepEqual(invert(obj), { x: 'a', y: 'b', z: 'c' });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(invert({}), {});
  });

  it('last duplicate value becomes the only key', () => {
    const result = invert({ a: 'dup', b: 'dup' });
    assert.equal(result['dup'], 'b');
  });

  it('does not mutate the original', () => {
    const obj = { a: 'x' };
    invert(obj);
    assert.deepEqual(obj, { a: 'x' });
  });
});

// ─── flatten (object) ─────────────────────────────────────────────────────────

describe('flatten', () => {
  it('flattens nested object to dot-separated keys', () => {
    const result = flatten({ a: { b: 1 }, c: 2 }, '', '.');
    assert.deepEqual(result, { 'a.b': 1, c: 2 });
  });

  it('defaults separator to dot', () => {
    const result = flatten({ a: { b: 1 } });
    assert.deepEqual(result, { 'a.b': 1 });
  });

  it('handles deeply nested objects', () => {
    const result = flatten({ a: { b: { c: 42 } } });
    assert.deepEqual(result, { 'a.b.c': 42 });
  });

  it('uses a custom separator', () => {
    const result = flatten({ a: { b: 1 } }, '', '_');
    assert.deepEqual(result, { 'a_b': 1 });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(flatten({}), {});
  });

  it('does not include intermediate keys, only leaf values', () => {
    const result = flatten({ a: { b: 1, c: 2 }, d: 3 });
    assert.deepEqual(result, { 'a.b': 1, 'a.c': 2, d: 3 });
  });
});

// ─── unflatten (object) ───────────────────────────────────────────────────────

describe('unflatten', () => {
  it('unflattens dot-separated keys to nested object', () => {
    const result = unflatten({ 'a.b': 1, c: 2 });
    assert.deepEqual(result, { a: { b: 1 }, c: 2 });
  });

  it('handles deeply nested paths', () => {
    assert.deepEqual(unflatten({ 'a.b.c': 42 }), { a: { b: { c: 42 } } });
  });

  it('handles custom separator', () => {
    assert.deepEqual(unflatten({ 'a_b': 1 }, '_'), { a: { b: 1 } });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(unflatten({}), {});
  });

  it('round-trips with flatten', () => {
    const original = { a: { b: { c: 1 }, d: 2 }, e: 3 };
    const result = unflatten(flatten(original));
    assert.deepEqual(result, original);
  });
});

// ─── isPlainObject ────────────────────────────────────────────────────────────

describe('isPlainObject', () => {
  it('returns true for a plain object literal', () => {
    assert.equal(isPlainObject({}), true);
  });

  it('returns true for an object with no prototype', () => {
    assert.equal(isPlainObject(Object.create(null)), true);
  });

  it('returns false for an array', () => {
    assert.equal(isPlainObject([]), false);
  });

  it('returns false for null', () => {
    assert.equal(isPlainObject(null), false);
  });

  it('returns false for a Date instance', () => {
    assert.equal(isPlainObject(new Date()), false);
  });

  it('returns false for a string', () => {
    assert.equal(isPlainObject('hello'), false);
  });

  it('returns false for a class instance', () => {
    class Foo {}
    assert.equal(isPlainObject(new Foo()), false);
  });
});

// ─── typeOf ───────────────────────────────────────────────────────────────────

describe('typeOf', () => {
  it('returns "null" for null', () => {
    assert.equal(typeOf(null), 'null');
  });

  it('returns "undefined" for undefined', () => {
    assert.equal(typeOf(undefined), 'undefined');
  });

  it('returns "array" for an array', () => {
    assert.equal(typeOf([]), 'array');
    assert.equal(typeOf([1, 2, 3]), 'array');
  });

  it('returns "object" for a plain object', () => {
    assert.equal(typeOf({}), 'object');
  });

  it('returns "string" for a string', () => {
    assert.equal(typeOf('hello'), 'string');
    assert.equal(typeOf(''), 'string');
  });

  it('returns "number" for a number', () => {
    assert.equal(typeOf(42), 'number');
    assert.equal(typeOf(NaN), 'number');
  });

  it('returns "boolean" for a boolean', () => {
    assert.equal(typeOf(true), 'boolean');
    assert.equal(typeOf(false), 'boolean');
  });

  it('returns "function" for a function', () => {
    assert.equal(typeOf(() => {}), 'function');
    assert.equal(typeOf(function foo() {}), 'function');
  });
});
