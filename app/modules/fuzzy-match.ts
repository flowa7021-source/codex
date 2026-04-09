// @ts-check
// ─── Fuzzy Match ─────────────────────────────────────────────────────────────
// Fuzzy string matching utilities: Levenshtein distance, similarity scoring,
// subsequence-based fuzzy matching, and HTML highlight helpers.

// ─── levenshtein ─────────────────────────────────────────────────────────────

/**
 * Compute the Levenshtein (edit) distance between two strings.
 *
 * Uses a space-optimised single-row dynamic-programming approach (O(n) space).
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Minimum number of single-character edits to transform `a` into `b`.
 *
 * @example
 *   levenshtein('kitten', 'sitting'); // 3
 *   levenshtein('', '');             // 0
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep two rows: previous and current.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    // Swap rows without allocating.
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

// ─── similarity ──────────────────────────────────────────────────────────────

/**
 * Compute a normalised similarity score between two strings.
 *
 * The score is `1 - distance / maxLength`, clipped to [0, 1].
 * Identical strings return `1.0`; completely dissimilar strings approach `0`.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Similarity in [0, 1].
 *
 * @example
 *   similarity('hello', 'hello'); // 1
 *   similarity('abc', 'xyz');     // 0
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ─── fuzzyMatch ──────────────────────────────────────────────────────────────

/**
 * Fuzzy match a query against a text using a greedy subsequence search.
 *
 * Each character of the query must appear in the text in order (subsequence
 * matching). Consecutive matched characters are rewarded with a higher score.
 *
 * @param query - Query string.
 * @param text  - Text to match against.
 * @returns `{ score, indices }` when at least all query characters are found
 *          as a subsequence of text, or `null` when no match is possible.
 *
 * @example
 *   fuzzyMatch('abc', 'abc');        // { score: 1, indices: [0,1,2] }
 *   fuzzyMatch('ac', 'abcd');        // { score: ..., indices: [0,2] }
 *   fuzzyMatch('xyz', 'hello');      // null
 */
export function fuzzyMatch(
  query: string,
  text: string,
): { score: number; indices: number[] } | null {
  if (query.length === 0) return { score: 1, indices: [] };

  const qLower = query.toLowerCase();
  const tLower = text.toLowerCase();

  // Greedy left-to-right subsequence search.
  const indices: number[] = [];
  let ti = 0;
  for (let qi = 0; qi < qLower.length; qi++) {
    let found = false;
    while (ti < tLower.length) {
      if (tLower[ti] === qLower[qi]) {
        indices.push(ti);
        ti++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) return null;
  }

  // Score: reward consecutive matches and penalise gaps.
  // Base score = matched chars / text length; bonus for consecutive runs.
  let consecutiveBonus = 0;
  let consecutive = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) {
      consecutive++;
      consecutiveBonus += consecutive;
    } else {
      consecutive = 1;
    }
  }

  // Exact match shortcut.
  if (indices.length === text.length && indices.length === query.length) {
    return { score: 1, indices };
  }

  const matchRatio = query.length / text.length;
  const bonusRatio = consecutiveBonus / (query.length * query.length + 1);
  const score = Math.min(1, matchRatio * 0.7 + bonusRatio * 0.3);

  return { score, indices };
}

// ─── findBestMatch ───────────────────────────────────────────────────────────

/**
 * Find the best fuzzy match for a query among a list of candidate strings.
 *
 * @param query      - Query string.
 * @param candidates - List of strings to search.
 * @param threshold  - Minimum score to consider a match (default: 0.1).
 * @returns The best-scoring candidate or `null` if none meet the threshold.
 *
 * @example
 *   findBestMatch('wrld', ['world', 'word', 'ward']); // { match: 'world', ... }
 */
export function findBestMatch(
  query: string,
  candidates: string[],
  threshold = 0.1,
): { match: string; score: number; index: number } | null {
  let best: { match: string; score: number; index: number } | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const result = fuzzyMatch(query, candidates[i]);
    if (!result) continue;
    if (result.score < threshold) continue;
    if (!best || result.score > best.score) {
      best = { match: candidates[i], score: result.score, index: i };
    }
  }

  return best;
}

// ─── fuzzyFilter ─────────────────────────────────────────────────────────────

/**
 * Filter and rank a list of strings by fuzzy match to a query.
 *
 * @param query      - Query string.
 * @param candidates - List of strings to filter.
 * @param threshold  - Minimum score to include (default: 0.1).
 * @returns Candidates that match, sorted by score descending.
 *
 * @example
 *   fuzzyFilter('wrd', ['world', 'word', 'unrelated']);
 *   // [{ item: 'word', score: ..., index: 1 }, { item: 'world', score: ..., index: 0 }]
 */
export function fuzzyFilter(
  query: string,
  candidates: string[],
  threshold = 0.1,
): Array<{ item: string; score: number; index: number }> {
  // Empty query — return all candidates with score 1, preserving order.
  if (query.length === 0) {
    return candidates.map((item, index) => ({ item, score: 1, index }));
  }

  const results: Array<{ item: string; score: number; index: number }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const result = fuzzyMatch(query, candidates[i]);
    if (!result || result.score < threshold) continue;
    results.push({ item: candidates[i], score: result.score, index: i });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ─── highlightMatches ────────────────────────────────────────────────────────

/**
 * Wrap characters at the given `indices` with `<mark>` HTML tags.
 *
 * Adjacent matched indices are merged into a single `<mark>` span for cleaner
 * output. Non-matched characters are returned as plain text (HTML-escaped).
 *
 * @param text    - Original string.
 * @param indices - Sorted array of matched character positions.
 * @returns HTML string with matched characters wrapped in `<mark>` tags.
 *
 * @example
 *   highlightMatches('hello', [0, 1]); // '<mark>he</mark>llo'
 *   highlightMatches('world', []);     // 'world'
 */
export function highlightMatches(text: string, indices: number[]): string {
  if (indices.length === 0) return escapeHtml(text);

  const matchSet = new Set(indices);
  let result = '';
  let inMark = false;

  for (let i = 0; i < text.length; i++) {
    const char = escapeHtml(text[i]);
    if (matchSet.has(i)) {
      if (!inMark) {
        result += '<mark>';
        inMark = true;
      }
      result += char;
    } else {
      if (inMark) {
        result += '</mark>';
        inMark = false;
      }
      result += char;
    }
  }
  if (inMark) result += '</mark>';

  return result;
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/** Escape HTML special characters in a single character or string. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
