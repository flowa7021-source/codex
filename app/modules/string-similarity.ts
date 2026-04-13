// @ts-check
// ─── String Similarity Algorithms ───────────────────────────────────────────
// A collection of classic string similarity and distance functions useful for
// approximate matching, spell checking, and text comparison tasks.

// ─── Levenshtein Distance ────────────────────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between two strings.
 * Counts the minimum number of single-character insertions, deletions,
 * and substitutions needed to transform `a` into `b`.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows to save memory.
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ─── Damerau-Levenshtein Distance ────────────────────────────────────────────

/**
 * Compute the Damerau-Levenshtein distance between two strings.
 * Like Levenshtein but also counts transpositions of adjacent characters
 * as a single edit operation.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // d[i][j] = distance between a[0..i-1] and b[0..j-1]
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,        // deletion
        d[i][j - 1] + 1,        // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost); // transposition
      }
    }
  }

  return d[m][n];
}

// ─── Hamming Distance ─────────────────────────────────────────────────────────

/**
 * Compute the Hamming distance between two strings of equal length.
 * Counts the number of positions where the corresponding characters differ.
 * Throws a `RangeError` if the strings have different lengths.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new RangeError(
      `hammingDistance requires equal-length strings (got ${a.length} and ${b.length})`,
    );
  }

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

// ─── Jaccard Similarity ──────────────────────────────────────────────────────

/**
 * Compute the Jaccard similarity between two strings based on their character
 * bigram sets.  Returns a value in [0, 1] where 1 means identical bigram sets.
 * Falls back to exact equality check when either string is shorter than 2 chars.
 */
export function jaccardSimilarity(a: string, b: string): number {
  // For very short strings use character unigrams.
  const ngramSize = Math.min(2, Math.min(a.length, b.length) === 0 ? 1 : 2);

  const setA = buildNgramSet(a, ngramSize);
  const setB = buildNgramSet(b, ngramSize);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const ngram of setA) {
    if (setB.has(ngram)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function buildNgramSet(str: string, n: number): Set<string> {
  const set = new Set<string>();
  if (str.length === 0) return set;
  if (str.length < n) {
    set.add(str);
    return set;
  }
  for (let i = 0; i <= str.length - n; i++) {
    set.add(str.slice(i, i + n));
  }
  return set;
}

// ─── Cosine Similarity (character frequency vectors) ─────────────────────────

/**
 * Compute the cosine similarity between two strings using their character
 * frequency vectors.  Returns a value in [0, 1] where 1 means identical
 * character distributions.
 */
export function cosineSimilarityStr(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const freqA = charFrequency(a);
  const freqB = charFrequency(b);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  const allChars = new Set([...freqA.keys(), ...freqB.keys()]);
  for (const ch of allChars) {
    const fa = freqA.get(ch) ?? 0;
    const fb = freqB.get(ch) ?? 0;
    dot += fa * fb;
  }
  for (const v of freqA.values()) normA += v * v;
  for (const v of freqB.values()) normB += v * v;

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function charFrequency(str: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const ch of str) {
    map.set(ch, (map.get(ch) ?? 0) + 1);
  }
  return map;
}

// ─── Longest Common Subsequence ──────────────────────────────────────────────

/**
 * Compute the length of the Longest Common Subsequence (LCS) of two strings.
 * Characters need not be contiguous but must appear in the same order.
 */
export function longestCommonSubsequence(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0 || n === 0) return 0;

  // Use two rows to save memory.
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ─── Longest Common Substring ─────────────────────────────────────────────────

/**
 * Find the longest common substring (contiguous characters) shared by `a`
 * and `b`.  Returns the actual substring string (empty string if none).
 */
export function longestCommonSubstring(a: string, b: string): string {
  const m = a.length;
  const n = b.length;

  if (m === 0 || n === 0) return '';

  let maxLen = 0;
  let endIndex = 0; // ending index in `a`

  // dp[i][j] = length of LCS ending at a[i-1] and b[j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endIndex = i;
        }
      }
    }
  }

  return a.slice(endIndex - maxLen, endIndex);
}

// ─── Similarity Ratio ────────────────────────────────────────────────────────

/**
 * Compute a normalised similarity ratio in [0, 1] based on Levenshtein
 * distance.  Returns 1 for identical strings and 0 for maximally different
 * ones.
 */
export function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}
