// ─── Unit Tests: dp-utils ─────────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  knapsack01,
  longestIncreasingSubsequence,
  editDistance,
  coinChange,
  rodCutting,
  subsetSum,
  longestPalindromicSubsequence,
} from '../../app/modules/dp-utils.js';

// ─── knapsack01 ───────────────────────────────────────────────────────────────

describe('knapsack01', () => {
  it('solves classic knapsack example', () => {
    const result = knapsack01([2, 3, 4, 5], [3, 4, 5, 6], 5);
    assert.equal(result.maxValue, 7);
    // items [1,0] → weights 3+2=5, values 4+3=7
    assert.deepEqual(result.items, [0, 1]);
  });

  it('returns 0 for zero capacity', () => {
    const result = knapsack01([1, 2], [10, 20], 0);
    assert.equal(result.maxValue, 0);
    assert.deepEqual(result.items, []);
  });

  it('picks nothing when all items too heavy', () => {
    const result = knapsack01([10, 20], [5, 10], 5);
    assert.equal(result.maxValue, 0);
    assert.deepEqual(result.items, []);
  });

  it('picks all items when capacity allows', () => {
    const result = knapsack01([1, 2, 3], [6, 10, 12], 10);
    assert.equal(result.maxValue, 28);
    assert.deepEqual(result.items, [0, 1, 2]);
  });
});

// ─── longestIncreasingSubsequence ─────────────────────────────────────────────

describe('longestIncreasingSubsequence', () => {
  it('finds LIS for standard example', () => {
    const lis = longestIncreasingSubsequence([10, 9, 2, 5, 3, 7, 101, 18]);
    assert.equal(lis.length, 4);
    // Verify strictly increasing
    for (let i = 1; i < lis.length; i++) {
      assert.ok(lis[i] > lis[i - 1]);
    }
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(longestIncreasingSubsequence([]), []);
  });

  it('returns single element for single-element input', () => {
    assert.deepEqual(longestIncreasingSubsequence([42]), [42]);
  });

  it('handles already sorted array', () => {
    const lis = longestIncreasingSubsequence([1, 2, 3, 4, 5]);
    assert.deepEqual(lis, [1, 2, 3, 4, 5]);
  });

  it('handles reverse sorted array', () => {
    const lis = longestIncreasingSubsequence([5, 4, 3, 2, 1]);
    assert.equal(lis.length, 1);
  });
});

// ─── editDistance ─────────────────────────────────────────────────────────────

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(editDistance('abc', 'abc'), 0);
  });

  it('returns length of b for empty a', () => {
    assert.equal(editDistance('', 'hello'), 5);
  });

  it('returns length of a for empty b', () => {
    assert.equal(editDistance('hello', ''), 5);
  });

  it('computes distance for kitten/sitting', () => {
    assert.equal(editDistance('kitten', 'sitting'), 3);
  });

  it('computes distance for single char difference', () => {
    assert.equal(editDistance('cat', 'bat'), 1);
  });
});

// ─── coinChange ──────────────────────────────────────────────────────────────

describe('coinChange', () => {
  it('returns 0 for amount 0', () => {
    assert.equal(coinChange([1, 2, 5], 0), 0);
  });

  it('solves standard example', () => {
    assert.equal(coinChange([1, 2, 5], 11), 3); // 5+5+1
  });

  it('returns -1 when impossible', () => {
    assert.equal(coinChange([2], 3), -1);
  });

  it('returns 1 when exact coin exists', () => {
    assert.equal(coinChange([1, 5, 10, 25], 25), 1);
  });
});

// ─── rodCutting ──────────────────────────────────────────────────────────────

describe('rodCutting', () => {
  it('solves classic rod cutting example', () => {
    const prices = [1, 5, 8, 9, 10, 17, 17, 20];
    const result = rodCutting(prices, 8);
    assert.equal(result.maxProfit, 22); // 2+6 = 8, price 5+17=22
    // Verify cuts sum to rod length
    const totalLen = result.cuts.reduce((a, b) => a + b, 0);
    assert.equal(totalLen, 8);
  });

  it('returns 0 for length 0', () => {
    const result = rodCutting([1, 5], 0);
    assert.equal(result.maxProfit, 0);
    assert.deepEqual(result.cuts, []);
  });

  it('cuts into unit pieces when that is optimal', () => {
    // price 3 for length 1, price 2 for length 2 => best is two length-1 pieces
    const result = rodCutting([3, 2], 2);
    assert.equal(result.maxProfit, 6);
    assert.deepEqual(result.cuts, [1, 1]);
  });
});

// ─── subsetSum ───────────────────────────────────────────────────────────────

describe('subsetSum', () => {
  it('returns true when target is 0', () => {
    assert.equal(subsetSum([1, 2, 3], 0), true);
  });

  it('returns true when subset exists', () => {
    assert.equal(subsetSum([3, 34, 4, 12, 5, 2], 9), true); // 4+5
  });

  it('returns false when no subset sums to target', () => {
    assert.equal(subsetSum([3, 34, 4, 12, 5, 2], 30), false);
  });

  it('handles single element equal to target', () => {
    assert.equal(subsetSum([7], 7), true);
  });

  it('returns false for negative target', () => {
    assert.equal(subsetSum([1, 2, 3], -1), false);
  });
});

// ─── longestPalindromicSubsequence ───────────────────────────────────────────

describe('longestPalindromicSubsequence', () => {
  it('returns the string itself when it is a palindrome', () => {
    assert.equal(longestPalindromicSubsequence('racecar'), 'racecar');
  });

  it('returns empty string for empty input', () => {
    assert.equal(longestPalindromicSubsequence(''), '');
  });

  it('returns single char for single char input', () => {
    assert.equal(longestPalindromicSubsequence('x'), 'x');
  });

  it('finds LPS of "bbbab"', () => {
    const lps = longestPalindromicSubsequence('bbbab');
    assert.equal(lps.length, 4);
    // Verify it is a palindrome
    assert.equal(lps, lps.split('').reverse().join(''));
  });

  it('finds LPS of "character"', () => {
    const lps = longestPalindromicSubsequence('character');
    // Verify it's a palindrome
    assert.equal(lps, lps.split('').reverse().join(''));
    // LPS length should be at least 3 (e.g. "carac" → 5 or "ara" → 3)
    assert.ok(lps.length >= 3);
  });

  it('finds LPS of "abcda"', () => {
    const lps = longestPalindromicSubsequence('abcda');
    assert.equal(lps.length, 3);
    assert.equal(lps, lps.split('').reverse().join(''));
  });
});
