// ─── Unit Tests: async-iter ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  fromArray,
  mapAsync,
  filterAsync,
  takeAsync,
  collectAsync,
  mergeAsync,
  batchAsync,
  interval,
} from '../../app/modules/async-iter.js';

// ─── fromArray ────────────────────────────────────────────────────────────────

describe('fromArray', () => {
  it('yields all items from the array', async () => {
    const result = await collectAsync(fromArray([1, 2, 3]));
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('yields nothing for an empty array', async () => {
    const result = await collectAsync(fromArray([]));
    assert.deepEqual(result, []);
  });

  it('works with strings', async () => {
    const result = await collectAsync(fromArray(['a', 'b', 'c']));
    assert.deepEqual(result, ['a', 'b', 'c']);
  });

  it('yields items one by one (async generator)', async () => {
    const gen = fromArray([10, 20, 30]);
    assert.deepEqual((await gen.next()).value, 10);
    assert.deepEqual((await gen.next()).value, 20);
    assert.deepEqual((await gen.next()).value, 30);
    assert.equal((await gen.next()).done, true);
  });
});

// ─── mapAsync ─────────────────────────────────────────────────────────────────

describe('mapAsync', () => {
  it('maps a sync function over items', async () => {
    const result = await collectAsync(mapAsync(fromArray([1, 2, 3]), (x) => x * 2));
    assert.deepEqual(result, [2, 4, 6]);
  });

  it('maps an async function over items', async () => {
    const result = await collectAsync(
      mapAsync(fromArray([1, 2, 3]), async (x) => x + 10),
    );
    assert.deepEqual(result, [11, 12, 13]);
  });

  it('returns empty for empty iterable', async () => {
    const result = await collectAsync(mapAsync(fromArray([]), async (x) => x));
    assert.deepEqual(result, []);
  });

  it('maps to a different type', async () => {
    const result = await collectAsync(
      mapAsync(fromArray([1, 2, 3]), async (x) => String(x)),
    );
    assert.deepEqual(result, ['1', '2', '3']);
  });
});

// ─── filterAsync ──────────────────────────────────────────────────────────────

describe('filterAsync', () => {
  it('filters with a sync predicate', async () => {
    const result = await collectAsync(
      filterAsync(fromArray([1, 2, 3, 4, 5]), (x) => x % 2 === 0),
    );
    assert.deepEqual(result, [2, 4]);
  });

  it('filters with an async predicate', async () => {
    const result = await collectAsync(
      filterAsync(fromArray([1, 2, 3, 4, 5]), async (x) => x > 3),
    );
    assert.deepEqual(result, [4, 5]);
  });

  it('returns empty when nothing matches', async () => {
    const result = await collectAsync(
      filterAsync(fromArray([1, 2, 3]), (x) => x > 100),
    );
    assert.deepEqual(result, []);
  });

  it('returns all when everything matches', async () => {
    const result = await collectAsync(
      filterAsync(fromArray([1, 2, 3]), () => true),
    );
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('returns empty for empty iterable', async () => {
    const result = await collectAsync(filterAsync(fromArray([]), () => true));
    assert.deepEqual(result, []);
  });
});

// ─── takeAsync ────────────────────────────────────────────────────────────────

describe('takeAsync', () => {
  it('takes the first n items', async () => {
    const result = await collectAsync(takeAsync(fromArray([1, 2, 3, 4, 5]), 3));
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('returns all items when n >= length', async () => {
    const result = await collectAsync(takeAsync(fromArray([1, 2, 3]), 10));
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('returns empty for n = 0', async () => {
    const result = await collectAsync(takeAsync(fromArray([1, 2, 3]), 0));
    assert.deepEqual(result, []);
  });

  it('returns empty for n < 0', async () => {
    const result = await collectAsync(takeAsync(fromArray([1, 2, 3]), -1));
    assert.deepEqual(result, []);
  });

  it('returns empty for empty iterable', async () => {
    const result = await collectAsync(takeAsync(fromArray([]), 5));
    assert.deepEqual(result, []);
  });

  it('takes exactly 1 item', async () => {
    const result = await collectAsync(takeAsync(fromArray([42, 99, 100]), 1));
    assert.deepEqual(result, [42]);
  });
});

// ─── collectAsync ─────────────────────────────────────────────────────────────

describe('collectAsync', () => {
  it('collects all items into an array', async () => {
    const result = await collectAsync(fromArray([10, 20, 30]));
    assert.deepEqual(result, [10, 20, 30]);
  });

  it('returns empty array for empty iterable', async () => {
    const result = await collectAsync(fromArray([]));
    assert.deepEqual(result, []);
  });

  it('works with a pipeline of operators', async () => {
    const pipeline = filterAsync(
      mapAsync(fromArray([1, 2, 3, 4, 5]), async (x) => x * 3),
      (x) => x > 6,
    );
    const result = await collectAsync(pipeline);
    assert.deepEqual(result, [9, 12, 15]);
  });
});

// ─── batchAsync ───────────────────────────────────────────────────────────────

describe('batchAsync', () => {
  it('batches items into chunks of the given size', async () => {
    const result = await collectAsync(batchAsync(fromArray([1, 2, 3, 4, 5]), 2));
    assert.deepEqual(result, [[1, 2], [3, 4], [5]]);
  });

  it('produces one batch when size >= length', async () => {
    const result = await collectAsync(batchAsync(fromArray([1, 2, 3]), 10));
    assert.deepEqual(result, [[1, 2, 3]]);
  });

  it('returns empty for empty iterable', async () => {
    const result = await collectAsync(batchAsync(fromArray([]), 3));
    assert.deepEqual(result, []);
  });

  it('returns empty for size <= 0', async () => {
    const result = await collectAsync(batchAsync(fromArray([1, 2, 3]), 0));
    assert.deepEqual(result, []);
  });

  it('produces single-item batches for size 1', async () => {
    const result = await collectAsync(batchAsync(fromArray([1, 2, 3]), 1));
    assert.deepEqual(result, [[1], [2], [3]]);
  });

  it('handles exactly even division', async () => {
    const result = await collectAsync(batchAsync(fromArray([1, 2, 3, 4]), 2));
    assert.deepEqual(result, [[1, 2], [3, 4]]);
  });
});

// ─── mergeAsync ───────────────────────────────────────────────────────────────

describe('mergeAsync', () => {
  it('merges multiple iterables into one', async () => {
    const result = await collectAsync(
      mergeAsync(fromArray([1, 2]), fromArray([3, 4]), fromArray([5])),
    );
    // All values should be present (order may vary between iterables)
    assert.equal(result.length, 5);
    assert.deepEqual([...result].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  it('returns empty for no iterables', async () => {
    const result = await collectAsync(mergeAsync());
    assert.deepEqual(result, []);
  });

  it('works with a single iterable', async () => {
    const result = await collectAsync(mergeAsync(fromArray([7, 8, 9])));
    assert.deepEqual(result, [7, 8, 9]);
  });

  it('handles empty iterables', async () => {
    const result = await collectAsync(
      mergeAsync(fromArray([]), fromArray([1, 2]), fromArray([])),
    );
    assert.deepEqual([...result].sort((a, b) => a - b), [1, 2]);
  });
});

// ─── interval ─────────────────────────────────────────────────────────────────

describe('interval', () => {
  it('emits count values when count is provided', async () => {
    const result = await collectAsync(interval(5, 3));
    assert.deepEqual(result, [0, 1, 2]);
  });

  it('emits values starting from 0', async () => {
    const result = await collectAsync(interval(5, 4));
    assert.equal(result[0], 0);
    assert.equal(result[3], 3);
  });

  it('emits 0 values for count = 0', async () => {
    const result = await collectAsync(interval(5, 0));
    assert.deepEqual(result, []);
  });

  it('emits 1 value for count = 1', async () => {
    const result = await collectAsync(interval(5, 1));
    assert.deepEqual(result, [0]);
  });

  it('takes first n values from unlimited interval via takeAsync', async () => {
    const result = await collectAsync(takeAsync(interval(5), 3));
    assert.deepEqual(result, [0, 1, 2]);
  });

  it('values are emitted with at least the specified delay', async () => {
    const ms = 15;
    const count = 3;
    const start = Date.now();
    await collectAsync(interval(ms, count));
    const elapsed = Date.now() - start;
    // 3 intervals of ~15ms = ~45ms minimum
    assert.ok(elapsed >= ms * count * 0.8, `elapsed ${elapsed}ms too short`);
  });
});
