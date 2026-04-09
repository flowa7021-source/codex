// @ts-check
// ─── Fuzzy Matcher ───────────────────────────────────────────────────────────
// Fuzzy string matching with scoring, search, similarity, and highlighting.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FuzzyMatch {
  item: string;
  score: number;    // 0-1, higher is better
  indices: number[]; // matched character positions in item
}

export interface FuzzyOptions {
  threshold?: number;      // minimum score, default 0.3
  caseSensitive?: boolean; // default false
  limit?: number;          // max results, default 10
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Check if `pattern` is a subsequence of `str` and collect matched indices.
 * Returns null if pattern cannot be matched as a subsequence.
 */
function subsequenceMatch(pattern: string, str: string): number[] | null {
  const indices: number[] = [];
  let pi = 0;
  for (let si = 0; si < str.length && pi < pattern.length; si++) {
    if (str[si] === pattern[pi]) {
      indices.push(si);
      pi++;
    }
  }
  return pi === pattern.length ? indices : null;
}

/**
 * Score a set of matched indices against the original `str`.
 *
 * Factors:
 *  - Consecutive run bonus: each run of consecutive indices contributes a bonus
 *  - Word-start bonus: match at position 0 or after a non-alphanumeric char
 *  - Coverage: matched / total length
 *
 * Returns a value in [0, 1].
 */
function scoreIndices(indices: number[], str: string): number {
  if (indices.length === 0) return 0;

  const matchCount = indices.length;
  const strLen = str.length;

  // Coverage factor
  const coverage = matchCount / strLen;

  // Consecutive runs bonus
  let consecutiveBonus = 0;
  let run = 1;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) {
      run++;
    } else {
      if (run > 1) consecutiveBonus += run * run;
      run = 1;
    }
  }
  if (run > 1) consecutiveBonus += run * run;
  // Normalise consecutive bonus against worst case (all matches consecutive)
  const maxConsecutive = matchCount * matchCount;
  const normConsecutive = maxConsecutive > 0 ? consecutiveBonus / maxConsecutive : 0;

  // Word-start bonus
  let wordStartBonus = 0;
  for (const idx of indices) {
    if (idx === 0 || !/[a-zA-Z0-9]/.test(str[idx - 1])) {
      wordStartBonus++;
    }
  }
  const normWordStart = matchCount > 0 ? wordStartBonus / matchCount : 0;

  // Weighted combination
  const score = coverage * 0.3 + normConsecutive * 0.5 + normWordStart * 0.2;

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, score));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fuzzy match a pattern against a single string.
 * Returns null if below threshold.
 */
export function fuzzyMatch(
  pattern: string,
  str: string,
  options?: FuzzyOptions,
): FuzzyMatch | null {
  const threshold = options?.threshold ?? 0.3;
  const caseSensitive = options?.caseSensitive ?? false;

  if (pattern.length === 0) {
    // Empty pattern matches everything with score 1
    return { item: str, score: 1, indices: [] };
  }

  const normalPattern = caseSensitive ? pattern : pattern.toLowerCase();
  const normalStr = caseSensitive ? str : str.toLowerCase();

  const indices = subsequenceMatch(normalPattern, normalStr);
  if (indices === null) return null;

  const score = scoreIndices(indices, normalStr);
  if (score < threshold) return null;

  return { item: str, score, indices };
}

/**
 * Fuzzy search pattern in a list of strings.
 * Returns ranked matches (highest score first).
 */
export function fuzzySearch(
  pattern: string,
  items: string[],
  options?: FuzzyOptions,
): FuzzyMatch[] {
  const limit = options?.limit ?? 10;

  const matches: FuzzyMatch[] = [];
  for (const item of items) {
    const m = fuzzyMatch(pattern, item, options);
    if (m !== null) matches.push(m);
  }

  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit);
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * normalised to the longer string's length.
 * Returns a value in [0, 1] where 1 = identical.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  if (lenA === 0 || lenB === 0) return 0;

  // Levenshtein distance using two rows
  const prev: number[] = Array.from({ length: lenB + 1 }, (_, i) => i);
  const curr: number[] = new Array(lenB + 1).fill(0);

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost,   // substitution
      );
    }
    prev.splice(0, prev.length, ...curr);
  }

  const distance = prev[lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

/**
 * Highlight matched characters in a string by wrapping each matched index
 * with `open` and `close` tags.
 * Defaults: open = '<mark>', close = '</mark>'
 */
export function highlight(
  str: string,
  indices: number[],
  open = '<mark>',
  close = '</mark>',
): string {
  if (indices.length === 0) return str;

  const indexSet = new Set(indices);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    if (indexSet.has(i)) {
      result += open + str[i] + close;
    } else {
      result += str[i];
    }
  }
  return result;
}
