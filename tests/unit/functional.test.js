// ─── Unit Tests: Functional Programming Utilities ────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compose,
  pipe,
  partial,
  curry,
  identity,
  constant,
  flip,
  negate,
  juxt,
  take,
  drop,
  takeWhile,
  dropWhile,
  zip,
  zipWith,
  flatten,
  flatMap,
  groupBy,
  unique,
  uniqueBy,
  chunk,
  intersection,
  difference,
  union,
  pick,
  omit,
  mapValues,
  filterValues,
} from '../../app/modules/functional.js';

// ─── compose ─────────────────────────────────────────────────────────────────

describe('compose', () => {
  it('applies functions right-to-left', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const f = compose(addOne, double); // addOne(double(x))
    assert.equal(f(3), 7);
  });

  it('works with three functions', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const square = (x) => x * x;
    const f = compose(addOne, double, square); // addOne(double(square(x)))
    assert.equal(f(3), 19); // square(3)=9, double=18, addOne=19
  });

  it('single function behaves like that function', () => {
    const double = (x) => x * 2;
    assert.equal(compose(double)(5), 10);
  });

  it('no functions returns identity', () => {
    assert.equal(compose()(42), 42);
  });

  it('works with string transformations', () => {
    const trim = (s) => s.trim();
    const upper = (s) => s.toUpperCase();
    const f = compose(upper, trim);
    assert.equal(f('  hello  '), 'HELLO');
  });
});

// ─── pipe ─────────────────────────────────────────────────────────────────────

describe('pipe', () => {
  it('applies functions left-to-right', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const f = pipe(addOne, double); // double(addOne(x))
    assert.equal(f(3), 8);
  });

  it('works with three functions', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    const square = (x) => x * x;
    const f = pipe(addOne, double, square); // square(double(addOne(x)))
    assert.equal(f(3), 64); // addOne(3)=4, double=8, square=64
  });

  it('single function behaves like that function', () => {
    const triple = (x) => x * 3;
    assert.equal(pipe(triple)(5), 15);
  });

  it('no functions returns identity', () => {
    assert.equal(pipe()('hello'), 'hello');
  });

  it('pipe(f, g) is the reverse of compose(g, f)', () => {
    const addOne = (x) => x + 1;
    const double = (x) => x * 2;
    assert.equal(pipe(addOne, double)(3), compose(double, addOne)(3));
  });
});

// ─── identity ────────────────────────────────────────────────────────────────

describe('identity', () => {
  it('returns numbers unchanged', () => {
    assert.equal(identity(42), 42);
  });

  it('returns strings unchanged', () => {
    assert.equal(identity('hello'), 'hello');
  });

  it('returns the same object reference', () => {
    const obj = { a: 1 };
    assert.equal(identity(obj), obj);
  });

  it('returns null unchanged', () => {
    assert.equal(identity(null), null);
  });

  it('returns undefined unchanged', () => {
    assert.equal(identity(undefined), undefined);
  });
});

// ─── constant ─────────────────────────────────────────────────────────────────

describe('constant', () => {
  it('always returns the fixed value', () => {
    const alwaysFive = constant(5);
    assert.equal(alwaysFive(), 5);
    assert.equal(alwaysFive(), 5);
  });

  it('returns the same object reference each call', () => {
    const obj = { x: 1 };
    const fn = constant(obj);
    assert.equal(fn(), obj);
  });

  it('works with boolean false', () => {
    const alwaysFalse = constant(false);
    assert.equal(alwaysFalse(), false);
  });

  it('works with null', () => {
    const alwaysNull = constant(null);
    assert.equal(alwaysNull(), null);
  });
});

// ─── flip ─────────────────────────────────────────────────────────────────────

describe('flip', () => {
  it('swaps the two arguments of a binary function', () => {
    const sub = (a, b) => a - b;
    const flippedSub = flip(sub);
    assert.equal(flippedSub(3, 10), 7); // 10 - 3
  });

  it('flip(flip(fn)) behaves like the original fn', () => {
    const div = (a, b) => a / b;
    assert.equal(flip(flip(div))(10, 2), div(10, 2));
  });

  it('works with string concatenation', () => {
    const concat = (a, b) => a + b;
    const flippedConcat = flip(concat);
    assert.equal(flippedConcat('world', 'hello'), 'helloworld');
  });

  it('works with array operations', () => {
    const prepend = (item, arr) => [item, ...arr];
    const flipped = flip(prepend);
    assert.deepEqual(flipped([1, 2], 0), [0, 1, 2]);
  });
});

// ─── negate ──────────────────────────────────────────────────────────────────

describe('negate', () => {
  it('inverts a predicate that returns true', () => {
    const isEven = (n) => n % 2 === 0;
    const isOdd = negate(isEven);
    assert.equal(isOdd(3), true);
    assert.equal(isOdd(4), false);
  });

  it('inverts a predicate that always returns false', () => {
    const alwaysFalse = () => false;
    assert.equal(negate(alwaysFalse)(), true);
  });

  it('works with multi-argument predicates', () => {
    const greaterThan = (a, b) => a > b;
    const notGreaterThan = negate(greaterThan);
    assert.equal(notGreaterThan(3, 5), true);
    assert.equal(notGreaterThan(5, 3), false);
  });

  it('can be used with Array.prototype.filter', () => {
    const isNull = (x) => x === null;
    const result = [1, null, 2, null, 3].filter(negate(isNull));
    assert.deepEqual(result, [1, 2, 3]);
  });
});

// ─── juxt ────────────────────────────────────────────────────────────────────

describe('juxt', () => {
  it('applies all functions to the same argument', () => {
    const double = (x) => x * 2;
    const addOne = (x) => x + 1;
    const result = juxt(double, addOne)(5);
    assert.deepEqual(result, [10, 6]);
  });

  it('returns an empty array when no functions given', () => {
    assert.deepEqual(juxt()(42), []);
  });

  it('works with a single function', () => {
    const square = (x) => x * x;
    assert.deepEqual(juxt(square)(4), [16]);
  });

  it('works with string functions', () => {
    const upper = (s) => s.toUpperCase();
    const lower = (s) => s.toLowerCase();
    const len = (s) => s.length;
    const result = juxt(upper, lower, len)('Hello');
    assert.deepEqual(result, ['HELLO', 'hello', 5]);
  });
});

// ─── partial ─────────────────────────────────────────────────────────────────

describe('partial', () => {
  it('fixes leading arguments', () => {
    const multiply = (a, b) => a * b;
    const double = partial(multiply, 2);
    assert.equal(double(5), 10);
  });

  it('works with multiple pre-applied args', () => {
    const clamp = (min, max, val) => Math.min(max, Math.max(min, val));
    const clamp0to100 = partial(clamp, 0, 100);
    assert.equal(clamp0to100(150), 100);
    assert.equal(clamp0to100(-10), 0);
    assert.equal(clamp0to100(50), 50);
  });

  it('accepts no leading args, behaving like a copy of the function', () => {
    const noop = (x) => x;
    const copy = partial(noop);
    assert.equal(copy(99), 99);
  });

  it('works with string operations', () => {
    const prepend = (prefix, str) => prefix + str;
    const addHello = partial(prepend, 'Hello, ');
    assert.equal(addHello('world'), 'Hello, world');
  });
});

// ─── curry ───────────────────────────────────────────────────────────────────

describe('curry', () => {
  it('returns the result when all args provided at once', () => {
    const add = curry((a, b) => a + b);
    assert.equal(add(2, 3), 5);
  });

  it('partially applies when fewer args than arity', () => {
    const add = curry((a, b) => a + b);
    const add5 = add(5);
    assert.equal(add5(3), 8);
  });

  it('supports arity-3 functions, all at once', () => {
    const sum3 = curry((a, b, c) => a + b + c);
    assert.equal(sum3(1, 2, 3), 6);
  });

  it('supports arity-3 functions, one at a time', () => {
    const sum3 = curry((a, b, c) => a + b + c);
    assert.equal(sum3(1)(2)(3), 6);
  });

  it('supports arity-3 functions, mixed groupings', () => {
    const sum3 = curry((a, b, c) => a + b + c);
    assert.equal(sum3(1, 2)(3), 6);
    assert.equal(sum3(1)(2, 3), 6);
  });

  it('curried function can be used as a callback', () => {
    const multiply = curry((a, b) => a * b);
    const triple = multiply(3);
    assert.deepEqual([1, 2, 3, 4].map(triple), [3, 6, 9, 12]);
  });
});

// ─── take ────────────────────────────────────────────────────────────────────

describe('take', () => {
  it('returns first n elements', () => {
    assert.deepEqual(take(3)([1, 2, 3, 4, 5]), [1, 2, 3]);
  });

  it('returns all elements when n >= length', () => {
    assert.deepEqual(take(10)([1, 2, 3]), [1, 2, 3]);
  });

  it('returns empty array when n === 0', () => {
    assert.deepEqual(take(0)([1, 2, 3]), []);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(take(3)([]), []);
  });
});

// ─── drop ────────────────────────────────────────────────────────────────────

describe('drop', () => {
  it('removes first n elements', () => {
    assert.deepEqual(drop(2)([1, 2, 3, 4, 5]), [3, 4, 5]);
  });

  it('returns empty array when n >= length', () => {
    assert.deepEqual(drop(10)([1, 2, 3]), []);
  });

  it('returns all elements when n === 0', () => {
    assert.deepEqual(drop(0)([1, 2, 3]), [1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(drop(3)([]), []);
  });
});

// ─── takeWhile ───────────────────────────────────────────────────────────────

describe('takeWhile', () => {
  it('takes elements while predicate holds', () => {
    assert.deepEqual(takeWhile((x) => x < 4)([1, 2, 3, 4, 5]), [1, 2, 3]);
  });

  it('returns all elements if predicate always holds', () => {
    assert.deepEqual(takeWhile((x) => x < 100)([1, 2, 3]), [1, 2, 3]);
  });

  it('returns empty array if predicate fails immediately', () => {
    assert.deepEqual(takeWhile((x) => x > 10)([1, 2, 3]), []);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(takeWhile(() => true)([]), []);
  });
});

// ─── dropWhile ───────────────────────────────────────────────────────────────

describe('dropWhile', () => {
  it('drops elements while predicate holds', () => {
    assert.deepEqual(dropWhile((x) => x < 3)([1, 2, 3, 4, 5]), [3, 4, 5]);
  });

  it('returns empty array if predicate always holds', () => {
    assert.deepEqual(dropWhile((x) => x < 100)([1, 2, 3]), []);
  });

  it('returns all elements if predicate fails immediately', () => {
    assert.deepEqual(dropWhile((x) => x > 10)([1, 2, 3]), [1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(dropWhile(() => false)([]), []);
  });
});

// ─── zip ─────────────────────────────────────────────────────────────────────

describe('zip', () => {
  it('zips two arrays of equal length', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b', 'c']), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('stops at the shorter array', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b']), [[1, 'a'], [2, 'b']]);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(zip([], [1, 2, 3]), []);
    assert.deepEqual(zip([1, 2, 3], []), []);
  });

  it('returns empty array for two empty arrays', () => {
    assert.deepEqual(zip([], []), []);
  });
});

// ─── zipWith ─────────────────────────────────────────────────────────────────

describe('zipWith', () => {
  it('combines two arrays with a function', () => {
    assert.deepEqual(zipWith((a, b) => a + b, [1, 2, 3], [10, 20, 30]), [11, 22, 33]);
  });

  it('stops at the shorter array', () => {
    assert.deepEqual(zipWith((a, b) => a * b, [1, 2, 3], [10, 20]), [10, 40]);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(zipWith((a, b) => a + b, [], [1, 2]), []);
  });

  it('works with string concatenation', () => {
    assert.deepEqual(zipWith((a, b) => a + b, ['a', 'b'], ['1', '2']), ['a1', 'b2']);
  });
});

// ─── flatten ─────────────────────────────────────────────────────────────────

describe('flatten', () => {
  it('flattens one level of nesting', () => {
    assert.deepEqual(flatten([[1, 2], [3, 4], [5]]), [1, 2, 3, 4, 5]);
  });

  it('handles mix of arrays and scalars', () => {
    assert.deepEqual(flatten([1, [2, 3], 4, [5]]), [1, 2, 3, 4, 5]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(flatten([]), []);
  });

  it('does not flatten deeply (only one level)', () => {
    assert.deepEqual(flatten([[1, [2]], [3]]), [1, [2], 3]);
  });
});

// ─── flatMap ─────────────────────────────────────────────────────────────────

describe('flatMap', () => {
  it('maps and flattens one level', () => {
    assert.deepEqual(flatMap((x) => [x, x * 2], [1, 2, 3]), [1, 2, 2, 4, 3, 6]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(flatMap((x) => [x], []), []);
  });

  it('handles function returning empty arrays', () => {
    assert.deepEqual(flatMap((x) => (x > 2 ? [x] : []), [1, 2, 3, 4]), [3, 4]);
  });

  it('works with string splitting', () => {
    assert.deepEqual(flatMap((s) => s.split(''), ['ab', 'cd']), ['a', 'b', 'c', 'd']);
  });
});

// ─── groupBy ─────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups elements by key function result', () => {
    const result = groupBy((x) => x % 2 === 0 ? 'even' : 'odd', [1, 2, 3, 4, 5]);
    assert.deepEqual(result, { odd: [1, 3, 5], even: [2, 4] });
  });

  it('returns empty object for empty array', () => {
    assert.deepEqual(groupBy((x) => String(x), []), {});
  });

  it('works with string grouping key', () => {
    const words = ['apple', 'banana', 'avocado', 'blueberry'];
    const result = groupBy((s) => s[0], words);
    assert.deepEqual(result, { a: ['apple', 'avocado'], b: ['banana', 'blueberry'] });
  });

  it('handles all elements in the same group', () => {
    const result = groupBy(() => 'all', [1, 2, 3]);
    assert.deepEqual(result, { all: [1, 2, 3] });
  });
});

// ─── unique ──────────────────────────────────────────────────────────────────

describe('unique', () => {
  it('removes duplicate numbers', () => {
    assert.deepEqual(unique([1, 2, 2, 3, 1]), [1, 2, 3]);
  });

  it('removes duplicate strings', () => {
    assert.deepEqual(unique(['a', 'b', 'a', 'c']), ['a', 'b', 'c']);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(unique([]), []);
  });

  it('preserves order of first occurrence', () => {
    assert.deepEqual(unique([3, 1, 2, 1, 3]), [3, 1, 2]);
  });

  it('returns same array when all elements are unique', () => {
    assert.deepEqual(unique([1, 2, 3]), [1, 2, 3]);
  });
});

// ─── uniqueBy ────────────────────────────────────────────────────────────────

describe('uniqueBy', () => {
  it('removes duplicates based on a key function', () => {
    const input = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }];
    const result = uniqueBy((x) => x.id, input);
    assert.deepEqual(result, [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(uniqueBy((x) => x, []), []);
  });

  it('uses strict equality for key comparison', () => {
    const result = uniqueBy((x) => x % 3, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('preserves first occurrence', () => {
    const result = uniqueBy((x) => x.toLowerCase(), ['A', 'b', 'a', 'B']);
    assert.deepEqual(result, ['A', 'b']);
  });
});

// ─── chunk ───────────────────────────────────────────────────────────────────

describe('chunk', () => {
  it('splits array into chunks of specified size', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it('returns single chunk when size >= array length', () => {
    assert.deepEqual(chunk([1, 2, 3], 10), [[1, 2, 3]]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(chunk([], 3), []);
  });

  it('throws for size <= 0', () => {
    assert.throws(() => chunk([1, 2], 0), /size/);
    assert.throws(() => chunk([1, 2], -1), /size/);
  });

  it('returns chunks of exactly size when evenly divisible', () => {
    assert.deepEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  });
});

// ─── intersection ─────────────────────────────────────────────────────────────

describe('intersection', () => {
  it('returns elements in both arrays', () => {
    assert.deepEqual(intersection([1, 2, 3, 4], [2, 4, 6]), [2, 4]);
  });

  it('returns empty array when no common elements', () => {
    assert.deepEqual(intersection([1, 2, 3], [4, 5, 6]), []);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(intersection([], [1, 2, 3]), []);
    assert.deepEqual(intersection([1, 2, 3], []), []);
  });

  it('preserves order from first array', () => {
    assert.deepEqual(intersection([3, 1, 2], [2, 3]), [3, 2]);
  });
});

// ─── difference ───────────────────────────────────────────────────────────────

describe('difference', () => {
  it('returns elements in a but not b', () => {
    assert.deepEqual(difference([1, 2, 3, 4], [2, 4]), [1, 3]);
  });

  it('returns all of a when b is empty', () => {
    assert.deepEqual(difference([1, 2, 3], []), [1, 2, 3]);
  });

  it('returns empty array when a is empty', () => {
    assert.deepEqual(difference([], [1, 2, 3]), []);
  });

  it('returns empty array when all of a is in b', () => {
    assert.deepEqual(difference([1, 2], [1, 2, 3]), []);
  });
});

// ─── union ────────────────────────────────────────────────────────────────────

describe('union', () => {
  it('returns all unique elements from both arrays', () => {
    assert.deepEqual(union([1, 2, 3], [2, 3, 4]), [1, 2, 3, 4]);
  });

  it('returns first array when second is empty', () => {
    assert.deepEqual(union([1, 2, 3], []), [1, 2, 3]);
  });

  it('returns second array when first is empty', () => {
    assert.deepEqual(union([], [1, 2, 3]), [1, 2, 3]);
  });

  it('handles two empty arrays', () => {
    assert.deepEqual(union([], []), []);
  });

  it('removes duplicates within each array too', () => {
    assert.deepEqual(union([1, 1, 2], [2, 3, 3]), [1, 2, 3]);
  });
});

// ─── pick ────────────────────────────────────────────────────────────────────

describe('pick', () => {
  it('returns only the specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(pick(obj, ['a', 'c']), { a: 1, c: 3 });
  });

  it('returns empty object when no keys specified', () => {
    assert.deepEqual(pick({ a: 1, b: 2 }, []), {});
  });

  it('ignores keys that do not exist on the object', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(pick(obj, ['a', 'z']), { a: 1 });
  });

  it('works with a single key', () => {
    const obj = { x: 10, y: 20 };
    assert.deepEqual(pick(obj, ['x']), { x: 10 });
  });
});

// ─── omit ────────────────────────────────────────────────────────────────────

describe('omit', () => {
  it('removes the specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(omit(obj, ['b']), { a: 1, c: 3 });
  });

  it('returns the whole object when no keys specified', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(omit(obj, []), { a: 1, b: 2 });
  });

  it('returns empty object when all keys omitted', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(omit(obj, ['a', 'b']), {});
  });

  it('ignores keys that do not exist on the object', () => {
    const obj = { a: 1, b: 2 };
    assert.deepEqual(omit(obj, ['z']), { a: 1, b: 2 });
  });
});

// ─── mapValues ───────────────────────────────────────────────────────────────

describe('mapValues', () => {
  it('transforms all values', () => {
    assert.deepEqual(mapValues({ a: 1, b: 2, c: 3 }, (v) => v * 2), { a: 2, b: 4, c: 6 });
  });

  it('passes the key to the mapping function', () => {
    const result = mapValues({ x: 1, y: 2 }, (v, k) => `${k}=${v}`);
    assert.deepEqual(result, { x: 'x=1', y: 'y=2' });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(mapValues({}, (v) => v), {});
  });

  it('works with string-to-number transformation', () => {
    assert.deepEqual(mapValues({ a: '1', b: '2' }, Number), { a: 1, b: 2 });
  });
});

// ─── filterValues ─────────────────────────────────────────────────────────────

describe('filterValues', () => {
  it('keeps only entries where predicate returns true', () => {
    assert.deepEqual(filterValues({ a: 1, b: 2, c: 3 }, (v) => v > 1), { b: 2, c: 3 });
  });

  it('returns empty object when no entries match', () => {
    assert.deepEqual(filterValues({ a: 1, b: 2 }, (v) => v > 100), {});
  });

  it('returns all entries when all match', () => {
    assert.deepEqual(filterValues({ a: 1, b: 2 }, (v) => v > 0), { a: 1, b: 2 });
  });

  it('passes the key to the predicate', () => {
    const result = filterValues({ a: 1, b: 2, c: 3 }, (_, k) => k !== 'b');
    assert.deepEqual(result, { a: 1, c: 3 });
  });

  it('returns empty object for empty input', () => {
    assert.deepEqual(filterValues({}, () => true), {});
  });
});
