// @ts-check
// ─── Fuzzy Search ────────────────────────────────────────────────────────────
// Lightweight fuzzy matching utilities.  All functions operate on plain
// strings and are suitable for filtering lists of items in real time.

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single result returned by `fuzzySearch` or a `FuzzySearcher`. */
export interface FuzzyResult {
  /** The original item string. */
  item: string;
  /** Match quality in [0, 1]; higher is better. */
  score: number;
  /** Zero-based indices in `item` where pattern characters were matched. */
  indices: number[];
}

// ─── fuzzyMatch ──────────────────────────────────────────────────────────────

/**
 * Return `true` when every character of `pattern` appears in `text` in order
 * (though not necessarily contiguously).  The check is case-sensitive.
 */
export function fuzzyMatch(pattern: string, text: string): boolean {
  if (pattern.length === 0) return true;
  if (pattern.length > text.length) return false;

  let pi = 0;
  for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
    if (pattern[pi] === text[ti]) pi++;
  }
  return pi === pattern.length;
}

// ─── fuzzyScore ──────────────────────────────────────────────────────────────

/**
 * Score how well `pattern` matches `text` as a value in [0, 1].
 *
 * The algorithm rewards:
 * - Consecutive character runs (each additional consecutive match adds a
 *   bonus that grows with run length).
 * - Matches near the start of `text`.
 *
 * Returns 0 when `pattern` does not match `text` at all.
 */
export function fuzzyScore(pattern: string, text: string): number {
  if (pattern.length === 0) return 1;
  if (!fuzzyMatch(pattern, text)) return 0;
  if (pattern === text) return 1;

  let score = 0;
  let consecutiveBonus = 0;
  let pi = 0;
  let prevMatchIndex = -2;

  for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
    if (pattern[pi] === text[ti]) {
      // Base score: higher for earlier positions.
      const positionScore = 1 - ti / text.length;
      score += positionScore;

      // Consecutive bonus: grows with run length.
      if (ti === prevMatchIndex + 1) {
        consecutiveBonus += 2;
        score += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }

      prevMatchIndex = ti;
      pi++;
    }
  }

  // Normalise: max possible score is when every character matches
  // consecutively at position 0.  Compute that ceiling and clamp to [0, 1].
  const maxScore = computeMaxScore(pattern.length, text.length);
  return maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
}

/**
 * Compute the theoretical maximum score for a pattern of length `p` matched
 * against a text of length `t`, assuming all characters match at positions
 * 0 .. p-1 (best possible consecutive run from position 0).
 */
function computeMaxScore(p: number, t: number): number {
  let score = 0;
  let consecutiveBonus = 0;
  for (let i = 0; i < p; i++) {
    const positionScore = 1 - i / t;
    score += positionScore;
    if (i > 0) {
      consecutiveBonus += 2;
      score += consecutiveBonus;
    }
  }
  return score;
}

// ─── fuzzySearch ─────────────────────────────────────────────────────────────

/**
 * Search `items` for strings that fuzzy-match `pattern`.
 *
 * Returns an array of `FuzzyResult` objects sorted by descending score.
 * Items that do not match (score === 0) are excluded.
 */
export function fuzzySearch(
  pattern: string,
  items: string[],
): FuzzyResult[] {
  const results: FuzzyResult[] = [];

  for (const item of items) {
    const score = fuzzyScore(pattern, item);
    if (score > 0) {
      results.push({ item, score, indices: matchIndices(pattern, item) });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Return the zero-based indices in `text` where each character of `pattern`
 * was matched (greedy, left-to-right).
 */
function matchIndices(pattern: string, text: string): number[] {
  const indices: number[] = [];
  let pi = 0;
  for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
    if (pattern[pi] === text[ti]) {
      indices.push(ti);
      pi++;
    }
  }
  return indices;
}

// ─── createFuzzySearcher ─────────────────────────────────────────────────────

/**
 * Factory that creates a reusable fuzzy searcher bound to a fixed `items`
 * array.  The returned function accepts a `pattern` and returns scored,
 * sorted results identical to `fuzzySearch`.
 */
export function createFuzzySearcher(
  items: string[],
): (pattern: string) => FuzzyResult[] {
  return (pattern: string) => fuzzySearch(pattern, items);
}
