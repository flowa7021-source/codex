// ─── Unit Tests: Random Selection ───────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  shuffle,
  shuffleInPlace,
  sample,
  weightedSample,
  weightedSampleMultiple,
  randomPermutation,
} from '../../app/modules/random-selection.js';

// Deterministic RNG that always returns 0.5
const rng05 = () => 0.5;

// Seeded linear congruential generator for reproducible tests
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 0x100000000;
    return s / 0x100000000;
  };
}

// ─── shuffle ────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns a new array with the same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original, rng05);
    assert.notStrictEqual(result, original);
    assert.equal(result.length, original.length);
    assert.deepStrictEqual([...result].sort(), [...original].sort());
  });

  it('does not mutate the original array', () => {
    const original = [10, 20, 30];
    const copy = [...original];
    shuffle(original, seededRng(42));
    assert.deepStrictEqual(original, copy);
  });

  it('handles empty array', () => {
    assert.deepStrictEqual(shuffle([], rng05), []);
  });

  it('handles single-element array', () => {
    assert.deepStrictEqual(shuffle([42], rng05), [42]);
  });

  it('produces deterministic output with fixed rng', () => {
    const a = shuffle([1, 2, 3, 4, 5], seededRng(100));
    const b = shuffle([1, 2, 3, 4, 5], seededRng(100));
    assert.deepStrictEqual(a, b);
  });
});

// ─── shuffleInPlace ─────────────────────────────────────────────────────────

describe('shuffleInPlace', () => {
  it('returns the same array reference', () => {
    const arr = [1, 2, 3];
    const result = shuffleInPlace(arr, rng05);
    assert.strictEqual(result, arr);
  });

  it('contains all original elements', () => {
    const arr = [10, 20, 30, 40, 50];
    shuffleInPlace(arr, seededRng(42));
    assert.deepStrictEqual([...arr].sort((a, b) => a - b), [10, 20, 30, 40, 50]);
  });

  it('actually permutes a non-trivial array with varied rng', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const original = [...arr];
    shuffleInPlace(arr, seededRng(7));
    // With a non-trivial rng the order should change for 8 elements
    const changed = arr.some((v, i) => v !== original[i]);
    assert.ok(changed, 'shuffleInPlace should reorder elements');
  });
});

// ─── sample ─────────────────────────────────────────────────────────────────

describe('sample', () => {
  it('returns k unique items from the array', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = sample(arr, 4, seededRng(42));
    assert.equal(result.length, 4);
    // All items should be from the original array
    for (const v of result) {
      assert.ok(arr.includes(v), `unexpected value ${v}`);
    }
    // No duplicates
    assert.equal(new Set(result).size, 4);
  });

  it('returns empty array when k <= 0', () => {
    assert.deepStrictEqual(sample([1, 2, 3], 0, rng05), []);
    assert.deepStrictEqual(sample([1, 2, 3], -1, rng05), []);
  });

  it('returns at most arr.length items when k > arr.length', () => {
    const result = sample([1, 2], 10, rng05);
    assert.equal(result.length, 2);
  });

  it('does not mutate the original array', () => {
    const arr = [10, 20, 30, 40];
    const copy = [...arr];
    sample(arr, 2, seededRng(42));
    assert.deepStrictEqual(arr, copy);
  });
});

// ─── weightedSample ─────────────────────────────────────────────────────────

describe('weightedSample', () => {
  it('returns a value from the items', () => {
    const items = [
      { value: 'a', weight: 1 },
      { value: 'b', weight: 1 },
      { value: 'c', weight: 1 },
    ];
    const result = weightedSample(items, rng05);
    assert.ok(['a', 'b', 'c'].includes(result));
  });

  it('throws on empty array', () => {
    assert.throws(() => weightedSample([], rng05), /empty/);
  });

  it('heavily-weighted item is selected when rng returns low value', () => {
    const items = [
      { value: 'heavy', weight: 100 },
      { value: 'light', weight: 0.001 },
    ];
    // rng returning 0.0 should always pick the first item
    const result = weightedSample(items, () => 0.0);
    assert.equal(result, 'heavy');
  });

  it('deterministic with fixed rng', () => {
    const items = [
      { value: 1, weight: 5 },
      { value: 2, weight: 3 },
      { value: 3, weight: 2 },
    ];
    const a = weightedSample(items, seededRng(42));
    const b = weightedSample(items, seededRng(42));
    assert.equal(a, b);
  });
});

// ─── weightedSampleMultiple ─────────────────────────────────────────────────

describe('weightedSampleMultiple', () => {
  it('returns k items', () => {
    const items = [
      { value: 'a', weight: 1 },
      { value: 'b', weight: 2 },
    ];
    const result = weightedSampleMultiple(items, 5, seededRng(42));
    assert.equal(result.length, 5);
  });

  it('returns empty array when k <= 0', () => {
    const items = [{ value: 'x', weight: 1 }];
    assert.deepStrictEqual(weightedSampleMultiple(items, 0, rng05), []);
  });

  it('all results come from the input set', () => {
    const items = [
      { value: 10, weight: 3 },
      { value: 20, weight: 7 },
    ];
    const result = weightedSampleMultiple(items, 10, seededRng(55));
    for (const v of result) {
      assert.ok(v === 10 || v === 20, `unexpected value ${v}`);
    }
  });
});

// ─── randomPermutation ──────────────────────────────────────────────────────

describe('randomPermutation', () => {
  it('returns a permutation of 0..n-1', () => {
    const perm = randomPermutation(6, seededRng(42));
    assert.equal(perm.length, 6);
    assert.deepStrictEqual([...perm].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  });

  it('returns empty array for n=0', () => {
    assert.deepStrictEqual(randomPermutation(0, rng05), []);
  });

  it('returns [0] for n=1', () => {
    assert.deepStrictEqual(randomPermutation(1, rng05), [0]);
  });

  it('produces deterministic output with fixed rng', () => {
    const a = randomPermutation(10, seededRng(88));
    const b = randomPermutation(10, seededRng(88));
    assert.deepStrictEqual(a, b);
  });
});
