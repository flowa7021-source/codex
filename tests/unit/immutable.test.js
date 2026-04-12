// ─── Unit Tests: Immutable Data Structure Utilities ───────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  freeze,
  isFrozen,
  push,
  pop,
  shift,
  unshift,
  splice,
  set,
  remove,
  setKey,
  deleteKey,
  merge,
  updateKey,
  deepClone,
  deepMerge,
  deepEqual,
  getPath,
  setPath,
  deletePath,
} from '../../app/modules/immutable.js';

// ─── freeze / isFrozen ────────────────────────────────────────────────────────

describe('freeze', () => {
  it('freezes a flat object', () => {
    const obj = freeze({ x: 1 });
    assert.ok(Object.isFrozen(obj));
  });

  it('freezes nested objects recursively', () => {
    const obj = freeze({ a: { b: { c: 3 } } });
    assert.ok(Object.isFrozen(obj.a));
    assert.ok(Object.isFrozen(obj.a.b));
  });

  it('freezes nested arrays', () => {
    const obj = freeze({ items: [1, 2, 3] });
    assert.ok(Object.isFrozen(obj.items));
  });

  it('returns the same reference', () => {
    const original = { n: 42 };
    const result = freeze(original);
    assert.equal(result, original);
  });

  it('passes primitives through unchanged', () => {
    assert.equal(freeze(7), 7);
    assert.equal(freeze('hi'), 'hi');
    assert.equal(freeze(null), null);
  });

  it('prevents mutation of frozen objects', () => {
    const obj = freeze({ x: 1 });
    assert.throws(() => {
      'use strict';
      // @ts-ignore intentional mutation for test
      obj.x = 99;
    });
  });
});

describe('isFrozen', () => {
  it('returns true for frozen flat objects', () => {
    assert.ok(isFrozen(freeze({ a: 1 })));
  });

  it('returns false for unfrozen objects', () => {
    assert.ok(!isFrozen({ a: 1 }));
  });

  it('returns false when a nested property is not frozen', () => {
    const outer = Object.freeze({ inner: { x: 1 } }); // inner not frozen
    assert.ok(!isFrozen(outer));
  });

  it('returns true for deeply frozen structures', () => {
    assert.ok(isFrozen(freeze({ a: { b: { c: 3 } } })));
  });

  it('returns true for primitives', () => {
    assert.ok(isFrozen(42));
    assert.ok(isFrozen('str'));
    assert.ok(isFrozen(null));
  });
});

// ─── push ─────────────────────────────────────────────────────────────────────

describe('push', () => {
  it('appends a single item', () => {
    assert.deepEqual(push([1, 2], 3), [1, 2, 3]);
  });

  it('appends multiple items', () => {
    assert.deepEqual(push([1], 2, 3, 4), [1, 2, 3, 4]);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2];
    push(arr, 3);
    assert.deepEqual(arr, [1, 2]);
  });

  it('works on an empty array', () => {
    assert.deepEqual(push([], 'a'), ['a']);
  });

  it('handles no items (identity)', () => {
    assert.deepEqual(push([1, 2]), [1, 2]);
  });
});

// ─── pop ──────────────────────────────────────────────────────────────────────

describe('pop', () => {
  it('removes the last element', () => {
    assert.deepEqual(pop([1, 2, 3]), [1, 2]);
  });

  it('returns empty array for a single-element array', () => {
    assert.deepEqual(pop([42]), []);
  });

  it('returns empty array for an empty array', () => {
    assert.deepEqual(pop([]), []);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2, 3];
    pop(arr);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── shift ────────────────────────────────────────────────────────────────────

describe('shift', () => {
  it('removes the first element', () => {
    assert.deepEqual(shift([10, 20, 30]), [20, 30]);
  });

  it('returns empty array for a single-element array', () => {
    assert.deepEqual(shift(['only']), []);
  });

  it('returns empty array for an empty array', () => {
    assert.deepEqual(shift([]), []);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2, 3];
    shift(arr);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── unshift ──────────────────────────────────────────────────────────────────

describe('unshift', () => {
  it('prepends a single item', () => {
    assert.deepEqual(unshift([2, 3], 1), [1, 2, 3]);
  });

  it('prepends multiple items in order', () => {
    assert.deepEqual(unshift([3], 1, 2), [1, 2, 3]);
  });

  it('works on an empty array', () => {
    assert.deepEqual(unshift([], 'a', 'b'), ['a', 'b']);
  });

  it('does not mutate the original', () => {
    const arr = [3, 4];
    unshift(arr, 1, 2);
    assert.deepEqual(arr, [3, 4]);
  });

  it('handles no items (identity)', () => {
    assert.deepEqual(unshift([1, 2]), [1, 2]);
  });
});

// ─── splice ───────────────────────────────────────────────────────────────────

describe('splice', () => {
  it('removes elements without inserting', () => {
    assert.deepEqual(splice([1, 2, 3, 4], 1, 2), [1, 4]);
  });

  it('inserts elements without removing', () => {
    assert.deepEqual(splice([1, 4], 1, 0, 2, 3), [1, 2, 3, 4]);
  });

  it('replaces elements', () => {
    assert.deepEqual(splice([1, 2, 3], 1, 1, 99), [1, 99, 3]);
  });

  it('removes from start to end when deleteCount is omitted', () => {
    assert.deepEqual(splice([1, 2, 3, 4], 2), [1, 2]);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2, 3];
    splice(arr, 0, 1);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── set ──────────────────────────────────────────────────────────────────────

describe('set (array)', () => {
  it('replaces the element at a positive index', () => {
    assert.deepEqual(set([1, 2, 3], 1, 99), [1, 99, 3]);
  });

  it('supports negative indices', () => {
    assert.deepEqual(set([1, 2, 3], -1, 99), [1, 2, 99]);
  });

  it('sets the first element', () => {
    assert.deepEqual(set([0, 2, 3], 0, 1), [1, 2, 3]);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2, 3];
    set(arr, 0, 99);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('removes the element at a positive index', () => {
    assert.deepEqual(remove([1, 2, 3], 1), [1, 3]);
  });

  it('removes the first element', () => {
    assert.deepEqual(remove([1, 2, 3], 0), [2, 3]);
  });

  it('supports negative indices', () => {
    assert.deepEqual(remove([1, 2, 3], -1), [1, 2]);
  });

  it('returns empty array when removing the only element', () => {
    assert.deepEqual(remove([42], 0), []);
  });

  it('does not mutate the original', () => {
    const arr = [1, 2, 3];
    remove(arr, 1);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── setKey ───────────────────────────────────────────────────────────────────

describe('setKey', () => {
  it('sets an existing key', () => {
    assert.deepEqual(setKey({ a: 1, b: 2 }, 'a', 99), { a: 99, b: 2 });
  });

  it('does not mutate the original', () => {
    const obj = { a: 1 };
    setKey(obj, 'a', 99);
    assert.equal(obj.a, 1);
  });

  it('returns a new object reference', () => {
    const obj = { a: 1 };
    const result = setKey(obj, 'a', 1);
    assert.notEqual(result, obj);
  });

  it('preserves other keys', () => {
    const result = setKey({ x: 1, y: 2, z: 3 }, 'y', 99);
    assert.equal(result.x, 1);
    assert.equal(result.z, 3);
  });
});

// ─── deleteKey ────────────────────────────────────────────────────────────────

describe('deleteKey', () => {
  it('removes the specified key', () => {
    const result = deleteKey({ a: 1, b: 2 }, 'a');
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'a'));
  });

  it('preserves other keys', () => {
    const result = deleteKey({ a: 1, b: 2, c: 3 }, 'b');
    assert.deepEqual(result, { a: 1, c: 3 });
  });

  it('does not mutate the original', () => {
    const obj = { a: 1, b: 2 };
    deleteKey(obj, 'a');
    assert.ok(Object.prototype.hasOwnProperty.call(obj, 'a'));
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('merges two objects', () => {
    assert.deepEqual(merge({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
  });

  it('source overrides target for shared keys', () => {
    assert.deepEqual(merge({ a: 1, b: 0 }, { b: 2 }), { a: 1, b: 2 });
  });

  it('does not mutate either argument', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    merge(target, source);
    assert.deepEqual(target, { a: 1 });
    assert.deepEqual(source, { b: 2 });
  });

  it('merging with empty object returns equivalent copy', () => {
    const obj = { x: 10 };
    assert.deepEqual(merge(obj, {}), obj);
  });
});

// ─── updateKey ────────────────────────────────────────────────────────────────

describe('updateKey', () => {
  it('applies the updater to the specified key', () => {
    const result = updateKey({ count: 5 }, 'count', (v) => (v) + 1);
    assert.equal(result.count, 6);
  });

  it('does not mutate the original', () => {
    const obj = { count: 5 };
    updateKey(obj, 'count', (v) => (v) + 1);
    assert.equal(obj.count, 5);
  });

  it('preserves other keys', () => {
    const result = updateKey({ a: 1, b: 'hello' }, 'b', (v) => String(v).toUpperCase());
    assert.equal(result.a, 1);
    assert.equal(result.b, 'HELLO');
  });
});

// ─── deepClone ────────────────────────────────────────────────────────────────

describe('deepClone', () => {
  it('clones a primitive (number)', () => {
    assert.equal(deepClone(42), 42);
  });

  it('clones a primitive (string)', () => {
    assert.equal(deepClone('hello'), 'hello');
  });

  it('clones null', () => {
    assert.equal(deepClone(null), null);
  });

  it('clones a flat object', () => {
    const obj = { a: 1, b: 2 };
    const clone = deepClone(obj);
    assert.deepEqual(clone, obj);
    assert.notEqual(clone, obj);
  });

  it('clones a nested object deeply', () => {
    const obj = { a: { b: { c: 3 } } };
    const clone = deepClone(obj);
    assert.deepEqual(clone, obj);
    assert.notEqual(clone.a, obj.a);
    assert.notEqual(clone.a.b, obj.a.b);
  });

  it('clones an array', () => {
    const arr = [1, [2, 3], { x: 4 }];
    const clone = deepClone(arr);
    assert.deepEqual(clone, arr);
    assert.notEqual(clone, arr);
    assert.notEqual(clone[1], arr[1]);
  });

  it('clones a Date', () => {
    const d = new Date(2024, 0, 1);
    const clone = deepClone(d);
    assert.ok(clone instanceof Date);
    assert.equal(clone.getTime(), d.getTime());
    assert.notEqual(clone, d);
  });

  it('clones a Map', () => {
    const m = new Map([['key', { val: 1 }]]);
    const clone = deepClone(m);
    assert.ok(clone instanceof Map);
    assert.notEqual(clone, m);
    assert.notEqual(clone.get('key'), m.get('key'));
    assert.deepEqual(clone.get('key'), m.get('key'));
  });

  it('clones a Set', () => {
    const s = new Set([1, 2, 3]);
    const clone = deepClone(s);
    assert.ok(clone instanceof Set);
    assert.notEqual(clone, s);
    assert.ok(clone.has(1) && clone.has(2) && clone.has(3));
  });

  it('mutation of clone does not affect original', () => {
    const obj = { nested: { x: 1 } };
    const clone = deepClone(obj);
    clone.nested.x = 99;
    assert.equal(obj.nested.x, 1);
  });
});

// ─── deepMerge ────────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  it('merges flat objects', () => {
    assert.deepEqual(deepMerge({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
  });

  it('recursively merges nested objects', () => {
    const result = deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 99 } });
    assert.deepEqual(result, { a: { x: 1, y: 99 } });
  });

  it('source value wins for non-object fields', () => {
    assert.deepEqual(deepMerge({ n: 1 }, { n: 42 }), { n: 42 });
  });

  it('does not mutate either argument', () => {
    const target = { a: { x: 1 } };
    const source = { a: { x: 2 } };
    deepMerge(target, source);
    assert.equal(target.a.x, 1);
  });

  it('source arrays replace (not merge) target arrays', () => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3] });
    assert.deepEqual(result.arr, [3]);
  });
});

// ─── deepEqual ────────────────────────────────────────────────────────────────

describe('deepEqual', () => {
  it('identical primitives are equal', () => {
    assert.ok(deepEqual(1, 1));
    assert.ok(deepEqual('x', 'x'));
    assert.ok(deepEqual(null, null));
  });

  it('different primitives are not equal', () => {
    assert.ok(!deepEqual(1, 2));
    assert.ok(!deepEqual('a', 'b'));
  });

  it('deeply equal objects are equal', () => {
    assert.ok(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }));
  });

  it('objects with different values are not equal', () => {
    assert.ok(!deepEqual({ a: 1 }, { a: 2 }));
  });

  it('objects with different key counts are not equal', () => {
    assert.ok(!deepEqual({ a: 1 }, { a: 1, b: 2 }));
  });

  it('deeply equal arrays are equal', () => {
    assert.ok(deepEqual([1, [2, 3]], [1, [2, 3]]));
  });

  it('arrays of different lengths are not equal', () => {
    assert.ok(!deepEqual([1, 2], [1, 2, 3]));
  });

  it('Date instances are compared by time value', () => {
    const d1 = new Date(2024, 0, 1);
    const d2 = new Date(2024, 0, 1);
    const d3 = new Date(2025, 0, 1);
    assert.ok(deepEqual(d1, d2));
    assert.ok(!deepEqual(d1, d3));
  });

  it('Maps are compared by entries', () => {
    assert.ok(deepEqual(new Map([['a', 1]]), new Map([['a', 1]])));
    assert.ok(!deepEqual(new Map([['a', 1]]), new Map([['a', 2]])));
  });

  it('Sets are compared by membership', () => {
    assert.ok(deepEqual(new Set([1, 2]), new Set([2, 1])));
    assert.ok(!deepEqual(new Set([1, 2]), new Set([1, 3])));
  });

  it('array vs object is not equal', () => {
    assert.ok(!deepEqual([], {}));
  });
});

// ─── getPath ──────────────────────────────────────────────────────────────────

describe('getPath', () => {
  it('reads a top-level key', () => {
    assert.equal(getPath({ a: 1 }, 'a'), 1);
  });

  it('reads a nested value', () => {
    assert.equal(getPath({ a: { b: { c: 42 } } }, 'a.b.c'), 42);
  });

  it('returns undefined for a missing key', () => {
    assert.equal(getPath({ a: 1 }, 'z'), undefined);
  });

  it('returns undefined when traversal hits a non-object', () => {
    assert.equal(getPath({ a: 1 }, 'a.b'), undefined);
  });

  it('reads array elements via numeric string keys', () => {
    assert.equal(getPath({ items: [10, 20, 30] }, 'items.1'), 20);
  });
});

// ─── setPath ──────────────────────────────────────────────────────────────────

describe('setPath', () => {
  it('sets a top-level key', () => {
    assert.deepEqual(setPath({ a: 1 }, 'a', 99), { a: 99 });
  });

  it('sets a deeply nested key', () => {
    const result = setPath({ a: { b: { c: 1 } } }, 'a.b.c', 42);
    assert.equal(result.a.b.c, 42);
  });

  it('creates intermediate objects as needed', () => {
    const result = setPath({}, 'x.y.z', 7);
    assert.equal(result.x.y.z, 7);
  });

  it('does not mutate the original', () => {
    const obj = { a: { b: 1 } };
    setPath(obj, 'a.b', 99);
    assert.equal(obj.a.b, 1);
  });

  it('sibling keys are preserved', () => {
    const result = setPath({ a: { b: 1, c: 2 } }, 'a.b', 99);
    assert.equal(result.a.c, 2);
  });
});

// ─── deletePath ───────────────────────────────────────────────────────────────

describe('deletePath', () => {
  it('deletes a top-level key', () => {
    const result = deletePath({ a: 1, b: 2 }, 'a');
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'a'));
    assert.equal(result.b, 2);
  });

  it('deletes a nested key', () => {
    const result = deletePath({ a: { b: 1, c: 2 } }, 'a.b');
    assert.ok(!Object.prototype.hasOwnProperty.call(result.a, 'b'));
    assert.equal(result.a.c, 2);
  });

  it('does not mutate the original', () => {
    const obj = { a: { b: 1 } };
    deletePath(obj, 'a.b');
    assert.ok(Object.prototype.hasOwnProperty.call(obj.a, 'b'));
  });

  it('returns object unchanged when path does not exist', () => {
    const obj = { a: 1 };
    const result = deletePath(obj, 'z');
    assert.deepEqual(result, obj);
  });

  it('sibling keys at the same level are preserved', () => {
    const result = deletePath({ a: 1, b: 2, c: 3 }, 'b');
    assert.deepEqual(result, { a: 1, c: 3 });
  });
});
