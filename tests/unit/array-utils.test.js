// ─── Unit Tests: array-utils ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  chunk,
  flatten,
  flattenDeep,
  unique,
  uniqueBy,
  groupBy,
  partition,
  zip,
  zipWith,
  intersection,
  difference,
  union,
  shuffle,
  sample,
  rotate,
  compact,
  sum,
  range,
} from '../../app/modules/array-utils.js';

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
    assert.deepEqual(chunk([1, 2, 3], -1), []);
  });

  it('wraps each element when size is 1', () => {
    assert.deepEqual(chunk([1, 2, 3], 1), [[1], [2], [3]]);
  });

  it('returns single chunk when size exceeds array length', () => {
    assert.deepEqual(chunk([1, 2], 10), [[1, 2]]);
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

  it('handles empty input', () => {
    assert.deepEqual(flatten([]), []);
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

  it('handles single element', () => {
    assert.deepEqual(unique([42]), [42]);
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
    assert.equal(result.length, 1);
  });
});

// ─── groupBy ──────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups items into a Record by key', () => {
    const items = ['one', 'two', 'three', 'four', 'five'];
    const result = groupBy(items, (s) => String(s.length));
    assert.deepEqual(result['3'], ['one', 'two']);
    assert.deepEqual(result['5'], ['three']);
    assert.deepEqual(result['4'], ['four', 'five']);
  });

  it('returns empty object for empty input', () => {
    const result = groupBy([], (x) => String(x));
    assert.deepEqual(result, {});
  });

  it('handles items all in the same group', () => {
    const result = groupBy([1, 2, 3], () => 'all');
    assert.deepEqual(result, { all: [1, 2, 3] });
  });

  it('handles numeric key values via string coercion', () => {
    const result = groupBy([{ n: 1 }, { n: 2 }, { n: 1 }], (x) => String(x.n));
    assert.equal(result['1'].length, 2);
    assert.equal(result['2'].length, 1);
  });
});

// ─── partition ────────────────────────────────────────────────────────────────

describe('partition', () => {
  it('splits array into matching and non-matching', () => {
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

// ─── zip ──────────────────────────────────────────────────────────────────────

describe('zip', () => {
  it('zips two arrays into pairs', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b', 'c']), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('stops at the shorter array', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b']), [[1, 'a'], [2, 'b']]);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(zip([], [1, 2, 3]), []);
    assert.deepEqual(zip([1, 2, 3], []), []);
  });

  it('returns empty array for two empty inputs', () => {
    assert.deepEqual(zip([], []), []);
  });

  it('handles single-element arrays', () => {
    assert.deepEqual(zip([42], ['x']), [[42, 'x']]);
  });
});

// ─── zipWith ──────────────────────────────────────────────────────────────────

describe('zipWith', () => {
  it('applies fn to each pair', () => {
    assert.deepEqual(zipWith([1, 2, 3], [4, 5, 6], (a, b) => a + b), [5, 7, 9]);
  });

  it('stops at the shorter array', () => {
    assert.deepEqual(zipWith([1, 2, 3], [10, 20], (a, b) => a * b), [10, 40]);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(zipWith([], [1, 2], (a, b) => a + b), []);
  });

  it('can produce strings', () => {
    assert.deepEqual(
      zipWith(['a', 'b'], ['x', 'y'], (a, b) => a + b),
      ['ax', 'by'],
    );
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

  it('returns empty array when first input is empty', () => {
    assert.deepEqual(intersection([], [1, 2, 3]), []);
  });

  it('returns empty array when second input is empty', () => {
    assert.deepEqual(intersection([1, 2, 3], []), []);
  });

  it('handles duplicates in first array (retains all matches)', () => {
    assert.deepEqual(intersection([1, 1, 2], [1, 2]), [1, 1, 2]);
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

// ─── union ────────────────────────────────────────────────────────────────────

describe('union', () => {
  it('combines two arrays and removes duplicates', () => {
    assert.deepEqual(union([1, 2, 3], [2, 3, 4]), [1, 2, 3, 4]);
  });

  it('handles two disjoint arrays', () => {
    assert.deepEqual(union([1, 2], [3, 4]), [1, 2, 3, 4]);
  });

  it('handles empty first array', () => {
    assert.deepEqual(union([], [1, 2, 3]), [1, 2, 3]);
  });

  it('handles empty second array', () => {
    assert.deepEqual(union([1, 2, 3], []), [1, 2, 3]);
  });

  it('handles both arrays empty', () => {
    assert.deepEqual(union([], []), []);
  });

  it('handles identical arrays', () => {
    assert.deepEqual(union([1, 2, 3], [1, 2, 3]), [1, 2, 3]);
  });
});

// ─── shuffle ──────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns array with same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    assert.deepEqual([...result].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  it('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    shuffle(original);
    assert.deepEqual(original, [1, 2, 3, 4, 5]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(shuffle([]), []);
  });

  it('returns single-element array unchanged', () => {
    assert.deepEqual(shuffle([42]), [42]);
  });

  it('is deterministic with a seed', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
    assert.deepEqual(a, b);
  });

  it('produces different results for different seeds', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 1);
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 2);
    assert.notDeepEqual(a, b);
  });
});

// ─── sample ───────────────────────────────────────────────────────────────────

describe('sample', () => {
  it('returns n elements', () => {
    const result = sample([1, 2, 3, 4, 5], 3);
    assert.equal(result.length, 3);
  });

  it('all returned elements come from the original array', () => {
    const original = [10, 20, 30, 40, 50];
    const result = sample(original, 3);
    for (const item of result) {
      assert.ok(original.includes(item));
    }
  });

  it('returns empty array when n is 0', () => {
    assert.deepEqual(sample([1, 2, 3], 0), []);
  });

  it('returns copy of entire array when n >= length', () => {
    const original = [1, 2, 3];
    const result = sample(original, 10);
    assert.equal(result.length, 3);
    assert.deepEqual([...result].sort((a, b) => a - b), [1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(sample([], 3), []);
  });
});

// ─── rotate ───────────────────────────────────────────────────────────────────

describe('rotate', () => {
  it('rotates right by positive n', () => {
    assert.deepEqual(rotate([1, 2, 3, 4, 5], 2), [4, 5, 1, 2, 3]);
  });

  it('rotates left with negative n', () => {
    assert.deepEqual(rotate([1, 2, 3, 4, 5], -2), [3, 4, 5, 1, 2]);
  });

  it('returns same array when n is 0', () => {
    assert.deepEqual(rotate([1, 2, 3], 0), [1, 2, 3]);
  });

  it('handles n larger than array length (wraps around)', () => {
    assert.deepEqual(rotate([1, 2, 3], 3), [1, 2, 3]);
    assert.deepEqual(rotate([1, 2, 3], 4), [3, 1, 2]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(rotate([], 3), []);
  });

  it('handles single-element array', () => {
    assert.deepEqual(rotate([42], 5), [42]);
  });
});

// ─── compact ──────────────────────────────────────────────────────────────────

describe('compact', () => {
  it('removes falsy values', () => {
    assert.deepEqual(compact([1, null, 2, undefined, 3, false, 0, '', 4]), [1, 2, 3, 4]);
  });

  it('returns empty array for all-falsy input', () => {
    assert.deepEqual(compact([null, undefined, false, 0, '']), []);
  });

  it('returns array unchanged when no falsy values', () => {
    assert.deepEqual(compact([1, 2, 3]), [1, 2, 3]);
  });

  it('handles empty array', () => {
    assert.deepEqual(compact([]), []);
  });

  it('preserves truthy non-number values', () => {
    assert.deepEqual(compact(['a', '', 'b', null, 'c']), ['a', 'b', 'c']);
  });
});

// ─── sum ──────────────────────────────────────────────────────────────────────

describe('sum', () => {
  it('sums an array of numbers', () => {
    assert.equal(sum([1, 2, 3, 4, 5]), 15);
  });

  it('returns 0 for empty array', () => {
    assert.equal(sum([]), 0);
  });

  it('handles negative numbers', () => {
    assert.equal(sum([-1, -2, -3]), -6);
  });

  it('handles single element', () => {
    assert.equal(sum([42]), 42);
  });

  it('handles mix of positive and negative', () => {
    assert.equal(sum([10, -5, 3, -2]), 6);
  });

  it('handles floats', () => {
    assert.ok(Math.abs(sum([0.1, 0.2, 0.3]) - 0.6) < 1e-10);
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

  it('returns empty array when start > end with positive step', () => {
    assert.deepEqual(range(5, 3), []);
  });
});
