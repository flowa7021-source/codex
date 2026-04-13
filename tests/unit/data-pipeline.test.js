// ─── Unit Tests: data-pipeline ────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Pipeline, pipeline } from '../../app/modules/data-pipeline.js';

// ─── pipeline() factory ───────────────────────────────────────────────────────

describe('pipeline() factory', () => {
  it('creates a Pipeline instance', () => {
    const p = pipeline([1, 2, 3]);
    assert.ok(p instanceof Pipeline);
  });

  it('round-trips an empty array', () => {
    assert.deepEqual(pipeline([]).toArray(), []);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    pipeline(arr).map((x) => x * 2);
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

// ─── map ─────────────────────────────────────────────────────────────────────

describe('Pipeline#map', () => {
  it('transforms each element', () => {
    assert.deepEqual(pipeline([1, 2, 3]).map((x) => x * 2).toArray(), [2, 4, 6]);
  });

  it('exposes the index to the callback', () => {
    const indices = [];
    pipeline(['a', 'b', 'c']).map((_, i) => { indices.push(i); return i; }).toArray();
    assert.deepEqual(indices, [0, 1, 2]);
  });

  it('can change element type', () => {
    const result = pipeline([1, 2, 3]).map((x) => String(x)).toArray();
    assert.deepEqual(result, ['1', '2', '3']);
  });

  it('returns empty pipeline for empty input', () => {
    assert.deepEqual(pipeline([]).map((x) => x).toArray(), []);
  });
});

// ─── filter ───────────────────────────────────────────────────────────────────

describe('Pipeline#filter', () => {
  it('keeps only elements that pass the predicate', () => {
    assert.deepEqual(
      pipeline([1, 2, 3, 4, 5]).filter((x) => x % 2 === 0).toArray(),
      [2, 4],
    );
  });

  it('exposes the index to the callback', () => {
    const result = pipeline(['a', 'b', 'c']).filter((_, i) => i > 0).toArray();
    assert.deepEqual(result, ['b', 'c']);
  });

  it('returns empty pipeline when no elements match', () => {
    assert.deepEqual(pipeline([1, 3, 5]).filter((x) => x % 2 === 0).toArray(), []);
  });

  it('returns all elements when all match', () => {
    assert.deepEqual(pipeline([2, 4, 6]).filter((x) => x % 2 === 0).toArray(), [2, 4, 6]);
  });
});

// ─── reduce ───────────────────────────────────────────────────────────────────

describe('Pipeline#reduce', () => {
  it('sums numbers', () => {
    assert.equal(pipeline([1, 2, 3, 4]).reduce((acc, x) => acc + x, 0), 10);
  });

  it('builds a string from elements', () => {
    assert.equal(
      pipeline(['a', 'b', 'c']).reduce((acc, x) => acc + x, ''),
      'abc',
    );
  });

  it('returns initial value for empty pipeline', () => {
    assert.equal(pipeline([]).reduce((acc, x) => acc + x, 42), 42);
  });

  it('exposes the index to the callback', () => {
    const indices = [];
    pipeline([10, 20, 30]).reduce((acc, _, i) => { indices.push(i); return acc; }, 0);
    assert.deepEqual(indices, [0, 1, 2]);
  });
});

// ─── groupBy ─────────────────────────────────────────────────────────────────

describe('Pipeline#groupBy', () => {
  it('groups numbers by even/odd', () => {
    const result = pipeline([1, 2, 3, 4, 5]).groupBy((x) => (x % 2 === 0 ? 'even' : 'odd'));
    assert.deepEqual(result.even, [2, 4]);
    assert.deepEqual(result.odd, [1, 3, 5]);
  });

  it('returns empty object for empty pipeline', () => {
    assert.deepEqual(pipeline([]).groupBy((x) => String(x)), {});
  });

  it('groups strings by first character', () => {
    const result = pipeline(['apple', 'banana', 'avocado']).groupBy((s) => s[0]);
    assert.deepEqual(result.a, ['apple', 'avocado']);
    assert.deepEqual(result.b, ['banana']);
  });
});

// ─── sortBy ──────────────────────────────────────────────────────────────────

describe('Pipeline#sortBy', () => {
  it('sorts numbers ascending', () => {
    assert.deepEqual(
      pipeline([3, 1, 4, 1, 5]).sortBy((a, b) => a - b).toArray(),
      [1, 1, 3, 4, 5],
    );
  });

  it('sorts strings alphabetically', () => {
    assert.deepEqual(
      pipeline(['banana', 'apple', 'cherry']).sortBy((a, b) => a.localeCompare(b)).toArray(),
      ['apple', 'banana', 'cherry'],
    );
  });

  it('does not mutate the original pipeline data', () => {
    const p = pipeline([3, 1, 2]);
    p.sortBy((a, b) => a - b);
    assert.deepEqual(p.toArray(), [3, 1, 2]);
  });
});

// ─── take ────────────────────────────────────────────────────────────────────

describe('Pipeline#take', () => {
  it('returns the first n elements', () => {
    assert.deepEqual(pipeline([1, 2, 3, 4, 5]).take(3).toArray(), [1, 2, 3]);
  });

  it('returns all elements when n >= length', () => {
    assert.deepEqual(pipeline([1, 2]).take(10).toArray(), [1, 2]);
  });

  it('returns empty pipeline when n is 0', () => {
    assert.deepEqual(pipeline([1, 2, 3]).take(0).toArray(), []);
  });
});

// ─── skip ────────────────────────────────────────────────────────────────────

describe('Pipeline#skip', () => {
  it('skips the first n elements', () => {
    assert.deepEqual(pipeline([1, 2, 3, 4, 5]).skip(2).toArray(), [3, 4, 5]);
  });

  it('returns empty pipeline when n >= length', () => {
    assert.deepEqual(pipeline([1, 2]).skip(10).toArray(), []);
  });

  it('returns all elements when n is 0', () => {
    assert.deepEqual(pipeline([1, 2, 3]).skip(0).toArray(), [1, 2, 3]);
  });
});

// ─── unique ──────────────────────────────────────────────────────────────────

describe('Pipeline#unique', () => {
  it('removes duplicate primitives', () => {
    assert.deepEqual(pipeline([1, 2, 2, 3, 1]).unique().toArray(), [1, 2, 3]);
  });

  it('uses key function to determine uniqueness', () => {
    const result = pipeline([
      { id: 1, v: 'a' },
      { id: 2, v: 'b' },
      { id: 1, v: 'c' },
    ])
      .unique((x) => x.id)
      .toArray();
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 1);
    assert.equal(result[1].id, 2);
  });

  it('returns empty pipeline for empty input', () => {
    assert.deepEqual(pipeline([]).unique().toArray(), []);
  });

  it('keeps first occurrence when duplicates exist', () => {
    const result = pipeline([3, 1, 2, 1, 3]).unique().toArray();
    assert.deepEqual(result, [3, 1, 2]);
  });
});

// ─── flatMap ─────────────────────────────────────────────────────────────────

describe('Pipeline#flatMap', () => {
  it('maps and flattens one level', () => {
    assert.deepEqual(
      pipeline([1, 2, 3]).flatMap((x) => [x, x * 10]).toArray(),
      [1, 10, 2, 20, 3, 30],
    );
  });

  it('returns empty pipeline for empty input', () => {
    assert.deepEqual(pipeline([]).flatMap((x) => [x]).toArray(), []);
  });

  it('can expand strings to characters', () => {
    assert.deepEqual(
      pipeline(['ab', 'cd']).flatMap((s) => s.split('')).toArray(),
      ['a', 'b', 'c', 'd'],
    );
  });
});

// ─── count / first / last ─────────────────────────────────────────────────────

describe('Pipeline#count', () => {
  it('returns the number of elements', () => {
    assert.equal(pipeline([1, 2, 3]).count(), 3);
  });

  it('returns 0 for empty pipeline', () => {
    assert.equal(pipeline([]).count(), 0);
  });
});

describe('Pipeline#first', () => {
  it('returns the first element', () => {
    assert.equal(pipeline([10, 20, 30]).first(), 10);
  });

  it('returns undefined for empty pipeline', () => {
    assert.equal(pipeline([]).first(), undefined);
  });
});

describe('Pipeline#last', () => {
  it('returns the last element', () => {
    assert.equal(pipeline([10, 20, 30]).last(), 30);
  });

  it('returns undefined for empty pipeline', () => {
    assert.equal(pipeline([]).last(), undefined);
  });
});

// ─── Chaining ────────────────────────────────────────────────────────────────

describe('Pipeline – chaining multiple operations', () => {
  it('filter → map → take', () => {
    const result = pipeline([1, 2, 3, 4, 5, 6])
      .filter((x) => x % 2 === 0)
      .map((x) => x * x)
      .take(2)
      .toArray();
    assert.deepEqual(result, [4, 16]);
  });

  it('skip → filter → reduce', () => {
    const sum = pipeline([1, 2, 3, 4, 5])
      .skip(2)
      .filter((x) => x % 2 !== 0)
      .reduce((acc, x) => acc + x, 0);
    assert.equal(sum, 8); // 3 + 5
  });

  it('flatMap → unique → sortBy', () => {
    const result = pipeline([[3, 1], [2, 1], [3, 4]])
      .flatMap((arr) => arr)
      .unique()
      .sortBy((a, b) => a - b)
      .toArray();
    assert.deepEqual(result, [1, 2, 3, 4]);
  });

  it('map → groupBy', () => {
    const result = pipeline([1, 2, 3, 4, 5, 6])
      .map((x) => ({ n: x, type: x % 2 === 0 ? 'even' : 'odd' }))
      .groupBy((x) => x.type);
    assert.equal(result.even.length, 3);
    assert.equal(result.odd.length, 3);
  });
});
