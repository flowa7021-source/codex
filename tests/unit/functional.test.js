// ─── Unit Tests: Functional Programming Utilities ────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compose,
  pipe,
  curry,
  partial,
  some,
  none,
  isSome,
  isNone,
  fromNullable,
  mapMaybe,
  getOrElse,
  chainMaybe,
  ok,
  err,
  isOk,
  isErr,
  mapResult,
  tryCatch,
  map,
  filter,
  reduce,
  head,
  tail,
  last,
  flatten,
  zip,
  groupBy,
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

  it('is associative: compose(f, compose(g, h)) === compose(compose(f, g), h)', () => {
    const f = (x) => x + 1;
    const g = (x) => x * 2;
    const h = (x) => x - 3;
    const a = compose(f, compose(g, h));
    const b = compose(compose(f, g), h);
    assert.equal(a(10), b(10));
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

  it('works with numerical transformations', () => {
    const negate = (x) => -x;
    const abs = (x) => Math.abs(x);
    assert.equal(pipe(negate, abs)(5), 5);
    assert.equal(pipe(negate, abs)(-5), 5);
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

  it('arity-1 function works as-is', () => {
    const double = curry((x) => x * 2);
    assert.equal(double(7), 14);
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

  it('the returned function accepts additional args beyond the partial ones', () => {
    const add3 = (a, b, c) => a + b + c;
    const addFrom10 = partial(add3, 10);
    assert.equal(addFrom10(1, 2), 13);
  });
});

// ─── some / none / isSome / isNone ───────────────────────────────────────────

describe('some / none / isSome / isNone', () => {
  it('some creates a Some with the value', () => {
    const m = some(42);
    assert.equal(m.type, 'some');
    assert.equal(m.value, 42);
  });

  it('none creates a None', () => {
    const m = none();
    assert.equal(m.type, 'none');
  });

  it('isSome returns true for Some', () => {
    assert.equal(isSome(some(1)), true);
  });

  it('isSome returns false for None', () => {
    assert.equal(isSome(none()), false);
  });

  it('isNone returns true for None', () => {
    assert.equal(isNone(none()), true);
  });

  it('isNone returns false for Some', () => {
    assert.equal(isNone(some(1)), false);
  });

  it('some wraps falsy values correctly', () => {
    assert.equal(isSome(some(0)), true);
    assert.equal(isSome(some('')), true);
    assert.equal(isSome(some(false)), true);
  });
});

// ─── fromNullable ─────────────────────────────────────────────────────────────

describe('fromNullable', () => {
  it('wraps a non-null value in Some', () => {
    const m = fromNullable(42);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 42);
  });

  it('returns None for null', () => {
    assert.equal(isNone(fromNullable(null)), true);
  });

  it('returns None for undefined', () => {
    assert.equal(isNone(fromNullable(undefined)), true);
  });

  it('wraps 0 (falsy but not nullish) as Some', () => {
    const m = fromNullable(0);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 0);
  });

  it('wraps empty string as Some', () => {
    const m = fromNullable('');
    assert.equal(isSome(m), true);
  });
});

// ─── mapMaybe ─────────────────────────────────────────────────────────────────

describe('mapMaybe', () => {
  it('applies fn to the value inside a Some', () => {
    const m = mapMaybe(some(3), (x) => x * 2);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 6);
  });

  it('returns None when given None', () => {
    const m = mapMaybe(none(), (x) => x * 2);
    assert.equal(isNone(m), true);
  });

  it('can change the type of the value', () => {
    const m = mapMaybe(some(42), String);
    assert.equal(isSome(m), true);
    assert.equal(m.value, '42');
  });

  it('is composable: successive mapMaybe calls', () => {
    const m = mapMaybe(mapMaybe(some(2), (x) => x + 1), (x) => x * 10);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 30);
  });
});

// ─── getOrElse ────────────────────────────────────────────────────────────────

describe('getOrElse', () => {
  it('returns the value for a Some', () => {
    assert.equal(getOrElse(some(10), 99), 10);
  });

  it('returns the default for a None', () => {
    assert.equal(getOrElse(none(), 99), 99);
  });

  it('works with string values', () => {
    assert.equal(getOrElse(some('hello'), 'default'), 'hello');
    assert.equal(getOrElse(none(), 'default'), 'default');
  });

  it('returns falsy Some value, not the default', () => {
    assert.equal(getOrElse(some(0), 42), 0);
    assert.equal(getOrElse(some(false), true), false);
  });
});

// ─── chainMaybe ───────────────────────────────────────────────────────────────

describe('chainMaybe', () => {
  it('applies fn to the value inside a Some', () => {
    const safeDiv = (x) => x === 0 ? none() : some(10 / x);
    const m = chainMaybe(some(2), safeDiv);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 5);
  });

  it('returns None when fn returns None', () => {
    const safeDiv = (x) => x === 0 ? none() : some(10 / x);
    const m = chainMaybe(some(0), safeDiv);
    assert.equal(isNone(m), true);
  });

  it('returns None when given None, without calling fn', () => {
    let called = false;
    const fn = (x) => { called = true; return some(x); };
    const m = chainMaybe(none(), fn);
    assert.equal(isNone(m), true);
    assert.equal(called, false);
  });

  it('can chain multiple operations', () => {
    const safeHead = (arr) => arr.length > 0 ? some(arr[0]) : none();
    const result = chainMaybe(some([1, 2, 3]), safeHead);
    assert.equal(isSome(result), true);
    assert.equal(result.value, 1);
  });
});

// ─── ok / err / isOk / isErr ─────────────────────────────────────────────────

describe('ok / err / isOk / isErr', () => {
  it('ok creates an Ok result', () => {
    const r = ok(42);
    assert.equal(r.type, 'ok');
    assert.equal(r.value, 42);
  });

  it('err creates an Err result', () => {
    const e = new Error('oops');
    const r = err(e);
    assert.equal(r.type, 'err');
    assert.equal(r.error, e);
  });

  it('isOk returns true for Ok', () => {
    assert.equal(isOk(ok(1)), true);
  });

  it('isOk returns false for Err', () => {
    assert.equal(isOk(err(new Error())), false);
  });

  it('isErr returns true for Err', () => {
    assert.equal(isErr(err(new Error())), true);
  });

  it('isErr returns false for Ok', () => {
    assert.equal(isErr(ok(1)), false);
  });

  it('ok wraps falsy values correctly', () => {
    assert.equal(isOk(ok(0)), true);
    assert.equal(isOk(ok(false)), true);
    assert.equal(isOk(ok('')), true);
  });
});

// ─── mapResult ────────────────────────────────────────────────────────────────

describe('mapResult', () => {
  it('applies fn to the value inside an Ok', () => {
    const r = mapResult(ok(3), (x) => x * 2);
    assert.equal(isOk(r), true);
    assert.equal(r.value, 6);
  });

  it('propagates Err unchanged without calling fn', () => {
    let called = false;
    const r = mapResult(err(new Error('bad')), (x) => { called = true; return x; });
    assert.equal(isErr(r), true);
    assert.equal(called, false);
  });

  it('can change the type of the value', () => {
    const r = mapResult(ok(42), String);
    assert.equal(isOk(r), true);
    assert.equal(r.value, '42');
  });

  it('is composable', () => {
    const r = mapResult(mapResult(ok(2), (x) => x + 1), (x) => x * 10);
    assert.equal(isOk(r), true);
    assert.equal(r.value, 30);
  });
});

// ─── tryCatch ─────────────────────────────────────────────────────────────────

describe('tryCatch', () => {
  it('returns Ok when fn succeeds', () => {
    const r = tryCatch(() => 42);
    assert.equal(isOk(r), true);
    assert.equal(r.value, 42);
  });

  it('returns Err when fn throws an Error', () => {
    const r = tryCatch(() => { throw new Error('boom'); });
    assert.equal(isErr(r), true);
    assert.ok(r.error instanceof Error);
    assert.equal(r.error.message, 'boom');
  });

  it('wraps non-Error throws in an Error', () => {
    const r = tryCatch(() => { throw 'string error'; });
    assert.equal(isErr(r), true);
    assert.ok(r.error instanceof Error);
  });

  it('works for JSON.parse success', () => {
    const r = tryCatch(() => JSON.parse('{"a":1}'));
    assert.equal(isOk(r), true);
    assert.deepEqual(r.value, { a: 1 });
  });

  it('works for JSON.parse failure', () => {
    const r = tryCatch(() => JSON.parse('not json'));
    assert.equal(isErr(r), true);
    assert.ok(r.error instanceof Error);
  });
});

// ─── map (point-free) ─────────────────────────────────────────────────────────

describe('map', () => {
  it('maps over an array', () => {
    const double = map((x) => x * 2);
    assert.deepEqual(double([1, 2, 3]), [2, 4, 6]);
  });

  it('returns empty array for empty input', () => {
    const double = map((x) => x * 2);
    assert.deepEqual(double([]), []);
  });

  it('can be used in compose pipelines', () => {
    const addOne = map((x) => x + 1);
    const double = map((x) => x * 2);
    const transform = compose(double, addOne);
    assert.deepEqual(transform([1, 2, 3]), [4, 6, 8]);
  });

  it('works with strings', () => {
    const toUpper = map((s) => s.toUpperCase());
    assert.deepEqual(toUpper(['a', 'b', 'c']), ['A', 'B', 'C']);
  });
});

// ─── filter (point-free) ──────────────────────────────────────────────────────

describe('filter', () => {
  it('filters elements matching the predicate', () => {
    const evens = filter((x) => x % 2 === 0);
    assert.deepEqual(evens([1, 2, 3, 4, 5]), [2, 4]);
  });

  it('returns empty array when no elements match', () => {
    const evens = filter((x) => x % 2 === 0);
    assert.deepEqual(evens([1, 3, 5]), []);
  });

  it('returns all elements when all match', () => {
    const positives = filter((x) => x > 0);
    assert.deepEqual(positives([1, 2, 3]), [1, 2, 3]);
  });

  it('returns empty array for empty input', () => {
    const evens = filter((x) => x % 2 === 0);
    assert.deepEqual(evens([]), []);
  });

  it('can be composed with map', () => {
    const evens = filter((x) => x % 2 === 0);
    const double = map((x) => x * 2);
    const transform = compose(double, evens);
    assert.deepEqual(transform([1, 2, 3, 4]), [4, 8]);
  });
});

// ─── reduce (point-free) ──────────────────────────────────────────────────────

describe('reduce', () => {
  it('reduces to a sum', () => {
    const sum = reduce((acc, x) => acc + x, 0);
    assert.equal(sum([1, 2, 3, 4, 5]), 15);
  });

  it('returns initial value for empty array', () => {
    const sum = reduce((acc, x) => acc + x, 0);
    assert.equal(sum([]), 0);
  });

  it('can build a string', () => {
    const join = reduce((acc, x) => acc + x, '');
    assert.equal(join(['a', 'b', 'c']), 'abc');
  });

  it('can collect into an array', () => {
    const toArray = reduce((acc, x) => [...acc, x * 2], []);
    assert.deepEqual(toArray([1, 2, 3]), [2, 4, 6]);
  });
});

// ─── head ─────────────────────────────────────────────────────────────────────

describe('head', () => {
  it('returns Some of the first element', () => {
    const m = head([1, 2, 3]);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 1);
  });

  it('returns None for an empty array', () => {
    assert.equal(isNone(head([])), true);
  });

  it('works for a single-element array', () => {
    const m = head([42]);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 42);
  });

  it('works with string arrays', () => {
    const m = head(['a', 'b', 'c']);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 'a');
  });
});

// ─── tail ─────────────────────────────────────────────────────────────────────

describe('tail', () => {
  it('returns all but the first element', () => {
    assert.deepEqual(tail([1, 2, 3]), [2, 3]);
  });

  it('returns empty array for a single-element array', () => {
    assert.deepEqual(tail([1]), []);
  });

  it('returns empty array for an empty array', () => {
    assert.deepEqual(tail([]), []);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    tail(arr);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── last ─────────────────────────────────────────────────────────────────────

describe('last', () => {
  it('returns Some of the last element', () => {
    const m = last([1, 2, 3]);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 3);
  });

  it('returns None for an empty array', () => {
    assert.equal(isNone(last([])), true);
  });

  it('works for a single-element array', () => {
    const m = last([42]);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 42);
  });

  it('works with string arrays', () => {
    const m = last(['a', 'b', 'c']);
    assert.equal(isSome(m), true);
    assert.equal(m.value, 'c');
  });
});

// ─── flatten ─────────────────────────────────────────────────────────────────

describe('flatten', () => {
  it('flattens one level of nesting', () => {
    assert.deepEqual(flatten([[1, 2], [3, 4], [5]]), [1, 2, 3, 4, 5]);
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(flatten([]), []);
  });

  it('handles empty inner arrays', () => {
    assert.deepEqual(flatten([[], [1, 2], []]), [1, 2]);
  });

  it('handles a single inner array', () => {
    assert.deepEqual(flatten([[1, 2, 3]]), [1, 2, 3]);
  });

  it('does not flatten more than one level', () => {
    assert.deepEqual(flatten([[[1, 2]], [3]]), [[1, 2], 3]);
  });
});

// ─── zip ─────────────────────────────────────────────────────────────────────

describe('zip', () => {
  it('zips two arrays of equal length', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b', 'c']), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('stops at the shorter array', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b']), [[1, 'a'], [2, 'b']]);
    assert.deepEqual(zip([1, 2], ['a', 'b', 'c']), [[1, 'a'], [2, 'b']]);
  });

  it('returns empty array when either input is empty', () => {
    assert.deepEqual(zip([], [1, 2, 3]), []);
    assert.deepEqual(zip([1, 2, 3], []), []);
  });

  it('returns empty array for two empty arrays', () => {
    assert.deepEqual(zip([], []), []);
  });

  it('produces pairs of numbers and strings', () => {
    const result = zip([1, 2], ['one', 'two']);
    assert.deepEqual(result[0], [1, 'one']);
    assert.deepEqual(result[1], [2, 'two']);
  });
});

// ─── groupBy ─────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups elements by key function result', () => {
    const byParity = groupBy((x) => x % 2 === 0 ? 'even' : 'odd');
    const result = byParity([1, 2, 3, 4, 5]);
    assert.deepEqual(result, { odd: [1, 3, 5], even: [2, 4] });
  });

  it('returns empty object for empty array', () => {
    const byFirst = groupBy((s) => s[0]);
    assert.deepEqual(byFirst([]), {});
  });

  it('works with string grouping key', () => {
    const byFirst = groupBy((s) => s[0]);
    const words = ['apple', 'banana', 'avocado', 'blueberry'];
    const result = byFirst(words);
    assert.deepEqual(result, { a: ['apple', 'avocado'], b: ['banana', 'blueberry'] });
  });

  it('handles all elements in the same group', () => {
    const all = groupBy(() => 'all');
    assert.deepEqual(all([1, 2, 3]), { all: [1, 2, 3] });
  });

  it('is curried: returns a function that takes an array', () => {
    const byLength = groupBy((s) => String(s.length));
    const fn = byLength;
    assert.equal(typeof fn, 'function');
    const result = fn(['a', 'bb', 'c', 'dd']);
    assert.deepEqual(result, { '1': ['a', 'c'], '2': ['bb', 'dd'] });
  });
});
