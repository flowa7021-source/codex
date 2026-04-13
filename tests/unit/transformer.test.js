// ─── Unit Tests: transformer ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deepClone,
  deepMerge,
  pick,
  omit,
  flatten,
  unflatten,
  groupBy,
  sortBy,
  chunk,
  zip,
} from '../../app/modules/transformer.js';

// ─── deepClone ────────────────────────────────────────────────────────────────

describe('deepClone', () => {
  it('clones a simple object', () => {
    const obj = { a: 1, b: 'two' };
    const cloned = deepClone(obj);
    assert.deepEqual(cloned, obj);
    assert.notEqual(cloned, obj);
  });

  it('deep clones nested objects', () => {
    const obj = { a: { b: { c: 42 } } };
    const cloned = deepClone(obj);
    assert.deepEqual(cloned, obj);
    cloned.a.b.c = 99;
    assert.equal(obj.a.b.c, 42);
  });

  it('clones arrays', () => {
    const arr = [1, [2, 3], { x: 4 }];
    const cloned = deepClone(arr);
    assert.deepEqual(cloned, arr);
    assert.notEqual(cloned, arr);
  });

  it('handles null and primitives', () => {
    assert.equal(deepClone(null), null);
    assert.equal(deepClone(42), 42);
    assert.equal(deepClone('hello'), 'hello');
    assert.equal(deepClone(true), true);
  });

  it('handles circular references gracefully', () => {
    const obj = { a: 1 };
    // @ts-ignore
    obj.self = obj;
    const cloned = deepClone(obj);
    assert.equal(cloned.a, 1);
    // @ts-ignore
    assert.equal(cloned.self, cloned);
  });
});

// ─── deepMerge ────────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  it('later values override earlier ones', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99 });
    assert.deepEqual(result, { a: 1, b: 99 });
  });

  it('deep merges nested objects', () => {
    const result = deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 99, z: 3 } });
    assert.deepEqual(result, { a: { x: 1, y: 99, z: 3 } });
  });

  it('replaces arrays instead of merging them', () => {
    const result = deepMerge({ arr: [1, 2] }, { arr: [3, 4, 5] });
    assert.deepEqual(result, { arr: [3, 4, 5] });
  });

  it('merges more than two objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 });
    assert.deepEqual(result, { a: 1, b: 2, c: 3 });
  });

  it('returns empty object when called with no arguments', () => {
    assert.deepEqual(deepMerge(), {});
  });
});

// ─── pick ─────────────────────────────────────────────────────────────────────

describe('pick', () => {
  it('picks specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(pick(obj, ['a', 'c']), { a: 1, c: 3 });
  });

  it('returns empty object when keys array is empty', () => {
    assert.deepEqual(pick({ a: 1 }, []), {});
  });

  it('ignores keys that do not exist on the object', () => {
    const obj = { a: 1, b: 2 };
    // @ts-ignore
    const result = pick(obj, ['a', 'z']);
    assert.deepEqual(result, { a: 1 });
  });

  it('does not mutate the original object', () => {
    const obj = { a: 1, b: 2 };
    pick(obj, ['a']);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });
});

// ─── omit ─────────────────────────────────────────────────────────────────────

describe('omit', () => {
  it('omits specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(omit(obj, ['b']), { a: 1, c: 3 });
  });

  it('returns copy of original when keys array is empty', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(omit(obj, []), { a: 1, b: 2 });
  });

  it('omits multiple keys', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    assert.deepEqual(omit(obj, ['a', 'c']), { b: 2, d: 4 });
  });

  it('does not mutate the original object', () => {
    const obj = { a: 1, b: 2 };
    omit(obj, ['a']);
    assert.deepEqual(obj, { a: 1, b: 2 });
  });
});

// ─── flatten ──────────────────────────────────────────────────────────────────

describe('flatten', () => {
  it('flattens a nested object to dot-path keys', () => {
    const obj = { a: { b: { c: 1 } }, d: 2 };
    assert.deepEqual(flatten(obj), { 'a.b.c': 1, d: 2 });
  });

  it('handles top-level primitives', () => {
    const obj = { x: 1, y: 'hello', z: true };
    assert.deepEqual(flatten(obj), { x: 1, y: 'hello', z: true });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(flatten({}), {});
  });

  it('preserves arrays as values (does not recurse into arrays)', () => {
    const obj = { a: [1, 2, 3] };
    const result = flatten(obj);
    assert.deepEqual(result, { a: [1, 2, 3] });
  });

  it('handles prefix parameter', () => {
    const result = flatten({ b: 1 }, 'a');
    assert.deepEqual(result, { 'a.b': 1 });
  });

  it('handles null values', () => {
    const obj = { a: null };
    assert.deepEqual(flatten(obj), { a: null });
  });
});

// ─── unflatten ────────────────────────────────────────────────────────────────

describe('unflatten', () => {
  it('unflattens dot-path keys to nested object', () => {
    const obj = { 'a.b.c': 1, d: 2 };
    assert.deepEqual(unflatten(obj), { a: { b: { c: 1 } }, d: 2 });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(unflatten({}), {});
  });

  it('handles keys without dots', () => {
    const obj = { x: 1, y: 2 };
    assert.deepEqual(unflatten(obj), { x: 1, y: 2 });
  });

  it('is the inverse of flatten for simple objects', () => {
    const original = { a: { b: 1 }, c: { d: { e: 2 } } };
    const result = unflatten(flatten(original));
    assert.deepEqual(result, original);
  });
});

// ─── groupBy ──────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups items by a key function returning string', () => {
    const items = ['one', 'two', 'three', 'four', 'five'];
    const result = groupBy(items, (s) => String(s.length));
    assert.deepEqual(result['3'], ['one', 'two']);
    assert.deepEqual(result['5'], ['three']);
    assert.deepEqual(result['4'], ['four', 'five']);
  });

  it('returns empty object for empty array', () => {
    assert.deepEqual(groupBy([], (x) => String(x)), {});
  });

  it('handles all items in the same group', () => {
    const result = groupBy([1, 2, 3], () => 'all');
    assert.deepEqual(result, { all: [1, 2, 3] });
  });

  it('handles objects by property', () => {
    const items = [{ type: 'a' }, { type: 'b' }, { type: 'a' }];
    const result = groupBy(items, (x) => x.type);
    assert.equal(result['a'].length, 2);
    assert.equal(result['b'].length, 1);
  });
});

// ─── sortBy ───────────────────────────────────────────────────────────────────

describe('sortBy', () => {
  it('sorts by a single key', () => {
    const items = [{ name: 'charlie' }, { name: 'alice' }, { name: 'bob' }];
    const sorted = sortBy(items, 'name');
    assert.deepEqual(sorted.map((x) => x.name), ['alice', 'bob', 'charlie']);
  });

  it('sorts by a key function', () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const sorted = sortBy(items, (x) => x.n);
    assert.deepEqual(sorted.map((x) => x.n), [1, 2, 3]);
  });

  it('sorts by multiple keys (secondary sort)', () => {
    const items = [
      { a: 1, b: 3 },
      { a: 2, b: 1 },
      { a: 1, b: 1 },
      { a: 2, b: 2 },
    ];
    const sorted = sortBy(items, 'a', 'b');
    assert.deepEqual(sorted, [
      { a: 1, b: 1 },
      { a: 1, b: 3 },
      { a: 2, b: 1 },
      { a: 2, b: 2 },
    ]);
  });

  it('does not mutate the original array', () => {
    const items = [{ n: 3 }, { n: 1 }];
    sortBy(items, 'n');
    assert.equal(items[0].n, 3);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(sortBy([], 'x'), []);
  });
});

// ─── chunk ────────────────────────────────────────────────────────────────────

describe('chunk', () => {
  it('splits array into chunks of given size', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it('returns single chunk when size equals array length', () => {
    assert.deepEqual(chunk([1, 2, 3], 3), [[1, 2, 3]]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(chunk([], 2), []);
  });

  it('returns empty array for size <= 0', () => {
    assert.deepEqual(chunk([1, 2, 3], 0), []);
    assert.deepEqual(chunk([1, 2, 3], -1), []);
  });

  it('wraps each element when size is 1', () => {
    assert.deepEqual(chunk([1, 2, 3], 1), [[1], [2], [3]]);
  });
});

// ─── zip ──────────────────────────────────────────────────────────────────────

describe('zip', () => {
  it('zips two arrays of equal length', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b', 'c']), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('stops at the length of the shortest array', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b']), [[1, 'a'], [2, 'b']]);
  });

  it('returns empty array when any input is empty', () => {
    assert.deepEqual(zip([], [1, 2, 3]), []);
    assert.deepEqual(zip([1, 2, 3], []), []);
  });

  it('zips three arrays', () => {
    assert.deepEqual(
      zip([1, 2], ['a', 'b'], [true, false]),
      [[1, 'a', true], [2, 'b', false]],
    );
  });

  it('returns empty array when called with no arguments', () => {
    assert.deepEqual(zip(), []);
  });

  it('zips single array', () => {
    assert.deepEqual(zip([1, 2, 3]), [[1], [2], [3]]);
  });
});
