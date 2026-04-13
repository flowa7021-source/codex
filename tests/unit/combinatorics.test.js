// ─── Unit Tests: Permutation & Combinatorics ─────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  factorial,
  permutations,
  combinations,
  choose,
  nextPermutation,
  shuffle,
  cartesianProduct,
  powerSet,
} from '../../app/modules/combinatorics.js';

// ─── factorial ───────────────────────────────────────────────────────────────

describe('factorial', () => {
  it('factorial(0) === 1 (base case)', () => {
    assert.equal(factorial(0), 1);
  });

  it('factorial(1) === 1', () => {
    assert.equal(factorial(1), 1);
  });

  it('factorial(5) === 120', () => {
    assert.equal(factorial(5), 120);
  });

  it('factorial(10) === 3628800', () => {
    assert.equal(factorial(10), 3628800);
  });

  it('factorial(20) is the maximum allowed value', () => {
    assert.equal(factorial(20), 2432902008176640000);
  });

  it('throws RangeError for n < 0', () => {
    assert.throws(() => factorial(-1), RangeError);
  });

  it('throws RangeError for n > 20', () => {
    assert.throws(() => factorial(21), RangeError);
  });

  it('throws RangeError for non-integer', () => {
    assert.throws(() => factorial(2.5), RangeError);
  });
});

// ─── permutations ────────────────────────────────────────────────────────────

describe('permutations', () => {
  it('returns [] for an empty array', () => {
    assert.deepEqual(permutations([]), []);
  });

  it('returns [[1]] for a single-element array', () => {
    assert.deepEqual(permutations([1]), [[1]]);
  });

  it('permutations([1,2,3]).length === 6  (P(3,3) = 3!)', () => {
    assert.equal(permutations([1, 2, 3]).length, 6);
  });

  it('permutations([1,2,3]) contains all 6 expected arrangements', () => {
    const result = permutations([1, 2, 3]);
    const expected = [
      [1, 2, 3], [1, 3, 2],
      [2, 1, 3], [2, 3, 1],
      [3, 1, 2], [3, 2, 1],
    ];
    assert.equal(result.length, expected.length);
    for (const perm of expected) {
      assert.ok(
        result.some((p) => p.join(',') === perm.join(',')),
        `missing permutation ${perm}`,
      );
    }
  });

  it('permutations([1,2,3], 2).length === 6  (P(3,2) = 6)', () => {
    assert.equal(permutations([1, 2, 3], 2).length, 6);
  });

  it('permutations([1,2,3], 1).length === 3', () => {
    assert.equal(permutations([1, 2, 3], 1).length, 3);
  });

  it('returns [] when r === 0', () => {
    assert.deepEqual(permutations([1, 2, 3], 0), []);
  });

  it('returns [] when r > arr.length', () => {
    assert.deepEqual(permutations([1, 2], 5), []);
  });

  it('works with string elements', () => {
    const result = permutations(['a', 'b']);
    assert.equal(result.length, 2);
  });
});

// ─── combinations ────────────────────────────────────────────────────────────

describe('combinations', () => {
  it('combinations([1,2,3,4], 2).length === 6  (C(4,2) = 6)', () => {
    assert.equal(combinations([1, 2, 3, 4], 2).length, 6);
  });

  it('combinations([1,2,3,4], 2) contains correct subsets', () => {
    const result = combinations([1, 2, 3, 4], 2);
    const expected = [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
    assert.equal(result.length, expected.length);
    for (const combo of expected) {
      assert.ok(
        result.some((c) => c.join(',') === combo.join(',')),
        `missing combination ${combo}`,
      );
    }
  });

  it('combinations(arr, 0) returns [[]] (one empty subset)', () => {
    assert.deepEqual(combinations([1, 2, 3], 0), [[]]);
  });

  it('combinations(arr, arr.length) returns [arr] (one full subset)', () => {
    assert.deepEqual(combinations([1, 2, 3], 3), [[1, 2, 3]]);
  });

  it('returns [] when r > arr.length', () => {
    assert.deepEqual(combinations([1, 2], 5), []);
  });

  it('C(5,2) === 10', () => {
    assert.equal(combinations([1, 2, 3, 4, 5], 2).length, 10);
  });

  it('works with string elements', () => {
    const result = combinations(['a', 'b', 'c'], 2);
    assert.equal(result.length, 3);
  });
});

// ─── choose ──────────────────────────────────────────────────────────────────

describe('choose', () => {
  it('choose(10, 3) === 120', () => {
    assert.equal(choose(10, 3), 120);
  });

  it('choose(n, 0) === 1 for any n', () => {
    assert.equal(choose(0, 0), 1);
    assert.equal(choose(5, 0), 1);
    assert.equal(choose(100, 0), 1);
  });

  it('choose(n, n) === 1', () => {
    assert.equal(choose(7, 7), 1);
  });

  it('choose(n, 1) === n', () => {
    assert.equal(choose(8, 1), 8);
  });

  it('choose(4, 2) === 6', () => {
    assert.equal(choose(4, 2), 6);
  });

  it('choose(52, 5) === 2598960 (poker hands)', () => {
    assert.equal(choose(52, 5), 2598960);
  });

  it('returns 0 when r < 0', () => {
    assert.equal(choose(5, -1), 0);
  });

  it('returns 0 when r > n', () => {
    assert.equal(choose(3, 5), 0);
  });

  it('is symmetric: choose(n, r) === choose(n, n-r)', () => {
    assert.equal(choose(10, 3), choose(10, 7));
  });
});

// ─── nextPermutation ─────────────────────────────────────────────────────────

describe('nextPermutation', () => {
  it('[1,2,3] → [1,3,2]', () => {
    const arr = [1, 2, 3];
    const changed = nextPermutation(arr);
    assert.equal(changed, true);
    assert.deepEqual(arr, [1, 3, 2]);
  });

  it('[1,3,2] → [2,1,3]', () => {
    const arr = [1, 3, 2];
    nextPermutation(arr);
    assert.deepEqual(arr, [2, 1, 3]);
  });

  it('[3,2,1] is the last permutation — returns false and does not mutate', () => {
    const arr = [3, 2, 1];
    const changed = nextPermutation(arr);
    assert.equal(changed, false);
    assert.deepEqual(arr, [3, 2, 1]);
  });

  it('cycling through all 6 permutations of [1,2,3]', () => {
    const arr = [1, 2, 3];
    const seen = [arr.slice()];
    for (let step = 0; step < 5; step++) {
      assert.equal(nextPermutation(arr), true);
      seen.push(arr.slice());
    }
    assert.equal(seen.length, 6);
    assert.equal(nextPermutation(arr), false); // back at last perm [3,2,1]
  });

  it('returns false for a single-element array', () => {
    const arr = [42];
    assert.equal(nextPermutation(arr), false);
  });

  it('returns false for an empty array', () => {
    assert.equal(nextPermutation([]), false);
  });

  it('[1,2] → [2,1] → false', () => {
    const arr = [1, 2];
    assert.equal(nextPermutation(arr), true);
    assert.deepEqual(arr, [2, 1]);
    assert.equal(nextPermutation(arr), false);
  });
});

// ─── shuffle ─────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns an array with the same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    assert.deepEqual([...result].sort((a, b) => a - b), [...original].sort((a, b) => a - b));
  });

  it('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    shuffle(original);
    assert.deepEqual(original, [1, 2, 3, 4, 5]);
  });

  it('returns a new array (not the same reference)', () => {
    const original = [1, 2, 3];
    const result = shuffle(original);
    assert.notEqual(result, original);
  });

  it('produces a deterministic result with a fixed seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const r1 = shuffle(arr, 42);
    const r2 = shuffle(arr, 42);
    assert.deepEqual(r1, r2);
  });

  it('different seeds produce different orderings (with high probability)', () => {
    const arr = Array.from({ length: 10 }, (_, i) => i);
    const r1 = shuffle(arr, 1);
    const r2 = shuffle(arr, 999);
    // It's astronomically unlikely two random shuffles are identical
    assert.notDeepEqual(r1, r2);
  });

  it('seeded shuffle contains all original elements', () => {
    const arr = [10, 20, 30, 40, 50];
    const result = shuffle(arr, 7);
    assert.deepEqual([...result].sort((a, b) => a - b), [...arr].sort((a, b) => a - b));
  });

  it('handles an empty array', () => {
    assert.deepEqual(shuffle([]), []);
  });

  it('handles a single-element array', () => {
    assert.deepEqual(shuffle([99]), [99]);
  });
});

// ─── cartesianProduct ────────────────────────────────────────────────────────

describe('cartesianProduct', () => {
  it('cartesianProduct([1,2],[3,4]) === [[1,3],[1,4],[2,3],[2,4]]', () => {
    const result = cartesianProduct([1, 2], [3, 4]);
    assert.deepEqual(result, [[1, 3], [1, 4], [2, 3], [2, 4]]);
  });

  it('result length equals the product of input lengths', () => {
    const result = cartesianProduct([1, 2], [3, 4], [5, 6]);
    assert.equal(result.length, 2 * 2 * 2); // 8
  });

  it('three arrays produce correct tuples', () => {
    const result = cartesianProduct(['a', 'b'], [1, 2], [true, false]);
    assert.equal(result.length, 8);
    assert.ok(result.some((t) => t[0] === 'a' && t[1] === 1 && t[2] === true));
    assert.ok(result.some((t) => t[0] === 'b' && t[1] === 2 && t[2] === false));
  });

  it('cartesianProduct with one array returns singleton tuples', () => {
    assert.deepEqual(cartesianProduct([1, 2, 3]), [[1], [2], [3]]);
  });

  it('cartesianProduct with no arguments returns [[]]', () => {
    assert.deepEqual(cartesianProduct(), [[]]);
  });

  it('returns [] if any input array is empty', () => {
    const result = cartesianProduct([1, 2], [], [3, 4]);
    assert.deepEqual(result, []);
  });
});

// ─── powerSet ────────────────────────────────────────────────────────────────

describe('powerSet', () => {
  it('powerSet([1,2]).length === 4  (includes empty set)', () => {
    assert.equal(powerSet([1, 2]).length, 4);
  });

  it('powerSet([1,2]) contains the correct subsets', () => {
    const result = powerSet([1, 2]);
    const strings = result.map((s) => s.join(','));
    assert.ok(strings.includes(''), 'missing empty set');
    assert.ok(strings.includes('1'), 'missing {1}');
    assert.ok(strings.includes('2'), 'missing {2}');
    assert.ok(strings.includes('1,2'), 'missing {1,2}');
  });

  it('powerSet([]) returns [[]] (only the empty set)', () => {
    assert.deepEqual(powerSet([]), [[]]);
  });

  it('powerSet([1]) returns [[], [1]]', () => {
    assert.deepEqual(powerSet([1]), [[], [1]]);
  });

  it('powerSet([1,2,3]).length === 8  (2^3)', () => {
    assert.equal(powerSet([1, 2, 3]).length, 8);
  });

  it('powerSet([1,2,3,4]).length === 16  (2^4)', () => {
    assert.equal(powerSet([1, 2, 3, 4]).length, 16);
  });

  it('always includes the empty set as the first element', () => {
    assert.deepEqual(powerSet([5, 6, 7])[0], []);
  });

  it('always includes the full set as the last element', () => {
    const arr = [5, 6, 7];
    const result = powerSet(arr);
    assert.deepEqual(result[result.length - 1], arr);
  });

  it('works with string elements', () => {
    const result = powerSet(['x', 'y']);
    assert.equal(result.length, 4);
  });
});
