// ─── Unit Tests: array-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  unique,
  uniqueBy,
  flatten,
  flattenDeep,
  groupBy,
  chunk,
  zip,
  difference,
  intersection,
  rotate,
  partition,
  sortBy,
  last,
  range,
} from '../../app/modules/array-utils.js';

// ─── unique ───────────────────────────────────────────────────────────────────

describe('unique', () => {
  it('removes duplicate numbers', () => {
    assert.deepEqual(unique([1, 2, 2, 3, 3, 3]), [1, 2, 3]);
  });

  it('removes duplicate strings', () => {
    assert.deepEqual(unique(['a', 'b', 'a', 'c']), ['a', 'b', 'c']);
  });

  it('returns empty array unchanged', () => {
    assert.deepEqual(unique([]), []);
  });

  it('returns array with no duplicates unchanged', () => {
    assert.deepEqual(unique([1, 2, 3]), [1, 2, 3]);
  });
});

// ─── uniqueBy ─────────────────────────────────────────────────────────────────

describe('uniqueBy', () => {
  it('deduplicates by a key function', () => {
    const items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }];
    const result = uniqueBy(items, (x) => x.id);
    assert.deepEqual(result, [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
  });

  it('returns all items when all keys are unique', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    assert.deepEqual(uniqueBy(items, (x) => x.id), items);
  });

  it('returns empty array when input is empty', () => {
    assert.deepEqual(uniqueBy([], (x) => x), []);
  });

  it('keeps the first occurrence when duplicates exist', () => {
    const items = [{ v: 'first', k: 1 }, { v: 'second', k: 1 }];
    const result = uniqueBy(items, (x) => x.k);
    assert.equal(result[0].v, 'first');
  });
});

// ─── flatten ──────────────────────────────────────────────────────────────────

describe('flatten', () => {
  it('flattens one level deep', () => {
    assert.deepEqual(flatten([[1, 2], [3, 4], [5]]), [1, 2, 3, 4, 5]);
  });

  it('does not flatten nested arrays beyond one level', () => {
    assert.deepEqual(flatten([[1, [2, 3]], [4]]), [1, [2, 3], 4]);
  });

  it('handles empty arrays', () => {
    assert.deepEqual(flatten([[], [], []]), []);
  });

  it('handles mix of items and arrays', () => {
    assert.deepEqual(flatten([1, [2, 3], 4]), [1, 2, 3, 4]);
  });
});

// ─── flattenDeep ──────────────────────────────────────────────────────────────

describe('flattenDeep', () => {
  it('flattens deeply nested arrays', () => {
    assert.deepEqual(flattenDeep([1, [2, [3, [4, [5]]]]]), [1, 2, 3, 4, 5]);
  });

  it('handles already-flat array', () => {
    assert.deepEqual(flattenDeep([1, 2, 3]), [1, 2, 3]);
  });

  it('handles empty array', () => {
    assert.deepEqual(flattenDeep([]), []);
  });

  it('handles mix of scalars and nested arrays', () => {
    assert.deepEqual(flattenDeep([[1, 2], [3, [4, 5]], 6]), [1, 2, 3, 4, 5, 6]);
  });
});

// ─── groupBy ──────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups items into a Map by key', () => {
    const items = ['one', 'two', 'three', 'four', 'five'];
    const result = groupBy(items, (s) => s.length);
    assert.deepEqual(result.get(3), ['one', 'two']);
    assert.deepEqual(result.get(5), ['three']);
    assert.deepEqual(result.get(4), ['four', 'five']);
  });

  it('returns empty Map for empty input', () => {
    const result = groupBy([], (x) => x);
    assert.equal(result.size, 0);
  });

  it('handles items all in the same group', () => {
    const result = groupBy([1, 2, 3], () => 'all');
    assert.deepEqual(result.get('all'), [1, 2, 3]);
    assert.equal(result.size, 1);
  });
});

// ─── chunk ────────────────────────────────────────────────────────────────────

describe('chunk', () => {
  it('splits array into chunks of size n', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it('returns one chunk when size equals array length', () => {
    assert.deepEqual(chunk([1, 2, 3], 3), [[1, 2, 3]]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(chunk([], 2), []);
  });

  it('returns empty array for size <= 0', () => {
    assert.deepEqual(chunk([1, 2, 3], 0), []);
  });

  it('wraps each element when size is 1', () => {
    assert.deepEqual(chunk([1, 2, 3], 1), [[1], [2], [3]]);
  });
});

// ─── zip ──────────────────────────────────────────────────────────────────────

describe('zip', () => {
  it('zips two arrays together', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b', 'c']), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('zips three arrays', () => {
    assert.deepEqual(zip([1, 2], [3, 4], [5, 6]), [[1, 3, 5], [2, 4, 6]]);
  });

  it('stops at the shortest array', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b']), [[1, 'a'], [2, 'b']]);
  });

  it('returns empty array when no arrays provided', () => {
    assert.deepEqual(zip(), []);
  });

  it('returns empty array when inputs are empty', () => {
    assert.deepEqual(zip([], []), []);
  });
});

// ─── difference ───────────────────────────────────────────────────────────────

describe('difference', () => {
  it('returns elements in a that are not in b', () => {
    assert.deepEqual(difference([1, 2, 3, 4], [2, 4]), [1, 3]);
  });

  it('returns all elements when b is empty', () => {
    assert.deepEqual(difference([1, 2, 3], []), [1, 2, 3]);
  });

  it('returns empty array when all elements are in b', () => {
    assert.deepEqual(difference([1, 2], [1, 2, 3]), []);
  });

  it('returns empty array when a is empty', () => {
    assert.deepEqual(difference([], [1, 2, 3]), []);
  });
});

// ─── intersection ─────────────────────────────────────────────────────────────

describe('intersection', () => {
  it('returns elements common to both arrays', () => {
    assert.deepEqual(intersection([1, 2, 3, 4], [2, 4, 6]), [2, 4]);
  });

  it('returns empty array when no common elements', () => {
    assert.deepEqual(intersection([1, 2], [3, 4]), []);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(intersection([], [1, 2, 3]), []);
    assert.deepEqual(intersection([1, 2, 3], []), []);
  });
});

// ─── rotate ───────────────────────────────────────────────────────────────────

describe('rotate', () => {
  it('rotates left by n positions', () => {
    assert.deepEqual(rotate([1, 2, 3, 4, 5], 2), [3, 4, 5, 1, 2]);
  });

  it('rotates right with negative n', () => {
    assert.deepEqual(rotate([1, 2, 3, 4, 5], -1), [5, 1, 2, 3, 4]);
  });

  it('returns same array when n is 0', () => {
    assert.deepEqual(rotate([1, 2, 3], 0), [1, 2, 3]);
  });

  it('handles n larger than array length', () => {
    assert.deepEqual(rotate([1, 2, 3], 4), [2, 3, 1]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(rotate([], 3), []);
  });
});

// ─── partition ────────────────────────────────────────────────────────────────

describe('partition', () => {
  it('splits array into truthy and falsy based on predicate', () => {
    const [evens, odds] = partition([1, 2, 3, 4, 5, 6], (n) => n % 2 === 0);
    assert.deepEqual(evens, [2, 4, 6]);
    assert.deepEqual(odds, [1, 3, 5]);
  });

  it('returns empty second array when all match', () => {
    const [truthy, falsy] = partition([1, 2, 3], (n) => n > 0);
    assert.deepEqual(truthy, [1, 2, 3]);
    assert.deepEqual(falsy, []);
  });

  it('returns empty first array when none match', () => {
    const [truthy, falsy] = partition([1, 2, 3], (n) => n > 10);
    assert.deepEqual(truthy, []);
    assert.deepEqual(falsy, [1, 2, 3]);
  });

  it('handles empty input', () => {
    const [truthy, falsy] = partition([], () => true);
    assert.deepEqual(truthy, []);
    assert.deepEqual(falsy, []);
  });
});

// ─── sortBy ───────────────────────────────────────────────────────────────────

describe('sortBy', () => {
  it('sorts by a numeric key function', () => {
    const items = [{ v: 3 }, { v: 1 }, { v: 2 }];
    const result = sortBy(items, (x) => x.v);
    assert.deepEqual(result, [{ v: 1 }, { v: 2 }, { v: 3 }]);
  });

  it('sorts by a string key function', () => {
    const items = ['banana', 'apple', 'cherry'];
    assert.deepEqual(sortBy(items, (s) => s), ['apple', 'banana', 'cherry']);
  });

  it('does not mutate the original array', () => {
    const original = [3, 1, 2];
    sortBy(original, (x) => x);
    assert.deepEqual(original, [3, 1, 2]);
  });

  it('handles empty array', () => {
    assert.deepEqual(sortBy([], (x) => x), []);
  });

  it('is stable — preserves order of equal elements', () => {
    const items = [{ k: 1, i: 0 }, { k: 1, i: 1 }, { k: 1, i: 2 }];
    const result = sortBy(items, (x) => x.k);
    assert.deepEqual(result.map((x) => x.i), [0, 1, 2]);
  });
});

// ─── last ─────────────────────────────────────────────────────────────────────

describe('last', () => {
  it('returns the last element when n is not provided', () => {
    assert.equal(last([1, 2, 3]), 3);
  });

  it('returns undefined for empty array without n', () => {
    assert.equal(last([]), undefined);
  });

  it('returns last N elements as array when n is provided', () => {
    assert.deepEqual(last([1, 2, 3, 4, 5], 3), [3, 4, 5]);
  });

  it('returns entire array when n exceeds array length', () => {
    assert.deepEqual(last([1, 2, 3], 10), [1, 2, 3]);
  });

  it('returns empty array when n is 0', () => {
    assert.deepEqual(last([1, 2, 3], 0), []);
  });
});

// ─── range ────────────────────────────────────────────────────────────────────

describe('range', () => {
  it('generates a range from start to end (exclusive)', () => {
    assert.deepEqual(range(0, 5), [0, 1, 2, 3, 4]);
  });

  it('generates range with a custom step', () => {
    assert.deepEqual(range(0, 10, 2), [0, 2, 4, 6, 8]);
  });

  it('returns empty array when start equals end', () => {
    assert.deepEqual(range(5, 5), []);
  });

  it('returns empty array when step is 0', () => {
    assert.deepEqual(range(0, 10, 0), []);
  });

  it('generates descending range with negative step', () => {
    assert.deepEqual(range(5, 0, -1), [5, 4, 3, 2, 1]);
  });

  it('handles non-zero start', () => {
    assert.deepEqual(range(3, 7), [3, 4, 5, 6]);
  });
});
