// ─── Unit Tests: stream-pipeline ─────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Stream,
  stream,
  range,
  repeat,
  generate,
} from '../../app/modules/stream-pipeline.js';

// ─── stream() factory ─────────────────────────────────────────────────────────

describe('stream()', () => {
  it('creates a Stream from an array', () => {
    const s = stream([1, 2, 3]);
    assert.ok(s instanceof Stream);
    assert.deepEqual(s.toArray(), [1, 2, 3]);
  });

  it('creates a Stream from a Set', () => {
    const s = stream(new Set([4, 5, 6]));
    assert.deepEqual(s.toArray(), [4, 5, 6]);
  });

  it('creates a Stream from an empty iterable', () => {
    assert.deepEqual(stream([]).toArray(), []);
  });
});

// ─── map ─────────────────────────────────────────────────────────────────────

describe('Stream.map()', () => {
  it('transforms every element', () => {
    assert.deepEqual(stream([1, 2, 3]).map((n) => n * 2).toArray(), [2, 4, 6]);
  });

  it('can change element type', () => {
    assert.deepEqual(stream([1, 2]).map(String).toArray(), ['1', '2']);
  });

  it('is lazy — does not evaluate until terminal', () => {
    let calls = 0;
    const s = stream([1, 2, 3]).map((n) => { calls++; return n; });
    assert.equal(calls, 0);
    s.toArray();
    assert.equal(calls, 3);
  });
});

// ─── filter ──────────────────────────────────────────────────────────────────

describe('Stream.filter()', () => {
  it('keeps only matching elements', () => {
    assert.deepEqual(
      stream([1, 2, 3, 4, 5]).filter((n) => n % 2 === 0).toArray(),
      [2, 4],
    );
  });

  it('returns empty when nothing matches', () => {
    assert.deepEqual(stream([1, 3, 5]).filter((n) => n % 2 === 0).toArray(), []);
  });
});

// ─── flatMap ─────────────────────────────────────────────────────────────────

describe('Stream.flatMap()', () => {
  it('flattens one level', () => {
    assert.deepEqual(
      stream([1, 2, 3]).flatMap((n) => [n, n * 10]).toArray(),
      [1, 10, 2, 20, 3, 30],
    );
  });

  it('works with generator return values', () => {
    function* pairs(n) { yield n; yield -n; }
    assert.deepEqual(stream([1, 2]).flatMap(pairs).toArray(), [1, -1, 2, -2]);
  });

  it('handles empty sub-iterables', () => {
    assert.deepEqual(stream([1, 2, 3]).flatMap(() => []).toArray(), []);
  });
});

// ─── take ─────────────────────────────────────────────────────────────────────

describe('Stream.take()', () => {
  it('takes the first n elements', () => {
    assert.deepEqual(stream([1, 2, 3, 4, 5]).take(3).toArray(), [1, 2, 3]);
  });

  it('returns all elements if n >= length', () => {
    assert.deepEqual(stream([1, 2]).take(10).toArray(), [1, 2]);
  });

  it('returns empty for n = 0', () => {
    assert.deepEqual(stream([1, 2, 3]).take(0).toArray(), []);
  });
});

// ─── skip ─────────────────────────────────────────────────────────────────────

describe('Stream.skip()', () => {
  it('skips the first n elements', () => {
    assert.deepEqual(stream([1, 2, 3, 4, 5]).skip(2).toArray(), [3, 4, 5]);
  });

  it('returns empty when n >= length', () => {
    assert.deepEqual(stream([1, 2]).skip(5).toArray(), []);
  });

  it('returns all elements for n = 0', () => {
    assert.deepEqual(stream([1, 2, 3]).skip(0).toArray(), [1, 2, 3]);
  });
});

// ─── takeWhile ───────────────────────────────────────────────────────────────

describe('Stream.takeWhile()', () => {
  it('takes elements while predicate is true', () => {
    assert.deepEqual(
      stream([1, 2, 3, 4, 1]).takeWhile((n) => n < 4).toArray(),
      [1, 2, 3],
    );
  });

  it('returns empty if first element fails predicate', () => {
    assert.deepEqual(stream([5, 1, 2]).takeWhile((n) => n < 3).toArray(), []);
  });
});

// ─── skipWhile ───────────────────────────────────────────────────────────────

describe('Stream.skipWhile()', () => {
  it('skips elements while predicate is true', () => {
    assert.deepEqual(
      stream([1, 2, 3, 4, 1]).skipWhile((n) => n < 3).toArray(),
      [3, 4, 1],
    );
  });

  it('returns all elements if first element fails predicate', () => {
    assert.deepEqual(stream([5, 1, 2]).skipWhile((n) => n < 3).toArray(), [5, 1, 2]);
  });
});

// ─── distinct ─────────────────────────────────────────────────────────────────

describe('Stream.distinct()', () => {
  it('removes duplicate primitives', () => {
    assert.deepEqual(
      stream([1, 2, 2, 3, 1, 4]).distinct().toArray(),
      [1, 2, 3, 4],
    );
  });

  it('preserves order of first occurrence', () => {
    assert.deepEqual(stream(['b', 'a', 'b', 'c']).distinct().toArray(), ['b', 'a', 'c']);
  });
});

// ─── distinctBy ──────────────────────────────────────────────────────────────

describe('Stream.distinctBy()', () => {
  it('removes elements with duplicate keys', () => {
    const items = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 1, v: 'c' }];
    assert.deepEqual(
      stream(items).distinctBy((x) => x.id).toArray(),
      [{ id: 1, v: 'a' }, { id: 2, v: 'b' }],
    );
  });
});

// ─── sort ─────────────────────────────────────────────────────────────────────

describe('Stream.sort()', () => {
  it('sorts numbers with default comparator', () => {
    assert.deepEqual(stream([3, 1, 2]).sort().toArray(), [1, 2, 3]);
  });

  it('sorts with a custom comparator', () => {
    assert.deepEqual(
      stream([3, 1, 2]).sort((a, b) => b - a).toArray(),
      [3, 2, 1],
    );
  });

  it('does not mutate the original source array', () => {
    const arr = [3, 1, 2];
    stream(arr).sort().toArray();
    assert.deepEqual(arr, [3, 1, 2]);
  });
});

// ─── sortBy ───────────────────────────────────────────────────────────────────

describe('Stream.sortBy()', () => {
  it('sorts objects by a key function', () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    assert.deepEqual(
      stream(items).sortBy((x) => x.n).toArray(),
      [{ n: 1 }, { n: 2 }, { n: 3 }],
    );
  });
});

// ─── reverse ─────────────────────────────────────────────────────────────────

describe('Stream.reverse()', () => {
  it('reverses element order', () => {
    assert.deepEqual(stream([1, 2, 3]).reverse().toArray(), [3, 2, 1]);
  });

  it('returns empty for empty input', () => {
    assert.deepEqual(stream([]).reverse().toArray(), []);
  });
});

// ─── zip ─────────────────────────────────────────────────────────────────────

describe('Stream.zip()', () => {
  it('zips two streams of equal length', () => {
    assert.deepEqual(
      stream([1, 2, 3]).zip(stream(['a', 'b', 'c'])).toArray(),
      [[1, 'a'], [2, 'b'], [3, 'c']],
    );
  });

  it('stops at the shorter stream', () => {
    assert.deepEqual(
      stream([1, 2, 3]).zip([10, 20]).toArray(),
      [[1, 10], [2, 20]],
    );
  });

  it('accepts a plain iterable as the second argument', () => {
    assert.deepEqual(
      stream([1, 2]).zip(new Set(['x', 'y'])).toArray(),
      [[1, 'x'], [2, 'y']],
    );
  });
});

// ─── reduce ──────────────────────────────────────────────────────────────────

describe('Stream.reduce()', () => {
  it('sums numbers', () => {
    assert.equal(stream([1, 2, 3, 4]).reduce((acc, n) => acc + n, 0), 10);
  });

  it('builds a string', () => {
    assert.equal(stream(['a', 'b', 'c']).reduce((acc, s) => acc + s, ''), 'abc');
  });

  it('returns initial value for empty stream', () => {
    assert.equal(stream([]).reduce((acc, n) => acc + n, 99), 99);
  });
});

// ─── forEach ──────────────────────────────────────────────────────────────────

describe('Stream.forEach()', () => {
  it('calls the function for every element', () => {
    const seen = [];
    stream([10, 20, 30]).forEach((n) => seen.push(n));
    assert.deepEqual(seen, [10, 20, 30]);
  });
});

// ─── find ─────────────────────────────────────────────────────────────────────

describe('Stream.find()', () => {
  it('returns the first matching element', () => {
    assert.equal(stream([1, 2, 3, 4]).find((n) => n > 2), 3);
  });

  it('returns undefined when nothing matches', () => {
    assert.equal(stream([1, 2, 3]).find((n) => n > 10), undefined);
  });

  it('returns the first match, not all matches', () => {
    let calls = 0;
    stream([5, 6, 7]).find((n) => { calls++; return n > 4; });
    assert.equal(calls, 1);
  });
});

// ─── some ─────────────────────────────────────────────────────────────────────

describe('Stream.some()', () => {
  it('returns true when any element matches', () => {
    assert.equal(stream([1, 2, 3]).some((n) => n === 2), true);
  });

  it('returns false when no element matches', () => {
    assert.equal(stream([1, 3, 5]).some((n) => n === 2), false);
  });

  it('returns false for empty stream', () => {
    assert.equal(stream([]).some(() => true), false);
  });
});

// ─── every ────────────────────────────────────────────────────────────────────

describe('Stream.every()', () => {
  it('returns true when all elements match', () => {
    assert.equal(stream([2, 4, 6]).every((n) => n % 2 === 0), true);
  });

  it('returns false when any element does not match', () => {
    assert.equal(stream([2, 3, 6]).every((n) => n % 2 === 0), false);
  });

  it('returns true for empty stream (vacuous truth)', () => {
    assert.equal(stream([]).every(() => false), true);
  });
});

// ─── count ────────────────────────────────────────────────────────────────────

describe('Stream.count()', () => {
  it('counts elements', () => {
    assert.equal(stream([1, 2, 3]).count(), 3);
  });

  it('returns 0 for empty stream', () => {
    assert.equal(stream([]).count(), 0);
  });

  it('counts after filter', () => {
    assert.equal(stream([1, 2, 3, 4]).filter((n) => n % 2 === 0).count(), 2);
  });
});

// ─── groupBy ──────────────────────────────────────────────────────────────────

describe('Stream.groupBy()', () => {
  it('groups elements by key', () => {
    const result = stream([1, 2, 3, 4, 5]).groupBy((n) => (n % 2 === 0 ? 'even' : 'odd'));
    assert.deepEqual(result.even, [2, 4]);
    assert.deepEqual(result.odd, [1, 3, 5]);
  });

  it('returns empty object for empty stream', () => {
    assert.deepEqual(stream([]).groupBy((n) => String(n)), {});
  });

  it('handles a single group', () => {
    const result = stream(['a', 'b', 'c']).groupBy(() => 'all');
    assert.deepEqual(result, { all: ['a', 'b', 'c'] });
  });
});

// ─── chaining ────────────────────────────────────────────────────────────────

describe('Stream chaining', () => {
  it('chains map, filter, take', () => {
    assert.deepEqual(
      stream([1, 2, 3, 4, 5, 6])
        .map((n) => n * n)
        .filter((n) => n > 5)
        .take(3)
        .toArray(),
      [9, 16, 25],
    );
  });

  it('chains skip and map', () => {
    assert.deepEqual(
      stream([0, 1, 2, 3, 4]).skip(2).map((n) => n * 10).toArray(),
      [20, 30, 40],
    );
  });
});

// ─── range ────────────────────────────────────────────────────────────────────

describe('range()', () => {
  it('generates integers from start to end (exclusive)', () => {
    assert.deepEqual(range(0, 5).toArray(), [0, 1, 2, 3, 4]);
  });

  it('respects a custom step', () => {
    assert.deepEqual(range(0, 10, 2).toArray(), [0, 2, 4, 6, 8]);
  });

  it('returns empty when start >= end with positive step', () => {
    assert.deepEqual(range(5, 5).toArray(), []);
    assert.deepEqual(range(6, 5).toArray(), []);
  });

  it('descends when step is negative', () => {
    assert.deepEqual(range(5, 0, -1).toArray(), [5, 4, 3, 2, 1]);
  });

  it('can be used with map', () => {
    assert.deepEqual(range(1, 4).map((n) => n * n).toArray(), [1, 4, 9]);
  });
});

// ─── repeat ───────────────────────────────────────────────────────────────────

describe('repeat()', () => {
  it('repeats a value n times', () => {
    assert.deepEqual(repeat('x', 3).toArray(), ['x', 'x', 'x']);
  });

  it('returns empty for count = 0', () => {
    assert.deepEqual(repeat(1, 0).toArray(), []);
  });

  it('works with objects (same reference)', () => {
    const obj = {};
    const arr = repeat(obj, 3).toArray();
    assert.equal(arr.length, 3);
    assert.ok(arr.every((x) => x === obj));
  });
});

// ─── generate ─────────────────────────────────────────────────────────────────

describe('generate()', () => {
  it('produces count values from index-based factory', () => {
    assert.deepEqual(generate((i) => i * i, 4).toArray(), [0, 1, 4, 9]);
  });

  it('returns empty for count = 0', () => {
    assert.deepEqual(generate(() => 42, 0).toArray(), []);
  });

  it('index starts at 0', () => {
    const indices = [];
    generate((i) => { indices.push(i); return i; }, 3).toArray();
    assert.deepEqual(indices, [0, 1, 2]);
  });
});
