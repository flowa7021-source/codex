// @ts-check
// ─── Edit Distance / String Alignment ───────────────────────────────────────
// Classical dynamic-programming algorithms for measuring and aligning strings.

// ─── Levenshtein Distance ────────────────────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between strings `a` and `b`.
 * Allowed operations (each cost 1): insertion, deletion, substitution.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Optimization: use two rows instead of the full matrix.
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let curr: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ─── Damerau-Levenshtein Distance ───────────────────────────────────────────

/**
 * Compute the Damerau-Levenshtein edit distance between strings `a` and `b`.
 * Extends Levenshtein by also allowing transposition of two adjacent characters
 * (cost 1), using the optimal string alignment (restricted) variant.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Full (m+1) × (n+1) matrix needed to access d[i-2][j-2] for transpositions.
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,           // deletion
        d[i][j - 1] + 1,           // insertion
        d[i - 1][j - 1] + cost,    // substitution
      );
      // Transposition: a[i-1] ↔ a[i-2] matches b[j-1] ↔ b[j-2]
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  return d[m][n];
}

// ─── Longest Common Subsequence ──────────────────────────────────────────────

/**
 * Return the length of the Longest Common Subsequence of `a` and `b`.
 * Uses the standard O(mn) DP with two-row space optimisation.
 */
export function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  let prev: number[] = new Array(n + 1).fill(0);
  let curr: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}

/**
 * Return the Longest Common Subsequence of `a` and `b` as a string.
 * When multiple LCS strings of the same length exist, one is returned
 * (no guarantee on which one).
 */
export function longestCommonSubsequence(a: string, b: string): string {
  const m = a.length;
  const n = b.length;

  // Build the full DP table for back-tracking.
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Back-track to reconstruct the LCS string.
  let i = m;
  let j = n;
  const parts: string[] = [];

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      parts.push(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return parts.reverse().join('');
}

// ─── Needleman-Wunsch Global Alignment ──────────────────────────────────────

/** Result of a global sequence alignment. */
export interface AlignmentResult {
  /** The optimal alignment score. */
  score: number;
  /** String `a` with gap characters (`-`) inserted. */
  alignedA: string;
  /** String `b` with gap characters (`-`) inserted. */
  alignedB: string;
}

/**
 * Perform Needleman-Wunsch global alignment of `a` and `b`.
 * Scoring: match = +1, mismatch = −1, gap = −2.
 * Returns the score and the two aligned strings (gaps represented as `'-'`).
 */
export function alignment(a: string, b: string): AlignmentResult {
  const MATCH = 1;
  const MISMATCH = -1;
  const GAP = -2;

  const m = a.length;
  const n = b.length;

  // Initialise score matrix.
  // Note: `0 * GAP` would yield −0 in JavaScript, so the base cell is set to 0 explicitly.
  const score: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 && j === 0 ? 0 : i === 0 ? j * GAP : j === 0 ? i * GAP : 0)),
  );

  // Fill score matrix.
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = score[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? MATCH : MISMATCH);
      const up   = score[i - 1][j] + GAP;
      const left = score[i][j - 1] + GAP;
      score[i][j] = Math.max(diag, up, left);
    }
  }

  // Back-track to reconstruct aligned strings.
  let i = m;
  let j = n;
  const partsA: string[] = [];
  const partsB: string[] = [];

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      score[i][j] === score[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? MATCH : MISMATCH)
    ) {
      partsA.push(a[i - 1]);
      partsB.push(b[j - 1]);
      i--;
      j--;
    } else if (i > 0 && score[i][j] === score[i - 1][j] + GAP) {
      partsA.push(a[i - 1]);
      partsB.push('-');
      i--;
    } else {
      partsA.push('-');
      partsB.push(b[j - 1]);
      j--;
    }
  }

  return {
    score: score[m][n],
    alignedA: partsA.reverse().join(''),
    alignedB: partsB.reverse().join(''),
  };
}

// ─── Normalized Similarity ───────────────────────────────────────────────────

/**
 * Normalized similarity score in [0, 1] based on Levenshtein distance.
 *
 * ```
 * similarity = 1 − levenshtein(a, b) / max(|a|, |b|)
 * ```
 *
 * Returns `1` for identical strings (including two empty strings) and `0`
 * when every character must be replaced (worst case).
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1; // both empty → identical
  return 1 - levenshtein(a, b) / maxLen;
}
