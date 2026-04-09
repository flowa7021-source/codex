// @ts-check
// ─── String Distance ─────────────────────────────────────────────────────────
// String distance and similarity algorithms.
// No browser APIs — pure algorithmic implementations.

// ─── Levenshtein ─────────────────────────────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between two strings.
 * Supports insert, delete, and substitute operations (cost 1 each).
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use two rows to save memory
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

// ─── Damerau-Levenshtein ─────────────────────────────────────────────────────

/**
 * Compute the Damerau-Levenshtein distance (optimal string alignment variant).
 * Supports insert, delete, substitute, and transposition of adjacent characters.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // dp[i][j] = distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // deletion
        dp[i][j - 1] + 1,     // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
      // transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }

  return dp[m][n];
}

// ─── Hamming ─────────────────────────────────────────────────────────────────

/**
 * Compute the Hamming distance between two equal-length strings.
 * Counts positions where characters differ.
 * Throws if the strings have different lengths.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new RangeError(
      `hammingDistance requires equal-length strings (got ${a.length} and ${b.length})`,
    );
  }
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

// ─── Jaccard Similarity ───────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two strings (treated as sets of characters).
 * Returns a value in [0, 1] where 1 means identical character sets.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a);
  const setB = new Set(b);

  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

// ─── Jaro Similarity ─────────────────────────────────────────────────────────

/**
 * Compute the Jaro similarity between two strings.
 * Returns a value in [0, 1] where 1 means identical.
 */
export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDist = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);

  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  return (
    (matches / a.length +
      matches / b.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}

// ─── Jaro-Winkler ────────────────────────────────────────────────────────────

/**
 * Compute the Jaro-Winkler similarity between two strings.
 * Boosts the Jaro score for strings sharing a common prefix.
 * `p` is the scaling factor (default 0.1, standard max is 0.25).
 * Returns a value in [0, 1].
 */
export function jaroWinkler(a: string, b: string, p = 0.1): number {
  const jaro = jaroSimilarity(a, b);

  // Find common prefix length (max 4)
  let l = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  while (l < maxPrefix && a[l] === b[l]) l++;

  return jaro + l * p * (1 - jaro);
}

// ─── Longest Common Subsequence ──────────────────────────────────────────────

/**
 * Find the longest common subsequence (LCS) of two strings.
 * Returns the LCS as a string (not necessarily contiguous).
 */
export function longestCommonSubsequence(a: string, b: string): string {
  const m = a.length;
  const n = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct LCS
  let result = '';
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result = a[i - 1] + result;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

// ─── Longest Common Substring ─────────────────────────────────────────────────

/**
 * Find the longest common contiguous substring of two strings.
 * Returns the substring itself.
 */
export function longestCommonSubstring(a: string, b: string): string {
  const m = a.length;
  const n = b.length;

  let maxLen = 0;
  let endIdx = 0; // end index in `a`

  // Use two rows for memory efficiency
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > maxLen) {
          maxLen = curr[j];
          endIdx = i;
        }
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return a.slice(endIdx - maxLen, endIdx);
}

// ─── Anagram ─────────────────────────────────────────────────────────────────

/**
 * Check whether two strings are anagrams of each other.
 * Case insensitive; ignores spaces.
 */
export function isAnagram(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s/g, '')
      .split('')
      .sort()
      .join('');
  return normalize(a) === normalize(b);
}

// ─── Palindrome ──────────────────────────────────────────────────────────────

/**
 * Check whether a string is a palindrome.
 * Case insensitive; ignores spaces.
 */
export function isPalindrome(s: string): boolean {
  const cleaned = s.toLowerCase().replace(/\s/g, '');
  const reversed = cleaned.split('').reverse().join('');
  return cleaned === reversed;
}
