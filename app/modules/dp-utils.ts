// @ts-check
// ─── Dynamic Programming Utilities ─────────────────────────────────────────
// Common DP problems with full solution recovery.

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * 0/1 Knapsack. Returns the maximum value and the list of chosen item
 * indices (0-based, sorted ascending).
 */
export function knapsack01(
  weights: number[],
  values: number[],
  capacity: number,
): { maxValue: number; items: number[] } {
  const n = weights.length;
  // dp[i][w] = best value using items 0..i-1 with capacity w
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(capacity + 1).fill(0),
  );

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (weights[i - 1] <= w) {
        const take = dp[i - 1][w - weights[i - 1]] + values[i - 1];
        if (take > dp[i][w]) dp[i][w] = take;
      }
    }
  }

  // Backtrack to find chosen items
  const items: number[] = [];
  let w = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      items.push(i - 1);
      w -= weights[i - 1];
    }
  }
  items.reverse();

  return { maxValue: dp[n][capacity], items };
}

/**
 * Longest Increasing Subsequence — returns one actual LIS (not just
 * the length). Uses patience-sorting style O(n log n) for length,
 * with predecessor tracking for reconstruction.
 */
export function longestIncreasingSubsequence(arr: number[]): number[] {
  const n = arr.length;
  if (n === 0) return [];

  const tails: number[] = [];        // tails[i] = smallest tail of IS length i+1
  const tailIdx: number[] = [];      // index in arr for tails
  const pred: number[] = new Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    // Binary search for first tail >= arr[i]
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (tails[mid] < arr[i]) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = arr[i];
    tailIdx[lo] = i;
    pred[i] = lo > 0 ? tailIdx[lo - 1] : -1;
  }

  // Reconstruct
  const lisLen = tails.length;
  const result: number[] = new Array(lisLen);
  let k = tailIdx[lisLen - 1];
  for (let i = lisLen - 1; i >= 0; i--) {
    result[i] = arr[k];
    k = pred[k];
  }
  return result;
}

/**
 * Edit distance (Levenshtein) between two strings.
 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use 1-D rolling array for space efficiency
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Minimum number of coins to make `amount`. Returns -1 if impossible.
 */
export function coinChange(coins: number[], amount: number): number {
  if (amount === 0) return 0;
  const dp = new Array<number>(amount + 1).fill(Infinity);
  dp[0] = 0;

  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) {
        dp[a] = dp[a - c] + 1;
      }
    }
  }

  return dp[amount] === Infinity ? -1 : dp[amount];
}

/**
 * Rod cutting. Given `prices[i]` = price of a rod of length i+1, find
 * the maximum revenue obtainable for a rod of length `length`, and the
 * list of piece lengths used (sorted ascending).
 */
export function rodCutting(
  prices: number[],
  length: number,
): { maxProfit: number; cuts: number[] } {
  const dp = new Array<number>(length + 1).fill(0);
  const choice = new Array<number>(length + 1).fill(0);

  for (let l = 1; l <= length; l++) {
    for (let i = 1; i <= Math.min(l, prices.length); i++) {
      const val = prices[i - 1] + dp[l - i];
      if (val > dp[l]) {
        dp[l] = val;
        choice[l] = i;
      }
    }
  }

  // Reconstruct cuts
  const cuts: number[] = [];
  let rem = length;
  while (rem > 0) {
    cuts.push(choice[rem]);
    rem -= choice[rem];
  }
  cuts.sort((a, b) => a - b);

  return { maxProfit: dp[length], cuts };
}

/**
 * Subset sum — returns true iff some subset of `nums` sums to `target`.
 */
export function subsetSum(nums: number[], target: number): boolean {
  if (target === 0) return true;
  if (target < 0) return false;

  const dp = new Uint8Array(target + 1);
  dp[0] = 1;

  for (const num of nums) {
    // Traverse right-to-left so each item used at most once
    for (let s = target; s >= num; s--) {
      if (dp[s - num]) dp[s] = 1;
    }
  }

  return dp[target] === 1;
}

/**
 * Longest Palindromic Subsequence — returns one actual LPS string.
 */
export function longestPalindromicSubsequence(s: string): string {
  const n = s.length;
  if (n === 0) return '';
  if (n === 1) return s;

  // dp[i][j] = length of LPS of s[i..j]
  const dp: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  );

  for (let i = 0; i < n; i++) dp[i][i] = 1;

  for (let l = 2; l <= n; l++) {
    for (let i = 0; i <= n - l; i++) {
      const j = i + l - 1;
      if (s[i] === s[j]) {
        dp[i][j] = (l === 2 ? 0 : dp[i + 1][j - 1]) + 2;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct
  const half: string[] = [];
  let i = 0;
  let j = n - 1;
  while (i < j) {
    if (s[i] === s[j]) {
      half.push(s[i]);
      i++;
      j--;
    } else if (dp[i + 1][j] >= dp[i][j - 1]) {
      i++;
    } else {
      j--;
    }
  }

  const middle = i === j ? s[i] : '';
  return half.join('') + middle + half.slice().reverse().join('');
}
