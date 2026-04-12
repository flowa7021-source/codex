// ─── Unit Tests: Lazy Stream ──────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Stream } from '../../app/modules/stream.js';

// ─── Stream.from ─────────────────────────────────────────────────────────────

describe('Stream.from', () => {
  it('wraps an array', () => {
    assert.deepEqual(Stream.from([1, 2, 3]).toArray(), [1, 2, 3]);
  });

  it('wraps a Set', () => {
    const s = new Set([10, 20, 30]);
    assert.deepEqual(Stream.from(s).toArray(), [10, 20, 30]);
  });

  it('wraps a Map entries iterable', () => {
    const m = new Map([['a', 1], ['b', 2]]);
    assert.deepEqual(Stream.from(m.keys()).toArray(), ['a', 'b']);
  });

  it('wraps an empty iterable', () => {
    assert.deepEqual(Stream.from([]).toArray(), []);
  });

  it('wraps a generator', () => {
    function* gen() { yield 'x'; yield 'y'; }
    assert.deepEqual(Stream.from(gen()).toArray(), ['x', 'y']);
  });
});

// ─── Stream.of ───────────────────────────────────────────────────────────────

describe('Stream.of', () => {
  it('creates a stream from varargs', () => {
    assert.deepEqual(Stream.of(1, 2, 3).toArray(), [1, 2, 3]);
  });

  it('creates a single-element stream', () => {
    assert.deepEqual(Stream.of('only').toArray(), ['only']);
  });

  it('creates an empty stream with no arguments', () => {
    assert.deepEqual(Stream.of().toArray(), []);
  });

  it('works with mixed types when used as Stream<unknown>', () => {
    assert.deepEqual(Stream.of(1, 'two', true).toArray(), [1, 'two', true]);
  });
});

// ─── Stream.range ────────────────────────────────────────────────────────────

describe('Stream.range', () => {
  it('produces [start, end) exclusive of end', () => {
    assert.deepEqual(Stream.range(1, 5).toArray(), [1, 2, 3, 4]);
  });

  it('produces an empty stream when start === end', () => {
    assert.deepEqual(Stream.range(3, 3).toArray(), []);
  });

  it('produces an empty stream when start > end with positive step', () => {
    assert.deepEqual(Stream.range(5, 2).toArray(), []);
  });

  it('respects a custom step', () => {
    assert.deepEqual(Stream.range(0, 10, 2).toArray(), [0, 2, 4, 6, 8]);
  });

  it('counts down with a negative step', () => {
    assert.deepEqual(Stream.range(5, 1, -1).toArray(), [5, 4, 3, 2]);
  });

  it('throws when step is zero', () => {
    assert.throws(() => Stream.range(0, 5, 0), RangeError);
  });

  it('produces a single element when range spans exactly one step', () => {
    assert.deepEqual(Stream.range(7, 8).toArray(), [7]);
  });
});

// ─── Stream.repeat ───────────────────────────────────────────────────────────

describe('Stream.repeat', () => {
  it('repeats a value a fixed number of times', () => {
    assert.deepEqual(Stream.repeat('a', 4).toArray(), ['a', 'a', 'a', 'a']);
  });

  it('produces an empty stream when count is 0', () => {
    assert.deepEqual(Stream.repeat(42, 0).toArray(), []);
  });

  it('infinite repeat is safe when paired with take', () => {
    assert.deepEqual(Stream.repeat(7).take(3).toArray(), [7, 7, 7]);
  });

  it('works with object references (same reference each time)', () => {
    const obj = { x: 1 };
    const arr = Stream.repeat(obj, 3).toArray();
    assert.equal(arr.length, 3);
    assert.equal(arr[0], obj);
    assert.equal(arr[2], obj);
  });
});

// ─── Stream.generate ─────────────────────────────────────────────────────────

describe('Stream.generate', () => {
  it('generates values by calling fn with 0-based index', () => {
    assert.deepEqual(Stream.generate(i => i * i, 4).toArray(), [0, 1, 4, 9]);
  });

  it('generates zero elements when count is 0', () => {
    assert.deepEqual(Stream.generate(() => 99, 0).toArray(), []);
  });

  it('infinite generate is safe when paired with take', () => {
    const result = Stream.generate(i => i + 1).take(5).toArray();
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it('index passed to fn starts at 0', () => {
    const indices = Stream.generate(i => i, 3).toArray();
    assert.deepEqual(indices, [0, 1, 2]);
  });
});

// ─── map & filter ────────────────────────────────────────────────────────────

describe('map and filter', () => {
  it('map transforms each element', () => {
    assert.deepEqual(Stream.of(1, 2, 3).map(x => x * 2).toArray(), [2, 4, 6]);
  });

  it('map receives the index as second argument', () => {
    const pairs = Stream.of('a', 'b', 'c').map((x, i) => `${i}:${x}`).toArray();
    assert.deepEqual(pairs, ['0:a', '1:b', '2:c']);
  });

  it('map on an empty stream returns an empty stream', () => {
    assert.deepEqual(Stream.of().map(x => x).toArray(), []);
  });

  it('filter keeps matching elements', () => {
    assert.deepEqual(
      Stream.range(1, 7).filter(x => x % 2 === 0).toArray(),
      [2, 4, 6],
    );
  });

  it('filter receives the index as second argument', () => {
    // keep elements at even indices
    const r = Stream.of('a', 'b', 'c', 'd').filter((_x, i) => i % 2 === 0).toArray();
    assert.deepEqual(r, ['a', 'c']);
  });

  it('filter with always-false predicate returns empty stream', () => {
    assert.deepEqual(Stream.of(1, 2, 3).filter(() => false).toArray(), []);
  });

  it('map and filter compose correctly', () => {
    // double the evens in [1..6]
    const r = Stream.range(1, 7)
      .filter(x => x % 2 === 0)
      .map(x => x * 2)
      .toArray();
    assert.deepEqual(r, [4, 8, 12]);
  });
});

// ─── take & skip ─────────────────────────────────────────────────────────────

describe('take and skip', () => {
  it('take limits output to n elements', () => {
    assert.deepEqual(Stream.range(0, 100).take(3).toArray(), [0, 1, 2]);
  });

  it('take(0) returns an empty stream', () => {
    assert.deepEqual(Stream.of(1, 2, 3).take(0).toArray(), []);
  });

  it('take more than available returns all elements', () => {
    assert.deepEqual(Stream.of(1, 2).take(10).toArray(), [1, 2]);
  });

  it('skip drops the first n elements', () => {
    assert.deepEqual(Stream.range(0, 5).skip(2).toArray(), [2, 3, 4]);
  });

  it('skip(0) returns the full stream', () => {
    assert.deepEqual(Stream.of(1, 2, 3).skip(0).toArray(), [1, 2, 3]);
  });

  it('skip more than available returns empty stream', () => {
    assert.deepEqual(Stream.of(1, 2).skip(10).toArray(), []);
  });

  it('take and skip compose correctly', () => {
    // elements 3, 4, 5 (skip first 3, take next 3) from [1..10)
    const r = Stream.range(1, 10).skip(2).take(3).toArray();
    assert.deepEqual(r, [3, 4, 5]);
  });
});

// ─── flatMap ─────────────────────────────────────────────────────────────────

describe('flatMap', () => {
  it('maps then flattens one level', () => {
    const r = Stream.of(1, 2, 3).flatMap(x => [x, x * 10]).toArray();
    assert.deepEqual(r, [1, 10, 2, 20, 3, 30]);
  });

  it('works with an empty inner iterable', () => {
    const r = Stream.of(1, 2, 3).flatMap(_x => []).toArray();
    assert.deepEqual(r, []);
  });

  it('flattens strings into characters', () => {
    const r = Stream.of('hi', 'yo').flatMap(s => s.split('')).toArray();
    assert.deepEqual(r, ['h', 'i', 'y', 'o']);
  });

  it('flatMap on empty stream returns empty', () => {
    assert.deepEqual(Stream.of().flatMap(x => [x]).toArray(), []);
  });
});

// ─── takeWhile & skipWhile ───────────────────────────────────────────────────

describe('takeWhile and skipWhile', () => {
  it('takeWhile stops at the first failing element', () => {
    assert.deepEqual(
      Stream.of(1, 2, 3, 4, 1).takeWhile(x => x < 4).toArray(),
      [1, 2, 3],
    );
  });

  it('takeWhile on an always-false predicate returns empty', () => {
    assert.deepEqual(Stream.of(1, 2, 3).takeWhile(() => false).toArray(), []);
  });

  it('takeWhile yields all elements when predicate is always true', () => {
    assert.deepEqual(Stream.of(1, 2, 3).takeWhile(() => true).toArray(), [1, 2, 3]);
  });

  it('skipWhile skips leading matching elements', () => {
    assert.deepEqual(
      Stream.of(1, 2, 3, 4, 1).skipWhile(x => x < 3).toArray(),
      [3, 4, 1],
    );
  });

  it('skipWhile with always-true predicate returns empty', () => {
    assert.deepEqual(Stream.of(1, 2, 3).skipWhile(() => true).toArray(), []);
  });

  it('skipWhile with always-false predicate returns all elements', () => {
    assert.deepEqual(Stream.of(1, 2, 3).skipWhile(() => false).toArray(), [1, 2, 3]);
  });
});

// ─── zip ─────────────────────────────────────────────────────────────────────

describe('zip', () => {
  it('pairs elements from two same-length streams', () => {
    const r = Stream.of(1, 2, 3).zip(['a', 'b', 'c']).toArray();
    assert.deepEqual(r, [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('stops at the shorter iterable (this stream shorter)', () => {
    const r = Stream.of(1, 2).zip([10, 20, 30]).toArray();
    assert.deepEqual(r, [[1, 10], [2, 20]]);
  });

  it('stops at the shorter iterable (other iterable shorter)', () => {
    const r = Stream.of(1, 2, 3).zip([10]).toArray();
    assert.deepEqual(r, [[1, 10]]);
  });

  it('returns empty when this stream is empty', () => {
    assert.deepEqual(Stream.of().zip([1, 2]).toArray(), []);
  });

  it('returns empty when other iterable is empty', () => {
    assert.deepEqual(Stream.of(1, 2).zip([]).toArray(), []);
  });
});

// ─── chunk ───────────────────────────────────────────────────────────────────

describe('chunk', () => {
  it('groups elements into fixed-size arrays', () => {
    assert.deepEqual(
      Stream.range(1, 7).chunk(2).toArray(),
      [[1, 2], [3, 4], [5, 6]],
    );
  });

  it('yields a partial last chunk when not evenly divisible', () => {
    assert.deepEqual(
      Stream.range(1, 6).chunk(2).toArray(),
      [[1, 2], [3, 4], [5]],
    );
  });

  it('chunk size equal to stream length yields one chunk', () => {
    assert.deepEqual(Stream.of(1, 2, 3).chunk(3).toArray(), [[1, 2, 3]]);
  });

  it('chunk size larger than stream yields one chunk', () => {
    assert.deepEqual(Stream.of(1, 2).chunk(10).toArray(), [[1, 2]]);
  });

  it('empty stream yields no chunks', () => {
    assert.deepEqual(Stream.of().chunk(3).toArray(), []);
  });

  it('throws when size is zero', () => {
    assert.throws(() => Stream.of(1).chunk(0), RangeError);
  });
});

// ─── distinct ────────────────────────────────────────────────────────────────

describe('distinct', () => {
  it('removes duplicate primitive values', () => {
    assert.deepEqual(Stream.of(1, 2, 1, 3, 2).distinct().toArray(), [1, 2, 3]);
  });

  it('keeps first occurrence', () => {
    assert.deepEqual(Stream.of('b', 'a', 'b').distinct().toArray(), ['b', 'a']);
  });

  it('empty stream stays empty', () => {
    assert.deepEqual(Stream.of().distinct().toArray(), []);
  });

  it('all unique elements are preserved', () => {
    assert.deepEqual(Stream.of(1, 2, 3).distinct().toArray(), [1, 2, 3]);
  });

  it('uses reference equality for objects', () => {
    const a = { v: 1 };
    const b = { v: 1 };
    // a and b are structurally equal but distinct references
    assert.deepEqual(Stream.of(a, b, a).distinct().toArray(), [a, b]);
  });
});

// ─── flatten ─────────────────────────────────────────────────────────────────

describe('flatten', () => {
  it('flattens one level of nested arrays', () => {
    const r = Stream.of([1, 2], [3, 4], [5]).flatten().toArray();
    assert.deepEqual(r, [1, 2, 3, 4, 5]);
  });

  it('empty inner arrays produce no elements', () => {
    assert.deepEqual(Stream.of([], [], []).flatten().toArray(), []);
  });

  it('flatten of empty stream returns empty stream', () => {
    assert.deepEqual(Stream.of().flatten().toArray(), []);
  });

  it('works with Set elements', () => {
    const r = Stream.of(new Set([1, 2]), new Set([3])).flatten().toArray();
    assert.deepEqual(r, [1, 2, 3]);
  });
});

// ─── Terminal operations ──────────────────────────────────────────────────────

describe('toSet', () => {
  it('collects elements into a Set (deduplicates)', () => {
    const s = Stream.of(1, 2, 1, 3).toSet();
    assert.ok(s instanceof Set);
    assert.deepEqual([...s].sort(), [1, 2, 3]);
  });

  it('empty stream returns empty Set', () => {
    assert.equal(Stream.of().toSet().size, 0);
  });
});

describe('toMap', () => {
  it('builds a Map from key and value functions', () => {
    const m = Stream.of({ id: 1, name: 'a' }, { id: 2, name: 'b' })
      .toMap(x => x.id, x => x.name);
    assert.equal(m.get(1), 'a');
    assert.equal(m.get(2), 'b');
  });

  it('later duplicate key overwrites earlier value', () => {
    const m = Stream.of([1, 'first'], [1, 'last'])
      .toMap(x => x[0], x => x[1]);
    assert.equal(m.get(1), 'last');
  });

  it('empty stream returns empty Map', () => {
    assert.equal(Stream.of().toMap(x => x, x => x).size, 0);
  });
});

describe('reduce', () => {
  it('folds a stream with an initial accumulator', () => {
    const sum = Stream.range(1, 5).reduce((acc, x) => acc + x, 0);
    assert.equal(sum, 10);
  });

  it('returns the initial value for an empty stream', () => {
    assert.equal(Stream.of().reduce((acc, _x) => acc, 42), 42);
  });

  it('builds an array via reduce', () => {
    const arr = Stream.of(1, 2, 3).reduce((acc, x) => { acc.push(x); return acc; }, []);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

describe('forEach', () => {
  it('calls fn for each element in order', () => {
    const seen = [];
    Stream.of('a', 'b', 'c').forEach(x => seen.push(x));
    assert.deepEqual(seen, ['a', 'b', 'c']);
  });

  it('does not call fn for an empty stream', () => {
    let called = false;
    Stream.of().forEach(() => { called = true; });
    assert.equal(called, false);
  });
});

describe('find', () => {
  it('returns the first matching element', () => {
    assert.equal(Stream.of(1, 2, 3, 4).find(x => x > 2), 3);
  });

  it('returns undefined when no element matches', () => {
    assert.equal(Stream.of(1, 2, 3).find(x => x > 10), undefined);
  });

  it('returns undefined for an empty stream', () => {
    assert.equal(Stream.of().find(() => true), undefined);
  });
});

describe('every and some', () => {
  it('every returns true when all elements match', () => {
    assert.equal(Stream.of(2, 4, 6).every(x => x % 2 === 0), true);
  });

  it('every returns false when any element fails', () => {
    assert.equal(Stream.of(2, 3, 6).every(x => x % 2 === 0), false);
  });

  it('every returns true vacuously for an empty stream', () => {
    assert.equal(Stream.of().every(() => false), true);
  });

  it('some returns true when at least one element matches', () => {
    assert.equal(Stream.of(1, 3, 4).some(x => x % 2 === 0), true);
  });

  it('some returns false when no element matches', () => {
    assert.equal(Stream.of(1, 3, 5).some(x => x % 2 === 0), false);
  });

  it('some returns false for an empty stream', () => {
    assert.equal(Stream.of().some(() => true), false);
  });
});

describe('count, first, last', () => {
  it('count returns the number of elements', () => {
    assert.equal(Stream.range(0, 10).count(), 10);
  });

  it('count returns 0 for an empty stream', () => {
    assert.equal(Stream.of().count(), 0);
  });

  it('first returns the first element', () => {
    assert.equal(Stream.of(10, 20, 30).first(), 10);
  });

  it('first returns undefined for an empty stream', () => {
    assert.equal(Stream.of().first(), undefined);
  });

  it('last returns the last element', () => {
    assert.equal(Stream.of(10, 20, 30).last(), 30);
  });

  it('last returns undefined for an empty stream', () => {
    assert.equal(Stream.of().last(), undefined);
  });

  it('last on a single-element stream returns that element', () => {
    assert.equal(Stream.of(42).last(), 42);
  });
});

// ─── Laziness (infinite streams) ─────────────────────────────────────────────

describe('laziness with infinite streams', () => {
  it('take on infinite repeat does not hang', () => {
    const r = Stream.repeat(1).take(5).toArray();
    assert.deepEqual(r, [1, 1, 1, 1, 1]);
  });

  it('take on infinite generate does not hang', () => {
    const r = Stream.generate(i => i * 3).take(4).toArray();
    assert.deepEqual(r, [0, 3, 6, 9]);
  });

  it('map on infinite stream is lazy — take caps evaluation', () => {
    let calls = 0;
    const r = Stream.repeat(0).map(x => { calls++; return x + 1; }).take(3).toArray();
    assert.deepEqual(r, [1, 1, 1]);
    assert.equal(calls, 3);
  });

  it('filter on infinite stream is lazy — take caps evaluation', () => {
    const r = Stream.generate(i => i).filter(x => x % 2 === 0).take(4).toArray();
    assert.deepEqual(r, [0, 2, 4, 6]);
  });

  it('takeWhile stops before end of infinite stream', () => {
    const r = Stream.generate(i => i).takeWhile(x => x < 5).toArray();
    assert.deepEqual(r, [0, 1, 2, 3, 4]);
  });

  it('find on infinite stream terminates when match is found', () => {
    const found = Stream.generate(i => i).find(x => x === 1000);
    assert.equal(found, 1000);
  });
});

// ─── Iterator protocol ────────────────────────────────────────────────────────

describe('iterator protocol', () => {
  it('Stream is iterable with for…of', () => {
    const result = [];
    for (const x of Stream.of(1, 2, 3)) result.push(x);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('spread operator works on a Stream', () => {
    assert.deepEqual([...Stream.range(1, 4)], [1, 2, 3]);
  });

  it('[Symbol.iterator] returns a fresh iterator each call', () => {
    const s = Stream.of(1, 2, 3);
    assert.deepEqual([...s], [1, 2, 3]);
    // A second call to [Symbol.iterator]() on the *same* Stream object
    // re-runs the source generator, so the stream is re-iterable.
    assert.deepEqual([...s], [1, 2, 3]);
  });

  it('Stream can be passed to Stream.from', () => {
    const inner = Stream.of(4, 5, 6);
    assert.deepEqual(Stream.from(inner).toArray(), [4, 5, 6]);
  });

  it('destructuring works on a stream', () => {
    const [a, b, c] = Stream.range(10, 20);
    assert.equal(a, 10);
    assert.equal(b, 11);
    assert.equal(c, 12);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('chaining many transformations on an empty stream returns empty', () => {
    const r = Stream.of()
      .map(x => x)
      .filter(() => true)
      .skip(1)
      .take(5)
      .toArray();
    assert.deepEqual(r, []);
  });

  it('single-element stream through a full pipeline', () => {
    const r = Stream.of(7)
      .map(x => x * 2)
      .filter(x => x > 10)
      .toArray();
    assert.deepEqual(r, [14]);
  });

  it('zip with itself produces pairs of the same elements', () => {
    const arr = [1, 2, 3];
    const r = Stream.from(arr).zip(arr).toArray();
    assert.deepEqual(r, [[1, 1], [2, 2], [3, 3]]);
  });

  it('chunk of size 1 wraps each element individually', () => {
    assert.deepEqual(Stream.of(1, 2, 3).chunk(1).toArray(), [[1], [2], [3]]);
  });

  it('flatMap followed by distinct deduplicates correctly', () => {
    const r = Stream.of([1, 2], [2, 3]).flatMap(x => x).distinct().toArray();
    assert.deepEqual(r, [1, 2, 3]);
  });

  it('skip then take on range slice works correctly', () => {
    // Range [0,10) → skip 3 → take 4 → [3,4,5,6]
    assert.deepEqual(Stream.range(0, 10).skip(3).take(4).toArray(), [3, 4, 5, 6]);
  });
});
